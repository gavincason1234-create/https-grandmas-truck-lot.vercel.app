import type { ReactNode } from "react";

type Tone = "ok" | "warn" | "plain" | "accent";

const tones: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  plain: "bg-sunk text-muted",
  accent: "bg-accent text-on-accent",
};

export function Tag({ tone = "plain", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-[2px] ${tones[tone]} ${className}`}>{children}</span>;
}
