# grandmas-truck-lot.vercel.app — what Vercel deploys

This repository is what the Vercel project **`trucklot`** builds and serves at
https://grandmas-truck-lot.vercel.app. Its `main` branch is the live site.

It is a mirror of the private source repository
**`gavincason1234-create/Grandmas-trucklot-website-`**, refreshed with `pnpm sync:deploy` from there.
Don't edit files here by hand — change the source repo, merge, sync, push.

```bash
# in Grandmas-trucklot-website-, after merging a change
pnpm sync:deploy                                   # copies committed files here
git -C ../https-grandmas-truck-lot.vercel.app push # trucklot redeploys
```

Only git-tracked files are copied, so `.env` files and the vault key can never end up here. The
encrypted safe (`vault/blob.json`) is included and is useless without `VAULT_KEY`, which lives only
in the `trucklot` project's environment variables. Setup steps are in `SETUP.md`.
