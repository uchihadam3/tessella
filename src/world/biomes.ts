/** Where things grow: scatter rules for trees, rocks, grass and flowers per biome. */
import * as THREE from 'three';
import { ANCHORS, CALDERA, CITADEL, HUB } from './layout';
import { smoothstep } from './noise';
import type { Forest, GrassRules } from './vegetation';
import type { AreaId } from '../data/areas';

function w(id: AreaId, x: number, z: number, r0: number, r1: number): number {
  const a = ANCHORS[id];
  return smoothstep(r1, r0, Math.hypot(x - a.x, z - a.z));
}

/** 1 in plain meadows, 0 inside special biomes. */
function meadow(x: number, z: number): number {
  let m = 1;
  const special: [AreaId, number, number][] = [
    ['kinship', 85, 125], ['measure', 80, 120], ['mold', 60, 95], ['weave', 75, 110], ['contour', 70, 105],
    ['mosaic', 80, 120], ['twins', 70, 105], ['beacon', 60, 95], ['citadel', 45, 75], ['prologue', 45, 80],
  ];
  for (const [id, r0, r1] of special) m = Math.min(m, 1 - w(id, x, z, r0, r1));
  const dc = Math.hypot(x - CALDERA.x, z - CALDERA.z);
  m = Math.min(m, smoothstep(CALDERA.rim, CALDERA.outer + 20, dc));
  const dh = Math.hypot(x - HUB.x, z - HUB.z);
  m = Math.min(m, smoothstep(40, 70, dh));
  return m;
}

export function scatterVegetation(f: Forest) {
  const flatOk = (slope: number, max = 0.28) => smoothstep(max, max * 0.6, slope);
  const offPath = (p: number) => smoothstep(0.25, 0.0, p);
  // meadow oaks and bushes
  f.scatter('oak', 15, (x, z, h, s, p) => 0.32 * meadow(x, z) * flatOk(s) * offPath(p) * (h > 4 ? 1 : 0), [0.8, 1.3], 11);
  f.scatter('bush', 10, (x, z, h, s, p) => 0.22 * (meadow(x, z) + 0.5 * w('hub', x, z, 60, 95)) * flatOk(s, 0.35) * offPath(p) * (h > 3 ? 1 : 0), [0.7, 1.3], 12);
  // autumn grove
  // (the mirror lake's cherry garden keeps to itself: no autumn wood among its trees)
  const garden = (x: number, z: number) => 1 - w('twins', x, z, 105, 125);
  f.scatter('autumn', 7.5, (x, z, h, s, p) => 0.72 * w('kinship', x, z, 70, 115) * garden(x, z) * flatOk(s, 0.4) * offPath(p), [0.85, 1.35], 13);
  f.scatter('bush', 9, (x, z, h, s, p) => 0.3 * w('kinship', x, z, 70, 115) * garden(x, z) * offPath(p), [0.8, 1.2], 14);
  // blossoms around the mirror lake
  f.scatter('blossom', 8, (x, z, h, s, p) => {
    const a = ANCHORS.twins;
    const r = Math.hypot(x - a.x, z - a.z);
    return 0.85 * smoothstep(48, 60, r) * smoothstep(112, 90, r) * flatOk(s, 0.35) * offPath(p) * (h > 8.2 ? 1 : 0);
  }, [0.8, 1.25], 15);
  // pines on the caldera slopes and the cliffs
  f.scatter('pine', 8, (x, z, h, s, p) => {
    const dc = Math.hypot(x - CALDERA.x, z - CALDERA.z);
    const slopeBand = smoothstep(CALDERA.rim - 5, CALDERA.rim + 15, dc) * smoothstep(CALDERA.outer + 50, CALDERA.outer + 10, dc);
    const basin = smoothstep(CALDERA.inner + 6, CALDERA.inner - 6, dc) * 0.15;
    const cliffs = w('beacon', x, z, 40, 90) * 0.35;
    return (0.55 * slopeBand + basin + cliffs) * smoothstep(0.75, 0.45, s) * offPath(p) * (h > 5 ? 1 : 0);
  }, [0.8, 1.4], 16);
  // cypresses: citadel islet and garden avenues
  f.scatter('cypress', 9, (x, z, h, s, p) => 0.45 * w('citadel', x, z, 35, 60) * flatOk(s, 0.45) * offPath(p) * (h > 15 ? 1 : 0), [0.8, 1.2], 17);
  f.scatter('cypress', 14, (x, z, h, s, p) => 0.25 * w('contour', x, z, 60, 95) * (1 - w('contour', x, z, 45, 60)) * offPath(p), [0.9, 1.2], 18);
  // palms by the sand temple and the beach
  f.scatter('palm', 11, (x, z, h, s, p) => {
    const a = ANCHORS.mosaic;
    const r = Math.hypot(x - a.x, z - a.z);
    return 0.35 * smoothstep(30, 40, r) * smoothstep(95, 70, r) * offPath(p) * flatOk(s, 0.4);
  }, [0.85, 1.2], 19);
  f.scatter('palm', 16, (x, z, h, s, p) => 0.2 * w('prologue', x, z, 25, 70) * (h > 2 && h < 9 ? 1 : 0) * offPath(p), [0.9, 1.2], 20);
  // poplars in the windmill vale
  f.scatter('poplar', 12, (x, z, h, s, p) => 0.28 * w('weave', x, z, 60, 100) * offPath(p) * flatOk(s), [0.9, 1.3], 21);
  // dead trees in the quarry and desert
  f.scatter('deadtree', 22, (x, z, h, s, p) => 0.25 * (w('mold', x, z, 40, 70) + w('mosaic', x, z, 50, 100) * 0.5) * offPath(p), [0.8, 1.1], 22);

  // rocks
  f.scatter('rock', 6, (x, z, h, s, p) => 0.55 * smoothstep(0.32, 0.6, s) * offPath(p) * (1 - w('citadel', x, z, 30, 60)), [0.8, 2.4], 31);
  f.scatter('rockdark', 7, (x, z, h, s, p) => {
    const dc = Math.hypot(x - CALDERA.x, z - CALDERA.z);
    return 0.25 * smoothstep(CALDERA.outer, CALDERA.inner, dc) * offPath(p) + 0.2 * w('citadel', x, z, 40, 65) * smoothstep(0.2, 0.5, s);
  }, [0.6, 2.2], 32);
  f.scatter('rocksand', 9, (x, z, h, s, p) => 0.16 * w('mosaic', x, z, 50, 110) * offPath(p), [0.5, 1.6], 33);
  f.scatter('rockwhite', 6, (x, z, h, s, p) => 0.4 * w('mold', x, z, 35, 75) * offPath(p), [0.5, 2.0], 34);
  f.scatter('rockflat', 9, (x, z, h, s, p) => (h < 2.8 && h > 0.6 ? 0.18 : 0) * smoothstep(200, 260, Math.hypot(x, z)), [0.6, 1.8], 35);
}

const C = (hex: string) => new THREE.Color(hex);

/** the autumn wood's fallen leaves (the drawing's are of the deeper red, rarer, colour) */
export const LITTER = ['#e2662f', '#f0a033', '#d9572b', '#f2c14e', '#e08a2e', '#c9412a'];
export const LITTER_LINE = '#c9412a';

export const grassRules: GrassRules = {
  density(x, z, h, slope, path) {
    let d = 0.92;
    const dc = Math.hypot(x - CALDERA.x, z - CALDERA.z);
    if (dc < CALDERA.outer) d = Math.min(d, 0.12 + 0.35 * smoothstep(CALDERA.rim, CALDERA.outer, dc));
    d *= 1 - 0.85 * w('mosaic', x, z, 70, 115);
    d *= 1 - 0.85 * w('mold', x, z, 45, 85);
    d *= 1 - 0.4 * w('kinship', x, z, 60, 110);
    d *= 1 - 0.55 * w('citadel', x, z, 30, 60);
    // beach: no grass on sand, dune grass behind it
    if (h < 2.8 && Math.hypot(x, z) > 230) d = 0;
    if (Math.hypot(x - CITADEL.x, z - CITADEL.z) < 75 && h < 18) d = 0;
    d *= smoothstep(0.55, 0.3, slope);
    d *= smoothstep(0.35, 0.05, path);
    return d;
  },
  flowerChance(x, z) {
    return 0.05 + 0.4 * w('weave', x, z, 50, 90) + 0.3 * w('twins', x, z, 75, 120) + 0.08 * w('contour', x, z, 50, 90) + 0.06 * w('hub', x, z, 40, 80);
  },
  flower(x, z) {
    const r = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    const q = Math.abs(r);
    if (w('weave', x, z, 50, 90) > 0.4) return q < 0.85 ? (q < 0.45 ? '#9a7fd6' : '#b79bf0') : '#f2d25a';
    if (w('twins', x, z, 50, 100) > 0.4) return q < 0.6 ? '#ffb6d3' : '#ffffff';
    if (w('contour', x, z, 50, 90) > 0.4) return q < 0.5 ? '#e5465b' : q < 0.8 ? '#ffffff' : '#f7a8b8';
    if (w('kinship', x, z, 60, 110) > 0.4) return q < 0.5 ? '#f2a03b' : '#e0562d';
    if (w('measure', x, z, 60, 110) > 0.4) return q < 0.7 ? '#f6e05a' : '#ffffff';
    return q < 0.4 ? '#ffffff' : q < 0.7 ? '#ffd84a' : q < 0.88 ? '#e8453c' : '#9fb7ff';
  },
  ripples(x, z) {
    return 0.95 * w('mosaic', x, z, 70, 120);
  },
  reeds(x, z, depth) {
    // in the shallows and along the wet edge of the lakes
    return depth < -0.15 || depth > 0.75 ? 0 : 0.85 * (1 - Math.abs(depth - 0.25) / 0.6);
  },
  litter(x, z) {
    return 0.9 * w('kinship', x, z, 95, 120);
  },
  litterColor(x, z, r) {
    return LITTER[Math.floor(r * LITTER.length) % LITTER.length];
  },
  tint(x, z, base) {
    const out = base.clone();
    // grass blades are a bit brighter and more saturated than the ground under them
    out.offsetHSL(0, 0.06, 0.03);
    out.lerp(C('#c9b45a'), 0.25 * w('beacon', x, z, 40, 90));
    out.lerp(C('#b8a24a'), 0.3 * w('kinship', x, z, 50, 110));
    return out;
  },
};
