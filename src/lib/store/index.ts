import "server-only";
import { env } from "../env";
import { createAdminClient } from "../supabase/admin";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { LotStore } from "./types";

export type { LotStore } from "./types";
export { NotFoundError, StoreError } from "./types";

const g = globalThis as unknown as { __lotStore?: LotStore };

/**
 * The one store the server uses. Memory in dev/tests, Supabase everywhere else.
 * Kept on globalThis so Next.js hot reloading doesn't create a fresh empty store each save.
 */
export function getStore(): LotStore {
  if (g.__lotStore) return g.__lotStore;
  if (env.storeMode === "memory") {
    g.__lotStore = new MemoryStore();
  } else {
    if (!env.supabase.canWrite) {
      // Fail loudly and early rather than 500 on every request with a confusing message.
      throw new Error(
        "Supabase is configured but SUPABASE_SERVICE_ROLE_KEY is missing. The server needs it to read and write bookings. See SETUP.md.",
      );
    }
    g.__lotStore = new SupabaseStore(createAdminClient());
  }
  return g.__lotStore;
}
