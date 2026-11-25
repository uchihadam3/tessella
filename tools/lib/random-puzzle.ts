/** Random puzzle generators used by fuzz tests and generators. Seeded RNG for reproducibility. */
import { allOrientations, buildGeometry, computeRegions, regionShape } from '../../src/puzzle/board';
import { contourCount, lineRuns, mosaicCount, rowTiles, colTiles, beaconSight } from '../../src/puzzle/rules';
import { GEM_COLORS, TWIN_SYMBOLS, type Cell, type PuzzleDef } from '../../src/puzzle/types';

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(a: readonly T[]) => a[Math.floor(next() * a.length)],
    chance: (p: number) => next() < p,
    shuffle: <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
}
export type Rng = ReturnType<typeof rng>;

/** Random board state with holes. */
export function randomBoard(r: Rng, w: number, h: number, holeP = 0.08, litP = 0.5): { cells: Cell[]; state: Uint8Array } {
  const cells: Cell[] = [];
  const state = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (r.chance(holeP)) cells.push({ hole: true });
    else { cells.push({}); state[i] = r.chance(litP) ? 1 : 0; }
  }
  return { cells, state };
}

/** Places glyphs of the given kinds consistent with `state`. Mutates cells. */
export function decorate(r: Rng, p: PuzzleDef, state: Uint8Array, kinds: string[], density = 0.35): void {
  const g = buildGeometry(p);
  const { id, members } = computeRegions(g, state);
  const n = p.w * p.h;
  const free = [...Array(n).keys()].filter((i) => !p.cells[i].hole);
  r.shuffle(free);
  const usedRegionsGem = new Map<number, string>();
  let gemColor = 0;
  let twinIdx = 0;
  for (const t of free) {
    if (!r.chance(density)) continue;
    const kind = r.pick(kinds);
    const c = p.cells[t];
    if (c.glyph) continue;
    switch (kind) {
      case 'measure': c.glyph = { kind: 'measure', n: members[id[t]].length }; break;
      case 'contour': c.glyph = { kind: 'contour', n: contourCount(g, state, t) }; break;
      case 'mosaic': c.glyph = { kind: 'mosaic', n: mosaicCount(p, g, state, t) }; break;
      case 'mold': {
        const shape = regionShape(g, members[id[t]]);
        if (shape.length > 6) break;
        c.glyph = { kind: 'mold', cells: shape, ...(r.chance(0.3) ? { free: true } : {}) };
        break;
      }
      case 'gem': {
        const rid = id[t];
        let col = usedRegionsGem.get(rid);
        if (!col) {
          if (gemColor >= GEM_COLORS.length) break;
          col = GEM_COLORS[gemColor++];
          usedRegionsGem.set(rid, col);
        }
        c.glyph = { kind: 'gem', color: col as (typeof GEM_COLORS)[number] };
        break;
      }
      case 'twin': {
        // find another region with the same shape
        if (twinIdx >= TWIN_SYMBOLS.length) break;
        const shape = regionShape(g, members[id[t]]);
        const key = JSON.stringify(shape);
        const other = free.find((u) => u !== t && id[u] !== id[t] && !p.cells[u].glyph && JSON.stringify(regionShape(g, members[id[u]])) === key);
        if (other === undefined) break;
        const sym = TWIN_SYMBOLS[twinIdx++];
        c.glyph = { kind: 'twin', symbol: sym };
        p.cells[other].glyph = { kind: 'twin', symbol: sym };
        break;
      }
      case 'lock': c.lock = state[t] as 0 | 1; break;
    }
  }
  if (kinds.includes('weave')) {
    p.rowClues = [...Array(p.h).keys()].map((rr) => (r.chance(0.7) ? lineRuns(p, rowTiles(p, rr), state) : null));
    p.colClues = [...Array(p.w).keys()].map((cc) => (r.chance(0.7) ? lineRuns(p, colTiles(p, cc), state) : null));
  }
}

/** Builds a random beacon puzzle: beacons + their arms form the solution. */
export function randomBeaconBoard(r: Rng, w: number, h: number, beacons: number, holeP = 0.05): { p: PuzzleDef; state: Uint8Array } {
  const cells: Cell[] = [];
  for (let i = 0; i < w * h; i++) cells.push(r.chance(holeP) ? { hole: true } : {});
  const p: PuzzleDef = { id: 'rb', w, h, cells };
  const g = buildGeometry(p);
  const state = new Uint8Array(w * h);
  const bs: number[] = [];
  const freeTiles = [...Array(w * h).keys()].filter((i) => !cells[i].hole);
  for (let k = 0; k < beacons; k++) {
    const t = r.pick(freeTiles);
    if (bs.includes(t)) continue;
    bs.push(t);
    state[t] = 1;
    for (let d = 0; d < 4; d++) {
      const len = r.int(3);
      let cur = g.dir4[t][d];
      for (let s = 0; s < len && cur >= 0; s++) { state[cur] = 1; cur = g.dir4[cur][d]; }
    }
  }
  for (const t of bs) {
    cells[t].lock = 1;
    cells[t].glyph = { kind: 'beacon', n: beaconSight(g, state, t).length };
  }
  return { p, state };
}

export { allOrientations };
