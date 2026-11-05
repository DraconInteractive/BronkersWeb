import { CardSet, Run, type Formation } from './formation';
export class Goal {
  completed = false;
  formations: Formation[];
  name: string;
  constructor(sets: number, runs: number, public points: number) {
    this.formations = [...Array.from({length:sets}, () => new CardSet()), ...Array.from({length:runs}, () => new Run())];
    this.name = [sets ? `${sets}S` : '', runs ? `${runs}R` : ''].filter(Boolean).join(' ');
  }
  get isComplete() { return this.formations.every(f => f.cards.length > 0); }
}
export function goalSheet() { return [[2,0,1],[3,0,1],[1,1,3],[0,2,3],[2,1,5],[4,0,5],[3,1,8],[1,2,8],[0,3,10],[2,2,10]].map(([s,r,p]) => new Goal(s,r,p)); }
