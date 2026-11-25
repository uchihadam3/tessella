/** Pretty-printing helpers for puzzles (ASCII previews) and source emission. */
import { GEM_TO_LETTER, TWIN_TO_LETTER, shapeToArt, toCompact } from '../../src/puzzle/board';
import { isInversionSymmetric, solve } from '../../src/puzzle/solver';
import type { Cell, PuzzleDef } from '../../src/puzzle/types';

export function cellToken(c: Cell): string {
  if (c.hole) return '#';
  let t = c.mute ? '~' : '';
  const g = c.glyph;
  if (c.lock === 1 && g?.kind !== 'beacon') t += 'L';
  if (c.lock === 0) t += 'D';
  if (g) {
    switch (g.kind) {
      case 'gem': t += '@' + GEM_TO_LETTER[g.color]; break;
      case 'measure': t += 'm' + g.n; break;
      case 'contour': t += 'c' + g.n; break;
      case 'mosaic': t += 'x' + g.n; break;
      case 'beacon': t += 'b' + g.n; break;
      case 'twin': t += 't' + TWIN_TO_LETTER[g.symbol] + (g.mirror ? "'" : ''); break;
      case 'mold': t += 'f[' + shapeToArt(g.cells) + ']' + (g.free ? '*' : ''); break;
    }
  }
  if (t === '' || t === '~') t += '.';
  if (c.echo?.length) t += '{' + c.echo.join(',') + '}';
  return t;
}

/** Side-by-side: glyph grid and a solution (█ lit, · dark). */
export function ascii(p: PuzzleDef, sol?: ArrayLike<number>): string {
  const toks = p.cells.map(cellToken);
  const wTok = Math.max(...toks.map((t) => t.length), 2);
  const lines: string[] = [];
  if (p.colClues) lines.push(' '.repeat(10) + p.colClues.map((c) => (c === null ? '-' : c.length ? c.join('.') : '0').padEnd(wTok + 1)).join(''));
  for (let r = 0; r < p.h; r++) {
    const rc = p.rowClues ? (p.rowClues[r] === null ? '-' : p.rowClues[r]!.length ? p.rowClues[r]!.join(' ') : '0') : '';
    let line = rc.padStart(9) + ' ';
    for (let c = 0; c < p.w; c++) line += toks[r * p.w + c].padEnd(wTok + 1);
    if (sol) {
      line += '   ';
      for (let c = 0; c < p.w; c++) {
        const i = r * p.w + c;
        line += p.cells[i].hole ? ' ' : sol[i] ? '█' : '·';
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Emits `puzzle('id', {...})` source code. */
export function toSource(p: PuzzleDef, indent = '  '): string {
  const c = toCompact(p);
  const lines = c.grid.split('\n');
  const width: number[] = [];
  const rows = lines.map((l) => l.split(' '));
  rows.forEach((r) => r.forEach((t, i) => (width[i] = Math.max(width[i] ?? 0, t.length))));
  const grid = rows.map((r) => indent + '    ' + r.map((t, i) => t.padEnd(width[i])).join(' ').trimEnd()).join('\n');
  const parts: string[] = [`${indent}puzzle('${p.id}', {`, `${indent}  grid: \`\n${grid}\n${indent}  \`,`];
  if (c.shapes) parts.push(`${indent}  shapes: ${JSON.stringify(c.shapes).replace(/"([A-Z]\w*)":/g, '$1: ').replace(/"/g, "'")},`);
  if (c.rows) parts.push(`${indent}  rows: '${c.rows}',`);
  if (c.cols) parts.push(`${indent}  cols: '${c.cols}',`);
  if (c.target) parts.push(`${indent}  target: '${c.target}',`);
  if (p.targetDisplay) parts.push(`${indent}  targetDisplay: '${p.targetDisplay}',`);
  if (c.init) parts.push(`${indent}  init: '${c.init}',`);
  if (c.wrap) parts.push(`${indent}  wrap: true,`);
  if (c.mirror) parts.push(`${indent}  mirror: '${c.mirror}',`);
  parts.push(`${indent}  difficulty: ${p.difficulty ?? 5},`);
  parts.push(`${indent}  note: ${JSON.stringify(p.note ?? '')},`);
  parts.push(`${indent}}),`);
  return parts.join('\n');
}

/** Solutions (capped) and the forced-tile map. */
export function analyze(p: PuzzleDef, cap = 64): { count: string; forced: string; first?: Uint8Array; nodes: number } {
  const res = solve(p, { maxSolutions: cap, maxNodes: 2_000_000, timeLimitMs: 60_000, breakSymmetry: true });
  const sols = res.solutions;
  let forced = '';
  for (let r = 0; r < p.h; r++) {
    for (let c = 0; c < p.w; c++) {
      const i = r * p.w + c;
      if (p.cells[i].hole) { forced += ' '; continue; }
      if (!sols.length) { forced += '?'; continue; }
      const v = sols[0][i];
      forced += sols.every((s) => s[i] === v) ? (v ? '█' : '·') : '?';
    }
    forced += '\n';
  }
  const count = `${sols.length}${sols.length >= cap ? '+' : ''}${res.complete ? '' : '?'}${isInversionSymmetric(p) ? '~' : ''}`;
  return { count, forced, first: sols[0], nodes: res.nodes };
}
