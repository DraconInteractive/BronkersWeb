import type { Card } from './card';
import { CardSet, Run, type Formation } from './formation';
import type { Player } from './player';
import { assessGoals, availableAICards, type GoalAssessment, type Group } from './aiGoals';
import { availabilityModel } from './aiAvailability';
import type { AIKnowledge } from './aiKnowledge';
import { cloneFormation, ownTableFirst, planTableAdds } from './aiTable';
import { assessMatchPlan, compareMatchPlans } from './aiMatch';
import { getCardScores, lowestCard } from './ai';

export type AIRiskProfile = 'aggressive' | 'conservative' | 'public-aware' | 'match-aware';

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

export function smartAssessGoals(player: Player, knowledge: AIKnowledge, cards = availableAICards(player), profile: AIRiskProfile = 'aggressive'): GoalAssessment[] {
  const model = availabilityModel(cards,knowledge);
  const pressure=isPublicAware(profile) ? bombingPressure(knowledge) : 0;
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
    const finishCost=profile==='conservative' ? riskDistance : riskDistance+0.35*exitCards;
    // Public pressure discounts unfinished work; it is a heuristic, not an
    // inferred probability or a reward bonus for completing a formation.
    const assessment: GoalAssessment = {...plan,riskDistance,exitCards,finishCost,expectedDraws:model.expectedDraws(plan.groups),
      usefulOuts:model.usefulOuts(plan.groups),score:profile==='conservative' ? Math.sqrt(plan.goal.points)/(finishCost+1) : plan.score*(plan.missing+1)/(finishCost+1),immediateWin:false};
    assessment.score/=1+pressure*riskDistance;
    if (!plan.missing) assessment.immediateWin = completeRemaining(plan.groups) <= (knowledge.hasDrawn ? 1 : 0);
    return profile==='match-aware' && knowledge.match ? assessMatchPlan(assessment,player.goals,knowledge.match) : assessment;
  });
}

export function smartBestGoal(player: Player, knowledge: AIKnowledge, cards?: Card[], tactical = true, profile: AIRiskProfile = 'aggressive'): GoalAssessment | null {
  const plans = smartAssessGoals(player,knowledge,cards,profile);
  const bankReady=banksReadyFirst(profile,knowledge);
  plans.sort((a,b)=> (profile==='match-aware' && knowledge.match ? compareMatchPlans(a,b,tactical,bankReady) : (tactical ? Number(b.immediateWin)-Number(a.immediateWin) : 0)
    || (bankReady ? Number(b.missing===0)-Number(a.missing===0) : 0)
    || b.score-a.score) || a.missing-b.missing || Number(b.goal===player.goal)-Number(a.goal===player.goal));
  const best = plans[0]; if (!best) return null;
  const current = plans.find(p=>p.goal===player.goal);
  // Equal missing counts no longer imply equal prospects: compare actual draw cost.
  if (current && (!tactical || current.immediateWin===best.immediateWin) && current.goal.points===best.goal.points
    && Math.abs(current.finishCost!-best.finishCost!)<1e-9
    && (!(profile==='match-aware' && knowledge.match) || compareMatchPlans(current,best,tactical,bankReady)===0)
    && (!isPublicAware(profile) || bombingPressure(knowledge)===0 || (Math.abs(current.score-best.score)<1e-9 && (!bankReady || (current.missing===0)===(best.missing===0))))) return current;
  return best;
}

export function smartSelectGoal(player: Player, knowledge: AIKnowledge, profile: AIRiskProfile = 'aggressive'): GoalAssessment | null {
  const best = smartBestGoal(player,knowledge,undefined,true,profile);
  if (best && best.goal !== player.goal) {
    for (const f of player.goal?.formations ?? []) { player.takeCards(f.cards); f.cards=[]; }
    player.goal=best.goal; player.refreshCanLayDown();
  }
  return best;
}

export function smartDiscard(player: Player, knowledge: AIKnowledge, allocation?: GoalAssessment | null, profile: AIRiskProfile = 'aggressive'): Card {
  if (player.laidDown) {
    const scores=getCardScores(player);
    if(!isPublicAware(profile) || player.hand.length===1) return lowestCard(scores);
    const minimum=Math.min(...scores.values());
    return safestDiscard(player.hand.filter(c=>scores.get(c)===minimum),knowledge);
  }
  if (!player.hand.length) throw Error('Empty hand in AI discard');
  const pool=availableAICards(player);
  const plan=allocation ?? smartBestGoal(player,knowledge,pool,false,profile);
  if (!plan) throw Error('No unfinished AI goal');
  const used=new Set(plan.groups.flatMap(g=>g.cards));
  const unused=player.hand.filter(c=>!used.has(c));
  const naturals=unused.filter(c=>!c.isWild);
  if(naturals.length) return isPublicAware(profile) ? safestDiscard(naturals,knowledge) : naturals[0];
  let choice=unused[0] ?? player.hand[0];
  let best=unused.length ? plan : smartBestGoal(player,knowledge,pool.filter(c=>c!==choice),false,profile);
  for (const card of player.hand) {
    if (card===choice || (unused.length && card.isWild)) continue;
    const candidate=smartBestGoal(player,knowledge,pool.filter(c=>c!==card),false,profile);
    if (candidate && (!best || betterFitness(candidate,best,profile,knowledge) || (candidate.score===best.score && !betterFitness(best,candidate,profile,knowledge) && (
      (choice.isWild && !card.isWild) || (isPublicAware(profile) && choice.isWild===card.isWild
        && discardHelp(card,knowledge)<discardHelp(choice,knowledge))
    )))) {
      choice=card;best=candidate;
    }
  }
  return choice;
}

export function smartPickup(player: Player, knowledge: AIKnowledge, discard?: Card, allocation?: GoalAssessment | null, profile: AIRiskProfile = 'aggressive'): boolean {
  if (!discard) return false;
  if (player.laidDown) {
    const table=ownTableFirst(player,knowledge.table);
    const before=planTableAdds(player.hand,table);
    const after=planTableAdds([...player.hand,discard],table);
    return after.remaining.length<=before.remaining.length;
  }
  const before=allocation ?? smartBestGoal(player,knowledge,undefined,true,profile);
  const pool=[...player.hand,discard,...(player.goal?.formations.flatMap(f=>f.cards)??[])];
  const afterKnowledge={...knowledge,hasDrawn:true};
  const after=smartBestGoal(player,afterKnowledge,pool,true,profile);
  if (!before || !after) return false;
  if (after.immediateWin) return true;
  const used=new Set(after.groups.flatMap(g=>g.cards));
  if (!used.has(discard) || !betterFitness(after,before,profile,knowledge)) return false;
  if (pool.some(c=>c!==discard && !used.has(c))) return true;
  return pool.some(card=>{
    if(card===discard)return false;
    const retained=smartBestGoal(player,afterKnowledge,pool.filter(c=>c!==card),false,profile);
    return retained!==null && betterFitness(retained,before,profile,knowledge);
  });
}

function betterFitness(candidate: GoalAssessment, current: GoalAssessment, profile: AIRiskProfile, knowledge: AIKnowledge): boolean {
  if(profile==='match-aware' && knowledge.match) return compareMatchPlans(candidate,current,false,banksReadyFirst(profile,knowledge))<0;
  if(banksReadyFirst(profile,knowledge) && (candidate.missing===0)!==(current.missing===0)) return candidate.missing===0;
  return candidate.score>current.score;
}


/** Only committed opponents' public counts affect pressure. No hidden progress. */
export function bombingPressure(knowledge: AIKnowledge): number {
  return Math.max(0,...(knowledge.opponents??[]).map(opponent=>{
    if(!opponent.laidDown) return 0;
    if(opponent.cardsRemaining<=2) return 1;
    if(opponent.cardsRemaining<=4) return 0.6;
    if(opponent.cardsRemaining<=6) return 0.3;
    return 0;
  }));
}
function banksReadyFirst(profile: AIRiskProfile, knowledge: AIKnowledge): boolean {
  return profile==='conservative' || (isPublicAware(profile) && bombingPressure(knowledge)===1);
}

/** Cost of visibly helping an eligible opponent; all checks use cloned tables. */
export function discardHelp(card: Card, knowledge: AIKnowledge): number {
  if(!knowledge.opponents?.some(opponent=>opponent.laidDown)) return 0;
  let help=0;
  // A committed opponent can use our exposed formations as well as their own.
  for(const formation of knowledge.table) {
    const result=cloneFormation(formation).tryAdd(card);
    if(result.ok) help=Math.max(help,card.isWild?3:result.swapped.length?2:1);
  }
  return help;
}
function safestDiscard(cards: Card[], knowledge: AIKnowledge): Card {
  let choice=cards[0];if(!choice) throw Error('Empty discard candidates');
  let help=discardHelp(choice,knowledge);
  for(const card of cards.slice(1)) {
    const candidate=discardHelp(card,knowledge);
    if(candidate<help){choice=card;help=candidate;}
  }
  return choice;
}

function isPublicAware(profile:AIRiskProfile):boolean {
  return profile==='public-aware'||profile==='match-aware';
}
