import { MessageSquareText, Phone } from "lucide-react";
import Link from "next/link";
import { phoneDigits } from "@/lib/codes";
import type { LotSettings } from "@/lib/types";

/**
 * Sticky bottom bar on driver pages: call, text, reserve. One thumb, no hunting.
 */
export function CallBar({ settings, reserveHref = "/book", reserveLabel = "Reserve a spot" }: { settings: LotSettings; reserveHref?: string; reserveLabel?: string }) {
  const tel = phoneDigits(settings.phone);
  const sms = phoneDigits(settings.smsPhone || settings.phone);
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-header text-header-fg border-t border-white/10 no-print" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto max-w-6xl px-3 py-2 grid grid-cols-[auto_auto_1fr] gap-2">
        <a href={`tel:${tel}`} className="inline-flex flex-col items-center justify-center min-w-16 min-h-12 rounded-sm border border-white/15 text-[11px] font-semibold no-underline text-header-fg hover:bg-white/10" aria-label={`Call ${settings.phone}`}>
          <Phone size={18} aria-hidden />
          Call
        </a>
        <a href={`sms:${sms}`} className="inline-flex flex-col items-center justify-center min-w-16 min-h-12 rounded-sm border border-white/15 text-[11px] font-semibold no-underline text-header-fg hover:bg-white/10" aria-label="Text the lot">
          <MessageSquareText size={18} aria-hidden />
          Text
        </a>
        <Link href={reserveHref} className="inline-flex items-center justify-center min-h-12 rounded-sm bg-accent text-on-accent text-[15px] font-bold no-underline hover:bg-accent-hover">
          {reserveLabel}
        </Link>
      </div>
    </div>
  );
}
