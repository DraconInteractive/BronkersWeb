import type { Card } from './card';
import type { Group } from './aiGoals';
import type { AIKnowledge } from './aiKnowledge';

// Draw counts are estimates over unseen cards (deck plus unknown opponent cards),
// not a peek at the deck. Observed cards are counted once, even in hypothetical hands.
export function availabilityModel(pool: readonly Card[], knowledge: AIKnowledge) {
  const known = new Set([...pool,...knowledge.knownCards]);
  const copies = Array(52).fill(2) as number[];
  for (const c of known) copies[c.suit*13+c.value-1] = Math.max(0,copies[c.suit*13+c.value-1]-1);
  const unseen = copies.reduce((a,b)=>a+b,0);
  const wilds = [0,1,2,3].reduce((n,suit)=>n+copies[suit*13+1],0);
  const cache = new Map<string,{distance:number;expectedDraws:number;outs:number}>();
  function groupCost(group: Group) {
    const required = group.kind === 'Set' ? 3 : 4;
    const missing = required-group.cards.length;
    if (missing <= 0) return {distance:0,expectedDraws:0,outs:0};
    const signature = `${group.kind}:${group.cards.map(c=>c.suit*13+c.value-1).sort((a,b)=>a-b).join(',')}`;
    const cached = cache.get(signature); if (cached) return cached;
    const naturals = group.cards.filter(c=>!c.isWild);
    const usedWild = group.cards.some(c=>c.isWild);
    let outs = 0;
    if (!naturals.length) {
      outs = unseen-(usedWild ? wilds : 0);
    } else if (group.kind === 'Set') {
      outs = [0,1,2,3].reduce((n,suit)=>n+copies[suit*13+naturals[0].value-1],0);
      if (!usedWild) outs += wilds;
    } else {
      const suit = naturals[0].suit;
      const ranks = new Set(naturals.map(c=>c.value));
      const useful = new Set<number>();
      for (let start=1;start<=11;start++) {
        const window = Array.from({length:4},(_,i)=>start+i===14 ? 1 : start+i);
        if (![...ranks].every(rank=>window.includes(rank))) continue;
        for (const rank of window) if (rank !== 2 && !ranks.has(rank)) useful.add(rank);
      }
      outs = [...useful].reduce((n,rank)=>n+copies[suit*13+rank-1],0);
      if (!usedWild) outs += wilds;
    }
    // A missing natural can be blocked even with wilds remaining: each planned
    // formation still requires the same minimum naturals as the current AI.
    const expectedDraws = missing*(unseen+1)/(outs+1);
    // Keep broad draws on the calibrated missing-card scale. About twelve
    // unseen useful copies is a flexible one-card draw; scarce outs cost more.
    const result = {distance:missing*Math.max(1,12/(outs+1)),expectedDraws,outs};
    cache.set(signature,result); return result;
  }
  return {
    groupsCost: (groups: readonly Group[]) => groups.reduce((n,g)=>n+groupCost(g).distance,0),
    expectedDraws: (groups: readonly Group[]) => groups.reduce((n,g)=>n+groupCost(g).expectedDraws,0),
    usefulOuts: (groups: readonly Group[]) => groups.filter(g=>g.cards.length<(g.kind==='Set'?3:4)).map(g=>groupCost(g).outs),
  };
}
