import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { BookingForm, type Plan } from "@/components/booking/booking-form";
import { PageShell } from "@/components/page-shell";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeCode, phoneDigits } from "@/lib/codes";
import { isIsoDay, todayStr } from "@/lib/dates";
import { isSimulated } from "@/lib/services/reservations";
import { publicSettings } from "@/lib/defaults";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Reserve a spot" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ plan?: string; arrive?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const store = getStore();
  const [settings, user] = await Promise.all([store.getSettings(), getSessionUser()]);
  const profile = user ? await store.getProfile(user.id) : null;

  const prefill = {
    name: profile?.fullName || user?.name || "",
    phone: profile?.phone ?? "",
    company: profile?.company ?? "",
    truck: profile?.truck ?? "",
    plate: profile?.plate ?? "",
  };
  const initialPlan: Plan | null = sp.plan === "monthly" || sp.plan === "nightly" ? sp.plan : null;
  const cancelledCode = sp.cancelled ? normalizeCode(sp.cancelled) : "";
  const today = todayStr();
  // The home page's 7-night strip links here with ?arrive=YYYY-MM-DD; only accept a real, not-yet-passed day.
  const initialArrive = sp.arrive && isIsoDay(sp.arrive) && sp.arrive >= today ? sp.arrive : null;

  return (
    <PageShell callBar={false} width="max-w-2xl">
      <div className="pt-6 sm:pt-8">
        <h1 className="text-[28px] font-extrabold tracking-tight m-0">Reserve a spot</h1>
        <p className="text-muted mt-2 mb-5 leading-relaxed">
          {user ? "About a minute. " : "About a minute, no account needed. "}You get a 5-character code, and your gate code shows up right here on your phone.
        </p>

        {cancelledCode ? (
          <div role="alert" className="mb-5 rounded-sm bg-warn-bg text-warn px-4 py-3 text-[14px] font-semibold leading-relaxed">
            Payment was cancelled — your spot isn&apos;t held. Start again below.
          </div>
        ) : null}

        <BookingForm settings={publicSettings(settings)} today={today} initialPlan={initialPlan} initialArrive={initialArrive} prefill={prefill} simulated={isSimulated()} signedIn={Boolean(user)} />

        <p className="mt-8 text-[13.5px] text-muted leading-relaxed">
          Rather talk to a person?{" "}
          <a href={`tel:${phoneDigits(settings.phone)}`} className="inline-flex items-center gap-1.5 font-bold text-fg no-underline min-h-12 align-middle">
            <Phone size={16} aria-hidden /> {settings.phone}
          </a>
        </p>
      </div>
    </PageShell>
  );
}
