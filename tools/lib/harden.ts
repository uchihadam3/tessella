/**
 * Picture hardening for the Weave language: flips as few pixels as possible (only on the
 * picture's outline, so the drawing stays recognisable) until the nonogram has a unique solution
 * that needs at least `minLooks` real cross-line contradictions ("e se?") to solve.
 */
import { insightPath, solve } from '../../src/puzzle/solver';
import type { PuzzleDef } from '../../src/puzzle/types';
import { weaveFromPicture } from '../weave-check';
import { rng } from './random-puzzle';

export interface Hardened { pic: string[]; p: PuzzleDef; looks: number; flips: number }

function looksOf(p: PuzzleDef): number | null {
  const res = solve(p, { maxSolutions: 2, maxNodes: 200000, timeLimitMs: 4000 });
  if (res.solutions.length !== 1 || !res.complete) return null;
  const ip = insightPath(p, 40);
  if (!ip.solved) return null;
  return ip.steps.filter((s) => s.tag === 'lookahead').length;
}

export function harden(name: string, pic: string[], holes: string[] | undefined, minLooks: number, maxLooks: number, seed = 1, maxFlips = 4, tries = 4000): Hardened | null {
  const H = pic.length;
  const W = pic[0].length;
  const holeAt = (r: number, c: number) => holes?.[r]?.[c] === '#';
  const base = pic.map((row) => [...row]);
  const make = (grid: string[][]) => weaveFromPicture(name, grid.map((row) => row.join('')).join('/'), (holes ?? []).join('/'));
  const p0 = make(base);
  const l0 = looksOf(p0);
  if (l0 !== null && l0 >= minLooks && l0 <= maxLooks) return { pic, p: p0, looks: l0, flips: 0 };
  // outline pixels: cells with a neighbour of the other colour
  const outline: [number, number][] = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (holeAt(r, c)) continue;
    const v = base[r][c];
    const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && a < H && b >= 0 && b < W && base[a][b] !== v);
    if (nb) outline.push([r, c]);
  }
  const rnd = rng(seed);
  let best: Hardened | null = null;
  for (let k = 0; k < tries; k++) {
    const nFlips = 1 + rnd.int(maxFlips);
    if (best && nFlips >= best.flips) continue;
    const grid = base.map((row) => [...row]);
    const chosen = rnd.shuffle([...outline]).slice(0, nFlips);
    for (const [r, c] of chosen) grid[r][c] = grid[r][c] === '#' ? '.' : '#';
    // keep every row and column non-empty-ish: avoid destroying the drawing
    const p = make(grid);
    const l = looksOf(p);
    if (l === null || l < minLooks || l > maxLooks) continue;
    best = { pic: grid.map((row) => row.join('')), p, looks: l, flips: nFlips };
    if (nFlips === 1) break;
  }
  return best;
}

/**
 * Keeps the drawing intact and instead removes some threads (row/column clues) — a line with no
 * thread can hold anything, so the player must read it from the crossing lines. Stops as soon as
 * the solve needs at least `minLooks` cross-line contradictions (and stays unique).
 */
const MAXFRAC = Number(process.env.PRUNE_FRAC ?? 0.5);
export function pruneThreads(p0: PuzzleDef, minLooks: number, maxLooks: number, seed = 1, attempts = 60): { p: PuzzleDef; looks: number; removed: number } | null {
  const rnd = rng(seed);
  let best: { p: PuzzleDef; looks: number; removed: number } | null = null;
  const lines = [...p0.rowClues!.map((_, i) => ['r', i] as const), ...p0.colClues!.map((_, i) => ['c', i] as const)];
  for (let a = 0; a < attempts; a++) {
    const p: PuzzleDef = JSON.parse(JSON.stringify(p0));
    let removed = 0;
    for (const [kind, i] of rnd.shuffle([...lines])) {
      const arr = kind === 'r' ? p.rowClues! : p.colClues!;
      if (arr[i] === null) continue;
      const keep = arr[i];
      arr[i] = null;
      const l = looksOf(p);
      if (l === null || l > maxLooks) { arr[i] = keep; continue; }
      removed++;
      if (l >= minLooks) {
        if (!best || removed < best.removed || (removed === best.removed && l > best.looks)) best = { p: JSON.parse(JSON.stringify(p)), looks: l, removed };
        break;
      }
      if (removed > Math.ceil(lines.length * MAXFRAC)) break;
    }
    if (best && best.removed <= 2) break;
  }
  return best;
}
