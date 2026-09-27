import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Camera, Check, Clock, Fence, KeyRound, Lightbulb, Ruler, ShowerHead, Toilet, Truck, WashingMachine, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, Note, Panel, SectionTitle } from "@/components/ui/card";
import { phoneDigits } from "@/lib/codes";
import { money } from "@/lib/money";
import { getStore } from "@/lib/store";
import type { Photo } from "@/lib/types";

export const metadata: Metadata = {
  title: "The lot",
  description: "Photos, what's on site, how the gate works, and the lot rules at Grandma's Truck Lot in Gainesville, TX.",
};

/** Hosts next.config.ts lets next/image optimise. Anything else is served as-is instead of throwing. */
function optimizable(src: string): boolean {
  if (!/^https?:\/\//i.test(src)) return true; // /public paths
  try {
    const host = new URL(src).hostname;
    return host === "lh3.googleusercontent.com" || host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function PhotoTile({ photo, hero }: { photo: Photo; hero: boolean }) {
  const box = hero ? "aspect-video" : "aspect-[4/3]";
  if (!photo.src) {
    return (
      <div className={`photo-placeholder ${box} ${hero ? "col-span-full" : ""} rounded-sm flex items-center justify-center text-center px-4 text-[15px] font-bold`} role="img" aria-label={`${photo.caption} (photo coming soon)`}>
        {photo.caption}
      </div>
    );
  }
  return (
    <figure className={`m-0 ${hero ? "col-span-full" : ""}`}>
      <div className={`relative ${box} overflow-hidden rounded-sm bg-sunk`}>
        <Image src={photo.src} alt={photo.caption} fill priority={hero} unoptimized={!optimizable(photo.src)} sizes={hero ? "(min-width: 1152px) 1152px, 100vw" : "(min-width: 640px) 50vw, 100vw"} className="object-cover" />
      </div>
      <figcaption className="mt-1.5 text-[12.5px] text-muted">{photo.caption}</figcaption>
    </figure>
  );
}

export default async function LotPage() {
  const s = await getStore().getSettings();
  const tel = phoneDigits(s.phone);

  const amenities: { icon: typeof Truck; text: string; on: boolean }[] = [
    { icon: KeyRound, text: "Gated — code keypads at cab height", on: s.security.gated },
    { icon: Lightbulb, text: "Lit all night", on: s.security.lit },
    { icon: Fence, text: "Fenced all the way around", on: s.security.fenced },
    { icon: Camera, text: "Cameras on the gate and lot", on: s.security.cameras },
    { icon: Truck, text: "Pull-through gravel stalls — no backing in", on: true },
    { icon: ShowerHead, text: "Shower in the shed", on: true },
    { icon: WashingMachine, text: "Washer and dryer", on: true },
    { icon: Toilet, text: "Porta-potties by the shed", on: true },
    { icon: Ruler, text: `Room for rigs up to ${s.maxLengthFt}' long`, on: true },
    { icon: Clock, text: "Open 24 hours — codes work any hour", on: true },
  ];

  const steps = [
    {
      title: "Reserve",
      body: "Pick tonight or any night up to six months out. Takes about a minute on your phone. No account needed — you get a 5-letter code you can look up later.",
    },
    {
      title: "Get your codes",
      body: "As soon as you're paid, the gate codes show on your phone (two days ahead at the earliest). They're also on your account page if you signed in.",
    },
    {
      title: "Punch it in and park",
      body: "At the gate, enter the code on the keypad — it's mounted at cab height, no climbing down. Pull through and park in any open stall.",
    },
  ];

  const rules = [
    "Park inside a stall, nose out, so the next driver can pull through.",
    "Idling is fine when you need heat or AC. Keep it to what you need — folks live close by.",
    "Quiet after 10 PM. No horns, no loud music, no engine work.",
    "No dumping tanks, oil, or trash on the gravel. Bagged trash goes in the dumpster by the shed.",
    "Keep the gate closed behind you and keep your code to yourself.",
    "Walking pace on the gravel. Kids and pets sometimes visit the house.",
    "Trailer drops, bobtails, and placarded loads — call first so she knows what's on the lot.",
    "One rig per spot. Need two? Reserve two.",
  ];

  return (
    <PageShell>
      <section className="pt-7 sm:pt-10">
        <h1 className="m-0 text-[30px] sm:text-[38px] font-extrabold tracking-tight leading-[1.05]">The lot</h1>
        <p className="mt-2 mb-0 text-[16.5px] text-muted leading-relaxed max-w-prose">
          {s.spots} gravel stalls behind a lit gate, a shower and laundry shed, and a grandmother who answers the phone. Nothing fancy — just a place to shut it down.
        </p>
      </section>

      {/* Photos */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {s.photos.map((p, i) => (
            <PhotoTile key={`${p.caption}-${i}`} photo={p} hero={i === 0} />
          ))}
        </div>
        {s.photos.every((p) => !p.src) ? <p className="mt-2 mb-0 text-[12.5px] text-muted">Real photos are on the way. Until then the lot looks like this: gravel, lights, and a gate.</p> : null}
      </section>

      {/* Amenities */}
      <section className="mt-8">
        <SectionTitle>What&apos;s here</SectionTitle>
        <ul className="list-none m-0 p-0 grid gap-1.5 sm:grid-cols-2">
          {amenities.map(({ icon: Icon, text, on }) => (
            <li key={text} className={`flex items-center gap-3 min-h-12 bg-elev border border-line rounded-sm px-3 py-2 text-[14.5px] ${on ? "font-semibold" : "text-muted line-through"}`}>
              {on ? <Check size={20} className="shrink-0 text-ok" aria-hidden /> : <X size={20} className="shrink-0" aria-hidden />}
              <Icon size={20} className={`shrink-0 ${on ? "text-accent" : ""}`} aria-hidden />
              <span className={on ? "" : "line-through"}>{text}</span>
              {on ? null : <span className="sr-only"> — not available</span>}
            </li>
          ))}
        </ul>
      </section>

      {/* How the gate works */}
      <section className="mt-8">
        <SectionTitle>How it works at the gate</SectionTitle>
        <ol className="list-none m-0 p-0 grid gap-2.5 md:grid-cols-3">
          {steps.map((st, i) => (
            <li key={st.title}>
              <Card tone="accent" className="h-full mb-0">
                <div className="flex items-center gap-3">
                  <span className="num inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent text-on-accent font-extrabold text-[16px]">{i + 1}</span>
                  <h3 className="m-0 text-[16px] font-bold">{st.title}</h3>
                </div>
                <p className="mt-2.5 mb-0 text-[14.5px] text-muted leading-relaxed">{st.body}</p>
              </Card>
            </li>
          ))}
        </ol>
        <Note className="mt-3">
          Code won&apos;t take? Don&apos;t sit at the gate — call{" "}
          <a href={`tel:${tel}`} className="font-bold text-fg no-underline">
            {s.phone}
          </a>
          . Codes are checked every night, but a keypad can act up in the rain.
        </Note>
      </section>

      {/* Rules */}
      <section className="mt-8">
        <SectionTitle>Rules</SectionTitle>
        <Panel>
          <ul className="m-0 pl-5 grid gap-2 text-[15px] leading-relaxed">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Panel>
      </section>

      {/* Size + hours */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            <Ruler size={16} aria-hidden /> Max length
          </div>
          <div className="mt-1 num text-[34px] font-extrabold leading-none">{s.maxLengthFt}&apos;</div>
          <p className="mt-2 mb-0 text-[14px] text-muted leading-relaxed">Tractor and trailer together. Standard 53&apos; vans fit easy with room to pull through. Longer than {s.maxLengthFt}&apos;? Call first.</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            <Clock size={16} aria-hidden /> Hours
          </div>
          <div className="mt-1 text-[34px] font-extrabold leading-none">24 / 7</div>
          <p className="mt-2 mb-0 text-[14px] text-muted leading-relaxed">Come and go any hour. Your gate code works the whole time you&apos;re paid for, day or night.</p>
        </Panel>
      </section>

      {/* CTA */}
      <section className="mt-8">
        <Panel className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-[18px] font-extrabold">Ready to shut it down?</div>
            <p className="m-0 mt-1 text-[14.5px] text-muted">
              {money(s.nightlyCents)} a night, {money(s.monthlyCents)} a month.{" "}
              <Link href="/pricing" className="font-semibold text-fg">
                See what&apos;s included
              </Link>
              .
            </p>
          </div>
          <LinkButton href="/book" size="lg" className="sm:w-auto sm:min-w-56">
            Reserve a spot
          </LinkButton>
        </Panel>
      </section>
    </PageShell>
  );
}
