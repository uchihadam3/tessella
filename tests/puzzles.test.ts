import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, VAULT_PUZZLE_ID, type AreaId } from '../src/data/areas';
import { PUZZLES } from '../src/data/puzzles/index';
import { initialState, pressSet } from '../src/puzzle/board';
import { check, geometryOf, lintPuzzle } from '../src/puzzle/rules';
import { bruteForce, insightPath, solve } from '../src/puzzle/solver';
import { gentleMax } from '../tools/calibrate';
import { fuzz } from '../tools/fuzz-solver';

declare const test: (name: string, fn: () => void) => void;

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures/solutions.json');
const fixtures: { solutions: Record<string, string>; presses: Record<string, number[]> } | null = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : null;

test('every area has the contracted groups, sizes and ids', () => {
  for (const area of AREAS) {
    const set = PUZZLES[area.id as AreaId];
    for (const g of area.groups) {
      assert.ok(set[g.key], `${area.id} misses group ${g.key}`);
      assert.equal(set[g.key].length, g.count, `${area.id}.${g.key} size`);
      set[g.key].forEach((p, i) => assert.equal(p.id, `${area.id}.${g.key}.${i + 1}`));
    }
    assert.deepEqual(set.secret ?? [], [], `${area.id}.secret must be empty`);
  }
  assert.equal(PUZZLES.hub.vault?.length, 1);
  assert.equal(PUZZLES.hub.vault[0].id, VAULT_PUZZLE_ID);
});

test('every puzzle lints clean, has a note, and does not start solved', () => {
  for (const area of Object.values(PUZZLES)) {
    for (const list of Object.values(area)) {
      for (const p of list) {
        assert.deepEqual(lintPuzzle(p), [], p.id);
        assert.ok(p.note && p.note.length > 5, `${p.id} note`);
        assert.ok(p.difficulty && p.difficulty >= 1 && p.difficulty <= 10, `${p.id} difficulty`);
        assert.equal(check(p, initialState(p)).ok, false, `${p.id} starts solved`);
      }
    }
  }
});

test('fixture solutions satisfy the rules (and echo presses reach them)', () => {
  if (!fixtures) return;
  for (const area of Object.values(PUZZLES)) {
    for (const list of Object.values(area)) {
      for (const p of list) {
        const sol: string | undefined = fixtures.solutions[p.id];
        assert.ok(sol, `${p.id} has no fixture — run npm run verify:puzzles`);
        const s: Uint8Array = Uint8Array.from(sol.split('').map((c: string) => (c === '1' ? 1 : 0)));
        assert.ok(check(p, s).ok, `${p.id} fixture invalid`);
        const pr: number[] | undefined = fixtures.presses[p.id];
        if (pr) {
          const st = initialState(p);
          const g = geometryOf(p);
          for (const t of pr) for (const x of pressSet(p, g, t)) st[x] ^= 1;
          assert.deepEqual(Array.from(st), Array.from(s), `${p.id} presses`);
        }
      }
    }
  }
});

test('solver agrees with brute force on random tiny puzzles', () => {
  assert.equal(fuzz(250, 42), 0);
});

test('solver finds the intro solutions quickly', () => {
  const p = PUZZLES.kinship.intro[18]; // the chain: rivet → amber light → crimson shadow → blue light
  const res = solve(p, { maxSolutions: 2 });
  assert.equal(res.solutions.length, 1);
  assert.equal(bruteForce(p).length, 1);
});

test('calibration: intro panels and sequence openers are gentle', () => {
  for (const area of Object.values(PUZZLES)) {
    for (const list of Object.values(area)) {
      for (const p of list) {
        const max = gentleMax(p.id);
        if (max === null) continue;
        const steps = insightPath(p, 30).steps.length;
        assert.ok(steps <= max, `${p.id} needs ${steps} insights (at most ${max} for its slot)`);
      }
    }
  }
});
