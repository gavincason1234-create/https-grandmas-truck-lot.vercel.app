import { money } from "./money";
import type { Extras, LotSettings } from "./types";

export type PriceLine = { label: string; amountCents: number };

export type Quote = { lines: PriceLine[]; totalCents: number };

export function clampNights(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(30, Math.trunc(v)));
}

export function clampExtras(e: Partial<Extras> | null | undefined, allowed: boolean): Extras {
  if (!allowed) return { showers: 0, loads: 0 };
  const clamp = (v: unknown) => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(20, Math.trunc(n))) : 0;
  };
  return { showers: clamp(e?.showers), loads: clamp(e?.loads) };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export type PriceSettings = Pick<LotSettings, "nightlyCents" | "monthlyCents" | "showerCents" | "laundryCents" | "nightlyExtras">;

export function quoteNightly(settings: PriceSettings, nightsIn: number, extrasIn: Extras): Quote {
  const nights = clampNights(nightsIn);
  const extras = clampExtras(extrasIn, settings.nightlyExtras);
  const lines: PriceLine[] = [
    { label: `${plural(nights, "night")} × ${money(settings.nightlyCents)}`, amountCents: nights * settings.nightlyCents },
  ];
  if (extras.showers) {
    lines.push({ label: `${plural(extras.showers, "shower")} × ${money(settings.showerCents)}`, amountCents: extras.showers * settings.showerCents });
  }
  if (extras.loads) {
    lines.push({ label: `${plural(extras.loads, "laundry load")} × ${money(settings.laundryCents)}`, amountCents: extras.loads * settings.laundryCents });
  }
  return { lines, totalCents: lines.reduce((a, l) => a + l.amountCents, 0) };
}

export function quoteMonthly(settings: PriceSettings): Quote {
  const lines: PriceLine[] = [
    { label: "Monthly spot · shower & laundry included", amountCents: settings.monthlyCents },
  ];
  return { lines, totalCents: settings.monthlyCents };
}

/** Stripe-style card fees, used only for the owner's money view. */
export function estimateCardFees(amountCents: number, transactions: number): number {
  return Math.round(amountCents * 0.029 + transactions * 30);
}
