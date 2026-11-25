/**
 * Procedural vegetation: stylised trees (several species), bushes, rocks (instanced), and a
 * dynamic grass + flower field around the player. Wind is done in the vertex shader.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { simplex, rng, smoothstep, clamp, hash2 } from './noise';
import type { Terrain } from './terrain';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

export type Species = 'oak' | 'autumn' | 'blossom' | 'pine' | 'cypress' | 'palm' | 'poplar' | 'bush' | 'deadtree';

const PALETTE: Record<Species, { trunk: string; leaves: string[] }> = {
  oak: { trunk: '#6b4f3a', leaves: ['#5c9a3c', '#6fae45', '#4f8a36', '#7db84e'] },
  autumn: { trunk: '#5a4232', leaves: ['#e2662f', '#f0a033', '#c9412a', '#f2c14e', '#d9572b'] },
  blossom: { trunk: '#4a3530', leaves: ['#f7b6d2', '#f4a3c4', '#fbd0e1', '#fde6ef'] },
  pine: { trunk: '#5b4636', leaves: ['#2f5d3a', '#3a6b40', '#2a5236'] },
  cypress: { trunk: '#4a3a2c', leaves: ['#2e4f2f', '#3b5e35', '#36573a'] },
  palm: { trunk: '#8a6d4b', leaves: ['#5f9a3a', '#79b04a', '#6aa443'] },
  poplar: { trunk: '#6e5a45', leaves: ['#9fbf4a', '#b7c95a', '#a9c452'] },
  bush: { trunk: '#5a4a3a', leaves: ['#5f9440', '#6ea44a', '#4f8338'] },
  deadtree: { trunk: '#7a6a5a', leaves: [] },
};

// ───────────────────────── geometry helpers ─────────────────────────

function paint(geo: THREE.BufferGeometry, color: THREE.Color, sway: number | ((y: number) => number), shade?: (p: THREE.Vector3) => number) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const sw = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const s = shade ? shade(v) : 1;
    col[i * 3] = color.r * s;
    col[i * 3 + 1] = color.g * s;
    col[i * 3 + 2] = color.b * s;
    sw[i] = typeof sway === 'number' ? sway : sway(v.y);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  return geo;
}

function clean(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aSway'].includes(k)) g.deleteAttribute(k);
  return g;
}

/** A blob of foliage with soft "spherical" normals. */
function foliage(r: number, cx: number, cy: number, cz: number, color: THREE.Color, rand: () => number, sway: number, squash = 1, detail = 2): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const seed = rand() * 100;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = simplex.noise(v.x / r * 1.3 + seed, v.y / r * 1.3 + v.z / r) * 0.22;
    v.multiplyScalar(1 + n);
    v.y *= squash;
    pos.setXYZ(i, v.x + cx, v.y + cy, v.z + cz);
  }
  const ng = g.index ? g.toNonIndexed() : g;
  // soft normals: blend radial direction with face normal
  ng.computeVertexNormals();
  const p2 = ng.attributes.position;
  const nrm = ng.attributes.normal;
  const c = new THREE.Vector3(cx, cy, cz);
  const fn = new THREE.Vector3();
  for (let i = 0; i < p2.count; i++) {
    v.fromBufferAttribute(p2, i).sub(c).normalize();
    fn.fromBufferAttribute(nrm, i);
    v.lerp(fn, 0.1).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  const top = cy + r * squash;
  const bottom = cy - r * squash;
  const hueJ = (rand() - 0.5) * 0.05;
  const col = color.clone().offsetHSL(hueJ, 0, (rand() - 0.5) * 0.06);
  return paint(clean(ng), col, sway, (p) => 0.62 + 0.5 * smoothstep(bottom, top, p.y));
}

function trunk(r0: number, r1: number, h: number, x: number, y: number, z: number, color: THREE.Color, lean: THREE.Vector3, segs = 7): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, h, segs, 4, true);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y / h;
    v.x += lean.x * t * t * h;
    v.z += lean.z * t * t * h;
    pos.setXYZ(i, v.x + x, v.y + y, v.z + z);
  }
  g.computeVertexNormals();
  return paint(clean(g), color, (yy) => clamp((yy - y) / (h * 3), 0, 0.25), (p) => 0.7 + 0.35 * clamp((p.y - y) / h, 0, 1));
}

export function makeTreeGeometry(species: Species, seed: number): THREE.BufferGeometry {
  const rand = rng(seed * 7919 + species.length * 101);
  const pal = PALETTE[species];
  const bark = new THREE.Color(pal.trunk);
  const leaf = () => new THREE.Color(pal.leaves[Math.floor(rand() * pal.leaves.length)]);
  const parts: THREE.BufferGeometry[] = [];
  const lean = new THREE.Vector3((rand() - 0.5) * 0.25, 0, (rand() - 0.5) * 0.25);
  switch (species) {
    case 'oak':
    case 'autumn':
    case 'blossom': {
      const h = species === 'blossom' ? 2.6 + rand() * 1.2 : 3.2 + rand() * 1.8;
      const r = species === 'blossom' ? 0.22 : 0.3;
      parts.push(trunk(r, r * 0.55, h, 0, 0, 0, bark, lean));
      const top = new THREE.Vector3(lean.x * h, h, lean.z * h);
      const crown = species === 'blossom' ? 2.3 : 2.6 + rand() * 0.8;
      const base = leaf();
      const n = 5 + Math.floor(rand() * 4);
      // branches
      for (let i = 0; i < 3; i++) {
        const a = rand() * Math.PI * 2;
        const bl = 1.2 + rand() * 0.8;
        const dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.7, Math.sin(a) * 0.8).normalize();
        const b = trunk(r * 0.45, r * 0.2, bl, 0, 0, 0, bark, new THREE.Vector3());
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        b.applyQuaternion(q);
        b.translate(top.x * 0.8, h * 0.78, top.z * 0.8);
        parts.push(b);
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand();
        const d = crown * (0.35 + rand() * 0.45);
        const cy = h + 0.4 + rand() * crown * 0.7;
        const rr = crown * (0.45 + rand() * 0.25);
        const c = species === 'autumn' && rand() < 0.4 ? leaf() : base;
        parts.push(foliage(rr, top.x + Math.cos(a) * d, cy, top.z + Math.sin(a) * d, c, rand, 1, species === 'blossom' ? 0.8 : 0.85));
      }
      parts.push(foliage(crown * 0.75, top.x, h + crown * 0.8, top.z, base, rand, 1, 0.85));
      break;
    }
    case 'poplar': {
      const h = 2 + rand();
      parts.push(trunk(0.2, 0.12, h + 3, 0, 0, 0, bark, lean.multiplyScalar(0.3)));
      const c = leaf();
      for (let i = 0; i < 4; i++) {
        parts.push(foliage(1.1 - i * 0.12, (rand() - 0.5) * 0.4, h + 1 + i * 1.5, (rand() - 0.5) * 0.4, c, rand, 1, 1.5));
      }
      break;
    }
    case 'pine': {
      const h = 6 + rand() * 4;
      parts.push(trunk(0.28, 0.12, h, 0, 0, 0, bark, new THREE.Vector3()));
      const tiers = 5 + Math.floor(rand() * 2);
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers;
        const rr = (2.4 - t * 1.9) * (0.9 + rand() * 0.2);
        const g = new THREE.ConeGeometry(rr, 2.2, 9, 1, true);
        const pos = g.attributes.position;
        const v = new THREE.Vector3();
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k);
          if (v.y < 0) {
            const a = Math.atan2(v.z, v.x);
            const j = 1 + 0.18 * Math.sin(a * 9 + i);
            v.x *= j;
            v.z *= j;
            v.y -= 0.25 * Math.abs(Math.sin(a * 4.5));
          }
          pos.setXYZ(k, v.x, v.y + 1.8 + t * (h - 1.5), v.z);
        }
        g.computeVertexNormals();
        const c = leaf();
        parts.push(paint(clean(g), c, 1, (p) => 0.65 + 0.45 * smoothstep(1.2 + t * h, 3 + t * h, p.y)));
      }
      break;
    }
    case 'cypress': {
      const h = 7 + rand() * 4;
      parts.push(trunk(0.22, 0.1, 2, 0, 0, 0, bark, new THREE.Vector3()));
      const c = leaf();
      const g = foliage(1, 0, 0, 0, c, rand, 1, 1, 2);
      g.scale(1.25, h / 2, 1.25);
      g.translate(0, h / 2 + 0.8, 0);
      // recolour with height gradient
      paint(g, c, (y) => clamp(y / h, 0.2, 1), (p) => 0.6 + 0.5 * smoothstep(0, h, p.y));
      parts.push(g);
      break;
    }
    case 'palm': {
      const h = 5 + rand() * 2.5;
      const bend = new THREE.Vector3((rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.8);
      parts.push(trunk(0.24, 0.16, h, 0, 0, 0, bark, bend, 8));
      const top = new THREE.Vector3(bend.x * h, h, bend.z * h);
      const fronds = 8;
      const c = leaf();
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * Math.PI * 2 + rand() * 0.3;
        const len = 3 + rand() * 0.8;
        const verts: number[] = [];
        const steps = 6;
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps, t1 = (s + 1) / steps;
          const w0 = 0.5 * Math.sin(Math.PI * Math.min(1, t0 * 1.1 + 0.05));
          const w1 = 0.5 * Math.sin(Math.PI * Math.min(1, t1 * 1.1 + 0.05));
          const y0 = 0.6 * t0 - 1.6 * t0 * t0, y1 = 0.6 * t1 - 1.6 * t1 * t1;
          const p = (t: number, w: number, y: number) => [Math.cos(a) * t * len - Math.sin(a) * w, y, Math.sin(a) * t * len + Math.cos(a) * w];
          const A = p(t0, -w0, y0), B = p(t0, w0, y0), C = p(t1, -w1, y1), D = p(t1, w1, y1);
          verts.push(...A, ...C, ...B, ...B, ...C, ...D);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        g.translate(top.x, top.y, top.z);
        g.computeVertexNormals();
        const nrm = g.attributes.normal;
        for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, 0, 1, 0);
        parts.push(paint(g, c, 1, () => 0.8 + rand() * 0.3));
      }
      break;
    }
    case 'bush': {
      const c = leaf();
      const n = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        parts.push(foliage(0.55 + rand() * 0.4, Math.cos(a) * 0.5, 0.45 + rand() * 0.3, Math.sin(a) * 0.5, c, rand, 0.6, 0.8));
      }
      break;
    }
    case 'deadtree': {
      const h = 3 + rand() * 2;
      parts.push(trunk(0.22, 0.08, h, 0, 0, 0, bark, lean));
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(a), 0.8 + rand() * 0.5, Math.sin(a)).normalize();
        const b = trunk(0.08, 0.02, 1 + rand(), 0, 0, 0, bark, new THREE.Vector3());
        b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        b.translate(lean.x * h * 0.7, h * (0.5 + rand() * 0.4), lean.z * h * 0.7);
        parts.push(b);
      }
      break;
    }
  }
  const merged = mergeGeometries(parts, false)!;
  merged.computeBoundingSphere();
  return merged;
}

export function makeRockGeometry(seed: number, flat = 0.7): THREE.BufferGeometry {
  const rand = rng(seed * 104729);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const s = rand() * 50;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = simplex.noise(v.x * 1.1 + s, v.y * 1.1 + v.z * 0.9) * 0.3 + simplex.noise(v.x * 2.7 - s, v.z * 2.7) * 0.12;
    v.multiplyScalar(1 + n);
    v.y *= flat;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  const col = new THREE.Color('#ffffff');
  return paint(clean(ng), col, 0, (p) => 0.78 + 0.28 * smoothstep(-0.6, 0.8, p.y));
}

// ───────────────────────── materials ─────────────────────────

export function makeWindMaterial(opts: { flutter?: number; roughness?: number } = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness ?? 0.9, metalness: 0 });
  const flutter = (opts.flutter ?? 1).toFixed(3);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec3 origin = vec3(0.0);
  #ifdef USE_INSTANCING
    origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float ph = origin.x * 0.071 + origin.z * 0.053;
  float w = sin(uTime * 1.2 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25 + sin(uTime * 0.5 + ph * 0.3) * 0.4;
  float s = aSway * aSway;
  transformed.x += w * s * uWind * 0.22;
  transformed.z += cos(uTime * 1.05 + ph) * s * uWind * 0.14;
  // leaf flutter: the offset depends only on the vertex position, so the copies of a vertex shared by
  // neighbouring flat-shaded faces move together (moving along the per-face normal opened hairline
  // cracks the sky showed through)
  vec3 fl = vec3(sin(uTime * 5.5 + position.y * 2.7 + ph * 9.0), sin(uTime * 4.7 + position.x * 2.3 + ph * 7.0) * 0.6, sin(uTime * 5.1 + position.z * 2.5 + ph * 8.0));
  transformed += fl * 0.03 * aSway * ${flutter};
}`,
      );
  };
  return mat;
}

// ───────────────────────── forest (instanced) ─────────────────────────

interface Placement {
  x: number;
  y: number;
  z: number;
  s: number;
  r: number;
}

export interface Exclusion {
  x: number;
  z: number;
  r: number;
}

export class Forest {
  readonly group = new THREE.Group();
  private placements = new Map<string, Placement[]>();
  private variants = 4;
  readonly exclusions: Exclusion[] = [];
  private treeMat = makeWindMaterial({ flutter: 1 });
  private rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  /** colliders produced for trunks / rocks: x, z, radius */
  readonly colliders: { x: number; z: number; r: number }[] = [];

  constructor(private terrain: Terrain) {}

  exclude(x: number, z: number, r: number) {
    this.exclusions.push({ x, z, r });
  }

  isExcluded(x: number, z: number, pad = 0): boolean {
    for (const e of this.exclusions) {
      const dx = x - e.x, dz = z - e.z;
      if (dx * dx + dz * dz < (e.r + pad) * (e.r + pad)) return true;
    }
    return false;
  }

  // the rotation comes from the position: the island must be identical every time it is built
  // (the constellations are placed by looking at the scenery, trees included)
  add(kind: string, x: number, z: number, s = 1, r = hash2(Math.round(x * 7) + 11, Math.round(z * 7) - 5) * Math.PI * 2, y?: number) {
    const variant = Math.floor(hash2(Math.round(x * 10), Math.round(z * 10)) * this.variants);
    const key = `${kind}#${variant}`;
    if (!this.placements.has(key)) this.placements.set(key, []);
    this.placements.get(key)!.push({ x, y: y ?? this.terrain.heightAt(x, z) - 0.15, z, s, r });
    if (kind.startsWith('rock')) {
      if (s > 0.9) this.colliders.push({ x, z, r: s * 0.85 });
    } else if (kind !== 'bush') this.colliders.push({ x, z, r: 0.35 * s });
  }

  /** Scatter a species over the island with a density function. */
  scatter(kind: string, cell: number, density: (x: number, z: number, h: number, slope: number, path: number) => number, scale: [number, number], seed: number, bounds = 560) {
    const rand = rng(seed);
    const n = new THREE.Vector3();
    for (let gz = -bounds; gz < bounds; gz += cell) {
      for (let gx = -bounds; gx < bounds; gx += cell) {
        const x = gx + rand() * cell;
        const z = gz + rand() * cell;
        const roll = rand();
        const sc = scale[0] + rand() * (scale[1] - scale[0]);
        const h = this.terrain.heightAt(x, z);
        if (h < 0.8) continue;
        this.terrain.normalAt(x, z, n);
        const d = density(x, z, h, 1 - n.y, this.terrain.pathAt(x, z));
        if (roll > d) continue;
        if (this.isExcluded(x, z, sc * 1.2)) continue;
        this.add(kind, x, z, sc);
      }
    }
  }

  /** A number that changes whenever the trees and rocks change (for caches built from them). */
  fingerprint(): number {
    let h = 0;
    for (const [key, list] of this.placements) {
      h = (h * 31 + key.length * 7 + list.length) % 1000000007;
      for (const p of list) h = (h * 17 + Math.round(p.x * 3 + p.z * 5 + p.s * 100 + p.r * 10)) % 1000000007;
    }
    return h;
  }

  /** drop trees and rocks whose base is within r of (x,z) (e.g. under something placed later) */
  removeNear(x: number, z: number, r: number) {
    for (const list of this.placements.values()) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < (r + 0.4 * p.s) ** 2) list.splice(i, 1);
      }
    }
    this.hitGrid = null;
  }

  private geoCache = new Map<string, THREE.BufferGeometry>();
  private geometryFor(key: string): THREE.BufferGeometry {
    let geo = this.geoCache.get(key);
    if (geo) return geo;
    const [kind, v] = key.split('#');
    const variant = Number(v);
    if (kind.startsWith('rock')) {
      geo = makeRockGeometry(variant + (kind === 'rockflat' ? 20 : 0), kind === 'rockflat' ? 0.45 : 0.75);
      const tint = kind === 'rocksand' ? '#d8bb8a' : kind === 'rockdark' ? '#6a6670' : kind === 'rockwhite' ? '#e4ddd0' : '#a29c92';
      const col = geo.attributes.color;
      const t = new THREE.Color(tint);
      for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * t.r, col.getY(i) * t.g, col.getZ(i) * t.b);
    } else geo = makeTreeGeometry(kind as Species, variant + 1);
    this.geoCache.set(key, geo);
    return geo;
  }

  /** the solid part of a tree (its crown) or a rock, as an axis-aligned ellipsoid in local units */
  private shapeCache = new Map<string, { c: THREE.Vector3; e: THREE.Vector3 }>();
  private shapeFor(key: string) {
    let sh = this.shapeCache.get(key);
    if (sh) return sh;
    const pos = this.geometryFor(key).attributes.position;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    const rock = key.startsWith('rock');
    const cut = rock ? -Infinity : maxY * 0.38; // the crown, not the trunk
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y >= cut) box.expandByPoint(v);
    }
    const c = box.getCenter(new THREE.Vector3());
    const e = box.getSize(new THREE.Vector3()).multiplyScalar(0.5 * (rock ? 0.9 : 0.82));
    sh = { c, e };
    this.shapeCache.set(key, sh);
    return sh;
  }

  private hitGrid: Map<string, { key: string; p: Placement }[]> | null = null;
  private static readonly HIT_CELL = 8;

  /**
   * First tree crown or rock along a ray (for placing things "in the scenery"). Crowns and rocks
   * are approximated by ellipsoids fitted to their geometry.
   */
  raycast(o: THREE.Vector3, d: THREE.Vector3, tMax: number): { t: number; kind: 'tree' | 'rock'; species: string; point: THREE.Vector3 } | null {
    const C = Forest.HIT_CELL;
    if (!this.hitGrid) {
      this.hitGrid = new Map();
      for (const [key, list] of this.placements) {
        for (const p of list) {
          const k = `${Math.floor(p.x / C)},${Math.floor(p.z / C)}`;
          let cell = this.hitGrid.get(k);
          if (!cell) this.hitGrid.set(k, (cell = []));
          cell.push({ key, p });
        }
      }
    }
    let best: { t: number; key: string } | null = null;
    const seen = new Set<Placement>();
    const lo = new THREE.Vector3(), ld = new THREE.Vector3();
    for (let t = 0; t <= tMax + C; t += C * 0.5) {
      if (best && t > best.t + C) break;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      const cx = Math.floor(x / C), cz = Math.floor(z / C);
      for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const cell = this.hitGrid.get(`${ix},${iz}`);
        if (!cell) continue;
        for (const { key, p } of cell) {
          if (seen.has(p)) continue;
          seen.add(p);
          const sh = this.shapeFor(key);
          // ray into the instance's local frame (rotation about Y, uniform scale), then into the unit sphere
          const cs = Math.cos(-p.r), sn = Math.sin(-p.r);
          const ox = o.x - p.x, oy = o.y - p.y, oz = o.z - p.z;
          lo.set((ox * cs + oz * sn) / p.s, oy / p.s, (-ox * sn + oz * cs) / p.s).sub(sh.c).divide(sh.e);
          ld.set((d.x * cs + d.z * sn) / p.s, d.y / p.s, (-d.x * sn + d.z * cs) / p.s).divide(sh.e);
          const a = ld.dot(ld), b = 2 * lo.dot(ld), cc = lo.dot(lo) - 1;
          const disc = b * b - 4 * a * cc;
          if (disc < 0) continue;
          const t0 = (-b - Math.sqrt(disc)) / (2 * a);
          if (t0 > 0.5 && t0 < tMax && (!best || t0 < best.t)) best = { t: t0, key };
        }
      }
    }
    if (!best) return null;
    const species = best.key.split('#')[0];
    return { t: best.t, kind: species.startsWith('rock') ? 'rock' : 'tree', species, point: o.clone().addScaledVector(d, best.t) };
  }

  /** is p inside (or within `pad` metres of) any tree crown? — e.g. to keep a viewpoint clear of foliage */
  crownNear(p: THREE.Vector3, pad: number): boolean {
    const C = Forest.HIT_CELL;
    if (!this.hitGrid) this.raycast(p, new THREE.Vector3(0, 1, 0), 0.01); // builds the grid
    const cx = Math.floor(p.x / C), cz = Math.floor(p.z / C);
    const l = new THREE.Vector3();
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
      for (const { key, p: q } of this.hitGrid!.get(`${ix},${iz}`) ?? []) {
        if (key.startsWith('rock')) continue;
        const sh = this.shapeFor(key);
        const cs = Math.cos(-q.r), sn = Math.sin(-q.r);
        const ox = p.x - q.x, oy = p.y - q.y, oz = p.z - q.z;
        l.set((ox * cs + oz * sn) / q.s, oy / q.s, (-ox * sn + oz * cs) / q.s).sub(sh.c);
        // ellipsoid grown by pad (in local units)
        const e = sh.e, pd = pad / q.s;
        if ((l.x / (e.x + pd)) ** 2 + (l.y / (e.y + pd)) ** 2 + (l.z / (e.z + pd)) ** 2 < 1) return true;
      }
    }
    return false;
  }

  build(): THREE.Group {
    const dummy = new THREE.Object3D();
    for (const [key, list] of this.placements) {
      if (!list.length) continue;
      const kind = key.split('#')[0];
      const geo = this.geometryFor(key);
      const mat: THREE.Material = kind.startsWith('rock') ? this.rockMat : this.treeMat;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.r, 0);
        dummy.scale.setScalar(p.s);
        if (kind.startsWith('rock')) dummy.scale.set(p.s * (0.8 + hash2(i, 3) * 0.5), p.s, p.s * (0.8 + hash2(i, 7) * 0.5));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.name = `veg_${key}`;
      this.group.add(mesh);
    }
    return this.group;
  }
}

// ───────────────────────── grass + flowers (dynamic around the player) ─────────────────────────

function makeGrassClump(): THREE.BufferGeometry {
  const rand = rng(99);
  const pos: number[] = [];
  const hh: number[] = [];
  const blades = 11;
  for (let b = 0; b < blades; b++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.42;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = 0.22 + rand() * 0.34;
    const w = 0.022 + rand() * 0.016;
    const facing = rand() * Math.PI;
    const lx = Math.cos(facing) * w, lz = Math.sin(facing) * w;
    const lean = 0.08 + rand() * 0.16;
    const tipx = x + Math.cos(a + 1) * lean, tipz = z + Math.sin(a + 1) * lean;
    const mx = x + (tipx - x) * 0.45, mz = z + (tipz - z) * 0.45;
    pos.push(x - lx, 0, z - lz, x + lx, 0, z + lz, mx + lx * 0.7, h * 0.55, mz + lz * 0.7);
    hh.push(0, 0, 0.55);
    pos.push(x - lx, 0, z - lz, mx + lx * 0.7, h * 0.55, mz + lz * 0.7, mx - lx * 0.7, h * 0.55, mz - lz * 0.7);
    hh.push(0, 0.55, 0.55);
    pos.push(mx - lx * 0.7, h * 0.55, mz - lz * 0.7, mx + lx * 0.7, h * 0.55, mz + lz * 0.7, tipx, h, tipz);
    hh.push(0.55, 0.55, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
  const n = new Float32Array(pos.length);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

function makeFlower(): THREE.BufferGeometry {
  const pos: number[] = [];
  const hh: number[] = [];
  const petals = 5;
  const y = 0.42;
  // stem
  pos.push(-0.01, 0, 0, 0.01, 0, 0, 0, y, 0);
  hh.push(0, 0, 0.6);
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * Math.PI * 2;
    const a1 = a0 + Math.PI / petals;
    const a2 = a0 + (2 * Math.PI) / petals;
    pos.push(0, y + 0.02, 0, Math.cos(a0) * 0.07, y, Math.sin(a0) * 0.07, Math.cos(a1) * 0.11, y + 0.01, Math.sin(a1) * 0.11);
    hh.push(1, 1, 1);
    pos.push(0, y + 0.02, 0, Math.cos(a1) * 0.11, y + 0.01, Math.sin(a1) * 0.11, Math.cos(a2) * 0.07, y, Math.sin(a2) * 0.07);
    hh.push(1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
  const n = new Float32Array(pos.length);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

function makeGrassMaterial(isFlower: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.uniforms.uFadeR = { value: 62 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH;\nvarying float vH;\nuniform float uTime;\nuniform float uWind;\nuniform float uFadeR;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vH = aH;
{
  vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float dist = distance(origin.xz, cameraPosition.xz);
  float fade = smoothstep(uFadeR, uFadeR - 14.0, dist);
  transformed.y *= fade;
  float ph = origin.x * 0.21 + origin.z * 0.17;
  float gust = 0.5 + 0.5 * sin(uTime * 0.35 + origin.x * 0.02 + origin.z * 0.015);
  float w = (sin(uTime * 1.9 + ph) * 0.5 + 0.5 * sin(uTime * 3.1 + ph * 1.3)) * (0.5 + gust);
  transformed.x += w * aH * aH * 0.16 * uWind;
  transformed.z += cos(uTime * 1.5 + ph) * aH * aH * 0.08 * uWind;
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace(
        '#include <color_fragment>',
        isFlower
          ? '#include <color_fragment>\ndiffuseColor.rgb = mix(vec3(0.25,0.45,0.2), diffuseColor.rgb, step(0.9, vH));'
          : '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.72, 1.12, vH);\ndiffuseColor.rgb += vec3(0.04,0.035,0.0) * vH * vH;',
      );
  };
  return mat;
}

export interface GrassRules {
  /** grass density 0..1 at a point */
  density: (x: number, z: number, h: number, slope: number, path: number) => number;
  /** flower colour for a point (or null) */
  flower: (x: number, z: number) => string | null;
  /** chance (0..1) that a grass clump becomes a flower */
  flowerChance?: (x: number, z: number) => number;
  /** grass tint for a point */
  tint: (x: number, z: number, base: THREE.Color) => THREE.Color;
}

export class GrassField {
  readonly group = new THREE.Group();
  private grass: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private cx = Infinity;
  private cz = Infinity;
  private cell = 4;
  radius = 58;
  private maxGrass = 34000;
  private maxFlowers = 5000;
  enabled = true;
  densityScale = 1;
  /** returns true where something (a floor, a plaza) covers the ground */
  covered: (x: number, z: number, h: number) => boolean = () => false;

  constructor(private terrain: Terrain, private rules: GrassRules, private colorAt: (x: number, z: number, out: THREE.Color) => THREE.Color) {
    this.grass = new THREE.InstancedMesh(makeGrassClump(), makeGrassMaterial(false), this.maxGrass);
    this.flowers = new THREE.InstancedMesh(makeFlower(), makeGrassMaterial(true), this.maxFlowers);
    for (const m of [this.grass, this.flowers]) {
      m.frustumCulled = false;
      m.receiveShadow = true;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    this.grass.setColorAt(0, new THREE.Color());
    this.flowers.setColorAt(0, new THREE.Color());
  }

  update(px: number, pz: number, force = false) {
    if (!this.enabled) {
      this.grass.count = this.flowers.count = 0;
      return;
    }
    const cx = Math.round(px / 8) * 8;
    const cz = Math.round(pz / 8) * 8;
    if (!force && cx === this.cx && cz === this.cz) return;
    this.cx = cx;
    this.cz = cz;
    this.rebuild(px, pz);
  }

  private rebuild(px: number, pz: number) {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const n = new THREE.Vector3();
    let gi = 0;
    let fi = 0;
    const R = this.radius;
    const c = this.cell;
    const x0 = Math.floor((px - R) / c), x1 = Math.ceil((px + R) / c);
    const z0 = Math.floor((pz - R) / c), z1 = Math.ceil((pz + R) / c);
    const perCell = Math.round(13 * this.densityScale);
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const ccx = gx * c + c / 2, ccz = gz * c + c / 2;
        const dd = Math.hypot(ccx - px, ccz - pz);
        if (dd > R) continue;
        for (let k = 0; k < perCell; k++) {
          const r1 = hash2(gx * 31 + k * 7, gz * 17 + k * 13);
          const r2 = hash2(gx * 13 + k * 5 + 99, gz * 29 + k * 11);
          const r3 = hash2(gx * 7 + k * 3, gz * 3 + k * 19 + 7);
          const x = gx * c + r1 * c, z = gz * c + r2 * c;
          const h = this.terrain.heightAt(x, z);
          if (h < 0.9) continue;
          this.terrain.normalAt(x, z, n);
          const d = this.rules.density(x, z, h, 1 - n.y, this.terrain.pathAt(x, z));
          if (r3 > d) continue;
          if (this.covered(x, z, h)) continue;
          const fc = this.rules.flowerChance ? this.rules.flowerChance(x, z) : 0.08;
          const flower = r3 < d * fc ? this.rules.flower(x, z) : null;
          dummy.position.set(x, h - 0.02, z);
          dummy.rotation.set(0, r1 * 6.283, 0);
          const s = 0.8 + r2 * 0.6;
          dummy.scale.set(s, s * (0.8 + r3 * 0.5), s);
          dummy.updateMatrix();
          if (flower && fi < this.maxFlowers) {
            this.flowers.setMatrixAt(fi, dummy.matrix);
            this.flowers.setColorAt(fi, col.set(flower));
            fi++;
          } else if (gi < this.maxGrass) {
            this.grass.setMatrixAt(gi, dummy.matrix);
            this.colorAt(x, z, col);
            this.grass.setColorAt(gi, this.rules.tint(x, z, col));
            gi++;
          }
        }
      }
    }
    this.grass.count = gi;
    this.flowers.count = fi;
    this.grass.instanceMatrix.needsUpdate = true;
    this.flowers.instanceMatrix.needsUpdate = true;
    if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true;
  }
}
