/** O Templo das Areias — Mosaico: N ladrilhos acesos na janela 3x3 centrada no glifo. */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
  // <hand>
  intro: [
    puzzle('mosaic.intro.1', {
      grid: `
        x1
      `,
      difficulty: 1,
      note: 'Só ele mesmo.',
    }),
    puzzle('mosaic.intro.2', {
      grid: `
        x2 .
      `,
      difficulty: 1,
      note: 'Ele e o vizinho.',
    }),
    puzzle('mosaic.intro.3', {
      grid: `
        . x2
      `,
      difficulty: 1,
      note: 'O vizinho do outro lado.',
    }),
    puzzle('mosaic.intro.4', {
      grid: `
        . x3 .
      `,
      difficulty: 1,
      note: 'Os dois lados.',
    }),
    puzzle('mosaic.intro.5', {
      grid: `
        L x2
      `,
      difficulty: 1,
      note: 'O rebite aceso conta.',
    }),
    puzzle('mosaic.intro.6', {
      grid: `
        L . x2
      `,
      difficulty: 1,
      note: 'O rebite longe não conta.',
    }),
    puzzle('mosaic.intro.7', {
      grid: `
        D x2 .
      `,
      difficulty: 1,
      note: 'O rebite escuro não acende.',
    }),
    puzzle('mosaic.intro.8', {
      grid: `
        x2 . x1
      `,
      difficulty: 1,
      note: 'Duas janelas lado a lado.',
    }),
    puzzle('mosaic.intro.9', {
      grid: `
        x2 . x2 D
      `,
      difficulty: 1,
      note: 'O vizinho é dos dois.',
    }),
    puzzle('mosaic.intro.10', {
      grid: `
        x2 . x3 .
      `,
      difficulty: 1,
      note: 'Uma janela inteira acesa ao lado de outra.',
    }),
    puzzle('mosaic.intro.11', {
      grid: `
        x0 . x1
      `,
      difficulty: 1,
      note: 'Zero: a janela inteira apagada.',
    }),
    puzzle('mosaic.intro.12', {
      grid: `
        x4 .
        .  .
      `,
      difficulty: 1,
      note: 'Também em cima e embaixo: no canto, quatro.',
    }),
    puzzle('mosaic.intro.13', {
      grid: `
        x3 .
        D  .
      `,
      difficulty: 1,
      note: 'No canto, com um rebite escuro.',
    }),
    puzzle('mosaic.intro.14', {
      grid: `
        D x5 .
        .  . .
      `,
      difficulty: 1,
      note: 'Na borda, seis.',
    }),
    puzzle('mosaic.intro.15', {
      grid: `
        x4 . .
        .  . x2
      `,
      difficulty: 1,
      note: 'Duas janelas que se cruzam.',
    }),
    puzzle('mosaic.intro.16', {
      grid: `
        . .  .
        . x9 .
        . .  .
      `,
      difficulty: 1,
      note: 'Nove: a janela inteira acende.',
    }),
    puzzle('mosaic.intro.17', {
      grid: `
        x4 . x3
        .  . .
        x2 . x1
      `,
      difficulty: 1,
      note: 'Nas bordas a janela é cortada: no canto ela tem só quatro ladrilhos.',
    }),
    puzzle('mosaic.intro.18', {
      grid: `
        .  x0 .  .
        .  x2 x3 .
        .  x3 .  x5
        .  .  .  .
      `,
      difficulty: 1,
      note: 'Zero apaga a janela inteira; o que sobra para os vizinhos fica contado.',
    }),
    puzzle('mosaic.intro.19', {
      grid: `
        .  .  .  x2 .
        .  x0 x3 .  .
        .  .  .  x2 .
      `,
      difficulty: 1,
      note: 'Janelas vizinhas dividem colunas: o 3 só pode estar na coluna que o zero não vê.',
    }),
    puzzle('mosaic.intro.20', {
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
  // </hand>
  // Scenery: the answer (or its numbers) is in the place itself.
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
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '1100/1110/0111/0011',
      targetDisplay: 'world',
      difficulty: 1,
      note: 'Pérgola maior: a faixa de luz atravessa o chão na diagonal.',
    }),
    puzzle('mosaic.light.3', {
      grid: `
        . .  .  .
        . .  x6 .
        . x6 .  .
        . .  x4 .
      `,
      target: '0110/1101/10??/01??',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'A areia cobriu um canto do chão: o que a luz não mostra, as janelas contam.',
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
  // </gen>
};

export default P;
