# grandmas-truck-lot.vercel.app — deploy mirror

This repository is an optional public mirror of the site. Vercel currently builds straight from the
private source repository; switch it to this one only if you ever want builds from a public repo.

It is a mirror of the private source repository
**`gavincason1234-create/Grandmas-trucklot-website-`**, refreshed with `pnpm sync:deploy` from there.
Don't edit files here by hand — change the source repo, then sync, then push.

```bash
# in Grandmas-trucklot-website-
git commit -am "…"
pnpm sync:deploy                                   # copies committed files here
git -C ../https-grandmas-truck-lot.vercel.app push
```

Setup steps (Google sign-in, Vercel environment variables, Stripe) are in `SETUP.md`.
The encrypted safe (`vault/blob.json`) is copied too — it is useless without `VAULT_KEY`, which
lives only in Vercel's environment variables.
