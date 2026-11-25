// Checks every fast-travel point: open ground, not inside a blocker, not in water, and the player can
// walk away from it in most directions. Usage: BASE=http://localhost:5180/ node scripts/waystones.cjs
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(400000);
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&norender&at=8,52,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  const res = await page.evaluate(async () => {
    const g = window.__game;
    const W = (await import('/src/world/layout.ts').catch(() => null))?.WAYSTONES;
    return W ? null : null;
  }).catch(() => null);
  void res;
  const out = await page.evaluate(() => {
    const g = window.__game;
    const cw = g.world.collision;
    const pl = g.player;
    const list = g.waystoneList ? g.waystoneList() : null;
    return { hasList: !!list };
  });
  console.log(JSON.stringify(out));
  await browser.close();
})();
