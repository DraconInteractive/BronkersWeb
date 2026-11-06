import type { Card } from './card';
import { CardSet, Run, type Formation } from './formation';
import type { Player } from './player';
export type TableMove = { card: Card; formation: Formation };
export type TablePlan = { moves: TableMove[]; remaining: Card[] };
export function cloneFormation(formation: Formation): Formation {
  const copy = formation.kind === 'Set' ? new CardSet() : new Run();
  copy.cards = [...formation.cards];
  return copy;
}
export function ownTableFirst(player: Player, table: readonly Formation[]): Formation[] {
  const own = player.goal?.formations ?? [];
  return [...table.filter(f => own.includes(f)),...table.filter(f => !own.includes(f))];
}

// Two cheap legal move orders catch common extension/wildcard-swap dependencies.
// Both are dry runs on clones. Every returned move is checked by the real engine.
export function planTableAdds(hand: readonly Card[], table: readonly Formation[]): TablePlan {
  function simulate(cardFirst: boolean): TablePlan {
    const copies = table.map(cloneFormation);
    const remaining = [...hand]; const moves: TableMove[] = [];
    const add = (card: Card, index: number) => {
      if (!remaining.includes(card)) return false;
      const result = copies[index].tryAdd(card);
      if (!result.ok) return false;
      remaining.splice(remaining.indexOf(card),1); remaining.push(...result.swapped);
      moves.push({card,formation:table[index]}); return true;
    };
    let changed: boolean;
    do {
      changed = false;
      if (cardFirst) {
        for (const card of [...remaining].sort((a,b) => Number(a.isWild)-Number(b.isWild))) {
          for (let i=0;i<copies.length;i++) if (add(card,i)) { changed=true; break; }
        }
      } else {
        for (let i=0;i<copies.length;i++) {
          for (const card of [...remaining].sort((a,b) => Number(a.isWild)-Number(b.isWild))) if (add(card,i)) changed=true;
        }
      }
    } while (changed);
    return {moves,remaining};
  }
  const plans = [simulate(true),simulate(false)];
  return plans.sort((a,b) => a.remaining.length-b.remaining.length
    || b.remaining.filter(c=>c.isWild).length-a.remaining.filter(c=>c.isWild).length)[0];
}
