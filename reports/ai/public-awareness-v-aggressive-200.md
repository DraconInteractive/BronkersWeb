# improved versus aggressive: 200 ten-round matches

Completed 200/200; capped 0; ties 12 (6.00%). 2000 completed-match rounds.
Mean round length 15.40 player turns. Runtime 310.5 seconds. Source e1091df3e89a9349a5e82cf7f5707f012b7ad4dd; tracked changes false.

| Policy | Match wins | Win % (ties included) | Mean points | Round wins | Bombs inflicted | Bombs suffered | Laydowns | Mean own turns to lay down |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| improved | 88 | 44.00% | 46.510 | 938 | 674 | 498 | 1502 | 6.406 |
| aggressive | 100 | 50.00% | 46.215 | 1062 | 498 | 674 | 1326 | 6.214 |

| Goal | Points | improved laydowns | % of its laydowns | aggressive laydowns | % of its laydowns |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 89 | 5.93% | 6 | 0.45% |
| 3S | 1 | 59 | 3.93% | 19 | 1.43% |
| 1S 1R | 3 | 168 | 11.19% | 111 | 8.37% |
| 2R | 3 | 99 | 6.59% | 61 | 4.60% |
| 2S 1R | 5 | 191 | 12.72% | 182 | 13.73% |
| 4S | 5 | 156 | 10.39% | 178 | 13.42% |
| 1S 2R | 8 | 192 | 12.78% | 195 | 14.71% |
| 3S 1R | 8 | 199 | 13.25% | 199 | 15.01% |
| 2S 2R | 10 | 191 | 12.72% | 195 | 14.71% |
| 3R | 10 | 158 | 10.52% | 180 | 13.57% |

## Protocol

- rounds: 10
- policies: public-pressure-and-denial-v1, availability-and-going-out-v1
- scoring: Goal points banked immediately on laydown, once per player/round; no round-win bonus. Bombed players score zero for that round.
- goals: Each goal usable once per player per match; goal sheets reset between matches.
- starters: Seat 0 improved, seat 1 aggressive; initial starter alternates by match; round starter alternates within each match.
- conservative: Ready goals first; otherwise sqrt(reward)/(availability distance+1), without aggressive exit-card cost. Shared immediate-win override and move search.
- aggressive: Preserved aggressive control: reward^1.65 (3R multiplier 1.05)/(availability distance+0.35*exitCards+1).
- improved: Aggressive control plus public-count bombing pressure and discard denial. No hidden opponent cards, private progress, match score or round budget.
- Both players receive the same legal move/search capabilities and see only their own cards and public cards. Animation delays are disabled.
- Each seed is a separate match. Goals carry over between its rounds; each match starts with fresh sheets. Results use points, not rounds won.
- A round cap aborts the match. Capped partial matches are included in raw files but excluded from all completed-match statistics.
- This experimental scoring format does not change the browser match-ending rules. The browser uses improved; aggressive preserves the previous control.

## Interpretation and validation

`improved` is the revised browser default (`public-pressure-and-denial-v1`); `aggressive` is the preserved previous control (`availability-and-going-out-v1`).

The revised AI was bombed in 24.90% of rounds, compared with 33.70% for the control. It banked in 75.10% versus 66.30%. Mean points were 46.510 versus 46.215, but the revised AI won 88 matches to the control’s 100, with 12 ties. This check supports the intended defensive behaviour, not a demonstrated improvement in match-winning strength.

The mean paired score advantage was +0.295 points; an approximate 95% confidence interval is -1.192 to 1.782 points. The interval includes zero. The sample is 200 matches, not the earlier 2,000-match study. Neither policy was retuned after this comparison.

The changes are tested together. This comparison does not isolate the effect of bombing pressure from discard denial. Match score and the remaining-round budget are still excluded. Successful-laydown turn averages exclude bombed players and should not be interpreted as an unconditional completion-time estimate.

### Initial starter strata

| Initial starter | Matches | Revised wins | Previous wins | Ties |
|---|---:|---:|---:|---:|
| Revised | 100 | 46 | 46 | 8 |
| Previous | 100 | 42 | 54 | 4 |

### Checks

- All 209 unit tests and the production build passed. Tests cover hidden-information isolation, public pressure thresholds, ready-goal banking through the real turn engine, pressure-aware pickups, defensive discard choices, wildcard swaps, read-only table checks and winning discards.
- Twenty historical rounds still reproduce the previous aggressive control exactly; the older baseline replays also pass.
- Nine browser checks passed across Chromium, Firefox and mobile Chromium.
- Independent audit passed: 200 unique seeds (6001–6200), 2,000 completed rounds, 100 initial starts per policy and five round starts per policy per match. Every score equals the goal laydown events; no goal is banked twice; winner and bombing flags agree with events; CSV row counts match the JSON.
- All 104 cards were conserved after every turn. No 500-turn cap was reached. The implementation was committed and clean during the comparison.

Raw files: [summary JSON](public-awareness-v-aggressive-200-summary.json), [matches CSV](public-awareness-v-aggressive-200-matches.csv), [rounds CSV](public-awareness-v-aggressive-200-rounds.csv), [complete compressed JSON](public-awareness-v-aggressive-200.json.gz).
