import { MAX_QUERY } from "../services/book";

/** Where to send someone after sign-in. Only same-site paths are allowed (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return fallback;
  return raw;
}

/**
 * A dashboard page (with its search, if any) that an owner's button may send her back to.
 * Only /admin, /admin/<tab> and a plain form-encoded query string qualify — no "//", no "..",
 * no "#", nothing a browser could turn into a redirect off the site or a header injection.
 */
const ADMIN_BACK = /^\/admin(?:\/[a-z-]+)*(?:\?[A-Za-z0-9=&%+*._-]*)?$/;

/** The longest URL the Bookings page can legitimately emit: every search character percent-encoded (up to 12 bytes each). */
export const ADMIN_BACK_MAX = "/admin/bookings?q=".length + MAX_QUERY * 12 + "&show=waiting&on=2026-01-01&all=1".length;

/** The page a dashboard button should return to, or `fallback` when the hidden field is missing or not one of ours. */
export function safeAdminBack(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return raw.length <= ADMIN_BACK_MAX && ADMIN_BACK.test(raw) ? raw : fallback;
}
