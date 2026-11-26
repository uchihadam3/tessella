/**
 * O Templo das Areias — Caminho: os dois poços de cada cor se ligam por um caminho de luz, um
 * ladrilho de largura, sem ramos, sem encostar em si mesmo nem em outro caminho; o caminho passa
 * pelos marcos; pedras e rebites escuros o bloqueiam. O portão ensina; as pérgolas, a torre e o
 * teto do santuário mostram parte dos caminhos no lugar; o coração pede tudo.
 * (gerado por tools/build-desert.ts)
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
  gate: [
    puzzle('mosaic.gate.1', {
      grid: `
        wa .  wa
      `,
      difficulty: 1,
      note: 'Ligar os dois poços com luz.',
    }),
    puzzle('mosaic.gate.2', {
      grid: `
        wa .  .  .  wa
      `,
      difficulty: 1,
      note: 'Um caminho mais longo.',
    }),
    puzzle('mosaic.gate.3', {
      grid: `
        wa .  o  .  wa
      `,
      difficulty: 1,
      note: 'O marco fica no caminho.',
    }),
    puzzle('mosaic.gate.4', {
      grid: `
        wa #  wa
        .  .  .
      `,
      difficulty: 1,
      note: 'A pedra obriga a dar a volta.',
    }),
    puzzle('mosaic.gate.5', {
      grid: `
        wa D  wa
        .  .  .
      `,
      difficulty: 1,
      note: 'O rebite escuro também bloqueia.',
    }),
    puzzle('mosaic.gate.6', {
      grid: `
        wa .  o
        .  #  .
        .  .  wa
      `,
      difficulty: 2,
      note: 'O marco escolhe o lado da pedra.',
    }),
    puzzle('mosaic.gate.7', {
      grid: `
        wa .  o
        .  .  .
        .  .  wa
      `,
      difficulty: 2,
      note: 'O marco no canto puxa o caminho para a borda.',
    }),
    puzzle('mosaic.gate.8', {
      grid: `
        wa .  .
        D  D  .
        wa .  .
      `,
      difficulty: 2,
      note: 'Contornar a parede de rebites.',
    }),
    puzzle('mosaic.gate.9', {
      grid: `
        wa .  .  .
        #  #  #  .
        wa .  .  .
      `,
      difficulty: 2,
      note: 'O caminho não encosta nele mesmo: dá a volta inteira.',
    }),
    puzzle('mosaic.gate.10', {
      grid: `
        wa .  wb
        .  .  .
        wa .  wb
      `,
      difficulty: 2,
      note: 'Duas cores, dois caminhos, que não se tocam.',
    }),
    puzzle('mosaic.gate.11', {
      grid: `
        wa .  .  wa
        .  .  .  .
        wb .  .  wb
      `,
      difficulty: 3,
      note: 'Dois caminhos paralelos.',
    }),
    puzzle('mosaic.gate.12', {
      grid: `
        .  wa .  .  .
        o  .  .  .  o
        .  .  .  .  .
        .  o  .  #  .
        D  .  .  wa .
      `,
      difficulty: 4,
      note: 'Portão: três marcos, uma pedra e um rebite.',
    }),
  ],
  light: [
    puzzle('mosaic.light.1', {
      grid: `
        .  .  .  .
        .  .  wa .
        .  .  .  .
        #  wa .  .
      `,
      target: '1110/1010/1100/#100',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Pérgola: a luz que passa pela treliça desenha o caminho no chão.',
    }),
    puzzle('mosaic.light.2', {
      grid: `
        .  .  .  .
        wa .  .  .
        .  wa .  .
        .  #  .  .
      `,
      target: '1111/10??/01??/0#00',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'A areia cobriu um canto: o resto do caminho se deduz.',
    }),
    puzzle('mosaic.light.3', {
      grid: `
        .  wa .  .  .
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  #  .
        D  .  .  wa .
      `,
      target: '11000/10111/10101/111#1/00011',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'Metade do chão soterrada: a treliça, vista por baixo, mostra o resto.',
    }),
    puzzle('mosaic.light.4', {
      grid: `
        o  .  .  .  wb
        wa .  .  .  .
        .  .  .  .  wb
        .  .  D  .  .
        .  .  .  wa .
      `,
      target: '11101/10101/?????/?????/?????',
      targetDisplay: 'world',
      difficulty: 5,
      note: 'Dois caminhos, a parte de baixo enterrada.',
    }),
  ],
  tower: [
    puzzle('mosaic.tower.1', {
      grid: `
        .  .  .  .
        .  .  wa .
        .  wa .  .
        .  .  D  .
      `,
      target: '1110/1010/1100/0000',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Do alto da torre: as lajes vitrificadas são o caminho.',
    }),
    puzzle('mosaic.tower.2', {
      grid: `
        .  .  .  wa .  .
        .  .  .  .  D  .
        .  .  #  .  .  .
        .  .  .  .  .  wa
        wb .  .  .  wb .
        .  .  .  .  .  .
      `,
      target: '001100/011000/01#111/011101/100010/111110',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'Um toldo esconde um canto visto do alto: descer e olhar por baixo.',
    }),
    puzzle('mosaic.tower.3', {
      grid: `
        .  o  .  .  wb
        .  .  .  .  .
        wa #  .  .  .
        .  .  .  .  .
        .  wa .  wb .
      `,
      target: '11101/10101/1#101/0????/0????',
      targetDisplay: 'world',
      difficulty: 5,
      note: 'Uma duna engoliu um canto: o caminho que falta se deduz.',
    }),
  ],
  roof: [
    puzzle('mosaic.roof.1', {
      grid: `
        .  o  .  .
        .  .  wa .
        .  .  .  .
        #  wa .  .
      `,
      hideGlyphs: true,
      difficulty: 3,
      note: 'O painel está quase em branco: os marcos estão no chão, lá embaixo.',
    }),
    puzzle('mosaic.roof.2', {
      grid: `
        .  .  wa o  .
        .  .  .  .  D
        .  .  .  o  o
        .  #  .  .  .
        .  wa .  .  .
      `,
      hideGlyphs: true,
      difficulty: 4,
      note: 'Cinco por cinco, lido do teto.',
    }),
    puzzle('mosaic.roof.3', {
      grid: `
        .  o  wa D  .
        .  .  .  .  .
        #  .  .  .  .
        wa .  .  .  o
        o  .  .  .  .
      `,
      hideGlyphs: true,
      difficulty: 5,
      note: 'Marcos nos cantos.',
    }),
    puzzle('mosaic.roof.4', {
      grid: `
        .  .  .  wb .  wa
        #  D  .  o  .  .
        .  .  .  .  .  .
        .  wb .  .  .  .
        .  .  .  .  .  .
        .  .  o  .  wa .
      `,
      hideGlyphs: true,
      difficulty: 6,
      note: 'Dois caminhos no maior tabuleiro do pátio.',
    }),
  ],
  heart: [
    puzzle('mosaic.heart.1', {
      grid: `
        .  .  .  .  .
        .  .  .  .  .
        .  wa o  o  .
        #  .  .  .  o
        #  wa .  .  .
      `,
      difficulty: 7,
      note: 'Coração: três marcos que parecem estar no caminho errado.',
    }),
    puzzle('mosaic.heart.2', {
      grid: `
        .  o  .  .  .  .
        D  .  #  .  .  .
        .  .  .  o  .  .
        .  .  o  #  wa .
        wa .  .  .  .  .
        .  .  .  .  .  .
      `,
      difficulty: 8,
      note: 'Coração: o caminho longo entre pedras.',
    }),
    puzzle('mosaic.heart.3', {
      grid: `
        .  o  .  .  .  wb
        .  .  .  .  .  #
        .  .  .  .  .  o
        .  .  .  .  .  .
        wb .  .  .  .  .
        .  wa wa .  .  D
      `,
      difficulty: 8,
      note: 'Coração: dois poços colados e um caminho que dá a volta no tabuleiro.',
    }),
  ],
  secret: [],
};

export default P;
