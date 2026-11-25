/**
 * Puzzle generation library: build a solution, decorate it with glyphs, then minimise the
 * glyphs while the solution stays unique (or "tight"), and grade the result.
 */
import { allOrientations, buildGeometry, computeRegions, initialState, mirrorShape, pressSet, regionShape, shapeKey, isPressable, type Geometry } from '../../src/puzzle/board';
import { beaconSight, check, colTiles, contourCount, lineRuns, mosaicCount, rowTiles } from '../../src/puzzle/rules';
import { insightPath, isInversionSymmetric, solve, type InsightPath } from '../../src/puzzle/solver';
import { GEM_COLORS, TWIN_SYMBOLS, type Cell, type EchoDir, type Glyph, type PuzzleDef } from '../../src/puzzle/types';
import type { Rng } from './random-puzzle';

export type Kind = 'measure' | 'mold' | 'contour' | 'mosaic' | 'gem' | 'twin' | 'beacon' | 'weave';

export interface Spec {
  w: number;
  h: number;
  kinds: Kind[];
  /** relative weights for picking a kind per tile (default 1 each) */
  weights?: Partial<Record<Kind, number>>;
  holes?: number;
  holeMask?: string;
  lit?: number;
  maxMold?: number;
  freeMoldP?: number;
  wrap?: boolean;
  mirror?: 'v' | 'h' | 'rot';
  /** rivets allowed to reach uniqueness */
  rivets?: number;
  /** keep at least this many glyphs of each kind */
  keep?: Partial<Record<Kind, number>>;
  /** weave: keep every clue (pure nonogram) */
  fullWeave?: boolean;
  /** custom solution generator */
  state?: (r: Rng, p: PuzzleDef, g: Geometry) => Uint8Array | null;
  /** custom solution with beacons (used when 'beacon' is among the kinds) */
  stateWithBeacons?: (r: Rng, p: PuzzleDef, g: Geometry) => { state: Uint8Array; beacons: number[] } | null;
  /** accept/reject the final puzzle */
  accept?: (p: PuzzleDef, sol: Uint8Array) => boolean;
  /** cheap filter on the solution before decorating/minimising */
  preAccept?: (p: PuzzleDef, state: Uint8Array) => boolean;
  /** 'unique' (default) or 'tight' (<= maxSols solutions) */
  mode?: 'unique' | 'tight';
  maxSols?: number;
  /** echo layout */
  echo?: { p: number; dirs: EchoDir[][]; mute?: number; plate?: boolean; presses?: [number, number] };
  /** number of beacons when 'beacon' in kinds */
  beacons?: [number, number];
  twinPairs?: number;
  mirrorTwinP?: number;
  gemColors?: number;
  /** fraction of a coloured region's tiles that get a gem (default: 2..3 gems) */
  gemFill?: number;
  /** let the minimiser remove gems (keeps at least one per colour) */
  trimGems?: boolean;
  /** blob solution with this many seeds (controls region count) */
  seeds?: number;
  /** reject solutions with more regions than this */
  maxRegions?: number;
  /** twins: stamp congruent shapes instead of searching random regions */
  stampTwins?: boolean;
  /** how many glyphs to place initially (fraction of free tiles), default 1 (all) */
  density?: number;
  /** fairness: minimise while the puzzle stays solvable by the human-like insight path
   *  using at most this many one-step "what if" lookaheads (undefined = plain uniqueness) */
  fairLook?: number;
}

export interface Candidate {
  p: PuzzleDef;
  sol: Uint8Array;
  /** full propagation solves it from the start (no guessing) */
  propOnly?: boolean;
  /** fraction of free tiles the root propagation determines (lower = harder to start) */
  root?: number;
  /** human-like solve path (insights in order) */
  ip?: InsightPath;
  glyphs: number;
  rivets: number;
  nodes: number;
  simple: boolean;
  sols: number;
  score: number;
}

export function freeTiles(p: PuzzleDef): number[] {
  return [...Array(p.w * p.h).keys()].filter((i) => !p.cells[i].hole);
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function countSolutions(p: PuzzleDef, cap = 2, nodes = 6000): { n: number; complete: boolean; sols: Uint8Array[]; nodes: number } {
  const res = solve(p, { maxSolutions: cap, maxNodes: nodes, timeLimitMs: 900, breakSymmetry: true });
  return { n: res.solutions.length, complete: res.complete, sols: res.solutions, nodes: res.nodes };
}

function okCount(spec: Spec, n: number, complete: boolean): boolean {
  if (!complete) return false;
  if ((spec.mode ?? 'unique') === 'unique') return n === 1;
  return n >= 1 && n <= (spec.maxSols ?? 4);
}

// ───────────────────────────── states ─────────────────────────────

export function randomState(r: Rng, p: PuzzleDef, lit = 0.5): Uint8Array {
  const s = new Uint8Array(p.w * p.h);
  for (const i of freeTiles(p)) s[i] = p.cells[i].lock ?? (r.chance(lit) ? 1 : 0);
  return s;
}

/** Blobby state: grows random regions (fewer tiny regions than pure noise). */
export function blobState(r: Rng, p: PuzzleDef, g: Geometry, seeds = 6): Uint8Array {
  const n = p.w * p.h;
  const s = new Uint8Array(n);
  const owner = new Int32Array(n).fill(-1);
  const free = freeTiles(p);
  const frontier: number[] = [];
  for (let k = 0; k < seeds; k++) {
    const t = r.pick(free);
    if (owner[t] >= 0) continue;
    owner[t] = k;
    frontier.push(t);
  }
  while (frontier.length) {
    const idx = r.int(frontier.length);
    const t = frontier[idx];
    const opts = g.nb[t].filter((j) => owner[j] < 0);
    if (!opts.length) { frontier.splice(idx, 1); continue; }
    const j = r.pick(opts);
    owner[j] = owner[t];
    frontier.push(j);
  }
  const colour = Array.from({ length: seeds }, () => (r.chance(0.5) ? 1 : 0));
  for (const i of free) s[i] = owner[i] >= 0 ? colour[owner[i]] : r.chance(0.5) ? 1 : 0;
  return s;
}

export function symmetricState(r: Rng, p: PuzzleDef, axis: 'v' | 'h' | 'rot', lit = 0.5): Uint8Array {
  const s = new Uint8Array(p.w * p.h);
  for (let rr = 0; rr < p.h; rr++) for (let c = 0; c < p.w; c++) {
    const i = rr * p.w + c;
    const m = axis === 'v' ? rr * p.w + (p.w - 1 - c) : axis === 'h' ? (p.h - 1 - rr) * p.w + c : (p.h - 1 - rr) * p.w + (p.w - 1 - c);
    if (m < i) s[i] = s[m];
    else s[i] = r.chance(lit) ? 1 : 0;
  }
  for (let i = 0; i < s.length; i++) if (p.cells[i].hole) s[i] = 0;
  return s;
}

/** Stamps `pairs` congruent (or mirrored) shapes as separate regions; returns state + twin tiles. */
export function twinStampState(r: Rng, p: PuzzleDef, g: Geometry, pairs: number, mirrorP: number, sizes: [number, number]): { state: Uint8Array; twins: [number, number, boolean][] } | null {
  const n = p.w * p.h;
  const state = new Uint8Array(n);
  const fixed = new Int8Array(n).fill(-1); // -1 free, 0/1 forced
  const stamped = new Uint8Array(n);
  const twins: [number, number, boolean][] = [];
  const free = freeTiles(p);
  for (let k = 0; k < pairs; k++) {
    // random polyomino by growth
    const size = sizes[0] + r.int(sizes[1] - sizes[0] + 1);
    let shape: [number, number][] = [[0, 0]];
    while (shape.length < size) {
      const [a, b] = r.pick(shape);
      const d = r.int(4);
      const nb: [number, number] = [a + [-1, 0, 1, 0][d], b + [0, 1, 0, -1][d]];
      if (!shape.some((x) => x[0] === nb[0] && x[1] === nb[1])) shape.push(nb);
    }
    const mirror = r.chance(mirrorP);
    const shapes = [shape, mirror ? shape.map(([a, b]) => [a, -b] as [number, number]) : shape];
    const placedTiles: number[][] = [];
    for (const sh of shapes) {
      let ok = false;
      for (let tries = 0; tries < 80 && !ok; tries++) {
        const t0 = r.pick(free);
        const r0 = Math.floor(t0 / p.w), c0 = t0 % p.w;
        const s = r.chance(0.5) ? 1 : 0;
        const tiles: number[] = [];
        let bad = false;
        for (const [a, b] of sh) {
          const rr = r0 + a;
          let cc = c0 + b;
          if (g.wrap) cc = ((cc % p.w) + p.w) % p.w;
          if (rr < 0 || rr >= p.h || cc < 0 || cc >= p.w) { bad = true; break; }
          const t = rr * p.w + cc;
          if (p.cells[t].hole || stamped[t] || (fixed[t] !== -1 && fixed[t] !== s) || tiles.includes(t)) { bad = true; break; }
          tiles.push(t);
        }
        if (bad) continue;
        let clash = false;
        for (const t of tiles) for (const j of g.nb[t]) if (!tiles.includes(j) && fixed[j] === s) clash = true;
        if (clash) continue;
        for (const t of tiles) { fixed[t] = s; state[t] = s; stamped[t] = 1; }
        for (const t of tiles) for (const j of g.nb[t]) if (!tiles.includes(j) && fixed[j] === -1) { fixed[j] = 1 - s; state[j] = 1 - s; }
        placedTiles.push(tiles);
        ok = true;
      }
      if (!ok) return null;
    }
    twins.push([r.pick(placedTiles[0]), r.pick(placedTiles[1]), mirror]);
  }
  for (const t of free) if (fixed[t] === -1) state[t] = r.chance(0.5) ? 1 : 0;
  return { state, twins };
}

export function beaconState(r: Rng, p: PuzzleDef, g: Geometry, count: number, maxArm = 3): { state: Uint8Array; beacons: number[] } {
  const state = new Uint8Array(p.w * p.h);
  const beacons: number[] = [];
  const free = freeTiles(p);
  for (let k = 0; k < count * 3 && beacons.length < count; k++) {
    const t = r.pick(free);
    if (beacons.includes(t) || state[t]) continue;
    beacons.push(t);
    state[t] = 1;
    for (let d = 0; d < 4; d++) {
      const len = r.int(maxArm + 1);
      let cur = g.dir4[t][d];
      for (let s = 0; s < len && cur >= 0; s++) { state[cur] = 1; cur = g.dir4[cur][d]; }
    }
  }
  return { state, beacons };
}

// ───────────────────────────── glyphs ─────────────────────────────

export function glyphFor(kind: Kind, p: PuzzleDef, g: Geometry, state: Uint8Array, t: number, reg: ReturnType<typeof computeRegions>, spec: Spec, r: Rng): Glyph | null {
  switch (kind) {
    case 'measure': return { kind: 'measure', n: reg.members[reg.id[t]].length };
    case 'contour': return { kind: 'contour', n: contourCount(g, state, t) };
    case 'mosaic': return { kind: 'mosaic', n: mosaicCount(p, g, state, t) };
    case 'mold': {
      const shape = regionShape(g, reg.members[reg.id[t]]);
      if (shape.length > (spec.maxMold ?? 5)) return null;
      if (g.wrap && Math.max(...shape.map((x) => x[1])) + 1 >= p.w) return null;
      // a free mold only makes sense when the shape actually has several orientations
      const canTurn = allOrientations(shape).length > 1;
      return { kind: 'mold', cells: shape, ...(canTurn && r.chance(spec.freeMoldP ?? 0) ? { free: true } : {}) };
    }
    default: return null;
  }
}

/** Decorates with gems (one colour per chosen region). */
function placeGems(r: Rng, p: PuzzleDef, reg: ReturnType<typeof computeRegions>, colors: number, perRegion: [number, number], fill?: number): number {
  // prefer bigger regions (more interesting corridors)
  const regions = r.shuffle(reg.members.map((m, i) => i).filter((i) => reg.members[i].length >= 1))
    .sort((a, b) => reg.members[b].length - reg.members[a].length + (r.next() - 0.5) * 3);
  let used = 0;
  for (const rid of regions) {
    if (used >= colors) break;
    const tiles = r.shuffle([...reg.members[rid]]).filter((t) => !p.cells[t].glyph);
    if (!tiles.length) continue;
    const k = fill !== undefined ? Math.max(1, Math.round(tiles.length * fill)) : Math.min(tiles.length, perRegion[0] + r.int(perRegion[1] - perRegion[0] + 1));
    for (const t of tiles.slice(0, k)) p.cells[t].glyph = { kind: 'gem', color: GEM_COLORS[used] };
    used++;
  }
  return used;
}

/** Plants twin pairs on congruent (or mirrored) regions. */
function placeTwins(r: Rng, p: PuzzleDef, g: Geometry, reg: ReturnType<typeof computeRegions>, pairs: number, mirrorP: number, maxSize = 7): number {
  const byShape = new Map<string, number[]>();
  reg.members.forEach((m, rid) => {
    if (m.length < 2 || m.length > maxSize) return;
    const key = shapeKey(regionShape(g, m));
    if (!byShape.has(key)) byShape.set(key, []);
    byShape.get(key)!.push(rid);
  });
  let placed = 0;
  const used = new Set<number>();
  for (const key of r.shuffle([...byShape.keys()])) {
    if (placed >= pairs) break;
    let list = byShape.get(key)!.filter((x) => !used.has(x));
    let mirror = false;
    if (r.chance(mirrorP) && list.length) {
      const a = list[0];
      const mk = shapeKey(mirrorShape(regionShape(g, reg.members[a])));
      if (mk !== key && byShape.has(mk)) {
        const b = byShape.get(mk)!.find((x) => !used.has(x));
        if (b !== undefined) { list = [a, b]; mirror = true; }
      }
    }
    if (list.length < 2) continue;
    const [ra, rb] = r.shuffle([...list]).slice(0, 2);
    const ta = r.pick(reg.members[ra].filter((t) => !p.cells[t].glyph));
    const tb = r.pick(reg.members[rb].filter((t) => !p.cells[t].glyph));
    if (ta === undefined || tb === undefined) continue;
    used.add(ra); used.add(rb);
    const sym = TWIN_SYMBOLS[placed];
    p.cells[ta].glyph = { kind: 'twin', symbol: sym };
    p.cells[tb].glyph = { kind: 'twin', symbol: sym, ...(mirror ? { mirror: true } : {}) };
    placed++;
  }
  return placed;
}

function kindOf(c: Cell): Kind | null {
  return (c.glyph?.kind as Kind) ?? null;
}

function counts(p: PuzzleDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of p.cells) { const k = kindOf(c); if (k) out[k] = (out[k] ?? 0) + 1; }
  if (p.rowClues) out.weave = (p.rowClues.filter(Boolean).length) + (p.colClues?.filter(Boolean).length ?? 0);
  return out;
}

// ───────────────────────────── echo ─────────────────────────────

export function applyEcho(r: Rng, p: PuzzleDef, e: NonNullable<Spec['echo']>): void {
  for (const c of p.cells) {
    if (c.hole) continue;
    if (r.chance(e.p)) c.echo = [...r.pick(e.dirs)];
    if (e.mute && r.chance(e.mute) && c.lock === undefined && !(c.glyph?.kind === 'beacon')) c.mute = true;
  }
}

export function isReachable(p: PuzzleDef, state: Uint8Array): boolean {
  const g = buildGeometry(p);
  const init = initialState(p);
  // gaussian elimination over GF(2) on press vectors
  const n = p.w * p.h;
  const rows: Uint8Array[] = [];
  for (const i of freeTiles(p)) {
    if (!isPressable(p, i)) continue;
    const v = new Uint8Array(n + 1);
    for (const t of pressSet(p, g, i)) v[t] = 1;
    rows.push(v);
  }
  const target = new Uint8Array(n);
  for (let i = 0; i < n; i++) target[i] = p.cells[i].hole ? 0 : state[i] ^ init[i];
  // reduce target against row space
  const basis: { col: number; v: Uint8Array }[] = [];
  for (const v of rows) {
    const x = Uint8Array.from(v);
    for (const b of basis) if (x[b.col]) for (let c = 0; c < n; c++) x[c] ^= b.v[c];
    const col = x.findIndex((y, i) => i < n && y === 1);
    if (col >= 0) basis.push({ col, v: x });
  }
  const t = Uint8Array.from(target);
  for (const b of basis) if (t[b.col]) for (let c = 0; c < n; c++) t[c] ^= b.v[c];
  return !t.some((y) => y === 1);
}

export function reachableRandom(r: Rng, p: PuzzleDef, presses: number): Uint8Array {
  const g = buildGeometry(p);
  const s = initialState(p);
  const pressable = freeTiles(p).filter((i) => isPressable(p, i));
  for (const t of r.shuffle([...pressable]).slice(0, presses)) for (const x of pressSet(p, g, t)) s[x] ^= 1;
  return s;
}

// ───────────────────────────── main generator ─────────────────────────────

export function generate(r: Rng, spec: Spec, id = 'gen'): Candidate | null {
  const { w, h } = spec;
  const cells: Cell[] = [];
  const mask = spec.holeMask?.split('/');
  for (let i = 0; i < w * h; i++) {
    const rr = Math.floor(i / w);
    const cc = i % w;
    const hole = mask ? mask[rr]?.[cc] === '#' : r.chance(spec.holes ?? 0);
    cells.push(hole ? { hole: true } : {});
  }
  const p: PuzzleDef = { id, w, h, cells };
  if (spec.wrap) p.wrap = true;
  if (spec.mirror) p.mirror = spec.mirror;
  const g = buildGeometry(p);

  // solution
  let state: Uint8Array | null;
  let beacons: number[] = [];
  if (spec.kinds.includes('beacon') && spec.stateWithBeacons) {
    const bs = spec.stateWithBeacons(r, p, g);
    if (!bs) return null;
    state = bs.state;
    beacons = bs.beacons;
  } else if (spec.kinds.includes('beacon')) {
    const bs = beaconState(r, p, g, spec.beacons ? spec.beacons[0] + r.int(spec.beacons[1] - spec.beacons[0] + 1) : 3);
    state = bs.state;
    beacons = bs.beacons;
    if (spec.mirror) return null;
  } else if (spec.state) state = spec.state(r, p, g);
  else if (spec.mirror) state = symmetricState(r, p, spec.mirror, spec.lit ?? 0.5);
  else if (spec.seeds) state = blobState(r, p, g, spec.seeds);
  else state = r.chance(0.5) ? blobState(r, p, g, Math.max(3, Math.round((w * h) / 4))) : randomState(r, p, spec.lit ?? 0.5);
  if (!state) return null;

  if (spec.echo) {
    applyEcho(r, p, spec.echo);
    const structured = spec.kinds.includes('beacon') || spec.kinds.includes('twin') || !!spec.state || !!spec.stateWithBeacons;
    if (spec.echo.plate || !structured) {
      const [a, b] = spec.echo.presses ?? (spec.echo.plate ? [3, 5] : [3, 8]);
      state = reachableRandom(r, p, a + r.int(b - a + 1));
    } else if (!isReachable(p, state)) return null;
  }

  let reg = computeRegions(g, state);
  if (spec.maxRegions && reg.members.length > spec.maxRegions) return null;
  if (spec.preAccept && !spec.preAccept(p, state)) return null;
  // beacons
  for (const t of beacons) {
    p.cells[t].lock = 1;
    p.cells[t].glyph = { kind: 'beacon', n: beaconSight(g, state, t).length };
  }
  if (spec.kinds.includes('gem')) placeGems(r, p, reg, spec.gemColors ?? 3, [2, 3], spec.gemFill);
  if (spec.kinds.includes('twin')) {
    if (spec.stampTwins) {
      const st = twinStampState(r, p, g, spec.twinPairs ?? 2, spec.mirrorTwinP ?? 0.3, [3, 5]);
      if (!st) return null;
      state = st.state;
      const reg2 = computeRegions(g, state);
      // verify each stamped pair really is two separate regions of the intended shapes
      let k = 0;
      for (const [a, b, mirror] of st.twins) {
        if (reg2.id[a] === reg2.id[b]) return null;
        const sym = TWIN_SYMBOLS[k++];
        p.cells[a].glyph = { kind: 'twin', symbol: sym };
        p.cells[b].glyph = { kind: 'twin', symbol: sym, ...(mirror ? { mirror: true } : {}) };
      }
      reg.id = reg2.id;
      reg.members = reg2.members;
    } else {
      const placed = placeTwins(r, p, g, reg, spec.twinPairs ?? 2, spec.mirrorTwinP ?? 0.3);
      if (placed < (spec.twinPairs ?? 2)) return null;
    }
  }
  const tileKinds = spec.kinds.filter((k) => k === 'measure' || k === 'mold' || k === 'contour' || k === 'mosaic');
  if (tileKinds.length) {
    const weights = tileKinds.map((k) => spec.weights?.[k] ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    for (const t of freeTiles(p)) {
      if (p.cells[t].glyph) continue;
      if (!r.chance(spec.density ?? 1)) continue;
      let x = r.next() * total;
      let k = tileKinds[0];
      for (let i = 0; i < tileKinds.length; i++) { x -= weights[i]; if (x <= 0) { k = tileKinds[i]; break; } }
      const gl = glyphFor(k, p, g, state, t, reg, spec, r);
      if (gl) p.cells[t].glyph = gl;
    }
  }
  if (spec.kinds.includes('weave')) {
    p.rowClues = [...Array(h).keys()].map((rr) => lineRuns(p, rowTiles(p, rr), state!));
    p.colClues = [...Array(w).keys()].map((cc) => lineRuns(p, colTiles(p, cc), state!));
  }
  if (spec.echo?.plate) {
    p.target = [...state].map((v, i) => (p.cells[i].hole ? '#' : v ? '1' : '0')).join('');
  }
  if (!check(p, state).ok) return null;

  // uniqueness, with rivets if allowed
  let cs = countSolutions(p, spec.mode === 'tight' ? (spec.maxSols ?? 4) + 1 : 2);
  let rivets = 0;
  while (!okCount(spec, cs.n, cs.complete) && cs.complete && cs.n > 1 && rivets < (spec.rivets ?? 0)) {
    const [s1, s2] = cs.sols;
    const diff = freeTiles(p).filter((i) => !p.cells[i].glyph && p.cells[i].lock === undefined && !p.cells[i].mute && s1[i] !== s2[i]);
    if (!diff.length) break;
    const t = r.pick(diff);
    p.cells[t].lock = state[t] as 0 | 1;
    rivets++;
    cs = countSolutions(p, spec.mode === 'tight' ? (spec.maxSols ?? 4) + 1 : 2);
  }
  if (!okCount(spec, cs.n, cs.complete)) return null;

  // minimise glyphs (and weave clues unless fullWeave)
  const keep = spec.keep ?? {};
  const removable: (() => () => void)[] = [];
  // remove duplicates first (several equal clues in one region), so the survivors are elegant
  const dupFirst = (() => {
    const tiles = r.shuffle(freeTiles(p));
    const seen = new Map<string, number>();
    const key = (t: number) => {
      const gl = p.cells[t].glyph;
      if (!gl || (gl.kind !== 'measure' && gl.kind !== 'mold')) return '';
      return gl.kind + ':' + reg.id[t];
    };
    for (const t of tiles) { const k = key(t); if (k) seen.set(k, (seen.get(k) ?? 0) + 1); }
    return [...tiles.filter((t) => (seen.get(key(t)) ?? 0) > 1), ...tiles.filter((t) => (seen.get(key(t)) ?? 0) <= 1)];
  })();
  for (const t of dupFirst) {
    const c = p.cells[t];
    const k = kindOf(c);
    if (!k || k === 'beacon' || k === 'twin' || (spec.echo?.plate)) continue;
    if (k === 'gem') {
      if (!spec.trimGems) continue;
      const color = (c.glyph as { color: string }).color;
      removable.push(() => {
        const left = p.cells.filter((x) => x.glyph?.kind === 'gem' && (x.glyph as { color: string }).color === color).length;
        if (left <= 1) return () => {};
        const gl = c.glyph!;
        delete c.glyph;
        return () => { c.glyph = gl; };
      });
      continue;
    }
    removable.push(() => {
      const gl = c.glyph!;
      delete c.glyph;
      return () => { c.glyph = gl; };
    });
  }
  if (p.rowClues && !spec.fullWeave) {
    for (const [arr, idx] of r.shuffle([...p.rowClues.map((_, i) => [p.rowClues!, i] as const), ...p.colClues!.map((_, i) => [p.colClues!, i] as const)])) {
      removable.push(() => {
        const v = arr[idx];
        arr[idx] = null;
        return () => { arr[idx] = v; };
      });
    }
  }
  const fairOk = () => spec.fairLook === undefined || insightPath(p, spec.fairLook).solved;
  if (!fairOk()) return null;
  for (const rm of removable) {
    const before = counts(p);
    const undo = rm();
    const after = counts(p);
    let violatesKeep = false;
    for (const [k, min] of Object.entries(keep)) if ((after[k] ?? 0) < (min ?? 0) && (before[k] ?? 0) >= (min ?? 0)) violatesKeep = true;
    if (violatesKeep) { undo(); continue; }
    if (spec.fairLook !== undefined) {
      if (!fairOk()) undo();
      continue;
    }
    const c2 = countSolutions(p, spec.mode === 'tight' ? (spec.maxSols ?? 4) + 1 : 2);
    if (!okCount(spec, c2.n, c2.complete)) undo();
  }
  if (check(p, initialState(p)).ok) return null;
  if (spec.accept && !spec.accept(p, state)) return null;

  const fin = solve(p, { maxSolutions: 2, maxNodes: 200000, timeLimitMs: 8000, breakSymmetry: true });
  const simple = solve(p, { maxSolutions: 1, simple: true, maxNodes: 1, timeLimitMs: 2000, breakSymmetry: true }).propagationOnly;
  const glyphs = p.cells.filter((c) => c.glyph && c.glyph.kind !== 'beacon').length + (p.rowClues?.filter(Boolean).length ?? 0) + (p.colClues?.filter(Boolean).length ?? 0);
  const free = freeTiles(p).length;
  const score = (simple ? 0 : 3) + Math.log2(1 + fin.nodes) * 1.2 + (free / Math.max(1, glyphs)) * 0.8 + free / 12 + rivets * -0.4;
  const ip = insightPath(p, 60);
  return { p, sol: fin.solutions[0] ?? state, glyphs, rivets, nodes: fin.nodes, simple, sols: fin.solutions.length, score, propOnly: fin.propagationOnly, root: fin.rootDetermined, ip };
}

/** Generates many candidates and returns `count` of them forming an increasing difficulty ramp. */
export function ramp(r: Rng, spec: Spec, count: number, tries: number, from = 0.2, to = 1.0): Candidate[] {
  const pool: Candidate[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < tries && pool.length < count * 5; k++) {
    const c = generate(r, spec);
    if (!c) continue;
    const key = JSON.stringify(c.p.cells) + JSON.stringify(c.p.rowClues ?? '') + JSON.stringify(c.p.colClues ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(c);
  }
  pool.sort((a, b) => a.score - b.score);
  if (pool.length < count) return pool;
  const out: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? to : from + ((to - from) * i) / (count - 1);
    let idx = Math.min(pool.length - 1, Math.round(f * (pool.length - 1)));
    while (out.includes(pool[idx]) && idx < pool.length - 1) idx++;
    while (out.includes(pool[idx]) && idx > 0) idx--;
    out.push(pool[idx]);
  }
  return out.sort((a, b) => a.score - b.score);
}

export { clone, isInversionSymmetric };

// ───────────────────────────── kinship ─────────────────────────────

export interface KinSpec {
  w: number;
  h: number;
  holes: number;
  colors: [number, number];
  gemsPer: [number, number];
  maxSolsWithCore?: number;
  rivets?: number;
  extraKinds?: Kind[];
}

/** Feasible family-state assignments (up to inversion) for a kinship puzzle. */
export function familyAssignments(p: PuzzleDef): { feasible: number; total: number; solsForFirst: number } {
  const fam = new Map<string, number[]>();
  p.cells.forEach((c, i) => {
    if (c.glyph?.kind === 'gem') {
      if (!fam.has(c.glyph.color)) fam.set(c.glyph.color, []);
      fam.get(c.glyph.color)!.push(i);
    }
  });
  const fams = [...fam.values()];
  const k = fams.length;
  let feasible = 0;
  let solsForFirst = 0;
  const symmetric = isInversionSymmetric(p);
  const total = symmetric ? 1 << (k - 1) : 1 << k;
  for (let mask = 0; mask < total; mask++) {
    const q: PuzzleDef = JSON.parse(JSON.stringify(p));
    let clash = false;
    fams.forEach((tiles, f) => {
      const s = ((mask >> f) & 1) as 0 | 1;
      for (const t of tiles) {
        if (q.cells[t].lock !== undefined && q.cells[t].lock !== s) clash = true;
        q.cells[t].lock = s;
      }
    });
    if (clash) continue;
    const res = solve(q, { maxSolutions: 1, maxNodes: 30000, timeLimitMs: 2000 });
    if (res.solutions.length) {
      feasible++;
      if (feasible === 1) solsForFirst = solve(q, { maxSolutions: 200, maxNodes: 60000, timeLimitMs: 3000 }).solutions.length;
    }
  }
  return { feasible, total, solsForFirst };
}

function farApart(r: Rng, p: PuzzleDef, tiles: number[], k: number): number[] {
  const rc = (t: number) => [Math.floor(t / p.w), t % p.w];
  const out = [r.pick(tiles)];
  while (out.length < k && out.length < tiles.length) {
    let best = -1, bestD = -1;
    for (const t of tiles) {
      if (out.includes(t)) continue;
      const d = Math.min(...out.map((o) => { const [a, b] = rc(o), [c, e] = rc(t); return Math.abs(a - c) + Math.abs(b - e); })) + r.next();
      if (d > bestD) { bestD = d; best = t; }
    }
    out.push(best);
  }
  return out;
}

export function generateKinship(r: Rng, ks: KinSpec, id = 'kin'): Candidate | null {
  const { w, h } = ks;
  const cells: Cell[] = [];
  for (let i = 0; i < w * h; i++) cells.push(r.chance(ks.holes) ? { hole: true } : {});
  const p: PuzzleDef = { id, w, h, cells };
  const g = buildGeometry(p);
  const state = r.chance(0.5) ? randomState(r, p, 0.5) : blobState(r, p, g, Math.round((w * h) / 3));
  const reg = computeRegions(g, state);
  const colors = ks.colors[0] + r.int(ks.colors[1] - ks.colors[0] + 1);
  const cand = reg.members.map((m, i) => i).filter((i) => reg.members[i].length >= 2);
  if (cand.length < colors) return null;
  // prefer big, snaky regions
  cand.sort((a, b) => reg.members[b].length - reg.members[a].length + (r.next() - 0.5) * 4);
  const chosen = cand.slice(0, colors);
  chosen.forEach((rid, ci) => {
    const k = Math.min(reg.members[rid].length, ks.gemsPer[0] + r.int(ks.gemsPer[1] - ks.gemsPer[0] + 1));
    for (const t of farApart(r, p, reg.members[rid], k)) cells[t].glyph = { kind: 'gem', color: GEM_COLORS[ci] };
  });
  if (!check(p, state).ok || check(p, initialState(p)).ok) return null;
  let fa = familyAssignments(p);
  let rivets = 0;
  // add rivets on gem tiles of a family until the family assignment is forced
  while (fa.feasible > 1 && rivets < (ks.rivets ?? 1)) {
    const gemTiles = freeTiles(p).filter((t) => p.cells[t].glyph?.kind === 'gem' && p.cells[t].lock === undefined);
    const t = r.pick(gemTiles);
    p.cells[t].lock = state[t] as 0 | 1;
    rivets++;
    fa = familyAssignments(p);
  }
  if (fa.feasible !== 1) return null;
  if (fa.solsForFirst > (ks.maxSolsWithCore ?? 200)) return null;
  const fin = solve(p, { maxSolutions: 1, maxNodes: 100000, breakSymmetry: true });
  if (!fin.solutions.length) return null;
  const glyphs = p.cells.filter((c) => c.glyph).length;
  const free = freeTiles(p).length;
  const score = colors * 1.5 + free / 6 + Math.log2(1 + fin.nodes) + (200 - fa.solsForFirst) / 50 - rivets;
  return { p, sol: fin.solutions[0], glyphs, rivets, nodes: fin.nodes, simple: false, sols: fa.solsForFirst, score, ip: insightPath(p, 30) };
}

export function rampWith(r: Rng, make: () => Candidate | null, count: number, tries: number, from = 0.2, to = 1): Candidate[] {
  const pool: Candidate[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < tries && pool.length < count * 8; k++) {
    const c = make();
    if (!c) continue;
    const key = JSON.stringify(c.p.cells);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(c);
  }
  pool.sort((a, b) => a.score - b.score);
  if (pool.length < count) return pool;
  const out: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? to : from + ((to - from) * i) / (count - 1);
    let idx = Math.min(pool.length - 1, Math.round(f * (pool.length - 1)));
    while (out.includes(pool[idx]) && idx < pool.length - 1) idx++;
    while (out.includes(pool[idx]) && idx > 0) idx--;
    out.push(pool[idx]);
  }
  return out.sort((a, b) => a.score - b.score);
}

// ───────────────────────────── twins (ponds) ─────────────────────────────

export interface PondSpec {
  h: number;
  left: number; // width of the model pond
  right: number; // width of the free pond
  pairs: number;
  sizes: [number, number];
  mirrorP: number;
  /** fraction of model rivets removed (harder: shapes must be inferred) */
  dropRivets: number;
  /** probability a model is dark */
  darkP: number;
  /** extra holes in the free pond */
  holes: number;
}

function randomPoly(r: Rng, size: number): [number, number][] {
  let shape: [number, number][] = [[0, 0]];
  while (shape.length < size) {
    const [a, b] = r.pick(shape);
    const d = r.int(4);
    const nb: [number, number] = [a + [-1, 0, 1, 0][d], b + [0, 1, 0, -1][d]];
    if (!shape.some((x) => x[0] === nb[0] && x[1] === nb[1])) shape.push(nb);
  }
  const mr = Math.min(...shape.map((x) => x[0])), mc = Math.min(...shape.map((x) => x[1]));
  return shape.map(([a, b]) => [a - mr, b - mc]);
}

/** Places shapes (as regions of chosen states) inside a rectangle of a state grid. Returns tiles per shape or null. */
function packShapes(r: Rng, p: PuzzleDef, g: Geometry, state: Uint8Array, fixed: Int8Array, area: { r0: number; c0: number; h: number; w: number }, shapes: { cells: [number, number][]; s: number }[]): number[][] | null {
  const out: number[][] = [];
  for (const sh of shapes) {
    let ok = false;
    for (let tries = 0; tries < 120 && !ok; tries++) {
      const rr0 = area.r0 + r.int(area.h);
      const cc0 = area.c0 + r.int(area.w);
      const tiles: number[] = [];
      let bad = false;
      for (const [a, b] of sh.cells) {
        const rr = rr0 + a, cc = cc0 + b;
        if (rr < area.r0 || rr >= area.r0 + area.h || cc < area.c0 || cc >= area.c0 + area.w) { bad = true; break; }
        const t = rr * p.w + cc;
        if (p.cells[t].hole || (fixed[t] !== -1 && fixed[t] !== sh.s) || fixed[t] === 2 + sh.s) { bad = true; break; }
        tiles.push(t);
      }
      if (bad) continue;
      // tiles must not already belong to another shape
      if (tiles.some((t) => fixed[t] >= 2)) continue;
      let clash = false;
      for (const t of tiles) for (const j of g.nb[t]) if (!tiles.includes(j) && (fixed[j] === sh.s || fixed[j] === 2 + sh.s)) clash = true;
      if (clash) continue;
      for (const t of tiles) { fixed[t] = 2 + sh.s; state[t] = sh.s; }
      for (const t of tiles) for (const j of g.nb[t]) if (!tiles.includes(j) && fixed[j] === -1) { fixed[j] = 1 - sh.s; state[j] = 1 - sh.s; }
      out.push(tiles);
      ok = true;
    }
    if (!ok) return null;
  }
  return out;
}

export function generatePond(r: Rng, ps: PondSpec, id = 'pond'): Candidate | null {
  const w = ps.left + 1 + ps.right;
  const h = ps.h;
  const cells: Cell[] = [];
  for (let i = 0; i < w * h; i++) {
    const c = i % w;
    cells.push(c === ps.left ? { hole: true } : c > ps.left && r.chance(ps.holes) ? { hole: true } : {});
  }
  const p: PuzzleDef = { id, w, h, cells };
  const g = buildGeometry(p);
  const state = new Uint8Array(w * h);
  const fixed = new Int8Array(w * h).fill(-1);
  const models: { cells: [number, number][]; s: number; mirror: boolean }[] = [];
  for (let k = 0; k < ps.pairs; k++) {
    const size = ps.sizes[0] + r.int(ps.sizes[1] - ps.sizes[0] + 1);
    models.push({ cells: randomPoly(r, size), s: r.chance(ps.darkP) ? 0 : 1, mirror: r.chance(ps.mirrorP) });
  }
  const left = packShapes(r, p, g, state, fixed, { r0: 0, c0: 0, h, w: ps.left }, models);
  if (!left) return null;
  const copies = models.map((m) => ({
    cells: (m.mirror ? normalizeCells(m.cells.map(([a, b]) => [a, -b] as [number, number])) : m.cells),
    s: r.chance(0.5) ? 1 : 0,
  }));
  const right = packShapes(r, p, g, state, fixed, { r0: 0, c0: ps.left + 1, h, w: ps.right }, copies);
  if (!right) return null;
  for (let i = 0; i < w * h; i++) if (!cells[i].hole && fixed[i] === -1) state[i] = r.chance(0.5) ? 1 : 0;
  // rivets: the whole left pond (models and their surroundings)
  for (let i = 0; i < w * h; i++) {
    const c = i % w;
    if (c < ps.left && !cells[i].hole) cells[i].lock = state[i] as 0 | 1;
  }
  models.forEach((m, k) => {
    const sym = TWIN_SYMBOLS[k];
    const a = r.pick(left[k]);
    const b = r.pick(right[k]);
    cells[a].glyph = { kind: 'twin', symbol: sym };
    cells[b].glyph = { kind: 'twin', symbol: sym, ...(m.mirror ? { mirror: true } : {}) };
  });
  // drop some rivets (never on twin tiles... allowed, but keep the glyph tile riveted)
  const riveted = freeTiles(p).filter((t) => cells[t].lock !== undefined && !cells[t].glyph);
  for (const t of r.shuffle(riveted).slice(0, Math.round(riveted.length * ps.dropRivets))) {
    const keep = cells[t].lock;
    delete cells[t].lock;
    if (!twinCoreForced(p)) cells[t].lock = keep;
  }
  if (!check(p, state).ok || check(p, initialState(p)).ok) return null;
  if (!twinCoreForced(p)) return null;
  const fin = solve(p, { maxSolutions: 200, maxNodes: 200000, timeLimitMs: 6000 });
  if (!fin.solutions.length || !fin.complete) return null;
  const glyphs = p.cells.filter((c) => c.glyph).length;
  const rivets = p.cells.filter((c) => c.lock !== undefined).length;
  const free = freeTiles(p).length - rivets;
  const score = ps.pairs * 2 + free / 4 + models.filter((m) => m.mirror).length + Math.log2(1 + fin.nodes) - fin.solutions.length / 60;
  return { p, sol: fin.solutions[0], glyphs, rivets, nodes: fin.nodes, simple: false, sols: fin.solutions.length, score, ip: insightPath(p, 30) };
}

function normalizeCells(cells: [number, number][]): [number, number][] {
  const mr = Math.min(...cells.map((x) => x[0])), mc = Math.min(...cells.map((x) => x[1]));
  return cells.map(([a, b]) => [a - mr, b - mc]);
}

/** All solutions (cap 120) give each twin glyph the same region tiles. */
export function twinCoreForced(p: PuzzleDef): boolean {
  const res = solve(p, { maxSolutions: 120, maxNodes: 150000, timeLimitMs: 5000 });
  if (!res.solutions.length || !res.complete) return false;
  const g = buildGeometry(p);
  const twinTiles = freeTiles(p).filter((t) => p.cells[t].glyph?.kind === 'twin');
  let ref: string | null = null;
  for (const s of res.solutions) {
    const reg = computeRegions(g, s);
    const key = twinTiles.map((t) => [...reg.members[reg.id[t]]].sort((a, b) => a - b).join(',')).join('|');
    if (ref === null) ref = key;
    else if (key !== ref) return false;
  }
  return true;
}
