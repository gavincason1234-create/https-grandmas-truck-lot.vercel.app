"use client";

import { Check, Lock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { money } from "@/lib/money";

type Phase = "idle" | "busy" | "done";

type Props = {
  open: boolean;
  /** Who is getting paid — the lot's name. */
  merchant: string;
  amountCents: number;
  /** One line under the amount: "2 nights from Sat, Sep 27". */
  summary: string;
  /** Monthly plans show "/month" after the amount. */
  recurring?: boolean;
  /**
   * Runs while the spinner shows. Return true to finish with the ✓ and call onPaid;
   * return false when the parent already handled a failure (the sheet resets).
   */
  onPay?: () => Promise<boolean>;
  onPaid: () => void;
  onCancel: () => void;
};

const PROCESSING_MS = 1300;
const DONE_MS = 650;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Pretend Stripe checkout for simulated payments. Looks like the real sheet so the flow
 * feels the same in test mode, but nothing here talks to a card network.
 */
export function CheckoutSheet({ open, merchant, amountCents, summary, recurring = false, onPay, onPaid, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const payRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    const t = window.setTimeout(() => payRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const cancel = useCallback(() => {
    if (phase !== "idle") return;
    onCancel();
  }, [phase, onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cancel]);

  async function pay() {
    if (phase !== "idle") return;
    setPhase("busy");
    let ok = true;
    try {
      const [result] = await Promise.all([onPay ? onPay() : Promise.resolve(true), sleep(PROCESSING_MS)]);
      ok = result;
    } catch {
      ok = false;
    }
    if (!alive.current) return;
    if (!ok) {
      setPhase("idle");
      return;
    }
    setPhase("done");
    await sleep(DONE_MS);
    if (alive.current) onPaid();
  }

  if (!open) return null;

  const amount = money(amountCents);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center no-print" onClick={cancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        aria-describedby="checkout-summary"
        className="w-full sm:max-w-md bg-elev text-fg rounded-t-lg sm:rounded-lg shadow-2xl border border-line p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-[2px] bg-accent text-on-accent uppercase tracking-wide">
            Test mode · simulation
          </span>
          <button
            type="button"
            onClick={cancel}
            disabled={phase !== "idle"}
            className="w-12 h-12 inline-flex items-center justify-center rounded-sm border border-line hover:bg-sunk disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <h2 id="checkout-title" className="m-0 mt-4 text-[14px] font-bold text-muted">
          {merchant}
        </h2>
        <div className="num text-[34px] font-extrabold tracking-tight leading-none mt-1">
          {amount}
          {recurring ? <span className="text-[15px] text-muted font-semibold"> /month</span> : null}
        </div>
        <p id="checkout-summary" className="m-0 mt-1.5 text-[13.5px] text-muted">
          {summary}
        </p>

        {phase === "done" ? (
          <div className="mt-6 mb-3 flex flex-col items-center gap-2 text-ok" role="status" aria-live="polite">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ok-bg">
              <Check size={34} aria-hidden />
            </span>
            <b className="text-[16px]">Paid</b>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-2">
              <label htmlFor="sim-card" className="text-[12.5px] font-semibold text-muted">
                Card
              </label>
              <input id="sim-card" readOnly value="4242 4242 4242 4242" className="num" aria-describedby="sim-card-hint" />
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Expiration" readOnly value="12 / 34" className="num" />
                <input aria-label="Security code" readOnly value="123" className="num" />
              </div>
              <p id="sim-card-hint" className="m-0 text-[12px] text-muted inline-flex items-center gap-1.5">
                <Lock size={12} aria-hidden /> Stripe&apos;s test card. No real money moves.
              </p>
            </div>

            <button ref={payRef} type="button" onClick={pay} disabled={phase !== "idle"} aria-busy={phase === "busy" || undefined} className={buttonClass("primary", "lg", "mt-4")}>
              {phase === "busy" ? (
                <>
                  <span className="spin" aria-hidden /> Processing…
                </>
              ) : (
                `Pay ${amount}`
              )}
            </button>
            <button type="button" onClick={cancel} disabled={phase !== "idle"} className="mt-2 w-full min-h-12 rounded-sm text-[14px] font-semibold text-muted hover:bg-sunk disabled:opacity-50">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
