#!/usr/bin/env node
import { createServer } from 'vite';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Worker, workerData, parentPort } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name)+1] : fallback;
if (args.includes('--rounds') && args.includes('--matches')) throw Error('Use --rounds or --matches, not both');
const freshRounds = !args.includes('--matches');
const matches = workerData?.matches ?? Number(freshRounds ? option('--rounds',1000) : option('--matches',100));
const label = freshRounds ? 'independent first rounds' : 'matches';
const firstSeed = workerData?.firstSeed ?? Number(option('--seed',1));
const workerCount = workerData ? 1 : Math.min(matches,Number(option('--workers',Math.min(3,availableParallelism()))));
const maxRoundTurns = Number(option('--max-round-turns',500));
const output = option('--output','reports/ai/latest');
const policyName=option('--policy','improved');
const opponentName=option('--opponent',policyName);
const alternateStart=args.includes('--alternate-start');
const baseSeed=workerData?.baseSeed ?? firstSeed;
if (![policyName,opponentName].every(p=>['improved','aggressive','baseline'].includes(p))) throw Error('Unknown AI policy');
if (workerData?.expected && (workerData.expected.policyName!==policyName || workerData.expected.opponentName!==opponentName || workerData.expected.alternateStart!==alternateStart)) throw Error('Worker policy configuration mismatch');
if (![matches,firstSeed,maxRoundTurns,workerCount].every(Number.isSafeInteger) || matches < 1 || firstSeed < 0 || maxRoundTurns < 1 || workerCount < 1) throw Error('Invalid simulation options');
const overrideOption = option('--reward-exponent',null);
const rewardOverride = overrideOption === null ? null : Number(overrideOption);
if (rewardOverride !== null && (!Number.isFinite(rewardOverride) || rewardOverride <= 0)) throw Error('Invalid reward exponent');
const rewardPattern = /const REWARD_EXPONENT = ([\d.]+);/;
const rewardSource = await readFile(new URL('../src/engine/aiGoals.ts',import.meta.url),'utf8');
const rewardMatch = rewardSource.match(rewardPattern);
if (!rewardMatch) throw Error('Cannot identify production reward exponent');
const rewardExponent = rewardOverride ?? Number(rewardMatch[1]);
const threeRunOption = option('--three-run-weight',null);
const threeRunOverride = threeRunOption === null ? null : Number(threeRunOption);
if (threeRunOverride !== null && (!Number.isFinite(threeRunOverride) || threeRunOverride <= 0)) throw Error('Invalid three-run weight');
const threeRunPattern = /const THREE_RUN_REWARD_MULTIPLIER = ([\d.]+);/;
const threeRunMatch = rewardSource.match(threeRunPattern);
if (!threeRunMatch) throw Error('Cannot identify production three-run weight');
const threeRunWeight = threeRunOverride ?? Number(threeRunMatch[1]);
const offsetOption = option('--missing-offset',null);
const offsetOverride = offsetOption === null ? null : Number(offsetOption);
if (offsetOverride !== null && (!Number.isFinite(offsetOverride) || offsetOverride <= 0)) throw Error('Invalid missing-card offset');
if (offsetOverride !== null && offsetOverride !== 1) throw Error('Current policy experiments keep the missing-card offset at 1; use the historical revision for old offset experiments');
if (policyName==='baseline' && opponentName==='baseline' && (rewardOverride!==null || threeRunOverride!==null || offsetOverride!==null)) throw Error('The frozen baseline cannot be weight-tuned');
const offsetPattern = /const MISSING_CARD_OFFSET = ([\d.]+);/;
const offsetMatch = rewardSource.match(offsetPattern);
if (!offsetMatch) throw Error('Cannot identify production missing-card offset');
const missingOffset = offsetOverride ?? Number(offsetMatch[1]);
if (workerData?.expected && (workerData.expected.rewardExponent !== rewardExponent || workerData.expected.freshRounds !== freshRounds || workerData.expected.maxRoundTurns !== maxRoundTurns || workerData.expected.threeRunWeight !== threeRunWeight || workerData.expected.missingOffset !== missingOffset)) {
  throw Error('Worker did not receive requested experiment configuration');
}
// Experiments alter this constant in the headless module only. The served game
// and source files keep their production policy while candidate weights run.
const plugins = rewardOverride === null && threeRunOverride === null && offsetOverride === null ? [] : [{
  name:'simulation-reward-exponent',enforce:'pre',
  transform(code,id) {
    if (!id.endsWith('/src/engine/aiGoals.ts')) return;
    if (!rewardPattern.test(code)) throw Error('Cannot override reward exponent');
    if (rewardOverride !== null) code = code.replace(rewardPattern,`const REWARD_EXPONENT = ${rewardOverride};`);
    if (threeRunOverride !== null) {
      if (!threeRunPattern.test(code)) throw Error('Cannot override three-run weight');
      code = code.replace(threeRunPattern,`const THREE_RUN_REWARD_MULTIPLIER = ${threeRunOverride};`);
    }
    if (offsetOverride !== null) {
      if (!offsetPattern.test(code)) throw Error('Cannot override missing-card offset');
      code = code.replace(offsetPattern,`const MISSING_CARD_OFFSET = ${offsetOverride};`);
    }
    return {code,map:null};
  },
}];
const server = await createServer({plugins,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
try {
  const { Game } = await server.ssrLoadModule('/src/engine/game.ts');
  const { improvedAI, aggressiveAI } = await server.ssrLoadModule('/src/engine/aiPolicy.ts');
  let baselineAI;
  let baselineManifest=null;
  if ([policyName,opponentName].includes('baseline')) {
    baselineManifest=JSON.parse(await readFile(new URL('../tests/ai-baseline/manifest.json',import.meta.url),'utf8'));
    for (const [file,expected] of Object.entries({...baselineManifest.snapshotFiles,...baselineManifest.sharedRules})) {
      const text=await readFile(new URL('../'+file,import.meta.url),'utf8');
      const actual=createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
      if(actual!==expected)throw Error(`Frozen baseline integrity mismatch: ${file}`);
    }
    ({baselineAI}=await server.ssrLoadModule('/tests/ai-baseline/policy.ts'));
  }
  const policies={improved:improvedAI,aggressive:aggressiveAI,baseline:baselineAI};
  const policyBySeat=[policyName,opponentName];
  const { seededRng } = await server.ssrLoadModule('/src/engine/rng.ts');
  const { goalSheet } = await server.ssrLoadModule('/src/engine/goal.ts');
  const { assessGoals, RETAIN_EQUIVALENT_GOALS } = await server.ssrLoadModule('/src/engine/aiGoals.ts');
  if (workerData?.expected && workerData.expected.retainEquivalentGoals !== RETAIN_EQUIVALENT_GOALS) throw Error('Worker goal-retention policy mismatch');
  const probe = assessGoals({hand:[],goal:null,laidDown:false,goals:goalSheet()});
  if (probe.some(plan => plan.score !== plan.goal.points**rewardExponent*(plan.goal.name === '3R' ? threeRunWeight : 1)/(plan.missing+missingOffset))) {
    throw Error('Loaded AI scoring weights do not match requested experiment');
  }
  // Disable automatic scheduling only. The runner explicitly calls the original
  // turn implementation for either seat; pickup, AI and round rules are unchanged.
  class SimulationGame extends Game {
    async processAITurn() {}
    runTurn() { return super.processAITurn(); }
  }
  const revision = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const started = new Date().toISOString();
  const startedTime = performance.now();
  const startedCPU = process.cpuUsage();
  async function runBatch() {
    const results = [];
    for (let i = 0; i < matches; i++) {
      const seed = firstSeed+i;
      const game = new SimulationGame(seededRng(seed),async () => {},policyBySeat.map(name=>policies[name]));
      if (alternateStart) game.activePlayer=(seed-baseSeed)%2;
      const result = {seed,status:'running',finishers:[],rounds:[]};
      if (freshRounds && game.players.some(p=>p.goals.some(g=>g.completed))) throw Error('Fresh trial contains locked goals');
      while (!game.gameOver && result.rounds.length < 100) {
        const round = {number:result.rounds.length+1,starter:game.activePlayer,policyBySeat:[...policyBySeat],turns:0,winner:null,status:'running',laydowns:[],pursuits:[],
          available:game.players.map(p=>p.goals.filter(g=>!g.completed).map(g=>g.name)),
          targetTurns:{},targetChanges:0};
        const personalTurns = [0,0];
        const seen = new Set();
        const lastGoal = [null,null];
        const pursuits=[null,null];
        const closePursuit=(seat,outcome)=>{
          const pursuit=pursuits[seat];if(!pursuit)return;
          round.pursuits.push({seat,policy:policyBySeat[seat],goal:pursuit.goal,firstOwnTurn:pursuit.start,lastOwnTurn:personalTurns[seat],targetedTurns:pursuit.turns.size,outcome});
          pursuits[seat]=null;
        };
        const unsubscribe = game.subscribe(()=> {
          game.players.forEach((p,seat)=> {
            if (p.goal && p.goal !== lastGoal[seat]) {
              if (lastGoal[seat]) round.targetChanges++;
              closePursuit(seat,'switched');
              pursuits[seat]={goal:p.goal.name,start:personalTurns[seat],turns:new Set()};
              lastGoal[seat] = p.goal;
            }
            if (pursuits[seat] && personalTurns[seat]>0) pursuits[seat].turns.add(personalTurns[seat]);
            if (p.laidDown && !seen.has(seat)) {
              closePursuit(seat,'laid-down');
              seen.add(seat);
              round.laydowns.push({seat,policy:policyBySeat[seat],goal:p.goal.name,points:p.goal.points,turn:round.turns,personalTurn:personalTurns[seat],cardsRemaining:p.hand.length});
            }
          });
        });
        while (!game.roundResult && round.turns < maxRoundTurns) {
          const seat = game.activePlayer;
          round.turns++; personalTurns[seat]++;
          await game.runTurn();
          const p = game.players[seat];
          // Target-turn counts are diagnostic only; laydown events are authoritative.
          if (p.goal && !p.laidDown) round.targetTurns[p.goal.name]=(round.targetTurns[p.goal.name]||0)+1;
          const cards = [...game.deck.cards,...game.discardPile,...game.players.flatMap(p=>[...p.hand,...(p.goal?.formations.flatMap(f=>f.cards)??[])])];
          if (cards.length !== 104 || new Set(cards).size !== 104) throw Error(`Card conservation failed: seed ${seed}, round ${round.number}, turn ${round.turns}`);
        }
        unsubscribe();
        for(let seat=0;seat<2;seat++)closePursuit(seat,game.roundResult ? 'round-ended' : 'capped');
        if (game.roundResult) {
          round.status='completed'; round.winner=game.roundResult.winner;
          if (!freshRounds) game.confirmRound();
        } else { round.status='turn-limit'; result.status='round-turn-limit'; }
        result.rounds.push(round);
        if (round.status !== 'completed') break;
        if (freshRounds) { result.status='completed'; break; }
      }
      result.finishers=[...game.finishers];
      if (game.gameOver) result.status='completed';
      else if (result.status === 'running') result.status='match-round-limit';
      game.dispose(); results.push(result);
      if ((i+1)%(freshRounds?50:5)===0 || i===matches-1) {
        if (parentPort) parentPort.postMessage({progress:i+1});
        else console.log(`${i+1}/${matches} ${label}; ${results.filter(m=>m.status==='completed').length} completed; ${results.reduce((n,m)=>n+m.rounds.length,0)} rounds`);
      }
      // Yield between matches so the process remains responsive.
      await new Promise(resolve=>setImmediate(resolve));
    }
    return results;
  }
  let results;
  if (workerCount === 1) results = await runBatch();
  else {
    const workers = [];
    const progress = Array(workerCount).fill(0);
    let offset = 0;
    try {
      results = (await Promise.all(Array.from({length:workerCount},(_,index)=>{
        const count = Math.floor(matches/workerCount)+(index < matches%workerCount ? 1 : 0);
        const seed = firstSeed+offset; offset += count;
        return new Promise((resolve,reject)=>{
          const worker = new Worker(new URL(import.meta.url),{argv:args,workerData:{matches:count,firstSeed:seed,baseSeed,expected:{policyName,opponentName,alternateStart,freshRounds,rewardExponent,threeRunWeight,missingOffset,retainEquivalentGoals:RETAIN_EQUIVALENT_GOALS,maxRoundTurns}}});
          workers.push(worker);
          let trials;
          worker.on('message',message=>{
            if (message.progress !== undefined) {
              progress[index] = message.progress;
              console.log(`${progress.reduce((a,b)=>a+b,0)}/${matches} ${label}; ${workerCount} workers`);
            } else trials = message.trials;
          });
          worker.on('error',reject);
          worker.on('exit',code=>code === 0 && trials ? resolve(trials) : reject(Error(`Simulation worker exited ${code}`)));
        });
      }))).flat().sort((a,b)=>a.seed-b.seed);
    } finally { await Promise.all(workers.map(worker=>worker.terminate())); }
  }
  if (parentPort) parentPort.postMessage({trials:results});
  else {
    const rounds=results.flatMap(m=>m.rounds);
    const lays=rounds.flatMap(r=>r.laydowns);
    const openingLays=results.flatMap(m=>m.rounds[0]?.laydowns??[]);
    const openingFirst=results.flatMap(m=>m.rounds[0]?.laydowns.slice(0,1)??[]);
    const average = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
    const goalDistribution=(eventsForPolicy,policy)=>goalSheet().map(goal=>{
      const events=eventsForPolicy.filter(l=>l.goal===goal.name);
      const turns=events.map(l=>l.personalTurn).sort((a,b)=>a-b);
      const middle=Math.floor(turns.length/2);
      const attempts=rounds.flatMap(r=>r.pursuits).filter(p=>p.goal===goal.name && (!policy || p.policy===policy));
      const abandoned=attempts.filter(p=>p.outcome!=='laid-down');
      return {goal:goal.name,points:goal.points,laydowns:events.length,share:eventsForPolicy.length ? events.length/eventsForPolicy.length : 0,
        openingRoundLaydowns:openingLays.filter(l=>l.goal===goal.name && eventsForPolicy.includes(l)).length,
        openingRoundFirstLaydowns:openingFirst.filter(l=>l.goal===goal.name && eventsForPolicy.includes(l)).length,
        availablePlayerRounds:rounds.reduce((n,r)=>n+r.available.filter((goals,seat)=>goals.includes(goal.name) && (!policy || r.policyBySeat[seat]===policy)).length,0),
        pursuits:attempts.length,abandonedPursuits:abandoned.length,meanTargetedTurnsAllPursuits:average(attempts.map(p=>p.targetedTurns)),meanAbandonedTargetedTurns:average(abandoned.map(p=>p.targetedTurns)),
        averagePersonalTurnsToLaydown:average(turns),
        medianPersonalTurnsToLaydown:turns.length ? (turns.length%2 ? turns[middle] : (turns[middle-1]+turns[middle])/2) : null,
        minPersonalTurnsToLaydown:turns[0] ?? null,maxPersonalTurnsToLaydown:turns.at(-1) ?? null,
        roundWins:rounds.reduce((n,r)=>n+r.laydowns.filter(l=>l.goal===goal.name && l.seat===r.winner && eventsForPolicy.includes(l)).length,0),
        seat0Laydowns:events.filter(l=>l.seat===0).length,seat1Laydowns:events.filter(l=>l.seat===1).length};
    });
    const distribution=goalDistribution(lays);
    const policyDistributions=Object.fromEntries([...new Set(policyBySeat)].map(name=>[name,goalDistribution(lays.filter(l=>l.policy===name),name)]));
    const policyResults=[...new Set(policyBySeat)].map(name=>{
      const seats=policyBySeat.flatMap((p,i)=>p===name?[i]:[]);
      const encounters=rounds.length*seats.length;
      const wins=rounds.filter(r=>r.winner!==null && r.policyBySeat[r.winner]===name).length;
      const attempts=rounds.flatMap(r=>r.pursuits).filter(p=>p.policy===name);
      const completedEncounters=rounds.filter(r=>r.status==='completed').length*seats.length;
      return {policy:name,encounters,wins,completedEncounters,winRate:completedEncounters?wins/completedEncounters:0,
        laydowns:lays.filter(l=>l.policy===name).length,
        endedWithoutLaydown:rounds.reduce((n,r)=>n+seats.filter(seat=>!r.laydowns.some(l=>l.seat===seat)).length,0),
        pursuits:attempts.length,abandonedPursuits:attempts.filter(p=>p.outcome!=='laid-down').length,
        meanTargetedTurns:average(attempts.map(p=>p.targetedTurns))};
    });
    const starts=[0,1].map(seat=>({starterSeat:seat,starterPolicy:policyBySeat[seat],rounds:rounds.filter(r=>r.starter===seat).length,
      seat0Wins:rounds.filter(r=>r.starter===seat && r.winner===0).length,
      seat1Wins:rounds.filter(r=>r.starter===seat && r.winner===1).length,
      capped:rounds.filter(r=>r.starter===seat && r.status!=='completed').length}));
    const summary={mode:freshRounds?'independent-first-rounds':'full-matches',trials:matches,completedTrials:results.filter(m=>m.status==='completed').length,
      cappedTrials:results.filter(m=>m.status!=='completed').map(m=>({seed:m.seed,status:m.status,lastRound:m.rounds.at(-1).number})),
      rounds:rounds.length,completedRounds:rounds.filter(r=>r.status==='completed').length,
      laydowns:lays.length,openingRoundLaydowns:openingLays.length,openingRoundFirstLaydowns:openingFirst.length,
      averageTurnsPerCompletedRound:average(rounds.filter(r=>r.status==='completed').map(r=>r.turns)),distribution,policyDistributions,policyResults,starts};
    const cpu = process.cpuUsage(startedCPU);
    const timing = {workers:workerCount,wallSeconds:(performance.now()-startedTime)/1000,cpuSeconds:(cpu.user+cpu.system)/1e6,playerTurns:rounds.reduce((n,r)=>n+r.turns,0)};
    const report={started,finished:new Date().toISOString(),commit:revision,
      baselineManifest,config:{trials:matches,mode:summary.mode,firstSeed,policyBySeat,policyIds:policyBySeat.map(name=>policies[name].id),alternateStart,baseSeed,rewardExponent,rewardExponentOverride:rewardOverride,threeRunWeight,threeRunWeightOverride:threeRunOverride,missingOffset,missingOffsetOverride:offsetOverride,retainEquivalentGoals:RETAIN_EQUIVALENT_GOALS,maxRoundTurns,maxRoundsPerTrial:freshRounds?1:100,policy:'production AI with recorded selection weights; delays skipped; fresh game per seed'},timing,summary,trials:results};
    await mkdir(path.dirname(output),{recursive:true});
    await writeFile(`${output}.json`,JSON.stringify(report,null,2)+'\n');
    const columns=Object.keys(distribution[0]);
    await writeFile(`${output}.csv`,columns.join(',')+'\n'+distribution.map(row=>columns.map(c=>row[c]??'').join(',')).join('\n')+'\n');
    for(const [name,rows] of Object.entries(policyDistributions)){
      const keys=Object.keys(rows[0]);
      await writeFile(`${output}.${name}.csv`,keys.join(',')+'\n'+rows.map(row=>keys.map(k=>row[k]??'').join(',')).join('\n')+'\n');
    }
    const md=[`# Automated AI ${label}`, '',`Engine commit: ${report.commit}. Seeds ${firstSeed}–${firstSeed+matches-1}.`,
      '',`${summary.completedTrials}/${matches} ${label} completed; ${summary.cappedTrials.length} capped. ${summary.completedRounds}/${rounds.length} rounds completed; ${lays.length} laydowns.`,
      '',`Reward exponent: ${rewardExponent}${rewardOverride === null ? ' (production)' : ' (headless experiment override)'}. Three-run selection multiplier: ${threeRunWeight}${threeRunOverride === null ? ' (production)' : ' (headless experiment override)'}. Missing-card offset: ${missingOffset}.`,
      '',`Equivalent-target retention: ${RETAIN_EQUIVALENT_GOALS ? 'enabled (same actual points and missing count)' : 'disabled'}.`,
      '',`Runtime: ${timing.wallSeconds.toFixed(2)} seconds; ${timing.playerTurns} player turns; ${workerCount} worker(s). All artificial AI waits are disabled. Policy source IDs and frozen baseline hashes are recorded in the JSON.`,
      '',`Policies by seat: ${policyBySeat.join(' versus ')}. Starter: ${alternateStart ? 'alternating seats' : 'seat 0'}.`,
      '',`The improved policy uses the selection weights recorded above; the baseline policy is frozen at d64208e. Delays are skipped; no human strategy is modelled. Each player turn counts once. ${freshRounds ? 'Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included.' : 'A match ends only when the existing game-over rule is reached.'} Limits: ${maxRoundTurns} turns per round${freshRounds ? '' : ', 100 rounds per match'}. Capped trials remain in the raw results and their observed laydowns remain in this table.`,
      '',`${freshRounds ? 'All counts below are from independent opening rounds; no goal was locked before a trial began.' : 'Full-match distribution includes later rounds where previously completed goals are unavailable. Opening-round results show the policy while all ten goals remain available.'} These are automated-policy observations, not predictions of win rates against a human. Laydown timing includes successful laydowns only; pursuit statistics include abandoned goals. A pursuit counts each own turn on which its goal was targeted, so mid-turn switches can expose two goals in one turn.`,
      '',`## Goal statistics (all participating policies)`,
      '',freshRounds ? `| Goal | Points | Laydowns | Share | First laydown | Round wins | Mean own turns | Median | Min–max |` : `| Goal | Points | All laydowns | Share | Opening round laydowns | First laydown in opening round | Mean personal turns to lay down |`,
      freshRounds ? `|---|---:|---:|---:|---:|---:|---:|---:|---:|` : `|---|---:|---:|---:|---:|---:|---:|`,
      ...distribution.map(d=>`| ${d.goal} | ${d.points} | ${d.laydowns} | ${(d.share*100).toFixed(1)}% | ${freshRounds ? '' : `${d.openingRoundLaydowns} | `}${d.openingRoundFirstLaydowns} | ${freshRounds ? `${d.roundWins} | ` : ''}${d.averagePersonalTurnsToLaydown?.toFixed(1)??'—'} |${freshRounds ? ` ${d.medianPersonalTurnsToLaydown??'—'} | ${d.laydowns ? `${d.minPersonalTurnsToLaydown}–${d.maxPersonalTurnsToLaydown}` : '—'} |` : ''}`),
      '',`## Policy results`, '',`| Policy | Player-rounds | Wins | Laydowns | Ended without laydown | Abandoned pursuits |`, `|---|---:|---:|---:|---:|---:|`,
      ...policyResults.map(p=>`| ${p.policy} | ${p.encounters} | ${p.wins} | ${p.laydowns} | ${p.endedWithoutLaydown} | ${p.abandonedPursuits} |`),
      ...Object.entries(policyDistributions).flatMap(([name,rows])=>[
        '',`## Goal statistics: ${name}`,'',`| Goal | Laydowns | Share | Wins | Mean own turns to lay down | Pursuits | Abandoned | Mean own turns per abandoned pursuit |`,
        `|---|---:|---:|---:|---:|---:|---:|---:|`,
        ...rows.map(d=>`| ${d.goal} | ${d.laydowns} | ${(d.share*100).toFixed(1)}% | ${d.roundWins} | ${d.averagePersonalTurnsToLaydown?.toFixed(1)??'—'} | ${d.pursuits} | ${d.abandonedPursuits} | ${d.meanAbandonedTargetedTurns?.toFixed(1)??'—'} |`),
      ]),
      '',`## Starter breakdown`, '',`| Starter | Rounds | Seat 0 wins | Seat 1 wins | Capped |`, `|---|---:|---:|---:|---:|`,
      ...starts.map(s=>`| Seat ${s.starterSeat} (${s.starterPolicy}) | ${s.rounds} | ${s.seat0Wins} | ${s.seat1Wins} | ${s.capped} |`),
      '',`Raw per-match/per-round events: [JSON](${path.basename(output)}.json). Aggregate data: [CSV](${path.basename(output)}.csv).`,
      '',`Reproduce: \`./scripts/with-node npm run simulate:ai -- ${freshRounds ? '--rounds' : '--matches'} ${matches} --seed ${firstSeed} --max-round-turns ${maxRoundTurns} --workers ${workerCount} --policy ${policyName} --opponent ${opponentName}${alternateStart ? ' --alternate-start' : ''}${rewardOverride === null ? '' : ` --reward-exponent ${rewardOverride}`}${threeRunOverride === null ? '' : ` --three-run-weight ${threeRunOverride}`}${offsetOverride === null ? '' : ` --missing-offset ${offsetOverride}`} --output ${output}\``,
      ...(summary.cappedTrials.length?['','Capped seeds: '+summary.cappedTrials.map(m=>`${m.seed} (${m.status}, round ${m.lastRound})`).join(', ')]:[])];
    await writeFile(`${output}.md`,md.join('\n')+'\n');
    console.log(JSON.stringify(summary,null,2));
    console.log(`Timing: ${JSON.stringify(timing)}`);
    console.log(`Reports: ${output}.{md,csv,json}`);
  }
} finally { await server.close(); }
