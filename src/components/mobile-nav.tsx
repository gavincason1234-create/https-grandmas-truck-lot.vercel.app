"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  links: { href: string; label: string }[];
  user: { name: string; isAdmin: boolean } | null;
};

export function MobileNav({ links, user }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-12 h-12 rounded-sm border border-white/15 text-header-fg hover:bg-white/10"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        <Menu size={22} aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-header text-header-fg p-5 flex flex-col gap-1 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-extrabold">Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="w-12 h-12 inline-flex items-center justify-center rounded-sm border border-white/15" aria-label="Close menu">
                <X size={22} aria-hidden />
              </button>
            </div>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`block py-3.5 px-3 rounded-sm text-[17px] font-semibold no-underline ${pathname === l.href ? "bg-white/10 text-header-fg" : "text-header-muted hover:text-header-fg"}`}>
                {l.label}
              </Link>
            ))}
            <div className="mt-auto pt-4 border-t border-white/15">
              {user ? (
                <>
                  <Link href="/account" className="block py-3.5 px-3 text-[17px] font-semibold no-underline text-header-fg">
                    My account
                  </Link>
                  {user.isAdmin ? (
                    <Link href="/admin" className="block py-3.5 px-3 text-[17px] font-semibold no-underline text-accent">
                      Owner dashboard
                    </Link>
                  ) : null}
                </>
              ) : (
                <Link href="/login" className="block text-center py-3.5 px-3 rounded-sm bg-accent text-on-accent text-[17px] font-bold no-underline">
                  Sign in with Google
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
