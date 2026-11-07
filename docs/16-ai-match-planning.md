# Match and remaining-goal planning

`improvedAI` (`match-and-goal-planning-v1`) adds the two requested planning features
on top of public bombing pressure and defensive discards. `publicAwareAI`
(`public-pressure-and-denial-v1`) preserves the immediately preceding policy.
The earlier `aggressiveAI` and `conservativeAI` controls also remain available.

## Live points context

Open `/?mode=points`, or choose **Start a 10-round points match** under Controls.
This starts a new match. The header shows the round and banked scores; round
results show totals. Each player can score each goal once. Points are banked at
laydown and retained even when the opponent goes out. Bombed players score zero
for that round. After exactly ten rounds, the higher total wins; equal totals are
a draw. Starters alternate between rounds. New game resets scores and goal sheets.

The ordinary URL continues the classic goal-completion format. It has no fixed
round budget, so the new policy uses the preceding public-opponent tactics there.
No artificial ten-round score objective is applied to a classic match.

The AI receives its own score, the opponent's public score, round/limit and the
opponent's remaining goal-sheet descriptors. Completed goals reflect past public
laydowns. Descriptors contain only name, points, set count and run count: no
private formations, current goal selection, hand identities or deck contents.
The engine supplies this context in the browser and the banking simulator.

## 1. Adjust risk to the match situation

The existing aggressive availability/exit assessment remains the starting point.
The policy estimates the future scoring opportunities on both goal sheets, then
adjusts the reward exponent by at most ±0.45. A projected deficit favours larger
rewards; a projected lead reduces risk. The adjustment grows as the round budget
shrinks. Public bombing pressure and legal move checks still apply. Goal reward
points themselves never change and there is no completion-points bonus.

The policy also checks actual mathematical bounds:

- A ready goal that secures a win even if the opponent banks their highest possible
  remaining rewards takes priority.
- Prefer goals that still permit a match win over ones whose maximum attainable
  total guarantees a loss. Prefer a possible draw over a guaranteed loss.
- A low-value immediate round win cannot override an attainable match comeback.
  For example, down nine on the final round, banking one cannot win; the policy
  instead pursues an available ten-point goal, even under public bombing pressure.
- Once match feasibility is respected, known legal round exits retain priority.

Selection, pickup and discard assessment use the same preference ordering.

## 2. Plan across the remaining goal sheet

For an unknown future hand, each goal gets a simple shape-based future value:
`points / (1 + 0.12 * max(0, requiredCards - 6) + 0.35 * runs)`.
This is a heuristic prior, not a calibrated completion probability.

For each candidate, reserve at most one unfinished goal per future round. Compare
future value if it is banked now versus if this round is bombed and the goal stays
available. This accounts for both the round spent and the option consumed. The
opportunity factor stays between 0.75 and 1, so the future-hand estimate cannot
overwhelm the real hand assessment. Equally rewarding difficult goals suited to
the current hand can be completed while preserving easier fallback goals.
Completed goals never contribute future points; no goal can fill two future slots.

This is bounded planning over up to ten goals, not an exhaustive search of future
deals. It does not read hidden cards. Forecasts and weights need further evaluation.

## Validation and comparison

```sh
./scripts/with-node npm run simulate:banking -- --matches 200 --seed 7201 --workers 3 --policy improved --opponent public-aware --output reports/ai/match-planning-v-public-aware-200
```

This is 200 ten-round matches (2,000 rounds), balanced for initial starter, with
fresh sheets between matches. Both policies receive identical public context;
the control ignores score/round context as before. The engine banks points and
an independent simulation ledger checks every total. Card conservation is checked
after each turn. The controls' saved games are replayed in unit tests.

The independent-first-round runner still uses classic mode and therefore does
not evaluate match planning. Use the banking runner for this comparison.
