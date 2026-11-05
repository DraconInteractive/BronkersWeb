# 03 — Opponent AI Specification (authoritative)

The AI is player 1. `processAITurn()` runs whenever `nextPlayer()` makes player 1 active. It must
behave identically to `MainWindow.ProcessAITurn` and its helpers, including tie-breaks, float precision
and delays.

---

## 1. Card scoring: `getCardScores(player, discard?: Card): Map<Card, float>`

Returns an **insertion-ordered** map (JS `Map` keyed by card object). Insertion order is a tie-break
(see `minBy` and the stable sort below), so build it exactly in this order.

```
TWO_SCORE = 10
scores = new Map()
if discard: scores.set(discard, discard.isWild ? 10 : 0)       // inserted FIRST
for card of player.hand: scores.set(card, card.isWild ? 10 : 0)  // hand order

if player.goal == null: throw Error("Null goal in card scores")

reqSets = count of player.goal.formations that are Set AND cards.length == 0
reqRuns = count of player.goal.formations that are Run AND cards.length == 0

// Set scoring
for card of scores.keys():
    if card.value == 2: continue
    n = count of keys k with k.value == card.value          // includes card itself
    scores.set(card, f32( f32(n / 3) * reqSets ))

// Run scoring
for card of scores.keys():
    if card.value == 2: continue
    n = count of keys k with k.suit == card.suit AND abs(card.value - k.value) < 4
        // includes card itself AND any 2s of that suit (a 2 is within range of A..5)
        // Ace counts as value 1 only
    s = f32( f32(n / 4) * reqRuns )
    if scores.get(card) < s: scores.set(card, s)

return scores
```
`f32(x) = Math.fround(x)`. Key points:
- Wilds always score 10.
- A card's score is `max(setScore, runScore)`. When the goal has no empty slot of a kind, that part is 0.
- Updating map values during iteration over keys is fine (it does not reorder a JS `Map`).

### 1.1 Float32 parity
C# computes these in `float`. Reproduce like this:
- Per-card scores: as above, `f32` after each division and multiplication.
- **Sums** (`Enumerable.Sum` with a float selector) accumulate in **double**, then cast to float:
  `sumF(map) = f32( values summed left-to-right in insertion order as JS numbers )`.
- `min` of float values: plain `Math.min` (values are already float32).
- Subtractions between float32 values: wrap in `f32`.
- Constant `0.6f` = `f32(0.6)` (= 0.60000002384185791015625).

---

## 2. `processAITurn()` (async)

`WAIT = 800` ms. `await delay(WAIT)` means `await new Promise(r => setTimeout(r, 800))`.
`player = players[activePlayer]` is captured at the start.

```
// 1. Goal selection
if player.goal == null:
    remaining = player.goals.filter(g => !g.completed)       // sheet order
    player.goal = remaining[ floor(rng() * remaining.length) ]
        // if remaining is empty the original throws IndexOutOfRange (see 08 Q1)
await delay(WAIT)

// 2. Pickup decision
scores        = getCardScores(player)
discardScores = getCardScores(player, discardPile[last])
cScore        = sumF(scores)
discardCScore = f32( sumF(discardScores) - min(discardScores.values()) )   // drop the worst card (see notes)
if f32(discardCScore - cScore) > f32(0.6):  pickupFromDiscard()
else:                                       pickup()
await delay(WAIT)

// 3. Actions
if player.laidDown == 0:
    // 3a. Shelve formations into the goal (invisible to the human; the internal hand shrinks but the header stays at 13)
    do:
        shelved = false
        ranked = [...getCardScores(player).entries()]
                   .filter(([c]) => !c.isWild)
                   .stableSortDescendingBy(([, s]) => s)
                   .map(([c]) => c)
        for card of ranked:
            f = tryGetFormation(player, card)            // §3
            if f == null: continue
            target = player.goal.formations.find(fm => fm.cards.length == 0 && fm.trySet(f))
                     // evaluated in formation order; trySet only mutates on success
            if target == null: continue
            player.removeCards(f)
            shelved = true
            break
    while shelved
else:
    // 3b. Already laid down: add to every laid-down formation on the table (own and others')
    do:
        added = false
        for other of players (index order):
            if other.goal == null OR other.laidDown == 0: continue
            for form of other.goal.formations (in order):
                for card of [...player.hand]:             // snapshot taken per formation
                    r = form.tryAdd(card)
                    if !r.ok: continue
                    player.removeCards([card])
                    player.takeCards(r.swapped)
                    added = true
    while added
    if tryEndRound(): return

// 4. Lay down
wentOut = player.hand.length == 0
player.refreshCanLayDown()
tryLayDown(player)                     // may end the round (and deal a new one) if hand is empty
if wentOut: return
finishActions()                        // phase = SelectDiscard
await delay(WAIT)

// 5. Discard
scores = getCardScores(player)
discard(player, minBy(scores))         // first entry (insertion order) with the lowest score
await delay(WAIT)                      // no effect: discard() already passed the turn
```

Notes:
- The note in the original reads "Drop lowest card so its a 13 v 13 comparison". The hand has 13 cards
  at pickup time, and the hypothetical with the discard has 14 minus the worst.
- The AI lays down in the same turn it completes its goal (step 4). It does **not** add to the table in
  that turn. Adding (3b) only happens on turns that **start** already laid down.
- The AI never changes its goal mid-round and never takes cards back from its slots.
- When the AI has laid down, every empty-slot count is 0, so every natural scores 0 and every wild 10.
  The discard is then the **first non-wild card in hand order**, or the first wild if the hand is all wilds.
- The AI can go out by discarding its last card (handled by `discard()` → `tryEndRound()`).
- Phases visible to the human: `WaitForPickup` for ~800 ms, `PlayerActions` for ~800 ms (actions resolve
  instantly at its end), `SelectDiscard` for ~800 ms, then the human's turn.
- While the AI runs, the human cannot pick up, place, lay down, finish or discard (all gated on
  `activePlayer == 0`). They **can** select and reorder hand cards and change their goal (`05`).

---

## 3. `tryGetFormation(player, card): Card[] | null`

Builds a candidate formation (for an **empty** goal slot) around `card` from the player's hand.

```
if card.isWild: return null
hand     = player.hand
wilds    = hand.filter(isWild)                        // hand order
naturals = hand.filter(c => c.value == card.value)    // includes card; any suit; hand order

needsSet = player.goal has a Set with cards.length == 0
set = [...naturals, ...wilds].slice(0, 3)
if needsSet AND naturals.length >= 2 AND set.length == 3:
    return set

needsRun = player.goal has a Run with cards.length == 0
if needsRun:
    RUN_LENGTH = 4; MIN_NATURALS = 3
    suited = hand.filter(c => c.suit == card.suit && !c.isWild)   // hand order
    best = []
    ranks = card.value == 1 ? [1, 14] : [card.value]
    for rank of ranks:
        firstStart = max(1, rank - 3)
        lastStart  = min(rank, 15 - 4)            // = min(rank, 11)
        for start = firstStart .. lastStart:
            window = for r in start .. start+3:
                         suited.find(c => c.value == (r == 14 ? 1 : r))   // first in hand order
                     keep only found cards (in r order)
            missing = 4 - window.length
            if window.length >= 3 AND missing <= wilds.length AND window.length > best.length:
                best = window                     // strictly greater: earliest window wins ties
    if best.length > 0:
        return [...best, ...wilds.slice(0, 4 - best.length)]

return null
```
- The set check always comes **first**. If the goal needs a set and there is a pair (+ wild), a set is
  returned even if a run was possible.
- A set candidate is always exactly 3 cards and a run candidate exactly 4.
- A rank-2 position in a window is never filled by a natural (2s are wild), so it counts as missing.

---

## 4. Human-visible signals of AI activity

- **WEB ADDITION (2026-11-06):** the header stays at "Opponent: 13 cards" until
  the AI commits to laying down. Pickup, shelving and discard do not change or
  flash that header while its goal is uncommitted. On laydown it reveals the
  actual hand count; subsequent visible count changes update and flash normally.
  A new round resets the display to 13. Internal hand counts and AI decisions are
  unchanged.
- The discard pile changes on pickup-from-discard and on discard.
- The deck count changes on deck pickup.
- AI formations appear on the table (as a "Player 1" row) only once it lays down.
