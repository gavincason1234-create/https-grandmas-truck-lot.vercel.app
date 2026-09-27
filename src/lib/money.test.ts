import { describe, expect, it } from "vitest";
import { money, parseDollars } from "./money";

describe("money", () => {
  it("formats whole dollars like a price sign", () => {
    expect(money(1000)).toBe("$10");
    expect(money(125000)).toBe("$1,250");
    expect(money(1250)).toBe("$12.50");
    expect(money(-500)).toBe("−$5");
    expect(money(0)).toBe("$0");
  });

  it("parses what an owner types", () => {
    expect(parseDollars("12")).toBe(1200);
    expect(parseDollars("12.5")).toBe(1250);
    expect(parseDollars("$1,250.00")).toBe(125000);
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("abc")).toBeNull();
    expect(parseDollars(10)).toBe(1000);
  });
});
