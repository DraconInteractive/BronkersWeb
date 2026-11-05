# 01 — Game Rules (plain language)

This describes Bronkers as the WPF app actually plays it. `02-game-logic-spec.md` holds the exact
algorithms. Where the two differ, `02` (and behind it, the original source) is authoritative.

## Overview

Bronkers is a contract-rummy style game for **2 players**: one human (player 0) and one computer
opponent (player 1). Each round, every player picks a **goal**, a combination of *sets* and *runs*,
builds it, **lays it down**, and then tries to **go out** by getting rid of every card.

## Equipment

- **Two standard 52-card decks** shuffled together (104 cards). No jokers.
- **Every 2 is wild.** A 2 can stand in for any card in a set or a run. A 2 is never a natural "2".
- Aces are low (A-2-3-4) or high (J-Q-K-A) in runs. There is no wrap-around (K-A-2 is not allowed).

## Formations

- **Set**: 3 or more cards of the same rank, in any suits. Wilds may fill in. Three or more 2s alone also
  make a valid set.
- **Run**: 4 or more cards of the **same suit** in consecutive rank order. Wilds may fill gaps or extend
  either end. A run can be at most 14 long: A through K, plus a second Ace on top (see below).

## Goals

Each player has the same sheet of 10 goals. A goal is a list of formations to fill:

| # | Goal | Sets | Runs | Points (code) |
|---|---|---|---|---|
| 1 | `2S` | 2 | 0 | 1 |
| 2 | `3S` | 3 | 0 | 1 |
| 3 | `1S 1R` | 1 | 1 | 3 |
| 4 | `2R` | 0 | 2 | 3 |
| 5 | `2S 1R` | 2 | 1 | 5 |
| 6 | `4S` | 4 | 0 | 5 |
| 7 | `3S 1R` | 3 | 1 | 8 |
| 8 | `1S 2R` | 1 | 2 | 8 |
| 9 | `3R` | 0 | 3 | 10 |
| 10 | `2S 2R` | 2 | 2 | 10 |

A goal, once laid down, is **completed** for that player for the rest of the session and cannot be
chosen again. Points are only displayed. They are never added up or used (see `08`).

## Setting up a round

1. Shuffle all 104 cards.
2. Deal 13 cards to each player (all 13 to the human first, then all 13 to the opponent).
3. Turn one card face up to start the discard pile.
4. The human always takes the first turn of every round.
5. Nobody has a goal selected. All goal slots are empty.

## A turn

1. **Pick up** one card, either the top of the deck or the top of the discard pile.
   - If the deck runs out during a pickup, every discard except the top card is shuffled back into the
     deck and the pickup continues.
2. **Actions** (any number, any order):
   - **Choose or change your goal** (before laying down). Changing goal returns every card you placed in
     the old goal's slots to your hand. The human can change goal at any moment, even outside their turn.
   - **Place cards in your goal's slots** (before laying down). An empty slot needs a complete valid
     formation in one go (3+ for a set, 4+ for a run). A filled slot accepts more matching cards.
   - **Take cards back** from your own goal slots (before laying down). If what remains is no longer a
     valid formation, the whole slot returns to your hand.
   - **Lay down** once every slot of your goal holds cards. This completes the goal.
   - **Add to the table** (only after you have laid down this round). Add cards to any laid-down
     formation, yours or the opponent's.
3. **Discard** exactly one card to the discard pile. The turn passes.

### Swapping out wilds

When you add a natural card to a formation that contains a wild, and that natural can take the wild's
place, it does. The wild comes back to your hand. In a set this always happens if there is any wild.
In a run it happens when the natural fits exactly where a wild sits.

### Second Ace

A run that already covers every rank from Ace (low) to King (13 cards, starting with an Ace) may take a
second Ace on the top end.

## Ending a round

A round ends **immediately** when a player who has laid down this round has **no cards in hand**. That
can happen by placing their last card on the table, or by discarding it. The web version now waits for confirmation before dealing again (see below).
**WEB ADDITION (2026-11-05):** the finished table is now paused behind a round-results
screen. It names the player who went out and shows who laid down, their laid-down
goals and cards remaining. Confirm **Next round** to deal again. No points are tallied.

## Ending the game

The original has no defined end of game. When goals run out it crashes. The web version adds one
(decided in `08` Q1): **when a round ends and any player has completed all 10 goals, the game is over.**
After confirming the final round results, a game over screen names who finished and offers a new game with fresh goal sheets. No points are tallied.
