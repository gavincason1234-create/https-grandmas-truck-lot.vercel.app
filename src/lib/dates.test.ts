import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, isIsoDay, nextBillAfter, prettyDay, todayStr } from "./dates";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds months without skipping (Jan 31 + 1 month = Feb 28)", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("measures whole days", () => {
    expect(daysBetween("2026-10-01", "2026-10-04")).toBe(3);
    expect(daysBetween("2026-10-04", "2026-10-01")).toBe(-3);
  });

  it("validates ISO days strictly", () => {
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("26-1-1")).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });

  it("uses the lot's Central Time day", () => {
    // 04:30 UTC on Oct 2 is still Oct 1 in Texas.
    expect(todayStr(new Date("2026-10-02T04:30:00Z"))).toBe("2026-10-01");
    expect(todayStr(new Date("2026-10-02T06:30:00Z"))).toBe("2026-10-02");
  });

  it("prints friendly days", () => {
    expect(prettyDay("2026-09-27")).toBe("Sun, Sep 27");
    expect(prettyDay(null)).toBe("");
  });
});

describe("nextBillAfter", () => {
  it("keeps the anniversary day like Stripe does", () => {
    // Started Jan 31: Feb 28, Mar 31, Apr 30 — never drifting to the 28th for good.
    expect(nextBillAfter("2026-01-31", "2026-02-28")).toBe("2026-03-31");
    expect(nextBillAfter("2026-01-31", "2026-03-31")).toBe("2026-04-30");
    expect(nextBillAfter("2026-01-15", "2026-02-15")).toBe("2026-03-15");
  });

  it("always moves forward even if the current date is behind", () => {
    expect(nextBillAfter("2026-01-10", "2025-12-01")).toBe("2026-02-10");
  });
});
