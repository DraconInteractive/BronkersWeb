export const SCHEMA_VERSION=1;
const goalPoints:Record<string,number>={'2S':1,'3S':1,'1S 1R':3,'2R':3,'2S 1R':5,'4S':5,'3S 1R':8,'1S 2R':8,'3R':10,'2S 2R':10};
export type ActorResult={laidDown:boolean;goal:string|null;targetGoal:string|null;points:number;cardsRemaining:number;laydownTurn:number|null};
export type RoundRecord={
  schemaVersion:1;eventId:string;matchId:string;round:number;mode:'goals'|'points';
  aiPolicy:string;buildCommit:string;startedAt:string;finishedAt:string;durationMs:number;
  turns:number;starter:'human'|'ai';winner:'human'|'ai';matchResult:'human'|'ai'|'draw'|null;
  human:ActorResult;ai:ActorResult;scores:{human:number;ai:number};
};
export class InvalidRecord extends Error {}
function object(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new InvalidRecord('Expected an object');
  const result=value as Record<string,unknown>;
  if(Object.keys(result).length!==keys.length||keys.some(key=>!Object.hasOwn(result,key)))throw new InvalidRecord('Unexpected or missing fields');
  return result;
}
function integer(value:unknown,min:number,max:number):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw new InvalidRecord('Number out of range');return value;
}
function text(value:unknown,pattern:RegExp):string {
  if(typeof value!=='string'||!pattern.test(value))throw new InvalidRecord('Invalid text field');return value;
}
function timestamp(value:unknown):string {
  const s=text(value,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  if(!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)throw new InvalidRecord('Invalid timestamp');return s;
}
function actor(value:unknown,turns:number):ActorResult {
  const v=object(value,['laidDown','goal','targetGoal','points','cardsRemaining','laydownTurn']);
  if(typeof v.laidDown!=='boolean')throw new InvalidRecord('Invalid laydown flag');
  if(v.targetGoal!==null&&(typeof v.targetGoal!=='string'||!Object.hasOwn(goalPoints,v.targetGoal)))throw new InvalidRecord('Invalid target goal');
  const targetGoal=v.targetGoal as string|null;
  const points=integer(v.points,0,10),remaining=integer(v.cardsRemaining,0,104);
  if(!v.laidDown){if(v.goal!==null||points!==0||v.laydownTurn!==null)throw new InvalidRecord('Uncommitted player cannot score');
    return {laidDown:false,goal:null,targetGoal,points:0,cardsRemaining:remaining,laydownTurn:null};}
  if(typeof v.goal!=='string'||!Object.hasOwn(goalPoints,v.goal)||goalPoints[v.goal]!==points||v.targetGoal!==v.goal)throw new InvalidRecord('Goal reward mismatch');
  return {laidDown:true,goal:v.goal,targetGoal,points,cardsRemaining:remaining,laydownTurn:integer(v.laydownTurn,1,turns)};
}
export function parseRound(value:unknown):RoundRecord {
  const v=object(value,['schemaVersion','eventId','matchId','round','mode','aiPolicy','buildCommit','startedAt','finishedAt','durationMs','turns','starter','winner','matchResult','human','ai','scores']);
  if(v.schemaVersion!==SCHEMA_VERSION)throw new InvalidRecord('Unsupported schema version');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const eventId=text(v.eventId,uuid).toLowerCase(),matchId=text(v.matchId,uuid).toLowerCase();
  if(v.mode!=='goals'&&v.mode!=='points')throw new InvalidRecord('Invalid match mode');
  const round=integer(v.round,1,v.mode==='points'?10:100000);
  const turns=integer(v.turns,1,100000),human=actor(v.human,turns),ai=actor(v.ai,turns);
  if(v.starter!=='human'&&v.starter!=='ai')throw new InvalidRecord('Invalid starter');
  if(v.winner!=='human'&&v.winner!=='ai')throw new InvalidRecord('Invalid winner');
  const winning=v.winner==='human'?human:ai;
  if(!winning.laidDown||winning.cardsRemaining!==0)throw new InvalidRecord('Winner must have laid down and gone out');
  const scores=object(v.scores,['human','ai']);
  const hs=integer(scores.human,human.points,54),as=integer(scores.ai,ai.points,54);
  const expected=v.mode==='points'?(round===10?(hs===as?'draw':hs>as?'human':'ai'):null)
    :(hs===54&&as===54?'draw':hs===54?'human':as===54?'ai':null);
  if(v.matchResult!==expected)throw new InvalidRecord('Match result disagrees with scores');
  const startedAt=timestamp(v.startedAt),finishedAt=timestamp(v.finishedAt);
  if(startedAt>finishedAt)throw new InvalidRecord('Round ends before it starts');
  return {schemaVersion:1,eventId,matchId,round,mode:v.mode,
    aiPolicy:text(v.aiPolicy,/^[A-Za-z0-9._-]{1,80}$/),buildCommit:text(v.buildCommit,/^(?:[a-f0-9]{7,40}(?:-dirty)?|development|unknown)$/),
    startedAt,finishedAt,durationMs:integer(v.durationMs,0,31622400000),turns,starter:v.starter,winner:v.winner,
    matchResult:expected,human,ai,scores:{human:hs,ai:as}};
}
