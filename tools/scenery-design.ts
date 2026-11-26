/**
 * Designs mosaic clues for panels whose pattern is read (partly) from the world.
 * Given a full solution and which cells the world hides ('?'), finds the smallest sets of
 * mosaic windows (glyphs on the panel) that pin the hidden cells down to one answer, and prints
 * the panel's grid and target. Also: for 'floor' panels (every cell hidden, clues in the world),
 * finds small clue sets with a unique answer.
 *   npx tsx tools/scenery-design.ts partial '1100/1110/0111/0011' '..../..../..??/..??'
 *   npx tsx tools/scenery-design.ts full '0110/1001/1001/0110'
 */
import { puzzle } from '../src/puzzle/board';
import { solve, insightPath } from '../src/puzzle/solver';

const [mode, solArg, maskArg, maxArg] = process.argv.slice(2);
const rows = solArg.split('/');
const h = rows.length, w = rows[0].length;
const sol = rows.join('');
const mask = mode === 'full' ? '?'.repeat(w * h) : maskArg.split('/').join('');
const maxClues = Number(maxArg ?? (mode === 'full' ? 7 : 3));

function count(t: number): number {
  const r0 = Math.floor(t / w), c0 = t % w;
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = r0 + dr, c = c0 + dc;
    if (r < 0 || r >= h || c < 0 || c >= w) continue;
    if (sol[r * w + c] === '1') n++;
  }
  return n;
}

function build(clues: number[]) {
  const grid: string[] = [];
  for (let r = 0; r < h; r++) {
    const toks: string[] = [];
    for (let c = 0; c < w; c++) {
      const t = r * w + c;
      toks.push(clues.includes(t) ? `x${count(t)}` : '.');
    }
    grid.push(toks.join(' '));
  }
  const target = mode === 'full' ? undefined : Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => (mask[r * w + c] === '?' ? '?' : sol[r * w + c])).join('')).join('/');
  return { grid: grid.join('\n'), target };
}

function unique(clues: number[]): boolean {
  const { grid, target } = build(clues);
  const p = puzzle('design.x', { grid, ...(target ? { target, targetDisplay: 'world' as const } : {}), difficulty: 1 });
  const res = solve(p, { maxSolutions: 2, maxNodes: 400000, timeLimitMs: 4000 });
  return res.complete && res.solutions.length === 1;
}

// windows that see at least one hidden cell
const useful: number[] = [];
for (let t = 0; t < w * h; t++) {
  const r0 = Math.floor(t / w), c0 = t % w;
  let sees = false;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = r0 + dr, c = c0 + dc;
    if (r >= 0 && r < h && c >= 0 && c < w && mask[r * w + c] === '?') sees = true;
  }
  if (sees) useful.push(t);
}
const found: number[][] = [];
function rec(start: number, chosen: number[], k: number) {
  if (found.length >= 12) return;
  if (chosen.length === k) {
    if (unique(chosen)) found.push([...chosen]);
    return;
  }
  for (let i = start; i < useful.length; i++) {
    chosen.push(useful[i]);
    rec(i + 1, chosen, k);
    chosen.pop();
    if (found.length >= 12) return;
  }
}
for (let k = 1; k <= maxClues && !found.length; k++) rec(0, [], k);
if (!found.length) console.log('no clue set up to', maxClues);
for (const f of found.slice(0, 6)) {
  const { grid, target } = build(f);
  const p = puzzle('design.x', { grid, ...(target ? { target, targetDisplay: 'world' as const } : {}), difficulty: 1 });
  console.log(`--- ${f.length} clues, insights ${insightPath(p, 30).steps.length}`);
  console.log(grid);
  if (target) console.log('target', target);
}
