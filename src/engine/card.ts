export enum Suit { Hearts, Diamonds, Spades, Clubs }
export const suitSymbols = ['♥', '♦', '♠', '♣'];
export const suitNames = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
export class Card {
  private rank: number;
  constructor(readonly id: number, public suit: Suit, value: number) { this.rank = 1; this.value = value; }
  get value() { return this.rank; }
  set value(v: number) { this.rank = Math.min(13, Math.max(1, v)); }
  get isWild() { return this.value === 2; }
  get label() { return ({1:'A',11:'J',12:'Q',13:'K'} as Record<number,string>)[this.value] ?? String(this.value); }
  displayStr() { return `${({1:'Ace',11:'Jack',12:'Queen',13:'King'} as Record<number,string>)[this.value] ?? this.value} of ${suitNames[this.suit]}`; }
}
