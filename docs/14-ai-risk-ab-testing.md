# Conservative versus aggressive AI

The original aggressive policy (`availability-and-going-out-v1`) remains exported
as `aggressiveAI` for reproducing this experiment. The browser now uses the later
`improvedAI` described in [match and goal planning](16-ai-match-planning.md).
Twenty seeds from
`reports/ai/availability-new-v-new-1000.json` are replayed as regression controls in
`tests/parity/aiBanking.test.ts`.

The additional `conservativeAI` (`conservative-banking-v1`) shares the control's
formation search, availability model, legal moves, table tactics and immediate-win
override. It prefers a completed goal over an unfinished goal. Otherwise its
selection score is `sqrt(goal.points) / (availabilityDistance + 1)`. Unlike the
aggressive policy, it does not penalize cards left after laydown: banking early is
its priority. Pickup and discard assessment use the same conservative preference.
There is no numeric immediate-completion bonus; completion is an explicit banking
priority for this experimental policy.

## Ten-round banking experiment

```sh
./scripts/with-node npm run simulate:banking -- --matches 2000 --seed 3001 --workers 3 --output reports/ai/conservative-v-aggressive-2000
```

Each match runs exactly ten rounds with fresh goal sheets at match start. A goal
can be used once by each player per match, as in the existing rules. Points are
banked immediately on laydown, once per player per round, and retained regardless
of who goes out. A player bombed before laying down scores zero for that round.
There is no bonus for going out. The higher total after ten rounds wins; equal
totals are ties. Thus the maximum per player is 54 points.

Seat 0 is conservative and seat 1 aggressive. The initial starter alternates over
matches; the starter also alternates within each match, giving each policy five
starts per match. Each seed drives the existing engine's seeded random generator.
Decisions use only the player's own cards and public cards. The two policies have
the same legal-move capabilities. Animation waits and automatic AI scheduling are
disabled; the harness explicitly executes the real turn method for both seats.
Cards are checked for conservation after every turn.

A 500-player-turn cap aborts the match and is reported explicitly. Partial capped
matches appear in raw files but are excluded from completed-match statistics.
The report includes the source revision and whether tracked files had changes.

Outputs: Markdown summary, JSON summary, match CSV, round CSV, and compressed JSON
containing every match, round, laydown event, scores, winners and bombs. Counts and
percentages in the goal table describe goals actually laid down, not intentions.
Mean laydown turns are each player's own turns since the start of that round.

This harness tests the proposed scoring variant. It does not change the browser's
match-ending rules or add point scoring to its interface. Neither policy adapts
to the match score or remaining rounds yet; that is a separate future improvement.

## Recorded result

[The 2,000-match report](../reports/ai/conservative-v-aggressive-2000.md) covers
20,000 rounds with no caps. Aggressive won 1,525 matches, conservative 443, and 32
were tied. Mean scores were 46.895 and 39.775 respectively. Conservative was bombed
less often, but banked the ten-point goals much less often. This is evidence about
these two fixed policies in this ten-round format, rather than a general verdict
on conservative play. The browser now uses the later aggressive policy with public opponent awareness.
