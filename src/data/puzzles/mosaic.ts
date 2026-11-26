/**
 * O Templo das Areias — Mosaico: o número conta os ladrilhos acesos na janela 3×3 em volta dele
 * (ele incluído). O portão ensina o idioma passo a passo; as pérgolas, a torre e o teto do
 * santuário o usam com o lugar (a luz no chão, lajes vistas do alto, números incrustados no pátio);
 * o coração exige o idioma inteiro.
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
  gate: [
    puzzle('mosaic.gate.1', {
      grid: `
        x1
      `,
      difficulty: 1,
      note: 'Só ele mesmo.',
    }),
    puzzle('mosaic.gate.2', {
      grid: `
        x2 .
      `,
      difficulty: 1,
      note: 'Ele e o vizinho.',
    }),
    puzzle('mosaic.gate.3', {
      grid: `
        . x3 .
      `,
      difficulty: 1,
      note: 'Os dois lados.',
    }),
    puzzle('mosaic.gate.4', {
      grid: `
        L x2
      `,
      difficulty: 1,
      note: 'O rebite aceso conta.',
    }),
    puzzle('mosaic.gate.5', {
      grid: `
        D x2 .
      `,
      difficulty: 1,
      note: 'O rebite escuro não acende.',
    }),
    puzzle('mosaic.gate.6', {
      grid: `
        x2 . x1
      `,
      difficulty: 1,
      note: 'Duas janelas lado a lado.',
    }),
    puzzle('mosaic.gate.7', {
      grid: `
        x0 . x1
      `,
      difficulty: 1,
      note: 'Zero: a janela inteira apagada.',
    }),
    puzzle('mosaic.gate.8', {
      grid: `
        x4 .
        .  .
      `,
      difficulty: 1,
      note: 'Também em cima e embaixo: no canto, quatro.',
    }),
    puzzle('mosaic.gate.9', {
      grid: `
        D x5 .
        .  . .
      `,
      difficulty: 1,
      note: 'Na borda, seis.',
    }),
    puzzle('mosaic.gate.10', {
      grid: `
        . .  .
        . x9 .
        . .  .
      `,
      difficulty: 1,
      note: 'Nove: a janela inteira acende.',
    }),
    puzzle('mosaic.gate.11', {
      grid: `
        x4 . x3
        .  . .
        x2 . x1
      `,
      difficulty: 1,
      note: 'Nas bordas a janela é cortada: no canto ela tem só quatro ladrilhos.',
    }),
    puzzle('mosaic.gate.12', {
      grid: `
        .  x6 .  .
        .  .  x8 .
        .  x8 .  .
        .  .  .  x1
      `,
      difficulty: 3,
      note: 'Portão: janelas quase cheias e um 1 solitário no canto.',
    }),
  ],
  light: [
    puzzle('mosaic.light.1', {
      grid: `
        . . .
        . . .
        . . .
      `,
      target: '101/010/101',
      targetDisplay: 'world',
      difficulty: 1,
      note: 'Pérgola: a treliça deixa passar o sol; os quadrados de luz no chão são o desenho.',
    }),
    puzzle('mosaic.light.2', {
      grid: `
        . .  .  .
        . .  x6 .
        . x6 .  .
        . .  x4 .
      `,
      target: '0110/1101/1011/0110',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'A areia cobriu um canto do chão: o que a luz não mostra, as janelas contam.',
    }),
    puzzle('mosaic.light.3', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '1011/0110/1101/1001',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'A areia cobriu metade do chão: a outra metade da luz se lê olhando a treliça por baixo.',
    }),
    puzzle('mosaic.light.4', {
      grid: `
        .  .  .  . .
        .  .  .  . .
        .  .  x8 . .
        x4 x6 x6 . .
        .  .  .  . .
      `,
      target: '10101/01110/11011/0???0/1???1',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'Uma flor de luz com o miolo de baixo enterrado: quatro janelas desenterram o resto.',
    }),
  ],
  tower: [
    puzzle('mosaic.tower.1', {
      grid: `
        . . .
        . . .
        . . .
      `,
      target: '110/101/011',
      targetDisplay: 'world',
      difficulty: 1,
      note: 'Do alto da torre: as lajes vitrificadas na areia são o desenho.',
    }),
    puzzle('mosaic.tower.2', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '1011/1101/0110/1001',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Um toldo esconde um canto das lajes visto do alto: é preciso descer e olhar por baixo.',
    }),
    puzzle('mosaic.tower.3', {
      grid: `
        .  .  .  .  .
        .  .  .  .  .
        x4 .  x5 .  .
        .  x5 .  .  x4
        .  .  .  .  .
      `,
      target: '11001/10011/01110/1????/1????',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'Uma duna engoliu as lajes do canto: as janelas do painel completam o desenho.',
    }),
  ],
  roof: [
    puzzle('mosaic.roof.1', {
      grid: `
        .  . x1
        x5 . .
        .  . x1
      `,
      hideGlyphs: true,
      difficulty: 3,
      note: 'O painel está em branco: os números estão incrustados no chão do pátio, lá embaixo.',
    }),
    puzzle('mosaic.roof.2', {
      grid: `
        x3 x3 .  .
        .  x4 x5 .
        x5 .  .  x1
        .  .  x2 .
      `,
      hideGlyphs: true,
      difficulty: 4,
      note: 'Quatro por quatro, lido do teto.',
    }),
    puzzle('mosaic.roof.3', {
      grid: `
        x2 x4 x4 .  .  .
        x4 .  .  x5 .  x2
        x3 .  x4 .  .  .
        .  .  .  x5 .  x4
        x0 .  x1 .  x5 .
      `,
      hideGlyphs: true,
      difficulty: 5,
      note: 'Seis por cinco, lido do teto: uma janela de zero no canto abre a conta.',
    }),
    puzzle('mosaic.roof.4', {
      grid: `
        .  .  .  x5 x3 .  .
        .  x3 .  .  .  .  x4
        .  .  x4 .  .  x4 .
        x3 .  .  x3 x5 x5 .
        x3 x5 x2 .  .  x6 .
        .  .  x1 .  .  .  .
      `,
      hideGlyphs: true,
      difficulty: 7,
      note: 'O maior tabuleiro do pátio: as janelas só se resolvem umas pelas outras, em cadeia.',
    }),
  ],
  heart: [
    puzzle('mosaic.heart.1', {
      grid: `
        .  .  .  .  .  .  .  x1
        x2 .  x6 .  x7 x7 .  .
        .  x3 .  .  .  x5 x4 .
        .  x3 x1 .  .  x2 .  x2
        .  x2 x2 .  .  .  .  x2
        x3 .  .  .  .  .  x3 x1
        .  .  .  .  .  x6 .  x2
        x1 .  x5 .  .  x5 .  .
      `,
      difficulty: 8,
      note: 'Coração do templo: um ornamento 8×8 sem atalhos.',
    }),
    puzzle('mosaic.heart.2', {
      grid: `
        .  .  .  .  x1 .  x3 .
        x5 .  x2 .  x1 x3 .  .
        .  .  .  x1 .  x4 .  x2
        .  .  x1 .  .  .  .  x1
        .  x1 .  .  .  x1 .  x1
        x2 .  x4 .  .  .  .  .
        x3 .  x3 x1 .  .  .  .
        x2 x3 .  .  x0 .  .  x4
      `,
      difficulty: 9,
      note: 'Coração do templo: janelas de um e de zero espalhadas — cada vazio tem que ser provado.',
    }),
    puzzle('mosaic.heart.3', {
      grid: `
        .  x2 .  x3 .  .  x2 .  x0
        .  .  .  .  x2 .  .  .  .
        x2 .  x2 .  .  x5 x2 x4 .
        .  x4 x3 .  .  .  .  .  .
        x2 .  x5 .  .  x8 .  .  .
        .  .  .  .  .  .  .  .  x3
        x5 .  x6 x7 .  .  x6 x8 .
        .  x7 x4 .  .  .  x4 .  x5
        .  .  .  x2 .  .  .  x4 .
      `,
      difficulty: 9,
      note: 'Coração do templo: o grande ornamento 9×9.',
    }),
  ],
  secret: [],
};

export default P;
