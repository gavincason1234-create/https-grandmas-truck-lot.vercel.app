import { NextResponse, type NextRequest } from "next/server";
import { DEV_COOKIE, DEV_USERS, encodeDevUser } from "@/lib/auth/dev";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/auth/next";

/**
 * POST /auth/dev  { as: "driver" | "admin", next?: string }
 * Pretend sign-in for local development and tests. Does not exist in production.
 */
export async function POST(request: NextRequest) {
  if (!env.devAuth) return NextResponse.json({ error: "not available" }, { status: 404 });
  const form = await request.formData();
  const as = form.get("as") === "admin" ? "admin" : "driver";
  const asked = safeNext(String(form.get("next") ?? ""));
  // Owners go straight to the dashboard unless they asked for somewhere specific (same rule as /auth/callback).
  const next = as === "admin" && asked === "/account" ? "/admin" : asked;
  const res = NextResponse.redirect(new URL(next, env.siteUrl), { status: 303 });
  res.cookies.set(DEV_COOKIE, encodeDevUser(DEV_USERS[as]), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  return res;
}
