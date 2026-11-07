import {afterEach,expect,test,vi} from 'vitest';
import {Game,Phase} from '../../src/engine/game';
import {seededRng} from '../../src/engine/rng';
import {cards} from '../cards';
import {attachRoundLogging,RoundOutbox} from '../../src/telemetry/roundLogging';
import {parseRound,type RoundRecord} from '../../server/contract';
import {goalSheet} from '../../src/engine/goal';
class MemoryStorage implements Storage {
  private values=new Map<string,string>();get length(){return this.values.size;}
  clear(){this.values.clear();}getItem(key:string){return this.values.get(key)??null;}
  key(i:number){return [...this.values.keys()][i]??null;}removeItem(key:string){this.values.delete(key);}
  setItem(key:string,value:string){this.values.set(key,value);}
}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const ack=(id:string)=>Response.json({id:1,eventId:id,duplicate:false});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
function finish(g:Game){
  g.chooseGoal(0);g.phase=Phase.PlayerActions;g.human.hand=cards('5H 5S 5D 8H 8S 8D KH');
  for(const f of g.human.goal!.formations){g.selectedHand=g.human.hand.slice(0,3);g.place(f);}
  g.humanLayDown();g.humanFinish();g.discard(g.human,g.human.hand[0]);
}
function capture(){
  const g=new Game(seededRng(1),async()=>{}),storage=new MemoryStorage();const records:RoundRecord[]=[];
  const send=vi.fn(async(_url:unknown,options:RequestInit)=>{const r=JSON.parse(options.body as string);records.push(r);return ack(r.eventId);}) as unknown as typeof fetch;
  const stop=attachRoundLogging(g,{storage,fetch:send,now:()=>Date.parse('2026-11-07T00:00:00.000Z')});
  return {g,storage,records,send,stop};
}
test('records a finished human round once, includes version and banked score, excludes private hands',async()=>{
  const {g,records,storage,stop}=capture();finish(g);g.changed();g.tryEndRound();await tick();
  expect(records).toHaveLength(1);const r=parseRound(records[0]);expect(r.winner).toBe('human');
  expect(r.human.goal).toBe('2S');expect(r.human.points).toBe(1);expect(r.ai.laidDown).toBe(false);
  expect(r.human.laydownTurn).toBe(1);expect(r.turns).toBe(1);expect(r.scores).toEqual({human:1,ai:0});
  expect(r.aiPolicy).toBe('match-and-goal-planning-v1');expect(JSON.stringify(r)).not.toContain('hand');
  expect(storage.length).toBe(0);stop();g.dispose();
});
test('a new match resets its identity and round number, repeated confirmation does not resend',async()=>{
  const {g,records,stop}=capture();g.roundNumber=10; // Classic game ends only when goals complete.
  g.human.goals.forEach((goal,i)=>goal.completed=i!==0);g.scores[0]=53;
  // Reattach after fixture setup, matching a match loaded at this state.
  finish(g);await tick();g.confirmRound();g.newGame();finish(g);await tick();
  expect(records).toHaveLength(2);expect(records[0].matchId).not.toBe(records[1].matchId);expect(records[1].round).toBe(1);
  stop();g.dispose();
});
test('offline records survive reload, retry unchanged and clear only after a matching acknowledgement',async()=>{
  vi.useFakeTimers();const storage=new MemoryStorage(),g=new Game(seededRng(1),async()=>{});
  const failed=vi.fn(async()=>{throw Error('offline');}) as unknown as typeof fetch;
  const stop=attachRoundLogging(g,{storage,fetch:failed});finish(g);await tick();expect(storage.length).toBe(1);
  const saved=storage.getItem(storage.key(0)!)!;stop();g.dispose();
  const wrong=vi.fn(async()=>Response.json({id:1,eventId:'wrong'})) as unknown as typeof fetch;
  const first=new RoundOutbox(storage,wrong);await first.flush();expect(storage.length).toBe(1);first.stop();
  const send=vi.fn(async(_url:unknown,options:RequestInit)=>{expect(options.body).toBe(saved);return ack(JSON.parse(saved).eventId);}) as unknown as typeof fetch;
  const next=new RoundOutbox(storage,send);await next.flush();expect(storage.length).toBe(0);next.stop();
});
test('server failure retries without a new event, an HTML fallback is not a save acknowledgement',async()=>{
  vi.useFakeTimers();const storage=new MemoryStorage();
  const r:RoundRecord={schemaVersion:1,eventId:crypto.randomUUID(),matchId:crypto.randomUUID(),round:1,mode:'points',aiPolicy:'test-v1',buildCommit:'development',
    startedAt:'2026-11-07T00:00:00.000Z',finishedAt:'2026-11-07T00:00:01.000Z',durationMs:1000,turns:1,starter:'human',winner:'human',matchResult:null,
    human:{laidDown:true,goal:'2S',targetGoal:'2S',points:1,cardsRemaining:0,laydownTurn:1},ai:{laidDown:false,goal:null,targetGoal:null,points:0,cardsRemaining:13,laydownTurn:null},scores:{human:1,ai:0}};
  const send=vi.fn().mockResolvedValueOnce(new Response('failed',{status:503})).mockResolvedValueOnce(new Response('<html>wrong route</html>')).mockResolvedValueOnce(ack(r.eventId));
  const box=new RoundOutbox(storage,send);box.enqueue(r);await tick();expect(storage.length).toBe(1);
  await vi.advanceTimersByTimeAsync(5000);expect(storage.length).toBe(1);
  await vi.advanceTimersByTimeAsync(10000);expect(storage.length).toBe(0);expect(send).toHaveBeenCalledTimes(3);box.stop();
});
test('schema goal rewards match the engine contract',()=>{
  for(const goal of goalSheet()){
    const {g,records,stop}=capture();finish(g); // Observer produces synchronously before upload acknowledgement.
    const record=structuredClone(records[0]);record.human.goal=goal.name;record.human.targetGoal=goal.name;record.human.points=goal.points;record.scores.human=goal.points;
    expect(parseRound(record).human.points).toBe(goal.points);stop();g.dispose();
  }
});
