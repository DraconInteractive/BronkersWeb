import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/engine/game';
import { seededRng } from '../../src/engine/rng';
import { baselineAI } from '../ai-baseline/policy';
const controls: Array<{seed:number;round:{turns:number;winner:number;laydowns:unknown[]}}>=JSON.parse(readFileSync(new URL('../ai-baseline/control.json',import.meta.url),'utf8'));
class ManualGame extends Game {
  override async processAITurn() {}
  turn(){return super.processAITurn();}
}
test.each(controls)('frozen baseline exactly reproduces historical seed $seed',async ({seed,round})=>{
  const g=new ManualGame(seededRng(seed),async()=>{},[baselineAI,baselineAI]);
  let turns=0;const own=[0,0];const seen=new Set<number>();const events: unknown[]=[];
  g.subscribe(()=>g.players.forEach((p,seat)=>{
    if(p.laidDown&&!seen.has(seat)){
      seen.add(seat);events.push({seat,goal:p.goal!.name,points:p.goal!.points,turn:turns,personalTurn:own[seat],cardsRemaining:p.hand.length});
    }
  }));
  while(!g.roundResult&&turns<500){
    turns++;own[g.activePlayer]++;await g.turn();
    const all=[...g.deck.cards,...g.discardPile,...g.players.flatMap(p=>[...p.hand,...(p.goal?.formations.flatMap(f=>f.cards)??[])])];
    expect(all).toHaveLength(104);expect(new Set(all).size).toBe(104);
  }
  expect(turns).toBe(round.turns);expect(g.roundResult?.winner).toBe(round.winner);expect(events).toEqual(round.laydowns);
});
