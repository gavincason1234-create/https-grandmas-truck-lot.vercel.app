import { safeBackgroundUrl } from "@/lib/background";

/**
 * The owner's background photo, fixed behind everything and tinted so text stays readable.
 * Renders nothing when no (valid) link is set — the built-in CSS background shows instead.
 */
export function SiteBackground({ url }: { url: string }) {
  const src = safeBackgroundUrl(url);
  if (!src) return null;
  return <div className="site-bg no-print" aria-hidden style={{ backgroundImage: `url("${src}")` }} />;
}
