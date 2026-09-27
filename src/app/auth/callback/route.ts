import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, syncProfileRole } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/next";

/** Google sends the driver back here. Trade the code for a session, then send them on. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription)}`, env.siteUrl));
  }
  if (!code) return NextResponse.redirect(new URL("/login?error=Missing+sign-in+code", env.siteUrl));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, env.siteUrl));
  }

  const user = await getSessionUser();
  if (user) {
    await syncProfileRole(user);
    // Owners go straight to the dashboard unless they asked for somewhere specific.
    if (user.isAdmin && next === "/account") return NextResponse.redirect(new URL("/admin", env.siteUrl));
  }
  return NextResponse.redirect(new URL(next, env.siteUrl));
}
