/**
 * Placeholder content so the game builds before the real puzzle sets exist.
 * Each placeholder is a small target-plate puzzle with the right id and group size.
 */
import { AREA_BY_ID, SECRET_COUNTS, type AreaId } from '../areas';
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
  const ns = SECRET_COUNTS[id] ?? 0;
  out.secret = [];
  for (let i = 1; i <= ns; i++) out.secret.push(puzzle(`${id}.secret.${i}`, { grid: '. . .\n. . .\n. . .', target: i % 2 ? '010/111/010' : '101/010/101' }));
  if (id === 'hub') out.vault = [puzzle('hub.vault', { grid: '. . . .\n. . . .\n. . . .\n. . . .', target: '1001/0110/0110/1001' })];
  return out;
}
