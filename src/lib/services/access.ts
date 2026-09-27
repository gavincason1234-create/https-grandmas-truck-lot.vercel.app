import { addDays, todayStr } from "../dates";
import type { Booking, Member, PrivateSettings } from "../types";

/** How many days before arrival a paid driver may see the gate codes. */
export const CODE_REVEAL_DAYS_AHEAD = 2;

/** The owner has typed real codes. Until then drivers are told to call rather than shown blanks. */
export function codesReady(priv: PrivateSettings, needShed: boolean): boolean {
  return priv.gate1.trim() !== "" && priv.gate2.trim() !== "" && (!needShed || priv.shedCode.trim() !== "");
}

export type CodeReveal =
  | { show: true; codes: PrivateSettings; shed: boolean }
  | { show: false; reason: "unpaid" | "cancelled" | "departed" | "too_early" | "ended" | "not_set"; availableOn?: string };

/**
 * The single rule for who sees gate codes. Used by the confirmation page, the account page,
 * the lookup API, and nothing else decides this.
 */
export function codesForBooking(b: Booking, priv: PrivateSettings, today = todayStr()): CodeReveal {
  if (b.status === "cancelled") return { show: false, reason: "cancelled" };
  if (b.status === "departed") return { show: false, reason: "departed" };
  if (!b.paid || b.status === "pending_payment") return { show: false, reason: "unpaid" };
  const revealFrom = addDays(b.arrive, -CODE_REVEAL_DAYS_AHEAD);
  if (today < revealFrom) return { show: false, reason: "too_early", availableOn: revealFrom };
  const lastNight = addDays(b.arrive, b.nights - 1);
  if (today > addDays(lastNight, 1)) return { show: false, reason: "ended" };
  const shed = b.extras.showers > 0 || b.extras.loads > 0;
  if (!codesReady(priv, shed)) return { show: false, reason: "not_set" };
  return { show: true, codes: priv, shed };
}

export function codesForMember(m: Member, priv: PrivateSettings, today = todayStr()): CodeReveal {
  if (m.status === "cancelled") {
    if (!(m.ended && today < m.ended)) return { show: false, reason: "cancelled" };
    return codesReady(priv, true) ? { show: true, codes: priv, shed: true } : { show: false, reason: "not_set" };
  }
  if (m.status === "pending_payment") return { show: false, reason: "unpaid" };
  const revealFrom = addDays(m.started, -CODE_REVEAL_DAYS_AHEAD);
  if (today < revealFrom) return { show: false, reason: "too_early", availableOn: revealFrom };
  if (!codesReady(priv, true)) return { show: false, reason: "not_set" };
  return { show: true, codes: priv, shed: true };
}

/** Strip gate codes when the viewer shouldn't have them, e.g. shed code for a nightly guest without add-ons. */
export function visibleCodes(reveal: CodeReveal): { gate1: string; gate2: string; shed: string | null } | null {
  if (!reveal.show) return null;
  return { gate1: reveal.codes.gate1, gate2: reveal.codes.gate2, shed: reveal.shed ? reveal.codes.shedCode : null };
}
