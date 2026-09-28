import type { ReactNode } from "react";
import { CallBar } from "./call-bar";
import { SiteBackground } from "./site-background";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TestBanner } from "./test-banner";
import { getStore } from "@/lib/store";

/**
 * Standard driver-facing page: banner, header, content, footer, sticky call bar.
 * Admin pages use their own shell.
 */
export async function PageShell({ children, callBar = true, reserveHref, reserveLabel, width = "max-w-6xl" }: { children: ReactNode; callBar?: boolean; reserveHref?: string; reserveLabel?: string; width?: string }) {
  const settings = await getStore().getSettings();
  return (
    <>
      <SiteBackground url={settings.backgroundUrl} />
      <TestBanner settings={settings} />
      <SiteHeader />
      <main id="main" className={`mx-auto ${width} px-4 sm:px-6 ${callBar ? "pb-24" : "pb-8"}`}>
        {children}
      </main>
      <SiteFooter />
      {callBar ? <CallBar settings={settings} reserveHref={reserveHref} reserveLabel={reserveLabel} /> : null}
    </>
  );
}
