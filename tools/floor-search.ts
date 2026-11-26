/** Random search for small mosaic boards (all clues, unique answer) for the floor of the temple court. */
import { puzzle } from '../src/puzzle/board';
import { solve, insightPath } from '../src/puzzle/solver';
const [W, H, K, N, SEED] = process.argv.slice(2).map(Number);
let s = SEED || 7;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const seen = new Set<string>();
let tries = 0;
const out: { g: string; ins: number }[] = [];
while (out.length < (N || 6) && tries < (Number(process.env.TRIES) || 4000)) {
  tries++;
  const sol = Array.from({ length: W * H }, () => (rnd() < 0.5 ? '1' : '0')).join('');
  const cnt = (t: number) => { const r0 = Math.floor(t / W), c0 = t % W; let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = r0 + dr, c = c0 + dc; if (r >= 0 && r < H && c >= 0 && c < W && sol[r * W + c] === '1') n++; } return n; };
  const idx = Array.from({ length: W * H }, (_, i) => i).sort(() => rnd() - 0.5).slice(0, K);
  const grid = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (idx.includes(r * W + c) ? `x${cnt(r * W + c)}` : '.')).join(' ')).join('\n');
  if (seen.has(grid)) continue;
  seen.add(grid);
  const p = puzzle('f.x', { grid, difficulty: 1 });
  const res = solve(p, { maxSolutions: 2, maxNodes: 200000, timeLimitMs: 2000 });
  if (!res.complete || res.solutions.length !== 1) continue;
  out.push({ g: grid, ins: insightPath(p, 30).steps.length });
}
out.sort((a, b) => b.ins - a.ins);
for (const o of out) console.log(`--- insights ${o.ins}\n${o.g}`);
console.log('tries', tries);
