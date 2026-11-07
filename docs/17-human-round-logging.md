# Persistent results from human matches

The browser sends one summary when a human-versus-AI round ends, before the
player confirms the next round. It supports classic and ten-round points mode.
The separate Node 24 API stores accepted records in SQLite. Gameplay stays in the
browser; there is no server-side game simulation or third-party analytics service.

## One-time VPS setup

The existing Caddy static server on loopback port 43187 stays in place. The API
binds only `127.0.0.1:43188`; no additional public listening port is required.

First update the checkout **before invoking the updated deploy script**. An older
script already running keeps its old functions in memory through a git pull:

```sh
cd ~/BronkersWeb
git pull --ff-only
./scripts/deploy --no-pull
sudo ./scripts/install-telemetry-service
curl --fail http://127.0.0.1:43188/api/health
```

The installer creates and starts `bronkers-telemetry.service`. It uses a dedicated
systemd dynamic user and stores the database at `/var/lib/bronkers/rounds.sqlite`.
It does not run as root or the deploy user. Node's built-in SQLite is used; no npm
runtime dependencies, separate database server or SQLite command-line tool are
needed. The pinned Node executable is copied outside the checkout to
`/var/www/bronkers/runtime/node`, where the service can execute it with home
folders hidden. The API code is linked at `/var/www/bronkers/telemetry`.

Replace only the `bronkers.dracon.au` block in `/etc/caddy/Caddyfile` with:

```caddyfile
bronkers.dracon.au {
    handle /api/* {
        reverse_proxy 127.0.0.1:43188
    }
    handle {
        reverse_proxy 127.0.0.1:43187
    }
}
```

Keep the existing `http://:43187` static block and all other sites unchanged.
The same snippet is in `deploy/Caddyfile.logging.example`. Then validate/reload:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo service caddy reload
curl --fail https://bronkers.dracon.au/api/health
curl --fail https://bronkers.dracon.au/api/stats
```

Refresh the game in each tester's browser to load the logging client. Older open
pages from before this feature cannot log rounds retroactively. Play one round,
then check `/api/stats` again. The stats should increase by one; a retry does not
increase them again.

For a non-default deployment root, pass `--root /absolute/path` to both deployment
and the installer. The service installer accepts paths without whitespace or
systemd metacharacters. This service setup targets the existing systemd Ubuntu
VPS; it is not needed on the development machine.

## Updates, rollback and persistence

Future updates are the usual `./scripts/deploy`. It copies the API into each new
release and atomically changes the telemetry link. The running API detects the
new target within two seconds, closes cleanly, and systemd restarts it using the
new code. No privileged restart permission is granted to the deploy user.

The database is outside all release directories and is never replaced by deploy
or rollback. An API rollback follows the corresponding release. Rolling back to
a static release from before logging leaves the most recent API active, so the
existing data can still be read. Do not prune the release targeted by `telemetry`.
The API is briefly unavailable during a restart; clients retain unacknowledged
records and retry.

```sh
sudo systemctl status bronkers-telemetry
sudo journalctl -u bronkers-telemetry -n 50 --no-pager
```

SQLite uses WAL and full synchronous commits. For a filesystem backup, stop the
service before copying its database directory, then start it again. Copying just
the main SQLite file while the service is running can omit WAL data. systemd may
place the actual StateDirectory under `/var/lib/private/bronkers`; use root for
backups and follow the `/var/lib/bronkers` path. JSON exports below are also useful
for analysis, independent of database backups.

## Read endpoints for analysis

Both read endpoints are public. The application stores no player names, accounts,
IP addresses, user agents, card identities, cookies or persistent device IDs.
A fresh random match ID links only the rounds in that match. The API's in-memory
write limiter uses the forwarded address from the loopback reverse proxy, without
saving it in the database. The API must stay bound to loopback behind Caddy.

- `GET /api/health`: service readiness.
- `GET /api/stats`: totals and breakdowns by mode, AI policy and build commit.
- `GET /api/rounds?after=0&limit=1000`: raw records with server IDs and receipt times.
- Optional filters: `mode=points` (or `goals`) and `aiPolicy=match-and-goal-planning-v1`.

The raw endpoint returns `rounds`, `hasMore`, `nextAfter` and `snapshotThrough`.
Continue with `after=nextAfter&through=snapshotThrough` to export a fixed snapshot.
The maximum page size is 1,000. Omit `through` on a later poll to include new data.
Use server IDs/receipt times for collection order; browser clocks and offline
uploads can make client timestamps arrive out of order.

The export helper follows every page automatically:

```sh
./scripts/with-node node scripts/export-rounds.mjs \
  https://bronkers.dracon.au .data/human-rounds.json
```

It also accepts a full filtered `/api/rounds?...` URL. Share the API URL or the
export file for analysis. Stats count **observed matches**, not unique people or
necessarily completed matches. A match can be abandoned after one logged round.

Each record includes:

- Schema version, event ID, match ID, round number and game mode.
- AI policy ID and the build's Git commit (`-dirty` for an uncommitted dev build).
- Round starter/winner, optional final match result, total individual player turns,
  client start/end times and duration including thinking/idle time.
- For each side: whether they laid down, goal/reward if they did, unfinished target
  at round end if they did not, hand **count** at the end, and the individual player
  turn when they laid down (counted from the start of the round).
- Cumulative banked scores. A bombed player has zero points for this round but
  retains earlier points. Match winner can differ from final-round winner.

`turns` and `laydownTurn` count both players’ individual turns, starting at one.
For example, if the human starts, an AI laydown on global turn six is its third
own turn. Goal-selection time is not recorded.

These are validated **client-reported testing results**, not authoritative or
cheat-proof scores. Invalid goal rewards/outcomes, unknown fields, oversized
bodies and excessive writes are rejected. Neither the raw data nor the summary
should be treated as a tamper-proof competition leaderboard.

## Delivery behaviour

The browser persists pending records as separate local-storage entries, up to
500 offline rounds. It retries after connection recovery, reload and transient
errors. Uploads can repeat during navigation or across tabs; the database's
unique event and match/round keys prevent duplicate rows. A record is removed
from the queue only after a matching save acknowledgement, or a permanent schema
rejection/conflict. A 200 HTML response from a misrouted static page is not an
acknowledgement. A record with conflicting content never overwrites the first.

The game continues if logging fails. If browser storage is unavailable, pending
records can only survive while the page is open. Clearing site data loses unsent
records; if the queue reaches 500 entries, the oldest is removed. Only completed
rounds are logged: closing a tab mid-round does not produce a result.

## Local development and tests

In a second terminal:

```sh
./scripts/with-node npm run start:telemetry
```

The usual Vite tester on port 43187 proxies `/api` to the loopback service on
43188. Local data is `.data/rounds.sqlite`, ignored by Git. It is separate from
VPS data. No ports or configuration for the other projects change.

```sh
./scripts/with-node npm test
./scripts/with-node npm run test:e2e -- --grep 'human round logging'
python3 tests/deployment/check.py
```

Tests cover persistence, duplicate/conflict handling, paging, validation, retries,
normal navigation duplicates, browser reloads, the HTTP LAN UUID fallback,
release-switch restart and retention of the API on a pre-logging rollback.
Future schema changes must retain compatibility with old open pages and queued
records, or introduce and handle a new schema version explicitly.
