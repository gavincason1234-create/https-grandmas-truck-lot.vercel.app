import { normalizeCode, phoneDigits } from "../codes";
import { addDays, isIsoDay } from "../dates";
import type { Booking } from "../types";

/*
 * The owner's booking book: every nightly stay there has ever been, sorted into four piles and
 * searched by the things an owner actually has in hand — a name, a code off a phone, the last
 * few digits of a number, a plate seen through the windshield.
 *
 * Pure functions, no store: unit tested, and shared by the /admin/bookings page.
 */

/** The four piles a booking can be in, in the order the page shows them. */
export type Pile = "upcoming" | "lot" | "waiting" | "past";
export const PILES: readonly Pile[] = ["upcoming", "lot", "waiting", "past"];

/** Group names. "Reserved" rather than "Coming up": a reservation that was due yesterday is still reserved, not coming up. */
export const PILE_LABEL: Record<Pile, string> = {
  upcoming: "Reserved",
  lot: "On the lot",
  waiting: "Waiting on payment",
  past: "Past",
};

/** What the "Show" box offers: one pile, or everything. */
export type Show = Pile | "all";
export const SHOW_OPTIONS: readonly { value: Show; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "upcoming", label: PILE_LABEL.upcoming },
  { value: "lot", label: PILE_LABEL.lot },
  { value: "waiting", label: PILE_LABEL.waiting },
  { value: "past", label: PILE_LABEL.past },
];

/** How many of the newest "Pulled out" stays the Tonight tab lists under Recently left. Bookings offers "Hide from Tonight" only for those. */
export const TONIGHT_RECENT_LEFT = 5;

export type BookQuery = {
  /** Free text: name, company, code, phone or plate. Trimmed, at most 80 characters. */
  q: string;
  show: Show;
  /** "Who was here on" — a YYYY-MM-DD day, or "" for any day. */
  on: string;
  /** Lift the per-pile cap. */
  all: boolean;
};

export const MAX_QUERY = 80;
/** How many cards a pile shows before "Show all". Plenty for a 15-stall lot; keeps the page quick on a phone. */
export const PILE_CAP = 60;

function isShow(v: string): v is Show {
  return v === "all" || (PILES as readonly string[]).includes(v);
}

/** Read the page's query string. Anything odd falls back to the default instead of erroring. */
export function parseBookQuery(sp: Record<string, string | string[] | undefined>): BookQuery {
  const one = (k: string): string => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return typeof s === "string" ? s.trim() : "";
  };
  const show = one("show");
  const on = one("on");
  return {
    q: one("q").slice(0, MAX_QUERY),
    show: isShow(show) ? show : "all",
    on: isIsoDay(on) ? on : "",
    all: one("all") === "1",
  };
}

/** Which pile a booking sits in. */
export function pileOf(b: Booking): Pile {
  switch (b.status) {
    case "reserved":
      return "upcoming";
    case "parked":
      return "lot";
    case "pending_payment":
      return "waiting";
    case "departed":
    case "cancelled":
      return "past";
  }
}

/** Date arithmetic only: does the booked stay cover `day` (arrival night through the last night)? */
export function staysOn(b: Booking, day: string): boolean {
  return b.arrive <= day && addDays(b.arrive, Math.max(1, b.nights) - 1) >= day;
}

/**
 * Was this truck actually on the lot on `day`? A cancelled or no-show reservation never held a
 * stall, and neither did a card hold that never went through — same rule as availability.ts.
 */
export function wasHereOn(b: Booking, day: string): boolean {
  if (b.status === "cancelled" || b.status === "pending_payment") return false;
  return staysOn(b, day);
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function plateKey(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Does this booking match what the owner typed?
 * - name / company: case-insensitive "contains", accents ignored
 * - code: the start of the code, any case, spaces ignored (typing "K7" finds K7M2P)
 * - phone: three or more digits anywhere in the number ("0142", "555 0142", "9405550142")
 * - plate: letters and digits only, spaces and dashes ignored ("771pz" finds "OK 771PZ")
 */
export function matchesQuery(b: Booking, q: string): boolean {
  const raw = q.trim();
  if (!raw) return true;
  const text = fold(raw);
  if (fold(b.name).includes(text) || (b.company && fold(b.company).includes(text))) return true;

  const code = normalizeCode(raw);
  if (code.length >= 2 && b.code.startsWith(code)) return true;

  // Same digits-only form on both sides, so "1-940-555-0142" finds "(940) 555-0142".
  const digits = phoneDigits(raw);
  if (digits.length >= 3 && phoneDigits(b.phone).includes(digits)) return true;

  const plate = plateKey(raw);
  if (plate.length >= 3 && b.plate && plateKey(b.plate).includes(plate)) return true;

  return false;
}

function byArrive(a: Booking, b: Booking): number {
  return a.arrive.localeCompare(b.arrive) || a.name.localeCompare(b.name);
}

function byArriveDesc(a: Booking, b: Booking): number {
  return b.arrive.localeCompare(a.arrive) || b.updatedAt.localeCompare(a.updatedAt);
}

function newestFirst(a: Booking, b: Booking): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

const ORDER: Record<Pile, (a: Booking, b: Booking) => number> = {
  upcoming: byArrive, // soonest arrival first
  lot: byArrive, // longest on the lot first
  waiting: newestFirst,
  past: byArriveDesc, // most recent stay first
};

export type PileResult = { pile: Pile; total: number; shown: Booking[] };

/**
 * Sort the whole book into piles for the page: filtered by the query, in the page's order,
 * capped per pile unless `all` is set. Piles the "Show" box hides are left out entirely.
 * Hidden stays are in the book like any other — hiding only tidies the Tonight tab.
 */
export function pilesFor(bookings: readonly Booking[], query: BookQuery): PileResult[] {
  const matching = bookings.filter((b) => matchesQuery(b, query.q) && (!query.on || wasHereOn(b, query.on)));
  const wanted = query.show === "all" ? PILES : [query.show];
  return wanted.map((pile) => {
    const rows = matching.filter((b) => pileOf(b) === pile).sort(ORDER[pile]);
    return { pile, total: rows.length, shown: query.all ? rows : rows.slice(0, PILE_CAP) };
  });
}

/** The stays the Tonight tab lists under Recently left: the newest few that pulled out and are not hidden. */
export function recentlyLeft(bookings: readonly Booking[]): Booking[] {
  return bookings
    .filter((b) => b.status === "departed" && !b.hidden)
    .sort(newestFirst)
    .slice(0, TONIGHT_RECENT_LEFT);
}

/** Build the page's own URL back from a query, so buttons can return to the same view. */
export function bookHref(query: Partial<BookQuery>, base = "/admin/bookings"): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.show && query.show !== "all") p.set("show", query.show);
  if (query.on) p.set("on", query.on);
  if (query.all) p.set("all", "1");
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}
