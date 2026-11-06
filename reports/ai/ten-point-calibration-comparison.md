# Ten-point goal calibration

Goal: bring both 3R and 2S 2R to roughly 8–10% of laydowns, preserving the goal-aligned pickup/discard policy. Both comparison runs use seeds 1–1000, production AI in both seats, all goals available at the start, and one opening round per trial. Both completed every round without a turn-limit cap.

Final selection score: `points^1.65 * goalWeight / (missingCards + 1)`, where `goalWeight` is 1.05 for 3R and 1 otherwise. Actual goal rewards remain unchanged. Keep the current goal when another goal offers the same actual reward points and needs the same number of cards; the small shape preference does not force a switch between equivalent targets. Pickup/discard use the same assessment. No completion bonus was introduced.

| Goal | Points | Before count | Before share | After count | After share |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | 0.0% |
| 3S | 1 | 0 | 0.0% | 0 | 0.0% |
| 1S 1R | 3 | 0 | 0.0% | 0 | 0.0% |
| 2R | 3 | 0 | 0.0% | 0 | 0.0% |
| 2S 1R | 5 | 145 | 10.2% | 14 | 1.0% |
| 4S | 5 | 32 | 2.2% | 27 | 2.0% |
| 3S 1R | 8 | 406 | 28.5% | 419 | 31.0% |
| 1S 2R | 8 | 669 | 47.0% | 655 | 48.4% |
| 3R | 10 | 74 | 5.2% | 133 | 9.8% |
| 2S 2R | 10 | 98 | 6.9% | 105 | 7.8% |

Final goal shares: **3R 9.8%** and **2S 2R 7.8%**. The latter is just below 8% in this sample; both are close to the requested range.

Laydowns: 1424 → 1353. Mean individual player turns per round: 15.52 → 16.00.

Final batch runtime: 219.20 seconds on three workers. All 800 ms AI waits were skipped. The runner checked all 104 physical cards after every turn. The first 200 final trials exactly match the selected pilot. Goal counts, shares, wins, median/min/max turns, and CSV totals were independently audited. Build, 139 engine tests and nine targeted browser checks pass.

Calibration used short pilots followed by full validation. Raising the exponent alone lifted 2S 2R much faster than 3R. Adding a small 3R weight without preserving equivalent targets overshot 3R in full validation. The final tie rule avoids unnecessary changes between equally rewarding, equally close targets. Missing-offset variants were explored but not shipped; production remains at offset 1.

A simulation argument-propagation issue was caught during calibration: workers initially ignored a new override. That inert pilot was discarded. Workers now receive all CLI arguments, validate requested weights/mode/turn limits, and verify loaded scoring values. Historical baseline first-round reports used default settings and are unaffected.

These are observed self-play frequencies, not goal quotas or evidence of a win-rate improvement against a human.

[Baseline report](goal-aligned-decisions-1000-first-rounds.md) · [Final per-goal statistics](tuned-ten-point-goals-1000-first-rounds.md) · [Earlier rejected full validation](reward-1.65-three-run-1.05-1000-first-rounds.md)

[Calibration trial summary](ten-point-calibration-trials.csv). Percentages are shares of laydowns, not shares of rounds.
