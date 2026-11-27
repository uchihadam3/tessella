/**
 * O Templo das Areias — o sol mostra o caminho. Cada painel é um caminho de luz entre os seus dois
 * poços; a resposta é sempre o caminho que o sol desenha (pelos furos de uma cobertura, de uma
 * pérgola, refletido numa placa, ou a sombra de vigas). Só o primeiro mostra tudo; os outros escondem
 * uma parte de um jeito diferente. (gerado por tools/build-desert.ts)
 */
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

const P: AreaPuzzles = {
  gate: [
    puzzle('mosaic.gate.1', {
      grid: `
        wa .  .
        .  .  .
        .  .  wa
      `,
      target: '110/010/011',
      targetDisplay: 'world',
      difficulty: 1,
      note: 'O sol passa pelos furos da cobertura e marca o caminho no próprio painel.',
    }),
    puzzle('mosaic.gate.2', {
      grid: `
        wa .  .  .
        .  .  .  .
        .  .  .  .
        .  .  .  wa
      `,
      target: '1000/1110/0010/0011',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Uma folha de palmeira tapa parte da cobertura: os furos que faltam se veem olhando para cima.',
    }),
    puzzle('mosaic.gate.3', {
      grid: `
        wa .  .  .
        .  .  .  .
        .  .  .  .
        wa .  .  .
      `,
      target: '1111/0001/0001/1111',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'Um pano cobre a cobertura inteira: só os furos, vistos por baixo, mostram o caminho.',
    }),
  ],
  light: [
    puzzle('mosaic.light.1', {
      grid: `
        .  wa .  .
        .  .  .  .
        .  .  .  .
        .  .  wa .
      `,
      target: '0100/0111/0001/0011',
      targetDisplay: 'world',
      difficulty: 2,
      note: 'A luz da pérgola cai no chão, ao lado do painel; os poços no piso dizem que aquele chão é o painel.',
    }),
    puzzle('mosaic.light.2', {
      grid: `
        wa .  .  .
        .  .  .  .
        .  .  .  .
        .  .  .  wa
      `,
      target: '1100/0100/0111/0001',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'Uma estela faz sombra num pedaço do caminho; atrás dela o caminho inteiro está gravado.',
    }),
    puzzle('mosaic.light.3', {
      grid: `
        wa .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  wa
      `,
      target: '11100/00100/00111/00001/00001',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'A areia cobre um trecho: o caminho que falta é o único que liga as pontas sem encostar.',
    }),
    puzzle('mosaic.light.4', {
      grid: `
        .  .  .  .  wa
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        wa .  .  .  .
      `,
      target: '00111/00100/01100/01000/11000',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'O chão está todo soterrado: só a treliça, vista por baixo, mostra o caminho.',
    }),
    puzzle('mosaic.light.5', {
      grid: `
        .  .  .  wa
        .  .  .  .
        .  .  .  .
        .  .  .  .
        wa .  .  .
      `,
      target: '0011/0010/0110/0100/1100',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'A pérgola encosta num muro: as primeiras fileiras da luz sobem pela parede.',
    }),
  ],
  court: [
    puzzle('mosaic.court.1', {
      grid: `
        wa .  .  wa
        .  .  .  .
        .  .  .  .
        .  .  .  .
      `,
      target: '1001/1001/1111/0000',
      targetDisplay: 'world',
      difficulty: 3,
      note: 'Uma placa de bronze reflete o sol: o caminho aparece longe, na parede do santuário.',
    }),
    puzzle('mosaic.court.2', {
      grid: `
        wa .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  wa
      `,
      target: '10000/11100/00100/00111/00001',
      targetDisplay: 'world',
      difficulty: 5,
      note: 'Duas treliças, uma sobre a outra: só passa luz onde as duas estão abertas.',
    }),
    puzzle('mosaic.court.3', {
      grid: `
        .  .  .  .  .
        .  .  .  .  .
        wa .  .  .  wa
        .  .  .  .  .
        .  .  .  .  .
      `,
      target: '00000/01110/11011/00000/00000',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'Ladrilhos polidos que só brilham vistos de um ponto: as pegadas no chão.',
    }),
    puzzle('mosaic.court.4', {
      grid: `
        .  .  .  .  wa
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        wa .  .  .  .
      `,
      target: '00011/00110/01100/11000/10000',
      targetDisplay: 'world',
      difficulty: 4,
      note: 'Vigas de pedra no alto: desta vez o caminho é a sombra.',
    }),
  ],
  heart: [
    puzzle('mosaic.heart.1', {
      grid: `
        .  .  .  .  .
        .  .  .  .  .
        wa .  .  .  .
        .  .  .  .  .
        wa .  .  .  .
      `,
      target: '00111/11101/10001/00111/11100',
      targetDisplay: 'world',
      difficulty: 7,
      note: 'Coração: a estela faz sombra em metade do caminho e a areia cobriu o pé da gravação.',
    }),
    puzzle('mosaic.heart.2', {
      grid: `
        .  wa .  .  .
        .  .  .  .  .
        .  .  .  .  .
        .  .  .  .  .
        wa .  .  .  .
      `,
      target: '01000/01110/00010/01110/11000',
      targetDisplay: 'world',
      difficulty: 8,
      note: 'Coração: duas treliças sobre um chão todo soterrado.',
    }),
    puzzle('mosaic.heart.3', {
      grid: `
        wa .  .  .  .  .
        .  .  .  .  .  .
        .  .  .  .  .  .
        .  .  .  .  .  .
        .  .  .  .  .  .
        .  wa .  .  .  .
      `,
      target: '111000/001000/001110/000010/011110/010000',
      targetDisplay: 'world',
      difficulty: 8,
      note: 'Coração: a sombra das vigas, com a areia cobrindo o meio.',
    }),
  ],
  secret: [],
};

export default P;

/** What each panel lets you see (for the world builder): '.' visible, '?' hidden. */
export const DESERT_SEEN: Record<string, string> = {
  "mosaic.light.3": "...../...??/...??/...../.....",
  "mosaic.heart.1": "...../...../...../...??/...??",
  "mosaic.heart.3": "....../....../..????/..????/....../......"
};
