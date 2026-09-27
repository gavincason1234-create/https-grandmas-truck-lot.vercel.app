import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("/book?plan=monthly&arrive=2026-10-01")).toBe("/book?plan=monthly&arrive=2026-10-01");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNext("https://evil.example/phish")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext("javascript:alert(1)")).toBe("/account");
    expect(safeNext("/x?u=http://ok")).toBe("/account");
  });

  it("falls back when empty", () => {
    expect(safeNext(null)).toBe("/account");
    expect(safeNext(undefined, "/admin")).toBe("/admin");
    expect(safeNext("", "/admin")).toBe("/admin");
  });
});
