import type { ReactNode } from "react";
import { prettyDay } from "@/lib/dates";
import { money } from "@/lib/money";
import type { Booking, Member } from "@/lib/types";
import { Card } from "./ui/card";
import { Tag } from "./ui/tag";

export type Stay = ({ kind: "nightly" } & Booking) | ({ kind: "monthly" } & Member);

function toneFor(stay: Stay): "plain" | "ok" | "accent" | "warn" {
  if (stay.kind === "monthly") return stay.status === "past_due" ? "warn" : stay.status === "cancelled" ? "plain" : "ok";
  if (stay.status === "parked") return stay.paid ? "ok" : "warn";
  if (stay.status === "reserved") return "accent";
  if (stay.status === "pending_payment") return "warn";
  return "plain";
}

export function statusLabel(stay: Stay): { text: string; tone: "ok" | "warn" | "plain" | "accent" } {
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
 * One booking or membership as a card. Shared by the driver's account page, the lookup page,
 * and the owner's dashboard (which adds its own buttons via `actions`).
 */
export function StayCard({ stay, actions, showContact = false, children }: { stay: Stay; actions?: ReactNode; showContact?: boolean; children?: ReactNode }) {
  const status = statusLabel(stay);
  const truckLine = [stay.truck, stay.plate].filter(Boolean).join(" · ") || "No truck details";
  const when =
    stay.kind === "monthly"
      ? `Since ${prettyDay(stay.started)} · next charge ${prettyDay(stay.nextBill)}`
      : `${prettyDay(stay.arrive)} · ${stay.nights} night${stay.nights === 1 ? "" : "s"}`;
  const amount = stay.kind === "monthly" ? `${money(stay.amountCents)}/mo` : money(stay.amountCents);

  return (
    <Card tone={toneFor(stay)} className="mb-2.5">
      <div className="flex justify-between gap-3 items-start">
        <div className="min-w-0">
          <div className="font-bold text-[15px]">{stay.name}</div>
          <div className="text-[12.5px] text-muted leading-relaxed mt-1">
            {showContact ? (
              <>
                {stay.phone}
                {stay.company ? ` · ${stay.company}` : ""}
                <br />
              </>
            ) : null}
            {truckLine}
            <br />
            {when} · code <span className="font-bold text-fg">{stay.code}</span>
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
      <div className="mt-2 flex flex-wrap gap-1">
        <Tag tone={status.tone}>{status.text}</Tag>
        {children}
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2 [&>*]:flex-1 [&>*]:min-w-[120px]">{actions}</div> : null}
    </Card>
  );
}
