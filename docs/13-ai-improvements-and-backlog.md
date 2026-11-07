# AI improvements and next work

## Delivered in this iteration

The baseline is the complete AI policy at `d64208e03883edb7de85e9fde9675d6605969498`,
frozen under `tests/ai-baseline`. It is not the original random-goal desktop AI.
The baseline adapter preserves its exact move order and its choice to wait a turn
before adding after laydown. Twenty historical rounds are replayed in unit tests;
the benchmark verifies hashes of frozen files and shared card rules.

The improved policy adds:

- **Scarcity-aware progress.** Partial sets/runs count useful unseen natural copies
  and wilds. Open runs differ from inside gaps; publicly exhausted outs cost more.
  Only own cards, exposed formations and the current discard pile are observed.
  Unknown cards include both deck and opponents' private cards: these are rough
  availability estimates, not a peek at the deck or exact draw probabilities.
- **Round-finishing cost.** Unplayable cards expected after laydown add a modest
  cost. For complete goals, actual legal layoff simulations replace the estimate.
  A proven legal exit (including the final discard) beats an unfinished high-value
  goal. Merely completing a formation gets no separate bonus.
- **Better ready allocations.** Among complete layouts still in the search beam,
  choose the one that sheds the most leftovers. This can avoid making two sets of
  the same rank when sets of two different ranks allow the whole hand to play.
- **Legal table tactics.** Add to tables immediately after committing to laydown,
  as the human already can. Consider playable natural discard pickups after
  laydown. Compare two dry-run natural-first move orders, including wild swaps,
  and apply the resulting moves through the same formation validators.
- **Failure-aware telemetry.** Record switched/unfinished/capped goal pursuits as
  well as successful laydowns. Own-turn exposure can overlap for two goals when
  the AI changes target within one turn; it is not additive clock time.

The reward exponent and three-run preference stay at the calibrated values.
The improved score uses scarcity-adjusted missing cards plus a small estimated
post-laydown clearing cost. This iteration prioritises observed round wins rather
than forcing the previous goal-frequency targets.

## Required evaluation

Every trial is a fresh first round: all ten goals start available. Artificial
800 ms waits are skipped. Card conservation is checked after every turn.

1. Seeds 1–1000: improved in seat 0 versus frozen baseline in seat 1. Alternate the
   starting seat by global trial index: improved starts 500, baseline starts 500.
2. Seeds 1001–2000: improved versus improved, also with 500 starts per seat.

Workers receive policy, starting-order and weight arguments explicitly. Reports
separate wins by starter and goal distributions by policy. Caps are failures to
complete a trial, not silently counted as wins or discarded from the raw data.
Pilot rounds are exploratory and are not added to the final 2,000-round totals.

## Deferred work to revisit

| Priority | Work | Why deferred / acceptance criteria |
|---|---|---|
| 1 | Public observation memory | Track visible pickups, discards and wild swaps after they leave the current public table. Handle discard recycling without double-counting cards. Tests must prove that hidden opponent/deck changes cannot affect decisions. |
| 2 | Deeper partial allocation search | The 24-state beam and greedy maximal natural groups remain bounded. Explore natural subsets and competing wildcard allocations; compare completion and win rates against this version with a phone-runtime budget. Ready allocations are improved now, but general exhaustive search is not delivered. |
| 3 | Exact short-hand table solver | Two legal move orders can miss a better sequence. Add bounded search for small remaining hands, especially overlapping runs, ace endpoints and repeated wild swaps. Capture concrete missed-win fixtures first. |
| 4 | Discard denial beyond exposed formations | Basic denial against exposed formations is delivered in [public opponent awareness](15-ai-public-opponents.md). Pickup/discard memory and inference about hidden goals remain deferred; never inspect private hands. |
| 5 | Full-match progress benchmark | Fresh-round wins do not prove superiority over all ten-goal matches. Later test goal-lock progression and finishing the whole sheet, keeping the fresh-round benchmark as a separate diagnostic. |
| 6 | Calibrate uncertainty and weights on held-out seeds | Twelve useful outs and the finishing-cost coefficient are heuristics. Validate runtime, confidence intervals and unfamiliar seeds before further reward/distribution tuning. Do not optimise only a small pilot or successful laydowns. |

Keep the old snapshot immutable for future comparisons. Version a new baseline
explicitly if the improved policy becomes the next reference.

## Recorded evaluation

[The complete 2,000-round evaluation](../reports/ai/availability-2000-round-evaluation.md)
records the exact protocol above. The improved policy won 684–316 against the
frozen baseline: 356/500 when starting and 328/500 when the baseline started.
New-versus-new rounds averaged 11.645 individual player turns; successful laydowns
averaged 5.527 own turns. Every round completed without a cap. This supports
stronger first-round play against the baseline, not a claim about human or full-
match win rates. Goal frequencies changed with the new objective; they were not
retuned to force the previous 8–10% ten-point distribution.
