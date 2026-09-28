import { describe, expect, it } from "vitest";
import { bookHref, MAX_QUERY } from "../services/book";
import { ADMIN_BACK_MAX, safeAdminBack, safeNext } from "./next";

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

describe("safeAdminBack", () => {
  const T = "/admin";

  it("keeps the dashboard's own pages, with or without a search", () => {
    expect(safeAdminBack("/admin", T)).toBe("/admin");
    expect(safeAdminBack("/admin/bookings", T)).toBe("/admin/bookings");
    expect(safeAdminBack("/admin/bookings?q=Dale+W&show=lot&on=2026-10-10&all=1", T)).toBe("/admin/bookings?q=Dale+W&show=lot&on=2026-10-10&all=1");
    expect(safeAdminBack("/admin/bookings?q=a%26b%3Dc%23d", T)).toBe("/admin/bookings?q=a%26b%3Dc%23d");
    // A percent-encoded line break is what the page itself emits for a pasted newline. It stays
    // three plain characters in the Location header, so it cannot split it.
    expect(safeAdminBack("/admin/bookings?q=x%0D%0Ay", T)).toBe("/admin/bookings?q=x%0D%0Ay");
  });

  it("accepts every URL the Bookings page can build, even a search full of accents or emoji", () => {
    for (const q of ["ñ".repeat(MAX_QUERY), "🚚".repeat(MAX_QUERY), "José Peña & Sons #2 / TX-8421", "x".repeat(MAX_QUERY)]) {
      const href = bookHref({ q, show: "waiting", on: "2026-01-01", all: true });
      expect(href.length).toBeLessThanOrEqual(ADMIN_BACK_MAX);
      expect(safeAdminBack(href, T)).toBe(href);
    }
  });

  it("refuses anything that is not one of our dashboard pages", () => {
    for (const bad of [
      "//evil.example",
      "https://evil.example/admin",
      "/admin//evil.example",
      "/admin/../account",
      "/admin\\x",
      "/admin/bookings?q=a#b",
      "/admin/bookings?q=a/b",
      "/admin/bookings?q=x\n",
      "/admin/bookings?q=x\r\nLocation:+https://evil.example",
      "/ADMIN",
      "/account",
      "/admin/Bookings",
      "/admin/bookings/../../login",
      "/adminx",
      " /admin",
      "/admin/bookings?q=" + "a".repeat(ADMIN_BACK_MAX),
    ]) {
      expect(safeAdminBack(bad, T), bad).toBe(T);
    }
  });

  it("falls back when the field is missing", () => {
    expect(safeAdminBack("", T)).toBe(T);
    expect(safeAdminBack(null, "/admin/bookings")).toBe("/admin/bookings");
    expect(safeAdminBack(undefined, T)).toBe(T);
  });
});
