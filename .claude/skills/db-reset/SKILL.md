---
name: db-reset
description: Apply or reset the local D1 database for samloc. Use when migrations need applying, the local DB is missing/stale, auth or lobby endpoints fail with SQL errors, or after adding a migration file.
disable-model-invocation: true
---

Local D1 for this repo lives at `apps/web/.wrangler/state` (not Wrangler's default location), because `pnpm dev` runs the Worker through `@cloudflare/vite-plugin` from the web app. Every D1 command must pass `--persist-to ../web/.wrangler/state` when run from `apps/worker`.

`$ARGUMENTS` may be `wipe` to destroy and recreate local state. Default is apply-only.

## Apply migrations (default)

1. Run:
   ```
   pnpm --filter @samloc/worker exec wrangler d1 migrations apply samloc-db --local --persist-to ../web/.wrangler/state
   ```
2. Report which migrations applied, or state that it was already up to date.

## Wipe and recreate (only when `$ARGUMENTS` contains `wipe`)

1. Confirm with the user first — this destroys all local accounts, rooms and match history.
2. Delete the local state directory: `rm -rf apps/web/.wrangler/state`
3. Re-run the apply command above.
4. Tell the user local accounts are gone and they need to re-register in the app.

## Checks

- Migration SQL lives in `apps/worker/migrations/`. If the user just added a file there, confirm the filename follows the existing numbering and uses a domain slug (no phase or plan references).
- If Wrangler reports the database does not exist, that is expected on first run — `--local` creates it.
- If `pnpm dev` is currently running, stop it before a wipe; the running process holds the state directory.
