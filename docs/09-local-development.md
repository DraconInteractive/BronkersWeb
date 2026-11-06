# Local development setup

Keep the runtime and downloads inside the repository's ignored `.tools/` folder.
No system Node installation or shell profile changes are needed.

Run from the repository root:

```sh
./scripts/setup-node
./scripts/with-node node --version
./scripts/with-node npm --version
```

On first installation the setup script downloads the latest Node 24 LTS Linux
x86-64 or ARM64 archive for the current host from nodejs.org and checks its SHA-256 against the release manifest.
It records the installed version in `.node-version`; commit that file after a
successful installation so subsequent setups use the same version.

The wrapper localises npm's cache, global installation prefix, and Playwright
browser downloads. Project dependencies use the usual local `node_modules/`.
It does not isolate system libraries as a container would.

Install the pinned project dependencies:

```sh
./scripts/with-node npm ci
```

Useful commands:

```sh
./scripts/with-node npm run typecheck
./scripts/with-node npm test
./scripts/with-node npm run test:e2e
./scripts/with-node npm run build
./scripts/with-node npx playwright install chromium firefox webkit
./scripts/dev
```

The application entry point is `index.html` and `src/main.ts`. The pure engine
lives in `src/engine/`; browser rendering and input handling are in `src/ui/`.
Vitest runs `tests/parity/` using the supplied expected values and flow scenarios,
without executing the C# harness. Playwright runs `tests/e2e/` against Chromium,
Firefox, and an emulated Android viewport. It reuses an existing server on 43187,
or starts one for the tests. Deterministic UI fixtures live under `tests/e2e/`
and are not included in the production build.

`npm run build` type-checks the project and produces self-contained static files
in `dist/`. Build artifacts, browser reports and downloaded tools are ignored by Git.

The development launcher binds to all IPv4 interfaces on port **43187** and fails
if that port is occupied. On the host use `http://localhost:43187`; from a Windows
PC or phone on the same network use `http://<host-LAN-IP>:43187`. Network/firewall
reachability still needs checking when the server is running.

Vite, TypeScript, Vitest, and Playwright are installed as project development
dependencies with exact versions and a lockfile. The C# parity harness is outside the current setup scope.
Manual testing on the user's Windows PC and mobile devices supplements automation.

## Setup status

Node 24.22.2 and npm 11.19.1 are installed in `.tools/node`. The game builds and
runs on `0.0.0.0:43187`. External device connectivity still requires a manual
check from the user's Windows PC or phone.

Chromium, Firefox, and WebKit browser binaries are downloaded inside
`.tools/browsers`. Headless Chromium and Firefox both passed launch, rendering,
and button-click checks. Playwright reports these missing host libraries for
WebKit: `libgstgl-1.0.so.0`, `libgstcodecparsers-1.0.so.0`, and
`libmanette-0.2.so.0`. WebKit automation is not ready; no system packages were
installed. Actual iOS testing can be performed manually for now.

## Automated AI trials

Run repeatable, independent opening rounds using the actual production AI for both
seats, with animation delays skipped:

```sh
./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --output reports/ai/tuned-ten-point-goals-1000-first-rounds
```

The default mode is 1,000 independent opening rounds. Each trial creates a fresh game with all ten goals available to both players and
stops at its first round result. Completed goals from one trial never carry into
the next. This is the preferred mode for measuring goal selection without the
influence of locked goals later in a match.

The runner writes a Markdown report, goal-distribution CSV, and raw per-trial JSON.
It records laydowns when they happen (not just the winning player's goal), personal
turns until laydown, first laydown per round, completed/capped trials, and available
goals. It checks all 104 physical cards after every turn. Seeds and the engine
commit are recorded for reproduction. Self-play is a diagnostic and does not
predict results against a human.

Artificial AI waits are replaced by an immediately resolving scheduler. The
800 ms in-game stage delays do not contribute to simulation time. The runner
uses up to three worker threads by default (limited by available CPUs); pass
`--workers 1` for a serial run. Each seed remains independent and report order is
sorted by seed, so worker count does not change decisions or outcomes. Reports
record wall time, CPU time, player-turn count and worker count. Headless Vite
loading disables watching, HMR and WebSockets, so workers do not open ports.

The default limit is 500 individual player turns per round; change it with
`--max-round-turns`. Hitting a limit is reported explicitly; observed laydowns are
retained, but a capped trial is never counted as completed.

For a separate test of progression through an entire game, use `--matches 100`
instead of `--rounds 1000`. Full-match mode automatically confirms round results
and caps each match at 100 rounds. It is unsuitable for measuring unrestricted
goal preference because previously completed goals become unavailable. Neither
mode changes the game rules or AI weights.

Recorded baseline: [1,000 independent rounds with reward exponent 1.5](../reports/ai/reward-1.5-1000-first-rounds.md).

Linear-penalty experiment: [paired comparison](../reports/ai/linear-penalty-comparison.md).
Reports use the currently checked-out engine; reproduce a historical policy using
the engine commit recorded in that report.

Goal-aligned pickup/discard experiment: [paired comparison](../reports/ai/goal-aligned-decisions-comparison.md),
using the same 1,000 opening-round seeds and unchanged linear goal scoring.

For calibration, `--reward-exponent 1.65 --three-run-weight 1.05` overrides those
constants only in the headless module loader. `--missing-offset` similarly
overrides the distance offset (production remains 1). The locally served game and source
files are unaffected by experimental overrides. Reports record actual loaded
weights, and both the coordinator and workers validate the configuration. Workers
receive all CLI arguments, including round limits and mode. Generated goal tables
also include round wins, median turns, and turn ranges.

Current ten-point tuning: [comparison and calibration](../reports/ai/ten-point-calibration-comparison.md), with [full per-goal statistics](../reports/ai/tuned-ten-point-goals-1000-first-rounds.md).
