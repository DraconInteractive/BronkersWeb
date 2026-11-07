#!/usr/bin/env node
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
const [source,output='.data/rounds-export.json']=process.argv.slice(2);
if(!source)throw Error('Usage: node scripts/export-rounds.mjs https://bronkers.dracon.au [output.json]');
const given=new URL(source),url=given.pathname==='/api/rounds'?given:new URL('/api/rounds',given);
if(!['http:','https:'].includes(url.protocol))throw Error('Expected an HTTP(S) endpoint');
if(!url.searchParams.has('limit'))url.searchParams.set('limit','1000');
let after=0,through;const rounds=[];
for(;;){
  url.searchParams.set('after',String(after));if(through!==undefined)url.searchParams.set('through',String(through));
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Export failed: HTTP ${response.status}`);
  const page=await response.json();
  if(page.schemaVersion!==1||!Array.isArray(page.rounds)||typeof page.hasMore!=='boolean'||!Number.isSafeInteger(page.snapshotThrough)||!Number.isSafeInteger(page.nextAfter))throw Error('Invalid export response');
  through??=page.snapshotThrough;if(page.snapshotThrough!==through)throw Error('Export snapshot changed');
  rounds.push(...page.rounds);if(!page.hasMore)break;
  if(page.nextAfter<=after)throw Error('Export cursor did not advance');after=page.nextAfter;
}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({source,exportedAt:new Date().toISOString(),snapshotThrough:through,rounds},null,2)+'\n');
console.log(`Saved ${rounds.length} rounds to ${output}`);
