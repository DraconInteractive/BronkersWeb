import type { Card } from './card';
import type { Player } from './player';
import { shelveAIPlan, type GoalAssessment } from './aiGoals';
import type { AIKnowledge } from './aiKnowledge';
import { smartDiscard, smartPickup, smartSelectGoal } from './aiSmart';
import { ownTableFirst, planTableAdds, type TablePlan } from './aiTable';
export type AIPolicy = {
  id: string;
  addAfterLaydown: boolean;
  shelve: (player: Player, plan: GoalAssessment, onShelved: () => void) => void;
  selectGoal: (player: Player, knowledge: AIKnowledge) => GoalAssessment | null;
  pickup: (player: Player, knowledge: AIKnowledge, discard?: Card, plan?: GoalAssessment | null) => boolean;
  discard: (player: Player, knowledge: AIKnowledge, plan?: GoalAssessment | null) => Card;
  table: (player: Player, knowledge: AIKnowledge) => TablePlan;
};
export const aggressiveAI: AIPolicy = {
  id:'availability-and-going-out-v1',addAfterLaydown:true,shelve:shelveAIPlan,
  selectGoal:smartSelectGoal,pickup:smartPickup,discard:smartDiscard,
  table:(player,knowledge)=>planTableAdds(player.hand,ownTableFirst(player,knowledge.table)),
};


// Preserve the previous aggressive control for reproducible historical tests.
// The default remains aggressive, adding only public pressure and discard denial.
export const improvedAI: AIPolicy = {
  ...aggressiveAI,id:'public-pressure-and-denial-v1',
  selectGoal:(player,knowledge)=>smartSelectGoal(player,knowledge,'public-aware'),
  pickup:(player,knowledge,discard,plan)=>smartPickup(player,knowledge,discard,plan,'public-aware'),
  discard:(player,knowledge,plan)=>smartDiscard(player,knowledge,plan,'public-aware'),
};
export const conservativeAI: AIPolicy = {
  ...aggressiveAI,id:'conservative-banking-v1',
  selectGoal:(player,knowledge)=>smartSelectGoal(player,knowledge,'conservative'),
  pickup:(player,knowledge,discard,plan)=>smartPickup(player,knowledge,discard,plan,'conservative'),
  discard:(player,knowledge,plan)=>smartDiscard(player,knowledge,plan,'conservative'),
};
