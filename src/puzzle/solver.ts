/**
 * Generic solver for Tessella puzzles (all nine languages + plates, locks, holes, drums,
 * mirror input and echo reachability).
 *
 * Strategy: sound constraint propagation to a fixpoint + DFS. Every complete state is
 * confirmed by rules.check() (the oracle), so propagation only needs to be SOUND (never
 * prune a valid state); it does not need to be complete.
 *
 * Echo / mirror / mute: the reachable states form an affine subspace init + span(pressSets)
 * over GF(2). We convert it to parity checks (the orthogonal complement) and propagate them.
 */
import { allOrientations, initialState, isPressable, mirrorShape, pressSet, regionShape, shapeKey, type Geometry, type Shape } from './board';
import { check, colTiles, geometryOf, rowTiles } from './rules';
import type { PuzzleDef } from './types';

const U = -1;

export interface SolveOptions {
  /** stop after this many solutions (default 2) */
  maxSolutions?: number;
  /** abort after this many DFS nodes (default 400k) */
  maxNodes?: number;
  /** abort after this many milliseconds (default 20000) */
  timeLimitMs?: number;
  /** restrict propagation to "simple" deductions (used for difficulty grading) */
  simple?: boolean;
  /** for puzzles whose rules are blind to light/dark (measure, mold, kinship, twins only),
   *  count solutions up to global inversion */
  breakSymmetry?: boolean;
}

/** True when inverting every tile maps solutions to solutions (only region languages, no rivets). */
export function isInversionSymmetric(p: PuzzleDef): boolean {
  if (p.target || p.rowClues || p.colClues || p.mirror) return false;
  for (const c of p.cells) {
    if (c.hole) continue;
    if (c.lock !== undefined || c.echo?.length || c.mute) return false;
    const k = c.glyph?.kind;
    if (k === 'contour' || k === 'mosaic' || k === 'beacon') return false;
  }
  return true;
}

export interface SolveResult {
  solutions: Uint8Array[];
  /** true when the search finished (solution count is exact up to maxSolutions) */
  complete: boolean;
  nodes: number;
  /** the root propagation alone determined every tile */
  propagationOnly: boolean;
  /** fraction of free tiles determined by root propagation */
  rootDetermined: number;
}

// ───────────────────────────── model ─────────────────────────────

interface Arm {
  b: number; // beacon index
  k: number; // direction
  tiles: number[];
}

interface Model {
  p: PuzzleDef;
  g: Geometry;
  n: number;
  hole: Uint8Array;
  base: Int8Array;
  freeCount: number;
  contour: [number, number][];
  mosaic: { t: number; n: number; win: number[] }[];
  /** overlapping mosaic window pairs: [a, b, intersection, a-only, b-only] */
  mosaicPairs: [number, number, number[], number[], number[]][];
  weave: { tiles: number[]; clue: number[] }[];
  beacons: { t: number; n: number; arms: number[][] }[];
  /** per tile: list of [beacon idx, dir, index in arm] */
  viewers: [number, number, number][][];
  measureAt: Int16Array; // -1 or n
  moldAt: Int16Array; // -1 or mold index
  molds: { t: number; orients: Shape[]; size: number }[];
  gemAt: Int8Array; // -1 or colour index
  gems: number[][]; // tiles per colour index
  twinAt: Int16Array; // -1 or twin group index
  twins: { tiles: number[]; mirror: boolean[] }[];
  checks: { tiles: number[]; rhs: number }[];
  regionRules: boolean;
  order: number[]; // static tie-break priority
  initial: Uint8Array;
}

function buildArms(g: Geometry, b: number): number[][] {
  const arms: number[][] = [];
  for (let k = 0; k < 4; k++) {
    const list: number[] = [];
    let cur = g.dir4[b][k];
    while (cur >= 0 && cur !== b && !list.includes(cur)) {
      list.push(cur);
      cur = g.dir4[cur][k];
    }
    arms.push(list);
  }
  return arms;
}

/** Bitset helpers for GF(2) (n <= 128 via plain arrays of 0/1 — simple and fast enough). */
function gf2Complement(n: number, hole: Uint8Array, vectors: Uint8Array[]): Uint8Array[] {
  // reduce vectors to RREF
  const rows = vectors.map((v) => Uint8Array.from(v));
  const pivots: number[] = [];
  let r = 0;
  for (let col = 0; col < n && r < rows.length; col++) {
    if (hole[col]) continue;
    let sel = -1;
    for (let i = r; i < rows.length; i++) if (rows[i][col]) { sel = i; break; }
    if (sel < 0) continue;
    [rows[r], rows[sel]] = [rows[sel], rows[r]];
    for (let i = 0; i < rows.length; i++) {
      if (i !== r && rows[i][col]) for (let c = 0; c < n; c++) rows[i][c] ^= rows[r][c];
    }
    pivots.push(col);
    r++;
  }
  const basis = rows.slice(0, r);
  const pivotSet = new Set(pivots);
  const out: Uint8Array[] = [];
  for (let f = 0; f < n; f++) {
    if (hole[f] || pivotSet.has(f)) continue;
    const x = new Uint8Array(n);
    x[f] = 1;
    basis.forEach((row, k) => {
      if (row[f]) x[pivots[k]] = 1;
    });
    out.push(x);
  }
  return out;
}

export function compile(p: PuzzleDef): Model {
  const g = geometryOf(p);
  const n = p.w * p.h;
  const hole = new Uint8Array(n);
  const base = new Int8Array(n).fill(U);
  const init = initialState(p);
  const measureAt = new Int16Array(n).fill(-1);
  const moldAt = new Int16Array(n).fill(-1);
  const gemAt = new Int8Array(n).fill(-1);
  const twinAt = new Int16Array(n).fill(-1);
  const contour: [number, number][] = [];
  const mosaic: Model['mosaic'] = [];
  const molds: Model['molds'] = [];
  const beaconsRaw: { t: number; n: number }[] = [];
  const gemIndex = new Map<string, number>();
  const gems: number[][] = [];
  const twinIndex = new Map<string, number>();
  const twins: Model['twins'] = [];

  for (let i = 0; i < n; i++) {
    const c = p.cells[i];
    if (c.hole) {
      hole[i] = 1;
      base[i] = 0;
      continue;
    }
    if (c.lock !== undefined) base[i] = c.lock;
    const gl = c.glyph;
    if (!gl) continue;
    switch (gl.kind) {
      case 'contour': contour.push([i, gl.n]); break;
      case 'mosaic': {
        const win: number[] = [];
        const r0 = Math.floor(i / p.w);
        const c0 = i % p.w;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const r = r0 + dr;
          let cc = c0 + dc;
          if (g.wrap) cc = (cc + p.w) % p.w;
          if (r < 0 || r >= p.h || cc < 0 || cc >= p.w) continue;
          const j = r * p.w + cc;
          if (!p.cells[j].hole && !win.includes(j)) win.push(j);
        }
        mosaic.push({ t: i, n: gl.n, win });
        break;
      }
      case 'measure': measureAt[i] = gl.n; break;
      case 'mold': {
        moldAt[i] = molds.length;
        molds.push({ t: i, orients: gl.free ? allOrientations(gl.cells) : [gl.cells], size: gl.cells.length });
        break;
      }
      case 'beacon': beaconsRaw.push({ t: i, n: gl.n }); base[i] = 1; break;
      case 'gem': {
        if (!gemIndex.has(gl.color)) { gemIndex.set(gl.color, gems.length); gems.push([]); }
        const k = gemIndex.get(gl.color)!;
        gemAt[i] = k;
        gems[k].push(i);
        break;
      }
      case 'twin': {
        if (!twinIndex.has(gl.symbol)) { twinIndex.set(gl.symbol, twins.length); twins.push({ tiles: [], mirror: [] }); }
        const k = twinIndex.get(gl.symbol)!;
        twinAt[i] = k;
        twins[k].tiles.push(i);
        twins[k].mirror.push(!!gl.mirror);
        break;
      }
    }
  }

  const mosaicPairs: Model['mosaicPairs'] = [];
  for (let a = 0; a < mosaic.length; a++) for (let b = a + 1; b < mosaic.length; b++) {
    const A = new Set(mosaic[a].win);
    const B = new Set(mosaic[b].win);
    const I = mosaic[a].win.filter((t) => B.has(t));
    if (!I.length) continue;
    mosaicPairs.push([a, b, I, mosaic[a].win.filter((t) => !B.has(t)), mosaic[b].win.filter((t) => !A.has(t))]);
  }

  const weave: Model['weave'] = [];
  p.rowClues?.forEach((clue, r) => { if (clue) weave.push({ tiles: rowTiles(p, r), clue }); });
  p.colClues?.forEach((clue, c) => { if (clue) weave.push({ tiles: colTiles(p, c), clue }); });

  const beacons = beaconsRaw.map((b) => ({ ...b, arms: buildArms(g, b.t) }));
  const viewers: [number, number, number][][] = Array.from({ length: n }, () => []);
  beacons.forEach((b, bi) => b.arms.forEach((arm, k) => arm.forEach((t, idx) => viewers[t].push([bi, k, idx]))));

  // target plate fixes everything
  if (p.target) {
    for (let i = 0; i < n; i++) if (!hole[i]) {
      const v = p.target[i] === '1' ? 1 : 0;
      if (base[i] !== U && base[i] !== v) base[i] = 2 as unknown as number; // impossible marker
      else base[i] = v;
    }
  }

  // reachability (echo / mirror / mute)
  const checks: Model['checks'] = [];
  const needsGf2 = !!p.mirror || p.cells.some((c) => c.echo?.length || c.mute);
  if (needsGf2) {
    const vectors: Uint8Array[] = [];
    for (let i = 0; i < n; i++) {
      if (!isPressable(p, i)) continue;
      const v = new Uint8Array(n);
      for (const t of pressSet(p, g, i)) v[t] = 1;
      vectors.push(v);
    }
    for (const x of gf2Complement(n, hole, vectors)) {
      const tiles: number[] = [];
      let rhs = 0;
      for (let i = 0; i < n; i++) if (x[i]) { tiles.push(i); rhs ^= init[i]; }
      if (tiles.length === 1) {
        const t = tiles[0];
        if (base[t] !== U && base[t] !== rhs) base[t] = 2 as unknown as number;
        else base[t] = rhs;
      } else checks.push({ tiles, rhs });
    }
  } else {
    // non-pressable, non-locked tiles cannot change
    for (let i = 0; i < n; i++) if (!hole[i] && !isPressable(p, i) && base[i] === U) base[i] = init[i];
  }

  // static priority: glyph tiles and their neighbours first
  const score = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (hole[i]) continue;
    if (p.cells[i].glyph) score[i] += 10;
    for (const j of g.nb[i]) if (p.cells[j].glyph) score[i] += 2;
  }
  const order = [...Array(n).keys()].filter((i) => !hole[i]).sort((a, b) => score[b] - score[a] || a - b);

  let freeCount = 0;
  for (let i = 0; i < n; i++) if (!hole[i] && base[i] === U) freeCount++;

  return {
    p, g, n, hole, base, freeCount, contour, mosaic, mosaicPairs, weave, beacons, viewers, measureAt, moldAt, molds,
    gemAt, gems, twinAt, twins, checks,
    regionRules: measureAt.some((x) => x >= 0) || molds.length > 0 || gems.length > 0 || twins.length > 0,
    order, initial: init,
  };
}

// ───────────────────────────── propagation ─────────────────────────────

/** Deduction categories. BASIC = what a beginner sees at once; the rest are the "ahá" insights. */
export const BASIC_DEDUCTIONS = new Set(['contour', 'mosaic', 'weave', 'beacon-count', 'beacon-source', 'measure-close', 'merge', 'kin-color', 'echo']);
export const INSIGHT_ORDER = ['measure-exit', 'mold-exit', 'beacon-single', 'mosaic-pair', 'measure-fill', 'kin-state', 'kin-cut', 'measure-room', 'mold-room', 'mold-place', 'twin-place'] as const;

class Ctx {
  changed = false;
  constructor(public val: Int8Array, public cats: Set<string> | null = null) {}
  allow(tag: string): boolean {
    return !this.cats || this.cats.has(tag);
  }
  set(i: number, v: number, tag = ''): boolean {
    const cur = this.val[i];
    if (cur === v) return true;
    if (cur !== U) return false;
    if (this.cats && !this.cats.has(tag)) return true; // deduction not available at this level
    this.val[i] = v;
    this.changed = true;
    return true;
  }
}

function propContour(m: Model, c: Ctx): boolean {
  const val = c.val;
  for (const [t, n] of m.contour) {
    const d = m.g.dir4[t];
    let k1 = 0, k0 = 0, unk = 0;
    for (let k = 0; k < 4; k++) {
      const j = d[k];
      const v = j < 0 ? 0 : val[j];
      if (v === U) unk++;
      else if (v === 1) k1++;
      else k0++;
    }
    const s = val[t];
    if (s !== U) {
      const bk = s === 1 ? k0 : k1;
      if (bk > n || bk + unk < n) return false;
      if (unk) {
        const fill = bk === n ? s : bk + unk === n ? 1 - s : U;
        if (fill !== U) for (let k = 0; k < 4; k++) { const j = d[k]; if (j >= 0 && val[j] === U && !c.set(j, fill, 'contour')) return false; }
      }
    } else {
      const ok0 = k1 <= n && k1 + unk >= n;
      const ok1 = k0 <= n && k0 + unk >= n;
      if (!ok0 && !ok1) return false;
      if (!ok0) { if (!c.set(t, 1, 'contour')) return false; }
      else if (!ok1) { if (!c.set(t, 0, 'contour')) return false; }
    }
  }
  return true;
}

function propMosaic(m: Model, c: Ctx, simple = false): boolean {
  const val = c.val;
  for (const { n, win } of m.mosaic) {
    let lit = 0, unk = 0;
    for (const j of win) { if (val[j] === 1) lit++; else if (val[j] === U) unk++; }
    if (lit > n || lit + unk < n) return false;
    if (unk) {
      const fill = lit === n ? 0 : lit + unk === n ? 1 : U;
      if (fill !== U) for (const j of win) if (val[j] === U && !c.set(j, fill, 'mosaic')) return false;
    }
  }
  if (simple || c.changed || !c.allow('mosaic-pair')) return true;
  // pair reasoning: two overlapping windows share their intersection
  const cnt = (list: number[]): [number, number] => {
    let lit = 0, unk = 0;
    for (const j of list) { if (val[j] === 1) lit++; else if (val[j] === U) unk++; }
    return [lit, unk];
  };
  const fill = (list: number[], v: number): boolean => {
    for (const j of list) if (val[j] === U && !c.set(j, v, 'mosaic-pair')) return false;
    return true;
  };
  for (const [ia, ib, I, X, Y] of m.mosaicPairs) {
    const a = m.mosaic[ia].n, b = m.mosaic[ib].n;
    const [lI, uI] = cnt(I), [lX, uX] = cnt(X), [lY, uY] = cnt(Y);
    if (!uI && !uX && !uY) continue;
    let lo = Math.max(0, a - lX - lI - uX, b - lY - lI - uY);
    let hi = Math.min(uI, a - lX - lI, b - lY - lI);
    if (lo > hi) return false;
    const xMax = a - lX - lI - lo, xMin = a - lX - lI - hi;
    const yMax = b - lY - lI - lo, yMin = b - lY - lI - hi;
    if (uI && lo === uI && !fill(I, 1)) return false;
    if (uI && hi === 0 && !fill(I, 0)) return false;
    if (uX && xMin === uX && !fill(X, 1)) return false;
    if (uX && xMax === 0 && !fill(X, 0)) return false;
    if (uY && yMin === uY && !fill(Y, 1)) return false;
    if (uY && yMax === 0 && !fill(Y, 0)) return false;
    if (c.changed) return true;
    void lo; void hi;
  }
  return true;
}

/** Line solver for one weave clue. Returns false on contradiction. */
function propLine(m: Model, c: Ctx, tiles: number[], clue: number[]): boolean {
  const val = c.val;
  const L = tiles.length;
  const cell = new Int8Array(L);
  let anyUnknown = false;
  for (let i = 0; i < L; i++) {
    const t = tiles[i];
    cell[i] = m.hole[t] ? 0 : val[t];
    if (cell[i] === U) anyUnknown = true;
  }
  // prefix counts of known-1 and known-0
  const k1 = new Int16Array(L + 1);
  const k0 = new Int16Array(L + 1);
  for (let i = 0; i < L; i++) { k1[i + 1] = k1[i] + (cell[i] === 1 ? 1 : 0); k0[i + 1] = k0[i] + (cell[i] === 0 ? 1 : 0); }
  const zeroOK = (a: number, b: number) => a >= b || k1[b] - k1[a] === 0;
  const oneOK = (a: number, b: number) => k0[b] - k0[a] === 0;
  const K = clue.length;
  const memo = new Int8Array((K + 1) * (L + 2)).fill(-1);
  const ok = (j: number, pos: number): boolean => {
    if (pos > L) pos = L;
    const key = j * (L + 2) + pos;
    if (memo[key] !== -1) return memo[key] === 1;
    let res = false;
    if (j === K) res = zeroOK(pos, L);
    else {
      const len = clue[j];
      for (let s = pos; s + len <= L; s++) {
        if (!zeroOK(pos, s)) break;
        if (!oneOK(s, s + len)) continue;
        const end = s + len;
        if (end === L) { if (j === K - 1) { res = true; break; } continue; }
        if (cell[end] === 1) continue;
        if (ok(j + 1, end + 1)) { res = true; break; }
      }
    }
    memo[key] = res ? 1 : 0;
    return res;
  };
  if (!ok(0, 0)) return false;
  if (!anyUnknown) return true;
  const can0 = new Uint8Array(L);
  const can1 = new Uint8Array(L);
  const seen = new Uint8Array((K + 1) * (L + 2));
  const mark = (j: number, pos: number) => {
    if (pos > L) pos = L;
    const key = j * (L + 2) + pos;
    if (seen[key]) return;
    seen[key] = 1;
    if (j === K) { for (let i = pos; i < L; i++) can0[i] = 1; return; }
    const len = clue[j];
    for (let s = pos; s + len <= L; s++) {
      if (!zeroOK(pos, s)) break;
      if (!oneOK(s, s + len)) continue;
      const end = s + len;
      let feasible = false;
      if (end === L) feasible = j === K - 1;
      else feasible = cell[end] !== 1 && ok(j + 1, end + 1);
      if (!feasible) continue;
      for (let i = pos; i < s; i++) can0[i] = 1;
      for (let i = s; i < end; i++) can1[i] = 1;
      if (end < L) { can0[end] = 1; mark(j + 1, end + 1); }
    }
  };
  mark(0, 0);
  for (let i = 0; i < L; i++) {
    if (cell[i] !== U) continue;
    const t = tiles[i];
    if (can1[i] && !can0[i]) { if (!c.set(t, 1, 'weave')) return false; }
    else if (can0[i] && !can1[i]) { if (!c.set(t, 0, 'weave')) return false; }
    else if (!can0[i] && !can1[i]) return false;
  }
  return true;
}

function propWeave(m: Model, c: Ctx): boolean {
  for (const w of m.weave) if (!propLine(m, c, w.tiles, w.clue)) return false;
  return true;
}

function propBeacon(m: Model, c: Ctx): boolean {
  if (!m.beacons.length) return true;
  const val = c.val;
  for (const b of m.beacons) {
    if (val[b.t] === 0) return false;
    const mins = [0, 0, 0, 0];
    const maxs = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const arm = b.arms[k];
      let i = 0;
      while (i < arm.length && val[arm[i]] === 1) i++;
      mins[k] = i;
      let j = 0;
      while (j < arm.length && val[arm[j]] !== 0) j++;
      maxs[k] = j;
    }
    const need = b.n - 1;
    const sMin = mins[0] + mins[1] + mins[2] + mins[3];
    const sMax = maxs[0] + maxs[1] + maxs[2] + maxs[3];
    if (need < sMin || need > sMax) return false;
    for (let k = 0; k < 4; k++) {
      const arm = b.arms[k];
      const lb = Math.max(mins[k], need - (sMax - maxs[k]));
      for (let i = mins[k]; i < lb; i++) if (!c.set(arm[i], 1, 'beacon-count')) return false;
      const ub = Math.min(maxs[k], need - (sMin - mins[k]));
      const curMin = Math.max(mins[k], lb);
      if (ub === curMin && curMin < arm.length && val[arm[curMin]] === U) {
        if (!c.set(arm[curMin], 0, 'beacon-count')) return false;
      }
    }
  }
  // every lit tile must be seen
  for (let t = 0; t < m.n; t++) {
    if (m.hole[t] || val[t] === 0) continue;
    if (m.p.cells[t].glyph?.kind === 'beacon') continue;
    let count = 0;
    let only: [number, number, number] | null = null;
    for (const v of m.viewers[t]) {
      const arm = m.beacons[v[0]].arms[v[1]];
      let ok = true;
      for (let i = 0; i < v[2]; i++) if (val[arm[i]] === 0) { ok = false; break; }
      if (ok) { count++; only = v; if (count > 1) break; }
    }
    if (count === 0) {
      if (val[t] === 1) return false;
      if (!c.set(t, 0, 'beacon-source')) return false;
    } else if (count === 1 && val[t] === 1 && only) {
      const arm = m.beacons[only[0]].arms[only[1]];
      for (let i = 0; i < only[2]; i++) if (!c.set(arm[i], 1, 'beacon-single')) return false;
    }
  }
  return true;
}

function propChecks(m: Model, c: Ctx): boolean {
  const val = c.val;
  for (const ch of m.checks) {
    let par = 0, unk = 0, last = -1;
    for (const t of ch.tiles) {
      const v = val[t];
      if (v === U) { unk++; last = t; if (unk > 1) break; }
      else par ^= v;
    }
    if (unk === 0 && par !== ch.rhs) return false;
    if (unk === 1) {
      // recompute parity fully (loop may have broken early only when unk > 1)
      if (!c.set(last, par ^ ch.rhs, 'echo')) return false;
    }
  }
  return true;
}

// ── region machinery ──

interface Comp {
  s: number;
  tiles: number[];
  unkNb: number[];
  measure: number; // -1 none, -2 conflict, else n
  molds: number[];
  gem: number; // -1 none, -2 conflict
  twins: number[]; // twin tiles inside
}

function components(m: Model, val: Int8Array): { cid: Int32Array; comps: Comp[] } {
  const n = m.n;
  const cid = new Int32Array(n).fill(-1);
  const comps: Comp[] = [];
  const stack: number[] = [];
  const nbMark = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (m.hole[i] || val[i] === U || cid[i] !== -1) continue;
    const s = val[i];
    const id = comps.length;
    const comp: Comp = { s, tiles: [], unkNb: [], measure: -1, molds: [], gem: -1, twins: [] };
    cid[i] = id;
    stack.push(i);
    while (stack.length) {
      const t = stack.pop()!;
      comp.tiles.push(t);
      const mn = m.measureAt[t];
      if (mn >= 0) comp.measure = comp.measure === -1 ? mn : comp.measure === mn ? mn : -2;
      if (m.moldAt[t] >= 0) comp.molds.push(m.moldAt[t]);
      const ge = m.gemAt[t];
      if (ge >= 0) comp.gem = comp.gem === -1 ? ge : comp.gem === ge ? ge : -2;
      if (m.twinAt[t] >= 0) comp.twins.push(t);
      for (const j of m.g.nb[t]) {
        const v = val[j];
        if (v === U) {
          if (nbMark[j] !== id) { nbMark[j] = id; comp.unkNb.push(j); }
        } else if (v === s && cid[j] === -1) {
          cid[j] = id;
          stack.push(j);
        }
      }
    }
    comps.push(comp);
  }
  return { cid, comps };
}

/** Max number of tiles the region of comp could reach (flood through U and compatible same-state tiles). */
function maxPotential(m: Model, val: Int8Array, cid: Int32Array, comps: Comp[], ci: number, cap: number): Set<number> {
  const comp = comps[ci];
  const s = comp.s;
  const seen = new Set<number>(comp.tiles);
  const stack = [...comp.tiles];
  while (stack.length && seen.size <= cap) {
    const t = stack.pop()!;
    for (const j of m.g.nb[t]) {
      if (seen.has(j)) continue;
      const v = val[j];
      if (v === U) {
        // an unknown tile carrying a conflicting measure cannot join
        const mn = m.measureAt[j];
        if (mn >= 0 && comp.measure >= 0 && mn !== comp.measure) continue;
        const ge = m.gemAt[j];
        if (ge >= 0 && comp.gem >= 0 && ge !== comp.gem) continue;
        seen.add(j);
        stack.push(j);
      } else if (v === s) {
        const other = comps[cid[j]];
        if (comp.measure >= 0 && other.measure >= 0 && other.measure !== comp.measure) continue;
        if (comp.gem >= 0 && other.gem >= 0 && other.gem !== comp.gem) continue;
        for (const x of other.tiles) if (!seen.has(x)) { seen.add(x); stack.push(x); }
      }
    }
  }
  return seen;
}

function shapeWidth(o: Shape): number {
  let w = 0;
  for (const x of o) if (x[1] + 1 > w) w = x[1] + 1;
  return w;
}
/** On drums, shapes as wide as the drum can wrap onto themselves: no placement reasoning then. */
function placeable(m: Model, orients: Shape[]): boolean {
  return !m.g.wrap || orients.every((o) => shapeWidth(o) < m.p.w);
}

function rc(m: Model, t: number): [number, number] {
  return [Math.floor(t / m.p.w), t % m.p.w];
}

/** Valid placements of `shape` (list of orientations) for comp containing anchor t. */
function placements(m: Model, val: Int8Array, cid: Int32Array, comps: Comp[], ci: number, t: number, orients: Shape[]): number[][] {
  const { p } = m;
  const comp = comps[ci];
  const s = comp.s;
  const [rt, ct] = rc(m, t);
  const out: number[][] = [];
  const seenKeys = new Set<string>();
  for (const o of orients) {
    for (const [ar, ac] of o) {
      const cells: number[] = [];
      let bad = false;
      for (const [r, cc0] of o) {
        const rr = rt + (r - ar);
        let cc = ct + (cc0 - ac);
        if (m.g.wrap) cc = ((cc % p.w) + p.w) % p.w;
        if (rr < 0 || rr >= p.h || cc < 0 || cc >= p.w) { bad = true; break; }
        const j = rr * p.w + cc;
        if (m.hole[j] || val[j] === 1 - s) { bad = true; break; }
        cells.push(j);
      }
      if (bad) continue;
      const set = new Set(cells);
      if (set.size !== cells.length) continue;
      const key = [...set].sort((a, b) => a - b).join(',');
      if (seenKeys.has(key)) continue;
      // comp inside placement
      if (comp.tiles.some((x) => !set.has(x))) continue;
      // any known-s tile inside must have its whole comp inside
      let ok = true;
      for (const j of cells) {
        if (val[j] === s && cid[j] !== ci) {
          const other = comps[cid[j]];
          if (other.tiles.some((x) => !set.has(x))) { ok = false; break; }
        }
      }
      if (!ok) continue;
      // outside neighbours cannot be s
      for (const j of cells) {
        for (const q of m.g.nb[j]) if (!set.has(q) && val[q] === s) { ok = false; break; }
        if (!ok) break;
      }
      if (!ok) continue;
      // region must not swallow conflicting glyphs: a measure glyph inside must equal size, another mold must accept, gems single colour, twin pair not both
      let gem = -1;
      let twinSeen = new Set<number>();
      for (const j of cells) {
        const mn = m.measureAt[j];
        if (mn >= 0 && mn !== cells.length) { ok = false; break; }
        const ge = m.gemAt[j];
        if (ge >= 0) { if (gem >= 0 && gem !== ge) { ok = false; break; } gem = ge; }
        const tw = m.twinAt[j];
        if (tw >= 0) { if (twinSeen.has(tw)) { ok = false; break; } twinSeen.add(tw); }
      }
      if (!ok) continue;
      seenKeys.add(key);
      out.push(cells);
    }
  }
  return out;
}

/** Is there any placement of the mold containing u, with every cell unknown-or-s and no known-s tile touching it from outside? */
function probeMold(m: Model, val: Int8Array, u: number, s: number, orients: Shape[]): boolean {
  const { p } = m;
  const [rt, ct] = rc(m, u);
  for (const o of orients) {
    for (const [ar, ac] of o) {
      const cells: number[] = [];
      let bad = false;
      for (const [r, c0] of o) {
        const rr = rt + (r - ar);
        let cc = ct + (c0 - ac);
        if (m.g.wrap) cc = ((cc % p.w) + p.w) % p.w;
        if (rr < 0 || rr >= p.h || cc < 0 || cc >= p.w) { bad = true; break; }
        const j = rr * p.w + cc;
        if (m.hole[j] || val[j] === 1 - s) { bad = true; break; }
        cells.push(j);
      }
      if (bad) continue;
      const set = new Set(cells);
      if (set.size !== cells.length) continue;
      let ok = true;
      for (const j of cells) {
        for (const q of m.g.nb[j]) if (!set.has(q) && val[q] === s) { ok = false; break; }
        if (!ok) break;
      }
      if (ok) return true;
    }
  }
  return false;
}

function applyPlacements(m: Model, c: Ctx, s: number, pls: number[][], tag: string): boolean {
  if (!pls.length) return false;
  const n = m.n;
  const inAll = new Int32Array(n);
  const outAll = new Int32Array(n);
  for (const cells of pls) {
    const set = new Set(cells);
    for (const j of cells) inAll[j]++;
    const outs = new Set<number>();
    for (const j of cells) for (const q of m.g.nb[j]) if (!set.has(q)) outs.add(q);
    for (const q of outs) outAll[q]++;
  }
  for (let j = 0; j < n; j++) {
    if (c.val[j] !== U) continue;
    if (inAll[j] === pls.length) { if (!c.set(j, s, tag)) return false; }
    else if (outAll[j] === pls.length) { if (!c.set(j, 1 - s, tag)) return false; }
  }
  return true;
}

function propRegions(m: Model, c: Ctx, simple: boolean): boolean {
  if (!m.regionRules) return true;
  const val = c.val;
  const { cid, comps } = components(m, val);

  // conflicts inside components + measure growth/closure + molds
  for (let ci = 0; ci < comps.length; ci++) {
    const comp = comps[ci];
    if (comp.measure === -2 || comp.gem === -2) return false;
    // twins: two tiles of one pair in a component
    if (comp.twins.length > 1) {
      const seen = new Set<number>();
      for (const t of comp.twins) { const k = m.twinAt[t]; if (seen.has(k)) return false; seen.add(k); }
    }
    let limit = Infinity;
    if (comp.measure >= 0) limit = comp.measure;
    for (const mi of comp.molds) limit = Math.min(limit, m.molds[mi].size);
    if (comp.tiles.length > limit) return false;
    if (comp.measure >= 0) {
      const n = comp.measure;
      if (comp.tiles.length === n) {
        for (const u of comp.unkNb) if (!c.set(u, 1 - comp.s, 'measure-close')) return false;
      } else {
        if (comp.unkNb.length === 0) return false; // closed but too small
        // the only way out must be taken
        if (comp.unkNb.length === 1 && c.allow('measure-exit')) { if (!c.set(comp.unkNb[0], comp.s, 'measure-exit')) return false; return true; }
        const pot = maxPotential(m, val, cid, comps, ci, n);
        if (pot.size < n) return false;
        if (!simple && pot.size === n) for (const j of pot) if (val[j] === U && !c.set(j, comp.s, 'measure-fill')) return false;
      }
      if (c.changed) return true;
    }
    if (comp.molds.length) {
      const mold = m.molds[comp.molds[0]];
      if (comp.tiles.length < mold.size && comp.unkNb.length === 1 && c.allow('mold-exit')) { if (!c.set(comp.unkNb[0], comp.s, 'mold-exit')) return false; return true; }
      if (comp.tiles.length < mold.size && comp.unkNb.length === 0) return false;
      if (simple) {
        if (comp.tiles.length === mold.size && comp.unkNb.length === 0) {
          const key = shapeKey(regionShape(m.g, comp.tiles));
          if (!mold.orients.some((o) => shapeKey(o) === key)) return false;
        }
      } else if (placeable(m, mold.orients)) {
        const pls = placements(m, val, cid, comps, ci, mold.t, mold.orients);
        if (!applyPlacements(m, c, comp.s, pls, 'mold-place')) return false;
        if (c.changed) return true;
      }
    }
  }

  // twins
  for (const tw of m.twins) {
    if (tw.tiles.some((t) => val[t] === U)) continue;
    const cs = tw.tiles.map((t) => cid[t]);
    if (new Set(cs).size !== cs.length) return false;
    // find a closed one
    let ref = -1;
    for (let k = 0; k < cs.length; k++) if (comps[cs[k]].unkNb.length === 0) { ref = k; break; }
    if (ref < 0) {
      // size bounds
      if (!simple) {
        for (let a = 0; a < cs.length; a++) for (let b = 0; b < cs.length; b++) {
          if (a === b) continue;
          const need = comps[cs[a]].tiles.length;
          const pot = maxPotential(m, val, cid, comps, cs[b], need);
          if (pot.size < need) return false;
        }
      }
      continue;
    }
    const refShape = regionShape(m.g, comps[cs[ref]].tiles);
    for (let k = 0; k < cs.length; k++) {
      if (k === ref) continue;
      const shape = tw.mirror[k] !== tw.mirror[ref] ? mirrorShape(refShape) : refShape;
      const comp = comps[cs[k]];
      if (comp.unkNb.length === 0) {
        if (shapeKey(regionShape(m.g, comp.tiles)) !== shapeKey(shape)) return false;
      } else if (!simple && placeable(m, [shape])) {
        if (comp.tiles.length > shape.length) return false;
        const pls = placements(m, val, cid, comps, cs[k], tw.tiles[k], [shape]);
        if (!applyPlacements(m, c, comp.s, pls, 'twin-place')) return false;
        if (c.changed) return true;
      } else if (comp.tiles.length > shape.length) return false;
    }
  }

  if (c.changed) return true; // recompute components before merge checks

  // probes: an unknown twin tile whose partner's region is already closed must be able to host the copy
  if (!simple && c.allow('twin-place')) {
    for (const tw of m.twins) {
      for (let k = 0; k < tw.tiles.length; k++) {
        const u = tw.tiles[k];
        if (val[u] !== U) continue;
        let shape: Shape | null = null;
        for (let j = 0; j < tw.tiles.length; j++) {
          if (j === k || val[tw.tiles[j]] === U) continue;
          const comp = comps[cid[tw.tiles[j]]];
          if (comp.unkNb.length) continue;
          const base = regionShape(m.g, comp.tiles);
          shape = tw.mirror[k] !== tw.mirror[j] ? mirrorShape(base) : base;
          break;
        }
        if (!shape || !placeable(m, [shape])) continue;
        const ok0 = probeMold(m, val, u, 0, [shape]);
        const ok1 = probeMold(m, val, u, 1, [shape]);
        if (!ok0 && !ok1) return false;
        if (!ok0) { if (!c.set(u, 1, 'twin-place')) return false; return true; }
        if (!ok1) { if (!c.set(u, 0, 'twin-place')) return false; return true; }
      }
    }
  }

  // probes: an unknown measure/mold tile cannot take a state in which its region has no room
  if (!simple) {
    for (let u = 0; u < m.n; u++) {
      if (m.hole[u] || val[u] !== U) continue;
      const need = m.measureAt[u] >= 0 ? m.measureAt[u] : m.moldAt[u] >= 0 ? m.molds[m.moldAt[u]].size : -1;
      if (need < 0) continue;
      let ok0 = true, ok1 = true;
      for (let s2 = 0; s2 <= 1; s2++) {
        // flood through unknown or s2 tiles (stopping at known opposite / holes)
        const seen = new Set<number>([u]);
        const stack = [u];
        while (stack.length && seen.size < need) {
          const t = stack.pop()!;
          for (const j of m.g.nb[t]) {
            if (seen.has(j)) continue;
            const v = val[j];
            if (v === 1 - s2) continue;
            seen.add(j);
            stack.push(j);
          }
        }
        let room = seen.size >= need;
        if (room && m.moldAt[u] >= 0 && placeable(m, m.molds[m.moldAt[u]].orients)) {
          room = probeMold(m, val, u, s2, m.molds[m.moldAt[u]].orients);
        }
        if (!room) { if (s2 === 0) ok0 = false; else ok1 = false; }
      }
      if (!ok0 && !ok1) return false;
      const ptag = m.measureAt[u] >= 0 ? 'measure-room' : 'mold-room';
      if (!c.allow(ptag)) continue;
      if (!ok0) { if (!c.set(u, 1, ptag)) return false; return true; }
      if (!ok1) { if (!c.set(u, 0, ptag)) return false; return true; }
    }
  }

  // merge checks for unknown tiles
  for (let u = 0; u < m.n; u++) {
    if (m.hole[u] || val[u] !== U) continue;
    let ok0 = true, ok1 = true;
    for (let s = 0; s <= 1; s++) {
      const ids = new Set<number>();
      for (const j of m.g.nb[u]) if (val[j] === s) ids.add(cid[j]);
      let size = 1;
      let meas = m.measureAt[u];
      let measConflict = false;
      let moldLimit = m.moldAt[u] >= 0 ? m.molds[m.moldAt[u]].size : Infinity;
      let gem = m.gemAt[u];
      let gemConflict = false;
      const twinGroups = new Set<number>();
      let twinConflict = false;
      if (m.twinAt[u] >= 0) twinGroups.add(m.twinAt[u]);
      for (const id of ids) {
        const comp = comps[id];
        size += comp.tiles.length;
        if (comp.measure >= 0) { if (meas >= 0 && meas !== comp.measure) measConflict = true; else meas = comp.measure; }
        for (const mi of comp.molds) moldLimit = Math.min(moldLimit, m.molds[mi].size);
        if (comp.gem >= 0) { if (gem >= 0 && gem !== comp.gem) gemConflict = true; else gem = comp.gem; }
        for (const t of comp.twins) { const k = m.twinAt[t]; if (twinGroups.has(k)) twinConflict = true; twinGroups.add(k); }
      }
      const bad = measConflict || gemConflict || twinConflict || (meas >= 0 && size > meas) || size > moldLimit;
      if (bad) { if (s === 0) ok0 = false; else ok1 = false; }
    }
    if (!ok0 && !ok1) return false;
    if (!c.allow('merge')) continue;
    if (!ok0) { if (!c.set(u, 1, 'merge')) return false; return true; }
    if (!ok1) { if (!c.set(u, 0, 'merge')) return false; return true; }
  }

  // kinship connectivity
  if (m.gems.length) {
    for (let k = 0; k < m.gems.length; k++) {
      const tiles = m.gems[k];
      let s = U;
      for (const t of tiles) {
        if (val[t] !== U) { if (s !== U && s !== val[t]) return false; s = val[t]; }
      }
      if (s !== U) for (const t of tiles) if (!c.set(t, s, 'kin-color')) return false;
      if (c.changed) return true;
      if (tiles.length < 2) continue;
      const states = s === U ? [0, 1] : [s];
      const feasible: number[] = [];
      for (const st of states) if (kinConnected(m, val, cid, comps, k, st, -1)) feasible.push(st);
      if (!feasible.length) return false;
      if (feasible.length === 1 && s === U && c.allow('kin-state')) {
        for (const t of tiles) if (!c.set(t, feasible[0], 'kin-state')) return false;
        return true;
      }
      if (s !== U && c.allow('kin-cut')) {
        // articulation forcing
        const usable = kinUsable(m, val, cid, comps, k, s);
        for (const u of usable) {
          if (val[u] !== U) continue;
          if (!kinConnected(m, val, cid, comps, k, s, u)) { if (!c.set(u, s, 'kin-cut')) return false; return true; }
        }
      }
    }
  }
  return true;
}

function kinUsableTile(m: Model, val: Int8Array, cid: Int32Array, comps: Comp[], k: number, s: number, j: number): boolean {
  if (m.hole[j]) return false;
  const v = val[j];
  if (v === 1 - s) return false;
  if (v === s) { const g = comps[cid[j]].gem; return g === -1 || g === k; }
  // unknown: must not carry another colour, must not touch a same-state comp with another colour
  const ge = m.gemAt[j];
  if (ge >= 0 && ge !== k) return false;
  for (const q of m.g.nb[j]) if (val[q] === s) { const g = comps[cid[q]].gem; if (g >= 0 && g !== k) return false; }
  return true;
}

function kinUsable(m: Model, val: Int8Array, cid: Int32Array, comps: Comp[], k: number, s: number): number[] {
  const start = m.gems[k][0];
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const t = stack.pop()!;
    for (const j of m.g.nb[t]) {
      if (seen.has(j)) continue;
      if (!kinUsableTile(m, val, cid, comps, k, s, j)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return [...seen];
}

function kinConnected(m: Model, val: Int8Array, cid: Int32Array, comps: Comp[], k: number, s: number, banned: number): boolean {
  const tiles = m.gems[k];
  for (const t of tiles) {
    if (val[t] === 1 - s) return false;
    if (!kinUsableTile(m, val, cid, comps, k, s, t) && val[t] !== s) return false;
  }
  const start = tiles[0];
  if (start === banned) return false;
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const t = stack.pop()!;
    for (const j of m.g.nb[t]) {
      if (seen.has(j) || j === banned) continue;
      if (!kinUsableTile(m, val, cid, comps, k, s, j)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return tiles.every((t) => seen.has(t));
}

function propagate(m: Model, val: Int8Array, simple = false, trace?: (rule: string, set: number) => void, cats: Set<string> | null = null, once = false): boolean {
  const c = new Ctx(val, cats ?? (simple ? BASIC_DEDUCTIONS : null));
  const known = () => { let k = 0; for (let i = 0; i < val.length; i++) if (val[i] !== U) k++; return k; };
  const step = (name: string, fn: () => boolean): boolean => {
    if (!trace) return fn();
    const before = known();
    const ok = fn();
    const after = known();
    if (after > before) trace(name, after - before);
    return ok;
  };
  for (let round = 0; round < 4000; round++) {
    c.changed = false;
    if (!step('contour', () => propContour(m, c))) return false;
    if (once && c.changed) return true;
    if (!step('mosaic', () => propMosaic(m, c, simple))) return false;
    if (once && c.changed) return true;
    if (!step('weave', () => propWeave(m, c))) return false;
    if (once && c.changed) return true;
    if (!step('beacon', () => propBeacon(m, c))) return false;
    if (once && c.changed) return true;
    if (m.checks.length && !step('echo', () => propChecks(m, c))) return false;
    if (!c.changed && !step('regions', () => propRegions(m, c, simple))) return false;
    if (!c.changed || once) return true;
  }
  return true;
}

/** Records which languages make progress, in order, when solving by pure deduction. */
export function traceDeduction(p: PuzzleDef): { steps: [string, number][]; solved: boolean } {
  const m = compile(p);
  const val = Int8Array.from(m.base);
  const steps: [string, number][] = [];
  const ok = propagate(m, val, false, (rule, n) => {
    const last = steps[steps.length - 1];
    if (last && last[0] === rule) last[1] += n;
    else steps.push([rule, n]);
  });
  return { steps, solved: ok && val.every((v, i) => m.hole[i] || v !== U) };
}

export interface InsightStep {
  /** the "ahá" deduction that unlocked progress */
  tag: string;
  /** tiles decided by the insight itself */
  direct: number;
  /** tiles that then followed by basic deductions */
  cascade: number;
}
export interface InsightPath {
  /** every tile was determined (or, for open puzzles, everything that is forced) */
  solved: boolean;
  /** fraction of free tiles a beginner determines before needing any insight */
  basicRoot: number;
  steps: InsightStep[];
  /** fraction of free tiles determined at the end */
  determined: number;
}

/**
 * Simulates a human-like solve: basic deductions to a fixpoint; when stuck, apply ONE kind of
 * insight (in INSIGHT_ORDER, then a one-step "what if" contradiction = 'lookahead'), then go back
 * to basic deductions. The resulting list of insights is the puzzle's "ahá" path.
 */
export function insightPath(p: PuzzleDef, maxLookahead = 30): InsightPath {
  const m = compile(p);
  const val = Int8Array.from(m.base);
  if (isInversionSymmetric(p) && m.order.length) val[m.order[0]] = 1;
  const known = (v: Int8Array) => { let k = 0; for (let i = 0; i < v.length; i++) if (!m.hole[i] && v[i] !== U) k++; return k; };
  const total = m.n - m.hole.reduce((a, b) => a + b, 0);
  const start = known(val);
  const free = Math.max(1, total - start);
  const steps: InsightStep[] = [];
  const done = () => known(val) === total;
  if (!propagate(m, val, true)) return { solved: false, basicRoot: 0, steps, determined: 0 };
  const basicRoot = (known(val) - start) / free;
  let looks = 0;
  while (!done()) {
    const before = known(val);
    let tag: string | null = null;
    for (const t of INSIGHT_ORDER) {
      const trial = Int8Array.from(val);
      if (!propagate(m, trial, false, undefined, new Set([t]), true)) continue;
      if (known(trial) > before) { val.set(trial); tag = t; break; }
    }
    if (!tag && looks < maxLookahead) {
      // one-step "what if": a tile whose one value breaks a rule at once (basic deductions only)
      // frontier: unknown tiles next to something known or carrying a clue
      const cand = m.order.filter((i) => val[i] === U && (m.p.cells[i].glyph || m.g.nb[i].some((j) => val[j] !== U)));
      for (const u of cand) {
        for (const v of [0, 1]) {
          const trial = Int8Array.from(val);
          trial[u] = v;
          if (!propagate(m, trial, true)) {
            val[u] = 1 - v;
            tag = 'lookahead';
            break;
          }
        }
        if (tag) break;
      }
      if (!tag) {
        // deeper "what if": follow the consequences with every deduction the player knows
        for (const u of cand) {
          for (const v of [0, 1]) {
            const trial = Int8Array.from(val);
            trial[u] = v;
            if (!propagate(m, trial, false)) {
              val[u] = 1 - v;
              tag = 'lookahead';
              break;
            }
          }
          if (tag) break;
        }
      }
      if (tag) looks++;
    }
    if (!tag && m.twins.length) {
      // open twin puzzles: the colour of a copy is often free — pick one that still has a solution
      // (a free choice, not an insight) and keep reasoning about where the copies fit
      const u = m.twins.flatMap((t) => t.tiles).find((t) => val[t] === U);
      if (u !== undefined) {
        for (const v of [1, 0]) {
          const q: PuzzleDef = { ...p, cells: p.cells.map((cell, i) => (i === u ? { ...cell, lock: v as 0 | 1 } : val[i] !== U && !cell.hole && cell.lock === undefined ? { ...cell, lock: val[i] as 0 | 1 } : cell)) };
          if (solve(q, { maxSolutions: 1, maxNodes: 20000, timeLimitMs: 2000 }).solutions.length) {
            val[u] = v;
            break;
          }
        }
        if (val[u] !== U) {
          if (!propagate(m, val, true)) return { solved: false, basicRoot, steps, determined: (known(val) - start) / free };
          continue;
        }
      }
    }
    if (!tag) break;
    const mid = known(val);
    if (!propagate(m, val, true)) return { solved: false, basicRoot, steps, determined: (known(val) - start) / free };
    steps.push({ tag, direct: mid - before, cascade: known(val) - mid });
  }
  return { solved: done(), basicRoot, steps, determined: (known(val) - start) / free };
}

// ───────────────────────────── search ─────────────────────────────

function finalCheck(m: Model, val: Int8Array): boolean {
  const s = new Uint8Array(m.n);
  for (let i = 0; i < m.n; i++) s[i] = m.hole[i] ? 0 : val[i];
  for (const ch of m.checks) {
    let par = 0;
    for (const t of ch.tiles) par ^= s[t];
    if (par !== ch.rhs) return false;
  }
  return check(m.p, s).ok;
}

function pickVar(m: Model, val: Int8Array): number {
  let best = -1;
  let bestScore = -1;
  for (const i of m.order) {
    if (val[i] !== U) continue;
    let sc = 0;
    for (const j of m.g.nb[i]) if (val[j] !== U) sc += 1;
    if (m.p.cells[i].glyph) sc += 3;
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  return best;
}

export function solve(p: PuzzleDef, opts: SolveOptions = {}): SolveResult {
  const maxSolutions = opts.maxSolutions ?? 2;
  const maxNodes = opts.maxNodes ?? 400_000;
  const deadline = Date.now() + (opts.timeLimitMs ?? 20_000);
  const m = compile(p);
  const solutions: Uint8Array[] = [];
  let nodes = 0;
  let aborted = false;
  const val0 = Int8Array.from(m.base);
  if (opts.breakSymmetry && isInversionSymmetric(p) && m.order.length) val0[m.order[0]] = 1;
  if (val0.some((v) => v === 2)) return { solutions, complete: true, nodes: 0, propagationOnly: false, rootDetermined: 0 };
  const rootOk = propagate(m, val0, !!opts.simple);
  let determined = 0;
  for (let i = 0; i < m.n; i++) if (!m.hole[i] && m.base[i] === U && val0[i] !== U) determined++;
  const rootDetermined = m.freeCount ? determined / m.freeCount : 1;
  const propagationOnly = rootOk && val0.every((v, i) => m.hole[i] || v !== U);

  const dfs = (val: Int8Array) => {
    if (aborted || solutions.length >= maxSolutions) return;
    nodes++;
    if (nodes > maxNodes || (nodes % 256 === 0 && Date.now() > deadline)) { aborted = true; return; }
    const v = pickVar(m, val);
    if (v < 0) {
      if (finalCheck(m, val)) {
        const s = new Uint8Array(m.n);
        for (let i = 0; i < m.n; i++) s[i] = m.hole[i] ? 0 : val[i];
        solutions.push(s);
      }
      return;
    }
    for (const x of [1, 0]) {
      const next = Int8Array.from(val);
      next[v] = x;
      if (propagate(m, next, !!opts.simple)) dfs(next);
      if (aborted || solutions.length >= maxSolutions) return;
    }
  };
  if (rootOk) dfs(val0);
  return { solutions, complete: !aborted, nodes, propagationOnly, rootDetermined };
}

/** Exhaustive check for tiny boards (used by tests to validate the solver). */
export function bruteForce(p: PuzzleDef, max = 1 << 16): Uint8Array[] {
  const m = compile(p);
  const free: number[] = [];
  for (let i = 0; i < m.n; i++) if (!m.hole[i] && m.base[i] === U) free.push(i);
  if ((1 << free.length) > max) throw new Error('too big for brute force');
  const out: Uint8Array[] = [];
  const val = Int8Array.from(m.base);
  for (let mask = 0; mask < 1 << free.length; mask++) {
    free.forEach((t, k) => (val[t] = (mask >> k) & 1));
    if (finalCheck(m, val)) out.push(Uint8Array.from(val, (v, i) => (m.hole[i] ? 0 : v)));
  }
  return out;
}

/** Presses (tile indices) that turn the initial state into `target` (GF(2)), or null. */
export function findPresses(p: PuzzleDef, target: ArrayLike<number>): number[] | null {
  const g = geometryOf(p);
  const n = p.w * p.h;
  const init = initialState(p);
  const cols: { tile: number; v: Uint8Array }[] = [];
  for (let i = 0; i < n; i++) {
    if (!isPressable(p, i)) continue;
    const v = new Uint8Array(n);
    for (const t of pressSet(p, g, i)) v[t] = 1;
    cols.push({ tile: i, v });
  }
  const m = cols.length;
  // augmented matrix rows = tiles, columns = presses + rhs
  const A: Uint8Array[] = [];
  for (let t = 0; t < n; t++) {
    if (p.cells[t].hole) continue;
    const row = new Uint8Array(m + 1);
    for (let k = 0; k < m; k++) row[k] = cols[k].v[t];
    row[m] = (target[t] ? 1 : 0) ^ init[t];
    A.push(row);
  }
  let r = 0;
  const pivotCol: number[] = [];
  for (let col = 0; col < m && r < A.length; col++) {
    let sel = -1;
    for (let i = r; i < A.length; i++) if (A[i][col]) { sel = i; break; }
    if (sel < 0) continue;
    [A[r], A[sel]] = [A[sel], A[r]];
    for (let i = 0; i < A.length; i++) if (i !== r && A[i][col]) for (let c = 0; c <= m; c++) A[i][c] ^= A[r][c];
    pivotCol.push(col);
    r++;
  }
  for (let i = r; i < A.length; i++) if (A[i][m]) return null;
  const x = new Uint8Array(m);
  pivotCol.forEach((col, i) => (x[col] = A[i][m]));
  const out: number[] = [];
  for (let k = 0; k < m; k++) if (x[k]) out.push(cols[k].tile);
  return out;
}

/** Rough human difficulty 1..10 from solver statistics. */
export function gradeDifficulty(p: PuzzleDef): { simpleSolved: boolean; fullSolved: boolean; nodes: number; free: number; score: number } {
  const simple = solve(p, { maxSolutions: 2, simple: true, maxNodes: 20000, timeLimitMs: 4000 });
  const full = solve(p, { maxSolutions: 2, maxNodes: 50000, timeLimitMs: 6000 });
  const free = compile(p).freeCount;
  let score = 1 + Math.log2(1 + free) * 0.9;
  if (!simple.propagationOnly) score += 1.5;
  if (!full.propagationOnly) score += 1.5 + Math.log2(1 + full.nodes) * 0.6;
  return { simpleSolved: simple.propagationOnly, fullSolved: full.propagationOnly, nodes: full.nodes, free, score: Math.max(1, Math.min(10, Math.round(score))) };
}

/** Debug helper: the board after the beginner's (basic) deductions; -1 = unknown. */
export function basicFixpoint(p: PuzzleDef): Int8Array {
  const m = compile(p);
  const val = Int8Array.from(m.base);
  propagate(m, val, true);
  return val;
}
