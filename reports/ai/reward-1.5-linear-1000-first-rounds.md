# Automated AI independent first rounds

Engine commit: 585a49d726f31a0cd8bedb0a19ef6ba923ac1e8c. Seeds 1–1000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1371 laydowns.

Runtime: 159.72 seconds; 17599 player turns; 3 worker(s). All artificial AI waits are disabled.

Both seats use the production AI, including its current reward weighting. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are self-play observations, not predictions of win rates against a human.

| Goal | Points | Laydowns | Share | First laydown in round | Mean personal turns to lay down |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | — |
| 3S | 1 | 0 | 0.0% | 0 | — |
| 1S 1R | 3 | 0 | 0.0% | 0 | — |
| 2R | 3 | 0 | 0.0% | 0 | — |
| 2S 1R | 5 | 88 | 6.4% | 74 | 4.4 |
| 4S | 5 | 33 | 2.4% | 28 | 4.7 |
| 3S 1R | 8 | 466 | 34.0% | 334 | 7.4 |
| 1S 2R | 8 | 655 | 47.8% | 492 | 6.6 |
| 3R | 10 | 84 | 6.1% | 48 | 9.3 |
| 2S 2R | 10 | 45 | 3.3% | 24 | 11.7 |

Raw per-match/per-round events: [JSON](reward-1.5-linear-1000-first-rounds.json). Aggregate data: [CSV](reward-1.5-linear-1000-first-rounds.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --max-round-turns 500 --workers 3 --output reports/ai/reward-1.5-linear-1000-first-rounds`
