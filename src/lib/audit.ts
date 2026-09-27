import "server-only";
import { getStore } from "./store";
import type { SessionUser } from "./types";

/** Record who did what in the owner dashboard. Failures never break the action itself. */
export async function audit(actor: SessionUser | string, action: string, target = "", meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await getStore().appendAudit({ actor: typeof actor === "string" ? actor : actor.email, action, target, meta });
  } catch (err) {
    console.error("audit failed", err);
  }
}
