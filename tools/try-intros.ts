/** Candidate teaching panels: solvable? how many solutions? not solved at the start? */
import { puzzle, initialState, stateToString } from '../src/puzzle/board';
import { check, lintPuzzle } from '../src/puzzle/rules';
import { solve, isInversionSymmetric, insightPath } from '../src/puzzle/solver';
import { CANDIDATES } from './intro-candidates';

for (const [id, spec] of Object.entries(CANDIDATES)) {
  let p;
  try { p = puzzle(id, { difficulty: 1, ...spec } as Parameters<typeof puzzle>[1]); } catch (e) { console.log('BAD', id, (e as Error).message); continue; }
  const lint = lintPuzzle(p);
  const init = check(p, initialState(p)).ok;
  const res = solve(p, { maxSolutions: 4, maxNodes: 200000, timeLimitMs: 5000, breakSymmetry: true });
  const sym = isInversionSymmetric(p) ? '~' : '';
  console.log(id.padEnd(16), `ins ${insightPath(p, 30).steps.length}`, `sols ${res.solutions.length}${res.complete ? '' : '?'}${sym}`, init ? 'SOLVED-AT-START' : '', lint.length ? 'lint:' + lint.join(';') : '', '|', res.solutions.map((s) => stateToString(p, s)).join('  /  '));
}
