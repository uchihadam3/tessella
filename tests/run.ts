/* Minimal test runner: `npm test`. Every file in tests/ that ends with .test.ts registers tests. */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type T = { name: string; fn: () => void | Promise<void> };
const tests: T[] = [];
(globalThis as unknown as { test: (n: string, f: T['fn']) => void }).test = (name, fn) => tests.push({ name, fn });

const here = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(here).filter((f) => f.endsWith('.test.ts')).sort()) await import(join(here, f));

let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`  ok   ${t.name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${t.name}\n       ${(e as Error).stack?.split('\n').slice(0, 4).join('\n       ')}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
