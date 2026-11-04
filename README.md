# Bronkers Web — Specification Pack

This folder holds the full specification for rebuilding **Bronkers** (a C# / WPF card game, .NET 9) as a
web application, hosted on an **antiX Linux** server.

No application code exists yet. These documents are the contract for writing it.

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
4. **Deliberate additions are labelled.** The only one so far is the game over screen (`docs/08` Q1). It is
   marked **WEB ADDITION** wherever it appears. Everything not marked must match the original.

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
