/**
 * Prints puzzles with solution counts and forced-tile maps.
 *   npx tsx tools/analyze.ts kinship            (whole area)
 *   npx tsx tools/analyze.ts kinship intro      (one group)
 *   npx tsx tools/analyze.ts kinship.intro.3    (one puzzle)
 */
import { PUZZLES } from '../src/data/puzzles/index';
import type { AreaId } from '../src/data/areas';
import { gradeDifficulty } from '../src/puzzle/solver';
import { analyze, ascii } from './lib/show';

const [a, b] = process.argv.slice(2);
const [areaId, groupKey, num] = a.includes('.') ? a.split('.') : [a, b, undefined];
const area = PUZZLES[areaId as AreaId];
if (!area) throw new Error('unknown area ' + areaId);
for (const [key, list] of Object.entries(area)) {
  if (groupKey && key !== groupKey) continue;
  list.forEach((p, i) => {
    if (num && String(i + 1) !== num && key !== 'secret') return;
    const t0 = Date.now();
    const an = analyze(p, 64);
    const gd = gradeDifficulty(p);
    console.log(`\n── ${p.id}  ${p.w}×${p.h}  sols=${an.count}  nodes=${an.nodes}  grade=${gd.score} simple=${gd.simpleSolved} full=${gd.fullSolved}  d=${p.difficulty}  ${Date.now() - t0}ms`);
    console.log('   ' + (p.note ?? ''));
    console.log(ascii(p, an.first));
    console.log(an.forced.split('\n').filter(Boolean).map((l) => ' '.repeat(10) + 'forced: ' + l).join('\n'));
  });
}
