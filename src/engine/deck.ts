import { Card, Suit } from './card';
import type { RNG } from './rng';
export class Deck {
  cards: Card[] = [];
  constructor(private rng: RNG = Math.random, doShuffle = true) { this.initializeCards(doShuffle); }
  get count() { return this.cards.length; }
  initializeCards(doShuffle = true) {
    this.cards = [];
    for (let copy = 0; copy < 2; copy++) for (let suit = 0; suit < 4; suit++) for (let value = 1; value <= 13; value++) this.cards.push(new Card(this.cards.length, suit as Suit, value));
    if (doShuffle) this.shuffle();
  }
  shuffle() {
    const arr = [...this.cards].reverse(); // C# Stack.ToArray is top first.
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    this.cards = arr;
  }
  deal(amount: number) {
    const count = Math.min(amount, this.count);
    return { cards: Array.from({length: count}, () => this.cards.pop()!), remaining: amount - count };
  }
  add(cards: Card[], shuffle = false) { this.cards.push(...cards); if (shuffle) this.shuffle(); }
}
