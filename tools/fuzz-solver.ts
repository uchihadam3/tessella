/** Fuzz: compares the solver against brute force on random tiny puzzles. `npx tsx tools/fuzz-solver.ts [count] [seed]` */
import { bruteForce, solve } from '../src/puzzle/solver';
import type { EchoDir, PuzzleDef } from '../src/puzzle/types';
import { decorate, randomBeaconBoard, randomBoard, rng } from './lib/random-puzzle';

const MAXH = Number(process.env.FUZZ_MAXH ?? 3);
const MAXFREE = Number(process.env.FUZZ_MAXFREE ?? 13);
const KIND_SETS = [
  ['measure'], ['contour'], ['mosaic'], ['mold'], ['gem'], ['twin', 'measure'], ['weave'],
  ['gem', 'measure'], ['contour', 'mosaic'], ['mold', 'twin'], ['gem', 'contour', 'lock'], ['measure', 'mold', 'gem', 'twin'],
];
const ECHO: EchoDir[][] = [['e', 'w'], ['n', 's'], ['n', 's', 'e', 'w'], ['ne', 'sw'], ['row'], ['col']];

export function fuzz(count: number, seed: number): number {
  const r = rng(seed);
  let failures = 0;
  for (let k = 0; k < count; k++) {
    let p: PuzzleDef;
    const mode = r.int(10);
    if (mode === 0) {
      const w = 2 + r.int(3), h = 2 + r.int(2);
      p = randomBeaconBoard(r, w, h, 1 + r.int(2)).p;
    } else {
      const w = 2 + r.int(3), h = 1 + r.int(MAXH);
      const { cells, state } = randomBoard(r, w, h, 0.1);
      p = { id: `fz${k}`, w, h, cells, wrap: r.chance(0.15) };
      decorate(r, p, state, r.pick(KIND_SETS), 0.45);
      if (mode === 1) {
        // echo puzzle
        for (const c of p.cells) if (!c.hole && r.chance(0.5)) c.echo = r.pick(ECHO);
        for (const c of p.cells) if (!c.hole && r.chance(0.15)) c.mute = true;
      }
      if (mode === 2) p.mirror = r.pick(['v', 'h', 'rot'] as const);
    }
    let free = 0;
    for (const c of p.cells) if (!c.hole && c.lock === undefined) free++;
    if (free > MAXFREE) continue;
    const brute = bruteForce(p, 1 << 16);
    const res = solve(p, { maxSolutions: 10000, maxNodes: 1e6, timeLimitMs: 20000 });
    const key = (s: Uint8Array) => Array.from(s).join('');
    const a = new Set(brute.map(key));
    const b = new Set(res.solutions.map(key));
    const same = a.size === b.size && [...a].every((x) => b.has(x));
    if (!same || !res.complete) {
      failures++;
      if (failures <= 5) console.log('MISMATCH', JSON.stringify(p), 'brute', a.size, 'solver', b.size, 'complete', res.complete, [...a].filter((x) => !b.has(x)).slice(0, 3));
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Number(process.argv[2] ?? 400);
  const seed = Number(process.argv[3] ?? 1);
  const t0 = Date.now();
  const f = fuzz(count, seed);
  console.log(`fuzz ${count} seed ${seed}: ${f} failures (${Date.now() - t0} ms)`);
  process.exit(f ? 1 : 0);
}
