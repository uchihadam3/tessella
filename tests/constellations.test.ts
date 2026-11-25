import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSTELLATIONS } from '../src/data/constellations';
import { checkConstellation, initialState, isInversionSymmetric, neighbors, pressSet, wantsAllLit } from '../src/secret/graph';
import { distinctSolutions, estimateDifficulty, reachable } from '../src/secret/solver';
import type { ConstellationDef } from '../src/secret/types';
import { drawingProblems, similarity, type P } from '../tools/lib/drawing-rules';

declare const test: (name: string, fn: () => void) => void;

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'constellation-solutions.json'), 'utf8')) as {
  solutions: Record<string, string>;
  presses: Record<string, number[]>;
};

const EXPECT: Record<string, number> = {
  prologue: 4, hub: 10, kinship: 15, measure: 15, mold: 13, contour: 13, mosaic: 15, beacon: 13, weave: 15, twins: 15, citadel: 12, echo: 10,
};

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

test('constellations: every one is a readable line drawing with a name', () => {
  const names = new Set<string>();
  for (const d of CONSTELLATIONS) {
    assert.ok(d.name && d.name.pt.length > 1 && d.name.en.length > 1, `${d.id} needs a name`);
    assert.ok(!names.has(d.name.pt), `${d.id}: drawing name ${d.name.pt} used twice`);
    names.add(d.name.pt);
    const keys = new Set<string>();
    d.threads.forEach((t) => {
      assert.ok(t.a >= 0 && t.b >= 0 && t.a < d.stars.length && t.b < d.stars.length && t.a !== t.b, `${d.id} bad thread`);
      const k = t.a < t.b ? `${t.a},${t.b}` : `${t.b},${t.a}`;
      assert.ok(!keys.has(k), `${d.id} duplicate thread ${k}`);
      keys.add(k);
    });
    // readability: 4..16 stars, one figure, no crossings, spacing, angles ≥ 20°, bell in a clear spot
    const pts: P[] = d.stars.map((s) => [s.x, s.z]);
    const problems = drawingProblems(pts, d.threads.map((t) => [t.a, t.b]), [d.bell.x, d.bell.z]);
    assert.deepEqual(problems, [], `${d.id} (${d.name.pt}) is hard to read`);
    // one connected network (also through the rules' own adjacency)
    const adj = neighbors(d);
    const seen = new Set([0]);
    const q = [0];
    while (q.length) for (const j of adj[q.pop()!]) if (!seen.has(j)) (seen.add(j), q.push(j));
    assert.equal(seen.size, d.stars.length, `${d.id} disconnected`);
  }
});

test('constellations: no two drawings are nearly the same (also mirrored)', () => {
  const nets = CONSTELLATIONS.map((d) => ({ id: d.id, pts: d.stars.map((s) => [s.x, s.z] as P), edges: d.threads.map((t) => [t.a, t.b] as [number, number]) }));
  for (let i = 0; i < nets.length; i++) for (let j = i + 1; j < nets.length; j++) {
    const s = similarity(nets[i], nets[j]);
    assert.ok(s <= 0.55, `${nets[i].id} and ${nets[j].id} look alike (${(s * 100).toFixed(0)}%)`);
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
    id: 't', area: 'prologue', name: { pt: 'Teste', en: 'Test' }, difficulty: 1, bell: { x: 0, z: 3 },
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
