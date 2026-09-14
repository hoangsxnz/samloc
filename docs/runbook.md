# Runbook — Sâm Lốc Online

All commands run from the repo root unless noted. `W='pnpm --filter @samloc/worker exec wrangler'`.

## Deploy

```bash
pnpm -r typecheck && pnpm -r test && pnpm build
pnpm run deploy                     # = pnpm build + wrangler deploy --config apps/web/dist/samloc/wrangler.json
```
The printed `https://samloc.<account>.workers.dev` URL is the app. `wrangler deploy` uploads
`apps/web/dist/client` as static assets, the Worker bundle, and the `RoomDO` migration.

## Rollback

```bash
$W deployments list
$W rollback                     # restores the previous Worker version; D1 schema is additive, no DB change needed
```

## Apply a D1 migration

```bash
$W d1 migrations create samloc-db <name>     # writes apps/worker/migrations/000N_<name>.sql
$W d1 migrations apply samloc-db --local --persist-to ../web/.wrangler/state   # local dev
$W d1 migrations apply samloc-db --remote                                       # production
```

## Read production data

```bash
$W d1 execute samloc-db --remote --command "SELECT username, display_name, created_at FROM users ORDER BY created_at DESC LIMIT 20"
$W d1 execute samloc-db --remote --command "SELECT * FROM hand_results ORDER BY created_at DESC LIMIT 20"
$W d1 execute samloc-db --remote --command "SELECT code, host_user_id, closed_at FROM room_sessions WHERE closed_at IS NULL"
```

## Reset a stuck room

A room lives in one Durable Object keyed by its code. Everyone leaving closes it; a room that
nobody is connected to closes itself 60 s after a hand ends. To force-close from the outside, mark
the lobby row closed so nobody can rejoin, and let the object idle:

```bash
$W d1 execute samloc-db --remote --command "UPDATE room_sessions SET closed_at = strftime('%s','now')*1000 WHERE code = 'ABC234'"
```
`/ws/ABC234` then returns 404 and the object receives no more traffic.

## Reset a password

Passwords are PBKDF2-SHA256 (100 000 iterations, 16-byte salt). Generate a new hash and salt with
Node, then update the row:

```bash
node -e '
const c=require("crypto");const salt=c.randomBytes(16);
const hash=c.pbkdf2Sync(process.argv[1],salt,100000,32,"sha256");
console.log(hash.toString("hex"), salt.toString("hex"))' 'mat-khau-moi'
$W d1 execute samloc-db --remote --command "UPDATE users SET password_hash='<hash>', password_salt='<salt>' WHERE username='son'"
$W d1 execute samloc-db --remote --command "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username='son')"
```

## Logs

```bash
$W tail                          # live request and console logs from the deployed Worker
```

## Limits to watch (free plan)

100k Worker requests/day and 100k Durable Object requests/day. WebSocket frames count as requests
only while the object is not hibernated; a 5-player hand is roughly 200 frames. D1 free tier is
sufficient for auth, lobby reads and one `hand_results` row per seat per hand.
