import { addDays, dayRange } from "./dates";
import type { Booking, LotSettings, Member } from "./types";

/** Does this nightly booking hold a stall on `day`? */
export function bookingCoversDay(b: Pick<Booking, "status" | "arrive" | "nights">, day: string): boolean {
  if (b.status === "departed" || b.status === "cancelled") return false;
  return day >= b.arrive && day < addDays(b.arrive, b.nights);
}

/** Does this member hold a stall on `day`? Members hold their stall every night from their start date until cancelled. */
export function memberCoversDay(m: Pick<Member, "status" | "started" | "ended">, day: string): boolean {
  if (m.status === "cancelled") return m.ended !== null && day >= m.started && day < m.ended;
  return day >= m.started;
}

export type DayOccupancy = { day: string; nightly: number; monthly: number; taken: number; open: number };

export function occupancyOn(
  settings: Pick<LotSettings, "spots">,
  bookings: readonly Pick<Booking, "status" | "arrive" | "nights">[],
  members: readonly Pick<Member, "status" | "started" | "ended">[],
  day: string,
): DayOccupancy {
  const nightly = bookings.filter((b) => bookingCoversDay(b, day)).length;
  const monthly = members.filter((m) => memberCoversDay(m, day)).length;
  const taken = nightly + monthly;
  return { day, nightly, monthly, taken, open: Math.max(0, settings.spots - taken) };
}

export function occupancyRange(
  settings: Pick<LotSettings, "spots">,
  bookings: readonly Pick<Booking, "status" | "arrive" | "nights">[],
  members: readonly Pick<Member, "status" | "started" | "ended">[],
  from: string,
  days: number,
): DayOccupancy[] {
  return dayRange(from, days).map((d) => occupancyOn(settings, bookings, members, d));
}

/** Fewest open stalls on any night of a proposed stay. 0 means the stay can't be booked. */
export function worstOpenForStay(
  settings: Pick<LotSettings, "spots">,
  bookings: readonly Pick<Booking, "status" | "arrive" | "nights">[],
  members: readonly Pick<Member, "status" | "started" | "ended">[],
  arrive: string,
  nights: number,
): number {
  let worst = settings.spots;
  for (const o of occupancyRange(settings, bookings, members, arrive, Math.max(1, nights))) {
    worst = Math.min(worst, o.open);
  }
  return worst;
}
