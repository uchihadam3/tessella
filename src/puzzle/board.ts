/**
 * Board geometry helpers + region computation + a compact text format for puzzles.
 *
 * Compact format (used by every puzzle file — easy to write by hand):
 *
 *   puzzle('kin-03', {
 *     grid: `
 *       @a  .  @a
 *       @b  .  @b
 *     `,
 *     note: 'lit and dark can each host a family',
 *   })
 *
 * Cell tokens (whitespace separated, one per tile, row by row):
 *   .        free tile                 #        hole (no tile)
 *   L / D    locked lit / locked dark  (prefix: combine with a glyph, e.g. L@a, Dm3)
 *   ~        mute prefix (cannot be pressed, only echoed), e.g. ~.  ~@a
 *   @a @b @c @j @i @v      gem amber/azure/crimson/jade/ivory/violet      (Kinship)
 *   m<n>     measure n                                                  (Measure)
 *   f<S>     mold with shape S from `shapes`, f<S>* = any rotation      (Mold)
 *   c<n>     contour n (0..4)                                           (Contour)
 *   x<n>     mosaic n (0..9)                                            (Mosaic)
 *   b<n>     beacon n (always lit)                                      (Beacon)
 *   t<s>     twin symbol s: m=moon s=star l=leaf d=drop u=sun w=wave; t<s>' = mirrored
 *   {dirs}   echo suffix: {+} orth, {x} diag, {*} all 8, {-} e+w, {|} n+s, {r} row, {k} col,
 *            or explicit list {n,s,e,w,ne,nw,se,sw,row,col}.  e.g.  .{+}   ~.{-}
 *
 * Other fields:
 *   shapes: { T: 'xxx/.x.' }   ascii rows separated by '/', x = cell
 *   rows / cols: weave clues, lines separated by '|', runs by spaces, '-' = no clue, '0' = empty
 *   target: '010/111/010'  rows separated by '/', '#' for holes
 *   init:   same format as target
 */

import type { Bit, Cell, EchoDir, GemColor, Glyph, PuzzleDef, TwinSymbol, WeaveClue } from './types';

// ───────────────────────────── geometry ─────────────────────────────

export interface Geometry {
  w: number;
  h: number;
  wrap: boolean;
  /** hole mask */
  hole: boolean[];
  /** orthogonal neighbour indices (excluding holes), per tile */
  nb: number[][];
  /** for each tile, neighbour in each direction N,E,S,W or -1 (edge/hole) */
  dir4: [number, number, number, number][];
}

export const DR = [-1, 0, 1, 0];
export const DC = [0, 1, 0, -1];

export function buildGeometry(p: PuzzleDef): Geometry {
  const { w, h } = p;
  const wrap = !!p.wrap;
  const hole = p.cells.map((c) => !!c.hole);
  const nb: number[][] = [];
  const dir4: [number, number, number, number][] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const d: [number, number, number, number] = [-1, -1, -1, -1];
      const list: number[] = [];
      if (!hole[i]) {
        for (let k = 0; k < 4; k++) {
          let rr = r + DR[k];
          let cc = c + DC[k];
          if (wrap) cc = (cc + w) % w;
          if (rr < 0 || rr >= h || cc < 0 || cc >= w) continue;
          const j = rr * w + cc;
          if (j === i || hole[j]) continue;
          d[k] = j;
          if (!list.includes(j)) list.push(j);
        }
      }
      nb.push(list);
      dir4.push(d);
    }
  }
  return { w, h, wrap, hole, nb, dir4 };
}

/** Regions: returns region id per tile (-1 for holes) and member lists. */
export function computeRegions(g: Geometry, state: ArrayLike<number>): { id: Int32Array; members: number[][] } {
  const n = g.w * g.h;
  const id = new Int32Array(n).fill(-1);
  const members: number[][] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (g.hole[i] || id[i] !== -1) continue;
    const rid = members.length;
    const list: number[] = [];
    id[i] = rid;
    stack.push(i);
    while (stack.length) {
      const t = stack.pop()!;
      list.push(t);
      for (const j of g.nb[t]) {
        if (id[j] === -1 && state[j] === state[t]) {
          id[j] = rid;
          stack.push(j);
        }
      }
    }
    members.push(list);
  }
  return { id, members };
}

// ───────────────────────────── shapes ─────────────────────────────

export type Shape = [number, number][];

/** Normalises a list of [r,c] so the minimum row and column are 0, sorted. */
export function normShape(cells: Shape): Shape {
  let mr = Infinity;
  let mc = Infinity;
  for (const [r, c] of cells) {
    if (r < mr) mr = r;
    if (c < mc) mc = c;
  }
  return cells
    .map(([r, c]) => [r - mr, c - mc] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function shapeKey(cells: Shape): string {
  return normShape(cells)
    .map(([r, c]) => `${r},${c}`)
    .join(';');
}

export function mirrorShape(cells: Shape): Shape {
  return normShape(cells.map(([r, c]) => [r, -c] as [number, number]));
}

/** All 8 orientations (rotations + reflections), deduplicated. */
export function allOrientations(cells: Shape): Shape[] {
  const out: Shape[] = [];
  const seen = new Set<string>();
  let cur = normShape(cells);
  for (let m = 0; m < 2; m++) {
    for (let k = 0; k < 4; k++) {
      const key = shapeKey(cur);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cur);
      }
      cur = normShape(cur.map(([r, c]) => [c, -r] as [number, number]));
    }
    cur = mirrorShape(cur);
  }
  return out;
}

/** Shape of a region given its tile indices. On drums (wrap) the region is unwrapped
 *  by BFS so that shapes crossing the seam are measured correctly. */
export function regionShape(g: Geometry, tiles: number[]): Shape {
  if (!g.wrap) return normShape(tiles.map((t) => [Math.floor(t / g.w), t % g.w] as [number, number]));
  // unwrap: assign each tile a column offset relative to the first, following adjacency
  const pos = new Map<number, [number, number]>();
  const set = new Set(tiles);
  const first = tiles[0];
  pos.set(first, [Math.floor(first / g.w), first % g.w]);
  const queue = [first];
  while (queue.length) {
    const t = queue.shift()!;
    const [r, c] = pos.get(t)!;
    const d = g.dir4[t];
    for (let k = 0; k < 4; k++) {
      const j = d[k];
      if (j < 0 || !set.has(j) || pos.has(j)) continue;
      pos.set(j, [r + DR[k], c + DC[k]]);
      queue.push(j);
    }
  }
  return normShape([...pos.values()]);
}

/** Parses ascii art like 'xx./.xx' into a shape. */
export function parseShape(art: string): Shape {
  const rows = art.trim().split('/');
  const out: Shape = [];
  rows.forEach((row, r) => {
    [...row.trim()].forEach((ch, c) => {
      if (ch === 'x' || ch === 'X' || ch === '#') out.push([r, c]);
    });
  });
  return normShape(out);
}

export function shapeToArt(cells: Shape): string {
  const s = normShape(cells);
  const h = Math.max(...s.map((p) => p[0])) + 1;
  const w = Math.max(...s.map((p) => p[1])) + 1;
  const rows: string[] = [];
  for (let r = 0; r < h; r++) {
    let line = '';
    for (let c = 0; c < w; c++) line += s.some((p) => p[0] === r && p[1] === c) ? 'x' : '.';
    rows.push(line);
  }
  return rows.join('/');
}

// ───────────────────────────── compact format ─────────────────────────────

const GEM_LETTER: Record<string, GemColor> = { a: 'amber', b: 'azure', c: 'crimson', j: 'jade', i: 'ivory', v: 'violet' };
const TWIN_LETTER: Record<string, TwinSymbol> = { m: 'moon', s: 'star', l: 'leaf', d: 'drop', u: 'sun', w: 'wave' };
export const GEM_TO_LETTER: Record<GemColor, string> = { amber: 'a', azure: 'b', crimson: 'c', jade: 'j', ivory: 'i', violet: 'v' };
export const TWIN_TO_LETTER: Record<TwinSymbol, string> = { moon: 'm', star: 's', leaf: 'l', drop: 'd', sun: 'u', wave: 'w' };

const ECHO_SHORT: Record<string, EchoDir[]> = {
  '+': ['n', 's', 'e', 'w'],
  x: ['ne', 'nw', 'se', 'sw'],
  '*': ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
  '-': ['e', 'w'],
  '|': ['n', 's'],
  r: ['row'],
  k: ['col'],
};

export interface CompactPuzzle {
  grid: string;
  shapes?: Record<string, string>;
  rows?: string;
  cols?: string;
  target?: string;
  targetDisplay?: 'plate' | 'outline' | 'world';
  hideGlyphs?: boolean;
  init?: string;
  wrap?: boolean;
  mirror?: 'v' | 'h' | 'rot';
  note?: string;
  difficulty?: number;
}

function parseClues(s: string | undefined, count: number, what: string): (WeaveClue | null)[] | undefined {
  if (s === undefined) return undefined;
  const parts = s.split('|').map((x) => x.trim());
  if (parts.length !== count) throw new Error(`${what}: expected ${count} clues, got ${parts.length}`);
  return parts.map((p) => {
    if (p === '-' || p === '') return null;
    if (p === '0') return [];
    return p.split(/\s+/).map((n) => {
      const v = Number(n);
      if (!Number.isInteger(v) || v <= 0) throw new Error(`${what}: bad run '${n}'`);
      return v;
    });
  });
}

function parsePattern(s: string, w: number, h: number, what: string): string {
  const flat = s.replace(/\//g, '').replace(/\s+/g, '');
  if (flat.length !== w * h) throw new Error(`${what}: expected ${w * h} cells, got ${flat.length}`);
  return flat;
}

export function parseCell(tok: string, shapes: Record<string, string> | undefined, where: string): Cell {
  const cell: Cell = {};
  let t = tok;
  // echo suffix
  const em = t.match(/\{([^}]*)\}$/);
  if (em) {
    t = t.slice(0, em.index);
    const body = em[1].trim();
    const dirs: EchoDir[] = [];
    for (const part of body.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (ECHO_SHORT[part]) dirs.push(...ECHO_SHORT[part]);
      else if (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'row', 'col'].includes(part)) dirs.push(part as EchoDir);
      else throw new Error(`${where}: bad echo '${part}'`);
    }
    cell.echo = [...new Set(dirs)];
  }
  if (t.startsWith('~')) {
    cell.mute = true;
    t = t.slice(1);
  }
  if (t === '#') {
    cell.hole = true;
    return cell;
  }
  if (t.startsWith('L') && t.length >= 1) {
    cell.lock = 1;
    t = t.slice(1);
  } else if (t.startsWith('D')) {
    cell.lock = 0;
    t = t.slice(1);
  }
  if (t === '' || t === '.') return cell;
  let glyph: Glyph | undefined;
  const ch = t[0];
  const rest = t.slice(1);
  if (ch === '@') {
    const color = GEM_LETTER[rest];
    if (!color) throw new Error(`${where}: bad gem '${t}'`);
    glyph = { kind: 'gem', color };
  } else if (ch === 'm' && /^\d+$/.test(rest)) {
    glyph = { kind: 'measure', n: Number(rest) };
  } else if (ch === 'c' && /^\d$/.test(rest)) {
    glyph = { kind: 'contour', n: Number(rest) };
  } else if (ch === 'x' && /^\d$/.test(rest)) {
    glyph = { kind: 'mosaic', n: Number(rest) };
  } else if (ch === 'b' && /^\d+$/.test(rest)) {
    glyph = { kind: 'beacon', n: Number(rest) };
    cell.lock = 1;
  } else if (ch === 'f') {
    const free = rest.endsWith('*');
    const name = free ? rest.slice(0, -1) : rest;
    const art = shapes?.[name];
    if (!art) throw new Error(`${where}: unknown shape '${name}'`);
    glyph = { kind: 'mold', cells: parseShape(art), ...(free ? { free: true } : {}) };
  } else if (ch === 't') {
    const mirror = rest.endsWith("'");
    const letter = mirror ? rest.slice(0, -1) : rest;
    const symbol = TWIN_LETTER[letter];
    if (!symbol) throw new Error(`${where}: bad twin '${t}'`);
    glyph = { kind: 'twin', symbol, ...(mirror ? { mirror: true } : {}) };
  } else {
    throw new Error(`${where}: unknown token '${tok}'`);
  }
  cell.glyph = glyph;
  return cell;
}

/** Builds a PuzzleDef from the compact format. Throws with a helpful message on errors. */
export function puzzle(id: string, src: CompactPuzzle): PuzzleDef {
  const lines = src.grid
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows = lines.map((l) => l.split(/\s+/));
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (!h || !w) throw new Error(`${id}: empty grid`);
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`${id}: row ${i} has ${r.length} cells, expected ${w}`);
  });
  const cells: Cell[] = [];
  rows.forEach((r, ri) => r.forEach((tok, ci) => cells.push(parseCell(tok, src.shapes, `${id}[${ri},${ci}]`))));
  const def: PuzzleDef = { id, w, h, cells };
  if (src.rows !== undefined) def.rowClues = parseClues(src.rows, h, `${id}.rows`);
  if (src.cols !== undefined) def.colClues = parseClues(src.cols, w, `${id}.cols`);
  if (src.target !== undefined) def.target = parsePattern(src.target, w, h, `${id}.target`);
  if (src.targetDisplay) def.targetDisplay = src.targetDisplay;
  if (src.hideGlyphs) def.hideGlyphs = true;
  if (src.init !== undefined) def.init = parsePattern(src.init, w, h, `${id}.init`);
  if (src.wrap) def.wrap = true;
  if (src.mirror) def.mirror = src.mirror;
  if (src.note) def.note = src.note;
  if (src.difficulty !== undefined) def.difficulty = src.difficulty;
  // sanity: holes in target must match grid holes
  if (def.target) {
    for (let i = 0; i < cells.length; i++) {
      if (!!cells[i].hole !== (def.target[i] === '#')) throw new Error(`${id}: target hole mismatch at ${i}`);
    }
  }
  return def;
}

/** Serialises a PuzzleDef back to the compact format (used by tools for docs/export). */
export function toCompact(p: PuzzleDef): CompactPuzzle {
  const shapes: Record<string, string> = {};
  const shapeNames = new Map<string, string>();
  const tokens: string[] = [];
  for (const cell of p.cells) {
    let tok = '';
    if (cell.mute) tok += '~';
    if (cell.hole) {
      tokens.push(tok + '#');
      continue;
    }
    const g = cell.glyph;
    if (cell.lock === 1 && g?.kind !== 'beacon') tok += 'L';
    if (cell.lock === 0) tok += 'D';
    if (g) {
      switch (g.kind) {
        case 'gem': tok += '@' + GEM_TO_LETTER[g.color]; break;
        case 'measure': tok += 'm' + g.n; break;
        case 'contour': tok += 'c' + g.n; break;
        case 'mosaic': tok += 'x' + g.n; break;
        case 'beacon': tok += 'b' + g.n; break;
        case 'twin': tok += 't' + TWIN_TO_LETTER[g.symbol] + (g.mirror ? "'" : ''); break;
        case 'mold': {
          const art = shapeToArt(g.cells);
          let name = shapeNames.get(art);
          if (!name) {
            name = String.fromCharCode(65 + shapeNames.size);
            shapeNames.set(art, name);
            shapes[name] = art;
          }
          tok += 'f' + name + (g.free ? '*' : '');
          break;
        }
      }
    }
    if (tok === '' || tok === '~') tok += '.';
    if (cell.echo?.length) tok += '{' + cell.echo.join(',') + '}';
    tokens.push(tok);
  }
  const grid: string[] = [];
  for (let r = 0; r < p.h; r++) grid.push(tokens.slice(r * p.w, (r + 1) * p.w).join(' '));
  const out: CompactPuzzle = { grid: grid.join('\n') };
  if (Object.keys(shapes).length) out.shapes = shapes;
  const clue = (c: WeaveClue | null) => (c === null ? '-' : c.length === 0 ? '0' : c.join(' '));
  if (p.rowClues) out.rows = p.rowClues.map(clue).join('|');
  if (p.colClues) out.cols = p.colClues.map(clue).join('|');
  const pat = (s: string) => {
    const rows: string[] = [];
    for (let r = 0; r < p.h; r++) rows.push(s.slice(r * p.w, (r + 1) * p.w));
    return rows.join('/');
  };
  if (p.target) out.target = pat(p.target);
  if (p.targetDisplay) out.targetDisplay = p.targetDisplay;
  if (p.hideGlyphs) out.hideGlyphs = true;
  if (p.init) out.init = pat(p.init);
  if (p.wrap) out.wrap = true;
  if (p.mirror) out.mirror = p.mirror;
  if (p.note) out.note = p.note;
  if (p.difficulty !== undefined) out.difficulty = p.difficulty;
  return out;
}

/** Initial board state for a puzzle. */
export function initialState(p: PuzzleDef): Uint8Array {
  const s = new Uint8Array(p.w * p.h);
  for (let i = 0; i < s.length; i++) {
    const c = p.cells[i];
    if (c.hole) continue;
    if (p.init) s[i] = p.init[i] === '1' ? 1 : 0;
    if (c.lock !== undefined) s[i] = c.lock;
  }
  return s;
}

/** Which tiles flip when the player presses tile i (includes echoes and mirror input). */
export function pressSet(p: PuzzleDef, g: Geometry, i: number): number[] {
  const out = new Set<number>();
  const base = [i];
  if (p.mirror) {
    const r = Math.floor(i / p.w);
    const c = i % p.w;
    let m = i;
    if (p.mirror === 'v') m = r * p.w + (p.w - 1 - c);
    else if (p.mirror === 'h') m = (p.h - 1 - r) * p.w + c;
    else m = (p.h - 1 - r) * p.w + (p.w - 1 - c);
    if (m !== i) base.push(m);
  }
  for (const t of base) {
    if (p.cells[t].hole) continue;
    out.add(t);
    const echo = p.cells[t].echo;
    if (!echo) continue;
    const r = Math.floor(t / p.w);
    const c = t % p.w;
    for (const d of echo) {
      if (d === 'row') {
        for (let cc = 0; cc < p.w; cc++) out.add(r * p.w + cc);
        continue;
      }
      if (d === 'col') {
        for (let rr = 0; rr < p.h; rr++) out.add(rr * p.w + c);
        continue;
      }
      const dr = d.includes('n') ? -1 : d.includes('s') ? 1 : 0;
      const dc = d.includes('e') ? 1 : d.includes('w') ? -1 : 0;
      const rr = r + dr;
      let cc = c + dc;
      if (g.wrap) cc = (cc + p.w) % p.w;
      if (rr < 0 || rr >= p.h || cc < 0 || cc >= p.w) continue;
      out.add(rr * p.w + cc);
    }
  }
  // holes and locked tiles never change
  return [...out].filter((t) => !p.cells[t].hole && p.cells[t].lock === undefined);
}

export function stateToString(p: PuzzleDef, s: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < p.w * p.h; i++) out += p.cells[i].hole ? '#' : s[i] ? '1' : '0';
  return out;
}

export function isPressable(p: PuzzleDef, i: number): boolean {
  const c = p.cells[i];
  return !c.hole && !c.mute && c.lock === undefined;
}

export type { Bit };
