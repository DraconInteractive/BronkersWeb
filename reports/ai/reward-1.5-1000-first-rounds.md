# Automated AI independent first rounds

Engine commit: 3228fd88a4461ecfaaf960ed3cd278d25c2ba8f4. Seeds 1–1000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1854 laydowns.

Both seats use the production AI, including its current reward weighting. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are self-play observations, not predictions of win rates against a human.

| Goal | Points | Laydowns | Share | First laydown in round | Mean personal turns to lay down |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 1 | 0.1% | 1 | 1.0 |
| 3S | 1 | 0 | 0.0% | 0 | — |
| 1S 1R | 3 | 784 | 42.3% | 518 | 2.2 |
| 2R | 3 | 6 | 0.3% | 4 | 2.2 |
| 2S 1R | 5 | 576 | 31.1% | 293 | 4.5 |
| 4S | 5 | 196 | 10.6% | 73 | 5.0 |
| 3S 1R | 8 | 74 | 4.0% | 22 | 8.1 |
| 1S 2R | 8 | 204 | 11.0% | 87 | 5.7 |
| 3R | 10 | 13 | 0.7% | 2 | 9.6 |
| 2S 2R | 10 | 0 | 0.0% | 0 | — |

Raw per-match/per-round events: [JSON](reward-1.5-1000-first-rounds.json). Aggregate data: [CSV](reward-1.5-1000-first-rounds.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --max-round-turns 500 --output reports/ai/reward-1.5-1000-first-rounds`
