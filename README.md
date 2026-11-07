# Bronkers Web

This folder holds the full specification for rebuilding **Bronkers** (a C# / WPF card game, .NET 9) as a
web application, hosted on an **antiX Linux** server.

The browser game is implemented in TypeScript, with a pure game engine and a
responsive DOM interface. The specification and original source below define its
rules. Gameplay runs in the player's browser. Static hosting is sufficient to play;
[persistent human-round logging](docs/17-human-round-logging.md) adds a small
Node/SQLite API behind Caddy. Reloading starts a fresh game.

## Run locally

From this repository directory:

```sh
./scripts/setup-node
./scripts/with-node npm ci
./scripts/dev
```

Open **http://localhost:43187/** on the host, or **http://<host-LAN-IP>:43187/**
from another device on the same network. Node, npm caches and browser downloads
stay inside the ignored `.tools/` directory.

```sh
./scripts/with-node npm test          # Rules, AI and round-flow tests
./scripts/with-node npm run test:e2e  # Chromium, Firefox and mobile Chromium
./scripts/with-node npm run build    # Type checking and static output in dist/
```

For browser tests on a fresh checkout, first run
`./scripts/with-node npx playwright install chromium firefox`.
See [local development](docs/09-local-development.md) for setup details, and
[mobile adaptations](docs/10-web-adaptations.md) for the approved UI additions.
Copy the contents of `dist/` to the eventual static web server for deployment.

For an uploadable Linux VPS deployment bundle:

```sh
./scripts/with-node npm run package
```

This produces a timestamped archive and checksum in `releases/`, including Caddy
and nginx examples. See [VPS deployment](docs/11-vps-deployment.md). The VPS needs
only a static web server to play. Persistent round logging additionally needs
the Node API described in [logging setup](docs/17-human-round-logging.md).

## Deploy updates from Git

For the existing VPS, after committing and pushing the implementation, clone the
repository there and run this one-time setup as your usual deploy user:

```sh
sudo ./scripts/deploy init --user "$(id -un)"
```

Then every update is one command from that VPS checkout:

```sh
./scripts/deploy
```

It pulls the upstream branch, installs the pinned tools/dependencies locally,
runs the engine tests, builds, and atomically activates a release. Failed builds
leave the live version intact. `./scripts/deploy rollback` restores the previous
release. See [Git deployment](docs/12-git-deployment.md) for complete setup and
migration from the existing tar installation. Caddy keeps using port 43187 and
`/var/www/bronkers/current/public` in this VPS setup.

## Ground rules

1. **Game logic is a 1-to-1 recreation.** Every rule, validation, ordering, tie-break, AI heuristic and
   timing in `docs/02` and `docs/03` must behave exactly as the WPF original. When a document and the
   original source disagree, **the original source wins**. It is copied into `reference/original-source/`.
2. **The look can differ, the design cannot.** Colours, fonts, exact pixel sizes and animation curves may
   change. The overall layout must stay the same: felt table, deck and discard on the left, the table of
   goals and formations on the right, a fanned hand along the bottom, prompt and action button underneath,
   the goal picker as a sticky note, and a help overlay. So must every piece of state the UI shows and
   every enable/visibility rule (`docs/05`).
3. **Quirks are preserved unless a decision says otherwise.** `docs/08` lists behaviour that looks odd but
   is what the original does, plus the decisions taken.
4. **Deliberate additions are labelled.** Game over and the round-results confirmation
   screen are marked **WEB ADDITION**. Approved touch controls and responsive layouts are
   documented in `docs/10`. Everything else follows the original rules.

## Documents

| File | Contents |
|---|---|
| [docs/01-game-rules.md](docs/01-game-rules.md) | Plain-language rules of Bronkers, derived from the code |
| [docs/02-game-logic-spec.md](docs/02-game-logic-spec.md) | Exact data model and algorithms: cards, deck, sets, runs, goals, players, turn and round flow |
| [docs/03-ai-spec.md](docs/03-ai-spec.md) | The opponent AI: scoring, pickup choice, formation search, play and discard, timing |
| [docs/04-ui-layout-and-visuals.md](docs/04-ui-layout-and-visuals.md) | Screen layout, components, colours, typography, animation |
| [docs/05-interactions-and-ui-state.md](docs/05-interactions-and-ui-state.md) | Every control, when it is visible or enabled, what it does, selection model, keyboard, all UI text |
| [docs/06-architecture-and-hosting.md](docs/06-architecture-and-hosting.md) | Recommended stack, module layout, and deployment on antiX |
| [docs/07-parity-test-cases.md](docs/07-parity-test-cases.md) | Concrete input → output cases that the web engine must pass |
| [docs/08-quirks-and-open-questions.md](docs/08-quirks-and-open-questions.md) | Odd but faithful behaviour, decisions taken, and remaining defaults |
| [docs/09-local-development.md](docs/09-local-development.md) | Workspace-local tools, development commands, and browser testing limitations |
| [docs/10-web-adaptations.md](docs/10-web-adaptations.md) | Approved responsive layouts, touch controls, and accessibility additions |
| [docs/13-ai-improvements-and-backlog.md](docs/13-ai-improvements-and-backlog.md) | Delivered AI improvements, frozen baseline, two-stage benchmark and deferred work |
| [docs/14-ai-risk-ab-testing.md](docs/14-ai-risk-ab-testing.md) | Conservative/aggressive policies and the ten-round banking benchmark |
| [docs/15-ai-public-opponents.md](docs/15-ai-public-opponents.md) | Public bombing pressure, defensive discards, and the previous aggressive control |
| [docs/16-ai-match-planning.md](docs/16-ai-match-planning.md) | Score-aware risk, goal-sheet planning, and optional ten-round points mode |
| [docs/17-human-round-logging.md](docs/17-human-round-logging.md) | Persistent human results, API endpoints and one-time VPS service setup |

## Reference material

- `reference/original-source/` — verbatim copies of the WPF source files that define the game
  (`Core/*.cs`, `MainWindow.xaml(.cs)`, `FanPanel.cs`).
- `reference/parity-harness/`: a small .NET 9 console app that runs the original Core code and prints
  the expected values in `docs/07` (`dotnet run`). `check.mjs` is the JavaScript float32 cross-check
  for the AI scoring (`node check.mjs`). Extend both when you add test cases.
- `reference/goal_outline.jpeg` — the hand-drawn goal sheet the goal picker imitates. Its point values do
  **not** match the code; see `docs/08`.

## Original source map

| Original file | Covers | Spec section |
|---|---|---|
| `Core/Card.cs` | Card, suits, wilds | 02 §1 |
| `Core/Deck.cs` | Two-deck shoe, shuffle, deal, refill | 02 §2 |
| `Core/GoalConfiguration.cs` | `Set`, `Run`, `GoalConfiguration` | 02 §3–5 |
| `Core/Player.cs`, `Core/Hand.cs` | Player state, goal list | 02 §6 |
| `MainWindow.xaml.cs` | Turn and round flow, human actions, AI | 02 §7–9, 03, 05 |
| `MainWindow.xaml` | Layout, styles, visibility and enable rules, text | 04, 05 |
| `FanPanel.cs` | Hand fan layout | 04 §5 |
