/**
 * Checks the constellation drawing library: readability problems per drawing, near-duplicates,
 * counts per area, and a suggested bell spot when the given one is too tight.
 *   npx tsx tools/art-check.ts [--area=hub] [--all]
 */
import { ART, artDrawing } from './lib/constellation-art';
import { dist, drawingProblems, pointSegDist, RULES, similarity, size, type P } from './lib/drawing-rules';

const area = process.argv.find((a) => a.startsWith('--area='))?.slice(7);
const EXPECT: Record<string, number> = { prologue: 4, hub: 10, kinship: 15, measure: 15, mold: 13, contour: 13, mosaic: 15, beacon: 13, weave: 15, twins: 15, citadel: 12, echo: 10 };

function clearance(p: P, pts: P[], edges: [number, number][]): number {
  let c = Infinity;
  for (const q of pts) c = Math.min(c, dist(p, q));
  for (const [a, b] of edges) c = Math.min(c, pointSegDist(p, pts[a], pts[b]));
  return c;
}

/** best bell spot within 2.5 units of the hint (maximum clearance, then closeness to the hint) */
export function fitBell(pts: P[], edges: [number, number][], hint: P): { p: P; c: number } {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  let best = { p: hint, c: clearance(hint, pts, edges) };
  for (let dx = -2.5; dx <= 2.5; dx += 0.1) for (let dz = -2.5; dz <= 2.5; dz += 0.1) {
    const p: P = [+(hint[0] + dx).toFixed(2), +(hint[1] + dz).toFixed(2)];
    if (p[0] < Math.min(...xs) || p[0] > Math.max(...xs) || p[1] < Math.min(...zs) || p[1] > Math.max(...zs)) continue;
    const c = clearance(p, pts, edges);
    const score = Math.min(c, size(pts) * 0.14) - 0.02 * dist(p, hint);
    const bestScore = Math.min(best.c, size(pts) * 0.14) - 0.02 * dist(best.p, hint);
    if (score > bestScore) best = { p, c };
  }
  return best;
}

let bad = 0;
const list = ART.map((a, i) => ({ a, i, d: artDrawing(a) }));
for (const { a, d } of list) {
  if (area && a.area !== area) continue;
  const probs = drawingProblems(d.pts, d.edges, a.bell);
  const W = size(d.pts);
  const c = clearance(a.bell, d.pts, d.edges);
  const tag = `${a.area.padEnd(8)} ${a.name.pt.padEnd(22)} ${String(d.pts.length).padStart(2)} stars ${String(d.edges.length).padStart(2)} threads  bell ${(c / W).toFixed(2)}W`;
  if (probs.length) {
    bad++;
    const fb = fitBell(d.pts, d.edges, a.bell);
    console.log(`✗ ${tag}\n    ${probs.join('\n    ')}${fb.c >= RULES.bellGap * W ? `\n    (bell could go to ${fb.p[0]},${fb.p[1]}: ${(fb.c / W).toFixed(2)}W)` : ''}`);
  } else if (process.argv.includes('--all')) console.log(`✓ ${tag}`);
}
// near-duplicates
for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  if (area && list[i].a.area !== area && list[j].a.area !== area) continue;
  const s = similarity(list[i].d, list[j].d);
  if (s > 0.55) console.log(`≈ ${list[i].a.name.pt} vs ${list[j].a.name.pt}: ${(s * 100).toFixed(0)}%`);
}
const names = new Set<string>();
for (const { a } of list) {
  if (names.has(a.name.pt)) console.log(`duplicate name ${a.name.pt}`);
  names.add(a.name.pt);
}
const counts: Record<string, number> = {};
for (const { a } of list) counts[a.area] = (counts[a.area] ?? 0) + 1;
console.log(Object.entries(EXPECT).map(([k, n]) => `${k} ${counts[k] ?? 0}/${n}`).join('  '));
console.log(`${list.length} drawings, ${bad} with problems`);
