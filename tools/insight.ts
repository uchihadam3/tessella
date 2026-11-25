/** Prints the "ahá" path of puzzles: npx tsx tools/insight.ts <area> [group] */
import { PUZZLES } from '../src/data/puzzles/index';
import type { AreaId } from '../src/data/areas';
import { insightPath } from '../src/puzzle/solver';

const [area, group] = process.argv.slice(2);
for (const [g, list] of Object.entries(PUZZLES[area as AreaId])) {
  if (group && g !== group) continue;
  for (const p of list) {
    const ip = insightPath(p);
    const path = ip.steps.map((s) => `${s.tag}(${s.direct}+${s.cascade})`).join(' → ');
    console.log(`${p.id.padEnd(20)} ${`${p.w}x${p.h}`.padEnd(6)} basic ${(ip.basicRoot * 100).toFixed(0).padStart(3)}%  ${ip.solved ? 'SOLVED' : `stuck ${(ip.determined * 100).toFixed(0)}%`}  ${path}`);
  }
}
