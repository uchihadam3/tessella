// Finds the places of all constellation pictures once (thousands of lines of sight, a couple of
// minutes) and saves them in src/data/constellation-places.json, so the game only has to build
// them. The file carries a signature of the island; if the island changes, the game notices and
// searches again by itself in the background — run this tool again and rebuild to make it fast.
// Usage: BASE=http://localhost:5180/ node scripts/place-constellations.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const out = 'src/data/constellation-places.json';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(1800000);
  const notPlaced = [];
  page.on('console', (m) => { if (/not placed/.test(m.text())) notPlaced.push(m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t0 = Date.now();
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&norender&starsCompute&at=8,52,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  await page.evaluate(() => window.__game.stars.placeAll());
  const res = await page.evaluate(() => {
    const st = window.__game.stars;
    const kinds = {};
    for (const it of st.items) for (const [k, v] of Object.entries(it.drawnOn)) kinds[k] = (kinds[k] || 0) + v;
    return { json: st.exportPlaces(), placed: st.items.length, total: st.total, kinds };
  });
  const rec = JSON.parse(res.json);
  fs.writeFileSync(out, JSON.stringify(rec) + '\n');
  console.log(`placed ${res.placed}/${res.total} in ${((Date.now() - t0) / 1000).toFixed(0)}s | signature ${rec.signature} | drawn on ${JSON.stringify(res.kinds)}`);
  console.log(`decoys: ${Object.values(rec.decoys).reduce((a, l) => a + l.length, 0)} | file ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  if (notPlaced.length) console.log('NOT PLACED:', notPlaced.join(' | '));
  await browser.close();
  process.exit(res.placed === res.total ? 0 : 1);
})().catch((e) => { console.log('place-constellations crashed:', e.message.split('\n')[0]); process.exit(1); });
