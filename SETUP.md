# Setting up Grandma's Truck Lot

Everything below is a one-time job. Budget an hour. Do the steps in order.

## 0. What's already done

- **Database**: the Supabase project `grandma-truck-lot` (`jxobukpkbefhgyzncrfo`) already has the new tables
  (`profiles`, `lot_settings`, `lot_private_settings`, `bookings`, `members`, `member_payments`, `reviews`, `audit_log`)
  with row-level security. The old `lot_kv` table is still there untouched.
- **The safe**: `vault/blob.json` is sealed and already contains `gavincason1234@gmail.com` as an admin.
  The key was handed to you separately (file `VAULT_KEY.txt`). It is **not** in this repo and must never be.

## 1. Google sign-in (Supabase → Google)

1. Google Cloud Console → https://console.cloud.google.com/apis/credentials → **Create credentials → OAuth client ID**.
   - Application type: **Web application**. Name: `Grandma's Truck Lot`.
   - If asked to configure the consent screen: External, app name "Grandma's Truck Lot", your email as support + developer contact, scopes: none extra. Publish it (or add tester emails while in testing).
   - **Authorized JavaScript origins**: `https://grandmas-truck-lot.vercel.app` (and `http://localhost:3000` for development).
   - **Authorized redirect URIs**: `https://jxobukpkbefhgyzncrfo.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.
2. Supabase dashboard → project `grandma-truck-lot` → **Authentication → Sign In / Providers → Google**:
   turn it **on**, paste Client ID + Client secret, save.
3. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://grandmas-truck-lot.vercel.app`
   - Redirect URLs: add `https://grandmas-truck-lot.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.

Anyone can now sign in with Google. Only the emails inside the safe get the owner dashboard.

## 2. Vercel

1. Two Vercel projects know about this code:
   - **`trucklot`** owns the live address `grandmas-truck-lot.vercel.app` and is connected to the public mirror
     repo `https-grandmas-truck-lot.vercel.app`. **This is production.** Its `main` branch is what drivers see.
   - `grandmas-truck-lot` is connected to this private repo and only builds previews of branches — handy for
     checking a change before it goes out; it serves no public address.

   So a change travels: this repo → merge → `pnpm sync:deploy` → push the mirror → `trucklot` redeploys.
2. **Environment Variables** — on project **`trucklot`** (Production + Preview):

   | Name | Value | Where from |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://jxobukpkbefhgyzncrfo.supabase.co` | already known |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_5CuAJz6KZ5hijwrHnuKs9Q_vFqDn87s` | Supabase → Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` (secret) | Supabase → Settings → API → **service_role** — treat like a password |
   | `VAULT_KEY` | 64 hex characters | `VAULT_KEY.txt` you were given |
   | `NEXT_PUBLIC_SITE_URL` | `https://grandmas-truck-lot.vercel.app` | your domain |

   Optional later: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (see §4),
   `CRON_SECRET` (any long random string; protects the cleanup cron).
3. Merge the mirror repo's pull request (or push to its `main`). `trucklot` redeploys in about a minute.
   Open the site → **Sign in** → pick your Gmail → you land on `/admin`.
4. Preview deployments sit behind Vercel's login wall by default (Deployment Protection). Leave that on; it keeps
   half-configured previews private.
5. Until the environment variables are in place, a production deployment shows a red "not connected to its
   database" bar and refuses reservations rather than losing them — so merging early is safe, just not useful.

## 3. First things in the dashboard

- **Settings** → check the address, phone, number of spots, prices, and **gate codes** (they start as 4471 / 4471 / 8820 — change them to match the keypads).
- **Settings → Test mode** → leave the banner on until real payments are wired (§4).
- Try it as a driver: open the site in a private window, reserve a night, see the codes, then find it on the Tonight tab.

## 4. Real payments (Stripe) — when ready

1. https://dashboard.stripe.com → get **Secret key** (`sk_live_…` or `sk_test_…` to practice).
2. Developers → Webhooks → Add endpoint `https://grandmas-truck-lot.vercel.app/api/webhooks/stripe` with events
   `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`. Copy the **Signing secret**.
3. Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Redeploy.
4. Dashboard → Settings → untick **Test mode**. The banner disappears; drivers now pay through Stripe Checkout.

Without Stripe keys the site runs in simulated mode: bookings are marked paid instantly and the amber test banner shows.

## 5. Adding Grandma (or anyone) as an owner

On your computer, in this repo, with the key in `.vault.key` or `VAULT_KEY`:

```bash
pnpm vault add-admin grandma@gmail.com
git commit -am "Add Grandma as admin" && git push
pnpm sync:deploy && git -C ../https-grandmas-truck-lot.vercel.app push
```

Vercel redeploys; she signs in with that Gmail and gets the dashboard. `pnpm vault remove-admin …` takes it away.

## 6. Running it on your own computer

```bash
pnpm install
cp .env.example .env.local        # fill in SUPABASE_SERVICE_ROLE_KEY and VAULT_KEY
pnpm doctor                       # tells you what's missing, in plain words
pnpm dev                          # http://localhost:3000 against the real database
pnpm dev:offline                  # no database, pretend sign-in buttons, data resets on restart
pnpm check                        # typecheck + lint + unit tests
```

## 7. Tests and builds

The **Cloude-code** repo is the test & build harness (Playwright end-to-end tests that drive the whole site in
offline mode on phone and desktop sizes). See its README. Its GitHub Action needs one secret,
`SITE_REPO_TOKEN` — a fine-grained personal access token with read access to this private repo.

## If something's wrong

- "The safe is locked" banner in the dashboard → `VAULT_KEY` on Vercel is missing or wrong.
- Nobody gets the dashboard → your Gmail isn't in the safe: `pnpm vault admins`. Emergency: set `ADMIN_EMAILS=you@gmail.com` on Vercel.
- Sign-in bounces back with an error → §1 redirect URLs don't match exactly.
- Bookings 500 → `SUPABASE_SERVICE_ROLE_KEY` missing. `pnpm doctor` catches this.
