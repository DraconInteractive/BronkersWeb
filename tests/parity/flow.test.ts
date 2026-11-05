import { describe, expect, test } from 'vitest';
import { Game, Phase } from '../../src/engine/game';
import { Deck } from '../../src/engine/deck';
import { goalSheet } from '../../src/engine/goal';
import { seededRng } from '../../src/engine/rng';
import { cards, names } from '../cards';
const game = () => new Game(seededRng(42),async () => {});
function fillSets(g: Game) {
 g.chooseGoal(0); g.phase = Phase.PlayerActions;
 g.human.hand = cards('5H 5S 5D 8H 8S 8D KH');
 for (const f of g.human.goal!.formations) { g.selectedHand = g.human.hand.slice(0,3); g.place(f); }
}
function allCards(g: Game) { return [...g.deck.cards,...g.discardPile,...g.players.flatMap(p => [...p.hand,...(p.goal?.formations.flatMap(f => f.cards) ?? [])])]; }

test('F1 round setup, card identity and completed flags',() => {
 const g = game(); g.human.goals[0].completed = true; g.setupRound();
 expect(g.players.map(p => p.hand.length)).toEqual([13,13]); expect(g.deck.count).toBe(77); expect(g.discardPile).toHaveLength(1);
 expect(g.activePlayer).toBe(0); expect(g.phase).toBe(Phase.WaitForPickup); expect(g.players.every(p => p.goal === null)).toBe(true); expect(g.human.goals[0].completed).toBe(true);
 expect(new Set(allCards(g)).size).toBe(104); expect(new Set(allCards(g).map(c => c.id)).size).toBe(104);
});
test('deck order and deal shortage',() => { const d = new Deck(seededRng(1),false); expect(names(d.deal(2).cards)).toBe('KC QC'); d.cards = cards('AH'); expect(d.deal(3).remaining).toBe(2); });
test('F2 pickup',() => { const g = game(); g.humanPickup(); expect(g.human.hand).toHaveLength(14); expect(g.deck.count).toBe(76); expect(g.phase).toBe(Phase.PlayerActions); });
test('F3 lazy discard refill',() => { const g = game(); g.deck.cards = []; g.discardPile = cards('AH 5C KS'); const top = g.discardPile[2]; g.pickup(); expect(g.discardPile).toEqual([top]); expect(g.deck.count).toBe(1); expect(g.human.hand).toHaveLength(14); });
test('F4 empty deck and one discard gives no card',() => { const g = game(); g.deck.cards = []; g.pickup(); expect(g.human.hand).toHaveLength(13); expect(g.phase).toBe(Phase.PlayerActions); });
test('F5 and F6 complete and lay down goal',() => { const g = game(); fillSets(g); expect(g.human.canLayDown).toBe(true); expect(g.prompt).toBe('Your goal is ready to lay down'); const goal = g.human.goal!; g.humanLayDown(); expect(g.human.laidDown).toBe(true); expect(goal.completed).toBe(true); expect(g.human.canLayDown).toBe(false); });
test('F7 last table add pauses until confirmation',() => { const g = game(); fillSets(g); g.humanLayDown(); g.human.hand = cards('5C'); g.selectedHand = [...g.human.hand]; g.place(g.human.goal!.formations[0]); expect(g.roundResult?.winner).toBe(0); expect(g.human.hand).toHaveLength(0); g.confirmRound(); expect(g.phase).toBe(Phase.WaitForPickup); expect(g.human.hand).toHaveLength(13); expect(g.human.goal).toBeNull(); });
test('F8 last discard pauses until confirmation',() => { const g = game(); fillSets(g); g.humanLayDown(); g.humanFinish(); g.selectedHand = [...g.human.hand]; g.humanDiscard(); expect(g.roundResult?.winner).toBe(0); expect(g.human.hand).toHaveLength(0); g.confirmRound(); expect(g.activePlayer).toBe(0); expect(g.human.hand).toHaveLength(13); expect(g.aiTask).toBeNull(); });
test('F9 faithful empty hand before laydown needs goal change',() => {
 const g = game(); g.chooseGoal(9); g.phase = Phase.PlayerActions;
 const groups = ['5H 5S 5D','8H 8S 8D','3H 4H 5H 6H','9S 10S JS QS'].map(cards); g.human.hand = groups.flat();
 g.human.goal!.formations.forEach((f,i) => { g.selectedHand = groups[i]; g.place(f); });
 expect(g.human.hand).toHaveLength(0); expect(g.human.canLayDown).toBe(true); g.humanFinish(); g.humanDiscard(); expect(g.phase).toBe(Phase.SelectDiscard);
 g.chooseGoal(0); expect(g.human.hand).toHaveLength(14); expect(g.human.canLayDown).toBe(false);
});
test('F10 goal change returns cards in formation order',() => { const g = game(); fillSets(g); const old = g.human.goal!; g.chooseGoal(2); expect(names(g.human.hand)).toBe('KH 5H 5S 5D 8H 8S 8D'); expect(old.formations.every(f => !f.cards.length)).toBe(true); expect(g.human.canLayDown).toBe(false); });
test('F11 return from four-card set',() => { const g = game(); g.chooseGoal(0); g.phase = Phase.PlayerActions; g.human.hand = []; const f = g.human.goal!.formations[0]; f.trySet(cards('5H 5S 5D 5C')); g.selectedFormationCards = [f.cards[1]]; g.returnToHand(f); expect(names(g.human.hand)).toBe('5S'); expect(names(f.cards)).toBe('5H 5D 5C'); });
test('F12 removal invalidates run and returns chosen first',() => { const g = game(); g.chooseGoal(3); g.phase = Phase.PlayerActions; g.human.hand = []; const f = g.human.goal!.formations[0]; f.trySet(cards('3H 4H 5H 6H 7H')); g.selectedFormationCards = [f.cards[2]]; g.returnToHand(f); expect(names(g.human.hand)).toBe('5H 3H 4H 6H 7H'); expect(f.cards).toHaveLength(0); expect(g.selectedFormationCards).toHaveLength(0); });
test.each([
 ['F13',[2,3],1,[3,4]], ['F14',[3,4],1,[3,4]], ['F15',[0,2],-1,[0,2]],
] as const)('%s grouped reorder',(_,indices,step,expected) => { const g = game(); g.human.hand = cards('3H 4H 5H 6H 7H'); g.selectedHand = indices.map(i => g.human.hand[i]); const selected = [...g.selectedHand]; g.moveHandCards(step); expect(selected.map(c => g.human.hand.indexOf(c))).toEqual(expected); });
test('F16 selection order swaps then appends, arriving wild unselected',() => { const g = game(); g.chooseGoal(0); g.phase = Phase.PlayerActions; const f = g.human.goal!.formations[0]; f.trySet(cards('5H 2C 5D')); g.human.hand = cards('2D 5S'); g.selectHand(g.human.hand[1]); g.selectHand(g.human.hand[0]); g.place(f); expect(names(f.cards)).toBe('5H 5S 5D 2D'); expect(names(g.human.hand)).toBe('2C'); expect(g.selectedHand).toHaveLength(0); });
test('F17 tenth AI goal only ends game at round end',() => {
 const g = game(); const ai = g.players[1]; ai.goals.forEach((goal,i) => { goal.completed = i !== 9; }); ai.goal = ai.goals[9];
 ai.goal.formations.forEach((f,i) => f.trySet(cards(i < 2 ? '5H 5S 5D' : '3H 4H 5H 6H'))); ai.refreshCanLayDown(); g.activePlayer = 1; g.tryLayDown(ai); expect(g.gameOver).toBe(false);
 g.activePlayer = 0; fillSets(g); g.humanLayDown(); g.humanFinish(); g.selectedHand = [...g.human.hand]; g.humanDiscard(); expect(g.gameOver).toBe(false); expect(g.roundResult?.winner).toBe(0); g.confirmRound(); expect(g.gameOver).toBe(true); expect(g.finishers).toEqual([1]); expect(g.aiTask).toBeNull();
});
test.each([false,true])('F18 final human laydown goes out, both finishers %s',both => {
 const g = game(); fillSets(g); const goal = g.human.goal!; g.human.goals.forEach(g => { g.completed = g !== goal; }); if (both) g.players[1].goals.forEach(g => { g.completed = true; });
 g.human.hand = []; g.humanLayDown(); expect(g.roundResult?.winner).toBe(0); expect(g.gameOver).toBe(false); g.confirmRound(); expect(g.gameOver).toBe(true); expect(g.finishers).toEqual(both ? [0,1] : [0]); expect(g.human.goal).toBe(goal);
 const phase = g.phase; g.pickup(); g.chooseGoal(2); expect(g.phase).toBe(phase); expect(g.human.goal).toBe(goal);
});
test('F19 new game',() => { const g = game(); g.human.goals.forEach(g => { g.completed = true; }); g.human.laidDown = true; g.human.hand = []; g.tryEndRound(); g.confirmRound(); const old = g.players; g.newGame(); expect(g.players).not.toBe(old); expect(g.gameOver).toBe(false); expect(g.players.every(p => p.goals.every(g => !g.completed))).toBe(true); expect(g.deck.count).toBe(77); expect(g.phase).toBe(Phase.WaitForPickup); });
test('goal sheet order, points and slots',() => { const goals = goalSheet(); expect(goals.map(g => g.name)).toEqual(['2S','3S','1S 1R','2R','2S 1R','4S','3S 1R','1S 2R','3R','2S 2R']); expect(goals.map(g => g.points)).toEqual([1,1,3,3,5,5,8,8,10,10]); expect(goals[9].formations.map(f => f.kind)).toEqual(['Set','Set','Run','Run']); });
test('human gates, selection regions and failed card selection',() => { const g = game(); g.chooseGoal(0); const f = g.human.goal!.formations[0]; g.selectedHand = g.human.hand.slice(0,3); const original = [...g.human.hand]; g.place(f); expect(g.human.hand).toEqual(original); g.humanPickup(); f.trySet(cards('5H 5S 5D')); g.human.hand = cards('6H'); g.selectHand(g.human.hand[0]); g.place(f); expect(g.selectedHand).toEqual(g.human.hand); g.selectFormation(f,f.cards[0]); expect(g.selectedHand).toHaveLength(0); g.activePlayer = 1; expect(g.slotEnabled(f)).toBe(false); const before = g.human.hand.length; g.humanPickup(); expect(g.human.hand).toHaveLength(before); g.chooseGoal(2); expect(g.human.goal?.name).toBe('1S 1R'); });
describe('AI integration',() => {
 test('AI picks up, shelves, lays down and discards, with visible updates',async () => {
   const g = game(); const ai = g.players[1]; ai.goal = ai.goals[0]; ai.hand = cards('5H 5S 5D 8H 8S 8D KH'); g.deck.cards = cards('QC'); g.discardPile = cards('3H'); g.activePlayer = 1;
   const counts: number[] = []; g.subscribe(() => counts.push(ai.hand.length)); await g.processAITurn();
   expect(ai.laidDown).toBe(true); expect(ai.goal.completed).toBe(true); expect(ai.hand).toHaveLength(1); expect(g.activePlayer).toBe(0); expect(counts).toContain(8); expect(counts).toContain(5); expect(counts).toContain(2);
 });
 test('AI can add to human formations and end round',async () => {
   const g = game(); fillSets(g); g.humanLayDown(); const ai = g.players[1]; ai.goal = ai.goals[0]; ai.goal.formations.forEach(f => f.trySet(cards('9H 9S 9D'))); ai.laidDown = true;
   ai.hand = cards('5C'); g.deck.cards = cards('8C'); g.discardPile = cards('KH'); g.activePlayer = 1; g.phase = Phase.WaitForPickup; await g.processAITurn(); expect(g.roundResult?.winner).toBe(1); expect(ai.hand).toHaveLength(0); expect(g.roundResult?.players.map(p => p.laidDown)).toEqual([true,true]); g.confirmRound(); expect(g.activePlayer).toBe(0); expect(g.human.hand).toHaveLength(13); expect(ai.hand).toHaveLength(13);
 });
 test('104 distinct cards survive 80 AI turns and repeated deck refill',async () => {
   const g = game();
   for (let turn = 0; turn < 80; turn++) {
     g.humanPickup(); g.humanFinish(); g.selectHand(g.human.hand[0]); g.humanDiscard(); await g.aiTask;
     expect(allCards(g)).toHaveLength(104); expect(new Set(allCards(g)).size).toBe(104); if (g.roundResult) g.confirmRound(); expect(g.activePlayer).toBe(0); expect(g.phase).toBe(Phase.WaitForPickup);
   }
 });
});

test('direct drag reorder moves one existing card and preserves ordered selection',() => {
 const g = game(); g.human.hand = cards('3H 4H 5H 6H 7H');
 const original = [...g.human.hand]; g.selectHand(original[3]); g.selectHand(original[1]);
 g.moveHandCard(original[0],3);
 expect(g.human.hand).toEqual([original[1],original[2],original[3],original[0],original[4]]);
 expect(g.selectedHand).toEqual([original[3],original[1]]);
 g.activePlayer = 1; g.moveHandCard(original[0],0);
 expect(g.human.hand).toEqual(original);
 expect(g.selectedHand).toEqual([original[3],original[1]]);
});
test('direct reorder rejects stale cards, invalid positions and game-over changes',() => {
 const g = game(); const original = [...g.human.hand];
 for (const to of [-1,original.length,NaN,1.5]) g.moveHandCard(original[0],to);
 g.moveHandCard(cards('AH')[0],2);
 expect(g.human.hand).toEqual(original);
 g.gameOver = true; g.moveHandCard(original[0],3);
 expect(g.human.hand).toEqual(original);
});

test('round summary captures each player’s laydown status before any reset',() => {
 const g=game(); fillSets(g); g.humanLayDown();
 g.players[1].goals[0].completed=true; // Completed previously, not laid down this round.
 g.players[1].goal=g.players[1].goals[2];
 g.humanFinish(); g.selectedHand=[...g.human.hand]; g.humanDiscard();
 expect(g.roundResult).toEqual({winner:0,players:[
   {index:0,laidDown:true,cardsRemaining:0,goal:'2S'},
   {index:1,laidDown:false,cardsRemaining:13,goal:null},
 ]});
 const summary=g.roundResult,deck=[...g.deck.cards],discard=[...g.discardPile];
 expect(g.tryEndRound()).toBe(true); expect(g.roundResult).toBe(summary);
 expect(g.deck.cards).toEqual(deck); expect(g.discardPile).toEqual(discard);
 g.confirmRound(); expect(g.roundResult).toBeNull(); expect(g.human.goals[0].completed).toBe(true);
 const fresh=[...g.human.hand]; g.confirmRound(); expect(g.human.hand).toEqual(fresh);
});
test('round summary pauses all human and AI actions until confirmed',async () => {
 const g=game(); fillSets(g); g.humanLayDown(); g.humanFinish(); g.selectedHand=[...g.human.hand]; g.humanDiscard();
 const result=g.roundResult,other=g.players[1],goal=g.human.goal!,form=goal.formations[0];
 const before={hand:[...g.human.hand],other:[...other.hand],deck:[...g.deck.cards],discard:[...g.discardPile],active:g.activePlayer,phase:g.phase};
 g.pickup(); g.pickup(true); g.humanPickup(); g.finishActions(); g.discard(other,other.hand[0]);
 g.nextPlayer(); g.chooseGoal(2); g.place(form); g.returnToHand(form); g.tryLayDown(other);
 g.selectHand(before.other[0]); g.selectFormation(form,form.cards[0]); g.moveHandCard(before.other[0],1); g.moveHandCards(1);
 g.newGame(); await g.processAITurn();
 expect(g.roundResult).toBe(result); expect(g.human.goal).toBe(goal);
 expect({hand:g.human.hand,other:other.hand,deck:g.deck.cards,discard:g.discardPile,active:g.activePlayer,phase:g.phase}).toEqual(before);
 expect(g.paused).toBe(true); expect(g.myTurn).toBe(false); expect(g.acting).toBe(false); expect(g.slotEnabled(form)).toBe(false);
 g.confirmRound(); expect(g.paused).toBe(false); expect(g.canPickup).toBe(true);
});
test('an empty-hand normal laydown shows results and preserves completion for the next round',() => {
 const g=game(); fillSets(g); g.human.hand=[]; g.humanLayDown();
 expect(g.roundResult?.winner).toBe(0); expect(g.gameOver).toBe(false);
 expect(g.human.goal?.completed).toBe(true); g.confirmRound();
 expect(g.human.hand).toHaveLength(13); expect(g.human.goal).toBeNull(); expect(g.human.goals[0].completed).toBe(true);
});
test('AI winning discard reports its win and does not schedule a turn before confirmation',async () => {
 const g=game(); const ai=g.players[1]; ai.goal=ai.goals[0]; ai.laidDown=true; ai.goal.completed=true;
 ai.goal.formations[0].trySet(cards('5H 5S 5D')); ai.goal.formations[1].trySet(cards('8H 8S 8D'));
 ai.hand=cards('KH'); g.deck.cards=cards('5C'); g.discardPile=cards('3C'); g.activePlayer=1;
 await g.processAITurn();
 expect(g.roundResult?.winner).toBe(1); expect(g.roundResult?.players.map(p=>[p.laidDown,p.cardsRemaining])).toEqual([[false,13],[true,0]]);
 expect(names(g.discardPile)).toBe('3C KH'); expect(g.activePlayer).toBe(1); expect(g.aiTask).toBeNull();
 g.confirmRound(); expect(g.activePlayer).toBe(0); expect(g.human.hand).toHaveLength(13);
});

function opponentSet(g: Game) {
 const opponent=g.players[1]; opponent.goal=opponent.goals[0]; opponent.laidDown=true; opponent.goal.completed=true;
 opponent.goal.formations[0].trySet(cards('5H 5S 5D'));
 opponent.goal.formations[1].trySet(cards('8H 8S 8D'));
 return opponent.goal.formations[0];
}
test.each([
 [0,Phase.WaitForPickup],[0,Phase.PlayerActions],[0,Phase.SelectDiscard],
 [1,Phase.WaitForPickup],[1,Phase.PlayerActions],[1,Phase.SelectDiscard],
])('blocked opponent add explains laydown without moving cards, player %s phase %s',(active,phase) => {
 const g=game(),form=opponentSet(g); g.human.hand=cards('5C KH'); g.selectHand(g.human.hand[0]);
 g.activePlayer=active; g.phase=phase;
 const before={hand:[...g.human.hand],selected:[...g.selectedHand],formation:[...form.cards],deck:[...g.deck.cards],discard:[...g.discardPile]};
 expect(g.slotEnabled(form)).toBe(false); g.place(form);
 expect(g.statusMessage).toBe("Lay down your goal before adding cards to your opponent's formations.");
 expect({hand:g.human.hand,selected:g.selectedHand,formation:form.cards,deck:g.deck.cards,discard:g.discardPile}).toEqual(before);
 expect(g.phase).toBe(phase); expect(g.activePlayer).toBe(active);
});
test('laying down clears the explanation and allows the previously blocked add',() => {
 const g=game(); fillSets(g); const form=opponentSet(g); g.human.hand=cards('5C KH'); g.selectHand(g.human.hand[0]);
 g.place(form); expect(g.statusMessage).not.toBeNull();
 g.humanLayDown(); expect(g.statusMessage).toBeNull(); expect(g.slotEnabled(form)).toBe(true);
 g.place(form); expect(names(form.cards)).toBe('5H 5S 5D 5C'); expect(names(g.human.hand)).toBe('KH');
 expect(g.statusMessage).toBeNull(); expect(g.selectedHand).toHaveLength(0);
});
test('other action gates and round results do not produce a misleading laydown warning',() => {
 const g=game(); g.chooseGoal(0); const own=g.human.goal!.formations[0];
 g.place(own); expect(g.statusMessage).toBeNull();
 const form=opponentSet(g); g.human.laidDown=true;
 g.place(form); expect(g.statusMessage).toBeNull(); // Already laid down, but has not picked up.
 g.human.hand=[]; g.tryEndRound();
 g.place(form); expect(g.statusMessage).toBeNull(); expect(g.roundResult).not.toBeNull();
});
test('corrective actions and turn changes clear the laydown hint',() => {
 const g=game(); const form=opponentSet(g);
 g.place(form); expect(g.statusMessage).not.toBeNull();
 g.humanPickup(); expect(g.statusMessage).toBeNull();
 g.place(form); g.chooseGoal(0); expect(g.statusMessage).toBeNull();
 g.place(form); g.place(g.human.goal!.formations[0]); expect(g.statusMessage).toBeNull();
 g.place(form); g.humanFinish(); expect(g.statusMessage).toBeNull();
 g.place(form); g.setupRound(); expect(g.statusMessage).toBeNull();
});
