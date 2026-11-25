/**
 * Calibration: sets every panel's difficulty label from its measured insight path — the number of
 * insights a careful player needs (insightPath: basic reading of the rules first, then one named
 * insight or one "e se?" at a time) — clamped to the range of its slot. A label then means the same
 * effort everywhere on the island, sequences still climb (they are ordered by the same measure) and
 * 10 is the true peak.
 *   npx tsx tools/relabel.ts [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUZZLES } from '../src/data/puzzles/index';
import { insightPath } from '../src/puzzle/solver';
import type { PuzzleDef } from '../src/puzzle/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** label from the measured path: 0 insights = pure reading (1 when reading alone finishes the panel);
 *  then roughly one label per insight, widening */
export function measuredLabel(steps: number, basicRoot: number, solved = false): number {
  if (steps === 0) return solved || basicRoot >= 0.85 ? 1 : 2;
  if (steps <= 3) return steps + 2; // 1 → 3, 2 → 4, 3 → 5
  if (steps <= 5) return 6;
  if (steps <= 7) return 7;
  if (steps <= 10) return 8;
  if (steps <= 14) return 9;
  return 10;
}

/** the label range of each slot (area.group, or group) — the place in the game bounds the label */
const RANGE: Record<string, [number, number]> = {
  'prologue.cave': [1, 3], 'prologue.shore': [1, 3], 'prologue.gate': [1, 3],
  'hub.vault': [10, 10],
  'echo.intro': [1, 4], 'echo.practice': [2, 6], 'echo.trial': [4, 9], 'echo.heart': [6, 10],
  'citadel.gate': [4, 8], 'citadel.court': [5, 9], 'citadel.halls': [6, 10], 'citadel.crown': [7, 10],
  'spire.ascent': [6, 9], 'spire.drums': [6, 10], 'spire.mirrors': [6, 10], 'spire.apex': [8, 10],
  intro: [1, 4], practice: [2, 6], trial: [3, 8], mastery: [5, 9], heart: [6, 10],
};
export function slotRange(id: string): [number, number] {
  const [area, group] = id.split('.');
  return RANGE[`${area}.${group}`] ?? RANGE[group] ?? [1, 10];
}

export function calibratedLabel(p: PuzzleDef): { label: number; steps: number; basicRoot: number } {
  const ip = insightPath(p, 60);
  const [lo, hi] = slotRange(p.id);
  const label = Math.max(lo, Math.min(hi, measuredLabel(ip.steps.length, ip.basicRoot, ip.solved)));
  return { label, steps: ip.steps.length, basicRoot: ip.basicRoot };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry');
  let changed = 0;
  for (const [area, set] of Object.entries(PUZZLES)) {
    const file = join(root, `src/data/puzzles/${area}.ts`);
    let src = readFileSync(file, 'utf8');
    for (const list of Object.values(set)) {
      for (const p of list as PuzzleDef[]) {
        const { label } = calibratedLabel(p);
        if (label === p.difficulty) continue;
        // rewrite `difficulty: N` inside this puzzle's block (the block starts at puzzle('<id>', {)
        const start = src.indexOf(`puzzle('${p.id}', {`);
        if (start < 0) throw new Error(`${p.id}: block not found in ${file}`);
        const next = src.indexOf('puzzle(', start + 8);
        const block = src.slice(start, next < 0 ? undefined : next);
        if (!/difficulty: \d+/.test(block)) throw new Error(`${p.id}: no difficulty field`);
        const nb = block.replace(/difficulty: \d+/, `difficulty: ${label}`);
        src = src.slice(0, start) + nb + (next < 0 ? '' : src.slice(next));
        changed++;
        if (dry) console.log(`${p.id}: ${p.difficulty} → ${label}`);
      }
    }
    if (!dry) writeFileSync(file, src);
  }
  console.log(`${changed} labels ${dry ? 'would change' : 'changed'}`);
}
