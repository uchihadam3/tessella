/**
 * Island layout: every important coordinate lives here so terrain, areas, atmosphere and
 * the map agree. North is -z. Sea level is y = 0.
 */
import type { AreaId } from '../data/areas';

export const WORLD_HALF = 560; // terrain covers [-560, 560]
export const CELL = 2; // metres per terrain cell
export const SEA = 0;

export const HUB = { x: 0, z: 20, y: 18, r: 40 };
export const CALDERA = { x: 0, z: -112, outer: 112, rim: 70, inner: 48, floor: 7, rimH: 88 };
export const SPIRE = { x: 0, z: -112, baseY: 7 };
export const CITADEL = { x: 0, z: -470, r: 58, y: 24 };
export const NORTH_LANDING = { x: 0, z: -336 };

export interface AreaGround {
  /** biome centre */
  x: number;
  z: number;
  /** radius of full influence / fade out */
  r0: number;
  r1: number;
  /** ground colours (main, secondary) */
  c1: string;
  c2: string;
}

export const ANCHORS: Record<AreaId, { x: number; z: number }> = {
  prologue: { x: 0, z: 292 },
  hub: { x: HUB.x, z: HUB.z },
  kinship: { x: -205, z: -118 },
  measure: { x: 205, z: -118 },
  mold: { x: 98, z: -252 },
  weave: { x: -98, z: -252 },
  contour: { x: -152, z: 178 },
  mosaic: { x: 152, z: 178 },
  twins: { x: -238, z: 34 },
  beacon: { x: 286, z: 44 },
  citadel: { x: CITADEL.x, z: CITADEL.z },
  echo: { x: CALDERA.x, z: CALDERA.z + 20 },
  spire: { x: SPIRE.x, z: SPIRE.z },
};

/** Biome ground colours per area (vertex colours of the terrain). */
export const GROUNDS: Partial<Record<AreaId, AreaGround>> = {
  prologue: { x: 0, z: 312, r0: 22, r1: 55, c1: '#d9c79c', c2: '#b9b07a' },
  hub: { x: 0, z: 20, r0: 45, r1: 95, c1: '#65a04a', c2: '#89b356' },
  kinship: { x: -205, z: -118, r0: 70, r1: 130, c1: '#a49b3f', c2: '#c4773a' },
  measure: { x: 205, z: -118, r0: 70, r1: 130, c1: '#8fcb46', c2: '#b6d65a' },
  mold: { x: 98, z: -252, r0: 55, r1: 100, c1: '#d6cdbd', c2: '#b9ab90' },
  weave: { x: -98, z: -252, r0: 60, r1: 110, c1: '#a3b552', c2: '#c2b35e' },
  contour: { x: -152, z: 178, r0: 60, r1: 110, c1: '#4f9844', c2: '#6aab4f' },
  mosaic: { x: 152, z: 178, r0: 65, r1: 120, c1: '#e3bd7a', c2: '#edd096' },
  twins: { x: -238, z: 34, r0: 60, r1: 110, c1: '#7fb766', c2: '#9cc77b' },
  beacon: { x: 286, z: 44, r0: 50, r1: 100, c1: '#8aa271', c2: '#a7b38b' },
  citadel: { x: 0, z: -470, r0: 40, r1: 80, c1: '#555a52', c2: '#69705a' },
  echo: { x: 0, z: -112, r0: 50, r1: 110, c1: '#5b5a66', c2: '#596f4c' },
};

export const MEADOW = { c1: '#5f9440', c2: '#86ab4e' };
export const SAND = '#e6d4a6';
export const WET_SAND = '#bfa877';
export const ROCK = '#8a847b';
export const PATH = '#cbb894';

/** Walking paths (polylines). Terrain is smoothed and tinted along them. */
export const PATHS: [number, number][][] = [
  // prologue -> hub
  [[0, 262], [2, 210], [6, 150], [2, 96], [0, 58]],
  // hub -> contour / mosaic
  [[-22, 48], [-70, 100], [-118, 146], [-140, 166]],
  [[22, 48], [70, 100], [118, 146], [140, 166]],
  // hub -> twins / beacon
  [[-38, 26], [-110, 32], [-180, 36], [-214, 36]],
  [[38, 26], [120, 32], [210, 40], [262, 44]],
  // hub -> kinship / measure (passing beside the caldera)
  [[-30, 4], [-96, -30], [-150, -78], [-188, -104]],
  [[30, 4], [96, -30], [150, -78], [188, -104]],
  // kinship -> weave, measure -> mold
  [[-205, -140], [-178, -200], [-128, -238], [-110, -246]],
  [[205, -140], [178, -200], [128, -238], [110, -246]],
  // weave/mold -> north landing
  [[-84, -270], [-48, -310], [-10, -332]],
  [[84, -270], [48, -310], [10, -332]],
  // hub -> gorge into the caldera
  [[0, -6], [0, -40], [0, -66]],
  // ring links
  [[-162, 156], [-196, 100], [-224, 58]],
  [[162, 156], [222, 100], [266, 64]],
];

export interface Waypoint {
  id: string;
  area: AreaId;
  x: number;
  z: number;
}

/**
 * Arrival point for an area: on the approach from the Courtyard, `back` metres before the area's
 * centre, i.e. a few steps in front of its first (teaching) panels with the gateway behind them.
 */
function approach(id: AreaId, back: number): { x: number; z: number } {
  const A = ANCHORS[id];
  const dx = A.x - HUB.x, dz = A.z - HUB.z;
  const l = Math.hypot(dx, dz);
  return { x: +(A.x - (dx / l) * back).toFixed(1), z: +(A.z - (dz / l) * back).toFixed(1) };
}

/** Guide stones: fast-travel points (attuned on first visit). Arrival faces the area. */
export const WAYSTONES: Waypoint[] = [
  { id: 'hub', area: 'hub', x: 8, z: 52 },
  { id: 'prologue', area: 'prologue', x: 6, z: 248 },
  { id: 'kinship', area: 'kinship', ...approach('kinship', 62) },
  { id: 'measure', area: 'measure', ...approach('measure', 64) },
  { id: 'mold', area: 'mold', ...approach('mold', 56) },
  { id: 'weave', area: 'weave', ...approach('weave', 56) },
  { id: 'contour', area: 'contour', ...approach('contour', 60) },
  { id: 'mosaic', area: 'mosaic', ...approach('mosaic', 56) },
  { id: 'twins', area: 'twins', ...approach('twins', 76) },
  { id: 'beacon', area: 'beacon', ...approach('beacon', 46) },
  { id: 'citadel', area: 'citadel', x: 6, z: -340 },
];

/** Which area the player is "in" for music/atmosphere: nearest anchor within its radius. */
export const AREA_RADIUS: Partial<Record<AreaId, number>> = {
  prologue: 75, hub: 70, kinship: 95, measure: 95, mold: 75, weave: 80, contour: 85, mosaic: 85, twins: 85, beacon: 75, citadel: 90, echo: 62, spire: 30,
};
