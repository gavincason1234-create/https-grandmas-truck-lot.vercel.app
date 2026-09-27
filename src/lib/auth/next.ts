/** Where to send someone after sign-in. Only same-site paths are allowed (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return fallback;
  return raw;
}
