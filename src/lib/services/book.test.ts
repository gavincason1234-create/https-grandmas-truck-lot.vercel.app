import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import type { Booking } from "../types";
import { bookHref, matchesQuery, parseBookQuery, PILE_CAP, pileOf, pilesFor, recentlyLeft, staysOn, TONIGHT_RECENT_LEFT, wasHereOn } from "./book";

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: over.id ?? over.code ?? "b1",
  code: "K7M2P",
  kind: "nightly",
  userId: null,
  name: "Dale Whitaker",
  phone: "(940) 555-0142",
  company: "Owner-operator",
  truck: "53' dry van",
  plate: "TX 8421RM",
  arrive: "2026-10-10",
  nights: 2,
  extras: { showers: 0, loads: 0 },
  amountCents: 2000,
  paid: true,
  status: "reserved",
  paymentRef: null,
  hidden: false,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  ...over,
});

const ANY = { q: "", show: "all", on: "", all: false } as const;

describe("parseBookQuery", () => {
  it("defaults to everything, any day, no search", () => {
    expect(parseBookQuery({})).toEqual({ q: "", show: "all", on: "", all: false });
  });

  it("keeps what is valid and drops what is not", () => {
    expect(parseBookQuery({ q: "  Dale ", show: "lot", on: "2026-10-10", all: "1" })).toEqual({ q: "Dale", show: "lot", on: "2026-10-10", all: true });
    expect(parseBookQuery({ show: "everyone", on: "next tuesday", all: "yes" })).toEqual({ q: "", show: "all", on: "", all: false });
  });

  it("takes the first value of a repeated key and trims a huge search", () => {
    const parsed = parseBookQuery({ q: ["x".repeat(500), "second"], show: ["past", "lot"] });
    expect(parsed.q).toHaveLength(80);
    expect(parsed.show).toBe("past");
  });

  it("round-trips through bookHref", () => {
    const q = { q: "Dale W", show: "lot", on: "2026-10-10", all: true } as const;
    const back = Object.fromEntries(new URL(`http://x${bookHref(q)}`).searchParams);
    expect(parseBookQuery(back)).toEqual(q);
  });
});

describe("pileOf", () => {
  it("sorts every status into one of four piles", () => {
    expect(pileOf(booking({ status: "reserved" }))).toBe("upcoming");
    expect(pileOf(booking({ status: "parked" }))).toBe("lot");
    expect(pileOf(booking({ status: "pending_payment" }))).toBe("waiting");
    expect(pileOf(booking({ status: "departed" }))).toBe("past");
    expect(pileOf(booking({ status: "cancelled" }))).toBe("past");
    expect(pileOf(booking({ status: "departed", hidden: true }))).toBe("past");
  });
});

describe("staysOn and wasHereOn", () => {
  it("covers the arrival night through the last night, not the morning after", () => {
    const two = booking({ arrive: "2026-10-10", nights: 2 });
    expect(staysOn(two, "2026-10-09")).toBe(false);
    expect(staysOn(two, "2026-10-10")).toBe(true);
    expect(staysOn(two, "2026-10-11")).toBe(true);
    expect(staysOn(two, "2026-10-12")).toBe(false);
  });

  it("follows a stay across a month and a year boundary", () => {
    const oct = booking({ arrive: "2026-10-31", nights: 2 });
    expect(staysOn(oct, "2026-11-01")).toBe(true);
    expect(staysOn(oct, "2026-11-02")).toBe(false);
    const nye = booking({ arrive: "2026-12-31", nights: 2 });
    expect(staysOn(nye, "2027-01-01")).toBe(true);
    expect(staysOn(nye, "2026-12-30")).toBe(false);
  });

  it("treats a zero-night row as one night", () => {
    expect(staysOn(booking({ nights: 0 }), "2026-10-10")).toBe(true);
  });

  it("only counts trucks that were really there", () => {
    expect(wasHereOn(booking({ status: "parked" }), "2026-10-10")).toBe(true);
    expect(wasHereOn(booking({ status: "departed" }), "2026-10-11")).toBe(true);
    expect(wasHereOn(booking({ status: "departed", hidden: true }), "2026-10-11")).toBe(true);
    expect(wasHereOn(booking({ status: "reserved" }), "2026-10-10")).toBe(true); // booked for that night
    expect(wasHereOn(booking({ status: "cancelled" }), "2026-10-10")).toBe(false); // never came (or a no-show)
    expect(wasHereOn(booking({ status: "pending_payment" }), "2026-10-10")).toBe(false); // card hold, no stall
  });
});

describe("matchesQuery", () => {
  const b = booking();

  it("matches nothing typed", () => {
    expect(matchesQuery(b, "")).toBe(true);
    expect(matchesQuery(b, "   ")).toBe(true);
  });

  it("finds a name or company, any case, accents ignored", () => {
    expect(matchesQuery(b, "dale")).toBe(true);
    expect(matchesQuery(b, "WHITAKER")).toBe(true);
    expect(matchesQuery(b, "owner-op")).toBe(true);
    expect(matchesQuery(booking({ name: "José Peña" }), "jose pena")).toBe(true);
    expect(matchesQuery(b, "Marisol")).toBe(false);
    expect(matchesQuery(booking({ company: "" }), "owner")).toBe(false);
  });

  it("finds a code by prefix, any case, spaces ignored", () => {
    expect(matchesQuery(b, "k7m2p")).toBe(true);
    expect(matchesQuery(b, "K7")).toBe(true);
    expect(matchesQuery(b, " k7 m2p ")).toBe(true);
    expect(matchesQuery(b, "7M2P")).toBe(false); // not a prefix
    // One letter is too little to go on for a code (it still finds it inside a name).
    expect(matchesQuery(booking({ name: "Zed", company: "" }), "K")).toBe(false);
  });

  it("finds a phone by any three or more digits in a row", () => {
    expect(matchesQuery(b, "0142")).toBe(true);
    expect(matchesQuery(b, "555 0142")).toBe(true);
    expect(matchesQuery(b, "(940) 555-0142")).toBe(true);
    expect(matchesQuery(b, "1-940-555-0142")).toBe(true);
    expect(matchesQuery(b, "0143")).toBe(false);
    expect(matchesQuery(b, "94")).toBe(false); // two digits: too many false hits
  });

  it("finds a plate with spaces and dashes ignored", () => {
    expect(matchesQuery(b, "8421rm")).toBe(true);
    expect(matchesQuery(b, "TX-8421")).toBe(true);
    expect(matchesQuery(b, "421RM")).toBe(true);
    expect(matchesQuery(booking({ plate: "" }), "8421")).toBe(false);
  });

  it("keeps phone digits and plate digits apart", () => {
    // "TX 8421RM" holds 8421, and the phone does not: only the plate can match it.
    expect(matchesQuery(booking({ phone: "(940) 555-0100" }), "8421")).toBe(true);
    expect(matchesQuery(booking({ phone: "(940) 555-0100", plate: "" }), "8421")).toBe(false);
  });
});

describe("pilesFor", () => {
  const now = "2026-10-01T12:00:00.000Z";
  const rows: Booking[] = [
    booking({ code: "AAAAA", name: "Curtis Bell", status: "reserved", arrive: "2026-10-12", plate: "OK 771PZ", phone: "(405) 555-0111" }),
    booking({ code: "BBBBB", name: "Dale Whitaker", status: "reserved", arrive: "2026-10-10" }),
    booking({ code: "CCCCC", name: "Marisol Ortega", status: "parked", arrive: "2026-10-09", nights: 2, phone: "(214) 555-0177" }),
    booking({ code: "DDDDD", name: "Tommy Reyes", status: "parked", arrive: "2026-10-07", paid: false }),
    booking({ code: "EEEEE", name: "Hold Person", status: "pending_payment", arrive: "2026-10-10", updatedAt: now }),
    booking({ code: "FFFFF", name: "Old Timer", status: "departed", arrive: "2026-09-01" }),
    booking({ code: "GGGGG", name: "Never Came", status: "cancelled", arrive: "2026-09-20" }),
    booking({ code: "HHHHH", name: "Hidden Hank", status: "departed", hidden: true, arrive: "2026-09-10" }),
    booking({ code: "JJJJJ", name: "Backed Out", status: "cancelled", arrive: "2026-10-10" }),
  ];

  it("returns the four piles in page order, sorted the way an owner reads them", () => {
    const piles = pilesFor(rows, ANY);
    expect(piles.map((p) => p.pile)).toEqual(["upcoming", "lot", "waiting", "past"]);
    expect(piles.map((p) => p.shown.map((b) => b.name))).toEqual([
      ["Dale Whitaker", "Curtis Bell"], // soonest first
      ["Tommy Reyes", "Marisol Ortega"], // longest on the lot first
      ["Hold Person"],
      ["Backed Out", "Never Came", "Hidden Hank", "Old Timer"], // most recent first; hidden stays are still in the book
    ]);
  });

  it("shows one pile when asked", () => {
    const piles = pilesFor(rows, { ...ANY, show: "past" });
    expect(piles.map((p) => [p.pile, p.total])).toEqual([["past", 4]]);
  });

  it("searches across every pile", () => {
    const piles = pilesFor(rows, { ...ANY, q: "771pz" });
    expect(piles.flatMap((p) => p.shown.map((b) => b.name))).toEqual(["Curtis Bell"]);
    const byPhone = pilesFor(rows, { ...ANY, q: "0177" });
    expect(byPhone.flatMap((p) => p.shown.map((b) => b.name))).toEqual(["Marisol Ortega"]);
  });

  it("answers 'who was here on' with the trucks that held a stall that night", () => {
    // Backed Out was booked for the 10th but cancelled; Hold Person never paid. Neither was here.
    const piles = pilesFor(rows, { ...ANY, on: "2026-10-10" });
    expect(piles.flatMap((p) => p.shown.map((b) => b.name)).sort()).toEqual(["Dale Whitaker", "Marisol Ortega"]);
    // A stay hidden from Tonight still counts: the truck was there.
    const hidden = pilesFor(rows, { ...ANY, on: "2026-09-10" });
    expect(hidden.flatMap((p) => p.shown.map((b) => b.name))).toEqual(["Hidden Hank"]);
  });

  it("applies the search, the day and the pile together", () => {
    const piles = pilesFor(rows, { q: "555", show: "lot", on: "2026-10-10", all: false });
    expect(piles.map((p) => [p.pile, p.shown.map((b) => b.name)])).toEqual([["lot", ["Marisol Ortega"]]]);
  });

  it("caps each pile at the newest rows until 'all' is set, and always reports the real total", () => {
    const many = Array.from({ length: PILE_CAP + 5 }, (_, i) => booking({ code: `P${i}`, id: `p${i}`, status: "departed", arrive: addDays("2026-01-01", i) }));
    const capped = pilesFor(many, { ...ANY, show: "past" });
    expect(capped.map((p) => [p.total, p.shown.length])).toEqual([[PILE_CAP + 5, PILE_CAP]]);
    expect(capped.map((p) => p.shown[0]?.arrive)).toEqual([addDays("2026-01-01", PILE_CAP + 4)]); // the most recent survive
    expect(capped.map((p) => p.shown[PILE_CAP - 1]?.arrive)).toEqual([addDays("2026-01-01", 5)]);
    const all = pilesFor(many, { ...ANY, show: "past", all: true });
    expect(all.map((p) => p.shown.length)).toEqual([PILE_CAP + 5]);
    // Exactly the cap: nothing is held back, so the page has no "Show all" to offer.
    const exact = pilesFor(many.slice(0, PILE_CAP), { ...ANY, show: "past" });
    expect(exact.map((p) => [p.total, p.shown.length])).toEqual([[PILE_CAP, PILE_CAP]]);
  });
});

describe("recentlyLeft", () => {
  it("is the newest few pulled-out stays that are not hidden, the same set the Tonight tab shows", () => {
    const rows = Array.from({ length: TONIGHT_RECENT_LEFT + 3 }, (_, i) =>
      booking({ code: `L${i}`, id: `l${i}`, status: "departed", updatedAt: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00.000Z` }),
    );
    rows.push(booking({ code: "HID", id: "hid", status: "departed", hidden: true, updatedAt: "2026-12-01T12:00:00.000Z" }));
    rows.push(booking({ code: "PRK", id: "prk", status: "parked", updatedAt: "2026-12-02T12:00:00.000Z" }));
    const left = recentlyLeft(rows);
    expect(left).toHaveLength(TONIGHT_RECENT_LEFT);
    expect(left.map((b) => b.id)).toEqual(["l7", "l6", "l5", "l4", "l3"]);
  });
});

describe("bookHref", () => {
  it("leaves defaults out and keeps what matters", () => {
    expect(bookHref({})).toBe("/admin/bookings");
    expect(bookHref({ q: "", show: "all", on: "", all: false })).toBe("/admin/bookings");
    expect(bookHref({ q: "Dale W", show: "lot", on: "2026-10-10", all: true })).toBe("/admin/bookings?q=Dale+W&show=lot&on=2026-10-10&all=1");
  });

  it("encodes what the owner typed so the link can't break out of the query", () => {
    expect(bookHref({ q: "a&b=c#d" })).toBe("/admin/bookings?q=a%26b%3Dc%23d");
  });
});
