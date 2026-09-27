import { describe, expect, it } from "vitest";
import { formatPhone, makeCode, normalizeCode, phoneDigits, phoneLast4 } from "./codes";

describe("codes", () => {
  it("makes readable 5-character codes without 0/O/1/I", () => {
    for (let i = 0; i < 200; i++) {
      const c = makeCode();
      expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it("normalizes what a driver types at the gate", () => {
    expect(normalizeCode(" k7m2p ")).toBe("K7M2P");
    expect(normalizeCode("k7-m2p")).toBe("K7M2P");
    expect(normalizeCode("0K1")).toBe("OKI");
  });

  it("formats phones", () => {
    expect(formatPhone("9405550100")).toBe("(940) 555-0100");
    expect(formatPhone("+1 940 555 0100")).toBe("(940) 555-0100");
    expect(formatPhone("555-0100")).toBe("555-0100");
    expect(phoneDigits("(940) 555-0100")).toBe("9405550100");
    expect(phoneLast4("+1 (940) 555-0100")).toBe("0100");
  });
});
