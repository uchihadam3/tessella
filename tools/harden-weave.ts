/**
 * Searches, for each Weave picture, the gentlest change that makes it need real cross-line
 * reasoning: first only removing threads (the drawing stays intact), then also flipping a few
 * outline pixels (mirror-symmetric when the drawing is). Writes tools/data/weave-hard.json.
 *   npx tsx tools/harden-weave.ts <minLooks> <maxLooks> name1 name2 ...
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCompact } from '../src/puzzle/board';
import { insightPath, solve } from '../src/puzzle/solver';
import type { PuzzleDef } from '../src/puzzle/types';
import { pruneThreads } from './lib/harden';
import { PICTURES } from './lib/pictures';
import { rng } from './lib/random-puzzle';
import { weaveFromPicture } from './weave-check';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tools/data/weave-hard.json');
const [minL, maxL, ...names] = process.argv.slice(2);
const minLooks = Number(minL), maxLooks = Number(maxL);
const db: Record<string, unknown> = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};

function looksOf(p: PuzzleDef): number | null {
  const res = solve(p, { maxSolutions: 2, maxNodes: 200000, timeLimitMs: 4000 });
  if (res.solutions.length !== 1 || !res.complete) return null;
  const ip = insightPath(p, 40);
  return ip.solved ? ip.steps.filter((s) => s.tag === 'lookahead').length : null;
}

for (const name of names) {
  const pic = PICTURES[name];
  const H = pic.pic.length, W = pic.pic[0].length;
  const holeAt = (r: number, c: number) => pic.holes?.[r]?.[c] === '#';
  const symmetric = pic.pic.every((row) => row === [...row].reverse().join(''));
  const r = rng(name.length * 7919 + 11);
  let best: { p: PuzzleDef; looks: number; flips: number; pruned: number; pic: string[] } | null = null;
  const consider = (grid: string[], flips: number) => {
    const p = weaveFromPicture(name, grid.join('/'), (pic.holes ?? []).join('/'));
    const l = looksOf(p);
    if (l !== null && l >= minLooks && l <= maxLooks) {
      if (!best || flips < best.flips) best = { p, looks: l, flips, pruned: 0, pic: grid };
      return;
    }
    if (l === null) return;
    const pr = pruneThreads(p, minLooks, maxLooks, r.int(1e9), 40);
    if (pr && (!best || flips * 3 + pr.removed < best.flips * 3 + best.pruned)) best = { p: pr.p, looks: pr.looks, flips, pruned: pr.removed, pic: grid };
  };
  consider(pic.pic, 0);
  for (let k = 0; process.env.NOFLIP && !best && k < 6; k++) consider(pic.pic, 0);
  const outline: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (holeAt(y, x)) continue;
    const v = pic.pic[y][x];
    if ([[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]].some(([a, b]) => a >= 0 && a < H && b >= 0 && b < W && pic.pic[a][b] !== v)) outline.push([y, x]);
  }
  const t0 = Date.now();
  for (let k = 0; k < 1500 && !process.env.NOFLIP && Date.now() - t0 < Number(process.env.MS ?? 90000); k++) {
    const nFlips = 1 + r.int(3);
    const bestNow = best as { flips: number } | null;
    if (bestNow && nFlips > bestNow.flips) continue;
    const g = pic.pic.map((row) => [...row]);
    for (const [y, x] of r.shuffle([...outline]).slice(0, nFlips)) {
      g[y][x] = g[y][x] === '#' ? '.' : '#';
      if (symmetric) g[y][W - 1 - x] = g[y][x];
    }
    consider(g.map((row) => row.join('')), nFlips);
  }
  const b = best as { p: PuzzleDef; looks: number; flips: number; pruned: number; pic: string[] } | null;
  console.log(`${name.padEnd(11)} ${b ? `looks ${b.looks} flips ${b.flips} pruned ${b.pruned}` : 'FAILED'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (b) db[`${name}@${minLooks}`] = { looks: b.looks, flips: b.flips, pruned: b.pruned, pic: b.pic, compact: toCompact(b.p) };
  // merge with entries other runs may have written meanwhile
  const now: Record<string, unknown> = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
  if (b) now[`${name}@${minLooks}`] = db[`${name}@${minLooks}`];
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(now, null, 1));
}
