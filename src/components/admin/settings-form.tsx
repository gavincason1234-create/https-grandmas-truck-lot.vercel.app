"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Note, Panel, SectionTitle } from "@/components/ui/card";
import { Check, Field, Row2, TextArea } from "@/components/ui/field";
import { centsToDollarString } from "@/lib/money";
import type { LotSettings } from "@/lib/types";

type Props = {
  settings: LotSettings;
  /** The saveSettings server action. */
  action: (formData: FormData) => Promise<void>;
};

type OverheadRow = { key: number; name: string; amount: string };
type PhotoRow = { key: number; src: string; caption: string };

const MAX_PHOTOS = 6;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" busy={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}

/**
 * The owner's settings, one long form. Fixed fields are plain inputs the browser remembers;
 * the two lists (expenses, photos) are the only stateful part. Everything posts to the server action.
 */
export function SettingsForm({ settings, action }: Props) {
  const nextKey = useRef(1000);
  const fresh = () => nextKey.current++;

  const [overhead, setOverhead] = useState<OverheadRow[]>(() => settings.overhead.map((o, i) => ({ key: i, name: o.name, amount: centsToDollarString(o.amountCents) })));
  const [photos, setPhotos] = useState<PhotoRow[]>(() => settings.photos.slice(0, MAX_PHOTOS).map((p, i) => ({ key: i, src: p.src, caption: p.caption })));

  function updateOverhead(key: number, patch: Partial<OverheadRow>) {
    setOverhead((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function updatePhoto(key: number, patch: Partial<PhotoRow>) {
    setPhotos((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <form action={action} className="grid gap-5">
      <Panel>
        <SectionTitle>The lot</SectionTitle>
        <Field id="s-lotName" label="Lot name" name="lotName" defaultValue={settings.lotName} required maxLength={80} autoComplete="off" />
        <Field id="s-address" label="Address" name="address" defaultValue={settings.address} maxLength={200} autoComplete="off" hint="Shown in the header, on the directions page and in the map link." />
        <Row2>
          <Field id="s-phone" label="Phone" name="phone" type="tel" inputMode="tel" defaultValue={settings.phone} required maxLength={30} autoComplete="off" />
          <Field id="s-smsPhone" label="Text number" name="smsPhone" type="tel" inputMode="tel" defaultValue={settings.smsPhone} maxLength={30} optional autoComplete="off" hint="Leave blank to use the phone number." />
        </Row2>
        <Row2>
          <Field id="s-spots" label="Spots" name="spots" type="number" inputMode="numeric" min={1} max={60} step={1} defaultValue={settings.spots} required hint="1 to 60. This is how many trucks can book a night." />
          <Field id="s-maxLengthFt" label="Max trailer length (feet)" name="maxLengthFt" type="number" inputMode="numeric" min={20} max={150} step={1} defaultValue={settings.maxLengthFt} required />
        </Row2>
      </Panel>

      <Panel>
        <SectionTitle>Prices</SectionTitle>
        <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">In dollars. Type 10 or 12.50 — no need for the dollar sign.</p>
        <Row2>
          <Field id="s-nightly" label="Per night ($)" name="nightly" inputMode="decimal" defaultValue={centsToDollarString(settings.nightlyCents)} required autoComplete="off" />
          <Field id="s-monthly" label="Per month ($)" name="monthly" inputMode="decimal" defaultValue={centsToDollarString(settings.monthlyCents)} required autoComplete="off" />
        </Row2>
        <Row2>
          <Field id="s-shower" label="Shower ($)" name="shower" inputMode="decimal" defaultValue={centsToDollarString(settings.showerCents)} required autoComplete="off" />
          <Field id="s-laundry" label="Laundry, per load ($)" name="laundry" inputMode="decimal" defaultValue={centsToDollarString(settings.laundryCents)} required autoComplete="off" />
        </Row2>
        <Check id="s-nightlyExtras" name="nightlyExtras" defaultChecked={settings.nightlyExtras} label="Let nightly guests buy a shower or laundry (monthly members always get both)" />
      </Panel>

      <Panel>
        <SectionTitle>What drivers see about security</SectionTitle>
        <p className="m-0 mb-2 text-[13.5px] text-muted leading-relaxed">Only tick what is true. Drivers plan around it.</p>
        <Check id="s-lit" name="lit" defaultChecked={settings.security.lit} label="Lit at night" />
        <Check id="s-gated" name="gated" defaultChecked={settings.security.gated} label="Gated with a code" />
        <Check id="s-fenced" name="fenced" defaultChecked={settings.security.fenced} label="Fenced all the way around" />
        <Check id="s-cameras" name="cameras" defaultChecked={settings.security.cameras} label="Cameras" />
      </Panel>

      <Panel>
        <SectionTitle>Directions for trucks</SectionTitle>
        <TextArea
          id="s-truckDirections"
          label="How a truck should come in"
          name="truckDirections"
          rows={5}
          maxLength={3000}
          defaultValue={settings.truckDirections}
          hint="Written for a driver, not a car GPS: which exit, which roads to avoid, low bridges, where the gate is."
        />
      </Panel>

      <Panel>
        <SectionTitle>Map pin</SectionTitle>
        <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">Optional. In Google Maps, press and hold on the gate — the two numbers that appear are the latitude and longitude. Leave both blank to use the address only.</p>
        <Row2>
          <Field id="s-lat" label="Latitude" name="lat" inputMode="decimal" defaultValue={settings.lat ?? ""} optional autoComplete="off" placeholder="33.6259" />
          <Field id="s-lng" label="Longitude" name="lng" inputMode="decimal" defaultValue={settings.lng ?? ""} optional autoComplete="off" placeholder="-97.2211" />
        </Row2>
      </Panel>

      <Panel>
        <SectionTitle right={<span className="text-[12.5px] text-muted">{photos.length} of {MAX_PHOTOS}</span>}>Photos</SectionTitle>
        <Note className="mb-4">
          Paste a link to a photo. Upload it to Google Photos or Google Drive first, turn on &quot;anyone with the link&quot;, and paste that link here. Leave the link blank and the site shows a placeholder with just the caption.
        </Note>
        <div className="grid gap-3">
          {photos.map((p, i) => (
            <div key={p.key} className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end">
              <div>
                <label htmlFor={`s-photoSrc-${p.key}`} className="block text-[13.5px] font-semibold mb-1.5">
                  Photo {i + 1} link
                </label>
                <input id={`s-photoSrc-${p.key}`} name="photoSrc" type="url" inputMode="url" autoComplete="off" placeholder="https://…" maxLength={600} value={p.src} onChange={(e) => updatePhoto(p.key, { src: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`s-photoCaption-${p.key}`} className="block text-[13.5px] font-semibold mb-1.5">
                  Caption
                </label>
                <input id={`s-photoCaption-${p.key}`} name="photoCaption" type="text" autoComplete="off" placeholder="Entrance from US-82" maxLength={120} value={p.caption} onChange={(e) => updatePhoto(p.key, { caption: e.target.value })} />
              </div>
              <Button type="button" variant="ghost" onClick={() => setPhotos((rows) => rows.filter((r) => r.key !== p.key))} aria-label={`Remove photo ${i + 1}`}>
                <Trash2 size={16} aria-hidden /> Remove
              </Button>
            </div>
          ))}
        </div>
        {photos.length < MAX_PHOTOS ? (
          <Button type="button" variant="ghost" className="mt-4" onClick={() => setPhotos((rows) => [...rows, { key: fresh(), src: "", caption: "" }])}>
            <Plus size={16} aria-hidden /> Add a photo
          </Button>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle>Monthly overhead</SectionTitle>
        <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">What the lot costs you each month. The Money page uses this to work out how many monthly members cover the bills.</p>
        <div className="grid gap-3">
          {overhead.map((o, i) => (
            <div key={o.key} className="grid gap-2 grid-cols-[minmax(0,1fr)_110px] sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`s-overheadName-${o.key}`} className="block text-[13.5px] font-semibold mb-1.5">
                  Expense {i + 1}
                </label>
                <input id={`s-overheadName-${o.key}`} name="overheadName" type="text" autoComplete="off" placeholder="Trash dumpster" maxLength={80} value={o.name} onChange={(e) => updateOverhead(o.key, { name: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`s-overheadAmount-${o.key}`} className="block text-[13.5px] font-semibold mb-1.5">
                  $ a month
                </label>
                <input id={`s-overheadAmount-${o.key}`} name="overheadAmount" type="text" inputMode="decimal" autoComplete="off" placeholder="80" maxLength={12} value={o.amount} onChange={(e) => updateOverhead(o.key, { amount: e.target.value })} />
              </div>
              <Button type="button" variant="ghost" onClick={() => setOverhead((rows) => rows.filter((r) => r.key !== o.key))} aria-label={`Remove expense ${i + 1}`}>
                <Trash2 size={16} aria-hidden /> Remove
              </Button>
            </div>
          ))}
        </div>
        {overhead.length === 0 ? <p className="m-0 mt-2 text-[13.5px] text-muted">No expenses listed. The Money page will treat overhead as zero.</p> : null}
        <Button type="button" variant="ghost" className="mt-4" onClick={() => setOverhead((rows) => [...rows, { key: fresh(), name: "", amount: "" }])}>
          <Plus size={16} aria-hidden /> Add an expense
        </Button>
      </Panel>

      <Panel>
        <SectionTitle>Words</SectionTitle>
        <TextArea id="s-notes" label="Notes drivers see with their gate code" name="notes" rows={4} maxLength={3000} defaultValue={settings.notes} hint="Where the keypads are, where to park, where the porta-potties are." />
        <TextArea id="s-policy" label="Cancellation policy" name="policy" rows={3} maxLength={3000} defaultValue={settings.policy} hint="Shown on the pricing page and before a driver pays." />
      </Panel>

      <Panel>
        <SectionTitle>Test mode</SectionTitle>
        <Check id="s-testMode" name="testMode" defaultChecked={settings.testMode} label="Show the test-mode banner" />
        <p className="m-0 mt-1 text-[13.5px] text-muted leading-relaxed">The amber &quot;Test mode&quot; strip at the top of every page. It always shows while payments are simulated; untick this once real card payments are on and you are done trying things out.</p>
      </Panel>

      <div className="sticky bottom-0 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 bg-bg/95 backdrop-blur border-t border-line sm:border-0">
        <SaveButton />
      </div>
    </form>
  );
}
