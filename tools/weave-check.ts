/** Checks nonogram pictures: npx tsx tools/weave-check.ts "#...#/.#.#./..#../.###./.###." ["..."] */
import { puzzle } from '../src/puzzle/board';
import { solve } from '../src/puzzle/solver';
import { ascii } from './lib/show';

export function weaveFromPicture(id: string, pic: string, holes = ''): ReturnType<typeof puzzle> {
  const rows = pic.split('/');
  const h = rows.length;
  const w = rows[0].length;
  const hole = (r: number, c: number) => holes.split('/')[r]?.[c] === '#';
  const runs = (cells: string[]) => {
    const out: number[] = [];
    let cur = 0;
    for (const ch of cells) {
      if (ch === '#') cur++;
      else if (cur) { out.push(cur); cur = 0; }
    }
    if (cur) out.push(cur);
    return out.length ? out.join(' ') : '0';
  };
  const grid: string[] = [];
  for (let r = 0; r < h; r++) {
    const toks: string[] = [];
    for (let c = 0; c < w; c++) toks.push(hole(r, c) ? '#' : '.');
    grid.push(toks.join(' '));
  }
  const rowClues = rows.map((row, r) => runs([...row].map((ch, c) => (hole(r, c) ? '.' : ch))));
  const colClues: string[] = [];
  for (let c = 0; c < w; c++) colClues.push(runs(rows.map((row, r) => (hole(r, c) ? '.' : row[c]))));
  return puzzle(id, { grid: grid.join('\n'), rows: rowClues.join('|'), cols: colClues.join('|') });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const pic of process.argv.slice(2)) {
    const [img, holes] = pic.split('@');
    const p = weaveFromPicture('w', img, holes ?? '');
    const res = solve(p, { maxSolutions: 3, maxNodes: 500000 });
    console.log(`\n${img}  ->  sols=${res.solutions.length}${res.complete ? '' : '?'} nodes=${res.nodes} prop=${res.propagationOnly}`);
    console.log(`rows: '${p.rowClues!.map((c) => (c && c.length ? c.join(' ') : '0')).join('|')}'`);
    console.log(`cols: '${p.colClues!.map((c) => (c && c.length ? c.join(' ') : '0')).join('|')}'`);
    if (res.solutions.length > 1) console.log(ascii(p, res.solutions[1]));
  }
}
