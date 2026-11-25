/* Save codes: a save must survive being turned into a text code and back. */
import { newSave, saveToCode, saveFromCode } from '../src/core/save';

declare const test: (name: string, fn: () => void) => void;
const assert = (c: unknown, m: string) => {
  if (!c) throw new Error(m);
};

test('save code round-trips a save (incl. non-ASCII text)', () => {
  const s = newSave(1);
  s.panels['kinship.intro.1'] = { s: '0110', done: 1 };
  s.totems.push('kinship');
  s.flags['r:star.kinship.3'] = true;
  s.visited.push('hub');
  (s.flags as Record<string, unknown>)['nota'] = 'ação';
  const code = saveToCode(s);
  assert(code.startsWith('TESSELLA1:'), 'prefix');
  const back = saveFromCode(code);
  assert(back, 'decodes');
  assert(JSON.stringify(back) === JSON.stringify({ ...s, ...back }), 'same content');
  assert(back!.panels['kinship.intro.1'].s === '0110' && back!.totems[0] === 'kinship', 'fields kept');
  assert((back!.flags as Record<string, unknown>)['nota'] === 'ação', 'utf-8 kept');
  // whitespace and line breaks from copy/paste are tolerated
  assert(saveFromCode('  ' + code.slice(0, 40) + '\n' + code.slice(40) + '  '), 'tolerates whitespace');
  // raw JSON also accepted
  assert(saveFromCode(JSON.stringify(s)), 'raw json');
});

test('save code rejects garbage', () => {
  assert(saveFromCode('hello') === null, 'garbage');
  assert(saveFromCode('TESSELLA1:!!!') === null, 'bad base64');
  assert(saveFromCode('{"a":1}') === null, 'not a save');
});
