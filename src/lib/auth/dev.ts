import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * Fake sign-in used only in memory mode (local dev + automated tests), where there is no Supabase.
 * A signed cookie carries a pretend user. Refused entirely on Vercel production.
 */
export const DEV_COOKIE = "lot_dev_user";

export type DevUser = { id: string; email: string; name: string };

export const DEV_USERS: Record<"driver" | "admin", DevUser> = {
  driver: { id: "00000000-0000-4000-8000-000000000001", email: "driver@example.com", name: "Test Driver" },
  admin: { id: "00000000-0000-4000-8000-000000000002", email: "admin@example.com", name: "Test Owner" },
};

function sign(payload: string): string {
  return createHmac("sha256", env.devAuthSecret).update(payload).digest("base64url");
}

export function encodeDevUser(u: DevUser): string {
  const payload = Buffer.from(JSON.stringify(u), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeDevUser(cookie: string | undefined): DevUser | null {
  if (!cookie) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const u = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DevUser;
    if (typeof u.id !== "string" || typeof u.email !== "string") return null;
    return u;
  } catch {
    return null;
  }
}
