"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { AuthError, requireUserApi } from "@/lib/auth/session";
import { formatPhone, phoneDigits } from "@/lib/codes";
import { refundBooking, stopMemberBilling } from "@/lib/services/refunds";
import { refundable } from "@/lib/services/reservations";
import { getStore } from "@/lib/store";
import type { SessionUser } from "@/lib/types";

/**
 * Server actions for the driver's account page. Every action:
 *  1. finds the signed-in driver (or sends them to sign in),
 *  2. checks the record really belongs to them,
 *  3. validates the form with zod,
 *  4. writes through the store, records an audit line, and lands back on /account with a flash.
 */

const ACCOUNT = "/account";

/** Short codes the page turns into friendly sentences. Never free text from the URL. */
type FlashError = "invalid" | "too_late" | "not_active" | "already_cancelled";

/** The signed-in driver, or off to the sign-in page — a form post can't do anything with a 401. */
async function currentUser(): Promise<SessionUser> {
  try {
    return await requireUserApi();
  } catch (err) {
    if (err instanceof AuthError) redirect(`/login?next=${encodeURIComponent(ACCOUNT)}`);
    throw err;
  }
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Back to the account page with a success flash; the page re-reads everything, so revalidate first. */
function done(params: Record<string, string>, anchor = ""): never {
  revalidatePath(ACCOUNT);
  redirect(`${ACCOUNT}?${new URLSearchParams(params).toString()}${anchor}`);
}

function fail(error: FlashError, anchor = ""): never {
  redirect(`${ACCOUNT}?${new URLSearchParams({ error }).toString()}${anchor}`);
}

/* ---------------------------------------------------------------------------------------------- */
/* Your details                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

const shortText = z.string().trim().max(80);

const profileSchema = z.object({
  fullName: shortText,
  phone: z
    .string()
    .trim()
    .max(25)
    .refine((v) => v === "" || phoneDigits(v).length >= 7, "That phone number doesn't look right."),
  company: shortText,
  truck: shortText,
  plate: shortText,
});

export async function saveProfile(formData: FormData): Promise<void> {
  const user = await currentUser();
  const parsed = profileSchema.safeParse({
    fullName: field(formData, "fullName"),
    phone: field(formData, "phone"),
    company: field(formData, "company"),
    truck: field(formData, "truck"),
    plate: field(formData, "plate"),
  });
  if (!parsed.success) fail("invalid", "#details");
  const d = parsed.data;

  await getStore().upsertProfile({
    id: user.id,
    email: user.email,
    fullName: d.fullName,
    phone: d.phone ? formatPhone(d.phone) : "",
    company: d.company,
    truck: d.truck,
    plate: d.plate.toUpperCase(),
    // The safe decides who is an owner; keep the database row in step with it.
    role: user.isAdmin ? "admin" : "driver",
  });
  // No phone numbers or plates in the audit log — just that it happened.
  await audit(user, "driver.save_profile", user.id, { hasPhone: d.phone !== "", hasTruck: d.truck !== "", hasPlate: d.plate !== "" });
  done({ saved: "1" }, "#details");
}

/* ---------------------------------------------------------------------------------------------- */
/* Cancel a night                                                                                 */
/* ---------------------------------------------------------------------------------------------- */

const idSchema = z.string().trim().min(1).max(64);

export async function cancelBooking(formData: FormData): Promise<void> {
  const user = await currentUser();
  const id = idSchema.safeParse(field(formData, "bookingId"));
  if (!id.success) fail("invalid");

  const store = getStore();
  const booking = await store.getBooking(id.data);
  if (!booking || booking.userId !== user.id) throw new Error("That reservation is not on this account.");
  if (booking.status === "cancelled") fail("already_cancelled");
  // Same rule the page uses to show the button: reserved, and before 6 PM lot time on arrival day.
  if (!refundable(booking)) fail("too_late");

  const refund = await refundBooking(booking);
  // A refund that went through (or wasn't needed) means the money is no longer ours to count.
  await store.updateBooking(booking.id, { status: "cancelled", paid: refund === "failed" ? booking.paid : false });
  await audit(user, "driver.cancel_booking", booking.code, {
    bookingId: booking.id,
    arrive: booking.arrive,
    nights: booking.nights,
    amountCents: booking.amountCents,
    refund,
  });
  done(refund === "failed" ? { cancelled: booking.code, refund: "failed" } : { cancelled: booking.code });
}

/* ---------------------------------------------------------------------------------------------- */
/* Cancel a monthly membership                                                                    */
/* ---------------------------------------------------------------------------------------------- */

export async function cancelMembership(formData: FormData): Promise<void> {
  const user = await currentUser();
  const id = idSchema.safeParse(field(formData, "memberId"));
  if (!id.success) fail("invalid");

  const store = getStore();
  const member = await store.getMember(id.data);
  if (!member || member.userId !== user.id) throw new Error("That membership is not on this account.");
  if (member.status === "cancelled") fail("already_cancelled");
  if (member.status !== "active" && member.status !== "past_due") fail("not_active");

  // They keep the stall (and the gate codes) through the day the next charge would have landed.
  const ended = member.nextBill;
  const billing = await stopMemberBilling(member, true);
  await store.updateMember(member.id, { status: "cancelled", ended });
  await audit(user, "driver.cancel_membership", member.code, { memberId: member.id, ended, wasPastDue: member.status === "past_due", billing });
  done(billing === "failed" ? { cancelled: member.code, refund: "failed" } : { cancelled: member.code });
}
