/**
 * O Despertar (prólogo) — a interface sem palavras: acender, selar, rebites, buracos,
 * ler o desenho no mundo e, por fim, deduzir o preenchimento só pelas bordas de luz.
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
  cave: [
    puzzle('prologue.cave.1', {
      grid: `
        .
      `,
      target: '1',
      difficulty: 1,
      note: 'Primeira luz: clicar no ladrilho acende; o selo confirma.',
    }),
    puzzle('prologue.cave.2', {
      grid: `
        . . .
      `,
      target: '010',
      difficulty: 1,
      note: 'Só o que a placa mostra: acender demais também é errar.',
    }),
    puzzle('prologue.cave.3', {
      grid: `
        L . .
        . . D
      `,
      target: '110/010',
      difficulty: 1,
      note: 'Rebites não mudam — e fazem parte do desenho.',
    }),
    puzzle('prologue.cave.4', {
      grid: `
        . # .
        . . .
        . # .
      `,
      target: '1#1/111/1#1',
      difficulty: 1,
      note: 'Buracos não têm ladrilho: o desenho contorna o vazio.',
    }),
    puzzle('prologue.cave.5', {
      grid: `
        . . .
        . . .
        . . .
      `,
      target: '010/111/010',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Não há placa: a luz que entra pela janela desenha a resposta no chão.',
    }),
  ],
  shore: [
    puzzle('prologue.shore.1', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '0110/1001/1001/0110',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'O círculo de pedras de pé na praia é o desenho.',
    }),
  ],
  gate: [
    puzzle('prologue.gate.1', {
      grid: `
        . . .
        . . .
        . . .
      `,
      target: '110/110/000',
      targetDisplay: 'outline',
      difficulty: 2,
      note: 'A placa mostra só as bordas: a luz preenche o que a linha cerca.',
    }),
    puzzle('prologue.gate.2', {
      grid: `
        . . . .
        . . . .
        . . . .
        . . . .
      `,
      target: '1111/1001/1001/1111',
      targetDisplay: 'outline',
      difficulty: 3,
      note: 'Bordas por dentro e por fora: um anel, não um bloco.',
    }),
  ],
  secret: [],
};

export default P;
