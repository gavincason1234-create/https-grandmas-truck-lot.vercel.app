"use client";

import type { PublicSettings } from "@/lib/defaults";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Minus, Phone, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Note } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { formatPhone, phoneDigits } from "@/lib/codes";
import { addDays, isIsoDay, prettyDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { clampExtras, clampNights, quoteMonthly, quoteNightly } from "@/lib/pricing";
import type { Extras } from "@/lib/types";
import { CheckoutSheet } from "./checkout-sheet";

export type Plan = "nightly" | "monthly";
export type Prefill = { name: string; phone: string; company: string; truck: string; plate: string };

type Props = {
  settings: PublicSettings;
  /** Today at the lot, YYYY-MM-DD. */
  today: string;
  initialPlan: Plan | null;
  /** Arrival day preselected by a link (validated by the server page), or null. */
  initialArrive?: string | null;
  prefill: Prefill;
  /** Payments are simulated — show the pretend checkout sheet instead of sending to Stripe. */
  simulated: boolean;
  signedIn: boolean;
};

type Step = 1 | 2 | 3 | 4;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Plan" },
  { n: 2, label: "Dates" },
  { n: 3, label: "Details" },
  { n: 4, label: "Pay" },
];

const DRAFT_KEY = "lot-booking-draft";
const MAX_AHEAD_DAYS = 180;
const DEBOUNCE_MS = 350;

type Draft = {
  plan: Plan | null;
  arrive: string;
  nights: string;
  name: string;
  phone: string;
  company: string;
  truck: string;
  plate: string;
  extras: Extras;
  step: Step;
};

type DetailsField = "name" | "phone" | "company" | "truck" | "plate";
type FieldErrors = Partial<Record<DetailsField | "arrive" | "nights", string>>;

type ApiFail = { error: string; code?: string; field?: string };
type ApiOk = { ok: true; kind: Plan; code: string; checkoutUrl: string | null };

type Availability = { state: "idle" | "checking" | "open" | "full" | "unknown"; open?: number };

function isDetailsField(f: string): f is DetailsField {
  return f === "name" || f === "phone" || f === "company" || f === "truck" || f === "plate";
}

function readDraft(): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode or full — a lost draft is not worth an error */
  }
}

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const stepperBtn = "inline-flex items-center justify-center w-12 h-12 rounded-sm border border-line bg-elev hover:bg-sunk disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * The reservation flow: Plan → Dates → Details → Pay. One screen per step so it works
 * with a thumb in a cab. Price is quoted live on the phone with the same pricing module the
 * server uses; the server still has the final say when the booking is created.
 */
export function BookingForm({ settings, today, initialPlan, initialArrive = null, prefill, simulated, signedIn }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialPlan ? 2 : 1);
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  const [arrive, setArrive] = useState(initialArrive ?? today);
  const [nightsText, setNightsText] = useState("1");
  const [name, setName] = useState(prefill.name);
  const [phone, setPhone] = useState(prefill.phone);
  const [company, setCompany] = useState(prefill.company);
  const [truck, setTruck] = useState(prefill.truck);
  const [plate, setPlate] = useState(prefill.plate);
  const [extras, setExtras] = useState<Extras>({ showers: 0, loads: 0 });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<ApiFail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const restored = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const prevStep = useRef<Step>(step);

  const nights = clampNights(nightsText);
  const maxDay = addDays(today, MAX_AHEAD_DAYS);
  const extrasAllowed = plan === "nightly" && settings.nightlyExtras;

  /* ---- restore a draft after a phone reload ---- */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const d = readDraft();
    if (!d) return;
    if (initialPlan) {
      setPlan(initialPlan);
      setStep(2);
    } else {
      if (d.plan === "nightly" || d.plan === "monthly") setPlan(d.plan);
      if (d.step === 1 || d.step === 2 || d.step === 3 || d.step === 4) setStep(d.plan ? d.step : 1);
    }
    if (!initialArrive && typeof d.arrive === "string" && isIsoDay(d.arrive) && d.arrive >= today) setArrive(d.arrive);
    if (typeof d.nights === "string" || typeof d.nights === "number") setNightsText(String(clampNights(d.nights)));
    if (typeof d.name === "string" && d.name) setName(d.name);
    if (typeof d.phone === "string" && d.phone) setPhone(d.phone);
    if (typeof d.company === "string" && d.company) setCompany(d.company);
    if (typeof d.truck === "string" && d.truck) setTruck(d.truck);
    if (typeof d.plate === "string" && d.plate) setPlate(d.plate);
    if (d.extras && typeof d.extras === "object") setExtras(clampExtras(d.extras, settings.nightlyExtras));
  }, [initialPlan, initialArrive, today, settings.nightlyExtras]);

  /* ---- keep the draft current ---- */
  useEffect(() => {
    if (!restored.current) return;
    writeDraft({ plan, arrive, nights: nightsText, name, phone, company, truck, plate, extras, step });
  }, [plan, arrive, nightsText, name, phone, company, truck, plate, extras, step]);

  /* ---- move focus to the step heading when the step changes ---- */
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    const h = headingRef.current;
    if (!h) return;
    h.focus({ preventScroll: true });
    const top = h.getBoundingClientRect().top + window.scrollY - 16;
    if (top < window.scrollY) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [step]);

  /* ---- live availability while picking dates ---- */
  useEffect(() => {
    if (step !== 2 || !plan || !isIsoDay(arrive) || arrive < today) {
      setAvailability((a) => (a.state === "idle" ? a : { state: "idle" }));
      return;
    }
    const days = plan === "monthly" ? 31 : nights;
    const ctrl = new AbortController();
    setAvailability({ state: "checking" });
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/availability?from=${encodeURIComponent(arrive)}&days=${days}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`availability ${res.status}`);
        const data = (await res.json()) as { spots?: number; days?: { day: string; open: number }[] };
        const opens = (data.days ?? []).map((d) => Number(d.open)).filter((n) => Number.isFinite(n));
        if (!opens.length) {
          setAvailability({ state: "unknown" });
          return;
        }
        const worst = Math.min(...opens);
        setAvailability(worst <= 0 ? { state: "full", open: 0 } : { state: "open", open: worst });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setAvailability({ state: "unknown" });
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [step, plan, arrive, nights, today]);

  const quote = useMemo(() => (plan === "monthly" ? quoteMonthly(settings) : quoteNightly(settings, nights, extras)), [plan, settings, nights, extras]);

  /* ---- step navigation ---- */
  function choosePlan(p: Plan) {
    setPlan(p);
    if (p === "monthly") setExtras({ showers: 0, loads: 0 });
    setErrors({});
    setApiError(null);
  }

  function validateDates(): boolean {
    const next: FieldErrors = {};
    if (!isIsoDay(arrive)) next.arrive = "Pick a date.";
    else if (arrive < today) next.arrive = "That date has already passed. Pick today or later.";
    else if (arrive > maxDay) next.arrive = "We take reservations up to 6 months out.";
    if (plan === "nightly" && (!Number.isFinite(Number(nightsText)) || Number(nightsText) < 1 || Number(nightsText) > 30)) next.nights = "1 to 30 nights. Staying longer? A monthly spot is cheaper.";
    setErrors(next);
    return !next.arrive && !next.nights;
  }

  function validateDetails(): boolean {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = "Add your name so she knows who to expect.";
    if (phoneDigits(phone).length < 7) next.phone = "Add a phone number in case a gate code fails.";
    setErrors(next);
    return !next.name && !next.phone;
  }

  function next() {
    setApiError(null);
    if (step === 1) {
      if (plan) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateDates()) setStep(3);
      return;
    }
    if (step === 3) {
      if (validateDetails()) setStep(4);
    }
  }

  function back() {
    setApiError(null);
    setErrors({});
    if (step > 1) setStep((step - 1) as Step);
  }

  function payload() {
    return {
      plan,
      arrive,
      nights: plan === "monthly" ? 1 : nights,
      name: name.trim(),
      phone: phone.trim(),
      company: company.trim(),
      truck: truck.trim(),
      plate: plate.trim(),
      extras: extrasAllowed ? extras : { showers: 0, loads: 0 },
      website,
    };
  }

  function showFailure(fail: ApiFail) {
    setApiError(fail);
    if (fail.field && isDetailsField(fail.field)) {
      setErrors({ [fail.field]: fail.error });
      setStep(3);
    } else if (fail.field === "arrive" || fail.field === "nights" || fail.code === "past_date" || fail.code === "too_far") {
      setErrors(fail.field === "arrive" || fail.field === "nights" ? { [fail.field]: fail.error } : { arrive: fail.error });
      setStep(2);
    }
  }

  function finish(code: string) {
    clearDraft();
    router.push(`/book/confirmed/${encodeURIComponent(code)}`);
  }

  /** Create the reservation. Resolves with the API result, or null after showing the error. */
  async function reserve(): Promise<ApiOk | null> {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = (await res.json().catch(() => null)) as ApiOk | ApiFail | null;
      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        showFailure(data && "error" in data ? data : { error: "Something went wrong on our end. Try again or call the lot.", code: "internal" });
        return null;
      }
      return data;
    } catch {
      showFailure({ error: "Couldn’t reach the lot’s server. Check your signal and try again.", code: "network" });
      return null;
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== 4) {
      next(); // Enter key on an earlier step means "next", never "pay".
      return;
    }
    if (!plan || submitting) return;
    setApiError(null);
    if (!validateDetails()) {
      setStep(3);
      return;
    }
    if (simulated) {
      // The pretend checkout sheet drives the API call from its own Pay button, so Cancel really cancels.
      setSheetOpen(true);
      return;
    }
    setSubmitting(true);
    const result = await reserve();
    if (!result) {
      setSubmitting(false);
      return;
    }
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return; // stay busy while the browser leaves
    }
    finish(result.code);
  }

  const pendingCode = useRef<string | null>(null);
  async function simulatedPay(): Promise<boolean> {
    const result = await reserve();
    if (!result) {
      setSheetOpen(false);
      return false;
    }
    if (result.checkoutUrl) {
      // Server turned out to be in real-payments mode after all: follow it.
      window.location.assign(result.checkoutUrl);
      return false;
    }
    pendingCode.current = result.code;
    return true;
  }

  const tel = phoneDigits(settings.phone);
  const total = quote.totalCents;
  const payLabel = plan === "monthly" ? `Start monthly · ${money(total)}/mo` : `Pay ${money(total)}`;
  const lastNight = addDays(arrive, Math.max(0, nights - 1));
  const stayLine = plan === "monthly" ? `Monthly spot starting ${prettyDay(arrive)}` : nights === 1 ? `1 night · ${prettyDay(arrive)}` : `${nights} nights · ${prettyDay(arrive)} to ${prettyDay(lastNight)}`;

  return (
    <form onSubmit={submit} noValidate className="relative">
      <StepIndicator step={step} />

      {/* Honeypot — real drivers never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 w-px h-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {/* ---------- Step 1: plan ---------- */}
      {step === 1 ? (
        <section aria-labelledby="step-heading">
          <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-[22px] font-extrabold tracking-tight m-0 mb-3 outline-none">
            How long are you staying?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlanCard
              selected={plan === "nightly"}
              onClick={() => choosePlan("nightly")}
              title="Tonight or a few nights"
              price={money(settings.nightlyCents)}
              per="/night"
              blurb={`Pick your nights. Gate code on your phone as soon as you pay.${settings.nightlyExtras ? " Shower and laundry are add-ons." : ""}`}
            />
            <PlanCard
              selected={plan === "monthly"}
              onClick={() => choosePlan("monthly")}
              title="Monthly spot"
              price={money(settings.monthlyCents)}
              per="/mo"
              blurb="Your own stall every night. Shower and laundry included. Cancel any time."
            />
          </div>
          <div className="mt-5">
            <Button type="button" size="lg" disabled={!plan} onClick={next}>
              Next: pick dates
            </Button>
          </div>
        </section>
      ) : null}

      {/* ---------- Step 2: dates ---------- */}
      {step === 2 && plan ? (
        <section aria-labelledby="step-heading">
          <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-[22px] font-extrabold tracking-tight m-0 mb-3 outline-none">
            {plan === "monthly" ? "When do you want to start?" : "When are you pulling in?"}
          </h2>
          <Field
            id="arrive"
            label={plan === "monthly" ? "Start date" : "Arrive"}
            type="date"
            min={today}
            max={maxDay}
            value={arrive}
            onChange={(e) => setArrive(e.target.value)}
            error={errors.arrive}
            hint={plan === "monthly" ? "Your first night. You're billed monthly from this date." : "Any time that day — the gate works 24 hours."}
            required
          />
          {plan === "nightly" ? (
            <div className="mb-4">
              <label htmlFor="nights" className="block text-[13.5px] font-semibold mb-1.5">
                Nights
              </label>
              <div className="grid grid-cols-[48px_1fr_48px] gap-2">
                <button type="button" className={stepperBtn} aria-label="One less night" onClick={() => setNightsText(String(clampNights(nights - 1)))} disabled={nights <= 1}>
                  <Minus size={20} aria-hidden />
                </button>
                <input
                  id="nights"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  step={1}
                  value={nightsText}
                  onChange={(e) => setNightsText(e.target.value)}
                  onBlur={() => setNightsText(String(nights))}
                  aria-invalid={errors.nights ? true : undefined}
                  aria-describedby={errors.nights ? "nights-error" : "nights-hint"}
                  className="text-center num font-bold"
                />
                <button type="button" className={stepperBtn} aria-label="One more night" onClick={() => setNightsText(String(clampNights(nights + 1)))} disabled={nights >= 30}>
                  <Plus size={20} aria-hidden />
                </button>
              </div>
              {errors.nights ? (
                <p id="nights-error" role="alert" className="mt-1.5 text-[13px] font-semibold text-warn">
                  {errors.nights}
                </p>
              ) : (
                <p id="nights-hint" className="mt-1.5 text-[12.5px] text-muted">
                  {isIsoDay(arrive) ? (nights === 1 ? `Just ${prettyDay(arrive)} · pull out ${prettyDay(addDays(arrive, 1))}` : `${prettyDay(arrive)} through ${prettyDay(lastNight)} · pull out ${prettyDay(addDays(arrive, nights))}`) : "Up to 30 nights."}
                </p>
              )}
            </div>
          ) : null}

          <AvailabilityLine availability={availability} phone={settings.phone} tel={tel} />

          <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={back} className={buttonClass("ghost", "md")}>
              <ChevronLeft size={18} aria-hidden /> Back
            </button>
            <Button type="button" size="md" onClick={next}>
              Next: your details
            </Button>
          </div>
        </section>
      ) : null}

      {/* ---------- Step 3: details ---------- */}
      {step === 3 && plan ? (
        <section aria-labelledby="step-heading">
          <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-[22px] font-extrabold tracking-tight m-0 mb-1 outline-none">
            Who&apos;s coming?
          </h2>
          <p className="text-[13.5px] text-muted mt-0 mb-4 leading-relaxed">So she knows which truck is yours. Your phone is only used if a gate code fails{signedIn ? "" : " — and to look this booking up later"}.</p>

          <Field id="name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" required />
          <Field id="phone" label="Phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} autoComplete="tel" placeholder="(940) 555-0100" required />
          <Field id="company" label="Company" optional value={company} onChange={(e) => setCompany(e.target.value)} error={errors.company} autoComplete="organization" placeholder="Owner-operator" />
          <Field id="truck" label="Truck" value={truck} onChange={(e) => setTruck(e.target.value)} error={errors.truck} hint="Like: 53' dry van, reefer, flatbed, cattle pot" autoComplete="off" />
          <Field id="plate" label="Plate" value={plate} onChange={(e) => setPlate(e.target.value)} error={errors.plate} autoCapitalize="characters" autoComplete="off" placeholder="TX 8421RM" className="[&_input]:uppercase" />

          {extrasAllowed ? (
            <fieldset className="border border-line rounded-md p-4 mb-4 min-w-0">
              <legend className="px-1 text-[13.5px] font-semibold">Add-ons — optional</legend>
              <Stepper label="Showers" price={`${money(settings.showerCents)} each`} value={extras.showers} noun="shower" onChange={(v) => setExtras((x) => ({ ...x, showers: v }))} />
              <Stepper label="Laundry loads" price={`${money(settings.laundryCents)} each`} value={extras.loads} noun="laundry load" onChange={(v) => setExtras((x) => ({ ...x, loads: v }))} />
              <p className="m-0 mt-2 text-[12.5px] text-muted">Adding one unlocks the shed code with your gate codes.</p>
            </fieldset>
          ) : null}

          <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={back} className={buttonClass("ghost", "md")}>
              <ChevronLeft size={18} aria-hidden /> Back
            </button>
            <Button type="button" size="md" onClick={next}>
              Next: review &amp; pay
            </Button>
          </div>
        </section>
      ) : null}

      {/* ---------- Step 4: pay ---------- */}
      {step === 4 && plan ? (
        <section aria-labelledby="step-heading">
          <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-[22px] font-extrabold tracking-tight m-0 mb-3 outline-none">
            Look right?
          </h2>

          <div className="bg-elev border border-line rounded-md p-4">
            <ReviewRow label={plan === "monthly" ? "Plan" : "Stay"} value={stayLine} onEdit={() => setStep(2)} />
            <ReviewRow label="Who" value={`${name.trim()} · ${formatPhone(phone)}`} onEdit={() => setStep(3)} />
            <ReviewRow label="Truck" value={[truck.trim(), plate.trim().toUpperCase(), company.trim()].filter(Boolean).join(" · ") || "No truck details"} onEdit={() => setStep(3)} />

            <div className="border-t border-line mt-3 pt-3">
              <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-1.5 text-[14px]">
                {quote.lines.map((l) => (
                  <PriceLine key={l.label} label={l.label} amount={money(l.amountCents)} />
                ))}
                <dt className="font-extrabold text-[16px] mt-1">{plan === "monthly" ? "Total today" : "Total"}</dt>
                <dd className="m-0 font-extrabold text-[16px] num mt-1 text-right">
                  {money(total)}
                  {plan === "monthly" ? <span className="text-[12.5px] text-muted font-semibold"> then {money(total)}/mo</span> : null}
                </dd>
              </dl>
            </div>
          </div>

          <Note className="mt-3">
            <b className="text-fg">Cancellations.</b> {settings.policy}
          </Note>

          {apiError ? (
            <div role="alert" className="mt-3 rounded-sm bg-warn-bg text-warn px-4 py-3 text-[14px] font-semibold leading-relaxed">
              {apiError.error}
              {apiError.code === "full" ? (
                <>
                  {" "}
                  <a href={`tel:${tel}`} className="inline-flex items-center gap-1 underline underline-offset-4 min-h-12 align-middle">
                    <Phone size={16} aria-hidden /> Call {settings.phone}
                  </a>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={back} className={buttonClass("ghost", "md", "min-h-14")} disabled={submitting}>
              <ChevronLeft size={18} aria-hidden /> Back
            </button>
            <Button type="submit" size="lg" busy={submitting}>
              {payLabel}
            </Button>
          </div>
          <p className="text-[12.5px] text-muted mt-3 mb-0 leading-relaxed text-center">
            {simulated ? "Test mode — a pretend card, no real charge." : "You'll pay on a secure Stripe page, then land right back here with your gate code."}
            {!signedIn ? (
              <>
                {" "}
                No account needed — you&apos;ll get a code you can look up any time.
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      <CheckoutSheet
        open={sheetOpen}
        merchant={settings.lotName}
        amountCents={total}
        summary={stayLine}
        recurring={plan === "monthly"}
        onPay={simulatedPay}
        onPaid={() => {
          const code = pendingCode.current;
          if (code) finish(code);
          else setSheetOpen(false);
        }}
        onCancel={() => setSheetOpen(false)}
      />
    </form>
  );
}

/* ---------- small pieces ---------- */

function StepIndicator({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-1 text-[12.5px] font-bold mb-5 list-none p-0 m-0 overflow-x-auto" aria-label="Steps">
      {STEPS.map((s, i) => {
        const state = s.n < step ? "done" : s.n === step ? "current" : "todo";
        return (
          <li key={s.n} className="flex items-center gap-1.5 whitespace-nowrap" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] num ${state === "done" ? "bg-ok text-dust" : state === "current" ? "bg-accent text-on-accent" : "bg-sunk text-muted"}`}
              aria-hidden
            >
              {state === "done" ? <Check size={14} /> : s.n}
            </span>
            <span className={state === "current" ? "text-fg" : "text-muted"}>
              <span className="sr-only">{state === "done" ? "Done: " : state === "current" ? "Current step: " : "Step: "}</span>
              {s.label}
            </span>
            {i < STEPS.length - 1 ? <span className="w-4 sm:w-6 h-px bg-line mx-1" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function PlanCard({ selected, onClick, title, price, per, blurb }: { selected: boolean; onClick: () => void; title: string; price: string; per: string; blurb: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`text-left rounded-md border-2 p-4 min-h-12 bg-elev transition-colors ${selected ? "border-accent" : "border-line hover:border-faint"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] font-extrabold tracking-tight">{title}</span>
        <span className="num text-[22px] font-extrabold whitespace-nowrap">
          {price}
          <span className="text-[13px] text-muted font-semibold">{per}</span>
        </span>
      </div>
      <p className="m-0 mt-1.5 text-[13.5px] text-muted leading-relaxed">{blurb}</p>
      <span className={`inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-bold ${selected ? "text-ok" : "text-muted"}`}>
        {selected ? (
          <>
            <Check size={14} aria-hidden /> Selected
          </>
        ) : (
          "Tap to choose"
        )}
      </span>
    </button>
  );
}

function AvailabilityLine({ availability, phone, tel }: { availability: Availability; phone: string; tel: string }) {
  if (availability.state === "idle") return null;
  if (availability.state === "full") {
    return (
      <div role="status" className="rounded-sm bg-warn-bg text-warn px-4 py-3 text-[14px] font-semibold leading-relaxed">
        Full for those nights — try another date or{" "}
        <a href={`tel:${tel}`} className="inline-flex items-center gap-1 underline underline-offset-4">
          <Phone size={15} aria-hidden /> call {phone}
        </a>
        . Sometimes a spot frees up.
      </div>
    );
  }
  return (
    <p role="status" className={`m-0 text-[13.5px] font-semibold ${availability.state === "open" ? "text-ok" : "text-muted"}`}>
      {availability.state === "checking" ? "Checking the lot…" : availability.state === "open" ? `${availability.open} open on your worst night` : "Couldn’t check the lot just now — you can still continue."}
    </p>
  );
}

function Stepper({ label, price, value, noun, onChange }: { label: string; price: string; value: number; noun: string; onChange: (v: number) => void }) {
  const id = `stepper-${noun.replace(/\s+/g, "-")}`;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-b-0">
      <div className="min-w-0">
        <div id={id} className="font-semibold text-[15px]">
          {label}
        </div>
        <div className="text-[12.5px] text-muted">{price}</div>
      </div>
      <div className="flex items-center gap-2" role="group" aria-labelledby={id}>
        <button type="button" className={stepperBtn} aria-label={`Fewer ${noun}s`} onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}>
          <Minus size={20} aria-hidden />
        </button>
        <output aria-live="polite" className="num font-extrabold text-[18px] w-8 text-center">
          {value}
        </output>
        <button type="button" className={stepperBtn} aria-label={`More ${noun}s`} onClick={() => onChange(Math.min(20, value + 1))} disabled={value >= 20}>
          <Plus size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-b-0">
      <div className="min-w-0">
        <div className="text-[12px] font-bold text-muted">{label}</div>
        <div className="text-[15px] font-semibold break-words">{value}</div>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 min-h-12 px-3 text-[13.5px] font-bold underline underline-offset-4 rounded-sm hover:bg-sunk">
        Change
      </button>
    </div>
  );
}

function PriceLine({ label, amount }: { label: string; amount: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 num text-right">{amount}</dd>
    </>
  );
}
