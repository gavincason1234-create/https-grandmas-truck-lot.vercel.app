import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = ["LOT_STORE", "VERCEL", "VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

async function load(vars: Partial<Record<(typeof KEYS)[number], string>>) {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  return (await import("./env")).env;
}

const supa = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_x", SUPABASE_SERVICE_ROLE_KEY: "service" };

describe("env", () => {
  it("runs in memory with pretend sign-in on a developer's machine", async () => {
    const e = await load({ LOT_STORE: "memory" });
    expect(e.storeMode).toBe("memory");
    expect(e.devAuth).toBe(true);
    expect(e.notConfigured).toBe(false);
  });

  it("never offers pretend sign-in on Vercel, previews included", async () => {
    const e = await load({ VERCEL: "1", VERCEL_ENV: "preview" });
    expect(e.storeMode).toBe("memory");
    expect(e.devAuth).toBe(false);
    expect(e.notConfigured).toBe(false);
  });

  it("flags a production deployment that has no database", async () => {
    const e = await load({ VERCEL: "1", VERCEL_ENV: "production" });
    expect(e.storeMode).toBe("memory");
    expect(e.notConfigured).toBe(true);
    expect(e.devAuth).toBe(false);
  });

  it("refuses memory mode in production when a database is configured", async () => {
    const e = await load({ VERCEL: "1", VERCEL_ENV: "production", LOT_STORE: "memory", ...supa });
    expect(e.storeMode).toBe("supabase");
    expect(e.notConfigured).toBe(false);
  });

  it("prefers the stable production URL for auth redirects", async () => {
    const e = await load({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "grandmas-truck-lot.vercel.app", VERCEL_URL: "site-abc123.vercel.app", ...supa });
    expect(e.siteUrl).toBe("https://grandmas-truck-lot.vercel.app");
    const explicit = await load({ NEXT_PUBLIC_SITE_URL: "https://example.com/", VERCEL_URL: "site-abc123.vercel.app" });
    expect(explicit.siteUrl).toBe("https://example.com");
  });
});
