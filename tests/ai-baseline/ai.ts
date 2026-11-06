// Frozen AI baseline from d64208e03883edb7de85e9fde9675d6605969498; do not tune.
import type { Card } from '../../src/engine/card';
import type { Player } from '../../src/engine/player';
export function getCardScores(player: Player, discard?: Card): Map<Card,number> {
  if (!player.goal) throw new Error('Null goal in card scores');
  const scores = new Map<Card,number>();
  if (discard) scores.set(discard, discard.isWild ? 10 : 0);
  for (const c of player.hand) scores.set(c,c.isWild ? 10 : 0);
  const cards = [...scores.keys()];
  const sets = player.goal.formations.filter(f => f.kind === 'Set' && !f.cards.length).length;
  const runs = player.goal.formations.filter(f => f.kind === 'Run' && !f.cards.length).length;
  for (const card of cards) {
    if (card.isWild) continue;
    const s = Math.fround(Math.fround(cards.filter(c => c.value === card.value).length / 3) * sets);
    const r = Math.fround(Math.fround(cards.filter(c => c.suit === card.suit && Math.abs(card.value-c.value) < 4).length / 4) * runs);
    scores.set(card, Math.max(s,r));
  }
  return scores;
}
export function sumF(scores: Map<Card,number>) { return Math.fround([...scores.values()].reduce((a,b) => a+b, 0)); }
export function lowestCard(scores: Map<Card,number>): Card {
  let chosen: Card | undefined; let min = Infinity;
  for (const [card,score] of scores) if (score < min) { chosen = card; min = score; }
  if (!chosen) throw new Error('Empty hand in AI discard');
  return chosen;
}
export function wantsDiscard(player: Player, discard?: Card) {
  const scores = getCardScores(player);
  const withDiscard = getCardScores(player,discard);
  const candidate = Math.fround(sumF(withDiscard)-Math.min(...withDiscard.values()));
  return Math.fround(candidate-sumF(scores)) > Math.fround(0.6);
}
export function tryGetFormation(player: Player, card: Card): Card[] | null {
  if (card.isWild || !player.goal) return null;
  const wilds = player.hand.filter(c => c.isWild);
  const naturals = player.hand.filter(c => c.value === card.value);
  const set = [...naturals,...wilds].slice(0,3);
  if (player.goal.formations.some(f => f.kind === 'Set' && !f.cards.length) && naturals.length >= 2 && set.length === 3) return set;
  if (player.goal.formations.some(f => f.kind === 'Run' && !f.cards.length)) {
    const suited = player.hand.filter(c => c.suit === card.suit && !c.isWild);
    let best: Card[] = [];
    for (const rank of card.value === 1 ? [1,14] : [card.value]) {
      for (let start = Math.max(1,rank-3); start <= Math.min(rank,11); start++) {
        const window = Array.from({length:4}, (_,i) => suited.find(c => c.value === (start+i === 14 ? 1 : start+i))).filter((c): c is Card => !!c);
        if (window.length >= 3 && 4-window.length <= wilds.length && window.length > best.length) best = window;
      }
    }
    if (best.length) return [...best,...wilds.slice(0,4-best.length)];
  }
  return null;
}
