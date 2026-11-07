#!/usr/bin/env node
import {createServer} from 'vite';
import {Worker,workerData,parentPort} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const count=workerData?.count??Number(option('--matches',2000));
const seed=workerData?.seed??Number(option('--seed',3001));
const offset=workerData?.offset??0;
const workers=workerData?1:Math.min(count,Number(option('--workers',Math.min(3,availableParallelism()))));
const maxRoundTurns=Number(option('--max-round-turns',500));
const output=option('--output','reports/ai/conservative-v-aggressive-2000');
const policyNames=[option('--policy','conservative'),option('--opponent','aggressive')];
if(!policyNames.every(name=>['conservative','aggressive','improved'].includes(name))) throw Error('Unknown banking policy');
if(workerData?.policyNames && policyNames.join()!==workerData.policyNames.join()) throw Error('Worker policy mismatch');
if(![count,seed,offset,workers,maxRoundTurns].every(Number.isSafeInteger)||count<1||seed<0||workers<1||offset<0||maxRoundTurns<1)throw Error('Invalid simulation options');
const started=performance.now();
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
try {
  const {runBankingMatch,bankingProtocol}=await server.ssrLoadModule('/scripts/aiBanking.ts');
  const {conservativeAI,aggressiveAI,improvedAI}=await server.ssrLoadModule('/src/engine/aiPolicy.ts');
  const policies={conservative:conservativeAI,aggressive:aggressiveAI,improved:improvedAI};
  const selectedPolicies=policyNames.map(name=>policies[name]);
  const protocol={...bankingProtocol,policies:selectedPolicies.map(policy=>policy.id),
    starters:`Seat 0 ${policyNames[0]}, seat 1 ${policyNames[1]}; initial starter alternates by match; round starter alternates within each match.`,
    improved:'Aggressive control plus public-count bombing pressure and discard denial. No hidden opponent cards, private progress, match score or round budget.'};
  async function batch(){
    const results=[];
    for(let i=0;i<count;i++) {
      results.push(await runBankingMatch(seed+i,(offset+i)%2,maxRoundTurns,selectedPolicies));
      if((i+1)%5===0||i+1===count){
        if(parentPort)parentPort.postMessage({progress:i+1});
        else console.log(`${i+1}/${count} matches; ${((performance.now()-started)/1000).toFixed(1)}s`);
      }
      await new Promise(resolve=>setImmediate(resolve));
    }
    return results;
  }
  let matches;
  if(workers===1) matches=await batch();
  else {
    const progress=Array(workers).fill(0);let next=0;
    const batches=Array.from({length:workers},(_,index)=>{
      const chunk=Math.floor(count/workers)+(index<count%workers?1:0);
      const data={count:chunk,seed:seed+next,offset:next,policyNames};next+=chunk;
      return new Promise((resolve,reject)=>{
        const worker=new Worker(new URL(import.meta.url),{workerData:data,argv:args});
        worker.on('message',message=>{
          if(message.progress!==undefined){progress[index]=message.progress;console.log(`${progress.reduce((n,x)=>n+x,0)}/${count} matches; ${((performance.now()-started)/1000).toFixed(1)}s`);}
          else if(message.results)resolve(message.results);
        });
        worker.on('error',reject);worker.on('exit',code=>{if(code!==0)reject(Error(`Worker exited ${code}`));});
      });
    });
    matches=(await Promise.all(batches)).flat().sort((a,b)=>a.seed-b.seed);
  }
  if(parentPort){parentPort.postMessage({results:matches});}
  else {
    const completed=matches.filter(m=>m.status==='completed');
    const rounds=completed.flatMap(m=>m.rounds);
    const {goalSheet}=await server.ssrLoadModule('/src/engine/goal.ts');
    const goals=new Map(goalSheet().map(g=>[g.name,{goal:g.name,points:g.points,counts:[0,0],ownTurns:[0,0]}]));
    const stats=policyNames.map((policy,seat)=>{
      const laid=rounds.flatMap(r=>r.laydowns.filter(e=>e.seat===seat));
      for(const event of laid){const key=event.goal;let row=goals.get(key);if(!row){row={goal:key,points:event.points,counts:[0,0],ownTurns:[0,0]};goals.set(key,row);}row.counts[seat]++;row.ownTurns[seat]+=event.personalTurn;}
      return {policy,matchWins:completed.filter(m=>m.winner===seat).length,meanScore:completed.reduce((n,m)=>n+m.scores[seat],0)/completed.length,
        roundWins:rounds.filter(r=>r.winner===seat).length,bombsInflicted:rounds.filter(r=>r.bombed===1-seat).length,bombsSuffered:rounds.filter(r=>r.bombed===seat).length,
        laidDown:laid.length,meanOwnTurnsToLayDown:laid.reduce((n,e)=>n+e.personalTurn,0)/laid.length,
        winsByInitialStarter:[0,1].map(starter=>({starter,matches:completed.filter(m=>m.starter===starter).length,wins:completed.filter(m=>m.starter===starter&&m.winner===seat).length}))};
    });
    const summary={matches:matches.length,completed:completed.length,capped:matches.length-completed.length,rounds:rounds.length,ties:completed.filter(m=>m.winner===null).length,
      meanRoundTurns:rounds.reduce((n,r)=>n+r.turns,0)/rounds.length,policies:stats,goals:[...goals.values()].sort((a,b)=>a.points-b.points||a.goal.localeCompare(b.goal))};
    const report={config:{...protocol,policyNames,count,seed,workers,maxRoundTurns,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      sourceDirty:execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()!==''},finished:new Date().toISOString(),elapsedSeconds:(performance.now()-started)/1000,summary,matches};
    await mkdir(path.dirname(output),{recursive:true});
    await writeFile(output+'.json.gz',gzipSync(JSON.stringify(report)));
    await writeFile(output+'-summary.json',JSON.stringify({...report,matches:undefined},null,2)+'\n');
    const matchCSV=[`seed,starter,status,winner,${policyNames[0]}_points,${policyNames[1]}_points,rounds`,...matches.map(m=>[m.seed,m.starter,m.status,m.status==='completed'?(m.winner??'tie'):'',...m.scores,m.rounds.length].join(','))].join('\n')+'\n';
    const roundCSV=[`seed,round,starter,turns,winner,bombed,${policyNames.map(n=>n+'_points').join(',')},${policyNames.map(n=>n+'_goal').join(',')},${policyNames.map(n=>n+'_laydown_turn').join(',')}`,...matches.flatMap(m=>m.rounds.map(r=>[m.seed,r.number,r.starter,r.turns,r.winner??'',r.bombed??'',...r.scores,...[0,1].map(s=>r.laydowns.find(e=>e.seat===s)?.goal??''),...[0,1].map(s=>r.laydowns.find(e=>e.seat===s)?.personalTurn??'')].join(',')))].join('\n')+'\n';
    await writeFile(output+'-matches.csv',matchCSV);await writeFile(output+'-rounds.csv',roundCSV);
    const pct=n=>(100*n/completed.length).toFixed(2)+'%';
    const lines=[`# ${policyNames[0]} versus ${policyNames[1]}: ${count} ten-round matches`,'',`Completed ${completed.length}/${count}; capped ${summary.capped}; ties ${summary.ties} (${pct(summary.ties)}). ${summary.rounds} completed-match rounds.`,
      `Mean round length ${summary.meanRoundTurns.toFixed(2)} player turns. Runtime ${report.elapsedSeconds.toFixed(1)} seconds. Source ${report.config.sourceRevision}; tracked changes ${report.config.sourceDirty}.`,'',
      '| Policy | Match wins | Win % (ties included) | Mean points | Round wins | Bombs inflicted | Bombs suffered | Laydowns | Mean own turns to lay down |','|---|---:|---:|---:|---:|---:|---:|---:|---:|',
      ...stats.map(s=>`| ${s.policy} | ${s.matchWins} | ${pct(s.matchWins)} | ${s.meanScore.toFixed(3)} | ${s.roundWins} | ${s.bombsInflicted} | ${s.bombsSuffered} | ${s.laidDown} | ${s.meanOwnTurnsToLayDown.toFixed(3)} |`),'',
      `| Goal | Points | ${policyNames[0]} laydowns | % of its laydowns | ${policyNames[1]} laydowns | % of its laydowns |`,'|---|---:|---:|---:|---:|---:|',
      ...summary.goals.map(g=>`| ${g.goal} | ${g.points} | ${g.counts[0]} | ${(100*g.counts[0]/stats[0].laidDown).toFixed(2)}% | ${g.counts[1]} | ${(100*g.counts[1]/stats[1].laidDown).toFixed(2)}% |`),'',
      '## Protocol','',...Object.entries(protocol).map(([k,v])=>`- ${k}: ${Array.isArray(v)?v.join(', '):v}`),
      '- Both players receive the same legal move/search capabilities and see only their own cards and public cards. Animation delays are disabled.',
      '- Each seed is a separate match. Goals carry over between its rounds; each match starts with fresh sheets. Results use points, not rounds won.',
      '- A round cap aborts the match. Capped partial matches are included in raw files but excluded from all completed-match statistics.',
      '- This experimental scoring format does not change the browser match-ending rules. The browser uses improved; aggressive preserves the previous control.',''];
    await writeFile(output+'.md',lines.join('\n'));
    console.log(JSON.stringify(summary,null,2));console.log(`Saved ${output}.{md,json.gz} and CSV/summary files.`);
  }
} finally {await server.close();}
