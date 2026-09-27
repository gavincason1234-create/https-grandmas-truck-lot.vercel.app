import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LinkButton } from "@/components/ui/button";
import { Note, Panel } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/auth/next";

export const metadata: Metadata = { title: "Sign in" };

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getSessionUser();
  if (user) redirect(user.isAdmin && next === "/account" ? "/admin" : next);

  return (
    <PageShell callBar={false} width="max-w-xl">
      <div className="pt-8">
        <h1 className="text-[28px] font-extrabold tracking-tight m-0">Sign in</h1>
        <p className="text-muted mt-2 mb-6 leading-relaxed">
          One tap with the Google account on your phone. Drivers see their bookings and gate codes; the owner gets the dashboard.
          You never need an account just to reserve a spot.
        </p>

        {sp.error ? (
          <div role="alert" className="mb-4 rounded-sm bg-warn-bg text-warn px-4 py-3 text-[14px] font-semibold">
            {sp.error}
          </div>
        ) : null}

        <Panel>
          {env.devAuth ? (
            <div>
              <div className="text-[13px] font-bold text-muted mb-3">Offline mode — pretend sign-in</div>
              <form method="post" action="/auth/dev" className="grid gap-2">
                <input type="hidden" name="next" value={next} />
                <button name="as" value="driver" className="min-h-14 rounded-sm border border-line bg-elev font-bold text-[16px] hover:bg-sunk">
                  Sign in as a test driver
                </button>
                <button name="as" value="admin" className="min-h-14 rounded-sm bg-asphalt text-dust font-bold text-[16px] hover:bg-asphalt-soft inline-flex items-center justify-center gap-2">
                  <ShieldCheck size={18} aria-hidden /> Sign in as the owner
                </button>
              </form>
              <Note className="mt-4">This site is running without a database (LOT_STORE=memory), so Google sign-in is replaced by these buttons. Nothing here is real.</Note>
            </div>
          ) : (
            <div>
              <LinkButton href={`/auth/login?next=${encodeURIComponent(next)}`} variant="dark" size="lg">
                <GoogleMark /> Continue with Google
              </LinkButton>
              <p className="text-[12.5px] text-muted mt-4 mb-0 leading-relaxed">
                We only see your name and email. No passwords to remember. Owner accounts are a fixed list — signing in with any other Google account gives a regular driver account.
              </p>
            </div>
          )}
        </Panel>

        <Note className="mt-5">
          Just need tonight? <a href="/book" className="font-bold text-fg">Reserve without signing in</a> — you&apos;ll get a code you can look up later with your phone number.
        </Note>
      </div>
    </PageShell>
  );
}
