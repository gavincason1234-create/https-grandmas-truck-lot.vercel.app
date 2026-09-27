import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimits, rateLimit } from "./ratelimit";

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit("ip", opts).ok).toBe(true);
    expect(rateLimit("ip", opts).ok).toBe(true);
    expect(rateLimit("ip", opts).ok).toBe(true);
    const blocked = rateLimit("ip", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("keeps keys separate", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("b", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(false);
  });
});
