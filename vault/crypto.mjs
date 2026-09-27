/**
 * The safe's lock. AES-256-GCM with a random 96-bit nonce per write.
 * Plain JavaScript so both the CLI (scripts/vault.mjs) and the app (src/lib/vault) share one implementation.
 *
 * Blob format (what gets committed to git):
 *   { v: 1, alg: "aes-256-gcm", iv: <base64>, tag: <base64>, data: <base64>, updatedAt: <ISO> }
 *
 * Without the 256-bit key the blob is just noise — that is what makes it safe to keep in the repo.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const VAULT_ALG = "aes-256-gcm";
export const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;

/** @returns {string} a fresh 64-hex-character key */
export function generateKeyHex() {
  return randomBytes(32).toString("hex");
}

/**
 * @param {string | undefined | null} hex
 * @returns {Buffer}
 */
export function keyFromHex(hex) {
  const s = String(hex ?? "").trim();
  if (!KEY_HEX_RE.test(s)) {
    throw new Error("VAULT_KEY must be exactly 64 hex characters (32 bytes). Generate one with: pnpm vault keygen");
  }
  return Buffer.from(s, "hex");
}

/**
 * @param {unknown} value  any JSON-serialisable value
 * @param {Buffer} key
 * @param {Date} [now]
 * @returns {{v:1, alg:string, iv:string, tag:string, data:string, updatedAt:string}}
 */
export function encryptJson(value, key, now = new Date()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(VAULT_ALG, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: VAULT_ALG,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: data.toString("base64"),
    updatedAt: now.toISOString(),
  };
}

/**
 * @param {{v:number, alg:string, iv:string, tag:string, data:string}} blob
 * @param {Buffer} key
 * @returns {unknown}
 */
export function decryptJson(blob, key) {
  if (!blob || blob.v !== 1 || blob.alg !== VAULT_ALG) {
    throw new Error("Unrecognised vault format");
  }
  const decipher = createDecipheriv(VAULT_ALG, key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
  } catch {
    throw new Error("Wrong VAULT_KEY — the safe did not open");
  }
  return JSON.parse(plaintext.toString("utf8"));
}

/** @returns {boolean} true when the object looks like a sealed blob (not plaintext) */
export function isSealedBlob(obj) {
  return !!obj && typeof obj === "object" && obj.v === 1 && obj.alg === VAULT_ALG && typeof obj.data === "string";
}
