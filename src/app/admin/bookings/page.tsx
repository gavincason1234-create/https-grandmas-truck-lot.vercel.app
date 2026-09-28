import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CallButton } from "@/components/admin/call-button";
import { Notice } from "@/components/admin/notice";
import { StayAction } from "@/components/admin/stay-action";
import { StayCard } from "@/components/stay-card";
import { Button, LinkButton } from "@/components/ui/button";
import { Empty, GroupName, Panel } from "@/components/ui/card";
import { Field, Row2, Select } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { requireAdmin } from "@/lib/auth/session";
import { prettyDay, todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { bookHref, parseBookQuery, PILE_LABEL, pilesFor, recentlyLeft, SHOW_OPTIONS } from "@/lib/services/book";
import { getStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { cancelHold, cancelRefund, markArrived, markDeparted, markNoShow, markPaid, removeBooking, restoreBooking } from "../actions";

export const metadata: Metadata = { title: "Bookings · Owner" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The buttons for one booking. Same rules as the Tonight tab, plus "put it back" for a hidden stay.
 * `onTonight` is the set of stays Tonight lists under Recently left: only those can be hidden from it.
 */
function Actions({ b, today, back, onTonight }: { b: Booking; today: string; back: string; onTonight: ReadonlySet<string> }) {
  switch (b.status) {
    case "reserved":
      return (
        <>
          <CallButton phone={b.phone} />
          {b.arrive <= today ? (
            <>
              <StayAction action={markArrived} id={b.id} back={back} variant="primary">
                They&apos;re here
              </StayAction>
              <StayAction action={markNoShow} id={b.id} back={back} variant="danger" confirm={`Mark ${b.name} as a no-show? Their stall opens back up and the reservation is closed.`}>
                No-show
              </StayAction>
            </>
          ) : (
            <StayAction action={cancelRefund} id={b.id} back={back} variant="danger" confirm={`Cancel ${b.name}'s reservation for ${prettyDay(b.arrive)}${b.paid ? ` and refund ${money(b.amountCents)}` : ""}?`}>
              Cancel &amp; refund
            </StayAction>
          )}
        </>
      );
    case "parked":
      return (
        <>
          <CallButton phone={b.phone} />
          {!b.paid ? (
            <StayAction action={markPaid} id={b.id} back={back} variant="primary" confirm={`Mark ${b.name} as paid ${money(b.amountCents)}? Only tap this once you have the money.`}>
              Mark paid · {money(b.amountCents)}
            </StayAction>
          ) : null}
          <StayAction action={markDeparted} id={b.id} back={back} variant={b.paid ? "dark" : "ghost"} confirm={`${b.name} pulled out? Their gate codes stop working and the stall opens up.`}>
            Pulled out
          </StayAction>
        </>
      );
    case "pending_payment":
      return (
        <>
          <CallButton phone={b.phone} />
          <StayAction action={cancelHold} id={b.id} back={back} variant="danger" confirm={`Cancel the hold for ${b.name}? They will need to book again.`}>
            Cancel hold
          </StayAction>
        </>
      );
    case "departed":
      return (
        <>
          <CallButton phone={b.phone} />
          {b.hidden ? (
            <StayAction action={restoreBooking} id={b.id} back={back} variant="ghost" confirm={`Put ${b.name}'s stay back at the top of Tonight's "Recently left" list?`}>
              Show on Tonight
            </StayAction>
          ) : onTonight.has(b.id) ? (
            <StayAction action={removeBooking} id={b.id} back={back} variant="ghost" confirm={`Hide ${b.name}'s stay from the Tonight tab? It stays here, and the money stays counted.`}>
              Hide from Tonight
            </StayAction>
          ) : null}
        </>
      );
    case "cancelled":
      return <CallButton phone={b.phone} />;
  }
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/bookings");
  const sp = await searchParams;
  const query = parseBookQuery(sp);
  const error = typeof sp.error === "string" ? sp.error : "";

  const bookings = await getStore().listBookings();
  const today = todayStr();
  const piles = pilesFor(bookings, query);
  const matched = piles.reduce((n, p) => n + p.total, 0);
  const filtering = Boolean(query.q || query.on || query.show !== "all");
  // Every button on this page comes back to this same view (same search, same filters).
  const self = bookHref(query);

  const upcoming = bookings.filter((b) => b.status === "reserved").length;
  const onLot = bookings.filter((b) => b.status === "parked").length;
  const onTonight = new Set(recentlyLeft(bookings).map((b) => b.id));

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Bookings</h1>
        <span className="text-muted text-[14.5px] font-semibold">
          <span className="num">{bookings.length}</span> all time · <span className="num">{upcoming}</span> reserved · <span className="num">{onLot}</span> on the lot
        </span>
      </div>

      {error ? <Notice tone="warn" className="mt-4">{error}</Notice> : null}

      <Panel className="mt-4">
        <form method="get" action="/admin/bookings" role="search" aria-label="Search bookings">
          <Field
            id="bk-q"
            label="Name, code, phone or plate"
            name="q"
            type="text"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={80}
            defaultValue={query.q}
            placeholder="Dale · K7M2P · 0142 · 8421RM"
            hint="Any part of a name or company, the start of a booking code, three or more digits of a phone number, or a plate."
          />
          <Row2>
            <Select id="bk-show" label="Show" name="show" defaultValue={query.show}>
              {SHOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Field id="bk-on" label="Who was here on" name="on" type="date" defaultValue={query.on} />
          </Row2>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="flex-1 min-w-[140px] sm:flex-none sm:px-8">
              <Search size={18} aria-hidden /> Search
            </Button>
            {filtering ? (
              <LinkButton href="/admin/bookings" variant="ghost" className="flex-1 min-w-[140px] sm:flex-none sm:px-8">
                Clear
              </LinkButton>
            ) : null}
          </div>
        </form>
      </Panel>

      {bookings.length === 0 ? (
        <Empty className="mt-6">
          No bookings yet. Every reservation a driver makes — and every walk-up you add — lands here and stays here, so you can always find a past stay.
        </Empty>
      ) : matched === 0 ? (
        <Empty className="mt-6">
          Nothing matches
          {query.q ? <> &ldquo;{query.q}&rdquo;</> : null}
          {query.on ? <> on {prettyDay(query.on)}</> : null}
          {query.show !== "all" ? <> under {PILE_LABEL[query.show]}</> : null}. Try fewer letters, just the last four digits of the phone, or &ldquo;Everything&rdquo; in the Show box.
        </Empty>
      ) : (
        <section className="mt-6" aria-label="Bookings found">
          {filtering ? (
            <p className="m-0 mb-3 text-[13.5px] text-muted" role="status">
              {matched === 1 ? "1 booking matches." : `${matched} bookings match.`}
            </p>
          ) : null}
          {piles
            .filter((p) => p.total > 0)
            .map((p) => (
              <div key={p.pile}>
                <GroupName>
                  {PILE_LABEL[p.pile]} ({p.total})
                </GroupName>
                {p.shown.map((b) => (
                  <StayCard key={b.id} stay={b} showContact actions={<Actions b={b} today={today} back={self} onTonight={onTonight} />}>
                    {b.status === "reserved" && b.arrive < today ? <Tag tone="warn">Was due {prettyDay(b.arrive)}</Tag> : null}
                    {b.status === "departed" && b.hidden ? <Tag>Hidden from Tonight</Tag> : null}
                    {/* A no-show keeps the money by policy; a cancel whose card refund failed keeps it until the owner refunds in Stripe. Either way it is still counted. */}
                    {b.status === "cancelled" && b.paid ? <Tag>Paid {money(b.amountCents)} · counted on Money</Tag> : null}
                  </StayCard>
                ))}
                {p.total > p.shown.length ? (
                  <LinkButton href={bookHref({ ...query, show: p.pile, all: true })} variant="ghost" className="w-full mb-2.5">
                    Show all {p.total} under {PILE_LABEL[p.pile]}
                  </LinkButton>
                ) : null}
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
