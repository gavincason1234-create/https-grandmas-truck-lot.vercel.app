/**
 * Date helpers. The lot runs on a single local calendar (Central Time, Texas).
 * All "day" values are `YYYY-MM-DD` strings so they compare and sort as plain text.
 */

export const LOT_TIME_ZONE = "America/Chicago";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date at the lot, as `YYYY-MM-DD`. */
export function todayStr(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DAY.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function fromDay(day: string): Date {
  return new Date(day + "T12:00:00Z");
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = fromDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

export function addMonths(day: string, n: number): string {
  const d = fromDay(day);
  const dom = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dom, last));
  return toDay(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000);
}

/** "Sat, Sep 27" */
export function prettyDay(day: string | null | undefined): string {
  if (!day) return "";
  return fromDay(day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Sat, Sep 27, 2026" */
export function prettyDayLong(day: string | null | undefined): string {
  if (!day) return "";
  return fromDay(day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Every day in [from, from + count). */
export function dayRange(from: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(from, i));
  return out;
}

/**
 * The billing day after `current`, anchored to the day of month the membership started on, so a
 * Jan 31 start bills Feb 28, Mar 31, Apr 30 (like Stripe) instead of drifting to the 28th forever.
 */
export function nextBillAfter(started: string, current: string): string {
  for (let n = 1; n < 1200; n++) {
    const d = addMonths(started, n);
    if (d > current) return d;
  }
  return addMonths(current, 1);
}
