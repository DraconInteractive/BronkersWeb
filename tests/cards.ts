import { Card, Suit } from '../src/engine/card';
let nextId = 1000;
export function cards(text: string): Card[] {
  return text.trim() ? text.trim().split(/\s+/).map(token => {
    const rank = token.slice(0,-1);
    return new Card(nextId++, 'HDSC'.indexOf(token.at(-1)!) as Suit, ({A:1,J:11,Q:12,K:13} as Record<string,number>)[rank] ?? Number(rank));
  }) : [];
}
export function names(input: Card[]) { return input.map(c => `${c.label}${'HDSC'[c.suit]}`).join(' '); }
