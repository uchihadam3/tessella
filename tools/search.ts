/**
 * Designer search: finds small puzzles with a unique solution for a given language,
 * board shape and glyph count. Used to tighten hand-designed intro panels.
 *
 *   npx tsx tools/search.ts --kind=measure --grid=". . .|. . .|. . ." --glyphs=3 --samples=3000 [--seed=1] [--top=8]
 *   grid tokens: '.' free, '#' hole, 'L'/'D' rivet; rows separated by '|'
 *   --require=R,C   force a glyph at row R col C (repeatable, ';' separated)
 *   --kinds=measure,contour  (mixed)
 */
import { buildGeometry, computeRegions, regionShape, puzzle, initialState } from '../src/puzzle/board';
import { beaconSight, check, contourCount, mosaicCount } from '../src/puzzle/rules';
import { solve } from '../src/puzzle/solver';
import type { Glyph, PuzzleDef } from '../src/puzzle/types';
import { rng } from './lib/random-puzzle';
import { ascii, toSource } from './lib/show';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || 'true']; }));
const kinds = (args.kinds ?? args.kind ?? 'measure').split(',');
const gridSrc = (args.grid as string).split('|').map((r) => r.trim()).join('\n');
const glyphs = Number(args.glyphs ?? 3);
const samples = Number(args.samples ?? 2000);
const top = Number(args.top ?? 6);
const r = rng(Number(args.seed ?? 1));
const required = (args.require ?? '').split(';').filter(Boolean).map((s: string) => s.split(',').map(Number));
const maxMold = Number(args.maxmold ?? 5);

const base = puzzle('search', { grid: gridSrc });
const g = buildGeometry(base);
const n = base.w * base.h;
const free = [...Array(n).keys()].filter((i) => !base.cells[i].hole);

function glyphFor(kind: string, state: Uint8Array, t: number, regions: ReturnType<typeof computeRegions>): Glyph | null {
  switch (kind) {
    case 'measure': return { kind: 'measure', n: regions.members[regions.id[t]].length };
    case 'contour': return { kind: 'contour', n: contourCount(g, state, t) };
    case 'mosaic': return { kind: 'mosaic', n: mosaicCount(base, g, state, t) };
    case 'mold': {
      const shape = regionShape(g, regions.members[regions.id[t]]);
      return shape.length <= maxMold ? { kind: 'mold', cells: shape } : null;
    }
    case 'beacon': return state[t] ? { kind: 'beacon', n: beaconSight(g, state, t).length } : null;
  }
  return null;
}

const found = new Map<string, { p: PuzzleDef; sol: Uint8Array; score: number }>();
for (let k = 0; k < samples; k++) {
  const state = new Uint8Array(n);
  for (const i of free) state[i] = base.cells[i].lock ?? (r.chance(Number(args.lit ?? 0.5)) ? 1 : 0);
  const regions = computeRegions(g, state);
  const pick = new Set<number>(required.map(([rr, cc]) => rr * base.w + cc));
  const pool = r.shuffle([...free]);
  for (const t of pool) { if (pick.size >= glyphs) break; pick.add(t); }
  const p: PuzzleDef = JSON.parse(JSON.stringify(base));
  p.id = 'cand';
  let ok = true;
  for (const t of pick) {
    const gl = glyphFor(r.pick(kinds), state, t, regions);
    if (!gl) { ok = false; break; }
    if (gl.kind === 'beacon') p.cells[t].lock = 1;
    p.cells[t].glyph = gl;
  }
  if (!ok) continue;
  if (kinds.includes('beacon')) {
    // all lit tiles must be seen in the generated state
    if (!check(p, state).ok) continue;
  }
  if (check(p, initialState(p)).ok) continue;
  const res = solve(p, { maxSolutions: 2, maxNodes: 20000, timeLimitMs: 2000, breakSymmetry: true });
  if (res.solutions.length !== 1 || !res.complete) continue;
  const key = JSON.stringify(p.cells);
  if (found.has(key)) continue;
  // prefer: fewer nodes = cleaner deduction; balanced lit ratio
  const lit = res.solutions[0].reduce((a, b) => a + b, 0) / free.length;
  const score = res.nodes + Math.abs(lit - 0.5) * 4;
  found.set(key, { p, sol: res.solutions[0], score });
}
const list = [...found.values()].sort((a, b) => a.score - b.score);
console.log(`${list.length} unique candidates`);
for (const c of list.slice(0, top)) {
  console.log('\n' + ascii(c.p, c.sol));
  if (args.src) console.log(toSource(c.p));
}
