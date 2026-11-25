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

export const PALETTE: Record<Species, { trunk: string; leaves: string[] }> = {
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

export interface Placement {
  x: number;
  y: number;
  z: number;
  s: number;
  r: number;
  /** grown for a constellation (see Forest.plant) */
  planted?: boolean;
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
  readonly colliders: { x: number; z: number; r: number; planted?: boolean }[] = [];

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

  /** the model a tree or rock standing at (x,z) gets (its variant comes from where it stands) */
  keyAt(kind: string, x: number, z: number): string {
    return `${kind}#${Math.floor(hash2(Math.round(x * 10), Math.round(z * 10)) * this.variants)}`;
  }

  /** its turn, from where it stands (as add() gives it) */
  turnAt(x: number, z: number): number {
    return hash2(Math.round(x * 7) + 11, Math.round(z * 7) - 5) * Math.PI * 2;
  }

  /** a model's crown (or a rock's body) as an ellipsoid: centre and half-sizes, local units */
  shape(key: string): { c: THREE.Vector3; e: THREE.Vector3 } {
    return this.shapeFor(key);
  }

  /**
   * A tree or rock grown for a constellation (see constellations.ts) — an ordinary one of the
   * place's own kinds. Kept apart only so that the island's signature, which the pictures' places
   * are checked against, does not count the trees grown for them.
   */
  plant(kind: string, x: number, z: number, s: number): { key: string; p: Placement } {
    const key = this.keyAt(kind, x, z);
    if (!this.placements.has(key)) this.placements.set(key, []);
    const p: Placement = { x, y: this.terrain.heightAt(x, z) - 0.15, z, s, r: this.turnAt(x, z), planted: true };
    this.placements.get(key)!.push(p);
    if (kind.startsWith('rock')) {
      if (s > 0.9) this.colliders.push({ x, z, r: s * 0.85, planted: true });
    } else if (kind !== 'bush') this.colliders.push({ x, z, r: 0.35 * s, planted: true });
    this.hitGrid = null;
    return { key, p };
  }

  /** take a grown one away again (a picture that did not fit after all) */
  unplant(p: Placement) {
    for (const list of this.placements.values()) {
      const i = list.indexOf(p);
      if (i >= 0) list.splice(i, 1);
    }
    const ci = this.colliders.findIndex((c) => c.planted && c.x === p.x && c.z === p.z);
    if (ci >= 0) this.colliders.splice(ci, 1);
    this.hitGrid = null;
  }

  /** the matrix one is drawn with (i: its index in build()'s list; grown ones need none) */
  matrixOf(key: string, p: Placement, i = 0): THREE.Matrix4 {
    const o = new THREE.Object3D();
    o.position.set(p.x, p.y, p.z);
    o.rotation.set(0, p.r, 0);
    o.scale.setScalar(p.s);
    if (key.startsWith('rock')) {
      // (a rock is a little wider one way than the other)
      const a = p.planted ? hash2(Math.round(p.x * 10), 3) : hash2(i, 3), b = p.planted ? hash2(Math.round(p.z * 10), 7) : hash2(i, 7);
      o.scale.set(p.s * (0.8 + a * 0.5), p.s, p.s * (0.8 + b * 0.5));
    }
    o.updateMatrix();
    return o.matrix.clone();
  }

  /** a grown one drawn at once, before the forest is built again (while the pictures are placed) */
  meshOf(key: string, p: Placement): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometryFor(key), key.startsWith('rock') ? this.rockMat : this.treeMat, 1);
    mesh.setMatrixAt(0, this.matrixOf(key, p));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.name = `veg_${key}`;
    mesh.userData.planted = true;
    return mesh;
  }

  /** is there a trunk (or a rock) within r of (x,z)? */
  standsNear(x: number, z: number, r: number): boolean {
    const C = Forest.HIT_CELL;
    if (!this.hitGrid) this.raycast(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0), 0.01); // builds the grid
    const cx = Math.floor(x / C), cz = Math.floor(z / C);
    const reach = Math.ceil(r / C);
    for (let ix = cx - reach; ix <= cx + reach; ix++) for (let iz = cz - reach; iz <= cz + reach; iz++) {
      for (const { p } of this.hitGrid!.get(`${ix},${iz}`) ?? []) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true;
    }
    return false;
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

  /** the tree standing at (x,z) — its species, geometry and placement (to dress it with blossoms) */
  treeAt(x: number, z: number, tol = 0.08): { species: Species; geometry: THREE.BufferGeometry; p: Placement } | null {
    for (const [key, list] of this.placements) {
      if (key.startsWith('rock')) continue;
      for (const p of list) if (Math.abs(p.x - x) < tol && Math.abs(p.z - z) < tol) return { species: key.split('#')[0] as Species, geometry: this.geometryFor(key), p };
    }
    return null;
  }

  /** the rock or tree standing at (x,z): its geometry and its exact matrix (as drawn) */
  instanceAt(x: number, z: number, tol = 0.08): { key: string; geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 } | null {
    for (const [key, list] of this.placements) {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (Math.abs(p.x - x) > tol || Math.abs(p.z - z) > tol) continue;
        // (build() numbers the grown ones apart from the others)
        const idx = p.planted ? 0 : list.filter((q) => !q.planted).indexOf(p);
        return { key, geometry: this.geometryFor(key), matrix: this.matrixOf(key, p, idx) };
      }
    }
    return null;
  }

  /** the trees in flower (the blossom trees) within r of (x,z) */
  flowering(x: number, z: number, r: number): { key: string; species: string; geometry: THREE.BufferGeometry; p: Placement }[] {
    const out: { key: string; species: string; geometry: THREE.BufferGeometry; p: Placement }[] = [];
    for (const [key, list] of this.placements) {
      const species = key.split('#')[0];
      if (!(species in BLOSSOM_COLORS)) continue;
      const geometry = this.geometryFor(key);
      for (const p of list) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) out.push({ key, species, geometry, p });
    }
    return out;
  }

  /** trees of a species within r of (x,z) (a grove that blossoms together) */
  treesNear(x: number, z: number, r: number, species: string): { species: Species; geometry: THREE.BufferGeometry; p: Placement }[] {
    const out: { species: Species; geometry: THREE.BufferGeometry; p: Placement }[] = [];
    for (const [key, list] of this.placements) {
      if (key.split('#')[0] !== species) continue;
      for (const p of list) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) out.push({ species: species as Species, geometry: this.geometryFor(key), p });
    }
    return out;
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
    for (const [key, all] of this.placements) {
      // (the ones grown for the constellations in a mesh of their own: see plant())
      for (const grown of [false, true]) {
        const list = all.filter((p) => !!p.planted === grown);
        if (!list.length) continue;
        const kind = key.split('#')[0];
        const geo = this.geometryFor(key);
        const mat: THREE.Material = kind.startsWith('rock') ? this.rockMat : this.treeMat;
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((p, i) => mesh.setMatrixAt(i, this.matrixOf(key, p, i)));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.name = `veg_${key}`;
        if (grown) mesh.userData.planted = true;
        this.group.add(mesh);
      }
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
  /** wind ripples on the sand: how many here (0..1) */
  ripples?: (x: number, z: number) => number;
  /** reeds: how many stand here (0..1), given the depth of the water (negative: dry) */
  reeds?: (x: number, z: number, depth: number) => number;
  /** fallen leaves: how many lie here (0..1) and their colour */
  litter?: (x: number, z: number) => number;
  litterColor?: (x: number, z: number, r: number) => string;
}

/** a wind ripple in the sand (unit length along X): a low ridge, a little curved */
function makeRipple(): THREE.BufferGeometry {
  const pos: number[] = [];
  const N = 8;
  const pt = (i: number, side: number) => {
    const t = i / N - 0.5;
    const bend = (t * t - 0.08) * 0.35;
    const h = 0.06 * Math.sin((i / N) * Math.PI) ** 0.6;
    return side === 0 ? [t, h, bend] : [t, 0, bend + side * 0.14];
  };
  for (let i = 0; i < N; i++) {
    for (const side of [-1, 1]) {
      const a0 = pt(i, side), a1 = pt(i + 1, side), t0 = pt(i, 0), t1 = pt(i + 1, 0);
      if (side < 0) pos.push(...a0, ...t0, ...t1, ...a0, ...t1, ...a1);
      else pos.push(...a0, ...t1, ...t0, ...a0, ...a1, ...t1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** a clump of reeds (unit height): thin blades standing in the shallows */
function makeReeds(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const rand = rng(77);
  const greens = [new THREE.Color('#6f8a3a'), new THREE.Color('#7f9844'), new THREE.Color('#5f7a33'), new THREE.Color('#8a9a4a')];
  for (let k = 0; k < 7; k++) {
    const a = rand() * Math.PI * 2, r = rand() * 0.12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.75 + rand() * 0.25, w = 0.014 + rand() * 0.008;
    const lean = (rand() - 0.5) * 0.12, dir = rand() * Math.PI * 2;
    const sx = Math.cos(dir) * w, sz = Math.sin(dir) * w;
    pos.push(x - sx, 0, z - sz, x + sx, 0, z + sz, x + lean, h, z + lean * 0.5);
    const c = greens[k % greens.length];
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** a fallen leaf lying flat (unit size): a rounded leaf, a little curled */
function makeFallenLeaf(): THREE.BufferGeometry {
  const pos: number[] = [];
  const K = 7;
  const ring: number[][] = [];
  for (let k = 0; k < K; k++) {
    const a = (k / K) * Math.PI * 2;
    const tip = Math.max(0, Math.cos(a)) ** 3 * 0.25;
    ring.push([Math.cos(a) * 0.5 * (1 + tip), Math.abs(Math.sin(a)) * 0.05, Math.sin(a) * 0.21 * (1 - 0.15 * Math.cos(a))]);
  }
  for (let k = 0; k < K; k++) pos.push(0, 0.02, 0, ...ring[(k + 1) % K], ...ring[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export class GrassField {
  readonly group = new THREE.Group();
  private grass: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private litter: THREE.InstancedMesh;
  private maxLitter = 18000;
  private reedMesh: THREE.InstancedMesh;
  private maxReeds = 5000;
  private rippleMesh: THREE.InstancedMesh;
  private maxRipples = 9000;
  /** water level at a point (lakes), set by the world */
  waterAt: (x: number, z: number) => number = () => 0;
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
    this.litter = new THREE.InstancedMesh(makeFallenLeaf(), new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), this.maxLitter);
    this.litter.frustumCulled = false;
    this.litter.receiveShadow = true;
    this.litter.count = 0;
    this.litter.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.litter.setColorAt(0, new THREE.Color());
    this.group.add(this.litter);
    this.reedMesh = new THREE.InstancedMesh(makeReeds(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), this.maxReeds);
    this.reedMesh.frustumCulled = false;
    this.reedMesh.receiveShadow = true;
    this.reedMesh.count = 0;
    this.reedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.reedMesh);
    this.rippleMesh = new THREE.InstancedMesh(makeRipple(), new THREE.MeshStandardMaterial({ roughness: 1 }), this.maxRipples);
    this.rippleMesh.frustumCulled = false;
    this.rippleMesh.receiveShadow = true;
    this.rippleMesh.count = 0;
    this.rippleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rippleMesh.setColorAt(0, new THREE.Color());
    this.group.add(this.rippleMesh);
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

  /** rebuild on the next update (something changed where grass may grow) */
  invalidate() {
    this.cx = this.cz = Infinity;
  }

  update(px: number, pz: number, force = false) {
    if (!this.enabled) {
      this.grass.count = this.flowers.count = this.litter.count = this.reedMesh.count = this.rippleMesh.count = 0;
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
    let li = 0;
    let ri = 0;
    let pi = 0;
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
        // wind ripples on the dunes (within 50 m): roughly parallel, as the wind lays them
        if (this.rules.ripples && dd < 50) {
          for (let k = 0; k < 14 && pi < this.maxRipples; k++) {
            const r1 = hash2(gx * 61 + k * 7, gz * 23 + k * 11), r2 = hash2(gx * 29 + k * 19 + 5, gz * 47 + k * 3);
            const x = gx * c + r1 * c, z = gz * c + r2 * c;
            if (hash2(gx * 7 + k * 41, gz * 5 + k * 3) > this.rules.ripples(x, z)) continue;
            if (this.terrain.surfaceAt(x, z) !== 'sand' || this.terrain.pathAt(x, z) > 0.4) continue;
            const h = this.terrain.heightAt(x, z);
            if (h < this.waterAt(x, z) + 0.2 || this.covered(x, z, h)) continue;
            dummy.position.set(x, h - 0.012, z);
            dummy.rotation.set(0, 0.6 + (r1 - 0.5) * 0.5, 0);
            const len = 1.2 + r2 * 1.6;
            dummy.scale.set(len, 0.8 + r1 * 0.6, 1 + r2 * 0.5);
            dummy.updateMatrix();
            this.rippleMesh.setMatrixAt(pi, dummy.matrix);
            this.colorAt(x, z, col);
            this.rippleMesh.setColorAt(pi, col.multiplyScalar(1.03));
            pi++;
          }
        }
        // reeds in the lakes' shallows (within 52 m)
        if (this.rules.reeds && dd < 52) {
          for (let k = 0; k < 10 && ri < this.maxReeds; k++) {
            const r1 = hash2(gx * 53 + k * 3, gz * 7 + k * 29), r2 = hash2(gx * 17 + k * 13 + 3, gz * 43 + k * 5);
            const x = gx * c + r1 * c, z = gz * c + r2 * c;
            const lvl = this.waterAt(x, z);
            if (lvl < 1) continue;
            const h = this.terrain.heightAt(x, z);
            if (hash2(gx * 3 + k * 37, gz * 13 + k) > this.rules.reeds(x, z, lvl - h)) continue;
            dummy.position.set(x, h - 0.05, z);
            dummy.rotation.set((r1 - 0.5) * 0.15, r2 * 6.283, (r2 - 0.5) * 0.15);
            const s = 0.9 + r1 * 0.6 + Math.max(0, lvl - h) * 0.8;
            dummy.scale.set(1, s, 1);
            dummy.updateMatrix();
            this.reedMesh.setMatrixAt(ri++, dummy.matrix);
          }
        }
        // fallen leaves on the autumn wood's floor (within 40 m)
        if (this.rules.litter && dd < 40) {
          for (let k = 0; k < 22 && li < this.maxLitter; k++) {
            const r1 = hash2(gx * 41 + k * 5, gz * 19 + k * 17), r2 = hash2(gx * 23 + k * 9 + 7, gz * 37 + k * 3);
            const x = gx * c + r1 * c, z = gz * c + r2 * c;
            if (hash2(gx * 5 + k * 31, gz * 11 + k) > this.rules.litter(x, z)) continue;
            const h = this.terrain.heightAt(x, z);
            if (h < 0.9 || this.covered(x, z, h) || this.terrain.pathAt(x, z) > 0.4) continue;
            dummy.position.set(x, h + 0.012, z);
            dummy.rotation.set((r1 - 0.5) * 0.5, r2 * 6.283, (r2 - 0.5) * 0.5);
            const s = 0.14 + r1 * 0.1;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            this.litter.setMatrixAt(li, dummy.matrix);
            this.litter.setColorAt(li, col.set(this.rules.litterColor ? this.rules.litterColor(x, z, r2) : '#e2662f'));
            li++;
          }
        }
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
          // wildflowers stand above the grass
          dummy.scale.set(s, s * (0.8 + r3 * 0.5) * (flower ? 1.55 : 1), s);
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
    this.litter.count = li;
    this.reedMesh.count = ri;
    this.rippleMesh.count = pi;
    this.rippleMesh.instanceMatrix.needsUpdate = true;
    if (this.rippleMesh.instanceColor) this.rippleMesh.instanceColor.needsUpdate = true;
    this.reedMesh.instanceMatrix.needsUpdate = true;
    this.litter.instanceMatrix.needsUpdate = true;
    if (this.litter.instanceColor) this.litter.instanceColor.needsUpdate = true;
    this.grass.instanceMatrix.needsUpdate = true;
    this.flowers.instanceMatrix.needsUpdate = true;
    if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true;
  }
}


// ───────────────────────── blossoms on the blossom trees (around the player) ─────────────────────────

/** the blossoms of the trees that flower: mostly the first colour, a few of the second */
export const BLOSSOM_COLORS: Record<string, { colors: string[]; weights: number[] }> = {
  blossom: { colors: ['#f9c4d7', '#fdf3f6'], weights: [0.84, 0.16] },
};

/** a blossom facing +Y (unit size): five rounded petals and a small yellow centre */
export function makeBlossom(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const P = (a: number, r: number) => [Math.cos(a) * r, 0, Math.sin(a) * r];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s1 = P(a - 0.42, 0.31), tip = P(a, 0.5), s2 = P(a + 0.42, 0.31);
    pos.push(0, 0, 0, ...tip, ...s1, 0, 0, 0, ...s2, ...tip);
    for (let k = 0; k < 6; k++) col.push(1, 1, 1);
  }
  const c = new THREE.Color('#f2c95c');
  const cc = [P(0, 0.09), P(2.1, 0.09), P(4.2, 0.09)];
  pos.push(cc[0][0], 0.01, cc[0][2], cc[2][0], 0.01, cc[2][2], cc[1][0], 0.01, cc[1][2]);
  for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

/** spots on a tree model's crown where blossoms sit (local units), with the crown's area */
export function crownSpots(geo: THREE.BufferGeometry, count: number, seed: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const sway = geo.attributes.aSway as THREE.BufferAttribute | undefined;
  const idx = geo.index;
  const n = idx ? idx.count / 3 : pos.count / 3;
  const tris: number[] = [], cum: number[] = [];
  let total = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    if (sway && Math.min(sway.getX(i0), sway.getX(i1), sway.getX(i2)) < 0.3) continue;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    if (ar < 1e-5) continue;
    total += ar;
    tris.push(i0, i1, i2);
    cum.push(total);
  }
  const rand = rng(seed);
  const out: { p: THREE.Vector3; n: THREE.Vector3; sway: number }[] = [];
  if (!tris.length) return { spots: out, area: 0 };
  for (let k = 0; k < count; k++) {
    const u = rand() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < u) lo = m + 1;
      else hi = m;
    }
    const i0 = tris[lo * 3], i1 = tris[lo * 3 + 1], i2 = tris[lo * 3 + 2];
    let r1 = rand(), r2 = rand();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const nn = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    out.push({ p: a.clone().addScaledVector(b.clone().sub(a), r1).addScaledVector(c.clone().sub(a), r2), n: nn, sway: sway ? Math.max(sway.getX(i0), sway.getX(i1), sway.getX(i2)) : 1 });
  }
  return { spots: out, area: total };
}

/**
 * The blossom trees (around the mirror lake) are in flower: their blossoms are drawn around the
 * player, swaying with the crowns in the wind.
 */
export class BlossomField {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private wind: THREE.InstancedBufferAttribute;
  private cx = Infinity;
  private cz = Infinity;
  radius = 64;
  private maxN = 16000;
  private spots = new Map<string, { p: THREE.Vector3; n: THREE.Vector3; sway: number }[]>();

  constructor(private forest: Forest) {
    this.mesh = new THREE.InstancedMesh(makeBlossom(), blossomMaterial(), this.maxN);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.wind = new THREE.InstancedBufferAttribute(new Float32Array(this.maxN * 3), 3);
    this.wind.setUsage(THREE.DynamicDrawUsage);
    this.mesh.geometry.setAttribute('aWind', this.wind);
    this.group.add(this.mesh);
  }

  private spotsFor(key: string, geo: THREE.BufferGeometry) {
    let s = this.spots.get(key);
    if (!s) {
      const area = crownSpots(geo, 1, 1).area;
      s = crownSpots(geo, Math.min(420, Math.max(60, Math.round(area / 0.045))), key.length * 131 + key.charCodeAt(0)).spots;
      this.spots.set(key, s);
    }
    return s;
  }

  update(px: number, pz: number, force = false) {
    const cx = Math.round(px / 8) * 8, cz = Math.round(pz / 8) * 8;
    if (!force && cx === this.cx && cz === this.cz) return;
    this.cx = cx;
    this.cz = cz;
    let n = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const wp = new THREE.Vector3(), wn = new THREE.Vector3();
    for (const t of this.forest.flowering(px, pz, this.radius)) {
      const pal = BLOSSOM_COLORS[t.species];
      const spots = this.spotsFor(t.key, t.geometry);
      const cs = Math.cos(t.p.r), sn = Math.sin(t.p.r);
      const ph = t.p.x * 0.071 + t.p.z * 0.053;
      for (let k = 0; k < spots.length && n < this.maxN; k++) {
        const sp = spots[k];
        wp.set(t.p.x + (sp.p.x * cs + sp.p.z * sn) * t.p.s, t.p.y + sp.p.y * t.p.s, t.p.z + (-sp.p.x * sn + sp.p.z * cs) * t.p.s);
        wn.set(sp.n.x * cs + sp.n.z * sn, sp.n.y, -sp.n.x * sn + sp.n.z * cs).normalize();
        const h = hash2(Math.round(t.p.x * 10) + k * 7, Math.round(t.p.z * 10) - k * 3);
        wp.addScaledVector(wn, 0.03);
        wn.x += (hash2(k, 11) - 0.5) * 0.7;
        wn.z += (hash2(k, 17) - 0.5) * 0.7;
        q.setFromUnitVectors(up, wn.normalize());
        const size = 0.15 + h * 0.07;
        m.compose(wp, q, sc.set(size, size, size));
        this.mesh.setMatrixAt(n, m);
        let ci = 0, acc = pal.weights[0];
        const pick = hash2(k * 13 + 5, Math.round(t.p.x * 7));
        while (pick > acc && ci < pal.colors.length - 1) acc += pal.weights[++ci];
        this.mesh.setColorAt(n, col.set(pal.colors[ci]).multiplyScalar(0.95 + h * 0.08));
        this.wind.setXYZ(n, ph, sp.sway * sp.sway * t.p.s, t.p.r);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.wind.needsUpdate = true;
  }
}

/** blossoms: lit like leaves, swaying with their tree (the same wind as the trees' own shader) */
export function blossomMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime;
    sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWind;\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
{
  float ph = aWind.x;
  float w = sin(uTime * 1.2 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25 + sin(uTime * 0.5 + ph * 0.3) * 0.4;
  vec2 d = vec2(w * aWind.y * uWind * 0.22, cos(uTime * 1.05 + ph) * aWind.y * uWind * 0.14);
  float c = cos(aWind.z), s = sin(aWind.z);
  mvPosition.x += d.x * c + d.y * s;
  mvPosition.z += -d.x * s + d.y * c;
}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  return mat;
}
