// Finds the places of all constellation pictures once (thousands of lines of sight, a couple of
// minutes) and saves them in src/data/constellation-places.json, so the game only has to build
// them. The file carries a signature of the island; if the island changes, the game notices and
// searches again by itself in the background — run this tool again and rebuild to make it fast.
// Usage: BASE=http://localhost:5180/ node scripts/place-constellations.cjs  (QUICK=1: fewer tries; ONLY=ids; OUT=file)
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.env.OUT || 'src/data/constellation-places.json';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(1800000);
  const notPlaced = [];
  page.on('console', (m) => { if (/not placed/.test(m.text())) notPlaced.push(m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t0 = Date.now();
  // ONLY=id,id… places just those (a quick look at why some do not fit; write OUT elsewhere then)
  const only = process.env.ONLY ? `&starsOnly=${process.env.ONLY}` : '';
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&norender&starsCompute' + (process.env.QUICK ? '&starsQuick' : '') + (process.env.HOME_ONLY ? '&starsHome' : '') + only + '&at=8,52,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  await page.evaluate(() => window.__game.stars.placeAll());
  const res = await page.evaluate(() => {
    const st = window.__game.stars;
    const kinds = {};
    for (const it of st.items) for (const [k, v] of Object.entries(it.drawnOn)) kinds[k] = (kinds[k] || 0) + v;
    const sh = [...st.shifts].sort((a, b) => a - b);
    const q = (f) => sh.length ? sh[Math.min(sh.length - 1, Math.floor(f * sh.length))].toFixed(2) : '-';
    return { why: st.why, json: st.exportPlaces(), placed: st.items.length, total: st.total, kinds, shifts: `min ${q(0)} p25 ${q(0.25)} median ${q(0.5)} p75 ${q(0.75)}` };
  });
  const rec = JSON.parse(res.json);
  fs.writeFileSync(out, JSON.stringify(rec) + '\n');
  console.log(`placed ${res.placed}/${res.total} in ${((Date.now() - t0) / 1000).toFixed(0)}s | signature ${rec.signature} | drawn on ${JSON.stringify(res.kinds)}`);
  console.log(`decoys: ${Object.values(rec.decoys).reduce((a, l) => a + l.length, 0)} | file ${(fs.statSync(out).size / 1024).toFixed(0)} KB | shape change from aside: ${res.shifts}`);
  console.log('turned down:', JSON.stringify(Object.entries(res.why).sort((a, b) => b[1] - a[1])));
  if (notPlaced.length) console.log('NOT PLACED:', notPlaced.length, notPlaced.map((t) => t.split(' ').pop()).join(' '));
  await browser.close();
  process.exit(res.placed === res.total ? 0 : 1);
})().catch((e) => { console.log('place-constellations crashed:', e.message.split('\n')[0]); process.exit(1); });
