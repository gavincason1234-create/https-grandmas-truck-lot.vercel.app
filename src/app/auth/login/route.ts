import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/auth/next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** GET /auth/login?next=/admin — begins Google sign-in through Supabase. */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (env.devAuth || !env.supabase.url) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, env.siteUrl));
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "online", prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error?.message ?? "Could not start sign-in")}`, env.siteUrl));
  }
  return NextResponse.redirect(data.url);
}
