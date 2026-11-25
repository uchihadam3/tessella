// Captures the intro sequence: gate, studio logo, title, menu.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error') console.log('[console.error]', t.slice(0, 300)); });
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/i0-gate.png' });
  const t0 = Date.now();
  await page.mouse.click(480, 270);
  await page.waitForSelector('#studio.play', { timeout: 60000 });
  console.log('studio play after', Date.now() - t0, 'ms');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'screenshots/i1-studio.png' });
  await page.waitForSelector('#title .word.reveal', { timeout: 60000 });
  console.log('title reveal after', Date.now() - t0, 'ms');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'screenshots/i2-title.png' });
  await page.waitForSelector('#menu.on', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/i3-menu.png' });
  await browser.close();
})();
