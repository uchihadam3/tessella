/**
 * Verifies every puzzle of the game: structure, ids, counts, lint, initial state not solved,
 * solvable (and how many solutions), difficulty. Writes tests/fixtures/solutions.json and
 * docs/PUZZLES.md.   Usage: npm run verify:puzzles [-- --area=kinship] [-- --quiet]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, VAULT_PUZZLE_ID, type AreaId } from '../src/data/areas';
import { PUZZLES } from '../src/data/puzzles/index';
import { initialState, stateToString } from '../src/puzzle/board';
import { check, lintPuzzle, ruleKinds } from '../src/puzzle/rules';
import { findPresses, isInversionSymmetric, solve } from '../src/puzzle/solver';
import type { PuzzleDef } from '../src/puzzle/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const onlyArea = args.find((a) => a.startsWith('--area='))?.slice(7);
const quiet = args.includes('--quiet');

interface Row { id: string; size: string; kinds: string[]; sols: string; nodes: number; ms: number; diff: number; note: string; ok: boolean; msg: string[] }

const errors: string[] = [];
const solutions: Record<string, string> = {};
const presses: Record<string, number[]> = {};
const rows: Record<string, Record<string, Row[]>> = {};
const t0 = Date.now();

const LANG_PT: Record<string, string> = {
  gem: 'Afinidade', measure: 'Medida', mold: 'Forma', contour: 'Contorno', mosaic: 'Mosaico', beacon: 'Farol',
  weave: 'Trama', twin: 'Gêmeos', echo: 'Eco', target: 'Placa', wrap: 'Tambor', mirror: 'Espelho',
};

function verifyOne(p: PuzzleDef): Row {
  const msg: string[] = [];
  let ok = true;
  const lint = lintPuzzle(p);
  if (lint.length) { ok = false; msg.push('lint: ' + lint.join('; ')); }
  if (!p.note) msg.push('no note');
  if (p.difficulty === undefined) msg.push('no difficulty');
  const init = initialState(p);
  if (check(p, init).ok) { ok = false; msg.push('INITIAL STATE ALREADY SOLVED'); }
  const ts = Date.now();
  const sym = isInversionSymmetric(p);
  const res = solve(p, { maxSolutions: 3, maxNodes: 600_000, timeLimitMs: 30_000, breakSymmetry: true });
  const ms = Date.now() - ts;
  let sols = String(res.solutions.length);
  if (res.solutions.length >= 3) sols = '3+';
  if (!res.complete) sols += '?';
  if (sym) sols += '~';
  if (!res.solutions.length) { ok = false; msg.push(res.complete ? 'UNSOLVABLE' : 'NO SOLUTION FOUND (search aborted)'); }
  else {
    const s = res.solutions[0];
    if (!check(p, s).ok) { ok = false; msg.push('solver returned invalid state'); }
    solutions[p.id] = stateToString(p, s);
    if (p.mirror || p.cells.some((c) => c.echo?.length || c.mute)) {
      const pr = findPresses(p, s);
      if (!pr) { ok = false; msg.push('solution not reachable by presses'); }
      else presses[p.id] = pr;
    }
  }
  return { id: p.id, size: `${p.w}×${p.h}`, kinds: ruleKinds(p), sols, nodes: res.nodes, ms, diff: p.difficulty ?? 0, note: p.note ?? '', ok, msg };
}

for (const area of AREAS) {
  if (onlyArea && area.id !== onlyArea) continue;
  const set = PUZZLES[area.id as AreaId];
  rows[area.id] = {};
  const expected = new Map(area.groups.map((g) => [g.key, g.count]));
  if (area.id === 'hub') expected.set('vault', 1);
  // world secrets are graph constellations now (owned elsewhere): the grid 'secret' list must be empty
  if (set.secret && set.secret.length) errors.push(`${area.id}: 'secret' must be an empty list`);
  for (const [key, count] of expected) {
    const list = set[key];
    if (!list) { errors.push(`${area.id}: missing group '${key}'`); continue; }
    if (list.length !== count) errors.push(`${area.id}.${key}: expected ${count} puzzles, got ${list.length}`);
  }
  for (const key of Object.keys(set)) if (!expected.has(key) && key !== 'secret') errors.push(`${area.id}: unexpected group '${key}'`);
  for (const [key, list] of Object.entries(set)) {
    rows[area.id][key] = [];
    list.forEach((p, i) => {
      const want = key === 'vault' ? VAULT_PUZZLE_ID : `${area.id}.${key}.${i + 1}`;
      if (p.id !== want) errors.push(`id ${p.id} should be ${want}`);
      const row = verifyOne(p);
      rows[area.id][key].push(row);
      if (!row.ok) errors.push(`${p.id}: ${row.msg.join(', ')}`);
    });
  }
}

// ── report ──
let total = 0;
let unique = 0;
let multi = 0;
for (const area of AREAS) {
  const groups = rows[area.id];
  if (!groups) continue;
  const all = Object.values(groups).flat();
  total += all.length;
  const u = all.filter((r) => r.sols === '1' || r.sols === '1~').length;
  unique += u;
  multi += all.length - u;
  const slow = all.reduce((a, r) => Math.max(a, r.ms), 0);
  console.log(`${area.id.padEnd(9)} ${String(all.length).padStart(3)} puzzles  unique ${String(u).padStart(3)}  multi ${String(all.length - u).padStart(3)}  slowest ${slow} ms`);
  if (!quiet) {
    for (const [key, list] of Object.entries(groups)) {
      for (const r of list) {
        const flag = r.ok ? (r.msg.length ? '~' : ' ') : '!';
        console.log(`   ${flag} ${r.id.padEnd(22)} ${r.size.padEnd(6)} sols ${r.sols.padEnd(3)} d${String(r.diff).padEnd(2)} nodes ${String(r.nodes).padStart(6)} ${String(r.ms).padStart(5)}ms  [${r.kinds.join(',')}] ${r.msg.join('; ')}`);
      }
      void key;
    }
  }
}
console.log(`\nTOTAL ${total} puzzles, ${unique} unique (~ = up to swapping light and dark), ${multi} with several solutions, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

if (!onlyArea) {
  mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
  writeFileSync(join(root, 'tests/fixtures/solutions.json'), JSON.stringify({ solutions, presses }, null, 1) + '\n');
  // catalogue
  const lines: string[] = [
    '# Catálogo de puzzles',
    '',
    'Gerado por `npm run verify:puzzles`. Cada linha: id, tamanho, linguagens, soluções, dificuldade (1–10) e a percepção ("ahá") que o painel ensina.',
    '',
    '## Como os puzzles foram feitos',
    '',
    '- **Introduções** (7 por área), o prólogo e a Caverna: feitos à mão, uma ideia nova por painel.',
    '- **Prática / Provação / Maestria**: sequências de 4 painéis, cada sequência explorando UMA percepção, do simples ao difícil. ' +
      'Cada candidato é gerado, minimizado e só é aceito se um *solucionador humano simulado* (`insightPath` em `src/puzzle/solver.ts`) ' +
      'consegue resolvê-lo sem chute: deduções básicas até travar, então UMA percepção nomeada (ex.: "a região só tem uma saída", ' +
      '"duas janelas vizinhas", "só um farol alcança aquela luz", "o gargalo entre as gemas"), e de novo deduções básicas. ' +
      'A nota de cada painel diz quais percepções o caminho realmente usa.',
    '- **Coração**: as obras-primas da área — os candidatos com mais percepções distintas e as maiores cascatas.',
    '- **Cidadela / Torre**: combinações; cada painel é escolhido pela interação entre linguagens no caminho de solução.',
    '- **Afinidade e Gêmeos** aceitam várias soluções (qualquer uma vale), mas o núcleo é forçado: a cor de cada família / o encaixe de cada cópia.',
    '- `soluções`: `1` = única; `1~` = única a menos de trocar luz e sombra (regras cegas à cor); `2`/`3+` = várias.',
    '',
    '## Calibração da dificuldade',
    '',
    '- A dificuldade (1–10) é **medida**: é o número de percepções que o caminho de `insightPath` usa (`tools/relabel.ts`): ' +
      '0 = só ler a regra (1, ou 2 quando a leitura sozinha não fecha o painel), 1 → 3, 2 → 4, 3 → 5, 4–5 → 6, 6–7 → 7, 8–10 → 8, 11–14 → 9, 15+ → 10, ' +
      'limitada pela faixa do lugar (introdução 1–4, prática 2–6, provação 3–8, maestria 5–9, coração 6–10; Cidadela, Eco e Torre têm faixas próprias; o Cofre é 10).',
    '- Toda introdução e todo painel que abre uma sequência de prática usam no máximo 2 percepções (provação: 3; maestria: 6); ' +
      'nenhum painel de rótulo 7+ se resolve com 1 percepção só (`tools/calibrate.ts`).',
    '- As sequências e os grupos finais estão em ordem de esforço medido; o último painel da Torre e o Cofre são os picos.',
    '- Limite do modelo: o Eco (toques que se somam, como "lights out") é tratado como dedução básica, então placas de eco puras medem 0 percepções.',
    '',
  ];
  for (const area of AREAS) {
    const groups = rows[area.id];
    if (!groups) continue;
    const all = Object.values(groups).flat();
    lines.push(`## ${area.name.pt}${area.rule ? ` — ${area.rule.pt}` : ''} (${all.length})`, '');
    for (const [key, list] of Object.entries(groups)) {
      lines.push(`### ${key}`, '', '| id | tamanho | linguagens | soluções | dif. | percepção |', '|---|---|---|---|---|---|');
      for (const r of list) lines.push(`| ${r.id} | ${r.size} | ${r.kinds.map((k) => LANG_PT[k] ?? k).join(' + ')} | ${r.sols} | ${r.diff} | ${r.note.replace(/\|/g, '/')} |`);
      lines.push('');
    }
  }
  writeFileSync(join(root, 'docs/PUZZLES.md'), lines.join('\n'));
}

if (errors.length) {
  console.log(`\n${errors.length} ERROR(S):`);
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('All puzzles OK.');
