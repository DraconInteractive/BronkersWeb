# Public opponent awareness

The previous browser default is preserved as `publicAwareAI`
(`public-pressure-and-denial-v1`). The new default adds
[match and goal planning](16-ai-match-planning.md). This prior policy keeps
the aggressive reward weighting, availability assessment, formation search and
table tactics, adding the two requested changes below. `aggressiveAI` preserves
the previous `availability-and-going-out-v1` control; its twenty historical replay
checks still pass. The conservative experimental policy is unchanged.

## Bombing pressure

`Game.aiKnowledge` exposes opponents' committed status and visible hand counts.
Until commitment the count is always 13, matching the UI, even if the opponent has
shelved private formations or drawn a fourteenth card. It exposes neither hidden
cards nor private goal selection, formations or progress. Committed opponents'
cards stay concealed; only their count and exposed formations are available.

Pressure is zero before an opponent lays down. Once committed, it is zero with
seven or more cards, 0.3 with five/six, 0.6 with three/four, and 1 with at most two.
These are deliberately simple heuristic weights, not calibrated probabilities.

The AI discounts unfinished goals by dividing their existing score by
`1 + pressure * scarcityAdjustedMissingCards`. Ready goals receive no reward bonus.
At critical pressure (at most two visible cards), a ready goal takes priority over
unfinished goals so the AI can bank points before a possible exit. A proven legal
immediate win retains first priority. The same preference is used for pickup and
discard assessment, including whether a visible pickup can secure a goal.

Without pressure goal assessment retains the previous aggressive behaviour.
It reassesses before and after each pickup. Match score, round budget and long-term
goal scheduling are not part of this change.

## Defensive discards

When an opponent has laid down, any exposed formation can help them, including
our own exposed formations. Discard evaluation tries each candidate on cloned
formations using the real validators. Nothing is added to the actual table.

Among unused natural cards that preserve the chosen allocation, prefer candidates
with no visible use. If all are useful, rank simple extensions below wildcard
reclaims, with playable wilds the highest help category. General removal searches
use denial as a tie-break at equal goal fitness. After laydown, denial breaks ties
between cards of equal existing retention value. Stable ties preserve hand order.

This does not break a better own allocation merely to deny an opponent, sacrifice
wildcard retention arbitrarily, or withhold a final discard that wins the round.
It does not infer an uncommitted opponent's private goal or cards.

## Evaluation

```sh
./scripts/with-node npm run simulate:banking -- --matches 200 --seed 6001 --workers 3 --policy public-aware --opponent aggressive --output reports/ai/public-awareness-v-aggressive-200
```

This is a separate 200-match check (2,000 rounds), using the same ten-round banking
rules as the previous experiment. Each policy starts five rounds per match;
initial starters alternate across all workers. Policy IDs and labels are recorded
in the report. Animation delays are skipped and cards are conserved after every
turn. This is a smaller evaluation than the prior 2,000-match study, not a repeat
of that study. The banking runner's default remains conservative versus the
preserved aggressive control, so the earlier experiment can still be reproduced.

For independent first-round comparisons, the existing runner now also accepts
`--opponent aggressive`. Historical JSON/CSV reports remain unchanged.

## Recorded check

[The 200-match report](../reports/ai/public-awareness-v-aggressive-200.md) records
2,000 completed rounds with no caps. Revised won 88 matches, previous won 100,
and 12 were tied. Mean points were 46.510 versus 46.215; bombing rates were 24.90%
versus 33.70%. This shows the intended defensive behaviour, but no clear overall
match-winning improvement. The two requested features were evaluated together;
the sample does not isolate their individual effects. No weights were retuned
following the result. The prior control remains available for further testing.

Historical reports label the prior policy `improved`; use `public-aware` to select
that same policy now. Its implementation and policy ID remain unchanged.
