// End-to-end test with real mouse and keyboard, the way a person plays:
// intro → menu → New game → walk with W → aim → click to engage the first panel → click the
// tiles of the solution → Space to submit → leave → pause menu → Save now → reload the page →
// Continue → the panel is still solved and the player is back where they were.
// Usage: BASE=http://localhost:5180/ node scripts/e2e.cjs [screenshot-prefix]
const { chromium } = require('playwright');
const fs = require('fs');
const sols = JSON.parse(fs.readFileSync('tests/fixtures/solutions.json', 'utf8'));
const BASE = process.env.BASE || 'http://localhost:5180/';
const shots = process.argv[2] || 'screenshots/e2e';
const results = [];
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  console.log(results[results.length - 1]);
  return cond;
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errors = [];
  // a real mouse click in the middle of an element (software rendering keeps the page busy, so no
  // Playwright post-click waits)
  const realClick = async (sel) => {
    const el = typeof sel === 'string' ? await page.waitForSelector(sel, { state: 'visible' }) : sel;
    const b = await el.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  const boot = async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
    await page.waitForTimeout(1200);
    await page.mouse.click(480, 300); // "click to begin"
    await page.waitForSelector('#menu.on', { timeout: 180000 });
    await page.waitForTimeout(1500);
  };
  const waitPlay = () => page.waitForFunction(() => window.__game.state === 'play' && !window.__game.pm.controllingCamera, null, { timeout: 120000 });

  // ── 1. intro → menu → new game ──
  await boot();
  await page.screenshot({ path: `${shots}-1-menu.png` });
  const menuTexts = await page.$$eval('#menu .menu-items button', (b) => b.map((x) => x.textContent));
  ok('menu in Portuguese', menuTexts.includes('Novo jogo'), menuTexts.join(' | '));
  await realClick('#menu .menu-items button:has-text("Novo jogo")');
  await page.waitForSelector('#slots.on .slotcard', { timeout: 30000 }).catch(() => {});
  const cards = await page.$$('.slotcard');
  ok('slot screen shows 3 slots', cards.length === 3, `${cards.length}`);
  await realClick(cards[0]);
  await waitPlay();
  await page.waitForTimeout(5000); // wake-up fade
  const start = await page.evaluate(() => ({ x: window.__game.player.pos.x, y: window.__game.player.pos.y, z: window.__game.player.pos.z }));
  ok('new game starts in the cave', Math.abs(start.z - 279.5) < 0.6 && Math.abs(start.x) < 0.6, JSON.stringify(start));
  await page.screenshot({ path: `${shots}-2-wake.png` });

  // ── 2. walk forward with W ──
  await page.keyboard.down('KeyW');
  const t0 = Date.now();
  let walked = null;
  while (Date.now() - t0 < 60000) {
    walked = await page.evaluate(() => ({ z: window.__game.player.pos.z, y: window.__game.player.pos.y }));
    if (walked.z > 280.9) break;
    await page.waitForTimeout(150);
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ x: window.__game.player.pos.x, y: window.__game.player.pos.y, z: window.__game.player.pos.z }));
  ok('W walks forward on the floor', after.z > 280.6 && Math.abs(after.y - start.y) < 0.3, JSON.stringify(after));

  // ── 3. look at the first panel and click to engage ──
  const pid = await page.evaluate(() => {
    const g = window.__game;
    const p = g.pm.panels.find((q) => q.area === 'prologue' && q.powered && !q.solved);
    const c = p.view.center;
    const e = g.engine.camera.position;
    const dx = c.x - e.x, dy = c.y - e.y, dz = c.z - e.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return p.id;
  });
  await page.waitForTimeout(1200);
  const aimed = await page.evaluate(() => window.__game.pm.aimed?.id ?? null);
  ok('crosshair finds the first panel', aimed === pid, `${aimed} vs ${pid}`);
  const ring = await page.$eval('#crosshair', (c) => c.classList.contains('ring'));
  ok('crosshair turns into a ring', ring);
  await page.mouse.click(480, 270);
  await page.waitForFunction(() => window.__game.pm.engaged && window.__game.pm.camT >= 1, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}-3-engaged.png` });
  ok('click engages the panel', await page.evaluate(() => !!window.__game.pm.engaged));

  // ── 4. a wrong submit blinks, then click the solution tiles ──
  const sol = sols.solutions?.[pid] ?? sols[pid];
  const targets = await page.evaluate((sol) => {
    const g = window.__game;
    const p = g.pm.engaged;
    const v = p.view;
    const L = v.layout;
    const V = g.engine.camera.position.constructor;
    const rect = g.engine.renderer.domElement.getBoundingClientRect();
    const out = [];
    for (let i = 0; i < p.state.length; i++) {
      if (p.def.cells[i].hole || p.def.cells[i].lock !== undefined) continue;
      if ((p.state[i] ? '1' : '0') === sol[i]) continue;
      const r = Math.floor(i / p.def.w), c = i % p.def.w;
      const w = v.face.localToWorld(new V(((L.gx + c + 0.5) / L.W - 0.5) * v.faceW, (0.5 - (L.gy + r + 0.5) / L.H) * v.faceH, 0));
      w.project(g.engine.camera);
      out.push([i, rect.left + ((w.x + 1) / 2) * rect.width, rect.top + ((1 - w.y) / 2) * rect.height]);
    }
    return out;
  }, sol);
  ok('solution tiles are on screen', targets.length > 0 && targets.every(([, x, y]) => x > 0 && x < 960 && y > 0 && y < 540), `${targets.length} tiles`);
  // submitting an empty board must fail (no glyph satisfied) without solving
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  ok('wrong answer is rejected', await page.evaluate(() => !window.__game.pm.engaged.solved));
  for (const [, x, y] of targets) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
  }
  const state = await page.evaluate(() => window.__game.pm.engaged.state.map((s) => (s ? '1' : '0')).join(''));
  ok('mouse clicks light exactly the intended tiles', state === sol, `${state} vs ${sol}`);
  await page.screenshot({ path: `${shots}-4-lit.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  ok('Space submits and solves', await page.evaluate((id) => window.__game.pm.panels.find((p) => p.id === id).solved, pid));
  await page.screenshot({ path: `${shots}-5-solved.png` });
  await waitPlay();
  ok('player steps back from the panel', await page.evaluate(() => !window.__game.pm.engaged));
  const next = await page.evaluate((id) => {
    const ps = window.__game.pm.panels.filter((p) => p.area === 'prologue');
    const i = ps.findIndex((p) => p.id === id);
    return ps[i + 1] ? { id: ps[i + 1].id, powered: ps[i + 1].powered } : null;
  }, pid);
  // the cable travels at 9 m/s of game time (slow software rendering stretches that in wall time)
  const nextPowered = await page.waitForFunction((id) => window.__game.pm.panels.find((p) => p.id === id)?.powered, next?.id, { timeout: 90000 }).then(() => true).catch(() => false);
  ok('the cable powers the next panel', !!nextPowered, JSON.stringify(next));

  // ── 5. pause menu + manual save ──
  const pos = await page.evaluate(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const paused = await page.evaluate(() => window.__game.state);
  ok('Esc opens the pause menu', paused === 'pause', paused);
  await page.screenshot({ path: `${shots}-6-pause.png` });
  const saveBtn = await page.$('button:has-text("Salvar agora")');
  if (saveBtn) await realClick(saveBtn);
  await page.waitForTimeout(600);
  const stored = await page.evaluate((id) => {
    const keys = Object.keys(localStorage).filter((k) => k.includes('tessella'));
    const blobs = keys.map((k) => localStorage.getItem(k) || '');
    return { keys, has: blobs.some((b) => b.includes(id)) };
  }, pid);
  ok('save is written to localStorage', stored.has, stored.keys.join(','));

  // ── 6. reload → Continue ──
  await boot();
  const cont = await page.$('#menu .menu-items button:has-text("Continuar")');
  ok('menu offers Continue after reload', !!cont);
  if (cont) {
    await realClick(cont);
    await waitPlay();
    await page.waitForTimeout(2500);
    const back = await page.evaluate((id) => ({
      solved: window.__game.pm.panels.find((p) => p.id === id).solved,
      x: window.__game.player.pos.x,
      z: window.__game.player.pos.z,
    }), pid);
    ok('solved panel is restored', back.solved);
    ok('player is restored where they saved', Math.hypot(back.x - pos.x, back.z - pos.z) < 1.0, JSON.stringify({ back, pos }));
    await page.screenshot({ path: `${shots}-7-continued.png` });
  }

  ok('no page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  console.log(results.filter((r) => r.startsWith('FAIL')).length ? 'E2E: FAILURES' : 'E2E: ALL PASS');
  await browser.close();
})().catch((e) => {
  console.log('E2E crashed:', e.message);
  process.exit(1);
});
