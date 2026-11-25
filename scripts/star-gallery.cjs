// Pictures of a few constellations in different places: from a few steps aside (nothing to see),
// from the spot while the vision is forming, and revealed.
// Usage: BASE=http://localhost:5180/ node scripts/star-gallery.cjs <outDir> [areas comma-list]
const { chromium } = require('playwright');
const fs = require('fs');
const outDir = process.argv[2] || 'screenshots/stars';
const areas = (process.argv[3] || 'kinship,mosaic,citadel,twins').split(',');
fs.mkdirSync(outDir, { recursive: true });
// one tall picture per figure (easy to read on a phone): aside, at the spot unlit, lit
async function sheet(browser, name, info) {
  const img = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const rows = [
    [`${name}-1-de-lado.png`, 'Alguns passos ao lado: só cenário'],
    [`${name}-2-apagada.png`, 'No ponto exato, olhando na direção certa: o próprio cenário forma o desenho'],
    [`${name}-4-acesa.png`, 'Depois de ficar parado olhando: a figura acende'],
  ];
  const html = `<html><body style="margin:0;background:#14110e;font:600 26px Georgia,serif;color:#f1e6d2">
    <div style="padding:18px 24px 6px">${info.pt || info.en} <span style="opacity:.55;font-weight:400">· ${info.area}</span></div>
    ${rows.map(([f, cap]) => `<div style="padding:8px 24px 0;font:400 21px Georgia,serif;opacity:.85">${cap}</div><img src="${img(f)}" style="display:block;width:1232px;margin:6px 24px 14px;border-radius:6px">`).join('')}
  </body></html>`;
  const p = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  await p.setContent(html);
  await p.screenshot({ path: `${name}-sheet.png`, fullPage: true });
  await p.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(600000);
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&at=8,52,180,0&p=0.45', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play');
  await page.evaluate(() => window.__game.stars.placeAll());
  await page.evaluate(() => {
    document.getElementById('crosshair')?.classList.add('hidden');
    const st = document.createElement('style');
    st.textContent = '#crosshair{display:none!important}';
    document.head.appendChild(st);
    for (const id of ['area-title', 'toasts']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  });
  const picks = await page.evaluate((areas) => {
    const items = window.__game.stars.items;
    // names (e.g. "Owl,Whale") pick those figures; area ids pick a big one from each area;
    // "auto" picks a varied set: drawn mostly on walls, on trees, with a cloud, on rocks, on paving
    if (areas[0] === 'auto') {
      const used = new Set(), areasUsed = new Set(), out = [];
      const share = (it, k) => { const tot = Object.values(it.drawnOn).reduce((a, b) => a + b, 0) || 1; return (it.drawnOn[k] || 0) / tot; };
      for (const k of ['wall', 'tree', 'sky', 'rock', 'floor', 'ground']) {
        const cands = items.map((it, i) => ({ it, i })).filter(({ it, i }) => !used.has(i) && !areasUsed.has(it.area) && it.def.stars.length >= 5);
        cands.sort((a, b) => share(b.it, k) - share(a.it, k));
        if (cands.length) { used.add(cands[0].i); areasUsed.add(cands[0].it.area); out.push(cands[0].i); }
      }
      return out;
    }
    if (areas.some((a) => /[A-Z]/.test(a))) return areas.map((n) => items.findIndex((it) => it.def.name?.en === n)).filter((i) => i >= 0);
    return areas.map((a) => {
      const cands = items.map((it, i) => ({ it, i })).filter(({ it }) => it.area === a && it.def.stars.length >= 5);
      cands.sort((x, y) => {
        const score = ({ it }) => it.def.stars.length;
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
      return { id: it.def.id, en: it.def.name?.en, pt: it.def.name?.pt, area: it.area, n: it.def.stars.length, drawnOn: it.drawnOn, dists: it.starPos.map((p) => p.distanceTo(it.view.eye).toFixed(0)).join(',') };
    }, { idx, dx, dz });
    const info = await place(2.6, -2.2);
    console.log('figure', JSON.stringify(info));
    const name = `${outDir}/${info.area}-${info.id.split('.').pop()}-${(info.en || '').toLowerCase().replace(/[^a-z]+/g, '-')}`;
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${name}-1-de-lado.png` });
    await place(0, 0);
    // hold each stage of the vision still while it is photographed
    await page.evaluate((idx) => { const st = window.__game.stars; st.holdPaused = true; st.items[idx].hold = 0; st.items[idx].dirty = true; }, idx);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${name}-2-apagada.png` });
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; it.hold = 0.6; it.dirty = true; }, idx);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${name}-3-acendendo.png` });
    await page.evaluate(() => { window.__game.stars.holdPaused = false; });
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; it.hold = 0.999; }, idx);
    await page.waitForFunction((idx) => window.__game.stars.items[idx].revealed && window.__game.stars.items[idx].reveal >= 1, idx);
    // light a couple of objects so the picture shows what lit ones look like
    await page.evaluate((idx) => { const it = window.__game.stars.items[idx]; for (let i = 0; i < it.state.length; i += 2) if (it.def.stars[i].lock === undefined) it.state[i] = 1; it.dirty = true; }, idx);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${name}-4-acesa.png` });
    await sheet(browser, name, info);
    console.log('shots', name);
  }
  await browser.close();
})().catch((e) => { console.log('gallery crashed:', e.message.split('\n')[0]); process.exit(1); });
