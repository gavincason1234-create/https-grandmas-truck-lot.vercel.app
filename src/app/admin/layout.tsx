import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { SiteBackground } from "@/components/site-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TestBanner } from "@/components/test-banner";
import { Note } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { env } from "@/lib/env";
import { vaultStatus } from "@/lib/vault";

/**
 * The owner's shell: banner, site header, the dashboard tabs, then the page.
 * Only accounts in the safe get past requireAdmin. Every page underneath checks again.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin("/admin");
  const settings = await getStore().getSettings();
  const vault = vaultStatus();

  return (
    <>
      <SiteBackground url={settings.backgroundUrl} />
      <TestBanner settings={settings} />
      <SiteHeader />
      <AdminNav who={user.email} />
      {vault.state !== "open" && !env.devAuth ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-4">
          <Note className="bg-warn-bg" role="status">
            <span className="text-warn font-semibold">
              The safe is locked ({vault.reason}). Admins are coming from the ADMIN_EMAILS fallback. Set VAULT_KEY on Vercel — see vault/README.md.
            </span>
          </Note>
        </div>
      ) : null}
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
