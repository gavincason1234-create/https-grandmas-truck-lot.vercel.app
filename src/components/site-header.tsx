import Link from "next/link";
import { ShieldCheck, UserRound } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

export const NAV_LINKS = [
  { href: "/", label: "Tonight" },
  { href: "/lot", label: "The lot" },
  { href: "/pricing", label: "Pricing" },
  { href: "/directions", label: "Directions" },
  { href: "/reviews", label: "Reviews" },
  { href: "/find", label: "Find my booking" },
];

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getSessionUser(), getStore().getSettings()]);

  return (
    <header className="bg-header text-header-fg no-print">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="min-w-0 no-underline text-header-fg">
            <div className="text-[19px] sm:text-[22px] font-extrabold tracking-tight leading-tight truncate">{settings.lotName}</div>
            <div className="text-[12px] text-header-muted truncate hidden sm:block">{settings.address}</div>
          </Link>

          <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="px-3 py-2 rounded-sm text-[14px] font-semibold text-header-muted hover:text-header-fg hover:bg-white/10 no-underline">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link href={user.isAdmin ? "/admin" : "/account"} className="hidden sm:inline-flex items-center gap-2 min-h-12 px-3 rounded-sm border border-white/15 text-[14px] font-semibold text-header-fg hover:bg-white/10 no-underline">
                {user.isAdmin ? <ShieldCheck size={18} aria-hidden /> : <UserRound size={18} aria-hidden />}
                <span className="max-w-[140px] truncate">{user.isAdmin ? "Owner" : user.name || "Account"}</span>
              </Link>
            ) : (
              <Link href="/login" className="hidden sm:inline-flex items-center min-h-12 px-3 rounded-sm bg-accent text-on-accent text-[14px] font-bold no-underline hover:bg-accent-hover">
                Sign in
              </Link>
            )}
            <MobileNav links={NAV_LINKS} user={user ? { name: user.name, isAdmin: user.isAdmin } : null} />
          </div>
        </div>
      </div>
    </header>
  );
}
