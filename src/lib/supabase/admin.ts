import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let client: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS. Never import from anything that ships to the browser. */
export function createAdminClient(): SupabaseClient {
  if (client) return client;
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
