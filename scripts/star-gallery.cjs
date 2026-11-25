// Pictures of a few constellations in different places: from a few steps aside (nothing to see),
// from the spot while the vision is forming, and revealed.
// Usage: BASE=http://localhost:5180/ node scripts/star-gallery.cjs <outDir> [areas comma-list]
const { chromium } = require('playwright');
const fs = require('fs');
const outDir = process.argv[2] || 'screenshots/stars';
const areas = (process.argv[3] || 'kinship,mosaic,citadel,twins').split(',');
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(600000);
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&at=8,52,180,0&p=0.45', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  await page.evaluate(() => {
    document.getElementById('crosshair')?.classList.add('hidden');
    for (const id of ['area-title', 'toasts']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  });
  const picks = await page.evaluate((areas) => {
    const items = window.__game.stars.items;
    // names (e.g. "Owl,Whale") pick those figures; area ids pick a big one from each area
    if (areas.some((a) => /[A-Z]/.test(a))) return areas.map((n) => items.findIndex((it) => it.def.name?.en === n)).filter((i) => i >= 0);
    return areas.map((a) => {
      const cands = items.map((it, i) => ({ it, i })).filter(({ it }) => it.area === a && it.def.stars.length >= 5);
      cands.sort((x, y) => {
        const score = ({ it }) => new Set(it.vis.map((v) => v.kind)).size * 10 + it.def.stars.length;
        return score(y) - score(x);
      });
      return cands.length ? cands[0].i : -1;
    }).filter((i) => i >= 0);
  }, areas);
  for (const idx of picks) {
    const place = (dx, dz) => page.evaluate(({ idx, dx, dz }) => {
      const g = window.__game;
      const it = g.stars.items[idx];
      const d = it.view.dir;
      // aside: same distance, a few steps to the side, still facing the figure's middle
      g.teleport(it.view.spot.x + dx, it.view.spot.z + dz, Math.atan2(-d.x, -d.z));
      g.player.pitch = Math.asin(d.y);
      return { id: it.def.id, en: it.def.name?.en, pt: it.def.name?.pt, area: it.area, n: it.def.stars.length, kinds: it.vis.map((v) => v.kind).join(','), dists: it.starPos.map((p) => p.distanceTo(it.view.eye).toFixed(0)).join(',') };
    }, { idx, dx, dz });
    const info = await place(2.6, -2.2);
    console.log('figure', JSON.stringify(info));
    const name = `${outDir}/${info.area}-${info.id.split('.').pop()}-${(info.en || '').toLowerCase().replace(/[^a-z]+/g, '-')}`;
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${name}-1-de-lado.png` });
    await place(0, 0);
    // stop the vision from advancing while we take the "unlit" picture
    await page.evaluate((idx) => { window.__REVEAL_FREEZE = idx; }, idx);
    await page.waitForTimeout(3500);
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; it.hold = 0; it.dirty = true; }, idx);
    await page.waitForTimeout(1200);
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; it.hold = 0; }, idx);
    await page.screenshot({ path: `${name}-2-apagada.png` });
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; it.hold = 0.75; it.dirty = true; }, idx);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${name}-3-acendendo.png` });
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; it.hold = 0.999; }, idx);
    await page.waitForFunction((idx) => window.__game.stars.items[idx].revealed && window.__game.stars.items[idx].reveal >= 1, idx);
    // light a couple of objects so the picture shows what lit ones look like
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; for (let i = 0; i < it.state.length; i += 2) if (it.def.stars[i].lock === undefined) it.state[i] = 1; it.dirty = true; }, idx);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${name}-4-acesa.png` });
    console.log('shots', name);
  }
  await browser.close();
})().catch((e) => { console.log('gallery crashed:', e.message.split('\n')[0]); process.exit(1); });
