#!/usr/bin/env node
/**
 * pnpm vault <command>
 * Manage the encrypted safe at vault/blob.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { decryptJson, encryptJson, generateKeyHex, isSealedBlob, keyFromHex } from "../vault/crypto.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOB_PATH = path.join(ROOT, "vault", "blob.json");
const KEY_FILE = path.join(ROOT, ".vault.key");

const DEFAULT_CONTENTS = {
  admins: [],
  owner: { name: "", email: "", phone: "" },
  notes: "",
};

const [, , cmd = "help", ...rest] = process.argv;

function die(msg, code = 1) {
  console.error(`vault: ${msg}`);
  process.exit(code);
}

function loadKey() {
  const fromEnv = process.env.VAULT_KEY;
  if (fromEnv && fromEnv.trim()) return keyFromHex(fromEnv);
  if (existsSync(KEY_FILE)) return keyFromHex(readFileSync(KEY_FILE, "utf8"));
  // .env.local is the usual place during local development
  const envLocal = path.join(ROOT, ".env.local");
  if (existsSync(envLocal)) {
    const m = readFileSync(envLocal, "utf8").match(/^\s*VAULT_KEY\s*=\s*["']?([0-9a-fA-F]{64})["']?\s*$/m);
    if (m) return keyFromHex(m[1]);
  }
  die("no key found. Set VAULT_KEY, put it in .env.local, or write it to .vault.key (git-ignored).");
}

function readBlob() {
  if (!existsSync(BLOB_PATH)) die(`no safe at ${path.relative(ROOT, BLOB_PATH)}. Run: pnpm vault init`);
  const blob = JSON.parse(readFileSync(BLOB_PATH, "utf8"));
  if (!isSealedBlob(blob)) die("vault/blob.json is not a sealed safe");
  return blob;
}

function open(key = loadKey()) {
  return { key, contents: decryptJson(readBlob(), key) };
}

function seal(contents, key) {
  writeFileSync(BLOB_PATH, JSON.stringify(encryptJson(contents, key), null, 2) + "\n");
}

function getPath(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, dotted, value) {
  const keys = dotted.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (typeof o[k] !== "object" || o[k] === null) o[k] = {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

function unsetPath(obj, dotted) {
  const keys = dotted.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (typeof o?.[k] !== "object" || o[k] === null) return;
    o = o[k];
  }
  delete o[keys[keys.length - 1]];
}

function parseValue(raw) {
  if (raw === undefined) die("missing value");
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normEmail(e) {
  const s = String(e ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) die(`"${e}" is not an email address`);
  return s;
}

switch (cmd) {
  case "keygen": {
    console.log(generateKeyHex());
    break;
  }
  case "init": {
    const force = rest.includes("--force");
    if (existsSync(BLOB_PATH) && !force) die("a safe already exists. Use --force to replace it (this destroys the old contents).");
    const key = loadKey();
    const admins = rest.filter((a) => a.includes("@")).map(normEmail);
    seal({ ...DEFAULT_CONTENTS, admins }, key);
    console.log(`sealed a new safe at vault/blob.json with ${admins.length} admin(s)`);
    break;
  }
  case "show": {
    const { contents } = open();
    console.log(JSON.stringify(contents, null, 2));
    break;
  }
  case "export": {
    const { contents } = open();
    process.stdout.write(JSON.stringify(contents, null, 2) + "\n");
    break;
  }
  case "import": {
    const file = rest[0];
    if (!file) die("usage: pnpm vault import <file.json>");
    const key = loadKey();
    const contents = JSON.parse(readFileSync(path.resolve(file), "utf8"));
    if (isSealedBlob(contents)) die("that file is already sealed; copy it to vault/blob.json instead");
    seal(contents, key);
    console.log("imported and sealed");
    break;
  }
  case "get": {
    const { contents } = open();
    const v = rest[0] ? getPath(contents, rest[0]) : contents;
    console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
    break;
  }
  case "set": {
    const [p, raw] = rest;
    if (!p) die("usage: pnpm vault set <path> <value>");
    const { key, contents } = open();
    setPath(contents, p, parseValue(raw));
    seal(contents, key);
    console.log(`set ${p}`);
    break;
  }
  case "unset": {
    const [p] = rest;
    if (!p) die("usage: pnpm vault unset <path>");
    const { key, contents } = open();
    unsetPath(contents, p);
    seal(contents, key);
    console.log(`removed ${p}`);
    break;
  }
  case "admins": {
    const { contents } = open();
    const admins = Array.isArray(contents.admins) ? contents.admins : [];
    if (!admins.length) console.log("(no admins in the safe)");
    for (const a of admins) console.log(a);
    break;
  }
  case "add-admin": {
    const email = normEmail(rest[0]);
    const { key, contents } = open();
    const admins = new Set((Array.isArray(contents.admins) ? contents.admins : []).map((a) => String(a).toLowerCase()));
    admins.add(email);
    contents.admins = [...admins];
    seal(contents, key);
    console.log(`${email} is now an admin (${contents.admins.length} total)`);
    break;
  }
  case "remove-admin": {
    const email = normEmail(rest[0]);
    const { key, contents } = open();
    const before = Array.isArray(contents.admins) ? contents.admins : [];
    contents.admins = before.filter((a) => String(a).toLowerCase() !== email);
    if (contents.admins.length === before.length) die(`${email} was not an admin`);
    seal(contents, key);
    console.log(`${email} removed (${contents.admins.length} left)`);
    break;
  }
  case "rotate": {
    const { contents } = open();
    const newKey = generateKeyHex();
    seal(contents, keyFromHex(newKey));
    console.log("re-sealed with a new key. Update VAULT_KEY everywhere (Vercel + your machine) to:");
    console.log(newKey);
    break;
  }
  case "check": {
    // exits 0 when the safe opens with the configured key
    const { contents } = open();
    const n = Array.isArray(contents.admins) ? contents.admins.length : 0;
    console.log(`safe opens. ${n} admin(s).`);
    break;
  }
  case "help":
  default: {
    console.log(`pnpm vault <command>

  keygen                    print a fresh 64-hex key
  init [emails...] [--force] seal a new safe (optionally with admin emails)
  show | export             print decrypted contents
  import <file.json>        seal the contents of a plain JSON file
  get [path]                read one value (dotted path, e.g. owner.phone)
  set <path> <value>        write one value (JSON or string)
  unset <path>              remove a value
  admins                    list admin emails
  add-admin <email>         grant admin access
  remove-admin <email>      revoke admin access
  rotate                    re-seal with a brand-new key
  check                     verify the configured key opens the safe

The key comes from VAULT_KEY, .env.local, or .vault.key (in that order).`);
  }
}
