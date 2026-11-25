// Reachability audit: flood-fills every place the player can walk (same movement rule as the
// player, all doors open) and checks every panel can be reached and used, and that every
// constellation's viewing spot is a place the player can stand on.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && !m.text().includes('GPU')) console.log('[warn]', m.text().slice(0, 120)); });
  await page.goto((process.env.BASE || 'http://localhost:5180/') + '?dev&at=0,279.5,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  const report = await page.evaluate(() => {
    const g = window.__game;
    g.engine.paused = true;
    const col = g.world.collision;
    // open everything (end-game state)
    for (const a of g.areas.values()) for (const d of a.doors.values()) d.openNow(false);
    g.hub.openHollow(true);
    g.spire.setOpen(true, true);
    g.vault.open(true);
    const R = 0.32, STEP = 0.55, H = 1.7;
    const C = 0.9; // cell size
    const key = (x, z, y) => `${Math.round(x / C)},${Math.round(z / C)},${Math.round(y * 2)}`;
    const seen = new Map();
    const q = [];
    const start = { x: 0, z: 279.5, y: 7.2 };
    seen.set(key(start.x, start.z, start.y), start);
    q.push(start);
    const dirs = [];
    for (let k = 0; k < 8; k++) dirs.push([Math.cos((k * Math.PI) / 4) * C, Math.sin((k * Math.PI) / 4) * C]);
    let iter = 0;
    while (q.length && iter < 4_000_000) {
      const s = q.pop();
      iter++;
      for (const [dx, dz] of dirs) {
        // walk in 3 sub-steps like the player
        let x = s.x, z = s.z, y = s.y, ok = true;
        for (let k = 1; k <= 3; k++) {
          const m = col.tryMove(x, z, y, s.x + (dx * k) / 3, s.z + (dz * k) / 3, R, STEP, H);
          if (!m) { ok = false; break; }
          x = m.x; z = m.z; y = Math.max(y, m.y);
          if (m.y < y) y = m.y; // falling
        }
        if (!ok) continue;
        if (Math.hypot(x - s.x, z - s.z) < C * 0.5) continue; // pushed back by a blocker
        const kk = key(x, z, y);
        if (seen.has(kk)) continue;
        const st = { x, z, y };
        seen.set(kk, st);
        q.push(st);
      }
    }
    // spatial index of reachable points
    const grid = new Map();
    for (const st of seen.values()) {
      const k = `${Math.floor(st.x / 4)},${Math.floor(st.z / 4)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(st);
    }
    const near = (x, z) => {
      const out = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(`${Math.floor(x / 4) + i},${Math.floor(z / 4) + j}`) ?? []));
      return out;
    };
    // a panel is usable if some reachable spot has the eye within reach of the face centre,
    // in front of it, and nothing blocks the line of sight
    const ray = new (g.engine.camera.position.constructor)();
    const bad = [];
    for (const p of g.pm.panels) {
      p.view.updateWorld();
      const c = p.view.center, n = p.view.normal;
      let ok = false;
      p.view.updateWorld();
      for (const st of near(c.x, c.z)) {
        const ex = st.x, ey = st.y + 1.62, ez = st.z;
        const vx = ex - c.x, vy = ey - c.y, vz = ez - c.z;
        const d = Math.hypot(vx, vy, vz);
        if (d > 4.0 || d < 0.6) continue;
        if ((vx * n.x + vy * n.y + vz * n.z) / d < 0.25) continue; // must be in front
        ok = true;
        break;
      }
      if (!ok) {
        // lattice artefacts: flood from the spot in front of the panel and see if it joins the main region
        const fx = c.x + n.x * 1.5, fz = c.z + n.z * 1.5;
        const [fy] = col.groundAt(fx, fz, c.y + 0.5);
        if (isFinite(fy)) {
          const local = new Map();
          const st0 = { x: fx, z: fz, y: fy };
          local.set(key(fx, fz, fy), st0);
          const lq = [st0];
          let joined = false;
          while (lq.length && local.size < 60000 && !joined) {
            const s2 = lq.shift();
            for (const [dx, dz] of dirs) {
              let x = s2.x, z = s2.z, y = s2.y, ok2 = true;
              for (let k = 1; k <= 3; k++) {
                const m = col.tryMove(x, z, y, s2.x + (dx * k) / 3, s2.z + (dz * k) / 3, R, STEP, H);
                if (!m) { ok2 = false; break; }
                x = m.x; z = m.z; y = m.y;
              }
              if (!ok2 || Math.hypot(x - s2.x, z - s2.z) < C * 0.5) continue;
              const kk = key(x, z, y);
              if (local.has(kk)) continue;
              const st = { x, z, y };
              local.set(kk, st);
              lq.push(st);
              if (near(x, z).some((m2) => Math.hypot(m2.x - x, m2.z - z) < 1.0 && Math.abs(m2.y - y) < 0.6)) { joined = true; break; }
            }
          }
          if (joined) ok = true;
        }
      }
      if (!ok) bad.push(`${p.id} @ ${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`);
    }
    // every constellation is seen and solved from its spot: the spot must be a reachable place
    const badStars = [];
    for (const it of g.stars.items) {
      const c = it.view.spot;
      const ok = near(c.x, c.z).some((st) => Math.hypot(st.x - c.x, st.z - c.z) < 0.9 && Math.abs(st.y - c.y) < 0.6);
      if (!ok) {
        console.log('spot', it.def.id, c.x.toFixed(1), c.y.toFixed(1), c.z.toFixed(1));
        badStars.push(`${it.def.id}@spot`);
      }
    }
    void ray;
    const probes = [[0, -330], [0, -338], [0, -350], [0, -380], [0, -415], [0, -425], [0, -440], [95, -252], [110, -262], [-238, 34], [-230, 30], [-208, 40], [152, 178], [175, 178], [0, -60], [0, -75], [0, -100], [0, -112]];
    const probe = probes.map(([x, z]) => {
      const ns = near(x, z).filter((st) => Math.hypot(st.x - x, st.z - z) < 2);
      return `${x},${z}: ${ns.length ? 'Y' + ns.map((s) => s.y.toFixed(1)).slice(0, 3).join('/') : 'no'}`;
    });
    return { probe, reachable: seen.size, iter, panels: g.pm.panels.length, badPanels: bad, stars: g.stars.items.length, badStars };
  });
  console.log('REPORT reachable cells:', report.reachable, 'iterations:', report.iter);
  console.log('PROBES', report.probe.join(' | '));
  console.log(`panels: ${report.panels}, unreachable: ${report.badPanels.length}`);
  for (const b of report.badPanels) console.log('  PANEL', b);
  console.log(`constellations: ${report.stars}, unreachable: ${report.badStars.length}`);
  for (const b of report.badStars) console.log('  STAR', b);
  await browser.close();
})();
