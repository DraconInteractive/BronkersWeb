import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,symlinkSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {record} from './fixtures.mjs';
function start(entry,data){
  const child=spawn(process.execPath,[entry],{env:{...process.env,BRONKERS_API_PORT:'0',BRONKERS_DATA_DIR:data,BRONKERS_ENTRYPOINT:entry},stdio:['ignore','pipe','pipe']});
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('API startup timeout')),10000);let output='';
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}`);}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);if(!output.includes('listening'))reject(Error(`API exited ${code}: ${output}`));});
    child.stderr.on('data',chunk=>{output+=chunk;});
  });
  return {child,ready};
}
test('a release switch exits cleanly and a restarted process keeps the database',async t=>{
  const root=mkdtempSync(join(tmpdir(),'bronkers-api-release-'));
  let first,second;
  t.after(async()=>{for(const run of [first,second])if(run&&run.child.exitCode===null){run.child.kill('SIGTERM');await once(run.child,'exit');}rmSync(root,{recursive:true,force:true});});
  cpSync(new URL('../../server',import.meta.url),join(root,'a'),{recursive:true});
  cpSync(new URL('../../server',import.meta.url),join(root,'b'),{recursive:true});
  symlinkSync(join(root,'a'),join(root,'telemetry'));
  const entry=join(root,'telemetry/index.mjs'),data=join(root,'data');
  first=start(entry,data);const base=await first.ready;
  const response=await fetch(base+'/api/rounds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record())});assert.equal(response.status,201);await response.json();
  const exited=once(first.child,'exit');symlinkSync(join(root,'b'),join(root,'next'));renameSync(join(root,'next'),join(root,'telemetry'));
  assert.equal((await exited)[0],0);
  second=start(entry,data);const next=await second.ready;
  assert.equal((await (await fetch(next+'/api/rounds')).json()).rounds.length,1);
});

test('an acknowledged result survives an abrupt process crash and WAL recovery',async t=>{
  const root=mkdtempSync(join(tmpdir(),'bronkers-api-crash-'));let first,second;
  t.after(async()=>{for(const run of [first,second])if(run&&run.child.exitCode===null&&run.child.signalCode===null){run.child.kill('SIGTERM');await once(run.child,'exit');}rmSync(root,{recursive:true,force:true});});
  cpSync(new URL('../../server',import.meta.url),join(root,'server'),{recursive:true});
  const entry=join(root,'server/index.mjs'),data=join(root,'data');
  first=start(entry,data);const base=await first.ready,r=record();
  const response=await fetch(base+'/api/rounds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});assert.equal(response.status,201);await response.json();
  const exited=once(first.child,'exit');first.child.kill('SIGKILL');await exited;
  second=start(entry,data);const next=await second.ready;
  assert.equal((await (await fetch(next+'/api/rounds')).json()).rounds[0].eventId,r.eventId);
});
