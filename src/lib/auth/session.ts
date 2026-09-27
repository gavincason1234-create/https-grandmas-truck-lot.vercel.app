import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "../env";
import { getStore } from "../store";
import { createSupabaseServerClient } from "../supabase/server";
import type { SessionUser } from "../types";
import { isAdminEmail } from "../vault";
import { DEV_COOKIE, DEV_USERS, decodeDevUser } from "./dev";

/**
 * Who is looking at this page? null when nobody is signed in.
 * Admin status comes from the safe (vault), never from anything the browser sends.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (env.devAuth) {
    const store = await cookies();
    const u = decodeDevUser(store.get(DEV_COOKIE)?.value);
    if (!u) return null;
    // In memory mode the pretend admin is always an admin, plus whoever the safe/ADMIN_EMAILS names.
    const isAdmin = u.email === DEV_USERS.admin.email || isAdminEmail(u.email);
    return { id: u.id, email: u.email, name: u.name, avatarUrl: null, isAdmin };
  }

  if (!env.supabase.url || !env.supabase.anonKey) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;
  const email = (user.email ?? "").toLowerCase();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? meta.name ?? email.split("@")[0] ?? "");
  const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  return { id: user.id, email, name, avatarUrl, isAdmin: isAdminEmail(email) };
}

/**
 * Keep the profile row in step with the allowlist so the role shows correctly in the database too.
 * Cheap and idempotent; called after sign-in.
 */
export async function syncProfileRole(user: SessionUser): Promise<void> {
  try {
    const store = getStore();
    const existing = await store.getProfile(user.id);
    const role = user.isAdmin ? "admin" : "driver";
    if (!existing || existing.role !== role || existing.email !== user.email) {
      await store.upsertProfile({ id: user.id, email: user.email, fullName: existing?.fullName || user.name, role });
    }
  } catch (err) {
    console.error("profile sync failed", err);
  }
}

function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** For pages: send anonymous visitors to sign in, then back. */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginUrl(next));
  return user;
}

/** For pages: only the accounts in the safe get through. Others see the "not an owner" page. */
export async function requireAdmin(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginUrl(next));
  if (!user.isAdmin) redirect("/account?denied=admin");
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** For route handlers: throw instead of redirect. */
export async function requireAdminApi(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Sign in first", 401);
  if (!user.isAdmin) throw new AuthError("This account is not an owner account", 403);
  return user;
}

export async function requireUserApi(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Sign in first", 401);
  return user;
}
