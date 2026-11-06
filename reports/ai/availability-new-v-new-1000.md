# Automated AI independent first rounds

Engine commit: 6665abe313911c23951df847091ad95b24c6d28d. Seeds 1001–2000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1120 laydowns.

Reward exponent: 1.65 (production). Three-run selection multiplier: 1.05 (production). Missing-card offset: 1.

Equivalent-target retention: enabled (same actual points and missing count).

Runtime: 204.66 seconds; 11645 player turns; 3 worker(s). All artificial AI waits are disabled. Policy source IDs and frozen baseline hashes are recorded in the JSON.

Policies by seat: improved versus improved. Starter: alternating seats.

The improved policy uses the selection weights recorded above; the baseline policy is frozen at d64208e. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are automated-policy observations, not predictions of win rates against a human. Laydown timing includes successful laydowns only; pursuit statistics include abandoned goals. A pursuit counts each own turn on which its goal was targeted, so mid-turn switches can expose two goals in one turn.

## Goal statistics (all participating policies)

| Goal | Points | Laydowns | Share | First laydown | Round wins | Mean own turns | Median | Min–max |
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

## Policy results

| Policy | Player-rounds | Wins | Laydowns | Ended without laydown | Abandoned pursuits |
|---|---:|---:|---:|---:|---:|
| improved | 2000 | 1000 | 1120 | 880 | 3403 |

## Goal statistics: improved

| Goal | Laydowns | Share | Wins | Mean own turns to lay down | Pursuits | Abandoned | Mean own turns per abandoned pursuit |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2S | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 3S | 6 | 0.5% | 6 | 7.5 | 6 | 0 | — |
| 1S 1R | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 2R | 0 | 0.0% | 0 | — | 0 | 0 | — |
| 2S 1R | 40 | 3.6% | 40 | 6.5 | 40 | 0 | — |
| 4S | 133 | 11.9% | 124 | 4.5 | 133 | 0 | — |
| 3S 1R | 491 | 43.8% | 491 | 5.7 | 1136 | 645 | 2.5 |
| 1S 2R | 252 | 22.5% | 154 | 4.5 | 307 | 55 | 2.0 |
| 3R | 46 | 4.1% | 33 | 5.2 | 763 | 717 | 2.3 |
| 2S 2R | 152 | 13.6% | 152 | 7.3 | 2138 | 1986 | 3.6 |

## Starter breakdown

| Starter | Rounds | Seat 0 wins | Seat 1 wins | Capped |
|---|---:|---:|---:|---:|
| Seat 0 (improved) | 500 | 279 | 221 | 0 |
| Seat 1 (improved) | 500 | 242 | 258 | 0 |

Raw per-match/per-round events: [JSON](availability-new-v-new-1000.json). Aggregate data: [CSV](availability-new-v-new-1000.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1001 --max-round-turns 500 --workers 3 --policy improved --opponent improved --alternate-start --output reports/ai/availability-new-v-new-1000`
