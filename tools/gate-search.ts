/**
 * Small searches for gentle teaching panels (intro gates and sequence openers): keeps candidates
 * whose insight path uses at most `max` insights and prints them as compact sources.
 *   npx tsx tools/gate-search.ts <kind> [max=2] [tries=4000]
 */
import { toCompact } from '../src/puzzle/board';
import { insightPath } from '../src/puzzle/solver';
import { generate, generateKinship, generatePond, type Candidate } from './lib/gen';
import { rng } from './lib/random-puzzle';
import { ascii } from './lib/show';

const [kind, maxS = '2', triesS = '4000'] = process.argv.slice(2);
const max = Number(maxS);
const r = rng(kind.length * 1009 + 7);
const make: Record<string, () => Candidate | null> = {
  kinship: () => generateKinship(r, { w: 4, h: 4, holes: 0, colors: [3, 3], gemsPer: [2, 2], rivets: 1, maxSolsWithCore: 100000 }),
  measure: () => generate(r, { w: 4, h: 4, kinds: ['measure'], holes: 0 }),
  mold: () => generate(r, { w: 4, h: 4, kinds: ['mold'], maxMold: 4, freeMoldP: 0.7, holes: 0 }),
  twins: () => generatePond(r, { h: 4, left: 2, right: 2, pairs: 2, sizes: [2, 3], mirrorP: 0.5, dropRivets: 0, darkP: 0.4, holes: 0 }),
};
const seen = new Set<string>();
const found: { c: Candidate; steps: number; path: string; basic: number }[] = [];
for (let k = 0; k < Number(triesS); k++) {
  const c = make[kind]();
  if (!c) continue;
  const key = JSON.stringify(c.p.cells);
  if (seen.has(key)) continue;
  seen.add(key);
  const ip = insightPath(c.p, 30);
  if (ip.steps.length > max || ip.steps.length < 1) continue;
  found.push({ c, steps: ip.steps.length, basic: ip.basicRoot, path: ip.steps.map((s) => s.tag).join(' → ') });
}
found.sort((a, b) => b.steps - a.steps || a.basic - b.basic);
for (const f of found.slice(0, Number(process.env.SHOW ?? 12))) {
  console.log(`steps ${f.steps} basic ${(f.basic * 100).toFixed(0)}%  ${f.path}`);
  console.log(JSON.stringify(toCompact(f.c.p)));
  console.log(ascii(f.c.p, f.c.sol));
}
console.log(`${found.length} found`);
