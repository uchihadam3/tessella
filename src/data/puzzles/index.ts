import type { AreaId } from '../areas';
import type { PuzzleDef } from '../../puzzle/types';
import type { AreaPuzzles } from './types';
import prologue from './prologue';
import hub from './hub';
import kinship from './kinship';
import measure from './measure';
import mold from './mold';
import contour from './contour';
import mosaic from './mosaic';
import beacon from './beacon';
import weave from './weave';
import twins from './twins';
import citadel from './citadel';
import echo from './echo';
import spire from './spire';

export type { AreaPuzzles };

export const PUZZLES: Record<AreaId, AreaPuzzles> = {
  prologue, hub, kinship, measure, mold, contour, mosaic, beacon, weave, twins, citadel, echo, spire,
};

export const PUZZLE_BY_ID = new Map<string, PuzzleDef>();
for (const area of Object.values(PUZZLES)) for (const list of Object.values(area)) for (const p of list) PUZZLE_BY_ID.set(p.id, p);
