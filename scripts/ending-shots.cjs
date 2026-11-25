// Captures moments of an ending: node scripts/ending-shots.cjs main|secret
const { chromium } = require('playwright');
const kind = process.argv[2] || 'main';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&at=0,40,0,0&p=1.5', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.evaluate((kind) => {
    const g = window.__game;
    if (kind === 'main') g['startEnding']();
    else {
      for (const it of g.stars.items) it.revealed = true;
      import('/src/game/endings.ts').catch(() => {});
      g.save.flags.secretEnding = true;
      // the vault panel's onSolved path triggers the secret ending
      const v = g.pm.byId.get('hub.vault');
      g['onSolved'](v);
    }
  }, kind);
  const times = kind === 'main' ? [3, 9, 16, 24, 34, 48, 70] : [4, 10, 18, 26, 36, 50, 70];
  let last = 0;
  for (const t of times) {
    await page.waitForTimeout((t - last) * 1000);
    last = t;
    await page.screenshot({ path: `screenshots/end-${kind}-${t}.png` });
    console.log('shot', t);
  }
  await browser.close();
})();
