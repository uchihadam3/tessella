import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSTELLATIONS } from '../src/data/constellations';
import { checkConstellation, initialState, isInversionSymmetric, neighbors, pressSet, wantsAllLit } from '../src/secret/graph';
import { distinctSolutions, estimateDifficulty, reachable } from '../src/secret/solver';
import type { ConstellationDef } from '../src/secret/types';

declare const test: (name: string, fn: () => void) => void;

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'constellation-solutions.json'), 'utf8')) as {
  solutions: Record<string, string>;
  presses: Record<string, number[]>;
};

const EXPECT: Record<string, number> = {
  prologue: 4, hub: 10, kinship: 15, measure: 15, mold: 13, contour: 13, mosaic: 15, beacon: 13, weave: 15, twins: 15, citadel: 12, echo: 10,
};

type P = [number, number];
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segInter(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function pointSegDist(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}
const pts = (d: ConstellationDef): P[] => d.stars.map((s) => [s.x, s.z]);
const toState = (s: string) => Uint8Array.from(s.split('').map((c) => (c === '1' ? 1 : 0)));

test('constellations: 150 in total with the planned distribution and well-formed ids', () => {
  assert.equal(CONSTELLATIONS.length, 150);
  const ids = new Set<string>();
  for (const [area, n] of Object.entries(EXPECT)) {
    const list = CONSTELLATIONS.filter((c) => c.area === area);
    assert.equal(list.length, n, `${area} count`);
    list.forEach((c, i) => assert.equal(c.id, `${area}.c${String(i + 1).padStart(2, '0')}`));
  }
  for (const c of CONSTELLATIONS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
  }
});

test('constellations: valid threads, planar, spaced, inside the footprint, bell clear', () => {
  for (const d of CONSTELLATIONS) {
    const P = pts(d);
    const keys = new Set<string>();
    d.threads.forEach((t) => {
      assert.ok(t.a >= 0 && t.b >= 0 && t.a < d.stars.length && t.b < d.stars.length && t.a !== t.b, `${d.id} bad thread`);
      const k = t.a < t.b ? `${t.a},${t.b}` : `${t.b},${t.a}`;
      assert.ok(!keys.has(k), `${d.id} duplicate thread ${k}`);
      keys.add(k);
    });
    for (let i = 0; i < P.length; i++) {
      assert.ok(Math.hypot(P[i][0], P[i][1]) <= 7.01, `${d.id} star ${i} outside 7 m`);
      for (let j = i + 1; j < P.length; j++) assert.ok(dist(P[i], P[j]) >= 1.6 - 1e-6, `${d.id} stars ${i},${j} too close`);
    }
    for (let i = 0; i < d.threads.length; i++) {
      const a = d.threads[i];
      for (let j = i + 1; j < d.threads.length; j++) {
        const b = d.threads[j];
        if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
        assert.ok(!segInter(P[a.a], P[a.b], P[b.a], P[b.b]), `${d.id} threads ${i},${j} cross`);
      }
      for (let s = 0; s < P.length; s++) if (s !== a.a && s !== a.b) assert.ok(pointSegDist(P[s], P[a.a], P[a.b]) >= 0.5, `${d.id} star ${s} lies on thread ${i}`);
    }
    const B: P = [d.bell.x, d.bell.z];
    assert.ok(Math.hypot(B[0], B[1]) <= 8.61, `${d.id} bell too far`);
    for (const p of P) assert.ok(dist(p, B) >= 1.15, `${d.id} bell on a star`);
    // connected network
    const adj = neighbors(d);
    const seen = new Set([0]);
    const q = [0];
    while (q.length) for (const j of adj[q.pop()!]) if (!seen.has(j)) (seen.add(j), q.push(j));
    assert.equal(seen.size, d.stars.length, `${d.id} disconnected`);
  }
});

test('constellations: glyph values are possible, difficulty ramps, every one has a note', () => {
  for (const d of CONSTELLATIONS) {
    const adj = neighbors(d);
    d.stars.forEach((s, i) => {
      const g = s.glyph;
      if (!g) return;
      if (g.kind === 'contour') assert.ok(g.n >= 0 && g.n <= adj[i].length, `${d.id} contour ${i}`);
      if (g.kind === 'mosaic') assert.ok(g.n >= 0 && g.n <= adj[i].length + 1, `${d.id} mosaic ${i}`);
      if (g.kind === 'measure') assert.ok(g.n >= 1 && g.n <= d.stars.length, `${d.id} measure ${i}`);
    });
    assert.ok(d.difficulty >= 1 && d.difficulty <= 10, `${d.id} difficulty`);
    assert.ok(d.note && d.note.length > 20, `${d.id} note`);
  }
  for (const area of Object.keys(EXPECT)) {
    const list = CONSTELLATIONS.filter((c) => c.area === area);
    for (let i = 1; i < list.length; i++) assert.ok(list[i].difficulty >= list[i - 1].difficulty, `${list[i].id} breaks the ramp`);
  }
});

test('constellations: solvable, unique (modulo inversion for symmetric rules), not solved at start', () => {
  for (const d of CONSTELLATIONS) {
    assert.equal(checkConstellation(d, initialState(d)).ok, false, `${d.id} already solved`);
    const sym = isInversionSymmetric(d);
    const r = distinctSolutions(d, sym, 2, 30_000_000);
    assert.ok(r.complete, `${d.id} search incomplete`);
    assert.equal(r.count, 1, `${d.id} has ${r.count} solutions`);
  }
});

test('constellations: fixture solutions and presses reproduce a valid, reachable answer', () => {
  for (const d of CONSTELLATIONS) {
    const s = fixture.solutions[d.id];
    assert.ok(s && s.length === d.stars.length, `${d.id} fixture missing`);
    const sol = toState(s);
    assert.ok(checkConstellation(d, sol).ok, `${d.id} fixture fails the rules`);
    assert.ok(reachable(d, sol), `${d.id} fixture unreachable`);
    const st = initialState(d);
    for (const i of fixture.presses[d.id] ?? []) for (const j of pressSet(d, i)) st[j] ^= 1;
    assert.deepEqual(Array.from(st), Array.from(sol), `${d.id} presses do not reproduce the solution`);
    if (wantsAllLit(d)) assert.ok(sol.every((v) => v === 1), `${d.id} all-lit`);
  }
});

test('constellations: fair — a careful player can solve each one by reasoning alone', () => {
  for (const d of CONSTELLATIONS) {
    const sol = toState(fixture.solutions[d.id]);
    const rep = estimateDifficulty(d, sol);
    assert.ok(rep.solvedByLogic, `${d.id} needs guessing`);
  }
});

test('constellation rules: thread marks, echo, all-lit default', () => {
  const chain: ConstellationDef = {
    id: 't', area: 'prologue', difficulty: 1, bell: { x: 0, z: 3 },
    stars: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 4, z: 0 }],
    threads: [{ a: 0, b: 1, mark: 'diff' }, { a: 1, b: 2, mark: 'same' }],
  };
  assert.equal(checkConstellation(chain, Uint8Array.from([1, 0, 0])).ok, true);
  assert.deepEqual(checkConstellation(chain, Uint8Array.from([1, 1, 0])).violations.threads, [0, 1]);
  const lit: ConstellationDef = { ...chain, threads: [{ a: 0, b: 1 }, { a: 1, b: 2 }] };
  assert.equal(checkConstellation(lit, Uint8Array.from([1, 1, 0])).ok, false);
  assert.equal(checkConstellation(lit, Uint8Array.from([1, 1, 1])).ok, true);
  const echo: ConstellationDef = { ...lit, echo: true };
  assert.deepEqual(pressSet(echo, 1).sort(), [0, 1, 2]);
  const locked: ConstellationDef = { ...echo, stars: [{ x: 0, z: 0, lock: 1 }, { x: 2, z: 0 }, { x: 4, z: 0 }] };
  assert.deepEqual(pressSet(locked, 1).sort(), [1, 2]);
  assert.deepEqual(pressSet(locked, 0), []);
});
