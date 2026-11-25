/**
 * Generates the 150 secret constellations → src/data/constellations.ts
 *
 *   npx tsx tools/gen-constellations.ts            (writes the data file)
 *   npx tsx tools/gen-constellations.ts --dry      (prints stats only)
 *
 * Every non-trivial constellation is built around ONE named insight that comes from the network's
 * topology (bridges / cut stars, hubs, leaves, odd rings, triangles, loop parity of cut threads,
 * chains of knots, interleaved families, overlapping windows, echo trees / rings / reachability).
 * Pipeline per slot: insight template (topology + intended solution + core clues) → extra clues of
 * the area's languages until the solution is unique → minimise (core clues only if the insight
 * witness still holds) → fairness check (a careful human solves it with deductions and
 * contradiction lookahead, never by guessing) → minimum reasoning depth (size alone never counts)
 * → keep the deepest/smallest/most varied candidate. Deterministic (seeded).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConstellationDef, Star, StarGlyph, Thread } from '../src/secret/types';
import type { AreaId } from '../src/data/areas';
import type { GemColor } from '../src/puzzle/types';
import { checkConstellation, constellationKinds, initialState, isInversionSymmetric, press, regionsOf, contourCount, mosaicCount, stateString, wantsAllLit } from '../src/secret/graph';
import { distinctSolutions, estimateDifficulty, parityChecks, pressesFor, reachable, solveConstellation } from '../src/secret/solver';

const here = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');

// ───────────────────────── rng ─────────────────────────
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const pick = <T>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];
function shuffle<T>(r: Rng, a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ───────────────────────── geometry ─────────────────────────
type P = [number, number];
interface Net {
  pts: P[];
  edges: [number, number][];
  shape: string;
}

function segInter(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
function pointSegDist(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function netProblems(pts: P[], edges: [number, number][], minDist = 1.6, maxR = 7): string[] {
  const errs: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i][0], pts[i][1]) > maxR + 1e-6) errs.push(`star ${i} outside radius`);
    for (let j = i + 1; j < pts.length; j++) if (dist(pts[i], pts[j]) < minDist - 1e-6) errs.push(`stars ${i},${j} too close`);
  }
  const key = new Set<string>();
  edges.forEach(([a, b], k) => {
    if (a === b) errs.push(`edge ${k} loop`);
    const kk = a < b ? `${a},${b}` : `${b},${a}`;
    if (key.has(kk)) errs.push(`edge ${k} dup`);
    key.add(kk);
  });
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segInter(pts[a], pts[b], pts[c], pts[d])) errs.push(`edges ${i},${j} cross`);
    }
    const [a, b] = edges[i];
    for (let s = 0; s < pts.length; s++) {
      if (s === a || s === b) continue;
      if (pointSegDist(pts[s], pts[a], pts[b]) < 0.55) errs.push(`star ${s} on edge ${i}`);
    }
  }
  return errs;
}

function connected(n: number, edges: [number, number][]): boolean {
  const adj = Array.from({ length: n }, () => [] as number[]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set([0]);
  const q = [0];
  while (q.length) for (const j of adj[q.pop()!]) if (!seen.has(j)) (seen.add(j), q.push(j));
  return seen.size === n;
}

/** Centre the network and scale it so every star fits inside radius `maxR`, spacing ≥ minDist. */
function normalize(net: Net, maxR = 6.6, minDist = 1.7): Net | null {
  const n = net.pts.length;
  let cx = 0, cz = 0;
  for (const [x, z] of net.pts) {
    cx += x;
    cz += z;
  }
  cx /= n;
  cz /= n;
  let pts: P[] = net.pts.map(([x, z]) => [x - cx, z - cz]);
  let md = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) md = Math.min(md, dist(pts[i], pts[j]));
  let R = 0;
  for (const p of pts) R = Math.max(R, Math.hypot(p[0], p[1]));
  // scale so that min distance = minDist*1.05 if possible, but radius ≤ maxR
  let k = (minDist * 1.08) / md;
  if (R * k > maxR) k = maxR / R;
  if (md * k < minDist) return null;
  pts = pts.map(([x, z]) => [+(x * k).toFixed(2), +(z * k).toFixed(2)]);
  return { ...net, pts };
}

// ───────────────────────── shapes ─────────────────────────

function greedyPlanar(pts: P[], maxLen: number, keepRatio = 1, r?: Rng): [number, number][] {
  const cand: [number, number, number][] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) cand.push([i, j, dist(pts[i], pts[j])]);
  cand.sort((a, b) => a[2] - b[2]);
  const edges: [number, number][] = [];
  for (const [i, j, d] of cand) {
    if (d > maxLen) break;
    let ok = true;
    for (const [a, b] of edges) {
      if (a === i || a === j || b === i || b === j) continue;
      if (segInter(pts[i], pts[j], pts[a], pts[b])) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (let s = 0; s < pts.length && ok; s++) if (s !== i && s !== j && pointSegDist(pts[s], pts[i], pts[j]) < 0.6 * (d / 2.2)) ok = false;
    if (ok) edges.push([i, j]);
  }
  if (keepRatio < 1 && r) {
    // remove random edges while staying connected
    const order = shuffle(r, edges.map((_, k) => k));
    const removeCount = Math.floor(edges.length * (1 - keepRatio));
    let removed = 0;
    let cur = edges.slice();
    for (const k of order) {
      if (removed >= removeCount) break;
      const e = edges[k];
      const trial = cur.filter((x) => x !== e);
      if (connected(pts.length, trial)) {
        cur = trial;
        removed++;
      }
    }
    return cur;
  }
  return edges;
}

function poisson(r: Rng, n: number, radius: number, minD: number): P[] {
  const pts: P[] = [];
  let guard = 0;
  while (pts.length < n && guard++ < 20000) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    const p: P = [Math.cos(a) * d, Math.sin(a) * d];
    if (pts.every((q) => dist(p, q) >= minD)) pts.push(p);
  }
  return pts;
}

const SHAPES: Record<string, (r: Rng, n: number) => Net> = {
  chain(r, n) {
    const pts: P[] = [];
    const bend = (r() - 0.5) * 1.4;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1) - 0.5;
      pts.push([t * (n - 1) * 2, Math.sin(t * Math.PI * bend) * 2.2 + (r() - 0.5) * 0.3]);
    }
    return { pts, edges: pts.slice(1).map((_, i) => [i, i + 1]), shape: 'cadeia' };
  },
  ring(r, n) {
    const pts: P[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * 3 * (1 + (r() - 0.5) * 0.08), Math.sin(a) * 3]);
    }
    return { pts, edges: pts.map((_, i) => [i, (i + 1) % n]), shape: 'anel' };
  },
  wheel(r, n) {
    const m = n - 1;
    const pts: P[] = [[0, 0]];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + r() * 0.1;
      pts.push([Math.cos(a) * 3, Math.sin(a) * 3]);
    }
    const edges: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      edges.push([1 + i, 1 + ((i + 1) % m)]);
      if (i % (m > 7 ? 2 : 1) === 0 || r() < 0.35) edges.push([0, 1 + i]);
    }
    return { pts, edges, shape: 'roda' };
  },
  doubleRing(r, n) {
    const m = Math.max(3, Math.floor(n / 2));
    const pts: P[] = [];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      pts.push([Math.cos(a) * 4, Math.sin(a) * 4]);
    }
    for (let i = 0; i < n - m; i++) {
      const a = ((i + 0.5) / (n - m)) * Math.PI * 2;
      pts.push([Math.cos(a) * 1.9, Math.sin(a) * 1.9]);
    }
    return { pts, edges: greedyPlanar(pts, 3.4, 0.8, r), shape: 'dois anéis' };
  },
  tree(r, n) {
    const pts: P[] = [[0, 0]];
    const edges: [number, number][] = [];
    let guard = 0;
    while (pts.length < n && guard++ < 4000) {
      const p = Math.floor(r() * pts.length);
      const a = r() * Math.PI * 2;
      const q: P = [pts[p][0] + Math.cos(a) * 2.1, pts[p][1] + Math.sin(a) * 2.1];
      if (Math.hypot(q[0], q[1]) > 6) continue;
      if (pts.some((s) => dist(s, q) < 1.75)) continue;
      const ok = edges.every(([u, v]) => u === p || v === p || !segInter(pts[u], pts[v], pts[p], q));
      if (!ok) continue;
      pts.push(q);
      edges.push([p, pts.length - 1]);
    }
    return { pts, edges, shape: 'árvore' };
  },
  cluster(r, n) {
    const pts = poisson(r, n, 5.4, 1.9);
    return { pts, edges: greedyPlanar(pts, 3.3, 0.72 + r() * 0.2, r), shape: 'aglomerado' };
  },
  dense(r, n) {
    const pts = poisson(r, n, 5.2, 1.85);
    return { pts, edges: greedyPlanar(pts, 3.1, 1, r), shape: 'triangulado' };
  },
  ladder(r, n) {
    const m = Math.max(2, Math.floor(n / 2));
    const pts: P[] = [];
    for (let i = 0; i < m; i++) pts.push([i * 2.1, 0], [i * 2.1, 2.2]);
    const edges: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      if (i < m - 1) edges.push([i * 2, i * 2 + 2], [i * 2 + 1, i * 2 + 3]);
      if (i === 0 || i === m - 1 || r() < 0.6) edges.push([i * 2, i * 2 + 1]);
    }
    return { pts, edges, shape: 'escada' };
  },
  lattice(r, n) {
    const w = Math.max(2, Math.round(Math.sqrt(n * 1.2)));
    const h = Math.max(2, Math.ceil(n / w));
    const pts: P[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pts.push([i * 2.2 + (j % 2) * 0.0, j * 2.2]);
    let edges: [number, number][] = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (i < w - 1) edges.push([k, k + 1]);
        if (j < h - 1) edges.push([k, k + w]);
      }
    // drop a few edges, keep connected
    const order = shuffle(r, edges.map((_, k) => k));
    let cur = edges;
    let drops = Math.floor(edges.length * (0.1 + r() * 0.2));
    for (const k of order) {
      if (drops <= 0) break;
      const trial = cur.filter((e) => e !== edges[k]);
      if (connected(pts.length, trial)) {
        cur = trial;
        drops--;
      }
    }
    edges = cur;
    return { pts, edges, shape: 'treliça' };
  },
  triLattice(r, n) {
    const pts: P[] = [];
    const rows = Math.max(2, Math.round(Math.sqrt(n)));
    for (let j = 0; j < rows; j++) {
      const cnt = Math.ceil(n / rows);
      for (let i = 0; i < cnt && pts.length < n; i++) pts.push([i * 2.2 + (j % 2) * 1.1, j * 1.9]);
    }
    return { pts, edges: greedyPlanar(pts, 2.3, 0.82, r), shape: 'treliça triangular' };
  },
  arms(r, n) {
    const k = n > 12 ? 5 : n > 8 ? 4 : 3;
    const per = Math.max(1, Math.floor((n - 1) / k));
    const pts: P[] = [[0, 0]];
    const edges: [number, number][] = [];
    for (let a = 0; a < k; a++) {
      const ang = (a / k) * Math.PI * 2 + r() * 0.2;
      let prev = 0;
      for (let i = 1; i <= per; i++) {
        pts.push([Math.cos(ang) * 2.05 * i, Math.sin(ang) * 2.05 * i]);
        edges.push([prev, pts.length - 1]);
        prev = pts.length - 1;
      }
    }
    // connect arm tips into a ring sometimes
    if (r() < 0.5 && k >= 4) {
      for (let a = 0; a < k; a++) {
        const t1 = 1 + a * per + per - 1, t2 = 1 + ((a + 1) % k) * per + per - 1;
        edges.push([t1, t2]);
      }
    }
    return { pts, edges, shape: 'estrela de braços' };
  },
};

/** Constellation drawings (normalised coordinates, x right, z down). */
const DRAWINGS: Record<string, { pts: P[]; edges: [number, number][] }> = {
  pássaro: {
    pts: [[-3, 0], [-1.5, -0.4], [0, 0], [1.6, -0.2], [3, -0.9], [3.6, -1.6], [-0.4, -2.2], [-1.6, -3.6], [0.6, 1.8], [-0.6, 3.2], [2.3, 0.9]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [1, 6], [2, 8], [8, 9], [3, 10], [8, 10]],
  },
  peixe: {
    pts: [[-3.2, 0], [-1.6, -1.6], [0.4, -2], [2.2, -1.2], [3.2, 0], [2.2, 1.2], [0.4, 2], [-1.6, 1.6], [-4.6, -1.6], [-4.6, 1.6], [1.4, -0.4]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 8], [8, 9], [9, 0], [3, 10], [2, 10]],
  },
  chave: {
    pts: [[-3.6, 0], [-2.6, -1.4], [-1.2, -1.4], [-0.4, 0], [-1.2, 1.4], [-2.6, 1.4], [1.4, 0], [3.2, 0], [5, 0], [3.2, 1.6], [5, 1.6]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [6, 7], [7, 8], [7, 9], [8, 10]],
  },
  crescente: {
    pts: [[0, -3.6], [2.2, -2.8], [3.4, -0.8], [3.2, 1.4], [1.8, 3.2], [-0.4, 3.6], [0.6, 2], [1.4, 0.4], [1.2, -1.4], [-0.2, -2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0], [1, 8], [3, 7], [4, 6]],
  },
  casa: {
    pts: [[-2.4, 3], [2.4, 3], [2.4, 0], [-2.4, 0], [0, -2.6], [0, 1.4], [-1.2, 3], [1.2, 3]],
    edges: [[0, 6], [6, 7], [7, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 2], [6, 5], [5, 7], [5, 3], [5, 2]],
  },
  flor: {
    pts: [[0, 0], [0, -2.2], [2.1, -0.7], [1.3, 1.8], [-1.3, 1.8], [-2.1, -0.7], [0, -4.2], [4, -1.3], [2.5, 3.4], [-2.5, 3.4], [-4, -1.3]],
    edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10], [1, 2], [3, 4]],
  },
  coroa: {
    pts: [[-4, 1.6], [-2, 1.6], [0, 1.6], [2, 1.6], [4, 1.6], [-4, -1.6], [-2, 0], [0, -2.2], [2, 0], [4, -1.6]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 4], [6, 1], [7, 2], [8, 3]],
  },
  coração: {
    pts: [[0, -1.4], [-1.6, -3], [-3.4, -2], [-3.2, 0.2], [-1.6, 2], [0, 3.6], [1.6, 2], [3.2, 0.2], [3.4, -2], [1.6, -3], [0, 1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0], [0, 10], [10, 4], [10, 6], [10, 5]],
  },
  barco: {
    pts: [[-3.6, 1.6], [-1.2, 2.8], [1.2, 2.8], [3.6, 1.6], [0, 1.4], [0, -1], [0, -3.4], [-2.4, 0.6], [2.2, -0.6]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [4, 5], [5, 6], [6, 7], [7, 4], [6, 8], [8, 5], [1, 4], [2, 4]],
  },
  borboleta: {
    pts: [[0, -2], [0, 0], [0, 2], [-2.4, -3], [-4, -0.8], [-2.2, 0.6], [2.4, -3], [4, -0.8], [2.2, 0.6], [-2.6, 2.8], [2.6, 2.8]],
    edges: [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [5, 1], [0, 6], [6, 7], [7, 8], [8, 1], [2, 9], [9, 5], [2, 10], [10, 8]],
  },
  lanterna: {
    pts: [[0, -3.8], [-1.6, -2.2], [1.6, -2.2], [-2.2, 0], [2.2, 0], [-1.6, 2.2], [1.6, 2.2], [0, 3.8], [0, 0]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8]],
  },
  serpente: {
    pts: [[-4, -1], [-2.6, 0.6], [-1, -0.6], [0.6, 0.8], [2.2, -0.5], [3.6, 0.9], [4.4, -0.7], [-4.8, -2.6]],
    edges: [[7, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
};

function drawing(name: string, r: Rng): Net {
  const d = DRAWINGS[name];
  const pts: P[] = d.pts.map(([x, z]) => [x + (r() - 0.5) * 0.25, z + (r() - 0.5) * 0.25]);
  return { pts, edges: d.edges.slice(), shape: name };
}

// ───────────────────────── clues ─────────────────────────

type ClueKind = 'gem' | 'measure' | 'contour' | 'mosaic' | 'mark' | 'lock';
interface Clue {
  kind: ClueKind;
  star?: number;
  thread?: number;
  glyph?: StarGlyph;
  mark?: 'same' | 'diff';
  lock?: 0 | 1;
}

const COLORS: GemColor[] = ['amber', 'azure', 'crimson', 'jade', 'ivory', 'violet'];
const COLOR_PT: Record<GemColor, string> = { amber: 'âmbar', azure: 'azuis', crimson: 'carmim', jade: 'jade', ivory: 'marfim', violet: 'violeta' };

function buildDef(id: string, area: AreaId, net: Net, clues: Clue[], echo: boolean): ConstellationDef {
  const stars: Star[] = net.pts.map(([x, z]) => ({ x, z }));
  const threads: Thread[] = net.edges.map(([a, b]) => ({ a, b }));
  for (const c of clues) {
    if (c.kind === 'mark') threads[c.thread!].mark = c.mark;
    else if (c.kind === 'lock') stars[c.star!].lock = c.lock;
    else stars[c.star!].glyph = c.glyph;
  }
  return { id, area, stars, threads, bell: { x: 0, z: 0 }, ...(echo ? { echo: true } : {}), difficulty: 1 };
}

/** Candidate clues consistent with `sol`. Gem colours: one colour per region; `fixed` pins colours
 *  already used by the core clues (region id → colour) and those colours are never reused. */
function candidateClues(def: ConstellationDef, sol: Uint8Array, kinds: ClueKind[], r: Rng, fixed = new Map<number, GemColor>()): Clue[] {
  const out: Clue[] = [];
  const { id: reg, members } = regionsOf(def, sol);
  if (kinds.includes('gem')) {
    const colorOf = new Map(fixed);
    const used = new Set(fixed.values());
    const free = shuffle(r, COLORS.filter((c) => !used.has(c)));
    for (const rid of shuffle(r, members.map((_, k) => k))) {
      if (colorOf.has(rid)) continue;
      const c = free.shift();
      if (!c) break;
      colorOf.set(rid, c);
    }
    def.stars.forEach((_s, i) => {
      const c = colorOf.get(reg[i]);
      if (c) out.push({ kind: 'gem', star: i, glyph: { kind: 'gem', color: c } });
    });
  }
  def.stars.forEach((_s, i) => {
    if (kinds.includes('measure')) out.push({ kind: 'measure', star: i, glyph: { kind: 'measure', n: members[reg[i]].length } });
    if (kinds.includes('contour')) out.push({ kind: 'contour', star: i, glyph: { kind: 'contour', n: contourCount(def, sol, i) } });
    if (kinds.includes('mosaic')) out.push({ kind: 'mosaic', star: i, glyph: { kind: 'mosaic', n: mosaicCount(def, sol, i) } });
    if (kinds.includes('lock')) out.push({ kind: 'lock', star: i, lock: sol[i] as 0 | 1 });
  });
  if (kinds.includes('mark')) def.threads.forEach((t, k) => out.push({ kind: 'mark', thread: k, mark: sol[t.a] === sol[t.b] ? 'same' : 'diff' }));
  return out;
}

const symmetricClues = (cl: Clue[], allLit: boolean) => !allLit && !cl.some((c) => c.kind === 'lock' || c.kind === 'mosaic');

function uniqueWith(id: string, area: AreaId, net: Net, cl: Clue[], echo: boolean, sol: Uint8Array): boolean {
  const def = buildDef(id, area, net, cl, echo);
  const sym = symmetricClues(cl, wantsAllLit(def));
  const res = distinctSolutions(def, sym, 2, 160_000);
  if (!res.complete || res.count !== 1) return false;
  const f = res.first!;
  return f.every((v, i) => v === sol[i]) || (sym && f.every((v, i) => v !== sol[i]));
}

// ───────────────────────── graph features ─────────────────────────

function adjOf(n: number, edges: [number, number][]): number[][] {
  const adj = Array.from({ length: n }, () => [] as number[]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

/** Components left when star `v` is removed. */
function componentsWithout(n: number, adj: number[][], v: number): number[][] {
  const seen = new Set<number>([v]);
  const comps: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (seen.has(s)) continue;
    const c = [s];
    seen.add(s);
    for (let k = 0; k < c.length; k++) for (const j of adj[c[k]]) if (!seen.has(j)) (seen.add(j), c.push(j));
    comps.push(c);
  }
  return comps;
}

function cutVertices(net: Net): { v: number; comps: number[][] }[] {
  const n = net.pts.length;
  const adj = adjOf(n, net.edges);
  const out: { v: number; comps: number[][] }[] = [];
  for (let v = 0; v < n; v++) {
    const comps = componentsWithout(n, adj, v);
    if (comps.length >= 2) out.push({ v, comps });
  }
  return out;
}

const isTree = (net: Net) => net.edges.length === net.pts.length - 1 && connected(net.pts.length, net.edges);

/** Longest simple cycle found by bounded DFS (graphs here are small). */
function longestCycle(net: Net, budget = 200_000): number[] {
  const n = net.pts.length;
  const adj = adjOf(n, net.edges);
  let best: number[] = [];
  let steps = 0;
  const path: number[] = [];
  const on = new Uint8Array(n);
  const dfs = (start: number, v: number) => {
    if (++steps > budget) return;
    for (const j of adj[v]) {
      if (j === start && path.length >= 3 && path.length > best.length) best = path.slice();
      if (on[j] || j < start) continue;
      on[j] = 1;
      path.push(j);
      dfs(start, j);
      path.pop();
      on[j] = 0;
    }
  };
  for (let s0 = 0; s0 < n && steps <= budget; s0++) {
    on[s0] = 1;
    path.push(s0);
    dfs(s0, s0);
    path.pop();
    on[s0] = 0;
  }
  return best;
}

// ───────────────────────── insight templates ─────────────────────────

interface Instance {
  net: Net;
  sol: Uint8Array;
  core: Clue[];
  note: string;
  echo?: boolean;
  allLit?: boolean;
  /** must hold on the final (minimised) definition */
  witness?: (def: ConstellationDef) => boolean;
  /** echo puzzles whose static rules admit ≥ 2 answers (reachability decides) */
  needStaticAmbiguity?: boolean;
}

type Template = (r: Rng, size: number, shapes: string[]) => Instance | null;

function netFromShape(r: Rng, shapes: string[], size: number): Net | null {
  const shape = pick(r, shapes);
  const raw = DRAWINGS[shape] ? drawing(shape, r) : SHAPES[shape](r, size);
  if (raw.pts.length < 3 || raw.pts.length > 24 || !connected(raw.pts.length, raw.edges)) return null;
  const norm = normalize(raw);
  if (!norm || netProblems(norm.pts, norm.edges).length) return null;
  return norm;
}

function placeNet(pts: P[], edges: [number, number][], shape: string): Net | null {
  if (!connected(pts.length, edges)) return null;
  const norm = normalize({ pts, edges, shape });
  if (!norm || netProblems(norm.pts, norm.edges).length) return null;
  return norm;
}

function randomSol(r: Rng, n: number, p = 0.5): Uint8Array {
  const s = new Uint8Array(n);
  for (let i = 0; i < n; i++) s[i] = r() < p ? 1 : 0;
  return s;
}

function tmpDef(net: Net, echo = false): ConstellationDef {
  return buildDef('tmp', 'hub', net, [], echo);
}

function gemClue(i: number, c: GemColor): Clue {
  return { kind: 'gem', star: i, glyph: { kind: 'gem', color: c } };
}
function glyphClue(kind: 'measure' | 'contour' | 'mosaic', i: number, n: number): Clue {
  return { kind, star: i, glyph: { kind, n } };
}
function markClue(net: Net, sol: Uint8Array, k: number): Clue {
  const [a, b] = net.edges[k];
  return { kind: 'mark', thread: k, mark: sol[a] === sol[b] ? 'same' : 'diff' };
}

/** two small clusters joined by a single star (a cut vertex) */
function twoClusters(r: Rng, sizeEach: number): { pts: P[]; edges: [number, number][]; c: number } {
  const pts: P[] = [[0, 0]];
  const edges: [number, number][] = [];
  for (const side of [-1, 1]) {
    const base = pts.length;
    const m = Math.max(3, sizeEach + Math.floor(r() * 2));
    const cx = side * 3.6;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + r() * 0.3;
      pts.push([cx + Math.cos(a) * 1.9 + side * 0.4, Math.sin(a) * 1.9]);
    }
    for (let i = 0; i < m; i++) edges.push([base + i, base + ((i + 1) % m)]);
    if (m >= 5 && r() < 0.6) edges.push([base, base + 2]);
    // connect the cluster to the middle star through its nearest star
    let best = base, bd = Infinity;
    for (let i = base; i < base + m; i++) {
      const d = dist(pts[i], [0, 0]);
      if (d < bd) (bd = d), (best = i);
    }
    edges.push([0, best]);
  }
  // optional pendant on the middle star (keeps it a cut vertex)
  if (r() < 0.4) {
    pts.push([0, r() < 0.5 ? 2.2 : -2.2]);
    edges.push([0, pts.length - 1]);
  }
  return { pts, edges, c: 0 };
}

const T: Record<string, Template> = {
  /** Warm-ups: plain small puzzles with the area's language (no insight required). */
  warm(r, size, shapes) {
    const net = netFromShape(r, shapes, size);
    if (!net) return null;
    return { net, sol: randomSol(r, net.pts.length, 0.45), core: [], note: 'Aquecimento: a linguagem do lugar, agora em rede.' };
  },

  /** A ponte: two same-colour gems on both sides of a cut star. */
  bridgeKin(r, size, shapes) {
    let net: Net | null = null;
    let cut: { v: number; comps: number[][] } | undefined;
    if (shapes.length) {
      net = netFromShape(r, shapes, size);
      if (!net) return null;
      cut = shuffle(r, cutVertices(net)).find((c) => c.comps.filter((cc) => cc.length >= 2).length >= 2);
    } else {
      const tc = twoClusters(r, Math.max(3, Math.floor((size - 1) / 2)));
      net = placeNet(tc.pts, tc.edges, 'duas ilhas e uma ponte');
      if (net) cut = cutVertices(net).find((c) => c.v === 0);
    }
    if (!net || !cut) return null;
    const comps = cut.comps.filter((cc) => cc.length >= 2).sort((a, b) => b.length - a.length);
    const [C1, C2] = comps;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const sol = randomSol(r, n, 0.45);
    const s = r() < 0.5 ? 1 : 0;
    const a = adj[cut.v].find((j) => C1.includes(j))!;
    const b = adj[cut.v].find((j) => C2.includes(j))!;
    sol[cut.v] = s;
    sol[a] = s;
    sol[b] = s;
    // grow a little on each side so the gems can sit away from the bridge
    for (const [start, C] of [[a, C1], [b, C2]] as [number, number[]][]) {
      const nb = adj[start].filter((j) => C.includes(j));
      if (nb.length && r() < 0.7) sol[pick(r, nb)] = s;
    }
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const R = members[reg[cut.v]];
    const far = (C: number[], from: number) => {
      const opts = R.filter((x) => C.includes(x));
      return opts.sort((x, y) => dist(net!.pts[y], net!.pts[from]) - dist(net!.pts[x], net!.pts[from]))[0];
    };
    const g1 = far(C1, cut.v), g2 = far(C2, cut.v);
    const color = pick(r, COLORS);
    const cutStar = cut.v;
    return {
      net, sol, core: [gemClue(g1, color), gemClue(g2, color)],
      note: `A ponte: as duas gemas ${COLOR_PT[color]} estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família.`,
      witness: (def) => {
        const gs = def.stars.map((st, i) => (st.glyph?.kind === 'gem' && st.glyph.color === color ? i : -1)).filter((i) => i >= 0);
        return gs.some((i) => C1.includes(i)) && gs.some((i) => C2.includes(i)) && !(def.stars[cutStar].glyph?.kind === 'gem');
      },
    };
  },

  /** O número não cabe de um lado só: the region must cross the bridge. */
  bridgeMeasure(r, size, shapes) {
    let net: Net | null = null;
    let cut: { v: number; comps: number[][] } | undefined;
    if (shapes.length) {
      net = netFromShape(r, shapes, size);
      if (!net) return null;
      cut = shuffle(r, cutVertices(net)).find((c) => c.comps.filter((cc) => cc.length >= 2).length >= 2);
    } else {
      const tc = twoClusters(r, Math.max(3, Math.floor((size - 1) / 2)));
      net = placeNet(tc.pts, tc.edges, 'duas ilhas e uma ponte');
      if (net) cut = cutVertices(net).find((c) => c.v === 0);
    }
    if (!net || !cut) return null;
    const comps = cut.comps.filter((cc) => cc.length >= 2).sort((a, b) => a.length - b.length);
    const C1 = comps[0], C2 = comps[comps.length - 1];
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const s = r() < 0.5 ? 1 : 0;
    const sol = new Uint8Array(n).fill(1 - s);
    // region: all of C1 except maybe one star, the cut star, and 1..3 stars of C2
    const R = new Set<number>([cut.v]);
    for (const x of C1) if (R.size < C1.length || r() < 0.85) R.add(x);
    const frontier = adj[cut.v].filter((j) => C2.includes(j));
    let grow = 1 + Math.floor(r() * 3);
    const q = [...frontier];
    while (grow > 0 && q.length) {
      const x = q.splice(Math.floor(r() * q.length), 1)[0];
      if (R.has(x)) continue;
      R.add(x);
      grow--;
      for (const j of adj[x]) if (C2.includes(j) && !R.has(j)) q.push(j);
    }
    for (const x of R) sol[x] = s;
    // other stars random (but never touching R with state s)
    for (let i = 0; i < n; i++) if (!R.has(i)) sol[i] = adj[i].some((j) => R.has(j)) ? 1 - s : r() < 0.5 ? 1 : 0;
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const region = members[reg[cut.v]];
    if (region.length <= C1.length + 1) return null;
    const inC1 = region.filter((x) => C1.includes(x));
    if (!inC1.length) return null;
    const at = inC1.sort((x, y) => dist(net!.pts[y], net!.pts[cut!.v]) - dist(net!.pts[x], net!.pts[cut!.v]))[0];
    const N = region.length;
    return {
      net, sol, core: [glyphClue('measure', at, N)],
      note: `O número não cabe de um lado só: a região de ${N} tem de atravessar a ponte.`,
      witness: (def) => def.stars.some((st, i) => C1.includes(i) && st.glyph?.kind === 'measure' && st.glyph.n > C1.length + 1),
    };
  },

  /** O cubo: differently-coloured gems all touch the hub, so it can't share their state. */
  hubKin(r, size) {
    const m = Math.max(6, size - 1);
    const pts: P[] = [[0, 0]];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      pts.push([Math.cos(a) * 3, Math.sin(a) * 3]);
    }
    const edges: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      edges.push([1 + i, 1 + ((i + 1) % m)]);
      edges.push([0, 1 + i]);
    }
    const net = placeNet(pts, edges, 'roda');
    if (!net) return null;
    const s = r() < 0.5 ? 1 : 0; // hub state
    const sol = new Uint8Array(net.pts.length);
    sol[0] = s;
    // rim: blocks of the opposite state separated by hub-state stars
    for (let i = 0; i < m; i++) sol[1 + i] = r() < 0.55 ? 1 - s : s;
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const opp = [...new Set(members.map((_, k) => k).filter((k) => sol[members[k][0]] !== s))];
    if (opp.length < 2) return null;
    const cols = shuffle(r, COLORS);
    const core = opp.slice(0, 4).map((rid, k) => gemClue(pick(r, members[rid]), cols[k]));
    return {
      net, sol, core,
      note: 'O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro.',
      witness: (def) => new Set(def.stars.slice(1).filter((st) => st.glyph?.kind === 'gem').map((st) => (st.glyph as { color: string }).color)).size >= 2 && !def.stars[0].glyph,
    };
  },

  /** Amigo único / o dissidente: hub contour 1 or d-1. */
  hubContour(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['wheel', 'arms', 'flor', 'lanterna'], size);
    if (!net) return null;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const hub = [...Array(n).keys()].sort((a, b) => adj[b].length - adj[a].length)[0];
    const d = adj[hub].length;
    if (d < 4) return null;
    const sol = randomSol(r, n, 0.5);
    const friend = r() < 0.5;
    const s = sol[hub];
    const chosen = pick(r, adj[hub]);
    for (const j of adj[hub]) sol[j] = friend ? (j === chosen ? s : 1 - s) : j === chosen ? 1 - s : s;
    const c = contourCount(tmpDef(net), sol, hub);
    return {
      net, sol, core: [glyphClue('contour', hub, c)],
      note: friend
        ? `Amigo único: dos ${d} fios do cubo, só um leva a alguém do mesmo estado — descubra qual.`
        : `O dissidente: dos ${d} vizinhos do cubo, só um é diferente — descubra qual.`,
      witness: (def) => def.stars[hub].glyph?.kind === 'contour',
    };
  },

  /** A janela inteira: the hub's mosaic window is its whole neighbourhood. */
  hubMosaic(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['wheel', 'flor', 'lanterna', 'arms'], size);
    if (!net) return null;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const hub = [...Array(n).keys()].sort((a, b) => adj[b].length - adj[a].length)[0];
    if (adj[hub].length < 4) return null;
    const sol = randomSol(r, n, 0.5);
    const def = tmpDef(net);
    const nb = pick(r, adj[hub]);
    return {
      net, sol, core: [glyphClue('mosaic', hub, mosaicCount(def, sol, hub)), glyphClue('mosaic', nb, mosaicCount(def, sol, nb))],
      note: 'A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê.',
      witness: (d) => d.stars[hub].glyph?.kind === 'mosaic' && adj[hub].some((j) => d.stars[j].glyph?.kind === 'mosaic'),
    };
  },

  /** Folhas: a leaf's mosaic window only sees itself and its parent. */
  leafMosaic(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['arms', 'tree', 'flor'], size);
    if (!net) return null;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const leaves = [...Array(n).keys()].filter((i) => adj[i].length === 1);
    if (leaves.length < 3) return null;
    const sol = randomSol(r, n, 0.5);
    const def = tmpDef(net);
    // leaves whose window is extreme (0 or 2) are the strong anchors
    const picks = shuffle(r, leaves).slice(0, 3);
    for (const l of picks.slice(0, 2)) sol[adj[l][0]] = sol[l];
    const core = picks.slice(0, 2).map((l) => glyphClue('mosaic', l, mosaicCount(def, sol, l)));
    return {
      net, sol, core,
      note: 'Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro.',
      witness: (d) => leaves.filter((l) => d.stars[l].glyph?.kind === 'mosaic').length >= 2,
    };
  },

  /** Árvore de medidas: in a tree every border splits for good. */
  treeMeasure(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['tree', 'arms', 'serpente'], size);
    if (!net || !isTree(net)) return null;
    const sol = randomSol(r, net.pts.length, 0.5);
    return {
      net, sol, core: [],
      note: 'Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco.',
      witness: (d) => d.stars.filter((st) => st.glyph?.kind === 'measure').length >= 3,
    };
  },

  /** Laço ímpar (contorno): alternation can't close around an odd ring. */
  oddRingContour(r, size) {
    const L = size % 2 ? size : size + 1;
    const pts: P[] = [];
    for (let i = 0; i < L; i++) {
      const a = (i / L) * Math.PI * 2;
      pts.push([Math.cos(a) * 3, Math.sin(a) * 3]);
    }
    const edges: [number, number][] = pts.map((_, i) => [i, (i + 1) % L]);
    const x = Math.floor(r() * L);
    const w = (x + 1) % L;
    // pendants on some stars (not the agreeing pair)
    const pend = r() < 0.6 ? 1 + Math.floor(r() * 2) : 0;
    const pendOn: number[] = [];
    for (let k = 0; k < pend; k++) {
      const v = (x + 2 + Math.floor(r() * (L - 3))) % L;
      if (pendOn.includes(v)) continue;
      const a = (v / L) * Math.PI * 2;
      pts.push([Math.cos(a) * 5.2, Math.sin(a) * 5.2]);
      edges.push([v, pts.length - 1]);
      pendOn.push(v);
    }
    const net = placeNet(pts, edges, 'laço ímpar');
    if (!net) return null;
    const n = net.pts.length;
    const sol = new Uint8Array(n);
    // alternate starting at w going around, so that x and w agree
    let st = 1;
    for (let k = 0; k < L; k++) {
      const v = (w + k) % L;
      sol[v] = st;
      st ^= 1;
    }
    sol[x] = sol[w];
    for (let i = L; i < n; i++) sol[i] = r() < 0.5 ? 1 : 0;
    const def = tmpDef(net);
    const core: Clue[] = [];
    for (let v = 0; v < L; v++) if (v !== x && v !== w && !pendOn.includes(v)) core.push(glyphClue('contour', v, contourCount(def, sol, v)));
    return {
      net, sol, core,
      note: 'Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar.',
      witness: (d) => d.stars.slice(0, L).filter((s2) => s2.glyph?.kind === 'contour' && s2.glyph.n === 2).length >= L - 4,
    };
  },

  /** Laço ímpar de gemas: adjacent different colours must alternate; the twin pair agrees. */
  oddRingKin(r, size) {
    const L = Math.min(7, size % 2 ? size : size + 1);
    const pts: P[] = [];
    for (let i = 0; i < L; i++) {
      const a = (i / L) * Math.PI * 2;
      pts.push([Math.cos(a) * 2.7, Math.sin(a) * 2.7]);
    }
    const edges: [number, number][] = pts.map((_, i) => [i, (i + 1) % L]);
    const pend = Math.floor(r() * 3);
    for (let k = 0; k < pend; k++) {
      const v = Math.floor(r() * L);
      const a = (v / L) * Math.PI * 2;
      if (pts.some((p) => dist(p, [Math.cos(a) * 4.8, Math.sin(a) * 4.8]) < 1.8)) continue;
      pts.push([Math.cos(a) * 4.8, Math.sin(a) * 4.8]);
      edges.push([v, pts.length - 1]);
    }
    const net = placeNet(pts, edges, 'laço de gemas');
    if (!net) return null;
    const n = net.pts.length;
    const x = Math.floor(r() * L), w = (x + 1) % L;
    const sol = new Uint8Array(n);
    let st = 1;
    for (let k = 0; k < L; k++) {
      sol[(w + k) % L] = st;
      st ^= 1;
    }
    sol[x] = sol[w];
    for (let i = L; i < n; i++) sol[i] = r() < 0.5 ? 1 : 0;
    const cols = shuffle(r, COLORS);
    const core: Clue[] = [];
    let ci = 0;
    for (let k = 0; k < L; k++) {
      const v = (w + k) % L;
      if (v === x) core.push(gemClue(v, cols[0]));
      else core.push(gemClue(v, v === w ? cols[0] : cols[1 + (ci++ % 5)]));
    }
    // a colour may only appear once (except the twin pair) → drop extra gems if colours ran out
    const seen = new Map<string, number>();
    const core2 = core.filter((c) => {
      const col = (c.glyph as { color: string }).color;
      const k = seen.get(col) ?? 0;
      seen.set(col, k + 1);
      return col === cols[0] ? true : k === 0;
    });
    const pair = cols[0];
    return {
      net, sol, core: core2,
      note: `Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas ${COLOR_PT[pair]} lado a lado dividem o estado.`,
      witness: (d) => d.stars.slice(0, L).filter((s2) => s2.glyph?.kind === 'gem').length >= L - 2,
    };
  },

  /** Paridade do laço: every loop has an even number of cuts. */
  cutParity(r, size, shapes) {
    let net: Net | null;
    let ring: number[];
    if (shapes.length) {
      net = netFromShape(r, shapes, size);
      if (!net) return null;
      ring = longestCycle(net);
      if (ring.length < 5) return null;
    } else {
      const L = size;
      const pts: P[] = [];
      for (let i = 0; i < L; i++) {
        const a = (i / L) * Math.PI * 2;
        pts.push([Math.cos(a) * 3.2, Math.sin(a) * 3.2]);
      }
      const edges: [number, number][] = pts.map((_, i) => [i, (i + 1) % L]);
      if (r() < 0.6) {
        pts.push([0, 0]);
        edges.push([L, 0], [L, Math.floor(L / 2)]);
      }
      net = placeNet(pts, edges, 'laço');
      ring = [...Array(L).keys()];
    }
    if (!net) return null;
    const n = net.pts.length;
    const sol = randomSol(r, n, 0.5);
    const ek = (a: number, b: number) => net!.edges.findIndex(([u, v]) => (u === a && v === b) || (u === b && v === a));
    const ringEdges = ring.map((v, k) => ek(v, ring[(k + 1) % ring.length]));
    if (ringEdges.some((e) => e < 0)) return null;
    // leave two non-adjacent ring threads unmarked; one is decided by a local clue, the other by parity
    const L = ringEdges.length;
    const e1 = Math.floor(r() * L);
    const e2 = (e1 + 2 + Math.floor(r() * (L - 3))) % L;
    const core: Clue[] = [];
    ringEdges.forEach((e, k) => {
      if (k !== e1 && k !== e2) core.push(markClue(net!, sol, e));
    });
    // a contour clue at an endpoint of e2's far side makes e2 matter
    const [ea] = net.edges[ringEdges[e2]];
    core.push(glyphClue('contour', ea, contourCount(tmpDef(net), sol, ea)));
    return {
      net, sol, core,
      note: 'Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela.',
      witness: (d) => ringEdges.filter((e) => d.threads[e].mark).length >= L - 3 && ringEdges.some((e) => !d.threads[e].mark),
    };
  },

  /** Corrente de nós: a chain of knots is one region; the measure says where it ends. */
  knotChain(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['lattice', 'triLattice', 'cluster', 'ladder'], size);
    if (!net) return null;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    // random simple path of length 3..5
    const len = 3 + Math.floor(r() * 3);
    let path: number[] = [];
    for (let tries = 0; tries < 30 && path.length < len; tries++) {
      path = [Math.floor(r() * n)];
      while (path.length < len) {
        const nb = adj[path[path.length - 1]].filter((j) => !path.includes(j));
        if (!nb.length) break;
        path.push(pick(r, nb));
      }
    }
    if (path.length < 3) return null;
    const s = r() < 0.5 ? 1 : 0;
    const sol = randomSol(r, n, 0.5);
    for (const v of path) sol[v] = s;
    for (const v of path) for (const j of adj[v]) if (!path.includes(j)) sol[j] = 1 - s;
    const core: Clue[] = [];
    for (let k = 0; k < path.length - 1; k++) {
      const e = net.edges.findIndex(([u, v]) => (u === path[k] && v === path[k + 1]) || (v === path[k] && u === path[k + 1]));
      core.push({ kind: 'mark', thread: e, mark: 'same' });
    }
    const end = path[path.length - 1];
    core.push(glyphClue('measure', end, path.length));
    return {
      net, sol, core,
      note: `Corrente de nós: as estrelas amarradas formam uma região só — e a medida ${path.length} diz que ela termina ali; todo fio que sai dela é um corte.`,
      witness: (d) => d.stars[end].glyph?.kind === 'measure' && d.threads.filter((t) => t.mark === 'same').length >= 2,
    };
  },

  /** Famílias entrelaçadas: one family passes through the hub, the other goes around the rim. */
  interleaved(r, size) {
    const m = Math.max(7, size - 1);
    const pts: P[] = [[0, 0]];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      pts.push([Math.cos(a) * 3.3, Math.sin(a) * 3.3]);
    }
    const edges: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      edges.push([1 + i, 1 + ((i + 1) % m)]);
      edges.push([0, 1 + i]);
    }
    const net = placeNet(pts, edges, 'roda entrelaçada');
    if (!net) return null;
    const n = net.pts.length;
    const s = r() < 0.5 ? 1 : 0; // hub family state
    const p = 1 + Math.floor(r() * m);
    const half = Math.floor(m / 2);
    const q = 1 + ((p - 1 + half) % m);
    // arc1 from p to q going forward contains m1; arc2 is the other way (A family goes around arc2)
    const arc1: number[] = [];
    for (let k = 1; k < half; k++) arc1.push(1 + ((p - 1 + k) % m));
    const arc2: number[] = [];
    for (let k = 1; k < m - half; k++) arc2.push(1 + ((q - 1 + k) % m));
    if (!arc1.length || !arc2.length) return null;
    const m1 = pick(r, arc1);
    const sol = new Uint8Array(n);
    sol[0] = s;
    sol[m1] = s;
    for (const v of [p, q, ...arc2]) sol[v] = 1 - s;
    for (const v of arc1) if (v !== m1) sol[v] = r() < 0.5 ? 1 : 0;
    const cols = shuffle(r, COLORS);
    return {
      net, sol,
      core: [gemClue(p, cols[0]), gemClue(q, cols[0]), gemClue(m1, cols[1]), gemClue(0, cols[1])],
      note: `Famílias entrelaçadas: as gemas ${COLOR_PT[cols[0]]} e ${COLOR_PT[cols[1]]} se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto.`,
      witness: (d) => d.stars[0].glyph?.kind === 'gem' && [p, q, m1].every((v) => d.stars[v].glyph?.kind === 'gem'),
    };
  },

  /** Janelas quase iguais: two hubs that see almost the same stars. */
  theta(r, size) {
    const k = Math.max(3, Math.min(5, size - 4));
    const pts: P[] = [[-1.7, 0], [1.7, 0]];
    const edges: [number, number][] = [[0, 1]];
    const ys = [2.1, -2.1, 4.2, -4.2, 6.0].slice(0, k);
    for (const y of ys) {
      pts.push([0, y]);
      edges.push([0, pts.length - 1], [1, pts.length - 1]);
    }
    // private stars
    const priv = 1 + Math.floor(r() * 2);
    for (let i = 0; i < priv; i++) {
      const side = i % 2 ? 1 : -1;
      pts.push([side * 4.3, (r() - 0.5) * 2]);
      edges.push([side < 0 ? 0 : 1, pts.length - 1]);
    }
    const net = placeNet(pts, edges, 'janelas gêmeas');
    if (!net) return null;
    const sol = randomSol(r, net.pts.length, 0.5);
    const def = tmpDef(net);
    return {
      net, sol, core: [glyphClue('mosaic', 0, mosaicCount(def, sol, 0)), glyphClue('mosaic', 1, mosaicCount(def, sol, 1))],
      note: 'Janelas quase iguais: os dois centros enxergam as mesmas estrelas, menos as suas próprias — subtraia uma janela da outra.',
      witness: (d) => d.stars[0].glyph?.kind === 'mosaic' && d.stars[1].glyph?.kind === 'mosaic',
    };
  },

  /** Triângulos: every triangle has 0 or 2 borders. */
  triangleContour(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['dense', 'triLattice', 'wheel', 'coroa', 'lanterna'], size);
    if (!net) return null;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const ears = [...Array(n).keys()].filter((v) => adj[v].length === 2 && adj[adj[v][0]].includes(adj[v][1]));
    if (!ears.length) return null;
    const x = pick(r, ears);
    const [y, z] = adj[x];
    const sol = randomSol(r, n, 0.5);
    // contour 1 at the ear: exactly one of y,z differs → y and z disagree
    sol[y] = sol[x];
    sol[z] = 1 - sol[x];
    const def = tmpDef(net);
    return {
      net, sol, core: [glyphClue('contour', x, 1), glyphClue('contour', y, contourCount(def, sol, y))],
      note: 'Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si.',
      witness: (d) => d.stars[x].glyph?.kind === 'contour' && (d.stars[x].glyph as { n: number }).n === 1,
    };
  },

  /** A soma par: the sum of all contours is twice the number of cut threads. */
  contourSum(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['ring', 'wheel', 'ladder', 'lattice'], size);
    if (!net) return null;
    const sol = randomSol(r, net.pts.length, 0.5);
    const def = tmpDef(net);
    const n = net.pts.length;
    const skip = Math.floor(r() * n);
    const core = [...Array(n).keys()].filter((i) => i !== skip).map((i) => glyphClue('contour', i, contourCount(def, sol, i)));
    return {
      net, sol, core,
      note: 'A soma de todos os contornos é sempre par (cada fio cortado conta duas vezes) — a estrela sem número se descobre contando.',
      witness: (d) => d.stars.filter((st) => st.glyph?.kind === 'contour').length >= n - 3,
    };
  },

  /** A gema solitária: a unique colour on a busy star needs a world of its own. */
  singleton(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['cluster', 'wheel', 'flor', 'dense'], size);
    if (!net) return null;
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const v = [...Array(n).keys()].sort((a, b) => adj[b].length - adj[a].length)[0];
    if (adj[v].length < 4) return null;
    const sol = randomSol(r, n, 0.5);
    for (const j of adj[v]) sol[j] = 1 - sol[v];
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const cols = shuffle(r, COLORS);
    const others = shuffle(r, members.map((_, k) => k).filter((k) => k !== reg[v])).slice(0, 3);
    const core: Clue[] = [gemClue(v, cols[0])];
    others.forEach((rid, k) => {
      const ms = members[rid];
      core.push(gemClue(pick(r, ms), cols[1 + k]));
    });
    return {
      net, sol, core,
      note: `A gema solitária: a ${COLOR_PT[cols[0]]} é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto.`,
      witness: (d) => d.stars[v].glyph?.kind === 'gem',
    };
  },

  // ── echo ──

  /** Eco na árvore: a leaf only flips itself and its parent. */
  echoTree(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['tree', 'arms', 'serpente'], size);
    if (!net || !isTree(net)) return null;
    return { net, sol: new Uint8Array(net.pts.length).fill(1), core: [], echo: true, allLit: true, note: 'Eco na árvore: cada folha só mexe nela e no pai — resolva de fora para dentro.' };
  },

  /** Anel de eco: on a ring, pressing changes three stars at a time. */
  echoRingLit(r, size) {
    const L = size % 3 === 0 ? size + 1 : size;
    const pts: P[] = [];
    for (let i = 0; i < L; i++) {
      const a = (i / L) * Math.PI * 2;
      pts.push([Math.cos(a) * 3, Math.sin(a) * 3]);
    }
    const net = placeNet(pts, pts.map((_, i) => [i, (i + 1) % L]), 'anel de eco');
    if (!net) return null;
    return { net, sol: new Uint8Array(L).fill(1), core: [], echo: true, allLit: true, note: 'Anel de eco: cada toque vira três estrelas; como o anel não é múltiplo de três, só existe um jeito de acender tudo.' };
  },

  /** Eco + lógica: deduce the picture from the rules, then chase it with echoes. */
  echoLogic(r, size, shapes) {
    const net = netFromShape(r, shapes.length ? shapes : ['tree', 'arms', 'ring', 'wheel'], size);
    if (!net) return null;
    const def0 = tmpDef(net, true);
    if (parityChecks(def0).length) return null; // every picture reachable: the challenge is two-stage
    const sol = initialState(def0);
    for (let i = 0; i < net.pts.length; i++) if (r() < 0.5) press(def0, sol, i);
    const tree = isTree(net);
    return {
      net, sol, core: [], echo: true,
      note: tree
        ? 'Duas etapas: primeiro descubra o desenho pelas regras; depois persiga-o com ecos, das folhas para dentro.'
        : 'Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira.',
      witness: (d) => d.stars.some((st) => st.glyph) && (pressesFor(d, sol)?.length ?? 0) >= 3,
    };
  },

  /** Eco + regras: the static rules admit two answers, but only one can be reached. */
  echoReach(r, size, shapes) {
    let net: Net | null;
    if (shapes.length) net = netFromShape(r, shapes, size);
    else {
      // ring of 3k (singular press matrix) with optional pendants
      const L = Math.max(6, size - (size % 3));
      const pts: P[] = [];
      for (let i = 0; i < L; i++) {
        const a = (i / L) * Math.PI * 2;
        pts.push([Math.cos(a) * 3.1, Math.sin(a) * 3.1]);
      }
      const edges: [number, number][] = pts.map((_, i) => [i, (i + 1) % L]);
      if (r() < 0.5) {
        pts.push([0, 0]);
        edges.push([L, 0], [L, L / 3], [L, (2 * L) / 3]);
      }
      net = placeNet(pts, edges, 'anel de três');
    }
    if (!net) return null;
    const def0 = tmpDef(net, true);
    if (!parityChecks(def0).length) return null; // need unreachable patterns
    const sol = initialState(def0);
    for (let i = 0; i < net.pts.length; i++) if (r() < 0.5) press(def0, sol, i);
    return {
      net, sol, core: [], echo: true, needStaticAmbiguity: true,
      note: 'Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui.',
    };
  },
};

// ───────────────────────── finishing an instance ─────────────────────────

interface Slot {
  tpl: string;
  size: number;
  shapes?: string[];
  extras: Partial<Record<ClueKind, number>>;
  warm?: boolean;
  show?: boolean;
  /** minimal reasoning required: lookaheads + 3·deep */
  depth?: number;
}

interface Built {
  def: ConstellationDef;
  raw: number;
  shape: string;
  sol: Uint8Array;
  depth: number;
}

function finish(id: string, area: AreaId, slot: Slot, inst: Instance, r: Rng): Built | null {
  const { net, sol, core } = inst;
  const echo = !!inst.echo;
  let def: ConstellationDef;
  if (inst.allLit) {
    def = buildDef(id, area, net, [], echo);
    if (!reachable(def, sol)) return null;
    const pr = pressesFor(def, sol);
    if (!pr || pr.length < 2) return null;
  } else {
    if (echo && !reachable(tmpDef(net, true), sol)) return null;
    const base = buildDef(id, area, net, [], echo);
    // pin gem colours used by the core to their regions
    const { id: reg } = regionsOf(base, sol);
    const fixed = new Map<number, GemColor>();
    for (const c of core) if (c.kind === 'gem') fixed.set(reg[c.star!], (c.glyph as { color: GemColor }).color);
    const coreStars = new Set(core.filter((c) => c.star !== undefined && c.kind !== 'lock').map((c) => c.star!));
    const coreThreads = new Set(core.filter((c) => c.kind === 'mark').map((c) => c.thread!));
    const kinds = (Object.keys(slot.extras) as ClueKind[]).filter((k) => (slot.extras[k] ?? 0) > 0);
    const pool = candidateClues(base, sol, kinds, r, fixed).filter((c) => (c.star === undefined || !coreStars.has(c.star)) && (c.thread === undefined || !coreThreads.has(c.thread)));
    // initial: core + one weighted extra glyph on ~45% of the other stars
    const chosen: Clue[] = [...core];
    const byStar = new Map<number, Clue[]>();
    for (const c of pool) if (c.star !== undefined && c.kind !== 'lock') (byStar.get(c.star) ?? byStar.set(c.star, []).get(c.star)!).push(c);
    for (const [, list] of byStar) {
      if (r() > 0.45) continue;
      const w = list.map((c) => slot.extras[c.kind] ?? 0);
      const tot = w.reduce((a, b) => a + b, 0);
      let x = r() * tot;
      for (let k = 0; k < list.length; k++) {
        x -= w[k];
        if (x <= 0) {
          chosen.push(list[k]);
          break;
        }
      }
    }
    const marks = pool.filter((c) => c.kind === 'mark');
    const locks = shuffle(r, candidateClues(base, sol, ['lock'], r));
    const others = shuffle(r, pool.filter((c) => c.kind !== 'mark' && c.kind !== 'lock' && !chosen.includes(c) && !chosen.some((h) => h.star === c.star)));
    let guard = 0;
    while (!uniqueWith(id, area, net, chosen, echo, sol) && guard++ < 80) {
      const unusedMarks = marks.filter((m) => !chosen.includes(m));
      const w = slot.extras.mark ?? 0;
      if (unusedMarks.length && w > 0 && r() < Math.min(0.85, 0.25 + w)) chosen.push(pick(r, unusedMarks));
      else if (others.length) {
        const c = others.shift()!;
        if (!chosen.some((h) => h.star === c.star && h.kind !== 'lock' && h.kind !== 'mark')) chosen.push(c);
      } else if (locks.length && chosen.filter((c) => c.kind === 'lock').length < 1) chosen.push(locks.shift()!);
      else if (unusedMarks.length) chosen.push(pick(r, unusedMarks));
      else return null;
    }
    if (!uniqueWith(id, area, net, chosen, echo, sol)) return null;
    // minimise: extras first, then core clues as long as the insight witness still holds
    for (const c of shuffle(r, chosen.filter((c) => !core.includes(c)))) {
      const trial = chosen.filter((x) => x !== c);
      if (uniqueWith(id, area, net, trial, echo, sol)) chosen.splice(chosen.indexOf(c), 1);
    }
    for (const c of shuffle(r, chosen.filter((c) => core.includes(c)))) {
      const trial = chosen.filter((x) => x !== c);
      if (!uniqueWith(id, area, net, trial, echo, sol)) continue;
      const d2 = buildDef(id, area, net, trial, echo);
      if (!inst.witness || inst.witness(d2)) chosen.splice(chosen.indexOf(c), 1);
    }
    def = buildDef(id, area, net, chosen, echo);
    if (!def.stars.some((s) => s.glyph) && !def.threads.some((t) => t.mark)) return null;
  }
  if (inst.witness && !inst.witness(def)) return null;
  if (checkConstellation(def, initialState(def)).ok) return null;
  if (inst.needStaticAmbiguity) {
    const stat = solveConstellation({ ...def, echo: false }, { maxSolutions: 2, nodeLimit: 400_000 });
    if (stat.solutions.length < 2) return null;
  }
  const rep = estimateDifficulty(def, sol);
  if (!rep.solvedByLogic) return null;
  const depth = rep.lookaheads + 3 * rep.deep + (inst.needStaticAmbiguity ? 2 : 0) + (def.echo ? Math.floor(rep.presses / 2) : 0);
  if (!slot.warm && depth < (slot.depth ?? 1)) return null;
  def.bell = placeBell(def);
  def.note = inst.note;
  const n = def.stars.length;
  // difficulty grows with reasoning, not with size
  const raw = 0.8 + 0.03 * n + 0.12 * rep.rounds + 1.1 * rep.lookaheads + 2.8 * rep.deep + (def.echo ? 0.4 + 0.3 * rep.presses : 0) + (inst.needStaticAmbiguity ? 1.2 : 0);
  return { def, raw, shape: net.shape, sol, depth };
}

// ───────────────────────── bell ─────────────────────────

function placeBell(def: ConstellationDef): { x: number; z: number } {
  const pts: P[] = def.stars.map((s) => [s.x, s.z]);
  let best: { x: number; z: number } | null = null;
  let bestScore = -Infinity;
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const dir: P = [Math.cos(a), Math.sin(a)];
    let ext = 0;
    for (const p of pts) ext = Math.max(ext, p[0] * dir[0] + p[1] * dir[1]);
    for (const off of [1.4, 1.8, 2.3]) {
      const d = Math.min(ext + off, 8.6);
      const b: P = [+(dir[0] * d).toFixed(2), +(dir[1] * d).toFixed(2)];
      let clear = Infinity;
      for (const p of pts) clear = Math.min(clear, dist(p, b));
      for (const t of def.threads) clear = Math.min(clear, pointSegDist(b, pts[t.a], pts[t.b]) + 0.3);
      if (clear < 1.2) continue;
      const score = Math.min(clear, 2.5) + 1.2 * dir[1] - 0.1 * off;
      if (score > bestScore) {
        bestScore = score;
        best = { x: b[0], z: b[1] };
      }
    }
  }
  return best ?? { x: 0, z: 8 };
}

// ───────────────────────── plans per area ─────────────────────────

const S = (tpl: string, size: number, extras: Partial<Record<ClueKind, number>>, o: Partial<Slot> = {}): Slot => ({ tpl, size, extras, ...o });

const PLANS: Partial<Record<AreaId, Slot[]>> = {
  hub: [
    S('bridgeKin', 9, { gem: 1, measure: 0.5 }, { depth: 1 }),
    S('hubMosaic', 9, { mosaic: 1, contour: 0.5 }, { depth: 1 }),
    S('oddRingContour', 7, { measure: 1, mosaic: 0.5 }, { depth: 1 }),
    S('knotChain', 11, { measure: 1, contour: 0.6, mark: 0.2 }, { depth: 2 }),
    S('singleton', 10, { gem: 1, measure: 0.5 }, { depth: 2 }),
    S('interleaved', 9, { gem: 0.6, measure: 0.6 }, { depth: 2 }),
    S('theta', 8, { mosaic: 1, contour: 0.5 }, { depth: 2 }),
    S('cutParity', 9, { measure: 0.7, mosaic: 0.4 }, { depth: 3 }),
    S('triangleContour', 14, { contour: 1, measure: 0.6, mark: 0.2 }, { shapes: ['coroa', 'lanterna', 'barco'], show: true, depth: 8 }),
    S('bridgeKin', 13, { gem: 1, measure: 0.8, mark: 0.2 }, { shapes: ['borboleta', 'chave', 'peixe'], show: true, depth: 9 }),
  ],
  kinship: [
    S('warm', 5, { gem: 1 }, { shapes: ['chain'], warm: true }),
    S('warm', 6, { gem: 1 }, { shapes: ['ring', 'ladder'], warm: true }),
    S('bridgeKin', 8, { gem: 1 }, { depth: 1 }),
    S('hubKin', 7, { gem: 1 }, { depth: 1 }),
    S('oddRingKin', 5, { gem: 1 }, { depth: 1 }),
    S('singleton', 10, { gem: 1 }, { depth: 1 }),
    S('bridgeKin', 11, { gem: 1, measure: 0.4 }, { depth: 2 }),
    S('interleaved', 9, { gem: 1 }, { depth: 2 }),
    S('hubKin', 10, { gem: 1, measure: 0.4, mark: 0.1 }, { depth: 2 }),
    S('singleton', 12, { gem: 1, measure: 0.4 }, { shapes: ['dense', 'cluster', 'wheel'], depth: 2 }),
    S('oddRingKin', 7, { gem: 1, measure: 0.4 }, { depth: 2 }),
    S('bridgeKin', 12, { gem: 1, measure: 0.5 }, { depth: 3 }),
    S('interleaved', 10, { gem: 1, measure: 0.5 }, { depth: 3 }),
    S('bridgeKin', 12, { gem: 1, measure: 0.5, mark: 0.15 }, { shapes: ['borboleta', 'chave', 'peixe', 'pássaro'], show: true, depth: 3 }),
    S('interleaved', 11, { gem: 1, measure: 0.6, mark: 0.15 }, { show: true, depth: 4 }),
  ],
  measure: [
    S('warm', 5, { measure: 1 }, { shapes: ['chain'], warm: true }),
    S('warm', 6, { measure: 1 }, { shapes: ['tree', 'ring'], warm: true }),
    S('treeMeasure', 8, { measure: 1 }, { depth: 1 }),
    S('bridgeMeasure', 9, { measure: 1 }, { depth: 1 }),
    S('knotChain', 9, { measure: 1, mark: 0.15 }, { depth: 1 }),
    S('treeMeasure', 10, { measure: 1 }, { shapes: ['arms', 'serpente'], depth: 2 }),
    S('bridgeMeasure', 11, { measure: 1, contour: 0.3 }, { depth: 2 }),
    S('knotChain', 12, { measure: 1, mark: 0.2 }, { depth: 2 }),
    S('treeMeasure', 13, { measure: 1, contour: 0.3 }, { depth: 3 }),
    S('bridgeMeasure', 12, { measure: 1, contour: 0.4, mark: 0.1 }, { depth: 3 }),
    S('knotChain', 13, { measure: 1, mark: 0.25 }, { shapes: ['cluster', 'triLattice'], depth: 3 }),
    S('treeMeasure', 14, { measure: 1, contour: 0.4 }, { shapes: ['arms', 'tree'], depth: 3 }),
    S('bridgeMeasure', 13, { measure: 1, contour: 0.5, mark: 0.1 }, { depth: 4 }),
    S('knotChain', 12, { measure: 1, contour: 0.4, mark: 0.2 }, { shapes: ['casa', 'barco', 'coroa', 'lanterna'], show: true, depth: 5 }),
    S('bridgeMeasure', 13, { measure: 1, contour: 0.4, mark: 0.15 }, { shapes: ['chave', 'borboleta', 'peixe'], show: true, depth: 4 }),
  ],
  mold: [
    S('warm', 6, { measure: 1, contour: 1 }, { shapes: ['lattice', 'ladder'], warm: true }),
    S('hubContour', 8, { measure: 0.6, contour: 0.6 }, { shapes: ['wheel', 'arms'], depth: 1 }),
    S('knotChain', 9, { measure: 1, contour: 0.5, mark: 0.15 }, { shapes: ['lattice', 'ladder'], depth: 1 }),
    S('bridgeMeasure', 10, { measure: 1, contour: 0.5 }, { depth: 1 }),
    S('triangleContour', 10, { contour: 1, measure: 0.5 }, { shapes: ['triLattice', 'dense'], depth: 2 }),
    S('contourSum', 9, { measure: 0.4 }, { shapes: ['lattice', 'ladder'], depth: 1 }),
    S('treeMeasure', 11, { measure: 1, contour: 0.4 }, { shapes: ['arms', 'tree'], depth: 2 }),
    S('hubContour', 11, { measure: 0.8, contour: 0.8, mark: 0.1 }, { shapes: ['wheel', 'lanterna', 'flor'], depth: 3 }),
    S('contourSum', 11, { measure: 0.5 }, { shapes: ['lattice', 'triLattice'], depth: 2 }),
    S('knotChain', 12, { measure: 1, contour: 0.5, mark: 0.2 }, { shapes: ['triLattice', 'lattice'], depth: 3 }),
    S('triangleContour', 12, { contour: 1, measure: 0.6 }, { shapes: ['dense', 'triLattice'], depth: 3 }),
    S('triangleContour', 12, { contour: 1, measure: 0.6 }, { shapes: ['casa', 'coroa', 'barco'], show: true, depth: 3 }),
    S('bridgeMeasure', 13, { measure: 1, contour: 0.6, mark: 0.1 }, { shapes: ['chave', 'borboleta'], show: true, depth: 4 }),
  ],
  contour: [
    S('warm', 6, { contour: 1 }, { shapes: ['chain'], warm: true }),
    S('oddRingContour', 5, { contour: 0.5 }, { depth: 1 }),
    S('hubContour', 8, { contour: 1 }, { shapes: ['wheel', 'arms'], depth: 1 }),
    S('triangleContour', 9, { contour: 1 }, { shapes: ['wheel', 'dense'], depth: 1 }),
    S('oddRingContour', 7, { contour: 0.6, measure: 0.3 }, { depth: 2 }),
    S('contourSum', 9, {}, { shapes: ['ring', 'wheel', 'ladder'], depth: 1 }),
    S('hubContour', 11, { contour: 1, mark: 0.1 }, { shapes: ['flor', 'lanterna', 'wheel'], depth: 2 }),
    S('triangleContour', 12, { contour: 1, measure: 0.3 }, { shapes: ['triLattice', 'dense'], depth: 3 }),
    S('contourSum', 11, { measure: 0.3 }, { shapes: ['wheel', 'lattice', 'triLattice'], depth: 2 }),
    S('oddRingContour', 9, { contour: 0.7, measure: 0.4 }, { depth: 3 }),
    S('hubContour', 12, { contour: 1, measure: 0.3, mark: 0.1 }, { shapes: ['flor', 'arms', 'lanterna'], depth: 3 }),
    S('hubContour', 11, { contour: 1, measure: 0.5, mark: 0.1 }, { shapes: ['lanterna', 'flor', 'coroa'], show: true, depth: 4 }),
    S('triangleContour', 13, { contour: 1, measure: 0.4, mark: 0.1 }, { shapes: ['coroa', 'lanterna', 'barco'], show: true, depth: 4 }),
  ],
  mosaic: [
    S('warm', 6, { mosaic: 1 }, { shapes: ['chain'], warm: true }),
    S('leafMosaic', 7, { mosaic: 1 }, { shapes: ['arms'], depth: 1 }),
    S('hubMosaic', 8, { mosaic: 1 }, { shapes: ['wheel'], depth: 1 }),
    S('leafMosaic', 9, { mosaic: 1 }, { shapes: ['tree'], depth: 1 }),
    S('theta', 7, { mosaic: 1 }, { depth: 1 }),
    S('hubMosaic', 10, { mosaic: 1 }, { shapes: ['wheel', 'arms'], depth: 2 }),
    S('leafMosaic', 12, { mosaic: 1 }, { shapes: ['arms', 'tree'], depth: 2 }),
    S('theta', 9, { mosaic: 1, contour: 0.3 }, { depth: 2 }),
    S('hubMosaic', 11, { mosaic: 1, contour: 0.5 }, { shapes: ['wheel', 'lanterna'], depth: 4 }),
    S('leafMosaic', 13, { mosaic: 1, contour: 0.5 }, { shapes: ['arms', 'tree', 'serpente'], depth: 4 }),
    S('hubMosaic', 12, { mosaic: 1, contour: 0.6 }, { shapes: ['wheel', 'lanterna'], depth: 5 }),
    S('hubMosaic', 12, { mosaic: 1, contour: 0.6, mark: 0.1 }, { shapes: ['wheel', 'flor', 'arms'], depth: 5 }),
    S('leafMosaic', 14, { mosaic: 1, contour: 0.6 }, { shapes: ['arms', 'tree'], depth: 5 }),
    S('hubMosaic', 11, { mosaic: 1, contour: 0.6 }, { shapes: ['flor', 'lanterna'], show: true, depth: 6 }),
    S('hubMosaic', 11, { mosaic: 1, contour: 0.6, mark: 0.1 }, { shapes: ['coroa', 'barco', 'casa', 'borboleta'], show: true, depth: 6 }),
  ],
  beacon: [
    S('warm', 6, { mosaic: 1, contour: 0.5 }, { shapes: ['arms', 'chain'], warm: true }),
    S('leafMosaic', 7, { mosaic: 1, contour: 0.3 }, { shapes: ['arms'], depth: 1 }),
    S('hubContour', 8, { contour: 1, mosaic: 0.4 }, { shapes: ['arms', 'wheel'], depth: 1 }),
    S('hubMosaic', 9, { mosaic: 1, contour: 0.4 }, { shapes: ['wheel'], depth: 1 }),
    S('cutParity', 7, { mosaic: 0.5, contour: 0.5 }, { depth: 1 }),
    S('leafMosaic', 12, { mosaic: 1, contour: 0.4 }, { shapes: ['arms'], depth: 2 }),
    S('theta', 8, { mosaic: 1, contour: 0.4 }, { depth: 2 }),
    S('hubContour', 11, { contour: 1, mosaic: 0.5, mark: 0.15 }, { shapes: ['wheel', 'arms'], depth: 2 }),
    S('cutParity', 9, { mosaic: 0.6, contour: 0.6 }, { depth: 3 }),
    S('hubMosaic', 12, { mosaic: 1, contour: 0.5 }, { shapes: ['arms', 'wheel'], depth: 3 }),
    S('leafMosaic', 13, { mosaic: 1, contour: 0.5 }, { shapes: ['arms', 'tree'], depth: 3 }),
    S('hubMosaic', 11, { mosaic: 1, contour: 0.5 }, { shapes: ['lanterna', 'flor'], show: true, depth: 3 }),
    S('hubContour', 11, { contour: 1, mosaic: 0.6, mark: 0.1 }, { shapes: ['flor', 'coroa', 'barco'], show: true, depth: 6 }),
  ],
  weave: [
    S('warm', 5, { mark: 1 }, { shapes: ['chain'], warm: true }),
    S('warm', 6, { mark: 1 }, { shapes: ['ladder'], warm: true }),
    S('cutParity', 6, { measure: 0.5 }, { depth: 1 }),
    S('knotChain', 8, { measure: 1, mark: 0.2 }, { shapes: ['lattice', 'ladder'], depth: 1 }),
    S('cutParity', 8, { measure: 0.6 }, { depth: 1 }),
    S('knotChain', 10, { measure: 1, mark: 0.25 }, { shapes: ['lattice', 'triLattice'], depth: 2 }),
    S('cutParity', 7, { measure: 0.6, contour: 0.4 }, { depth: 2 }),
    S('knotChain', 12, { measure: 1, contour: 0.4, mark: 0.25 }, { shapes: ['cluster', 'lattice'], depth: 2 }),
    S('cutParity', 9, { measure: 0.7, contour: 0.4 }, { depth: 3 }),
    S('knotChain', 13, { measure: 1, contour: 0.5, mark: 0.3 }, { shapes: ['triLattice', 'cluster', 'dense'], depth: 3 }),
    S('cutParity', 10, { measure: 0.7, contour: 0.5 }, { depth: 3 }),
    S('knotChain', 14, { measure: 1, contour: 0.5, mark: 0.3 }, { shapes: ['dense', 'cluster'], depth: 3 }),
    S('cutParity', 11, { measure: 0.7, contour: 0.5 }, { depth: 4 }),
    S('cutParity', 11, { measure: 0.7, contour: 0.6 }, { shapes: ['peixe', 'crescente', 'casa', 'coroa'], show: true, depth: 6 }),
    S('knotChain', 12, { measure: 1, contour: 0.5, mark: 0.3 }, { shapes: ['casa', 'chave', 'barco'], show: true, depth: 4 }),
  ],
  twins: [
    S('echoRingLit', 4, {}, { warm: true }),
    S('echoTree', 5, {}, { shapes: ['chain'], warm: true }),
    S('echoRingLit', 5, {}, { depth: 1 }),
    S('echoTree', 7, {}, { shapes: ['arms', 'tree'], depth: 1 }),
    S('echoRingLit', 7, {}, { depth: 2 }),
    S('echoLogic', 9, { mosaic: 1, contour: 0.4 }, { shapes: ['tree', 'arms'], depth: 2 }),
    S('echoReach', 6, { mosaic: 1, contour: 0.6 }, { depth: 1 }),
    S('echoLogic', 8, { contour: 1, mosaic: 0.5 }, { shapes: ['ring', 'wheel'], depth: 3 }),
    S('echoReach', 9, { mosaic: 1, measure: 0.5 }, { depth: 2 }),
    S('echoLogic', 11, { mosaic: 1, measure: 0.5 }, { shapes: ['arms', 'tree'], depth: 4 }),
    S('echoReach', 9, { mosaic: 1, contour: 0.6 }, { shapes: ['cluster', 'wheel', 'ladder'], depth: 2 }),
    S('echoReach', 12, { mosaic: 1, contour: 0.6, measure: 0.4 }, { depth: 3 }),
    S('echoReach', 10, { mosaic: 1, contour: 0.6, measure: 0.4 }, { shapes: ['lattice', 'ladder'], depth: 3 }),
    S('echoReach', 11, { mosaic: 1, contour: 0.6, mark: 0.1 }, { shapes: ['pássaro', 'coroa', 'chave'], show: true, depth: 3 }),
    S('echoReach', 11, { mosaic: 1, contour: 0.7, measure: 0.4 }, { shapes: ['peixe', 'crescente', 'casa'], show: true, depth: 4 }),
  ],
  citadel: [
    S('cutParity', 9, { gem: 0.6, measure: 0.6 }, { depth: 2 }),
    S('hubKin', 10, { gem: 1, measure: 0.5, mark: 0.2 }, { depth: 2 }),
    S('bridgeMeasure', 12, { measure: 1, contour: 0.5, mark: 0.2 }, { depth: 3 }),
    S('interleaved', 10, { gem: 1, mosaic: 0.4, mark: 0.15 }, { depth: 3 }),
    S('theta', 9, { mosaic: 1, contour: 0.6, mark: 0.15 }, { depth: 3 }),
    S('oddRingKin', 7, { gem: 1, measure: 0.6, mark: 0.15 }, { depth: 3 }),
    S('triangleContour', 13, { contour: 1, mosaic: 0.5, mark: 0.2 }, { shapes: ['dense', 'triLattice'], depth: 4 }),
    S('singleton', 12, { gem: 1, mosaic: 0.5, mark: 0.2 }, { shapes: ['dense', 'cluster'], depth: 4 }),
    S('knotChain', 14, { measure: 1, gem: 0.5, contour: 0.4, mark: 0.3 }, { shapes: ['cluster', 'dense', 'triLattice'], depth: 4 }),
    S('oddRingContour', 9, { contour: 0.6, gem: 0.6, mark: 0.2 }, { depth: 4 }),
    S('bridgeKin', 14, { gem: 1, measure: 0.7, mark: 0.25 }, { shapes: ['chave', 'borboleta', 'peixe', 'pássaro'], show: true, depth: 5 }),
    S('interleaved', 12, { gem: 1, mosaic: 0.6, measure: 0.4, mark: 0.2 }, { show: true, depth: 5 }),
  ],
  echo: [
    S('echoRingLit', 8, {}, { depth: 2 }),
    S('echoTree', 10, {}, { shapes: ['arms', 'tree'], depth: 2 }),
    S('echoReach', 9, { mosaic: 1, contour: 0.6, measure: 0.4 }, { depth: 2 }),
    S('echoReach', 12, { mosaic: 1, contour: 0.6, measure: 0.4 }, { shapes: ['lattice', 'ladder'], depth: 3 }),
    S('echoReach', 12, { mosaic: 1, contour: 0.6, measure: 0.4, mark: 0.1 }, { shapes: ['cluster', 'dense'], depth: 3 }),
    S('echoLogic', 11, { mosaic: 1, contour: 0.6, measure: 0.4 }, { shapes: ['tree', 'wheel', 'ring', 'arms'], depth: 5 }),
    S('echoReach', 12, { mosaic: 1, contour: 0.7, measure: 0.5 }, { depth: 4 }),
    S('echoReach', 13, { mosaic: 1, contour: 0.7, measure: 0.5, gem: 0.3 }, { shapes: ['dense', 'cluster', 'triLattice'], depth: 4 }),
    S('echoReach', 11, { mosaic: 1, contour: 0.7, measure: 0.5, mark: 0.1 }, { shapes: ['crescente', 'coroa', 'serpente'], show: true, depth: 4 }),
    S('echoReach', 13, { mosaic: 1, contour: 0.7, measure: 0.5, gem: 0.4 }, { shapes: ['pássaro', 'peixe', 'chave'], show: true, depth: 5 }),
  ],
};

// ───────────────────────── handcrafted discovery ramp (prologue) ─────────────────────────

function prologueSet(): ConstellationDef[] {
  return [
    {
      id: 'prologue.c01', area: 'prologue', difficulty: 1,
      note: 'Descoberta: três conchas ligadas por fios. Sem nenhum glifo, a constelação só quer todas as estrelas acesas — e o sino canta.',
      stars: [{ x: -2.2, z: 0.4 }, { x: 0, z: -0.6 }, { x: 2.2, z: 0.4 }],
      threads: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
      bell: { x: 0, z: 2.2 },
    },
    {
      id: 'prologue.c02', area: 'prologue', difficulty: 2, echo: true,
      note: 'Eco: apertar uma estrela vira também as vizinhas. Acender as quatro = apertar só as duas pontas.',
      stars: [{ x: -3.3, z: 0 }, { x: -1.1, z: -0.5 }, { x: 1.1, z: 0.5 }, { x: 3.3, z: 0 }],
      threads: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }],
      bell: { x: 0, z: 2.4 },
    },
    {
      id: 'prologue.c03', area: 'prologue', difficulty: 2,
      note: 'A linguagem secreta: o fio cortado quer pontas diferentes, o nó quer pontas iguais. Ninguém explica — quando erra, quem pisca é o fio.',
      stars: [{ x: -2.2, z: 0.6 }, { x: 0, z: -0.5 }, { x: 2.2, z: 0.6 }],
      threads: [{ a: 0, b: 1, mark: 'diff' }, { a: 1, b: 2, mark: 'same' }],
      bell: { x: 0, z: 2.4 },
    },
    {
      id: 'prologue.c04', area: 'prologue', difficulty: 3,
      note: 'Um laço de quatro com dois cortes e dois nós: cortes em número par fecham o laço. A estaca acesa decide o resto.',
      stars: [{ x: 0, z: -2.4, lock: 1 }, { x: 0, z: 0 }, { x: -2.2, z: 1.6 }, { x: 2.2, z: 1.6 }],
      threads: [{ a: 0, b: 1, mark: 'same' }, { a: 1, b: 2, mark: 'diff' }, { a: 1, b: 3, mark: 'diff' }, { a: 2, b: 3, mark: 'same' }],
      bell: { x: 0, z: 3.6 },
    },
  ];
}

// ───────────────────────── generation ─────────────────────────

function generateSlot(id: string, area: AreaId, slot0: Slot, seed: number, used: Built[], targetDepth: number): Built {
  const tpl = T[slot0.tpl];
  // if the requested depth is out of reach for this template, relax it step by step
  for (let relax = 0; relax <= 4; relax++) {
    const slot: Slot = { ...slot0, depth: Math.max(1, (slot0.depth ?? 1) - relax), size: slot0.size + (relax >= 2 ? 1 : 0) };
    let best: Built | null = null;
    let bestScore = -Infinity;
    const attempts = (slot.show ? 900 : 500) * (1 + relax);
    const r = mulberry(seed + relax * 7);
    let found = 0;
    const cap = (slot.show ? 14 : 8) + Math.round(2 * targetDepth);
    for (let k = 0; k < attempts && found < cap; k++) {
      const inst = tpl(r, slot.size + Math.floor(r() * 3) - 1, slot.shapes ?? []);
      if (!inst) continue;
      const b = finish(id, area, slot, inst, r);
      if (!b) continue;
      found++;
      const repeats = used.filter((u) => u.shape === b.shape).length;
      const clues = b.def.stars.filter((s) => s.glyph).length + b.def.threads.filter((t) => t.mark).length;
      // aim at the slot's target reasoning depth (the ramp), then prefer small, sparse, varied
      const score = -1.0 * Math.abs(b.depth - targetDepth) - 0.05 * b.def.stars.length - 0.1 * clues - 0.7 * repeats + (slot.warm ? -0.5 * b.raw : 0);
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (best) {
      if (relax) console.log(`  (${id} ${slot0.tpl}: depth relaxed by ${relax})`);
      return best;
    }
  }
  throw new Error(`could not generate ${id} (${slot0.tpl})`);
}

function toDifficulty(raw: number): number {
  return Math.max(1, Math.min(10, Math.round(raw * 0.68)));
}

function emit(all: ConstellationDef[]): string {
  const lines: string[] = [];
  lines.push('// GENERATED by tools/gen-constellations.ts — do not edit by hand.');
  lines.push('// The secret layer: 150 constellations hidden across the island (see docs/CONSTELLATIONS.md).');
  lines.push("import type { ConstellationDef } from '../secret/types';");
  lines.push('');
  lines.push('export const CONSTELLATIONS: ConstellationDef[] = [');
  for (const d of all) {
    lines.push('  {');
    lines.push(`    id: '${d.id}', area: '${d.area}', difficulty: ${d.difficulty},${d.echo ? ' echo: true,' : ''}`);
    if (d.note) lines.push(`    note: ${JSON.stringify(d.note)},`);
    lines.push('    stars: [');
    for (const s of d.stars) {
      const parts = [`x: ${s.x}`, `z: ${s.z}`];
      if (s.glyph) parts.push(`glyph: ${s.glyph.kind === 'gem' ? `{ kind: 'gem', color: '${s.glyph.color}' }` : `{ kind: '${s.glyph.kind}', n: ${s.glyph.n} }`}`);
      if (s.lock !== undefined) parts.push(`lock: ${s.lock}`);
      lines.push(`      { ${parts.join(', ')} },`);
    }
    lines.push('    ],');
    const th = d.threads.map((t) => (t.mark ? `{ a: ${t.a}, b: ${t.b}, mark: '${t.mark}' }` : `{ a: ${t.a}, b: ${t.b} }`));
    lines.push('    threads: [');
    for (let k = 0; k < th.length; k += 4) lines.push(`      ${th.slice(k, k + 4).join(', ')},`);
    lines.push('    ],');
    lines.push(`    bell: { x: ${d.bell.x}, z: ${d.bell.z} },`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

// ───────────────────────── main ─────────────────────────

const ONLY = process.argv.find((a) => a.startsWith('--area='))?.slice(7);
const ORDER: AreaId[] = (['prologue', 'hub', 'kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins', 'citadel', 'echo'] as AreaId[]).filter((a) => !ONLY || a === ONLY);
const EXPECT: Record<string, number> = { prologue: 4, hub: 10, kinship: 15, measure: 15, mold: 13, contour: 13, mosaic: 15, beacon: 13, weave: 15, twins: 15, citadel: 12, echo: 10 };
const t0 = Date.now();
const all: ConstellationDef[] = [];
const stats: string[] = [];
ORDER.forEach((area, ai) => {
  const ta = Date.now();
  if (area === 'prologue') {
    all.push(...prologueSet());
    stats.push('prologue: 4 handcrafted');
    return;
  }
  const plan = PLANS[area]!;
  if (plan.length !== EXPECT[area]) throw new Error(`${area}: plan has ${plan.length}, expected ${EXPECT[area]}`);
  const built: Built[] = [];
  const brutal = area === 'citadel' || area === 'echo' ? 1.35 : area === 'hub' ? 1.5 : 1;
  const N = plan.length;
  plan.forEach((slot, i) => {
    const id = `${area}.c${String(i + 1).padStart(2, '0')}`;
    const t = N > 1 ? i / (N - 1) : 1;
    const target = slot.warm ? 1 : (2 + (slot.show ? 9.5 : 7.5) * Math.pow(t, 1.1)) * brutal;
    const b = generateSlot(id, area, slot, (ai + 1) * 100_003 + i * 7919, built, target);
    built.push(b);
  });
  // final order: warm-ups, then the ramp by difficulty, showpieces last
  const rank = (b: Built) => (plan[built.indexOf(b)].warm ? 0 : plan[built.indexOf(b)].show ? 2 : 1);
  const ordered = built.slice().sort((x, y) => rank(x) - rank(y) || x.raw - y.raw);
  let prev = 1;
  ordered.forEach((b, k) => {
    b.def.id = `${area}.c${String(k + 1).padStart(2, '0')}`;
    b.def.difficulty = Math.max(prev, toDifficulty(b.raw));
    prev = b.def.difficulty;
    all.push(b.def);
  });
  stats.push(`${area}: ${built.length} (${((Date.now() - ta) / 1000).toFixed(1)}s)`);
  if (DRY && process.argv.includes('--verbose')) {
    for (const b of ordered) {
      const d = b.def;
      const kinds: Record<string, number> = {};
      for (const st of d.stars) if (st.glyph) kinds[st.glyph.kind] = (kinds[st.glyph.kind] ?? 0) + 1;
      const marks = d.threads.filter((t) => t.mark).length;
      console.log(`  ${d.id} ${plan[built.indexOf(b)].tpl.padEnd(15)} ${b.shape.padEnd(20)} n=${d.stars.length} e=${d.threads.length} ${JSON.stringify(kinds)} marks=${marks}${d.echo ? ' ECHO' : ''} depth=${b.depth} raw=${b.raw.toFixed(1)} diff=${d.difficulty}`);
    }
  }
});
console.log(stats.join('\n'));
console.log(`total ${all.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (!DRY && !ONLY) {
  if (all.length !== 150) throw new Error(`expected 150, got ${all.length}`);
  writeFileSync(join(here, '..', 'src', 'data', 'constellations.ts'), emit(all));
  console.log('wrote src/data/constellations.ts');
  const solutions: Record<string, string> = {};
  const presses: Record<string, number[]> = {};
  for (const d of all) {
    const res = solveConstellation(d, { maxSolutions: 1, nodeLimit: 20_000_000 });
    const sol = res.solutions[0];
    if (!sol) throw new Error(`no solution for ${d.id}`);
    solutions[d.id] = stateString(sol);
    const pr = pressesFor(d, sol);
    if (!pr) throw new Error(`no presses for ${d.id}`);
    presses[d.id] = pr;
  }
  writeFileSync(join(here, '..', 'tests', 'fixtures', 'constellation-solutions.json'), JSON.stringify({ solutions, presses }, null, 1) + '\n');
  console.log('wrote tests/fixtures/constellation-solutions.json');
  writeFileSync(join(here, '..', 'docs', 'CONSTELLATIONS.md'), docs(all));
  console.log('wrote docs/CONSTELLATIONS.md');
}
void isInversionSymmetric;
void cutVertices;

function docs(list: ConstellationDef[]): string {
  const KIND_PT: Record<string, string> = {
    gem: 'Afinidade', measure: 'Medida', contour: 'Contorno', mosaic: 'Mosaico', mark: 'Fios (nó/corte)', echo: 'Eco', lock: 'Estaca', 'all-lit': 'Acender tudo',
  };
  const AREA_PT: Record<string, string> = {
    prologue: 'O Despertar', hub: 'Pátio das Nove Luzes', kinship: 'Bosque Outonal', measure: 'Terraços', mold: 'Pedreira', contour: 'Jardim de Sebes',
    mosaic: 'Templo das Areias', beacon: 'Penhascos dos Faróis', weave: 'Vale dos Moinhos', twins: 'Lago Espelhado', citadel: 'Cidadela', echo: 'Caverna Ressonante',
  };
  const out: string[] = [];
  out.push('# As Constelações — a camada secreta de Tessella');
  out.push('');
  out.push('> Nenhum lugar do jogo ensina isto. Quem descobrir, descobre 150 puzzles a mais.');
  out.push('');
  out.push('## A ideia');
  out.push('');
  out.push('Espalhadas pela ilha existem **redes de estrelas**: lanternas, conchas, pedras, vitórias-régias, cristais, braseiros —');
  out.push('objetos que parecem decoração, ligados por **fios finos de luz**. Cada objeto é uma *estrela* que acende e apaga');
  out.push('com um clique. Cada rede tem um **sino**: tocar o sino confere a constelação. Se estiver certa, os fios brilham para sempre');
  out.push('e o Salão das Tesselas ganha uma luz; se estiver errada, as estrelas e os fios culpados piscam em vermelho.');
  out.push('');
  out.push('Não é uma grade: **vizinhas são as estrelas ligadas por um fio**. As linguagens que o jogador aprendeu nos painéis');
  out.push('ganham outra geometria — e isso muda tudo:');
  out.push('');
  out.push('| Regra | Na rede |');
  out.push('|---|---|');
  out.push('| Sem glifos | todas as estrelas acesas |');
  out.push('| Afinidade (gemas) | gemas da mesma cor na mesma região; cores diferentes em regiões diferentes (região = estrelas do mesmo estado ligadas por fios) |');
  out.push('| Medida (número no anel) | a região da estrela tem exatamente N estrelas |');
  out.push('| Contorno (tracinhos) | exatamente N dos fios da estrela levam a uma estrela de estado diferente |');
  out.push('| Mosaico (número na janela) | exatamente N estrelas acesas entre a própria estrela e suas vizinhas |');
  out.push('| **Fios marcados** (linguagem exclusiva) | **nó** no fio = pontas iguais; **fio cortado** = pontas diferentes |');
  out.push('| Eco | apertar uma estrela vira também todas as vizinhas |');
  out.push('| Estaca | estrela fixa (não muda) |');
  out.push('');
  out.push('### Como a descoberta acontece');
  out.push('');
  out.push('1. No Despertar, três conchas na praia têm fios brilhando entre elas. Quem mira nelas vê o cursor virar anel —');
  out.push('   como num painel. Clicar acende. Tocar o sino com tudo aceso faz a primeira constelação cantar.');
  out.push('2. A segunda tem eco (apertar uma vira as vizinhas) — só se descobre apertando.');
  out.push('3. A terceira e a quarta ensinam sozinhas a linguagem secreta dos fios: o erro pisca *no fio*.');
  out.push('4. A partir da primeira solução, um vitral escondido no Salão das Tesselas acende e mostra `1 / 150`.');
  out.push('5. Com 100 constelações, abre-se o Cofre Oculto.');
  out.push('');
  out.push('### Uma percepção por constelação');
  out.push('');
  out.push('Toda constelação não trivial nasce de **uma ideia que só existe em rede** (nunca numa grade). A nota de cada uma');
  out.push('no catálogo nomeia essa ideia. As famílias de percepções:');
  out.push('');
  out.push('| Percepção | Ideia |');
  out.push('|---|---|');
  out.push('| A ponte | uma estrela (ponto de corte) é a única passagem entre duas partes: famílias ou regiões que precisam se encontrar passam por ela |');
  out.push('| O número não cabe | a Medida é maior que um lado inteiro da ponte: a região é obrigada a atravessar |');
  out.push('| O cubo | a estrela com muitos fios encosta em todo mundo: só uma família pode ter o estado dela |');
  out.push('| Amigo único / o dissidente | Contorno 1 ou N−1 num cubo: exatamente um vizinho é igual (ou diferente) |');
  out.push('| A janela inteira | o Mosaico de um cubo conta a vizinhança toda; comparado com uma vizinha, sobra pouco |');
  out.push('| Janelas quase iguais | dois centros veem as mesmas estrelas, menos as próprias: subtraia |');
  out.push('| Folhas | o Mosaico de uma folha só vê ela e o pai: resolva das pontas para dentro |');
  out.push('| Árvore de medidas | numa árvore cada fronteira corta de vez; as Medidas se encaixam como galhos |');
  out.push('| Laço ímpar | num anel ímpar, luz e sombra não alternam o caminho todo: em algum ponto dois vizinhos concordam |');
  out.push('| Paridade do laço | todo laço tem um número par de fios cortados: o elo sem marca se revela contando |');
  out.push('| Corrente de nós | estrelas amarradas por nós são uma região só; a Medida diz onde ela termina |');
  out.push('| Famílias entrelaçadas | cores que se cruzam no anel só se resolvem se uma passa por dentro (pelo cubo) e a outra por fora |');
  out.push('| Triângulos | todo triângulo tem 0 ou 2 fronteiras, nunca 1 ou 3 |');
  out.push('| A soma par | a soma de todos os Contornos é o dobro dos fios cortados: sempre par |');
  out.push('| A gema solitária | uma cor única no lugar mais movimentado precisa de um mundo só dela |');
  out.push('| Eco na árvore / no anel | uma folha só mexe nela e no pai; num anel cada toque vira três estrelas |');
  out.push('| Eco alcançável | as regras admitem duas respostas, mas apertando estrelas só se chega a uma |');
  out.push('');
  out.push('As últimas constelações de cada lugar são **vitrines**: desenhos (pássaro, peixe, chave, borboleta, flor, lanterna,');
  out.push('coroa, crescente…) cuja forma carrega a percepção, com mais camadas de raciocínio.');
  out.push('');
  out.push('### Garantias');
  out.push('');
  out.push('- Todas as redes são planas (fios nunca se cruzam), com estrelas a ≥ 1,6 m umas das outras, dentro de um raio de 7 m;');
  out.push('  o sino fica fora da rede, a até 8,6 m do centro, de preferência do lado +z (sul).');
  out.push('- Toda constelação tem **uma única solução** (para regras simétricas — sem mosaico nem estaca — a solução invertida');
  out.push('  também vale e é aceita) e pode ser resolvida **só com raciocínio**, sem chute: o gerador simula um jogador cuidadoso');
  out.push('  (deduções locais + hipóteses com contradição) e descarta o que exigir tentativa e erro. A dificuldade vem da');
  out.push('  profundidade do raciocínio, não do tamanho: candidatas difíceis só por serem grandes são descartadas.');
  out.push('- Nas constelações com eco, a solução é alcançável apertando estrelas a partir do estado inicial.');
  out.push('');
  out.push('## Catálogo');
  out.push('');
  out.push('| id | lugar | estrelas | fios | regras | dificuldade | nota |');
  out.push('|---|---|---|---|---|---|---|');
  for (const d of list) {
    const kinds = constellationKinds(d).map((k) => KIND_PT[k] ?? k).join(', ');
    out.push(`| ${d.id} | ${AREA_PT[d.area] ?? d.area} | ${d.stars.length} | ${d.threads.length} | ${kinds} | ${d.difficulty} | ${(d.note ?? '').replace(/\|/g, '/')} |`);
  }
  out.push('');
  return out.join('\n');
}
void isInversionSymmetric;
