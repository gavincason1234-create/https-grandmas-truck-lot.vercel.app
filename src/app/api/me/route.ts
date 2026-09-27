import { handler, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — who is signed in, for client components that need to know.
 * Never cached and never touches the store. Returns only what the browser already knows
 * about its own user (name, email, owner or not) — no ids, no codes.
 */
export const GET = handler(async () => {
  const user = await getSessionUser();
  return json({ user: user ? { name: user.name, email: user.email, isAdmin: user.isAdmin } : null });
});
