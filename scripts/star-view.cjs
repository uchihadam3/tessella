// Constellation check: how many were placed, where their objects ended up (ground, floors, walls,
// sky), and pictures of one figure: from its spot before/while/after the vision, and from a few
// steps aside (where it must not show).
// Usage: BASE=http://localhost:5180/ node scripts/star-view.cjs [index] [out-prefix]
const { chromium } = require('playwright');
const idx = Number(process.argv[2] || 0);
const out = process.argv[3] || 'screenshots/star';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  page.setDefaultTimeout(600000);
  const warns = [];
  page.on('console', (m) => { if (/not placed/.test(m.text())) warns.push(m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t0 = Date.now();
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&at=8,52,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  console.log('ready after', ((Date.now() - t0) / 1000).toFixed(0) + 's', '| not placed:', warns.length, warns.slice(0, 5).join(' '));
  const stats = await page.evaluate(() => {
    const items = window.__game.stars.items;
    const kinds = { ground: 0, floor: 0, wall: 0, sky: 0 };
    let spreadSum = 0;
    for (const it of items) {
      for (const v of it.vis) kinds[v.kind === 'prop' ? 'ground' : v.kind === 'disc' ? 'wall' : 'sky']++;
      const ds = it.starPos.map((p) => p.distanceTo(it.view.eye)).filter((d) => d < 100);
      spreadSum += Math.max(...ds) / Math.max(0.5, Math.min(...ds));
    }
    return { count: items.length, kinds, meanSpread: (spreadSum / items.length).toFixed(2) };
  });
  console.log('constellations', JSON.stringify(stats));
  const look = async (dx, dz) => page.evaluate(({ idx, dx, dz }) => {
    const g = window.__game;
    const it = g.stars.items[idx];
    const d = it.view.dir;
    g.teleport(it.view.spot.x + dx, it.view.spot.z + dz, Math.atan2(-d.x, -d.z));
    g.player.pitch = Math.asin(d.y);
    document.getElementById('crosshair')?.classList.add('hidden');
    return { id: it.def.id, area: it.area, kinds: it.vis.map((v) => v.kind).join(','), dists: it.starPos.map((p) => p.distanceTo(it.view.eye).toFixed(1)).join(',') };
  }, { idx, dx, dz });
  const info = await look(3.2, 1.5);
  console.log('figure', JSON.stringify(info));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}-aside.png` });
  await look(0, 0);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}-spot.png` });
  await page.waitForFunction((idx) => window.__game.stars.items[idx].hold > 0.55, idx, { timeout: 600000 });
  await page.screenshot({ path: `${out}-holding.png` });
  await page.waitForFunction((idx) => window.__game.stars.items[idx].revealed && window.__game.stars.items[idx].reveal >= 1, idx, { timeout: 600000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}-revealed.png` });
  await look(3.2, 1.5);
  await page.waitForTimeout(3000);
  const aside = await page.evaluate((idx) => window.__game.stars.items[idx].threadU.uAlpha.value, idx);
  console.log('thread alpha from aside after reveal:', aside.toFixed(2));
  await browser.close();
})().catch((e) => { console.log('star-view crashed:', e.message.split('\n')[0]); process.exit(1); });
