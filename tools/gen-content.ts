/**
 * Generates every non-handcrafted puzzle group and writes it into the area files between
 * the `// <gen>` and `// </gen>` markers. Deterministic (seeded).
 *
 * Quality bar: every post-teaching panel is curated around its INSIGHT PATH (see
 * solver.insightPath): the solve is fair (no guessing beyond a few one-step "what if"s) and its
 * bottleneck is a nameable "ahá"; the note names the actual insights. Hearts end with showpieces.
 *
 *   npx tsx tools/gen-content.ts            (all areas)
 *   npx tsx tools/gen-content.ts kinship    (one area)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREA_BY_ID, type AreaId } from '../src/data/areas';
import { buildGeometry, computeRegions, puzzle } from '../src/puzzle/board';
import { beaconSight, geometryOf } from '../src/puzzle/rules';
import { insightPath, solve } from '../src/puzzle/solver';
import type { PuzzleDef } from '../src/puzzle/types';
import { curate, insightNote, pool, poolSpec, score, showScore, stats, type Level } from './lib/curate';
import { generate, generateKinship, generatePond, type Candidate, type Kind, type PondSpec, type Spec } from './lib/gen';
import { PICTURES } from './lib/pictures';
import { rng, type Rng } from './lib/random-puzzle';
import { toSource } from './lib/show';
import citadelExisting from '../src/data/puzzles/citadel';
import spireExisting from '../src/data/puzzles/spire';
import { weaveFromPicture } from './weave-check';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv[2];

const ECHO_DIRS = [['n', 's', 'e', 'w'], ['e', 'w'], ['n', 's'], ['ne', 'nw', 'se', 'sw'], ['row'], ['col'], ['ne', 'sw'], ['nw', 'se']] as const;
type EchoSpec = NonNullable<Spec['echo']>;
const echoDirs = (list: number[]): EchoSpec['dirs'] => list.map((i) => [...ECHO_DIRS[i]]) as EchoSpec['dirs'];
const LOOK: Record<Level, number> = { practice: 2, trial: 4, heart: 8 };
/** calibration: how many insights a sequence opener may use (practice = teaching pace) */
const OPENER_MAX: Record<Level, number> = { practice: 2, trial: 3, heart: 6 };
/** calibration: a sequence stays inside its slot — at most this many insights (mastery sequences use 'heart') */
const STEP_CAP: Record<Level, number> = { practice: 6, trial: 10, heart: 14 };

// ── helpers ───────────────────────────────────────────

function cnt(area: AreaId, group: string): number {
  if (group === 'vault') return 1;
  const g = AREA_BY_ID[area].groups.find((x) => x.key === group);
  if (!g) throw new Error(`no group ${area}.${group}`);
  return g.count;
}
function regionStats(p: PuzzleDef, s: Uint8Array): { maxRegion: number; regions: number } {
  const reg = computeRegions(buildGeometry(p), s);
  return { maxRegion: Math.max(...reg.members.map((m) => m.length)), regions: reg.members.length };
}
function glyphKinds(p: PuzzleDef): Set<string> {
  const s = new Set<string>();
  for (const c of p.cells) if (c.glyph) s.add(c.glyph.kind);
  if (p.rowClues?.some(Boolean) || p.colClues?.some(Boolean)) s.add('weave');
  if (p.cells.some((c) => c.echo?.length)) s.add('echo');
  return s;
}
function count(p: PuzzleDef, kind: string): number {
  return p.cells.filter((c) => c.glyph?.kind === kind).length;
}
function freeCount(p: PuzzleDef): number {
  return p.cells.filter((c) => !c.hole).length;
}
function seeded(area: string, group: string): Rng {
  let h = 2166136261;
  for (const ch of `${area}/${group}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return rng(h || 7);
}
const N = (n: number) => ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'][n] ?? String(n);
const NF = (n: number) => ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'][n] ?? String(n);
const cap = (s: string) => s.replace(/^./, (x) => x.toUpperCase());
const holesTxt = (p: PuzzleDef) => { const h = p.cells.filter((c) => c.hole).length; return h ? ` e ${h === 1 ? 'uma rocha' : `${NF(h)} rochas`}` : ''; };
const LANG: Record<string, string> = { gem: 'Afinidade', measure: 'Medida', mold: 'Forma', contour: 'Contorno', mosaic: 'Mosaico', beacon: 'Farol', weave: 'Trama', twin: 'Gêmeos', echo: 'Eco' };
const langs = (p: PuzzleDef) => [...glyphKinds(p)].map((k) => LANG[k] ?? k).join(' + ');

function finish(list: Candidate[], area: AreaId, group: string, diff: [number, number], note: (c: Candidate, i: number) => string, need = cnt(area, group)): PuzzleDef[] {
  if (list.length < need) throw new Error(`${area}.${group}: only ${list.length}/${need} candidates`);
  return list.slice(0, need).map((c, i) => {
    const p = c.p;
    p.id = group === 'vault' ? 'hub.vault' : `${area}.${group}.${i + 1}`;
    p.difficulty = need === 1 ? diff[1] : Math.round(diff[0] + ((diff[1] - diff[0]) * i) / (need - 1));
    p.note = note(c, i);
    return p;
  });
}

/** at most `k` clues of one kind inside one region (clean, elegant panels) */
const tidy = (k = 2) => (p: PuzzleDef, s: Uint8Array) => {
  const reg = computeRegions(buildGeometry(p), s);
  const per = new Map<string, number>();
  p.cells.forEach((c, i) => {
    if (!c.glyph || (c.glyph.kind !== 'measure' && c.glyph.kind !== 'mold')) return;
    const key = c.glyph.kind + reg.id[i];
    per.set(key, (per.get(key) ?? 0) + 1);
  });
  return [...per.values()].every((v) => v <= k);
};
const all = (...fs: ((p: PuzzleDef, s: Uint8Array) => boolean)[]) => (p: PuzzleDef, s: Uint8Array) => fs.every((f) => f(p, s));
const hasAll = (kinds: Kind[]) => (p: PuzzleDef) => kinds.every((k) => glyphKinds(p).has(k));
const keepOf = (kinds: Kind[]) => Object.fromEntries(kinds.filter((k) => k !== 'twin' && k !== 'beacon' && k !== 'gem').map((k) => [k, 1])) as Partial<Record<Kind, number>>;

/** Generates a pool for one group and curates it. */
function group(area: AreaId, g: string, level: Level, spec: Spec, tries: number, max: number, accept?: (p: PuzzleDef, s: Uint8Array) => boolean, o: Parameters<typeof curate>[4] = {}, need = cnt(area, g)): Candidate[] {
  const r = seeded(area, g);
  const s2: Spec = { ...spec, fairLook: spec.fairLook ?? LOOK[level], accept: (p, sol) => (!spec.accept || spec.accept(p, sol)) && (!accept || accept(p, sol)) };
  const list = poolSpec(r, s2, tries, max);
  return curate(list, need, level, `${area}.${g}`, o);
}

/** Best single candidate for one slot (used by the combination areas). */
function slot(area: AreaId, key: string, level: Level, spec: Spec, tries: number, accept?: (p: PuzzleDef, s: Uint8Array) => boolean, minNamed = 1, minSteps = 0): Candidate[] {
  const r = seeded(area, key);
  const s2: Spec = { ...spec, fairLook: spec.fairLook ?? LOOK[level], accept: (p, sol) => (!spec.accept || spec.accept(p, sol)) && (!accept || accept(p, sol)) };
  const list = poolSpec(r, s2, tries, Number(process.env.POOL ?? (level === 'heart' ? 12 : 8)));
  const maxBasic = level === 'heart' ? 0.6 : level === 'trial' ? 0.8 : 1;
  const hard = list.filter((c) => stats(c).solved && stats(c).named.length >= minNamed && stats(c).basicRoot <= maxBasic && stats(c).steps >= minSteps);
  const good = hard.length ? hard : list.filter((c) => stats(c).solved && stats(c).named.length >= minNamed && stats(c).steps >= minSteps);
  const pickFrom = good.length ? good : list.filter((c) => stats(c).solved);
  if (!pickFrom.length) throw new Error(`${area}.${key}: no fair candidate (${list.length} in pool)`);
  return [pickFrom.sort((a, b) => showScore(b) - showScore(a))[0]];
}

function weaveSet(names: string[]): Candidate[] {
  return names.map((name) => {
    const pic = PICTURES[name];
    const p = weaveFromPicture('w', pic.pic.join('/'), (pic.holes ?? []).join('/'));
    const res = solve(p, { maxSolutions: 2, maxNodes: 400000 });
    if (res.solutions.length !== 1) throw new Error(`picture ${name} not unique`);
    p.note = pic.note;
    return { p, sol: res.solutions[0], glyphs: 0, rivets: 0, nodes: res.nodes, simple: res.propagationOnly, sols: 1, score: 0 };
  });
}

/** wrap is essential: the same glyphs on a flat board have no solution or a different one. */
function wrapEssential(p: PuzzleDef, sol: Uint8Array): boolean {
  const flat: PuzzleDef = JSON.parse(JSON.stringify(p));
  delete flat.wrap;
  const res = solve(flat, { maxSolutions: 1, maxNodes: 60000, timeLimitMs: 3000 });
  if (!res.complete) return false;
  if (!res.solutions.length) return true;
  return res.solutions[0].some((v, i) => v !== sol[i]);
}

// ── features (structural facts worth naming) ─────────

function measureFeature(c: Candidate): string | undefined {
  let best: { n: number; dark: boolean } | null = null;
  c.p.cells.forEach((cell, i) => {
    if (cell.glyph?.kind !== 'measure') return;
    const n = (cell.glyph as { n: number }).n;
    if (!best || n > best.n) best = { n, dark: !c.sol[i] };
  });
  const b = best as { n: number; dark: boolean } | null;
  if (b && b.dark && b.n >= 7) return `O ${b.n} mora na sombra: ele mede a escuridão`;
  if (c.p.cells.some((cell, i) => cell.glyph?.kind === 'measure' && !c.sol[i])) return 'Há números morando na sombra';
  return undefined;
}
function moldFeature(c: Candidate): string | undefined {
  const molds = c.p.cells.map((cell, i) => [cell, i] as const).filter(([cell]) => cell.glyph?.kind === 'mold');
  const free = molds.filter(([cell]) => (cell.glyph as { free?: boolean }).free).length;
  const dark = molds.filter(([, i]) => !c.sol[i]).length;
  const bits: string[] = [];
  if (free) bits.push(free === 1 ? 'um molde que gira' : `${N(free)} moldes que giram`);
  if (dark) bits.push(dark === 1 ? 'um molde esculpido na sombra' : `${N(dark)} moldes esculpidos na sombra`);
  return bits.length ? cap(bits.join(' e ')) : undefined;
}
function beaconFeature(c: Candidate): string | undefined {
  const g = geometryOf(c.p);
  const bs = c.p.cells.map((cell, i) => (cell.glyph?.kind === 'beacon' ? i : -1)).filter((i) => i >= 0);
  const sees = bs.some((b) => beaconSight(g, c.sol, b).some((t) => t !== b && bs.includes(t)));
  return sees ? 'Faróis que se enxergam' : undefined;
}
function twinFeature(c: Candidate): string | undefined {
  const bits: string[] = [];
  const twins = c.p.cells.map((cell, i) => [cell, i] as const).filter(([cell]) => cell.glyph?.kind === 'twin');
  const bySym = new Map<string, number[]>();
  for (const [cell, i] of twins) {
    const sym = (cell.glyph as { symbol: string }).symbol;
    if (!bySym.has(sym)) bySym.set(sym, []);
    bySym.get(sym)!.push(i);
  }
  if ([...bySym.values()].some((t) => t.length === 2 && c.sol[t[0]] !== c.sol[t[1]])) bits.push('a luz copia a sombra');
  if (twins.some(([cell]) => (cell.glyph as { mirror?: boolean }).mirror)) bits.push('um par espelhado');
  return bits.length ? cap(bits.join(' e ')) : undefined;
}

// ── teaching areas ────────────────────────────────────

type Groups = Record<string, PuzzleDef[]>;

// ── sequences (contract v3): each teaching area = 8 insight sequences of 4 + 6 showpieces ──

interface Seq {
  key: string; // letter A..H
  title: string; // the sequence's idea (shown in the note)
  level: Level;
  make: (r: Rng) => Candidate | null;
  fit: (c: Candidate) => boolean;
  tries: number;
  lang: string;
  feature?: (c: Candidate) => string | undefined;
  /** a gentler generator (smaller board, fewer clues) for the sequence's opener */
  openMake?: (r: Rng) => Candidate | null;
}

const fair = (c: Candidate, level: Level) => {
  const s = stats(c);
  return s.solved && s.looks <= LOOK[level];
};
const hasNamed = (c: Candidate, ...tags: string[]) => stats(c).named.some((t) => tags.includes(t));
const looks = (c: Candidate) => stats(c).looks;

/** Builds a sequence of `n` puzzles that all show the sequence's insight, easy → hard. */
function runSeq(area: AreaId, s: Seq, n = 4, open = false): Candidate[] {
  const r = seeded(area, `seq-${s.key}`);
  const fits: Candidate[] = [];
  const seen = new Set<string>();
  const t0 = Date.now();
  const budget = Number(process.env.SEQ_MS ?? 120_000);
  for (let k = 0; k < s.tries && fits.length < n * 3 && (Date.now() - t0 < budget || fits.length < n); k++) {
    if (Date.now() - t0 > budget * 3) break;
    const c = s.make(r);
    if (!c) continue;
    const key = JSON.stringify(c.p.cells) + JSON.stringify(c.p.rowClues ?? '') + JSON.stringify(c.p.colClues ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    if (!open && !fair(c, s.level)) continue;
    if (!s.fit(c) || stats(c).steps > STEP_CAP[s.level]) continue;
    fits.push(c);
  }
  if (fits.length < n) {
    // keep going with a relaxed criterion (any fair panel with at least one real insight)
    const extra: Candidate[] = [];
    const t1 = Date.now();
    for (let k = 0; k < s.tries * 2 && fits.length + extra.length < n * 2 && Date.now() - t1 < budget; k++) {
      const c = s.make(r);
      if (!c) continue;
      if (!open && !fair(c, s.level)) continue;
      if (stats(c).steps < 1 || stats(c).steps > STEP_CAP[s.level]) continue;
      extra.push(c);
    }
    console.warn(`  ${area} seq ${s.key}: ${fits.length} fitting + ${extra.length} relaxed`);
    fits.push(...extra.sort((a, b) => stats(b).named.length - stats(a).named.length).slice(0, n - fits.length));
  }
  if (fits.length < n) throw new Error(`${area} seq ${s.key} (${s.title}): only ${fits.length}/${n} fitting candidates`);
  // calibration: a sequence opens gently (practice openers use at most 2 insights) and climbs
  const gentle = (c: Candidate) => stats(c).steps * 10 - stats(c).basicRoot;
  fits.sort((a, b) => gentle(a) - gentle(b));
  const openerMax = OPENER_MAX[s.level];
  if (stats(fits[0]).steps > openerMax) {
    const t2 = Date.now();
    const mk = s.openMake ?? s.make;
    let gentlest: Candidate | null = null;
    for (let k = 0; k < s.tries * 3 && Date.now() - t2 < budget; k++) {
      const c = mk(r);
      if (!c || (!open && !fair(c, s.level)) || !s.fit(c) || stats(c).steps < 1) continue;
      if (!gentlest || gentle(c) < gentle(gentlest)) gentlest = c;
      if (stats(c).steps <= openerMax) break;
    }
    if (gentlest && gentle(gentlest) < gentle(fits[0])) fits.unshift(gentlest);
    if (stats(fits[0]).steps > openerMax) console.warn(`  ${area} seq ${s.key}: gentlest opener still uses ${stats(fits[0]).steps} insights`);
  }
  const rest = fits.slice(1);
  const out: Candidate[] = [fits[0]];
  for (let i = 1; i < n; i++) out.push(rest[Math.round(((i - 1) * (rest.length - 1)) / Math.max(1, n - 2))] ?? rest[rest.length - 1]);
  const uniq = [...new Set(out)];
  if (uniq.length < n) for (const c of rest) { if (uniq.length >= n) break; if (!uniq.includes(c)) uniq.push(c); }
  return uniq.slice(0, n).sort((a, b) => gentle(a) - gentle(b));
}

/** what a panel without any named insight asks for (pure reading of the rule) */
const PLAIN: Record<string, string> = {
  weave: 'cada fio, lido sozinho e depois cruzado com os outros, já decide o desenho',
  beacon: 'basta contar o que cada farol enxerga',
  contour: 'basta ler cada placa com cuidado',
  mosaic: 'basta contar cada janela com cuidado',
  measure: 'basta contar as regiões com cuidado',
  mold: 'basta encaixar as peças com cuidado',
  gem: 'basta separar e unir as famílias',
  twin: 'basta copiar a forma do outro lado',
};
function seqNote(s: Seq, i: number, n: number, c: Candidate): string {
  const note = insightNote(c, s.lang, s.feature?.(c));
  return `seq ${s.key}${i + 1}/${n} — ${s.title}. ${note === '.' ? `${cap(PLAIN[s.lang] ?? 'leitura direta da regra')}.` : note}`;
}

/** practice = A,B,C; trial = D,E,F; mastery = G,H; heart = showpieces from `heartMake`. */
function teaching(area: AreaId, seqs: Seq[], heartMake: (r: Rng) => Candidate | null, heartTries: number, lang: string, feature?: (c: Candidate) => string | undefined, open = false, heartMs = Number(process.env.SEQ_MS ?? 120_000) * 2, heartMin = 0): Groups {
  const out: Groups = {};
  const byGroup: Record<string, Seq[]> = { practice: seqs.slice(0, 3), trial: seqs.slice(3, 6), mastery: seqs.slice(6, 8) };
  const diffs: Record<string, [number, number]> = { practice: [3, 5], trial: [5, 7], mastery: [7, 8] };
  for (const [g, list] of Object.entries(byGroup)) {
    const puzzles: PuzzleDef[] = [];
    list.forEach((s, si) => {
      const four = runSeq(area, s, 4, open);
      four.forEach((c, i) => {
        const p = c.p;
        p.id = `${area}.${g}.${puzzles.length + 1}`;
        const [d0, d1] = diffs[g];
        p.difficulty = Math.min(10, d0 + si * 0 + Math.round(((d1 - d0) * i) / 3));
        p.note = seqNote(s, i, 4, c);
        puzzles.push(p);
      });
    });
    if (puzzles.length !== cnt(area, g)) throw new Error(`${area}.${g}: ${puzzles.length} != ${cnt(area, g)}`);
    out[g] = puzzles;
  }
  // hearts: the strongest showpieces
  const r = seeded(area, 'heart');
  const tH = Date.now();
  const poolH = pool(r, () => (Date.now() - tH > heartMs ? null : heartMake(r)), heartTries, 24).filter((c) => open || fair(c, 'heart'));
  // showpieces must be genuinely hard (calibration): prefer the ones with at least `heartMin` insights
  const hardH = poolH.filter((c) => stats(c).steps >= heartMin);
  if (hardH.length < cnt(area, 'heart')) console.warn(`  ${area} hearts: only ${hardH.length} with >= ${heartMin} insights`);
  const picked = hardH.sort((a, b) => showScore(b) - showScore(a)).slice(0, cnt(area, 'heart'));
  for (const c of poolH.filter((x) => !picked.includes(x)).sort((a, b) => stats(b).steps - stats(a).steps)) if (picked.length < cnt(area, 'heart')) picked.push(c);
  const shows = picked.sort((a, b) => stats(a).steps * 10 - stats(a).basicRoot - (stats(b).steps * 10 - stats(b).basicRoot));
  out.heart = finish(shows, area, 'heart', [8, 10], (c, i) => `Obra-prima ${i + 1}/${shows.length}. ${insightNote(c, lang, feature?.(c))}`);
  return out;
}

const gen = (spec: Spec, level: Level) => (r: Rng) => generate(r, { ...spec, fairLook: spec.fairLook ?? LOOK[level] });

// ── teaching areas ────────────────────────────────────

function kinship(): Groups {
  const A: AreaId = 'kinship';
  const K = (w: number, h: number, colors: [number, number], rivets: number, holes = 0.07) => (r: Rng) => generateKinship(r, { w, h, holes, colors, gemsPer: [2, 3], rivets, maxSolsWithCore: 100000 });
  const sameStateFamilies = (c: Candidate) => {
    const fam = new Map<string, number>();
    c.p.cells.forEach((cell, i) => { if (cell.glyph?.kind === 'gem') fam.set((cell.glyph as { color: string }).color, c.sol[i]); });
    const lit = [...fam.values()].filter((v) => v === 1).length;
    return lit >= 2 || fam.size - lit >= 2;
  };
  const feature = (c: Candidate) => `${cap(NF(new Set(c.p.cells.filter((x) => x.glyph?.kind === 'gem').map((x) => (x.glyph as { color: string }).color)).size))} famílias${holesTxt(c.p)}`;
  const S = (key: string, title: string, level: Level, make: Seq['make'], fit: Seq['fit'], tries = 700): Seq => ({ key, title, level, make, fit, tries, lang: 'gem', feature });
  const seqs: Seq[] = [
    S('A', 'quem é luz e quem é sombra', 'practice', K(5, 5, [3, 3], 1), (c) => stats(c).named[0] === 'kin-state'),
    S('B', 'o gargalo entre as gemas', 'practice', K(5, 5, [3, 4], 1), (c) => hasNamed(c, 'kin-cut')),
    S('C', 'duas famílias na mesma luz precisam de um fosso', 'practice', K(5, 5, [3, 4], 1), (c) => sameStateFamilies(c) && hasNamed(c, 'kin-state', 'kin-cut')),
    S('D', 'decidir a cor de cinco famílias', 'trial', K(6, 6, [4, 5], 2), (c) => hasNamed(c, 'kin-state') && stats(c).steps >= 2, 900),
    S('E', 'gargalos em cadeia', 'trial', K(6, 6, [4, 5], 2), (c) => stats(c).named.includes('kin-cut') && stats(c).steps >= 2, 900),
    S('F', 'o rebite decide a família', 'trial', K(6, 6, [4, 5], 2, 0.09), (c) => c.rivets >= 1 && hasNamed(c, 'kin-state', 'kin-cut'), 900),
    S('G', 'cor e caminho ao mesmo tempo', 'heart', K(7, 6, [5, 6], 2), (c) => stats(c).named.length >= 2, 1000),
    S('H', 'seis famílias num bosque apertado', 'heart', K(7, 7, [6, 6], 2), (c) => stats(c).named.length >= 2, 1000),
  ];
  // calibration: openers are the gentlest instance of the sequence's idea (smaller wood, fewer families)
  for (const q of seqs.slice(0, 3)) q.openMake = K(4, 4, [3, 3], 1, 0.03);
  for (const q of seqs.slice(3, 6)) q.openMake = K(5, 5, [3, 4], 2, 0.05);
  return teaching(A, seqs, K(7, 7, [5, 6], 2, 0.06), 900, 'gem', feature, true, undefined, 5);
}

function measure(): Groups {
  const A: AreaId = 'measure';
  const pre = (maxR: number, minRegions: number) => (p: PuzzleDef, s: Uint8Array) => { const st = regionStats(p, s); return st.maxRegion <= maxR && st.regions >= minRegions; };
  const M = (w: number, h: number, maxR: number, minR: number, level: Level) => gen({ w, h, kinds: ['measure'], holes: 0.04, preAccept: pre(maxR, minR), accept: tidy(2) }, level);
  const darkBig = (min: number) => (c: Candidate) => c.p.cells.some((cell, i) => cell.glyph?.kind === 'measure' && !c.sol[i] && (cell.glyph as { n: number }).n >= min);
  const S = (key: string, title: string, level: Level, make: Seq['make'], fit: Seq['fit'], tries = 900): Seq => ({ key, title, level, make, fit, tries, lang: 'measure', feature: measureFeature });
  const seqs: Seq[] = [
    S('A', 'a região incompleta só tem uma saída', 'practice', M(5, 5, 9, 6, 'practice'), (c) => stats(c).named[0] === 'measure-exit'),
    S('B', 'a escuridão também é uma região — e o número a mede', 'practice', M(5, 5, 11, 5, 'practice'), (c) => darkBig(5)(c)),
    S('C', 'o espaço que sobra é exatamente o pedido', 'practice', M(5, 5, 10, 5, 'practice'), (c) => hasNamed(c, 'measure-fill')),
    S('D', 'um número que não cabe na luz mora na sombra', 'trial', M(6, 6, 12, 8, 'trial'), (c) => hasNamed(c, 'measure-room'), 1300),
    S('E', 'o fundo escuro inteiro em um só número', 'trial', M(6, 6, 16, 7, 'trial'), (c) => darkBig(9)(c) && stats(c).steps >= 2, 1300),
    S('F', '"e se?": imagine a região maior', 'trial', M(6, 6, 12, 8, 'trial'), (c) => looks(c) >= 2, 1300),
    S('G', 'saídas e espaços exatos encadeados', 'heart', M(7, 7, 15, 11, 'heart'), (c) => hasNamed(c, 'measure-exit') && hasNamed(c, 'measure-fill'), 1300),
    S('H', 'tudo junto: luz, sombra e números que não cabem', 'heart', M(7, 7, 15, 11, 'heart'), (c) => stats(c).named.length >= 3 || (stats(c).named.length >= 2 && looks(c) >= 1), 1300),
  ];
  // calibration: openers are the gentlest instance of the sequence's idea (a smaller board)
  [M(4, 4, 8, 4, 'practice'), M(4, 4, 11, 3, 'practice'), M(4, 4, 10, 3, 'practice'), M(4, 4, 9, 3, 'trial'), M(5, 5, 14, 4, 'trial'), M(5, 5, 10, 5, 'trial'), M(6, 6, 12, 8, 'heart'), M(6, 6, 12, 8, 'heart')]
    .forEach((mk, i) => (seqs[i].openMake = mk));
  return teaching(A, seqs, M(7, 7, 15, 11, 'heart'), 1500, 'measure', measureFeature, false, undefined, 10);
}

function mold(): Groups {
  const A: AreaId = 'mold';
  const acc = (minMolds: number, needFree: boolean, maxR: number) => (p: PuzzleDef, s: Uint8Array) => {
    const molds = p.cells.filter((x) => x.glyph?.kind === 'mold');
    if (molds.length < minMolds) return false;
    if (needFree && !molds.some((x) => (x.glyph as { free?: boolean }).free)) return false;
    return regionStats(p, s).maxRegion <= maxR && tidy(1)(p, s);
  };
  const F = (w: number, h: number, maxMold: number, freeP: number, minMolds: number, needFree: boolean, maxR: number, level: Level) =>
    gen({ w, h, kinds: ['mold'], maxMold, freeMoldP: freeP, holes: 0.03, accept: acc(minMolds, needFree, maxR) }, level);
  const darkMold = (c: Candidate) => c.p.cells.some((cell, i) => cell.glyph?.kind === 'mold' && !c.sol[i]);
  const S = (key: string, title: string, level: Level, make: Seq['make'], fit: Seq['fit'], tries = 1000): Seq => ({ key, title, level, make, fit, tries, lang: 'mold', feature: moldFeature });
  const seqs: Seq[] = [
    S('A', 'só existe um encaixe', 'practice', F(5, 5, 4, 0, 3, false, 12, 'practice'), (c) => hasNamed(c, 'mold-place')),
    S('B', 'a forma esculpida na sombra', 'practice', F(5, 5, 4, 0, 3, false, 12, 'practice'), (c) => darkMold(c) && stats(c).steps >= 1),
    S('C', 'a peça incompleta só tem uma saída', 'practice', F(5, 5, 4, 0, 3, false, 12, 'practice'), (c) => hasNamed(c, 'mold-exit')),
    S('D', 'o anel deixa girar — mas só um giro cabe', 'trial', F(6, 5, 5, 0.4, 3, true, 14, 'trial'), (c) => hasNamed(c, 'mold-place'), 1400),
    S('E', 'na luz o molde não cabe', 'trial', F(6, 5, 5, 0.3, 3, false, 14, 'trial'), (c) => hasNamed(c, 'mold-room'), 1400),
    S('F', 'um encaixe decide o outro', 'trial', F(6, 6, 5, 0.3, 3, false, 14, 'trial'), (c) => stats(c).steps >= 3 && stats(c).named.length >= 2, 1400),
    S('G', 'pentominós que giram, na luz e na sombra', 'heart', F(6, 6, 5, 0.4, 4, true, 16, 'heart'), (c) => stats(c).named.length >= 2, 1400),
    S('H', 'a pedreira inteira: encaixe por exclusão', 'heart', F(7, 6, 5, 0.25, 4, false, 16, 'heart'), (c) => stats(c).named.length >= 2 && stats(c).basicRoot <= 0.5, 1400),
  ];
  // calibration: openers are the gentlest instance of the sequence's idea (a smaller quarry)
  [F(4, 4, 4, 0, 2, false, 10, 'practice'), F(4, 4, 4, 0, 2, false, 10, 'practice'), F(4, 4, 4, 0, 2, false, 10, 'practice'),
    F(5, 5, 4, 0.4, 3, true, 12, 'trial'), F(5, 5, 4, 0.3, 3, false, 12, 'trial'), F(5, 5, 5, 0.3, 3, false, 12, 'trial'),
    F(6, 5, 5, 0.4, 3, true, 14, 'heart'), F(6, 5, 5, 0.25, 4, false, 14, 'heart')].forEach((mk, i) => (seqs[i].openMake = mk));
  return teaching(A, seqs, F(7, 7, 5, 0.3, 5, false, 18, 'heart'), 1500, 'mold', moldFeature, false, undefined, 7);
}

function contour(): Groups {
  const A: AreaId = 'contour';
  const acc = (maxFrac: number) => (p: PuzzleDef) => count(p, 'contour') <= freeCount(p) * maxFrac;
  const C = (w: number, h: number, holes: number, maxFrac: number, level: Level) => gen({ w, h, kinds: ['contour'], holes, accept: acc(maxFrac) }, level);
  const vals = (c: Candidate) => c.p.cells.filter((x) => x.glyph?.kind === 'contour').map((x) => (x.glyph as { n: number }).n);
  const border = (c: Candidate) => {
    const tiles = c.p.cells.map((x, i) => (x.glyph?.kind === 'contour' ? i : -1)).filter((i) => i >= 0);
    const on = tiles.filter((i) => { const r = Math.floor(i / c.p.w), q = i % c.p.w; return r === 0 || q === 0 || r === c.p.h - 1 || q === c.p.w - 1; });
    return tiles.length ? on.length / tiles.length : 0;
  };
  const feature = (c: Candidate) => {
    const v = vals(c);
    return v.includes(4) && v.includes(0) ? 'Uma ilha de quatro lados e zeros que copiam os vizinhos' : v.includes(4) ? 'Uma ilha de quatro lados' : v.includes(0) ? 'Zeros que copiam os vizinhos' : 'Fora do painel é escuro';
  };
  const S = (key: string, title: string, level: Level, make: Seq['make'], fit: Seq['fit'], tries = 900): Seq => ({ key, title, level, make, fit, tries, lang: 'contour', feature });
  const seqs: Seq[] = [
    S('A', 'o zero copia todos os vizinhos', 'practice', C(5, 5, 0.02, 0.6, 'practice'), (c) => vals(c).filter((v) => v === 0).length >= 2 && stats(c).steps >= 1),
    S('B', 'o quatro é uma ilha', 'practice', C(5, 5, 0.02, 0.6, 'practice'), (c) => vals(c).includes(4) && stats(c).steps >= 1),
    S('C', 'fora do painel é escuro', 'practice', C(5, 5, 0, 0.6, 'practice'), (c) => border(c) >= 0.6 && stats(c).steps >= 1),
    S('D', '"e se?" de um passo', 'trial', C(6, 6, 0.02, 0.5, 'trial'), (c) => looks(c) >= 2),
    S('E', 'pistas esparsas: cada borda conta', 'trial', C(6, 6, 0.02, 0.36, 'trial'), (c) => stats(c).steps >= 2, 1200),
    S('F', 'rochas contam como escuro', 'trial', C(6, 6, 0.1, 0.5, 'trial'), (c) => c.p.cells.filter((x) => x.hole).length >= 2 && stats(c).steps >= 2, 1200),
    S('G', 'correntes longas de deduções', 'heart', C(7, 7, 0.02, 0.42, 'heart'), (c) => looks(c) >= 3 && stats(c).basicRoot <= 0.4, 1200),
    S('H', 'o jardim inteiro com poucas placas', 'heart', C(8, 7, 0.02, 0.38, 'heart'), (c) => looks(c) >= 3, 1200),
  ];
  return teaching(A, seqs, C(8, 8, 0.02, 0.4, 'heart'), 1200, 'contour', feature);
}

function mosaic(): Groups {
  const A: AreaId = 'mosaic';
  const acc = (maxFrac: number) => (p: PuzzleDef) => count(p, 'mosaic') <= freeCount(p) * maxFrac;
  const sym = (axis: 'v' | 'rot'): Spec['state'] => (r, p) => {
    const s = new Uint8Array(p.w * p.h);
    for (let rr = 0; rr < p.h; rr++) for (let c = 0; c < p.w; c++) {
      const i = rr * p.w + c;
      const m = axis === 'v' ? rr * p.w + (p.w - 1 - c) : (p.h - 1 - rr) * p.w + (p.w - 1 - c);
      s[i] = m < i ? s[m] : r.chance(0.5) ? 1 : 0;
    }
    return s;
  };
  const X = (w: number, h: number, maxFrac: number, level: Level, axis?: 'v' | 'rot') => gen({ w, h, kinds: ['mosaic'], accept: acc(maxFrac), ...(axis ? { state: sym(axis) } : {}) }, level);
  const extremes = (c: Candidate) => c.p.cells.some((x) => x.glyph?.kind === 'mosaic' && ((x.glyph as { n: number }).n === 0 || (x.glyph as { n: number }).n >= 8));
  const pairs = (c: Candidate) => stats(c).steps && c.ip!.steps.filter((s) => s.tag === 'mosaic-pair').length;
  const feature = (c: Candidate) => `Um ornamento ${c.p.w}×${c.p.h} com ${count(c.p, 'mosaic')} janelas`;
  const S = (key: string, title: string, level: Level, make: Seq['make'], fit: Seq['fit'], tries = 900): Seq => ({ key, title, level, make, fit, tries, lang: 'mosaic', feature });
  const seqs: Seq[] = [
    S('A', 'janelas de canto e de borda são menores', 'practice', X(5, 5, 0.5, 'practice'), (c) => stats(c).basicRoot >= 0.5 && stats(c).steps >= 1),
    S('B', 'zeros apagam, cheios acendem', 'practice', X(6, 5, 0.45, 'practice'), (c) => extremes(c) && stats(c).steps >= 1),
    S('C', 'duas janelas vizinhas: a diferença é uma faixa', 'practice', X(6, 5, 0.45, 'practice'), (c) => hasNamed(c, 'mosaic-pair')),
    S('D', 'subtrações em cadeia', 'trial', X(7, 6, 0.4, 'trial'), (c) => (pairs(c) as number) >= 3),
    S('E', 'o ornamento simétrico', 'trial', X(7, 7, 0.4, 'trial', 'v'), (c) => hasNamed(c, 'mosaic-pair') && stats(c).steps >= 2),
    S('F', '"e se?": uma janela passaria da conta', 'trial', X(7, 7, 0.38, 'trial'), (c) => looks(c) >= 1 && hasNamed(c, 'mosaic-pair'), 1100),
    S('G', 'a rosácea girada', 'heart', X(8, 8, 0.36, 'heart', 'rot'), (c) => (pairs(c) as number) >= 4 && stats(c).basicRoot <= 0.5, 1000),
    S('H', 'o grande piso do templo', 'heart', X(9, 9, 0.34, 'heart', 'v'), (c) => (pairs(c) as number) >= 4, 1000),
  ];
  return teaching(A, seqs, X(8, 8, 0.36, 'heart', 'rot'), 900, 'mosaic', feature, false, 420_000);
}

function beacon(): Groups {
  const A: AreaId = 'beacon';
  const B = (w: number, h: number, beacons: [number, number], holes: number, level: Level, rivets = 1) => gen({ w, h, kinds: ['beacon'], beacons, holes, rivets }, level);
  const seesEach = (c: Candidate) => !!beaconFeature(c);
  const crossing = (c: Candidate) => {
    const g = geometryOf(c.p);
    const bs = c.p.cells.map((cell, i) => (cell.glyph?.kind === 'beacon' ? i : -1)).filter((i) => i >= 0);
    const seenBy = new Map<number, number>();
    for (const b of bs) for (const t of beaconSight(g, c.sol, b)) if (t !== b) seenBy.set(t, (seenBy.get(t) ?? 0) + 1);
    return [...seenBy.values()].some((v) => v >= 2);
  };
  const feature = (c: Candidate) => beaconFeature(c) ?? `${cap(N(count(c.p, 'beacon')))} faróis${holesTxt(c.p)}`;
  const S = (key: string, title: string, level: Level, make: Seq['make'], fit: Seq['fit'], tries = 3000): Seq => ({ key, title, level, make, fit, tries, lang: 'beacon', feature });
  const seqs: Seq[] = [
    S('A', 'toda luz precisa de uma fonte', 'practice', B(5, 5, [2, 3], 0.04, 'practice', 0), (c) => stats(c).basicRoot >= 0.4),
    S('B', 'faróis que se enxergam', 'practice', B(5, 5, [2, 3], 0.04, 'practice', 0), (c) => seesEach(c) && stats(c).steps >= 1, 6000),
    S('C', 'as rochas cortam o feixe', 'practice', B(5, 5, [2, 3], 0.14, 'practice', 0), (c) => c.p.cells.filter((x) => x.hole).length >= 2 && stats(c).steps >= 1, 6000),
    S('D', 'só um farol alcança aquela luz', 'trial', B(6, 6, [3, 4], 0.06, 'trial'), (c) => hasNamed(c, 'beacon-single'), 5000),
    S('E', 'feixes que se cruzam contam para os dois', 'trial', B(6, 6, [3, 4], 0.06, 'trial'), (c) => crossing(c) && stats(c).steps >= 1, 5000),
    S('F', '"e se?": um farol veria demais', 'trial', B(6, 6, [3, 4], 0.08, 'trial'), (c) => looks(c) >= 1, 5000),
    // calibration: mastery and showpieces need at least three real insights (rivets pin the coast down
    // without deciding it, so the counting has to travel between beacons)
    S('G', 'a costa inteira: fontes, cruzamentos e rochas', 'heart', B(7, 7, [4, 6], 0.06, 'heart', 3), (c) => stats(c).steps >= 3 && crossing(c) && stats(c).basicRoot <= 0.8, 9000),
    S('H', 'faróis que dependem uns dos outros', 'heart', B(7, 7, [5, 6], 0.04, 'heart', 3), (c) => seesEach(c) && stats(c).steps >= 3, 9000),
  ];
  const heartB = B(7, 7, [5, 6], 0.05, 'heart', 3);
  const SEQ = Number(process.env.SEQ_MS ?? 120_000);
  return teaching(A, seqs, (r) => { const c = heartB(r); return c && stats(c).steps >= 4 ? c : null; }, 20000, 'beacon', feature, false, SEQ * 6, 4);
}

/** Weave pictures hardened by tools/harden-weave.ts (a few threads removed, at most a few outline
 *  pixels moved) so that they need real cross-line reasoning ("e se?"). */
const HARD_PATH = join(root, 'tools/data/weave-hard.json');
const HARD: Record<string, { looks: number; flips: number; pruned: number; pic: string[]; compact: Record<string, unknown> }> = existsSync(HARD_PATH) ? JSON.parse(readFileSync(HARD_PATH, 'utf8')) : {};
function hardPic(name: string, minLooks: number): Candidate {
  const h = HARD[`${name}@${minLooks}`];
  if (!h) throw new Error(`weave: no hardened ${name}@${minLooks} in tools/data/weave-hard.json (run tools/harden-weave.ts)`);
  const p = puzzle('w', h.compact as never);
  const res = solve(p, { maxSolutions: 2, maxNodes: 400000 });
  if (res.solutions.length !== 1) throw new Error(`hardened picture ${name} not unique`);
  const missing = (p.rowClues ?? []).filter((x) => x === null).length + (p.colClues ?? []).filter((x) => x === null).length;
  const c: Candidate = { p, sol: res.solutions[0], glyphs: 0, rivets: 0, nodes: res.nodes, simple: res.propagationOnly, sols: 1, score: 0 };
  const lk = stats(c).looks;
  const bits = [PICTURES[name].note.replace(/\.$/, '')];
  if (missing) bits.push(missing === 1 ? 'uma linha ficou sem fio: ela se lê pelas que a cruzam' : `${NF(missing)} linhas ficaram sem fio: elas se leem pelas que as cruzam`);
  bits.push(`Ahá: ${lk === 1 ? 'um "e se?"' : `${N(lk)} "e se?"`} — imagine a sequência ali: o fio cruzado não fecharia`);
  p.note = bits.join('; ') + '.';
  return c;
}

function weave(): Groups {
  const A: AreaId = 'weave';
  const tapestry = (w: number, h: number, holes: number, level: Level) => (r: Rng) => {
    const symState: Spec['state'] = (rr, p) => {
      const s = new Uint8Array(p.w * p.h);
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const i = y * p.w + x;
        const m = y * p.w + (p.w - 1 - x);
        s[i] = p.cells[i].hole ? 0 : m < i ? s[m] : rr.chance(0.55) ? 1 : 0;
      }
      return s;
    };
    return generate(r, { w, h, kinds: ['weave'], holes, fullWeave: true, state: symState, fairLook: LOOK[level] });
  };
  const gentleW = (c: Candidate) => stats(c).steps * 10 - stats(c).basicRoot;
  const pics = (names: string[], title: string, key: string, extra = ''): PuzzleDef[] =>
    weaveSet(names).map((c, i) => { c.p.note = `seq ${key}${i + 1}/4 — ${title}. ${c.p.note}${extra}`; return c.p; });
  const hardPics = (list: [string, number][], title: string, key: string): PuzzleDef[] =>
    list.map(([name, min]) => hardPic(name, min)).sort((a, b) => gentleW(a) - gentleW(b))
      .map((c, i) => { c.p.note = `seq ${key}${i + 1}/4 — ${title}. ${c.p.note}`; return c.p; });
  const symmetric = 'As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro';
  const tap = (key: string, title: string, w: number, h: number, holes: number, level: Level, fit: (c: Candidate) => boolean, tries = 900): PuzzleDef[] => {
    const s: Seq = { key, title, level, make: tapestry(w, h, holes, level), fit, tries, lang: 'weave', feature: () => symmetric };
    return runSeq(A, s).map((c, i) => { c.p.note = seqNote(s, i, 4, c); return c.p; });
  };
  const ids = (list: PuzzleDef[], g: string, diff: [number, number]) => list.map((p, i) => { p.id = `${A}.${g}.${i + 1}`; p.difficulty = Math.round(diff[0] + ((diff[1] - diff[0]) * (i % 4)) / 3); return p; });
  // calibration: trial pictures need 1–3 cross-line contradictions, mastery tapestries at least two
  // (or one on a board a beginner cannot start), showpieces three or more
  const hearts = (['sun', 'pine', 'fox', 'windmill', 'island', 'emblem'] as const).map((n) => hardPic(n, 3)).sort((a, b) => gentleW(a) - gentleW(b));
  return {
    practice: ids([
      ...pics(['leaf', 'mushroom', 'sailboat', 'anchor'], 'a sequência mais longa de uma linha cobre o meio dela', 'A'),
      ...pics(['fish', 'butterfly', 'bird', 'house'], 'sequências separadas: sempre um escuro entre elas', 'B'),
      ...tap('C', 'tapeçarias simétricas', 6, 6, 0, 'practice', (c) => stats(c).basicRoot >= 0.6),
    ], 'practice', [3, 5]),
    trial: ids([
      ...hardPics([['bell', 1], ['lighthouse', 1], ['flower', 1], ['turtle', 1]], 'fios partidos: a sequência não atravessa o buraco', 'D'),
      ...hardPics(WEAVE_E, 'fios partidos em desenhos maiores', 'E'),
      ...tap('F', '"e se?": a sequência ali não fecharia', 8, 8, 0, 'trial', (c) => looks(c) >= 1, 1200),
    ], 'trial', [5, 7]),
    mastery: ids([
      ...tap('G', 'tapeçarias partidas', 9, 9, 0.05, 'heart', (c) => looks(c) >= 2 || (looks(c) >= 1 && stats(c).basicRoot < 0.8), 1600),
      ...tap('H', 'o grande tear: deduções cruzadas', 10, 10, 0, 'heart', (c) => looks(c) >= 2, 1600),
    ], 'mastery', [7, 8]),
    heart: finish(hearts, A, 'heart', [8, 10], (c, i) => `Obra-prima ${i + 1}/6. ${c.p.note!}`),
  };
}
/** trial E pictures (bigger drawings with broken threads) */
const WEAVE_E: [string, number][] = (process.env.WEAVE_E ?? 'tree:1,owl:1,castle:1,snail:1').split(',').map((x) => { const [n, l] = x.split(':'); return [n, Number(l)]; });

function twins(): Groups {
  const A: AreaId = 'twins';
  const P = (ps: PondSpec) => (r: Rng) => generatePond(r, ps);
  const pairsOf = (c: Candidate) => count(c.p, 'twin') / 2;
  const diffStates = (c: Candidate) => /luz copia a sombra/.test(twinFeature(c) ?? '');
  const mirrored = (c: Candidate) => c.p.cells.some((x) => x.glyph?.kind === 'twin' && (x.glyph as { mirror?: boolean }).mirror);
  const partial = (c: Candidate) => {
    const water = c.p.cells.findIndex((y) => y.hole) % c.p.w;
    return c.p.cells.some((x, i) => i % c.p.w < water && !x.hole && x.lock === undefined);
  };
  // every pond puzzle has a forced core (generatePond checks that all solutions share the twin regions):
  // the copy only fits in one place. Notes name that plus the panel's twist.
  const twNote = (c: Candidate) => {
    const bits = ['Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra'];
    if (partial(c)) bits.push('o modelo não está todo travado: a forma também se deduz pelos dois lados');
    if (mirrored(c)) bits.push('o símbolo espelhado inverte a forma');
    if (diffStates(c)) bits.push('a luz pode copiar a sombra');
    return `${twinFeature(c) ?? `${cap(N(pairsOf(c)))} pares atravessam o lago`}. ${bits.join('; ')}.`;
  };
  const S = (key: string, title: string, level: Level, ps: PondSpec, fit: Seq['fit'], tries = 900): Seq => ({ key, title, level, make: P(ps), fit, tries, lang: 'twin' });
  const base: PondSpec = { h: 4, left: 3, right: 3, pairs: 2, sizes: [2, 4], mirrorP: 0, dropRivets: 0, darkP: 0.3, holes: 0.03 };
  const seqs: Seq[] = [
    S('A', 'a cópia só cabe num lugar', 'practice', { ...base }, (c) => !mirrored(c)),
    S('B', 'a luz pode copiar a sombra', 'practice', { ...base, darkP: 0.6 }, (c) => diffStates(c)),
    S('C', 'o espelho inverte a forma', 'practice', { ...base, mirrorP: 0.8 }, (c) => mirrored(c)),
    S('D', 'três cópias que precisam caber juntas', 'trial', { ...base, h: 5, right: 4, pairs: 3 }, (c) => pairsOf(c) === 3, 1100),
    S('E', 'o modelo incompleto: a forma também se deduz', 'trial', { ...base, h: 5, right: 4, pairs: 2, dropRivets: 0.4 }, (c) => partial(c), 1100),
    S('F', 'espelhos e sombras atravessando o lago', 'trial', { ...base, h: 5, right: 4, pairs: 3, mirrorP: 0.6, darkP: 0.5 }, (c) => mirrored(c) && pairsOf(c) === 3, 1100),
    // calibration: mastery panels must need several real placements the model can follow (>= 3 insights)
    S('G', 'modelos incompletos e espelhados', 'heart', { h: 6, left: 4, right: 4, pairs: 3, sizes: [3, 5], mirrorP: 0.5, dropRivets: 0.25, darkP: 0.4, holes: 0.03 }, (c) => partial(c) && mirrored(c) && stats(c).steps >= 3, 1600),
    S('H', 'o lago inteiro: quatro pares', 'heart', { h: 6, left: 4, right: 5, pairs: 4, sizes: [2, 4], mirrorP: 0.4, dropRivets: 0.15, darkP: 0.4, holes: 0.03 }, (c) => pairsOf(c) === 4 && stats(c).steps >= 4, 1600),
  ];
  // calibration: openers are the gentlest instance of the sequence's idea (a narrower lake, smaller shapes)
  const small: PondSpec = { ...base, left: 2, right: 3, sizes: [2, 3] };
  ([{ ...small }, { ...small, darkP: 0.6 }, { ...small, mirrorP: 0.8 }, { ...small, right: 4, pairs: 3 }, { ...small, right: 4, dropRivets: 0.3 }, { ...small, right: 4, pairs: 3, mirrorP: 0.6, darkP: 0.5 },
    { h: 5, left: 3, right: 4, pairs: 3, sizes: [2, 4], mirrorP: 0.5, dropRivets: 0.25, darkP: 0.4, holes: 0.03 }, { h: 5, left: 3, right: 5, pairs: 4, sizes: [2, 3], mirrorP: 0.4, dropRivets: 0.1, darkP: 0.4, holes: 0.03 }] as PondSpec[])
    .forEach((ps, i) => (seqs[i].openMake = P(ps)));
  const out: Groups = {};
  const byGroup: Record<string, Seq[]> = { practice: seqs.slice(0, 3), trial: seqs.slice(3, 6), mastery: seqs.slice(6, 8) };
  const diffs: Record<string, [number, number]> = { practice: [3, 5], trial: [5, 7], mastery: [7, 8] };
  for (const [g, list] of Object.entries(byGroup)) {
    const puzzles: PuzzleDef[] = [];
    for (const s of list) {
      runSeq(A, s, 4, true).forEach((c, i) => {
        const p = c.p;
        p.id = `${A}.${g}.${puzzles.length + 1}`;
        p.difficulty = Math.round(diffs[g][0] + ((diffs[g][1] - diffs[g][0]) * i) / 3);
        p.note = `seq ${s.key}${i + 1}/4 — ${s.title}. ${twNote(c)}`;
        puzzles.push(p);
      });
    }
    out[g] = puzzles;
  }
  const r = seeded(A, 'heart');
  // showpieces: big lakes whose copies the model can actually follow (>= 5 insights), hardest last
  const tH = Date.now();
  const heartMs = Number(process.env.SEQ_MS ?? 120_000) * 4;
  const hp = pool(r, () => {
    if (Date.now() - tH > heartMs) return null;
    const c = generatePond(r, { h: 6, left: 4, right: 5, pairs: 3 + r.int(2), sizes: [3, 5], mirrorP: 0.5, dropRivets: 0.2, darkP: 0.4, holes: 0.02 });
    return c && stats(c).steps >= 5 ? c : null;
  }, 6000, 18);
  if (hp.length < cnt(A, 'heart')) throw new Error(`twins hearts: only ${hp.length}`);
  const shows = hp.sort((x, y) => showScore(y) + stats(y).steps * 0.5 - showScore(x) - stats(x).steps * 0.5).slice(0, cnt(A, 'heart')).sort((x, y) => stats(x).steps - stats(y).steps);
  out.heart = finish(shows, A, 'heart', [8, 10], (c, i) => `Obra-prima ${i + 1}/${shows.length}. ${twNote(c)}`);
  return out;
}

// ── late areas ────────────────────────────────────────

function echo(): Groups {
  const A: AreaId = 'echo';
  const plate = (w: number, h: number, dirs: number[], p: number, mute: number, presses: [number, number]): Spec => ({ w, h, kinds: [], echo: { p, dirs: echoDirs(dirs), mute, plate: true, presses } });
  const accPlate = (p: PuzzleDef) => (p.target ?? '').split('').filter((x) => x === '1').length >= 3;
  const plates = (key: string, title: string, spec: Spec, n: number, why: (mutes: number) => string): PuzzleDef[] => {
    const list = poolSpec(seeded(A, key), { ...spec, accept: accPlate }, 500, n * 3).slice(0, n * 3);
    list.sort((a, b) => (a.p.target!.split('1').length) - (b.p.target!.split('1').length));
    const pick = [0, Math.floor(list.length / 2), list.length - 1].slice(0, n).map((i) => list[i]);
    return pick.map((c, i) => {
      const mutes = c.p.cells.filter((x) => x.mute).length;
      c.p.note = `seq ${key}${i + 1}/${n} — ${title}. Ahá: ${why(mutes)}.`;
      return c.p;
    });
  };
  const combo = (kinds: Kind[], w: number, h: number, extra: Partial<Spec> = {}): Spec => ({ w, h, kinds, keep: keepOf(kinds), echo: { p: 0.45, dirs: echoDirs([0, 1, 2, 3, 6, 7]), mute: 0.3, presses: [4, 9] }, maxMold: 5, gemColors: 2, ...extra });
  const comboSeq = (key: string, title: string, kinds: Kind[], sizes: [number, number][], level: Level): PuzzleDef[] =>
    sizes.map(([w, h], i) => {
      const c = slot(A, `${key}-${i}`, level, combo(kinds, w, h), 700, hasAll(kinds), kinds.length > 1 ? 1 : 0)[0];
      c.p.note = `seq ${key}${i + 1}/${sizes.length} — ${title}. ${insightNote(c, 'default', `Eco + ${kinds.map((k) => LANG[k]).join(' + ')}`)}`;
      return c.p;
    });
  const ids = (list: PuzzleDef[], g: string, diff: [number, number]) => list.map((p, i) => { p.id = `${A}.${g}.${i + 1}`; p.difficulty = Math.round(diff[0] + ((diff[1] - diff[0]) * i) / Math.max(1, list.length - 1)); return p; });
  const heartCombos: [Kind[], number, number][] = [[['contour', 'mosaic'], 6, 6], [['measure', 'mold'], 6, 6], [['gem', 'contour'], 6, 6], [['mosaic', 'measure'], 7, 6], [['gem', 'contour', 'weave'], 7, 7]];
  return {
    practice: ids([
      ...plates('A', 'toques que se somam', plate(4, 4, [0, 1, 2], 0.7, 0, [3, 5]), 3, () => 'tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez'),
      ...plates('B', 'cristais mudos', plate(4, 4, [0, 1, 2, 3], 0.75, 0.2, [3, 5]), 3, (m) => (m === 1 ? 'o cristal mudo só muda pela soma das ressonâncias dos vizinhos' : 'os cristais mudos só mudam pela soma das ressonâncias dos vizinhos')),
      ...plates('C', 'ecos longos de linha e coluna', plate(5, 5, [0, 4, 5], 0.5, 0.1, [4, 7]), 3, () => 'um toque vira a linha inteira — comece pelas linhas que só um cristal alcança'),
    ], 'practice', [5, 6]),
    trial: ids([
      ...comboSeq('D', 'eco + Medida: o tamanho pedido tem de ser alcançável', ['measure'], [[5, 5], [5, 5], [6, 5]], 'trial'),
      ...comboSeq('E', 'eco + Contorno: bordas que os ecos conseguem desenhar', ['contour'], [[5, 5], [5, 5], [6, 5]], 'trial'),
      ...comboSeq('F', 'eco + Mosaico: janelas alcançáveis', ['mosaic'], [[5, 5], [5, 5], [6, 5]], 'trial'),
    ], 'trial', [7, 8]),
    heart: ids(heartCombos.map(([kinds, w, h], i) => {
      const c = slot(A, `heart-${i}`, 'heart', combo(kinds, w, h), 900, hasAll(kinds), 1)[0];
      c.p.note = `Obra-prima ${i + 1}/${heartCombos.length}. ${insightNote(c, 'default', `Eco + ${kinds.map((k) => LANG[k]).join(' + ')}: a resposta precisa obedecer às regras e ser alcançável pelos ecos`)}`;
      return c.p;
    }), 'heart', [9, 10]),
  };
}

function citadel(): Groups {
  const A: AreaId = 'citadel';
  const S = (kinds: Kind[], w: number, h: number, extra: Partial<Spec> = {}): Spec => ({ w, h, kinds, holes: 0.03, maxMold: 5, keep: keepOf(kinds), gemColors: 3, twinPairs: 1, beacons: [2, 3], freeMoldP: 0.25, ...extra });
  const ech = (dirs: number[], mute = 0.3): Partial<Spec> => ({ echo: { p: 0.45, dirs: echoDirs(dirs), mute, presses: [5, 9] } });
  const note = (c: Candidate) => insightNote(c, 'default', `Sem tutorial — ${langs(c.p)}: o que uma linguagem decide, a outra aproveita`);
  const run = (g: string, list: [Kind[], number, number, Level, Partial<Spec>?, number?][]) => {
    const cands = list.map(([kinds, w, h, level, extra, minNamed], i) => slot(A, `${g}-${i}`, level, S(kinds, w, h, extra ?? {}), kinds.includes('twin') ? 2500 : 900, all(hasAll(kinds), tidy(2)), minNamed ?? (kinds.length >= 3 ? 2 : 1))[0]);
    return finish(cands.sort((a, b) => showScore(a) - showScore(b)), A, g, g === 'gate' ? [6, 7] : g === 'court' ? [7, 8] : g === 'halls' ? [8, 9] : [9, 10], note);
  };
  const LISTS: Record<string, [Kind[], number, number, Level, Partial<Spec>?, number?][]> = {
    gate: [
      [['gem', 'measure'], 5, 5, 'trial'], [['contour', 'mosaic'], 5, 5, 'trial', {}, 0], [['mold', 'twin'], 5, 5, 'trial'],
      [['weave', 'beacon'], 5, 5, 'trial', {}, 0], [['measure', 'mold'], 5, 5, 'trial'], [['gem', 'contour'], 5, 5, 'trial'],
    ],
    court: [
      [['measure', 'contour'], 6, 6, 'trial'], [['gem', 'mold'], 6, 6, 'trial'], [['mosaic', 'beacon'], 6, 6, 'trial'],
      [['twin', 'measure'], 6, 6, 'trial'], [['weave', 'gem'], 6, 6, 'trial'], [['contour', 'twin'], 6, 6, 'trial'],
      [['mold', 'mosaic'], 6, 6, 'trial'], [['beacon', 'measure'], 6, 6, 'trial'], [['gem', 'mosaic'], 6, 6, 'trial'], [['weave', 'mold'], 6, 6, 'trial'],
    ],
    halls: [
      [['measure', 'contour', 'gem'], 6, 6, 'heart'], [['mold', 'mosaic', 'gem'], 6, 6, 'heart'], [['beacon', 'weave', 'contour'], 6, 6, 'heart', {}, 0],
      [['twin', 'measure', 'mosaic'], 6, 6, 'heart', {}, 1], [['gem', 'contour', 'mosaic'], 7, 6, 'heart'], [['mold', 'contour', 'weave'], 7, 6, 'heart'],
      [['beacon', 'measure', 'gem'], 7, 6, 'heart'], [['twin', 'mold', 'contour'], 7, 7, 'heart', {}, 1], [['weave', 'measure', 'mosaic'], 7, 7, 'heart'],
      [['beacon', 'mold', 'gem'], 7, 7, 'heart'], [['twin', 'gem', 'measure'], 7, 7, 'heart', {}, 1], [['contour', 'mosaic', 'measure'], 7, 7, 'heart'],
      [['weave', 'twin', 'gem'], 7, 7, 'heart', {}, 1], [['beacon', 'contour', 'mosaic'], 7, 7, 'heart'],
    ],
    crown: [
      [['measure', 'contour', 'gem'], 7, 6, 'heart', ech([0, 1, 2, 3])], [['gem', 'mosaic'], 6, 6, 'heart', ech([0, 1, 2, 3])],
      [['weave', 'measure', 'gem'], 7, 7, 'heart', ech([1, 2, 6, 7])], [['mold', 'contour', 'gem'], 7, 6, 'heart', ech([0, 1, 2])],
      [['mosaic', 'measure', 'contour'], 7, 6, 'heart', ech([0, 1, 2, 3], 0.25)], [['twin', 'measure', 'mosaic'], 7, 7, 'heart', ech([0, 3], 0), 1],
      [['beacon', 'contour', 'gem'], 7, 7, 'heart', ech([0, 1, 2], 0.08)], [['mold', 'weave', 'contour', 'gem'], 7, 7, 'heart', ech([0, 1, 2, 3], 0.25)],
      [['twin', 'mold', 'measure', 'gem'], 7, 7, 'heart', ech([0, 3], 0), 1], [['beacon', 'mosaic', 'measure', 'gem'], 7, 7, 'heart', ech([0, 1, 2], 0.08)],
    ],
  };
  const patch = process.env.PATCH;
  if (!patch) return Object.fromEntries(Object.entries(LISTS).map(([g, l]) => [g, run(g, l)]));
  // PATCH=crown.3=6,...: regenerate single panels in place from slot <index> of their group, asking for
  // at least MIN_STEPS insights (calibration), and keep every other panel exactly as it is.
  const groups: Groups = JSON.parse(JSON.stringify(citadelExisting));
  for (const item of patch.split(',')) {
    const [target, idx] = item.split('=');
    const [g, n] = target.split('.');
    const [kinds, w, h, level, extra, minNamed] = LISTS[g][Number(idx)];
    const minSteps = Number(process.env.MIN_STEPS ?? 3);
    const c = slot(A, `${g}-${idx}-cal`, level, S(kinds, w, h, extra ?? {}), Number(process.env.TRIES ?? (kinds.includes('twin') ? 2500 : 1600)), all(hasAll(kinds), tidy(2)), minNamed ?? (kinds.length >= 3 ? 2 : 1), minSteps)[0];
    if (stats(c).steps < minSteps) throw new Error(`patch ${target}: best candidate has only ${stats(c).steps} insights`);
    const old = groups[g][Number(n) - 1];
    c.p.id = old.id;
    c.p.difficulty = old.difficulty;
    c.p.note = note(c);
    groups[g][Number(n) - 1] = c.p;
    console.log(`patched ${old.id}: ${stats(c).steps} insights (${langs(c.p)})`);
  }
  return groups;
}

function spire(): Groups {
  const A: AreaId = 'spire';
  let cal = '';
  let minSteps = 0;
  const one = (g: string, kinds: Kind[], w: number, h: number, extra: Partial<Spec> = {}, tries = 900, acc?: (p: PuzzleDef, s: Uint8Array) => boolean, minNamed = 1) =>
    slot(A, g + cal, 'heart', { w, h, kinds, holes: 0.02, maxMold: 5, keep: keepOf(kinds), gemColors: 4, twinPairs: 1, beacons: [3, 4], freeMoldP: 0.3, ...extra }, tries, (p, s) => hasAll(kinds)(p) && tidy(2)(p, s) && (!acc || acc(p, s)), minNamed, minSteps);
  const note = (c: Candidate) => insightNote(c, 'default', `${langs(c.p)}: tudo o que a ilha ensinou, junto`);
  const noteDrum = (c: Candidate) => insightNote(c, 'default', `Tambor: a borda esquerda encosta na direita — ${langs(c.p)} dando a volta`);
  const noteMirror = (c: Candidate) => insightNote(c, 'default', `Espelho (${c.p.mirror === 'v' ? 'vertical' : c.p.mirror === 'h' ? 'horizontal' : 'rotação'}): cada toque acende também o reflexo, então a resposta é simétrica — ${langs(c.p)}`);
  const sortRamp = (l: Candidate[]) => [...l].sort((a, b) => showScore(a) - showScore(b));
  const apexNote = (c: Candidate, i: number) => (i === 3 ? insightNote(c, 'default', `O último painel da Torre: as ${NF(glyphKinds(c.p).size)} linguagens de uma só vez (${langs(c.p)})`) : note(c));
  const SLOTS: Record<string, (() => Candidate[])[]> = {
    ascent: [
      () => one('ascent-1', ['measure', 'gem'], 6, 6), () => one('ascent-2', ['contour', 'beacon'], 6, 6, {}, 900, undefined, 0),
      () => one('ascent-3', ['mosaic', 'mold'], 6, 6), () => one('ascent-4', ['weave', 'twin'], 6, 6, {}, 2500, undefined, 0),
      () => one('ascent-5', ['gem', 'contour', 'measure'], 7, 7, {}, 900, undefined, 2), () => one('ascent-6', ['beacon', 'mosaic', 'mold'], 7, 7, {}, 900, undefined, 1),
      () => one('ascent-7', ['twin', 'contour', 'gem'], 7, 7, {}, 2500, undefined, 1), () => one('ascent-8', ['weave', 'measure', 'mold'], 7, 7, {}, 900, undefined, 2),
    ],
    drums: [
      () => one('drums-1', ['gem', 'measure'], 6, 4, { wrap: true, gemColors: 2, holes: 0 }, 2000, wrapEssential),
      () => one('drums-2', ['measure'], 7, 5, { wrap: true, holes: 0 }, 2000, wrapEssential),
      () => one('drums-3', ['contour'], 7, 5, { wrap: true, holes: 0 }, 2000, wrapEssential, 0),
      () => one('drums-4', ['mold', 'contour'], 8, 5, { wrap: true, holes: 0 }, 2000, wrapEssential),
      () => one('drums-5', ['mosaic', 'gem'], 8, 5, { wrap: true, holes: 0 }, 2000, wrapEssential),
      () => one('drums-6', ['gem', 'measure', 'contour'], 8, 6, { wrap: true, holes: 0.02 }, 2000, wrapEssential),
    ],
    mirrors: [
      () => one('mirrors-1', ['measure', 'contour'], 6, 6, { mirror: 'v', holes: 0 }), () => one('mirrors-2', ['gem', 'mosaic'], 6, 6, { mirror: 'h', holes: 0 }),
      () => one('mirrors-3', ['contour', 'mold'], 6, 6, { mirror: 'rot', holes: 0 }), () => one('mirrors-4', ['mold', 'contour', 'mosaic'], 7, 7, { mirror: 'rot', holes: 0 }),
      () => one('mirrors-5', ['gem', 'measure', 'weave'], 7, 7, { mirror: 'v', holes: 0 }), () => one('mirrors-6', ['mosaic', 'measure', 'gem'], 7, 7, { mirror: 'h', holes: 0 }),
    ],
    apex: [
      () => one('apex-1', ['gem', 'measure', 'contour', 'mosaic'], 7, 7, {}, 1200, undefined, 2),
      () => one('apex-2', ['mold', 'twin', 'beacon', 'contour', 'gem', 'mosaic'], 8, 8, {}, 4000, undefined, 2),
      () => one('apex-3', ['weave', 'measure', 'mold', 'gem', 'contour'], 8, 8, {}, 2000, undefined, 2),
      () => one('apex-4', ['gem', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twin'], 9, 9, { echo: { p: 0.3, dirs: echoDirs([0, 1, 2, 3]), mute: 0.08 }, beacons: [3, 4] }, 5000, undefined, 2),
    ],
  };
  const NOTES: Record<string, (c: Candidate, i: number) => string> = { ascent: note, drums: noteDrum, mirrors: noteMirror, apex: apexNote };
  const patch = process.env.PATCH;
  if (patch) {
    // PATCH=apex.4=3,...: regenerate single panels in place from slot <index>, asking for at least MIN_STEPS insights
    const groups: Groups = JSON.parse(JSON.stringify(spireExisting));
    cal = '-cal';
    minSteps = Number(process.env.MIN_STEPS ?? 3);
    for (const item of patch.split(',')) {
      const [target, idx] = item.split('=');
      const [g, n] = target.split('.');
      let c: Candidate;
      if (idx.endsWith('.json')) {
        // a panel found by a dedicated search (tools/gen-vault.ts with OUT=...): the Spire's finale
        const data = JSON.parse(readFileSync(join(root, idx), 'utf8'));
        const p = puzzle(`${A}.${target}`, data.compact);
        delete p.difficulty;
        const res = solve(p, { maxSolutions: 2, maxNodes: 2_000_000 });
        if (res.solutions.length !== 1) throw new Error(`${idx}: not unique`);
        c = { p, sol: res.solutions[0], glyphs: 0, rivets: 0, nodes: res.nodes, simple: res.propagationOnly, sols: 1, score: 0 };
      } else {
        c = SLOTS[g][Number(idx)]()[0];
      }
      if (stats(c).steps < minSteps) throw new Error(`patch ${target}: best candidate has only ${stats(c).steps} insights`);
      const old = groups[g][Number(n) - 1];
      c.p.id = old.id;
      c.p.difficulty = old.difficulty;
      c.p.note = NOTES[g](c, Number(n) - 1);
      groups[g][Number(n) - 1] = c.p;
      console.log(`patched ${old.id}: ${stats(c).steps} insights (${langs(c.p)})`);
    }
    return groups;
  }
  return {
    ascent: finish(sortRamp(SLOTS.ascent.flatMap((f) => f())), A, 'ascent', [8, 9], note),
    drums: finish(SLOTS.drums.flatMap((f) => f()), A, 'drums', [8, 9], noteDrum),
    mirrors: finish(SLOTS.mirrors.flatMap((f) => f()), A, 'mirrors', [8, 9], noteMirror),
    apex: finish(SLOTS.apex.flatMap((f) => f()), A, 'apex', [9, 10], apexNote),
  };
}

function hub(): Groups {
  return { vault: vault() };
}

/** The Hidden Vault puzzle comes from tools/gen-vault.ts (tools/data/vault.json). */
function vault(): PuzzleDef[] {
  const file = join(root, 'tools/data/vault.json');
  if (!existsSync(file)) throw new Error('run tools/gen-vault.ts first (tools/data/vault.json missing)');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const p = puzzle('hub.vault', data.compact);
  p.difficulty = 10;
  p.note = data.note ?? 'O Cofre Escondido — as linguagens da ilha num só painel 9×9, solução única, sem chute.';
  return [p];
}

// ── emission ──────────────────────────────────────────

const GENERATORS: Partial<Record<AreaId, () => Groups>> = { kinship, measure, mold, contour, mosaic, beacon, weave, twins, echo, citadel, spire, hub };

function emit(area: AreaId, groups: Groups): void {
  const path = join(root, `src/data/puzzles/${area}.ts`);
  let src = readFileSync(path, 'utf8');
  const a = src.indexOf('  // <gen>');
  const b = src.indexOf('  // </gen>');
  if (a < 0 || b < 0) throw new Error(`${area}: missing gen markers`);
  const order = [...AREA_BY_ID[area].groups.map((g) => g.key), 'vault'].filter((k) => groups[k]);
  for (const g of AREA_BY_ID[area].groups) if (!groups[g.key] && g.key !== 'intro') throw new Error(`${area}: group ${g.key} not generated`);
  const body = order.map((k) => `  ${k}: [\n${groups[k].map((p) => toSource(p, '    ')).join('\n')}\n  ],`).join('\n') + '\n  secret: [],';
  src = src.slice(0, a) + '  // <gen> (generated by tools/gen-content.ts — do not edit by hand)\n' + body + '\n' + src.slice(b);
  writeFileSync(path, src);
}

/**
 * REORDER=citadel,echo,spire: calibration pass for the late areas — orders each group (and each
 * 3-panel echo sequence) by measured difficulty, renumbering ids and the "i/N" in the notes; the
 * Spire's finale is its hardest panel. Content is untouched.
 */
async function reorderLate(area: AreaId): Promise<void> {
  const mod = await import(`../src/data/puzzles/${area}.ts`);
  const groups: Groups = JSON.parse(JSON.stringify(mod.default));
  delete groups.secret;
  if (area === 'echo') delete groups.intro; // hand-written, lives outside the generated block
  const effort = new Map<PuzzleDef, number>();
  const gentleP = (p: PuzzleDef) => {
    if (!effort.has(p)) { const ip = insightPath(p, 60); effort.set(p, ip.steps.length * 10 - ip.basicRoot); }
    return effort.get(p)!;
  };
  const byEffort = (l: PuzzleDef[]) => [...l].sort((a, b) => gentleP(a) - gentleP(b));
  for (const [g, list] of Object.entries(groups)) {
    let out: PuzzleDef[];
    if (area === 'echo' && g === 'trial') {
      out = [];
      for (let k = 0; k < list.length; k += 3) {
        byEffort(list.slice(k, k + 3)).forEach((p, i) => { p.note = p.note!.replace(/^seq ([A-Z])\d\/3/, `seq $1${i + 1}/3`); out.push(p); });
      }
    } else if (area === 'echo' && g === 'practice') {
      out = list;
    } else if (area === 'spire' && g === 'apex') {
      // the finale is the hardest panel of the Tower: order by effort and give the last one the finale's words
      const FIN = 'O último painel da Torre';
      out = byEffort(list).map((p, i, arr) => {
        let n = p.note!.replace(new RegExp(`^${FIN}: a`), 'A').replace(new RegExp(`^${FIN} — `), '');
        if (i === arr.length - 1) n = `${FIN} — ${n}`;
        p.note = n;
        return p;
      });
    } else {
      out = byEffort(list);
    }
    out.forEach((p, i) => {
      p.id = `${area}.${g}.${i + 1}`;
      if (p.note) p.note = p.note.replace(/^Obra-prima \d+\/(\d+)/, `Obra-prima ${i + 1}/$1`);
    });
    groups[g] = out;
  }
  emit(area, groups);
  console.log(`${area}: reordered ${Object.entries(groups).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
}
if (process.env.REORDER) {
  for (const area of process.env.REORDER.split(',') as AreaId[]) await reorderLate(area);
}

for (const [area, fn] of Object.entries(GENERATORS) as [AreaId, () => Groups][]) {
  if (only && only !== area) continue;
  const t0 = Date.now();
  const groups = fn();
  emit(area, groups);
  console.log(`${area}: ${Object.entries(groups).map(([k, v]) => `${k} ${v.length}`).join(', ')}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
