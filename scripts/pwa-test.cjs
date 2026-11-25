// Installed-game checks: manifest + icons valid, the service worker takes control, the game still
// starts with the network OFF, and a newer build is picked up automatically when back online.
// Usage: BASE=http://localhost:5180/ node scripts/pwa-test.cjs
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:5180/';
const results = [];
const ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); console.log(results[results.length - 1]); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true);
  const man = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
    const m = await (await fetch(href)).json();
    const icons = await Promise.all(m.icons.map(async (i) => { const r = await fetch(i.src); const b = await r.blob(); const bm = await createImageBitmap(b); return `${i.src}:${bm.width}x${bm.height}:${i.sizes}`; }));
    return { name: m.name, display: m.display, start: m.start_url, icons };
  });
  ok('manifest is valid', man.name === 'TESSELLA' && man.display === 'fullscreen', JSON.stringify({ name: man.name, display: man.display, start: man.start }));
  ok('icons load at their declared sizes', man.icons.every((s) => { const [, got, want] = s.split(':'); return got === want; }), man.icons.join(' '));
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  ok('service worker controls the page', controlled);
  const v1 = await page.evaluate(() => localStorage.getItem('tessella.version'));
  // offline start
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 }).catch(() => {});
  ok('game starts with the network off', await page.evaluate(() => window.__ready === true && !!window.__game));
  await ctx.setOffline(false);
  // a new build appears on the server → picked up on the next launch, no action needed
  execSync('npx vite build', { stdio: 'ignore' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true);
  const v2 = await page.evaluate(() => localStorage.getItem('tessella.version'));
  ok('a newer build is used automatically', !!v1 && !!v2 && v1 !== v2, `${v1} → ${v2}`);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  console.log(results.some((r) => r.startsWith('FAIL')) ? 'PWA: FAILURES' : 'PWA: ALL PASS');
  await browser.close();
})().catch((e) => { console.log('PWA crashed:', e.message.split('\n')[0]); process.exit(1); });
