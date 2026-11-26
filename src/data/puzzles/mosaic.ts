/**
 * O Templo das Areias — desenhos para acender. Alguns estão numa placa ao lado do painel (inteiros
 * ou só as bordas); outros, no próprio lugar: a luz que as pérgolas deixam passar, lajes vistas do
 * alto da torre, tabuleiros no chão vistos do teto do santuário, janelas no mosaico do pátio. Os
 * mais difíceis viram também os vizinhos a cada toque.
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
  gate: [
    puzzle('mosaic.gate.1', {
      grid: `
        . . .
        . . .
        . . .
      `,
      target: '110/010/011',
      difficulty: 1,
      note: 'A placa ao lado mostra o desenho: copiar.',
    }),
    puzzle('mosaic.gate.2', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '0110/1111/1111/0110',
      targetDisplay: 'outline',
      difficulty: 2,
      note: 'A placa mostra só as bordas: um círculo de luz.',
    }),
    puzzle('mosaic.gate.3', {
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
  ],
  light: [
    puzzle('mosaic.light.1', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '1100/1110/0111/0011',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Pérgola maior: a faixa de luz atravessa o chão na diagonal.',
    }),
    puzzle('mosaic.light.2', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '0110/1101/1011/0110',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'A areia cobriu um canto do chão: o resto da luz se lê olhando a treliça por baixo.',
    }),
    puzzle('mosaic.light.3', {
      grid: `
        .{-} .{-} .{-}
        .{-} .{-} .{-}
        .{-} .{-} .{-}
      `,
      target: '010/111/010',
      difficulty: 3,
      note: 'Cada ladrilho aceso vira também os vizinhos da mesma linha: achar a ordem certa.',
    }),
    puzzle('mosaic.light.4', {
      grid: `
        .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+}
      `,
      target: '1001/0110/0110/1001',
      targetDisplay: 'world',
      difficulty: 5,
      note: 'O desenho está no chão da pérgola; cada toque vira o ladrilho e seus quatro vizinhos.',
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
      difficulty: 2,
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
      difficulty: 4,
      note: 'Um toldo esconde um canto das lajes visto do alto: é preciso descer e olhar por baixo.',
    }),
    puzzle('mosaic.tower.3', {
      grid: `
        . . . . .
        . . . . .
        . . # . .
        . . . . .
        . . . . .
      `,
      target: '11011/10001/00#00/10001/11011',
      targetDisplay: 'outline',
      difficulty: 5,
      note: 'Só as bordas, com um buraco no meio: quatro cantos e quatro hastes.',
    }),
    puzzle('mosaic.tower.4', {
      grid: `
        .{|} .{|} .{|} .{|} .{|}
        .{|} .{|} .{|} .{|} .{|}
        .{|} .{|} .{|} .{|} .{|}
        .{|} .{|} .{|} .{|} .{|}
        .{|} .{|} .{|} .{|} .{|}
      `,
      target: '11001/10011/01110/11001/10011',
      targetDisplay: 'world',
      difficulty: 6,
      note: 'O último campo: cada toque vira também os vizinhos de cima e de baixo.',
    }),
  ],
  roof: [
    puzzle('mosaic.roof.1', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '0110/1111/1001/0110',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'Da beirada do teto: o tabuleiro de ladrilhos lá embaixo é o desenho.',
    }),
    puzzle('mosaic.roof.2', {
      grid: `
        .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x}
      `,
      target: '10001/01010/00100/01010/10001',
      targetDisplay: 'world',
      difficulty: 6,
      note: 'Cada toque vira os vizinhos nas diagonais.',
    }),
    puzzle('mosaic.roof.3', {
      grid: `
        .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+}
      `,
      target: '01110/10001/10101/10001/01110',
      targetDisplay: 'world',
      difficulty: 7,
      note: 'Cada toque vira os quatro vizinhos: um anel com o centro aceso.',
    }),
    puzzle('mosaic.roof.4', {
      grid: `
        .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*}
      `,
      target: '110011/100001/001100/001100/100001/110011',
      targetDisplay: 'world',
      difficulty: 8,
      note: 'Cada toque vira os oito vizinhos.',
    }),
  ],
  heart: [
    puzzle('mosaic.heart.1', {
      grid: `
        .{x} .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x} .{x}
        .{x} .{x} .{x} .{x} .{x} .{x}
      `,
      target: '110001/011001/001001/001001/001001/001001',
      targetDisplay: 'world',
      difficulty: 8,
      note: 'Coração: a janela de ouro no mosaico do pátio; cada toque vira as diagonais.',
    }),
    puzzle('mosaic.heart.2', {
      grid: `
        .{+} .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+} .{+}
        .{+} .{+} .{+} .{+} .{+} .{+}
      `,
      target: '111111/000000/000000/111110/100011/000001',
      targetDisplay: 'world',
      difficulty: 9,
      note: 'Coração: a janela do meio; cada toque vira os quatro vizinhos.',
    }),
    puzzle('mosaic.heart.3', {
      grid: `
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
        .{*} .{*} .{*} .{*} .{*} .{*} .{*}
      `,
      target: '1000000/1000111/1001100/1001000/1001000/1001001/1001001',
      targetDisplay: 'world',
      difficulty: 10,
      note: 'Coração: a maior janela; cada toque vira os oito vizinhos.',
    }),
  ],
  secret: [],
};

export default P;
