"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Field, TextArea } from "./ui/field";

type Props = {
  /** Prefilled when the driver is signed in. */
  defaultName?: string;
  /** Prefilled from ?code= after a stay. */
  defaultCode?: string;
};

type ApiOk = { ok: true; approved: boolean };
type ApiFail = { error: string; code: string; field?: string };

const MAX_TEXT = 600;
const STAR_WORDS = ["", "Rough", "Meh", "Fine", "Good", "Great"] as const;

/**
 * Leave-a-review form. Five big star buttons, a couple of fields, one submit.
 * Posts JSON to /api/reviews and shows whatever the server says.
 */
export function ReviewForm({ defaultName = "", defaultCode = "" }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(defaultCode);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [done, setDone] = useState<{ approved: boolean } | null>(null);

  const shown = hover || stars;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (stars < 1) {
      setError({ message: "Tap a star first.", field: "stars" });
      return;
    }
    if (name.trim().length < 2) {
      setError({ message: "Add your name — first name is fine.", field: "name" });
      return;
    }
    if (text.trim().length < 5) {
      setError({ message: "Say a little more — one sentence helps the next driver.", field: "text" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stars,
          name: name.trim(),
          text: text.trim(),
          code: code.trim() ? code.trim().toUpperCase() : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as ApiOk | ApiFail | null;
      if (!res.ok || !data || !("ok" in data) || data.ok !== true) {
        const fail = data && "error" in data ? data : null;
        setError({
          message: fail?.error ?? "Couldn't send that. Try again, or call the lot.",
          field: fail?.field && ["stars", "name", "text", "code"].includes(fail.field) ? fail.field : undefined,
        });
        return;
      }
      setDone({ approved: data.approved });
    } catch {
      setError({ message: "No connection. Try again when you have a signal." });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-sm bg-ok-bg text-ok px-4 py-4 text-[15px] leading-relaxed">
        <div className="font-extrabold text-[17px]">{done.approved ? "Thanks — posted." : "Thanks — the owner will approve it shortly."}</div>
        <p className="m-0 mt-1">
          {done.approved
            ? "Your review is live on this page. Other drivers appreciate it."
            : "Reviews from drivers we can't match to a paid stay get a quick look from the owner first, then go up."}
        </p>
      </div>
    );
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : undefined);

  return (
    <form onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <fieldset className="border-0 p-0 m-0 mb-4 min-w-0">
        <legend className="block text-[13.5px] font-semibold mb-1.5 p-0">Your rating</legend>
        <div className="flex items-center gap-1" role="group" aria-label="Stars, 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={stars === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(0)}
              className={`w-12 h-12 min-w-12 inline-flex items-center justify-center rounded-sm text-[34px] leading-none transition-colors hover:bg-sunk ${
                n <= shown ? "text-accent" : "text-faint"
              }`}
            >
              {n <= shown ? "★" : "☆"}
            </button>
          ))}
          <span className="ml-2 text-[14px] font-semibold text-muted min-w-[3.5rem]" aria-live="polite">
            {shown ? STAR_WORDS[shown] : ""}
          </span>
        </div>
        {fieldError("stars") ? (
          <p role="alert" className="mt-1.5 text-[13px] font-semibold text-warn">
            {fieldError("stars")}
          </p>
        ) : null}
      </fieldset>

      <Field
        id="review-name"
        label="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoComplete="name"
        hint="First name and company is plenty. That's what shows next to your review."
        error={fieldError("name")}
      />

      <Field
        id="review-code"
        label="Booking code"
        optional
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={12}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="[&_input]:uppercase [&_input]:tracking-[0.12em] [&_input]:font-bold"
        hint="The 5-letter code from your reservation. With it, your review posts right away."
        error={fieldError("code")}
      />

      <TextArea
        id="review-text"
        label="What should other drivers know?"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
        maxLength={MAX_TEXT}
        rows={5}
        placeholder="How was the gate, the lot, the shower? Anything to watch for on the way in?"
        hint={`${text.length} / ${MAX_TEXT}`}
        error={fieldError("text")}
      />

      {error && !error.field ? (
        <div role="alert" className="mb-4 rounded-sm bg-warn-bg text-warn px-4 py-3 text-[14px] font-semibold">
          {error.message}
        </div>
      ) : null}

      <Button type="submit" size="lg" busy={busy}>
        Post review
      </Button>
    </form>
  );
}
