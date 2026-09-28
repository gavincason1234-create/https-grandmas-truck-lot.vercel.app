"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { safeAdminBack } from "@/lib/auth/next";
import { AuthError, requireAdminApi } from "@/lib/auth/session";
import { formatPhone } from "@/lib/codes";
import { addMonths, isIsoDay, nextBillAfter, todayStr } from "@/lib/dates";
import { parseDollars } from "@/lib/money";
import { refundBooking, stopMemberBilling } from "@/lib/services/refunds";
import { isSimulated } from "@/lib/services/reservations";
import { loadSampleData, sampleDataAllowed } from "@/lib/services/sample";
import { getStore, StoreError } from "@/lib/store";
import type { LotSettings, OverheadLine, Photo, PrivateSettings, SessionUser } from "@/lib/types";

/*
 * Every button on the owner dashboard lands here.
 * Each action: check the owner is signed in → read the form → change the store → write the log → go back.
 * Nothing here trusts the browser: the id is looked up again and every field is validated.
 */

const TONIGHT = "/admin";
const BOOKINGS = "/admin/bookings";
const MONTHLY = "/admin/monthly";
const REVIEWS = "/admin/reviews";
const SETTINGS = "/admin/settings";

/** Who is tapping the button. Anyone who is not an owner is sent to sign in. */
async function owner(): Promise<SessionUser> {
  try {
    return await requireAdminApi();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?next=/admin");
    throw err;
  }
}

type Outcome = { to?: string } | { error: string };

function withQuery(path: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  if (!q) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${q}`;
}

/**
 * Where to land after a booking button: the page it was tapped on (its hidden "back" field) when
 * that is one of our dashboard pages, else the tab the action belongs to. The check lives in
 * auth/next.ts next to safeNext(), where it is unit tested.
 */
function returnTo(fd: FormData, fallback: string): string {
  return safeAdminBack(text(fd, "back"), fallback);
}

/** Do the work, then go back to the page — with a plain-words message when something went wrong. */
async function finish(path: string, work: () => Promise<Outcome | void>): Promise<void> {
  let outcome: Outcome = {};
  try {
    outcome = (await work()) ?? {};
  } catch (err) {
    console.error("admin action failed", err);
    outcome = { error: err instanceof StoreError ? err.message : "Something went wrong. Try again in a moment." };
  }
  if ("error" in outcome) {
    redirect(withQuery(path, { error: outcome.error }));
  } else {
    // Stall counts show on the home page, the booking page and the lot page too.
    revalidatePath("/", "layout");
    redirect(outcome.to ?? path);
  }
}

/* ---------- form helpers ---------- */

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function texts(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => (typeof v === "string" ? v.trim() : ""));
}

/** Checkboxes only show up in the form when ticked. */
function checked(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

function idOf(fd: FormData): string | null {
  const id = text(fd, "id");
  return id.length > 0 && id.length <= 120 ? id : null;
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form and try again.";
}

const GONE_BOOKING = "That booking is gone — someone else may have removed it.";
const GONE_MEMBER = "That member is gone — someone else may have removed them.";
const GONE_REVIEW = "That review is gone — it may already be deleted.";

/* ============================================================
 * TONIGHT — nightly bookings
 * ============================================================ */

export async function markArrived(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, TONIGHT), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    await store.updateBooking(id, { status: "parked" });
    await audit(user, "admin.mark_arrived", b.code, { name: b.name, arrive: b.arrive });
  });
}

export async function markNoShow(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, TONIGHT), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    // A no-show keeps what they paid (the posted policy) but frees the stall.
    await store.updateBooking(id, { status: "cancelled" });
    await audit(user, "admin.no_show", b.code, { name: b.name, arrive: b.arrive, paid: b.paid, amountCents: b.amountCents });
  });
}

export async function markPaid(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, TONIGHT), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    await store.updateBooking(id, { paid: true, ...(b.status === "pending_payment" ? { status: "reserved" as const } : {}) });
    await audit(user, "admin.mark_paid", b.code, { name: b.name, amountCents: b.amountCents, how: "owner marked paid" });
  });
}

export async function markDeparted(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, TONIGHT), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    await store.updateBooking(id, { status: "departed" });
    await audit(user, "admin.mark_departed", b.code, { name: b.name, paid: b.paid });
  });
}

export async function cancelRefund(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  const back = returnTo(formData, TONIGHT);
  return finish(back, async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    const refund = await refundBooking(b);
    // If the card refund failed, keep the money counted and tell the owner to finish it in Stripe.
    await store.updateBooking(id, { status: "cancelled", paid: refund === "failed" ? b.paid : false });
    await audit(user, "admin.cancel_refund", b.code, { name: b.name, arrive: b.arrive, refundCents: b.paid ? b.amountCents : 0, paymentRef: b.paymentRef, refund });
    if (refund === "failed") return { to: withQuery(back, { error: `${b.name}'s reservation is cancelled, but the card refund did not go through. Refund it from the Stripe dashboard.` }) };
  });
}

export async function removeBooking(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, TONIGHT), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    // Never delete a stay: the Money tab adds up every row. Just take it off the Tonight list.
    await store.updateBooking(id, { hidden: true });
    await audit(user, "admin.hide_booking", b.code, { name: b.name, status: b.status, arrive: b.arrive });
  });
}

/** Undo "Hide": the stay shows under Recently left on Tonight again. */
export async function restoreBooking(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, BOOKINGS), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    await store.updateBooking(id, { hidden: false });
    await audit(user, "admin.unhide_booking", b.code, { name: b.name, status: b.status, arrive: b.arrive });
  });
}

export async function cancelHold(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(returnTo(formData, TONIGHT), async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const b = await store.getBooking(id);
    if (!b) return { error: GONE_BOOKING };
    await store.updateBooking(id, { status: "cancelled", paid: false });
    await audit(user, "admin.cancel_hold", b.code, { name: b.name, arrive: b.arrive });
  });
}

const walkUpSchema = z.object({
  name: z.string().trim().min(1, "Add the driver's name.").max(80, "That name is too long."),
  phone: z.string().trim().max(25, "That phone number is too long."),
  truck: z.string().trim().max(80, "Keep the truck description short."),
  plate: z.string().trim().max(20, "That plate is too long."),
  nights: z.coerce.number({ error: "Nights must be a number." }).int("Nights must be a whole number.").min(1, "At least 1 night.").max(30, "Up to 30 nights at a time."),
  paid: z.boolean(),
});

/** A driver pulled in and paid cash (or will). Books tonight, parked right away. */
export async function addWalkUp(formData: FormData): Promise<void> {
  const user = await owner();
  const parsed = walkUpSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    truck: text(formData, "truck"),
    plate: text(formData, "plate"),
    nights: text(formData, "nights") || "1",
    paid: checked(formData, "paid"),
  });
  return finish(TONIGHT, async () => {
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const input = parsed.data;
    const store = getStore();
    const settings = await store.getSettings();
    const today = todayStr();
    const booking = await store.createBooking({
      userId: null,
      name: input.name,
      phone: input.phone ? formatPhone(input.phone) : "",
      company: "",
      truck: input.truck,
      plate: input.plate.toUpperCase(),
      arrive: today,
      nights: input.nights,
      extras: { showers: 0, loads: 0 },
      amountCents: input.nights * settings.nightlyCents,
      paid: input.paid,
      status: "parked",
      paymentRef: null,
    });
    await audit(user, "admin.add_walk_up", booking.code, { name: booking.name, nights: booking.nights, paid: booking.paid, amountCents: booking.amountCents });
    return { to: withQuery(TONIGHT, { added: booking.code }) };
  });
}

/* ============================================================
 * MONTHLY — members
 * ============================================================ */

export async function chargeMember(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(MONTHLY, async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const m = await store.getMember(id);
    if (!m) return { error: GONE_MEMBER };
    if (m.status === "cancelled") return { error: `${m.name}'s membership is cancelled. Add them again to start over.` };
    const simulated = isSimulated();
    // No card is charged from this button. It records money the owner already took (cash, check,
    // a card run on the lot) or, in test mode, a pretend charge. Card members renew through Stripe.
    const note = simulated ? "Monthly charge (simulated)" : "Payment recorded by owner";
    const nextBill = nextBillAfter(m.started, m.nextBill);
    const payment = await store.addMemberPayment({ memberId: id, date: todayStr(), amountCents: m.amountCents, note });
    await store.updateMember(id, { nextBill, status: "active" });
    await audit(user, "admin.charge_member", m.code, { name: m.name, amountCents: m.amountCents, paymentId: payment.id, simulated, nextBill });
  });
}

export async function markPastDue(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(MONTHLY, async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const m = await store.getMember(id);
    if (!m) return { error: GONE_MEMBER };
    await store.updateMember(id, { status: "past_due" });
    await audit(user, "admin.mark_past_due", m.code, { name: m.name, nextBill: m.nextBill });
  });
}

export async function cancelMember(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(MONTHLY, async () => {
    if (!id) return { error: "Nothing was selected." };
    const store = getStore();
    const m = await store.getMember(id);
    if (!m) return { error: GONE_MEMBER };
    const today = todayStr();
    const billing = await stopMemberBilling(m, false);
    await store.updateMember(id, { status: "cancelled", ended: today });
    await audit(user, "admin.cancel_member", m.code, { name: m.name, started: m.started, ended: today, billing });
    if (billing === "failed") return { to: withQuery(MONTHLY, { error: `${m.name}'s membership is cancelled here, but Stripe did not confirm. Cancel the subscription from the Stripe dashboard so the card isn't charged again.` }) };
  });
}

const memberSchema = z.object({
  name: z.string().trim().min(1, "Add the driver's name.").max(80, "That name is too long."),
  phone: z.string().trim().max(25, "That phone number is too long."),
  company: z.string().trim().max(80, "Keep the company name short."),
  truck: z.string().trim().max(80, "Keep the truck description short."),
  plate: z.string().trim().max(20, "That plate is too long."),
  started: z.string().refine(isIsoDay, "Pick a start date."),
  paid: z.boolean(),
});

/** The owner signs a driver up herself — usually a regular who pays in person. */
export async function addMember(formData: FormData): Promise<void> {
  const user = await owner();
  const parsed = memberSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    company: text(formData, "company"),
    truck: text(formData, "truck"),
    plate: text(formData, "plate"),
    started: text(formData, "started") || todayStr(),
    paid: checked(formData, "paid"),
  });
  return finish(MONTHLY, async () => {
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const input = parsed.data;
    const store = getStore();
    const settings = await store.getSettings();
    const today = todayStr();
    // Paid: the next charge is a month out. Unpaid: the first month is due on the start date,
    // and it is already past due when that date has come and gone.
    const member = await store.createMember({
      userId: null,
      name: input.name,
      phone: input.phone ? formatPhone(input.phone) : "",
      company: input.company,
      truck: input.truck,
      plate: input.plate.toUpperCase(),
      started: input.started,
      nextBill: input.paid ? addMonths(input.started, 1) : input.started,
      amountCents: settings.monthlyCents,
      status: input.paid ? "active" : input.started <= today ? "past_due" : "active",
      ended: null,
      paymentRef: null,
    });
    if (input.paid) {
      await store.addMemberPayment({ memberId: member.id, date: today, amountCents: member.amountCents, note: "First month" });
    }
    await audit(user, "admin.add_member", member.code, { name: member.name, started: member.started, paid: input.paid, amountCents: member.amountCents });
    return { to: withQuery(MONTHLY, { added: member.code }) };
  });
}

/* ============================================================
 * REVIEWS
 * ============================================================ */

async function reviewById(id: string) {
  const all = await getStore().listReviews();
  return all.find((r) => r.id === id) ?? null;
}

export async function approveReview(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(REVIEWS, async () => {
    if (!id) return { error: "Nothing was selected." };
    const r = await reviewById(id);
    if (!r) return { error: GONE_REVIEW };
    await getStore().updateReview(id, { approved: true });
    await audit(user, "admin.approve_review", id, { name: r.name, stars: r.stars });
  });
}

export async function hideReview(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(REVIEWS, async () => {
    if (!id) return { error: "Nothing was selected." };
    const r = await reviewById(id);
    if (!r) return { error: GONE_REVIEW };
    await getStore().updateReview(id, { approved: false });
    await audit(user, "admin.hide_review", id, { name: r.name, stars: r.stars });
  });
}

export async function deleteReview(formData: FormData): Promise<void> {
  const user = await owner();
  const id = idOf(formData);
  return finish(REVIEWS, async () => {
    if (!id) return { error: "Nothing was selected." };
    const r = await reviewById(id);
    if (!r) return { error: GONE_REVIEW };
    await getStore().deleteReview(id);
    await audit(user, "admin.delete_review", id, { name: r.name, stars: r.stars, text: r.text.slice(0, 120) });
  });
}

/* ============================================================
 * SETTINGS
 * ============================================================ */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function intField(fd: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(text(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Blank → null. Anything else must be a number. */
function coordField(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  if (raw === "") return null;
  return Number(raw.replace(/,/g, "."));
}

const dollars = (label: string) =>
  z
    .number({ error: `${label} needs a dollar amount like 10 or 12.50.` })
    .int()
    .min(0, `${label} can't be below zero.`)
    .max(10_000_000, `${label} is too high.`);

const photoLink = z
  .string()
  .trim()
  .max(600, "That photo link is too long.")
  .refine((v) => v === "" || /^(https?:\/\/|\/)/i.test(v), "Photo links must start with https:// (or be left blank).");

const settingsSchema = z.object({
  lotName: z.string().trim().min(1, "Give the lot a name.").max(80, "The lot name is too long."),
  address: z.string().trim().max(200, "The address is too long."),
  phone: z.string().trim().min(7, "Add the lot's phone number.").max(30, "That phone number is too long."),
  smsPhone: z.string().trim().max(30, "That text number is too long."),
  spots: z.number().int().min(1).max(60),
  maxLengthFt: z.number({ error: "Max trailer length needs a number of feet." }).int().min(20, "Max trailer length is at least 20 feet.").max(150, "Max trailer length is 150 feet at most."),
  nightlyCents: dollars("Per night"),
  monthlyCents: dollars("Per month"),
  showerCents: dollars("Shower"),
  laundryCents: dollars("Laundry"),
  nightlyExtras: z.boolean(),
  security: z.object({ lit: z.boolean(), gated: z.boolean(), cameras: z.boolean(), fenced: z.boolean() }),
  truckDirections: z.string().trim().max(3000, "Directions are too long — keep them under 3000 characters."),
  lat: z.number({ error: "Latitude needs a number like 33.6259 (or leave it blank)." }).min(-90).max(90).nullable(),
  lng: z.number({ error: "Longitude needs a number like -97.2211 (or leave it blank)." }).min(-180).max(180).nullable(),
  photos: z.array(z.object({ src: photoLink, caption: z.string().trim().max(120, "Photo captions are 120 characters at most.") })).max(6, "Up to 6 photos."),
  backgroundUrl: photoLink,
  overhead: z.array(z.object({ name: z.string().trim().min(1, "Every expense needs a name.").max(80, "Expense names are 80 characters at most."), amountCents: dollars("An expense") })).max(30, "Up to 30 expenses."),
  notes: z.string().trim().max(3000, "Notes are too long — keep them under 3000 characters."),
  policy: z.string().trim().max(3000, "The policy is too long — keep it under 3000 characters."),
  testMode: z.boolean(),
});

function photosFrom(fd: FormData): Photo[] {
  const srcs = texts(fd, "photoSrc");
  const captions = texts(fd, "photoCaption");
  const rows: Photo[] = [];
  for (let i = 0; i < Math.max(srcs.length, captions.length); i++) {
    const src = srcs[i] ?? "";
    const caption = captions[i] ?? "";
    if (!src && !caption) continue;
    rows.push({ src, caption });
  }
  return rows;
}

function overheadFrom(fd: FormData): { rows: OverheadLine[]; error: string | null } {
  const names = texts(fd, "overheadName");
  const amounts = texts(fd, "overheadAmount");
  const rows: OverheadLine[] = [];
  for (let i = 0; i < Math.max(names.length, amounts.length); i++) {
    const name = names[i] ?? "";
    const amount = amounts[i] ?? "";
    if (!name && !amount) continue;
    if (!name) return { rows, error: `The expense of $${amount} needs a name.` };
    const cents = parseDollars(amount);
    if (cents === null) return { rows, error: `"${name}" needs a dollar amount like 250 or 80.50.` };
    rows.push({ name, amountCents: cents });
  }
  return { rows, error: null };
}

/** The big settings form. Dollars become cents, checkboxes become booleans, everything is checked before it is saved. */
export async function saveSettings(formData: FormData): Promise<void> {
  const user = await owner();
  return finish(SETTINGS, async () => {
    const store = getStore();
    const before = await store.getSettings();
    const overhead = overheadFrom(formData);
    if (overhead.error) return { error: overhead.error };

    const parsed = settingsSchema.safeParse({
      lotName: text(formData, "lotName"),
      address: text(formData, "address"),
      phone: text(formData, "phone"),
      smsPhone: text(formData, "smsPhone"),
      spots: clamp(intField(formData, "spots", before.spots), 1, 60),
      maxLengthFt: intField(formData, "maxLengthFt", before.maxLengthFt),
      nightlyCents: parseDollars(text(formData, "nightly")),
      monthlyCents: parseDollars(text(formData, "monthly")),
      showerCents: parseDollars(text(formData, "shower")),
      laundryCents: parseDollars(text(formData, "laundry")),
      nightlyExtras: checked(formData, "nightlyExtras"),
      security: {
        lit: checked(formData, "lit"),
        gated: checked(formData, "gated"),
        cameras: checked(formData, "cameras"),
        fenced: checked(formData, "fenced"),
      },
      truckDirections: text(formData, "truckDirections"),
      lat: coordField(formData, "lat"),
      lng: coordField(formData, "lng"),
      photos: photosFrom(formData),
      backgroundUrl: text(formData, "backgroundUrl"),
      overhead: overhead.rows,
      notes: text(formData, "notes"),
      policy: text(formData, "policy"),
      testMode: checked(formData, "testMode"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const patch: Partial<LotSettings> = parsed.data;
    const after = await store.saveSettings(patch);
    const changed = (Object.keys(patch) as (keyof LotSettings)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    await audit(user, "admin.save_settings", "settings", { changed });
    return { to: withQuery(SETTINGS, { saved: "1" }) };
  });
}

const codeField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} can't be blank.`)
    .max(16, `${label} is 16 characters at most.`)
    .regex(/^[0-9A-Za-z#*]+$/, `${label} can only use numbers, letters, # and *.`);

const privateSchema = z.object({
  gate1: codeField("Gate 1"),
  gate2: codeField("Gate 2"),
  shedCode: codeField("The shed code"),
});

/** Gate + shed codes. Saved separately and never written to the log. */
export async function savePrivateSettings(formData: FormData): Promise<void> {
  const user = await owner();
  const parsed = privateSchema.safeParse({
    gate1: text(formData, "gate1"),
    gate2: text(formData, "gate2"),
    shedCode: text(formData, "shedCode"),
  });
  return finish(SETTINGS, async () => {
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const store = getStore();
    const before = await store.getPrivateSettings();
    const patch: PrivateSettings = parsed.data;
    await store.savePrivateSettings(patch);
    const changed = (Object.keys(patch) as (keyof PrivateSettings)[]).filter((k) => before[k] !== patch[k]);
    // The log says WHICH codes changed, never what they are.
    await audit(user, "admin.save_codes", "codes", { changed });
    return { to: withQuery(SETTINGS, { saved: "codes" }) };
  });
}

/* ============================================================
 * TEST DATA
 * ============================================================ */

export async function loadSample(): Promise<void> {
  const user = await owner();
  return finish(SETTINGS, async () => {
    const store = getStore();
    // The sample uses fixed codes; loading it twice would double everything up.
    if (!sampleDataAllowed()) return { error: "Sample bookings are for trying things out — not for the live lot. Use a preview deployment or your computer." };
    const existing = await store.listBookings({ limit: 200 });
    if (existing.some((b) => b.name === "Dale Whitaker")) return { error: "Sample bookings are already loaded. Clear everything first if you want a fresh set." };
    await loadSampleData();
    await audit(user, "admin.load_sample", "sample", {});
    return { to: withQuery(TONIGHT, { sample: "1" }) };
  });
}

export async function clearAll(): Promise<void> {
  const user = await owner();
  return finish(SETTINGS, async () => {
    const store = getStore();
    const [bookings, members, reviews] = await Promise.all([store.listBookings(), store.listMembers({ includeCancelled: true }), store.listReviews()]);
    await store.clearOperationalData();
    // Written after the wipe so the fresh log starts with who cleared it.
    await audit(user, "admin.clear_all", "everything", { bookings: bookings.length, members: members.length, reviews: reviews.length });
    return { to: withQuery(SETTINGS, { saved: "cleared" }) };
  });
}
