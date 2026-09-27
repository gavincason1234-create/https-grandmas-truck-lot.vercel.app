import { timingSafeEqual } from "node:crypto";
import { ApiError, handler, json } from "@/lib/api";
import { env } from "@/lib/env";
import { expireStalePending } from "@/lib/services/reservations";

/**
 * GET /api/cron/expire — Vercel Cron calls this every 15 minutes (see vercel.json).
 * Drops "waiting on payment" holds older than PENDING_TTL_MIN so they stop blocking a stall.
 * When CRON_SECRET is set, Vercel sends it as `Authorization: Bearer <secret>` and we insist on it.
 * When it isn't set the route is open — all it can do is cancel stale unpaid holds.
 */
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export const GET = handler(async (req: Request) => {
  const secret = env.cronSecret;
  if (secret) {
    const given = req.headers.get("authorization") ?? "";
    if (!safeEqual(given, `Bearer ${secret}`)) throw new ApiError("Not allowed.", 401, "unauthorized");
  }
  const expired = await expireStalePending();
  return json({ expired });
});
