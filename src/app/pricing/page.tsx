import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Check, CreditCard } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LinkButton } from "@/components/ui/button";
import { Note, Panel, SectionTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { phoneDigits } from "@/lib/codes";
import { money } from "@/lib/money";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Nightly and monthly truck parking prices at Grandma's Truck Lot in Gainesville, TX. What's included, add-ons, and how to pay.",
};

function Included({ items }: { items: string[] }) {
  return (
    <ul className="list-none m-0 p-0 grid gap-2 text-[14.5px] leading-snug">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5">
          <Check size={18} className="shrink-0 mt-0.5 text-ok" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PricingPage() {
  const s = await getStore().getSettings();
  const tel = phoneDigits(s.phone);
  const breakEven = s.nightlyCents > 0 ? Math.ceil(s.monthlyCents / s.nightlyCents) : null;

  const nightlyIncluded = [
    "A stall for the night — pull in any time, pull out by the next evening",
    "Gate codes on your phone as soon as you're paid",
    "Lit, gated lot. Porta-potties by the shed",
    s.nightlyExtras ? `Shower ${money(s.showerCents)} each · laundry ${money(s.laundryCents)} a load, add them when you book` : "Shower and laundry are for monthly members",
  ];
  const monthlyIncluded = [
    "Your own stall, every night, held for you",
    "Shower and laundry included — no per-use charge",
    "Gate and shed codes that stay on the whole month",
    "Come and go as you please. Cancel any time",
  ];

  const rows: { label: string; nightly: string; monthly: string }[] = [
    { label: "Price", nightly: `${money(s.nightlyCents)} a night`, monthly: `${money(s.monthlyCents)} a month` },
    { label: "Your spot", nightly: "Any open stall, the nights you book", monthly: "A stall every night, held for you" },
    { label: "Gate codes", nightly: "On your phone once paid", monthly: "On the whole month" },
    { label: "Shower", nightly: s.nightlyExtras ? `${money(s.showerCents)} each` : "Not offered", monthly: "Included" },
    { label: "Laundry", nightly: s.nightlyExtras ? `${money(s.laundryCents)} a load` : "Not offered", monthly: "Included" },
    { label: "Book ahead", nightly: "Up to 6 months out", monthly: "Start any day" },
    { label: "Cancelling", nightly: "Full refund before 6 PM on arrival day", monthly: "Any time; the current month isn't refunded" },
    { label: "Good for", nightly: "Passing through, a night or a few", monthly: "Local haulers who want a home base" },
  ];

  return (
    <PageShell>
      <section className="pt-7 sm:pt-10">
        <h1 className="m-0 text-[30px] sm:text-[38px] font-extrabold tracking-tight leading-[1.05]">Pricing</h1>
        <p className="mt-2 mb-0 text-[16.5px] text-muted leading-relaxed max-w-prose">Two ways to park. No fees on top, no account needed for a night.</p>
      </section>

      {/* Plans */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel className="flex flex-col">
          <div className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Nightly</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="num text-[48px] font-extrabold leading-none tracking-tight">{money(s.nightlyCents)}</span>
            <span className="text-[15px] text-muted">per night</span>
          </div>
          <p className="mt-2 mb-4 text-[14.5px] text-muted leading-relaxed">One night or a stretch, up to 30 nights in a row.</p>
          <Included items={nightlyIncluded} />
          {s.nightlyExtras ? (
            <div className="mt-4 rounded-sm bg-sunk px-3.5 py-3 text-[13.5px] leading-relaxed">
              <div className="font-bold text-fg">Add-ons</div>
              <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted">
                <span>Shower</span>
                <span className="num font-bold text-fg">{money(s.showerCents)} each</span>
                <span>Laundry</span>
                <span className="num font-bold text-fg">{money(s.laundryCents)} a load</span>
              </div>
            </div>
          ) : null}
          <div className="mt-auto pt-5">
            <LinkButton href="/book?plan=nightly" size="lg">
              Reserve a night
            </LinkButton>
          </div>
        </Panel>

        <Panel className="flex flex-col border-accent border-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Monthly</div>
            {breakEven ? <Tag tone="accent">Pays off after {breakEven} nights</Tag> : null}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="num text-[48px] font-extrabold leading-none tracking-tight">{money(s.monthlyCents)}</span>
            <span className="text-[15px] text-muted">per month</span>
          </div>
          <p className="mt-2 mb-4 text-[14.5px] text-muted leading-relaxed">A home base for your rig. Billed monthly from the day you start.</p>
          <Included items={monthlyIncluded} />
          <div className="mt-auto pt-5">
            <LinkButton href="/book?plan=monthly" size="lg" variant="dark">
              Start monthly
            </LinkButton>
          </div>
        </Panel>
      </section>

      {/* Compare */}
      <section className="mt-8">
        <SectionTitle>Side by side</SectionTitle>
        <div className="overflow-x-auto rounded-md border border-line bg-elev">
          <table className="w-full min-w-[520px] border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-[12.5px] uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 font-bold border-b border-line w-[28%]">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="px-4 py-3 font-bold border-b border-line">
                  Nightly
                </th>
                <th scope="col" className="px-4 py-3 font-bold border-b border-line">
                  Monthly
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line last:border-b-0 align-top">
                  <th scope="row" className="px-4 py-3 text-left font-bold text-fg">
                    {r.label}
                  </th>
                  <td className="px-4 py-3 text-muted">{r.nightly}</td>
                  <td className="px-4 py-3 text-muted">{r.monthly}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Policy + payment */}
      <section className="mt-8 grid gap-3 md:grid-cols-2">
        <Note>
          <span className="font-bold text-fg">Cancelling · </span>
          {s.policy}
        </Note>
        <Note>
          <div className="flex items-center gap-2 font-bold text-fg">
            <CreditCard size={16} aria-hidden />
            <Banknote size={16} aria-hidden />
            Cash or card
          </div>
          <p className="m-0 mt-1">Card online. Paying cash on the lot? Reserve first so your spot is held, then settle with the owner — she&apos;ll mark you paid.</p>
        </Note>
      </section>

      <section className="mt-8">
        <Panel className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-[18px] font-extrabold">Not sure which one?</div>
            <p className="m-0 mt-1 text-[14.5px] text-muted">
              Start nightly. If you keep coming back, switch to monthly — or just call{" "}
              <a href={`tel:${tel}`} className="font-semibold text-fg no-underline">
                {s.phone}
              </a>{" "}
              and ask.{" "}
              <Link href="/lot" className="font-semibold text-fg">
                See the lot
              </Link>
              .
            </p>
          </div>
          <LinkButton href="/book" size="lg" className="sm:w-auto sm:min-w-56">
            Reserve a spot
          </LinkButton>
        </Panel>
      </section>
    </PageShell>
  );
}
