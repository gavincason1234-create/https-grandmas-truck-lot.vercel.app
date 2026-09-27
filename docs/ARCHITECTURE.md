# How this app is put together

Next.js 15 (App Router, TypeScript, Tailwind 4) on Vercel. Supabase for Postgres + Google sign-in.
Payments through Stripe when keys are present, simulated otherwise.

```
src/app/                 pages and route handlers (App Router)
src/components/          shared UI (server components unless the file starts with "use client")
src/lib/                 everything that is not UI
  types.ts               domain types — money in CENTS, days as "YYYY-MM-DD"
  defaults.ts            starting settings + withDefaults()
  env.ts                 the only file that reads process.env
  dates.ts pricing.ts availability.ts money.ts codes.ts   pure helpers, unit tested
  store/                 LotStore interface; MemoryStore (dev/tests) and SupabaseStore (prod)
  auth/session.ts        getSessionUser(), requireUser(), requireAdmin(), requireAdminApi()
  auth/next.ts           safeNext() — sanitise ?next= redirects
  vault/                 the safe: isAdminEmail(), getVault(), vaultStatus()   (server-only)
  services/reservations.ts  createReservation(), markPaidByCode(), refundable()
  services/access.ts     codesForBooking()/codesForMember() — the ONLY rule for showing gate codes
  services/sample.ts     loadSampleData()
  payments.ts            Stripe wrapper; paymentsMode() → "stripe" | "simulated"
  api.ts                 handler(), json(), ApiError, errorResponse()
  ratelimit.ts audit.ts
vault/                   blob.json (sealed safe, committed) + crypto.mjs
scripts/vault.mjs        pnpm vault ... CLI
supabase/migrations/     SQL applied to the Supabase project
```

## Rules every page follows

1. **Data goes through `getStore()`** (`@/lib/store`). Never import `@/lib/supabase/*` from a page.
   The store is the same shape in memory mode and Supabase mode; pages don't know which is active.
2. **Who is signed in** comes from `getSessionUser()`. Admin = `user.isAdmin`, which is decided by the
   safe (`isAdminEmail`). Nothing the browser sends can make someone admin.
3. **Admin pages** call `await requireAdmin("/admin/whatever")` at the top of the server component.
   **Admin server actions and API routes** call `await requireAdminApi()` and then `audit(user, "action", target, meta)`.
4. **Gate codes** are only ever shown via `codesForBooking()` / `codesForMember()` + `<CodesPanel>`.
   Public settings (`getSettings()`) never contain codes; they live in `getPrivateSettings()`.
5. **Money** is cents everywhere in code and the database. Format with `money(cents)`. Parse owner input with `parseDollars()`.
6. **Dates** are `YYYY-MM-DD` strings in Central Time. Use `todayStr()`, `addDays()`, `prettyDay()`.
7. **Route handlers** wrap the body in `handler(async (req) => { ... return json(...) })` from `@/lib/api`,
   validate input with zod, and rate-limit public POSTs with `rateLimit(clientIp(req) + ":name", {limit, windowMs})`.
8. **Driver pages** render inside `<PageShell>` (banner, header, footer, sticky call bar).
   Admin pages have their own layout. `PageShell` accepts `callBar={false}` and `width`.
9. **Server components by default.** Add `"use client"` only for forms and interactive bits; keep them small
   and pass server data in as props. Client components never import from `@/lib/store`, `@/lib/vault`,
   `@/lib/auth/session`, `@/lib/payments`, `@/lib/env` (server-only). Pure helpers (`pricing`, `dates`, `money`, `codes`, `availability`) are fine on the client.
10. **Async request APIs**: in Next 15 `params`, `searchParams`, `cookies()`, `headers()` are Promises — `await` them.

## Look and feel

Tokens live in `src/app/globals.css` and are exposed as Tailwind colours: `bg-bg`, `bg-elev`, `bg-sunk`,
`text-fg`, `text-muted`, `text-faint`, `border-line`, `bg-accent`/`text-on-accent` (amber), `text-ok`/`bg-ok-bg`
(green), `text-warn`/`bg-warn-bg` (brick), `bg-header`/`text-header-fg`. Night mode flips them automatically
(`data-theme="dark"` on `<html>`), so **never hard-code white/black backgrounds** — use the tokens.

Trucker-first UI: minimum 48px tap targets (`min-h-12`), 16px inputs, one primary action per screen,
phone numbers always tappable (`tel:`), plain words ("Pulled out", "They're here"), no jargon.

Components: `Button`/`LinkButton` (variants primary, dark, ghost, danger, link; sizes sm/md/lg),
`Card`/`Panel`/`Note`/`Empty`/`SectionTitle`/`GroupName`, `Tag`, `Field`/`TextArea`/`Select`/`Check`/`Row2`,
`Stalls` (the angled stall row), `StayCard`, `CodesPanel`, `CallBar`, `ThemeToggle`. Icons from `lucide-react`.

## Modes

- `LOT_STORE=memory` → in-memory store, pretend sign-in buttons on /login (driver@example.com / admin@example.com).
  Used for `pnpm dev:offline` and the e2e tests. Refused on Vercel production.
- Supabase configured → real store; Google sign-in through Supabase Auth.
- `STRIPE_SECRET_KEY` set → real Stripe Checkout; otherwise a simulated checkout marks stays paid immediately
  and a "Test mode" banner shows.

## Checks

`pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest) · `pnpm build`. E2E tests live in the Cloude-code repo.
