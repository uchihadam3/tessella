// Screenshot a constellation before and after its reveal: node scripts/star-shot.cjs <id> <out-prefix>
const { chromium } = require('playwright');
const id = process.argv[2] || 'kinship.c03';
const out = process.argv[3] || 'screenshots/star';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&at=0,279.5,180,0&p=0.5', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  const pos = await page.evaluate((id) => {
    const g = window.__game;
    const it = g.stars.items.find((i) => i.def.id === id);
    const c = it.center;
    // stand 6 m away, looking at the centre
    const dir = { x: 0.6, z: 0.8 };
    const px = c.x + dir.x * 6.5, pz = c.z + dir.z * 6.5;
    g.teleport(px, pz, Math.atan2(c.x - px, c.z - pz) + Math.PI);
    g.player.pitch = -0.32;
    return [c.x, c.y, c.z];
  }, id);
  console.log('center', pos.map((v) => v.toFixed(1)).join(','));
  await page.waitForTimeout(12000);
  await page.screenshot({ path: out + '-hidden.png' });
  await page.evaluate((id) => {
    const g = window.__game;
    const it = g.stars.items.find((i) => i.def.id === id);
    it.revealed = true; it.reveal = 1; it.dirty = true;
    it.state[0] = 1; it.state[1] = 1;
  }, id);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: out + '-revealed.png' });
  await browser.close();
})();
