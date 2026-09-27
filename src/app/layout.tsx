import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { themeInitScript } from "@/components/theme-toggle";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Grandma's Truck Lot — Truck parking in Gainesville, TX", template: "%s · Grandma's Truck Lot" },
  description: "Gated, lit, pull-through truck parking off US-82 in Cooke County, Texas. Nightly spots and monthly memberships with shower and laundry. Reserve in a minute, gate code on your phone.",
  applicationName: "Grandma's Truck Lot",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Truck Lot", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: "Grandma's Truck Lot", title: "Grandma's Truck Lot", description: "Gated, lit truck parking off US-82. Nightly or monthly." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#23262B" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1113" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-accent focus:text-on-accent focus:px-3 focus:py-2 focus:rounded-sm">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
