import { expect, test } from 'vitest';
import { assessGoals, selectAIGoal, shelveAIPlan } from '../../src/engine/aiGoals';
import { Player } from '../../src/engine/player';
import { Game } from '../../src/engine/game';
import { seededRng } from '../../src/engine/rng';
import { cards } from '../cards';

function player(hand: string, available?: number[]) {
  const p = new Player(); p.hand = cards(hand);
  if (available) p.goals.forEach((goal,i) => { goal.completed = !available.includes(i); });
  return p;
}

test.each([
  ['5H 5S 5D 8H 8S 8D KH', '2S'],
  ['3H 4H 5H 6H 9D 10D JD QD KS', '2R'],
  ['5H 5S 5D 8H 8S 8D 3C 4C 5C 6C KH', '2S 1R'],
  ['3H 3S 3D 5H 5S 5D 8H 8S 8D KH KS KD AC', '4S'],
])('lays down a ready available goal fitting %s → %s', (hand,name) => {
  const p = player(hand);
  p.goals.forEach(goal => { goal.completed = goal.name !== name; });
  const plan = selectAIGoal(p)!;
  expect(plan.goal.name).toBe(name); expect(plan.missing).toBe(0);
  shelveAIPlan(p,plan);
  expect(p.canLayDown).toBe(true);
  expect(p.goal!.formations.every(f => f.isValid())).toBe(true);
});

test('weights missing cards by reward points instead of always picking the easiest goal', () => {
  const p = player('5D 5S 5C 8H 9H KH KS',[0,2]);
  const assessments = assessGoals(p);
  expect(assessments.map(a => a.missing)).toEqual([1,2]);
  expect(assessments[1].score).toBeGreaterThan(assessments[0].score);
  expect(selectAIGoal(p)!.goal.name).toBe('1S 1R');
});

test('a ready low-reward goal gets no priority over a better weighted incomplete goal', () => {
  const p = player('5H 5S 5D 8H 8S 8D 3C 4C 5C',[0,4]);
  const assessments = assessGoals(p);
  expect(assessments.map(a => a.missing)).toEqual([0,1]);
  expect(assessments[0].score).toBe(1);
  expect(assessments[1].score).toBeCloseTo(5**1.65/2);
  expect(selectAIGoal(p)!.goal.name).toBe('2S 1R');
});

test('linear distance penalty pursues an 8-point goal over a ready 5-point goal', () => {
  const p = player('5H 5S 5D 8H 8S 8D 3C 4C 5C 6C KH KS',[4,6]);
  const assessments = assessGoals(p);
  expect(assessments.map(a => a.missing)).toEqual([0,1]);
  // The previous squared distance penalty preferred the ready 5-point goal.
  expect(8**1.65/2**2).toBeLessThan(5**1.65);
  expect(assessments[1].score).toBeCloseTo(8**1.65/2);
  expect(assessments[1].score).toBeGreaterThan(assessments[0].score);
  expect(selectAIGoal(p)!.goal.name).toBe('3S 1R');
});

test('does not count one physical card in both a set and a run', () => {
  const p = player('5H 5S 5D 3H 4H 6H',[2]);
  const plan = selectAIGoal(p)!;
  expect(plan.missing).toBe(1);
  const used = plan.groups.flatMap(g => g.cards);
  expect(new Set(used).size).toBe(used.length);
});

test.each(['QH KH AH 2C 5D 5S 5C','AH 3H 4H 2C 5D 5S 5C'])('aces and a wild complete a valid mixed goal: %s', hand => {
  const p = player(hand,[2]); const plan = selectAIGoal(p)!;
  expect(plan.missing).toBe(0); shelveAIPlan(p,plan);
  expect(p.canLayDown).toBe(true); expect(p.goal!.formations.every(f => f.isValid())).toBe(true);
});

test('one wild is shared across the assessment rather than reused in every slot', () => {
  const p = player('5H 5S 8H 8S 2C',[0]); const plan = selectAIGoal(p)!;
  expect(plan.missing).toBe(1);
  expect(plan.groups.flatMap(g => g.cards).filter(c => c.isWild)).toHaveLength(1);
});

test('multiple copies of a rank in a suit cannot fill different run positions', () => {
  const p = player('5H 5H 6H 6H',[3]);
  expect(assessGoals(p)[0].missing).toBe(4);
});

test('can change goals using shelved cards without losing cards or marking goals complete', () => {
  const p = player('3H 4H 5H 6H 9D 10D JD QD KS');
  p.goal = p.goals[0]; const old = p.goal;
  const shelved = cards('8H 8S 8D'); old.formations[0].trySet(shelved);
  const original = [...p.hand,...shelved];
  const plan = selectAIGoal(p)!;
  expect(p.goal).not.toBe(old); expect(old.formations.every(f => !f.cards.length)).toBe(true);
  expect(new Set(p.hand)).toEqual(new Set(original)); expect(p.hand).toHaveLength(original.length);
  shelveAIPlan(p,plan);
  const after = [...p.hand,...p.goal!.formations.flatMap(f => f.cards)];
  expect(new Set(after)).toEqual(new Set(original)); expect(after).toHaveLength(original.length);
  expect(p.goals.every(g => !g.completed)).toBe(true);
});

test('completed goals are excluded and an already laid-down goal is locked', () => {
  const p = player('5H 5S 5D 8H 8S 8D',[1]);
  expect(selectAIGoal(p)!.goal).toBe(p.goals[1]);
  p.laidDown = true; const goal = p.goal; const hand = [...p.hand];
  expect(selectAIGoal(p)).toBeNull(); expect(p.goal).toBe(goal); expect(p.hand).toEqual(hand);
});

test('ties retain the existing goal and repeat assessments are deterministic and read-only', () => {
  const p = player('3H 4H 5H 6H 9D 10D JD QD 8S 8C 8D',[2,3]);
  p.goal = p.goals[3]; const hand = [...p.hand];
  const results = assessGoals(p);
  expect(assessGoals(p)).toEqual(results); expect(p.hand).toEqual(hand);
  expect(p.goal.formations.every(f => !f.cards.length)).toBe(true);
  expect(selectAIGoal(p)!.goal).toBe(p.goals[3]);
});

test('reassesses after pickup and lays down the new goal during the same turn', async () => {
  const g = new Game(seededRng(42),async () => {}); const p = g.players[1];
  p.hand = cards('3H 4H 5H 6H 9D 10D JD 8S 8C KS');
  p.goals.forEach((goal,i) => { goal.completed = ![2,3].includes(i); });
  expect(selectAIGoal(p)!.goal).toBe(p.goals[2]);
  g.discardPile = cards('3C'); g.deck.cards = cards('QD'); g.activePlayer = 1;
  await g.processAITurn();
  expect(p.goal).toBe(p.goals[3]); expect(p.laidDown).toBe(true);
  expect(p.goal!.completed).toBe(true); expect(g.activePlayer).toBe(0);
});


test('three-run selection boost leaves actual reward points unchanged', () => {
  const p = player('',[8,9]);
  const assessments = assessGoals(p);
  expect(assessments.map(a => a.goal.points)).toEqual([10,10]);
  expect(assessments[0].score).toBeCloseTo(10**1.65*1.05/13);
  expect(assessments[1].score).toBeCloseTo(10**1.65/15);
});
