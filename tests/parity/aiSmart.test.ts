import { expect, test } from 'vitest';
import { availabilityModel } from '../../src/engine/aiAvailability';
import { smartAssessGoals, smartBestGoal, smartPickup } from '../../src/engine/aiSmart';
import { planTableAdds } from '../../src/engine/aiTable';
import { CardSet, Run } from '../../src/engine/formation';
import { Game } from '../../src/engine/game';
import { Player } from '../../src/engine/player';
import { seededRng } from '../../src/engine/rng';
import { baselineAI } from '../ai-baseline/policy';
import { cards, names } from '../cards';
import type { AIKnowledge } from '../../src/engine/aiKnowledge';
const context=(knownCards=cards(''),table: (CardSet|Run)[]=[],hasDrawn=true): AIKnowledge=>({knownCards,table,hasDrawn});

test('an open run has more useful draws than an inside gap',()=>{
  const open=cards('5H 6H 7H'),closed=cards('5H 6H 8H');
  const a=availabilityModel(open,context(open)),b=availabilityModel(closed,context(closed));
  expect(a.usefulOuts([{kind:'Run',cards:open}])).toEqual([12]);
  expect(b.usefulOuts([{kind:'Run',cards:closed}])).toEqual([10]);
  expect(a.groupsCost([{kind:'Run',cards:open}])).toBeLessThan(b.groupsCost([{kind:'Run',cards:closed}]));
});

test('set pairs recognise all remaining matching ranks and wilds',()=>{
  const pair=cards('5H 5S');
  expect(availabilityModel(pair,context(pair)).usefulOuts([{kind:'Set',cards:pair}])).toEqual([14]);
});

test('publicly exhausted natural/wild outs make a gap expensive',()=>{
  const hand=cards('5H 6H 8H');
  const exposed=cards('7H 7H 2H 2H 2D 2D 2S 2S 2C 2C');
  const blocked=availabilityModel(hand,context([...hand,...exposed]));
  expect(blocked.usefulOuts([{kind:'Run',cards:hand}])).toEqual([0]);
  expect(blocked.groupsCost([{kind:'Run',cards:hand}])).toBeGreaterThan(availabilityModel(hand,context(hand)).groupsCost([{kind:'Run',cards:hand}]));
});

test('aces high and rank-two wild positions use legal run windows',()=>{
  const high=cards('QH KH AH'),low=cards('AH 3H 4H');
  expect(availabilityModel(high,context(high)).usefulOuts([{kind:'Run',cards:high}])).toEqual([10]);
  expect(availabilityModel(low,context(low)).usefulOuts([{kind:'Run',cards:low}])).toEqual([8]);
});

test('hypothetical removals do not make discarded known cards unseen again',()=>{
  const hand=cards('5H 5S 5D');
  const k=context(hand),group={kind:'Set' as const,cards:hand.slice(0,2)};
  expect(availabilityModel(hand,k).usefulOuts([group])).toEqual(availabilityModel(hand.slice(0,2),k).usefulOuts([group]));
});

test('knowledge never contains hidden opponent cards or private formations',()=>{
  const g=new Game(seededRng(42),async()=>{});const p=g.players[1];
  const before=g.aiKnowledge(p);
  g.human.hand=cards('AH KH QH 2C');g.human.goal=g.human.goals[0];
  g.human.goal.formations[0].trySet(cards('7H 7D 7S'));
  const after=g.aiKnowledge(p);
  expect(after.knownCards).toEqual(before.knownCards);expect(after.table).toEqual(before.table);
  expect(smartAssessGoals(p,after)).toEqual(smartAssessGoals(p,before));
});

test('table planning is read-only and handles reclaimed wildcards and extensions',()=>{
  const run=new Run();run.trySet(cards('3H 4H 2C 6H'));
  const hand=cards('5H 7H 8H 2D'),original=[...run.cards];
  const plan=planTableAdds(hand,[run]);
  expect(plan.remaining).toHaveLength(0);expect(run.cards).toEqual(original);expect(hand).toHaveLength(4);
  const actual=[...hand];
  for(const move of plan.moves){
    expect(actual).toContain(move.card);const r=move.formation.tryAdd(move.card);expect(r.ok).toBe(true);
    actual.splice(actual.indexOf(move.card),1);actual.push(...r.swapped);
  }
  expect(actual).toHaveLength(0);expect(run.isValid()).toBe(true);
});

test('after laydown the AI takes a playable natural that the baseline ignores',()=>{
  const p=new Player();p.goal=p.goals[0];p.laidDown=true;
  p.goal.formations[0].trySet(cards('5H 5D 5S'));p.goal.formations[1].trySet(cards('8H 8D 8S'));
  p.hand=cards('KH');const top=cards('5C')[0];const k=context([...p.hand,top],p.goal.formations as CardSet[]);
  expect(baselineAI.pickup(p,k,top)).toBe(false);
  expect(smartPickup(p,k,top)).toBe(true);
});

test('a guaranteed legal exit takes precedence over an unfinished high-reward goal',()=>{
  const p=new Player();p.hand=cards('5H 5D 5S 5C 5H 5D 5S 8H 8D 8S 8C 8H 8D 8S');
  p.goals.forEach((g,i)=>{g.completed=![0,8].includes(i);});
  const before=[...p.hand];const k=context(p.hand);
  const plan=smartBestGoal(p,k)!;
  expect(plan.goal).toBe(p.goals[0]);expect(plan.immediateWin).toBe(true);
  expect(p.hand).toEqual(before);expect(p.goal).toBeNull();
});

test('the engine lays down, adds to its new formations and goes out in the same turn',async()=>{
  const g=new Game(seededRng(42),async()=>{});const p=g.players[1];
  p.hand=cards('5H 5D 5S 5C 5H 5D 5S 8H 8D 8S 8C 8H 8D');
  p.goals.forEach((goal,i)=>{goal.completed=![0,8].includes(i);});
  g.discardPile=cards('8S');g.deck.cards=cards('QC');g.activePlayer=1;
  const original=[...p.hand,...g.discardPile,...g.deck.cards];
  await g.processAITurn();
  expect(g.roundResult?.winner).toBe(1);expect(p.goal?.name).toBe('2S');expect(p.hand).toHaveLength(0);
  const after=[...p.hand,...p.goal!.formations.flatMap(f=>f.cards),...g.deck.cards,...g.discardPile];
  expect(after).toHaveLength(original.length);expect(new Set(after)).toEqual(new Set(original));
});

test('after laydown a known playable pickup lets the engine win without drawing the deck',async()=>{
  const g=new Game(seededRng(42),async()=>{});const p=g.players[1];p.goal=p.goals[0];p.laidDown=true;p.goal.completed=true;
  p.goal.formations[0].trySet(cards('5H 5D 5S'));p.goal.formations[1].trySet(cards('8H 8D 8S'));
  p.hand=cards('KH');g.discardPile=cards('5C');g.deck.cards=cards('QC');g.activePlayer=1;
  await g.processAITurn();
  expect(g.roundResult?.winner).toBe(1);expect(names(g.deck.cards)).toBe('QC');
});
