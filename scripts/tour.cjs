// Photo tour: loads the game once and visits a list of viewpoints, saving a screenshot at each.
// Usage: BASE=http://localhost:5180/ node scripts/tour.cjs <outDir> [scale]
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || 'screenshots/tour';
const scale = Number(process.argv[3] || 2);
const BASE = process.env.BASE || 'http://localhost:5180/';
fs.mkdirSync(out, { recursive: true });

// [name, kind, ...] — 'stand': x, z, lookX, lookZ, pitchDeg, skyProgress
//                    'fly':   x, y, z, lookX, lookY, lookZ, skyProgress
const SPOTS = [
  ['01-ilha', 'fly', 330, 150, 330, 0, 20, -60, 0.55],
  ['02-caverna-despertar', 'stand', 0, 279.5, 0, 284, -12, 0.05],
  ['03-patio', 'stand', 8, 52, 0, 16, 2, 0.3],
  ['04-bosque-outonal', 'stand', -184, -98, -205, -118, 0, 0.35],
  ['05-terracos', 'stand', 184, -98, 205, -118, 0, 0.35],
  ['06-pedreira', 'stand', 76, -238, 98, -252, 2, 0.45],
  ['07-jardim-de-sebes', 'stand', -132, 160, -152, 178, 0, 0.4],
  ['08-templo-das-areias', 'stand', 132, 160, 152, 178, 2, 0.55],
  ['09-penhascos', 'stand', 256, 50, 286, 44, 0, 0.6],
  ['10-vale-dos-moinhos', 'stand', -76, -238, -98, -252, 2, 0.5],
  ['11-lago-espelhado', 'stand', -206, 40, -238, 34, 0, 0.65],
  ['12-cidadela', 'fly', 40, 70, -380, 0, 30, -470, 0.75],
  ['13-caldeira', 'fly', 120, 120, -40, 0, 20, -112, 0.8],
];

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '?dev&at=8,52,180,0', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true && window.__game?.state === 'play', null, { timeout: 400000 });
  await page.evaluate(() => {
    document.getElementById('crosshair')?.classList.add('hidden');
    for (const id of ['hud', 'toasts', 'area-title']) { const e = document.getElementById(id); if (e) e.style.opacity = '0'; }
  });
  for (const [name, kind, ...a] of SPOTS) {
    const t0 = Date.now();
    await page.evaluate(({ kind, a }) => {
      const g = window.__game;
      if (kind === 'stand') {
        const [x, z, tx, tz, pd, p] = a;
        g.state = 'play';
        g.teleport(x, z, Math.atan2(-(tx - x), -(tz - z)));
        g.player.pitch = (pd * Math.PI) / 180;
      } else {
        const [x, y, z, tx, ty, tz, p] = a;
        g.state = 'pause';
        g.engine.camera.position.set(x, y, z);
        g.engine.camera.lookAt(tx, ty, tz);
      }
      window.__setSky(a[a.length - 1]);
    }, { kind, a });
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch((e) => { console.log('tour crashed:', e.message); process.exit(1); });
