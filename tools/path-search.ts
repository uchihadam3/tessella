/** Random search for path panels (wells, waymarks, rocks, rivets) with exactly one answer. */
import { puzzle } from '../src/puzzle/board';
import { solve } from '../src/puzzle/solver';
const [W, H, COLORS, DOTS, ROCKS, N, SEED] = process.argv.slice(2).map(Number);
let s = SEED || 7;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const out: { g: string; nodes: number }[] = [];
const seen = new Set<string>();
for (let tries = 0; tries < (Number(process.env.TRIES) || 20000) && out.length < (N || 5); tries++) {
  const cells = Array(W * H).fill('.');
  const free = () => { for (;;) { const i = Math.floor(rnd() * W * H); if (cells[i] === '.') return i; } };
  const letters = 'abcjiv';
  for (let c = 0; c < COLORS; c++) { cells[free()] = 'w' + letters[c]; cells[free()] = 'w' + letters[c]; }
  for (let k = 0; k < DOTS; k++) cells[free()] = 'o';
  for (let k = 0; k < ROCKS; k++) cells[free()] = rnd() < 0.5 ? '#' : 'D';
  const grid = Array.from({ length: H }, (_, r) => cells.slice(r * W, r * W + W).join(' ')).join('\n');
  if (seen.has(grid)) continue;
  seen.add(grid);
  const p = puzzle('s.x', { grid, difficulty: 1 });
  const res = solve(p, { maxSolutions: 2 });
  if (!res.complete || res.solutions.length !== 1) continue;
  // difficulty: how many partial paths a plain search had to try
  const lit = res.solutions[0].reduce((a: number, b: number) => a + b, 0);
  if (lit < W * H * 0.35) continue;
  out.push({ g: grid, nodes: res.nodes });
}
out.sort((a, b) => b.nodes - a.nodes);
for (const o of out) console.log(`--- nodes ${o.nodes}\n${o.g}`);
