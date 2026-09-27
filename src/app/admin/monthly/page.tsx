import type { Metadata } from "next";
import { ChevronDown, Plus } from "lucide-react";
import { CallButton } from "@/components/admin/call-button";
import { Notice } from "@/components/admin/notice";
import { StayAction } from "@/components/admin/stay-action";
import { StayCard } from "@/components/stay-card";
import { Button } from "@/components/ui/button";
import { Empty, GroupName, Note } from "@/components/ui/card";
import { Check, Field, Row2 } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { requireAdmin } from "@/lib/auth/session";
import { prettyDay, todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { getStore } from "@/lib/store";
import type { Member, MemberPayment } from "@/lib/types";
import { isSimulated } from "@/lib/services/reservations";
import { addMember, cancelMember, chargeMember, markPastDue } from "../actions";

export const metadata: Metadata = { title: "Monthly · Owner" };
export const dynamic = "force-dynamic";

type Search = { added?: string; error?: string };
type Totals = { count: number; cents: number; last: string | null };

function totalsByMember(payments: MemberPayment[]): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const p of payments) {
    const t = out.get(p.memberId) ?? { count: 0, cents: 0, last: null };
    t.count += 1;
    t.cents += p.amountCents;
    if (!t.last || p.date > t.last) t.last = p.date;
    out.set(p.memberId, t);
  }
  return out;
}

const NONE: Totals = { count: 0, cents: 0, last: null };

function paymentsTag(t: Totals): string {
  if (t.count === 0) return "No payments yet";
  return `${t.count} payment${t.count === 1 ? "" : "s"} · ${money(t.cents)}`;
}

function isDue(m: Member, today: string): boolean {
  return m.status === "past_due" || (m.status === "active" && m.nextBill <= today);
}

/** Past due first, then due today, then everyone else by name. */
function rank(m: Member, today: string): number {
  if (m.status === "past_due") return 0;
  if (m.status === "active" && m.nextBill <= today) return 1;
  if (m.status === "pending_payment") return 3;
  return 2;
}

export default async function AdminMonthlyPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin("/admin/monthly");
  const sp = await searchParams;
  const store = getStore();
  const simulated = isSimulated();
  const [settings, members, payments] = await Promise.all([store.getSettings(), store.listMembers({ includeCancelled: true }), store.listMemberPayments()]);
  const today = todayStr();
  const totals = totalsByMember(payments);

  const current = members.filter((m) => m.status !== "cancelled").sort((a, b) => rank(a, today) - rank(b, today) || a.name.localeCompare(b.name));
  const cancelled = members.filter((m) => m.status === "cancelled").sort((a, b) => (b.ended ?? "").localeCompare(a.ended ?? ""));
  const active = members.filter((m) => m.status === "active" || m.status === "past_due");
  const mrr = active.reduce((sum, m) => sum + m.amountCents, 0);
  const dueCount = current.filter((m) => isDue(m, today)).length;

  const added = sp.added ? members.find((m) => m.code === sp.added) ?? null : null;

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Monthly</h1>
        <span className="text-muted text-[14.5px] font-semibold">
          <span className="num">{active.length}</span> active · <span className="num">{money(mrr)}</span> per month recurring
        </span>
      </div>

      {sp.error ? <Notice tone="warn" className="mt-4">{sp.error}</Notice> : null}
      {added ? (
        <Notice className="mt-4">
          {added.name} is on the monthly list. Their code is <span className="num font-extrabold tracking-wider">{added.code}</span> — they can look up their gate codes on the site with it and their phone number.
        </Notice>
      ) : null}

      {members.length === 0 ? (
        <Empty className="mt-6">No monthly members yet. Monthly is the steady money — a driver who needs a home for his rig, paying like rent.</Empty>
      ) : (
        <section className="mt-6" aria-label="Monthly members">
          <GroupName>
            Members ({current.length}){dueCount ? ` · ${dueCount} due` : ""}
          </GroupName>
          {current.length === 0 ? <Empty>Nobody is on a monthly spot right now.</Empty> : null}
          {current.map((m) => {
            const t = totals.get(m.id) ?? NONE;
            const due = isDue(m, today);
            return (
              <StayCard
                key={m.id}
                stay={m}
                showContact
                actions={
                  <>
                    <CallButton phone={m.phone} />
                    {due ? (
                      <StayAction action={chargeMember} id={m.id} variant="primary" confirm={simulated ? `Charge ${m.name} ${money(m.amountCents)}? (Test mode — pretend money.)` : `Record ${money(m.amountCents)} from ${m.name}? Only tap this once you have the money — cards on file renew by themselves.`}>
                        {simulated ? `Charge ${money(m.amountCents)} now` : `Record ${money(m.amountCents)} payment`}
                      </StayAction>
                    ) : null}
                    {m.status === "active" && !due ? (
                      <StayAction action={markPastDue} id={m.id} variant="ghost" confirm={`Mark ${m.name} as past due? Their card shows "Past due" until you charge them.`}>
                        Mark past due
                      </StayAction>
                    ) : null}
                    <StayAction action={cancelMember} id={m.id} variant="danger" confirm={`Cancel ${m.name}'s monthly membership? Their stall opens up today and their codes stop working.`}>
                      Cancel membership
                    </StayAction>
                  </>
                }
              >
                <Tag>{paymentsTag(t)}</Tag>
                {t.last ? <Tag>Last paid {prettyDay(t.last)}</Tag> : null}
                {due ? <Tag tone="warn">{m.nextBill <= today ? `Due ${prettyDay(m.nextBill)}` : "Owes this month"}</Tag> : null}
                {m.status === "pending_payment" ? <Tag tone="warn">Card checkout not finished</Tag> : null}
              </StayCard>
            );
          })}
          {current.some((m) => m.status === "pending_payment") ? (
            <Note className="mt-2">A member who is &quot;waiting on payment&quot; started a card checkout on the site. They turn Current on their own once the card goes through.</Note>
          ) : null}
        </section>
      )}

      <details className="group mt-8 bg-elev border border-line rounded-md">
        <summary className="list-none cursor-pointer min-h-14 px-5 flex items-center justify-between gap-3 font-bold text-[16px] select-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Plus size={18} aria-hidden /> Add a member
          </span>
          <ChevronDown size={20} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5 pt-4 border-t border-line">
          <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">
            For a regular who signs up in person. {money(settings.monthlyCents)} a month, shower and laundry included. Untick &quot;paid&quot; if they still owe the first month.
          </p>
          <form action={addMember}>
            <Field id="mb-name" label="Driver's name" name="name" required autoComplete="off" maxLength={80} placeholder="Ray" />
            <Field id="mb-phone" label="Phone" name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={25} optional />
            <Field id="mb-company" label="Company" name="company" autoComplete="off" maxLength={80} optional placeholder="Owner-operator" />
            <Row2>
              <Field id="mb-truck" label="Truck" name="truck" autoComplete="off" maxLength={80} optional placeholder="Peterbilt 389" />
              <Field id="mb-plate" label="Plate" name="plate" autoComplete="off" maxLength={20} optional placeholder="TX 1234AB" />
            </Row2>
            <Row2>
              <Field id="mb-started" label="Starts" name="started" type="date" defaultValue={today} required />
              <div className="mb-4 flex items-end">
                <Check id="mb-paid" label="Paid first month" name="paid" defaultChecked />
              </div>
            </Row2>
            <Button type="submit" size="lg">
              Add member · {money(settings.monthlyCents)}/mo
            </Button>
          </form>
        </div>
      </details>

      {cancelled.length ? (
        <section className="mt-8" aria-label="Cancelled members">
          <GroupName>Cancelled ({cancelled.length})</GroupName>
          {cancelled.map((m) => {
            const t = totals.get(m.id) ?? NONE;
            return (
              <StayCard key={m.id} stay={m} showContact>
                <Tag>{m.ended ? `Ended ${prettyDay(m.ended)}` : "Ended"}</Tag>
                <Tag>{t.count === 0 ? "Never paid" : `${t.count} payment${t.count === 1 ? "" : "s"} · ${money(t.cents)} lifetime`}</Tag>
              </StayCard>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
