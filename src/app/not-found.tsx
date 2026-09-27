import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LinkButton } from "@/components/ui/button";
import { Note, Panel } from "@/components/ui/card";
import { phoneDigits } from "@/lib/codes";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Page not found" };

export default async function NotFound() {
  const s = await getStore().getSettings();
  const tel = phoneDigits(s.phone);

  return (
    <PageShell callBar={false} width="max-w-xl">
      <section className="pt-10">
        <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Wrong turn</p>
        <h1 className="mt-2 mb-3 text-[30px] font-extrabold tracking-tight leading-tight">That page isn&apos;t here.</h1>
        <p className="m-0 text-[16px] text-muted leading-relaxed">The link may be old, or it got typed wrong. The lot is still open — here&apos;s the way back.</p>

        <Panel className="mt-6 grid gap-2.5">
          <LinkButton href="/" size="lg">
            See what&apos;s open tonight
          </LinkButton>
          <LinkButton href="/find" size="lg" variant="ghost">
            Find my booking
          </LinkButton>
          <LinkButton href={`tel:${tel}`} size="lg" variant="dark">
            <Phone size={18} aria-hidden /> Call {s.phone}
          </LinkButton>
        </Panel>

        <Note className="mt-5">Stuck at the gate? Don&apos;t hunt through the website — just call. She picks up.</Note>
      </section>
    </PageShell>
  );
}
