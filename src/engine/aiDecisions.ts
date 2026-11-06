import type { Card } from './card';
import type { Player } from './player';
import { getCardScores, lowestCard, wantsDiscard } from './ai';
import { availableAICards, bestGoalAssessment, type GoalAssessment } from './aiGoals';

const usedCards = (plan: GoalAssessment) => new Set(plan.groups.flatMap(group => group.cards));

// A witness allocation remains feasible after discarding any unused card. No
// removal can improve the true best allocation. An unused natural therefore
// preserves the selected allocation without running the search once per card. Private slots are
// included in the allocation, but only cards actually in hand may be discarded.
export function chooseAIDiscard(player: Player, allocation?: GoalAssessment | null): Card {
  if (player.laidDown) return lowestCard(getCardScores(player));
  if (!player.hand.length) throw new Error('Empty hand in AI discard');
  const pool = availableAICards(player);
  const plan = allocation ?? bestGoalAssessment(player,pool);
  if (!plan) throw new Error('No unfinished goal in AI discard');
  const used = usedCards(plan);
  const unused = player.hand.filter(card => !used.has(card));
  const natural = unused.find(card => !card.isWild);
  if (natural) return natural;

  // Small/custom hands can need every card; an unused wild may also be replaceable
  // by a natural at equal fitness. Compare legal removals explicitly in those cases.
  let chosen = unused[0] ?? player.hand[0];
  let best = unused.length ? plan : bestGoalAssessment(player,pool.filter(c => c !== chosen));
  for (const card of player.hand) {
    if (card === chosen || (unused.length && card.isWild)) continue;
    const candidate = bestGoalAssessment(player,pool.filter(c => c !== card));
    if (!candidate) continue;
    if (!best || candidate.score > best.score || (candidate.score === best.score && (
      candidate.missing < best.missing || (candidate.missing === best.missing && chosen.isWild && !card.isWild)
    ))) { chosen = card; best = candidate; }
  }
  return chosen;
}

export function shouldPickUpDiscard(player: Player, discard?: Card, current?: GoalAssessment | null): boolean {
  if (!discard) return false;
  if (player.laidDown) return wantsDiscard(player,discard);
  const pool = availableAICards(player);
  const before = current ?? bestGoalAssessment(player,pool);
  const pickupPool = [...player.hand,discard,...(player.goal?.formations.flatMap(f => f.cards) ?? [])];
  const after = bestGoalAssessment(player,pickupPool);
  if (!before || !after) return false;
  const used = usedCards(after);
  // A visible card that contributes nothing to the chosen allocation is not an
  // improvement, even if the bounded search happened to find a different plan.
  if (!used.has(discard)) return false;
  if (after.missing === 0 && used.size === pool.length+1) {
    // A goal may consume the entire hand and end the round without a discard.
    return after.score >= before.score;
  }
  if (after.score <= before.score) return false;
  // Removing an unused original card retains the improved score. Re-shelving
  // after pickup returns old private slots, so any such card becomes discardable.
  if (pool.some(card => !used.has(card))) return true;
  // If every card is required (usually a small test/custom hand), include the
  // compulsory discard in the comparison rather than counting a free extra card.
  return pool.some(card => {
    const retained = bestGoalAssessment(player,pickupPool.filter(c => c !== card));
    return retained !== null && retained.score > before.score;
  });
}
