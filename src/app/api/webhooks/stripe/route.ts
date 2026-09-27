import type Stripe from "stripe";
import { json } from "@/lib/api";
import { normalizeCode } from "@/lib/codes";
import { nextBillAfter, todayStr } from "@/lib/dates";
import { constructWebhookEvent } from "@/lib/payments";
import { markPaidByCode } from "@/lib/services/reservations";
import { getStore } from "@/lib/store";

/**
 * POST /api/webhooks/stripe — Stripe tells us what happened to money.
 * Needs the raw request body for signature checking, so this route does not use handler()'s
 * JSON parsing. Every branch is idempotent: Stripe retries on any non-2xx.
 */
export const runtime = "nodejs";

const MONTHLY_NOTE = "Monthly charge";

/** The reservation code Stripe carries for a subscription invoice, wherever this API version put it. */
function codeFromInvoice(invoice: Stripe.Invoice): string | null {
  const viaParent = invoice.parent?.subscription_details?.metadata?.code;
  if (viaParent) return normalizeCode(viaParent);
  for (const line of invoice.lines?.data ?? []) {
    const c = line.metadata?.code;
    if (c) return normalizeCode(c);
  }
  // Older API versions exposed subscription metadata at the top level.
  const legacy = (invoice as unknown as { subscription_details?: { metadata?: Record<string, string> | null } | null }).subscription_details?.metadata?.code;
  return legacy ? normalizeCode(legacy) : null;
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // Delayed methods (bank debits) complete the session before the money is in; wait for async_payment_succeeded.
  if (session.payment_status === "unpaid") return;
  const rawCode = session.metadata?.code ?? session.client_reference_id;
  if (!rawCode) return;
  const code = normalizeCode(rawCode);
  const kind = session.metadata?.kind;
  if (kind === "nightly" || kind === "monthly") {
    await markPaidByCode(code, kind, session.id);
    return;
  }
  // Metadata missing its kind (shouldn't happen) — work it out from the store.
  const booking = await getStore().getBookingByCode(code);
  await markPaidByCode(code, booking ? "nightly" : "monthly", session.id);
}

/** A delayed payment bounced: drop the hold so the stall frees up. */
async function onCheckoutFailed(session: Stripe.Checkout.Session): Promise<void> {
  const rawCode = session.metadata?.code ?? session.client_reference_id;
  if (!rawCode) return;
  const code = normalizeCode(rawCode);
  const store = getStore();
  const booking = await store.getBookingByCode(code);
  if (booking) {
    if (booking.status === "pending_payment") await store.updateBooking(booking.id, { status: "cancelled" });
    return;
  }
  const member = await store.getMemberByCode(code);
  if (member && member.status === "pending_payment") await store.updateMember(member.id, { status: "cancelled", ended: member.started });
}

async function onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // The first month is settled by checkout.session.completed; only renewals land here.
  if (invoice.billing_reason === "subscription_create") return;
  const code = codeFromInvoice(invoice);
  if (!code) return;
  const store = getStore();
  const member = await store.getMemberByCode(code);
  if (!member || member.status === "cancelled") return;

  const today = todayStr();
  const payments = await store.listMemberPayments(member.id);
  const alreadyRecorded = payments.some((p) => p.date === today && p.note === MONTHLY_NOTE && p.amountCents === invoice.amount_paid);
  if (alreadyRecorded) return; // Stripe retried an event we already handled.

  await store.addMemberPayment({ memberId: member.id, date: today, amountCents: invoice.amount_paid, note: MONTHLY_NOTE });
  await store.updateMember(member.id, { nextBill: nextBillAfter(member.started, member.nextBill), status: "active" });
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // A failed first payment is still "pending" — the expire cron cleans those up.
  if (invoice.billing_reason === "subscription_create") return;
  const code = codeFromInvoice(invoice);
  if (!code) return;
  const store = getStore();
  const member = await store.getMemberByCode(code);
  if (!member || member.status === "cancelled" || member.status === "pending_payment") return;
  await store.updateMember(member.id, { status: "past_due" });
}

async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const rawCode = sub.metadata?.code;
  if (!rawCode) return;
  const store = getStore();
  const member = await store.getMemberByCode(normalizeCode(rawCode));
  if (!member || member.status === "cancelled") return;
  await store.updateMember(member.id, { status: "cancelled", ended: todayStr() });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing stripe-signature header.", code: "bad_signature" }, 400);

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.warn("stripe webhook rejected:", err instanceof Error ? err.message : err);
    return json({ error: "Bad signature.", code: "bad_signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await onCheckoutCompleted(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await onCheckoutFailed(event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await onInvoicePaymentFailed(event.data.object);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object);
        break;
      default:
        // Not something we act on. Acknowledge so Stripe stops sending it.
        break;
    }
  } catch (err) {
    console.error(`stripe webhook ${event.type} failed`, err);
    return json({ error: "Webhook handling failed.", code: "internal" }, 500);
  }

  return json({ received: true });
}
