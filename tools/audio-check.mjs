#!/usr/bin/env node
/**
 * Automated audio check: starts a Vite dev server, opens the audio lab in headless Chromium,
 * triggers every music cue / sound effect / ambience layer / positional source and verifies:
 *   - output is not silent, - no NaN, - peak < 0.99, - no page errors or [audio] warnings.
 * Usage: node tools/audio-check.mjs [--quick]
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5174;
const URL = `http://localhost:${PORT}/tools/audio-lab.html`;
const quick = process.argv.includes('--quick');

const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
const killServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    try {
      server.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
};
process.on('exit', killServer);
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await sleep(250);
  }
  throw new Error('vite did not start:\n' + serverLog);
}

const results = [];
const errors = [];
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || t.includes('[audio]')) errors.push(`${m.type()}: ${t}`);
  });
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__lab);
  // ── startup latency: unlock must be fast, first sounds must start immediately, no long tasks ──
  const startup = await page.evaluate(async () => {
    const long = [];
    const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
    obs.observe({ entryTypes: ['longtask'] });
    const t0 = performance.now();
    await window.__lab.audio.unlock();
    const unlockMs = performance.now() - t0;
    window.__lab.reset();
    window.__lab.audio.studioSting();
    await new Promise((r) => setTimeout(r, 150));
    const sting = window.__lab.read().peak;
    window.__lab.audio.setMusic('menu', 0.5);
    for (let i = 0; i < 9; i++) setTimeout(() => window.__lab.audio.titleTile(i), 100 + i * 150);
    setTimeout(() => window.__lab.audio.titleResolve(), 1600);
    await new Promise((r) => setTimeout(r, 3000));
    obs.disconnect();
    return { unlockMs: Math.round(unlockMs), stingPeakAt150ms: sting, longTasks: long, ready: window.__lab.audio.ready };
  });
  console.log('startup', JSON.stringify(startup));
  if (startup.unlockMs > 250) errors.push(`unlock took ${startup.unlockMs} ms`);
  if (startup.stingPeakAt150ms < 0.002) errors.push('studio sting silent 150 ms after unlock');
  if (startup.longTasks.some((d) => d > 120)) errors.push(`long main-thread tasks after unlock: ${startup.longTasks.join(', ')} ms`);
  await page.waitForFunction(() => window.__lab && window.__lab.audio.ready, null, { timeout: 15000 });

  const ev = (code) => page.evaluate(code);
  const measure = async (name, code, ms, kind = 'sfx') => {
    await ev('__lab.reset()');
    const t0 = Date.now();
    await ev(code);
    await sleep(ms);
    const r = await ev('__lab.read()');
    results.push({ name, kind, ...r, ms: Date.now() - t0 });
    process.stdout.write(`  ${name.padEnd(26)} peak ${r.peak.toFixed(3)}  rms ${(20 * Math.log10(r.rms + 1e-9)).toFixed(1)} dB\n`);
  };
  const silence = async (ms = 2500) => {
    await ev(`__lab.audio.setMusic('silence', 0.05); __lab.audio.setAmbience({});`);
    await sleep(ms);
  };

  console.log('music');
  const cues = ['menu', 'prologue', 'hub', 'kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins', 'citadel', 'echo', 'spire'];
  const musicMs = quick ? 6000 : 9000;
  for (const cue of cues) {
    await silence(3000);
    await measure(`music:${cue}`, `__lab.audio.setMusic('${cue}', 0.3)`, musicMs, 'music');
  }
  await silence(3000);
  await ev(`__lab.audio.setProgress({ totems: 8, citadelDone: true, echoOpen: true, finale: true })`);
  await measure('music:hub(full)', `__lab.audio.setMusic('hub', 0.3)`, musicMs, 'music');
  await ev(`__lab.audio.setProgress({ totems: 0, citadelDone: false, echoOpen: false, finale: false })`);
  await silence(3000);
  await measure('music:ending', `__lab.audio.playEnding()`, quick ? 8000 : 14000, 'music');
  await silence(4000);
  await measure('music:secretEnding', `__lab.audio.playSecretEnding()`, quick ? 8000 : 14000, 'music');
  await silence(4000);

  console.log('sfx');
  const sfx = [
    ['studioSting', '__lab.audio.studioSting()', 6500],
    ['title', 'for (let i=0;i<9;i++) setTimeout(()=>__lab.audio.titleTile(i), i*300); setTimeout(()=>__lab.audio.titleResolve(), 3000)', 6000],
    ['tile', `for (let i=0;i<25;i++) setTimeout(()=>__lab.audio.tile(i%2===0, Math.floor(i/5), i%5, 5, 5, 'kinship'), i*30)`, 1500],
    ['panelEngage', '__lab.audio.panelEngage()', 800],
    ['panelLeave', '__lab.audio.panelLeave()', 800],
    ['panelSolved', `__lab.audio.panelSolved('measure', 0.3)`, 2000],
    ['panelSolved(big)', `__lab.audio.panelSolved('beacon', 1)`, 3000],
    ['panelFailed', '__lab.audio.panelFailed()', 1000],
    ['panelPowered', '__lab.audio.panelPowered()', 1600],
    ['cable', '__lab.audio.cable(2)', 2500],
    ['door:stone', `__lab.audio.door('stone')`, 3200],
    ['door:wood', `__lab.audio.door('wood')`, 2200],
    ['door:light', `__lab.audio.door('light')`, 2500],
    ['door:water', `__lab.audio.door('water')`, 2600],
    ['totem', `__lab.audio.totem('twins')`, 6000],
    ['greatUnlock', '__lab.audio.greatUnlock()', 9000],
    ['secretSolved', '__lab.audio.secretSolved()', 2000],
    ['uiHover', '__lab.audio.uiHover()', 400],
    ['uiClick', '__lab.audio.uiClick()', 500],
    ['uiBack', '__lab.audio.uiBack()', 500],
    ['achievement', '__lab.audio.achievement()', 1800],
    ['save', '__lab.audio.save()', 1000],
  ];
  for (const [name, code, ms] of sfx) {
    await sleep(600);
    await measure(name, code, ms);
  }
  for (const s of ['grass', 'stone', 'sand', 'wood', 'gravel', 'water', 'leaves', 'crystal', 'marble']) {
    await sleep(300);
    await measure(`step:${s}`, `for (let i=0;i<3;i++) setTimeout(()=>__lab.audio.footstep('${s}', 1), i*400)`, 1500);
  }

  console.log('ambience');
  for (const l of ['wind', 'sea', 'birds', 'stream', 'insects', 'cave', 'leaves', 'night', 'gulls', 'chimes']) {
    await silence(2500);
    await measure(`amb:${l}`, `__lab.audio.setAmbience({ ${l}: 1 })`, quick ? 6000 : 9000, 'amb');
  }
  await silence(2500);

  console.log('positional');
  await ev('__lab.audio.setListener(0, 1.6, 0, 0, 0, -1)');
  for (const k of ['waterfall', 'windmill', 'fountain', 'brook', 'surf', 'crystal', 'fire']) {
    await sleep(1500);
    await measure(`src:${k}`, `__lab.sources.push(__lab.audio.addSource('${k}', 2, 1, -4, 30))`, 4000, 'src');
    await ev('__lab.sources.forEach(s => s.stop()); __lab.sources = []');
  }

  // stress: drag across many tiles fast + music + ambience together
  await measure('stress', `__lab.audio.setMusic('hub', 0.5); __lab.audio.setAmbience({ wind: 0.6, birds: 0.6, chimes: 0.5 }); for (let i=0;i<120;i++) setTimeout(()=>__lab.audio.tile(i%2===0, i%7, i%7, 7, 7, 'hub'), i*12);`, 5000, 'stress');
  const voices = await ev('__lab.read().voices');
  console.log('voices after stress', JSON.stringify(voices));
} catch (e) {
  errors.push('script: ' + (e && e.stack ? e.stack : e));
} finally {
  if (browser) await browser.close();
  killServer();
}

let fail = 0;
console.log('\nresults');
for (const r of results) {
  const problems = [];
  if (r.peak < 0.002) problems.push('SILENT');
  if (r.peak >= 0.99) problems.push('CLIP');
  if (r.nan) problems.push('NaN');
  if (problems.length) {
    fail++;
    console.log(`  FAIL ${r.name}: ${problems.join(', ')} (peak ${r.peak.toFixed(4)})`);
  }
}
for (const e of errors) {
  fail++;
  console.log('  ERROR ' + e);
}
console.log(`\n${results.length} checks, ${fail} problems`);
process.exit(fail ? 1 : 0);
