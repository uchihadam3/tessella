/** Beacon designer search: random beacon layouts with unique solutions.
 *  npx tsx tools/search-beacon.ts --w=4 --h=4 --beacons=2 --holes=0.08 --samples=3000 [--locks=1] */
import { initialState } from '../src/puzzle/board';
import { check } from '../src/puzzle/rules';
import { solve } from '../src/puzzle/solver';
import { randomBeaconBoard, rng } from './lib/random-puzzle';
import { ascii, toSource } from './lib/show';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || 'true']; }));
const w = Number(args.w ?? 4), h = Number(args.h ?? 4);
const r = rng(Number(args.seed ?? 1));
const found = new Map<string, { src: string; art: string; score: number }>();
for (let k = 0; k < Number(args.samples ?? 3000); k++) {
  const { p, state } = randomBeaconBoard(r, w, h, Number(args.beacons ?? 2), Number(args.holes ?? 0.08));
  // optional rivets: lock a few random tiles to their solution state
  const locks = Number(args.locks ?? 0);
  for (let i = 0; i < locks; i++) {
    const t = r.int(w * h);
    if (!p.cells[t].hole && !p.cells[t].glyph) p.cells[t].lock = state[t] as 0 | 1;
  }
  if (!check(p, state).ok) continue;
  if (check(p, initialState(p)).ok) continue;
  const res = solve(p, { maxSolutions: 2, maxNodes: 50000 });
  if (res.solutions.length !== 1 || !res.complete) continue;
  const key = JSON.stringify(p.cells);
  if (found.has(key)) continue;
  const lit = state.reduce((a, b) => a + b, 0);
  found.set(key, { src: toSource(p), art: ascii(p, state), score: res.nodes * 3 - lit });
}
const list = [...found.values()].sort((a, b) => a.score - b.score);
console.log(`${list.length} unique`);
for (const c of list.slice(0, Number(args.top ?? 6))) { console.log('\n' + c.art); if (args.src) console.log(c.src); }
