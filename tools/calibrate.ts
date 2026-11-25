/**
 * Difficulty calibration report: mean number of insights (insightPath steps) per difficulty
 * label, plus panels that are "too hard for their slot" (intro panels and practice openers needing
 * more than 2 insights, trial openers more than 3, mastery openers more than 6) or "too easy for
 * their slot" (label >= 7 with <= 1 insight and a beginner already deciding >= 85% of the board).
 *   npx tsx tools/calibrate.ts [--json out.json]
 */
import { writeFileSync } from 'node:fs';
import { PUZZLES } from '../src/data/puzzles/index';
import { insightPath } from '../src/puzzle/solver';
import type { PuzzleDef } from '../src/puzzle/types';

export interface Measure { id: string; label: number; steps: number; basicRoot: number; solved: boolean }

export function measureAll(areas?: string[]): Measure[] {
  const out: Measure[] = [];
  for (const [area, set] of Object.entries(PUZZLES)) {
    if (areas && !areas.includes(area)) continue;
    for (const list of Object.values(set)) {
      for (const p of list as PuzzleDef[]) {
        const ip = insightPath(p, 60);
        out.push({ id: p.id, label: p.difficulty ?? 0, steps: ip.steps.length, basicRoot: ip.basicRoot, solved: ip.solved });
      }
    }
  }
  return out;
}

const TEACHING = ['kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins'];
/** how many insights a teaching panel may use: every intro panel and every sequence opener is gentle */
export function gentleMax(id: string): number | null {
  const [a, g, n] = id.split('.');
  if (g === 'intro' || a === 'prologue') return 2;
  if (!TEACHING.includes(a) || (Number(n) - 1) % 4 !== 0) return null;
  return g === 'practice' ? 2 : g === 'trial' ? 3 : g === 'mastery' ? 6 : null;
}
export const isOpener = (id: string): boolean => gentleMax(id) !== null;

if (import.meta.url === `file://${process.argv[1]}`) {
  const areaArg = process.argv.find((a) => a.startsWith('--area='));
  const all = measureAll(areaArg ? areaArg.slice(7).split(',') : undefined);
  if (process.argv.includes('--groups')) {
    const by = new Map<string, Measure[]>();
    for (const m of all) { const k = m.id.split('.').slice(0, 2).join('.'); if (!by.has(k)) by.set(k, []); by.get(k)!.push(m); }
    for (const [k, l] of by) console.log(k.padEnd(18), l.map((m) => `${m.label}:${m.steps}${m.solved ? '' : '?'}`).join(' '));
  }
  const byLabel = new Map<number, number[]>();
  for (const m of all) {
    if (!byLabel.has(m.label)) byLabel.set(m.label, []);
    byLabel.get(m.label)!.push(m.steps);
  }
  console.log('mean insights by label:');
  console.log([...byLabel.keys()].sort((a, b) => a - b).map((l) => `${l}:${(byLabel.get(l)!.reduce((a, b) => a + b, 0) / byLabel.get(l)!.length).toFixed(1)} (n=${byLabel.get(l)!.length})`).join('  '));
  console.log('range by label: ' + [...byLabel.keys()].sort((a, b) => a - b).map((l) => `${l}:[${Math.min(...byLabel.get(l)!)}..${Math.max(...byLabel.get(l)!)}]`).join(' '));
  const vault = all.find((m) => m.id === 'hub.vault');
  if (vault) console.log(`vault: ${vault.steps} insights (max elsewhere ${Math.max(...all.filter((m) => m.id !== 'hub.vault').map((m) => m.steps))})`);
  const tooHard = all.filter((m) => gentleMax(m.id) !== null && m.steps > gentleMax(m.id)!);
  const tooEasy = all.filter((m) => m.label >= 7 && m.steps <= 1 && m.basicRoot >= 0.85);
  console.log(`\ntoo hard for their slot (${tooHard.length}): ` + tooHard.map((m) => `${m.id}(${m.steps},${m.basicRoot.toFixed(2)})`).join(' '));
  console.log(`too easy for their slot (${tooEasy.length}): ` + tooEasy.map((m) => `${m.id}(${m.steps},${m.basicRoot.toFixed(2)})`).join(' '));
  const jsonIdx = process.argv.indexOf('--json');
  if (jsonIdx > 0) writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(all, null, 1));
}
