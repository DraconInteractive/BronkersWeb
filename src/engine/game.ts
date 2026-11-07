import { Card } from './card';
import { Deck } from './deck';
import type { Formation } from './formation';
import { Player } from './player';
import { improvedAI, type AIPolicy } from './aiPolicy';
import type { AIKnowledge } from './aiKnowledge';
import type { GoalAssessment } from './aiGoals';
import { publicGoal } from './aiMatch';
import type { RNG } from './rng';
export enum Phase { WaitForPickup, PlayerActions, SelectDiscard }
export const LAY_DOWN_FIRST_MESSAGE = "Lay down your goal before adding cards to your opponent's formations.";
export type RoundResult = {
  winner: number;
  players: Array<{ index: number; laidDown: boolean; cardsRemaining: number; goal: string | null }>;
};
export type GameOptions = {mode?:'goals'|'points'};
export type Scheduler = (milliseconds: number) => Promise<void>;
export class Game {
  readonly mode:'goals'|'points';
  readonly roundLimit=10;
  scores=[0,0];
  roundNumber=1;
  deck: Deck;
  players = [new Player(), new Player()];
  discardPile: Card[] = [];
  activePlayer = 0;
  phase = Phase.WaitForPickup;
  statusMessage: string | null = null;
  gameOver = false;
  roundResult: RoundResult | null = null;
  finishers: number[] = [];
  selectedHand: Card[] = [];
  selectedFormationCards: Card[] = [];
  private listeners = new Set<() => void>();
  private disposed = false;
  aiTask: Promise<void> | null = null;
  constructor(public rng: RNG = Math.random, private delay: Scheduler = ms => new Promise(r => setTimeout(r,ms)), readonly aiPolicies: readonly AIPolicy[] = [], options:GameOptions={}) {
    this.mode=options.mode??'goals';
    this.deck = new Deck(rng); this.setupRound();
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose() { this.disposed = true; this.listeners.clear(); }
  get human() { return this.players[0]; }
  get paused() { return this.gameOver || this.roundResult !== null; }
  get myTurn() { return !this.paused && this.activePlayer === 0; }
  get acting() { return this.myTurn && this.phase === Phase.PlayerActions; }
  get canPickup() { return this.myTurn && this.phase === Phase.WaitForPickup; }
  changed() {
    this.selectedHand = this.selectedHand.filter(c => this.human.hand.includes(c));
    const formations = this.players.flatMap(p => p.goal?.formations ?? []);
    this.selectedFormationCards = this.selectedFormationCards.filter(c => formations.some(f => f.cards.includes(c)));
    for (const listener of this.listeners) listener();
  }
  setupRound() {
    this.roundResult = null;
    this.statusMessage = null;
    this.selectedHand = []; this.selectedFormationCards = []; this.discardPile = [];
    this.deck.initializeCards();
    for (const p of this.players) { p.reset(); p.takeCards(this.deck.deal(13).cards); }
    this.discardPile.push(this.deck.deal(1).cards[0]);
    this.activePlayer = this.mode==='points'?(this.roundNumber-1)%2:0; this.phase = Phase.WaitForPickup; this.changed();
  }
  newGame() {
    if (!this.gameOver) return;
    this.players = [new Player(), new Player()]; this.deck = new Deck(this.rng);
    this.gameOver = false; this.finishers = []; this.scores=[0,0];this.roundNumber=1; this.setupRound();
  }
  tryEndRound() {
    if (this.paused) return true;
    const p = this.players[this.activePlayer];
    if (!p.laidDown || p.hand.length) return false;
    this.statusMessage = null;
    this.finishers = this.mode==='points'
      ? (this.roundNumber===this.roundLimit ? this.scores.flatMap((score,i)=>score===Math.max(...this.scores)?[i]:[]) : [])
      : this.players.flatMap((p,i) => p.goals.every(g => g.completed) ? [i] : []);
    this.roundResult = {
      winner: this.activePlayer,
      players: this.players.map((player,index) => ({
        index, laidDown: player.laidDown, cardsRemaining: player.hand.length,
        goal: player.laidDown ? player.goal?.name ?? null : null,
      })),
    };
    this.changed();
    return true;
  }
  confirmRound() {
    if (!this.roundResult || this.gameOver) return;
    this.roundResult = null;
    if (this.finishers.length) { this.gameOver = true; this.changed(); }
    else {
      this.roundNumber++;this.setupRound();
      if(this.activePlayer!==0) this.aiTask=this.processAITurn();
    }
  }
  pickup(fromDiscard = false) {
    if (this.paused || this.phase !== Phase.WaitForPickup) return;
    const p = this.players[this.activePlayer];
    if (fromDiscard) {
      const c = this.discardPile.pop(); if (!c) return;
      p.takeCards([c]);
    } else {
      const dealt = this.deck.deal(1); p.takeCards(dealt.cards);
      if (dealt.remaining) {
        const top = this.discardPile.at(-1);
        this.deck.add(this.discardPile.slice(0,-1),true);
        this.discardPile = top ? [top] : [];
        p.takeCards(this.deck.deal(dealt.remaining).cards);
      }
    }
    this.statusMessage = null;
    this.phase = Phase.PlayerActions; this.changed();
  }
  humanPickup(fromDiscard = false) { if (this.canPickup) this.pickup(fromDiscard); }
  finishActions() { if (!this.paused && this.phase === Phase.PlayerActions) { this.statusMessage = null; this.phase = Phase.SelectDiscard; this.changed(); } }
  humanFinish() { if (this.acting) this.finishActions(); }
  discard(p: Player, card: Card) {
    if (this.paused || p !== this.players[this.activePlayer] || this.phase !== Phase.SelectDiscard || !p.hand.includes(card)) return;
    this.discardPile.push(card); p.removeCards([card]);
    if (!this.tryEndRound()) this.nextPlayer();
    this.changed();
  }
  humanDiscard() { if (this.myTurn && this.selectedHand.length === 1) this.discard(this.human,this.selectedHand[0]); }
  nextPlayer() {
    if (this.paused) return;
    this.statusMessage = null; this.activePlayer = (this.activePlayer+1) % this.players.length;
    this.phase = Phase.WaitForPickup; this.changed();
    if (this.activePlayer !== 0) this.aiTask = this.processAITurn();
  }
  chooseGoal(index: number) {
    const goal = this.human.goals[index];
    if (this.paused || this.human.laidDown || !goal || goal.completed || goal === this.human.goal) return;
    this.statusMessage = null;
    this.selectedFormationCards = [];
    for (const f of this.human.goal?.formations ?? []) { this.human.takeCards(f.cards); f.cards = []; }
    this.human.goal = goal; this.human.refreshCanLayDown(); this.changed();
  }
  slotEnabled(f: Formation) {
    if (!this.acting) return false;
    return this.players.some((p,i) => p.goal?.formations.includes(f) && (p.laidDown ? this.human.laidDown : i === 0));
  }
  needsLayDownToAdd(f: Formation) {
    return !this.paused && !this.human.laidDown && this.players.some((p,i) => i !== 0 && p.laidDown && p.goal?.formations.includes(f));
  }
  place(f: Formation) {
    if (!this.slotEnabled(f)) {
      if (this.needsLayDownToAdd(f)) { this.statusMessage = LAY_DOWN_FIRST_MESSAGE; this.changed(); }
      return;
    }
    this.statusMessage = null;
    const chosen = [...this.selectedHand];
    if (!f.cards.length && f.trySet(chosen)) this.human.removeCards(chosen);
    else if (f.cards.length) for (const c of chosen) {
      const result = f.tryAdd(c);
      if (result.ok) { this.human.removeCards([c]); this.human.takeCards(result.swapped); }
    }
    this.human.refreshCanLayDown(); this.tryEndRound(); this.changed();
  }
  returnToHand(f: Formation) {
    if (!this.acting || this.human.laidDown || !this.human.goal?.formations.includes(f)) return;
    this.statusMessage = null;
    const chosen = f.cards.filter(c => this.selectedFormationCards.includes(c));
    f.cards = f.cards.filter(c => !chosen.includes(c)); this.human.takeCards(chosen);
    if (!f.isValid()) { this.human.takeCards(f.cards); f.cards = []; }
    this.human.refreshCanLayDown(); this.changed();
  }
  tryLayDown(p: Player) {
    if (this.paused || !this.players.includes(p) || p.laidDown || !p.canLayDown) return false;
    this.statusMessage = null;
    p.laidDown = true; p.refreshCanLayDown(); if (p.goal) {p.goal.completed = true;this.scores[this.players.indexOf(p)]+=p.goal.points;}
    this.tryEndRound(); this.changed(); return true;
  }
  humanLayDown() { if (this.acting) this.tryLayDown(this.human); }
  selectHand(card: Card) {
    if (this.paused || !this.human.hand.includes(card)) return;
    this.selectedFormationCards = [];
    this.selectedHand = this.selectedHand.includes(card) ? this.selectedHand.filter(c => c !== card) : [...this.selectedHand,card];
    this.changed();
  }
  selectFormation(f: Formation, card: Card) {
    if (!this.slotEnabled(f) || !f.cards.includes(card)) return;
    this.selectedHand = [];
    this.selectedFormationCards = this.selectedFormationCards.filter(c => f.cards.includes(c));
    this.selectedFormationCards = this.selectedFormationCards.includes(card) ? this.selectedFormationCards.filter(c => c !== card) : [...this.selectedFormationCards,card];
    this.changed();
  }
  moveHandCard(card: Card, to: number) {
    if (this.paused || !Number.isInteger(to)) return;
    const hand = this.human.hand;
    const from = hand.indexOf(card);
    if (from < 0 || to < 0 || to >= hand.length || from === to) return;
    hand.splice(to, 0, hand.splice(from, 1)[0]);
    this.changed();
  }
  moveHandCards(step: -1 | 1) {
    if (this.paused || !this.selectedHand.length) return;
    const hand = this.human.hand;
    const indices = this.selectedHand.map(c => hand.indexOf(c)).sort((a,b) => step < 0 ? a-b : b-a);
    const leading = indices[0]+step;
    if (leading >= 0 && leading < hand.length) for (const from of indices) hand.splice(from+step,0,hand.splice(from,1)[0]);
    this.changed();
  }
  get prompt() {
    if (this.roundResult) return 'Round complete';
    if (this.activePlayer === 0) {
      if (this.phase === Phase.SelectDiscard) return 'Select one card to discard';
      if (this.phase === Phase.PlayerActions) return this.human.canLayDown ? 'Your goal is ready to lay down' : 'Place cards in your goal, or finish your actions';
      return 'Pick up from the deck or discard pile';
    }
    return ['Opponent is picking up...', 'Opponent is taking their actions...', 'Opponent is discarding...'][this.phase];
  }
  aiKnowledge(player: Player): AIKnowledge {
    const table=this.players.flatMap(p=>p.laidDown ? p.goal?.formations ?? [] : []);
    const opponent=this.players.find(p=>p!==player)!;
    return {knownCards:[...player.hand,...(player.goal?.formations.flatMap(f=>f.cards)??[]),...this.discardPile,...table.flatMap(f=>f.cards)],
      table,hasDrawn:this.phase!==Phase.WaitForPickup,
      opponents:this.players.filter(p=>p!==player).map(p=>({laidDown:p.laidDown,cardsRemaining:p.laidDown?p.hand.length:13})),
      ...(this.mode==='points'?{match:{round:this.roundNumber,roundLimit:this.roundLimit,ownScore:this.scores[this.players.indexOf(player)],
        opponentScore:this.scores[this.players.indexOf(opponent)],opponentLaidDown:opponent.laidDown,
        opponentRemainingGoals:opponent.goals.filter(g=>!g.completed).map(publicGoal)}}:{})};
  }
  private playAITables(player: Player, policy: AIPolicy) {
    const plan=policy.table(player,this.aiKnowledge(player));
    for (const move of plan.moves) {
      if (!player.hand.includes(move.card)) throw Error('AI planned a card not in hand');
      const result=move.formation.tryAdd(move.card);
      if (!result.ok) throw Error('AI planned an illegal table move');
      player.removeCards([move.card]);player.takeCards(result.swapped);this.changed();
    }
    return this.tryEndRound();
  }
  async processAITurn() {
    if (this.disposed || this.paused) return;
    const p = this.players[this.activePlayer];
    const policy=this.aiPolicies[this.activePlayer] ?? improvedAI;
    let plan: GoalAssessment | null = null;
    if (!p.laidDown) { plan = policy.selectGoal(p,this.aiKnowledge(p)); this.changed(); }
    await this.delay(800); if (this.disposed || this.paused) return;
    this.pickup(policy.pickup(p,this.aiKnowledge(p),this.discardPile.at(-1),plan));
    await this.delay(800); if (this.disposed || this.paused) return;
    if (!p.laidDown) {
      plan = policy.selectGoal(p,this.aiKnowledge(p));
      if (plan) { policy.shelve(p,plan,() => this.changed()); this.changed(); }
    } else {
      if (this.playAITables(p,policy)) return;
    }
    const wentOut = !p.hand.length;
    p.refreshCanLayDown(); const justLaid=this.tryLayDown(p);
    if (wentOut || this.paused) return;
    if (justLaid && policy.addAfterLaydown && this.playAITables(p,policy)) return;
    this.finishActions();
    await this.delay(800); if (this.disposed || this.paused) return;
    this.discard(p,policy.discard(p,this.aiKnowledge(p),plan));
    await this.delay(800);
  }
}
