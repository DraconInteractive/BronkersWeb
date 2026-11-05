# 07 — Parity Test Cases

**Sections 1–9: every expected result was produced by running the original `Core/*.cs` code** (and verbatim
copies of `GetCardScores` / `TryGetFormation` from `MainWindow.xaml.cs`) under .NET 9. The AI float
cases were also checked against a JavaScript implementation of `03` §1.1, which matched bit for bit.
The web engine must pass all of them. Add these as unit tests (`06` §3).

**Notation:** `5H` = 5 of Hearts, `AS` = Ace of Spades, `10C`, `JD`, `QH`, `KS`. Suits are H, D, S, C. Every
`2x` is wild. Listed cards are **separate card objects**, even when two have the same suit and value.
"→ true [..]" gives the formation's resulting `cards` order.

## 1. Set.trySet

| # | Input | Result |
|---|---|---|
| S1 | 5H 5S 5D | true `[5H,5S,5D]` |
| S2 | 5H 2C 5D | true `[5H,2C,5D]` |
| S3 | 2H 2C 2D | true `[2H,2C,2D]` (all wild) |
| S4 | 5H 6H 5D | false |
| S5 | 5H 5S | false (too few) |
| S6 | 2C 7H 7S 7D | true `[2C,7H,7S,7D]` (input order kept) |

## 2. Set.tryAdd (formation built with trySet first)

| # | Formation | Add | Result | Formation after | Swapped out |
|---|---|---|---|---|---|
| SA1 | `[5H,2C,5D]` | 5S | true | `[5H,5S,5D]` | `[2C]` |
| SA2 | `[5H,5S,5D]` | 2C | true | `[5H,5S,5D,2C]` | `[]` |
| SA3 | `[5H,5S,5D]` | 6H | false | unchanged | `[]` |
| SA4 | `[2H,2C,2D]` | 9S | true | `[2H,2C,2D,9S]` | `[]` (all-wild: no swap, any natural OK) |
| SA5 | `[2H,5C,2D]` | 5S | true | `[5S,5C,2D]` | `[2H]` (leftmost wild) |

## 3. Run.trySet

| # | Input | Result |
|---|---|---|
| R1 | 5H 6H 7H 8H | true `[5H,6H,7H,8H]` |
| R2 | 8H 5H 7H 6H | true `[5H,6H,7H,8H]` |
| R3 | 5H 2C 7H 8H | true `[5H,2C,7H,8H]` (gap filled) |
| R4 | 5H 6H 7H 2C | true `[2C,5H,6H,7H]` (leftover wild goes LOW first) |
| R5 | QH KH AH 2C | true `[2C,QH,KH,AH]` (ace-high fallback) |
| R6 | AH 3H 4H 2C | true `[AH,2C,3H,4H]` (ace-low) |
| R7 | KH AH 2C 3H | false (no wrap-around) |
| R8 | 5H 6S 7H 8H | false (mixed suits) |
| R9 | 5H 5H 6H 7H | false (duplicate rank) |
| R10 | 2H 2C 2D 2S | true `[2H,2C,2D,2S]` (all wild, order kept) |
| R11 | 5H 6H 7H | false (too few) |
| R12 | JH QH KH AH | true `[JH,QH,KH,AH]` |
| R13 | AH 2S 2D 4H | true `[AH,2S,2D,4H]` |
| R14 | 3H 2C 2D 2S | true `[2D,2C,3H,2S]` (low-end wilds are unshifted one at a time, then the high end) |

## 4. Run.tryAdd (formation built with trySet first, shown in its stored order)

| # | Formation | Add | Result | Formation after | Swapped |
|---|---|---|---|---|---|
| RA1 | `[5H,6H,7H,8H]` | 9H | true | `[5H,6H,7H,8H,9H]` | `[]` |
| RA2 | `[5H,6H,7H,8H]` | 4H | true | `[4H,5H,6H,7H,8H]` | `[]` |
| RA3 | `[5H,6H,7H,8H]` | 9S | false | unchanged | `[]` |
| RA4 | `[5H,2C,7H,8H]` | 6H | true | `[5H,6H,7H,8H]` | `[2C]` |
| RA5 | `[2C,5H,6H,7H]` | 4H | true | `[4H,5H,6H,7H]` | `[2C]` |
| RA6 | `[2C,5H,6H,7H]` | 8H | true | `[2C,5H,6H,7H,8H]` | `[]` |
| RA7 | `[2C,5H,6H,7H]` | 9H | **false** | unchanged | `[]` (wild would have to move: pattern check) |
| RA8 | `[2C,QH,KH,AH]` | 10H | true | `[10H,2C,QH,KH,AH]` | `[]` |
| RA9 | `[AH,2C,3H,4H]` | 2D | true | `[AH,2C,3H,4H,2D]` | `[]` |
| RA10 | `[5H,6H,7H,8H]` | 2C | true | `[2C,5H,6H,7H,8H]` | `[]` |
| RA11 | `[AH,2C,3H..KH]` (13) | AS | false | unchanged | `[]` (wrong suit) |
| RA12 | `[AH,2C,3H..KH]` (13) | AH | true | `[AH,2C,3H..KH,AH]` (14) | `[]` (second ace) |
| RA13 | `[10H,JH,QH,KH]` | AH | true | `[10H,JH,QH,KH,AH]` | `[]` |
| RA14 | `[2C,2D,2S,2H]` | 7H | true | `[2H,2S,2D,2C,7H]` | `[]` |

## 5. isValid after removal (drives "return to hand")

| # | Case | isValid |
|---|---|---|
| V1 | Run `[3H..7H]`, remove 5H → `[3H,4H,6H,7H]` | false → whole formation returns to hand |
| V2 | Run `[3H..7H]`, remove 3H → `[4H,5H,6H,7H]` | true |
| V3 | Set of four 5s, remove one | true |
| V4 | Run `[2C,QH,KH,AH]` | true |

## 6. Goal sheet

| idx | name | points | formations |
|---|---|---|---|
| 0 | 2S | 1 | Set, Set |
| 1 | 3S | 1 | Set, Set, Set |
| 2 | 1S 1R | 3 | Set, Run |
| 3 | 2R | 3 | Run, Run |
| 4 | 2S 1R | 5 | Set, Set, Run |
| 5 | 4S | 5 | Set ×4 |
| 6 | 3S 1R | 8 | Set ×3, Run |
| 7 | 1S 2R | 8 | Set, Run, Run |
| 8 | 3R | 10 | Run ×3 |
| 9 | 2S 2R | 10 | Set, Set, Run, Run |

## 7. AI: getCardScores

Values are float32, shown as C# prints them (JS shows e.g. `0.6666666865348816` for `0.6666667`).

| # | Hand (in order) | Goal / empty slots | Scores (map order) |
|---|---|---|---|
| SC1 | 5H 5S 6H 7H 2H | 1S 1R (1 set, 1 run) | 5H=1, 5S=0.6666667, 6H=0.75, 7H=0.75, 2H=10. Sum 13.166667. **minBy → 5S** |
| SC2 | same | 2S (2 sets) | 5H=1.3333334, 5S=1.3333334, 6H=0.6666667, 7H=0.6666667, 2H=10 |
| SC3 | same | 2R (2 runs) | 5H=2, 5S=0.5, 6H=1.5, 7H=1.5, 2H=10 |
| SC4 | same | 1S 1R with the Set slot already filled | 5H=1, 5S=0.25, 6H=0.75, 7H=0.75, 2H=10 |
| SC5 | KH 9S 2C 4D | 1S 1R, both filled | KH=0, 9S=0, 2C=10, 4D=0. **minBy → KH** (first of the ties) |

SC1 shows that **2H counts toward 5H's run range** (|5−2| < 4, same suit). 5H gets 4/4 = 1.

## 8. AI: pickup decision

Hand (in order): `3H 3S 7D 9C 10C JS KH 4D 8S QC 6D AH 5S`. Goal `1S 1R`, nothing placed.
`cScore = 8.666667`. Rule: take discard iff `f32(discardCScore − cScore) > f32(0.6)`.

| Top discard | discardCScore | diff | Takes discard? |
|---|---|---|---|
| 3D | 10.5 | 1.833333 | yes |
| 2D | 18.583332 | 9.916665 | yes |
| 8D | 9.583334 | 0.916667 | yes |
| 5D | 10.083334 | 1.416667 | yes |
| KC | 9.75 | 1.083333 | yes |
| JD | 9.166667 | 0.5 | **no** → deck |
| 9H | 9 | 0.33333302 | **no** → deck |
| QS | 9.25 | 0.583333 | **no** → deck |

## 9. AI: tryGetFormation

| # | Hand (in order) | Goal | Card | Result |
|---|---|---|---|---|
| TG1 | 7H 7S 2C 9D KS | 2S | 7H | `[7H,7S,2C]` |
| TG2 | 7H 9D 2C 2S KS | 2S | 7H | none (only one natural 7) |
| TG3 | 5H 6H 8H 2C KS | 2R | 5H | `[5H,6H,8H,2C]` |
| TG4 | 5H 6H 8H KS | 2R | 5H | none (needs a wild) |
| TG5 | AH QH KH 2C | 2R | AH | `[QH,KH,AH,2C]` (ace as 14) |
| TG6 | AH 3H 4H 9S | 2R | AH | none (rank 2 can only be a wild) |
| TG7 | 7H 7S 6H 8H 9H | 1S 1R | 7H | `[6H,7H,8H,9H]` (pair without wild → falls through to run) |
| TG8 | 7H 7S 6H 8H 9H | 2R | 7H | `[6H,7H,8H,9H]` |
| TG9 | 2C | 1S 1R | 2C | none (wild) |
| TG10 | 4H 5H 6H 7H 8H | 2R | 6H | `[4H,5H,6H,7H]` (earliest full window wins) |
| TG11 | 7H 7S 9D | 2S | 7H | none |

## 10. Flow scenarios (integration tests with a seeded RNG / stacked deck)

**WEB ADDITION (2026-11-05):** F7–F8 and F17–F19 now include the approved round-results
pause and confirmation before the next deal or game-over screen.

These come from **reading** `MainWindow.xaml.cs`, not from running it. That code depends on WPF and
wasn't executed. F17–F19 cover the web addition and have no original to compare against.

| # | Scenario | Expected |
|---|---|---|
| F1 | New round | each hand 13 cards; discard 1; deck 77; `activePlayer 0`; `WaitForPickup`; both goals null; completed flags unchanged |
| F2 | Human deck pickup | hand 14; deck 76; phase `PlayerActions` |
| F3 | Deck at 0, discard pile `[a,b,c]`, human picks deck | deck gets `[a,b]` shuffled, discard becomes `[c]`, human receives 1 card from the refilled deck |
| F4 | Deck at 0, discard pile `[c]`, pick deck | human receives **no** card, phase `PlayerActions` |
| F5 | Human chooses goal 2S, fills both sets | `canLayDown` true; prompt "Your goal is ready to lay down"; Lay down enabled |
| F6 | Human lays down with cards left | `laidDown 1`; goal completed; own section hidden; "Player 0" row shown |
| F7 | Human (laid down) places last card on a table formation | round-results snapshot appears with human as winner; confirmation deals the next round, `activePlayer 0` |
| F8 | Human (laid down) discards last card | round-results snapshot appears; confirmation deals the next round |
| F9 | Human not laid down, every hand card shelved in goal slots (possible with 2S 2R + 14 cards), then Finish actions | round does **not** end (needs `laidDown`). Discard stays disabled (no card to select). Recover only by changing goal (`08` Q6) |
| F10 | Human changes goal with filled slots | all slot cards appended to hand (formation order, sets then runs), slots cleared, `canLayDown` false |
| F11 | Return one card from a valid 4-card set in own slot | that card to hand; set stays with 3 |
| F12 | Return middle card of a 5-run in own slot | all 5 cards to hand (selected first, then the rest in formation order), slot empty |
| F13 | Arrow-right with selection at indices {2,3} of 5 | they move to {3,4} |
| F14 | Arrow-right with selection {3,4} of 5 | nothing moves |
| F15 | Arrow-left with selection {0,2} | nothing moves (leading card at edge) |
| F16 | Human selects 5S then 2D, clicks set `[5H,2C,5D]` | 5S swaps out 2C (2C to hand). Then 2D is appended. Result `[5H,5S,5D,2D]`, hand gains 2C |
| F17 (web addition) | Player 1 has 9 goals completed, lays down the 10th mid-round, round continues, then someone goes out | at the round end: round results first, `finishers [1]`, no AI turn scheduled; confirmation sets `gameOver` true with no new deal |
| F18 (web addition) | Human completes 10th goal and goes out in the same action | round results first, then confirmation sets `gameOver` true, `finishers [0]` (or `[0,1]` if the AI also laid down its 10th goal earlier in this round) |
| F19 (web addition) | New game after game over | fresh deck and players, no goals completed, `activePlayer 0`, `WaitForPickup`, `gameOver` false |
