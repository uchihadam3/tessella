/** Insight steps of every intro panel (the calibration test allows at most 2). */
import { PUZZLES } from '../src/data/puzzles';
import { insightPath } from '../src/puzzle/solver';
for (const [area, groups] of Object.entries(PUZZLES)) {
  const intro = (groups as Record<string, { id: string }[]>).intro;
  if (!intro) continue;
  console.log(area.padEnd(8), intro.map((p) => insightPath(p as never, 30).steps.length).join(' '));
}
