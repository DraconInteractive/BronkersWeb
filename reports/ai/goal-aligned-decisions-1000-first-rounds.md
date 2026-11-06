# Automated AI independent first rounds

Engine commit: 38a6bc8ec33603abe1e7036dcdc9e53a3f30ab03. Seeds 1–1000.

1000/1000 independent first rounds completed; 0 capped. 1000/1000 rounds completed; 1424 laydowns.

Runtime: 213.09 seconds; 15520 player turns; 3 worker(s). All artificial AI waits are disabled.

Both seats use the production AI, including its current reward weighting. Delays are skipped; no human strategy is modelled. Each player turn counts once. Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included. Limits: 500 turns per round. Capped trials remain in the raw results and their observed laydowns remain in this table.

All counts below are from independent opening rounds; no goal was locked before a trial began. These are self-play observations, not predictions of win rates against a human.

| Goal | Points | Laydowns | Share | First laydown in round | Mean personal turns to lay down |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 0 | 0.0% | 0 | — |
| 3S | 1 | 0 | 0.0% | 0 | — |
| 1S 1R | 3 | 0 | 0.0% | 0 | — |
| 2R | 3 | 0 | 0.0% | 0 | — |
| 2S 1R | 5 | 145 | 10.2% | 105 | 4.1 |
| 4S | 5 | 32 | 2.2% | 28 | 3.4 |
| 3S 1R | 8 | 406 | 28.5% | 293 | 6.1 |
| 1S 2R | 8 | 669 | 47.0% | 477 | 5.8 |
| 3R | 10 | 74 | 5.2% | 48 | 7.4 |
| 2S 2R | 10 | 98 | 6.9% | 49 | 9.3 |

Raw per-match/per-round events: [JSON](goal-aligned-decisions-1000-first-rounds.json). Aggregate data: [CSV](goal-aligned-decisions-1000-first-rounds.csv).

Reproduce: `./scripts/with-node npm run simulate:ai -- --rounds 1000 --seed 1 --max-round-turns 500 --workers 3 --output reports/ai/goal-aligned-decisions-1000-first-rounds`
