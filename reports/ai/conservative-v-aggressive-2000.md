# Conservative versus aggressive: 2000 ten-round matches

Completed 2000/2000; capped 0; ties 32 (1.60%). 20000 completed-match rounds.
Mean round length 15.80 player turns. Runtime 2579.5 seconds. Source ea6d7992d376bf9af7e5acc8e024bcc8eff5f93e; tracked changes false.

| Policy | Match wins | Win % (ties included) | Mean points | Round wins | Bombs inflicted | Bombs suffered | Laydowns | Mean own turns to lay down |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| conservative | 443 | 22.15% | 39.775 | 8911 | 5736 | 3128 | 16872 | 4.202 |
| aggressive | 1525 | 76.25% | 46.895 | 11089 | 3128 | 5736 | 14264 | 6.274 |

| Goal | Points | Conservative laydowns | % of its laydowns | Aggressive laydowns | % of its laydowns |
|---|---:|---:|---:|---:|---:|
| 2S | 1 | 2000 | 11.85% | 249 | 1.75% |
| 3S | 1 | 1999 | 11.85% | 631 | 4.42% |
| 1S 1R | 3 | 2000 | 11.85% | 1233 | 8.64% |
| 2R | 3 | 1799 | 10.66% | 870 | 6.10% |
| 2S 1R | 5 | 1999 | 11.85% | 1836 | 12.87% |
| 4S | 5 | 1839 | 10.90% | 1820 | 12.76% |
| 1S 2R | 8 | 1851 | 10.97% | 1971 | 13.82% |
| 3S 1R | 8 | 1847 | 10.95% | 1994 | 13.98% |
| 2S 2R | 10 | 1144 | 6.78% | 1946 | 13.64% |
| 3R | 10 | 394 | 2.34% | 1714 | 12.02% |

## Protocol

- rounds: 10
- policies: conservative-banking-v1, availability-and-going-out-v1
- scoring: Goal points banked immediately on laydown, once per player/round; no round-win bonus. Bombed players score zero for that round.
- goals: Each goal usable once per player per match; goal sheets reset between matches.
- starters: Seat 0 conservative, seat 1 aggressive; initial starter alternates by match; round starter alternates within each match.
- conservative: Ready goals first; otherwise sqrt(reward)/(availability distance+1), without aggressive exit-card cost. Shared immediate-win override and move search.
- aggressive: Unchanged production AI: reward^1.65 (3R multiplier 1.05)/(availability distance+0.35*exitCards+1).
- Both players receive the same legal move/search capabilities and see only their own cards and public cards. Animation delays are disabled.
- Each seed is a separate match. Goals carry over between its rounds; each match starts with fresh sheets. Results use points, not rounds won.
- A round cap aborts the match. Capped partial matches are included in raw files but excluded from all completed-match statistics.
- This experimental scoring format does not change the browser game or its default aggressive AI.

## Interpretation and audit

The aggressive control won 76.25% of matches against this conservative policy. Conservative banked more often (84.36% of rounds versus 71.32%) and was bombed less often (15.64% versus 28.68%), but its smaller rewards did not compensate for that advantage.

Aggressive averaged 7.1195 more points per match. An approximate 95% confidence interval for the paired mean score difference is 6.624 to 7.615 points, treating each match as one independent observation.

The ten-point goals explain much of the gap: conservative banked 3R in 19.70% of matches and 2S 2R in 57.20%; aggressive banked them in 85.70% and 97.30%, respectively. Together these goals contributed 7.69 points per conservative match and 18.30 per aggressive match. The round-by-round scores below are consistent with conservative leaving difficult, valuable goals until late in the match.

This compares two fixed policy bundles, not an isolated reward-exponent change: conservative also banks ready goals first and omits the exit-card cost. It does not establish that every conservative policy is weaker. A later experiment could test a moderate or score-aware policy; this batch was not tuned after seeing its results.

Laydown-turn averages include successful laydowns only. Bombed players have no laydown time. Goal percentages in the main table use each policy’s successful laydowns as the denominator; they are not fresh-first-round frequencies.

### Initial starter balance

| Initial starter | Matches | Conservative wins | Aggressive wins | Ties |
|---|---:|---:|---:|---:|
| Conservative | 1000 | 217 | 768 | 15 |
| Aggressive | 1000 | 226 | 757 | 17 |

### Points banked per round

| Round | Conservative mean points | Aggressive mean points | Conservative bombed | Aggressive bombed |
|---|---:|---:|---:|---:|
| 1 | 2.345 | 6.859 | 3.70% | 10.40% |
| 2 | 2.241 | 6.492 | 6.70% | 14.90% |
| 3 | 2.658 | 5.870 | 8.80% | 23.35% |
| 4 | 2.986 | 5.271 | 12.50% | 30.75% |
| 5 | 3.775 | 4.487 | 13.75% | 39.40% |
| 6 | 4.396 | 4.024 | 18.85% | 42.75% |
| 7 | 4.822 | 3.808 | 21.70% | 40.05% |
| 8 | 5.050 | 3.771 | 22.30% | 34.45% |
| 9 | 5.533 | 3.351 | 23.30% | 29.25% |
| 10 | 5.970 | 2.961 | 24.80% | 21.50% |

### Validation

- Independent audit passed: 2,000 distinct seeds (3001–5000), ten completed rounds per match, five round starts per policy per match, and 1,000 initial starts per policy.
- Every bank event matches the goal reward; no player repeats a completed goal; scores equal all bank events; every winner and bombing flag agrees with the round events. CSV rows agree with the compressed JSON.
- The engine checked all 104 cards for identity and conservation after every turn. No round reached the 500-turn cap.
- All 197 unit tests and the production build passed, including 20 exact historical replays of the unchanged aggressive control.
- All nine selected browser checks passed across Chromium, Firefox and mobile Chromium after pausing the test clock explicitly.
- The experiment source was committed and clean during the run. The later browser-test clock fix affects test timing only.

Raw data: [summary JSON](conservative-v-aggressive-2000-summary.json), [match CSV](conservative-v-aggressive-2000-matches.csv), [round CSV](conservative-v-aggressive-2000-rounds.csv), [compressed complete JSON](conservative-v-aggressive-2000.json.gz).
