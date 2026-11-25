/**
 * Measures hand-written candidate panels: uniqueness and the insight path.
 *   npx tsx tools/probe.ts file.json   (file: [{ "id": "...", ...compact source }])
 */
import { readFileSync } from 'node:fs';
import { puzzle } from '../src/puzzle/board';
import { insightPath, isInversionSymmetric, solve } from '../src/puzzle/solver';
import { ascii } from './lib/show';

const list = JSON.parse(readFileSync(process.argv[2], 'utf8')) as ({ id: string } & Record<string, unknown>)[];
for (const src of list) {
  try {
    const p = puzzle(src.id, { ...src, grid: String(src.grid).split('/').join('\n') } as never);
    const res = solve(p, { maxSolutions: 3, breakSymmetry: isInversionSymmetric(p), maxNodes: 400000 });
    const ip = insightPath(p, 60);
    const path = ip.steps.map((s) => `${s.tag}(${s.direct}+${s.cascade})`).join(' → ');
    console.log(`${src.id.padEnd(22)} sols ${res.solutions.length}${res.complete ? '' : '+'}${isInversionSymmetric(p) ? '~' : ''}  basic ${(ip.basicRoot * 100).toFixed(0).padStart(3)}%  ${ip.solved ? 'SOLVED' : `stuck ${(ip.determined * 100).toFixed(0)}%`}  steps ${ip.steps.length}: ${path}`);
    if (process.env.SHOWSOL && res.solutions.length) console.log(ascii(p, res.solutions[0]));
  } catch (e) {
    console.log(`${src.id}: ERROR ${(e as Error).message}`);
  }
}
