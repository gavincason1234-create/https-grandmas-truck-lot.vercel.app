import type { DayOccupancy } from "@/lib/availability";

/** The lot drawn as a row of angled stalls. Green = monthly, dark = nightly, dashed = open. */
export function Stalls({ spots, occupancy, label }: { spots: number; occupancy: DayOccupancy; label?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex gap-1 h-[54px] overflow-hidden pb-1 min-w-0" role="img" aria-label={label ?? `${occupancy.open} of ${spots} spots open`}>
        {Array.from({ length: spots }).map((_, i) => {
          const cls = i < occupancy.monthly ? "member" : i < occupancy.taken ? "taken" : "open";
          return <div key={i} className={`stall ${cls}`} />;
        })}
      </div>
      <div className="stall-legend flex gap-4 text-xs text-muted mt-2.5">
        <span>
          <i style={{ background: "var(--ok)" }} />
          Monthly
        </span>
        <span>
          <i style={{ background: "var(--line-strong)" }} />
          Nightly
        </span>
        <span>
          <i style={{ border: "1.5px dashed var(--fg-faint)" }} />
          Open
        </span>
      </div>
    </div>
  );
}
