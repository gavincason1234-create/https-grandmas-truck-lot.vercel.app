import "server-only";
import { getStripe, paymentsMode } from "../payments";
import type { Booking, Member } from "../types";

/**
 * Giving money back and stopping subscriptions. Shared by the driver's account page and the
 * owner's dashboard so "Cancel & refund" means the same thing wherever it is tapped.
 * Simulated payments have nothing to refund. A failure never blocks the cancel — the stall
 * should free up either way — but it is returned so the caller can tell the owner to finish
 * it in the Stripe dashboard.
 */

export type RefundOutcome = "not_needed" | "refunded" | "failed";
export type BillingOutcome = "not_needed" | "stopped" | "failed";

async function paymentIntentFor(paymentRef: string): Promise<string | null> {
  if (paymentRef.startsWith("pi_")) return paymentRef;
  const session = await getStripe().checkout.sessions.retrieve(paymentRef);
  return typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
}

async function subscriptionFor(paymentRef: string): Promise<string | null> {
  if (paymentRef.startsWith("sub_")) return paymentRef;
  const session = await getStripe().checkout.sessions.retrieve(paymentRef);
  return typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
}

/** Refund a nightly booking's card payment in full. Idempotent per booking. */
export async function refundBooking(b: Pick<Booking, "id" | "code" | "paid" | "paymentRef">): Promise<RefundOutcome> {
  if (!b.paid || !b.paymentRef || paymentsMode() !== "stripe") return "not_needed";
  try {
    const intent = await paymentIntentFor(b.paymentRef);
    if (!intent) return "failed";
    await getStripe().refunds.create({ payment_intent: intent }, { idempotencyKey: `refund-booking-${b.id}` });
    return "refunded";
  } catch (err) {
    console.error(`refund failed for booking ${b.code}`, err);
    return "failed";
  }
}

/**
 * Tell Stripe not to charge next month. `atPeriodEnd` keeps the stall through the paid period
 * (what a driver cancelling from their account gets); false stops it now (owner cancelling).
 */
export async function stopMemberBilling(m: Pick<Member, "id" | "code" | "paymentRef">, atPeriodEnd: boolean): Promise<BillingOutcome> {
  if (!m.paymentRef || paymentsMode() !== "stripe") return "not_needed";
  try {
    const subscription = await subscriptionFor(m.paymentRef);
    if (!subscription) return "failed";
    if (atPeriodEnd) await getStripe().subscriptions.update(subscription, { cancel_at_period_end: true });
    else await getStripe().subscriptions.cancel(subscription);
    return "stopped";
  } catch (err) {
    console.error(`could not stop billing for member ${m.code}`, err);
    return "failed";
  }
}
