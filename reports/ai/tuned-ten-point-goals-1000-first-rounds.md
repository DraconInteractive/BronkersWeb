# Automated AI independent first rounds

Engine commit: 8e1121382b19ea8fb8166270a7e590c138b04735. Seeds 1–1000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1353 laydowns.

Reward exponent: 1.65 (production). Three-run selection multiplier: 1.05 (production). Missing-card offset: 1.

Equivalent-target retention: enabled (same actual points and missing count).

Runtime: 219.20 seconds; 15999 player turns; 3 worker(s). All artificial AI waits are disabled.

Both seats use the production AI with the selection weights recorded above. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are self-play observations, not predictions of win rates against a human.

| Goal | Points | Laydowns | Share | First laydown | Round wins | Mean own turns | Median | Min–max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | 0 | — | — | — |
| 3S | 1 | 0 | 0.0% | 0 | 0 | — | — | — |
| 1S 1R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2R | 3 | 0 | 0.0% | 0 | 0 | — | — | — |
| 2S 1R | 5 | 14 | 1.0% | 13 | 6 | 2.6 | 2.5 | 1–7 |
| 4S | 5 | 27 | 2.0% | 25 | 26 | 2.7 | 3 | 1–10 |
| 3S 1R | 8 | 419 | 31.0% | 322 | 419 | 6.4 | 6 | 1–24 |
| 1S 2R | 8 | 655 | 48.4% | 508 | 359 | 5.8 | 5 | 1–21 |
| 3R | 10 | 133 | 9.8% | 77 | 85 | 8.3 | 8 | 1–18 |
| 2S 2R | 10 | 105 | 7.8% | 55 | 105 | 9.8 | 10 | 3–25 |

Raw per-match/per-round events: [JSON](tuned-ten-point-goals-1000-first-rounds.json). Aggregate data: [CSV](tuned-ten-point-goals-1000-first-rounds.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --max-round-turns 500 --workers 3 --output reports/ai/tuned-ten-point-goals-1000-first-rounds`
