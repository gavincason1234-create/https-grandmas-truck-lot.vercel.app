import { z } from "zod";
import { ApiError, clientIp, handler, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeCode } from "@/lib/codes";
import { todayStr } from "@/lib/dates";
import { rateLimit } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  stars: z.coerce.number().int("Tap a star.").min(1, "Tap a star.").max(5, "Five stars is the most we take."),
  name: z.string().trim().min(2, "Add your name — first name is fine.").max(60, "Keep the name under 60 characters."),
  text: z.string().trim().min(5, "Say a little more — one sentence helps the next driver.").max(600, "Keep it under 600 characters."),
  code: z.string().trim().max(20, "That code is too long.").optional(),
});

/** "Ray Fleitman" + "Fleitman Hay & Cattle" → "Ray · Fleitman Hay & Cattle", like the sample data. */
function displayName(stayName: string, company: string, fallback: string): string {
  const first = stayName.trim().split(/\s+/)[0] ?? "";
  if (!first) return fallback;
  const co = company.trim();
  return co ? `${first} · ${co}` : first;
}

/**
 * POST /api/reviews  { stars, name, text, code? }
 * Anyone can post. A review tied to a paid stay goes live at once; anything else waits for the owner.
 */
export const POST = handler(async (req: Request) => {
  const limit = rateLimit(`${clientIp(req)}:reviews`, { limit: 5, windowMs: 3600_000 });
  if (!limit.ok) throw new ApiError("That's plenty of reviews for one hour. Try again later.", 429, "rate_limited");

  const raw: unknown = await req.json().catch(() => null);
  if (raw === null || typeof raw !== "object") throw new ApiError("Send the review as JSON.", 400, "bad_json");
  const input = schema.parse(raw);

  const store = getStore();
  const user = await getSessionUser();

  let approved = false;
  let name = input.name;
  let bookingCode: string | null = null;

  const code = input.code ? normalizeCode(input.code) : "";
  if (code) {
    const [booking, member] = await Promise.all([store.getBookingByCode(code), store.getMemberByCode(code)]);
    if (booking) {
      bookingCode = booking.code;
      name = displayName(booking.name, booking.company, input.name);
      approved = booking.paid && booking.status !== "cancelled";
    } else if (member) {
      bookingCode = member.code;
      name = displayName(member.name, member.company, input.name);
      approved = member.status === "active" || member.status === "past_due";
    }
  }

  await store.createReview({
    userId: user?.id ?? null,
    bookingCode,
    name,
    stars: input.stars,
    text: input.text,
    date: todayStr(),
    approved,
  });

  return json({ ok: true, approved });
});
