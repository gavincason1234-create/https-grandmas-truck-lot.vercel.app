import { NextResponse, type NextRequest } from "next/server";
import { DEV_COOKIE } from "@/lib/auth/dev";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", env.siteUrl), { status: 303 });
  if (env.devAuth) {
    res.cookies.set(DEV_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }
  if (env.supabase.url) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  void request;
  return res;
}
