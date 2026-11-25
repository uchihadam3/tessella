/**
 * THE CONSTELLATIONS — the secret layer, drawn by the island itself.
 *
 * Every constellation is a picture (a whale, an owl, a windmill…) whose lines are made of real
 * things in the scenery: a root or a fallen branch on the ground, a vine across a tree crown, a
 * crack or a strand of ivy on a ruined wall, a thin wisp of cloud in the sky. A single line of the
 * picture is often several of these at very different distances — it starts as a branch at your
 * feet, carries on as a crack in a wall forty metres away and ends in a cloud. From everywhere
 * else they are just roots, vines, cracks and clouds (and the island is full of those anyway).
 *
 * From ONE spot, looking in ONE direction, the pieces join and the picture is there, unlit, made
 * of the scenery. Stand exactly there and keep looking: after several seconds the picture lights
 * up, line by line, the world dims a little around it, the knots of the puzzle and its glyphs
 * appear and a small orb rises (ring it to check). The figure only makes sense from that spot,
 * so that is where it is solved. Never taught anywhere.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONSTELLATIONS } from '../data/constellations';
import type { ConstellationDef } from './types';
import { checkConstellation, initialState, isPressable, pressSet, stateString } from './graph';
import type { World } from '../world/world';
import type { AreaId } from '../data/areas';
import { ANCHORS, AREA_RADIUS, CALDERA, CITADEL, NORTH_LANDING, SPIRE } from '../world/layout';
import { drawGlyph } from '../puzzle/glyphs';
import { rng } from '../world/noise';
import { audio } from '../audio';

export const VAULT_THRESHOLD = 100;
/** the player's eye height (see Player.eye) */
const EYE_H = 1.62;
/** half-width of a figure as seen from its spot (degrees, centre to the farthest point) */
const SPAN_DEG = 22;
/** how close to the spot you must stand (metres) and how straight you must look (degrees) */
const SPOT_TOL = 0.42;
const LOOK_TOL = 4;
/** seconds of steady looking for the picture to light up */
const REVEAL_SECONDS = 6;
/** viewing spots this far apart at least: the figures are spread over the whole island */
const SPOT_SPACING = 16;
/** where clouds are drawn (metres) */
const SKY_DIST = 420;

// ───────────────────────── what the lines are made of ─────────────────────────

type HitKind = 'ground' | 'floor' | 'wall' | 'tree' | 'rock' | 'sky';
interface Hit {
  kind: HitKind;
  p: THREE.Vector3;
  dist: number;
}
interface Sample {
  t: number;
  dir: THREE.Vector3;
  hit: Hit;
}
/** a stretch of one line that lies on one surface, continuously */
interface Run {
  kind: HitKind;
  samples: Sample[];
}

type Look = { color: string; w: number; off: number; kind: 'solid' | 'cloud' };
/** colour and thickness (radians, as seen from the spot) of a line on each kind of surface */
function lookFor(kind: HitKind, area: AreaId): Look {
  const stony = area === 'citadel' || area === 'echo' || area === 'mold';
  const sandy = area === 'mosaic' || area === 'prologue';
  switch (kind) {
    case 'sky':
      return { color: '#ffffff', w: 0.03, off: 0, kind: 'cloud' }; // one soft little cloud
    case 'tree':
      return { color: '#3a3322', w: 0.0036, off: 0.16, kind: 'solid' }; // a vine over the crown
    case 'wall':
      return stony || sandy ? { color: '#2a2622', w: 0.0028, off: 0.03, kind: 'solid' } // a crack
        : { color: '#3d5a2e', w: 0.0034, off: 0.04, kind: 'solid' }; // a strand of ivy
    case 'rock':
      return { color: '#45473a', w: 0.003, off: 0.03, kind: 'solid' }; // a crack with moss
    case 'floor':
      return { color: '#302c28', w: 0.0028, off: 0.02, kind: 'solid' }; // a crack in the paving
    default:
      if (sandy) return { color: '#8a7d66', w: 0.0042, off: 0.05, kind: 'solid' }; // driftwood / a dry stick
      if (stony) return { color: '#36312c', w: 0.003, off: 0.03, kind: 'solid' }; // a crack in the rock
      return { color: '#56412f', w: 0.0042, off: 0.05, kind: 'solid' }; // a root, a fallen branch
  }
}

/** Lit like everything else; glows (line by line) once the picture lights up. */
function strokeMaterial(u: { uLit: { value: number }; uReveal: { value: number } }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = u.uLit;
    sh.uniforms.uReveal = u.uReveal;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nattribute float aT;\nattribute float aCut;\nvarying vec3 vGlow;\nvarying float vT;\nvarying float vCut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vT = aT; vCut = aCut;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLit;\nuniform float uReveal;\nvarying vec3 vGlow;\nvarying float vT;\nvarying float vCut;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ float on = step(vT, uReveal) * uLit * (1.0 - vCut); float head = smoothstep(uReveal - 0.05, uReveal, vT) * step(uReveal, 0.999); totalEmissiveRadiance += vGlow * on * (1.0 + head * 2.0); }',
      );
  };
  return m;
}

// a soft puff of cloud (several of them, overlapping, make one small elongated cloud)
let puffTex: THREE.Texture | null = null;
function puffTexture(): THREE.Texture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const rnd = rng(7);
  for (let i = 0; i < 9; i++) {
    const x = 34 + rnd() * 60, y = 44 + rnd() * 40, r = 18 + rnd() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

const cloudVert = /* glsl */ `
attribute vec3 aGlow; attribute float aT; attribute float aV;
varying vec3 vGlow; varying float vT; varying float vV;
void main(){ vGlow = aGlow; vT = aT; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const cloudFrag = /* glsl */ `
uniform float uLit; uniform float uReveal;
varying vec3 vGlow; varying float vT; varying float vV;
void main(){
  float soft = smoothstep(0.0, 0.5, vV) * smoothstep(1.0, 0.5, vV);
  float on = step(vT, uReveal) * uLit;
  vec3 c = vec3(1.0, 0.985, 0.96) + vGlow * on * 0.8;
  gl_FragColor = vec4(c, soft * soft * (0.34 + 0.5 * on));
}`;

// ───────────────────────── glyph sprites ─────────────────────────

const glyphTexCache = new Map<string, THREE.Texture>();
function glyphTexture(g: NonNullable<ConstellationDef['stars'][number]['glyph']>): THREE.Texture {
  const key = JSON.stringify(g);
  let t = glyphTexCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(20,20,34,0.85)');
  grad.addColorStop(1, 'rgba(20,20,34,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  drawGlyph(ctx, g as Parameters<typeof drawGlyph>[1], 64, 64, 100, false);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glyphTexCache.set(key, t);
  return t;
}

// ───────────────────────── geometry of a line piece ─────────────────────────

/** a tube along `pts` with radius r[i] (seen from far it reads as a root, a vine or a crack) */
function tube(pts: THREE.Vector3[], r: number[], col: THREE.Color, t0: number[], cut: number[]): THREE.BufferGeometry {
  const SIDES = 5;
  const pos: number[] = [], nrm: number[] = [], colr: number[] = [], tt: number[] = [], cc: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const rings: { c: THREE.Vector3; n: THREE.Vector3[] }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tan = b.clone().sub(a).normalize();
    let s = new THREE.Vector3().crossVectors(tan, up);
    if (s.lengthSq() < 1e-6) s = new THREE.Vector3(1, 0, 0);
    s.normalize();
    const u2 = new THREE.Vector3().crossVectors(s, tan).normalize();
    const ns: THREE.Vector3[] = [];
    for (let k = 0; k < SIDES; k++) {
      const ang = (k / SIDES) * Math.PI * 2;
      ns.push(s.clone().multiplyScalar(Math.cos(ang)).addScaledVector(u2, Math.sin(ang)));
    }
    rings.push({ c: pts[i], n: ns });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < SIDES; k++) {
      const k2 = (k + 1) % SIDES;
      const quad: [number, number][] = [[i, k], [i, k2], [i + 1, k2], [i + 1, k]];
      for (const qi of [0, 1, 2, 0, 2, 3]) {
        const [ii, kk] = quad[qi];
        const n = rings[ii].n[kk];
        const p = rings[ii].c.clone().addScaledVector(n, r[ii]);
        pos.push(p.x, p.y, p.z);
        nrm.push(n.x, n.y, n.z);
        // a little variation along the line, like bark or moss
        const v = 0.85 + 0.3 * (((ii * 7 + kk * 3) % 5) / 4);
        colr.push(col.r * v, col.g * v, col.b * v);
        tt.push(t0[ii]);
        cc.push(cut[ii]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aCut', new THREE.Float32BufferAttribute(cc, 1));
  return g;
}

/** a soft ribbon facing the spot (for wisps of cloud) */
function ribbon(pts: THREE.Vector3[], halfW: number[], eye: THREE.Vector3, t0: number[]): THREE.BufferGeometry {
  const pos: number[] = [], tt: number[] = [], vv: number[] = [];
  const side: THREE.Vector3[] = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tan = b.clone().sub(a).normalize();
    return new THREE.Vector3().crossVectors(tan, p.clone().sub(eye).normalize()).normalize().multiplyScalar(halfW[i]);
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const q = [pts[i].clone().sub(side[i]), pts[i].clone().add(side[i]), pts[i + 1].clone().add(side[i + 1]), pts[i + 1].clone().sub(side[i + 1])];
    const v = [0, 1, 1, 0];
    const ti = [t0[i], t0[i], t0[i + 1], t0[i + 1]];
    for (const qi of [0, 1, 2, 0, 2, 3]) {
      pos.push(q[qi].x, q[qi].y, q[qi].z);
      vv.push(v[qi]);
      tt.push(ti[qi]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(vv, 1));
  return g;
}

// ───────────────────────── the system ─────────────────────────

export interface CItem {
  def: ConstellationDef;
  area: AreaId;
  group: THREE.Group;
  /** the picture's lines, made of scenery: solid pieces (roots, vines, cracks) and cloud wisps */
  strokes: THREE.Mesh | null;
  /** at most one small real-looking cloud carrying a piece of one line */
  cloud: THREE.Group | null;
  /** for each line of the picture: its vertex ranges in strokes/clouds (to colour its glow) */
  lineRanges: { solid: [number, number][]; cloud: [number, number][] }[];
  u: { uLit: { value: number }; uReveal: { value: number } };
  /** the knots of the puzzle (one per point of the picture), shown once it lights up */
  knots: THREE.InstancedMesh;
  sprites: THREE.Sprite[];
  orb: THREE.Mesh;
  orbBase: THREE.Vector3;
  state: Uint8Array;
  solved: boolean;
  revealed: boolean;
  /** kept for compatibility with saves/tests: 1 once the picture has lit up */
  reveal: number;
  /** 0..1: how far the vision has come while looking from the spot */
  hold: number;
  /** where to stand (feet), the eye there, and the way to look */
  view: { spot: THREE.Vector3; eye: THREE.Vector3; dir: THREE.Vector3 };
  center: THREE.Vector3;
  radius: number;
  /** where each point of the picture is in the world (what you aim at) */
  starPos: THREE.Vector3[];
  lit: THREE.Color;
  blink: number;
  bad: Set<number>;
  badThreads: Set<number>;
  dirty: boolean;
  near: boolean;
  /** how brightly the picture is lit right now (0..1) */
  alpha: number;
}

export type CTarget = { item: CItem; star: number } | { item: CItem; bell: true };

export class ConstellationSystem {
  readonly items: CItem[] = [];
  readonly group = new THREE.Group();
  private cullTimer = 0;
  aimed: CTarget | null = null;
  onSolved: (item: CItem) => void = () => {};
  onChanged: (item: CItem) => void = () => {};
  onRevealed: (item: CItem) => void = () => {};
  /** the secret ending: everything blazes, seen from anywhere */
  blaze = false;
  /** pictures/tests: keep each vision exactly where it is */
  holdPaused = false;
  private spots: { x: number; z: number }[] = [];
  private taken: THREE.Vector3[] = [];
  private lastFwd = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private knotGeo = new THREE.IcosahedronGeometry(1, 1);
  private decoyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  private decoyCloudMat = new THREE.ShaderMaterial({
    uniforms: { uLit: { value: 0 }, uReveal: { value: 1 } },
    vertexShader: cloudVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  /** a veil over the world (drawn just before the knots and glyphs) that dims it while a picture is lit */
  private veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float uOpacity; varying vec2 vUv; void main(){ float d = length(vUv - 0.5); gl_FragColor = vec4(0.015, 0.02, 0.05, uOpacity * (0.55 + 0.9 * d)); }',
      transparent: true, depthTest: false, depthWrite: false,
    }),
  );

  constructor(private world: World) {
    world.root.add(this.group);
    this.veil.frustumCulled = false;
    this.veil.renderOrder = 18;
    this.veil.visible = false;
    this.group.add(this.veil);
  }

  // ───────────────────────── placement ─────────────────────────

  private groundAt(x: number, z: number): number {
    const t = this.world.terrain.heightAt(x, z);
    return this.world.collision.groundAt(x, z, t + 30)[0];
  }

  /** flat, free, dry ground (paths allowed: people stop on paths) */
  private okPoint(x: number, z: number): number | null {
    const g = this.groundAt(x, z);
    if (!isFinite(g)) return null;
    if (g < this.world.waterAt(x, z) + 0.15) return null;
    if (g < 1.2) return null;
    const d = 0.9;
    for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (Math.abs(this.groundAt(x + dx, z + dz) - g) > 0.5) return null;
    if (this.world.collision.blockedAt(x, z, 0.8, g + 0.2, g + 1.6)) return null;
    return g;
  }

  /** places known to be reachable (where panels are), bucketed for quick lookup */
  private anchors = new Map<string, { x: number; z: number; y: number }[]>();
  setAnchors(points: { x: number; z: number; y: number }[]) {
    this.anchors.clear();
    for (const p of points) {
      const k = `${Math.floor(p.x / 4)},${Math.floor(p.z / 4)}`;
      if (!this.anchors.has(k)) this.anchors.set(k, []);
      this.anchors.get(k)!.push(p);
    }
  }
  private nearAnchor(x: number, z: number, y: number): boolean {
    const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      for (const a of this.anchors.get(`${i},${j}`) ?? []) if (Math.abs(a.x - x) < 3.5 && Math.abs(a.z - z) < 3.5 && Math.abs(a.y - y) < 1.2) return true;
    }
    return false;
  }

  /** Can someone walk onto this spot from its surroundings? (not the top of a block, a ledge, a pit) */
  private enterable(x: number, z: number, y: number): boolean {
    const col = this.world.collision;
    let ways = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      let px = x + Math.cos(a) * 5, pz = z + Math.sin(a) * 5;
      let py = this.groundAt(px, pz);
      if (!isFinite(py) || col.blockedAt(px, pz, 0.32, py + 0.5, py + 1.7)) continue;
      for (let i = 0; i < 30; i++) {
        const dx = x - px, dz = z - pz;
        const l = Math.hypot(dx, dz);
        if (l < 0.35) break;
        const st = Math.min(0.3, l);
        const m = col.tryMove(px, pz, py, px + (dx / l) * st, pz + (dz / l) * st, 0.32, 0.55, 1.7);
        if (!m || Math.hypot(m.x - px, m.z - pz) < 0.05) break;
        px = m.x;
        pz = m.z;
        py = m.y;
      }
      if (Math.hypot(x - px, z - pz) < 0.5 && Math.abs(py - y) < 0.35 && ++ways >= 2) return true;
    }
    return false;
  }

  /** Is the spot connected on foot to the rest of the island (a path, or a panel's standing place)? */
  private connected(x: number, z: number, y: number): boolean {
    const col = this.world.collision;
    const seen = new Set<number>([2048 * 4096 + 2048]);
    const q: [number, number, number, number, number][] = [[0, 0, x, z, y]];
    for (let head = 0; head < q.length && q.length < 3200; head++) {
      const [i, j, px, pz, py] = q[head];
      if (this.world.terrain.pathAt(px, pz) > 0.5 && py - this.world.terrain.heightAt(px, pz) < 0.3) return true;
      if (this.nearAnchor(px, pz, py)) return true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj;
        const k = (ni + 2048) * 4096 + (nj + 2048);
        if (seen.has(k) || ni * ni + nj * nj > 900) continue;
        const tx = x + ni, tz = z + nj;
        const m = col.tryMove(px, pz, py, tx, tz, 0.32, 0.55, 1.7);
        if (!m || Math.hypot(m.x - tx, m.z - tz) > 0.35) continue;
        seen.add(k);
        q.push([ni, nj, m.x, m.z, m.y]);
      }
    }
    return false;
  }

  /** where a line of sight from the spot first meets the scenery (null: into water) */
  private castRay(eye: THREE.Vector3, dir: THREE.Vector3, tMin: number, tMax: number): Hit | null {
    const col = this.world.collision;
    const p = new THREE.Vector3();
    let t = tMin;
    const veg = this.world.forest.raycast(eye, dir, tMax);
    const vegT = veg && veg.t > tMin ? veg.t : Infinity;
    p.copy(eye).addScaledVector(dir, t);
    if (p.y <= this.world.terrain.heightAt(p.x, p.z) || col.blockedAt(p.x, p.z, 0.04, p.y - 0.04, p.y + 0.04)) return null;
    while (t < tMax) {
      const step = t < 14 ? 0.22 : 0.45;
      t += step;
      if (t >= vegT) return { kind: veg!.kind, p: eye.clone().addScaledVector(dir, vegT), dist: vegT };
      p.copy(eye).addScaledVector(dir, t);
      const terr = this.world.terrain.heightAt(p.x, p.z);
      if (p.y <= terr) {
        // refine where the line of sight meets the ground
        let lo = t - step, hi = t;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          const q = eye.clone().addScaledVector(dir, mid);
          if (q.y <= this.world.terrain.heightAt(q.x, q.z)) hi = mid;
          else lo = mid;
        }
        const q = eye.clone().addScaledVector(dir, hi);
        if (this.world.terrain.heightAt(q.x, q.z) < this.world.waterAt(q.x, q.z) + 0.05) return null;
        return { kind: 'ground', p: q, dist: hi };
      }
      const [g, surf] = col.groundAt(p.x, p.z, p.y + 0.01);
      if (surf !== null && p.y - g < step * Math.abs(dir.y) + 0.04) return { kind: 'floor', p: new THREE.Vector3(p.x, g, p.z), dist: t };
      if (col.blockedAt(p.x, p.z, 0.04, p.y - 0.04, p.y + 0.04)) return { kind: 'wall', p: eye.clone().addScaledVector(dir, t - 0.1), dist: t - 0.1 };
    }
    return { kind: 'sky', p: eye.clone().addScaledVector(dir, SKY_DIST), dist: SKY_DIST };
  }

  /**
   * Follow one line of the picture through the scenery: sample the directions between its two
   * ends (all of them project onto that line) and see what each one meets. The result is a few
   * runs, each lying on one surface; dressed as scenery, they join into the line from the spot.
   */
  private traceLine(eye: THREE.Vector3, dA: THREE.Vector3, dB: THREE.Vector3): Run[] | null {
    const ang = THREE.MathUtils.radToDeg(dA.angleTo(dB));
    const n = Math.max(4, Math.ceil(ang / 1.1));
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const dir = dA.clone().lerp(dB, t).normalize();
      const hit = this.castRay(eye, dir, 1.5, 60);
      if (!hit) return null;
      if (hit.kind !== 'sky' && hit.dist < 3) return null;
      const s: Sample = { t, dir, hit };
      const prev: Sample | undefined = cur ? cur.samples[cur.samples.length - 1] : undefined;
      const jump = prev ? Math.abs(hit.dist - prev.hit.dist) > 0.6 + 0.12 * Math.min(hit.dist, prev.hit.dist) : true;
      const sameKind = !!cur && (cur.kind === hit.kind || ((cur.kind === 'wall' || cur.kind === 'rock') && (hit.kind === 'wall' || hit.kind === 'rock')));
      if (!cur || !sameKind || jump) {
        cur = { kind: hit.kind, samples: [s] };
        runs.push(cur);
      } else cur.samples.push(s);
    }
    if (runs.length > 5) return null;
    return runs;
  }

  private region(area: AreaId): { center: { x: number; z: number }; rMin: number; rMax: number } {
    // each place keeps its figures, but they spread over its whole surroundings, wild parts included
    if (area === 'prologue') return { center: { x: 0, z: 300 }, rMin: 0, rMax: 62 };
    if (area === 'echo') return { center: { x: CALDERA.x, z: CALDERA.z }, rMin: 10, rMax: 50 };
    if (area === 'citadel') return { center: { x: CITADEL.x, z: CITADEL.z - 10 }, rMin: 0, rMax: 75 };
    if (area === 'hub') return { center: ANCHORS.hub, rMin: 26, rMax: 120 };
    return { center: ANCHORS[area], rMin: 0, rMax: (AREA_RADIUS[area] ?? 80) + 60 };
  }

  /** true once every picture has found its place */
  ready = false;
  private placer: Generator<void, void> | null = null;
  /** saved states for pictures not placed yet (applied as soon as each one is built) */
  private pending = new Map<string, { s?: string; solved: boolean; revealed: boolean }>();

  /**
   * Finding the pictures' places takes a while (thousands of lines of sight), so it runs in the
   * background in small slices — during the intro and the menu, then in the idle time of frames —
   * and never holds up the start of the game. The result is always the same.
   */
  startPlacing() {
    if (this.placer || this.ready) return;
    this.placer = this.placeSteps();
    type IdleDeadline = { timeRemaining(): number };
    const ric = (window as unknown as { requestIdleCallback?: (cb: (d: IdleDeadline) => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const step = (deadline?: IdleDeadline) => {
      if (!this.placer) return;
      const t0 = performance.now();
      const budget = () => (deadline ? deadline.timeRemaining() > 1 : performance.now() - t0 < 6);
      do {
        if (this.placer.next().done) {
          this.placer = null;
          this.ready = true;
          return;
        }
      } while (budget());
      if (ric) ric(step, { timeout: 200 });
      else setTimeout(() => step(), 0);
    };
    if (ric) ric(step, { timeout: 200 });
    else setTimeout(() => step(), 0);
  }

  /** Place everything right now (tests and tools). */
  placeAll() {
    if (!this.placer) this.placer = this.placeSteps();
    while (!this.placer.next().done) { /* keep going */ }
    this.placer = null;
    this.ready = true;
  }

  private *placeSteps(): Generator<void, void> {
    const byArea = new Map<AreaId, ConstellationDef[]>();
    for (const d of CONSTELLATIONS) {
      if (!byArea.has(d.area)) byArea.set(d.area, []);
      byArea.get(d.area)!.push(d);
    }
    for (const [area, defs] of byArea) {
      const rnd = rng(area.length * 977 + 13);
      const { center, rMin, rMax } = this.region(area);
      for (const def of defs) {
        let done = false;
        // strict first (a picture across several kinds of scenery), then relaxed, then wider
        for (let pass = 0; pass < 4 && !done; pass++) {
          for (let attempt = 0; attempt < (pass === 3 ? 1600 : 300) && !done; attempt++) {
            const ang = rnd() * Math.PI * 2;
            const wide = pass >= 2 ? 1.5 : 1;
            let r = rMin + Math.sqrt(rnd()) * (rMax - rMin) * wide;
            let base = center;
            if (pass >= 2 && area === 'citadel' && attempt % 2) base = { x: NORTH_LANDING.x, z: NORTH_LANDING.z + 20 };
            if (pass === 3 && area === 'citadel' && attempt % 3 === 2) {
              // the northern half of the island looks up at the citadel too
              base = { x: 0, z: -390 };
              r = Math.sqrt(rnd()) * 150;
            }
            if (pass >= 2 && area === 'echo' && attempt % 2) {
              base = { x: CALDERA.x, z: CALDERA.z };
              r = 70 + rnd() * (pass === 3 ? 90 : 45);
            }
            const vx = base.x + Math.cos(ang) * r, vz = base.z + Math.sin(ang) * r;
            if (Math.hypot(vx, vz - 20) > 520) continue; // stay on the island
            done = this.tryPlace(def, area, vx, vz, rnd, pass);
            yield;
          }
        }
        if (!done) console.warn('constellation not placed', def.id);
      }
      this.scatterDecoys(area, center, rMin, rMax, defs.length * 5, rnd);
      yield;
    }
  }

  private tryPlace(def: ConstellationDef, area: AreaId, vx: number, vz: number, rnd: () => number, pass: number): boolean {
    const gy = this.okPoint(vx, vz);
    if (gy === null) return false;
    if (Math.hypot(vx - SPIRE.x, vz - SPIRE.z) < 26) return false; // the Spire's island and landings
    if (area !== 'echo' && Math.hypot(vx - CALDERA.x, vz - CALDERA.z) < CALDERA.inner + 6) return false;
    const spacing = pass === 3 ? SPOT_SPACING * 0.7 : SPOT_SPACING;
    if (this.spots.some((v) => Math.hypot(v.x - vx, v.z - vz) < spacing)) return false;
    if (!this.enterable(vx, vz, gy)) return false;
    const eye = new THREE.Vector3(vx, gy + EYE_H, vz);
    if (this.world.forest.crownNear(eye, 2.2)) return false;
    const yaw = rnd() * Math.PI * 2;
    // mostly level or a little down; in open country the last pass looks further down (the sea has
    // nothing to draw with)
    const pitch = THREE.MathUtils.degToRad(pass === 3 ? -30 + rnd() * 20 : -18 + rnd() * 26);
    const fwd = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // the picture's layout, centred and scaled to the angle it covers from the spot
    const pts2 = [...def.stars.map((st) => [st.x, st.z]), [def.bell.x, def.bell.z]];
    const xs = def.stars.map((s) => s.x), zs = def.stars.map((s) => s.z);
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, mz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const maxR = Math.max(0.3, ...pts2.map((q) => Math.hypot(q[0] - mx, q[1] - mz)));
    const k = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG)) / maxR;
    const dirs = pts2.map(([x, z]) => fwd.clone().addScaledVector(right, (x - mx) * k).addScaledVector(up, -(z - mz) * k).normalize());
    // the corners first (cheap): what each point of the picture meets in the scenery
    const hits: Hit[] = [];
    for (const d of dirs) {
      const h = this.castRay(eye, d, 1.5, 60);
      if (!h || h.kind === 'sky' || h.dist < 3) return false;
      hits.push(h);
    }
    // a good frame: nothing big right in your face around the picture
    for (let kk = 0; kk < 12; kk++) {
      const a = (kk / 12) * Math.PI * 2;
      const t = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG * 1.3));
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * t).addScaledVector(up, Math.sin(a) * t).normalize();
      const h = this.castRay(eye, dir, 0.4, 4.5);
      if (h && (h.kind === 'wall' || h.kind === 'tree' || h.kind === 'rock')) return false;
    }
    // never on a panel: a crack across a panel would read as part of its puzzle
    for (const h of hits) if (h.kind === 'wall' && this.nearAnchor(h.p.x, h.p.z, h.p.y - 1.2)) return false;
    if (this.taken.some((q) => hits.some((h) => h.kind !== 'sky' && q.distanceTo(h.p) < 1.2))) return false;
    // now every line, through the scenery
    const lines: Run[][] = [];
    const count: Record<HitKind, number> = { ground: 0, floor: 0, wall: 0, tree: 0, rock: 0, sky: 0 };
    let total = 0;
    for (const th of def.threads) {
      const runs = this.traceLine(eye, dirs[th.a], dirs[th.b]);
      if (!runs) return false;
      for (const r of runs) for (const s of r.samples) {
        count[s.hit.kind]++;
        total++;
        if (s.hit.kind === 'wall' && this.nearAnchor(s.hit.p.x, s.hit.p.z, s.hit.p.y - 1.2)) return false;
      }
      lines.push(runs);
    }
    // everywhere, not only on the ground; several kinds of scenery; the sky at most once, briefly
    // (one real-looking cloud carrying a short piece of one line — more than that gives it away)
    const onGround = (count.ground + count.floor) / total;
    const skyRuns = lines.flat().filter((r) => r.kind === 'sky');
    if (skyRuns.length > 1 || (skyRuns.length === 1 && skyRuns[0].samples.length > 5)) return false;
    const kinds = (Object.keys(count) as HitKind[]).filter((kk) => kk !== 'sky' && count[kk] / total > 0.06).length;
    if (pass === 0 && (onGround > 0.6 || kinds < 3)) return false;
    if (pass === 1 && (onGround > 0.75 || kinds < 2)) return false;
    if (pass === 2 && onGround > 0.88) return false;
    // last (the slowest check): the spot must be walkable-to from the rest of the island
    if (!this.connected(vx, vz, gy)) return false;
    this.spots.push({ x: vx, z: vz });
    this.build(def, area, eye, gy, fwd, dirs, hits, lines);
    return true;
  }

  /** Turn traced lines into scenery: tubes for the solid pieces, soft ribbons for cloud. */
  private dress(
    lines: Run[][], area: AreaId, eye: THREE.Vector3, tOf: (line: number, t: number) => number, cutOf: (line: number, t: number) => number,
  ): { solid: THREE.BufferGeometry | null; puffs: { p: THREE.Vector3; size: number }[]; ranges: { solid: [number, number][]; cloud: [number, number][] }[] } {
    const solids: THREE.BufferGeometry[] = [];
    const puffs: { p: THREE.Vector3; size: number }[] = [];
    let solidN = 0;
    const ranges = lines.map(() => ({ solid: [] as [number, number][], cloud: [] as [number, number][] }));
    lines.forEach((runs, li) => {
      runs.forEach((run, ri) => {
        const look = lookFor(run.kind, area);
        // the run's own samples, stretched half a step into its neighbours at its own depth, so
        // the pieces meet exactly as seen from the spot
        const ss: { t: number; dir: THREE.Vector3; dist: number }[] = run.samples.map((s) => ({ t: s.t, dir: s.dir, dist: s.hit.dist }));
        const prevRun = runs[ri - 1], nextRun = runs[ri + 1];
        if (prevRun) {
          const a = prevRun.samples[prevRun.samples.length - 1], b = run.samples[0];
          ss.unshift({ t: (a.t + b.t) / 2, dir: a.dir.clone().lerp(b.dir, 0.5).normalize(), dist: b.hit.dist });
        }
        if (nextRun) {
          const a = run.samples[run.samples.length - 1], b = nextRun.samples[0];
          ss.push({ t: (a.t + b.t) / 2, dir: a.dir.clone().lerp(b.dir, 0.5).normalize(), dist: a.hit.dist });
        }
        if (ss.length < 2) ss.push({ t: ss[0].t + 0.001, dir: ss[0].dir, dist: ss[0].dist });
        const pts = ss.map((s) => eye.clone().addScaledVector(s.dir, Math.max(0.5, s.dist - look.off - s.dist * 0.003)));
        const w = ss.map((s) => s.dist * look.w);
        const tt = ss.map((s) => tOf(li, s.t));
        if (look.kind === 'cloud') {
          puffs.push(...pts.map((p, i) => ({ p, size: w[i] })));
        } else {
          const g = tube(pts, w, new THREE.Color(look.color), tt, ss.map((s) => cutOf(li, s.t)));
          ranges[li].solid.push([solidN, solidN + g.attributes.position.count]);
          solidN += g.attributes.position.count;
          solids.push(g);
        }
      });
    });
    return { solid: solids.length ? mergeGeometries(solids, false) : null, puffs, ranges };
  }

  private build(def: ConstellationDef, area: AreaId, eye: THREE.Vector3, gy: number, fwd: THREE.Vector3, dirs: THREE.Vector3[], hits: Hit[], lines: Run[][]) {
    const g = new THREE.Group();
    const n = def.stars.length;
    const nT = def.threads.length;
    const u = { uLit: { value: 0 }, uReveal: { value: 1 } };
    // the light runs along the lines one after another when the picture lights up
    const tOf = (li: number, t: number) => (li + t) / nT;
    // a cut line (its two ends must differ) stays dark in its middle when lit
    const cutOf = (li: number, t: number) => (def.threads[li].mark === 'diff' && t > 0.42 && t < 0.58 ? 1 : 0);
    const dressed = this.dress(lines, area, eye, tOf, cutOf);
    let strokes: THREE.Mesh | null = null;
    if (dressed.solid) {
      strokes = new THREE.Mesh(dressed.solid, strokeMaterial(u));
      strokes.castShadow = true;
      strokes.receiveShadow = true;
      g.add(strokes);
    }
    let cloud: THREE.Group | null = null;
    if (dressed.puffs.length) {
      // one small cloud: overlapping soft puffs along its piece of line
      cloud = new THREE.Group();
      const mat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      const rr = rng(Math.round(eye.x * 7 + eye.z * 3));
      for (const pf of dressed.puffs) {
        for (let k = 0; k < 2; k++) {
          const sp = new THREE.Sprite(mat);
          sp.position.copy(pf.p).add(new THREE.Vector3((rr() - 0.5) * pf.size * 0.6, (rr() - 0.5) * pf.size * 0.25, (rr() - 0.5) * pf.size * 0.6));
          sp.scale.set(pf.size * (2.4 + rr() * 1.4), pf.size * (1.5 + rr() * 0.8), 1);
          sp.renderOrder = 2;
          cloud.add(sp);
        }
      }
      g.add(cloud);
    }
    // the points of the picture: where its lines meet, as seen from the spot
    const starPos = hits.slice(0, n).map((h, i) => eye.clone().addScaledVector(dirs[i], Math.max(0.6, Math.min(h.dist, 80) - 0.15)));
    for (const h of hits) if (h.kind !== 'sky') this.taken.push(h.p.clone());
    // knots (the puzzle's lights), only once the picture is lit
    const knots = new THREE.InstancedMesh(this.knotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), n);
    starPos.forEach((p, i) => {
      const s = p.distanceTo(eye) * 0.0085;
      knots.setMatrixAt(i, new THREE.Matrix4().makeScale(s, s, s).setPosition(p));
      knots.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    knots.instanceMatrix.needsUpdate = true;
    knots.renderOrder = 21;
    knots.frustumCulled = false;
    knots.visible = false;
    g.add(knots);
    // glyphs: sized by distance so they all look the same from the spot
    const sprites: THREE.Sprite[] = [];
    def.stars.forEach((st, i) => {
      if (!st.glyph) return;
      const d = starPos[i].distanceTo(eye);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(st.glyph), depthWrite: false, depthTest: false, transparent: true, opacity: 0, fog: false }));
      sp.position.copy(starPos[i]).add(new THREE.Vector3(0, d * 0.03, 0));
      sp.scale.setScalar(d * 0.032);
      sp.renderOrder = 22;
      sp.visible = false;
      g.add(sp);
      sprites.push(sp);
    });
    // the orb (rung to check) appears where the picture says
    const orbHit = hits[n];
    const od = Math.min(orbHit.kind === 'sky' ? 18 : orbHit.dist - 0.3, 40);
    const orbBase = eye.clone().addScaledVector(dirs[n], Math.max(2, od));
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(Math.max(0.1, orbBase.distanceTo(eye) * 0.011), 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.65, 1.3), toneMapped: false, transparent: true, opacity: 0.95, depthTest: false, fog: false }),
    );
    orb.renderOrder = 23;
    orb.position.copy(orbBase);
    orb.visible = false;
    orb.userData.bell = true;
    g.add(orb);
    this.group.add(g);
    const centroid = starPos.reduce((acc, q) => acc.add(q), new THREE.Vector3()).multiplyScalar(1 / n);
    this.items.push({
      def, area, group: g, strokes, cloud, lineRanges: dressed.ranges, u, knots, sprites, orb, orbBase,
      state: initialState(def), solved: false, revealed: false, reveal: 0, hold: 0,
      view: { spot: new THREE.Vector3(eye.x, gy, eye.z), eye: eye.clone(), dir: fwd.clone() },
      center: centroid, radius: 3, starPos, lit: new THREE.Color('#ffd9a0'), blink: 0, bad: new Set(), badThreads: new Set(), dirty: true, near: false, alpha: 0,
    });
    const p = this.pending.get(def.id);
    if (p) {
      this.pending.delete(def.id);
      this.restore(def.id, p.s, p.solved, p.revealed);
    }
  }

  /** Roots, vines, cracks and wisps of cloud that draw nothing at all (the island is full of them). */
  private scatterDecoys(area: AreaId, center: { x: number; z: number }, rMin: number, rMax: number, count: number, rnd: () => number) {
    const solids: THREE.BufferGeometry[] = [];
    let made = 0;
    for (let attempt = 0; attempt < count * 12 && made < count; attempt++) {
      const ang = rnd() * Math.PI * 2;
      const r = rMin + Math.sqrt(rnd()) * (rMax - rMin) * 1.2;
      const cx = center.x + Math.cos(ang) * r, cz = center.z + Math.sin(ang) * r;
      if (Math.hypot(cx, cz - 20) > 520) continue;
      const y0 = this.groundAt(cx, cz);
      if (!isFinite(y0) || y0 < this.world.waterAt(cx, cz) + 0.2) continue;
      const eye = new THREE.Vector3(cx, y0 + EYE_H, cz);
      const yaw = rnd() * Math.PI * 2, pitch = THREE.MathUtils.degToRad(-14 + rnd() * 26);
      const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
      const tilt = (rnd() - 0.5) * 1.2;
      const half = THREE.MathUtils.degToRad(3 + rnd() * 8);
      const dA = d.clone().addScaledVector(side, -Math.tan(half)).add(new THREE.Vector3(0, tilt * Math.tan(half), 0)).normalize();
      const dB = d.clone().addScaledVector(side, Math.tan(half)).add(new THREE.Vector3(0, -tilt * Math.tan(half), 0)).normalize();
      const runs = this.traceLine(eye, dA, dB);
      if (!runs) continue;
      const ground = runs.filter((r) => r.kind !== 'sky');
      if (!ground.length) continue;
      const res = this.dress([ground], area, eye, () => 0, () => 0);
      if (res.solid) solids.push(res.solid);
      made++;
    }
    if (solids.length) {
      const m = new THREE.Mesh(mergeGeometries(solids, false)!, this.decoyMat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // ───────────────────────── seeing ─────────────────────────

  /**
   * Called every frame while walking. Standing on a picture's spot and looking its way, steadily,
   * lights it up: the light runs along its lines and completes after REVEAL_SECONDS.
   */
  watch(dt: number, camera: THREE.PerspectiveCamera, _playerSpeed = 0) {
    let focus = 0;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    // turning the head quickly breaks the spell
    const turn = this.lastFwd.lengthSq() > 0 ? this.lastFwd.angleTo(fwd) / Math.max(dt, 1e-3) : 0;
    this.lastFwd.copy(fwd);
    const steady = turn < 0.35;
    const cam = camera.position;
    for (const it of this.items) {
      if (!it.near) {
        if (it.hold > 0 && !it.revealed) {
          it.hold = Math.max(0, it.hold - dt * 0.5);
          it.dirty = true;
        }
        if (it.alpha > 0 && !this.blaze) {
          it.alpha = 0;
          it.dirty = true;
        }
        continue;
      }
      const dh = Math.hypot(cam.x - it.view.eye.x, cam.z - it.view.eye.z);
      const dv = Math.abs(cam.y - it.view.eye.y);
      const ang = THREE.MathUtils.radToDeg(fwd.angleTo(it.view.dir));
      const aligned = dh < SPOT_TOL && dv < 0.45 && ang < LOOK_TOL;
      let alpha: number;
      if (this.blaze) alpha = 1;
      else if (it.revealed) {
        // a lit picture stays lit while you are around its spot
        alpha = THREE.MathUtils.clamp(1 - (dh - 1.4) / 2.4, 0, 1) * THREE.MathUtils.clamp(1 - (ang - 28) / 25, 0, 1);
      } else {
        const before = it.hold;
        if (this.holdPaused) {
          /* keep it */
        } else if (aligned && steady) it.hold = Math.min(1, it.hold + dt / REVEAL_SECONDS);
        else it.hold = Math.max(0, it.hold - dt * (aligned ? 0.15 : 0.5));
        if (it.hold !== before) it.dirty = true;
        alpha = it.hold;
        if (it.hold >= 1) {
          it.revealed = true;
          it.reveal = 1;
          it.dirty = true;
          audio.panelPowered();
          this.onRevealed(it);
        }
      }
      if (Math.abs(alpha - it.alpha) > 1e-3) {
        it.alpha = alpha;
        it.dirty = true;
      }
      if (!this.blaze) focus = Math.max(focus, alpha);
    }
    // the world quietly dims as a picture lights up
    const veil = this.veil.material as THREE.ShaderMaterial;
    const target = 0.38 * Math.min(1, focus * 1.1);
    const cur = veil.uniforms.uOpacity.value as number;
    veil.uniforms.uOpacity.value = cur + (target - cur) * Math.min(1, dt * 3);
    this.veil.visible = veil.uniforms.uOpacity.value > 0.004;
  }

  // ───────────────────────── interaction ─────────────────────────

  /** what the crosshair (or, on touch, the finger at `ndc`) points at — from the picture's spot */
  aim(camera: THREE.Camera, ndc = new THREE.Vector2(0, 0)): CTarget | null {
    const ray = this.raycaster;
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let best: CTarget | null = null;
    let bestA = THREE.MathUtils.degToRad(1.8);
    const v = new THREE.Vector3();
    for (const it of this.items) {
      if (!it.near || !it.revealed) continue;
      if (Math.hypot(o.x - it.view.eye.x, o.z - it.view.eye.z) > 2.4) continue;
      for (let i = 0; i < it.starPos.length; i++) {
        const a = v.copy(it.starPos[i]).sub(o).normalize().angleTo(d);
        if (a < bestA) {
          bestA = a;
          best = { item: it, star: i };
        }
      }
      if (it.orb.visible) {
        const a = v.copy(it.orb.position).sub(o).normalize().angleTo(d);
        if (a < bestA * 1.3) {
          bestA = a;
          best = { item: it, bell: true };
        }
      }
    }
    this.aimed = best;
    return best;
  }

  click(): boolean {
    const t = this.aimed;
    if (!t) return false;
    const it = t.item;
    if ('bell' in t) {
      this.ring(it);
      return true;
    }
    if (it.solved || !isPressable(it.def, t.star)) return true;
    for (const j of pressSet(it.def, t.star)) it.state[j] ^= 1;
    it.blink = 0;
    it.dirty = true;
    audio.tile(!!it.state[t.star], t.star % 7, (t.star * 3) % 9, 7, 9, it.area);
    this.onChanged(it);
    return true;
  }

  private ring(it: CItem) {
    if (it.solved) {
      audio.uiClick();
      return;
    }
    const res = checkConstellation(it.def, it.state);
    if (res.ok) {
      it.solved = true;
      it.dirty = true;
      audio.secretSolved();
      this.onSolved(it);
    } else {
      it.bad = new Set(res.violations.stars);
      it.badThreads = new Set(res.violations.threads);
      it.blink = 2.2;
      audio.panelFailed();
    }
  }

  // ───────────────────────── state ─────────────────────────

  restore(id: string, s: string | undefined, solved: boolean, revealed: boolean) {
    const it = this.items.find((x) => x.def.id === id);
    if (!it) {
      if (solved || revealed || s) this.pending.set(id, { s, solved, revealed });
      else this.pending.delete(id);
      return;
    }
    it.state = initialState(it.def);
    if (s && s.length === it.state.length) for (let i = 0; i < s.length; i++) if (it.def.stars[i].lock === undefined) it.state[i] = s[i] === '1' ? 1 : 0;
    it.solved = solved;
    it.revealed = revealed || solved;
    it.reveal = it.revealed ? 1 : 0;
    it.hold = it.revealed ? 1 : 0;
    it.dirty = true;
  }

  stateOf(it: CItem) {
    return stateString(it.state);
  }

  get solvedCount() {
    let n = this.items.filter((i) => i.solved).length;
    for (const p of this.pending.values()) if (p.solved) n++;
    return n;
  }

  get revealedCount() {
    let n = this.items.filter((i) => i.revealed).length;
    for (const p of this.pending.values()) if (p.revealed || p.solved) n++;
    return n;
  }

  /** how many pictures there are in all (placed or not yet) */
  get total() {
    return CONSTELLATIONS.length;
  }

  update(dt: number, t: number, cam: THREE.Vector3) {
    this.cullTimer -= dt;
    if (this.cullTimer <= 0) {
      this.cullTimer = 0.4;
      for (const it of this.items) {
        const d = Math.hypot(it.view.eye.x - cam.x, it.view.eye.z - cam.z);
        it.near = d < 14 || this.blaze;
      }
    }
    const c = new THREE.Color();
    for (const it of this.items) {
      if (it.blink > 0) {
        it.blink = Math.max(0, it.blink - dt);
        it.dirty = true;
      }
      const lit = it.alpha;
      // the puzzle's knots, glyphs and orb exist only while the picture is lit
      const show = (it.revealed || this.blaze) && lit > 0.02;
      it.knots.visible = show;
      it.orb.visible = show && !it.solved;
      if (it.orb.visible) {
        const bob = Math.sin(t * 1.6 + it.orbBase.x) * 0.04 * Math.max(1, it.orbBase.distanceTo(it.view.eye) / 6);
        it.orb.position.set(it.orbBase.x, it.orbBase.y + bob, it.orbBase.z);
        (it.orb.material as THREE.MeshBasicMaterial).opacity = 0.95 * lit;
      }
      for (const s of it.sprites) {
        s.visible = show;
        (s.material as THREE.SpriteMaterial).opacity = lit;
      }
      if (!it.dirty && !it.solved && !this.blaze) continue;
      // while you hold, the light runs along the lines; once lit, it stays
      it.u.uLit.value = lit;
      it.u.uReveal.value = it.revealed || this.blaze ? 1 : it.hold;
      (it.knots.material as THREE.MeshBasicMaterial).opacity = lit;
      const blinkOn = it.blink > 0 && Math.floor(it.blink * 4) % 2 === 0;
      for (let i = 0; i < it.state.length; i++) {
        if (blinkOn && it.bad.has(i)) c.setRGB(2.2, 0.15, 0.1);
        else if (it.solved || this.blaze) c.set('#fff2cf').multiplyScalar(1.9 + 0.3 * Math.sin(t * 2 + i));
        else if (it.state[i]) c.copy(it.lit).multiplyScalar(2.4);
        else c.setRGB(0.55, 0.55, 0.62);
        it.knots.setColorAt(i, c);
      }
      if (it.knots.instanceColor) it.knots.instanceColor.needsUpdate = true;
      // each line glows by its state (red while it is why a check failed)
      const gS = it.strokes?.geometry.attributes.aGlow as THREE.BufferAttribute | undefined;
      it.lineRanges.forEach((rg, k) => {
        let r = 1.5, gg = 1.38, bl = 1.15;
        if (blinkOn && it.badThreads.has(k)) [r, gg, bl] = [2.6, 0.2, 0.12];
        else if (it.solved || this.blaze) [r, gg, bl] = [2.4, 2.0, 1.35];
        else {
          const th = it.def.threads[k];
          if (it.state[th.a] && it.state[th.b]) [r, gg, bl] = [2.7, 2.3, 1.55];
        }
        if (gS) for (const [a, b] of rg.solid) for (let v = a; v < b; v++) gS.setXYZ(v, r, gg, bl);
      });
      if (gS) gS.needsUpdate = true;
      if (it.cloud) {
        // the cloud warms and glows with the picture
        const m = (it.cloud.children[0] as THREE.Sprite).material as THREE.SpriteMaterial;
        m.color.setRGB(1, 1, 1).lerp(new THREE.Color(1.6, 1.4, 1.05), lit);
      }
      it.dirty = false;
    }
  }
}
