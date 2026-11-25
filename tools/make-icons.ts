/**
 * Renders the app icons (installable game) from the TESSELLA emblem.
 *   npx tsx tools/make-icons.ts   → public/icons/*.png
 */
import { createRequire } from 'node:module';
import { AREA_BY_ID } from '../src/data/areas';
import type { AreaId } from '../src/data/areas';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function emblem(): string {
  const order: AreaId[] = ['kinship', 'mold', 'measure', 'twins', 'echo', 'beacon', 'contour', 'weave', 'mosaic'];
  let tiles = '';
  order.forEach((id, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const col = AREA_BY_ID[id].lit;
    tiles += `<rect x="${c * 36}" y="${r * 36}" width="30" height="30" rx="6" fill="${col}" style="filter:drop-shadow(0 0 5px ${col})"/>`;
  });
  return `<svg viewBox="-30 -30 166 166" xmlns="http://www.w3.org/2000/svg"><g transform="translate(53 -22) rotate(45)">
    <rect x="-8" y="-8" width="118" height="118" rx="10" fill="none" stroke="#e9c77d" stroke-width="1.6" opacity=".85"/>${tiles}</g></svg>`;
}

// scale = emblem size relative to the icon; round = rounded square (regular icons) or full bleed (maskable)
function page(size: number, scale: number, round: boolean): string {
  const e = Math.round(size * scale);
  return `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    border-radius:${round ? Math.round(size * 0.22) : 0}px;overflow:hidden;
    background:radial-gradient(circle at 50% 45%, #2a2236 0%, #120f19 55%, #07060b 100%)">
    <div style="width:${e}px;height:${e}px">${emblem()}</div></div></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ deviceScaleFactor: 1 });
  const jobs: [string, number, number, boolean][] = [
    ['icon-192.png', 192, 0.86, true],
    ['icon-512.png', 512, 0.86, true],
    ['maskable-512.png', 512, 0.66, false],
    ['apple-touch-icon.png', 180, 0.8, false],
  ];
  for (const [name, size, scale, round] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(page(size, scale, round));
    await p.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', name);
  }
  await browser.close();
})();
