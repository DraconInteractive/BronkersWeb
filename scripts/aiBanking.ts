import { Game } from '../src/engine/game';
import { aggressiveAI, conservativeAI } from '../src/engine/aiPolicy';
import type { AIPolicy } from '../src/engine/aiPolicy';
import { seededRng } from '../src/engine/rng';

export const bankingProtocol = {
  rounds:10, policies:['conservative-banking-v1','availability-and-going-out-v1'],
  scoring:'Goal points banked immediately on laydown, once per player/round; no round-win bonus. Bombed players score zero for that round.',
  goals:'Each goal usable once per player per match; goal sheets reset between matches.',
  starters:'Seat 0 conservative, seat 1 aggressive; initial starter alternates by match; round starter alternates within each match.',
  conservative:'Ready goals first; otherwise sqrt(reward)/(availability distance+1), without aggressive exit-card cost. Shared immediate-win override and move search.',
  aggressive:'Preserved aggressive control: reward^1.65 (3R multiplier 1.05)/(availability distance+0.35*exitCards+1).',
} as const;

export type BankEvent = {seat:number;goal:string;points:number;turn:number;personalTurn:number;cardsRemaining:number};
export type BankingRound = {number:number;starter:number;turns:number;winner:number|null;status:'running'|'completed'|'turn-limit';laydowns:BankEvent[];scores:number[];bombed:number|null};
export type BankingMatch = {seed:number;starter:number;status:'completed'|'turn-limit';winner:number|null;scores:number[];rounds:BankingRound[]};

/** Independent score ledger observes the real engine's laydown transition. */
export class BankingLedger {
  scores=[0,0];
  private completed=[new Set<string>(),new Set<string>()];
  private paid=new Set<number>();
  beginRound() {this.paid.clear();}
  bank(event:BankEvent):boolean {
    if(this.paid.has(event.seat)) return false;
    if(![0,1].includes(event.seat) || !Number.isInteger(event.points) || event.points<1) throw Error('Invalid bank event');
    if(this.completed[event.seat].has(event.goal)) throw Error('Goal banked twice in a match');
    this.paid.add(event.seat);this.completed[event.seat].add(event.goal);
    this.scores[event.seat]+=event.points;return true;
  }
  winner() {return this.scores[0]===this.scores[1] ? null : this.scores[0]>this.scores[1] ? 0 : 1;}
}

class BankingGame extends Game {
  // The harness manually runs either seat with no animation delay.
  override async processAITurn() {}
  runTurn() {return super.processAITurn();}
}
export async function runBankingMatch(seed:number,starter:number,maxRoundTurns=500,policies:readonly AIPolicy[]=[conservativeAI,aggressiveAI]):Promise<BankingMatch> {
  if(policies.length!==2) throw Error('Banking experiment requires two policies');
  const game=new BankingGame(seededRng(seed),async()=>{},policies,{mode:'points'});
  const ledger=new BankingLedger();
  const match:BankingMatch={seed,starter,status:'completed',winner:null,scores:[],rounds:[]};
  try {
    for(let index=0;index<bankingProtocol.rounds;index++) {
      if(game.gameOver) throw Error('Unexpected game over before tenth round');
      game.activePlayer=(starter+index)%2;
      ledger.beginRound();
      const round:BankingRound={number:index+1,starter:game.activePlayer,turns:0,winner:null,status:'running',laydowns:[],scores:[0,0],bombed:null};
      const personalTurns=[0,0];
      const unsubscribe=game.subscribe(()=>{
        game.players.forEach((player,seat)=>{
          if(!player.laidDown || !player.goal) return;
          const event:BankEvent={seat,goal:player.goal.name,points:player.goal.points,turn:round.turns,personalTurn:personalTurns[seat],cardsRemaining:player.hand.length};
          if(ledger.bank(event)){round.laydowns.push(event);round.scores[seat]+=event.points;}
        });
      });
      try {
        while(!game.roundResult && round.turns<maxRoundTurns) {
          round.turns++;personalTurns[game.activePlayer]++;
          await game.runTurn();
          const cards=[...game.deck.cards,...game.discardPile,...game.players.flatMap(p=>[...p.hand,...(p.goal?.formations.flatMap(f=>f.cards)??[])])];
          if(cards.length!==104 || new Set(cards).size!==104) throw Error(`Card conservation: seed ${seed} round ${index+1}`);
        }
      } finally {unsubscribe();}
      if(game.roundResult) {
        round.status='completed';round.winner=game.roundResult.winner;
        const loser=1-round.winner;
        if(!game.players[loser].laidDown) round.bombed=loser;
        if(!game.players[round.winner].laidDown || !round.laydowns.some(e=>e.seat===round.winner)) throw Error('Winner did not bank a goal');
      } else {round.status='turn-limit';match.status='turn-limit';}
      match.rounds.push(round);
      if(round.status!=='completed') break;
      if(index+1<bankingProtocol.rounds) game.confirmRound();
    }
    if(game.scores.some((score,seat)=>score!==ledger.scores[seat])) throw Error('Engine scores disagree with independent banking ledger');
    match.scores=[...ledger.scores];
    if(match.scores.some(s=>s>54)) throw Error('Score exceeds single-use goal sheet');
    if(match.status==='completed') {
      match.winner=ledger.winner();
      const winners=match.winner===null?[0,1]:[match.winner];
      if(game.finishers.join()!==winners.join()) throw Error('Engine match winner disagrees with independent ledger');
    }
    return match;
  } finally {game.dispose();}
}
