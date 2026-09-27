import "server-only";
import { decryptJson, isSealedBlob, keyFromHex } from "../../../vault/crypto.mjs";
import blob from "../../../vault/blob.json";

/**
 * The safe, opened once per server process.
 * Everything in here is server-only: this module can never be imported by client components.
 */

export type VaultContents = {
  admins: string[];
  owner: { name: string; email: string; phone: string };
  notes: string;
  [key: string]: unknown;
};

export type VaultStatus =
  | { state: "open"; admins: number; updatedAt: string }
  | { state: "no-key"; reason: string }
  | { state: "locked"; reason: string };

type Cache = { key: string | undefined; contents: VaultContents | null; status: VaultStatus };

let cache: Cache | null = null;

function normalizeEmail(e: unknown): string {
  return String(e ?? "").trim().toLowerCase();
}

function load(): Cache {
  const keyHex = process.env.VAULT_KEY?.trim() || undefined;
  if (cache && cache.key === keyHex) return cache;

  const blobUpdated = (blob as { updatedAt?: string }).updatedAt ?? "";
  if (!keyHex) {
    cache = { key: keyHex, contents: null, status: { state: "no-key", reason: "VAULT_KEY is not set" } };
    return cache;
  }
  if (!isSealedBlob(blob)) {
    cache = { key: keyHex, contents: null, status: { state: "locked", reason: "vault/blob.json is not a sealed safe" } };
    return cache;
  }
  try {
    const raw = decryptJson(blob as Parameters<typeof decryptJson>[0], keyFromHex(keyHex)) as Partial<VaultContents>;
    const contents: VaultContents = {
      ...raw,
      admins: Array.isArray(raw.admins) ? raw.admins.map(normalizeEmail).filter(Boolean) : [],
      owner: { name: "", email: "", phone: "", ...(raw.owner ?? {}) },
      notes: typeof raw.notes === "string" ? raw.notes : "",
    };
    cache = { key: keyHex, contents, status: { state: "open", admins: contents.admins.length, updatedAt: blobUpdated } };
  } catch (err) {
    cache = { key: keyHex, contents: null, status: { state: "locked", reason: err instanceof Error ? err.message : String(err) } };
  }
  return cache;
}

/** Decrypted contents, or null when the safe can't be opened. */
export function getVault(): VaultContents | null {
  return load().contents;
}

export function vaultStatus(): VaultStatus {
  return load().status;
}

/**
 * Admin allowlist = emails inside the safe ∪ ADMIN_EMAILS env (emergency fallback).
 * Always lowercase.
 */
export function getAdminEmails(): string[] {
  const fromVault = load().contents?.admins ?? [];
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set([...fromVault, ...fromEnv])];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(normalizeEmail(email));
}

/** Test hook: forget the cached contents so a new VAULT_KEY is picked up. */
export function _resetVaultCache(): void {
  cache = null;
}
