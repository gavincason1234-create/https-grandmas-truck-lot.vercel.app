import { describe, expect, it } from "vitest";
import { safeBackgroundUrl } from "./background";

describe("safeBackgroundUrl", () => {
  it("accepts https links and local files", () => {
    expect(safeBackgroundUrl("https://photos.example.com/lot.jpg")).toBe("https://photos.example.com/lot.jpg");
    expect(safeBackgroundUrl("  https://a.b/c?x=1  ")).toBe("https://a.b/c?x=1");
    expect(safeBackgroundUrl("/lot-at-dusk.jpg")).toBe("/lot-at-dusk.jpg");
  });

  it("refuses anything that is not a plain https link", () => {
    expect(safeBackgroundUrl("")).toBeNull();
    expect(safeBackgroundUrl(null)).toBeNull();
    expect(safeBackgroundUrl("http://insecure.example/x.jpg")).toBeNull();
    expect(safeBackgroundUrl("javascript:alert(1)")).toBeNull();
    expect(safeBackgroundUrl("//evil.example/x.jpg")).toBeNull();
    expect(safeBackgroundUrl('https://a.b/x.jpg") , url("https://evil')).toBeNull();
    expect(safeBackgroundUrl("https://a.b/x y.jpg")).toBeNull();
    expect(safeBackgroundUrl("https://a.b/" + "x".repeat(700))).toBeNull();
  });
});
