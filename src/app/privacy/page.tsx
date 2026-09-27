import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Note, Panel } from "@/components/ui/card";
import { phoneDigits } from "@/lib/codes";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Grandma's Truck Lot keeps about you, why, and who sees it. Short and honest.",
};

export default async function PrivacyPage() {
  const s = await getStore().getSettings();
  const tel = phoneDigits(s.phone);

  return (
    <PageShell callBar={false} width="max-w-2xl">
      <section className="pt-8">
        <h1 className="m-0 text-[30px] font-extrabold tracking-tight">Privacy</h1>
        <p className="mt-2 mb-6 text-[16px] text-muted leading-relaxed">Short version: we keep what we need to hold your spot and reach you. We don&apos;t sell it, and we don&apos;t share it with anyone who isn&apos;t helping run the lot.</p>

        <Panel className="grid gap-5 text-[15px] leading-relaxed">
          <div>
            <h2 className="m-0 text-[17px] font-bold">What we store</h2>
            <ul className="mt-2 mb-0 pl-5 grid gap-1">
              <li>Your name and phone number.</li>
              <li>Your truck and plate, if you gave them, so the owner knows which rig is yours.</li>
              <li>Your company name, if you gave one.</li>
              <li>The dates you booked, what you paid, and your booking code.</li>
              <li>Your email address — only if you signed in with Google. We see your name and email from Google, nothing else.</li>
              <li>Reviews you leave, with the name you put on them.</li>
            </ul>
          </div>

          <div>
            <h2 className="m-0 text-[17px] font-bold">Why</h2>
            <ul className="mt-2 mb-0 pl-5 grid gap-1">
              <li>To hold your spot and know who to expect on the lot.</li>
              <li>To reach you if a gate code fails or something comes up with your truck.</li>
              <li>To show you your own bookings and gate codes when you sign in or look a booking up by phone number.</li>
              <li>To keep the owner&apos;s books straight: who paid, who owes, who parked.</li>
            </ul>
          </div>

          <div>
            <h2 className="m-0 text-[17px] font-bold">Payments</h2>
            <p className="mt-2 mb-0">When card payments are turned on, they&apos;re handled by Stripe. Your card number goes to Stripe, not to us — we never see or store it. We keep a reference to the payment so we can match it to your stay and refund it if the posted policy says so.</p>
          </div>

          <div>
            <h2 className="m-0 text-[17px] font-bold">Who sees it</h2>
            <p className="mt-2 mb-0">The owner and whoever she has helping run the lot. That&apos;s it. We don&apos;t sell your information, rent it, or hand it to advertisers. We share it only if the law requires it.</p>
          </div>

          <div>
            <h2 className="m-0 text-[17px] font-bold">Cookies and your phone</h2>
            <p className="mt-2 mb-0">A sign-in cookie keeps you signed in. Your day/night setting is saved on your own phone. No ad trackers.</p>
          </div>

          <div>
            <h2 className="m-0 text-[17px] font-bold">Want it gone?</h2>
            <p className="mt-2 mb-0">
              Call or text{" "}
              <a href={`tel:${tel}`} className="font-bold text-fg no-underline">
                {s.phone}
              </a>{" "}
              and ask. We&apos;ll remove what we can — payment records may have to stay for tax reasons.
            </p>
          </div>
        </Panel>

        <Note className="mt-5">
          Gate codes are not personal data, but treat them like they are: don&apos;t share yours. Questions about how the site works?{" "}
          <Link href="/lot" className="font-bold text-fg">
            How it works at the gate
          </Link>
          .
        </Note>
      </section>
    </PageShell>
  );
}
