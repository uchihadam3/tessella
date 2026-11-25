/** Twins designer search: plants twin pairs on congruent regions and adds rivets until unique.
 *  npx tsx tools/search-twins.ts --w=4 --h=3 --pairs=2 --holes=0.1 --maxlocks=2 --samples=3000 [--mirror=0.3] [--minsize=2] */
import { buildGeometry, computeRegions, initialState, mirrorShape, regionShape, shapeKey } from '../src/puzzle/board';
import { check } from '../src/puzzle/rules';
import { solve } from '../src/puzzle/solver';
import { TWIN_SYMBOLS, type Cell, type PuzzleDef } from '../src/puzzle/types';
import { rng } from './lib/random-puzzle';
import { ascii, toSource } from './lib/show';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || 'true']; }));
const w = Number(args.w ?? 4), h = Number(args.h ?? 3);
const r = rng(Number(args.seed ?? 1));
const pairs = Number(args.pairs ?? 1);
const maxLocks = Number(args.maxlocks ?? 2);
const minSize = Number(args.minsize ?? 2);
const maxSize = Number(args.maxsize ?? 6);
const mirrorP = Number(args.mirror ?? 0);
const extra = (args.extra ?? '') as string; // e.g. 'measure' to add a measure glyph per pair
const found = new Map<string, { src: string; art: string; score: number }>();

for (let k = 0; k < Number(args.samples ?? 3000); k++) {
  const cells: Cell[] = [];
  const state = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (r.chance(Number(args.holes ?? 0.08))) cells.push({ hole: true });
    else { cells.push({}); state[i] = r.chance(0.5) ? 1 : 0; }
  }
  const p: PuzzleDef = { id: 'tw', w, h, cells };
  const g = buildGeometry(p);
  const { id, members } = computeRegions(g, state);
  const byShape = new Map<string, number[]>();
  members.forEach((m, rid) => {
    if (m.length < minSize || m.length > maxSize) return;
    const key = shapeKey(regionShape(g, m));
    if (!byShape.has(key)) byShape.set(key, []);
    byShape.get(key)!.push(rid);
  });
  let placed = 0;
  const used = new Set<number>();
  const keys = r.shuffle([...byShape.keys()]);
  for (const key of keys) {
    if (placed >= pairs) break;
    let list = byShape.get(key)!.filter((x) => !used.has(x));
    let mirror = false;
    if (r.chance(mirrorP)) {
      // look for a mirrored partner
      const a = list[0];
      if (a !== undefined) {
        const mk = shapeKey(mirrorShape(regionShape(g, members[a])));
        if (mk !== key && byShape.has(mk)) {
          const b = byShape.get(mk)!.find((x) => !used.has(x));
          if (b !== undefined) { list = [a, b]; mirror = true; }
        }
      }
    }
    if (list.length < 2) continue;
    const [ra, rb] = r.shuffle([...list]).slice(0, 2);
    used.add(ra); used.add(rb);
    const sym = TWIN_SYMBOLS[placed];
    const ta = r.pick(members[ra]);
    const tb = r.pick(members[rb]);
    cells[ta].glyph = { kind: 'twin', symbol: sym };
    cells[tb].glyph = { kind: 'twin', symbol: sym, ...(mirror ? { mirror: true } : {}) };
    if (extra === 'measure') {
      const tc = members[ra].find((t) => !cells[t].glyph);
      if (tc !== undefined && r.chance(0.5)) cells[tc].glyph = { kind: 'measure', n: members[ra].length };
    }
    placed++;
  }
  if (placed < pairs) continue;
  if (!check(p, state).ok) continue;
  let locks = 0;
  let res = solve(p, { maxSolutions: 2, maxNodes: 40000 });
  while (res.solutions.length > 1 && locks < maxLocks) {
    const [s1, s2] = res.solutions;
    const diff = [...Array(w * h).keys()].filter((i) => !cells[i].hole && !cells[i].glyph && cells[i].lock === undefined && s1[i] !== s2[i]);
    if (!diff.length) break;
    const t = r.pick(diff);
    cells[t].lock = state[t] as 0 | 1;
    locks++;
    res = solve(p, { maxSolutions: 2, maxNodes: 40000 });
  }
  if (res.solutions.length !== 1 || !res.complete) continue;
  if (check(p, initialState(p)).ok) continue;
  const key = JSON.stringify(cells);
  if (found.has(key)) continue;
  found.set(key, { src: toSource(p), art: ascii(p, res.solutions[0]), score: locks * 10 + res.nodes });
}
const list = [...found.values()].sort((a, b) => a.score - b.score);
console.log(`${list.length} unique`);
for (const c of list.slice(0, Number(args.top ?? 6))) { console.log('\n' + c.art); if (args.src) console.log(c.src); }
