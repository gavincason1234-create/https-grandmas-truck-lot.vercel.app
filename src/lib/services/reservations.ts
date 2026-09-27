import "server-only";
import { z } from "zod";
import { ApiError } from "../api";
import { worstOpenForStay } from "../availability";
import { audit } from "../audit";
import { refundBooking } from "./refunds";
import { formatPhone, phoneDigits } from "../codes";
import { addDays, addMonths, isIsoDay, todayStr } from "../dates";
import { env } from "../env";
import { PENDING_TTL_MIN, createCheckoutSession, paymentsMode } from "../payments";
import { clampExtras, clampNights, quoteMonthly, quoteNightly } from "../pricing";
import { getStore } from "../store";
import type { Booking, Member, SessionUser } from "../types";

const nameSchema = z.string().trim().min(2, "Add your name so she knows who to expect.").max(80);
const phoneSchema = z
  .string()
  .trim()
  .min(7, "Add a phone number in case a gate code fails.")
  .max(25)
  .refine((v) => phoneDigits(v).length >= 7, "That phone number doesn't look right.");
const shortText = z.string().trim().max(80).default("");

export const reservationSchema = z.object({
  plan: z.enum(["nightly", "monthly"]),
  arrive: z.string().refine(isIsoDay, "Pick a date."),
  nights: z.coerce.number().int().min(1).max(30).default(1),
  name: nameSchema,
  phone: phoneSchema,
  company: shortText,
  truck: shortText,
  plate: shortText,
  extras: z.object({ showers: z.coerce.number().int().min(0).max(20).default(0), loads: z.coerce.number().int().min(0).max(20).default(0) }).default({ showers: 0, loads: 0 }),
  /** Honeypot: real people never fill this in. */
  website: z.string().max(0, "Something went wrong.").optional().default(""),
});

export type ReservationInput = z.infer<typeof reservationSchema>;

/** How far ahead a monthly sign-up must have room. */
const MONTHLY_LOOKAHEAD_DAYS = 31;

/**
 * Second look after the row is in. Two drivers can pass the first check at the same moment; the
 * one whose row landed later gives it back. Rows created after ours don't count against us.
 */
async function stillFits(createdAt: string, arrive: string, nights: number): Promise<boolean> {
  const store = getStore();
  const settings = await store.getSettings();
  const [bookings, members] = await Promise.all([store.listBookings({ from: arrive, to: addDays(arrive, nights + 1) }), store.listMembers({ includeCancelled: true })]);
  const mine = bookings.filter((b) => b.createdAt <= createdAt);
  const theirs = members.filter((m) => m.createdAt <= createdAt);
  return worstOpenForStay(settings, mine, theirs, arrive, nights) >= 0;
}

export type ReservationResult =
  | { kind: "nightly"; booking: Booking; checkoutUrl: string | null }
  | { kind: "monthly"; member: Member; checkoutUrl: string | null };

/**
 * The one way a stay gets created — from the website form or, later, anything else.
 * Availability, price, and payment mode are all decided here on the server; the browser only asks.
 */
export async function createReservation(raw: unknown, user: SessionUser | null): Promise<ReservationResult> {
  const input = reservationSchema.parse(raw);
  const store = getStore();
  const settings = await store.getSettings();
  const today = todayStr();

  if (input.arrive < today) throw new ApiError("That date has already passed. Pick today or later.", 400, "past_date");
  if (input.arrive > addDays(today, 180)) throw new ApiError("We take reservations up to 6 months out.", 400, "too_far");

  const base = {
    userId: user?.id ?? null,
    name: input.name,
    phone: formatPhone(input.phone),
    company: input.company,
    truck: input.truck,
    plate: input.plate.toUpperCase(),
    paymentRef: null,
  };

  const [bookings, members] = await Promise.all([store.listBookings({ from: input.arrive, to: addDays(input.arrive, 31) }), store.listMembers({ includeCancelled: true })]);
  const simulated = paymentsMode() === "simulated";

  if (input.plan === "monthly") {
    // A member holds a stall every night, so the whole next month has to have room.
    if (worstOpenForStay(settings, bookings, members, input.arrive, MONTHLY_LOOKAHEAD_DAYS) <= 0) {
      throw new ApiError("No monthly spots open right now. Call the lot — sometimes one frees up.", 409, "full");
    }
    const quote = quoteMonthly(settings);
    const member = await store.createMember({
      ...base,
      started: input.arrive,
      nextBill: addMonths(input.arrive, 1),
      amountCents: quote.totalCents,
      status: simulated ? "active" : "pending_payment",
      ended: null,
    });
    if (!(await stillFits(member.createdAt, input.arrive, MONTHLY_LOOKAHEAD_DAYS))) {
      await store.updateMember(member.id, { status: "cancelled", ended: member.started });
      throw new ApiError("Someone took the last spot a moment ago. Call the lot — sometimes one frees up.", 409, "full");
    }
    if (simulated) {
      await store.addMemberPayment({ memberId: member.id, date: today, amountCents: quote.totalCents, note: "First month (simulated)" });
      return { kind: "monthly", member, checkoutUrl: null };
    }
    const session = await createCheckoutSession({ kind: "monthly", code: member.code, amountCents: quote.totalCents, description: `Starts ${member.started}`, customerEmail: user?.email, lotName: settings.lotName });
    const updated = await store.updateMember(member.id, { paymentRef: session.id });
    return { kind: "monthly", member: updated, checkoutUrl: session.url };
  }

  const nights = clampNights(input.nights);
  const extras = clampExtras(input.extras, settings.nightlyExtras);
  if (worstOpenForStay(settings, bookings, members, input.arrive, nights) <= 0) {
    throw new ApiError("The lot is full for those nights. Try a different date or call the lot.", 409, "full");
  }
  const quote = quoteNightly(settings, nights, extras);
  const booking = await store.createBooking({
    ...base,
    arrive: input.arrive,
    nights,
    extras,
    amountCents: quote.totalCents,
    paid: simulated,
    status: simulated ? "reserved" : "pending_payment",
  });
  if (!(await stillFits(booking.createdAt, input.arrive, nights))) {
    await store.deleteBooking(booking.id);
    throw new ApiError("Someone took the last spot a moment ago. Try another night or call the lot.", 409, "full");
  }
  if (simulated) return { kind: "nightly", booking, checkoutUrl: null };
  const session = await createCheckoutSession({ kind: "nightly", code: booking.code, amountCents: quote.totalCents, description: `${nights} night${nights === 1 ? "" : "s"} from ${booking.arrive}`, customerEmail: user?.email, lotName: settings.lotName });
  const updated = await store.updateBooking(booking.id, { paymentRef: session.id });
  return { kind: "nightly", booking: updated, checkoutUrl: session.url };
}

/** Called by the Stripe webhook (or the confirmation page's fallback check). Idempotent. */
export async function markPaidByCode(code: string, kind: "nightly" | "monthly", paymentRef: string): Promise<void> {
  const store = getStore();
  if (kind === "monthly") {
    const m = await store.getMemberByCode(code);
    if (!m) return;
    if (m.status === "cancelled" && !m.paymentRef) {
      await audit("stripe", "payment.after_cancel", m.code, { name: m.name, amountCents: m.amountCents, note: "Subscription started after the hold was cancelled — cancel it in Stripe and refund." });
      await store.updateMember(m.id, { paymentRef });
      return;
    }
    if (m.status !== "pending_payment") return;
    await store.updateMember(m.id, { status: "active", paymentRef });
    await store.addMemberPayment({ memberId: m.id, date: todayStr(), amountCents: m.amountCents, note: "First month" });
    return;
  }
  const b = await store.getBookingByCode(code);
  if (!b || b.paid) return;
  if (b.status === "cancelled") {
    // The hold expired (or the owner cancelled it) before the card cleared. Don't revive it — refund.
    const refund = await refundBooking({ ...b, paid: true, paymentRef });
    await store.updateBooking(b.id, { paymentRef, paid: refund === "failed" });
    await audit("stripe", "payment.after_cancel", b.code, { name: b.name, amountCents: b.amountCents, refund });
    return;
  }
  await store.updateBooking(b.id, { paid: true, status: "reserved", paymentRef });
}

export { PENDING_TTL_MIN };

export async function expireStalePending(): Promise<number> {
  if (paymentsMode() === "simulated") return 0;
  const store = getStore();
  const cutoff = Date.now() - PENDING_TTL_MIN * 60_000;
  let n = 0;
  for (const b of await store.listBookings({ status: ["pending_payment"] })) {
    if (new Date(b.createdAt).getTime() < cutoff) {
      await store.updateBooking(b.id, { status: "cancelled" });
      n++;
    }
  }
  for (const m of await store.listMembers()) {
    if (m.status === "pending_payment" && new Date(m.createdAt).getTime() < cutoff) {
      await store.updateMember(m.id, { status: "cancelled", ended: m.started });
      n++;
    }
  }
  return n;
}

/** Can this driver cancel for a full refund? Mirrors the posted policy: before 6 PM lot time on arrival day. */
export function refundable(b: Booking, now = new Date()): boolean {
  if (b.status !== "reserved") return false;
  const today = todayStr(now);
  if (today < b.arrive) return true;
  if (today > b.arrive) return false;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(now));
  return hour < 18;
}

export function isSimulated(): boolean {
  return paymentsMode() === "simulated" || !env.stripe.enabled;
}
