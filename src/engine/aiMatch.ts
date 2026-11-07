import type { Goal } from './goal';
import type { GoalAssessment } from './aiGoals';
import type { AIMatchState, PublicGoal } from './aiKnowledge';

export function publicGoal(goal: Goal): PublicGoal {
  return {name:goal.name,points:goal.points,sets:goal.formations.filter(f=>f.kind==='Set').length,runs:goal.formations.filter(f=>f.kind==='Run').length};
}
// A shape-based prior for an unknown future hand, not a calibrated probability.
// Runs and larger allocations are harder to complete than short set goals.
export function futureGoalValue(goal: PublicGoal): number {
  const required=3*goal.sets+4*goal.runs;
  return goal.points/(1+0.12*Math.max(0,required-6)+0.35*goal.runs);
}
export function continuationValue(goals: readonly PublicGoal[], rounds: number): number {
  return goals.map(futureGoalValue).sort((a,b)=>b-a).slice(0,Math.max(0,rounds)).reduce((a,b)=>a+b,0);
}
const ceiling=(points:readonly number[],slots:number)=>[...points].sort((a,b)=>b-a).slice(0,Math.max(0,slots)).reduce((a,b)=>a+b,0);
const outcome=(own:number,opponent:number)=>own>opponent?2:own===opponent?1:0;

export function assessMatchPlan(plan:GoalAssessment,available:readonly Goal[],match:AIMatchState):GoalAssessment {
  const later=Math.max(0,match.roundLimit-match.round);
  const remaining=available.filter(g=>!g.completed).map(publicGoal);
  const others=remaining.filter(g=>g.name!==plan.goal.name);
  const afterBank=continuationValue(others,later),afterBomb=continuationValue(remaining,later);
  // A known exit prevents an uncommitted opponent from scoring this round.
  const opponentSlots=later+(match.opponentLaidDown||plan.immediateWin?0:1);
  const opponentWithoutExit=match.opponentScore+continuationValue(match.opponentRemainingGoals,later+(match.opponentLaidDown?0:1));
  // Keep the aggressive evaluation as the base. Score context changes its
  // reward exponent by at most +/-0.45, with a smaller change early in a match.
  const projectedMargin=match.ownScore+afterBomb-opponentWithoutExit;
  const riskAdjustment=Math.max(-1,Math.min(1,-projectedMargin/12))/(1+later/2);
  // Spending a goal can remove a valuable future option. Reserve easier fallbacks
  // when equally rewarding harder goals suit the present hand. Bound this effect
  // so unknown-future-hand priors cannot overwhelm the actual current hand.
  const marginalPoints=plan.goal.points+afterBank-afterBomb;
  const opportunityFactor=0.75+0.25*Math.max(0,Math.min(1,marginalPoints/plan.goal.points));
  const bestOwnTotal=match.ownScore+plan.goal.points+ceiling(others.map(g=>g.points),later);
  const bestOpponentTotal=match.opponentScore+ceiling(match.opponentRemainingGoals.map(g=>g.points),opponentSlots);
  return {...plan,score:plan.score*plan.goal.points**(0.45*riskAdjustment)*opportunityFactor,
    matchCeiling:outcome(bestOwnTotal,match.opponentScore),
    securesMatch:plan.missing===0 && match.ownScore+plan.goal.points>bestOpponentTotal,
    continuationValue:afterBank,riskAdjustment};
}

/** Negative means a should be preferred. Shared by selection, pickup and discard. */
export function compareMatchPlans(a:GoalAssessment,b:GoalAssessment,tactical:boolean,critical:boolean):number {
  return (b.matchCeiling??0)-(a.matchCeiling??0)
    || Number(b.securesMatch)-Number(a.securesMatch)
    || (tactical?Number(b.immediateWin)-Number(a.immediateWin):0)
    || (critical?Number(b.missing===0)-Number(a.missing===0):0)
    || b.score-a.score;
}
