import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Game,Phase} from '../../src/engine/game';
import {Player} from '../../src/engine/player';
import {Goal} from '../../src/engine/goal';
import {improvedAI,publicAwareAI,aggressiveAI} from '../../src/engine/aiPolicy';
import {assessMatchPlan,compareMatchPlans,continuationValue,publicGoal} from '../../src/engine/aiMatch';
import type {GoalAssessment} from '../../src/engine/aiGoals';
import type {AIMatchState,AIKnowledge} from '../../src/engine/aiKnowledge';
import {seededRng} from '../../src/engine/rng';
import {cards} from '../cards';

const state=(overrides:Partial<AIMatchState>={}):AIMatchState=>({round:10,roundLimit:10,ownScore:0,opponentScore:9,opponentLaidDown:true,opponentRemainingGoals:[],...overrides});
function hand(){const p=new Player();p.hand=cards('5H 5D 5S 8H 8D 8S 6C 7C 8C 9C QH KD AC');p.goals.forEach((g,i)=>g.completed=![0,9].includes(i));return p;}
const knowledge=(p:Player,match?:AIMatchState):AIKnowledge=>({knownCards:p.hand,table:[],hasDrawn:true,opponents:[{laidDown:true,cardsRemaining:2}],...(match?{match}:{})});
const plan=(goal:Goal,missing=0,immediateWin=false):GoalAssessment=>({goal,missing,immediateWin,score:1,groups:[],riskDistance:missing,exitCards:0,finishCost:missing});

test('behind on the final round, do not bank an easy goal that guarantees a match loss',()=>{
  const p=hand(),k=knowledge(p,state());
  expect(publicAwareAI.selectGoal(p,k)?.goal.name).toBe('2S');
  expect(improvedAI.selectGoal(p,k)?.goal.name).toBe('2S 2R');
});
test('bank a ready goal that secures the final match instead of risking unfinished points',()=>{
  const p=hand(),result=improvedAI.selectGoal(p,knowledge(p,state({ownScore:9})))!;
  expect(result.goal.name).toBe('2S');expect(result.securesMatch).toBe(true);
});
test('a losing immediate round win cannot override an attainable match win',()=>{
  const low=new Goal(2,0,1),high=new Goal(2,2,10),m=state();
  const a=assessMatchPlan(plan(low,0,true),[low,high],m);
  const b=assessMatchPlan(plan(high,1),[low,high],m);
  expect(a.matchCeiling).toBe(0);expect(b.matchCeiling).toBe(2);
  expect(compareMatchPlans(b,a,true,true)).toBeLessThan(0);
});
test('include future goal slots when deciding whether a bank can still catch up',()=>{
  const low=new Goal(2,1,5),medium=new Goal(3,1,8),high=new Goal(2,2,10),goals=[low,medium,high];
  const m=state({round:9,opponentScore:17});
  expect(assessMatchPlan(plan(low),goals,m).matchCeiling).toBe(0);
  expect(assessMatchPlan(plan(medium,1),goals,m).matchCeiling).toBe(2);
});
test('do not claim a secure lead while an uncommitted opponent can still score',()=>{
  const low=new Goal(2,0,1),m=state({ownScore:9,opponentScore:9,opponentLaidDown:false,opponentRemainingGoals:[publicGoal(new Goal(2,2,10))]});
  expect(assessMatchPlan(plan(low),[low],m).securesMatch).toBe(false);
  expect(assessMatchPlan(plan(low,0,true),[low],m).securesMatch).toBe(true);
});
test('complete a harder equally rewarding goal while suited; keep the easier fallback for later',()=>{
  const easy=new Goal(2,0,1),hard=new Goal(3,0,1),m=state({round:9,opponentScore:0});
  const a=assessMatchPlan(plan(easy),[easy,hard],m),b=assessMatchPlan(plan(hard),[easy,hard],m);
  expect(b.continuationValue).toBeGreaterThan(a.continuationValue!);
  expect(compareMatchPlans(b,a,false,false)).toBeLessThan(0);
});
test('future scheduling books at most one unfinished goal per remaining round',()=>{
  const goals=[new Goal(2,0,1),new Goal(3,0,1),new Goal(0,3,10)].map(publicGoal);
  expect(continuationValue(goals,0)).toBe(0);
  expect(continuationValue(goals,1)).toBeLessThan(continuationValue(goals,2));
  expect(continuationValue(goals,3)).toBe(continuationValue(goals,10));
});
test('completed goals cannot contribute phantom future points',()=>{
  const low=new Goal(2,0,1),high=new Goal(0,3,10);high.completed=true;
  const result=assessMatchPlan(plan(low),[low,high],state({round:9}));
  expect(result.continuationValue).toBe(0);
});
test('selection, pickup and discard share match feasibility; avoid a pickup only useful to a losing goal',()=>{
  const p=hand();p.hand=p.hand.filter(c=>!(c.value===5&&c.suit===2));
  const k=knowledge(p,state()),top=cards('5S')[0];
  // This completes the low goal, but contributes to the high goal too. Protect
  // the catch-up allocation rather than applying the previous ready-first rule.
  const result=improvedAI.selectGoal(p,k)!;expect(result.goal.name).toBe('2S 2R');
  const discard=improvedAI.discard(p,k,result);
  expect(p.hand).toContain(discard);expect(result.groups.flatMap(g=>g.cards)).not.toContain(discard);
  expect(improvedAI.pickup(p,k,top,result)).toBe(true);
});
test('without a fixed points budget the default retains public-aware behaviour',()=>{
  const p=hand(),k=knowledge(p);expect(improvedAI.selectGoal(p,k)?.goal).toBe(publicAwareAI.selectGoal(p,k)?.goal);
});

class ManualGame extends Game {override async processAITurn(){} turn(){return super.processAITurn();}}
const game=()=>new ManualGame(seededRng(21),async()=>{},[],{mode:'points'});
function ready(g:Game,seat:number,index=0) {
  const p=g.players[seat];p.goal=p.goals[index];
  p.goal.formations.forEach(f=>f.trySet(cards(f.kind==='Set'?'5H 5D 5S':'3C 4C 5C 6C')));
  p.hand=cards('KH');p.refreshCanLayDown();g.activePlayer=seat;g.phase=Phase.PlayerActions;
}
test('bank immediately and once, keep points when losing the round, bombed players earn zero',()=>{
  const g=game();ready(g,0);expect(g.tryLayDown(g.human)).toBe(true);expect(g.scores).toEqual([1,0]);
  expect(g.tryLayDown(g.human)).toBe(false);ready(g,1,4);g.tryLayDown(g.players[1]);
  expect(g.scores).toEqual([1,5]);g.players[1].hand=[];g.tryEndRound();g.confirmRound();
  expect(g.scores).toEqual([1,5]);expect(g.roundNumber).toBe(2);expect(g.activePlayer).toBe(1);
  ready(g,1,1);g.tryLayDown(g.players[1]);g.players[1].hand=[];g.tryEndRound();
  expect(g.roundResult?.players[0].laidDown).toBe(false);expect(g.scores).toEqual([1,6]);g.dispose();
});
test.each([false,true])('end the tenth round by banked totals, not its round winner; tie %s',tie=>{
  const g=game();g.roundNumber=10;g.scores=[tie?24:20,25];ready(g,0);g.tryLayDown(g.human);g.human.hand=[];g.tryEndRound();
  expect(g.roundResult?.winner).toBe(0);expect(g.finishers).toEqual(tie?[0,1]:[1]);
  g.confirmRound();expect(g.gameOver).toBe(true);expect(g.roundNumber).toBe(10);
  g.newGame();expect(g.scores).toEqual([0,0]);expect(g.roundNumber).toBe(1);expect(g.mode).toBe('points');g.dispose();
});
test('match context contains only scores, committed status and public goal-sheet history',()=>{
  const g=game(),p=g.players[1];g.scores=[10,8];g.roundNumber=4;const before=g.aiKnowledge(p);
  g.human.hand=cards('AH');g.human.goal=g.human.goals[9];g.human.goal.formations[0].trySet(cards('7H 7D 7S'));g.deck.cards=cards('2C');
  expect(g.aiKnowledge(p)).toEqual(before);expect(before.match?.ownScore).toBe(8);expect(before.match?.opponentScore).toBe(10);
  expect(before.match?.opponentRemainingGoals).toHaveLength(10);
  expect(JSON.stringify(before.match)).not.toContain('formations');g.dispose();
});

const historical:Array<{seed:number;rounds:Array<{starter:number;turns:number;winner:number;laydowns:unknown[]}>}>=JSON.parse(gunzipSync(readFileSync(new URL('../../reports/ai/public-awareness-v-aggressive-200.json.gz',import.meta.url))).toString()).matches.slice(0,5);
test.each(historical)('previous public-aware control reproduces historical first round seed $seed',async({seed,rounds})=>{
  const expected=rounds[0];const g=new ManualGame(seededRng(seed),async()=>{},[publicAwareAI,aggressiveAI],{mode:'points'});
  g.activePlayer=expected.starter;let turns=0;const own=[0,0],events:unknown[]=[];const seen=new Set();
  g.subscribe(()=>g.players.forEach((p,seat)=>{if(p.laidDown&&!seen.has(seat)){seen.add(seat);events.push({seat,goal:p.goal!.name,points:p.goal!.points,turn:turns,personalTurn:own[seat],cardsRemaining:p.hand.length});}}));
  try {while(!g.roundResult&&turns<500){turns++;own[g.activePlayer]++;await g.turn();}
    expect(turns).toBe(expected.turns);expect(g.roundResult?.winner).toBe(expected.winner);expect(events).toEqual(expected.laydowns);
  }finally{g.dispose();}
});


test('the same hand takes more reward risk when behind late, less when protecting a lead',()=>{
  const high=new Goal(2,2,10),low=new Goal(2,0,1),goals=[high,low];
  const behind=assessMatchPlan(plan(high,1),goals,state());
  const ahead=assessMatchPlan(plan(high,1),goals,state({ownScore:20}));
  expect(behind.riskAdjustment).toBeGreaterThan(0);expect(ahead.riskAdjustment).toBeLessThan(0);
  expect(behind.score).toBeGreaterThan(ahead.score);
});
