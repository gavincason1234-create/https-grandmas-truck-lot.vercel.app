"use client";

import { useEffect } from "react";
import { Phone, RotateCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Note } from "@/components/ui/card";

/**
 * Catches anything a page throws. There are no settings here on purpose — the store may be the
 * very thing that broke — so the phone hint points at the sign on the gate instead of a number.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Hit a bump</p>
      <h1 className="mb-3 mt-2 text-[30px] font-extrabold leading-tight tracking-tight">Something went wrong on our end.</h1>
      <p className="m-0 text-[16px] leading-relaxed text-muted">It&apos;s not your phone. Give it another try — if it keeps happening, the lot is still open and she still picks up.</p>

      <div className="mt-6 grid gap-2.5">
        <Button type="button" size="lg" onClick={reset}>
          <RotateCw size={18} aria-hidden /> Try again
        </Button>
        <LinkButton href="/" variant="ghost" size="lg">
          Back to tonight&apos;s spots
        </LinkButton>
      </div>

      <Note className="mt-5 flex items-start gap-2">
        <Phone size={16} aria-hidden className="mt-0.5 shrink-0" />
        <span>If you&apos;re at the gate, call the number on the sign. Don&apos;t sit there waiting on a website.</span>
      </Note>

      {error.digest ? <p className="num mt-4 text-[12px] text-faint">Reference: {error.digest}</p> : null}
    </main>
  );
}
