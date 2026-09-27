import "server-only";
import Stripe from "stripe";
import { env } from "./env";

/** Minutes an unpaid hold keeps a stall. Shared with services/reservations. */
export const PENDING_TTL_MIN = 45;

/**
 * Payments. Two modes:
 *  - Stripe (STRIPE_SECRET_KEY set): real Checkout Sessions; a webhook marks the stay paid.
 *  - Simulated (default): the booking is marked paid on the spot and the UI shows a test banner.
 */

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.stripe.enabled) throw new Error("Stripe is not configured");
  if (!stripe) stripe = new Stripe(env.stripe.secretKey);
  return stripe;
}

export function paymentsMode(): "stripe" | "simulated" {
  return env.stripe.enabled ? "stripe" : "simulated";
}

export type CheckoutInput = {
  kind: "nightly" | "monthly";
  code: string;
  amountCents: number;
  description: string;
  customerEmail?: string;
  lotName: string;
};

/** Create a Stripe Checkout session. Returns the URL the driver is sent to. */
export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const s = getStripe();
  const success = `${env.siteUrl}/book/confirmed/${input.code}?session_id={CHECKOUT_SESSION_ID}`;
  const cancel = `${env.siteUrl}/book?cancelled=${input.code}`;
  const common: Stripe.Checkout.SessionCreateParams = {
    success_url: success,
    cancel_url: cancel,
    // The stall is only held for PENDING_TTL_MIN; Stripe's minimum is 30 minutes.
    expires_at: Math.floor(Date.now() / 1000) + Math.max(30, PENDING_TTL_MIN) * 60,
    // Cards settle instantly, so "session completed" means "paid". No bank debits that clear days later.
    payment_method_types: ["card"],
    customer_email: input.customerEmail || undefined,
    client_reference_id: input.code,
    metadata: { code: input.code, kind: input.kind },
    phone_number_collection: { enabled: false },
  };
  const session =
    input.kind === "monthly"
      ? await s.checkout.sessions.create({
          ...common,
          mode: "subscription",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: input.amountCents,
                recurring: { interval: "month" },
                product_data: { name: `${input.lotName} — monthly spot`, description: input.description },
              },
            },
          ],
          subscription_data: { metadata: { code: input.code, kind: "monthly" } },
        })
      : await s.checkout.sessions.create({
          ...common,
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: input.amountCents,
                product_data: { name: `${input.lotName} — nightly parking`, description: input.description },
              },
            },
          ],
          payment_intent_data: { metadata: { code: input.code, kind: "nightly" } },
        });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { id: session.id, url: session.url };
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.stripe.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}

/** Look a Checkout session up (used when the driver lands on the confirmation page before the webhook fires). */
export async function retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(id);
}
