import { describe, expect, it } from "vitest";
import type { Booking, Member, PrivateSettings } from "../types";
import { CODE_REVEAL_DAYS_AHEAD, codesForBooking, codesForMember, visibleCodes } from "./access";

const priv: PrivateSettings = { gate1: "4821", gate2: "7730", shedCode: "1955" };

/** Two nights, Oct 10 and Oct 11; pull out the morning of Oct 12. Paid and reserved unless told otherwise. */
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

/** Started Oct 1, next charge Nov 1, active unless told otherwise. */
const member = (over: Partial<Member> = {}): Member => ({
  id: "m1",
  code: "H2WZ6",
  kind: "monthly",
  userId: null,
  name: "Ray Fleitman",
  phone: "(940) 555-0128",
  company: "Fleitman Hay & Cattle",
  truck: "Peterbilt 389",
  plate: "TX 5507HC",
  started: "2026-10-01",
  nextBill: "2026-11-01",
  amountCents: 25000,
  status: "active",
  ended: null,
  paymentRef: null,
  createdAt: "2026-09-20T12:00:00.000Z",
  updatedAt: "2026-09-20T12:00:00.000Z",
  ...over,
});

describe("codesForBooking", () => {
  it("reveals two days ahead", () => {
    expect(CODE_REVEAL_DAYS_AHEAD).toBe(2);
  });

  it("hides codes until the stay is paid", () => {
    expect(codesForBooking(booking({ paid: false, status: "pending_payment" }), priv, "2026-10-10")).toEqual({ show: false, reason: "unpaid" });
    // "Reserved · owes" — the owner let them in without paying up front. Still no codes.
    expect(codesForBooking(booking({ paid: false, status: "reserved" }), priv, "2026-10-10")).toEqual({ show: false, reason: "unpaid" });
    // Marked paid but the status never moved on from pending: treat as unpaid, never leak codes.
    expect(codesForBooking(booking({ paid: true, status: "pending_payment" }), priv, "2026-10-10")).toEqual({ show: false, reason: "unpaid" });
  });

  it("hides codes for cancelled and departed stays, even on the night itself", () => {
    expect(codesForBooking(booking({ status: "cancelled" }), priv, "2026-10-10")).toEqual({ show: false, reason: "cancelled" });
    expect(codesForBooking(booking({ status: "departed" }), priv, "2026-10-10")).toEqual({ show: false, reason: "departed" });
    // Cancelled wins over unpaid: the driver should hear "cancelled", not "pay first".
    expect(codesForBooking(booking({ status: "cancelled", paid: false }), priv, "2026-10-10")).toEqual({ show: false, reason: "cancelled" });
  });

  it("is too early more than two days before arrival and says which day the codes unlock", () => {
    expect(codesForBooking(booking(), priv, "2026-10-07")).toEqual({ show: false, reason: "too_early", availableOn: "2026-10-08" });
    expect(codesForBooking(booking(), priv, "2026-09-01")).toEqual({ show: false, reason: "too_early", availableOn: "2026-10-08" });
  });

  it("shows codes two days before arrival and the day before", () => {
    expect(codesForBooking(booking(), priv, "2026-10-08")).toMatchObject({ show: true });
    expect(codesForBooking(booking(), priv, "2026-10-09")).toMatchObject({ show: true });
  });

  it("shows codes on every night of the stay", () => {
    expect(codesForBooking(booking(), priv, "2026-10-10")).toMatchObject({ show: true });
    expect(codesForBooking(booking(), priv, "2026-10-11")).toMatchObject({ show: true });
    expect(codesForBooking(booking({ status: "parked" }), priv, "2026-10-11")).toMatchObject({ show: true });
  });

  it("keeps codes through the morning after the last night, then ends", () => {
    // Last night is Oct 11; the driver pulls out on the 12th and may still need the gate.
    expect(codesForBooking(booking(), priv, "2026-10-12")).toMatchObject({ show: true });
    expect(codesForBooking(booking(), priv, "2026-10-13")).toEqual({ show: false, reason: "ended" });
    expect(codesForBooking(booking(), priv, "2026-11-13")).toEqual({ show: false, reason: "ended" });
  });

  it("handles a one-night stay the same way", () => {
    const one = booking({ nights: 1 });
    expect(codesForBooking(one, priv, "2026-10-10")).toMatchObject({ show: true });
    expect(codesForBooking(one, priv, "2026-10-11")).toMatchObject({ show: true }); // grace day
    expect(codesForBooking(one, priv, "2026-10-12")).toEqual({ show: false, reason: "ended" });
  });

  it("adds the shed code only with a shower or laundry add-on", () => {
    expect(codesForBooking(booking(), priv, "2026-10-10")).toEqual({ show: true, codes: priv, shed: false });
    expect(codesForBooking(booking({ extras: { showers: 1, loads: 0 } }), priv, "2026-10-10")).toEqual({ show: true, codes: priv, shed: true });
    expect(codesForBooking(booking({ extras: { showers: 0, loads: 1 } }), priv, "2026-10-10")).toEqual({ show: true, codes: priv, shed: true });
    expect(codesForBooking(booking({ extras: { showers: 2, loads: 3 } }), priv, "2026-10-10")).toEqual({ show: true, codes: priv, shed: true });
  });
});

describe("codesForMember", () => {
  it("members always get the shed", () => {
    expect(codesForMember(member(), priv, "2026-10-15")).toEqual({ show: true, codes: priv, shed: true });
  });

  it("hides codes while the first payment is pending", () => {
    expect(codesForMember(member({ status: "pending_payment" }), priv, "2026-10-15")).toEqual({ show: false, reason: "unpaid" });
  });

  it("is too early more than two days before the start", () => {
    expect(codesForMember(member(), priv, "2026-09-28")).toEqual({ show: false, reason: "too_early", availableOn: "2026-09-29" });
  });

  it("shows codes from two days before the start onward", () => {
    expect(codesForMember(member(), priv, "2026-09-29")).toMatchObject({ show: true, shed: true });
    expect(codesForMember(member(), priv, "2026-09-30")).toMatchObject({ show: true, shed: true });
    expect(codesForMember(member(), priv, "2026-10-01")).toMatchObject({ show: true, shed: true });
    expect(codesForMember(member(), priv, "2027-03-01")).toMatchObject({ show: true, shed: true });
  });

  it("still lets a past-due member in — the owner chases the money, the gate doesn't", () => {
    expect(codesForMember(member({ status: "past_due", nextBill: "2026-10-10" }), priv, "2026-10-15")).toMatchObject({ show: true, shed: true });
  });

  it("keeps codes for a cancelled member until the paid period ends", () => {
    const cancelled = member({ status: "cancelled", ended: "2026-11-01" });
    expect(codesForMember(cancelled, priv, "2026-10-15")).toEqual({ show: true, codes: priv, shed: true });
    expect(codesForMember(cancelled, priv, "2026-10-31")).toEqual({ show: true, codes: priv, shed: true });
    // The ended day itself is the first day without a stall.
    expect(codesForMember(cancelled, priv, "2026-11-01")).toEqual({ show: false, reason: "cancelled" });
    expect(codesForMember(cancelled, priv, "2026-11-02")).toEqual({ show: false, reason: "cancelled" });
  });

  it("hides codes for a cancelled member with no end date", () => {
    expect(codesForMember(member({ status: "cancelled", ended: null }), priv, "2026-10-15")).toEqual({ show: false, reason: "cancelled" });
  });
});

describe("visibleCodes", () => {
  it("returns nothing when the codes are hidden", () => {
    expect(visibleCodes({ show: false, reason: "unpaid" })).toBeNull();
    expect(visibleCodes({ show: false, reason: "too_early", availableOn: "2026-10-08" })).toBeNull();
    expect(visibleCodes({ show: false, reason: "ended" })).toBeNull();
  });

  it("returns both gate codes and no shed code for a plain nightly stay", () => {
    expect(visibleCodes({ show: true, codes: priv, shed: false })).toEqual({ gate1: "4821", gate2: "7730", shed: null });
  });

  it("includes the shed code when the stay earns it", () => {
    expect(visibleCodes({ show: true, codes: priv, shed: true })).toEqual({ gate1: "4821", gate2: "7730", shed: "1955" });
  });

  it("agrees with codesForBooking end to end", () => {
    expect(visibleCodes(codesForBooking(booking({ extras: { showers: 1, loads: 0 } }), priv, "2026-10-10"))).toEqual({ gate1: "4821", gate2: "7730", shed: "1955" });
    expect(visibleCodes(codesForBooking(booking(), priv, "2026-10-10"))).toEqual({ gate1: "4821", gate2: "7730", shed: null });
    expect(visibleCodes(codesForBooking(booking({ status: "departed" }), priv, "2026-10-10"))).toBeNull();
  });
});

describe("codes that the owner has not typed yet", () => {
  it("tells the driver to call instead of showing blanks", () => {
    const blank = { gate1: "", gate2: "", shedCode: "" };
    const paid = booking({ paid: true, status: "reserved", arrive: "2026-10-01" });
    const r = codesForBooking(paid, blank, "2026-10-01");
    expect(r.show).toBe(false);
    if (!r.show) expect(r.reason).toBe("not_set");
  });

  it("only needs the shed code when the stay uses the shed", () => {
    const noShed = { gate1: "1111", gate2: "2222", shedCode: "" };
    const plain = booking({ paid: true, status: "reserved", arrive: "2026-10-01", extras: { showers: 0, loads: 0 } });
    expect(codesForBooking(plain, noShed, "2026-10-01").show).toBe(true);
    const shower = booking({ paid: true, status: "reserved", arrive: "2026-10-01", extras: { showers: 1, loads: 0 } });
    expect(codesForBooking(shower, noShed, "2026-10-01").show).toBe(false);
  });
});
