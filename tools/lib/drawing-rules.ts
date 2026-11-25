/**
 * Line drawings for the constellations: parsing, readability rules and a similarity measure.
 *
 * A drawing is written as strokes on paper (x to the right, z downward): "x,z x,z x,z; x,z x,z".
 * Points with the same coordinates are the same star; consecutive points of a stroke are joined
 * by a thread.
 *
 * Readability (W = the drawing's size, the larger side of its bounding box):
 *  - 4..16 stars, one connected figure
 *  - threads never cross; a star is never closer than 0.06·W to a thread it is not on
 *  - stars at least 0.11·W apart; no thread shorter than 0.10·W
 *  - the angle between two threads at a star is at least 20°
 *  - the bell lies inside the figure's box, at least 0.10·W from every star and thread
 */
export type P = [number, number];

export const RULES = { minStars: 4, maxStars: 16, starGap: 0.11, edgeGap: 0.06, minEdge: 0.1, minAngle: 20, bellGap: 0.1 };

export function parseStrokes(src: string): { pts: P[]; edges: [number, number][] } {
  const pts: P[] = [];
  const edges: [number, number][] = [];
  const index = new Map<string, number>();
  const seen = new Set<string>();
  const at = (x: number, z: number): number => {
    const k = `${Math.round(x * 1000)},${Math.round(z * 1000)}`;
    let i = index.get(k);
    if (i === undefined) {
      i = pts.length;
      pts.push([x, z]);
      index.set(k, i);
    }
    return i;
  };
  for (const stroke of src.split(';')) {
    const toks = stroke.trim().split(/\s+/).filter(Boolean);
    let prev = -1;
    for (const t of toks) {
      const [x, z] = t.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error(`bad point '${t}' in '${src}'`);
      const v = at(x, z);
      if (prev >= 0 && prev !== v) {
        const k = prev < v ? `${prev}-${v}` : `${v}-${prev}`;
        if (!seen.has(k)) {
          seen.add(k);
          edges.push([prev, v]);
        }
      }
      prev = v;
    }
  }
  return { pts, edges };
}

export const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function pointSegDist(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)) : 0;
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}
export function segCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export function size(pts: P[]): number {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
}

function connected(n: number, edges: [number, number][]): boolean {
  const adj = Array.from({ length: n }, () => [] as number[]);
  for (const [a, b] of edges) (adj[a].push(b), adj[b].push(a));
  const seen = new Set([0]);
  const q = [0];
  while (q.length) for (const j of adj[q.pop()!]) if (!seen.has(j)) (seen.add(j), q.push(j));
  return seen.size === n;
}

/** Every readability problem of a drawing (empty = readable). */
export function drawingProblems(pts: P[], edges: [number, number][], bell: P): string[] {
  const out: string[] = [];
  const n = pts.length;
  if (n < RULES.minStars || n > RULES.maxStars) out.push(`${n} stars (want ${RULES.minStars}..${RULES.maxStars})`);
  if (n && !connected(n, edges)) out.push('not one connected figure');
  const W = size(pts);
  const f = (x: number) => x.toFixed(2);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = dist(pts[i], pts[j]);
    if (d < RULES.starGap * W - 1e-9) out.push(`stars ${i},${j} too close (${f(d / W)}W)`);
  }
  edges.forEach(([a, b], k) => {
    const L = dist(pts[a], pts[b]);
    if (L < RULES.minEdge * W - 1e-9) out.push(`thread ${a}-${b} too short (${f(L / W)}W)`);
    for (let s = 0; s < n; s++) {
      if (s === a || s === b) continue;
      const d = pointSegDist(pts[s], pts[a], pts[b]);
      if (d < RULES.edgeGap * W - 1e-9) out.push(`star ${s} too close to thread ${a}-${b} (${f(d / W)}W)`);
    }
    for (let k2 = k + 1; k2 < edges.length; k2++) {
      const [c, d] = edges[k2];
      if (a === c || a === d || b === c || b === d) continue;
      if (segCross(pts[a], pts[b], pts[c], pts[d])) out.push(`threads ${a}-${b} and ${c}-${d} cross`);
    }
  });
  // angles at each star
  for (let v = 0; v < n; v++) {
    const dirs = edges.filter(([a, b]) => a === v || b === v).map(([a, b]) => (a === v ? b : a)).map((u) => Math.atan2(pts[u][1] - pts[v][1], pts[u][0] - pts[v][0]));
    for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) {
      let d = Math.abs(dirs[i] - dirs[j]) * (180 / Math.PI);
      if (d > 180) d = 360 - d;
      if (d < RULES.minAngle - 1e-9) out.push(`angle ${d.toFixed(0)}° at star ${v}`);
    }
  }
  // bell
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  if (bell[0] < Math.min(...xs) || bell[0] > Math.max(...xs) || bell[1] < Math.min(...zs) || bell[1] > Math.max(...zs)) out.push('bell outside the figure');
  for (let i = 0; i < n; i++) if (dist(bell, pts[i]) < RULES.bellGap * W - 1e-9) out.push(`bell too close to star ${i} (${f(dist(bell, pts[i]) / W)}W)`);
  for (const [a, b] of edges) {
    const d = pointSegDist(bell, pts[a], pts[b]);
    if (d < RULES.bellGap * W - 1e-9) out.push(`bell too close to thread ${a}-${b} (${f(d / W)}W)`);
  }
  return out;
}

/** Coarse raster of the drawing's lines (normalised), for near-duplicate detection. */
export function raster(pts: P[], edges: [number, number][], mirror = false, N = 24): Set<number> {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const W = size(pts) || 1;
  const map = (p: P): P => [((mirror ? -1 : 1) * (p[0] - cx)) / W + 0.5, (p[1] - cz) / W + 0.5];
  const cells = new Set<number>();
  for (const [a, b] of edges) {
    const A = map(pts[a]), B = map(pts[b]);
    const steps = Math.ceil(dist(A, B) * N * 3) + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.min(N - 1, Math.max(0, Math.floor((A[0] + (B[0] - A[0]) * t) * N)));
      const z = Math.min(N - 1, Math.max(0, Math.floor((A[1] + (B[1] - A[1]) * t) * N)));
      cells.add(z * N + x);
    }
  }
  return cells;
}

/** Jaccard similarity of two drawings' line rasters (also against the mirror image). */
export function similarity(a: { pts: P[]; edges: [number, number][] }, b: { pts: P[]; edges: [number, number][] }): number {
  const ra = raster(a.pts, a.edges);
  let best = 0;
  for (const m of [false, true]) {
    const rb = raster(b.pts, b.edges, m);
    let inter = 0;
    for (const c of ra) if (rb.has(c)) inter++;
    best = Math.max(best, inter / (ra.size + rb.size - inter));
  }
  return best;
}
