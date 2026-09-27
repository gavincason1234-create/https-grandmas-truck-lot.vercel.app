/** Unambiguous alphabet: no 0/O, 1/I. Easy to read off a phone at a gate in the dark. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Cryptographically random booking code. Uses Web Crypto (available in Node 20+ and browsers)
 * rather than node:crypto so this module stays importable from client components.
 * The alphabet has exactly 32 symbols, so masking a byte to 5 bits is an unbiased pick.
 */
export function makeCode(length = 5): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[(bytes[i] ?? 0) & 31];
  return s;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/0/g, "O").replace(/1/g, "I");
}

/** Keep only digits, then format US numbers as (940) 555-0100. Anything else is returned trimmed. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw.trim();
}

export function phoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/** Last four digits of a phone number — used to look a booking up without an account. */
export function phoneLast4(raw: string): string {
  return phoneDigits(raw).slice(-4);
}
