import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoundServer} from '../../server/http.mjs';
import {RoundStore} from '../../server/store.mjs';
import {parseRound} from '../../server/contract.ts';
import {record} from './fixtures.mjs';
async function start(t,options={}) {
  const app=createRoundServer({filename:':memory:',...options});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>app.close());const base=`http://127.0.0.1:${app.server.address().port}`;
  return {...app,base,post:(body,headers={})=>fetch(base+'/api/rounds',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}),
    get:path=>fetch(base+path).then(async response=>({status:response.status,body:await response.json()}))};
}
test('saves once, acknowledges a retry and preserves the first record on conflict',async t=>{
  const app=await start(t),r=record();let response=await app.post(r);assert.equal(response.status,201);
  const ack=await response.json();assert.equal(ack.eventId,r.eventId);
  response=await app.post(r);assert.equal(response.status,200);assert.equal((await response.json()).id,ack.id);
  assert.equal((await app.post({...r,turns:6})).status,409);
  assert.equal((await app.post({...r,eventId:record().eventId})).status,409);
  const rows=(await app.get('/api/rounds')).body.rounds;assert.equal(rows.length,1);assert.equal(rows[0].turns,5);
});
test('SQLite survives a close and reopen and is private on disk',()=>{
  const dir=mkdtempSync(join(tmpdir(),'bronkers-db-')),file=join(dir,'rounds.sqlite'),r=parseRound(record());
  try{let store=new RoundStore(file);store.save(r);store.close();store=new RoundStore(file);
    assert.equal(store.rounds().rounds[0].eventId,r.eventId);assert.equal(statSync(file).mode&0o777,0o600);store.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('exports stable pages, filters by policy/mode and exposes no request metadata',async t=>{
  const app=await start(t);
  for(let i=0;i<3;i++)assert.equal((await app.post(record({aiPolicy:i===2?'other-v1':'match-and-goal-planning-v1',mode:i===2?'goals':'points'}))).status,201);
  const first=(await app.get('/api/rounds?limit=2')).body;assert.equal(first.hasMore,true);assert.equal(first.rounds.length,2);
  await app.post(record());
  const second=(await app.get(`/api/rounds?after=${first.nextAfter}&through=${first.snapshotThrough}&limit=2`)).body;
  assert.equal(second.hasMore,false);assert.equal(second.rounds.length,1);assert.equal(second.snapshotThrough,3);
  const filtered=(await app.get('/api/rounds?mode=goals&aiPolicy=other-v1')).body;assert.equal(filtered.rounds.length,1);
  assert.equal(filtered.nextAfter,4);assert.ok(!JSON.stringify(filtered).includes('127.0.0.1'));
  const stats=(await app.get('/api/stats')).body;assert.equal(stats.totals.rounds,4);assert.equal(stats.totals.humanWins,4);
  assert.equal(stats.totals.aiBombed,4);assert.equal(stats.groups.length,2);
});
test('rejects hidden-card/identity fields, invalid scores, outcomes and rewards',async t=>{
  const app=await start(t),r=record();
  for(const bad of [{...r,ip:'127.0.0.1'},{...r,hand:['AH']},{...r,schemaVersion:2},{...r,scores:{human:55,ai:0}},
    {...r,human:{...r.human,points:10}},{...r,ai:{...r.ai,points:1}},{...r,winner:'ai'},
    {...r,round:10},{...r,human:{...r.human,laydownTurn:6}}])assert.equal((await app.post(bad)).status,400);
  assert.equal((await app.get('/api/stats')).body.totals.rounds,0);
});
test('accepts points ties and classic final results, including a final-round loser winning the match',()=>{
  const r=record({round:10,scores:{human:20,ai:25},matchResult:'ai'});assert.equal(parseRound(r).matchResult,'ai');
  assert.equal(parseRound({...r,scores:{human:25,ai:25},matchResult:'draw'}).matchResult,'draw');
  assert.equal(parseRound({...r,mode:'goals',round:18,scores:{human:54,ai:25},matchResult:'human'}).matchResult,'human');
});
test('bounds requests and queries, refuses cross-origin writes and does not enable CORS',async t=>{
  const app=await start(t);
  assert.equal((await app.post(record(),{Origin:'https://elsewhere.invalid'})).status,403);
  assert.equal((await app.post(record(),{Origin:app.base})).status,201);
  assert.equal((await app.post(record(),{'Content-Type':'text/plain'})).status,415);
  assert.equal((await app.post({oversized:'a'.repeat(9000)})).status,413);
  for(const path of ['/api/rounds?limit=1001','/api/rounds?after=-1','/api/rounds?limit=1&limit=2','/api/rounds?x=1','/api/stats?mode=invalid'])assert.equal((await app.get(path)).status,400);
  const response=await fetch(app.base+'/api/health');assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).status,'ok');
});
test('rate limits writes and permits them after the window expires',async t=>{
  let now=0;const app=await start(t,{rateLimit:1,now:()=>now});
  assert.equal((await app.post(record())).status,201);const limited=await app.post(record());assert.equal(limited.status,429);
  assert.equal(limited.headers.get('retry-after'),'60');now=60001;assert.equal((await app.post(record())).status,201);
});
test('storage failure is not acknowledged as a saved round',async t=>{
  const app=await start(t);app.store.save=()=>{throw Error('simulated unavailable storage');};
  assert.equal((await app.post(record())).status,500);
});

test('export helper follows pages and produces a complete analysis artifact',async t=>{
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {readFileSync}=await import('node:fs');
  const app=await start(t),dir=mkdtempSync(join(tmpdir(),'bronkers-export-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  for(let i=0;i<3;i++)await app.post(record());
  const output=join(dir,'export.json');
  await promisify(execFile)(process.execPath,['scripts/export-rounds.mjs',app.base+'/api/rounds?limit=2',output]);
  const data=JSON.parse(readFileSync(output,'utf8'));assert.equal(data.rounds.length,3);assert.equal(new Set(data.rounds.map(r=>r.id)).size,3);
});

test('the Vite same-origin proxy accepts a real browser-style POST and serves saved data',async t=>{
  const {createServer,loadConfigFromFile}=await import('vite');const app=await start(t);
  const configured=await loadConfigFromFile({command:'serve',mode:'test'});
  assert.equal(configured.config.server.proxy['/api'].changeOrigin,false);
  const vite=await createServer({configFile:false,appType:'custom',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,ws:false,watch:null,proxy:{'/api':{target:app.base,changeOrigin:false}}}});
  await vite.listen();t.after(()=>vite.close());const base=`http://127.0.0.1:${vite.httpServer.address().port}`;
  const response=await fetch(base+'/api/rounds',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(record())});
  assert.equal(response.status,201);await response.json();
  assert.equal((await (await fetch(base+'/api/stats')).json()).totals.rounds,1);
});
