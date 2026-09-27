import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, MapPin, Navigation, Phone, TriangleAlert, Truck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LinkButton } from "@/components/ui/button";
import { Note, Panel, SectionTitle } from "@/components/ui/card";
import { phoneDigits } from "@/lib/codes";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Directions",
  description: "How to get a truck to Grandma's Truck Lot in Gainesville, TX: the approach from US-82, map links, and what to do at the gate.",
};

function isCoord(v: number | null): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export default async function DirectionsPage() {
  const s = await getStore().getSettings();
  const tel = phoneDigits(s.phone);
  const hasCoords = isCoord(s.lat) && isCoord(s.lng);
  const lat = hasCoords ? (s.lat as number) : null;
  const lng = hasCoords ? (s.lng as number) : null;

  const destination = lat !== null && lng !== null ? `${lat},${lng}` : encodeURIComponent(s.address);
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  const appleUrl = `https://maps.apple.com/?daddr=${destination}`;

  const bbox = lat !== null && lng !== null ? `${(lng - 0.014).toFixed(5)},${(lat - 0.009).toFixed(5)},${(lng + 0.014).toFixed(5)},${(lat + 0.009).toFixed(5)}` : null;
  const embedUrl = bbox && lat !== null && lng !== null ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}` : null;
  const largeMapUrl = lat !== null && lng !== null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}` : null;

  return (
    <PageShell>
      <section className="pt-7 sm:pt-10">
        <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Directions</p>
        <h1 className="mt-2 mb-0 leading-tight">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-3 text-[26px] sm:text-[34px] font-extrabold tracking-tight text-fg no-underline hover:underline underline-offset-4">
            <MapPin size={30} className="text-accent shrink-0 mt-1" aria-hidden />
            <span>{s.address}</span>
          </a>
        </h1>
        <p className="mt-3 mb-0 text-[15px] text-muted leading-relaxed">Tap the address or a button below to open turn-by-turn in your maps app. Then read the truck approach — it matters here.</p>
      </section>

      <section className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <LinkButton href={googleUrl} size="lg" target="_blank" rel="noopener noreferrer">
          <Navigation size={18} aria-hidden /> Open in Google Maps
        </LinkButton>
        <LinkButton href={appleUrl} size="lg" variant="dark" target="_blank" rel="noopener noreferrer">
          <Navigation size={18} aria-hidden /> Open in Apple Maps
        </LinkButton>
      </section>

      {/* Truck approach */}
      <section className="mt-8">
        <SectionTitle>Truck approach</SectionTitle>
        <Panel className="border-l-4 border-l-accent">
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            <Truck size={16} aria-hidden /> Written for trucks, not cars
          </div>
          <p className="mt-2 mb-0 text-[17px] leading-relaxed whitespace-pre-line">{s.truckDirections}</p>
        </Panel>
        <div role="note" className="mt-3 rounded-sm bg-warn-bg border-l-4 border-l-warn px-4 py-3.5">
          <div className="flex items-start gap-3">
            <TriangleAlert size={22} className="text-warn shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-extrabold text-warn text-[15px]">Don&apos;t follow car GPS onto the county roads south of the lot.</div>
              <p className="m-0 mt-1 text-[14px] leading-relaxed text-fg">
                Come in from US-82 every time. The county roads to the south have a low bridge and nowhere to turn a 53&apos; around. If your GPS starts routing you that way, stop and call.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* At the gate */}
      <section className="mt-8">
        <SectionTitle>At the gate</SectionTitle>
        <Panel>
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            <KeyRound size={16} aria-hidden /> Code entry, any hour
          </div>
          <ol className="mt-3 mb-0 pl-5 grid gap-2 text-[15px] leading-relaxed">
            <li>Pull up to the gate. The keypad is at cab height on the driver&apos;s side, so stay in the seat.</li>
            <li>Punch in the gate code from your reservation. It shows on your phone once you&apos;re paid, and works around the clock for every night you booked.</li>
            <li>The gate opens. Pull through and park in any open stall, nose out. Monthly members have their own stall.</li>
            <li>Shower or laundry? The shed code is with your gate codes if you added them (or you&apos;re monthly).</li>
          </ol>
          <Note className="mt-4">
            Code won&apos;t take? Don&apos;t sit at the gate — call{" "}
            <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 font-bold text-fg no-underline">
              <Phone size={14} aria-hidden /> {s.phone}
            </a>
            . She picks up.
          </Note>
        </Panel>
      </section>

      {/* Map */}
      <section className="mt-8">
        <SectionTitle>Map</SectionTitle>
        {embedUrl && largeMapUrl ? (
          <>
            <div className="relative aspect-video overflow-hidden rounded-md border border-line bg-sunk">
              <iframe title={`Map showing ${s.lotName}`} src={embedUrl} className="absolute inset-0 w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
            <p className="mt-2 mb-0 text-[13px] text-muted">
              <a href={largeMapUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-fg">
                View larger map
              </a>{" "}
              · Map by OpenStreetMap. The map is for finding the spot — use the truck approach above for the way in.
            </p>
          </>
        ) : (
          <Note>
            Map pin isn&apos;t set yet. Use the Google Maps or Apple Maps buttons above — they&apos;ll route to the street address — and follow the truck approach for the last few miles.
          </Note>
        )}
      </section>

      <section className="mt-8">
        <Panel className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-[18px] font-extrabold">Headed this way tonight?</div>
            <p className="m-0 mt-1 text-[14.5px] text-muted">
              Reserve before you roll so the spot&apos;s held and the code is ready when you get here.{" "}
              <Link href="/" className="font-semibold text-fg">
                See what&apos;s open
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
