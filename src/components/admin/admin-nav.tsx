"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Tonight" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/monthly", label: "Monthly" },
  { href: "/admin/money", label: "Money" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/log", label: "Log" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The owner's sub-navigation. Sticks under the site header and scrolls sideways on a phone
 * so every tab stays one thumb-tap away.
 */
export function AdminNav({ who }: { who?: string }) {
  const pathname = usePathname() ?? "/admin";
  return (
    <nav aria-label="Owner dashboard" className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line no-print">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center gap-3">
        <ul className="flex items-stretch gap-1 overflow-x-auto flex-1 list-none m-0 p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ADMIN_LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <li key={l.href} className="shrink-0 flex">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center min-h-12 px-3.5 text-[15px] font-bold no-underline border-b-[3px] -mb-px transition-colors ${
                    active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {who ? (
          <div className="hidden md:block shrink-0 text-[12.5px] text-muted truncate max-w-[220px]" title={who}>
            Signed in as <span className="font-semibold text-fg">{who}</span>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
