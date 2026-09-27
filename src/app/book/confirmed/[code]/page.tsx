import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarPlus, MapPin, Star } from "lucide-react";
import { CodesPanel } from "@/components/codes-panel";
import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/print-button";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Note } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeCode, phoneLast4 } from "@/lib/codes";
import { addDays, prettyDay, prettyDayLong } from "@/lib/dates";
import { money } from "@/lib/money";
import { paymentsMode, retrieveCheckoutSession } from "@/lib/payments";
import { codesForBooking, codesForMember } from "@/lib/services/access";
import { isSimulated, markPaidByCode } from "@/lib/services/reservations";
import { rateLimit } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";
import type { Booking, Member } from "@/lib/types";

type Params = Promise<{ code: string }>;
type Search = Promise<{ session_id?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  return { title: `Reservation ${normalizeCode(code)}`, robots: { index: false, follow: false } };
}

type Stay = Booking | Member;

async function loadStay(code: string): Promise<Stay | null> {
  const store = getStore();
  const booking = await store.getBookingByCode(code);
  if (booking) return booking;
  return store.getMemberByCode(code);
}

function isPending(stay: Stay): boolean {
  return stay.status === "pending_payment";
}

function statusOf(stay: Stay): { text: string; tone: "ok" | "warn" | "plain" | "accent" } {
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

/**
 * The receipt. Reachable by anyone holding the 5-character code — that's by design for a
 * 15-spot lot — so it shows only the last 4 digits of the phone and lets the access rules
 * (codesForBooking / codesForMember) decide whether gate codes appear.
 */
export default async function ConfirmedPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ code: raw }, sp] = await Promise.all([params, searchParams]);
  const code = normalizeCode(raw);
  if (!code) notFound();

  // Codes are unguessable (32^5 of them), but nobody gets to try thousands from one address.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`${ip}:confirmed`, { limit: 40, windowMs: 600_000 }).ok) {
    return (
      <PageShell callBar={false} width="max-w-2xl">
        <div className="pt-8">
          <h1 className="text-[24px] font-extrabold tracking-tight m-0">Slow down a moment</h1>
          <p className="text-muted mt-2">Too many pages opened from this connection. Wait a minute and try again, or call the lot.</p>
        </div>
      </PageShell>
    );
  }

  let stay = await loadStay(code);
  if (!stay) notFound();

  // Landed here from Stripe before the webhook arrived? Ask Stripe directly, once.
  if (sp.session_id && isPending(stay) && paymentsMode() === "stripe") {
    try {
      const session = await retrieveCheckoutSession(sp.session_id);
      const sessionCode = normalizeCode(session.metadata?.code ?? session.client_reference_id ?? "");
      if (sessionCode === code && (session.payment_status === "paid" || session.status === "complete")) {
        await markPaidByCode(code, stay.kind, session.id);
        stay = (await loadStay(code)) ?? stay;
      }
    } catch (err) {
      console.error("checkout session check failed", err);
    }
  }

  const store = getStore();
  const [settings, priv, user] = await Promise.all([store.getSettings(), store.getPrivateSettings(), getSessionUser()]);
  const reveal = stay.kind === "nightly" ? codesForBooking(stay, priv) : codesForMember(stay, priv);
  const pending = isPending(stay);
  const waitingOnStripe = pending && !isSimulated();
  const status = statusOf(stay);
  const last4 = phoneLast4(stay.phone);
  const firstName = stay.name.trim().split(/\s+/)[0] ?? "";
  const truckLine = [stay.truck, stay.plate].filter(Boolean).join(" · ") || "No truck details";
  const refreshHref = `/book/confirmed/${code}${sp.session_id ? `?session_id=${encodeURIComponent(sp.session_id)}` : ""}`;

  let heading: string;
  let when: string;
  let amountNote: string;
  if (stay.kind === "nightly") {
    const lastNight = addDays(stay.arrive, Math.max(0, stay.nights - 1));
    when = stay.nights === 1 ? `${prettyDayLong(stay.arrive)} · 1 night · pull out ${prettyDay(addDays(stay.arrive, 1))}` : `${prettyDayLong(stay.arrive)} to ${prettyDay(lastNight)} · ${stay.nights} nights · pull out ${prettyDay(addDays(stay.arrive, stay.nights))}`;
    amountNote = stay.paid ? "paid" : pending ? "due — waiting on your card" : "due at the lot";
    heading = stay.status === "cancelled" ? "This reservation was cancelled" : pending ? "Almost done" : `You’re booked${firstName ? `, ${firstName}` : ""}`;
  } else {
    when = `Starts ${prettyDayLong(stay.started)} · next charge ${prettyDay(stay.nextBill)}${stay.ended ? ` · ends ${prettyDay(stay.ended)}` : ""}`;
    amountNote = pending ? "/mo — waiting on your card" : "charged today, then monthly";
    heading = stay.status === "cancelled" ? "This membership was cancelled" : pending ? "Almost done" : `Welcome aboard${firstName ? `, ${firstName}` : ""}`;
  }

  return (
    <PageShell reserveHref="/directions" reserveLabel="Directions" width="max-w-2xl">
      {waitingOnStripe ? <meta httpEquiv="refresh" content="8" /> : null}

      <div className="pt-6 sm:pt-8">
        {/* ---- receipt header (always dark, like a printed ticket) ---- */}
        <section className="bg-asphalt text-dust rounded-md p-5 sm:p-6 print-plain" aria-labelledby="receipt-heading">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-bold uppercase tracking-wide text-[#A9AFB6]">{stay.kind === "nightly" ? "Nightly parking" : "Monthly spot"}</div>
              <h1 id="receipt-heading" className="m-0 mt-1 text-[24px] sm:text-[28px] font-extrabold tracking-tight leading-tight">
                {heading}
              </h1>
            </div>
            <Tag tone={status.tone} className="shrink-0 mt-1">
              {status.text}
            </Tag>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="bg-[#2E3237] rounded-sm px-6 py-4 text-center">
              <small className="block text-[11px] text-[#A9AFB6] mb-1">Your code</small>
              <b className="num block text-[40px] tracking-[0.18em] text-amber-lift leading-none">{stay.code}</b>
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px] leading-snug">
              <dt className="text-[#A9AFB6]">Who</dt>
              <dd className="m-0 font-semibold">
                {stay.name}
                <span className="text-[#A9AFB6] font-normal"> · phone ending in {last4}</span>
              </dd>
              <dt className="text-[#A9AFB6]">When</dt>
              <dd className="m-0 font-semibold">{when}</dd>
              <dt className="text-[#A9AFB6]">Truck</dt>
              <dd className="m-0 font-semibold">{truckLine}</dd>
              <dt className="text-[#A9AFB6]">Amount</dt>
              <dd className="m-0 font-semibold num">
                {money(stay.amountCents)}
                <span className="text-[#A9AFB6] font-normal"> {amountNote}</span>
              </dd>
            </dl>
          </div>
        </section>

        {waitingOnStripe ? (
          <Note className="mt-3" role="status">
            Waiting for the card payment to finish. Your gate codes appear the moment it goes through — this page checks again every few seconds.{" "}
            <Link href={refreshHref} className="font-bold text-fg">
              Refresh now
            </Link>
          </Note>
        ) : null}

        {/* ---- gate codes (or why not yet) ---- */}
        <div className="mt-3">
          <CodesPanel reveal={reveal} phone={settings.phone} notes={settings.notes} />
        </div>

        {/* ---- actions ---- */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3 no-print">
          <LinkButton href="/directions" variant="ghost" className="w-full">
            <MapPin size={18} aria-hidden /> Directions
          </LinkButton>
          <a href={`/api/ics/${code}`} download={`truck-lot-${code}.ics`} className={buttonClass("ghost", "md", "w-full")}>
            <CalendarPlus size={18} aria-hidden /> Add to calendar
          </a>
          <PrintButton className="w-full" />
        </div>

        <Note className="mt-4">
          <b className="text-fg">Save this page.</b> Lost it? Use{" "}
          <Link href={`/find?code=${code}`} className="font-bold text-fg inline-flex items-center min-h-12 align-middle">
            Find my booking
          </Link>{" "}
          with your code and the last 4 digits of your phone.
          {user ? (
            <>
              {" "}
              It&apos;s also under{" "}
              <Link href="/account" className="font-bold text-fg">
                My account
              </Link>
              .
            </>
          ) : null}
        </Note>

        {stay.status !== "cancelled" ? (
          <p className="mt-5 text-[14px] text-muted leading-relaxed no-print">
            How was it?{" "}
            <Link href={`/reviews?code=${code}`} className="inline-flex items-center gap-1.5 font-bold text-fg min-h-12 align-middle">
              <Star size={16} aria-hidden /> Leave a review
            </Link>
          </p>
        ) : (
          <p className="mt-5 text-[14px] text-muted leading-relaxed no-print">
            Need a spot after all?{" "}
            <Link href="/book" className="font-bold text-fg">
              Reserve again
            </Link>
            .
          </p>
        )}
      </div>
    </PageShell>
  );
}
