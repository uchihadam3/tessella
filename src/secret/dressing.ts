/**
 * What the lines of a constellation are made of: the very stuff of the place they cross, added
 * the way that place already is.
 *
 *   a meadow with flowers .. some of its flowers (of a colour that meadow has)
 *   plain grass ............ tufts of drier grass
 *   the autumn wood floor .. fallen leaves of another of its colours
 *   sand ................... low ridges of sand
 *   stony ground ........... stones like the ones lying around
 *   a lake ................. reeds
 *   a tree's crown ......... leaves of another of its own shades
 *   a dead tree ............ its bare branches
 *   a ruin, paving, a rock . cracks (and moss)
 *
 * Every element lies exactly where it is seen from the picture's spot, so from there they join
 * into the line; anywhere else they are just flowers, leaves, sand, stones, reeds and cracks.
 */
import * as THREE from 'three';
import { BLOSSOM_COLORS, PALETTE } from '../world/vegetation';
import { LITTER_LINE } from '../world/biomes';
import { CRACK_COLOR } from '../world/weathering';

export type PieceKind = 'ground' | 'floor' | 'wall' | 'tree' | 'rock' | 'water';

/** one surface's stretch of a line, ready to dress */
export interface Piece {
  kind: PieceKind;
  /** directions from the eye and distances to the surface, along the stretch */
  dirs: THREE.Vector3[];
  dists: number[];
  /** the light's sweep parameter (0..1 over the whole picture) and "cut" flags, per sample */
  ts: number[];
  cuts: number[];
  /** the surface normal (facing the eye) */
  n: THREE.Vector3;
  /** what the ground is (grass, sand, leaves, stone, gravel) */
  ground?: string;
  /** on a tree: the wind there (phase, reach, the tree's turn), so what grows there sways with it */
  wind?: [number, number, number] | null;
  /** the surface's own colour (sRGB hex) */
  color?: number;
  /** on a tree: its species */
  species?: string;
}

export interface DressCtx {
  eye: THREE.Vector3;
  heightAt(x: number, z: number): number;
  waterAt(x: number, z: number): number;
  /** the colour of the meadow's flowers that draws here (one the meadow has), or null: no flowers here */
  flowerAt(x: number, z: number): string | null;
  /** the ground's own colour */
  groundColor(x: number, z: number): THREE.Color;
  area: string;
  rnd: () => number;
}

const C = (hex: string | number) => new THREE.Color(hex);
const UP = new THREE.Vector3(0, 1, 0);
const STEM = C('#4d7a33');
const REED = [C('#6f8a3a'), C('#7f9844'), C('#5f7a33')];
const CATTAIL = C('#6b4a2c');
const FALLEN = ['#c9412a', '#e2662f', '#f0a033', '#f2c14e', '#d9572b'];
const DRY = C('#c9b45a');
const MOSS = [C('#5f7f34'), C('#6d8c3a'), C('#55732e')];

export class StrokeBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  tt: number[] = [];
  cut: number[] = [];
  wnd: number[] = [];
  fade: number[] = [];
  /** the wind of what is being dressed now (0 reach: still) */
  wind: [number, number, number] = [0, 0, 0];
  /** light sweep / cut of what is being added now; `far` 1: small things that fade far away like the meadow's own */
  t = 0;
  c = 0;
  far = 0;
  get count() {
    return this.pos.length / 3;
  }

  private v(p: THREE.Vector3, n: THREE.Vector3, col: THREE.Color) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(col.r, col.g, col.b);
    this.tt.push(this.t);
    this.cut.push(this.c);
    this.wnd.push(this.wind[0], this.wind[1], this.wind[2]);
    this.fade.push(this.far);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, col: THREE.Color, n?: THREE.Vector3) {
    const nn = n ?? new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    this.v(a, nn, col);
    this.v(b, nn, col);
    this.v(c, nn, col);
  }

  /** a round piece (a branch, a ridge of sand when `flat` < 1): rings around pts with radius r[i] */
  tube(pts: THREE.Vector3[], r: number[], base: THREE.Color, t: number[], cut: number[], sides = 6, shade = 0.3, flat = 1) {
    if (pts.length < 2) return;
    const rings: THREE.Vector3[][] = [];
    let prevS: THREE.Vector3 | null = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tan = b.clone().sub(a);
      if (tan.lengthSq() < 1e-12) tan.set(1, 0, 0);
      tan.normalize();
      let s = new THREE.Vector3().crossVectors(tan, UP);
      if (s.lengthSq() < 1e-6) s = prevS ? prevS.clone() : new THREE.Vector3(1, 0, 0);
      s.normalize();
      prevS = s;
      const u2 = new THREE.Vector3().crossVectors(s, tan).normalize();
      const ring: THREE.Vector3[] = [];
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2;
        ring.push(s.clone().multiplyScalar(Math.cos(ang)).addScaledVector(u2, Math.sin(ang) * flat));
      }
      rings.push(ring);
    }
    const c = new THREE.Color();
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        const quad: [number, number][] = [[i, k], [i + 1, k], [i + 1, k2], [i, k2]];
        for (const qi of [0, 1, 2, 0, 2, 3]) {
          const [ii, kk] = quad[qi];
          const off = rings[ii][kk];
          const n = off.clone().normalize();
          const p = pts[ii].clone().addScaledVector(off, r[ii]);
          const v = 0.86 + shade * Math.max(0, n.y) - 0.12 * Math.max(0, -n.y) + 0.06 * (((ii * 7 + kk * 3) % 5) / 4 - 0.5);
          c.copy(base).multiplyScalar(v);
          this.t = t[ii];
          this.c = cut[ii];
          this.v(p, n, c);
        }
      }
    }
  }

  /** a flat piece lying on a surface (a crack): pts on the surface, n its normal */
  ribbon(pts: THREE.Vector3[], n: THREE.Vector3, halfW: number[], base: THREE.Color, t: number[], cut: number[]) {
    if (pts.length < 2) return;
    const sides = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tan = b.clone().sub(a).normalize();
      return new THREE.Vector3().crossVectors(n, tan).normalize().multiplyScalar(halfW[i]);
    });
    const c = new THREE.Color();
    for (let i = 0; i < pts.length - 1; i++) {
      const q = [pts[i].clone().sub(sides[i]), pts[i + 1].clone().sub(sides[i + 1]), pts[i + 1].clone().add(sides[i + 1]), pts[i].clone().add(sides[i])];
      const qi2 = [i, i + 1, i + 1, i];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        c.copy(base).multiplyScalar(0.92 + 0.16 * (((qi2[k] * 5) % 3) / 2));
        this.t = t[qi2[k]];
        this.c = cut[qi2[k]];
        this.v(q[k], n, c);
      }
    }
  }

  /** a rounded leaf lying on a surface (normal n), `along` its axis */
  leaf(center: THREE.Vector3, n: THREE.Vector3, along: THREE.Vector3, size: number, color: THREE.Color, width = 0.42) {
    const a = along.clone().normalize().multiplyScalar(size * 0.5);
    const s = new THREE.Vector3().crossVectors(n, along).normalize().multiplyScalar(size * width);
    const ring: THREE.Vector3[] = [];
    const K = 7;
    for (let k = 0; k < K; k++) {
      const ang = (k / K) * Math.PI * 2;
      const tip = Math.max(0, Math.cos(ang)) ** 3 * 0.25;
      ring.push(center.clone().addScaledVector(a, Math.cos(ang) * (1 + tip)).addScaledVector(s, Math.sin(ang) * (1 - 0.15 * Math.cos(ang))));
    }
    const mid = color.clone().multiplyScalar(1.06), edge = color.clone().multiplyScalar(0.88);
    for (let k = 0; k < K; k++) {
      this.v(center, n, mid);
      this.v(ring[k], n, edge);
      this.v(ring[(k + 1) % K], n, edge);
    }
  }

  /** a low-poly lump (leaves, a stone, moss), flat-shaded like the island */
  blob(c: THREE.Vector3, rx: number, ry: number, rz: number, color: THREE.Color, rnd: () => number, spin = 0) {
    const pa = BLOB.attributes.position as THREE.BufferAttribute;
    const jit = Array.from({ length: 12 }, () => 0.84 + rnd() * 0.3);
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const vtx: THREE.Vector3[] = [];
    for (let i = 0; i < pa.count; i++) {
      const k = jit[BLOB_KEY[i]];
      const x = pa.getX(i) * rx * k, y = pa.getY(i) * ry * k, z = pa.getZ(i) * rz * k;
      vtx.push(new THREE.Vector3(c.x + x * cs + z * sn, c.y + y, c.z - x * sn + z * cs));
    }
    const col = new THREE.Color();
    for (let i = 0; i < vtx.length; i += 3) {
      const a = vtx[i], b = vtx[i + 1], d = vtx[i + 2];
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
      col.copy(color).multiplyScalar(0.86 + 0.2 * Math.max(0, n.y) + 0.06 * (rnd() - 0.5));
      this.v(a, n, col);
      this.v(b, n, col);
      this.v(d, n, col);
    }
  }

  /** a meadow flower like the island's own: a thin stem and a flat head of five petals */
  flower(base: THREE.Vector3, head: THREE.Vector3, radius: number, petal: THREE.Color, face: THREE.Vector3, rnd: () => number) {
    let side = new THREE.Vector3().crossVectors(face, UP);
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
    side.normalize();
    const w = 0.012;
    const sn = side.clone().cross(UP).normalize();
    const cut = this.c;
    this.c = 1; // (the stem stays dark when the picture lights up: only the heads glow)
    this.tri(base.clone().addScaledVector(side, -w), base.clone().addScaledVector(side, w), head, STEM, sn);
    this.c = cut;
    const u = new THREE.Vector3().crossVectors(face, side).normalize();
    const rot = rnd() * Math.PI;
    const p = (ang: number, rad: number) => head.clone().addScaledVector(side, Math.cos(ang) * rad).addScaledVector(u, Math.sin(ang) * rad);
    const c0 = head.clone().addScaledVector(face, radius * 0.15);
    for (let i = 0; i < 5; i++) {
      const a0 = rot + (i / 5) * Math.PI * 2, a1 = a0 + Math.PI / 5, a2 = a0 + (2 * Math.PI) / 5;
      this.tri(c0, p(a0, radius * 0.64), p(a1, radius), petal, face);
      this.tri(c0, p(a1, radius), p(a2, radius * 0.64), petal, face);
    }
  }

  /** a blossom like the blossom trees' own (five rounded petals, a yellow centre), facing `face` */
  blossom(c: THREE.Vector3, face: THREE.Vector3, size: number, petal: THREE.Color, rnd: () => number) {
    let side = new THREE.Vector3().crossVectors(face, UP);
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
    side.normalize();
    const u = new THREE.Vector3().crossVectors(face, side).normalize();
    const rot = rnd() * Math.PI * 2;
    const p = (ang: number, rad: number) => c.clone().addScaledVector(side, Math.cos(ang) * rad * size).addScaledVector(u, Math.sin(ang) * rad * size);
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2;
      this.tri(c, p(a, 0.5), p(a - 0.42, 0.31), petal, face);
      this.tri(c, p(a + 0.42, 0.31), p(a, 0.5), petal, face);
    }
    const lift = face.clone().multiplyScalar(size * 0.01);
    this.tri(p(rot, 0.09).add(lift), p(rot + 4.2, 0.09).add(lift), p(rot + 2.1, 0.09).add(lift), C('#f2c95c'), face);
  }

  /** a tuft of grass blades (tips at height `top`) */
  tuft(base: THREE.Vector3, top: number, color: THREE.Color, rnd: () => number) {
    for (let k = 0; k < 5; k++) {
      const a = rnd() * Math.PI * 2;
      const w = 0.02 + rnd() * 0.015;
      const lean = 0.06 + rnd() * 0.14;
      const dx = Math.cos(a), dz = Math.sin(a);
      const b0 = base.clone().add(new THREE.Vector3(-dz * w, 0, dx * w)), b1 = base.clone().add(new THREE.Vector3(dz * w, 0, -dx * w));
      const tip = base.clone().add(new THREE.Vector3(dx * lean, (top - base.y) * (0.75 + rnd() * 0.25), dz * lean));
      this.tri(b0, b1, tip, color.clone().multiplyScalar(0.9 + rnd() * 0.15), new THREE.Vector3(dx, 0.4, dz).normalize());
    }
  }

  /** reeds standing in shallow water (some with a cattail) */
  reeds(base: THREE.Vector3, top: number, rnd: () => number, cattails = 0.5) {
    for (let k = 0; k < 4; k++) {
      const a = rnd() * Math.PI * 2;
      const w = 0.018;
      const dx = Math.cos(a), dz = Math.sin(a);
      const o = new THREE.Vector3((rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12);
      const b0 = base.clone().add(o).add(new THREE.Vector3(-dz * w, 0, dx * w)), b1 = base.clone().add(o).add(new THREE.Vector3(dz * w, 0, -dx * w));
      const h = (top - base.y) * (0.8 + rnd() * 0.25);
      const tip = base.clone().add(o).add(new THREE.Vector3(dx * 0.05, h, dz * 0.05));
      const cut = this.c;
      this.c = 1; // (only the cattails glow when the picture lights up)
      this.tri(b0, b1, tip, REED[Math.floor(rnd() * REED.length)], new THREE.Vector3(dx, 0.3, dz).normalize());
      this.c = cut;
      if (k < 2 && rnd() < cattails) this.blob(tip.clone().addScaledVector(UP, -0.1), 0.025, 0.09, 0.025, CATTAIL, rnd);
    }
  }
}

// a unit icosahedron (non-indexed) and, per corner, which of its 12 points it is (to bend them alike)
const BLOB = new THREE.IcosahedronGeometry(1, 0);
const BLOB_KEY: number[] = (() => {
  const pa = BLOB.attributes.position as THREE.BufferAttribute;
  const pts: THREE.Vector3[] = [];
  const out: number[] = [];
  for (let i = 0; i < pa.count; i++) {
    const v = new THREE.Vector3(pa.getX(i), pa.getY(i), pa.getZ(i));
    let k = pts.findIndex((q) => q.distanceToSquared(v) < 1e-6);
    if (k < 0) {
      k = pts.length;
      pts.push(v);
    }
    out.push(k);
  }
  return out;
})();

export function finishGeometry(b: StrokeBuilder): THREE.BufferGeometry | null {
  if (!b.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(b.pos.length), 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(b.tt, 1));
  g.setAttribute('aCut', new THREE.Float32BufferAttribute(b.cut, 1));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(b.wnd, 3));
  g.setAttribute('aFade', new THREE.Float32BufferAttribute(b.fade, 1));
  g.computeBoundingSphere();
  return g;
}

/** where on its ray a point `h` above the ground (or water) is: heads of flowers, tops of stones… */
function overGround(ctx: DressCtx, dir: THREE.Vector3, dist: number, h: number, water = false): number {
  const e = ctx.eye;
  const floor = (x: number, z: number) => (water ? Math.max(ctx.heightAt(x, z), ctx.waterAt(x, z)) : ctx.heightAt(x, z));
  const above = (t: number) => e.y + dir.y * t - floor(e.x + dir.x * t, e.z + dir.z * t);
  let lo = Math.max(0.6, dist * 0.45), hi = dist;
  if (above(lo) < h) return lo;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    if (above(mid) > h) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** where on its ray something of thickness r rests on a flat surface (normal n) */
function onPlane(dir: THREE.Vector3, dist: number, n: THREE.Vector3, r: number, minC = 0.12): number {
  const c = Math.max(minC, Math.abs(n.dot(dir)));
  return Math.max(dist * 0.5, dist - (r + 0.006 * dist) / c);
}

/**
 * Walk along a piece, one element after another, each placed where the line is (as seen from the
 * spot), spaced by its own apparent size so they touch; `put` places one (direction, distance to
 * the surface, its size, the direction across the line).
 */
function walk(pc: Piece, ctx: DressCtx, b: StrokeBuilder, size: (d: number) => number, gap: number, put: (dir: THREE.Vector3, dist: number, s: number, across: THREE.Vector3) => void) {
  const N = pc.dirs.length;
  const seg: number[] = [0];
  for (let i = 1; i < N; i++) seg.push(seg[i - 1] + pc.dirs[i - 1].angleTo(pc.dirs[i]));
  const L = seg[N - 1];
  const rnd = ctx.rnd;
  let a = 0, i = 0;
  for (let guard = 0; guard < 4000 && a <= L + 1e-9; guard++) {
    while (i < N - 2 && seg[i + 1] < a) i++;
    const j = Math.min(N - 1, i + 1);
    const f = seg[j] > seg[i] ? Math.min(1, Math.max(0, (a - seg[i]) / (seg[j] - seg[i]))) : 0;
    const dir = pc.dirs[i].clone().lerp(pc.dirs[j], f).normalize();
    const dist = pc.dists[i] + (pc.dists[j] - pc.dists[i]) * f;
    b.t = pc.ts[i] + (pc.ts[j] - pc.ts[i]) * f;
    b.c = pc.cuts[i];
    const s = size(dist);
    const across = new THREE.Vector3().crossVectors(dir, pc.dirs[j].clone().sub(pc.dirs[i]));
    if (across.lengthSq() < 1e-14) across.crossVectors(dir, UP);
    across.normalize();
    put(dir, dist, s, across);
    a += (s / dist) * gap * (0.8 + rnd() * 0.4);
  }
}

/** a direction a little across the line (as seen from the spot): things grow in a loose band */
function spread(dir: THREE.Vector3, across: THREE.Vector3, ang: number): THREE.Vector3 {
  return dir.clone().addScaledVector(across, ang).normalize();
}

/** of a set of colours, the one farthest from `c` (another of the thing's own shades) */
function otherShade(colors: string[], c: THREE.Color): THREE.Color {
  let best = C(colors[0]), bd = -1;
  for (const h of colors) {
    const k = C(h);
    const d = (k.r - c.r) ** 2 + (k.g - c.g) ** 2 + (k.b - c.b) ** 2;
    if (d > bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

/** Dress one piece of a line with the stuff of the place it crosses. */
export function dressPiece(b: StrokeBuilder, pc: Piece, ctx: DressCtx): void {
  const N = pc.dirs.length;
  if (N < 2) return;
  const { eye, rnd } = ctx;
  b.wind = pc.wind ?? [0, 0, 0];
  b.far = 0;
  const mid = eye.clone().addScaledVector(pc.dirs[Math.floor(N / 2)], pc.dists[Math.floor(N / 2)]);
  const midC = Math.abs(pc.n.dot(pc.dirs[Math.floor(N / 2)]));
  const hitCol = C(pc.color ?? 0x7a7a6a);

  if (pc.kind === 'ground') {
    const g = pc.ground ?? 'grass';
    const flower = g === 'grass' || g === 'leaves' ? ctx.flowerAt(mid.x, mid.z) : null;
    if (flower) {
      // a meadow in flower: some of its flowers (one of its colours), leaning a little towards you
      const petal = C(flower);
      b.far = 1;
      walk(pc, ctx, b, () => 0.24, 0.95, (dir0, dist, s0, across) => {
        const n = rnd() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const s = 0.8 + rnd() * 0.6;
          const dir = spread(dir0, across, (rnd() - 0.5) * 1.2 * (s0 / dist));
          const h = 0.42 * s * (0.85 + rnd() * 0.4) * 1.55;
          const head = eye.clone().addScaledVector(dir, overGround(ctx, dir, dist, h));
          const base = new THREE.Vector3(head.x, ctx.heightAt(head.x, head.z) - 0.02, head.z);
          const face = UP.clone().multiplyScalar(1.7).add(eye.clone().sub(head).setY(0).normalize()).add(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).multiplyScalar(0.5)).normalize();
          b.flower(base, head, 0.11 * s, petal.clone().multiplyScalar(0.95 + rnd() * 0.08), face, rnd);
        }
      });
      return;
    }
    if (g === 'leaves') {
      // the autumn wood's floor, covered in fallen leaves: some of them, of its deeper red
      const col = C(LITTER_LINE);
      walk(pc, ctx, b, () => 0.2, 0.8, (dir0, dist, s0, across) => {
        const n = 1 + (rnd() < 0.4 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const dir = spread(dir0, across, (rnd() - 0.5) * 1.1 * (s0 / dist));
          const q = eye.clone().addScaledVector(dir, overGround(ctx, dir, dist, 0.02));
          q.y = ctx.heightAt(q.x, q.z) + 0.014 + k * 0.004;
          const nrm = new THREE.Vector3((rnd() - 0.5) * 0.5, 1, (rnd() - 0.5) * 0.5).normalize();
          const ax = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
          b.leaf(q, nrm, ax, 0.14 + rnd() * 0.1, col.clone().multiplyScalar(0.92 + rnd() * 0.14));
        }
      });
      return;
    }
    if (g === 'grass') {
      // plain grass: tufts of drier grass
      const col = ctx.groundColor(mid.x, mid.z).clone().lerp(DRY, 0.55);
      b.far = 1;
      walk(pc, ctx, b, () => 0.2, 0.7, (dir0, dist, s0, across) => {
        const dir = spread(dir0, across, (rnd() - 0.5) * 0.8 * (s0 / dist));
        const h = 0.5 + rnd() * 0.25;
        const top = eye.clone().addScaledVector(dir, overGround(ctx, dir, dist, h));
        const base = new THREE.Vector3(top.x, ctx.heightAt(top.x, top.z) - 0.02, top.z);
        b.tuft(base, top.y, col, rnd);
      });
      return;
    }
    if (g === 'sand') {
      // sand: low ridges of the sand itself
      // (like the wind ripples all over the dunes)
      const col = ctx.groundColor(mid.x, mid.z).clone().multiplyScalar(1.03);
      const hR = pc.dists.map((d) => THREE.MathUtils.clamp(d * 0.003, 0.05, 0.09));
      const pts = pc.dirs.map((dir, i) => {
        const p = eye.clone().addScaledVector(dir, overGround(ctx, dir, pc.dists[i], hR[i]));
        p.y = ctx.heightAt(p.x, p.z);
        return p;
      });
      b.tube(pts, hR.map((h) => h * 2.4), col, pc.ts, pc.cuts, 7, 0.4, 0.42);
      return;
    }
    // stony ground: stones like the ones lying around
    const col = ctx.groundColor(mid.x, mid.z).clone().lerp(C('#b5b0a6'), 0.5);
    walk(pc, ctx, b, (d) => THREE.MathUtils.clamp(d * 0.0135, 0.14, 0.7), 0.85, (dir0, dist, s0, across) => {
      const r = s0 * 0.5 * (0.65 + rnd() * 0.5);
      const dir = spread(dir0, across, (rnd() - 0.5) * 0.7 * (s0 / dist));
      const c = eye.clone().addScaledVector(dir, overGround(ctx, dir, dist, r * 0.42));
      c.y = Math.max(c.y, ctx.heightAt(c.x, c.z) + r * 0.25);
      b.blob(c, r * (0.9 + rnd() * 0.25), r * (0.5 + rnd() * 0.15), r * (0.85 + rnd() * 0.25), col.clone().multiplyScalar(0.9 + rnd() * 0.2), rnd, rnd() * 6);
    });
    return;
  }

  if (pc.kind === 'water') {
    // a lake: reeds standing in the shallows
    b.far = 1;
    walk(pc, ctx, b, () => 0.16, 0.75, (dir0, dist, s0, across) => {
      const dir = spread(dir0, across, (rnd() - 0.5) * 0.8 * (s0 / dist));
      const h = 0.8 + rnd() * 0.35;
      const top = eye.clone().addScaledVector(dir, overGround(ctx, dir, dist, h, true));
      const base = new THREE.Vector3(top.x, Math.max(ctx.heightAt(top.x, top.z), ctx.waterAt(top.x, top.z)) - 0.05, top.z);
      b.reeds(base, top.y, rnd, 0.9);
    });
    return;
  }

  if (pc.kind === 'tree') {
    if (pc.species === 'deadtree') {
      // a dead tree: its bare branches
      const r = pc.dists.map((d) => THREE.MathUtils.clamp(d * 0.0026, 0.02, 0.08));
      const pts = pc.dirs.map((dir, i) => eye.clone().addScaledVector(dir, onPlane(dir, pc.dists[i], pc.n, r[i], 0.2)));
      b.tube(pts, r, C(PALETTE.deadtree.trunk), pc.ts, pc.cuts, 5, 0.3);
      return;
    }
    const bl = BLOSSOM_COLORS[pc.species ?? ''];
    if (bl) {
      // a tree in flower: some of its blossoms, of the rarer colour it already has
      const petal = C(bl.colors[bl.colors.length - 1]);
      walk(pc, ctx, b, () => 0.19, 0.9, (dir0, dist, s0, across) => {
        const n = rnd() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const sz = 0.15 + rnd() * 0.07;
          const dir = spread(dir0, across, (rnd() - 0.5) * 1.1 * (s0 / dist));
          const c = eye.clone().addScaledVector(dir, Math.max(dist * 0.5, dist - 0.04));
          const face = pc.n.clone().multiplyScalar(1.3).add(eye.clone().sub(c).normalize()).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.6)).normalize();
          b.blossom(c, face, sz, petal.clone().multiplyScalar(0.95 + rnd() * 0.08), rnd);
        }
      });
      return;
    }
    // a crown: a few clusters of its leaves in another of its own colours
    const pal = PALETTE[(pc.species ?? 'oak') as keyof typeof PALETTE]?.leaves;
    // (only a little different from the leaves around them: a few turning or younger leaves)
    const col = hitCol.clone().lerp(otherShade(pal && pal.length ? pal : PALETTE.oak.leaves, hitCol), 0.3).multiplyScalar(1.07);
    walk(pc, ctx, b, () => 0.3, 0.95, (dir0, dist, s0, across) => {
      const dir = spread(dir0, across, (rnd() - 0.5) * 0.9 * (s0 / dist));
      const c = eye.clone().addScaledVector(dir, Math.max(dist * 0.5, dist - 0.06));
      const face = pc.n.clone().add(eye.clone().sub(c).normalize()).normalize();
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(face).normalize();
        const off = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.16);
        b.leaf(c.clone().add(off).addScaledVector(face, 0.01 * k), face.clone().add(off.clone().multiplyScalar(2)).normalize(), ax, 0.14 + rnd() * 0.08, col.clone().multiplyScalar(0.92 + rnd() * 0.14));
      }
    });
    return;
  }

  if (pc.kind === 'floor' && midC < 0.35) {
    // paving seen low: moss growing along a joint
    walk(pc, ctx, b, (d) => THREE.MathUtils.clamp(d * 0.012, 0.1, 0.5), 0.7, (dir0, dist, s0, across) => {
      const r = s0 * 0.5 * (0.7 + rnd() * 0.5);
      const dir = spread(dir0, across, (rnd() - 0.5) * 0.6 * (s0 / dist));
      const c = eye.clone().addScaledVector(dir, onPlane(dir, dist, pc.n, r * 0.35));
      b.blob(c, r, r * 0.36, r, MOSS[Math.floor(rnd() * MOSS.length)], rnd, rnd() * 6);
    });
    return;
  }

  // a crack in a wall, the paving or a rock: a darker shade of the stone itself, uneven
  const base = CRACK_COLOR.clone();
  const c = midC;
  const lift = (d: number) => (0.012 + d * 0.0012) / Math.max(0.2, c);
  const half = (d: number) => THREE.MathUtils.clamp((d * 0.0024) / Math.max(0.35, c) / 2, 0.005, 0.016);
  const cp: THREE.Vector3[] = [], cw: number[] = [], ct: number[] = [], cc: number[] = [];
  for (let i = 0; i < N; i++) {
    const p = eye.clone().addScaledVector(pc.dirs[i], pc.dists[i] - lift(pc.dists[i]));
    cp.push(p);
    cw.push(half(pc.dists[i]) * (0.6 + rnd() * 0.7));
    ct.push(pc.ts[i]);
    cc.push(pc.cuts[i]);
    if (i < N - 1) {
      const f = 0.35 + rnd() * 0.3;
      const dir = pc.dirs[i].clone().lerp(pc.dirs[i + 1], f).normalize();
      const d = pc.dists[i] + (pc.dists[i + 1] - pc.dists[i]) * f;
      const q = eye.clone().addScaledVector(dir, d - lift(d));
      const tan = eye.clone().addScaledVector(pc.dirs[i + 1], pc.dists[i + 1]).sub(p).normalize();
      const side = new THREE.Vector3().crossVectors(pc.n, tan).normalize();
      q.addScaledVector(side, (rnd() - 0.5) * half(d) * 1.6);
      cp.push(q);
      cw.push(half(d) * (0.5 + rnd() * 0.7));
      ct.push(pc.ts[i] + (pc.ts[i + 1] - pc.ts[i]) * f);
      cc.push(pc.cuts[i]);
    }
  }
  b.ribbon(cp, pc.n, cw, base, ct, cc);
  for (let i = 1; i < cp.length - 1; i++) {
    if (rnd() > (pc.kind === 'rock' ? 0.4 : 0.1)) continue;
    b.t = ct[i];
    b.c = cc[i];
    if (pc.kind === 'rock') {
      const r = cw[i] * 2.4;
      b.blob(cp[i].clone().addScaledVector(pc.n, r * 0.2), r, r * 0.4, r, MOSS[Math.floor(rnd() * MOSS.length)], rnd, rnd() * 6);
      continue;
    }
    const tan = cp[i + 1].clone().sub(cp[i - 1]).normalize();
    const side = new THREE.Vector3().crossVectors(pc.n, tan).normalize().multiplyScalar(rnd() < 0.5 ? 1 : -1);
    const dirB = tan.clone().multiplyScalar(rnd() < 0.5 ? 1 : -1).add(side.multiplyScalar(1.2)).normalize();
    const len = cw[i] * (8 + rnd() * 8);
    const q1 = cp[i].clone().addScaledVector(dirB, len * 0.5), q2 = cp[i].clone().addScaledVector(dirB, len);
    b.ribbon([cp[i], q1, q2], pc.n, [cw[i] * 0.6, cw[i] * 0.4, cw[i] * 0.1], base, [ct[i], ct[i], ct[i]], [cc[i], cc[i], cc[i]]);
  }
}
