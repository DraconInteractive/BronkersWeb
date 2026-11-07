import {expect,test} from 'vitest';
import {Game} from '../../src/engine/game';
import {Player} from '../../src/engine/player';
import {CardSet,Run} from '../../src/engine/formation';
import {improvedAI,aggressiveAI} from '../../src/engine/aiPolicy';
import {bombingPressure,discardHelp,smartAssessGoals} from '../../src/engine/aiSmart';
import type {AIKnowledge} from '../../src/engine/aiKnowledge';
import {seededRng} from '../../src/engine/rng';
import {cards} from '../cards';

function knowledge(p:Player,count:number|null=2,table:AIKnowledge['table']=[]):AIKnowledge {
  return {knownCards:[...p.hand,...table.flatMap(f=>f.cards)],table,hasDrawn:true,
    opponents:[{laidDown:count!==null,cardsRemaining:count??13}]};
}
function competingGoals() {
  const p=new Player();p.hand=cards('5H 5D 5S 8H 8D 8S 6C 7C 8C 9C QH KD AC');
  p.goals.forEach((g,i)=>g.completed=![0,9].includes(i));return p;
}
function set(text:string){const f=new CardSet();expect(f.trySet(cards(text))).toBe(true);return f;}
function run(text:string){const f=new Run();expect(f.trySet(cards(text))).toBe(true);return f;}

test('public opponent view conceals cards and private progress until commitment',()=>{
  const g=new Game(seededRng(11),async()=>{});const p=g.players[1];const before=g.aiKnowledge(p);
  g.human.hand=cards('AH');g.human.goal=g.human.goals[0];g.human.goal.formations[0].trySet(cards('7H 7D 7S'));
  g.deck.cards=cards('KH QC');
  const hidden=g.aiKnowledge(p);expect(hidden).toEqual(before);
  expect(improvedAI.selectGoal(p,hidden)?.goal).toBe(aggressiveAI.selectGoal(p,before)?.goal);
  g.human.laidDown=true;
  expect(g.aiKnowledge(p).opponents).toEqual([{laidDown:true,cardsRemaining:1}]);
  g.human.hand=cards('KH');
  const publicView=g.aiKnowledge(p);g.human.hand=cards('QC');
  expect(g.aiKnowledge(p)).toEqual(publicView);g.dispose();
});

test('pressure depends on committed public counts, not a concealed one-card hand',()=>{
  const p=new Player();
  expect(bombingPressure({...knowledge(p),opponents:[{laidDown:false,cardsRemaining:1}]})).toBe(0);
  expect(bombingPressure(knowledge(p,13))).toBe(0);
  expect(bombingPressure(knowledge(p,6))).toBe(0.3);
  expect(bombingPressure(knowledge(p,4))).toBe(0.6);
  expect(bombingPressure(knowledge(p,2))).toBe(1);
});

test('default keeps its aggressive target without pressure, banks when opponent nears exit',()=>{
  const quiet=competingGoals();expect(improvedAI.selectGoal(quiet,knowledge(quiet,null))?.goal.name).toBe('2S 2R');
  const critical=competingGoals();expect(improvedAI.selectGoal(critical,knowledge(critical,2))?.goal.name).toBe('2S');
  const control=competingGoals();expect(aggressiveAI.selectGoal(control,knowledge(control,2))?.goal.name).toBe('2S 2R');
});

test('pressure discounts unfinished work, without increasing the reward of ready goals',()=>{
  const p=competingGoals();
  const quiet=smartAssessGoals(p,knowledge(p,13),undefined,'public-aware');
  const near=smartAssessGoals(p,knowledge(p,4),undefined,'public-aware');
  for(const plan of quiet){
    const risk=near.find(a=>a.goal===plan.goal)!;
    if(plan.missing)expect(risk.score).toBeLessThan(plan.score);
    else expect(risk.score).toBe(plan.score);
  }
});

test('pressure-aware pickup takes a card that banks a goal instead of chasing unfinished points',()=>{
  const p=competingGoals();p.hand=p.hand.filter(c=>!(c.value===5&&c.suit===2));
  const top=cards('5S')[0];const k=knowledge(p,2);k.knownCards=[...k.knownCards,top];
  expect(improvedAI.pickup(p,k,top)).toBe(true);
});

test('a certain immediate exit retains priority under pressure',()=>{
  const p=new Player();p.hand=cards('5H 5D 5S 5C 5H 5D 5S 8H 8D 8S 8C 8H 8D 8S');
  p.goals.forEach((g,i)=>g.completed=![0,8].includes(i));
  const plan=improvedAI.selectGoal(p,knowledge(p,1));expect(plan?.immediateWin).toBe(true);expect(plan?.goal.name).toBe('2S');
});

test('denial avoids feeding an opponent set among unused cards without breaking own plan',()=>{
  const p=new Player();p.hand=cards('5H 5D 8H 8D 7C QC');p.goals.forEach((g,i)=>g.completed=i!==0);
  const table=[set('7H 7D 7S')],k=knowledge(p,1,table);const plan=improvedAI.selectGoal(p,k)!;
  expect(improvedAI.discard(p,k,plan)).toBe(p.hand[5]); // Safe queen, keep both pairs.
  expect(aggressiveAI.discard(p,k,plan)).toBe(p.hand[4]);
  expect(p.hand).toHaveLength(6);expect(table[0].cards).toHaveLength(3);
});

test('denial checks our exposed table too: a committed opponent can add to either table',()=>{
  const p=new Player();p.goal=p.goals[0];p.laidDown=true;
  p.goal.formations[0].trySet(cards('7H 7D 7S'));p.goal.formations[1].trySet(cards('8H 8D 8S'));
  p.hand=cards('7C QC');const k=knowledge(p,1,p.goal.formations);
  expect(improvedAI.discard(p,k)).toBe(p.hand[1]);
});

test('denial recognises run extensions, wild swaps and wilds without mutating tables',()=>{
  const p=new Player(),r=run('3H 4H 2C 6H'),f=set('7H 7D 7S');const k=knowledge(p,2,[r,f]);
  const original=[...r.cards];
  expect(discardHelp(cards('7H')[0],k)).toBe(1);
  expect(discardHelp(cards('5H')[0],k)).toBe(2);
  expect(discardHelp(cards('2D')[0],k)).toBe(3);
  expect(discardHelp(cards('QC')[0],k)).toBe(0);
  expect(r.cards).toEqual(original);expect(r.isValid()).toBe(true);
});

test('no inference about hidden goals, no denial against an ineligible opponent',()=>{
  const p=new Player();p.hand=cards('7C QC');p.goal=p.goals[0];p.laidDown=true;
  const k=knowledge(p,null,[set('7H 7D 7S')]);
  expect(discardHelp(p.hand[0],k)).toBe(0);expect(improvedAI.discard(p,k)).toBe(p.hand[0]);
});

test('a winning final discard is never withheld to deny a visible extension',()=>{
  const p=new Player();p.hand=cards('7C');p.goal=p.goals[0];p.laidDown=true;
  expect(improvedAI.discard(p,knowledge(p,1,[set('7H 7D 7S')]))).toBe(p.hand[0]);
});


test('the real turn banks a ready goal when a committed opponent holds two cards',async()=>{
  const g=new Game(seededRng(12),async()=>{});const p=g.players[1];
  p.hand=competingGoals().hand;p.goals.forEach((goal,i)=>goal.completed=![0,9].includes(i));
  g.human.goal=g.human.goals[0];g.human.laidDown=true;
  g.human.goal.formations[0].trySet(cards('10H 10D 10S'));
  g.human.goal.formations[1].trySet(cards('JH JD JS'));
  g.human.hand=cards('KH QS');g.deck.cards=cards('3D');g.discardPile=cards('QC');g.activePlayer=1;
  try {await g.processAITurn();expect(p.laidDown).toBe(true);expect(p.goal?.name).toBe('2S');}
  finally {g.dispose();}
});
