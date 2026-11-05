import { expect, test } from 'vitest';
import { getCardScores, lowestCard, sumF, tryGetFormation, wantsDiscard } from '../../src/engine/ai';
import { Player } from '../../src/engine/player';
import { cards, names } from '../cards';
function player(hand: string, goal: number) { const p = new Player(); p.hand = cards(hand); p.goal = p.goals[goal]; return p; }
const f = Math.fround;
test.each([
 ['SC1',2,0,[1,f(2/3),.75,.75,10]], ['SC2',0,0,[f(f(2/3)*2),f(f(2/3)*2),f(f(1/3)*2),f(f(1/3)*2),10]],
 ['SC3',3,0,[2,.5,1.5,1.5,10]], ['SC4',2,1,[1,.25,.75,.75,10]],
] as const)('%s float32 scoring',(_,goal,filled,expected) => {
  const p = player('5H 5S 6H 7H 2H',goal);
  if (filled) p.goal!.formations[0].trySet(cards('9H 9S 9D'));
  expect([...getCardScores(p).values()]).toEqual(expected);
});
test('SC1 sum and lowest card',() => { const p = player('5H 5S 6H 7H 2H',2); const s = getCardScores(p); expect(sumF(s)).toBe(f(13.166667)); expect(names([lowestCard(s)])).toBe('5S'); });
test('SC5 first card wins tied discard',() => {
 const p = player('KH 9S 2C 4D',2); p.goal!.formations[0].trySet(cards('5H 5D 5S')); p.goal!.formations[1].trySet(cards('5H 6H 7H 8H'));
 expect([...getCardScores(p).values()]).toEqual([0,0,10,0]); expect(lowestCard(getCardScores(p))).toBe(p.hand[0]);
});
test.each([['3D',true],['2D',true],['8D',true],['5D',true],['KC',true],['JD',false],['9H',false],['QS',false]] as const)('pickup %s → %s',(discard,expected) => {
 const p = player('3H 3S 7D 9C 10C JS KH 4D 8S QC 6D AH 5S',2);
 expect(sumF(getCardScores(p))).toBe(f(8.666667)); expect(wantsDiscard(p,cards(discard)[0])).toBe(expected);
});
test.each([
 ['TG1','7H 7S 2C 9D KS',0,'7H','7H 7S 2C'], ['TG2','7H 9D 2C 2S KS',0,'7H',''],
 ['TG3','5H 6H 8H 2C KS',3,'5H','5H 6H 8H 2C'], ['TG4','5H 6H 8H KS',3,'5H',''], ['TG5','AH QH KH 2C',3,'AH','QH KH AH 2C'],
 ['TG6','AH 3H 4H 9S',3,'AH',''], ['TG7','7H 7S 6H 8H 9H',2,'7H','6H 7H 8H 9H'], ['TG8','7H 7S 6H 8H 9H',3,'7H','6H 7H 8H 9H'],
 ['TG9','2C',2,'2C',''], ['TG10','4H 5H 6H 7H 8H',3,'6H','4H 5H 6H 7H'], ['TG11','7H 7S 9D',0,'7H',''],
] as const)('%s formation search',(_,hand,goal,card,expected) => {
 const p = player(hand,goal); const chosen = p.hand.find(c => names([c]) === card)!;
 expect(names(tryGetFormation(p,chosen) ?? [])).toBe(expected);
});
