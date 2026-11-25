/** Difficulty statistics per group: npx tsx tools/stats.ts [area] */
import { PUZZLES } from '../src/data/puzzles/index';
import type { AreaId } from '../src/data/areas';
import { solve } from '../src/puzzle/solver';

const only = process.argv[2];
for (const [area, set] of Object.entries(PUZZLES)) {
  if (only && area !== only) continue;
  for (const [group, list] of Object.entries(set)) {
    if (!list.length) continue;
    const rows = list.map((p) => {
      const simple = solve(p, { maxSolutions: 1, simple: true, maxNodes: 1, timeLimitMs: 3000, breakSymmetry: true });
      const full = solve(p, { maxSolutions: 2, maxNodes: 200000, timeLimitMs: 10000, breakSymmetry: true });
      return { id: p.id, size: `${p.w}x${p.h}`, sr: simple.rootDetermined, fr: full.rootDetermined, nodes: full.nodes, prop: full.propagationOnly };
    });
    const avg = (f: (r: (typeof rows)[number]) => number) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(2);
    console.log(`${(area as AreaId).padEnd(9)} ${group.padEnd(9)} n=${rows.length} simpleRoot ${avg((r) => r.sr)} fullRoot ${avg((r) => r.fr)} nodes ${avg((r) => r.nodes)} propOnly ${rows.filter((r) => r.prop).length}`);
    if (process.env.V) for (const r of rows) console.log(`    ${r.id.padEnd(20)} ${r.size.padEnd(6)} sr ${r.sr.toFixed(2)} fr ${r.fr.toFixed(2)} nodes ${r.nodes} ${r.prop ? 'prop' : ''}`);
  }
}
