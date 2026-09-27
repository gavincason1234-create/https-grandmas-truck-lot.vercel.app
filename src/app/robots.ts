import type { MetadataRoute } from "next";

/** Read directly from process.env: this file runs at build time and must not pull in server-only modules. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://grandmas-truck-lot.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api", "/auth"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
