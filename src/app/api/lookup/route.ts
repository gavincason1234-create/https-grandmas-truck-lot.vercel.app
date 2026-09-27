import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { LookupStay } from "@/components/find-form";
import { clientIp, handler, json } from "@/lib/api";
import { normalizeCode, phoneLast4 } from "@/lib/codes";
import { prettyDay } from "@/lib/dates";
import { rateLimit } from "@/lib/ratelimit";
import { codesForBooking, codesForMember, visibleCodes, type CodeReveal } from "@/lib/services/access";
import { getStore } from "@/lib/store";

/**
 * POST /api/lookup — "Find my booking" without an account: code + last 4 digits of the phone.
 * Same error for a wrong code and a wrong phone so nobody can probe which codes exist.
 * Never returns the full phone number.
 */

const lookupSchema = z.object({
  code: z.string().trim().min(3, "Enter the code from your confirmation.").max(12, "That code is too long."),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits of the phone you booked with."),
});

const NOT_FOUND = { error: "No booking matches that code and phone.", code: "not_found" } as const;

/** Constant-time string compare so response timing doesn't leak which half was wrong. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Mirrors the wording in <CodesPanel> so the lookup page reads the same as the confirmation page. */
function codesMessage(reveal: CodeReveal): string | null {
  if (reveal.show) return null;
  switch (reveal.reason) {
    case "unpaid":
      return "Gate codes appear here as soon as payment goes through.";
    case "too_early":
      return `Gate codes unlock on ${prettyDay(reveal.availableOn)} — two days before you arrive.`;
    case "cancelled":
      return "This reservation was cancelled, so the codes are no longer active.";
    case "departed":
      return "This stay is over. Thanks for parking with us.";
    case "not_set":
      return "Call the lot for tonight's gate code — she'll give it to you over the phone.";
    default:
      return "This stay has ended, so the codes are no longer active.";
  }
}

export const POST = handler(async (req: Request) => {
  const rl = rateLimit(clientIp(req) + ":lookup", { limit: 20, windowMs: 600_000 });
  if (!rl.ok) {
    return json(
      { error: "Too many tries. Wait a minute and try again, or call the lot.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, rl.retryAfterSec)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Enter your code and the last 4 digits of your phone.", code: "invalid" }, 400);
  }
  const input = lookupSchema.parse(body);
  const code = normalizeCode(input.code);

  const store = getStore();
  const booking = code ? await store.getBookingByCode(code) : null;
  const member = booking || !code ? null : await store.getMemberByCode(code);
  const stay = booking ?? member;

  // Always run the compare, even with no stay, so a missing code takes as long as a wrong phone.
  const expected = stay ? phoneLast4(stay.phone) : "0000";
  const matches = safeEqual(expected, input.last4);
  if (!stay || !matches) return json(NOT_FOUND, 404);

  const priv = await store.getPrivateSettings();
  const reveal = stay.kind === "nightly" ? codesForBooking(stay, priv) : codesForMember(stay, priv);
  const common = {
    code: stay.code,
    name: stay.name,
    truck: stay.truck,
    plate: stay.plate,
    company: stay.company,
    phoneLast4: expected,
    amountCents: stay.amountCents,
    codes: visibleCodes(reveal),
    codesReason: reveal.show ? null : reveal.reason,
    codesAvailableOn: reveal.show ? null : (reveal.availableOn ?? null),
    codesMessage: codesMessage(reveal),
  };

  const out: LookupStay =
    stay.kind === "nightly"
      ? { ...common, kind: "nightly", arrive: stay.arrive, nights: stay.nights, extras: stay.extras, status: stay.status, paid: stay.paid }
      : { ...common, kind: "monthly", started: stay.started, nextBill: stay.nextBill, ended: stay.ended, status: stay.status, paid: stay.status !== "pending_payment" };

  return json(out);
});
