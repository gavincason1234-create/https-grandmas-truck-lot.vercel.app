# grandmas-truck-lot.vercel.app — deploy mirror

This repository is what **Vercel** builds and deploys to https://grandmas-truck-lot.vercel.app.

It is a mirror of the private source repository
**`gavincason1234-create/Grandmas-trucklot-website-`**, refreshed with `pnpm sync:deploy` from there.
Don't edit files here by hand — change the source repo, then sync, then push.

```bash
# in Grandmas-trucklot-website-
git commit -am "…"
pnpm sync:deploy                                   # copies committed files here
git -C ../https-grandmas-truck-lot.vercel.app push # Vercel redeploys
```

Setup steps (Google sign-in, Vercel environment variables, Stripe) are in `SETUP.md`.
The encrypted safe (`vault/blob.json`) is copied too — it is useless without `VAULT_KEY`, which
lives only in Vercel's environment variables.
