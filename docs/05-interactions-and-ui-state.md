# 05 — Interactions and UI State Rules (authoritative)

These rules decide what the human can do and when. They are part of the game logic (they gate
actions), so they must be reproduced exactly. Shorthand:

- `MY_TURN` = `activePlayer == 0`
- `ACT` = `MY_TURN && phase == PlayerActions`
- `LAID` = `players[0].laidDown == 1`

---

## 1. Control matrix

| Control | Visible when | Enabled when | Action |
|---|---|---|---|
| Deck (pickup) | always | `MY_TURN && phase == WaitForPickup` | `pickup()` |
| Discard pile (pickup) | always | `MY_TURN && phase == WaitForPickup && discardPile.length > 0` | `pickupFromDiscard()` |
| Goal picker | `!LAID` (whole own-goal section) | always; completed goals inside it are disabled | set `players[0].goal`, then `onGoalChanged(old, new)` |
| Lay down | `!LAID` (with own-goal section) | `ACT && players[0].canLayDown` | `tryLayDown(players[0])` |
| Own goal slot button (dotted) | own goal chosen, `!LAID` | `ACT` | `onFormationClicked(formation)` |
| Table slot button ("+") | that player's row is shown (they laid down) | `ACT && LAID` | `onFormationClicked(formation)` |
| Formation card (select) | — | same as its slot button | toggles selection (§2) |
| Return to hand | own goal section only (§4.4) | — | `returnToHand(formation)` |
| Finish actions | `ACT` (space reserved otherwise) | always when visible | `finishActions()` |
| Discard | `MY_TURN && phase == SelectDiscard` (space reserved otherwise) | exactly **1** hand card selected | `discard(players[0], thatCard)` |
| Hand cards | always | always (any phase, either turn) | toggles selection (§2) |
| Arrow keys | — | at least 1 hand card selected | reorder (§3) |
| Help "?" | always | always | toggle overlay |
| Next round / Continue (WEB ADDITION) | `roundResult != null` | always | `confirmRound()` (`02` §7.3) |
| New game (WEB ADDITION) | `gameOver` | always | `newGame()` (`02` §7.5) |

**Game over (WEB ADDITION):** while `gameOver` is true, every control above except New game is disabled,
including the goal picker, hand selection and arrow keys. The overlay (`04` §10) blocks clicks anyway.

**Round results (WEB ADDITION, 2026-11-05):** while `roundResult != null`, only its
Next round / Continue button is active. The overlay freezes the table, goal picker,
hand selection, drag/keyboard reordering and AI. Help closes, focus goes to the
confirmation button, and backdrop clicks or Escape do not advance play. Confirming
deals a new round, or opens game over if any player completed all ten goals.

Visibility and enabled state are **reactive**. Recompute after every state change (AI steps included).

## 2. Selection model

There are two disjoint selection areas. **At most one is non-empty at a time.**

1. **Hand selection**: multi-select. Clicking a card toggles it. Keep the selection as an **ordered list
   in the order cards were selected**. Order matters for `onFormationClicked` (see `08` Q4).
2. **Formation selection** (`selectedFormationCards`): multi-select inside **one** formation at a time.

Rules:
- Selecting any hand card clears every formation selection.
- Selecting a card in formation F clears the hand selection and the selection in every other formation.
- A card that leaves a collection (played, discarded, returned, cleared by a new round) also leaves its
  selection. Cards that stay keep their selection. For example, a card whose `tryAdd` failed stays selected.
- Cards that arrive in the hand (pickups, swapped wilds, returns, goal change) arrive **unselected**.
- `onGoalChanged` clears `selectedFormationCards`.
- A new round clears all selections.
- If a formation's slot becomes disabled (phase change), its cards can't be clicked, but an existing
  selection is not cleared.

## 3. Keyboard: arrow-key reordering

Global key handler (fires regardless of focus. The original uses window-level `PreviewKeyDown`):
```
if key not in {ArrowLeft, ArrowRight}: ignore (do not preventDefault)
if hand selection is empty: ignore
hand = players[0].hand
step = ArrowLeft ? -1 : +1
indices = selected cards' current indices in hand
ordered = step < 0 ? ascending(indices) : descending(indices)
leading = ordered[0] + step
if 0 <= leading < hand.length:
    for from of ordered: move hand[from] to index from+step     // ObservableCollection.Move semantics
preventDefault()   // handled even when nothing moved
```
The selected cards move one step together and keep their gaps. If any selected card is already at the
edge in that direction, nothing moves. It works in any phase, including the AI's turn. Reordering must
**not** replay the arrival animation.

`Move(from, to)`: remove the item at `from`, then insert it at `to`.

## 4. Action details

### 4.1 Pickup
Clicking an enabled deck or discard pile performs the pickup (`02` §8.1–8.2). The picked card enters the
hand at the end, with the arrival animation.

### 4.2 Placing cards (`onFormationClicked`)
See `02` §8.5. Afterwards, Lay down may become enabled (`canLayDown`), and the round may end.

### 4.3 Lay down
See `02` §8.8. After it succeeds:
- the own-goal section (picker, Lay down, slots) **disappears**;
- a **"Player 0"** row appears in the table section with the same formations (now with "+" slots, enabled
  during `ACT`);
- that goal gets a completed circle on the sheet.
If the hand is already empty, the round ends at once.

### 4.4 Return to hand (own goal section only)
Visibility of the button under formation F in the **own goal section** (`!LAID`):
```
visible  if  F has ≥1 selected card AND F's slot is enabled (ACT)
otherwise hidden, BUT its space stays reserved
```
In table rows the button never appears and takes no space. Click → `returnToHand(F)` (`02` §8.6).

### 4.5 Finish actions → Discard
Finish actions → `phase = SelectDiscard`. The Discard button replaces it and is enabled only with exactly
one hand card selected. Discard → `02` §8.4, then the AI turn starts (`03`) unless the round ended.
There is no way back from SelectDiscard to PlayerActions.

### 4.6 Goal picker
Opening and choosing are allowed at any time while `!LAID`, including during the AI's turn and during
SelectDiscard. Choosing the goal that is already selected is a no-op. Choosing a different one returns
all cards from the old goal's slots to the hand (`02` §8.7). Completed goals can't be chosen. After a new
round starts the picker shows "Choose a goal".

### 4.7 Help overlay
While open, the game below can't be clicked. The arrow-key handler is window-level in the original and
still fires. Optional for the web build (harmless either way).

## 5. AI turn and the UI
`processAITurn` runs asynchronously (`03`). The UI must re-render after **each** AI step so the human sees:
phase prompt changes, deck count, discard top, "Opponent: N cards" flashes, and table rows appearing.
Don't batch the whole AI turn into one render.

## 6. Reactivity notes from the original bindings
- `players[0].goal` is two-way bound to the picker. `reset()` setting it to null resets the picker to
  "Choose a goal" and fires `onGoalChanged(old, null)`. The old formations are already empty, so only the
  side effects (clear formation selection, refresh canLayDown) happen.
- The own-goal formations list follows `players[0].goal.formations`. Table rows follow each player's
  `laidDown` and `goal.formations`.
- `canLayDown` is a stored flag, refreshed only by `refreshCanLayDown()` calls (`02` §6). Bind the
  Lay down button and the prompt to the **stored** flag, not to a live recomputation.

## 7. Prompt text (row 3)

**WEB ADDITION:** a non-null `statusMessage` takes precedence in the same prompt
area and uses the accent colour. A blocked opponent add before human laydown sets
"Lay down your goal before adding cards to your opponent's formations." The add
and formation-card controls can explain that restriction without permitting any
card movement; their `aria-disabled` state remains true. See `docs/10` for message
clearing behavior. The normal prompt rules below apply again once it clears.

Evaluate top to bottom. **The first match wins.**

| Condition | Text |
|---|---|
| `MY_TURN && phase == SelectDiscard` | Select one card to discard |
| `MY_TURN && phase == PlayerActions && players[0].canLayDown` | Your goal is ready to lay down |
| `MY_TURN && phase == PlayerActions` | Place cards in your goal, or finish your actions |
| `MY_TURN && phase == WaitForPickup` | Pick up from the deck or discard pile |
| `phase == SelectDiscard` | Opponent is discarding... |
| `phase == PlayerActions` | Opponent is taking their actions... |
| `phase == WaitForPickup` | Opponent is picking up... |
| (fallback, unreachable) | Opponent's turn |

"Your goal is ready to lay down" never shows after laying down, because `canLayDown` requires
`laidDown == 0`.

## 8. All UI strings

| Where | Text |
|---|---|
| Title | Bronkers |
| Header | `Opponent: {n} cards` (always "cards", even for 1) |
| Deck label | `Deck: {n} left` |
| Discard label | Discard pile |
| Goal label | Goal |
| Goal picker, none chosen | Choose a goal |
| Goal picker, points | `+{points}` |
| Goal names | 2S, 3S, 1S 1R, 2R, 2S 1R, 4S, 3S 1R, 1S 2R, 3R, 2S 2R |
| Empty slots | `Set` / `3+ cards`, `Run` / `4+ cards` (two lines) |
| Filled slot | + |
| Table row | `Player {index}` (0-based) |
| Buttons | Lay down, Finish actions, Discard |
| Return tooltip | Return to hand |
| Help | see `04` §9 |
| Game over (WEB ADDITION) | Game over; finisher line (see `04` §10); New game |
| Prompts | see §7 |
