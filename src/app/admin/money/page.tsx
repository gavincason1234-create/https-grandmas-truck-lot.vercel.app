import type { Metadata } from "next";
import { CallButton } from "@/components/admin/call-button";
import { MoneyRow } from "@/components/admin/money-row";
import { statusLabel } from "@/components/stay-card";
import { Empty, Note, Panel, SectionTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { addDays, addMonths, prettyDay, todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { estimateCardFees } from "@/lib/pricing";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Money · Owner" };
export const dynamic = "force-dynamic";

function sum<T>(items: readonly T[], pick: (t: T) => number): number {
  return items.reduce((total, t) => total + pick(t), 0);
}

/** "2026-09" → "Sep 2026" */
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function AdminMoneyPage() {
  await requireAdmin("/admin/money");
  const store = getStore();
  const [settings, bookings, members, payments] = await Promise.all([store.getSettings(), store.listBookings(), store.listMembers({ includeCancelled: true }), store.listMemberPayments()]);
  const today = todayStr();

  // All time. A paid booking counts even when it was later closed as a no-show — the policy keeps that money.
  // Refunds and cancelled holds set paid back to false, so they fall out on their own.
  const paidBookings = bookings.filter((b) => b.paid);
  const nightlyCollected = sum(paidBookings, (b) => b.amountCents);
  const memberCollected = sum(payments, (p) => p.amountCents);
  const collected = nightlyCollected + memberCollected;

  const owingBookings = bookings.filter((b) => !b.paid && (b.status === "parked" || b.status === "reserved")).sort((a, b) => a.arrive.localeCompare(b.arrive));
  const owingMembers = members.filter((m) => m.status === "past_due").sort((a, b) => a.nextBill.localeCompare(b.nextBill));
  const owed = sum(owingBookings, (b) => b.amountCents) + sum(owingMembers, (m) => m.amountCents);

  // Each month, as of today
  const activeMembers = members.filter((m) => m.status === "active" || m.status === "past_due");
  const mrr = sum(activeMembers, (m) => m.amountCents);
  const overheadTotal = sum(settings.overhead, (o) => o.amountCents);
  const fees = estimateCardFees(mrr, activeMembers.length);
  const net = mrr - overheadTotal - fees;

  const perMemberNet = Math.round(settings.monthlyCents * 0.97);
  const needed = perMemberNet > 0 ? Math.ceil(overheadTotal / perMemberNet) : null;

  // Last 30 nights
  const from30 = addDays(today, -29);
  const recent = paidBookings.filter((b) => b.arrive >= from30 && b.arrive <= today);
  const recentCents = sum(recent, (b) => b.amountCents);

  // Month by month, last 6 months
  const keys = [5, 4, 3, 2, 1, 0].map((i) => addMonths(today, -i).slice(0, 7));
  const byMonth = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const p of payments) {
    const k = p.date.slice(0, 7);
    if (byMonth.has(k)) byMonth.set(k, (byMonth.get(k) ?? 0) + p.amountCents);
  }
  for (const b of paidBookings) {
    const k = b.arrive.slice(0, 7);
    if (byMonth.has(k)) byMonth.set(k, (byMonth.get(k) ?? 0) + b.amountCents);
  }
  const monthMax = Math.max(0, ...byMonth.values());

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Money</h1>
        <span className="text-muted text-[14.5px] font-semibold">As of {prettyDay(today)}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Panel>
          <div className="text-xs font-bold text-muted uppercase tracking-wide">Collected · all time</div>
          <div className="num text-[32px] font-extrabold tracking-tight leading-none mt-2 text-ok">{money(collected)}</div>
          <div className="text-[13px] text-muted mt-2 leading-relaxed">
            {money(memberCollected)} from monthly members · {money(nightlyCollected)} from {plural(paidBookings.length, "nightly stay")}
          </div>
        </Panel>
        <Panel>
          <div className="text-xs font-bold text-muted uppercase tracking-wide">Still owed</div>
          <div className={`num text-[32px] font-extrabold tracking-tight leading-none mt-2 ${owed > 0 ? "text-warn" : "text-fg"}`}>{money(owed)}</div>
          <div className="text-[13px] text-muted mt-2 leading-relaxed">
            {owed > 0 ? `${plural(owingBookings.length, "nightly stay")} and ${plural(owingMembers.length, "past-due member")}` : "Everybody is paid up."}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5">
        <SectionTitle>Each month, as of today</SectionTitle>
        <MoneyRow label={`${plural(activeMembers.length, "monthly member")}`} sub={activeMembers.length ? `at ${money(settings.monthlyCents)} each` : "Nobody on monthly yet"} cents={mrr} tone="ok" />
        {settings.overhead.map((o, i) => (
          <MoneyRow key={`${o.name}-${i}`} label={o.name} cents={-o.amountCents} tone="warn" />
        ))}
        <MoneyRow label="Card fees (estimate)" sub="About 2.9% + 30¢ per charge" cents={-fees} tone="warn" />
        <MoneyRow label="Net before nightly guests" cents={net} tone={net >= 0 ? "ok" : "warn"} big />
      </Panel>

      {needed !== null ? (
        <Note className="mt-3">
          Overhead is <span className="font-bold text-fg">{money(overheadTotal)}</span> a month. Each monthly member nets about <span className="font-bold text-fg">{money(perMemberNet)}</span> after card fees, so{" "}
          <span className="font-bold text-fg">
            it takes {needed} monthly member{needed === 1 ? "" : "s"} to cover it.
          </span>{" "}
          {activeMembers.length >= needed ? <span className="text-ok font-semibold">You have {activeMembers.length} — every nightly guest is profit.</span> : <span>You have {activeMembers.length} — {needed - activeMembers.length} more to go.</span>}
        </Note>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel>
          <SectionTitle right={<span className="text-[12.5px] text-muted">{prettyDay(from30)} – {prettyDay(today)}</span>}>Last 30 nights</SectionTitle>
          <div className="num text-[28px] font-extrabold tracking-tight leading-none text-ok">{money(recentCents)}</div>
          <div className="text-[13px] text-muted mt-2 leading-relaxed">
            {recent.length ? `${plural(recent.length, "paid nightly stay")} · about ${money(Math.round(recentCents / 30))} a night on average` : "No paid nightly stays in the last 30 nights."}
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Month by month</SectionTitle>
          <p className="m-0 mb-1 text-[12.5px] text-muted leading-relaxed">Monthly payments by the day they were paid, nightly stays by the night they arrived.</p>
          {keys.map((k) => {
            const cents = byMonth.get(k) ?? 0;
            return <MoneyRow key={k} label={monthLabel(k)} cents={cents} tone={cents > 0 ? "plain" : "muted"} bar={monthMax > 0 ? cents / monthMax : 0} />;
          })}
        </Panel>
      </div>

      <Panel className="mt-5">
        <SectionTitle right={owed > 0 ? <span className="num text-[15px] font-bold text-warn">{money(owed)}</span> : undefined}>Who owes you</SectionTitle>
        {owingBookings.length + owingMembers.length === 0 ? (
          <Empty>Nobody owes you anything right now.</Empty>
        ) : (
          <ul className="list-none m-0 p-0">
            {owingMembers.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-line last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[15px]">{m.name}</div>
                  <div className="text-[12.5px] text-muted leading-relaxed">
                    Monthly · {statusLabel(m).text} · was due {prettyDay(m.nextBill)} · code <span className="font-bold text-fg">{m.code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num font-bold text-[15px] text-warn whitespace-nowrap">{money(m.amountCents)}</span>
                  <CallButton phone={m.phone} />
                </div>
              </li>
            ))}
            {owingBookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-line last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[15px]">{b.name}</div>
                  <div className="text-[12.5px] text-muted leading-relaxed">
                    Nightly · {statusLabel(b).text} · {prettyDay(b.arrive)} · {b.nights} night{b.nights === 1 ? "" : "s"} · code <span className="font-bold text-fg">{b.code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num font-bold text-[15px] text-warn whitespace-nowrap">{money(b.amountCents)}</span>
                  <CallButton phone={b.phone} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
