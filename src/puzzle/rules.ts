/**
 * The nine languages of Tessella (+ the base target-plate rule).
 * `check` is the single source of truth used by the game, the solver and the tests.
 */
import { allOrientations, buildGeometry, computeRegions, type Geometry, mirrorShape, regionShape, shapeKey } from './board';
import type { CheckResult, GemColor, PuzzleDef, TwinSymbol, Violation, WeaveClue } from './types';

const geoCache = new WeakMap<PuzzleDef, Geometry>();
export function geometryOf(p: PuzzleDef): Geometry {
  let g = geoCache.get(p);
  if (!g) {
    g = buildGeometry(p);
    geoCache.set(p, g);
  }
  return g;
}

/** Runs of lit tiles along a list of tile indices (holes break runs). */
export function lineRuns(p: PuzzleDef, tiles: number[], state: ArrayLike<number>): number[] {
  const runs: number[] = [];
  let cur = 0;
  for (const t of tiles) {
    if (!p.cells[t].hole && state[t]) cur++;
    else if (cur) {
      runs.push(cur);
      cur = 0;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

export function rowTiles(p: PuzzleDef, r: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < p.w; c++) out.push(r * p.w + c);
  return out;
}
export function colTiles(p: PuzzleDef, c: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < p.h; r++) out.push(r * p.w + c);
  return out;
}

function sameClue(a: number[], b: WeaveClue): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Number of border sides of tile t (outside/holes count as dark). */
export function contourCount(g: Geometry, state: ArrayLike<number>, t: number): number {
  let n = 0;
  const s = state[t];
  const d = g.dir4[t];
  for (let k = 0; k < 4; k++) {
    const j = d[k];
    const ns = j < 0 ? 0 : state[j];
    if (ns !== s) n++;
  }
  return n;
}

/** Number of lit tiles in the 3x3 block centred on t (wraps horizontally on drums). */
export function mosaicCount(p: PuzzleDef, g: Geometry, state: ArrayLike<number>, t: number): number {
  const r0 = Math.floor(t / p.w);
  const c0 = t % p.w;
  let n = 0;
  const seen = new Set<number>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr;
      let c = c0 + dc;
      if (g.wrap) c = (c + p.w) % p.w;
      if (r < 0 || r >= p.h || c < 0 || c >= p.w) continue;
      const j = r * p.w + c;
      if (seen.has(j)) continue;
      seen.add(j);
      if (!p.cells[j].hole && state[j]) n++;
    }
  }
  return n;
}

/** Tiles seen by a beacon at t (itself included), walking the 4 directions until darkness. */
export function beaconSight(g: Geometry, state: ArrayLike<number>, t: number): number[] {
  const seen = [t];
  if (!state[t]) return seen;
  for (let k = 0; k < 4; k++) {
    let cur = g.dir4[t][k];
    while (cur >= 0 && cur !== t && state[cur]) {
      if (!seen.includes(cur)) seen.push(cur);
      cur = g.dir4[cur][k];
    }
  }
  return seen;
}

/** All rule kinds present on a panel (for UI / docs). */
export function ruleKinds(p: PuzzleDef): string[] {
  const set = new Set<string>();
  for (const c of p.cells) if (c.glyph) set.add(c.glyph.kind);
  if (p.rowClues || p.colClues) set.add('weave');
  if (p.target) set.add('target');
  if (p.cells.some((c) => c.echo?.length)) set.add('echo');
  if (p.wrap) set.add('wrap');
  if (p.mirror) set.add('mirror');
  return [...set];
}

export function check(p: PuzzleDef, state: ArrayLike<number>): CheckResult {
  const g = geometryOf(p);
  const n = p.w * p.h;
  const violations: Violation[] = [];

  // locks (cannot normally be broken, but keep the check honest)
  const badLock: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = p.cells[i];
    if (!c.hole && c.lock !== undefined && state[i] !== c.lock) badLock.push(i);
  }
  if (badLock.length) violations.push({ rule: 'lock', tiles: badLock });

  // target plate
  if (p.target) {
    const bad: number[] = [];
    for (let i = 0; i < n; i++) {
      if (p.cells[i].hole || p.target[i] === '?') continue;
      const want = p.target[i] === '1' ? 1 : 0;
      if (state[i] !== want) bad.push(i);
    }
    // never which tiles differ from the pattern: that would show the answer
    if (bad.length) violations.push({ rule: 'target', tiles: [], whole: true });
  }

  const { id: reg, members } = computeRegions(g, state);

  // Kinship
  const gemsByColor = new Map<GemColor, number[]>();
  const twinsBySymbol = new Map<TwinSymbol, number[]>();
  const beacons: number[] = [];
  for (let i = 0; i < n; i++) {
    const gl = p.cells[i].glyph;
    if (!gl || p.cells[i].hole) continue;
    if (gl.kind === 'gem') {
      if (!gemsByColor.has(gl.color)) gemsByColor.set(gl.color, []);
      gemsByColor.get(gl.color)!.push(i);
    } else if (gl.kind === 'twin') {
      if (!twinsBySymbol.has(gl.symbol)) twinsBySymbol.set(gl.symbol, []);
      twinsBySymbol.get(gl.symbol)!.push(i);
    } else if (gl.kind === 'beacon') {
      beacons.push(i);
    }
  }
  if (gemsByColor.size) {
    const bad = new Set<number>();
    // same colour must share one region
    for (const tiles of gemsByColor.values()) {
      const r0 = reg[tiles[0]];
      if (tiles.some((t) => reg[t] !== r0)) tiles.forEach((t) => bad.add(t));
    }
    // a region may hold only one colour
    const colorOfRegion = new Map<number, GemColor>();
    const conflictRegions = new Set<number>();
    for (const [color, tiles] of gemsByColor) {
      for (const t of tiles) {
        const r = reg[t];
        const prev = colorOfRegion.get(r);
        if (prev && prev !== color) conflictRegions.add(r);
        else colorOfRegion.set(r, color);
      }
    }
    if (conflictRegions.size) {
      for (const tiles of gemsByColor.values()) for (const t of tiles) if (conflictRegions.has(reg[t])) bad.add(t);
    }
    if (bad.size) violations.push({ rule: 'gem', tiles: [...bad] });
  }

  // Measure, Mold, Contour, Mosaic (per glyph)
  for (let i = 0; i < n; i++) {
    const gl = p.cells[i].glyph;
    if (!gl || p.cells[i].hole) continue;
    switch (gl.kind) {
      case 'measure':
        if (members[reg[i]].length !== gl.n) violations.push({ rule: 'measure', tiles: [i] });
        break;
      case 'mold': {
        const shape = regionShape(g, members[reg[i]]);
        const key = shapeKey(shape);
        const ok = gl.free
          ? allOrientations(gl.cells).some((o) => shapeKey(o) === key)
          : shapeKey(gl.cells) === key;
        if (!ok) violations.push({ rule: 'mold', tiles: [i] });
        break;
      }
      case 'contour':
        if (contourCount(g, state, i) !== gl.n) violations.push({ rule: 'contour', tiles: [i] });
        break;
      case 'mosaic':
        if (mosaicCount(p, g, state, i) !== gl.n) violations.push({ rule: 'mosaic', tiles: [i] });
        break;
      default:
        break;
    }
  }

  // Beacon
  if (beacons.length) {
    const seenAll = new Set<number>();
    for (const b of beacons) {
      const gl = p.cells[b].glyph as { kind: 'beacon'; n: number };
      const sight = beaconSight(g, state, b);
      sight.forEach((t) => seenAll.add(t));
      if (!state[b] || sight.length !== gl.n) violations.push({ rule: 'beacon', tiles: [b] });
    }
    // a lit tile no beacon sees: blink the beacons (the rule), not the tile (that would show the answer)
    let unseen = false;
    for (let i = 0; i < n; i++) if (!p.cells[i].hole && state[i] && !seenAll.has(i)) unseen = true;
    if (unseen) violations.push({ rule: 'beacon', tiles: [...beacons] });
  }

  // Path: wells joined by paths of lit tiles (one wide, no branches, nothing touching)
  {
    const wells: number[] = [];
    const dots: number[] = [];
    for (let i = 0; i < n; i++) {
      const gl = p.cells[i].glyph;
      if (!gl || p.cells[i].hole) continue;
      if (gl.kind === 'well') wells.push(i);
      else if (gl.kind === 'dot') dots.push(i);
    }
    if (wells.length) {
      const bad = new Set<number>();
      const isWell = new Set(wells);
      const lit = (t: number) => t >= 0 && !p.cells[t].hole && !!state[t];
      for (const w of wells) if (!state[w]) bad.add(w);
      for (const d of dots) if (!state[d]) bad.add(d);
      // where the path is wrong blinks: a tile that branches or touches (wrong number of lit
      // neighbours), a piece that joins no wells or the wrong ones — like a broken symbol, it
      // shows what is wrong, not what is right
      for (let i = 0; i < n; i++) {
        if (!lit(i)) continue;
        let deg = 0;
        for (const j of g.dir4[i]) if (lit(j)) deg++;
        if (deg !== (isWell.has(i) ? 1 : 2)) bad.add(i);
      }
      const seen = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (!lit(i) || seen[i]) continue;
        const stack = [i];
        seen[i] = 1;
        const piece: number[] = [];
        const ends: number[] = [];
        while (stack.length) {
          const t = stack.pop()!;
          piece.push(t);
          if (isWell.has(t)) ends.push(t);
          for (const j of g.dir4[t]) if (lit(j) && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
        const col = (t: number) => (p.cells[t].glyph as { color: string }).color;
        if (ends.length === 0) piece.forEach((t) => bad.add(t));
        else if (ends.length !== 2 || col(ends[0]) !== col(ends[1])) ends.forEach((t) => bad.add(t));
      }
      if (bad.size) violations.push({ rule: 'path', tiles: [...bad] });
    }
  }

  // Weave
  if (p.rowClues || p.colClues) {
    const badRows: number[] = [];
    const badCols: number[] = [];
    p.rowClues?.forEach((clue, r) => {
      if (clue && !sameClue(lineRuns(p, rowTiles(p, r), state), clue)) badRows.push(r);
    });
    p.colClues?.forEach((clue, c) => {
      if (clue && !sameClue(lineRuns(p, colTiles(p, c), state), clue)) badCols.push(c);
    });
    if (badRows.length || badCols.length) violations.push({ rule: 'weave', tiles: [], rows: badRows, cols: badCols });
  }

  // Twins
  for (const tiles of twinsBySymbol.values()) {
    const bad = new Set<number>();
    const regions = tiles.map((t) => reg[t]);
    if (new Set(regions).size !== regions.length) tiles.forEach((t) => bad.add(t));
    else {
      const ref = tiles[0];
      const refMirror = !!(p.cells[ref].glyph as { mirror?: boolean }).mirror;
      const refKey = shapeKey(regionShape(g, members[reg[ref]]));
      for (const t of tiles.slice(1)) {
        const m = !!(p.cells[t].glyph as { mirror?: boolean }).mirror;
        let shape = regionShape(g, members[reg[t]]);
        if (m !== refMirror) shape = mirrorShape(shape);
        if (shapeKey(shape) !== refKey) {
          bad.add(ref);
          bad.add(t);
        }
      }
    }
    if (bad.size) violations.push({ rule: 'twin', tiles: [...bad] });
  }

  return { ok: violations.length === 0, violations };
}

/** Quick structural validation of a puzzle definition (used by tests and tools). */
export function lintPuzzle(p: PuzzleDef): string[] {
  const errs: string[] = [];
  if (p.cells.length !== p.w * p.h) errs.push('cell count mismatch');
  const twins = new Map<string, number>();
  p.cells.forEach((c, i) => {
    if (c.hole && (c.glyph || c.lock !== undefined || c.echo)) errs.push(`hole ${i} has content`);
    if (c.glyph?.kind === 'beacon' && c.lock !== 1) errs.push(`beacon ${i} not locked lit`);
    if (c.glyph?.kind === 'twin') twins.set(c.glyph.symbol, (twins.get(c.glyph.symbol) ?? 0) + 1);
    if (c.glyph?.kind === 'gem') {
      /* fine */
    }
    if (c.glyph?.kind === 'contour' && (c.glyph.n < 0 || c.glyph.n > 4)) errs.push(`contour ${i} out of range`);
    if (c.glyph?.kind === 'mosaic' && (c.glyph.n < 0 || c.glyph.n > 9)) errs.push(`mosaic ${i} out of range`);
  });
  for (const [s, k] of twins) if (k < 2) errs.push(`twin ${s} has ${k} tile(s)`);
  if (p.rowClues && p.rowClues.length !== p.h) errs.push('rowClues length');
  if (p.colClues && p.colClues.length !== p.w) errs.push('colClues length');
  if (p.target && p.target.length !== p.w * p.h) errs.push('target length');
  return errs;
}
