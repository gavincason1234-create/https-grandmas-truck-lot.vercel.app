"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "light" | "dark";

function systemMode(): Mode {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Day / night switch. Truckers use this at 2 AM; night mode keeps the cab dark. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as Mode | null;
    setMode(current ?? systemMode());
  }, []);

  const toggle = () => {
    const next: Mode = (mode ?? systemMode()) === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("lot-theme", next);
    } catch {
      /* private mode */
    }
    setMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center justify-center w-12 h-12 rounded-sm border border-white/15 text-header-fg hover:bg-white/10 ${className}`}
      aria-label={mode === "dark" ? "Switch to day mode" : "Switch to night mode"}
      title={mode === "dark" ? "Day mode" : "Night mode"}
    >
      {mode === "dark" ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  );
}

/** Inline in <head> before paint so night mode doesn't flash white. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('lot-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;
