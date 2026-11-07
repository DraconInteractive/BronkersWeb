import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {BankingLedger,runBankingMatch,type BankEvent} from '../../scripts/aiBanking';
import {aggressiveAI,conservativeAI,improvedAI} from '../../src/engine/aiPolicy';
import {smartAssessGoals,smartBestGoal,smartPickup} from '../../src/engine/aiSmart';
import {Game} from '../../src/engine/game';
import {Player} from '../../src/engine/player';
import {seededRng} from '../../src/engine/rng';
import {cards} from '../cards';

const event=(seat:number,goal:string,points:number):BankEvent=>({seat,goal,points,turn:1,personalTurn:1,cardsRemaining:5});
test('bank points at laydown once, keep them after losing, and give a bombed player zero',()=>{
  const ledger=new BankingLedger();ledger.beginRound();
  expect(ledger.bank(event(0,'3S 1R',8))).toBe(true);
  expect(ledger.scores).toEqual([8,0]);
  expect(ledger.bank(event(0,'3S 1R',8))).toBe(false);
  expect(ledger.bank(event(1,'2S',1))).toBe(true);
  expect(ledger.scores).toEqual([8,1]); // Either player can go out; scoring is already final.
  ledger.beginRound();ledger.bank(event(1,'2S 2R',10));
  expect(ledger.scores).toEqual([8,11]); // Seat 0 bombed this round, retains the earlier eight.
  expect(ledger.winner()).toBe(1);
  expect(()=>ledger.bank(event(0,'3S 1R',8))).toThrow('Goal banked twice');
});
test('equal banked totals are a tie and a fresh match has fresh sheets',()=>{
  const ledger=new BankingLedger();ledger.beginRound();
  ledger.bank(event(0,'2S',1));ledger.bank(event(1,'3S',1));expect(ledger.winner()).toBeNull();
  expect(new BankingLedger().bank(event(0,'2S',1))).toBe(true);
});
test('conservative prefers banking a ready low goal over an unfinished high goal',()=>{
  const p=new Player();p.hand=cards('5H 5D 5S 8H 8D 8S 6C 7C 8C 9C QH KD AC');
  p.goals.forEach((g,i)=>g.completed=![0,9].includes(i));
  const knowledge={knownCards:p.hand,table:[],hasDrawn:true};
  expect(smartBestGoal(p,knowledge,undefined,true,'conservative')?.goal.name).toBe('2S');
  expect(smartBestGoal(p,knowledge)?.goal.name).toBe('2S 2R');
  const plans=smartAssessGoals(p,knowledge,undefined,'conservative');
  for(const plan of plans) expect(plan.score).toBeCloseTo(Math.sqrt(plan.goal.points)/(plan.riskDistance!+1));
});
test('conservative pickup recognises a ready goal even when its numeric reward score is lower',()=>{
  const p=new Player();p.hand=cards('5H 5D 8H 8D 8S 6C 7C 8C 9C QH KD AC 3D');
  p.goals.forEach((g,i)=>g.completed=![0,9].includes(i));
  const top=cards('5S')[0];const k={knownCards:[...p.hand,top],table:[],hasDrawn:false};
  expect(smartPickup(p,k,top,undefined,'conservative')).toBe(true);
});
test('the default policy stays the aggressive control; both styles share table tactics',()=>{
  expect(aggressiveAI).toBe(improvedAI);expect(conservativeAI.table).toBe(aggressiveAI.table);
  expect(conservativeAI.shelve).toBe(aggressiveAI.shelve);
});

test('ten-round integration preserves scores and single-use goals, with five starts each',async()=>{
  const result=await runBankingMatch(3001,0);
  expect(result.status).toBe('completed');expect(result.rounds).toHaveLength(10);
  expect(result.rounds.map(r=>r.starter)).toEqual([0,1,0,1,0,1,0,1,0,1]);
  for(const seat of [0,1]) {
    const events=result.rounds.flatMap(r=>r.laydowns.filter(e=>e.seat===seat));
    expect(new Set(events.map(e=>e.goal)).size).toBe(events.length);
    expect(result.scores[seat]).toBe(events.reduce((n,e)=>n+e.points,0));
    expect(result.scores[seat]).toBeLessThanOrEqual(54);
  }
  for(const round of result.rounds) {
    expect(round.laydowns.some(e=>e.seat===round.winner)).toBe(true);
    if(round.bombed!==null)expect(round.scores[round.bombed]).toBe(0);
  }
},120_000);
test('a turn cap stops the match without declaring a winner',async()=>{
  const result=await runBankingMatch(3001,1,1);
  expect(result.status).toBe('turn-limit');expect(result.winner).toBeNull();expect(result.rounds).toHaveLength(1);
});

// Captured from the committed 1,000-round new-v-new report, before risk profiles.
const controls:Array<{seed:number;round:{starter:number;turns:number;winner:number;laydowns:unknown[]}}>=JSON.parse(readFileSync(new URL('../ai-aggressive-control.json',import.meta.url),'utf8'));
class ManualGame extends Game {
  override async processAITurn() {}
  turn(){return super.processAITurn();}
}
test.each(controls)('aggressive AI reproduces previous report seed $seed',async({seed,round})=>{
  const game=new ManualGame(seededRng(seed),async()=>{},[aggressiveAI,aggressiveAI]);
  game.activePlayer=round.starter;let turns=0;const own=[0,0],seen=new Set();const events:unknown[]=[];
  game.subscribe(()=>game.players.forEach((p,seat)=>{
    if(p.laidDown&&!seen.has(seat)){
      seen.add(seat);events.push({seat,policy:'improved',goal:p.goal!.name,points:p.goal!.points,turn:turns,personalTurn:own[seat],cardsRemaining:p.hand.length});
    }
  }));
  try {
    while(!game.roundResult&&turns<500){turns++;own[game.activePlayer]++;await game.turn();}
    expect(turns).toBe(round.turns);expect(game.roundResult?.winner).toBe(round.winner);expect(events).toEqual(round.laydowns);
  } finally {game.dispose();}
});
