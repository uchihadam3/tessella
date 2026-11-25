// Screenshot helper: node tools/shot.mjs <url-query> <out.png> [waitMs] [w] [h]
// Expects a dev server on http://localhost:5173 (npx vite --port 5173).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , query = '', out = 'screenshots/shot.png', wait = '4000', w = '1280', h = '720'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto(`${process.env.BASE ?? 'http://localhost:5173/'}${query}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }).catch(() => logs.push('[timeout] __ready'));
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log(`saved ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
