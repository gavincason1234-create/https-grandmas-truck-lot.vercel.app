import type { DayOccupancy } from "@/lib/availability";
import { prettyDay } from "@/lib/dates";

/** Seven small tiles: how many stalls are open each of the next nights. Owner's version — no links. */
export function OpenStrip({ days, spots, today }: { days: DayOccupancy[]; spots: number; today: string }) {
  if (!days.length) return null;
  return (
    <ol className="grid grid-cols-7 gap-1 list-none m-0 p-0" aria-label="Open stalls for the next 7 nights">
      {days.map((d) => {
        const full = d.open <= 0;
        const [weekday = ""] = prettyDay(d.day).split(", ");
        const label = `${d.day === today ? "Tonight" : prettyDay(d.day)}: ${full ? "full" : `${d.open} of ${spots} open`}`;
        return (
          <li
            key={d.day}
            aria-label={label}
            title={label}
            className={`rounded-sm border px-0.5 py-1.5 text-center min-h-12 flex flex-col justify-center ${full ? "border-warn/40 bg-warn-bg text-warn" : "border-line bg-elev text-fg"}`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-muted leading-none">{d.day === today ? "Tonight" : weekday}</span>
            <span className="block num text-[17px] font-extrabold leading-tight mt-1">{full ? "Full" : d.open}</span>
            {!full ? <span className="block text-[10px] text-muted leading-none">open</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
