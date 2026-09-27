import type { ReactNode } from "react";

/** A one-line message after a button was tapped: "Saved.", "That booking is gone.", etc. */
export function Notice({ tone = "ok", children, className = "" }: { tone?: "ok" | "warn"; children: ReactNode; className?: string }) {
  const colours = tone === "ok" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn";
  return (
    <div role="status" className={`rounded-sm px-4 py-3 text-[14.5px] font-semibold leading-relaxed ${colours} ${className}`}>
      {children}
    </div>
  );
}
