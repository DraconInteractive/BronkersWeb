# Availability and going-out AI: 2,000-round evaluation

The improved policy won **684 of 1,000 rounds (68.4%)** against the frozen baseline at d64208e. The old AI won 316. The approximate binomial Wilson 95% interval for the new policy is 65.5–71.2%.

All rounds are independent first rounds with every goal initially available. Seats stay fixed by policy and the starter alternates by global trial index. There are exactly 500 starts per side, including across worker boundaries. No artificial 800 ms waits are used. Pilots are not included in these totals.

## New versus old: seeds 1–1000

| Starter | Rounds | New wins | Old wins | New win rate |
|---|---:|---:|---:|---:|
| New | 500 | 356 | 144 | 71.2% |
| Old | 500 | 328 | 172 | 65.6% |

| Policy | Laydowns | Ended without laying down | Pursuits | Abandoned pursuits |
|---|---:|---:|---:|---:|
| improved | 740 | 260 | 2381 | 1641 |
| baseline | 529 | 471 | 2160 | 1631 |

Mean round length: **13.45 individual player turns**.

## New versus new: seeds 1001–2000

Mean round length: **11.645 individual player turns**. Successful laydowns: **1120**, averaging **5.53 own turns** from round start. The starting player won 537/1,000 rounds.

| Goal | Points | Laydowns | Share | First laydown | Wins | Mean own turns | Median | Min–max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | 0 | — | — | — |
| 3S | 1 | 6 | 0.5% | 3 | 6 | 7.5 | 8 | 5–9 |
| 1S 1R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2S 1R | 5 | 40 | 3.6% | 24 | 40 | 6.5 | 6.5 | 3–11 |
| 4S | 5 | 133 | 11.9% | 120 | 124 | 4.5 | 4 | 1–14 |
| 3S 1R | 8 | 491 | 43.8% | 450 | 491 | 5.7 | 5 | 1–16 |
| 1S 2R | 8 | 252 | 22.5% | 232 | 154 | 4.5 | 4 | 1–12 |
| 3R | 10 | 46 | 4.1% | 39 | 33 | 5.2 | 5 | 1–12 |
| 2S 2R | 10 | 152 | 13.6% | 132 | 152 | 7.3 | 7 | 1–17 |

Successful laydown averages exclude players who did not lay down. Per-policy CSV/JSON also record unsuccessful goal pursuits. A pursuit counts own-turn exposure; two goals can be exposed in one turn if the target changes after pickup, so these durations are not additive clock time.

## Changes and limits

The new policy estimates useful unseen draws, considers the cost of shedding leftovers, chooses better complete allocations, takes known playable discard cards after laydown, and can add immediately after committing to laydown. Going-out sequences are dry-run on cloned formations and applied through the ordinary validators. Shared rules and actual goal points are unchanged. No hidden deck or opponent-hand data enters the policy.

This comparison supports improved first-round play against the frozen AI. It does not establish human win rates or superiority over full ten-goal matches. Allocation/table search is bounded, and copy-count draw estimates are heuristic. Observation memory, deeper search and full-match benchmarks remain deferred in the backlog.

Validation: 170 engine tests, including 20 historical baseline replays; nine targeted browser checks; build; frozen-source/shared-rule hashes; card conservation after every turn; independent audit of starter order, per-policy counts, pursuit outcomes and goal timing statistics. All 2,000 rounds completed without caps. Recorded simulation time: 421.4 seconds on three workers.

[Mixed-stage details](availability-new-v-old-1000.md) · [Self-play details](availability-new-v-new-1000.md) · [Deferred work](../../docs/13-ai-improvements-and-backlog.md)
