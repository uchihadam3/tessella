/**
 * Writes src/data/puzzles/mosaic.ts — the desert's path panels. Panels whose drawing is seen in
 * the place get their target from the answer of a base puzzle (with what the place hides as '?'),
 * and every panel is checked to have exactly one answer.
 *   npx tsx tools/build-desert.ts
 */
import { writeFileSync } from 'node:fs';
import { puzzle } from '../src/puzzle/board';
import { solve } from '../src/puzzle/solver';

type Spec = { grid: string; note: string; base?: string; mask?: string; hide?: boolean; difficulty: number };
const rows = (s: string) => s.split('/').map((r) => r.trim());
function solOf(grid: string): Uint8Array {
  const p = puzzle('b', { grid: rows(grid).join('\n'), difficulty: 1 });
  const r = solve(p, { maxSolutions: 2 });
  if (r.solutions.length !== 1) throw new Error(`base not unique: ${grid}`);
  return r.solutions[0];
}
const G: Record<string, Spec[]> = {
  gate: [
    { grid: 'wa . wa', difficulty: 1, note: 'Ligar os dois poços com luz.' },
    { grid: 'wa . . . wa', difficulty: 1, note: 'Um caminho mais longo.' },
    { grid: 'wa ./# wa', difficulty: 1, note: 'O caminho pode virar.' },
    { grid: 'wa #/. ./# wa', difficulty: 1, note: 'Virar duas vezes.' },
    { grid: 'wa . ./# # ./# # wa', difficulty: 1, note: 'Um corredor em L.' },
    { grid: 'wa . ./# # ./wa . .', difficulty: 1, note: 'Ir e voltar pelo corredor.' },
    { grid: 'wa # . ./. # . #/. . . #/# # . wa', difficulty: 2, note: 'Um labirinto pequeno.' },
    { grid: 'wa . . #/# # . #/. . . #/. # # #/. . . wa', difficulty: 2, note: 'Um labirinto mais comprido.' },
  ],
  rivets: [
    { grid: 'wa D wa/. . .', difficulty: 1, note: 'O rebite escuro não acende: dar a volta.' },
    { grid: 'wa . ./D D ./wa . .', difficulty: 1, note: 'Uma parede de rebites escuros.' },
    { grid: 'wa . L . wa', difficulty: 1, note: 'O rebite aceso já faz parte do caminho.' },
    { grid: 'wa L ./. D ./. . wa', difficulty: 2, note: 'O aceso puxa o caminho; o escuro o desvia.' },
    { grid: 'wa . ./. D L/. . wa', difficulty: 2, note: 'Passar pelo aceso, contornando o escuro.' },
    { grid: 'wa . . ./. D D ./L . . ./. . D wa', difficulty: 3, note: 'Quatro por quatro com rebites dos dois tipos.' },
  ],
  marks: [
    { grid: 'wa . o . wa', difficulty: 1, note: 'O marco fica no caminho.' },
    { grid: 'wa . o/. . ./. . wa', difficulty: 2, note: 'O marco no canto puxa o caminho para a borda.' },
    { grid: 'wa o ./. . ./. o wa', difficulty: 2, note: 'Dois marcos: o caminho desce pelo meio.' },
    { grid: 'wa . . ./. # # o/. . . ./. . . wa', difficulty: 2, note: 'Um marco atrás das pedras.' },
    { grid: '. o . ./. . wa ./. . . ./# wa . .', difficulty: 3, note: 'O marco longe dos poços.' },
    { grid: '. . . ./wa . . ./. wa . o/. # . .', difficulty: 3, note: 'Dar a volta para buscar o marco.' },
  ],
  apart: [
    { grid: 'wa . o/. . ./wa . .', difficulty: 2, note: 'O caminho não encosta nele mesmo: ida e volta com uma fresta.' },
    { grid: 'wa . . o/. . . ./wa . . .', difficulty: 2, note: 'A fresta no meio fica apagada.' },
    { grid: 'wa . . o/. . . ./o . . ./wa . . .', difficulty: 3, note: 'Em zigue-zague, sem encostar.' },
    { grid: '. wa . . ./o . . . o/. . . . ./. o . # ./D . . wa .', difficulty: 4, note: 'Três marcos, uma pedra e um rebite.' },
  ],
  pairs: [
    { grid: 'wa . wa/. . ./wb . wb', difficulty: 2, note: 'Duas cores, dois caminhos.' },
    { grid: 'wa . wb/. . ./wa . wb', difficulty: 2, note: 'Os caminhos em pé.' },
    { grid: 'wa . . wa/. . . ./wb . . wb', difficulty: 2, note: 'Dois caminhos paralelos, com uma fresta entre eles.' },
    { grid: 'wa . . . wa/. . . . ./wb . . . wb', difficulty: 2, note: 'Mais compridos.' },
    { grid: '. . wb ./. wa . ./. wa . ./. . . wb', difficulty: 3, note: 'Um caminho dá a volta no outro.' },
    { grid: '. wb . ./wb o . ./. . . ./. wa . wa', difficulty: 4, note: 'Quem passa pelo marco?' },
  ],
  light: [
    { grid: '. wa . ./. . . ./. . . ./. D wa .', base: '. wa . ./. . . ./o . . ./. D wa .', mask: '', difficulty: 2, note: 'Pérgola: a luz que passa pela treliça desenha o caminho no chão.' },
    { grid: '. . D ./. . wa ./. . . o/wa . . .', base: '. . D ./. . wa ./. . . o/wa . . .', mask: '..../..../??../??..', difficulty: 3, note: 'A areia cobriu um canto: o resto do caminho se deduz.' },
    { grid: '. wa . . ./. . . . ./. D wa . ./. # . . ./. . . . .', base: '. wa . . ./. o . . ./. D wa . o/. # . . ./. . . . .', mask: '', difficulty: 4, note: 'Metade do chão soterrada: a treliça, vista por baixo, mostra o resto.' },
    { grid: 'o . . . wb/wa . . . ./. . . . wb/. . D . ./. . . wa .', base: 'o . . . wb/wa . . . ./. . . . wb/. . D . ./. . . wa .', mask: '...../...../?????/?????/?????', difficulty: 5, note: 'Dois caminhos, a parte de baixo enterrada.' },
  ],
  tower: [
    { grid: '. . . ./. . wa ./. wa . ./. . D .', base: '. . . ./o . wa ./. wa . ./. . D .', mask: '', difficulty: 2, note: 'Do alto da torre: as lajes vitrificadas são o caminho.' },
    { grid: '. . . wa . ./. . . . D ./. . # . . ./. . . . . wa/wb . . . wb ./. . . . . .', base: '. . . wa . ./. . o . D ./. . # . . ./. . o . . wa/wb . . . wb ./. . . . . .', mask: '', difficulty: 4, note: 'Um toldo esconde um canto visto do alto: descer e olhar por baixo.' },
    { grid: '. o . . wb/. . . . ./wa # . . ./. . . . ./. wa . wb .', base: '. o . . wb/. . . . ./wa # . . ./. . . . ./. wa . wb .', mask: '...../...../...../.????/.????', difficulty: 5, note: 'Uma duna engoliu um canto: o caminho que falta se deduz.' },
  ],
  roof: [
    { grid: '. . . D/. o wa ./o . . wa/. . . .', hide: true, difficulty: 3, note: 'O painel está quase em branco: os marcos estão no chão, lá embaixo.' },
    { grid: '. . wa o ./. . . . D/. . . o o/. # . . ./. wa . . .', hide: true, difficulty: 4, note: 'Cinco por cinco, lido do teto.' },
    { grid: '. o wa D ./. . . . ./# . . . ./wa . . . o/o . . . .', hide: true, difficulty: 5, note: 'Marcos nos cantos.' },
    { grid: '. . . wb . wa/# D . o . ./. . . . . ./. wb . . . ./. . . . . ./. . o . wa .', hide: true, difficulty: 6, note: 'Dois caminhos no maior tabuleiro do pátio.' },
  ],
  heart: [
    { grid: '. . . . ./. . . . ./. wa o o ./# . . . o/# wa . . .', difficulty: 7, note: 'Coração: três marcos que parecem estar no caminho errado.' },
    { grid: '. o . . . ./D . # . . ./. . . o . ./. . o # wa ./wa . . . . ./. . . . . .', difficulty: 8, note: 'Coração: o caminho longo entre pedras.' },
    { grid: '. o . . . wb/. . . . . #/. . . . . o/. . . . . ./wb . . . . ./. wa wa . . D', difficulty: 8, note: 'Coração: dois poços colados e um caminho que dá a volta no tabuleiro.' },
  ],
};
let out = `/**
 * O Templo das Areias — Caminho: os dois poços de cada cor se ligam por um caminho de luz, um
 * ladrilho de largura, sem ramos, sem encostar em si mesmo nem em outro caminho; o caminho passa
 * pelos marcos; pedras e rebites escuros o bloqueiam. O portão ensina; as pérgolas, a torre e o
 * teto do santuário mostram parte dos caminhos no lugar; o coração pede tudo.
 * (gerado por tools/build-desert.ts)
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
`;
for (const [group, list] of Object.entries(G)) {
  out += `  ${group}: [\n`;
  list.forEach((sp, i) => {
    const id = `mosaic.${group}.${i + 1}`;
    const r = rows(sp.grid);
    const w = Math.max(...r.flatMap((x) => x.split(/\s+/).map((t) => t.length)));
    const grid = r.map((x) => '        ' + x.split(/\s+/).map((t) => t.padEnd(w)).join(' ').trimEnd()).join('\n');
    let target: string | undefined;
    if (sp.base !== undefined) {
      const sol = solOf(sp.base);
      const p0 = puzzle('b', { grid: rows(sp.base).join('\n'), difficulty: 1 });
      const m = (sp.mask ?? '').replace(/\//g, '');
      target = Array.from({ length: p0.h }, (_, y) => Array.from({ length: p0.w }, (_, x) => {
        const k = y * p0.w + x;
        if (p0.cells[k].hole) return '#';
        return m[k] === '?' ? '?' : String(sol[k]);
      }).join('')).join('/');
    }
    const def = puzzle(id, { grid: r.join('\n'), ...(target ? { target, targetDisplay: 'world' as const } : {}), ...(sp.hide ? { hideGlyphs: true } : {}), difficulty: sp.difficulty });
    const res = solve(def, { maxSolutions: 2 });
    if (res.solutions.length !== 1) throw new Error(`${id}: ${res.solutions.length} answers`);
    out += `    puzzle('${id}', {\n      grid: \`\n${grid}\n      \`,\n`;
    if (target) out += `      target: '${target}',\n      targetDisplay: 'world',\n`;
    if (sp.hide) out += `      hideGlyphs: true,\n`;
    out += `      difficulty: ${sp.difficulty},\n      note: ${JSON.stringify(sp.note).replace(/^"|"$/g, "'")},\n    }),\n`;
  });
  out += '  ],\n';
}
out += '  secret: [],\n};\n\nexport default P;\n';
writeFileSync('src/data/puzzles/mosaic.ts', out);
console.log('written');
