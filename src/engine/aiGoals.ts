import type { Card } from './card';
import type { Goal } from './goal';
import type { Player } from './player';
import type { Formation } from './formation';

type Group = { kind: Formation['kind']; cards: Card[] };
export type GoalAssessment = { goal: Goal; missing: number; score: number; groups: Group[] };
type Plan = { remaining: Card[]; sets: number; runs: number; groups: Group[]; used: number; complete: number };
const size = (kind: Group['kind']) => kind === 'Set' ? 3 : 4;

// Bound the search so reassessment stays cheap on phones. Different slot orders
// and wildcard allocations compete; no card can contribute to two formations.
const SEARCH_WIDTH = 24;
function candidates(hand: Card[], kind: Group['kind']): Card[][] {
  const wild = hand.find(c => c.isWild);
  const naturals = hand.filter(c => !c.isWild);
  const groups: Card[][] = [[]];
  if (kind === 'Set') {
    for (const rank of new Set(naturals.map(c => c.value))) {
      groups.push(naturals.filter(c => c.value === rank).slice(0,3));
    }
  } else {
    for (let suit = 0; suit < 4; suit++) for (let start = 1; start <= 11; start++) {
      const group: Card[] = [];
      for (let rank = start; rank < start+4; rank++) {
        const card = naturals.find(c => c.suit === suit && c.value === (rank === 14 ? 1 : rank));
        if (card) group.push(card);
      }
      if (group.length) groups.push(group);
    }
  }
  // The existing AI requires two naturals per set / three per run: at most
  // one wildcard per planned formation, even when assessing partial groups.
  if (wild) for (const group of [...groups]) if (group.length < size(kind)) groups.push([...group,wild]);
  return groups;
}

export function assessGoals(player: Player): GoalAssessment[] {
  if (player.laidDown) return [];
  const hand = [...player.hand,...(player.goal?.formations.flatMap(f => f.cards) ?? [])];
  const indices = new Map(hand.map((card,i) => [card,i]));
  const key = (cards: Card[]) => cards.map(c => indices.get(c)).join(',');
  const cache = new Map<string,Card[][]>();
  return player.goals.filter(goal => !goal.completed).map(goal => {
    const sets = goal.formations.filter(f => f.kind === 'Set').length;
    const runs = goal.formations.length-sets;
    let plans: Plan[] = [{remaining:hand,sets,runs,groups:[],used:0,complete:0}];
    for (let slot = 0; slot < sets+runs; slot++) {
      const next = new Map<string,Plan>();
      for (const plan of plans) for (const kind of ['Set','Run'] as const) {
        if (!(kind === 'Set' ? plan.sets : plan.runs)) continue;
        const cacheKey = `${kind}:${key(plan.remaining)}`;
        let options = cache.get(cacheKey);
        if (!options) { options = candidates(plan.remaining,kind); cache.set(cacheKey,options); }
        for (const cards of options) {
          const remaining = plan.remaining.filter(c => !cards.includes(c));
          const candidate: Plan = {
            remaining, sets:plan.sets-(kind === 'Set' ? 1 : 0), runs:plan.runs-(kind === 'Run' ? 1 : 0),
            groups:[...plan.groups,{kind,cards}], used:plan.used+cards.length,
            complete:plan.complete+(cards.length === size(kind) ? 1 : 0),
          };
          const signature = `${candidate.sets}:${candidate.runs}:${key(remaining)}`;
          const old = next.get(signature);
          if (!old || candidate.complete > old.complete) next.set(signature,candidate);
        }
      }
      plans = [...next.values()].sort((a,b) => b.used-a.used || b.complete-a.complete).slice(0,SEARCH_WIDTH);
    }
    const best = plans[0];
    const missing = sets*3+runs*4-best.used;
    return {goal,missing,score:goal.points/(missing+1)**2,groups:best.groups};
  });
}

export function selectAIGoal(player: Player): GoalAssessment | null {
  const assessments = assessGoals(player);
  assessments.sort((a,b) => b.score-a.score || a.missing-b.missing
    || Number(b.goal === player.goal)-Number(a.goal === player.goal));
  const best = assessments[0];
  if (!best) return null;
  if (player.goal !== best.goal) {
    for (const formation of player.goal?.formations ?? []) {
      player.takeCards(formation.cards); formation.cards = [];
    }
    player.goal = best.goal;
    player.refreshCanLayDown();
  }
  return best;
}

export function shelveAIPlan(player: Player, plan: GoalAssessment, onShelved: () => void = () => {}) {
  // Rebuild private slots from the selected allocation, preserving every card.
  // This also lets a newly drawn card free a wildcard for a different slot.
  for (const formation of player.goal!.formations) {
    player.takeCards(formation.cards); formation.cards = [];
  }
  for (const group of plan.groups) {
    if (group.cards.length !== size(group.kind)) continue;
    const target = player.goal!.formations.find(f => f.kind === group.kind && !f.cards.length);
    if (target?.trySet(group.cards)) { player.removeCards(group.cards); onShelved(); }
  }
  player.refreshCanLayDown();
}
