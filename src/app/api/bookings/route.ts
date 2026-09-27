import { ApiError, clientIp, handler, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";
import { createReservation } from "@/lib/services/reservations";

/**
 * POST /api/bookings — the one way the website creates a stay.
 * The browser sends the form; the server decides price, availability and payment mode
 * (see createReservation). Gate codes are never returned here — the confirmation page
 * and /api/lookup apply the reveal rules.
 */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(clientIp(req) + ":bookings", { limit: 10, windowMs: 600_000 });
  if (!rl.ok) {
    return json(
      { error: "Too many attempts. Wait a minute and try again.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, rl.retryAfterSec)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("The form didn't come through right. Reload the page and try again.", 400, "bad_json");
  }

  const user = await getSessionUser();
  const result = await createReservation(body, user);

  return json({
    ok: true,
    kind: result.kind,
    code: result.kind === "nightly" ? result.booking.code : result.member.code,
    checkoutUrl: result.checkoutUrl,
  });
});
