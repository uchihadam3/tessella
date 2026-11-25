import { PICTURES } from './lib/pictures';
import { weaveFromPicture } from './weave-check';
import { solve } from '../src/puzzle/solver';
import { ascii } from './lib/show';
for (const [name, { pic, holes }] of Object.entries(PICTURES)) {
  const p = weaveFromPicture(name, pic.join('/'), (holes ?? []).join('/'));
  const res = solve(p, { maxSolutions: 2, maxNodes: 400000, timeLimitMs: 20000 });
  console.log(`${name.padEnd(11)} ${p.w}x${p.h} sols=${res.solutions.length}${res.complete ? '' : '?'} nodes=${res.nodes} prop=${res.propagationOnly}`);
  if (res.solutions.length > 1) console.log(ascii(p, res.solutions[1]));
}
