const grid = (w: number, h: number, tok: string) => Array.from({ length: h }, () => Array(w).fill(tok).join(' ')).join('\n');
export const CANDIDATES: Record<string, Record<string, unknown>> = {
  'g2out': { grid: grid(4, 4, '.'), target: '0110/1111/1111/0110', targetDisplay: 'outline', note: '' },
  't3out': { grid: '. . . . .\n. . . . .\n. . # . .\n. . . . .\n. . . . .', target: '11011/10001/00#00/10001/11011', targetDisplay: 'outline', note: '' },
  't4|': { grid: grid(5, 5, '.{|}'), target: '11001/10011/01110/11001/10011', note: '' },
  't4-': { grid: grid(5, 5, '.{-}'), target: '11001/10011/01110/11001/10011', note: '' },
  'l3-': { grid: grid(3, 3, '.{-}'), target: '010/111/010', note: '' },
  'h1x': { grid: grid(6, 6, '.{x}'), target: '110001/011001/001001/001001/001001/001001', note: '' },
  'h2+': { grid: grid(6, 6, '.{+}'), target: '111111/000000/000000/111110/100011/000001', note: '' },
  'h3*': { grid: grid(7, 7, '.{*}'), target: '1000000/1000111/1001100/1001000/1001000/1001001/1001001', note: '' },
};
