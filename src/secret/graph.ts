/**
 * Constellations — pure rule logic (no three.js / DOM).
 *
 * Neighbours are the stars joined by a thread. A REGION is a maximal set of same-state stars
 * connected through threads. See src/secret/types.ts for the rules.
 */
import type { ConstellationDef, GraphViolation, StarGlyph } from './types';
import type { GemColor } from '../puzzle/types';

const adjCache = new WeakMap<ConstellationDef, number[][]>();

/** Adjacency lists (deduplicated, no self loops). Cached per definition object. */
export function neighbors(def: ConstellationDef): number[][] {
  let adj = adjCache.get(def);
  if (adj) return adj;
  adj = def.stars.map(() => [] as number[]);
  for (const t of def.threads) {
    if (t.a === t.b) continue;
    if (!adj[t.a].includes(t.b)) adj[t.a].push(t.b);
    if (!adj[t.b].includes(t.a)) adj[t.b].push(t.a);
  }
  adjCache.set(def, adj);
  return adj;
}

/** True when the constellation has no glyphs and no thread marks: then every star must be lit. */
export function wantsAllLit(def: ConstellationDef): boolean {
  return !def.stars.some((s) => s.glyph) && !def.threads.some((t) => t.mark);
}

/** Initial state: all dark, locked stars at their lock value. */
export function initialState(def: ConstellationDef): Uint8Array {
  const s = new Uint8Array(def.stars.length);
  def.stars.forEach((st, i) => {
    if (st.lock !== undefined) s[i] = st.lock;
  });
  return s;
}

export function isPressable(def: ConstellationDef, i: number): boolean {
  return i >= 0 && i < def.stars.length && def.stars[i].lock === undefined;
}

/** Stars that flip when star i is pressed (echo: i and its neighbours). Locked stars never change. */
export function pressSet(def: ConstellationDef, i: number): number[] {
  if (!isPressable(def, i)) return [];
  const out = [i];
  if (def.echo) for (const j of neighbors(def)[i]) out.push(j);
  return out.filter((j) => def.stars[j].lock === undefined);
}

/** Applies a press to a state (mutates and returns it). */
export function press(def: ConstellationDef, state: Uint8Array, i: number): Uint8Array {
  for (const j of pressSet(def, i)) state[j] ^= 1;
  return state;
}

export function regionsOf(def: ConstellationDef, state: ArrayLike<number>): { id: Int32Array; members: number[][] } {
  const n = def.stars.length;
  const adj = neighbors(def);
  const id = new Int32Array(n).fill(-1);
  const members: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (id[i] !== -1) continue;
    const rid = members.length;
    const list = [i];
    id[i] = rid;
    for (let k = 0; k < list.length; k++) {
      const t = list[k];
      for (const j of adj[t]) {
        if (id[j] === -1 && state[j] === state[t]) {
          id[j] = rid;
          list.push(j);
        }
      }
    }
    members.push(list);
  }
  return { id, members };
}

export function contourCount(def: ConstellationDef, state: ArrayLike<number>, i: number): number {
  let n = 0;
  for (const j of neighbors(def)[i]) if (state[j] !== state[i]) n++;
  return n;
}

export function mosaicCount(def: ConstellationDef, state: ArrayLike<number>, i: number): number {
  let n = state[i] ? 1 : 0;
  for (const j of neighbors(def)[i]) if (state[j]) n++;
  return n;
}

export interface GraphCheck {
  ok: boolean;
  violations: GraphViolation;
}

/** Validates a full state. Violations list the stars and threads to blink. */
export function checkConstellation(def: ConstellationDef, state: ArrayLike<number>): GraphCheck {
  const bad = new Set<number>();
  const badThreads = new Set<number>();
  const n = def.stars.length;

  // locks
  def.stars.forEach((s, i) => {
    if (s.lock !== undefined && state[i] !== s.lock) bad.add(i);
  });

  if (wantsAllLit(def)) {
    for (let i = 0; i < n; i++) if (!state[i]) bad.add(i);
    return { ok: bad.size === 0, violations: { stars: [...bad], threads: [] } };
  }

  // thread marks (the secret language)
  def.threads.forEach((t, k) => {
    if (!t.mark) return;
    const same = state[t.a] === state[t.b];
    if ((t.mark === 'same') !== same) badThreads.add(k);
  });

  const { id: reg, members } = regionsOf(def, state);

  // kinship gems
  const byColor = new Map<GemColor, number[]>();
  def.stars.forEach((s, i) => {
    if (s.glyph?.kind === 'gem') {
      if (!byColor.has(s.glyph.color)) byColor.set(s.glyph.color, []);
      byColor.get(s.glyph.color)!.push(i);
    }
  });
  if (byColor.size) {
    for (const list of byColor.values()) {
      const r0 = reg[list[0]];
      if (list.some((i) => reg[i] !== r0)) list.forEach((i) => bad.add(i));
    }
    const colorOf = new Map<number, GemColor>();
    const conflict = new Set<number>();
    for (const [color, list] of byColor) {
      for (const i of list) {
        const prev = colorOf.get(reg[i]);
        if (prev && prev !== color) conflict.add(reg[i]);
        else colorOf.set(reg[i], color);
      }
    }
    if (conflict.size) for (const list of byColor.values()) for (const i of list) if (conflict.has(reg[i])) bad.add(i);
  }

  // measure / contour / mosaic
  def.stars.forEach((s, i) => {
    const g = s.glyph;
    if (!g) return;
    if (g.kind === 'measure' && members[reg[i]].length !== g.n) bad.add(i);
    else if (g.kind === 'contour' && contourCount(def, state, i) !== g.n) bad.add(i);
    else if (g.kind === 'mosaic' && mosaicCount(def, state, i) !== g.n) bad.add(i);
  });

  return { ok: bad.size === 0 && badThreads.size === 0, violations: { stars: [...bad].sort((a, b) => a - b), threads: [...badThreads].sort((a, b) => a - b) } };
}

/** Rule kinds used by a constellation (for docs / UI). */
export function constellationKinds(def: ConstellationDef): string[] {
  const k = new Set<string>();
  for (const s of def.stars) if (s.glyph) k.add(s.glyph.kind);
  if (def.threads.some((t) => t.mark)) k.add('mark');
  if (def.echo) k.add('echo');
  if (def.stars.some((s) => s.lock !== undefined)) k.add('lock');
  if (wantsAllLit(def)) k.add('all-lit');
  return [...k];
}

/** Rule sets that do not care about which state is "lit" admit the inverted solution too. */
export function isInversionSymmetric(def: ConstellationDef): boolean {
  if (wantsAllLit(def)) return false;
  if (def.stars.some((s) => s.lock !== undefined || s.glyph?.kind === 'mosaic')) return false;
  return true;
}

export function stateString(state: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < state.length; i++) s += state[i] ? '1' : '0';
  return s;
}

export function glyphLabel(g: StarGlyph): string {
  switch (g.kind) {
    case 'gem':
      return `gem:${g.color}`;
    default:
      return `${g.kind}:${g.n}`;
  }
}
