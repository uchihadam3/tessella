/**
 * Searches for the Hidden Vault puzzle: 9×9, eight languages, unique, solvable by pure
 * deduction (no guessing) yet needing the advanced deductions, with long chains where the
 * languages feed each other. Keeps the best candidate in tools/data/vault.json.
 *   npx tsx tools/gen-vault.ts [minutes] [seed]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzle, toCompact } from '../src/puzzle/board';
import { insightPath, solve, traceDeduction } from '../src/puzzle/solver';
import type { PuzzleDef } from '../src/puzzle/types';
import { generate, type Kind, type Spec } from './lib/gen';
import { rng } from './lib/random-puzzle';
import { ascii } from './lib/show';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, process.env.OUT ?? 'tools/data/vault.json');
const minutes = Number(process.argv[2] ?? 10);
const r = rng(Number(process.argv[3] ?? 2026));
const kinds: Kind[] = ['gem', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twin'];

function present(p: PuzzleDef): Set<string> {
  const s = new Set<string>();
  for (const c of p.cells) if (c.glyph) s.add(c.glyph.kind);
  if (p.rowClues?.some(Boolean) || p.colClues?.some(Boolean)) s.add('weave');
  return s;
}

export function vaultScore(p: PuzzleDef): { score: number; trace: [string, number][]; simpleRoot: number; glyphs: number } | null {
  const tr = traceDeduction(p);
  if (!tr.solved) return null;
  const simple = solve(p, { maxSolutions: 1, simple: true, maxNodes: 1, timeLimitMs: 3000 });
  if (simple.propagationOnly) return null; // too easy: no advanced deduction needed
  const alternations = tr.steps.length;
  const regionSteps = tr.steps.filter(([k]) => k === 'regions').length;
  const glyphs = p.cells.filter((c) => c.glyph && c.glyph.kind !== 'beacon').length + (p.rowClues?.filter(Boolean).length ?? 0) + (p.colClues?.filter(Boolean).length ?? 0);
  const bigNumbers = p.cells.filter((c) => c.glyph?.kind === 'measure' && (c.glyph as { n: number }).n > 16).length;
  // the vault must be the true peak: many insights, of many kinds, from a board a beginner can barely start
  const ip = insightPath(p, 60);
  if (!ip.solved) return null;
  const kinds = new Set(ip.steps.map((s) => s.tag.split('-')[0]));
  const looks = ip.steps.filter((s) => s.tag === 'lookahead').length;
  if (looks > 10) return null;
  const score = ip.steps.length * Number(process.env.STEPW ?? 3) + kinds.size * 5 + (1 - ip.basicRoot) * 20 + alternations * 0.5 - glyphs * 0.5 - bigNumbers * 6;
  return { score, trace: tr.steps, simpleRoot: simple.rootDetermined, glyphs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const spec: Spec = {
    w: 9, h: 9, kinds, holes: 0, maxMold: 5, freeMoldP: 0.5,
    keep: Object.fromEntries(['measure', 'mold', 'contour', 'mosaic', 'weave'].map((k) => [k, 1])),
    gemColors: 3, twinPairs: 1, mirrorTwinP: 1,
    weights: process.env.VW ? JSON.parse(process.env.VW) : { measure: 1, mold: 0.8, contour: 1, mosaic: 1 },
    stateWithBeacons: (rr, p, g) => {
      // left-right symmetric constellation of beacons: every region has a mirror twin
      const W = p.w, H = p.h;
      const state = new Uint8Array(W * H);
      const beacons: number[] = [];
      const pairs = 2 + rr.int(2);
      const center = rr.chance(0.6);
      const place = (row: number, col: number, arms: number[]) => {
        const t = row * W + col;
        if (beacons.includes(t)) return;
        beacons.push(t);
        state[t] = 1;
        arms.forEach((len, d) => {
          let cur = g.dir4[t][d];
          for (let k = 0; k < len && cur >= 0; k++) { state[cur] = 1; cur = g.dir4[cur][d]; }
        });
      };
      for (let k = 0; k < pairs; k++) {
        const row = rr.int(H);
        const col = rr.int(Math.floor(W / 2));
        const arms = [rr.int(4), rr.int(4), rr.int(4), rr.int(4)];
        place(row, col, arms);
        place(row, W - 1 - col, [arms[0], arms[3], arms[2], arms[1]]); // mirror E/W arms
      }
      if (center) place(rr.int(H), Math.floor(W / 2), [rr.int(5), rr.int(3), rr.int(5), 0].map((x, i) => (i === 3 ? 0 : x)).map((x, i, a) => (i === 3 ? a[1] : x)));
      // balance: light in every quadrant, not too much, not too little
      const lit = state.reduce((a, b) => a + b, 0);
      if (lit < 22 || lit > 42) return null;
      const q = [0, 0, 0, 0];
      for (let i = 0; i < W * H; i++) if (state[i]) q[(Math.floor(i / W) < H / 2 ? 0 : 2) + (i % W < W / 2 ? 0 : 1)]++;
      if (Math.min(...q) < 3) return null;
      return { state, beacons };
    },
  };
  let best: { p: PuzzleDef; score: number; trace: [string, number][]; simpleRoot: number; glyphs: number } | null = null;
  if (existsSync(out)) {
    const prev = JSON.parse(readFileSync(out, 'utf8'));
    const p = puzzle('hub.vault', prev.compact);
    const sc = vaultScore(p);
    if (sc) best = { p, ...sc };
    console.log('previous best', best?.score.toFixed(1));
  }
  const t0 = Date.now();
  let tried = 0, valid = 0;
  while (Date.now() - t0 < minutes * 60_000) {
    tried++;
    const c = generate(r, spec, 'hub.vault');
    if (!c || !c.propOnly) continue;
    const have = present(c.p);
    if (!kinds.every((k) => have.has(k))) continue;
    const sc = vaultScore(c.p);
    if (!sc) continue;
    valid++;
    if (!best || sc.score > best.score) {
      best = { p: c.p, ...sc };
      console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] new best ${sc.score.toFixed(1)} glyphs ${sc.glyphs} simpleRoot ${sc.simpleRoot.toFixed(2)} steps ${sc.trace.length}`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify({ score: sc.score, trace: sc.trace, compact: toCompact(best.p) }, null, 1));
    }
  }
  console.log(`tried ${tried}, valid ${valid}`);
  if (best) {
    const res = solve(best.p, { maxSolutions: 2 });
    console.log(ascii(best.p, res.solutions[0]));
    console.log('trace:', best.trace.map(([k, n]) => `${k}:${n}`).join(' → '));
  }
}
