/**
 * What the lines of a constellation are made of, in the scenery: fallen branches and driftwood
 * lying on the ground (with twigs, and dead leaves in the autumn wood), cracks in walls, paving
 * and rocks, ivy climbing walls, vines around trunks. Each piece lies exactly on the surface you
 * see from the picture's spot, so from there the pieces join into the line.
 */
import * as THREE from 'three';

/** one surface's stretch of a line, ready to dress */
export interface Piece {
  kind: 'ground' | 'floor' | 'wall' | 'tree' | 'rock';
  /** points on the surface, as seen from the eye (already joined to the neighbouring pieces) */
  pts: THREE.Vector3[];
  dirs: THREE.Vector3[];
  dists: number[];
  /** the light's sweep parameter (0..1 over the whole picture) and "cut" flags, per point */
  ts: number[];
  cuts: number[];
  /** the surface normal (facing the eye); for the ground, per point from the terrain */
  n: THREE.Vector3;
  normals?: THREE.Vector3[];
  /** what the ground is (grass, sand, leaves, stone, gravel) */
  ground?: string;
  /** on a tree crown: the wind there (phase, reach, the tree's turn), so the vine sways with it */
  wind?: [number, number, number] | null;
}

export interface DressCtx {
  eye: THREE.Vector3;
  /** ground height (to rest branches on the ground) */
  heightAt(x: number, z: number): number;
  stony: boolean;
  sandy: boolean;
  rnd: () => number;
  /** thickest a piece may be (metres): pieces far from the spot are thick, but not logs */
  maxR?: number;
}

/** sizes, as fractions of the distance from the spot (i.e. angles in radians) */
const BRANCH_R = 0.0036;
const CROWN_R = 0.0039;
const STEM_R = 0.0021;
const CRACK_W = 0.0036;
const LEAF = 0.0105;

const C = (hex: string) => new THREE.Color(hex);
const WOOD: Record<string, THREE.Color> = {
  sand: C('#a39680'),
  leaves: C('#4b3626'),
  stone: C('#43372c'),
  gravel: C('#57412f'),
  grass: C('#5a4331'),
};
const CRACK = C('#342d27');
const ROCK_CRACK = C('#30332b');
const IVY_STEM = C('#35472a');
const IVY = [C('#3f6b2e'), C('#4d7c34'), C('#355f27'), C('#5b8a3b'), C('#46702f')];
const VINE = C('#3a2e22');
const AUTUMN = [C('#c4612a'), C('#d9902f'), C('#a8432a'), C('#e0b24a'), C('#b8562c')];

export class StrokeBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  tt: number[] = [];
  cut: number[] = [];
  wnd: number[] = [];
  /** the wind of what is being dressed now (0 reach: still) */
  wind: [number, number, number] = [0, 0, 0];
  get count() {
    return this.pos.length / 3;
  }

  private v(p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, t: number, cut: number) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.tt.push(t);
    this.cut.push(cut);
    this.wnd.push(this.wind[0], this.wind[1], this.wind[2]);
  }

  /** a round piece (branch, root, stem, twig): rings around pts with radius r[i] */
  tube(pts: THREE.Vector3[], r: number[], base: THREE.Color, t: number[], cut: number[], sides = 6, shade = 0.3) {
    if (pts.length < 2) return;
    const up = new THREE.Vector3(0, 1, 0);
    const rings: THREE.Vector3[][] = [];
    let prevS: THREE.Vector3 | null = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tan = b.clone().sub(a);
      if (tan.lengthSq() < 1e-12) tan.set(1, 0, 0);
      tan.normalize();
      let s = new THREE.Vector3().crossVectors(tan, up);
      if (s.lengthSq() < 1e-6) s = prevS ? prevS.clone() : new THREE.Vector3(1, 0, 0);
      s.normalize();
      prevS = s;
      const u2 = new THREE.Vector3().crossVectors(s, tan).normalize();
      const ring: THREE.Vector3[] = [];
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2;
        ring.push(s.clone().multiplyScalar(Math.cos(ang)).addScaledVector(u2, Math.sin(ang)));
      }
      rings.push(ring);
    }
    const c = new THREE.Color();
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        // counter-clockwise seen from outside
        const quad: [number, number][] = [[i, k], [i + 1, k], [i + 1, k2], [i, k2]];
        for (const qi of [0, 1, 2, 0, 2, 3]) {
          const [ii, kk] = quad[qi];
          const n = rings[ii][kk];
          const p = pts[ii].clone().addScaledVector(n, r[ii]);
          // bark/moss: lighter on top, a little variation along the piece
          const v = 0.86 + shade * Math.max(0, n.y) - 0.12 * Math.max(0, -n.y) + 0.08 * (((ii * 7 + kk * 3) % 5) / 4 - 0.5);
          c.copy(base).multiplyScalar(v);
          this.v(p, n, c, t[ii], cut[ii]);
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
        c.copy(base).multiplyScalar(0.9 + 0.2 * (((qi2[k] * 5) % 3) / 2));
        this.v(q[k], n, c, t[qi2[k]], cut[qi2[k]]);
      }
    }
  }

  /** a leaf lying on a surface: a pointed oval, `along` its axis */
  leaf(center: THREE.Vector3, n: THREE.Vector3, along: THREE.Vector3, size: number, color: THREE.Color, t: number, cut: number, width = 0.3) {
    // a rounded leaf: a fan around its middle, a little pointed at the tip
    const a = along.clone().normalize().multiplyScalar(size * 0.5);
    const s = new THREE.Vector3().crossVectors(n, along).normalize().multiplyScalar(size * width);
    const ring: THREE.Vector3[] = [];
    const K = 8;
    for (let k = 0; k < K; k++) {
      const ang = (k / K) * Math.PI * 2;
      const tip = Math.max(0, Math.cos(ang)) ** 3 * 0.25;
      ring.push(center.clone().addScaledVector(a, Math.cos(ang) * (1 + tip)).addScaledVector(s, Math.sin(ang) * (1 - 0.15 * Math.cos(ang))));
    }
    const mid = color.clone().multiplyScalar(1.08), edge = color.clone().multiplyScalar(0.86);
    for (let k = 0; k < K; k++) {
      this.v(center, n, mid, t, cut);
      this.v(ring[k], n, edge, t, cut);
      this.v(ring[(k + 1) % K], n, edge, t, cut);
    }
  }

  geometry(): THREE.BufferGeometry | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(this.pos.length), 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(this.tt, 1));
    g.setAttribute('aCut', new THREE.Float32BufferAttribute(this.cut, 1));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wnd, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** where on its ray a round piece of radius r rests on the ground (it lies on it, not in it) */
function restOnGround(ctx: DressCtx, dir: THREE.Vector3, dist: number, r: number): number {
  const e = ctx.eye;
  const above = (t: number) => e.y + dir.y * t - ctx.heightAt(e.x + dir.x * t, e.z + dir.z * t);
  let lo = Math.max(0.6, dist * 0.55), hi = dist;
  if (above(lo) < r) return lo; // rising ground in front: as close as allowed
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (above(mid) > r) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** where on its ray a piece of thickness r rests on a flat surface (normal n) */
function restOnPlane(dir: THREE.Vector3, dist: number, n: THREE.Vector3, r: number, minC = 0.1): number {
  const c = Math.max(minC, Math.abs(n.dot(dir)));
  return Math.max(dist * 0.55, dist - (r + 0.006 * dist) / c);
}

/**
 * Dress one piece. Returns nothing; adds to the builder. `ends` says whether each end of the piece
 * is a free end (the line jumps to another depth there) — those taper a little, like real wood.
 */
export function dressPiece(b: StrokeBuilder, pc: Piece, ctx: DressCtx, ends: [boolean, boolean]): { pts: THREE.Vector3[]; r: number[] } | null {
  const N = pc.pts.length;
  if (N < 2) return null;
  const { eye, rnd } = ctx;
  const maxR = ctx.maxR ?? 0.11;
  b.wind = pc.wind ?? [0, 0, 0];
  const along = (pts: THREE.Vector3[], i: number) => pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
  const taper = (i: number) => {
    const f = N <= 2 ? 0.5 : i / (N - 1);
    return (ends[0] ? 0.72 + 0.28 * Math.min(1, f * 4) : 1) * (ends[1] ? 0.72 + 0.28 * Math.min(1, (1 - f) * 4) : 1);
  };
  const c = Math.abs(pc.n.dot(pc.dirs[Math.floor(N / 2)]));

  if (pc.kind === 'ground' || (pc.kind === 'floor' && c < 0.3) || (pc.kind === 'rock' && c < 0.3)) {
    // a fallen branch, a root, driftwood on the sand
    const wood = pc.kind === 'ground' ? WOOD[pc.ground ?? 'grass'] ?? WOOD.grass : WOOD.gravel;
    const r = pc.dists.map((d, i) => Math.min(maxR, d * BRANCH_R) * taper(i));
    const pts = pc.dirs.map((dir, i) => {
      const t = pc.kind === 'ground' ? restOnGround(ctx, dir, pc.dists[i], r[i]) : restOnPlane(dir, pc.dists[i], pc.n, r[i]);
      return eye.clone().addScaledVector(dir, t);
    });
    const rr = pts.map((p, i) => Math.min(maxR, p.distanceTo(eye) * BRANCH_R) * taper(i));
    b.tube(pts, rr, wood, pc.ts, pc.cuts, 6, 0.34);
    // a twig now and then, lying on the ground beside it
    for (let i = 1; i < N - 1; i++) {
      if (rnd() > 0.2) continue;
      const nrm = pc.normals?.[i] ?? pc.n;
      const tan = along(pts, i);
      const side = new THREE.Vector3().crossVectors(nrm, tan).normalize().multiplyScalar(rnd() < 0.5 ? 1 : -1);
      const dirT = tan.clone().multiplyScalar(rnd() < 0.5 ? 1.1 : -1.1).add(side).normalize();
      const len = rr[i] * (4 + rnd() * 3);
      const p0 = pts[i], p1 = p0.clone().addScaledVector(dirT, len * 0.5).addScaledVector(nrm, rr[i] * 0.1), p2 = p0.clone().addScaledVector(dirT, len).addScaledVector(nrm, -rr[i] * 0.3);
      b.tube([p0, p1, p2], [rr[i] * 0.4, rr[i] * 0.28, rr[i] * 0.12], wood, [pc.ts[i], pc.ts[i], pc.ts[i]], [pc.cuts[i], pc.cuts[i], pc.cuts[i]], 4, 0.3);
    }
    // dead leaves around branches in the autumn wood
    if (pc.ground === 'leaves') {
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 2; k++) {
          if (rnd() > 0.5) continue;
          const nrm = pc.normals?.[i] ?? pc.n;
          const tan = along(pts, i);
          const side = new THREE.Vector3().crossVectors(nrm, tan).normalize();
          const p = pts[i].clone().addScaledVector(side, (rnd() - 0.5) * rr[i] * 8).addScaledVector(tan, (rnd() - 0.5) * rr[i] * 6);
          p.y = ctx.heightAt(p.x, p.z) + 0.02;
          const ax = tan.clone().applyAxisAngle(nrm, rnd() * Math.PI * 2);
          b.leaf(p, nrm, ax, rr[i] * (3 + rnd() * 2), AUTUMN[Math.floor(rnd() * AUTUMN.length)], pc.ts[i], pc.cuts[i], 0.4);
        }
      }
    }
    return { pts, r: rr };
  }

  const crown = pc.kind === 'tree' && !!pc.wind && pc.wind[1] > 0.05;
  if (crown) {
    // a thin dead branch caught across the crown (it sways with it)
    const r = pc.dists.map((d, i) => Math.min(maxR * 0.8, d * CROWN_R) * taper(i));
    const pts = pc.dirs.map((dir, i) => eye.clone().addScaledVector(dir, restOnPlane(dir, pc.dists[i], pc.n, r[i] + 0.07, 0.3)));
    b.tube(pts, r, VINE, pc.ts, pc.cuts, 5, 0.3);
    return null;
  }

  if (pc.kind === 'tree' || (pc.kind === 'wall' && !(ctx.stony || ctx.sandy) && rnd() < 0.8) || (pc.kind === 'wall' && c < 0.3)) {
    // ivy on a wall, a vine around a trunk: a stem in a band of leaves
    const r = pc.dists.map((d, i) => Math.min(maxR * 0.6, d * STEM_R) * taper(i));
    const pts = pc.dirs.map((dir, i) => eye.clone().addScaledVector(dir, restOnPlane(dir, pc.dists[i], pc.n, r[i], 0.1)));
    b.tube(pts, r, IVY_STEM, pc.ts, pc.cuts, 5, 0.25);
    for (let i = 0; i < N - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const f = (k + rnd() * 0.8) / 3;
        const p0 = pts[i].clone().lerp(pts[i + 1], f);
        const d = pc.dists[i] + (pc.dists[i + 1] - pc.dists[i]) * f;
        const tan = pts[i + 1].clone().sub(pts[i]).normalize();
        const side = new THREE.Vector3().crossVectors(pc.n, tan).normalize();
        const sgn = (i * 3 + k) % 2 ? 1 : -1;
        const size = Math.min(maxR * 3, d * LEAF) * (0.7 + rnd() * 0.4);
        const p = p0.addScaledVector(side, sgn * size * 0.22).addScaledVector(pc.n, r[i] * 0.5);
        const ax = tan.clone().multiplyScalar(rnd() < 0.5 ? 1 : -1).addScaledVector(side, sgn * (0.35 + rnd() * 0.3)).normalize();
        const t = pc.ts[i] + (pc.ts[i + 1] - pc.ts[i]) * f;
        b.leaf(p, pc.n, ax, size, IVY[Math.floor(rnd() * IVY.length)], t, pc.cuts[i], 0.42);
      }
    }
    return null;
  }

  // a crack: dark, uneven, now and then splitting, lying on the wall / paving / rock face
  const base = pc.kind === 'rock' ? ROCK_CRACK : CRACK;
  const lift = (d: number) => (0.012 + d * 0.0012) / Math.max(0.2, c);
  const half = (d: number) => Math.min(maxR * 0.7, (d * CRACK_W) / Math.max(0.35, c) / 2);
  const cp: THREE.Vector3[] = [], cw: number[] = [], ct: number[] = [], cc: number[] = [];
  for (let i = 0; i < N; i++) {
    const p = eye.clone().addScaledVector(pc.dirs[i], pc.dists[i] - lift(pc.dists[i]));
    cp.push(p);
    cw.push(half(pc.dists[i]) * (0.6 + rnd() * 0.7) * taper(i));
    ct.push(pc.ts[i]);
    cc.push(pc.cuts[i]);
    if (i < N - 1) {
      // a zigzag point between samples, within the crack's own width
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
  // short side cracks
  for (let i = 1; i < cp.length - 1; i++) {
    if (rnd() > 0.12) continue;
    const tan = cp[i + 1].clone().sub(cp[i - 1]).normalize();
    const side = new THREE.Vector3().crossVectors(pc.n, tan).normalize().multiplyScalar(rnd() < 0.5 ? 1 : -1);
    const dirB = tan.clone().multiplyScalar(rnd() < 0.5 ? 1 : -1).add(side.multiplyScalar(1.2)).normalize();
    const len = cw[i] * (8 + rnd() * 8);
    const q1 = cp[i].clone().addScaledVector(dirB, len * 0.5), q2 = cp[i].clone().addScaledVector(dirB, len);
    b.ribbon([cp[i], q1, q2], pc.n, [cw[i] * 0.6, cw[i] * 0.4, cw[i] * 0.1], base, [ct[i], ct[i], ct[i]], [cc[i], cc[i], cc[i]]);
  }
  return null;
}
