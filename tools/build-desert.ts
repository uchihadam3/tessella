/**
 * Writes src/data/puzzles/mosaic.ts — the desert: "the sun shows the way". Every panel is a path
 * of light between its two wells; the answer is always the path the sun draws. Each panel hides
 * that drawing a different way (see src/world/areas/desert.ts). Panels that must be worked out
 * from part of the drawing list what can be seen (`seen`: '.' visible, '?' hidden) and are checked
 * to have exactly one answer from that alone.
 *   npx tsx tools/build-desert.ts
 */
import { writeFileSync } from 'node:fs';
import { puzzle } from '../src/puzzle/board';
import { check } from '../src/puzzle/rules';
import { solve } from '../src/puzzle/solver';

type Spec = { path: string; note: string; difficulty: number; seen?: string };
const G: Record<string, Spec[]> = {
  gate: [
    { path: 'W10/010/01W', difficulty: 1, note: 'O sol passa pelos furos da cobertura e marca o caminho no próprio painel.' },
    { path: 'W000/1110/0010/001W', difficulty: 2, note: 'Uma folha de palmeira tapa parte da cobertura: os furos que faltam se veem olhando para cima.' },
    { path: 'W111/0001/0001/W111', difficulty: 2, note: 'Um pano cobre a cobertura inteira: só os furos, vistos por baixo, mostram o caminho.' },
  ],
  light: [
    { path: '0W00/0111/0001/00W1', difficulty: 2, note: 'A luz da pérgola cai no chão, ao lado do painel; os poços no piso dizem que aquele chão é o painel.' },
    { path: 'W100/0100/0111/000W', difficulty: 3, note: 'Uma estela faz sombra num pedaço do caminho; atrás dela o caminho inteiro está gravado.' },
    { path: 'W1100/00100/00111/00001/0000W', difficulty: 3, seen: '...../...??/...??/...../.....', note: 'A areia cobre um trecho: o caminho que falta é o único que liga as pontas sem encostar.' },
    { path: '0011W/00100/01100/01000/W1000', difficulty: 4, note: 'O chão está todo soterrado: só a treliça, vista por baixo, mostra o caminho.' },
    { path: '001W/0010/0110/0100/W100', difficulty: 4, note: 'A pérgola encosta num muro: as primeiras fileiras da luz sobem pela parede.' },
  ],
  court: [
    { path: 'W00W/1001/1111/0000', difficulty: 3, note: 'Uma placa de bronze reflete o sol: o caminho aparece longe, na parede do santuário.' },
    { path: 'W0000/11100/00100/00111/0000W', difficulty: 5, note: 'Duas treliças, uma sobre a outra: só passa luz onde as duas estão abertas.' },
    { path: '00000/01110/W101W/00000/00000', difficulty: 4, note: 'Ladrilhos polidos que só brilham vistos de um ponto: as pegadas no chão.' },
    { path: '0001W/00110/01100/11000/W0000', difficulty: 4, note: 'Vigas de pedra no alto: desta vez o caminho é a sombra.' },
  ],
  heart: [
    { path: '00111/11101/W0001/00111/W1100', difficulty: 7, seen: '...../...../...../...??/...??', note: 'Coração: a estela faz sombra em metade do caminho e a areia cobriu o pé da gravação.' },
    { path: '0W000/01110/00010/01110/W1000', difficulty: 8, note: 'Coração: duas treliças sobre um chão todo soterrado.' },
    { path: 'W11000/001000/001110/000010/011110/0W0000', difficulty: 8, seen: '....../....../..????/..????/....../......', note: 'Coração: a sombra das vigas, com a areia cobrindo o meio.' },
  ],
};
let out = `/**
 * O Templo das Areias — o sol mostra o caminho. Cada painel é um caminho de luz entre os seus dois
 * poços; a resposta é sempre o caminho que o sol desenha (pelos furos de uma cobertura, de uma
 * pérgola, refletido numa placa, ou a sombra de vigas). Só o primeiro mostra tudo; os outros escondem
 * uma parte de um jeito diferente. (gerado por tools/build-desert.ts)
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
`;
for (const [group, list] of Object.entries(G)) {
  out += `  ${group}: [\n`;
  list.forEach((sp, i) => {
    const id = `mosaic.${group}.${i + 1}`;
    // the drawing: W = well (lit), 1 = path, 0 = dark; a row may be written with W's in it
    const rows = sp.path.split('/').map((r) => r.replace(/W/g, 'W'));
    const cells = rows.map((r) => r.split(''));
    const w = cells[0].length;
    let k = 0;
    const tok = cells.map((r) => r.map((ch) => (ch === 'W' ? (k++ < 2 ? 'wa' : 'wa') : '.')));
    const grid = tok.map((r) => '        ' + r.map((t) => t.padEnd(2)).join(' ').trimEnd()).join('\n');
    const target = cells.map((r) => r.map((ch) => (ch === '0' ? '0' : '1')).join('')).join('/');
    const def = puzzle(id, { grid: tok.map((r) => r.join(' ')).join('\n'), target, targetDisplay: 'world', difficulty: sp.difficulty });
    if (cells.some((r) => r.length !== w)) throw new Error(`${id}: ragged`);
    const st = Uint8Array.from(target.replace(/\//g, ''), (c) => (c === '1' ? 1 : 0));
    const res = check(def, st);
    if (!res.ok) throw new Error(`${id}: the drawing is not a path between the wells (${res.violations.map((v) => v.rule).join(',')})`);
    if (sp.seen) {
      const m = sp.seen.replace(/\//g, '');
      const partial = target.replace(/\//g, '').split('').map((c, j) => (m[j] === '?' ? '?' : c));
      const pp = Array.from({ length: def.h }, (_, y) => partial.slice(y * w, y * w + w).join('')).join('/');
      const p2 = puzzle(id + '.seen', { grid: tok.map((r) => r.join(' ')).join('\n'), target: pp, targetDisplay: 'world', difficulty: 1 });
      const r2 = solve(p2, { maxSolutions: 2 });
      if (r2.solutions.length !== 1) throw new Error(`${id}: what can be seen allows ${r2.solutions.length} answers`);
    }
    out += `    puzzle('${id}', {\n      grid: \`\n${grid}\n      \`,\n      target: '${target}',\n      targetDisplay: 'world',\n      difficulty: ${sp.difficulty},\n      note: ${JSON.stringify(sp.note).replace(/^"|"$/g, "'")},\n    }),\n`;
  });
  out += '  ],\n';
}
out += '  secret: [],\n};\n\nexport default P;\n\n/** What each panel lets you see (for the world builder): \'.\' visible, \'?\' hidden. */\nexport const DESERT_SEEN: Record<string, string> = ' + JSON.stringify(Object.fromEntries(Object.entries(G).flatMap(([g, l]) => l.map((s, i) => [`mosaic.${g}.${i + 1}`, s.seen ?? ''])).filter(([, v]) => v)), null, 2) + ';\n';
writeFileSync('src/data/puzzles/mosaic.ts', out);
console.log('written');
