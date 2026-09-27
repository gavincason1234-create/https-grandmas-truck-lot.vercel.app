import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Clock, Fence, KeyRound, Lightbulb, MessageSquareText, Phone, Ruler, ShowerHead, Truck } from "lucide-react";
import { AvailabilityStrip } from "@/components/availability-strip";
import { PageShell } from "@/components/page-shell";
import { ReviewSummary, Stars } from "@/components/review-list";
import { Stalls } from "@/components/stalls";
import { LinkButton } from "@/components/ui/button";
import { Card, Empty, Note, Panel, SectionTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { occupancyOn, occupancyRange } from "@/lib/availability";
import { phoneDigits } from "@/lib/codes";
import { addDays, prettyDay, todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Grandma's Truck Lot — Truck parking tonight in Gainesville, TX" },
  description:
    "See how many spots are open tonight and reserve one in about a minute. Gated, lit, pull-through gravel lot off US-82 in Gainesville, Texas. Nightly or monthly, shower and laundry on site.",
};

const STRIP_DAYS = 7;

export default async function HomePage() {
  const store = getStore();
  const today = todayStr();
  const [s, bookings, members, reviews] = await Promise.all([
    store.getSettings(),
    store.listBookings({ from: today, to: addDays(today, STRIP_DAYS - 1) }),
    store.listMembers({ includeCancelled: true }),
    store.listReviews({ approvedOnly: true }),
  ]);

  const tonight = occupancyOn(s, bookings, members, today);
  const week = occupancyRange(s, bookings, members, today, STRIP_DAYS);
  const full = tonight.open <= 0;
  const tel = phoneDigits(s.phone);
  const sms = phoneDigits(s.smsPhone || s.phone);
  const topReviews = reviews.slice(0, 3);

  const traitWords = [s.security.gated ? "gated" : null, s.security.lit ? "lit" : null, "pull-through"].filter((w): w is string => Boolean(w));
  const traits = traitWords.join(", ");
  const heroLine = `${traits.charAt(0).toUpperCase()}${traits.slice(1)}. Off US-82 in Gainesville, TX. Gate code on your phone in about a minute.`;

  const facts: { icon: typeof Truck; text: string }[] = [
    ...(s.security.gated ? [{ icon: KeyRound, text: "Gated · code entry" }] : []),
    ...(s.security.lit ? [{ icon: Lightbulb, text: "Lit at night" }] : []),
    ...(s.security.fenced ? [{ icon: Fence, text: "Fenced" }] : []),
    ...(s.security.cameras ? [{ icon: Camera, text: "Cameras" }] : []),
    { icon: Truck, text: "Pull-through gravel" },
    { icon: ShowerHead, text: "Showers + laundry" },
    { icon: Ruler, text: `Up to ${s.maxLengthFt}' long` },
    { icon: Clock, text: "Open 24 hours" },
  ];

  return (
    <PageShell reserveHref={full ? "/book" : "/book?plan=nightly"} reserveLabel={full ? "Pick another night" : "Reserve a spot"}>
      {/* Hero */}
      <section className="pt-7 sm:pt-10">
        <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Truck parking · Gainesville, Texas</p>
        <h1 className="mt-2 mb-3 text-[32px] sm:text-[42px] font-extrabold tracking-tight leading-[1.05]">A safe spot to park tonight.</h1>
        <p className="m-0 text-[17px] text-muted leading-relaxed max-w-prose">{heroLine}</p>
      </section>

      {/* Tonight */}
      <Panel className="mt-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`num text-[72px] sm:text-[88px] font-extrabold leading-none tracking-tight ${full ? "text-warn" : ""}`}>{tonight.open}</span>
              <span className="text-[24px] font-extrabold">open</span>
              {full ? <Tag tone="warn">Full tonight</Tag> : null}
            </div>
            <div className="mt-1 text-[15px] text-muted">
              of {s.spots} spots · tonight, {prettyDay(today)}
            </div>
            <div className="mt-5">
              <Stalls spots={s.spots} occupancy={tonight} label={`${tonight.open} of ${s.spots} spots open tonight`} />
            </div>
          </div>

          <div className="grid gap-2.5">
            <div className="flex items-baseline gap-2">
              <span className="num text-[30px] font-extrabold leading-none">{money(s.nightlyCents)}</span>
              <span className="text-[15px] text-muted">a night · no account needed</span>
            </div>
            {full ? (
              <>
                <LinkButton href="/book" size="lg">
                  Pick another night
                </LinkButton>
                <a href={`tel:${tel}`} className="inline-flex items-center justify-center gap-2 min-h-14 rounded-sm border border-line text-[16px] font-semibold no-underline text-fg hover:bg-sunk">
                  <Phone size={18} aria-hidden /> Call — a spot may free up
                </a>
              </>
            ) : (
              <LinkButton href="/book?plan=nightly" size="lg">
                Reserve a spot
              </LinkButton>
            )}
            <LinkButton href="/pricing" variant="ghost" size="lg">
              Monthly · {money(s.monthlyCents)}/mo
            </LinkButton>
          </div>
        </div>
      </Panel>

      {/* Next 7 nights */}
      <section className="mt-8">
        <SectionTitle
          right={
            <Link href="/book" className="text-[14px] font-semibold text-fg whitespace-nowrap">
              Pick a date
            </Link>
          }
        >
          Next {STRIP_DAYS} nights
        </SectionTitle>
        <AvailabilityStrip days={week} spots={s.spots} today={today} />
        <p className="mt-2 mb-0 text-[12.5px] text-muted">Tap a night to reserve it. Counts update as drivers book.</p>
      </section>

      {/* Quick facts */}
      <section className="mt-8">
        <SectionTitle>Quick facts</SectionTitle>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 list-none m-0 p-0">
          {facts.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 min-h-12 bg-elev border border-line rounded-sm px-3 py-2 text-[14px] font-semibold leading-tight">
              <Icon size={20} className="shrink-0 text-accent" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Link href="/lot" className="inline-flex items-center min-h-12 text-[14px] font-semibold text-fg">
            See the lot, the rules, and how the gate works
          </Link>
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-8">
        <SectionTitle
          right={
            reviews.length ? (
              <Link href="/reviews" className="text-[14px] font-semibold text-fg whitespace-nowrap">
                All {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </Link>
            ) : (
              <Link href="/reviews#leave-a-review" className="text-[14px] font-semibold text-fg whitespace-nowrap">
                Leave a review
              </Link>
            )
          }
        >
          Drivers say
        </SectionTitle>
        {topReviews.length ? (
          <>
            <ReviewSummary reviews={reviews} />
            <ul className="list-none m-0 p-0 mt-3 grid gap-2.5 sm:grid-cols-3">
              {topReviews.map((r) => (
                <li key={r.id}>
                  <Card className="h-full mb-0">
                    <Stars stars={r.stars} size="sm" />
                    <p className="mt-2 mb-2 text-[14.5px] leading-relaxed">{r.text}</p>
                    <div className="text-[12.5px] text-muted">
                      <span className="font-semibold text-fg">{r.name}</span> · {prettyDay(r.date)}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty>
            No reviews yet. Parked here?{" "}
            <Link href="/reviews#leave-a-review" className="font-bold text-fg">
              Tell the next driver how it went.
            </Link>
          </Empty>
        )}
      </section>

      {/* Contact */}
      <section className="mt-8">
        <SectionTitle>Questions or gate trouble</SectionTitle>
        <Panel>
          <p className="m-0 text-[15px] text-muted leading-relaxed">Code won&apos;t take? Not sure where to pull in? Call — don&apos;t sit at the gate.</p>
          <a href={`tel:${tel}`} className="mt-3 inline-flex items-center gap-3 min-h-14 num text-[30px] sm:text-[36px] font-extrabold tracking-tight no-underline text-fg">
            <Phone size={28} className="text-accent shrink-0" aria-hidden />
            {s.phone}
          </a>
          <div className="mt-2">
            <a href={`sms:${sms}`} className="inline-flex items-center gap-2 min-h-12 text-[15px] font-semibold text-fg">
              <MessageSquareText size={18} aria-hidden /> Or send a text
            </a>
          </div>
          <p className="mt-3 mb-0 text-[13px] text-muted">
            {s.address} ·{" "}
            <Link href="/directions" className="inline-flex items-center min-h-12 font-semibold text-fg align-middle">
              Directions for trucks
            </Link>
          </p>
        </Panel>
      </section>

      {/* Notes */}
      <section className="mt-8 grid gap-3 md:grid-cols-2">
        {s.notes ? (
          <Note>
            <span className="font-bold text-fg">Good to know · </span>
            {s.notes}
          </Note>
        ) : null}
        {s.policy ? (
          <Note>
            <span className="font-bold text-fg">Cancelling · </span>
            {s.policy}
          </Note>
        ) : null}
      </section>
    </PageShell>
  );
}
