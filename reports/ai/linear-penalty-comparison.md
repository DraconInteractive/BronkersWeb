# Linear distance penalty comparison

Both runs use seeds 1–1000, fresh games with all ten goals available, and the production AI in both seats. Each trial stops at its first round result. All 1,000 rounds completed in each run; no caps or stalls occurred.

Baseline: `points^1.5 / (missingCards + 1)^2`. Updated: `points^1.5 / (missingCards + 1)`. Pickup/discard scoring is unchanged. Shares count both players’ laydowns, including the player who did not win.

| Goal | Points | Before count | Before share | After count | After share |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 1 | 0.1% | 0 | 0.0% |
| 3S | 1 | 0 | 0.0% | 0 | 0.0% |
| 1S 1R | 3 | 784 | 42.3% | 0 | 0.0% |
| 2R | 3 | 6 | 0.3% | 0 | 0.0% |
| 2S 1R | 5 | 576 | 31.1% | 88 | 6.4% |
| 4S | 5 | 196 | 10.6% | 33 | 2.4% |
| 3S 1R | 8 | 74 | 4.0% | 466 | 34.0% |
| 1S 2R | 8 | 204 | 11.0% | 655 | 47.8% |
| 3R | 10 | 13 | 0.7% | 84 | 6.1% |
| 2S 2R | 10 | 0 | 0.0% | 45 | 3.3% |

Laydowns: 1854 → 1371. Mean player turns per round: 20.59 → 17.60.

Both players laid down in 85.4% of baseline rounds and 37.1% of updated rounds. The larger goals use more of the hand when committed, so laydown is closer to going out.

Batch time: 253.09 seconds for the old serial run; 159.72 seconds for the new three-worker run. Both skip all 800 ms AI waits. Numeric search keys replace repeated string allocations. The comparison also includes a policy change and different turn counts, so it is not an isolated implementation-speed benchmark.

Numeric keys were separately checked against string keys on 20 seeds before changing the formula: all trial outcomes and target decisions matched. The updated formula produced identical serial and parallel results over 20 seeds, and the full new run matches those serial trials. The runner checked card conservation after every turn. Headless workers disable watching, HMR and WebSockets.

Goals worth eight or ten points now account for 91.2% of laydowns, versus 15.7% before. No one- or three-point goals were laid down in the updated sample. This is a strong swing toward high-value goals, not evidence of a higher win rate against humans.

[Baseline report](reward-1.5-1000-first-rounds.md) · [Updated report](reward-1.5-linear-1000-first-rounds.md)
