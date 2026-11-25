/**
 * Generates the 150 secret constellations → src/data/constellations.ts
 *
 *   npx tsx tools/gen-constellations.ts            (writes data, fixtures and docs)
 *   npx tsx tools/gen-constellations.ts --dry      (prints stats only)
 *   npx tsx tools/gen-constellations.ts --dry --area=kinship --verbose
 *
 * Every constellation is a LINE DRAWING (tools/lib/constellation-art.ts: a swan, an anchor, a fox…):
 * the stars and threads are the drawing and never change. The puzzle is generated ON that fixed
 * graph, around ONE named insight that comes from the drawing's topology (a bridge star, a hub,
 * leaves, an odd ring, triangles, loop parity of cut threads, chains of knots, overlapping windows,
 * echo trees / reachability): template (intended solution + core clues found in the drawing) →
 * extra clues of the area's languages until the solution is unique → minimise (core clues only if
 * the insight still holds) → fairness check (a careful human solves it with deductions and
 * contradiction lookahead, never by guessing) → keep the candidate closest to the slot's target
 * reasoning depth. Deterministic (seeded).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConstellationDef, Star, StarGlyph, Thread } from '../src/secret/types';
import type { AreaId } from '../src/data/areas';
import type { GemColor } from '../src/puzzle/types';
import { checkConstellation, constellationKinds, contourCount, initialState, mosaicCount, press, regionsOf, stateString, wantsAllLit } from '../src/secret/graph';
import { distinctSolutions, estimateDifficulty, parityChecks, pressesFor, reachable, solveConstellation } from '../src/secret/solver';
import { ART, artDrawing, type Art } from './lib/constellation-art';
import { drawingProblems, size, type P } from './lib/drawing-rules';

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

// ───────────────────────── drawings → networks ─────────────────────────
interface Net {
  pts: P[];
  edges: [number, number][];
  /** the drawing's name (pt) */
  shape: string;
  bell: P;
  name: { pt: string; en: string };
}

/** The drawing centred on its box and scaled so its larger side is 12 (stars within ±6). */
function netOf(a: Art): Net {
  const d = artDrawing(a);
  const xs = d.pts.map((p) => p[0]), zs = d.pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const k = 12 / size(d.pts);
  const f = (p: P): P => [+((p[0] - cx) * k).toFixed(2), +((p[1] - cz) * k).toFixed(2)];
  const net: Net = { pts: d.pts.map(f), edges: d.edges, shape: a.name.pt, bell: f(a.bell), name: a.name };
  const probs = drawingProblems(net.pts, net.edges, net.bell);
  if (probs.length) throw new Error(`drawing ${a.name.pt}: ${probs.join('; ')}`);
  return net;
}

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

const isTree = (net: Net) => net.edges.length === net.pts.length - 1;

/** Simple cycles (as vertex lists), found by bounded DFS; graphs here are small. */
function cycles(net: Net, maxLen = 12, budget = 300_000): number[][] {
  const n = net.pts.length;
  const adj = adjOf(n, net.edges);
  const out: number[][] = [];
  const seen = new Set<string>();
  let steps = 0;
  const path: number[] = [];
  const on = new Uint8Array(n);
  const dfs = (start: number, v: number) => {
    if (++steps > budget) return;
    for (const j of adj[v]) {
      if (j === start && path.length >= 3) {
        const key = [...path].sort((a, b) => a - b).join(',') + '|' + path.length;
        if (!seen.has(key)) (seen.add(key), out.push(path.slice()));
      }
      if (on[j] || j < start || path.length >= maxLen) continue;
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
  return out;
}

function longestCycle(net: Net): number[] {
  return cycles(net).sort((a, b) => b.length - a.length)[0] ?? [];
}

/** a cycle without chords (no thread joins two non-consecutive stars of it) */
function chordless(net: Net, cyc: number[]): boolean {
  const adj = adjOf(net.pts.length, net.edges);
  const L = cyc.length;
  for (let i = 0; i < L; i++) for (let j = i + 2; j < L; j++) {
    if (i === 0 && j === L - 1) continue;
    if (adj[cyc[i]].includes(cyc[j])) return false;
  }
  return true;
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
  return { id, area, name: net.name, stars, threads, bell: { x: net.bell[0], z: net.bell[1] }, ...(echo ? { echo: true } : {}), difficulty: 1 };
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

function randomSol(r: Rng, n: number, p = 0.5): Uint8Array {
  const s = new Uint8Array(n);
  for (let i = 0; i < n; i++) s[i] = r() < p ? 1 : 0;
  return s;
}
const tmpDef = (net: Net, echo = false) => buildDef('tmp', 'hub', net, [], echo);
const gemClue = (i: number, c: GemColor): Clue => ({ kind: 'gem', star: i, glyph: { kind: 'gem', color: c } });
const glyphClue = (kind: 'measure' | 'contour' | 'mosaic', i: number, n: number): Clue => ({ kind, star: i, glyph: { kind, n } });
function markClue(net: Net, sol: Uint8Array, k: number): Clue {
  const [a, b] = net.edges[k];
  return { kind: 'mark', thread: k, mark: sol[a] === sol[b] ? 'same' : 'diff' };
}
const hubOf = (net: Net) => {
  const adj = adjOf(net.pts.length, net.edges);
  return [...adj.keys()].sort((a, b) => adj[b].length - adj[a].length)[0];
};

// ───────────────────────── insight templates (on a fixed drawing) ─────────────────────────

interface Instance {
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
type Template = (r: Rng, net: Net) => Instance | null;

/** the plain reading of each language, for panels that need no special insight */
const PLAIN: Record<string, string> = {
  gem: 'Afinidade em rede: cada família precisa de um caminho só dela, e famílias diferentes não podem se tocar no mesmo estado.',
  measure: 'Medida em rede: a região conta as estrelas ligadas por fios, não as vizinhas no chão — conte pelos fios.',
  contour: 'Contorno em rede: cada estrela conta só os seus próprios fios — as pontas decidem umas às outras.',
  mosaic: 'Mosaico em rede: a janela de cada estrela é ela mais as vizinhas pelos fios — comece pelas janelas pequenas.',
  mark: 'A linguagem secreta dos fios: o nó quer pontas iguais, o corte quer pontas diferentes — siga a corrente.',
};

const T: Record<string, Template> = {
  /** Warm-ups / plain reading: the area's language on the drawing, no special insight required. */
  warm(r, net) {
    return { sol: randomSol(r, net.pts.length, 0.45), core: [], note: '' };
  },

  /** A ponte: two same-colour gems on both sides of a cut star. */
  bridgeKin(r, net) {
    const cut = shuffle(r, cutVertices(net)).find((c) => c.comps.filter((cc) => cc.length >= 2).length >= 2);
    if (!cut) return null;
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
    for (const [start, C] of [[a, C1], [b, C2]] as [number, number[]][]) {
      const nb = adj[start].filter((j) => C.includes(j));
      if (nb.length && r() < 0.7) sol[pick(r, nb)] = s;
    }
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const R = members[reg[cut.v]];
    const far = (C: number[]) => {
      const opts = R.filter((x) => C.includes(x));
      return opts.sort((x, y) => Math.hypot(net.pts[y][0] - net.pts[cut.v][0], net.pts[y][1] - net.pts[cut.v][1]) - Math.hypot(net.pts[x][0] - net.pts[cut.v][0], net.pts[x][1] - net.pts[cut.v][1]))[0];
    };
    const g1 = far(C1), g2 = far(C2);
    if (g1 === undefined || g2 === undefined) return null;
    const color = pick(r, COLORS);
    const cutStar = cut.v;
    return {
      sol, core: [gemClue(g1, color), gemClue(g2, color)],
      note: `A ponte: as duas gemas ${COLOR_PT[color]} estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família.`,
      witness: (def) => {
        const gs = def.stars.map((st, i) => (st.glyph?.kind === 'gem' && st.glyph.color === color ? i : -1)).filter((i) => i >= 0);
        return gs.some((i) => C1.includes(i)) && gs.some((i) => C2.includes(i)) && !(def.stars[cutStar].glyph?.kind === 'gem');
      },
    };
  },

  /** O número não cabe de um lado só: the region must cross the bridge. */
  bridgeMeasure(r, net) {
    const cut = shuffle(r, cutVertices(net)).find((c) => c.comps.filter((cc) => cc.length >= 2).length >= 2);
    if (!cut) return null;
    const comps = cut.comps.filter((cc) => cc.length >= 2).sort((a, b) => a.length - b.length);
    const C1 = comps[0], C2 = comps[comps.length - 1];
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const s = r() < 0.5 ? 1 : 0;
    const sol = new Uint8Array(n).fill(1 - s);
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
    for (let i = 0; i < n; i++) if (!R.has(i)) sol[i] = adj[i].some((j) => R.has(j)) ? 1 - s : r() < 0.5 ? 1 : 0;
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const region = members[reg[cut.v]];
    if (region.length <= C1.length + 1) return null;
    const inC1 = region.filter((x) => C1.includes(x));
    if (!inC1.length) return null;
    const at = inC1.sort((x, y) => Math.hypot(net.pts[y][0] - net.pts[cut.v][0], net.pts[y][1] - net.pts[cut.v][1]) - Math.hypot(net.pts[x][0] - net.pts[cut.v][0], net.pts[x][1] - net.pts[cut.v][1]))[0];
    const N = region.length;
    return {
      sol, core: [glyphClue('measure', at, N)],
      note: `O número não cabe de um lado só: a região de ${N} tem de atravessar a ponte.`,
      witness: (def) => def.stars.some((st, i) => C1.includes(i) && st.glyph?.kind === 'measure' && st.glyph.n > C1.length + 1),
    };
  },

  /** O cubo: differently-coloured gems all touch the hub, so it can't share their state. */
  hubKin(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const hub = hubOf(net);
    if (adj[hub].length < 3) return null;
    const s = r() < 0.5 ? 1 : 0;
    const sol = randomSol(r, n, 0.5);
    sol[hub] = s;
    for (const j of adj[hub]) sol[j] = r() < 0.65 ? 1 - s : s;
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const opp = [...new Set(adj[hub].filter((j) => sol[j] !== s).map((j) => reg[j]))];
    if (opp.length < 2) return null;
    const cols = shuffle(r, COLORS);
    const core = opp.slice(0, 4).map((rid, k) => gemClue(pick(r, members[rid]), cols[k]));
    return {
      sol, core,
      note: 'O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro.',
      witness: (def) => new Set(def.stars.filter((st, i) => i !== hub && st.glyph?.kind === 'gem').map((st) => (st.glyph as { color: string }).color)).size >= 2 && !def.stars[hub].glyph,
    };
  },

  /** Amigo único / o dissidente: hub contour 1 or d-1. */
  hubContour(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const hub = hubOf(net);
    const d = adj[hub].length;
    if (d < 3) return null;
    const sol = randomSol(r, n, 0.5);
    const friend = r() < 0.5;
    const s = sol[hub];
    const chosen = pick(r, adj[hub]);
    for (const j of adj[hub]) sol[j] = friend ? (j === chosen ? s : 1 - s) : j === chosen ? 1 - s : s;
    const c = contourCount(tmpDef(net), sol, hub);
    return {
      sol, core: [glyphClue('contour', hub, c)],
      note: friend
        ? `Amigo único: dos ${d} fios do cubo, só um leva a alguém do mesmo estado — descubra qual.`
        : `O dissidente: dos ${d} vizinhos do cubo, só um é diferente — descubra qual.`,
      witness: (def) => def.stars[hub].glyph?.kind === 'contour',
    };
  },

  /** A janela inteira: the hub's mosaic window is its whole neighbourhood. */
  hubMosaic(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const hub = hubOf(net);
    if (adj[hub].length < 3) return null;
    const sol = randomSol(r, n, 0.5);
    const def = tmpDef(net);
    const nb = pick(r, adj[hub]);
    return {
      sol, core: [glyphClue('mosaic', hub, mosaicCount(def, sol, hub)), glyphClue('mosaic', nb, mosaicCount(def, sol, nb))],
      note: 'A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê.',
      witness: (d) => d.stars[hub].glyph?.kind === 'mosaic' && adj[hub].some((j) => d.stars[j].glyph?.kind === 'mosaic'),
    };
  },

  /** Folhas: a leaf's mosaic window only sees itself and its parent. */
  leafMosaic(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const leaves = [...Array(n).keys()].filter((i) => adj[i].length === 1);
    if (leaves.length < 2) return null;
    const sol = randomSol(r, n, 0.5);
    const def = tmpDef(net);
    const picks = shuffle(r, leaves).slice(0, Math.min(3, leaves.length));
    for (const l of picks.slice(0, 2)) sol[adj[l][0]] = sol[l];
    const core = picks.slice(0, 2).map((l) => glyphClue('mosaic', l, mosaicCount(def, sol, l)));
    return {
      sol, core,
      note: 'Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro.',
      witness: (d) => leaves.filter((l) => d.stars[l].glyph?.kind === 'mosaic').length >= 2,
    };
  },

  /** Árvore de medidas: in a tree every border splits for good. */
  treeMeasure(r, net) {
    if (!isTree(net)) return null;
    return {
      sol: randomSol(r, net.pts.length, 0.5), core: [],
      note: 'Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco.',
      witness: (d) => d.stars.filter((st) => st.glyph?.kind === 'measure').length >= 3,
    };
  },

  /** Laço ímpar (contorno): alternation can't close around an odd ring of the drawing. */
  oddRingContour(r, net) {
    const odd = cycles(net).filter((c) => c.length % 2 === 1 && c.length >= 5 && chordless(net, c));
    if (!odd.length) return null;
    const ring = pick(r, odd);
    const L = ring.length;
    const adj = adjOf(net.pts.length, net.edges);
    const k0 = Math.floor(r() * L);
    const x = ring[k0], w = ring[(k0 + 1) % L];
    const sol = randomSol(r, net.pts.length, 0.5);
    let st = r() < 0.5 ? 1 : 0;
    for (let k = 0; k < L; k++) {
      sol[ring[(k0 + 1 + k) % L]] = st;
      st ^= 1;
    }
    sol[x] = sol[w];
    const def = tmpDef(net);
    const core: Clue[] = [];
    for (const v of ring) if (v !== x && v !== w && adj[v].length === 2) core.push(glyphClue('contour', v, contourCount(def, sol, v)));
    if (core.length < L - 4) return null;
    return {
      sol, core,
      note: 'Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar.',
      witness: (d) => ring.filter((v) => d.stars[v].glyph?.kind === 'contour' && (d.stars[v].glyph as { n: number }).n === 2).length >= L - 4,
    };
  },

  /** Laço ímpar de gemas: adjacent different colours must alternate; the twin pair agrees. */
  oddRingKin(r, net) {
    const odd = cycles(net).filter((c) => c.length % 2 === 1 && c.length >= 5 && c.length <= 7 && chordless(net, c));
    if (!odd.length) return null;
    const ring = pick(r, odd);
    const L = ring.length;
    const k0 = Math.floor(r() * L);
    const x = ring[k0], w = ring[(k0 + 1) % L];
    const sol = randomSol(r, net.pts.length, 0.5);
    let st = 1;
    for (let k = 0; k < L; k++) {
      sol[ring[(k0 + 1 + k) % L]] = st;
      st ^= 1;
    }
    sol[x] = sol[w];
    const cols = shuffle(r, COLORS);
    const core: Clue[] = [gemClue(x, cols[0]), gemClue(w, cols[0])];
    let ci = 1;
    for (let k = 2; k < L && ci < COLORS.length; k++) core.push(gemClue(ring[(k0 + k) % L], cols[ci++]));
    // gems of other regions must not share colours: the ring stars of the same state are separate regions
    // only when not linked elsewhere; uniqueness checking discards inconsistent candidates
    const pair = cols[0];
    return {
      sol, core,
      note: `Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas ${COLOR_PT[pair]} lado a lado dividem o estado.`,
      witness: (d) => ring.filter((v) => d.stars[v].glyph?.kind === 'gem').length >= L - 2,
    };
  },

  /** Paridade do laço: every loop has an even number of cuts. */
  cutParity(r, net) {
    const ring = longestCycle(net);
    if (ring.length < 4) return null;
    const sol = randomSol(r, net.pts.length, 0.5);
    const ek = (a: number, b: number) => net.edges.findIndex(([u, v]) => (u === a && v === b) || (u === b && v === a));
    const ringEdges = ring.map((v, k) => ek(v, ring[(k + 1) % ring.length]));
    if (ringEdges.some((e) => e < 0)) return null;
    const L = ringEdges.length;
    const e1 = Math.floor(r() * L);
    const e2 = (e1 + 2 + Math.floor(r() * Math.max(1, L - 3))) % L;
    const core: Clue[] = [];
    ringEdges.forEach((e, k) => {
      if (k !== e1 && k !== e2) core.push(markClue(net, sol, e));
    });
    const [ea] = net.edges[ringEdges[e2]];
    core.push(glyphClue('contour', ea, contourCount(tmpDef(net), sol, ea)));
    return {
      sol, core,
      note: 'Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela.',
      witness: (d) => ringEdges.filter((e) => d.threads[e].mark).length >= L - 3 && ringEdges.some((e) => !d.threads[e].mark),
    };
  },

  /** Corrente de nós: a chain of knots is one region; the measure says where it ends. */
  knotChain(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
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
      sol, core,
      note: `Corrente de nós: as estrelas amarradas formam uma região só — e a medida ${path.length} diz que ela termina ali; todo fio que sai dela é um corte.`,
      witness: (d) => d.stars[end].glyph?.kind === 'measure' && d.threads.filter((t) => t.mark === 'same').length >= 2,
    };
  },

  /** Janelas quase iguais: two joined stars that see almost the same stars. */
  theta(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const pairs = net.edges.filter(([u, v]) => adj[u].filter((j) => adj[v].includes(j)).length >= 2);
    if (!pairs.length) return null;
    const [u, v] = pick(r, pairs);
    const sol = randomSol(r, n, 0.5);
    const def = tmpDef(net);
    return {
      sol, core: [glyphClue('mosaic', u, mosaicCount(def, sol, u)), glyphClue('mosaic', v, mosaicCount(def, sol, v))],
      note: 'Janelas quase iguais: as duas estrelas enxergam quase as mesmas vizinhas, menos as suas próprias — subtraia uma janela da outra.',
      witness: (d) => d.stars[u].glyph?.kind === 'mosaic' && d.stars[v].glyph?.kind === 'mosaic',
    };
  },

  /** Triângulos: every triangle has 0 or 2 borders. */
  triangleContour(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const ears = [...Array(n).keys()].filter((v) => adj[v].length === 2 && adj[adj[v][0]].includes(adj[v][1]));
    if (!ears.length) return null;
    const x = pick(r, ears);
    const [y, z] = adj[x];
    const sol = randomSol(r, n, 0.5);
    sol[y] = sol[x];
    sol[z] = 1 - sol[x];
    const def = tmpDef(net);
    return {
      sol, core: [glyphClue('contour', x, 1), glyphClue('contour', y, contourCount(def, sol, y))],
      note: 'Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si.',
      witness: (d) => d.stars[x].glyph?.kind === 'contour' && (d.stars[x].glyph as { n: number }).n === 1,
    };
  },

  /** A soma par: the sum of all contours is twice the number of cut threads. */
  contourSum(r, net) {
    const n = net.pts.length;
    if (n > 13) return null;
    const sol = randomSol(r, n, 0.5);
    const def = tmpDef(net);
    const skip = Math.floor(r() * n);
    const core = [...Array(n).keys()].filter((i) => i !== skip).map((i) => glyphClue('contour', i, contourCount(def, sol, i)));
    return {
      sol, core,
      note: 'A soma de todos os contornos é sempre par (cada fio cortado conta duas vezes) — a estrela sem número se descobre contando.',
      witness: (d) => d.stars.filter((st) => st.glyph?.kind === 'contour').length >= n - 3,
    };
  },

  /** A gema solitária: a unique colour on the busiest star needs a world of its own. */
  singleton(r, net) {
    const n = net.pts.length;
    const adj = adjOf(n, net.edges);
    const v = hubOf(net);
    if (adj[v].length < 3) return null;
    const sol = randomSol(r, n, 0.5);
    for (const j of adj[v]) sol[j] = 1 - sol[v];
    const { id: reg, members } = regionsOf(tmpDef(net), sol);
    const cols = shuffle(r, COLORS);
    const others = shuffle(r, members.map((_, k) => k).filter((k) => k !== reg[v])).slice(0, 3);
    const core: Clue[] = [gemClue(v, cols[0])];
    others.forEach((rid, k) => core.push(gemClue(pick(r, members[rid]), cols[1 + k])));
    return {
      sol, core,
      note: `A gema solitária: a ${COLOR_PT[cols[0]]} é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto.`,
      witness: (d) => d.stars[v].glyph?.kind === 'gem',
    };
  },

  // ── echo ──

  /** Eco com tudo aceso: find the presses that light the whole drawing. */
  echoAllLit(r, net) {
    void r;
    const def = tmpDef(net, true);
    const pr = pressesFor(def, new Uint8Array(net.pts.length).fill(1));
    if (!pr || pr.length < 2) return null;
    const adj = adjOf(net.pts.length, net.edges);
    const ring = adj.every((l) => l.length === 2);
    return {
      sol: new Uint8Array(net.pts.length).fill(1), core: [], echo: true, allLit: true,
      note: isTree(net)
        ? 'Eco na árvore: cada folha só mexe nela e no pai — resolva de fora para dentro.'
        : ring
          ? 'Anel de eco: cada toque vira três estrelas; o anel inteiro decide quantos toques cabem.'
          : `Eco: cada toque vira a estrela e suas vizinhas — acender o desenho inteiro pede exatamente ${pr.length} toques certos.`,
    };
  },

  /** Eco + lógica: deduce the picture from the rules, then chase it with echoes. */
  echoLogic(r, net) {
    const def0 = tmpDef(net, true);
    if (parityChecks(def0).length) return null;
    const sol = initialState(def0);
    for (let i = 0; i < net.pts.length; i++) if (r() < 0.5) press(def0, sol, i);
    return {
      sol, core: [], echo: true,
      note: isTree(net)
        ? 'Duas etapas: primeiro descubra o desenho pelas regras; depois persiga-o com ecos, das folhas para dentro.'
        : 'Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira.',
      witness: (d) => d.stars.some((st) => st.glyph) && (pressesFor(d, sol)?.length ?? 0) >= 3,
    };
  },

  /** Eco + regras: the static rules admit two answers, but only one can be reached. */
  echoReach(r, net) {
    const def0 = tmpDef(net, true);
    if (!parityChecks(def0).length) return null;
    const sol = initialState(def0);
    for (let i = 0; i < net.pts.length; i++) if (r() < 0.5) press(def0, sol, i);
    return {
      sol, core: [], echo: true, needStaticAmbiguity: true,
      note: 'Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui.',
    };
  },
};

// ───────────────────────── finishing an instance ─────────────────────────

interface Slot {
  extras: Partial<Record<ClueKind, number>>;
  warm?: boolean;
  /** minimal reasoning required: lookaheads + 3·deep */
  depth?: number;
}

interface Built {
  def: ConstellationDef;
  raw: number;
  tpl: string;
  sol: Uint8Array;
  depth: number;
}

function finish(id: string, area: AreaId, net: Net, slot: Slot, inst: Instance, r: Rng, tpl: string): Built | null {
  const { sol, core } = inst;
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
    const { id: reg } = regionsOf(base, sol);
    const fixed = new Map<number, GemColor>();
    for (const c of core) if (c.kind === 'gem') {
      const col = (c.glyph as { color: GemColor }).color;
      if (fixed.has(reg[c.star!]) && fixed.get(reg[c.star!]) !== col) return null;
      fixed.set(reg[c.star!], col);
    }
    // a colour may only name one region
    const colorRegions = new Map<GemColor, number>();
    for (const [rid, col] of fixed) {
      if (colorRegions.has(col) && colorRegions.get(col) !== rid) return null;
      colorRegions.set(col, rid);
    }
    const coreStars = new Set(core.filter((c) => c.star !== undefined && c.kind !== 'lock').map((c) => c.star!));
    const coreThreads = new Set(core.filter((c) => c.kind === 'mark').map((c) => c.thread!));
    const kinds = (Object.keys(slot.extras) as ClueKind[]).filter((k) => (slot.extras[k] ?? 0) > 0);
    const pool = candidateClues(base, sol, kinds, r, fixed).filter((c) => (c.star === undefined || !coreStars.has(c.star)) && (c.thread === undefined || !coreThreads.has(c.thread)));
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
  const note = inst.note || PLAIN[(Object.keys(slot.extras) as string[]).sort((a, b) => (slot.extras[b as ClueKind] ?? 0) - (slot.extras[a as ClueKind] ?? 0))[0]] || PLAIN.contour;
  def.note = note;
  const n = def.stars.length;
  const raw = 0.8 + 0.03 * n + 0.12 * rep.rounds + 1.1 * rep.lookaheads + 2.8 * rep.deep + (def.echo ? 0.4 + 0.3 * rep.presses : 0) + (inst.needStaticAmbiguity ? 1.2 : 0);
  return { def, raw, tpl, sol, depth };
}

// ───────────────────────── plans per area ─────────────────────────

type Extras = Partial<Record<ClueKind, number>>;
interface AreaPlan {
  /** number of warm-up slots (the simplest drawings) and showpieces (the richest) */
  warm: number;
  show: number;
  warmExtras: Extras;
  /** template of the warm-ups (default: plain reading of the place's language) */
  warmTpl?: string;
  /** templates of the place, with the languages that fill in around the insight */
  tpls: [string, Extras][];
  /** reasoning ramp multiplier */
  brutal?: number;
}

const PLANS: Partial<Record<AreaId, AreaPlan>> = {
  hub: {
    warm: 0, show: 2, warmExtras: { mosaic: 1, contour: 0.5 }, brutal: 1.5,
    tpls: [['bridgeKin', { gem: 1, measure: 0.5 }], ['hubMosaic', { mosaic: 1, contour: 0.5 }], ['oddRingContour', { measure: 1, mosaic: 0.5 }], ['knotChain', { measure: 1, contour: 0.6, mark: 0.2 }],
      ['singleton', { gem: 1, measure: 0.5 }], ['theta', { mosaic: 1, contour: 0.5 }], ['cutParity', { measure: 0.7, mosaic: 0.4 }], ['triangleContour', { contour: 1, measure: 0.6, mark: 0.2 }],
      ['bridgeMeasure', { measure: 1, contour: 0.5 }], ['hubContour', { contour: 1, measure: 0.4 }], ['treeMeasure', { measure: 1, contour: 0.4 }], ['leafMosaic', { mosaic: 1, contour: 0.5 }]],
  },
  kinship: {
    warm: 2, show: 2, warmExtras: { gem: 1 },
    tpls: [['bridgeKin', { gem: 1, measure: 0.4 }], ['hubKin', { gem: 1, measure: 0.4, mark: 0.1 }], ['oddRingKin', { gem: 1, measure: 0.4 }], ['singleton', { gem: 1, measure: 0.4 }], ['warm', { gem: 1, measure: 0.3 }]],
  },
  measure: {
    warm: 2, show: 2, warmExtras: { measure: 1 },
    tpls: [['treeMeasure', { measure: 1, contour: 0.3 }], ['bridgeMeasure', { measure: 1, contour: 0.3 }], ['knotChain', { measure: 1, mark: 0.2 }], ['warm', { measure: 1, contour: 0.3 }]],
  },
  mold: {
    warm: 1, show: 2, warmExtras: { measure: 1, contour: 1 },
    tpls: [['hubContour', { measure: 0.6, contour: 0.6 }], ['knotChain', { measure: 1, contour: 0.5, mark: 0.15 }], ['bridgeMeasure', { measure: 1, contour: 0.5 }], ['triangleContour', { contour: 1, measure: 0.5 }],
      ['contourSum', { measure: 0.4 }], ['treeMeasure', { measure: 1, contour: 0.4 }], ['warm', { measure: 1, contour: 0.6 }]],
  },
  contour: {
    warm: 1, show: 2, warmExtras: { contour: 1 },
    tpls: [['oddRingContour', { contour: 0.6, measure: 0.3 }], ['hubContour', { contour: 1, mark: 0.1 }], ['triangleContour', { contour: 1, measure: 0.3 }], ['contourSum', { measure: 0.3 }], ['warm', { contour: 1, measure: 0.3 }]],
  },
  mosaic: {
    warm: 1, show: 2, warmExtras: { mosaic: 1 },
    tpls: [['leafMosaic', { mosaic: 1, contour: 0.6, mark: 0.2 }], ['hubMosaic', { mosaic: 1, contour: 0.6, mark: 0.2 }], ['theta', { mosaic: 1, contour: 0.5 }], ['leafMosaic', { mosaic: 1, contour: 0.3 }], ['hubMosaic', { mosaic: 1, contour: 0.4 }], ['warm', { mosaic: 1, contour: 0.6, mark: 0.2 }]],
  },
  beacon: {
    warm: 1, show: 2, warmExtras: { mosaic: 1, contour: 0.5 },
    tpls: [['leafMosaic', { mosaic: 1, contour: 0.5, mark: 0.15 }], ['hubContour', { contour: 1, mosaic: 0.5, mark: 0.15 }], ['hubMosaic', { mosaic: 1, contour: 0.5, mark: 0.15 }], ['cutParity', { mosaic: 0.6, contour: 0.6 }], ['theta', { mosaic: 1, contour: 0.4 }], ['warm', { mosaic: 1, contour: 0.6, mark: 0.15 }]],
  },
  weave: {
    warm: 2, show: 2, warmExtras: { mark: 1 },
    tpls: [['cutParity', { measure: 0.6, contour: 0.4 }], ['knotChain', { measure: 1, contour: 0.4, mark: 0.25 }], ['warm', { mark: 1, measure: 0.5 }]],
  },
  twins: {
    warm: 2, show: 2, warmExtras: {}, warmTpl: 'echoAllLit',
    tpls: [['echoAllLit', {}], ['echoLogic', { mosaic: 1, contour: 0.5 }], ['echoReach', { mosaic: 1, contour: 0.6, measure: 0.4 }]],
  },
  citadel: {
    warm: 0, show: 2, warmExtras: { gem: 1, measure: 0.5 }, brutal: 1.35,
    tpls: [['cutParity', { gem: 0.6, measure: 0.6 }], ['hubKin', { gem: 1, measure: 0.5, mark: 0.2 }], ['bridgeMeasure', { measure: 1, contour: 0.5, mark: 0.2 }], ['theta', { mosaic: 1, contour: 0.6, mark: 0.15 }],
      ['oddRingKin', { gem: 1, measure: 0.6, mark: 0.15 }], ['triangleContour', { contour: 1, mosaic: 0.5, mark: 0.2 }], ['singleton', { gem: 1, mosaic: 0.5, mark: 0.2 }], ['knotChain', { measure: 1, gem: 0.5, contour: 0.4, mark: 0.3 }],
      ['oddRingContour', { contour: 0.6, gem: 0.6, mark: 0.2 }], ['bridgeKin', { gem: 1, measure: 0.7, mark: 0.25 }], ['hubContour', { contour: 1, gem: 0.5, mark: 0.2 }], ['hubMosaic', { mosaic: 1, gem: 0.4, mark: 0.2 }]],
  },
  echo: {
    warm: 0, show: 2, warmExtras: {}, brutal: 1.35,
    tpls: [['echoAllLit', {}], ['echoReach', { mosaic: 1, contour: 0.7, measure: 0.5, mark: 0.1 }], ['echoLogic', { mosaic: 1, contour: 0.6, measure: 0.4 }], ['echoReach', { mosaic: 1, contour: 0.7, measure: 0.5, gem: 0.3 }]],
  },
};

// ───────────────────────── the discovery ramp (prologue), on its drawings ─────────────────────────

function prologueSet(): ConstellationDef[] {
  const arts = ART.filter((a) => a.area === 'prologue');
  const byName = (pt: string) => netOf(arts.find((a) => a.name.pt === pt)!);
  const out: ConstellationDef[] = [];
  // c01 — no glyphs: every star lit
  {
    const net = byName('Gaivota');
    const d = buildDef('prologue.c01', 'prologue', net, [], false);
    d.note = 'Descoberta: as cinco estrelas da gaivota ligadas por fios. Sem nenhum glifo, a constelação só quer todas as estrelas acesas — e o sino canta.';
    out.push(d);
  }
  // c02 — echo, all lit
  {
    const net = byName('Veleiro');
    const d = buildDef('prologue.c02', 'prologue', net, [], true);
    const pr = pressesFor(d, new Uint8Array(net.pts.length).fill(1));
    if (!pr || pr.length < 2 || pr.length > 4) throw new Error(`prologue echo: ${pr?.length} presses`);
    d.note = `Eco: apertar uma estrela vira também as vizinhas. Acender o veleiro inteiro pede só ${pr.length} toques bem escolhidos.`;
    out.push(d);
  }
  // c03 — the secret language of the threads: knots and cuts only
  {
    const net = byName('Concha');
    const r = mulberry(303);
    let best: ConstellationDef | null = null;
    for (let k = 0; k < 400 && !best; k++) {
      const sol = randomSol(r, net.pts.length, 0.5);
      if (sol.every((v) => v === sol[0])) continue;
      const base = buildDef('prologue.c03', 'prologue', net, [], false);
      let chosen = candidateClues(base, sol, ['mark'], r);
      if (!uniqueWith('prologue.c03', 'prologue', net, chosen, false, sol)) continue;
      for (const c of shuffle(r, chosen.slice())) {
        const trial = chosen.filter((x) => x !== c);
        if (uniqueWith('prologue.c03', 'prologue', net, trial, false, sol)) chosen = trial;
      }
      const d = buildDef('prologue.c03', 'prologue', net, chosen, false);
      if (!d.threads.some((t) => t.mark === 'same') || !d.threads.some((t) => t.mark === 'diff')) continue;
      if (!estimateDifficulty(d, sol).solvedByLogic) continue;
      best = d;
    }
    if (!best) throw new Error('prologue.c03');
    best.note = 'A linguagem secreta: o fio cortado quer pontas diferentes, o nó quer pontas iguais. Ninguém explica — quando erra, quem pisca é o fio.';
    out.push(best);
  }
  // c04 — a loop with knots and cuts, and the stake (the umbrella's pole) decides the rest
  {
    const net = byName('Guarda-sol');
    const n = net.pts.length;
    const pole = net.pts.reduce((b, p, i) => (p[1] > net.pts[b][1] ? i : b), 0);
    const r = mulberry(404);
    let best: ConstellationDef | null = null;
    for (let k = 0; k < 600 && !best; k++) {
      const sol = randomSol(r, n, 0.5);
      sol[pole] = 1;
      const base = buildDef('prologue.c04', 'prologue', net, [], false);
      const lock: Clue = { kind: 'lock', star: pole, lock: 1 };
      let chosen = [lock, ...candidateClues(base, sol, ['mark'], r)];
      if (!uniqueWith('prologue.c04', 'prologue', net, chosen, false, sol)) continue;
      for (const c of shuffle(r, chosen.filter((c) => c.kind === 'mark'))) {
        const trial = chosen.filter((x) => x !== c);
        if (uniqueWith('prologue.c04', 'prologue', net, trial, false, sol)) chosen = trial;
      }
      const d = buildDef('prologue.c04', 'prologue', net, chosen, false);
      const unmarked = d.threads.filter((t) => !t.mark).length;
      if (unmarked < 1 || unmarked > 2) continue;
      const rep = estimateDifficulty(d, sol);
      if (!rep.solvedByLogic) continue;
      best = d;
    }
    if (!best) throw new Error('prologue.c04');
    best.note = 'O guarda-sol fincado na areia: a estaca acesa decide o resto. Cada triângulo tem um número par de cortes — o fio sem marca se revela contando.';
    out.push(best);
  }
  out[0].difficulty = 1;
  out[1].difficulty = 2;
  out[2].difficulty = 2;
  out[3].difficulty = 3;
  return out;
}

// ───────────────────────── generation ─────────────────────────

function generateSlot(id: string, area: AreaId, net: Net, plan: AreaPlan, warm: boolean, show: boolean, target: number, seed: number, usedTpls: string[]): Built {
  // showpieces get one more layer: the secret thread language joins the place's languages
  const choices: [string, Extras][] = warm ? [[plan.warmTpl ?? 'warm', plan.warmExtras]] : show ? plan.tpls.map(([t, e]) => [t, Object.keys(e).length ? { mark: 0.15, ...e } : e] as [string, Extras]) : plan.tpls;
  for (let relax = 0; relax <= 4; relax++) {
    let best: Built | null = null;
    let bestScore = -Infinity;
    const r = mulberry(seed + relax * 7);
    const attempts = (show ? 3000 : 1500) * (1 + relax);
    const cap = (show ? 60 : 24) + Math.round(3 * target);
    let found = 0;
    const t0 = Date.now();
    const depthMin = warm ? 0 : Math.max(1, Math.round(target / 3) - relax);
    for (let k = 0; k < attempts && found < cap && Date.now() - t0 < 45_000 * (1 + relax); k++) {
      const [tpl, extras] = pick(r, choices);
      const inst = T[tpl](r, net);
      if (!inst) continue;
      const b = finish(id, area, net, { extras, warm, depth: depthMin }, inst, r, tpl);
      if (!b) continue;
      // warm-ups are read, not reasoned: at most one "what if" (more only when nothing gentler exists)
      if (warm && b.depth > 1 + relax) continue;
      found++;
      const repeats = usedTpls.filter((u) => u === tpl).length;
      const clues = b.def.stars.filter((s) => s.glyph).length + b.def.threads.filter((t) => t.mark).length;
      // a named insight beats plain reading, even at some cost in depth
      const plain = tpl === 'warm' && !warm ? (show ? 3.5 : 2.5) : 0;
      const score = -1.0 * Math.abs(b.depth - target) - 0.1 * clues - 0.6 * repeats - plain + (warm ? -0.5 * b.raw : 0);
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (best) {
      if (relax) console.log(`  (${id} ${net.shape}: relaxed ×${relax})`);
      return best;
    }
  }
  throw new Error(`could not generate ${id} on ${net.shape}`);
}

function toDifficulty(raw: number): number {
  return Math.max(1, Math.min(10, Math.round(raw * 0.68)));
}

function emit(all: ConstellationDef[]): string {
  const lines: string[] = [];
  lines.push('// GENERATED by tools/gen-constellations.ts — do not edit by hand.');
  lines.push('// The secret layer: 150 constellations hidden across the island, each one a line drawing');
  lines.push('// (see docs/CONSTELLATIONS.md). x to the right, z downward, as seen from the figure\'s spot.');
  lines.push("import type { ConstellationDef } from '../secret/types';");
  lines.push('');
  lines.push('export const CONSTELLATIONS: ConstellationDef[] = [');
  for (const d of all) {
    lines.push('  {');
    lines.push(`    id: '${d.id}', area: '${d.area}', difficulty: ${d.difficulty},${d.echo ? ' echo: true,' : ''}`);
    lines.push(`    name: { pt: ${JSON.stringify(d.name.pt)}, en: ${JSON.stringify(d.name.en)} },`);
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
    stats.push('prologue: 4 handcrafted on drawings');
    return;
  }
  const plan = PLANS[area]!;
  const arts = ART.filter((a) => a.area === area);
  if (arts.length !== EXPECT[area]) throw new Error(`${area}: ${arts.length} drawings, expected ${EXPECT[area]}`);
  // the simplest drawings warm up, the rest climb the ramp; the drawings that carry the deepest puzzles
  // are then rebuilt as showpieces (more budget, one more language layer) and close the place
  const nets = arts.map(netOf).sort((x, y) => x.pts.length + 0.6 * x.edges.length - (y.pts.length + 0.6 * y.edges.length));
  const built: { b: Built; rank: number; net: Net; i: number; target: number }[] = [];
  const used: string[] = [];
  const brutal = plan.brutal ?? 1;
  const N = nets.length;
  const seedOf = (i: number, show: boolean) => (ai + 1) * 100_003 + i * 7919 + (show ? 55_555 : 0);
  const log = (net: Net, b: Built, target: number, tag: string) => {
    if (!process.argv.includes('--verbose')) return;
    const d = b.def;
    const kinds: Record<string, number> = {};
    for (const st of d.stars) if (st.glyph) kinds[st.glyph.kind] = (kinds[st.glyph.kind] ?? 0) + 1;
    console.log(`  ${tag} ${net.shape.padEnd(22)} ${b.tpl.padEnd(15)} n=${d.stars.length} e=${d.threads.length} ${JSON.stringify(kinds)} marks=${d.threads.filter((x) => x.mark).length}${d.echo ? ' ECHO' : ''} depth=${b.depth} target=${target.toFixed(1)} raw=${b.raw.toFixed(1)}`);
  };
  nets.forEach((net, i) => {
    const warm = i < plan.warm;
    const t = N > 1 ? i / (N - 1) : 1;
    const target = warm ? 1 : (2 + 7.5 * Math.pow(t, 1.1)) * brutal;
    const id = `${area}.c${String(i + 1).padStart(2, '0')}`;
    const b = generateSlot(id, area, net, plan, warm, false, target, seedOf(i, false), used);
    used.push(b.tpl);
    built.push({ b, rank: warm ? 0 : 1, net, i, target });
    log(net, b, target, warm ? 'warm' : 'ramp');
  });
  const showWorth = (x: { b: Built }) => x.b.raw - (x.b.tpl === 'warm' ? 2.5 : 0);
  const shows = built.filter((x) => x.rank === 1).sort((x, y) => showWorth(y) - showWorth(x)).slice(0, plan.show);
  for (const x of shows) {
    const target = (2 + 9.5) * brutal;
    const b = generateSlot(x.b.def.id, area, x.net, plan, false, true, target, seedOf(x.i, true), used.filter((u) => u !== x.b.tpl));
    if (b.raw > x.b.raw) x.b = b;
    x.rank = 2;
    log(x.net, x.b, target, 'show');
  }
  // final order: warm-ups, then the ramp by difficulty, showpieces last
  const ordered = built.sort((x, y) => x.rank - y.rank || x.b.raw - y.b.raw).map((x) => x.b);
  let prev = 1;
  ordered.forEach((b, k) => {
    b.def.id = `${area}.c${String(k + 1).padStart(2, '0')}`;
    b.def.difficulty = Math.max(prev, toDifficulty(b.raw));
    prev = b.def.difficulty;
    all.push(b.def);
  });
  stats.push(`${area}: ${built.length} (${((Date.now() - ta) / 1000).toFixed(1)}s)`);
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
  out.push('> Nenhum lugar do jogo ensina isto. Quem descobrir, descobre 150 puzzles a mais — e 150 desenhos no céu da ilha.');
  out.push('');
  out.push('## A ideia');
  out.push('');
  out.push('Espalhadas pela ilha existem **redes de estrelas**: objetos que parecem decoração, ligados por **fios finos de luz**.');
  out.push('Vistas do lugar certo, as estrelas e os fios formam um **desenho** — como as constelações do céu: um cisne, uma âncora,');
  out.push('uma raposa, um farol. Cada desenho é diferente e combina com o lugar (conchas e gaivotas na praia, folhas e corujas no');
  out.push('bosque, escaravelhos e esfinges no templo das areias…). Cada objeto é uma *estrela* que acende e apaga com um clique.');
  out.push('Cada rede tem um **sino** num ponto que significa algo no desenho (o olho de um bicho, o centro de uma roda, a luz de uma');
  out.push('lanterna): tocar o sino confere a constelação. Se estiver certa, os fios brilham para sempre e o Diário guarda o nome do');
  out.push('desenho; se estiver errada, as estrelas e os fios culpados piscam em vermelho.');
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
  out.push('1. No Despertar, as cinco estrelas de uma **gaivota** brilham sobre a praia. Quem mira nelas vê o cursor virar anel —');
  out.push('   como num painel. Clicar acende. Tocar o sino com tudo aceso faz a primeira constelação cantar.');
  out.push('2. A segunda, um **veleiro**, tem eco (apertar uma vira as vizinhas) — só se descobre apertando.');
  out.push('3. A **concha** e o **guarda-sol** ensinam sozinhos a linguagem secreta dos fios: o erro pisca *no fio*.');
  out.push('4. A partir da primeira solução, um vitral escondido no Salão das Tesselas acende e mostra `1 / 150`.');
  out.push('5. Com 100 constelações, abre-se o Cofre Oculto.');
  out.push('');
  out.push('### Desenhos legíveis');
  out.push('');
  out.push('Cada desenho foi feito à mão (`tools/lib/constellation-art.ts`) e passa por regras de leitura, conferidas em código');
  out.push('(`tools/lib/drawing-rules.ts`, `tools/art-check.ts` e os testes), com W = o lado maior do desenho:');
  out.push('');
  out.push('- 4 a 16 estrelas, uma figura só; fios nunca se cruzam;');
  out.push('- estrelas a pelo menos 0,11·W umas das outras e a 0,06·W de qualquer fio que não seja delas; nenhum fio menor que 0,10·W;');
  out.push('- o ângulo entre dois fios numa estrela é de pelo menos 20°;');
  out.push('- o sino fica dentro da figura, a pelo menos 0,10·W de toda estrela e todo fio;');
  out.push('- nenhum par de desenhos é quase igual (sobreposição das linhas, também espelhada).');
  out.push('');
  out.push('A folha de contato com todos os desenhos e seus nomes: `npx tsx tools/render-constellations.ts` →');
  out.push('`screenshots/constellation-drawings.png`.');
  out.push('');
  out.push('### Uma percepção por constelação');
  out.push('');
  out.push('O desenho é fixo; o puzzle nasce **em cima dele**, de uma ideia que só existe em rede e que o próprio desenho oferece');
  out.push('(a estrela que liga a cauda ao corpo, o cubo de uma roda, as pontas soltas de uma folha, o anel ímpar de um rosto…).');
  out.push('A nota de cada uma no catálogo nomeia essa ideia. As famílias de percepções:');
  out.push('');
  out.push('| Percepção | Ideia |');
  out.push('|---|---|');
  out.push('| A ponte | uma estrela (ponto de corte) é a única passagem entre duas partes: famílias ou regiões que precisam se encontrar passam por ela |');
  out.push('| O número não cabe | a Medida é maior que um lado inteiro da ponte: a região é obrigada a atravessar |');
  out.push('| O cubo | a estrela com mais fios encosta em todo mundo: só uma família pode ter o estado dela |');
  out.push('| Amigo único / o dissidente | Contorno 1 ou N−1 num cubo: exatamente um vizinho é igual (ou diferente) |');
  out.push('| A janela inteira | o Mosaico de um cubo conta a vizinhança toda; comparado com uma vizinha, sobra pouco |');
  out.push('| Janelas quase iguais | duas estrelas ligadas veem quase as mesmas vizinhas: subtraia |');
  out.push('| Folhas | o Mosaico de uma folha só vê ela e o pai: resolva das pontas para dentro |');
  out.push('| Árvore de medidas | numa árvore cada fronteira corta de vez; as Medidas se encaixam como galhos |');
  out.push('| Laço ímpar | num anel ímpar, luz e sombra não alternam o caminho todo: em algum ponto dois vizinhos concordam |');
  out.push('| Paridade do laço | todo laço tem um número par de fios cortados: o elo sem marca se revela contando |');
  out.push('| Corrente de nós | estrelas amarradas por nós são uma região só; a Medida diz onde ela termina |');
  out.push('| Triângulos | todo triângulo tem 0 ou 2 fronteiras, nunca 1 ou 3 |');
  out.push('| A soma par | a soma de todos os Contornos é o dobro dos fios cortados: sempre par |');
  out.push('| A gema solitária | uma cor única no lugar mais movimentado precisa de um mundo só dela |');
  out.push('| Eco na árvore / no anel / no desenho | uma folha só mexe nela e no pai; acender tudo pede os toques certos |');
  out.push('| Eco alcançável | as regras admitem duas respostas, mas apertando estrelas só se chega a uma |');
  out.push('');
  out.push('Os desenhos mais simples de cada lugar são o aquecimento; os mais ricos, as **vitrines**, com mais camadas de raciocínio.');
  out.push('');
  out.push('### Garantias');
  out.push('');
  out.push('- Toda constelação tem **uma única solução** (para regras simétricas — sem mosaico nem estaca — a solução invertida');
  out.push('  também vale e é aceita) e pode ser resolvida **só com raciocínio**, sem chute: o gerador simula um jogador cuidadoso');
  out.push('  (deduções locais + hipóteses com contradição) e descarta o que exigir tentativa e erro. A dificuldade vem da');
  out.push('  profundidade do raciocínio, não do tamanho.');
  out.push('- Nas constelações com eco, a solução é alcançável apertando estrelas a partir do estado inicial.');
  out.push('');
  out.push('## Catálogo');
  out.push('');
  out.push('| id | desenho | lugar | estrelas | fios | regras | dificuldade | nota |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const d of list) {
    const kinds = constellationKinds(d).map((k) => KIND_PT[k] ?? k).join(', ');
    out.push(`| ${d.id} | **${d.name.pt}** (${d.name.en}) | ${AREA_PT[d.area] ?? d.area} | ${d.stars.length} | ${d.threads.length} | ${kinds} | ${d.difficulty} | ${(d.note ?? '').replace(/\|/g, '/')} |`);
  }
  out.push('');
  return out.join('\n');
}
