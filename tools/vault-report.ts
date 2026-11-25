/** Prints the Hidden Vault puzzle with its deduction trace. npx tsx tools/vault-report.ts */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzle } from '../src/puzzle/board';
import { insightPath, solve, traceDeduction } from '../src/puzzle/solver';
import { ascii } from './lib/show';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, process.argv[2] ?? 'tools/data/vault.json'), 'utf8'));
const p = puzzle('hub.vault', data.compact);
const res = solve(p, { maxSolutions: 2, maxNodes: 1e6 });
console.log(`solutions: ${res.solutions.length} complete: ${res.complete} nodes: ${res.nodes} propagationOnly: ${res.propagationOnly}`);
const simple = solve(p, { maxSolutions: 1, simple: true, maxNodes: 1 });
console.log(`simple root determined: ${(simple.rootDetermined * 100).toFixed(0)}%`);
console.log(ascii(p, res.solutions[0]));
const tr = traceDeduction(p);
console.log('trace:', tr.steps.map(([k, n]) => `${k}:${n}`).join(' → '));
const kinds = new Map<string, number>();
for (const c of p.cells) if (c.glyph) kinds.set(c.glyph.kind, (kinds.get(c.glyph.kind) ?? 0) + 1);
console.log('glyphs:', [...kinds].map(([k, n]) => `${k}×${n}`).join(', '), '| weave rows', p.rowClues?.filter(Boolean).length, 'cols', p.colClues?.filter(Boolean).length);
const ip = insightPath(p, 60);
console.log(`insight path (${ip.steps.length} insights, beginner decides ${(ip.basicRoot * 100).toFixed(0)}%):`, ip.steps.map((s) => `${s.tag}(${s.direct}+${s.cascade})`).join(' → '));
