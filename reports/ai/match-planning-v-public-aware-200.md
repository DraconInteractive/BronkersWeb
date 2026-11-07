# improved versus public-aware: 200 ten-round matches

Completed 200/200; capped 0; ties 15 (7.50%). 2000 completed-match rounds.
Mean round length 15.73 player turns. Runtime 307.2 seconds. Source d16ca30cd05c6bc8a6c9be58fcb464335b394cd4; tracked changes false.

| Policy | Match wins | Win % (ties included) | Mean points | Round wins | Bombs inflicted | Bombs suffered | Laydowns | Mean own turns to lay down |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| improved | 93 | 46.50% | 46.880 | 1007 | 462 | 513 | 1487 | 6.343 |
| public-aware | 92 | 46.00% | 47.170 | 993 | 513 | 462 | 1538 | 6.229 |

| Goal | Points | improved laydowns | % of its laydowns | public-aware laydowns | % of its laydowns |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 86 | 5.78% | 98 | 6.37% |
| 3S | 1 | 55 | 3.70% | 67 | 4.36% |
| 1S 1R | 3 | 155 | 10.42% | 170 | 11.05% |
| 2R | 3 | 85 | 5.72% | 103 | 6.70% |
| 2S 1R | 5 | 182 | 12.24% | 193 | 12.55% |
| 4S | 5 | 169 | 11.37% | 159 | 10.34% |
| 1S 2R | 8 | 195 | 13.11% | 196 | 12.74% |
| 3S 1R | 8 | 200 | 13.45% | 199 | 12.94% |
| 2S 2R | 10 | 195 | 13.11% | 187 | 12.16% |
| 3R | 10 | 165 | 11.10% | 166 | 10.79% |

## Protocol

- rounds: 10
- policies: match-and-goal-planning-v1, public-pressure-and-denial-v1
- scoring: Goal points banked immediately on laydown, once per player/round; no round-win bonus. Bombed players score zero for that round.
- goals: Each goal usable once per player per match; goal sheets reset between matches.
- starters: Seat 0 improved, seat 1 public-aware; initial starter alternates by match; round starter alternates within each match.
- conservative: Ready goals first; otherwise sqrt(reward)/(availability distance+1), without aggressive exit-card cost. Shared immediate-win override and move search.
- aggressive: Preserved aggressive control: reward^1.65 (3R multiplier 1.05)/(availability distance+0.35*exitCards+1).
- engineMode: points
- engineScoreAudit: true
- improved: Bounded score-aware risk and remaining-goal opportunity values, plus public bombing pressure and discard denial. Uses public scores/round budget; no hidden cards or private opponent progress.
- public-aware: Previous public-pressure-and-denial-v1 control, without match planning.
- Both players receive the same legal move/search capabilities and see only their own cards and public cards. Animation delays are disabled.
- Each seed is a separate match. Goals carry over between its rounds; each match starts with fresh sheets. Results use points, not rounds won.
- A round cap aborts the match. Capped partial matches are included in raw files but excluded from all completed-match statistics.
- This experimental scoring format does not change the browser match-ending rules. The browser uses improved; aggressive preserves the previous control.

## Interpretation and validation

`improved` is the new `match-and-goal-planning-v1` policy. `public-aware` is the immediately preceding `public-pressure-and-denial-v1` control. Both retain public bombing awareness and discard denial; the new policy additionally uses match score, remaining rounds and future goal opportunities.

The new policy won 93 matches, the previous policy 92, and 15 were tied. Mean scores were 46.880 versus 47.170. The mean paired score difference was −0.290 points; an approximate 95% confidence interval is -1.535 to 0.955 points. This 200-match batch shows no clear overall strength gain.

The policy and weights were fixed before this final comparison. Development smoke runs used separate seeds and are not included. Score-aware risk and goal-sheet planning were tested together; this comparison does not isolate their individual effects. Future-goal values are bounded heuristics for an unknown hand, not calibrated probabilities or hidden-card predictions.

### Initial starter strata

| Initial starter | Matches | New wins | Previous wins | Ties |
|---|---:|---:|---:|---:|
| New | 100 | 52 | 39 | 9 |
| Previous | 100 | 41 | 53 | 6 |

### Results by score at round start

These are descriptive, conditional round statistics. They are not a causal comparison: policies reach different score states and remaining goal sheets. Late-round scores can also change after the opponent banks within a round. Match-level uncertainty above treats matches, not these correlated rounds, as independent observations.

| Policy | Round-start position | Rounds | Mean points banked | Bombed | Round wins |
|---|---|---:|---:|---:|---:|
| New | ahead | 804 | 3.803 | 29.85% | 39.43% |
| New | tied | 305 | 4.456 | 34.75% | 48.85% |
| New | behind | 891 | 5.566 | 18.74% | 60.72% |
| Previous | ahead | 891 | 3.979 | 27.05% | 39.28% |
| Previous | tied | 305 | 4.820 | 29.18% | 51.15% |
| Previous | behind | 804 | 5.496 | 16.42% | 60.57% |

### Points by round

| Round | New mean points | Previous mean points |
|---|---:|---:|
| 1 | 4.310 | 4.605 |
| 2 | 4.575 | 4.475 |
| 3 | 4.295 | 4.880 |
| 4 | 4.720 | 4.770 |
| 5 | 4.700 | 5.550 |
| 6 | 5.010 | 4.920 |
| 7 | 4.975 | 4.920 |
| 8 | 5.045 | 4.780 |
| 9 | 4.715 | 4.485 |
| 10 | 4.535 | 3.785 |

### Validation

- 229 unit tests passed, including late comeback feasibility, secure banking, future-goal slot limits, completed-goal exclusion, retaining easier fallback goals, consistent pickup/discard assessment, immediate scoring, final totals, draws, resets and hidden-information isolation.
- The previous public-aware policy reproduced five saved games; the aggressive and older baseline replay controls also passed.
- The build passed. Browser checks passed across Chromium, Firefox and mobile Chromium, covering classic interactions, points banking and round advancement, match winners/draws/resets, compact score layout and keyboard mode switching.
- Independent audit passed: 200 unique seeds (7201–7400), 2,000 completed rounds, 100 initial starts per policy and five round starts per policy per match. Scores equal the goal bank events; no completed goal is reused; all winners and bombs agree with events; CSV rows match JSON.
- The engine’s scores and final match winners agreed with the independent banking ledger. All 104 cards were conserved after every turn. No 500-turn cap was reached.
- The implementation was committed and clean during the comparison. Browser points mode and the simulator both use the same live scoring context. The classic game uses public-opponent tactics without a fixed points budget.

Raw data: [summary JSON](match-planning-v-public-aware-200-summary.json), [match CSV](match-planning-v-public-aware-200-matches.csv), [round CSV](match-planning-v-public-aware-200-rounds.csv), [complete compressed JSON](match-planning-v-public-aware-200.json.gz).
