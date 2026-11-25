// Phone test (touch emulation, landscape): tap to begin → menu (with "Install") → New game →
// left-thumb walk → right-thumb look → tap the first panel → tap its tile → tap the Seal → tap the
// next panel → tap off the panel to leave → pause emblem opens the menu.
// Usage: BASE=http://localhost:5180/ node scripts/mobile-e2e.cjs [screenshot-prefix]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const sols = JSON.parse(fs.readFileSync('tests/fixtures/solutions.json', 'utf8'));
const BASE = process.env.BASE || 'http://localhost:5180/';
const shots = process.argv[2] || 'screenshots/mobile';
const results = [];
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  console.log(results[results.length - 1]);
  return cond;
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const phone = devices['Pixel 7 landscape'] || { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 };
  const ctx = await browser.newContext({ ...phone, deviceScaleFactor: 1, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push(t.slice(0, 200));
    if (/context|webgl|reload|fullscreen|orientation/i.test(t) && !/GPU stall/.test(t)) console.log('[console]', t.slice(0, 200));
  });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('[navigated]', f.url()); });
  page.on('crash', () => console.log('[page crashed]'));
  const W = page.viewportSize().width, H = page.viewportSize().height;

  // timestamps say when the finger moved, as a real device does (software rendering delays handling)
  const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: ts ?? Date.now() / 1000, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
  const tap = async (x, y) => {
    const t0 = Date.now() / 1000;
    await touch('touchStart', [[x, y]], t0);
    await touch('touchEnd', [], t0 + 0.08);
  };
  const tapEl = async (sel) => {
    const el = typeof sel === 'string' ? await page.waitForSelector(sel, { state: 'visible' }) : sel;
    const b = await el.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  // hold a finger and slide it from a to b, keeping it down for `holdMs`
  const drag = async (ax, ay, bx, by, holdMs) => {
    await touch('touchStart', [[ax, ay]]);
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', [[ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps]]);
      await page.waitForTimeout(40);
    }
    const t0 = Date.now();
    while (Date.now() - t0 < holdMs) {
      await touch('touchMove', [[bx + (Math.random() - 0.5) * 0.5, by]]);
      await page.waitForTimeout(200);
    }
    await touch('touchEnd', []);
  };
  const project = (fnBody, arg) => page.evaluate(fnBody, arg);

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(1000);
  const gateText = await page.$eval('#gate p', (p) => p.textContent);
  ok('gate says "Toque para começar"', gateText === 'Toque para começar', gateText);
  await page.screenshot({ path: `${shots}-0-gate.png` });
  await tap(W / 2, H / 2);
  await page.waitForSelector('#menu.on', { timeout: 180000 });
  await page.waitForTimeout(1500);
  const items = await page.$$eval('#menu .menu-items button', (b) => b.map((x) => x.textContent));
  ok('menu offers "Instalar o jogo"', items.includes('Instalar o jogo'), items.join(' | '));
  const lastBottom = await page.$eval('#menu .menu-items button:last-child', (b) => b.getBoundingClientRect().bottom);
  ok('whole menu fits on a phone screen', lastBottom <= H, `${Math.round(lastBottom)} <= ${H}`);
  await page.screenshot({ path: `${shots}-1-menu.png` });
  const quality = await page.evaluate(() => window.__game.settings.quality);
  ok('phones start on medium quality', quality === 'medium', quality);

  await tapEl('#menu .menu-items button:has-text("Novo jogo")');
  await page.waitForSelector('#slots.on .slotcard');
  await tapEl((await page.$$('.slotcard'))[0]);
  await page.waitForFunction(() => window.__game.state === 'play' && !window.__game.pm.controllingCamera);
  await page.waitForTimeout(5000);
  ok('touch layout on (no keyboard hints)', await page.evaluate(() => document.getElementById('ui').classList.contains('touch')));
  ok('pause emblem visible while exploring', await page.$eval('#tpause', (b) => b.classList.contains('on') && getComputedStyle(b).opacity !== '0'));
  await page.screenshot({ path: `${shots}-2-play.png` });

  // ── walk with the left thumb (push up = forward) ──
  const z0 = await page.evaluate(() => window.__game.player.pos.z);
  await drag(W * 0.18, H * 0.7, W * 0.18, H * 0.7 - 40, 4500);
  await page.waitForTimeout(600);
  const z1 = await page.evaluate(() => window.__game.player.pos.z);
  ok('left thumb walks forward', z1 - z0 > 0.4, `${z0.toFixed(2)} → ${z1.toFixed(2)}`);

  // ── look with the right thumb ──
  const yaw0 = await page.evaluate(() => window.__game.player.yaw);
  await drag(W * 0.75, H * 0.5, W * 0.75 - 90, H * 0.5, 300);
  await page.waitForTimeout(500);
  const yaw1 = await page.evaluate(() => window.__game.player.yaw);
  ok('right thumb turns the camera', Math.abs(yaw1 - yaw0) > 0.05, `${yaw0.toFixed(2)} → ${yaw1.toFixed(2)}`);
  // face the first panel again
  const pid = await page.evaluate(() => {
    const g = window.__game;
    const p = g.pm.panels.find((q) => q.area === 'prologue' && q.powered && !q.solved);
    const c = p.view.center, e = g.engine.camera.position;
    g.player.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z));
    g.player.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
    return p.id;
  });
  await page.waitForTimeout(1200);

  // ── tap the panel where it is on screen ──
  const centerOf = () => project((id) => {
    const g = window.__game;
    const p = g.pm.panels.find((q) => q.id === id);
    const v = p.view.center.clone().project(g.engine.camera);
    const r = g.engine.renderer.domElement.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  }, pid);
  const [px, py] = await centerOf();
  await tap(px, py);
  await page.waitForFunction(() => window.__game.pm.engaged && !window.__game.pm.tweening, null, { timeout: 60000 }).catch(() => {});
  ok('tapping a panel uses it', await page.evaluate((id) => window.__game.pm.engaged?.id === id, pid));
  const btns = await page.$$eval('#engage-hint .tb', (b) => b.map((x) => x.textContent));
  ok('only three quiet glyphs while in a panel', btns.join('') === '↺⟲✕', btns.join(' '));

  // ── tap the tiles of the solution, then the Seal ──
  const sol = sols.solutions?.[pid] ?? sols[pid];
  const pts = await page.evaluate((sol) => {
    const g = window.__game;
    const p = g.pm.engaged, v = p.view, L = v.layout;
    const V = g.engine.camera.position.constructor;
    const r = g.engine.renderer.domElement.getBoundingClientRect();
    const scr = (lx, ly) => {
      const w = v.face.localToWorld(new V(lx, ly, 0)).project(g.engine.camera);
      return [r.left + ((w.x + 1) / 2) * r.width, r.top + ((1 - w.y) / 2) * r.height];
    };
    const tiles = [];
    for (let i = 0; i < p.state.length; i++) {
      if ((p.state[i] ? '1' : '0') === sol[i]) continue;
      const row = Math.floor(i / p.def.w), c = i % p.def.w;
      tiles.push(scr(((L.gx + c + 0.5) / L.W - 0.5) * v.faceW, (0.5 - (L.gy + row + 0.5) / L.H) * v.faceH));
    }
    const seal = scr((L.sealX / L.W - 0.5) * v.faceW, (0.5 - L.sealY / L.H) * v.faceH);
    return { tiles, seal };
  }, sol);
  for (const [x, y] of pts.tiles) {
    await tap(x, y);
    await page.waitForTimeout(250);
  }
  const state = await page.evaluate(() => window.__game.pm.engaged.state.map((s) => (s ? '1' : '0')).join(''));
  ok('tapping tiles lights them', state === sol, `${state} vs ${sol}`);
  await page.screenshot({ path: `${shots}-3-panel.png` });
  await tap(pts.seal[0], pts.seal[1]);
  await page.waitForTimeout(800);
  ok('tapping the Seal confirms', await page.evaluate((id) => window.__game.pm.panels.find((p) => p.id === id).solved, pid));
  await page.waitForFunction(() => window.__game.state === 'play' && !window.__game.pm.engaged && !window.__game.pm.controllingCamera);

  // ── next panel: tap it, then tap off the panel to leave ──
  const next = await page.evaluate((id) => {
    const ps = window.__game.pm.panels.filter((p) => p.area === 'prologue');
    return ps[ps.findIndex((p) => p.id === id) + 1]?.id;
  }, pid);
  await page.waitForFunction((id) => window.__game.pm.panels.find((p) => p.id === id)?.powered, next, { timeout: 90000 }).catch(() => {});
  await page.evaluate((id) => {
    const g = window.__game;
    const p = g.pm.panels.find((q) => q.id === id);
    const c = p.view.center;
    // stand two metres in front of it
    const n = p.view.normal ?? { x: 0, z: -1 };
    g.teleport(c.x + (n.x ?? 0) * 2.2, c.z + (n.z ?? -1) * 2.2);
    const e = g.engine.camera.position;
    g.player.update(0.016);
    g.player.applyCamera(g.engine.camera);
    g.player.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z));
    g.player.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
  }, next);
  await page.waitForTimeout(1500);
  const [nx, ny] = await project((id) => {
    const g = window.__game;
    const p = g.pm.panels.find((q) => q.id === id);
    const v = p.view.center.clone().project(g.engine.camera);
    const r = g.engine.renderer.domElement.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  }, next);
  await tap(nx, ny);
  await page.waitForFunction(() => window.__game.pm.engaged && !window.__game.pm.tweening, null, { timeout: 60000 }).catch(() => {});
  ok('tapping the next panel uses it', await page.evaluate((id) => window.__game.pm.engaged?.id === id, next), next);
  await tap(W * 0.06, H * 0.12); // far corner, off the panel
  await page.waitForFunction(() => !window.__game.pm.engaged && !window.__game.pm.controllingCamera, null, { timeout: 60000 }).catch(() => {});
  ok('tapping off the panel leaves it', await page.evaluate(() => !window.__game.pm.engaged));

  // ── the pause emblem ──
  await page.waitForTimeout(600);
  await tapEl('#tpause');
  await page.waitForTimeout(900);
  ok('pause emblem opens the menu', (await page.evaluate(() => window.__game.state)) === 'pause');
  await page.screenshot({ path: `${shots}-4-pause.png` });

  ok('no page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  console.log(results.some((r) => r.startsWith('FAIL')) ? 'MOBILE: FAILURES' : 'MOBILE: ALL PASS');
  await browser.close();
})().catch((e) => {
  console.log('MOBILE crashed:', e.message.split('\n')[0]);
  process.exit(1);
});
