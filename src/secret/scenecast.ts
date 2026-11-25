/**
 * Exact lines of sight through the island as it is drawn: terrain, ruins, walls, rocks, trunks —
 * every opaque triangle on screen. Used to lay the constellations' lines exactly on what you see
 * (and never on water, panels, doors or anything else that moves).
 *
 * Groups can say how they count with `userData.castAs`: 'skip' (ignored: sky, grass, effects),
 * 'bad' (a line may not touch it: water, panels, doors, moving things), 'terrain', 'static'.
 */
import * as THREE from 'three';
import { TriBVH } from './bvh';

export type CastClass = 'terrain' | 'static' | 'rock' | 'tree' | 'bad' | 'water';
export interface CastHit {
  t: number;
  cls: CastClass;
  /** world normal, facing the ray's origin */
  n: THREE.Vector3;
  /** how much the hit spot sways in the wind (trees: 0 at the foot of the trunk, 1 in the crown) */
  sway: number;
  /** which object was hit (to tell one tree from the next) */
  id: number;
  /** trees: the wind's phase there, the sway's reach (sway² × size) and the tree's turn */
  wind: [number, number, number] | null;
  /** the colour of what was hit (sRGB hex) */
  color: number;
  /** instances (trees): where the hit one stands, and its kind (oak, bush…) */
  ox: number;
  oz: number;
  species: string;
  /** a fixed surface (wall, paving…): its index in staticSurfaces() (-1 otherwise) */
  sid: number;
}

/**
 * The fixed surfaces of the scene (walls, paving, ruins…) in a stable order, so a saved picture can
 * name the one its line lies on (and draw on it again, the same every time).
 */
export function staticSurfaces(scene: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D, inherited: string | null, hidden: boolean) => {
    const tag = (o.userData?.castAs as string | undefined) ?? inherited;
    if (tag === 'skip') return;
    if ((o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (o as THREE.Line).isLine) return;
    const hid = hidden || !o.visible;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !hid && (tag === null || tag === 'static')) {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
      const seeThrough = !!mat && ((mat.transparent && mat.opacity < 0.75) || !mat.depthWrite || mat.blending === THREE.AdditiveBlending || !mat.visible);
      if (!seeThrough) out.push(m);
    }
    for (const ch of o.children) walk(ch, tag, hid);
  };
  walk(scene, null, false);
  return out;
}

interface Entry {
  bvh: TriBVH;
  /** world → local (column-major 4×4), null when the mesh is already in world units */
  inv: Float64Array | null;
  cls: CastClass;
  box: Float64Array;
  sway: ArrayLike<number> | null;
  stamp: number;
  id: number;
  /** instances: where they stand, their size and turn (for the wind) */
  ox: number;
  oz: number;
  scale: number;
  rot: number;
  colors: ArrayLike<number> | null;
  tint: THREE.Color;
  species: string;
  sid: number;
}

const CELL = 12;
const key = (i: number, j: number) => (i + 2048) * 4096 + (j + 2048);

export class SceneCaster {
  private entries: Entry[] = [];
  private grid = new Map<number, Entry[]>();
  private stamp = 0;
  private bvhCache = new Map<THREE.BufferGeometry, TriBVH | null>();
  /** changes whenever what was collected changes (for the placement signature) */
  fingerprint = 0;
  triangles = 0;

  private sids = new Map<THREE.Object3D, number>();

  constructor(scene: THREE.Object3D) {
    scene.updateMatrixWorld(true);
    staticSurfaces(scene).forEach((m, i) => this.sids.set(m, i));
    this.collect(scene, null, false);
  }

  private mix(v: number) {
    this.fingerprint = (Math.imul(this.fingerprint ^ (Math.round(v * 10) | 0), 16777619) >>> 0);
  }

  private bvhFor(geo: THREE.BufferGeometry): TriBVH | null {
    if (this.bvhCache.has(geo)) return this.bvhCache.get(geo)!;
    const pa = geo.attributes.position as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    let b: TriBVH | null = null;
    if (pa && pa.itemSize === 3 && pa.count >= 3) {
      let arr: ArrayLike<number>;
      if ((pa as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
        const a = new Float32Array(pa.count * 3);
        for (let i = 0; i < pa.count; i++) {
          a[i * 3] = pa.getX(i);
          a[i * 3 + 1] = pa.getY(i);
          a[i * 3 + 2] = pa.getZ(i);
        }
        arr = a;
      } else arr = (pa as THREE.BufferAttribute).array;
      b = new TriBVH(arr, geo.index ? geo.index.array : null);
      this.triangles += geo.index ? geo.index.count / 3 : pa.count / 3;
    }
    this.bvhCache.set(geo, b);
    return b;
  }

  private collect(o: THREE.Object3D, inherited: CastClass | 'skip' | null, hidden: boolean) {
    const tag = o.userData?.castAs as CastClass | 'skip' | undefined;
    const cls = tag ?? inherited;
    if (cls === 'skip') return;
    if ((o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (o as THREE.Line).isLine) return;
    const hid = hidden || !o.visible;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
      const seeThrough = !!mat && ((mat.transparent && mat.opacity < 0.75) || !mat.depthWrite || mat.blending === THREE.AdditiveBlending || !mat.visible);
      if (!seeThrough) {
        // something hidden now may well appear later (a bridge, steps): never draw where it would be
        let c: CastClass = hid ? 'bad' : cls ?? 'static';
        if ((m as THREE.InstancedMesh).isInstancedMesh) {
          if (m.name.startsWith('veg_') && c !== 'bad') c = m.name.startsWith('veg_rock') ? 'rock' : 'tree';
          this.addInstanced(m as THREE.InstancedMesh, c);
        } else this.addMesh(m, c, m.matrixWorld);
      }
    }
    for (const ch of o.children) this.collect(ch, cls, hid);
  }

  private addMesh(m: THREE.Mesh, cls: CastClass, world: THREE.Matrix4, sway: ArrayLike<number> | null = null) {
    const ca = m.geometry.attributes.color as THREE.BufferAttribute | undefined;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
    const colors = ca && ca.itemSize >= 3 && !(ca as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? ca.array : null;
    const tint = mat?.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
    const bvh = this.bvhFor(m.geometry);
    if (!bvh) return;
    const identity = world.equals(IDENTITY);
    const inv = identity ? null : Float64Array.from(new THREE.Matrix4().copy(world).invert().elements);
    const lb = bvh.box();
    const box = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const v = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? lb[3] : lb[0], k & 2 ? lb[4] : lb[1], k & 4 ? lb[5] : lb[2]);
      if (!identity) v.applyMatrix4(world);
      box[0] = Math.min(box[0], v.x);
      box[1] = Math.min(box[1], v.y);
      box[2] = Math.min(box[2], v.z);
      box[3] = Math.max(box[3], v.x);
      box[4] = Math.max(box[4], v.y);
      box[5] = Math.max(box[5], v.z);
    }
    if (!isFinite(box[0]) || !isFinite(box[3])) return;
    const tr = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    world.decompose(tr, q, sc);
    const rot = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    const species = m.name.startsWith('veg_') ? m.name.slice(4).split('#')[0] : '';
    const e: Entry = { bvh, inv, cls, box, sway, stamp: 0, id: this.entries.length, ox: tr.x, oz: tr.z, scale: sc.y, rot, colors, tint, species, sid: this.sids.get(m) ?? -1 };
    this.entries.push(e);
    this.mix(box[0] + box[2] * 3 + box[4] * 7 + (cls.length * 13));
    const i0 = Math.floor(box[0] / CELL), i1 = Math.floor(box[3] / CELL);
    const j0 = Math.floor(box[2] / CELL), j1 = Math.floor(box[5] / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      let cell = this.grid.get(k);
      if (!cell) this.grid.set(k, (cell = []));
      cell.push(e);
    }
  }

  private addInstanced(m: THREE.InstancedMesh, cls: CastClass) {
    const sway = (m.geometry.attributes.aSway as THREE.BufferAttribute | undefined)?.array ?? null;
    const im = new THREE.Matrix4(), w = new THREE.Matrix4();
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, im);
      w.multiplyMatrices(m.matrixWorld, im);
      this.addMesh(m, cls, w, sway);
    }
  }

  /** first thing drawn along o + t·d (tMin < t < tMax), or null when nothing is there (sky) */
  cast(o: THREE.Vector3, d: THREE.Vector3, tMin: number, tMax: number): CastHit | null {
    const stamp = ++this.stamp;
    let best = tMax, bestE: Entry | null = null, bestTri = -1;
    let ix = Math.floor(o.x / CELL), iz = Math.floor(o.z / CELL);
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const ddx = Math.abs(d.x) > 1e-9 ? Math.abs(CELL / d.x) : Infinity;
    const ddz = Math.abs(d.z) > 1e-9 ? Math.abs(CELL / d.z) : Infinity;
    let nx = Math.abs(d.x) > 1e-9 ? ((ix + (sx > 0 ? 1 : 0)) * CELL - o.x) / d.x : Infinity;
    let nz = Math.abs(d.z) > 1e-9 ? ((iz + (sz > 0 ? 1 : 0)) * CELL - o.z) / d.z : Infinity;
    let tEnter = 0;
    const idx = 1 / (Math.abs(d.x) < 1e-12 ? 1e-12 : d.x), idy = 1 / (Math.abs(d.y) < 1e-12 ? 1e-12 : d.y), idz = 1 / (Math.abs(d.z) < 1e-12 ? 1e-12 : d.z);
    for (let guard = 0; guard < 4000 && tEnter <= best; guard++) {
      const cell = this.grid.get(key(ix, iz));
      if (cell) {
        for (const e of cell) {
          if (e.stamp === stamp) continue;
          e.stamp = stamp;
          const b = e.box;
          let t0 = (b[0] - o.x) * idx, t1 = (b[3] - o.x) * idx;
          let lo = Math.min(t0, t1), hi = Math.max(t0, t1);
          t0 = (b[1] - o.y) * idy;
          t1 = (b[4] - o.y) * idy;
          lo = Math.max(lo, Math.min(t0, t1));
          hi = Math.min(hi, Math.max(t0, t1));
          t0 = (b[2] - o.z) * idz;
          t1 = (b[5] - o.z) * idz;
          lo = Math.max(lo, Math.min(t0, t1));
          hi = Math.min(hi, Math.max(t0, t1));
          if (!(hi >= lo) || hi < tMin || lo > best) continue;
          let t: number;
          const v = e.inv;
          if (v) {
            const ox = v[0] * o.x + v[4] * o.y + v[8] * o.z + v[12];
            const oy = v[1] * o.x + v[5] * o.y + v[9] * o.z + v[13];
            const oz = v[2] * o.x + v[6] * o.y + v[10] * o.z + v[14];
            const dx = v[0] * d.x + v[4] * d.y + v[8] * d.z;
            const dy = v[1] * d.x + v[5] * d.y + v[9] * d.z;
            const dz = v[2] * d.x + v[6] * d.y + v[10] * d.z;
            t = e.bvh.raycast(ox, oy, oz, dx, dy, dz, tMin, best);
          } else t = e.bvh.raycast(o.x, o.y, o.z, d.x, d.y, d.z, tMin, best);
          if (t < best) {
            best = t;
            bestE = e;
            bestTri = e.bvh.lastTri;
          }
        }
      }
      if (nx < nz) {
        tEnter = nx;
        nx += ddx;
        ix += sx;
      } else {
        tEnter = nz;
        nz += ddz;
        iz += sz;
      }
      if (tEnter > tMax || !isFinite(tEnter)) break;
    }
    if (!bestE) return null;
    const ln = bestE.bvh.normal(bestTri, [0, 0, 0]);
    const n = new THREE.Vector3();
    const v = bestE.inv;
    if (v) n.set(v[0] * ln[0] + v[1] * ln[1] + v[2] * ln[2], v[4] * ln[0] + v[5] * ln[1] + v[6] * ln[2], v[8] * ln[0] + v[9] * ln[1] + v[10] * ln[2]).normalize();
    else n.set(ln[0], ln[1], ln[2]);
    if (n.dot(d) > 0) n.negate();
    const sway = bestE.sway ? bestE.bvh.maxOver(bestTri, bestE.sway) : 0;
    const wind: [number, number, number] | null = bestE.sway ? [bestE.ox * 0.071 + bestE.oz * 0.053, sway * sway * bestE.scale, bestE.rot] : null;
    const col = bestE.tint.clone();
    if (bestE.colors) {
      const cs = bestE.colors;
      const stride = (cs.length / (bestE.bvh.pos.length / 3)) | 0 || 3;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 3; k++) {
        const v = bestE.bvh.corner(bestTri, k) * stride;
        r += cs[v];
        g += cs[v + 1];
        b += cs[v + 2];
      }
      col.multiply(new THREE.Color(r / 3, g / 3, b / 3));
    }
    return { t: best, cls: bestE.cls, n, sway, id: bestE.id, wind, color: col.getHex(), ox: bestE.ox, oz: bestE.oz, species: bestE.species, sid: bestE.sid };
  }
}

const IDENTITY = new THREE.Matrix4();
