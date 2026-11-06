// Frozen policy adapter for d64208e03883edb7de85e9fde9675d6605969498.
// Do not make tactical/scoring improvements here. Shared formation classes enforce
// the same game rules for both policies; private AI source is snapshotted alongside.
import type { AIPolicy } from '../../src/engine/aiPolicy';
import { CardSet, Run } from '../../src/engine/formation';
import { selectAIGoal, shelveAIPlan } from './aiGoals';
import { chooseAIDiscard, shouldPickUpDiscard } from './aiDecisions';
export const baselineAI: AIPolicy = {
  id:'baseline-d64208e',addAfterLaydown:false,shelve:shelveAIPlan,
  selectGoal:player=>selectAIGoal(player),
  pickup:(player,_knowledge,discard,plan)=>shouldPickUpDiscard(player,discard,plan),
  discard:(player,_knowledge,plan)=>chooseAIDiscard(player,plan),
  table:(player,knowledge)=>{
    const copies=knowledge.table.map(f=>{
      const copy=f.kind==='Set'?new CardSet():new Run();copy.cards=[...f.cards];return copy;
    });
    const hand=[...player.hand]; const moves=[];
    let added: boolean;
    do {
      added=false;
      for (let i=0;i<copies.length;i++) for (const card of [...hand]) {
        const result=copies[i].tryAdd(card);if(!result.ok)continue;
        hand.splice(hand.indexOf(card),1);hand.push(...result.swapped);
        moves.push({card,formation:knowledge.table[i]});added=true;
      }
    } while(added);
    return {moves,remaining:hand};
  },
};
