const f32 = Math.fround;
let id = 0;
const C = s => { const su = s.at(-1), v = s.slice(0, -1); return { id: id++, suit: su, value: ({A:1,J:11,Q:12,K:13})[v] ?? +v }; };
const H = s => s.split(' ').map(C);
function scores(hand, goal, discard) {
  const m = new Map();
  if (discard) m.set(discard, discard.value === 2 ? 10 : 0);
  for (const c of hand) m.set(c, c.value === 2 ? 10 : 0);
  const { reqSets, reqRuns } = goal;
  const keys = [...m.keys()];
  for (const c of keys) { if (c.value === 2) continue; const n = keys.filter(k => k.value === c.value).length; m.set(c, f32(f32(n / 3) * reqSets)); }
  for (const c of keys) { if (c.value === 2) continue; const n = keys.filter(k => k.suit === c.suit && Math.abs(c.value - k.value) < 4).length; const s = f32(f32(n / 4) * reqRuns); if (m.get(c) < s) m.set(c, s); }
  return m;
}
const sumF = m => { let s = 0; for (const v of m.values()) s += v; return f32(s); };
const hand = H('3H 3S 7D 9C 10C JS KH 4D 8S QC 6D AH 5S');
const goal = { reqSets: 1, reqRuns: 1 };
const cS = sumF(scores(hand, goal));
for (const d of ['3D','2D','8D','5D','KC','JD','9H','QS']) {
  const ds = scores(hand, goal, C(d));
  const dC = f32(sumF(ds) - Math.min(...ds.values()));
  const diff = f32(dC - cS);
  console.log(d, cS, dC, diff, diff > f32(0.6));
}
const s1 = scores(H('5H 5S 6H 7H 2H'), goal); console.log([...s1.values()], sumF(s1));
