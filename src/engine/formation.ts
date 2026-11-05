import { Card } from './card';
export type AddResult = {ok: boolean; swapped: Card[]};
const fail = (): AddResult => ({ok:false, swapped:[]});
export abstract class Formation {
  cards: Card[] = [];
  abstract readonly kind: 'Set' | 'Run';
  abstract trySet(input: Card[]): boolean;
  abstract tryAdd(card: Card): AddResult;
  abstract isValid(): boolean;
  protected trySwapWild(card: Card): AddResult {
    if (card.isWild || this.cards.every(c => c.isWild)) return fail();
    for (let i = 0; i < this.cards.length; i++) {
      const wild = this.cards[i];
      if (!wild.isWild) continue;
      this.cards[i] = card;
      if (this.isValid()) return {ok:true, swapped:[wild]};
      this.cards[i] = wild;
    }
    return fail();
  }
}
export class CardSet extends Formation {
  readonly kind = 'Set';
  trySet(input: Card[]) {
    if (input.length < 3) return false;
    const core = input.find(c => !c.isWild)?.value ?? input[0].value;
    if (!input.every(c => c.isWild || c.value === core)) return false;
    this.cards = [...input]; return true;
  }
  tryAdd(card: Card): AddResult {
    if (this.cards.length < 3) return fail();
    const core = this.cards.find(c => !c.isWild);
    if (core && card.value !== core.value && !card.isWild) return fail();
    const swap = this.trySwapWild(card); if (swap.ok) return swap;
    this.cards.push(card); return {ok:true, swapped:[]};
  }
  isValid() { return this.cards.length >= 3 && new Set(this.cards.filter(c => !c.isWild).map(c => c.value)).size <= 1; }
}
export function inRunOrder(candidates: Card[], aceHigh: boolean): Card[] | null {
  const rank = (c: Card) => aceHigh && c.value === 1 ? 14 : c.value;
  const naturals = candidates.filter(c => !c.isWild).sort((a,b) => rank(a)-rank(b));
  const wilds = candidates.filter(c => c.isWild);
  if (!naturals.length) return [...candidates];
  const ordered = [naturals[0]];
  for (let i = 1; i < naturals.length; i++) {
    const gap = rank(naturals[i])-rank(naturals[i-1])-1;
    if (gap < 0 || gap > wilds.length) return null;
    for (let j = 0; j < gap; j++) ordered.push(wilds.shift()!);
    ordered.push(naturals[i]);
  }
  for (let r = rank(naturals[0]); r > 1 && wilds.length; r--) ordered.unshift(wilds.shift()!);
  for (let r = rank(naturals[naturals.length-1]); r < 14 && wilds.length; r++) ordered.push(wilds.shift()!);
  return wilds.length ? null : ordered;
}
export class Run extends Formation {
  readonly kind = 'Run';
  trySet(input: Card[]) {
    if (input.length < 4 || new Set(input.filter(c => !c.isWild).map(c => c.suit)).size > 1) return false;
    const ordered = inRunOrder(input, false) ?? inRunOrder(input, true);
    if (!ordered) return false;
    this.cards = ordered; return true;
  }
  tryAdd(card: Card): AddResult {
    if (this.cards.length < 4) return fail();
    const natural = this.cards.find(c => !c.isWild);
    if (natural && card.suit !== natural.suit && !card.isWild) return fail();
    const swap = this.trySwapWild(card); if (swap.ok) return swap;
    if (card.value === 1 && this.cards.length === 13 && this.cards[0].value === 1) { this.cards.push(card); return {ok:true, swapped:[]}; }
    const input = [...this.cards, card];
    const ordered = inRunOrder(input, false) ?? inRunOrder(input, true);
    if (!ordered) return fail();
    const pattern = ordered.filter(c => c !== card);
    if (pattern.length !== this.cards.length || !pattern.every((c,i) => c.isWild === this.cards[i].isWild)) return fail();
    this.cards = ordered; return {ok:true, swapped:[]};
  }
  isValid() {
    if (this.cards.length < 4 || new Set(this.cards.filter(c => !c.isWild).map(c => c.suit)).size > 1) return false;
    for (let start = 1; start <= 14; start++) {
      if (start + this.cards.length - 1 <= 14 && this.cards.every((c,i) => c.isWild || c.value === (start+i === 14 ? 1 : start+i))) return true;
    }
    return false;
  }
}
