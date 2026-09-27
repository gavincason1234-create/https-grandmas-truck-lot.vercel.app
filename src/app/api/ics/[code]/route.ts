import { NextResponse } from "next/server";
import { ApiError, clientIp, handler } from "@/lib/api";
import { normalizeCode } from "@/lib/codes";
import { addDays, prettyDayLong } from "@/lib/dates";
import { env } from "@/lib/env";
import { money } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

/**
 * GET /api/ics/[code] — an "Add to calendar" file for a stay.
 * All-day event on the arrival date(s). Gate codes are deliberately NOT in the file:
 * calendars sync everywhere and get shared; the site applies the reveal rules instead.
 */

/** RFC 5545 text escaping. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a content line to 75 octets; continuation lines start with a single space. */
function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const l = Buffer.byteLength(ch, "utf8");
    if (len + l > 75) {
      out.push(cur);
      cur = " " + ch;
      len = 1 + l;
    } else {
      cur += ch;
      len += l;
    }
  }
  out.push(cur);
  return out.join("\r\n");
}

function compactDay(day: string): string {
  return day.replace(/-/g, "");
}

function stampNow(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export const GET = handler(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  if (!rateLimit(clientIp(req) + ":ics", { limit: 40, windowMs: 600_000 }).ok) throw new ApiError("Too many requests. Wait a minute and try again.", 429, "rate_limited");
  const { code: raw } = await ctx.params;
  const code = normalizeCode(raw);
  if (!code) throw new ApiError("No reservation with that code.", 404, "not_found");

  const store = getStore();
  const [settings, booking] = await Promise.all([store.getSettings(), store.getBookingByCode(code)]);
  const member = booking ? null : await store.getMemberByCode(code);
  const stay = booking ?? member;
  if (!stay) throw new ApiError("No reservation with that code.", 404, "not_found");

  const site = env.siteUrl;
  const confirmUrl = `${site}/book/confirmed/${code}`;
  const findUrl = `${site}/find`;

  let start: string;
  let end: string;
  let summary: string;
  let stayLine: string;
  if (stay.kind === "nightly") {
    start = stay.arrive;
    end = addDays(stay.arrive, Math.max(1, stay.nights));
    summary = `Truck parking — ${settings.lotName}`;
    stayLine = `${stay.nights} night${stay.nights === 1 ? "" : "s"} starting ${prettyDayLong(stay.arrive)}. ${money(stay.amountCents)}${stay.paid ? ", paid" : ""}.`;
  } else {
    start = stay.started;
    end = addDays(stay.started, 1);
    summary = `Monthly truck parking starts — ${settings.lotName}`;
    stayLine = `Monthly spot from ${prettyDayLong(stay.started)}. ${money(stay.amountCents)}/month, next charge ${prettyDayLong(stay.nextBill)}.`;
  }
  const cancelled = stay.status === "cancelled";

  const description = [
    `Reservation code ${code}${stay.name ? ` for ${stay.name}` : ""}.`,
    stayLine,
    `Gate codes: open the site — ${confirmUrl} — or look it up at ${findUrl} with your code and the last 4 of your phone.`,
    settings.truckDirections ? `Truck route: ${settings.truckDirections}` : "",
    `Questions or trouble at the gate: call ${settings.phone}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(settings.lotName)}//Reservations//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${code}@grandmas-truck-lot`,
    `DTSTAMP:${stampNow()}`,
    `DTSTART;VALUE=DATE:${compactDay(start)}`,
    `DTEND;VALUE=DATE:${compactDay(end)}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(settings.address)}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:${confirmUrl}`,
    cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const body = lines.map(fold).join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="truck-lot-${code}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
