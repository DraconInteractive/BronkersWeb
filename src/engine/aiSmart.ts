import type { Card } from './card';
import { CardSet, Run, type Formation } from './formation';
import type { Player } from './player';
import { assessGoals, availableAICards, type GoalAssessment, type Group } from './aiGoals';
import { availabilityModel } from './aiAvailability';
import type { AIKnowledge } from './aiKnowledge';
import { ownTableFirst, planTableAdds } from './aiTable';
import { getCardScores, lowestCard } from './ai';

function completionRemainder(groups: readonly Group[], pool: readonly Card[], knowledge: AIKnowledge) {
  // Goal slots are sets first, then runs, irrespective of the search's slot order.
  const forms: Formation[] = [...groups.filter(g=>g.kind==='Set').map(()=>new CardSet()),...groups.filter(g=>g.kind==='Run').map(()=>new Run())];
  for (const group of groups) {
    const target = forms.find(f=>f.kind===group.kind && !f.cards.length);
    if (!target?.trySet(group.cards)) throw Error('Invalid complete AI goal allocation');
  }
  const used = new Set(groups.flatMap(g=>g.cards));
  return planTableAdds(pool.filter(c=>!used.has(c)),[...forms,...knowledge.table]);
}

export function smartAssessGoals(player: Player, knowledge: AIKnowledge, cards = availableAICards(player)): GoalAssessment[] {
  const model = availabilityModel(cards,knowledge);
  const completed=new Map<string,number>();
  const completeRemaining=(groups: readonly Group[])=>{
    const key=groups.map(g=>`${g.kind}:${g.cards.map(c=>c.id).join(',')}`).join(';');
    let count=completed.get(key);
    if(count===undefined){count=completionRemainder(groups,cards,knowledge).remaining.length;completed.set(key,count);}
    return count;
  };
  // Among equally complete allocations, choose the one that sheds the most
  // leftovers. This does not award a bonus for completing an easier goal.
  const planCost=(groups: readonly Group[])=>{
    const distance=model.groupsCost(groups);
    return distance===0 ? completeRemaining(groups)*1e-6 : distance;
  };
  return assessGoals(player,cards,planCost).map(plan=>{
    const riskDistance = model.groupsCost(plan.groups);
    const required=plan.goal.formations.reduce((n,f)=>n+(f.kind==='Set'?3:4),0);
    // Unknown future pickups are not treated as known playable cards. Once ready,
    // use an actual legal layoff simulation instead of this conservative estimate.
    const exitCards=plan.missing ? Math.max(0,14-required-1) : Math.max(0,completeRemaining(plan.groups)-(knowledge.hasDrawn?1:0));
    const finishCost=riskDistance+0.35*exitCards;
    const assessment: GoalAssessment = {...plan,riskDistance,exitCards,finishCost,expectedDraws:model.expectedDraws(plan.groups),
      usefulOuts:model.usefulOuts(plan.groups),score:plan.score*(plan.missing+1)/(finishCost+1),immediateWin:false};
    if (!plan.missing) assessment.immediateWin = completeRemaining(plan.groups) <= (knowledge.hasDrawn ? 1 : 0);
    return assessment;
  });
}

export function smartBestGoal(player: Player, knowledge: AIKnowledge, cards?: Card[], tactical = true): GoalAssessment | null {
  const plans = smartAssessGoals(player,knowledge,cards);
  plans.sort((a,b)=> (tactical ? Number(b.immediateWin)-Number(a.immediateWin) : 0)
    || b.score-a.score || a.missing-b.missing || Number(b.goal===player.goal)-Number(a.goal===player.goal));
  const best = plans[0]; if (!best) return null;
  const current = plans.find(p=>p.goal===player.goal);
  // Equal missing counts no longer imply equal prospects: compare actual draw cost.
  if (current && (!tactical || current.immediateWin===best.immediateWin) && current.goal.points===best.goal.points
    && Math.abs(current.finishCost!-best.finishCost!)<1e-9) return current;
  return best;
}

export function smartSelectGoal(player: Player, knowledge: AIKnowledge): GoalAssessment | null {
  const best = smartBestGoal(player,knowledge);
  if (best && best.goal !== player.goal) {
    for (const f of player.goal?.formations ?? []) { player.takeCards(f.cards); f.cards=[]; }
    player.goal=best.goal; player.refreshCanLayDown();
  }
  return best;
}

export function smartDiscard(player: Player, knowledge: AIKnowledge, allocation?: GoalAssessment | null): Card {
  if (player.laidDown) return lowestCard(getCardScores(player));
  if (!player.hand.length) throw Error('Empty hand in AI discard');
  const pool=availableAICards(player);
  const plan=allocation ?? smartBestGoal(player,knowledge,pool,false);
  if (!plan) throw Error('No unfinished AI goal');
  const used=new Set(plan.groups.flatMap(g=>g.cards));
  const unused=player.hand.filter(c=>!used.has(c));
  const natural=unused.find(c=>!c.isWild); if (natural) return natural;
  let choice=unused[0] ?? player.hand[0];
  let best=unused.length ? plan : smartBestGoal(player,knowledge,pool.filter(c=>c!==choice),false);
  for (const card of player.hand) {
    if (card===choice || (unused.length && card.isWild)) continue;
    const candidate=smartBestGoal(player,knowledge,pool.filter(c=>c!==card),false);
    if (candidate && (!best || candidate.score>best.score || (candidate.score===best.score && choice.isWild && !card.isWild))) {
      choice=card;best=candidate;
    }
  }
  return choice;
}

export function smartPickup(player: Player, knowledge: AIKnowledge, discard?: Card, allocation?: GoalAssessment | null): boolean {
  if (!discard) return false;
  if (player.laidDown) {
    const table=ownTableFirst(player,knowledge.table);
    const before=planTableAdds(player.hand,table);
    const after=planTableAdds([...player.hand,discard],table);
    return after.remaining.length<=before.remaining.length;
  }
  const before=allocation ?? smartBestGoal(player,knowledge);
  const pool=[...player.hand,discard,...(player.goal?.formations.flatMap(f=>f.cards)??[])];
  const afterKnowledge={...knowledge,hasDrawn:true};
  const after=smartBestGoal(player,afterKnowledge,pool);
  if (!before || !after) return false;
  if (after.immediateWin) return true;
  const used=new Set(after.groups.flatMap(g=>g.cards));
  if (!used.has(discard) || after.score<=before.score) return false;
  if (pool.some(c=>c!==discard && !used.has(c))) return true;
  return pool.some(card=>card!==discard && (smartBestGoal(player,afterKnowledge,pool.filter(c=>c!==card),false)?.score??0)>before.score);
}
