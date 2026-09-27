import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { StayCard } from "@/components/stay-card";
import { Button, LinkButton } from "@/components/ui/button";
import { Empty, GroupName, Note, Panel, SectionTitle } from "@/components/ui/card";
import { Field, Row2 } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { requireUser } from "@/lib/auth/session";
import { money } from "@/lib/money";
import { prettyDay, todayStr } from "@/lib/dates";
import { refundable } from "@/lib/services/reservations";
import { getStore } from "@/lib/store";
import type { Booking, Member, Profile } from "@/lib/types";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { env } from "@/lib/env";
import { vaultStatus } from "@/lib/vault";
import { cancelBooking, cancelMembership, saveProfile } from "./actions";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

type Search = Promise<{ denied?: string; saved?: string; cancelled?: string; error?: string; refund?: string }>;

/** Plain-English versions of the error codes the actions redirect back with. */
const ERRORS: Record<string, string> = {
  invalid: "Something in that form didn't look right. Check the phone number and try again.",
  too_late: "It's past the cancel-by time for that night (6 PM on arrival day). Call the lot and she'll sort it out.",
  not_active: "That membership isn't active, so there's nothing to cancel.",
  already_cancelled: "That one was already cancelled.",
};

/** Nights that still hold (or will hold) a stall. Everything else is history. */
const OPEN: readonly Booking["status"][] = ["reserved", "parked", "pending_payment"];

/** Live memberships sort ahead of cancelled ones. */
const MEMBER_RANK: Record<Member["status"], number> = { past_due: 0, active: 1, pending_payment: 2, cancelled: 3 };

function Flash({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  const cls = tone === "ok" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn";
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={`rounded-sm px-4 py-3 text-[14px] font-semibold leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

function Avatar({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <Image src={avatarUrl} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-full border border-line object-cover" />;
  }
  const initial = ((name.trim() || email)[0] ?? "?").toUpperCase();
  return (
    <div aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-on-accent text-[24px] font-extrabold">
      {initial}
    </div>
  );
}

function ReceiptLink({ code }: { code: string }) {
  return (
    <LinkButton href={`/book/confirmed/${code}`} variant="ghost">
      <KeyRound size={18} aria-hidden /> Codes &amp; receipt
    </LinkButton>
  );
}

function BookingCard({ booking: b }: { booking: Booking }) {
  const canCancel = b.status === "reserved" && refundable(b);
  return (
    <StayCard
      stay={b}
      actions={
        <>
          <ReceiptLink code={b.code} />
          {canCancel ? (
            <form action={cancelBooking} className="flex">
              <input type="hidden" name="bookingId" value={b.id} />
              <ConfirmButton message={`Cancel your ${prettyDay(b.arrive)} reservation? Your stall opens up and the ${money(b.amountCents)} goes back to your card.`} className="w-full">
                Cancel · full refund
              </ConfirmButton>
            </form>
          ) : null}
        </>
      }
    />
  );
}

function MemberCard({ member: m, today }: { member: Member; today: string }) {
  const canCancel = m.status === "active" || m.status === "past_due";
  const stillHasStall = m.status === "cancelled" && m.ended !== null && today < m.ended;
  return (
    <StayCard
      stay={m}
      actions={
        <>
          <ReceiptLink code={m.code} />
          {canCancel ? (
            <form action={cancelMembership} className="flex">
              <input type="hidden" name="memberId" value={m.id} />
              <ConfirmButton message={`Cancel your monthly membership? You keep the stall through ${prettyDay(m.nextBill)}, then no more charges.`} className="w-full">
                Cancel membership
              </ConfirmButton>
            </form>
          ) : null}
        </>
      }
    >
      {stillHasStall ? <Tag tone="ok">Stall is yours through {prettyDay(m.ended)}</Tag> : null}
    </StayCard>
  );
}

/**
 * The driver's own page: their nights, their monthly spot, and the details we prefill the booking
 * form with. Gate codes are not shown here on purpose — each stay's "Codes & receipt" page applies
 * the reveal rules and is the one place codes appear.
 */
export default async function AccountPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser("/account");
  const sp = await searchParams;
  const store = getStore();
  const today = todayStr();

  const [bookings, members, existing] = await Promise.all([
    store.listBookings({ userId: user.id }),
    store.listMembers({ userId: user.id, includeCancelled: true }),
    store.getProfile(user.id),
  ]);
  const profile: Profile = existing ?? (await store.upsertProfile({ id: user.id, email: user.email, fullName: user.name, role: user.isAdmin ? "admin" : "driver" }));

  const open = bookings.filter((b) => OPEN.includes(b.status)).sort((a, b) => a.arrive.localeCompare(b.arrive));
  const past = bookings.filter((b) => !OPEN.includes(b.status)).sort((a, b) => b.arrive.localeCompare(a.arrive));
  const sortedMembers = members.slice().sort((a, b) => MEMBER_RANK[a.status] - MEMBER_RANK[b.status] || b.started.localeCompare(a.started));

  const firstName = user.name.trim().split(/\s+/)[0] || user.email;
  const cancelledMember = sp.cancelled ? members.find((m) => m.code === sp.cancelled && m.status === "cancelled") : undefined;
  const cancelledBooking = !cancelledMember && sp.cancelled ? bookings.find((b) => b.code === sp.cancelled && b.status === "cancelled") : undefined;
  const errorText = sp.error ? ERRORS[sp.error] : undefined;

  return (
    <PageShell callBar={false} width="max-w-2xl">
      <div className="pt-6 sm:pt-8">
        {/* ---- who ---- */}
        <section className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">My account</p>
            <h1 className="m-0 mt-0.5 truncate text-[26px] font-extrabold leading-tight tracking-tight sm:text-[28px]">Hey, {firstName}</h1>
            <p className="m-0 mt-0.5 truncate text-[14px] text-muted">{user.email}</p>
          </div>
          <SignOutButton className="ml-auto" />
        </section>

        {/* ---- flashes ---- */}
        <div className="mt-5 grid gap-2 empty:hidden">
          {sp.denied === "admin" ? (
            <Flash tone="warn">
              {vaultStatus().state === "open" || env.devAuth
                ? "This Google account isn't set up as an owner. If you run the lot, sign in with the Google account that was set up for you, or ask whoever manages the website to add this one."
                : "Owner sign-in isn't working right now: the website's key for the owner list is missing on the server. Whoever manages the website needs to set VAULT_KEY."}
            </Flash>
          ) : null}
          {sp.saved ? <Flash tone="ok">Saved. Your next reservation will start with these details.</Flash> : null}
          {cancelledMember ? (
            <Flash tone="ok">
              Membership {cancelledMember.code} is cancelled.{" "}
              {cancelledMember.ended && today < cancelledMember.ended ? `Your stall and gate codes keep working through ${prettyDay(cancelledMember.ended)}, then they turn off.` : "No more charges."}
            </Flash>
          ) : null}
          {cancelledBooking && sp.refund === "failed" ? (
            <Flash tone="warn">Reservation {cancelledBooking.code} is cancelled, but the card refund didn&apos;t go through automatically. Call the lot and she&apos;ll send it back by hand.</Flash>
          ) : cancelledBooking ? (
            <Flash tone="ok">Reservation {cancelledBooking.code} is cancelled. If you paid by card, the refund goes back to that same card — usually within a few business days.</Flash>
          ) : null}
          {cancelledMember && sp.refund === "failed" ? <Flash tone="warn">Heads up: we couldn&apos;t confirm the card was stopped. Call the lot so you aren&apos;t charged again.</Flash> : null}
          {errorText ? <Flash tone="warn">{errorText}</Flash> : null}
        </div>

        {/* ---- nights ---- */}
        <section className="mt-8">
          <SectionTitle right={bookings.length ? <LinkButton href="/book">Reserve a spot</LinkButton> : undefined}>Your bookings</SectionTitle>
          {bookings.length === 0 ? (
            <Empty>
              <p className="m-0 mb-4">No nights booked yet. Tonight&apos;s spots are a tap away.</p>
              <LinkButton href="/book">Reserve a spot</LinkButton>
            </Empty>
          ) : (
            <>
              <GroupName>Upcoming &amp; current</GroupName>
              {open.length ? (
                open.map((b) => <BookingCard key={b.id} booking={b} />)
              ) : (
                <Empty>
                  Nothing on the books right now.{" "}
                  <Link href="/book" className="font-bold text-fg">
                    Reserve a night
                  </Link>
                  .
                </Empty>
              )}
              {past.length ? (
                <>
                  <GroupName>Past</GroupName>
                  {past.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </>
              ) : null}
            </>
          )}
          {open.some((b) => b.status === "reserved" && refundable(b)) ? (
            <Note className="mt-3">Change of plans? Cancel any time before 6 PM on the day you arrive and the whole amount comes back. After that the night is yours either way.</Note>
          ) : null}
        </section>

        {/* ---- monthly ---- */}
        <section className="mt-8">
          <SectionTitle>Monthly membership</SectionTitle>
          {sortedMembers.length === 0 ? (
            <Empty>
              <p className="m-0 mb-4">No monthly spot yet. Park here most nights? A membership is cheaper, the stall is always yours, and showers and laundry are included.</p>
              <LinkButton href="/book?plan=monthly" variant="ghost">
                See the monthly plan
              </LinkButton>
            </Empty>
          ) : (
            <>
              {sortedMembers.map((m) => (
                <MemberCard key={m.id} member={m} today={today} />
              ))}
              {sortedMembers.some((m) => m.status === "active" || m.status === "past_due") ? (
                <Note className="mt-3">
                  Cancelling stops the next charge. You keep your stall and your gate codes through the day you&apos;ve already paid for — the date shown as your next charge — then they turn off. No partial refunds on a month already started.
                </Note>
              ) : null}
            </>
          )}
        </section>

        {/* ---- details ---- */}
        <section className="mt-8" id="details">
          <SectionTitle>Your details</SectionTitle>
          <Panel>
            <form action={saveProfile}>
              <Field id="fullName" name="fullName" label="Full name" autoComplete="name" defaultValue={profile.fullName} maxLength={80} />
              <Field id="phone" name="phone" type="tel" inputMode="tel" label="Phone" hint="In case a gate code fails." autoComplete="tel" defaultValue={profile.phone} maxLength={25} />
              <Field id="company" name="company" label="Company" optional autoComplete="organization" defaultValue={profile.company} maxLength={80} />
              <Row2>
                <Field id="truck" name="truck" label="Truck" optional placeholder="53' dry van" defaultValue={profile.truck} maxLength={80} />
                <Field id="plate" name="plate" label="Plate" optional placeholder="TX 8421RM" defaultValue={profile.plate} maxLength={80} autoCapitalize="characters" />
              </Row2>
              <Button type="submit" size="lg">
                Save details
              </Button>
            </form>
            <Note className="mt-4">We prefill your next reservation with these. Nothing here is shared with anyone — it just saves you typing in the cab.</Note>
          </Panel>
        </section>

        {/* ---- owner ---- */}
        {user.isAdmin ? (
          <section className="mt-8">
            <SectionTitle>Owner?</SectionTitle>
            <Panel className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 max-w-[36ch] text-[14px] leading-relaxed text-muted">This account is on the owner list. The dashboard has tonight&apos;s lot, the money, and the safe.</p>
              <LinkButton href="/admin" variant="dark">
                <ShieldCheck size={18} aria-hidden /> Open the dashboard
              </LinkButton>
            </Panel>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
