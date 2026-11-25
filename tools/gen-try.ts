/** Quick generator trial: npx tsx tools/gen-try.ts '<json spec>' [count] [seed] */
import { ramp, type Spec } from './lib/gen';
import { rng } from './lib/random-puzzle';
import { ascii } from './lib/show';

const spec = JSON.parse(process.argv[2]) as Spec;
const count = Number(process.argv[3] ?? 4);
const r = rng(Number(process.argv[4] ?? 1));
const t0 = Date.now();
const list = ramp(r, spec, count, Number(process.env.TRIES ?? 200));
console.log(`${list.length} candidates in ${Date.now() - t0} ms`);
for (const c of list) {
  console.log(`\nscore ${c.score.toFixed(2)} glyphs ${c.glyphs} rivets ${c.rivets} nodes ${c.nodes} simple ${c.simple} sols ${c.sols}`);
  console.log(ascii(c.p, c.sol));
}
