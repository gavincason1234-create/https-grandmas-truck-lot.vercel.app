# The safe

This folder is the site's safe: account information that must not be readable by
anyone who happens to see the code, but that the server needs at runtime.

- `blob.json` — the sealed safe. Committed to git. Encrypted with AES-256-GCM.
  Without the key it is random noise, so it is fine for this file to live in the repo.
- `crypto.mjs` — the lock (encrypt/decrypt). Shared by the app and the CLI.
- `vault.local.json` — a decrypted working copy, **never committed** (git-ignored).
- `.vault.key` (repo root) — an optional local copy of the key, **never committed**.

## What lives inside

```json
{
  "admins": ["gavincason1234@gmail.com"],
  "owner":  { "name": "", "email": "", "phone": "" },
  "notes":  "free text — anything the family needs to remember about the accounts"
}
```

`admins` is the list of Google accounts that get the owner dashboard when they sign in.
Anyone else who signs in with Google is a regular driver.

## The key

The key is 64 hex characters. It lives in **one** place per environment:

- On Vercel: Project → Settings → Environment Variables → `VAULT_KEY`
- On your computer: a `.vault.key` file in the repo root, or `VAULT_KEY` in `.env.local`

Lose the key and the safe cannot be opened. Keep a copy somewhere safe offline
(a password manager). You can always re-seal a new safe with `pnpm vault init --force`.

## Everyday commands

```bash
pnpm vault keygen                      # print a new key (do this once)
pnpm vault init                        # seal a fresh safe with default contents
pnpm vault show                        # print the decrypted contents
pnpm vault admins                      # list admin emails
pnpm vault add-admin grandma@gmail.com # give an account admin access
pnpm vault remove-admin someone@x.com
pnpm vault set owner.phone "(940) 555-0100"
pnpm vault set notes "Gate company is ABC Fence, 940-555-0199"
pnpm vault unset notes
pnpm vault rotate                      # re-seal with a brand-new key (prints it)
pnpm vault export > vault/vault.local.json
pnpm vault import vault/vault.local.json
```

If the server can't open the safe (missing or wrong key) the site still runs, but
the admin list falls back to the `ADMIN_EMAILS` environment variable and the
dashboard shows a "safe is locked" warning to whoever is signed in as admin.
