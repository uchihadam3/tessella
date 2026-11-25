/**
 * Placeholder content so the game builds before the real puzzle sets exist.
 * Each placeholder is a small target-plate puzzle with the right id and group size.
 */
import { AREA_BY_ID, type AreaId } from '../areas';
import { puzzle } from '../../puzzle/board';
import type { AreaPuzzles } from './types';

export function placeholderArea(id: AreaId): AreaPuzzles {
  const out: AreaPuzzles = {};
  for (const g of AREA_BY_ID[id].groups) {
    out[g.key] = [];
    for (let i = 1; i <= g.count; i++) {
      const n = 2 + ((i + g.key.length) % 3);
      const rows: string[] = [];
      const target: string[] = [];
      for (let r = 0; r < n; r++) {
        rows.push(Array(n).fill('.').join(' '));
        let t = '';
        for (let c = 0; c < n; c++) t += (r + c + i) % 2 === 0 ? '1' : '0';
        target.push(t);
      }
      out[g.key].push(puzzle(`${id}.${g.key}.${i}`, { grid: rows.join('\n'), target: target.join('/') }));
    }
  }
  out.secret = [puzzle(`${id}.secret`, { grid: '. . .\n. . .\n. . .', target: '010/111/010' })];
  return out;
}
