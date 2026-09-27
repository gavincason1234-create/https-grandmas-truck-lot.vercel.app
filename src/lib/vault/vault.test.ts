import { afterEach, describe, expect, it } from "vitest";
import { decryptJson, encryptJson, generateKeyHex, isSealedBlob, keyFromHex } from "../../../vault/crypto.mjs";

describe("vault crypto", () => {
  it("round-trips JSON", () => {
    const key = keyFromHex(generateKeyHex());
    const blob = encryptJson({ admins: ["a@b.com"], n: 1 }, key);
    expect(isSealedBlob(blob)).toBe(true);
    expect(decryptJson(blob, key)).toEqual({ admins: ["a@b.com"], n: 1 });
  });

  it("refuses the wrong key", () => {
    const blob = encryptJson({ secret: true }, keyFromHex(generateKeyHex()));
    expect(() => decryptJson(blob, keyFromHex(generateKeyHex()))).toThrow(/Wrong VAULT_KEY/);
  });

  it("detects tampering", () => {
    const key = keyFromHex(generateKeyHex());
    const blob = encryptJson({ admins: ["a@b.com"] }, key);
    const bytes = Buffer.from(blob.data, "base64");
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() => decryptJson({ ...blob, data: bytes.toString("base64") }, key)).toThrow();
  });

  it("rejects malformed keys", () => {
    expect(() => keyFromHex("abc")).toThrow(/64 hex/);
    expect(() => keyFromHex(undefined)).toThrow();
  });

  it("uses a fresh nonce every time", () => {
    const key = keyFromHex(generateKeyHex());
    const a = encryptJson({ x: 1 }, key);
    const b = encryptJson({ x: 1 }, key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });
});

describe("vault admin allowlist", () => {
  const saved = { VAULT_KEY: process.env.VAULT_KEY, ADMIN_EMAILS: process.env.ADMIN_EMAILS };
  afterEach(() => {
    process.env.VAULT_KEY = saved.VAULT_KEY;
    process.env.ADMIN_EMAILS = saved.ADMIN_EMAILS;
  });

  it("falls back to ADMIN_EMAILS when the safe is locked", async () => {
    process.env.VAULT_KEY = "";
    process.env.ADMIN_EMAILS = "Grandma@Gmail.com, gavin@example.com";
    const v = await import("./index");
    v._resetVaultCache();
    expect(v.vaultStatus().state).toBe("no-key");
    expect(v.isAdminEmail("grandma@gmail.com")).toBe(true);
    expect(v.isAdminEmail("GAVIN@example.com")).toBe(true);
    expect(v.isAdminEmail("stranger@example.com")).toBe(false);
    expect(v.isAdminEmail(null)).toBe(false);
  });

  it("reports a wrong key as locked", async () => {
    process.env.VAULT_KEY = generateKeyHex();
    process.env.ADMIN_EMAILS = "";
    const v = await import("./index");
    v._resetVaultCache();
    expect(v.vaultStatus().state).toBe("locked");
    expect(v.getAdminEmails()).toEqual([]);
  });
});
