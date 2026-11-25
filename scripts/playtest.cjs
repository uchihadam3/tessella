// Automated playtest: solves panels in chain order using the verified solutions and checks
// that power, doors, totems and saves behave. Usage: node scripts/playtest.cjs <areas comma-list> [shot.png]
const { chromium } = require('playwright');
const fs = require('fs');
const sols = JSON.parse(fs.readFileSync('tests/fixtures/solutions.json', 'utf8'));
const areas = (process.argv[2] || 'prologue').split(',');
const shot = process.argv[3];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&norender&at=0,279.5,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(2000);
  for (const area of areas) {
    if (area === 'spire' || area === 'echo') {
      // gated areas: wait for the unlock set-piece to finish
      await page.waitForFunction((a) => a === 'spire' ? window.__game.save.flags.spireOpen : window.__game.save.flags.hollowOpen, area, { timeout: 120000 }).catch(() => console.log('gate flag timeout', area));
      await page.waitForTimeout(8000);
      await page.evaluate(() => { const g = window.__game; g.state = 'play'; g.player.frozen = false; g.pm.refreshPower(); });
    }
    const ids = await page.evaluate((a) => window.__game.pm.panels.filter((p) => p.area === a).map((p) => p.id), area);
    let solved = 0;
    for (let round = 0; round < ids.length + 2 && solved < ids.length; round++) {
      const res = await page.evaluate(({ a, sols }) => {
        const g = window.__game;
        const out = [];
        for (const p of g.pm.panels.filter((q) => q.area === a && !q.solved && q.powered)) {
          const s = sols.solutions?.[p.id] ?? sols[p.id];
          if (!s) { out.push(p.id + ':nosol'); continue; }
          // engage and submit through the real code path
          g.pm.engaged = p;
          for (let i = 0; i < p.state.length; i++) if (!p.def.cells[i].hole && p.def.cells[i].lock === undefined) p.state[i] = s[i] === '1' ? 1 : 0;
          p.view.setState(p.state);
          g.pm.submit();
          g.pm.engaged = null;
          out.push(p.id + (p.solved ? ':ok' : ':FAIL'));
        }
        // let cables finish instantly
        for (const p of g.pm.panels) if (p.solved) for (const c of p.cablesOut) c.flow(true);
        g.pm.refreshPower();
        return out;
      }, { a: area, sols });
      await page.waitForTimeout(300);
      solved = await page.evaluate((a) => window.__game.pm.panels.filter((p) => p.area === a && p.solved).length, area);
      if (res.some((r) => r.includes('FAIL') || r.includes('nosol'))) console.log(area, 'round', round, res.filter((r) => !r.endsWith(':ok')).join(' '));
    }
    const info = await page.evaluate((a) => {
      const g = window.__game;
      const ar = g.areas.get(a);
      return { total: ar?.panels.length, solved: ar?.panels.filter((p) => p.solved).length, totem: g.save.totems.includes(a), doors: ar ? [...ar.doors.entries()].map(([k, d]) => k + '=' + d.open) : [] };
    }, area);
    console.log(area, JSON.stringify(info));
  }
  await page.waitForTimeout(6000);
  const flags = await page.evaluate(() => ({ flags: window.__game.save.flags, totems: window.__game.save.totems, solvedTotal: window.__game.solvedCount() }));
  console.log('state', JSON.stringify(flags));
  if (shot) {
    await page.evaluate(() => { window.__game.engine.skipRender = false; });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: shot });
  }
  console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
  await browser.close();
})();
