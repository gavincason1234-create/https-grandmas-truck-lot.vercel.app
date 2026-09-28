/**
 * The owner can paste a photo link to use as the site's background.
 * Only plain https links (or a path under /public) are accepted, and nothing that could break out
 * of a CSS url("…") ever reaches the page.
 */
export function safeBackgroundUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 600) return null;
  if (/[\s"'()<>\\]/.test(v)) return null;
  if (/^https:\/\/[^/]+\/?/i.test(v)) return v;
  if (/^\/(?!\/)[^?#]*(\?[^#]*)?$/.test(v)) return v; // a file the owner put in /public
  return null;
}
