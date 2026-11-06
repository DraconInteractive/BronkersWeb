# Goal-aligned pickup/discard comparison

Both experiments use seeds 1–1000, the production AI in both seats, and a fresh game for every trial. All ten goals start available; each trial stops at its first round result. Both runs completed every round without a turn-limit cap.

The goal formula remains `points^1.5 / (missingCards + 1)`. The only strategic change is that pre-laydown pickup and discard now use the goal-allocation assessment instead of the legacy per-card scores. Endgame behaviour after laydown is unchanged. All artificial AI waits are skipped.

| Goal | Points | Before count | Before share | After count | After share |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | 0.0% |
| 3S | 1 | 0 | 0.0% | 0 | 0.0% |
| 1S 1R | 3 | 0 | 0.0% | 0 | 0.0% |
| 2R | 3 | 0 | 0.0% | 0 | 0.0% |
| 2S 1R | 5 | 88 | 6.4% | 145 | 10.2% |
| 4S | 5 | 33 | 2.4% | 32 | 2.2% |
| 3S 1R | 8 | 466 | 34.0% | 406 | 28.5% |
| 1S 2R | 8 | 655 | 47.8% | 669 | 47.0% |
| 3R | 10 | 84 | 6.1% | 74 | 5.2% |
| 2S 2R | 10 | 45 | 3.3% | 98 | 6.9% |

| Metric | Before | After |
|---|---:|---:|
| Completed rounds | 1000 | 1000 |
| Laydowns (both seats) | 1371 | 1424 |
| Mean player turns per round | 17.60 | 15.52 |
| Rounds with both players laid down | 37.1% | 42.4% |
| 10-point share of laydowns | 9.4% | 12.1% |
| Batch runtime (3 workers) | 159.72 s | 213.09 s |

Average rounds are 11.8% shorter. The 2S 2R count increased from 45 to 98; the 10-point share rose from 9.4% to 12.1%. Eight-point goals still account for 75.5% of all laydowns, with 1S 2R alone at 47.0%. No one- or three-point goals were laid down in either experiment. This improves measured goal completion pace without removing the preference for high-value goals.

The extra hypothetical pickup assessment increases batch CPU cost, despite fewer simulated turns. The reused selected allocation avoids a full search for every ordinary discard: unused cards can be removed without destroying that allocation. Explicit per-card evaluation handles cases with no unused natural. The underlying allocation search remains bounded, not exhaustive.

Checks: 137 engine tests, including retained-hand pickup comparisons, ace-high runs, whole-hand laydowns, hypothetical-state immutability, private-card restrictions, and wildcard tie breaks; nine targeted browser checks; card conservation after each simulated turn. The first 20 full-run trials exactly match the pilot. Report events and CSV aggregates were independently audited.

Self-play does not establish a win-rate improvement against a human.

[Previous report](reward-1.5-linear-1000-first-rounds.md) · [Updated report](goal-aligned-decisions-1000-first-rounds.md)
