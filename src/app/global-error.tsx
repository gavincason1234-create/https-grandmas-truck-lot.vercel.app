"use client";

/**
 * Last-resort fallback when the root layout itself fails. The site stylesheet is not loaded here,
 * so the handful of styles ship inline in the brand's day and night colours.
 */
const css = `
:root{--bg:#edeae3;--fg:#23262b;--muted:#6b675e;--faint:#9a958a;--accent:#c8951f;--on-accent:#23262b}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--fg:#e8e4da;--muted:#a9a49a;--faint:#6f6b64;--accent:#e4b33c;--on-accent:#15171a}}
body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh;line-height:1.45}
main{max-width:560px;margin:0 auto;padding:48px 16px}
h1{font-size:28px;margin:0 0 12px;letter-spacing:-.01em;line-height:1.15}
p{margin:0;color:var(--muted);font-size:16px}
button{margin-top:24px;min-height:56px;width:100%;border:0;border-radius:3px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:700;font-size:16px;cursor:pointer}
.ref{margin-top:16px;font-size:12px;color:var(--faint)}
`;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{css}</style>
      </head>
      <body>
        <main>
          <h1>Something went wrong on our end.</h1>
          <p>Give it another try. If you&apos;re at the gate, call the number on the sign — don&apos;t sit there waiting on a website.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
          {error.digest ? <p className="ref">Reference: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
