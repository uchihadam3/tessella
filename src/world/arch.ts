/**
 * Architecture kit: geometry builders + a static batcher that merges everything per material
 * (few draw calls), plus helpers that register collision at the same time.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CollisionWorld } from '../player/collision';
import type { Surface } from '../audio/api';

export class Batcher {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  readonly group = new THREE.Group();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (m) g.applyMatrix4(m);
    if (g.attributes.color) g.deleteAttribute('color');
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat)!.push(g);
  }

  addMesh(mesh: THREE.Mesh) {
    mesh.updateMatrixWorld(true);
    this.add(mesh.geometry, mesh.material as THREE.Material, mesh.matrixWorld);
  }

  finalize(shadows = true): THREE.Group {
    for (const [mat, list] of this.buckets) {
      // merge in chunks to keep buffers reasonable
      for (let i = 0; i < list.length; i += 400) {
        const merged = mergeGeometries(list.slice(i, i + 400), false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
    this.buckets.clear();
    return this.group;
  }
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

export function mtx(x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
  tmpE.set(rx, ry, rz, 'YXZ');
  tmpQ.setFromEuler(tmpE);
  return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export const G = {
  box: (w: number, h: number, d: number, r = 0) =>
    r > 0 ? cached(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r)) : cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, seg = 16) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 16) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  sphere: (r: number, seg = 16) => cached(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2))),
  torus: (r: number, t: number, seg = 24, arc = Math.PI * 2) => cached(`t${r},${t},${seg},${arc}`, () => new THREE.TorusGeometry(r, t, 8, seg, arc)),
};

/** An arch (two piers + semicircular top) as one geometry, centred at the base, spanning x. */
export function archGeometry(span: number, height: number, thick: number, depth: number): THREE.BufferGeometry {
  const key = `arch${span},${height},${thick},${depth}`;
  return cached(key, () => {
    const outerR = span / 2 + thick;
    const innerR = span / 2;
    const shape = new THREE.Shape();
    const legH = height - innerR;
    shape.moveTo(-outerR, 0);
    shape.lineTo(-outerR, legH);
    shape.absarc(0, legH, outerR, Math.PI, 0, true);
    shape.lineTo(outerR, 0);
    shape.lineTo(innerR, 0);
    shape.lineTo(innerR, legH);
    shape.absarc(0, legH, innerR, 0, Math.PI, false);
    shape.lineTo(-innerR, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 18 });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });
}

/** Gable roof (prism) geometry, ridge along x. */
export function gableRoof(w: number, d: number, h: number, overhang = 0.3): THREE.BufferGeometry {
  return cached(`gable${w},${d},${h},${overhang}`, () => {
    const W = w / 2 + overhang, D = d / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-D, 0);
    shape.lineTo(0, h);
    shape.lineTo(D, 0);
    shape.lineTo(D - 0.12, 0);
    shape.lineTo(0, h - 0.16);
    shape.lineTo(-D + 0.12, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: W * 2, bevelEnabled: false });
    g.translate(0, 0, -W);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

/** Curved oriental roof (pagoda style): a concave square pyramid with lifted eaves. */
export function pagodaRoof(w: number, h: number, flare = 0.35): THREE.BufferGeometry {
  return cached(`pagoda${w},${h},${flare}`, () => {
    const g = new THREE.CylinderGeometry(0.04, w * 0.72, h, 4, 8, false);
    g.rotateY(Math.PI / 4);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const t = (v.y + h / 2) / h; // 0 bottom .. 1 top
      const lin = 1 - t * (1 - 0.04 / (w * 0.72));
      const concave = Math.pow(Math.max(0, 1 - t), 1.65) + 0.05 * t;
      const k = lin > 1e-4 ? concave / lin : 1;
      v.x *= k;
      v.z *= k;
      v.y += flare * Math.pow(1 - t, 4) * h * 0.55;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

export interface BuildCtx {
  batch: Batcher;
  col: CollisionWorld;
}

/** A solid box placed with its base at y (rotation ry). Adds collision (block + walkable top). */
export function solidBox(c: BuildCtx, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, opts: { round?: number; walk?: boolean; surface?: Surface; collide?: boolean } = {}) {
  c.batch.add(G.box(w, h, d, opts.round ?? 0), mat, mtx(x, y + h / 2, z, ry));
  if (opts.collide !== false) {
    if (opts.walk === false) c.col.addBlocker({ x, z, hw: w / 2, hd: d / 2, rot: ry, y0: y, y1: y + h });
    else c.col.addSolidBox(x, z, w / 2, d / 2, ry, y, y + h, opts.surface ?? 'stone');
  }
}

/** Floor slab you can walk on (no blocking if thin). */
export function floorSlab(c: BuildCtx, mat: THREE.Material, x: number, y: number, z: number, w: number, d: number, ry = 0, thick = 0.25, surface: Surface = 'stone') {
  c.batch.add(G.box(w, thick, d), mat, mtx(x, y - thick / 2, z, ry));
  c.col.addFloor({ x, z, hw: w / 2, hd: d / 2, rot: ry, top: y, bottom: y - thick, surface });
}

/** Column with base and capital. */
export function column(c: BuildCtx, mat: THREE.Material, x: number, y: number, z: number, h: number, r = 0.28, collide = true) {
  c.batch.add(G.cyl(r * 1.35, r * 1.45, 0.25, 12), mat, mtx(x, y + 0.125, z));
  c.batch.add(G.cyl(r * 0.92, r, h - 0.55, 14), mat, mtx(x, y + 0.25 + (h - 0.55) / 2, z));
  c.batch.add(G.box(r * 2.7, 0.3, r * 2.7, 0.04), mat, mtx(x, y + h - 0.15, z));
  if (collide) c.col.addBlocker({ x, z, r: r * 1.2, y0: y, y1: y + h });
}

/** Wall from (x0,z0) to (x1,z1), base at y. Optional walkable top. */
export function wall(c: BuildCtx, mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, y: number, h: number, t = 0.6, opts: { cap?: THREE.Material; walk?: boolean } = {}) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ry = Math.atan2(-dz, dx);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  c.batch.add(G.box(len, h, t), mat, mtx(cx, y + h / 2, cz, ry));
  if (opts.cap) c.batch.add(G.box(len + 0.1, 0.18, t + 0.16, 0.04), opts.cap, mtx(cx, y + h + 0.09, cz, ry));
  c.col.addBlocker({ x: cx, z: cz, hw: len / 2, hd: t / 2, rot: ry, y0: y - 5, y1: y + h });
  if (opts.walk) c.col.addFloor({ x: cx, z: cz, hw: len / 2, hd: t / 2, rot: ry, top: y + h });
}

/** Straight stairs rising from (x,z) along direction ry, `steps` steps. Returns top position. */
export function stairs(c: BuildCtx, mat: THREE.Material, x: number, y: number, z: number, ry: number, width: number, rise: number, run: number, steps: number): { x: number; y: number; z: number } {
  const fx = -Math.sin(ry), fz = -Math.cos(ry); // forward = -z rotated
  for (let i = 0; i < steps; i++) {
    const hh = rise * (i + 1);
    const px = x + fx * run * (i + 0.5), pz = z + fz * run * (i + 0.5);
    c.batch.add(G.box(width, hh, run), mat, mtx(px, y + hh / 2, pz, ry));
  }
  const total = run * steps;
  const cx = x + (fx * total) / 2, cz = z + (fz * total) / 2;
  // walkable ramp approximating the steps (v goes from +1 (start) to -1 (top) along local z)
  c.col.addFloor({
    x: cx, z: cz, hw: width / 2, hd: total / 2, rot: ry,
    top: (_u: number, v: number) => y + rise * steps * ((1 - v) / 2) + rise * 0.5,
    bottom: y - 1, surface: 'stone',
  });
  // side blockers
  return { x: x + fx * total, y: y + rise * steps, z: z + fz * total };
}

/** Lantern on a post (emissive). */
export function lantern(c: BuildCtx, post: THREE.Material, glow: THREE.Material, x: number, y: number, z: number, h = 1.6) {
  c.batch.add(G.cyl(0.05, 0.07, h, 8), post, mtx(x, y + h / 2, z));
  c.batch.add(G.box(0.26, 0.3, 0.26, 0.03), post, mtx(x, y + h + 0.15, z));
  c.batch.add(G.box(0.18, 0.22, 0.18), glow, mtx(x, y + h + 0.15, z));
  c.batch.add(G.cone(0.24, 0.18, 4), post, mtx(x, y + h + 0.39, z, Math.PI / 4));
  c.col.addBlocker({ x, z, r: 0.12, y0: y, y1: y + h + 0.5 });
}
