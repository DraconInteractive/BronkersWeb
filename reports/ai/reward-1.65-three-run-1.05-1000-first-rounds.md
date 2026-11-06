# Automated AI independent first rounds

Engine commit: 1ea44579c3713763a09d32bb4a5c150094dd8d8d. Seeds 1–1000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1357 laydowns.

Reward exponent: 1.65 (production). Three-run selection multiplier: 1.05 (production).

Equivalent-target retention: disabled (rejected calibration candidate).

Runtime: 219.44 seconds; 16286 player turns; 3 worker(s). All artificial AI waits are disabled.

Both seats use the production AI with the selection weights recorded above. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are self-play observations, not predictions of win rates against a human.

| Goal | Points | Laydowns | Share | First laydown | Round wins | Mean own turns | Median | Min–max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | 0 | — | — | — |
| 3S | 1 | 0 | 0.0% | 0 | 0 | — | — | — |
| 1S 1R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2S 1R | 5 | 18 | 1.3% | 16 | 8 | 2.9 | 3 | 1–7 |
| 4S | 5 | 27 | 2.0% | 25 | 26 | 2.7 | 2 | 1–10 |
| 3S 1R | 8 | 400 | 29.5% | 305 | 400 | 6.4 | 6 | 1–24 |
| 1S 2R | 8 | 659 | 48.6% | 503 | 367 | 5.9 | 5 | 1–21 |
| 3R | 10 | 154 | 11.3% | 95 | 100 | 8.7 | 8 | 1–23 |
| 2S 2R | 10 | 99 | 7.3% | 56 | 99 | 9.5 | 9 | 3–25 |

Raw per-match/per-round events: [JSON](reward-1.65-three-run-1.05-1000-first-rounds.json). Aggregate data: [CSV](reward-1.65-three-run-1.05-1000-first-rounds.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --max-round-turns 500 --workers 3 --output reports/ai/reward-1.65-three-run-1.05-1000-first-rounds`
