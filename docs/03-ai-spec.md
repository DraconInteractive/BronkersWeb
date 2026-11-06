# 03 — Opponent AI Specification (authoritative)

The AI is player 1. `processAITurn()` runs whenever `nextPlayer()` makes player 1 active. It must
follow the web goal-selection addition below. Pickup/discard scoring, laid-down table
additions, and 800 ms turn delays retain the original behaviour.

---

## 0. Adaptive goal selection (web addition, 2026-11-06)

Before pickup and again after drawing, assess every unfinished goal using the AI's
hand plus its privately shelved cards. Completed goals are excluded. After laydown,
the goal is locked for the rest of the round.

A bounded search (24 retained allocations per depth) estimates the fewest missing
cards by allocating disjoint partial sets/runs to the goal's slots. It explores
both slot orders, run windows with aces low/high, duplicate physical cards, and
wildcard allocation. A card is never counted in two groups. As in the original AI,
a completed set needs at least two naturals and a completed run at least three;
other legal, more wildcard-heavy formations are not planned in this first pass.
This is an estimate rather than an exhaustive optimal solver.

- Rank every goal by `points^1.5 / (missingCards + 1)`, with no bonus or priority
  for immediate completion. The reward exponent was increased from 1 to 1.5
  after local play showed too much preference for easy goals. The distance penalty
  is now linear, rather than squared, to give higher-reward goals more time to develop.
- Ties prefer fewer missing cards, then retain the current goal; remaining ties
  use goal-sheet order. Selection is deterministic and consumes no random draws.
- Switching returns all privately shelved cards before changing goal. After pickup,
  rebuild the private slots using complete groups from the chosen allocation. This
  can release a wildcard for another slot. Assessments themselves never mutate play.
- Only existing hand/shelved cards are assessed; the AI cannot inspect the deck or
  the human's cards. Pickup/discard scoring uses the chosen goal as before.

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
if !player.laidDown: selectAIGoal(player)   // §0
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
    // 3a. Reassess after drawing, then shelve complete planned groups (§0).
    plan = selectAIGoal(player)
    shelveAIPlan(player, plan)
    // Private slots and header remain concealed until laydown.
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
- Before laydown, the AI may change goals and reallocate cards in its private slots (§0).
- When the AI has laid down, every empty-slot count is 0, so every natural scores 0 and every wild 10.
  The discard is then the **first non-wild card in hand order**, or the first wild if the hand is all wilds.
- The AI can go out by discarding its last card (handled by `discard()` → `tryEndRound()`).
- Phases visible to the human: `WaitForPickup` for ~800 ms, `PlayerActions` for ~800 ms (actions resolve
  instantly at its end), `SelectDiscard` for ~800 ms, then the human's turn.
- While the AI runs, the human cannot pick up, place, lay down, finish or discard (all gated on
  `activePlayer == 0`). They **can** select and reorder hand cards and change their goal (`05`).

---

## 3. Legacy helper: `tryGetFormation(player, card): Card[] | null`

Retained as an independently tested original helper. Adaptive shelving now uses the
allocation from §0 instead. This helper builds a candidate formation (for an
**empty** goal slot) around `card` from the player's hand.

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
