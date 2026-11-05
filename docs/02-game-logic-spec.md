# 02 — Game Logic Specification (authoritative)

Everything here must be reproduced **exactly**: orderings, tie-breaks, and side effects included.
Pseudocode is TypeScript-flavoured. Section references like `Deck.cs` point into
`reference/original-source/`.

---

## 0. Cross-cutting rules

### 0.1 Card identity
The shoe holds two of every card (for example two 7♥). Cards are **distinct objects**. Every collection
operation (remove, indexOf, contains, dictionary keys) uses **object identity, not suit/value equality**.
In the web build, give each card a unique `id` (0–103, assigned at creation) and compare by identity or id.

### 0.2 Ordered collections
Hands, formations and the discard pile are ordered lists. "Append" means push to the end. Order matters
for AI tie-breaks (`03` §1–3) and for display.

### 0.3 Stable sorts
LINQ `OrderBy` / `OrderByDescending` are **stable**. Use stable sorts. `Array.prototype.sort` is stable
in every current engine. Never sort by a comparator that breaks ties randomly.

### 0.4 Randomness
The original uses `Random.Shared` (unseeded). Use an **injectable RNG** (`() => number` in `[0,1)`),
defaulting to `Math.random`, so tests can seed it. Every place randomness is used:
1. Deck shuffle (§2.3), Fisher–Yates.
2. AI goal choice (`03` §2), uniform over remaining goals.
3. `Player.removeCardsRandom` (§6), defined but never called in play.

### 0.5 Float arithmetic (AI only)
The AI scoring uses C# `float` (IEEE-754 single precision), with `Enumerable.Sum` accumulating in
`double`. `03` §1 says where to apply `Math.fround` so threshold comparisons come out identical.

---

## 1. Card (`Card.cs`)

```ts
enum Suit { Hearts = 0, Diamonds = 1, Spades = 2, Clubs = 3 }   // declaration order matters for deck build

class Card {
  readonly id: number;
  suit: Suit;
  value: number;            // setter clamps to [1, 13]. 1 = Ace, 11 = J, 12 = Q, 13 = K
  get isWild(): boolean { return this.value === 2; }
  displayStr(): string;     // "7 of Hearts", "Ace of Spades", "Jack/Queen/King of X"
}
```

- `value` is clamped with `Math.min(13, Math.max(1, v))` on every assignment.
- `isWild` is true for **every 2, in every suit**. There is no natural 2 anywhere in the logic.
- `displayStr`: values 2–10 → `"${value} of ${SuitName}"`. 1 → `"Ace of …"`, 11 → `"Jack of …"`,
  12 → `"Queen of …"`, 13 → `"King of …"`. Suit names are `Hearts`, `Diamonds`, `Spades`, `Clubs`.
  It is debug-only and not shown in the UI.

---

## 2. Deck (`Deck.cs`)

A **stack** (last in, first out). `count` is observable, because the UI shows "Deck: N left".

### 2.1 `initializeCards(doShuffle = true)`
1. Clear.
2. Push, in this exact order: Hearts 1..13, Diamonds 1..13, Spades 1..13, Clubs 1..13, then again
   Hearts 1..13, Diamonds 1..13, Spades 1..13, Clubs 1..13. 104 cards. The last pushed (K♣) is on top.
3. If `doShuffle`, call `shuffle()`.

### 2.2 Constructor
`new Deck(doShuffle = true)` calls `initializeCards(doShuffle)`. A second constructor wraps a supplied
card array (unused in play, useful for tests).

### 2.3 `shuffle()`
`arr = stack.toArray()` (top first). Fisher–Yates shuffle `arr` in place. Rebuild the stack by pushing
`arr[0]`, `arr[1]`, … in order, so `arr[last]` ends up on top. With an unseeded RNG the exact mapping
only matters for seeded tests. Implement as: **top of stack = last element of the shuffled array**.

### 2.4 `deal(amount): { cards: Card[], remaining: number }`
```
dealCount = min(amount, count)
remaining = amount - dealCount          // how many could NOT be dealt
cards = pop() dealCount times, in pop order
notify count changed
```

### 2.5 `add(cards, shuffle = false)`
Push each card in array order, then `shuffle()` if requested. Notify count changed.

---

## 3. Formations (`GoalConfiguration.cs`)

A `Formation` owns an ordered, observable `cards: Card[]`. Two kinds: `Set` and `Run`.

### 3.1 Shared: `trySwapWild(card): { ok, swapped: Card[] }`
```
if card.isWild OR cards.every(c => c.isWild): return {ok:false, swapped:[]}
for i in 0 .. cards.length-1:
    wild = cards[i]
    if !wild.isWild: continue
    cards[i] = card
    if this.isValid(): return {ok:true, swapped:[wild]}
    cards[i] = wild                          // revert
return {ok:false, swapped:[]}
```
It tries wild positions **left to right** and takes the first that leaves the formation valid.
Note that `cards.every` on an empty array is `true`, so an empty formation never swaps.

### 3.2 Set

**`trySet(input: Card[]): boolean`**
```
if input.length < 3: return false
coreValue = (first card in input with value != 2)?.value ?? input[0].value
if input.every(c => c.value == coreValue || c.isWild):
    cards = [...input]                       // replace contents; keep INPUT ORDER
    return true
return false
```
An all-2s input of 3 or more is a valid set.

**`tryAdd(card): { ok, swapped }`**
```
if cards.length < 3: return {ok:false, swapped:[]}
core = first card in cards with !isWild
if core != null AND card.value != core.value AND !card.isWild: return {ok:false, swapped:[]}
r = trySwapWild(card); if r.ok: return r
cards.push(card)
return {ok:true, swapped:[]}
```
- Adding a matching natural to a set that has any wild (and is not all wilds) **always swaps out the
  leftmost wild** and returns it.
- If the set is all wilds, `core` is null, so **any** natural is accepted and appended.

**`isValid()`**: `cards.length >= 3` and the non-wild cards have at most 1 distinct value.

### 3.3 Run

**`trySet(input: Card[]): boolean`**
```
if input.length < 4: return false
if distinct suits among non-wild cards in input > 1: return false
ordered = inRunOrder(input, aceHigh=false) ?? inRunOrder(input, aceHigh=true)
if ordered == null: return false
cards = ordered
return true
```

**`static inRunOrder(candidates, aceHigh): Card[] | null`**
```
rank(c) = (aceHigh && c.value == 1) ? 14 : c.value
naturals = candidates.filter(!isWild), STABLE sorted ascending by rank
wilds    = queue of candidates.filter(isWild), in candidate order

if naturals.length == 0: return candidates           // unchanged order, any length

ordered = [naturals[0]]
for i in 1 .. naturals.length-1:
    gap = rank(naturals[i]) - rank(naturals[i-1]) - 1
    if gap < 0 OR gap > wilds.size: return null       // duplicate rank, or can't bridge
    repeat gap times: ordered.push(wilds.dequeue())
    ordered.push(naturals[i])

// leftover wilds: extend LOW end first, then HIGH end
for (r = rank(naturals[0]); r > 1 && wilds.size > 0; r--): ordered.unshift(wilds.dequeue())
for (r = rank(naturals[last]); r < 14 && wilds.size > 0; r++): ordered.push(wilds.dequeue())

return wilds.size == 0 ? ordered : null
```
- The low end can extend down to rank 1 and the high end up to rank 14. This holds in both ace modes.
- Ace-low is always tried first. Ace-high is tried only if ace-low returns null.

**`tryAdd(card): { ok, swapped }`**
```
if cards.length < 4: return {ok:false, swapped:[]}
natural = first card in cards with !isWild
if natural != null AND card.suit != natural.suit AND !card.isWild: return {ok:false, swapped:[]}

r = trySwapWild(card); if r.ok: return r

// second Ace on top of a complete A..K run
if card.value == 1 AND cards.length == 13 AND cards[0].value == 1:
    cards.push(card); return {ok:true, swapped:[]}

candidates = [...cards, card]
ordered = inRunOrder(candidates, false) ?? inRunOrder(candidates, true)

// cards already placed keep their wild/natural pattern; a natural cannot push a wild along
if ordered == null OR
   ordered.filter(x => x !== card).map(x => x.isWild)  !=  cards.map(x => x.isWild)   (element-wise):
    return {ok:false, swapped:[]}

cards = ordered
return {ok:true, swapped:[]}
```

**`isValid()`**
```
if cards.length < 4: return false
if distinct suits among non-wild cards > 1: return false
fitsFrom(start):
    if start + cards.length - 1 > 14: return false
    for i in 0..cards.length-1:
        rank = start + i
        expected = (rank == 14) ? 1 : rank
        if !cards[i].isWild AND cards[i].value != expected: return false
    return true
return any start in 1..14 where fitsFrom(start)
```
`isValid` checks the cards **in their stored order**. It is used by `trySwapWild` and by the human's
"return to hand" action (§8.6).

---

## 4. GoalConfiguration

```ts
class GoalConfiguration {
  formations: Formation[];   // reqSets Sets first, then reqRuns Runs
  points: number;
  name: string;              // e.g. "2S", "1S 1R", "2R": parts joined by a single space, zero counts omitted
  completed: boolean;        // observable; starts false
  get isComplete(): boolean { return formations.every(f => f.cards.length > 0); }
}
```
`isComplete` only checks that each slot is non-empty. Slots can only be filled through `trySet`, so a
non-empty slot is always valid at the time it is filled.

## 5. Goal sheet (per player, `Player.cs`)

Each player gets their **own** array of 10 new `GoalConfiguration`s, in this order:

| idx | sets | runs | points | name |
|---|---|---|---|---|
| 0 | 2 | 0 | 1 | `2S` |
| 1 | 3 | 0 | 1 | `3S` |
| 2 | 1 | 1 | 3 | `1S 1R` |
| 3 | 0 | 2 | 3 | `2R` |
| 4 | 2 | 1 | 5 | `2S 1R` |
| 5 | 4 | 0 | 5 | `4S` |
| 6 | 3 | 1 | 8 | `3S 1R` |
| 7 | 1 | 2 | 8 | `1S 2R` |
| 8 | 0 | 3 | 10 | `3R` |
| 9 | 2 | 2 | 10 | `2S 2R` |

The goal objects persist for the whole session. `completed` is **never reset**.

---

## 6. Player (`Player.cs`)

```ts
class Player {
  hand: Card[];                 // observable, ordered
  goals: GoalConfiguration[];   // §5
  goal: GoalConfiguration | null;   // observable (the "current goal")
  laidDown: 0 | 1;              // observable (int in the original)
  canLayDown: boolean;          // observable, cached, recomputed only by refreshCanLayDown()

  refreshCanLayDown() { canLayDown = laidDown == 0 && goal?.isComplete === true }

  reset() {
    laidDown = 0
    if goal: for f of goal.formations: f.cards = []
    goal = null                 // see 05 §6: for player 0 this fires the goal-changed handler (no-op here)
    refreshCanLayDown()
    hand = []
  }

  takeCards(cards)          { append each, in order }
  removeCards(cards)        { remove each by identity (first occurrence); return cards }
  removeCardsRandom(n)      { order hand by random key, take n, removeCards }   // unused in play
}
```
`canLayDown` is a cached flag. It does not update itself when formations change. Call
`refreshCanLayDown()` exactly where the original does (§8–9 and `03`).

---

## 7. Game state (`MainWindow.xaml.cs`)

```ts
enum TurnPhase { WaitForPickup, PlayerActions, SelectDiscard }

deck: Deck
discardPile: Card[]                  // last element = top
players: Player[2]                   // [0] human, [1] AI
activePlayer: number                 // observable
phase: TurnPhase                     // observable
statusMessage: string | null         // observable; only ever set to null (see 08)
gameOver: boolean                    // observable; WEB ADDITION (§7.5), starts false
finishers: number[]                  // WEB ADDITION (§7.5), player indices that completed every goal
selectedFormationCards: Card[]       // human's selection inside table/goal formations
```

### 7.1 Startup
```
deck = new Deck()                    // shuffled (then reinitialised again by setupRound)
statusMessage = null
players = [new Player(), new Player()]
setupRound()
```

### 7.2 `setupRound()`
```
selectedFormationCards = []
discardPile = []
deck.initializeCards()               // fresh 104, shuffled
for p of players (index order 0, 1):
    p.reset()
    p.takeCards(deck.deal(13).cards)
discardPile.push(deck.deal(1).cards[0])
activePlayer = 0
phase = WaitForPickup
```
The human starts every round. Goals marked `completed` stay completed.

### 7.3 Round results (WEB ADDITION, approved 2026-11-05)

The original dealt a new round immediately. The approved web behavior pauses for
confirmation, retaining the finished table and completed-goal flags:

```
roundResult: null | {
    winner: number,
    players: { index, laidDown, cardsRemaining, goal }[]
}
paused = gameOver || roundResult != null

tryEndRound():
    if paused: return true
    p = players[activePlayer]
    if p.laidDown != 1 OR p.hand.length != 0: return false
    finishers = indices of players with every goal completed
    roundResult = snapshot of activePlayer as winner and each player's
                  laidDown, hand.length, and laid-down goal name (null if unlaid)
    notify changes
    return true

confirmRound():
    if roundResult == null OR gameOver: return
    roundResult = null
    if finishers.length > 0: gameOver = true; notify changes
    else: setupRound()
```

All gameplay inputs and AI processing are guarded by `paused`. Repeated end-round
checks preserve the same snapshot, and repeated confirmations cannot deal twice.
The winner is still the active player who went out after laying down, regardless
of whether another player completed a goal during the round.

### 7.5 Game over (WEB ADDITION, decided in `08` Q1)

Completing the tenth goal mid-round does not stop play. At the round end,
`finishers` records all players with ten completed goals. The round-results screen
appears first; its Continue button then opens game over instead of starting a new
round. The final table remains frozen beneath both overlays.

`newGame()` is enabled only after game over. It creates a fresh deck and players,
clears finishers and round results, and runs `setupRound()`. No points are tallied.

### 7.4 `nextPlayer()`
```
statusMessage = null
activePlayer = (activePlayer == players.length-1) ? 0 : activePlayer + 1
phase = WaitForPickup
if activePlayer != 0: processAITurn()     // fire-and-forget async (03)
```

---

## 8. Actions

### 8.1 `pickup()` (from deck)
```
p = players[activePlayer]
{cards, remaining} = deck.deal(1)
p.takeCards(cards)
if remaining > 0:                          // deck was empty
    top = discardPile[last]
    deck.add(discardPile.slice(0, -1), shuffle=true)
    discardPile = [top]
    p.takeCards(deck.deal(remaining).cards)  // may be empty if the pile had only 1 card
phase = PlayerActions
```
The reshuffle happens **lazily**: the deck can sit at 0 until the next deck pickup.

### 8.2 `pickupFromDiscard()`
```
p = players[activePlayer]
card = discardPile[last]
p.takeCards([card])
discardPile.remove(card)                   // by identity
phase = PlayerActions
```

### 8.3 `finishActions()`
`phase = SelectDiscard`

### 8.4 `discard(player, card)`
```
discardPile.push(card)
player.removeCards([card])
if !tryEndRound(): nextPlayer()
```
Human entry point: `discard(players[0], <the single selected hand card>)`.

### 8.5 Human: `onFormationClicked(formation)`
Only reachable when the formation's slot button is enabled (`05` §4).
```
statusMessage = null
p = players[0]
chosen = selected hand cards, IN SELECTION ORDER (order the user selected them; see 08 Q4)

if formation.cards.length == 0 AND formation.trySet(chosen):
    p.removeCards(chosen)
else if formation.cards.length > 0:
    for card of chosen:
        r = formation.tryAdd(card)
        if r.ok:
            p.removeCards([card])
            if r.swapped.length > 0: p.takeCards(r.swapped)   // appended to hand, NOT selected
p.refreshCanLayDown()
tryEndRound()
```
- Cards that fail `tryAdd` stay in hand **and stay selected**. Cards that succeed leave the selection.
- An empty slot whose `trySet` fails does nothing. No message is shown.

### 8.6 Human: `returnToHand(formation)`
```
chosen = formation.cards.filter(c => selectedFormationCards.includes(c))   // formation order
remove each chosen from formation.cards
players[0].takeCards(chosen)
if !formation.isValid():                                   // also true when it is now empty
    players[0].takeCards([...formation.cards])             // formation order
    formation.cards = []
players[0].refreshCanLayDown()
```
The returned cards drop out of the formation selection (`selectedFormationCards` loses them).

### 8.7 Human: `onGoalChanged(oldGoal, newGoal)`
Fires whenever player 0's selected goal changes. That includes the user picking in the goal picker, and
`reset()` setting it to null.
```
statusMessage = null
selectedFormationCards = []
if oldGoal != null:
    collected = []
    for f of oldGoal.formations: collected.push(...f.cards); f.cards = []
    if collected.length > 0: players[0].takeCards(collected)
players[0].refreshCanLayDown()
```
`players[0].goal = newGoal` is set by the picker binding before or at this point. Allowed at **any
time**, in any phase, on either player's turn, while `players[0].laidDown == 0` (the picker is hidden
afterwards). Completed goals cannot be picked.

### 8.8 `tryLayDown(player)`
```
if player.laidDown == 1: return false
if !player.canLayDown: return false
player.laidDown = 1
player.refreshCanLayDown()                 // -> false
if player.goal: player.goal.completed = true
tryEndRound()
return true
```
Human entry point: the Lay down button, which is enabled only in the human's `PlayerActions` with
`canLayDown` (`05`).

---

## 9. Turn state machine

```
                ┌──────────────── setupRound() (activePlayer = 0) ───────────────┐
                ▼                                                                │
  [WaitForPickup] --pickup()/pickupFromDiscard()--> [PlayerActions]              │
                                                       │  place / return /       │
                                                       │  lay down / add         │
                                                       │  (any may end round) ───┤
                                                       ▼                         │
                                         finishActions() → [SelectDiscard]       │
                                                       │                         │
                                         discard(card) ─┬─ tryEndRound() true ───┘  (or → [GameOver], §7.5)
                                                        └─ nextPlayer() → [WaitForPickup] for next player
```
- Human: every transition is driven by clicks (`05`).
- AI: `processAITurn()` drives the same functions with delays (`03`).
- Hand-empty checks (`tryEndRound`) run after: discard, every human formation click, AI table adds,
  and every lay down.
