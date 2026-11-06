# Automated AI independent first rounds

Engine commit: 6665abe313911c23951df847091ad95b24c6d28d. Seeds 1–1000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1269 laydowns.

Reward exponent: 1.65 (production). Three-run selection multiplier: 1.05 (production). Missing-card offset: 1.

Equivalent-target retention: enabled (same actual points and missing count).

Runtime: 216.73 seconds; 13454 player turns; 3 worker(s). All artificial AI waits are disabled. Policy source IDs and frozen baseline hashes are recorded in the JSON.

Policies by seat: improved versus baseline. Starter: alternating seats.

The improved policy uses the selection weights recorded above; the baseline policy is frozen at d64208e. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are automated-policy observations, not predictions of win rates against a human. Laydown timing includes successful laydowns only; pursuit statistics include abandoned goals. A pursuit counts each own turn on which its goal was targeted, so mid-turn switches can expose two goals in one turn.

## Goal statistics (all participating policies)

| Goal | Points | Laydowns | Share | First laydown | Round wins | Mean own turns | Median | Min–max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | 0 | — | — | — |
| 3S | 1 | 6 | 0.5% | 1 | 6 | 6.2 | 6.5 | 2–12 |
| 1S 1R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2R | 3 | 2 | 0.2% | 0 | 2 | 8.0 | 8 | 3–13 |
| 2S 1R | 5 | 57 | 4.5% | 17 | 51 | 6.4 | 6 | 1–15 |
| 4S | 5 | 88 | 6.9% | 71 | 81 | 4.2 | 4 | 1–12 |
| 3S 1R | 8 | 454 | 35.8% | 387 | 454 | 5.9 | 5 | 1–21 |
| 1S 2R | 8 | 429 | 33.8% | 364 | 202 | 5.4 | 5 | 1–17 |
| 3R | 10 | 79 | 6.2% | 60 | 50 | 7.4 | 7 | 2–18 |
| 2S 2R | 10 | 154 | 12.1% | 100 | 154 | 8.4 | 8 | 3–23 |

## Policy results

| Policy | Player-rounds | Wins | Laydowns | Ended without laydown | Abandoned pursuits |
|---|---:|---:|---:|---:|---:|
| improved | 1000 | 684 | 740 | 260 | 1641 |
| baseline | 1000 | 316 | 529 | 471 | 1631 |

## Goal statistics: improved

| Goal | Laydowns | Share | Wins | Mean own turns to lay down | Pursuits | Abandoned | Mean own turns per abandoned pursuit |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2S | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 3S | 6 | 0.8% | 6 | 6.2 | 7 | 1 | 1.0 |
| 1S 1R | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 2R | 2 | 0.3% | 2 | 8.0 | 2 | 0 | — |
| 2S 1R | 48 | 6.5% | 48 | 7.3 | 48 | 0 | — |
| 4S | 76 | 10.3% | 75 | 4.4 | 77 | 1 | 1.0 |
| 3S 1R | 292 | 39.5% | 292 | 6.1 | 604 | 312 | 2.7 |
| 1S 2R | 164 | 22.2% | 117 | 5.3 | 188 | 24 | 1.7 |
| 3R | 31 | 4.2% | 23 | 7.7 | 357 | 326 | 2.6 |
| 2S 2R | 121 | 16.4% | 121 | 8.7 | 1098 | 977 | 3.8 |

## Goal statistics: baseline

| Goal | Laydowns | Share | Wins | Mean own turns to lay down | Pursuits | Abandoned | Mean own turns per abandoned pursuit |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2S | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 3S | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 1S 1R | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 2R | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 2S 1R | 9 | 1.7% | 3 | 1.6 | 18 | 9 | 1.0 |
| 4S | 12 | 2.3% | 6 | 2.8 | 13 | 1 | 1.0 |
| 3S 1R | 162 | 30.6% | 162 | 5.6 | 332 | 170 | 2.7 |
| 1S 2R | 265 | 50.1% | 85 | 5.4 | 515 | 250 | 2.4 |
| 3R | 48 | 9.1% | 27 | 7.3 | 727 | 679 | 3.7 |
| 2S 2R | 33 | 6.2% | 33 | 7.3 | 555 | 522 | 3.4 |

## Starter breakdown

| Starter | Rounds | Seat 0 wins | Seat 1 wins | Capped |
|---|---:|---:|---:|---:|
| Seat 0 (improved) | 500 | 356 | 144 | 0 |
| Seat 1 (baseline) | 500 | 328 | 172 | 0 |

Raw per-match/per-round events: [JSON](availability-new-v-old-1000.json). Aggregate data: [CSV](availability-new-v-old-1000.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --max-round-turns 500 --workers 3 --policy improved --opponent baseline --alternate-start --output reports/ai/availability-new-v-old-1000`
