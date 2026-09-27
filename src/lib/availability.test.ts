import { describe, expect, it } from "vitest";
import { bookingCoversDay, memberCoversDay, occupancyOn, occupancyRange, worstOpenForStay } from "./availability";

const settings = { spots: 3 };

const booking = (arrive: string, nights: number, status: "reserved" | "parked" | "departed" | "cancelled" | "pending_payment" = "reserved") => ({ arrive, nights, status });
const member = (started: string, status: "active" | "past_due" | "cancelled" | "pending_payment" = "active", ended: string | null = null) => ({ started, status, ended });

describe("availability", () => {
  it("a booking covers its nights and nothing else", () => {
    const b = booking("2026-10-01", 2);
    expect(bookingCoversDay(b, "2026-09-30")).toBe(false);
    expect(bookingCoversDay(b, "2026-10-01")).toBe(true);
    expect(bookingCoversDay(b, "2026-10-02")).toBe(true);
    expect(bookingCoversDay(b, "2026-10-03")).toBe(false);
  });

  it("departed and cancelled bookings free the stall", () => {
    expect(bookingCoversDay(booking("2026-10-01", 5, "departed"), "2026-10-02")).toBe(false);
    expect(bookingCoversDay(booking("2026-10-01", 5, "cancelled"), "2026-10-02")).toBe(false);
  });

  it("a booking waiting on payment still holds the stall briefly", () => {
    expect(bookingCoversDay(booking("2026-10-01", 1, "pending_payment"), "2026-10-01")).toBe(true);
  });

  it("members hold a stall every night from their start date", () => {
    const m = member("2026-09-01");
    expect(memberCoversDay(m, "2026-08-31")).toBe(false);
    expect(memberCoversDay(m, "2026-09-01")).toBe(true);
    expect(memberCoversDay(m, "2027-01-01")).toBe(true);
  });

  it("cancelled members hold the stall until their end date", () => {
    const m = member("2026-09-01", "cancelled", "2026-09-15");
    expect(memberCoversDay(m, "2026-09-14")).toBe(true);
    expect(memberCoversDay(m, "2026-09-15")).toBe(false);
  });

  it("counts nightly and monthly separately", () => {
    const o = occupancyOn(settings, [booking("2026-10-01", 1)], [member("2026-09-01")], "2026-10-01");
    expect(o).toEqual({ day: "2026-10-01", nightly: 1, monthly: 1, taken: 2, open: 1 });
  });

  it("never reports negative open spots", () => {
    const o = occupancyOn({ spots: 1 }, [booking("2026-10-01", 1), booking("2026-10-01", 1)], [], "2026-10-01");
    expect(o.open).toBe(0);
  });

  it("finds the worst night of a stay", () => {
    const bookings = [booking("2026-10-02", 1), booking("2026-10-02", 1), booking("2026-10-02", 1)];
    expect(worstOpenForStay(settings, bookings, [], "2026-10-01", 1)).toBe(3);
    expect(worstOpenForStay(settings, bookings, [], "2026-10-01", 2)).toBe(0);
    expect(occupancyRange(settings, bookings, [], "2026-10-01", 3).map((o) => o.open)).toEqual([3, 0, 3]);
  });
});
