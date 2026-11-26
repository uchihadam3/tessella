/**
 * Scenery path panels: from a path puzzle with one answer, keep only its wells (and what the
 * panel shows) and hide part of the answer drawn in the place; check the answer stays unique.
 *   npx tsx tools/scenery-path.ts '<full grid>' '<panel grid>' '<mask rows, ? = hidden>'
 */
import { puzzle } from '../src/puzzle/board';
import { solve } from '../src/puzzle/solver';
const [full, panel, mask] = process.argv.slice(2);
const base = puzzle('b', { grid: full.replace(/\//g, '\n'), difficulty: 1 });
const r = solve(base, { maxSolutions: 2 });
if (r.solutions.length !== 1) { console.log('base not unique', r.solutions.length); process.exit(1); }
const sol = r.solutions[0];
const m = mask.replace(/\//g, '');
const w = base.w;
const target = Array.from({ length: base.h }, (_, y) => Array.from({ length: w }, (_, x) => {
  const i = y * w + x;
  if (base.cells[i].hole) return '#';
  return m[i] === '?' ? '?' : String(sol[i]);
}).join('')).join('/');
const p = puzzle('p', { grid: panel.replace(/\//g, '\n'), target, targetDisplay: 'world', difficulty: 1 });
const q = solve(p, { maxSolutions: 2 });
console.log(q.solutions.length === 1 ? 'UNIQUE' : `NOT unique (${q.solutions.length})`, 'target', target);
