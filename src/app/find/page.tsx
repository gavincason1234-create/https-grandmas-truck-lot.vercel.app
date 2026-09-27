import type { Metadata } from "next";
import Link from "next/link";
import { FindForm } from "@/components/find-form";
import { PageShell } from "@/components/page-shell";
import { Note } from "@/components/ui/card";
import { normalizeCode, phoneDigits } from "@/lib/codes";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Find my booking" };

export default async function FindPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const [sp, settings] = await Promise.all([searchParams, getStore().getSettings()]);
  const initialCode = sp.code ? normalizeCode(sp.code) : "";

  return (
    <PageShell callBar={false} width="max-w-xl">
      <div className="pt-6 sm:pt-8">
        <h1 className="text-[28px] font-extrabold tracking-tight m-0">Find my booking</h1>
        <p className="text-muted mt-2 mb-5 leading-relaxed">
          Lost the page? Enter your 5-character code and the last 4 digits of the phone you booked with. You&apos;ll see your stay and, once it&apos;s paid and close to your date, your gate codes.
        </p>

        <FindForm phone={settings.phone} notes={settings.notes} initialCode={initialCode} />

        <Note className="mt-5">
          Signed in?{" "}
          <Link href="/account" className="font-bold text-fg">
            See all your bookings
          </Link>{" "}
          in one place.
        </Note>

        <p className="mt-6 text-[13.5px] text-muted leading-relaxed">
          Can&apos;t find your code? Call{" "}
          <a href={`tel:${phoneDigits(settings.phone)}`} className="font-bold text-fg no-underline">
            {settings.phone}
          </a>{" "}
          — she can look you up by name.
        </p>
      </div>
    </PageShell>
  );
}
