#!/usr/bin/env bash
# Copy this repo's COMMITTED files into the deploy repo (the one Vercel is connected to) and commit there.
# Only files git tracks are copied, so .env files, .vault.key and node_modules can never travel.
# Usage: pnpm sync:deploy [path-to-deploy-repo] [branch]
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$SRC/../https-grandmas-truck-lot.vercel.app}"
BRANCH="${2:-}"

if [ ! -d "$DEST/.git" ]; then
  echo "deploy repo not found at $DEST (clone gavincason1234-create/https-grandmas-truck-lot.vercel.app there first)" >&2
  exit 1
fi
if [ -n "$(git -C "$SRC" status --porcelain)" ]; then
  echo "commit your changes in $SRC first — only committed files are synced" >&2
  exit 1
fi

if [ -n "$BRANCH" ]; then git -C "$DEST" checkout -q -B "$BRANCH"; fi

# 1. Remove everything in the deploy repo except its .git, so deleted files disappear too.
find "$DEST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

# 2. Export the source repo's tracked files at HEAD into it.
git -C "$SRC" archive --format=tar HEAD | tar -x -C "$DEST"

git -C "$DEST" add -A
if git -C "$DEST" diff --cached --quiet; then
  echo "deploy repo already up to date"
else
  git -C "$DEST" commit -q -m "Sync from Grandmas-trucklot-website- $(git -C "$SRC" rev-parse --short HEAD)"
  echo "committed sync in $DEST — now: git -C $DEST push"
fi
