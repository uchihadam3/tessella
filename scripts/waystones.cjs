// Checks every fast-travel point (guide stones on the map): the player lands on open ground, not
// inside a wall or panel, not in water, and can walk away in most directions.
// Usage: BASE=http://localhost:5180/ node scripts/waystones.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync('src/world/layout.ts', 'utf8');
const block = src.slice(src.indexOf('export const WAYSTONES'), src.indexOf('];', src.indexOf('export const WAYSTONES')));
const stones = [...block.matchAll(/id: '([a-z]+)'.*?x: (-?[\d.]+), z: (-?[\d.]+)/g)].map((m) => ({ id: m[1], x: Number(m[2]), z: Number(m[3]) }));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(400000);
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&norender&at=8,52,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  const out = await page.evaluate((stones) => {
    const g = window.__game;
    const cw = g.world.collision;
    const pl = g.player;
    return stones.map((s) => {
      pl.place(s.x, s.z);
      const y = pl.pos.y;
      const inside = cw.blockedAt(s.x, s.z, pl.radius, y + pl.step * 0.9, y + pl.height);
      const water = g.world.waterAt(s.x, s.z) - y;
      let free = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const m = cw.tryMove(s.x, s.z, y, s.x + Math.cos(a) * 0.6, s.z + Math.sin(a) * 0.6, pl.radius, pl.step, pl.height);
        if (m && Math.hypot(m.x - s.x, m.z - s.z) > 0.3) free++;
      }
      // nearest panel (for the fast-travel arrival view)
      let near = 1e9;
      for (const p of g.pm.panels) near = Math.min(near, Math.hypot(p.view.root.position.x - s.x, p.view.root.position.z - s.z));
      return { id: s.id, y: +y.toFixed(2), inside, water: +water.toFixed(2), free, nearPanel: +near.toFixed(1) };
    });
  }, stones);
  let bad = 0;
  for (const r of out) {
    const fail = r.inside || r.water > 0.3 || r.free < 5 || r.nearPanel < 1.2;
    if (fail) bad++;
    console.log(`${fail ? 'FAIL' : 'ok  '} ${r.id.padEnd(9)} y=${r.y} inside=${r.inside} water=${r.water} free=${r.free}/8 nearestPanel=${r.nearPanel}m`);
  }
  console.log(bad ? `WAYSTONES: ${bad} problem(s)` : `WAYSTONES: all ${out.length} safe`);
  await browser.close();
})().catch((e) => { console.log('waystones crashed:', e.message.split('\n')[0]); process.exit(1); });
