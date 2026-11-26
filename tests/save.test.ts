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

test('an old save keeps its progress when the introductions grow to 20 panels', () => {
  const old = newSave(0) as unknown as { version: number; panels: Record<string, { s?: string; done?: number }> };
  old.version = 2;
  old.panels = {};
  // the whole old twins introduction solved (11 panels); measure only its first three
  for (let i = 1; i <= 11; i++) old.panels[`twins.intro.${i}`] = { s: `t${i}`, done: 1 };
  for (let i = 1; i <= 3; i++) old.panels[`measure.intro.${i}`] = { s: `m${i}`, done: 1 };
  const back = saveFromCode(JSON.stringify(old));
  assert(back && back.version >= 3, 'migrated');
  const p = back!.panels;
  for (let i = 1; i <= 20; i++) assert(p[`twins.intro.${i}`]?.done, `twins.intro.${i} solved`);
  assert(p['twins.intro.4'].s === 't1' && p['twins.intro.20'].s === 't11', 'old answers moved with their panels');
  // measure: old 1,2,3 are now 1,5,2; panel 3, 4 (new, before old 2's new place) count as solved
  assert(p['measure.intro.1'].s === 'm1' && p['measure.intro.5'].s === 'm2' && p['measure.intro.2'].s === 'm3', 'measure moved');
  assert(p['measure.intro.3']?.done && p['measure.intro.4']?.done, 'new panels before a solved one count as solved');
  assert(!p['measure.intro.6'] && !p['measure.intro.20'], 'unsolved stay unsolved');
});
