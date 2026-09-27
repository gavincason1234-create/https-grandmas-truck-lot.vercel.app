"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CodesPanel } from "@/components/codes-panel";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { normalizeCode } from "@/lib/codes";
import { prettyDay } from "@/lib/dates";
import { money } from "@/lib/money";
import type { CodeReveal } from "@/lib/services/access";
import type { BookingStatus, Extras, MemberStatus } from "@/lib/types";

/** What /api/lookup returns. Plain JSON — no full phone number, ever. */
type LookupBase = {
  code: string;
  name: string;
  truck: string;
  plate: string;
  company: string;
  phoneLast4: string;
  amountCents: number;
  paid: boolean;
  codes: { gate1: string; gate2: string; shed: string | null } | null;
  codesReason: "unpaid" | "cancelled" | "departed" | "too_early" | "ended" | "not_set" | null;
  codesAvailableOn: string | null;
  codesMessage: string | null;
};

export type LookupStay =
  | (LookupBase & { kind: "nightly"; arrive: string; nights: number; extras: Extras; status: BookingStatus })
  | (LookupBase & { kind: "monthly"; started: string; nextBill: string; ended: string | null; status: MemberStatus });

type ApiFail = { error: string; code?: string; field?: string };

function toReveal(stay: LookupStay): CodeReveal {
  if (stay.codes) {
    return { show: true, codes: { gate1: stay.codes.gate1, gate2: stay.codes.gate2, shedCode: stay.codes.shed ?? "" }, shed: stay.codes.shed !== null };
  }
  return { show: false, reason: stay.codesReason ?? "unpaid", availableOn: stay.codesAvailableOn ?? undefined };
}

function statusOf(stay: LookupStay): { text: string; tone: "ok" | "warn" | "plain" | "accent" } {
  if (stay.kind === "monthly") {
    switch (stay.status) {
      case "active":
        return { text: "Current", tone: "ok" };
      case "past_due":
        return { text: "Past due", tone: "warn" };
      case "pending_payment":
        return { text: "Waiting on payment", tone: "warn" };
      case "cancelled":
        return { text: "Cancelled", tone: "plain" };
    }
  }
  switch (stay.status) {
    case "reserved":
      return stay.paid ? { text: "Paid · reserved", tone: "ok" } : { text: "Reserved · owes", tone: "warn" };
    case "parked":
      return stay.paid ? { text: "Parked · paid", tone: "ok" } : { text: "Parked · owes money", tone: "warn" };
    case "pending_payment":
      return { text: "Waiting on payment", tone: "warn" };
    case "departed":
      return { text: "Pulled out", tone: "plain" };
    case "cancelled":
      return { text: "Cancelled", tone: "plain" };
  }
}

export function FindForm({ phone, notes, initialCode = "" }: { phone: string; notes: string; initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [last4, setLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ code?: string; last4?: string }>({});
  const [stay, setStay] = useState<LookupStay | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const cleanCode = normalizeCode(code);
    const digits = last4.replace(/\D/g, "");
    const errs: { code?: string; last4?: string } = {};
    if (cleanCode.length < 3) errs.code = "Enter the code from your confirmation — 5 letters and numbers.";
    if (digits.length !== 4) errs.last4 = "Enter the last 4 digits of the phone you booked with.";
    setFieldError(errs);
    if (errs.code || errs.last4) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ code: cleanCode, last4: digits }),
      });
      const data = (await res.json().catch(() => null)) as LookupStay | ApiFail | null;
      if (!res.ok || !data || "error" in data) {
        setStay(null);
        setError(data && "error" in data ? data.error : "Something went wrong on our end. Try again or call the lot.");
        return;
      }
      setStay(data);
    } catch {
      setStay(null);
      setError("Couldn’t reach the lot’s server. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} noValidate className="bg-elev border border-line rounded-md p-4 sm:p-5">
        <Field
          id="find-code"
          label="Your code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          error={fieldError.code}
          hint="5 letters and numbers, like K7M2P. It's on your confirmation page."
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          className="[&_input]:tabular-nums [&_input]:tracking-[0.15em] [&_input]:font-bold [&_input]:uppercase"
        />
        <Field
          id="find-last4"
          label="Last 4 digits of your phone"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          error={fieldError.last4}
          autoComplete="off"
          className="[&_input]:tabular-nums [&_input]:tracking-[0.2em] [&_input]:font-bold"
        />
        {error ? (
          <div role="alert" className="mb-4 rounded-sm bg-warn-bg text-warn px-4 py-3 text-[14px] font-semibold">
            {error}
          </div>
        ) : null}
        <Button type="submit" size="lg" busy={busy}>
          <Search size={18} aria-hidden /> Find my booking
        </Button>
      </form>

      <section aria-live="polite" className="mt-5">
        {stay ? <Result stay={stay} phone={phone} notes={notes} /> : null}
      </section>
    </div>
  );
}

function Result({ stay, phone, notes }: { stay: LookupStay; phone: string; notes: string }) {
  const status = statusOf(stay);
  const truckLine = [stay.truck, stay.plate].filter(Boolean).join(" · ") || "No truck details";
  const when =
    stay.kind === "monthly"
      ? `Since ${prettyDay(stay.started)} · next charge ${prettyDay(stay.nextBill)}`
      : `${prettyDay(stay.arrive)} · ${stay.nights} night${stay.nights === 1 ? "" : "s"}`;
  const amount = stay.kind === "monthly" ? `${money(stay.amountCents)}/mo` : money(stay.amountCents);
  const tone = status.tone === "ok" ? "ok" : status.tone === "warn" ? "warn" : status.tone === "accent" ? "accent" : "plain";

  return (
    <div>
      <Card tone={tone}>
        <div className="flex justify-between gap-3 items-start">
          <div className="min-w-0">
            <div className="font-bold text-[15px]">{stay.name}</div>
            <div className="text-[12.5px] text-muted leading-relaxed mt-1">
              {stay.kind === "monthly" ? "Monthly spot" : "Nightly parking"} · phone ending in {stay.phoneLast4}
              <br />
              {truckLine}
              <br />
              {when} · code <span className="font-bold text-fg num">{stay.code}</span>
              {stay.kind === "nightly" && (stay.extras.showers || stay.extras.loads) ? (
                <>
                  <br />
                  {stay.extras.showers ? `${stay.extras.showers} shower${stay.extras.showers === 1 ? "" : "s"}` : ""}
                  {stay.extras.showers && stay.extras.loads ? " · " : ""}
                  {stay.extras.loads ? `${stay.extras.loads} laundry` : ""}
                </>
              ) : null}
            </div>
          </div>
          <div className="font-bold text-[15px] whitespace-nowrap num">{amount}</div>
        </div>
        <div className="mt-2">
          <Tag tone={status.tone}>{status.text}</Tag>
        </div>
      </Card>

      <div className="mt-3">
        <CodesPanel reveal={toReveal(stay)} phone={phone} notes={notes} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <LinkButton href={`/book/confirmed/${stay.code}`} variant="ghost">
          Full receipt
        </LinkButton>
        <LinkButton href="/directions" variant="ghost">
          Directions
        </LinkButton>
      </div>
    </div>
  );
}
