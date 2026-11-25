/**
 * THE CONSTELLATIONS — the secret layer of Tessella (never taught anywhere in the game).
 *
 * A constellation is a small NETWORK of "stars" (world objects: lanterns, stones, lily pads,
 * crystals…) joined by thin threads of light. Each star is lit or dark. Neighbours are the stars
 * joined by a thread (not grid adjacency). The player clicks stars to toggle them and rings the
 * constellation's bell to check. Rules (graph versions of the panel languages + one secret one):
 *
 *  - no glyph rules at all  → every star must be lit
 *  - gem (Kinship): same colour in one region, different colours in different regions
 *                   (region = stars of the same state connected through threads)
 *  - measure: the star's region has exactly n stars
 *  - contour: exactly n of the star's threads lead to a star of the OTHER state
 *  - mosaic:  exactly n lit stars among the star itself and its neighbours
 *  - thread marks (SECRET language, exclusive to constellations):
 *        'same' (a knot on the thread)   → both ends have the same state
 *        'diff' (a frayed / cut thread)  → both ends have different states
 *  - echo constellation: pressing a star also flips all its neighbours
 *  - lock: the star is fixed (a rivet/stake)
 */
import type { GemColor } from '../puzzle/types';
import type { AreaId } from '../data/areas';

export type StarGlyph =
  | { kind: 'gem'; color: GemColor }
  | { kind: 'measure'; n: number }
  | { kind: 'contour'; n: number }
  | { kind: 'mosaic'; n: number };

export interface Star {
  /** local position in metres (footprint roughly within a 7 m radius around 0,0) */
  x: number;
  z: number;
  glyph?: StarGlyph;
  lock?: 0 | 1;
}

export interface Thread {
  a: number;
  b: number;
  mark?: 'same' | 'diff';
}

export interface ConstellationDef {
  /** e.g. 'kinship.c07' */
  id: string;
  area: AreaId;
  stars: Star[];
  threads: Thread[];
  /** local position of the bell (submit) */
  bell: { x: number; z: number };
  /** pressing a star also flips its neighbours */
  echo?: boolean;
  /** 1..10 */
  difficulty: number;
  /** designer note (insight), not shown */
  note?: string;
}

export interface GraphViolation {
  stars: number[];
  threads: number[];
}
