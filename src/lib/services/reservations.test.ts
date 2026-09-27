import { describe, expect, it } from "vitest";
import type { Booking } from "../types";
import { refundable, reservationSchema } from "./reservations";

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: "b1",
  code: "K7M2P",
  kind: "nightly",
  userId: null,
  name: "Dale Whitaker",
  phone: "(940) 555-0142",
  company: "",
  truck: "53' dry van",
  plate: "TX 8421RM",
  arrive: "2026-10-05",
  nights: 1,
  extras: { showers: 0, loads: 0 },
  amountCents: 1000,
  paid: true,
  status: "reserved",
  paymentRef: null,
  hidden: false,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  ...over,
});

// October 2026 is Central Daylight Time (UTC−5): 6 PM in Texas is 23:00Z.
describe("refundable", () => {
  it("is refundable the day before arrival", () => {
    expect(refundable(booking(), new Date("2026-10-04T17:00:00Z"))).toBe(true);
    expect(refundable(booking(), new Date("2026-10-05T03:30:00Z"))).toBe(true); // 10:30 PM Oct 4 in Texas
  });

  it("is refundable on arrival day before 6 PM Central", () => {
    expect(refundable(booking(), new Date("2026-10-05T13:00:00Z"))).toBe(true); // 8:00 AM
    expect(refundable(booking(), new Date("2026-10-05T22:59:00Z"))).toBe(true); // 5:59 PM
  });

  it("is not refundable from 6 PM Central on arrival day", () => {
    expect(refundable(booking(), new Date("2026-10-05T23:00:00Z"))).toBe(false); // 6:00 PM
    expect(refundable(booking(), new Date("2026-10-06T03:30:00Z"))).toBe(false); // 10:30 PM, still Oct 5 in Texas
  });

  it("is not refundable the day after arrival", () => {
    expect(refundable(booking(), new Date("2026-10-06T14:00:00Z"))).toBe(false);
    expect(refundable(booking({ nights: 3 }), new Date("2026-10-07T14:00:00Z"))).toBe(false);
  });

  it("only applies to reserved stays", () => {
    const early = new Date("2026-10-01T12:00:00Z");
    expect(refundable(booking({ status: "parked" }), early)).toBe(false);
    expect(refundable(booking({ status: "departed" }), early)).toBe(false);
    expect(refundable(booking({ status: "cancelled" }), early)).toBe(false);
    expect(refundable(booking({ status: "pending_payment", paid: false }), early)).toBe(false);
  });
});

describe("reservationSchema", () => {
  const nightly = {
    plan: "nightly",
    arrive: "2026-10-05",
    nights: 2,
    name: "Dale Whitaker",
    phone: "940-555-0142",
    company: "",
    truck: "53' dry van",
    plate: "tx 8421rm",
    extras: { showers: 1, loads: 0 },
    website: "",
  };

  it("accepts a good nightly body", () => {
    const out = reservationSchema.parse(nightly);
    expect(out.plan).toBe("nightly");
    expect(out.arrive).toBe("2026-10-05");
    expect(out.nights).toBe(2);
    expect(out.name).toBe("Dale Whitaker");
    expect(out.extras).toEqual({ showers: 1, loads: 0 });
    expect(out.website).toBe("");
  });

  it("accepts a good monthly body and fills in defaults", () => {
    const out = reservationSchema.parse({ plan: "monthly", arrive: "2026-11-01", name: "Ray Fleitman", phone: "(940) 555-0128" });
    expect(out.plan).toBe("monthly");
    expect(out.nights).toBe(1);
    expect(out.company).toBe("");
    expect(out.truck).toBe("");
    expect(out.plate).toBe("");
    expect(out.extras).toEqual({ showers: 0, loads: 0 });
    expect(out.website).toBe("");
  });

  it("coerces nights and extras sent as strings", () => {
    const out = reservationSchema.parse({ ...nightly, nights: "3", extras: { showers: "2", loads: "1" } });
    expect(out.nights).toBe(3);
    expect(out.extras).toEqual({ showers: 2, loads: 1 });
    expect(reservationSchema.safeParse({ ...nightly, nights: "abc" }).success).toBe(false);
  });

  it("keeps nights between 1 and 30", () => {
    expect(reservationSchema.safeParse({ ...nightly, nights: 0 }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...nightly, nights: 31 }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...nightly, nights: 2.5 }).success).toBe(false);
    expect(reservationSchema.parse({ ...nightly, nights: 30 }).nights).toBe(30);
  });

  it("trims and rejects an empty name", () => {
    const r = reservationSchema.safeParse({ ...nightly, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["name"]);
    expect(reservationSchema.safeParse({ ...nightly, name: "   " }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...nightly, name: "D" }).success).toBe(false);
    expect(reservationSchema.parse({ ...nightly, name: "  Dale  " }).name).toBe("Dale");
  });

  it("rejects a phone number that is not a phone number", () => {
    for (const phone of ["", "12", "call me", "555-01", "(940) 5"]) {
      const r = reservationSchema.safeParse({ ...nightly, phone });
      expect(r.success, `phone "${phone}" should fail`).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(["phone"]);
    }
    expect(reservationSchema.parse({ ...nightly, phone: "+1 (940) 555-0142" }).phone).toBe("+1 (940) 555-0142");
  });

  it("rejects a filled-in honeypot", () => {
    const r = reservationSchema.safeParse({ ...nightly, website: "http://spam.example" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["website"]);
    expect(reservationSchema.safeParse({ ...nightly, website: undefined }).success).toBe(true);
  });

  it("rejects a bad date", () => {
    for (const arrive of ["tomorrow", "10/05/2026", "2026-13-01", "2026-02-29", "2026-10-5", ""]) {
      const r = reservationSchema.safeParse({ ...nightly, arrive });
      expect(r.success, `arrive "${arrive}" should fail`).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(["arrive"]);
    }
  });

  it("rejects an unknown plan", () => {
    expect(reservationSchema.safeParse({ ...nightly, plan: "weekly" }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...nightly, plan: undefined }).success).toBe(false);
  });
});
