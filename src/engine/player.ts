import type { Card } from './card';
import { Goal, goalSheet } from './goal';
export class Player {
  hand: Card[] = [];
  goals = goalSheet();
  goal: Goal | null = null;
  laidDown = false;
  canLayDown = false;
  refreshCanLayDown() { this.canLayDown = !this.laidDown && this.goal?.isComplete === true; }
  reset() {
    this.laidDown = false;
    this.goal?.formations.forEach(f => { f.cards = []; });
    this.goal = null; this.refreshCanLayDown(); this.hand = [];
  }
  takeCards(cards: Card[]) { this.hand.push(...cards); }
  removeCards(cards: Card[]) { for (const card of cards) { const i = this.hand.indexOf(card); if (i >= 0) this.hand.splice(i,1); } }
}
