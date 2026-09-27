import Link from "next/link";
import type { DayOccupancy } from "@/lib/availability";
import { prettyDay } from "@/lib/dates";

/**
 * The next several nights as a row of tiles: how many spots are open each night.
 * Tapping a night with room starts a booking for that date. Full nights are shown in the
 * warning tone and are not links. Server component — the page computes the occupancy and passes it in.
 */
export function AvailabilityStrip({ days, spots, today }: { days: DayOccupancy[]; spots: number; today: string }) {
  if (!days.length) return null;
  return (
    <ol className="grid grid-cols-7 gap-1.5 list-none m-0 p-0" aria-label="Open spots for the next nights">
      {days.map((d) => {
        const full = d.open <= 0;
        const isToday = d.day === today;
        const [weekday = "", monthDay = ""] = prettyDay(d.day).split(", ");
        const dayNum = monthDay.split(" ")[1] ?? "";
        const label = `${isToday ? "Tonight, " : ""}${prettyDay(d.day)}: ${full ? "full" : `${d.open} of ${spots} open`}`;
        const inner = (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted leading-none">{weekday}</span>
            <span className="num text-[12px] font-semibold leading-none mt-1">{dayNum}</span>
            {full ? (
              <span className="text-[13px] font-extrabold leading-none mt-2">Full</span>
            ) : (
              <>
                <span className="num text-[20px] font-extrabold leading-none mt-1.5">{d.open}</span>
                <span className="text-[10px] font-semibold text-muted leading-none mt-1">open</span>
              </>
            )}
          </>
        );
        const box = `flex flex-col items-center justify-center min-h-[72px] rounded-sm border px-0.5 py-2 text-center no-underline ${
          full ? "border-warn/40 bg-warn-bg text-warn" : "bg-elev text-fg hover:bg-sunk"
        } ${isToday && !full ? "border-accent border-2" : full ? "" : "border-line"}`;
        return (
          <li key={d.day}>
            {full ? (
              <div className={box} role="img" aria-label={label}>
                {inner}
              </div>
            ) : (
              <Link href={`/book?plan=nightly&arrive=${d.day}`} className={box} aria-label={`${label}. Reserve this night.`}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
