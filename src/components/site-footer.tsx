import Link from "next/link";
import { getStore } from "@/lib/store";
import { phoneDigits } from "@/lib/codes";

export async function SiteFooter() {
  const s = await getStore().getSettings();
  const tel = phoneDigits(s.phone);
  return (
    <footer className="mt-16 border-t border-line text-[13.5px] text-muted no-print">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid gap-6 sm:grid-cols-3">
        <div>
          <div className="font-extrabold text-fg text-[15px]">{s.lotName}</div>
          <div className="mt-1 leading-relaxed">{s.address}</div>
          <a href={`tel:${tel}`} className="block mt-2 font-bold text-fg no-underline">
            {s.phone}
          </a>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Link href="/lot" className="inline-flex items-center min-h-12 text-fg no-underline">The lot</Link>
          <Link href="/pricing" className="inline-flex items-center min-h-12 text-fg no-underline">Pricing</Link>
          <Link href="/directions" className="inline-flex items-center min-h-12 text-fg no-underline">Directions</Link>
          <Link href="/reviews" className="inline-flex items-center min-h-12 text-fg no-underline">Reviews</Link>
          <Link href="/find" className="inline-flex items-center min-h-12 text-fg no-underline">Find my booking</Link>
          <Link href="/account" className="inline-flex items-center min-h-12 text-fg no-underline">My account</Link>
        </div>
        <div className="leading-relaxed">
          <p className="m-0">Gate codes work 24 hours. If a code fails, call — don&apos;t sit at the gate.</p>
          <p className="m-0 mt-2">
            <Link href="/login" className="text-fg no-underline">Owner sign-in</Link> · <Link href="/privacy" className="text-fg no-underline">Privacy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
