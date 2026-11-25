/**
 * TESSELLA — puzzle data model.
 *
 * A puzzle ("tessela") is a grid of tiles. Every tile is either LIT (1) or DARK (0).
 * A REGION is a maximal group of same-state tiles connected orthogonally
 * (holes and the board edge break connectivity; with `wrap` the left and right
 * edges are glued together, like a drum).
 *
 * Rules are expressed by glyphs. A panel may combine any number of rule kinds.
 */

export type Bit = 0 | 1;

/** Gem colours for the Kinship rule. */
export const GEM_COLORS = ['amber', 'azure', 'crimson', 'jade', 'ivory', 'violet'] as const;
export type GemColor = (typeof GEM_COLORS)[number];

/** Symbols used by the Twins rule. */
export const TWIN_SYMBOLS = ['moon', 'star', 'leaf', 'drop', 'sun', 'wave'] as const;
export type TwinSymbol = (typeof TWIN_SYMBOLS)[number];

/** Echo directions (which other tiles flip when this tile is pressed). */
export type EchoDir =
  | 'n' | 's' | 'e' | 'w'            // orthogonal neighbour
  | 'ne' | 'nw' | 'se' | 'sw'        // diagonal neighbour
  | 'row' | 'col';                   // the whole row / column (holes stop nothing)

/** A glyph sitting on a tile. */
export type Glyph =
  /** Kinship: gems of one colour share one region; different colours never share a region. */
  | { kind: 'gem'; color: GemColor }
  /** Measure: the region containing this tile has exactly n tiles. */
  | { kind: 'measure'; n: number }
  /** Mold: the region containing this tile has exactly this shape.
   *  cells are [row, col] offsets (normalised so min row/col = 0).
   *  free=true: any rotation/reflection is accepted. */
  | { kind: 'mold'; cells: [number, number][]; free?: boolean }
  /** Contour: exactly n of this tile's 4 sides are borders (neighbour of the other state;
   *  outside the board and holes count as DARK). */
  | { kind: 'contour'; n: number }
  /** Mosaic: exactly n lit tiles in the 3x3 block centred on this tile (itself included). */
  | { kind: 'mosaic'; n: number }
  /** Beacon: this tile is always lit; it sees exactly n lit tiles in the 4 straight
   *  directions until darkness/hole/edge, itself included. On a panel with beacons, every
   *  lit tile must be seen by at least one beacon. */
  | { kind: 'beacon'; n: number }
  /** Twins: the two tiles carrying the same symbol lie in two DIFFERENT regions with the
   *  same shape (translation only). mirror=true on ONE of the pair means the regions are
   *  left-right mirror images of each other. */
  | { kind: 'twin'; symbol: TwinSymbol; mirror?: boolean };

export type GlyphKind = Glyph['kind'];

export interface Cell {
  /** A hole: no tile here at all. */
  hole?: boolean;
  /** Locked state: the player cannot change it (shown with a rivet). */
  lock?: Bit;
  /** Mute: cannot be pressed directly, but echoes can flip it. */
  mute?: boolean;
  /** Echo marks: pressing this tile also flips the tiles in these directions. */
  echo?: EchoDir[];
  glyph?: Glyph;
}

/** One weave clue: list of run lengths (empty list = no lit tile in the line). */
export type WeaveClue = number[];

export interface PuzzleDef {
  id: string;
  /** rows */
  h: number;
  /** columns */
  w: number;
  /** row-major cells, length h*w */
  cells: Cell[];
  /** Weave clues per row (null = no clue for that row). */
  rowClues?: (WeaveClue | null)[];
  /** Weave clues per column. */
  colClues?: (WeaveClue | null)[];
  /** Target plate: exact pattern the board must match ('1' lit, '0' dark, '#' hole), row-major. */
  target?: string;
  /** How the target is shown: a plate next to the panel (default), only the glowing
   *  outline of the pattern on the plate ('outline'), or hidden in the world ('world'). */
  targetDisplay?: 'plate' | 'outline' | 'world';
  /** Initial state ('1'/'0', row-major). Default: all dark (locked tiles at their lock). */
  init?: string;
  /** Drum panel: left and right edges are adjacent. */
  wrap?: boolean;
  /** Mirror input: pressing a tile also presses its mirror across this axis. */
  mirror?: 'v' | 'h' | 'rot';
  /** Free-form designer note (insight this puzzle teaches). Not shown in game. */
  note?: string;
  /** Rough difficulty 1..10 (for sorting / tuning). */
  difficulty?: number;
}

/** A violation found when the player submits. Used for the red blinking feedback. */
export interface Violation {
  rule: GlyphKind | 'target' | 'weave' | 'lock';
  /** Tiles to blink (indices). */
  tiles: number[];
  /** Weave clue lines to blink. */
  rows?: number[];
  cols?: number[];
  /** the answer as a whole is wrong: say so without telling which tiles (that would give it away) */
  whole?: boolean;
}

export interface CheckResult {
  ok: boolean;
  violations: Violation[];
}
