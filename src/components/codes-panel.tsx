import { Phone } from "lucide-react";
import { phoneDigits } from "@/lib/codes";
import { prettyDay } from "@/lib/dates";
import type { CodeReveal } from "@/lib/services/access";

/**
 * The dark receipt block with the gate codes. Big numbers, readable from a phone held up to a keypad.
 * Pass the result of codesForBooking / codesForMember — this component never decides who may see codes.
 */
export function CodesPanel({ reveal, phone, notes }: { reveal: CodeReveal; phone: string; notes?: string }) {
  if (!reveal.show) {
    const msg =
      reveal.reason === "unpaid"
        ? "Gate codes appear here as soon as payment goes through."
        : reveal.reason === "too_early"
          ? `Gate codes unlock on ${prettyDay(reveal.availableOn)} — two days before you arrive.`
          : reveal.reason === "cancelled"
            ? "This reservation was cancelled, so the codes are no longer active."
            : reveal.reason === "departed"
              ? "This stay is over. Thanks for parking with us."
              : reveal.reason === "not_set"
                ? "Call the lot for tonight's gate code — she'll give it to you over the phone."
                : "This stay has ended, so the codes are no longer active.";
    return (
      <div className="bg-asphalt text-dust rounded-sm p-5 print-plain">
        <p className="m-0 text-[14px] text-[#A9AFB6] leading-relaxed">{msg}</p>
        {reveal.reason === "unpaid" || reveal.reason === "too_early" || reveal.reason === "not_set" ? (
          <a href={`tel:${phoneDigits(phone)}`} className="inline-flex items-center gap-2 mt-4 text-amber-lift font-bold no-underline">
            <Phone size={16} aria-hidden /> Need in sooner? Call {phone}
          </a>
        ) : null}
      </div>
    );
  }
  const three = reveal.shed;
  return (
    <div className="bg-asphalt text-dust rounded-sm p-5 print-plain">
      <p className="m-0 text-[13.5px] text-[#A9AFB6]">Your codes — keypads are at cab height</p>
      <div className={`grid gap-2.5 mt-3 ${three ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="bg-[#2E3237] rounded-sm py-3 px-2 text-center">
          <small className="block text-[11px] text-[#A9AFB6] mb-1">Gate 1</small>
          <b className="num text-[clamp(19px,6.5vw,26px)] tracking-[0.08em] text-amber-lift break-all">{reveal.codes.gate1}</b>
        </div>
        <div className="bg-[#2E3237] rounded-sm py-3 px-2 text-center">
          <small className="block text-[11px] text-[#A9AFB6] mb-1">Gate 2</small>
          <b className="num text-[clamp(19px,6.5vw,26px)] tracking-[0.08em] text-amber-lift break-all">{reveal.codes.gate2}</b>
        </div>
        {three ? (
          <div className="bg-[#2E3237] rounded-sm py-3 px-2 text-center">
            <small className="block text-[11px] text-[#A9AFB6] mb-1">Shed</small>
            <b className="num text-[clamp(19px,6.5vw,26px)] tracking-[0.08em] text-amber-lift break-all">{reveal.codes.shedCode}</b>
          </div>
        ) : null}
      </div>
      {notes ? <p className="mt-4 mb-0 text-[13.5px] text-[#A9AFB6] leading-relaxed">{notes}</p> : null}
      <p className="mt-3 mb-0 text-[13.5px] text-[#A9AFB6]">
        Trouble at the gate?{" "}
        <a href={`tel:${phoneDigits(phone)}`} className="text-amber-lift font-bold no-underline">
          {phone}
        </a>{" "}
        — call, don&apos;t sit there.
      </p>
    </div>
  );
}
