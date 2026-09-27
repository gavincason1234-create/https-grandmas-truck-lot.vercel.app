import { env } from "@/lib/env";
import type { LotSettings } from "@/lib/types";

/** Shown while payments are simulated so nobody thinks real money moved. */
export function TestBanner({ settings }: { settings: LotSettings }) {
  if (env.stripe.enabled && !settings.testMode) return null;
  return (
    <div className="bg-accent text-on-accent text-[12px] font-bold text-center px-3 py-1.5 no-print" role="status">
      Test mode — payments are simulated, no real money moves
    </div>
  );
}
