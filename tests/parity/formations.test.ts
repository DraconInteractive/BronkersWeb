import { describe, expect, test } from 'vitest';
import { CardSet, Run } from '../../src/engine/formation';
import { cards, names } from '../cards';

const setCases: [string, boolean, string?][] = [
  ['5H 5S 5D',true], ['5H 2C 5D',true], ['2H 2C 2D',true], ['5H 6H 5D',false], ['5H 5S',false], ['2C 7H 7S 7D',true],
];
const runCases: [string, boolean, string?][] = [
  ['5H 6H 7H 8H',true], ['8H 5H 7H 6H',true,'5H 6H 7H 8H'], ['5H 2C 7H 8H',true], ['5H 6H 7H 2C',true,'2C 5H 6H 7H'],
  ['QH KH AH 2C',true,'2C QH KH AH'], ['AH 3H 4H 2C',true,'AH 2C 3H 4H'], ['KH AH 2C 3H',false], ['5H 6S 7H 8H',false],
  ['5H 5H 6H 7H',false], ['2H 2C 2D 2S',true], ['5H 6H 7H',false], ['JH QH KH AH',true], ['AH 2S 2D 4H',true], ['3H 2C 2D 2S',true,'2D 2C 3H 2S'],
];
for (const [kind,Type,cases] of [['Set',CardSet,setCases],['Run',Run,runCases]] as const) describe(`${kind}.trySet`,() => {
  cases.forEach(([input,ok,ordered],i) => test(`${kind === 'Set' ? 'S' : 'R'}${i+1}`,() => {
    const formation = new Type(); const hand = cards(input);
    expect(formation.trySet(hand)).toBe(ok);
    expect(names(formation.cards)).toBe(ok ? ordered ?? input : '');
    if (ok) expect(formation.cards.every(c => hand.includes(c))).toBe(true);
  }));
});
const setAdds: [string,string,boolean,string,string][] = [
 ['5H 2C 5D','5S',true,'5H 5S 5D','2C'], ['5H 5S 5D','2C',true,'5H 5S 5D 2C',''], ['5H 5S 5D','6H',false,'5H 5S 5D',''],
 ['2H 2C 2D','9S',true,'2H 2C 2D 9S',''], ['2H 5C 2D','5S',true,'5S 5C 2D','2H'],
];
const longRun = 'AH 2C 3H 4H 5H 6H 7H 8H 9H 10H JH QH KH';
const runAdds: [string,string,boolean,string,string][] = [
 ['5H 6H 7H 8H','9H',true,'5H 6H 7H 8H 9H',''], ['5H 6H 7H 8H','4H',true,'4H 5H 6H 7H 8H',''], ['5H 6H 7H 8H','9S',false,'5H 6H 7H 8H',''],
 ['5H 2C 7H 8H','6H',true,'5H 6H 7H 8H','2C'], ['2C 5H 6H 7H','4H',true,'4H 5H 6H 7H','2C'], ['2C 5H 6H 7H','8H',true,'2C 5H 6H 7H 8H',''],
 ['2C 5H 6H 7H','9H',false,'2C 5H 6H 7H',''], ['2C QH KH AH','10H',true,'10H 2C QH KH AH',''], ['AH 2C 3H 4H','2D',true,'AH 2C 3H 4H 2D',''],
 ['5H 6H 7H 8H','2C',true,'2C 5H 6H 7H 8H',''], [longRun,'AS',false,longRun,''], [longRun,'AH',true,`${longRun} AH`,''],
 ['10H JH QH KH','AH',true,'10H JH QH KH AH',''], ['2C 2D 2S 2H','7H',true,'2H 2S 2D 2C 7H',''],
];
for (const [kind,Type,cases] of [['Set',CardSet,setAdds],['Run',Run,runAdds]] as const) describe(`${kind}.tryAdd`,() => {
 cases.forEach(([input,add,ok,ordered,swapped],i) => test(`${kind === 'Set' ? 'SA' : 'RA'}${i+1}`,() => {
   const f = new Type(); expect(f.trySet(cards(input))).toBe(true);
   const result = f.tryAdd(cards(add)[0]); expect(result.ok).toBe(ok);
   expect(names(f.cards)).toBe(ordered); expect(names(result.swapped)).toBe(swapped);
 }));
});
test.each([
 ['3H 4H 6H 7H',false], ['4H 5H 6H 7H',true], ['2C QH KH AH',true],
])('Run.isValid stored order %s', (input,valid) => { const f = new Run(); f.cards = cards(input); expect(f.isValid()).toBe(valid); });
test('V3 removing one card from a four-card set',() => { const f = new CardSet(); f.trySet(cards('5H 5S 5D 5C')); f.cards.pop(); expect(f.isValid()).toBe(true); });
test('faithful all-wild run length quirk',() => { const f = new Run(); expect(f.trySet(cards(Array(15).fill('2H').join(' ')))).toBe(true); expect(f.isValid()).toBe(false); });
