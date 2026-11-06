#!/usr/bin/env node
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Worker, workerData, parentPort } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

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
if (![matches,firstSeed,maxRoundTurns,workerCount].every(Number.isSafeInteger) || matches < 1 || firstSeed < 0 || maxRoundTurns < 1 || workerCount < 1) throw Error('Invalid simulation options');
const server = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const { Game } = await server.ssrLoadModule('/src/engine/game.ts');
  const { seededRng } = await server.ssrLoadModule('/src/engine/rng.ts');
  const { goalSheet } = await server.ssrLoadModule('/src/engine/goal.ts');
  // Disable automatic scheduling only. The runner explicitly calls the original
  // turn implementation for either seat; pickup, AI and round rules are unchanged.
  class SimulationGame extends Game {
    async processAITurn() {}
    runTurn() { return super.processAITurn(); }
  }
  const started = new Date().toISOString();
  const startedTime = performance.now();
  const startedCPU = process.cpuUsage();
  async function runBatch() {
    const results = [];
    for (let i = 0; i < matches; i++) {
      const seed = firstSeed+i;
      const game = new SimulationGame(seededRng(seed),async () => {});
      const result = {seed,status:'running',finishers:[],rounds:[]};
      if (freshRounds && game.players.some(p=>p.goals.some(g=>g.completed))) throw Error('Fresh trial contains locked goals');
      while (!game.gameOver && result.rounds.length < 100) {
        const round = {number:result.rounds.length+1,turns:0,winner:null,status:'running',laydowns:[],
          available:game.players.map(p=>p.goals.filter(g=>!g.completed).map(g=>g.name)),
          targetTurns:{},targetChanges:0};
        const personalTurns = [0,0];
        const seen = new Set();
        const lastGoal = [null,null];
        const unsubscribe = game.subscribe(()=> {
          game.players.forEach((p,seat)=> {
            if (p.goal && p.goal !== lastGoal[seat]) {
              if (lastGoal[seat]) round.targetChanges++;
              lastGoal[seat] = p.goal;
            }
            if (p.laidDown && !seen.has(seat)) {
              seen.add(seat);
              round.laydowns.push({seat,goal:p.goal.name,points:p.goal.points,turn:round.turns,personalTurn:personalTurns[seat],cardsRemaining:p.hand.length});
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
          const worker = new Worker(new URL(import.meta.url),{workerData:{matches:count,firstSeed:seed}});
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
    const distribution=goalSheet().map(goal=>{
      const events=lays.filter(l=>l.goal===goal.name);
      return {goal:goal.name,points:goal.points,laydowns:events.length,share:lays.length ? events.length/lays.length : 0,
        openingRoundLaydowns:openingLays.filter(l=>l.goal===goal.name).length,
        openingRoundFirstLaydowns:openingFirst.filter(l=>l.goal===goal.name).length,
        availablePlayerRounds:rounds.reduce((n,r)=>n+r.available.filter(goals=>goals.includes(goal.name)).length,0),
        averagePersonalTurnsToLaydown:average(events.map(l=>l.personalTurn)),
        firstSeat:events.filter(l=>l.seat===0).length,secondSeat:events.filter(l=>l.seat===1).length};
    });
    const summary={mode:freshRounds?'independent-first-rounds':'full-matches',trials:matches,completedTrials:results.filter(m=>m.status==='completed').length,
      cappedTrials:results.filter(m=>m.status!=='completed').map(m=>({seed:m.seed,status:m.status,lastRound:m.rounds.at(-1).number})),
      rounds:rounds.length,completedRounds:rounds.filter(r=>r.status==='completed').length,
      laydowns:lays.length,openingRoundLaydowns:openingLays.length,openingRoundFirstLaydowns:openingFirst.length,
      averageTurnsPerCompletedRound:average(rounds.filter(r=>r.status==='completed').map(r=>r.turns)),distribution};
    const cpu = process.cpuUsage(startedCPU);
    const timing = {workers:workerCount,wallSeconds:(performance.now()-startedTime)/1000,cpuSeconds:(cpu.user+cpu.system)/1e6,playerTurns:rounds.reduce((n,r)=>n+r.turns,0)};
    const report={started,finished:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      config:{trials:matches,mode:summary.mode,firstSeed,maxRoundTurns,maxRoundsPerTrial:freshRounds?1:100,policy:'current production AI in both seats; delays skipped; fresh game per seed'},timing,summary,trials:results};
    await mkdir(path.dirname(output),{recursive:true});
    await writeFile(`${output}.json`,JSON.stringify(report,null,2)+'\n');
    const columns=Object.keys(distribution[0]);
    await writeFile(`${output}.csv`,columns.join(',')+'\n'+distribution.map(row=>columns.map(c=>row[c]??'').join(',')).join('\n')+'\n');
    const md=[`# Automated AI ${label}`, '',`Engine commit: ${report.commit}. Seeds ${firstSeed}–${firstSeed+matches-1}.`,
      '',`${summary.completedTrials}/${matches} ${label} completed; ${summary.cappedTrials.length} capped. ${summary.completedRounds}/${rounds.length} rounds completed; ${lays.length} laydowns.`,
      '',`Runtime: ${timing.wallSeconds.toFixed(2)} seconds; ${timing.playerTurns} player turns; ${workerCount} worker(s). All artificial AI waits are disabled.`,
      '',`Both seats use the production AI, including its current reward weighting. Delays are skipped; no human strategy is modelled. Each player turn counts once. ${freshRounds ? 'Every trial creates a fresh game with all ten goals available to both players, and stops at the first round result. No later rounds are included.' : 'A match ends only when the existing game-over rule is reached.'} Limits: ${maxRoundTurns} turns per round${freshRounds ? '' : ', 100 rounds per match'}. Capped trials remain in the raw results and their observed laydowns remain in this table.`,
      '',`${freshRounds ? 'All counts below are from independent opening rounds; no goal was locked before a trial began.' : 'Full-match distribution includes later rounds where previously completed goals are unavailable. Opening-round results show the policy while all ten goals remain available.'} These are self-play observations, not predictions of win rates against a human.`,
      '',freshRounds ? `| Goal | Points | Laydowns | Share | First laydown in round | Mean personal turns to lay down |` : `| Goal | Points | All laydowns | Share | Opening round laydowns | First laydown in opening round | Mean personal turns to lay down |`,
      freshRounds ? `|---|---:|---:|---:|---:|---:|` : `|---|---:|---:|---:|---:|---:|---:|`,
      ...distribution.map(d=>`| ${d.goal} | ${d.points} | ${d.laydowns} | ${(d.share*100).toFixed(1)}% | ${freshRounds ? '' : `${d.openingRoundLaydowns} | `}${d.openingRoundFirstLaydowns} | ${d.averagePersonalTurnsToLaydown?.toFixed(1)??'—'} |`),
      '',`Raw per-match/per-round events: [JSON](${path.basename(output)}.json). Aggregate data: [CSV](${path.basename(output)}.csv).`,
      '',`Reproduce: \`./scripts/with-node npm run simulate:ai -- ${freshRounds ? '--rounds' : '--matches'} ${matches} --seed ${firstSeed} --max-round-turns ${maxRoundTurns} --workers ${workerCount} --output ${output}\``,
      ...(summary.cappedTrials.length?['','Capped seeds: '+summary.cappedTrials.map(m=>`${m.seed} (${m.status}, round ${m.lastRound})`).join(', ')]:[])];
    await writeFile(`${output}.md`,md.join('\n')+'\n');
    console.log(JSON.stringify(summary,null,2));
    console.log(`Timing: ${JSON.stringify(timing)}`);
    console.log(`Reports: ${output}.{md,csv,json}`);
  }
} finally { await server.close(); }
