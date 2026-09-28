import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { CallButton } from "@/components/admin/call-button";
import { Notice } from "@/components/admin/notice";
import { OpenStrip } from "@/components/admin/open-strip";
import { StayAction } from "@/components/admin/stay-action";
import { Stalls } from "@/components/stalls";
import { StayCard } from "@/components/stay-card";
import { Button, LinkButton } from "@/components/ui/button";
import { Empty, GroupName, Note, Panel } from "@/components/ui/card";
import { Check, Field, Row2 } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { requireAdmin } from "@/lib/auth/session";
import { occupancyOn, occupancyRange } from "@/lib/availability";
import { prettyDay, todayStr } from "@/lib/dates";
import { money } from "@/lib/money";
import { codesForBooking, visibleCodes } from "@/lib/services/access";
import { recentlyLeft } from "@/lib/services/book";
import { getStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { addWalkUp, cancelHold, cancelRefund, markArrived, markDeparted, markNoShow, markPaid, removeBooking } from "./actions";

export const metadata: Metadata = { title: "Tonight · Owner" };
export const dynamic = "force-dynamic";

type Search = { added?: string; error?: string; sample?: string };

function byArrive(a: Booking, b: Booking): number {
  return a.arrive.localeCompare(b.arrive) || a.name.localeCompare(b.name);
}

function newestFirst(a: Booking, b: Booking): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export default async function AdminTonightPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin("/admin");
  const sp = await searchParams;
  const store = getStore();
  const [settings, bookings, members, priv] = await Promise.all([store.getSettings(), store.listBookings(), store.listMembers({ includeCancelled: true }), store.getPrivateSettings()]);
  const today = todayStr();

  const tonight = occupancyOn(settings, bookings, members, today);
  const week = occupancyRange(settings, bookings, members, today, 7);

  const expected = bookings.filter((b) => b.status === "reserved" && b.arrive <= today).sort(byArrive);
  const parked = bookings.filter((b) => b.status === "parked").sort(byArrive);
  const coming = bookings.filter((b) => b.status === "reserved" && b.arrive > today).sort(byArrive);
  const waiting = bookings.filter((b) => b.status === "pending_payment").sort(newestFirst);
  const left = recentlyLeft(bookings);

  const added = sp.added ? bookings.find((b) => b.code === sp.added) ?? null : null;
  const addedCodes = added ? visibleCodes(codesForBooking(added, priv, today)) : null;

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Tonight</h1>
        <span className="text-muted text-[14.5px] font-semibold">{prettyDay(today)}</span>
      </div>

      {sp.error ? <Notice tone="warn" className="mt-4">{sp.error}</Notice> : null}
      {sp.sample ? (
        <Notice className="mt-4">
          Sample bookings loaded. None of these people are real — clear them from{" "}
          <Link href="/admin/settings" className="underline text-ok">
            Settings
          </Link>{" "}
          when you&apos;re done looking around.
        </Notice>
      ) : null}
      {added ? (
        <Notice className="mt-4">
          {added.name} is added and parked. Booking code <span className="num font-extrabold tracking-wider">{added.code}</span>.
          {addedCodes ? (
            <>
              {" "}
              Gate code <span className="num font-extrabold tracking-wider">{addedCodes.gate1}</span>
              {addedCodes.gate2 !== addedCodes.gate1 ? (
                <>
                  {" "}
                  (second gate <span className="num font-extrabold tracking-wider">{addedCodes.gate2}</span>)
                </>
              ) : null}
              .
            </>
          ) : (
            <> Mark them paid to hand over the gate code.</>
          )}
        </Notice>
      ) : null}

      <Panel className="mt-4">
        <Stalls spots={settings.spots} occupancy={tonight} label={`${tonight.open} of ${settings.spots} stalls open tonight`} />
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="text-[24px] font-extrabold tracking-tight leading-none">
            <span className="num">{tonight.open}</span> open <span className="text-muted font-bold text-[17px]">of {settings.spots} tonight</span>
          </div>
          <div className="text-[13.5px] text-muted">
            {tonight.monthly} monthly · {tonight.nightly} nightly
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs font-bold text-muted mb-1.5">Next 7 nights</div>
          <OpenStrip days={week} spots={settings.spots} today={today} />
        </div>
      </Panel>

      {bookings.length === 0 ? (
        <Empty className="mt-6">
          No nightly bookings yet. Share the link with drivers and they&apos;ll show up here.
          <br />
          <span className="text-[13px]">Someone pull in already? Add them as a walk-up below.</span>
        </Empty>
      ) : (
        <section className="mt-6" aria-label="Nightly bookings">
          <GroupName>Expected today ({expected.length})</GroupName>
          {expected.length === 0 ? (
            <Empty>Nobody else is due in today.</Empty>
          ) : (
            expected.map((b) => (
              <StayCard
                key={b.id}
                stay={b}
                showContact
                actions={
                  <>
                    <CallButton phone={b.phone} />
                    <StayAction action={markArrived} id={b.id} variant="primary">
                      They&apos;re here
                    </StayAction>
                    <StayAction action={markNoShow} id={b.id} variant="danger" confirm={`Mark ${b.name} as a no-show? Their stall opens back up and the reservation is closed.`}>
                      No-show
                    </StayAction>
                  </>
                }
              >
                {b.arrive < today ? <Tag tone="warn">Was due {prettyDay(b.arrive)}</Tag> : null}
              </StayCard>
            ))
          )}

          <GroupName>Parked now ({parked.length})</GroupName>
          {parked.length === 0 ? (
            <Empty>No nightly trucks on the lot right now.</Empty>
          ) : (
            parked.map((b) => (
              <StayCard
                key={b.id}
                stay={b}
                showContact
                actions={
                  <>
                    <CallButton phone={b.phone} />
                    {!b.paid ? (
                      <StayAction action={markPaid} id={b.id} variant="primary" confirm={`Mark ${b.name} as paid ${money(b.amountCents)}? Only tap this once you have the money.`}>
                        Mark paid · {money(b.amountCents)}
                      </StayAction>
                    ) : null}
                    <StayAction action={markDeparted} id={b.id} variant={b.paid ? "dark" : "ghost"} confirm={`${b.name} pulled out? Their gate codes stop working and the stall opens up.`}>
                      Pulled out
                    </StayAction>
                  </>
                }
              />
            ))
          )}

          <GroupName>Coming up ({coming.length})</GroupName>
          {coming.length === 0 ? (
            <Empty>Nothing booked past tonight yet.</Empty>
          ) : (
            coming.map((b) => (
              <StayCard
                key={b.id}
                stay={b}
                showContact
                actions={
                  <>
                    <CallButton phone={b.phone} />
                    <StayAction action={cancelRefund} id={b.id} variant="danger" confirm={`Cancel ${b.name}'s reservation for ${prettyDay(b.arrive)}${b.paid ? ` and refund ${money(b.amountCents)}` : ""}?`}>
                      Cancel &amp; refund
                    </StayAction>
                  </>
                }
              />
            ))
          )}

          {waiting.length ? (
            <>
              <GroupName>Waiting on payment ({waiting.length})</GroupName>
              <Note className="mb-2.5">These drivers started a card payment but it has not gone through yet. Holds drop on their own after 45 minutes; cancel one sooner if you need the stall.</Note>
              {waiting.map((b) => (
                <StayCard
                  key={b.id}
                  stay={b}
                  showContact
                  actions={
                    <>
                      <CallButton phone={b.phone} />
                      <StayAction action={cancelHold} id={b.id} variant="danger" confirm={`Cancel the hold for ${b.name}? They will need to book again.`}>
                        Cancel hold
                      </StayAction>
                    </>
                  }
                />
              ))}
            </>
          ) : null}

          {left.length ? (
            <>
              <GroupName>Recently left</GroupName>
              {left.map((b) => (
                <StayCard
                  key={b.id}
                  stay={b}
                  showContact
                  actions={
                    <StayAction action={removeBooking} id={b.id} variant="ghost" confirm={`Hide ${b.name}'s stay from this list? It stays under Bookings, where you can put it back, and the money stays counted on the Money tab.`}>
                      Hide
                    </StayAction>
                  }
                />
              ))}
            </>
          ) : null}
          <LinkButton href="/admin/bookings" variant="ghost" className="w-full mt-4">
            Find an older stay, or search by name, phone or plate
          </LinkButton>
        </section>
      )}

      <details className="group mt-8 bg-elev border border-line rounded-md">
        <summary className="list-none cursor-pointer min-h-14 px-5 flex items-center justify-between gap-3 font-bold text-[16px] select-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Plus size={18} aria-hidden /> Add a walk-up
          </span>
          <ChevronDown size={20} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5 pt-4 border-t border-line">
          <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">
            For a driver who pulls in without booking. They go straight to &quot;Parked now&quot; for tonight at {money(settings.nightlyCents)} a night.
          </p>
          <form action={addWalkUp}>
            <Field id="wu-name" label="Driver's name" name="name" required autoComplete="off" maxLength={80} placeholder="Dale" />
            <Field id="wu-phone" label="Phone" name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={25} optional hint="So you can call them if a code fails." />
            <Row2>
              <Field id="wu-truck" label="Truck" name="truck" autoComplete="off" maxLength={80} optional placeholder="53' dry van" />
              <Field id="wu-plate" label="Plate" name="plate" autoComplete="off" maxLength={20} optional placeholder="TX 1234AB" />
            </Row2>
            <Row2>
              <Field id="wu-nights" label="Nights" name="nights" type="number" inputMode="numeric" min={1} max={30} defaultValue={1} required />
              <div className="mb-4 flex items-end">
                <Check id="wu-paid" label="Paid (cash or card)" name="paid" defaultChecked />
              </div>
            </Row2>
            <Button type="submit" size="lg">
              Add walk-up
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
