# 08 — Quirks and Open Questions

## Part A: Faithful quirks (reproduce as-is)

These look odd but are what the WPF game does. "1-to-1 logic" means keeping them unless a decision in
Part B changes one.

| # | Quirk | Where |
|---|---|---|
| A1 | **Points are never scored.** `points` is shown on the goal sheet and, from 2026-11-06, weights adaptive AI goal selection. There is no points total. The approved web addition now names the round winner in a results screen. | `02` §4 |
| A2 | Original: a fresh deal happened instantly. **Superseded 2026-11-05:** round results name who went out and wait for confirmation. | `02` §7.3 |
| A3 | The **human always starts** every round. The dealer doesn't rotate. | `02` §7.2 |
| A4 | Original: `statusMessage` was always null. **Superseded:** blocked opponent adds now show a lay-down-first explanation in the prompt area. | `05` §7 |
| A5 | Table rows read **"Player 0"** (human) and **"Player 1"** (AI), 0-based. | `04` §2 |
| A6 | The goal picker works **at any time** before laying down: during the AI's turn and during SelectDiscard. Changing goal pulls placed cards back into the hand. | `05` §4.6 |
| A7 | Hand selection and arrow-key reordering work at any time, including the AI's turn and under the help overlay. | `05` §3 |
| A8 | The AI's goal slots fill invisibly before it lays down. **Updated 2026-11-06:** the header also stays at "Opponent: 13 cards" until laydown, concealing progress. | `03` §2 |
| A9 | A laid-down AI adds to **every** laid-down formation, including the human's, and may swap out the human's wilds into its own hand. | `03` §2 |
| A10 | Adding a matching natural to a set that holds a wild **always** swaps the leftmost wild out to the adder's hand. | `02` §3.2 |
| A11 | An all-wild set accepts **any** natural as its first natural. An all-wild run accepts a natural of **any suit**. | `02` §3, `07` SA4/RA14 |
| A12 | Run scoring counts same-suit **2s** within 3 ranks as run neighbours. | `03` §1 |
| A13 | The deck refills from the discard pile only when a pickup finds it empty, so it can sit at "0 left". If the pile has only its top card, that pickup gives nothing. | `02` §8.1 |
| A14 | `canLayDown` is a cached flag, refreshed only at specific calls. | `02` §6 |
| A15 | A run of 3 wilds + 1 natural, or 4+ wilds alone, is valid. An all-wild run of any length passes `trySet`, because `inRunOrder` returns all-wild input unchanged. | `02` §3.3 |
| A16 | Once a goal is completed it stays completed for the session. Goals are per player, so both players can complete the same goal name. | `02` §5 |
| A17 | "Opponent: 1 cards" (no singular form). | `05` §8 |
| A18 | `TryEndRound(int winner = -1)`'s parameter, `DiscardRandom`, `RemoveCardsRandom`, `PrintHand`, `Card.DisplayStr` and the `automatedTest` flag are unused or debug-only in play. They are not needed in the web build. `automatedTest` (AI plays both seats) may be kept as a dev flag. | source |

## Part B: Decisions

### Decided (2026-11-04)

| # | Question | Decision | Spec |
|---|---|---|---|
| Q1 | Goals running out. The original crashes: the AI picks from an empty list (`Random.Next(0)` → `remaining[0]` throws inside `async void`), and the human can never pick a goal again. | **Add a game over screen.** It triggers at a round end when any player has completed all 10 goals, and offers New game. This is a web addition. Nothing before that point changes. | `02` §7.5, `04` §10, `05` §1, `07` F17–F19 |
| Q2 | Goal points: code (`1,1 \| 3,3 \| 5,5 \| 8,8 \| 10,10`) or the paper sheet (first row worth 2)? | **Use the code values.** | `02` §5 |
| Q3 | Score tally / "went out" message? | **Updated 2026-11-05:** show round results with winner and laydown status; confirmation advances to the next round or game over. No points tally. | — |
| Q4 | Order of selected hand cards passed to `onFormationClicked`. | **Selection order** (order clicked), assumed to match WPF `SelectedItems`. It hasn't been checked in the WPF app. If a later check disagrees, only `02` §8.5 and `07` F16 change. | `02` §8.5, `05` §2 |

### Defaults still open (they apply unless changed)

### Q5. Help overlay and keyboard
In the original the arrow keys still reorder the hand while help is open (A7). Harmless. Keep or block?
**Default:** keep.

### Q6. Empty-hand soft lock before laying down
With goal `2S 2R`, the human can shelve all 14 cards and then click Finish actions without laying down.
Discard is then impossible (nothing to select). The return button needs PlayerActions, so the player's only way out is to
change goal, which pulls every slot card back into the hand. This is faithful. **Default:** keep.

### Q7. Player count
The engine supports N players (`players.length`), but the UI and AI assume 2 (header shows only
`players[1]`, human is index 0). **Default:** fix at 2, but keep the engine N-capable as in the original.

### Q8. Browser refresh
A reload restarts the session (fresh goal sheets), the same as relaunching the WPF app. Persisting to
`localStorage` would be a new feature. **Default:** no persistence.
