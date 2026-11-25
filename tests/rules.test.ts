import assert from 'node:assert/strict';
import { puzzle, initialState, pressSet, buildGeometry, toCompact } from '../src/puzzle/board';
import { check } from '../src/puzzle/rules';
import type { PuzzleDef } from '../src/puzzle/types';

declare const test: (name: string, fn: () => void) => void;

const st = (p: PuzzleDef, s: string) => Uint8Array.from(s.replace(/[\s/]/g, '').split('').map((c) => (c === '1' ? 1 : 0)));

test('kinship: different colours must separate, same must join', () => {
  const p = puzzle('k1', { grid: '@a @b' });
  assert.equal(check(p, st(p, '00')).ok, false);
  assert.equal(check(p, st(p, '10')).ok, true);
  const q = puzzle('k2', { grid: '@a L @a' });
  assert.equal(check(q, st(q, '010')).ok, false);
  assert.equal(check(q, st(q, '111')).ok, true);
});

test('measure counts the region, dark regions included', () => {
  const p = puzzle('m', { grid: '. . .\n. m1 .\n. . m8' });
  assert.equal(check(p, st(p, '000/010/000')).ok, true);
  assert.equal(check(p, st(p, '000/000/000')).ok, false);
});

test('mold fixed and free orientation', () => {
  const p = puzzle('f', { grid: 'fT . .\n. . .', shapes: { T: 'xxx/.x.' } });
  assert.equal(check(p, st(p, '111/010')).ok, true);
  assert.equal(check(p, st(p, '010/111')).ok, false); // upside-down T: wrong orientation
  const q = puzzle('f2', { grid: '. fT* .\n. . .', shapes: { T: 'xxx/.x.' } });
  assert.equal(check(q, st(q, '010/111')).ok, true);
});

test('contour counts borders, outside is dark', () => {
  const p = puzzle('c', { grid: 'c4' });
  assert.equal(check(p, st(p, '1')).ok, true);
  assert.equal(check(p, st(p, '0')).ok, false);
  const q = puzzle('c2', { grid: '. c2 .' });
  assert.equal(check(q, st(q, '111')).ok, true);
  assert.equal(check(q, st(q, '101')).ok, true);
  assert.equal(check(q, st(q, '010')).ok, false);
});

test('mosaic counts 3x3 including itself', () => {
  const p = puzzle('x', { grid: 'x1' });
  assert.equal(check(p, st(p, '1')).ok, true);
  const q = puzzle('x2', { grid: 'x4 . .\n. . .' });
  assert.equal(check(q, st(q, '110/110')).ok, true);
});

test('beacon sight and every lit tile must be seen', () => {
  const p = puzzle('b', { grid: 'b2 . .' });
  assert.equal(check(p, st(p, '110')).ok, true);
  assert.equal(check(p, st(p, '111')).ok, false);
  assert.equal(check(p, st(p, '101')).ok, false);
  const q = puzzle('b2', { grid: 'b3 . L' });
  assert.equal(check(q, st(q, '111')).ok, true);
});

test('weave runs with holes splitting lines', () => {
  const p = puzzle('w', { grid: '. . . .', rows: '2 1', cols: '-|-|-|-' });
  assert.equal(check(p, st(p, '1101')).ok, true);
  assert.equal(check(p, st(p, '1011')).ok, false);
  const q = puzzle('w2', { grid: '. # .', rows: '1 1' });
  assert.equal(check(q, st(q, '101')).ok, true);
});

test('twins: distinct regions, same shape; mirror variant', () => {
  const p = puzzle('t', { grid: 'tm . . tm' });
  assert.equal(check(p, st(p, '1100')).ok, true); // two dominoes
  assert.equal(check(p, st(p, '0000')).ok, false); // same region
  assert.equal(check(p, st(p, '1000')).ok, false); // 1 vs 3
  const q = puzzle('t2', { grid: "tm . # . tm'\n. . # . ." });
  // L on the left, mirrored L on the right
  assert.equal(check(q, st(q, '10#01/11#11')).ok, true);
});

test('target plate', () => {
  const p = puzzle('p', { grid: '. . .', target: '010' });
  assert.equal(check(p, st(p, '010')).ok, true);
  assert.equal(check(p, st(p, '011')).ok, false);
});

test('echo and mirror press sets', () => {
  const p = puzzle('e', { grid: '. .{-} .' });
  const g = buildGeometry(p);
  assert.deepEqual(pressSet(p, g, 1).sort(), [0, 1, 2]);
  const m = puzzle('mi', { grid: '. . .', mirror: 'v' });
  assert.deepEqual(pressSet(m, buildGeometry(m), 0).sort(), [0, 2]);
});

test('drum wrap joins left and right edges', () => {
  const p = puzzle('d', { grid: '@a . @b @a', wrap: true });
  assert.equal(check(p, st(p, '1001')).ok, true); // amber joined across the seam
});

test('compact roundtrip', () => {
  const p = puzzle('r', { grid: "L@a m3 fA*\n# ~.{+} tm'\nc2 x4 b3", shapes: { A: 'xx/x.' }, rows: '1|0|2', target: '101/#01/111' });
  const back = puzzle('r', toCompact(p));
  assert.deepEqual(back.cells, p.cells);
  assert.deepEqual(back.rowClues, p.rowClues);
  assert.equal(initialState(p)[0], 1);
});
