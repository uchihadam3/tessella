import type { PuzzleDef } from '../../puzzle/types';

/** Puzzles of one area, keyed by group key (see src/data/areas.ts), in teaching order.
 *  Optional `secret` group holds the environmental "world tessera" puzzle(s) of the area. */
export type AreaPuzzles = Record<string, PuzzleDef[]>;
