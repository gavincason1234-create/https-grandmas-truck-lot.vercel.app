#!/usr/bin/env node
/**
 * pnpm doctor — checks the environment this server will run with and says what's missing, in plain words.
 * Reads .env.local if present (like Next.js does) so it works on your machine too.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decryptJson, isSealedBlob, keyFromHex } from "../vault/crypto.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (existsSync(path.join(ROOT, ".vault.key")) && !process.env.VAULT_KEY) {
  process.env.VAULT_KEY = readFileSync(path.join(ROOT, ".vault.key"), "utf8").trim();
}

const rows = [];
const ok = (name, msg) => rows.push(["OK  ", name, msg]);
const warn = (name, msg) => rows.push(["WARN", name, msg]);
const bad = (name, msg) => rows.push(["MISSING", name, msg]);

const memory = process.env.LOT_STORE === "memory";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (memory) {
  warn("Store", "LOT_STORE=memory — everything lives in this process and vanishes on restart. Fine for development, wrong for the real site.");
} else if (url && anon && service) {
  ok("Store", `Supabase at ${url}`);
} else if (url && anon) {
  bad("SUPABASE_SERVICE_ROLE_KEY", "The server needs this to read/write bookings. Supabase → Project Settings → API → service_role (secret). Never put it in NEXT_PUBLIC_*.");
} else {
  bad("Supabase", "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — the site will fall back to memory mode.");
}

const key = process.env.VAULT_KEY;
const blobPath = path.join(ROOT, "vault", "blob.json");
if (!existsSync(blobPath)) {
  bad("vault/blob.json", "No safe. Run: pnpm vault init you@gmail.com");
} else if (!key) {
  bad("VAULT_KEY", "Not set — the safe can't be opened, so nobody is admin unless ADMIN_EMAILS is set. See vault/README.md.");
} else {
  try {
    const blob = JSON.parse(readFileSync(blobPath, "utf8"));
    if (!isSealedBlob(blob)) throw new Error("blob is not sealed");
    const contents = decryptJson(blob, keyFromHex(key));
    const admins = Array.isArray(contents.admins) ? contents.admins : [];
    if (admins.length) ok("Safe", `opens; admins: ${admins.join(", ")}`);
    else warn("Safe", "opens, but has no admin emails. pnpm vault add-admin you@gmail.com");
  } catch (e) {
    bad("VAULT_KEY", `does not open the safe (${e.message}).`);
  }
}
if (process.env.ADMIN_EMAILS) warn("ADMIN_EMAILS", `fallback admins set: ${process.env.ADMIN_EMAILS}. Prefer keeping admins in the safe.`);

const site = process.env.NEXT_PUBLIC_SITE_URL;
if (!site) warn("NEXT_PUBLIC_SITE_URL", "not set — auth redirects will use VERCEL_URL or localhost. Set it to https://grandmas-truck-lot.vercel.app on Vercel.");
else if (!/^https?:\/\//.test(site)) bad("NEXT_PUBLIC_SITE_URL", `"${site}" must start with https://`);
else ok("Site URL", site);

if (process.env.STRIPE_SECRET_KEY) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) bad("STRIPE_WEBHOOK_SECRET", "Stripe is on but the webhook secret is missing — payments would never be marked paid.");
  else ok("Payments", `Stripe (${process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "LIVE" : "test"} keys)`);
} else {
  warn("Payments", "simulated — no real money moves and a test banner shows. Add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to go live.");
}

const width = Math.max(...rows.map((r) => r[1].length));
for (const [status, name, msg] of rows) console.log(`${status.padEnd(7)} ${name.padEnd(width)}  ${msg}`);
const missing = rows.filter((r) => r[0] === "MISSING").length;
console.log(missing ? `\n${missing} thing(s) to fix before this is the real site.` : "\nAll set.");
process.exit(missing ? 1 : 0);
