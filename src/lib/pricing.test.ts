import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { clampExtras, clampNights, estimateCardFees, quoteMonthly, quoteNightly } from "./pricing";

describe("pricing", () => {
  it("quotes a plain night", () => {
    const q = quoteNightly(DEFAULT_SETTINGS, 1, { showers: 0, loads: 0 });
    expect(q.totalCents).toBe(1000);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]!.label).toBe("1 night × $10");
  });

  it("adds showers and laundry for nightly guests", () => {
    const q = quoteNightly(DEFAULT_SETTINGS, 3, { showers: 2, loads: 1 });
    expect(q.totalCents).toBe(3 * 1000 + 2 * 1000 + 500);
    expect(q.lines.map((l) => l.label)).toEqual(["3 nights × $10", "2 showers × $10", "1 laundry load × $5"]);
  });

  it("ignores extras when the owner turned them off", () => {
    const q = quoteNightly({ ...DEFAULT_SETTINGS, nightlyExtras: false }, 1, { showers: 5, loads: 5 });
    expect(q.totalCents).toBe(1000);
  });

  it("clamps nights to 1..30 and extras to 0..20", () => {
    expect(clampNights(0)).toBe(1);
    expect(clampNights("99")).toBe(30);
    expect(clampNights("abc")).toBe(1);
    expect(clampNights(2.9)).toBe(2);
    expect(clampExtras({ showers: -3, loads: 999 }, true)).toEqual({ showers: 0, loads: 20 });
    expect(clampExtras({ showers: 2 }, false)).toEqual({ showers: 0, loads: 0 });
  });

  it("monthly includes shower and laundry", () => {
    const q = quoteMonthly(DEFAULT_SETTINGS);
    expect(q.totalCents).toBe(12500);
    expect(q.lines[0]!.label).toMatch(/included/);
  });

  it("estimates card fees like Stripe", () => {
    expect(estimateCardFees(12500, 1)).toBe(Math.round(12500 * 0.029 + 30));
  });
});
