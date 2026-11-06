import { expect, test } from 'vitest';
import { Player } from '../../src/engine/player';
import { chooseAIDiscard, shouldPickUpDiscard } from '../../src/engine/aiDecisions';
import { availableAICards, bestGoalAssessment, selectAIGoal, shelveAIPlan } from '../../src/engine/aiGoals';
import { getCardScores, lowestCard, wantsDiscard } from '../../src/engine/ai';
import { Game } from '../../src/engine/game';
import { seededRng } from '../../src/engine/rng';
import { cards, names } from '../cards';

function player(hand: string, goal = 8) {
  const p = new Player(); p.hand = cards(hand); p.goal = p.goals[goal];
  p.goals.forEach(g => { g.completed = g !== p.goal; });
  return p;
}
const runHand = 'AH QH KH 5D 6D 7D 8D 9S 10S JS 3C 6C 9C KC';

test('preserves ace-high run progress that legacy distance scoring would discard', () => {
  const p = player(runHand);
  expect(names([lowestCard(getCardScores(p))])).toBe('AH');
  expect(names([chooseAIDiscard(p)])).toBe('3C');
});

test('discard retains the best goal score obtainable after any legal removal', () => {
  const p = player(runHand); const pool = availableAICards(p);
  const chosen = chooseAIDiscard(p);
  const scores = p.hand.map(card => bestGoalAssessment(p,pool.filter(c => c !== card))!.score);
  expect(bestGoalAssessment(p,pool.filter(c => c !== chosen))!.score).toBe(Math.max(...scores));
});

test('picks up a visible run bridge but rejects an unhelpful duplicate', () => {
  const p = player('AH QH KH 5D 6D 7D 8D 9S JS QS 3C 6C 9C');
  expect(shouldPickUpDiscard(p,cards('10S')[0])).toBe(true);
  expect(shouldPickUpDiscard(p,cards('AH')[0])).toBe(false);
  expect(shouldPickUpDiscard(p)).toBe(false);
});

test('a pickup must still improve the goal after the compulsory discard', () => {
  const p = player('5H 5S 8H 8S',1);
  const extra = cards('KH')[0];
  expect(bestGoalAssessment(p,[...p.hand,extra])!.score).toBeGreaterThan(bestGoalAssessment(p)!.score);
  expect(shouldPickUpDiscard(p,extra)).toBe(false);
});

test('can take the final card for a goal consuming the entire hand without discarding', () => {
  const p = player('5H 5S 5D 8H 8S 8D 3C 4C 5C 6C 9D 10D JD',9);
  expect(shouldPickUpDiscard(p,cards('QD')[0])).toBe(true);
});

test('includes private cards in pickup/discard assessment without mutating them', () => {
  const p = player('AH QH KH 9S JS QS 3C 6C 9C');
  p.goal!.formations[0].trySet(cards('5D 6D 7D 8D'));
  const hand = [...p.hand]; const shelf = [...p.goal!.formations[0].cards]; const goal = p.goal;
  expect(shouldPickUpDiscard(p,cards('10S')[0])).toBe(true);
  const discarded = chooseAIDiscard(p);
  expect(p.hand).toContain(discarded); expect(shelf).not.toContain(discarded);
  expect(p.hand).toEqual(hand); expect(p.goal).toBe(goal); expect(p.goal!.formations[0].cards).toEqual(shelf);
});

test('decision assessment can switch to a different unfinished goal', () => {
  const p = player('3H 4H 5H 6H 9D 10D JD 8S 8C KS 3C 6S AC');
  p.goals.forEach((g,i) => { g.completed = ![2,3].includes(i); }); p.goal = p.goals[2];
  expect(shouldPickUpDiscard(p,cards('QD')[0])).toBe(true);
  expect(p.goal).toBe(p.goals[2]); // Hypothetical decisions never retarget the player.
});

test('returns a legal discard even when every card participates in a partial allocation', () => {
  const p = player('5H 5S 8H 8S',1);
  const choice = chooseAIDiscard(p);
  expect(p.hand).toContain(choice);
  const pool = availableAICards(p);
  const optimum = Math.max(...p.hand.map(c => bestGoalAssessment(p,pool.filter(card => card !== c))!.score));
  expect(bestGoalAssessment(p,pool.filter(c => c !== choice))!.score).toBe(optimum);
});

test('uses a supplied allocation after shelving and never discards its protected cards', () => {
  const p = player(runHand); const plan = selectAIGoal(p)!;
  shelveAIPlan(p,plan);
  const used = new Set(plan.groups.flatMap(g => g.cards));
  const chosen = chooseAIDiscard(p,plan);
  expect(p.hand).toContain(chosen); expect(used.has(chosen)).toBe(false);
  expect(p.goal!.formations[0].isValid()).toBe(true);
});

test('keeps existing endgame pickup and discard behaviour after laydown', () => {
  const p = player('KH 2C 4D',0); p.laidDown = true;
  const top = cards('2D')[0];
  expect(shouldPickUpDiscard(p,top)).toBe(wantsDiscard(p,top));
  expect(chooseAIDiscard(p)).toBe(lowestCard(getCardScores(p)));
});

test('engine picks up a useful visible bridge, lays down and conserves all cards', async () => {
  const g = new Game(seededRng(42),async () => {}); const p = g.players[1];
  p.goal = p.goals[3]; p.goals.forEach(goal => { goal.completed = goal !== p.goal; });
  p.hand = cards('3H 4H 5H 6H 9D 10D JD 8S 8C KS 3C 6S AC');
  const top = cards('QD')[0]; g.discardPile = [top]; g.deck.cards = cards('2C'); g.activePlayer = 1;
  const before = [...p.hand,...g.deck.cards,...g.discardPile];
  await g.processAITurn();
  expect(p.laidDown).toBe(true); expect(p.goal.formations.flatMap(f => f.cards)).toContain(top);
  expect(g.deck.cards).toHaveLength(1);
  const after = [...p.hand,...p.goal.formations.flatMap(f => f.cards),...g.deck.cards,...g.discardPile];
  expect(after).toHaveLength(before.length); expect(new Set(after)).toEqual(new Set(before));
});

test('preserves a spare wildcard when a natural can be discarded at equal goal fitness', () => {
  const p = player('5H 5S 5D 8H 8S 2C 2D 2S KH',1);
  const before = bestGoalAssessment(p)!;
  const discarded = chooseAIDiscard(p);
  expect(discarded.isWild).toBe(false);
  expect(bestGoalAssessment(p,p.hand.filter(c => c !== discarded))!.score).toBe(before.score);
});
