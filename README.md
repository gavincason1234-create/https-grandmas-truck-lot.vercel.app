# Grandma's Truck Lot

The website for a small, gated, lit truck lot off US-82 in Gainesville, Texas.
Drivers reserve a nightly spot or a monthly membership from their phone and get the gate codes.
The owner runs the whole lot from a dashboard: who's coming tonight, who's parked, who owes, monthly members, money, reviews, settings.

**Live site**: https://grandmas-truck-lot.vercel.app

## Pages

| Drivers | Owner (Google sign-in, allow-listed) |
|---|---|
| `/` tonight's availability, price, reserve | `/admin` tonight: expected, parked, coming up, walk-ups |
| `/lot` photos, amenities, rules, how the gate works | `/admin/monthly` members, charges, past due |
| `/pricing` nightly vs monthly | `/admin/money` collected, owed, overhead, break-even |
| `/directions` truck approach, maps links | `/admin/reviews` approve / hide |
| `/reviews` read + leave a review | `/admin/settings` prices, spots, gate codes, photos, words |
| `/book` → `/book/confirmed/CODE` gate codes after payment | `/admin/log` who did what |
| `/find` look a booking up by code + phone | |
| `/account` a signed-in driver's bookings and details | |

## How it's built

Next.js 15 · TypeScript · Tailwind 4 · Supabase (Postgres + Google auth) · Stripe (optional) · Vercel.
Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing code, and [`SETUP.md`](SETUP.md) to deploy.

**The safe.** Owner accounts are listed inside an encrypted file in the repo, `vault/blob.json`
(AES-256-GCM). The key lives only in Vercel's environment variables. `pnpm vault add-admin someone@gmail.com`
changes who gets the dashboard. See [`vault/README.md`](vault/README.md).

## Commands

```bash
pnpm install
pnpm dev            # real database (needs .env.local — see SETUP.md)
pnpm dev:offline    # no database; pretend sign-in; resets on restart
pnpm check          # typecheck + lint + unit tests
pnpm build
pnpm doctor         # explains what's missing from your environment
pnpm vault …        # manage the safe
pnpm sync:deploy    # mirror this repo into the deploy repo Vercel watches
```

End-to-end tests live in the **Cloude-code** repository (Playwright, phone + desktop).

## Repos

- `Grandmas-trucklot-website-` — this repo, the source of truth (private).
- `https-grandmas-truck-lot.vercel.app` — deploy mirror Vercel builds from. Updated with `pnpm sync:deploy`.
- `Cloude-code` — test & build harness.
