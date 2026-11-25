#!/usr/bin/env node
/**
 * Offline loudness report for every music cue (renders faster than real time in Chromium).
 * Usage: node tools/audio-levels.mjs [seconds] [cue ...]
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5175;
const URL = `http://localhost:${PORT}/tools/audio-lab.html`;
const args = process.argv.slice(2);
const seconds = Number(args[0]) || 64;
const cues = args.slice(1).length
  ? args.slice(1)
  : ['menu', 'prologue', 'hub', 'kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins', 'citadel', 'echo', 'spire', 'ending', 'secretEnding'];

const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
const kill = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* gone */
  }
};
process.on('exit', kill);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* wait */
  }
  await sleep(250);
}
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().includes('[audio]')) errors.push(m.text());
});
await page.goto(URL);
await page.waitForFunction(() => !!window.__lab);
for (const cue of cues) {
  const secs = cue === 'ending' ? 180 : cue === 'secretEnding' ? 165 : seconds;
  const t0 = Date.now();
  const r = await page.evaluate(([c, s]) => window.__lab.analyze(c, s), [cue, secs]);
  const w = r.windows.map((x) => x.toFixed(0)).join(' ');
  console.log(`${cue.padEnd(10)} rms ${r.rms.toFixed(1)} dB  peak ${r.peak.toFixed(2)}  audio-thread load≈${(r.load * 100).toFixed(0)}%  8s-windows: ${w}`);
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
kill();
process.exit(0);
