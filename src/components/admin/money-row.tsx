import type { ReactNode } from "react";
import { money } from "@/lib/money";

type Tone = "plain" | "ok" | "warn" | "muted";

const tones: Record<Tone, string> = {
  plain: "text-fg",
  ok: "text-ok",
  warn: "text-warn",
  muted: "text-muted",
};

/**
 * One line of the money page: a label on the left, dollars on the right.
 * `bar` (0..1) draws a proportional amber bar under the label for the month-by-month view.
 */
export function MoneyRow({ label, cents, tone = "plain", sub, bar, big = false }: { label: ReactNode; cents: number; tone?: Tone; sub?: ReactNode; bar?: number; big?: boolean }) {
  const width = bar === undefined ? null : `${Math.max(0, Math.min(1, bar)) * 100}%`;
  return (
    <div className="py-2.5 border-b border-line last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className={`${big ? "text-[16px] font-bold" : "text-[14.5px] font-semibold"} leading-snug`}>{label}</div>
          {sub ? <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">{sub}</div> : null}
        </div>
        <div className={`num whitespace-nowrap ${big ? "text-[20px] font-extrabold" : "text-[15px] font-bold"} ${tones[tone]}`}>{money(cents)}</div>
      </div>
      {width !== null ? (
        <div className="mt-2 h-2.5 rounded-[2px] bg-sunk overflow-hidden" aria-hidden>
          <div className="h-full bg-accent rounded-[2px]" style={{ width }} />
        </div>
      ) : null}
    </div>
  );
}
