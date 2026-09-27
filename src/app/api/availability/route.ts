import { handler, json } from "@/lib/api";
import { occupancyRange } from "@/lib/availability";
import { addDays, isIsoDay, todayStr } from "@/lib/dates";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 60;

/**
 * GET /api/availability?from=YYYY-MM-DD&days=1..60
 * Public. How many stalls are open each night — the same numbers the home page shows.
 * Never cached: a driver checking from the cab needs the count as of right now.
 */
export const GET = handler(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const fromParam = params.get("from");
  const from = isIsoDay(fromParam) ? fromParam : todayStr();
  const daysParsed = Number.parseInt(params.get("days") ?? "", 10);
  const days = Number.isFinite(daysParsed) ? Math.min(MAX_DAYS, Math.max(1, daysParsed)) : DEFAULT_DAYS;

  const store = getStore();
  const [settings, bookings, members] = await Promise.all([
    store.getSettings(),
    store.listBookings({ from, to: addDays(from, days - 1) }),
    store.listMembers({ includeCancelled: true }),
  ]);

  return json(
    { spots: settings.spots, from, days: occupancyRange(settings, bookings, members, from, days) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});
