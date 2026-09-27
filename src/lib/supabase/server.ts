import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";

/**
 * Per-request Supabase client bound to the visitor's auth cookies.
 * Used only for auth (who is signed in) — data access goes through the store with the service role.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. The middleware refreshes them instead.
        }
      },
    },
  });
}
