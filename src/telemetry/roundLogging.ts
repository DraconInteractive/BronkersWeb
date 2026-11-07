import type { Game } from '../engine/game';
import { improvedAI } from '../engine/aiPolicy';
import { parseRound, type ActorResult, type RoundRecord } from '../../server/contract';
const PREFIX='bronkers.round.v1.';
const MAX_QUEUED=500;
export type LoggingOptions={storage?:Storage|null;fetch?:typeof fetch;now?:()=>number;uuid?:()=>string;buildCommit?:string};

export class RoundOutbox {
  private memory=new Map<string,RoundRecord>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  private running=false;
  private stopped=false;
  private delay=5000;
  constructor(private storage:Storage|null,private send:typeof fetch){}
  pending():RoundRecord[]{
    const records=new Map(this.memory);
    try{
      for(let i=0;i<(this.storage?.length??0);i++){
        const key=this.storage!.key(i);if(!key?.startsWith(PREFIX))continue;
        try{const record=parseRound(JSON.parse(this.storage!.getItem(key)!));records.set(record.eventId,record);}catch{this.storage!.removeItem(key);i--;}
      }
    }catch{} // Storage-disabled browsers still log for the lifetime of the page.
    return [...records.values()].sort((a,b)=>a.finishedAt.localeCompare(b.finishedAt)||a.eventId.localeCompare(b.eventId));
  }
  enqueue(record:RoundRecord){
    const pending=this.pending();
    if(pending.length>=MAX_QUEUED){this.remove(pending[0].eventId);console.warn('Bronkers round queue full; oldest offline record removed');}
    this.memory.set(record.eventId,record);
    try{this.storage?.setItem(PREFIX+record.eventId,JSON.stringify(record));}catch{}
    void this.flush();
  }
  private remove(id:string){this.memory.delete(id);try{this.storage?.removeItem(PREFIX+id);}catch{}}
  async flush(){
    if(this.running||this.stopped)return;
    clearTimeout(this.timer);this.running=true;
    try{
      for(const record of this.pending()){
        if(this.stopped)break;
        let response:Response,ack:{eventId:string;id:number}|null=null;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
        try{response=await this.send('/api/rounds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record),keepalive:true,signal:controller.signal});if(response.ok)ack=await response.json();}
        catch{break;}finally{clearTimeout(timeout);}
        if(response.ok){
          if(!ack||ack.eventId!==record.eventId||!Number.isSafeInteger(ack.id)||ack.id<1)break;
          this.remove(record.eventId);this.delay=5000;continue;
        }
        if([400,409,413,415].includes(response.status)){
          console.warn(`Bronkers round record rejected (${response.status})`);this.remove(record.eventId);continue;
        }
        if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));if(Number.isFinite(seconds))this.delay=Math.max(this.delay,Math.min(60000,seconds*1000));}
        break;
      }
    }finally{
      this.running=false;
      if(!this.stopped&&this.pending().length){this.timer=setTimeout(()=>void this.flush(),this.delay);this.delay=Math.min(60000,this.delay*2);}
    }
  }
  stop(){this.stopped=true;clearTimeout(this.timer);}
}

function installRoundLogging(game:Game,options:LoggingOptions){
  let storage=options.storage;
  if(storage===undefined){try{storage=globalThis.localStorage??null;}catch{storage=null;}}
  const outbox=new RoundOutbox(storage,options.fetch??globalThis.fetch.bind(globalThis));
  const now=options.now??Date.now,uuid=options.uuid??newUUID;
  let player=game.human,matchId=uuid(),round=game.roundNumber,startedAt=now();
  let logged=false,starter=game.activePlayer;
  let laid:Array<number|null>=[null,null];
  function observe(){
    if(player!==game.human){player=game.human;matchId=uuid();round=-1;}
    if(round!==game.roundNumber){round=game.roundNumber;startedAt=now();logged=false;starter=game.activePlayer;laid=[null,null];}
    game.players.forEach((p,i)=>{if(p.laidDown&&laid[i]===null)laid[i]=game.turnNumber;});
    if(!game.roundResult||logged)return;
    logged=true;
    const finishedAt=Math.max(startedAt,now());
    const actor=(i:number):ActorResult=>{
      const result=game.roundResult!.players[i];
      return {laidDown:result.laidDown,goal:result.goal,targetGoal:game.players[i].goal?.name??null,points:result.laidDown?game.players[i].goal!.points:0,
        cardsRemaining:result.cardsRemaining,laydownTurn:result.laidDown?laid[i]:null};
    };
    outbox.enqueue({schemaVersion:1,eventId:uuid(),matchId,round,mode:game.mode,
      aiPolicy:game.aiPolicies[1]?.id??improvedAI.id,buildCommit:options.buildCommit??'development',
      startedAt:new Date(startedAt).toISOString(),finishedAt:new Date(finishedAt).toISOString(),durationMs:finishedAt-startedAt,
      turns:game.turnNumber,starter:starter===0?'human':'ai',winner:game.roundResult.winner===0?'human':'ai',
      matchResult:game.finishers.length===2?'draw':game.finishers.length?game.finishers[0]===0?'human':'ai':null,
      human:actor(0),ai:actor(1),scores:{human:game.scores[0],ai:game.scores[1]}});
  }
  const observeSafely=()=>{try{observe();}catch{console.warn('Could not prepare Bronkers round log');}};
  const unsubscribe=game.subscribe(observeSafely);
  const flush=()=>void outbox.flush();
  if(typeof window!=='undefined'){window.addEventListener('online',flush);window.addEventListener('pagehide',flush);}
  observeSafely();flush();
  return ()=>{unsubscribe();outbox.stop();if(typeof window!=='undefined'){window.removeEventListener('online',flush);window.removeEventListener('pagehide',flush);}};
}

function newUUID():string {
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  // getRandomValues also works on the plain-HTTP LAN tester.
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function attachRoundLogging(game:Game,options:LoggingOptions={}){
  try{return installRoundLogging(game,options);}catch{console.warn('Bronkers round logging unavailable');return ()=>{};}
}
