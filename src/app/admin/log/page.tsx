import type { Metadata } from "next";
import { Empty, Note, Panel } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { LOT_TIME_ZONE } from "@/lib/dates";
import { getStore } from "@/lib/store";
import type { AuditEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Log · Owner" };
export const dynamic = "force-dynamic";

const whenFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: LOT_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const whenFormatLong = new Intl.DateTimeFormat("en-US", {
  timeZone: LOT_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function when(at: string): { short: string; long: string } {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return { short: at, long: at };
  return { short: whenFormat.format(d), long: whenFormatLong.format(d) };
}

/** "admin.mark_arrived" → "mark arrived"; "driver.cancel_booking" → "driver: cancel booking" */
function plainAction(action: string): string {
  const words = action.replace(/^(admin|driver)\./, "").replace(/[._]+/g, " ");
  return action.startsWith("driver.") ? `driver: ${words}` : words;
}

function metaText(meta: AuditEntry["meta"]): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return JSON.stringify(meta);
  } catch {
    return "";
  }
}

export default async function AdminLogPage() {
  await requireAdmin("/admin/log");
  const entries = await getStore().listAudit(200);

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Log</h1>
        <span className="text-muted text-[14.5px] font-semibold">Last {entries.length} of up to 200 · Texas time</span>
      </div>

      <Note className="mt-4">Every button tapped on this dashboard is written down here: when, which account, what it did and to which booking. Gate codes are never written here — only that they changed.</Note>

      {entries.length === 0 ? (
        <Empty className="mt-6">Nothing in the log yet. It fills in as you mark drivers in and out.</Empty>
      ) : (
        <Panel className="mt-5 p-0 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-4 py-2.5 text-xs font-bold text-muted border-b border-line bg-sunk">
            <div>When</div>
            <div>Who</div>
            <div>What</div>
            <div>Details</div>
          </div>
          <ol className="list-none m-0 p-0">
            {entries.map((e) => {
              const t = when(e.at);
              const meta = metaText(e.meta);
              return (
                <li key={e.id} className="grid gap-x-3 gap-y-1 px-4 py-3 border-b border-line last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:items-start">
                  <time dateTime={e.at} title={t.long} className="num text-[13px] text-muted sm:text-fg">
                    {t.short}
                  </time>
                  <div className="text-[13.5px] truncate" title={e.actor}>
                    {e.actor}
                  </div>
                  <div className="text-[14px] font-bold">
                    <span className="capitalize">{plainAction(e.action)}</span>
                    {e.target ? <span className="font-semibold text-muted"> · {e.target}</span> : null}
                  </div>
                  <div className="min-w-0">{meta ? <code className="block text-[11.5px] leading-relaxed text-muted break-all bg-sunk rounded-[2px] px-1.5 py-0.5">{meta}</code> : null}</div>
                </li>
              );
            })}
          </ol>
        </Panel>
      )}
    </div>
  );
}
