import type { MetadataRoute } from "next";

/** Read directly from process.env: this file runs at build time and must not pull in server-only modules. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://grandmas-truck-lot.vercel.app").replace(/\/$/, "");

const PUBLIC_PATHS = ["/", "/lot", "/pricing", "/directions", "/reviews", "/book", "/find"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path === "/book" ? 0.9 : 0.7,
  }));
}
