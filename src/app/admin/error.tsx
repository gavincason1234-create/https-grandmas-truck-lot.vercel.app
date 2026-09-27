"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Note } from "@/components/ui/card";

/**
 * Catches anything an owner page or server action throws that the page didn't turn into a
 * ?error= notice (a database hiccup, a network failure talking to Stripe). Renders inside the
 * admin layout, so the tabs stay usable and the owner can hop to another screen.
 */
export default function AdminErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pt-6 max-w-xl">
      <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Hit a bump</p>
      <h1 className="mb-3 mt-2 text-[28px] font-extrabold leading-tight tracking-tight">That didn&apos;t go through.</h1>
      <p className="m-0 text-[16px] leading-relaxed text-muted">Nothing was changed. Try it once more — if it keeps failing, the log will show what did go through.</p>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <Button type="button" size="lg" onClick={reset}>
          <RotateCw size={18} aria-hidden /> Try again
        </Button>
        <LinkButton href="/admin" variant="ghost" size="lg">
          Back to Tonight
        </LinkButton>
      </div>

      <Note className="mt-5">If a payment or refund was involved, check the Stripe dashboard before doing it a second time.</Note>

      {error.digest ? <p className="num mt-4 text-[12px] text-faint">Reference: {error.digest}</p> : null}
    </div>
  );
}
