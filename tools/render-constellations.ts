/**
 * Contact sheet of the constellation drawings (names, stars, threads, bell) → PNG.
 *   npx tsx tools/render-constellations.ts                 (final data → screenshots/constellation-drawings.png)
 *   npx tsx tools/render-constellations.ts --art [--area=kinship] [--out=file.png] [--scale=1]
 *        (the drawing library itself, before puzzles are generated; for iterating on the art)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { ART, artDrawing } from './lib/constellation-art';
import { drawingProblems, type P } from './lib/drawing-rules';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const useArt = process.argv.includes('--art');
const area = arg('area');
const out = arg('out') ?? join(root, 'screenshots', useArt ? 'constellation-art.png' : 'constellation-drawings.png');
const scale = Number(arg('scale') ?? (useArt ? 1 : 2));

interface Item { id: string; name: string; pts: P[]; edges: [number, number][]; bell: P; glyphs?: string[]; marks?: (string | undefined)[]; echo?: boolean; bad: boolean }

async function items(): Promise<Item[]> {
  if (useArt) {
    return ART.filter((a) => !area || a.area === area).map((a, i) => {
      const d = artDrawing(a);
      return { id: `${a.area} ${i + 1}`, name: `${a.name.pt} · ${a.name.en}`, pts: d.pts, edges: d.edges, bell: a.bell, bad: drawingProblems(d.pts, d.edges, a.bell).length > 0 };
    });
  }
  const { CONSTELLATIONS } = await import('../src/data/constellations');
  return CONSTELLATIONS.filter((c) => !area || c.area === area).map((c) => {
    const pts: P[] = c.stars.map((s) => [s.x, s.z]);
    const edges: [number, number][] = c.threads.map((t) => [t.a, t.b]);
    const name = (c as { name?: { pt: string; en: string } }).name;
    const glyphs = c.stars.map((s) => (s.glyph ? (s.glyph.kind === 'gem' ? `◆${s.glyph.color[0]}` : `${s.glyph.kind[0]}${s.glyph.n}`) : '') + (s.lock !== undefined ? '🔒' : ''));
    return { id: c.id, name: name ? `${name.pt} · ${name.en}` : '?', pts, edges, bell: [c.bell.x, c.bell.z], glyphs, marks: c.threads.map((t) => t.mark), echo: c.echo, bad: drawingProblems(pts, edges, [c.bell.x, c.bell.z]).length > 0 };
  });
}

function svg(it: Item, S: number): string {
  const xs = it.pts.map((p) => p[0]), zs = it.pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = Math.max(maxX - minX, maxZ - minZ) || 1;
  const pad = S * 0.12;
  const k = (S - 2 * pad) / W;
  const ox = pad + (S - 2 * pad - (maxX - minX) * k) / 2, oz = pad + (S - 2 * pad - (maxZ - minZ) * k) / 2;
  const X = (x: number) => (ox + (x - minX) * k).toFixed(1), Z = (z: number) => (oz + (z - minZ) * k).toFixed(1);
  const parts: string[] = [];
  it.edges.forEach(([a, b], e) => {
    const m = it.marks?.[e];
    parts.push(`<line x1="${X(it.pts[a][0])}" y1="${Z(it.pts[a][1])}" x2="${X(it.pts[b][0])}" y2="${Z(it.pts[b][1])}" stroke="${m === 'same' ? '#ffd27a' : m === 'diff' ? '#ff8f8f' : '#9fc3ff'}" stroke-width="2.2" ${m === 'diff' ? 'stroke-dasharray="5 4"' : ''} stroke-linecap="round"/>`);
  });
  it.pts.forEach(([x, z], i) => {
    parts.push(`<circle cx="${X(x)}" cy="${Z(z)}" r="5" fill="#fffbe8" stroke="#ffe7a0" stroke-width="1.5"/>`);
    const g = it.glyphs?.[i];
    if (g) parts.push(`<text x="${(Number(X(x)) + 7).toFixed(1)}" y="${(Number(Z(z)) - 6).toFixed(1)}" font-size="11" fill="#c9d6ff">${g}</text>`);
  });
  parts.push(`<circle cx="${X(it.bell[0])}" cy="${Z(it.bell[1])}" r="6" fill="none" stroke="#ffb347" stroke-width="2"/><circle cx="${X(it.bell[0])}" cy="${Z(it.bell[1])}" r="2" fill="#ffb347"/>`);
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${parts.join('')}</svg>`;
}

const list = await items();
const S = 230;
const cols = Math.min(10, list.length);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0b1020;font-family:system-ui,sans-serif;color:#dfe7ff}
  .grid{display:grid;grid-template-columns:repeat(${cols},${S}px);gap:6px;padding:10px}
  .c{background:#121a33;border-radius:8px;padding:4px 0 8px;text-align:center}
  .c.bad{outline:2px solid #ff5d5d}
  .n{font-size:13px;line-height:16px;padding:0 6px;height:32px;overflow:hidden}
  .i{font-size:11px;color:#8ea0d0}
</style></head><body><div class="grid">${list.map((it) => `<div class="c${it.bad ? ' bad' : ''}">${svg(it, S)}<div class="n">${it.name}</div><div class="i">${it.id}${it.echo ? ' · eco' : ''}</div></div>`).join('')}</div></body></html>`;
mkdirSync(dirname(out), { recursive: true });
const tmp = join(tmpdir(), `constellation-sheet-${process.pid}.html`);
writeFileSync(tmp, html);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cols * (S + 6) + 20, height: 800 }, deviceScaleFactor: scale });
await page.goto(`file://${tmp}`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out} (${list.length} drawings, ${list.filter((i) => i.bad).length} with problems)`);
