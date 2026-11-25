/**
 * THE CONSTELLATIONS — the secret layer, drawn by the island itself.
 *
 * Every constellation is a picture (a whale, an owl, a windmill…) whose lines are made of real
 * things in the scenery: a fallen branch or driftwood on the ground, ivy climbing a wall, a crack
 * in a ruin, the paving or a rock, a vine around a trunk, now and then one small cloud. A single
 * line of the picture is several of these at very different distances — it starts as a branch at
 * your feet, carries on as a crack in a wall forty metres away and ends as ivy on a tower. From
 * everywhere else they are just branches, cracks and ivy (and the island is full of those anyway).
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
import SAVED_PLACES from '../data/constellation-places.json';
import type { ConstellationDef } from './types';
import { checkConstellation, initialState, isPressable, pressSet, stateString } from './graph';
import type { World } from '../world/world';
import type { AreaId } from '../data/areas';
import { ANCHORS, AREA_RADIUS, CALDERA, CITADEL, NORTH_LANDING, SPIRE } from '../world/layout';
import { drawGlyph } from '../puzzle/glyphs';
import { rng } from '../world/noise';
import { windUniforms } from '../world/vegetation';
import { audio } from '../audio';
import { SceneCaster } from './scenecast';
import { StrokeBuilder, dressPiece, type DressCtx, type Piece } from './dressing';

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
  /** surface normal, facing the spot */
  n: THREE.Vector3;
  /** which object (trees: to tell one from the next) and, on a tree, its wind */
  id?: number;
  wind?: [number, number, number] | null;
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
  /** the surface's (mean) normal */
  n: THREE.Vector3;
  /** on a tree: how the wind moves it (phase, reach, turn) */
  wind?: [number, number, number] | null;
}

/** how far the drawing must fall apart when seen from a couple of steps aside (shape difference) */
const SHIFT_MIN = 0.16;

/** difference of two 2D point sets after the best shift, scale and turn (0 = same shape) */
function shapeDifference(A: number[][], B: number[][]): number {
  const norm = (P: number[][]) => {
    let cx = 0, cy = 0;
    for (const q of P) {
      cx += q[0];
      cy += q[1];
    }
    cx /= P.length;
    cy /= P.length;
    let ss = 0;
    const out = P.map((q) => [q[0] - cx, q[1] - cy]);
    for (const q of out) ss += q[0] * q[0] + q[1] * q[1];
    const k = 1 / Math.sqrt(Math.max(1e-12, ss / P.length));
    return out.map((q) => [q[0] * k, q[1] * k]);
  };
  const a = norm(A), b = norm(B);
  let sxx = 0, sxy = 0;
  for (let i = 0; i < a.length; i++) {
    sxx += a[i][0] * b[i][0] + a[i][1] * b[i][1];
    sxy += a[i][0] * b[i][1] - a[i][1] * b[i][0];
  }
  const th = Math.atan2(sxy, sxx), c = Math.cos(th), sn = Math.sin(th);
  let err = 0;
  for (let i = 0; i < a.length; i++) {
    const rx = b[i][0] * c + b[i][1] * sn, ry = -b[i][0] * sn + b[i][1] * c;
    err += (a[i][0] - rx) ** 2 + (a[i][1] - ry) ** 2;
  }
  return Math.sqrt(err / a.length);
}

/** Lit like everything else; glows (line by line) once the picture lights up. */
function strokeMaterial(u: { uLit: { value: number }; uReveal: { value: number } }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = u.uLit;
    sh.uniforms.uReveal = u.uReveal;
    sh.uniforms.uTime = windUniforms.uTime;
    sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nattribute float aT;\nattribute float aCut;\nattribute vec3 aWind;\nuniform float uTime;\nuniform float uWind;\nvarying vec3 vGlow;\nvarying float vT;\nvarying float vCut;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow; vT = aT; vCut = aCut;
{
  // a vine on a tree crown sways exactly like the crown (same wind as the trees' shader)
  float ph = aWind.x;
  float w = sin(uTime * 1.2 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25 + sin(uTime * 0.5 + ph * 0.3) * 0.4;
  vec2 d = vec2(w * aWind.y * uWind * 0.22, cos(uTime * 1.05 + ph) * aWind.y * uWind * 0.14);
  float c = cos(aWind.z), s = sin(aWind.z);
  transformed.x += d.x * c + d.y * s;
  transformed.z += -d.x * s + d.y * c;
}`,
      );
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

// ───────────────────────── saved placement ─────────────────────────

const KINDS: HitKind[] = ['ground', 'floor', 'wall', 'tree', 'rock', 'sky'];
const r2 = (v: number) => Math.round(v * 100) / 100;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
/** a run as numbers: kind, normal, wind (phase, reach, turn), then t and distance of each sample */
function packRun(r: Run): number[] {
  const w = r.wind ?? [0, 0, 0];
  return [KINDS.indexOf(r.kind), r2(r.n.x), r2(r.n.y), r2(r.n.z), r2(w[0]), r2(w[1]), r2(w[2]), ...r.samples.flatMap((sm) => [r5(sm.t), r2(sm.hit.dist)])];
}
/** where every picture was placed (computed once by scripts/place-constellations.cjs) */
export interface PlaceRecord {
  /** fingerprint of the world the places were computed for (terrain, solids, trees, pictures) */
  signature: string;
  /** per picture: eye, ground, facing, corner hits [kind, dist], and per line its runs as
   *  [kind, normal x,y,z, then t,dist for every sample] */
  places: Record<string, { e: number[]; g: number; f: number[]; h: number[][]; l: number[][][] }>;
  /** decoy lines per area: eye, the two directions, runs (as above) */
  decoys: Record<string, { e: number[]; a: number[]; b: number[]; l: number[][] }[]>;
}

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
  /** what its lines run through: samples per kind of scenery */
  drawnOn: Record<string, number>;
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
  private decoyMat = strokeMaterial({ uLit: { value: 0 }, uReveal: { value: 1 } });
  /** exact lines of sight through the island as drawn (built only when places are searched for) */
  private caster: SceneCaster | null = null;
  /** ground under branches: no grass grows over them (cells of 4 m: x0,z0,x1,z1,r…) */
  private bare = new Map<number, number[]>();
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

  /** how each part of the scene counts for lines of sight */
  private markScene() {
    const w = this.world;
    w.terrain.group.userData.castAs = 'terrain';
    w.water.group.userData.castAs = 'bad';
    w.grass.group.userData.castAs = 'skip';
    w.sky.mesh.userData.castAs = 'skip';
    this.group.userData.castAs = 'skip';
  }

  private ensureCaster(): SceneCaster {
    if (!this.caster) {
      this.markScene();
      this.caster = new SceneCaster(this.world.engine.scene);
    }
    return this.caster;
  }

  /**
   * Where a line of sight from the spot first meets what is drawn on screen. null: water, a panel,
   * a door or anything else that moves, a swaying tree crown, or something right in front of you.
   */
  private castRay(eye: THREE.Vector3, dir: THREE.Vector3, tMin: number, tMax: number): Hit | null {
    const h = this.ensureCaster().cast(eye, dir, 0.05, tMax);
    if (!h) return { kind: 'sky', p: eye.clone().addScaledVector(dir, SKY_DIST), dist: SKY_DIST, n: dir.clone().negate() };
    if (h.t < tMin) {
      this.lastWhy = 'close';
      return null;
    }
    let kind: HitKind;
    if (h.cls === 'bad') {
      this.lastWhy = 'bad';
      return null;
    }
    if (h.cls === 'tree') kind = 'tree'; // trunk or crown (a vine there sways with it)
    else if (h.cls === 'rock') kind = 'rock';
    else if (h.cls === 'terrain') kind = 'ground';
    else kind = h.n.y > 0.6 ? 'floor' : 'wall';
    const p = eye.clone().addScaledVector(dir, h.t);
    if (kind === 'ground' && this.world.terrain.heightAt(p.x, p.z) < this.world.waterAt(p.x, p.z) + 0.05) {
      this.lastWhy = 'water';
      return null;
    }
    return { kind, p, dist: h.t, n: h.n, id: h.id, wind: h.wind };
  }

  /**
   * Follow one line of the picture through the scenery: sample the directions between its two
   * ends (all of them project onto that line) and see what each one meets. The result is a few
   * runs, each lying continuously on one surface; dressed as scenery, they join into the line
   * from the spot (and only from there, when they lie at different depths).
   */
  private traceLine(eye: THREE.Vector3, dA: THREE.Vector3, dB: THREE.Vector3): Run[] | null {
    const ang = THREE.MathUtils.radToDeg(dA.angleTo(dB));
    const n = Math.max(5, Math.ceil(ang / 1.1));
    const at = (t: number): Sample | null => {
      const dir = dA.clone().lerp(dB, t).normalize();
      const hit = this.castRay(eye, dir, 1.5, 70);
      if (!hit) {
        this.lastMiss = this.lastWhy;
        return null;
      }
      if (hit.kind !== 'sky' && hit.dist < 3) {
        this.lastMiss = 'near';
        return null;
      }
      return { t, dir, hit };
    };
    let samples: Sample[] = [];
    for (let i = 0; i <= n; i++) {
      const sm = at(i / n);
      if (!sm) return null;
      samples.push(sm);
    }
    // look between neighbours: something small in front, a corner, a bend — keep the middle where it differs
    const out: Sample[] = [samples[0]];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      if (a.hit.kind !== 'sky' || b.hit.kind !== 'sky') {
        const m = at((a.t + b.t) / 2);
        if (!m) return null;
        const exp = (a.hit.dist + b.hit.dist) / 2;
        if (m.hit.kind !== a.hit.kind || m.hit.kind !== b.hit.kind || Math.abs(m.hit.dist - exp) > 0.03 * exp + 0.04) out.push(m);
      }
      out.push(b);
    }
    samples = out;
    // neighbours on one surface, far apart in space: still one surface (grazing ground, a slanted
    // wall) or a jump to something farther/nearer? The middle of a continuous surface lies between.
    const continuous = (a: Sample, b: Sample): boolean => {
      if (a.hit.kind !== b.hit.kind) return false;
      if (a.hit.kind === 'sky') return true;
      const gap = a.hit.p.distanceTo(b.hit.p);
      if (gap < 0.25 + 0.04 * Math.min(a.hit.dist, b.hit.dist)) return true;
      if (gap > 0.5 * Math.min(a.hit.dist, b.hit.dist)) return false;
      const m = at((a.t + b.t) / 2);
      if (!m || m.hit.kind !== a.hit.kind) return false;
      const seg = b.hit.p.clone().sub(a.hit.p);
      const w = m.hit.p.clone().sub(a.hit.p);
      const f = w.dot(seg) / seg.lengthSq();
      if (f < 0.1 || f > 0.9) return false;
      return w.sub(seg.multiplyScalar(f)).length() < 0.04 * m.hit.dist + 0.1;
    };
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (const sm of samples) {
      const prev = cur ? cur.samples[cur.samples.length - 1] : undefined;
      // walls and paving are cut at corners (each piece lies on one face)
      const corner = !!prev && (sm.hit.kind === 'wall' || sm.hit.kind === 'floor') && prev.hit.n.dot(sm.hit.n) < 0.9;
      const otherTree = !!prev && sm.hit.kind === 'tree' && prev.hit.id !== sm.hit.id;
      if (!cur || !prev || corner || otherTree || !continuous(prev, sm)) {
        cur = { kind: sm.hit.kind, samples: [sm], n: sm.hit.n.clone(), wind: sm.hit.wind ?? null };
        runs.push(cur);
      } else {
        cur.samples.push(sm);
        cur.n.add(sm.hit.n);
      }
    }
    for (const r of runs) r.n.normalize();
    if (runs.length > 7) {
      this.lastMiss = 'runs';
      return null;
    }
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
  /** what this run decided (exported by scripts/place-constellations.cjs) */
  readonly record: PlaceRecord = { signature: '', places: {}, decoys: {} };
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
    const grass = this.world.grass;
    const covered = grass.covered;
    grass.covered = (x, z, h) => covered(x, z, h) || this.bareAt(x, z);
    this.record.signature = this.worldSignature();
    const saved = SAVED_PLACES as unknown as PlaceRecord;
    const force = typeof location !== 'undefined' && new URLSearchParams(location.search).has('starsCompute');
    if (!force && saved.signature === this.record.signature && Object.keys(saved.places).length === CONSTELLATIONS.length) {
      // the island has not changed since the places were computed: just build them (fast)
      this.buildFromRecord(saved);
      this.ready = true;
      grass.invalidate();
      return;
    }
    if (!force && saved.signature) console.warn('constellation places are out of date: searching again in the background');
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
          this.caster = null; // (its memory is not needed any more)
          grass.invalidate();
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
    if (this.ready) return;
    if (!this.record.signature) this.record.signature = this.worldSignature();
    if (!this.placer) this.placer = this.placeSteps();
    while (!this.placer.next().done) { /* keep going */ }
    this.placer = null;
    this.ready = true;
    this.caster = null;
    this.world.grass.invalidate();
  }

  /** fingerprint of everything the placement depends on: terrain, solids, trees and the pictures */
  private worldSignature(): string {
    let h = 0x811c9dc5;
    const mix = (v: number) => {
      h = Math.imul(h ^ (Math.round(v * 20) | 0), 16777619) >>> 0;
    };
    for (let x = -540; x <= 540; x += 30) for (let z = -540; z <= 540; z += 30) mix(this.world.terrain.heightAt(x, z));
    mix(this.world.collision.fingerprint());
    // everything drawn that lines of sight can meet (positions and sizes; moving things only count)
    this.markScene();
    const scene = this.world.engine.scene;
    scene.updateMatrixWorld(true);
    const walk = (o: THREE.Object3D, cls: string | null) => {
      const tag = (o.userData?.castAs as string | undefined) ?? cls;
      if (tag === 'skip') return;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        mix(m.geometry.attributes.position?.count ?? 0);
        if (tag !== 'bad') {
          const el = m.matrixWorld.elements;
          mix(el[12]);
          mix(el[13]);
          mix(el[14]);
          const im = m as THREE.InstancedMesh;
          if (im.isInstancedMesh) {
            mix(im.count);
            const a = im.instanceMatrix.array;
            for (let i = 0; i < im.count; i++) {
              mix(a[i * 16 + 12]);
              mix(a[i * 16 + 13]);
              mix(a[i * 16 + 14]);
            }
          }
        }
      }
      for (const c of o.children) walk(c, tag);
    };
    walk(scene, null);
    for (const d of CONSTELLATIONS) {
      mix(d.stars.length);
      for (const st of d.stars) {
        mix(st.x);
        mix(st.z);
      }
      for (const t of d.threads) mix(t.a * 31 + t.b);
      mix(d.bell.x);
      mix(d.bell.z);
    }
    return h.toString(16) + '-v3-' + SPAN_DEG + '-' + SPOT_SPACING + '-' + SHIFT_MIN;
  }

  /** the decided places as JSON (written to src/data/constellation-places.json by the tool) */
  exportPlaces(): string {
    return JSON.stringify(this.record);
  }

  private basis(fwd: THREE.Vector3) {
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { right, up };
  }

  /** the directions of a picture's points from its spot (exactly as when it was placed) */
  private directions(def: ConstellationDef, fwd: THREE.Vector3): THREE.Vector3[] {
    const { right, up } = this.basis(fwd);
    const pts2 = [...def.stars.map((st) => [st.x, st.z]), [def.bell.x, def.bell.z]];
    const xs = def.stars.map((s) => s.x), zs = def.stars.map((s) => s.z);
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, mz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const maxR = Math.max(0.3, ...pts2.map((q) => Math.hypot(q[0] - mx, q[1] - mz)));
    const k = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG)) / maxR;
    return pts2.map(([x, z]) => fwd.clone().addScaledVector(right, (x - mx) * k).addScaledVector(up, -(z - mz) * k).normalize());
  }

  private runsFrom(eye: THREE.Vector3, dA: THREE.Vector3, dB: THREE.Vector3, stored: number[][]): Run[] {
    return stored.map((r) => {
      const kind = KINDS[r[0]];
      const n = new THREE.Vector3(r[1], r[2], r[3]).normalize();
      const wind: [number, number, number] | null = r[5] > 0 ? [r[4], r[5], r[6]] : null;
      const samples: Sample[] = [];
      for (let i = 7; i < r.length; i += 2) {
        const t = r[i], dist = r[i + 1];
        const dir = dA.clone().lerp(dB, t).normalize();
        samples.push({ t, dir, hit: { kind, p: eye.clone().addScaledVector(dir, dist), dist, n, wind } });
      }
      return { kind, samples, n, wind };
    });
  }

  /** Build every picture (and the decoys) from saved places, without searching. */
  private buildFromRecord(rec: PlaceRecord) {
    for (const def of CONSTELLATIONS) {
      const e = rec.places[def.id];
      if (!e) continue;
      const eye = new THREE.Vector3(e.e[0], e.e[1], e.e[2]);
      const fwd = new THREE.Vector3(e.f[0], e.f[1], e.f[2]).normalize();
      const dirs = this.directions(def, fwd);
      const hits: Hit[] = e.h.map(([k, d], i) => ({ kind: KINDS[k], p: eye.clone().addScaledVector(dirs[i], d), dist: d, n: dirs[i].clone().negate() }));
      const lines = def.threads.map((th, li) => this.runsFrom(eye, dirs[th.a], dirs[th.b], e.l[li]));
      this.spots.push({ x: eye.x, z: eye.z });
      this.build(def, def.area, eye, e.g, fwd, dirs, hits, lines);
      const count: Record<string, number> = {};
      for (const runs of lines) for (const r of runs) count[r.kind] = (count[r.kind] ?? 0) + r.samples.length;
      this.items[this.items.length - 1].drawnOn = count;
      this.record.places[def.id] = e;
    }
    for (const [area, list] of Object.entries(rec.decoys)) {
      const lines = list.map((d) => {
        const eye = new THREE.Vector3(d.e[0], d.e[1], d.e[2]);
        return { eye, runs: this.runsFrom(eye, new THREE.Vector3(d.a[0], d.a[1], d.a[2]), new THREE.Vector3(d.b[0], d.b[1], d.b[2]), d.l) };
      });
      this.addDecoyMesh(area as AreaId, lines);
    }
    this.record.decoys = rec.decoys;
  }

  private addDecoyMesh(area: AreaId, lines: { eye: THREE.Vector3; runs: Run[] }[]) {
    const solids: THREE.BufferGeometry[] = [];
    lines.forEach(({ eye, runs }, i) => {
      const res = this.dress([runs], area, eye, () => 1, () => 0, 7919 * (i + 1) + area.length, 0.035);
      if (res.solid) solids.push(res.solid);
    });
    if (!solids.length) return;
    const m = new THREE.Mesh(mergeGeometries(solids, false)!, this.decoyMat);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
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
        for (let pass = 0; pass < 6 && !done; pass++) {
          // (only places with standing room count as attempts: most random points are slopes or water)
          const tries = [900, 900, 1500, 6000, 8000, 14000][pass];
          let real = 0;
          for (let attempt = 0; real < tries && attempt < tries * 30 && !done; attempt++) {
            const ang = rnd() * Math.PI * 2;
            const wide = pass === 3 ? 2.1 : pass === 2 ? 1.5 : 1;
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
            if (pass >= 4) {
              // last: anywhere on the island where the scenery is rich enough
              base = { x: 0, z: 20 };
              r = Math.sqrt(rnd()) * 480;
            }
            const vx = base.x + Math.cos(ang) * r, vz = base.z + Math.sin(ang) * r;
            if (Math.hypot(vx, vz - 20) > 520) continue; // stay on the island
            if (this.okPoint(vx, vz) === null) {
              if (attempt % 25 === 0) yield;
              continue;
            }
            real++;
            done = this.tryPlace(def, area, vx, vz, rnd, pass);
            yield;
          }
        }
        if (!done) console.warn('constellation not placed', def.id);
      }
      this.scatterDecoys(area, center, rMin, rMax, defs.length * 4, rnd);
      yield;
    }
  }

  private tryPlace(def: ConstellationDef, area: AreaId, vx: number, vz: number, rnd: () => number, pass: number): boolean {
    const gy = this.okPoint(vx, vz);
    if (gy === null) return this.no('ground');
    if (Math.hypot(vx - SPIRE.x, vz - SPIRE.z) < 26) return this.no('spire'); // the Spire's island and landings
    if (area !== 'echo' && Math.hypot(vx - CALDERA.x, vz - CALDERA.z) < CALDERA.inner + 6) return this.no('crater');
    const spacing = SPOT_SPACING * (pass === 5 ? 0.6 : pass >= 3 ? 0.7 : 1);
    if (this.spots.some((v) => Math.hypot(v.x - vx, v.z - vz) < spacing)) return this.no('spacing');
    const eye = new THREE.Vector3(vx, gy + EYE_H, vz);
    if (this.world.forest.crownNear(eye, 2.2)) return this.no('crown');
    // look around from here and face the richest view: trees, walls, ruins and rocks rather than
    // bare ground, and no open sky (a quick 3×3 probe across the picture's extent per direction)
    let bestScore = -Infinity, yaw = 0, pitch = 0;
    const yaw0 = rnd() * Math.PI * 2;
    const tSpan = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG * 0.8));
    for (let yi = 0; yi < 8; yi++) {
      const yw = yaw0 + (yi / 8) * Math.PI * 2;
      for (const pd of pass >= 3 ? [-26, -18, -10, -2] : [-18, -10, -2, 6]) {
        const pt = THREE.MathUtils.degToRad(pd + (rnd() - 0.5) * 6);
        const f = new THREE.Vector3(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt));
        const rt = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
        const upv = new THREE.Vector3().crossVectors(rt, f).normalize();
        let score = 0;
        const depths: number[] = [];
        for (const [ax, ay] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const d = f.clone().addScaledVector(rt, ax * tSpan).addScaledVector(upv, ay * tSpan).normalize();
          const h = this.castRay(eye, d, 1.5, 50);
          if (!h || (h.kind !== 'sky' && h.dist < 3)) score -= 20;
          else if (h.kind === 'sky') score -= 6;
          else {
            depths.push(Math.log(h.dist));
            if (h.kind === 'tree' || h.kind === 'wall' || h.kind === 'rock') score += 3;
            else if (h.kind === 'floor') score += 1;
          }
        }
        // things at many different depths (near, middle, far): what lets the lines join from here only
        if (depths.length > 2) {
          const m = depths.reduce((a, b) => a + b, 0) / depths.length;
          score += 14 * Math.sqrt(depths.reduce((a, b) => a + (b - m) ** 2, 0) / depths.length);
        }
        score += rnd() * 2; // a little variety among equally good views
        if (score > bestScore) {
          bestScore = score;
          yaw = yw;
          pitch = pt;
        }
      }
    }
    if (bestScore < -10) return this.no('view');
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
      if (!h || h.kind === 'sky' || h.dist < 3) return this.no('corner');
      hits.push(h);
    }
    // a good frame: nothing big right in your face around the picture
    for (let kk = 0; kk < 12; kk++) {
      const a = (kk / 12) * Math.PI * 2;
      const t = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG * 1.3));
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * t).addScaledVector(up, Math.sin(a) * t).normalize();
      const h = this.ensureCaster().cast(eye, dir, 0.05, 4.5);
      if (h && h.cls !== 'terrain' && !(h.cls === 'static' && h.n.y > 0.6)) return this.no('frame');
    }
    if (!this.enterable(vx, vz, gy)) return this.no('enterable');
    // never on a panel: a crack across a panel would read as part of its puzzle
    for (const h of hits) if (h.kind === 'wall' && this.nearAnchor(h.p.x, h.p.z, h.p.y - 1.2)) return this.no('panel');
    if (this.taken.some((q) => hits.some((h) => h.kind !== 'sky' && q.distanceTo(h.p) < 1.2))) return this.no('taken');
    // now every line, through the scenery
    const lines: Run[][] = [];
    const count: Record<HitKind, number> = { ground: 0, floor: 0, wall: 0, tree: 0, rock: 0, sky: 0 };
    let total = 0;
    for (const th of def.threads) {
      const runs = this.traceLine(eye, dirs[th.a], dirs[th.b]);
      if (!runs) return this.no('trace:' + this.lastMiss);
      for (const r of runs) for (const s of r.samples) {
        count[s.hit.kind]++;
        total++;
        if (s.hit.kind === 'wall' && this.nearAnchor(s.hit.p.x, s.hit.p.z, s.hit.p.y - 1.2)) return this.no('panel2');
      }
      lines.push(runs);
    }
    // everywhere, not only on the ground; several kinds of scenery; the sky at most once, briefly
    // (one real-looking cloud carrying a short piece of one line — more than that gives it away)
    const onGround = (count.ground + count.floor) / total;
    const skyRuns = lines.flat().filter((r) => r.kind === 'sky');
    if (skyRuns.length > 1 || (skyRuns.length === 1 && skyRuns[0].samples.length > 5)) return this.no('sky');
    const kinds = (Object.keys(count) as HitKind[]).filter((kk) => kk !== 'sky' && count[kk] / total > 0.06).length;
    if (pass === 0 && (onGround > 0.55 || kinds < 3)) return this.no('mix0');
    if (pass >= 1 && (onGround > (pass >= 4 ? 0.72 : 0.65) || kinds < 2)) return this.no('mix' + Math.min(pass, 2));
    // anamorphic: the line pieces lie at very different depths, so they join only from here —
    // a couple of steps aside, the drawing must fall apart (not a picture painted on one wall)
    // (almost) every line is cut by jumps in depth, well inside it (not just at a tip): seen from
    // aside every line falls apart — never a picture painted on one wall, one tree or one field
    let split = 0;
    for (const runs of lines) {
      let from = 0, longest = 0;
      for (let i = 1; i < runs.length; i++) {
        const a = runs[i - 1].samples[runs[i - 1].samples.length - 1], b = runs[i].samples[0];
        if (Math.abs(a.hit.dist - b.hit.dist) > 0.15 * Math.min(a.hit.dist, b.hit.dist)) {
          const at = (a.t + b.t) / 2;
          longest = Math.max(longest, at - from);
          from = at;
        }
      }
      longest = Math.max(longest, 1 - from);
      if (longest <= 0.72) split++;
    }
    if (split < Math.ceil(def.threads.length * [0.75, 0.68, 0.6, 0.55, 0.5, 0.45][pass])) return this.no('breaks');
    const shift = this.shapeShift(eye, fwd, right, up, lines);
    if (shift < SHIFT_MIN) return this.no('shift');
    // last (the slowest check): the spot must be walkable-to from the rest of the island
    if (!this.connected(vx, vz, gy)) return this.no('connected');
    this.spots.push({ x: vx, z: vz });
    this.build(def, area, eye, gy, fwd, dirs, hits, lines);
    this.items[this.items.length - 1].drawnOn = { ...count };
    this.shifts.push(shift);
    this.record.places[def.id] = {
      e: [r2(eye.x), r2(eye.y), r2(eye.z)], g: r2(gy), f: [r5(fwd.x), r5(fwd.y), r5(fwd.z)],
      h: hits.map((h) => [KINDS.indexOf(h.kind), r2(h.dist)]),
      l: lines.map((runs) => runs.map(packRun)),
    };
    return true;
  }

  private lastWhy = '';
  private lastMiss = '';
  /** why places were turned down (tools) */
  readonly why: Record<string, number> = {};
  private no(reason: string): false {
    this.why[reason] = (this.why[reason] ?? 0) + 1;
    return false;
  }

  /** how much the drawing changes when seen from two steps to either side (0: not at all) */
  readonly shifts: number[] = [];
  private shapeShift(eye: THREE.Vector3, fwd: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, lines: Run[][]): number {
    const pts: THREE.Vector3[] = [];
    for (const runs of lines) for (const r of runs) for (const sm of r.samples) pts.push(sm.hit.p);
    const proj = (e: THREE.Vector3) => pts.map((q) => {
      const v = q.clone().sub(e);
      const z = Math.max(0.3, v.dot(fwd));
      return [v.dot(right) / z, v.dot(up) / z];
    });
    const A = proj(eye);
    let least = Infinity;
    for (const side of [-2.2, 2.2]) least = Math.min(least, shapeDifference(A, proj(eye.clone().addScaledVector(right, side))));
    return least;
  }

  /**
   * Turn traced lines into scenery: each run becomes a branch, ivy, a crack or a vine lying on its
   * surface (see dressing.ts); a piece in the sky becomes one small cloud.
   */
  private dress(
    lines: Run[][], area: AreaId, eye: THREE.Vector3, tOf: (line: number, t: number) => number, cutOf: (line: number, t: number) => number, seed: number, maxR = 0.1,
  ): { solid: THREE.BufferGeometry | null; puffs: { p: THREE.Vector3; size: number }[]; ranges: { solid: [number, number][]; cloud: [number, number][] }[] } {
    const b = new StrokeBuilder();
    const puffs: { p: THREE.Vector3; size: number }[] = [];
    const ranges = lines.map(() => ({ solid: [] as [number, number][], cloud: [] as [number, number][] }));
    const terrain = this.world.terrain;
    const ctx: DressCtx = {
      eye, heightAt: (x, z) => terrain.heightAt(x, z), rnd: rng(seed), maxR,
      stony: area === 'citadel' || area === 'echo' || area === 'mold', sandy: area === 'mosaic' || area === 'prologue',
    };
    lines.forEach((runs, li) => {
      const start = b.count;
      runs.forEach((run, ri) => {
        // the run's own samples, stretched half a step into its neighbours at its own depth, so
        // the pieces meet exactly as seen from the spot
        const ss = run.samples.map((sm) => ({ t: sm.t, dir: sm.dir, dist: sm.hit.dist }));
        const prevRun = runs[ri - 1], nextRun = runs[ri + 1];
        if (prevRun) {
          const a = prevRun.samples[prevRun.samples.length - 1], c0 = run.samples[0];
          ss.unshift({ t: (a.t + c0.t) / 2, dir: a.dir.clone().lerp(c0.dir, 0.5).normalize(), dist: c0.hit.dist });
        }
        if (nextRun) {
          const a = run.samples[run.samples.length - 1], c0 = nextRun.samples[0];
          ss.push({ t: (a.t + c0.t) / 2, dir: a.dir.clone().lerp(c0.dir, 0.5).normalize(), dist: a.hit.dist });
        }
        if (ss.length < 2) return;
        if (run.kind === 'sky') {
          for (const sm of ss) puffs.push({ p: eye.clone().addScaledVector(sm.dir, SKY_DIST), size: SKY_DIST * 0.03 });
          return;
        }
        const pts = ss.map((sm) => eye.clone().addScaledVector(sm.dir, sm.dist));
        const mid = pts[Math.floor(pts.length / 2)];
        const piece: Piece = {
          kind: run.kind, pts, dirs: ss.map((sm) => sm.dir), dists: ss.map((sm) => sm.dist),
          ts: ss.map((sm) => tOf(li, sm.t)), cuts: ss.map((sm) => cutOf(li, sm.t)), n: run.n,
          normals: run.kind === 'ground' ? pts.map((q) => terrain.normalAt(q.x, q.z, new THREE.Vector3())) : undefined,
          ground: run.kind === 'ground' ? terrain.surfaceAt(mid.x, mid.z) : undefined,
          wind: run.wind,
        };
        const lying = dressPiece(b, piece, ctx, [!!prevRun, !!nextRun]);
        if (lying && run.kind === 'ground') this.addBare(lying.pts, lying.r);
      });
      ranges[li].solid.push([start, b.count]);
    });
    return { solid: b.geometry(), puffs, ranges };
  }

  /** no grass over branches lying on the ground (it would hide them, and it looks right) */
  private addBare(pts: THREE.Vector3[], r: number[]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], rad = Math.max(r[i], r[i + 1]) + 0.3;
      const i0 = Math.floor((Math.min(a.x, b.x) - rad) / 4), i1 = Math.floor((Math.max(a.x, b.x) + rad) / 4);
      const j0 = Math.floor((Math.min(a.z, b.z) - rad) / 4), j1 = Math.floor((Math.max(a.z, b.z) + rad) / 4);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) continue;
      for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) {
        const k = (ii + 4096) * 8192 + (jj + 4096);
        let cell = this.bare.get(k);
        if (!cell) this.bare.set(k, (cell = []));
        cell.push(a.x, a.z, b.x, b.z, rad);
      }
    }
  }

  bareAt(x: number, z: number): boolean {
    const cell = this.bare.get((Math.floor(x / 4) + 4096) * 8192 + (Math.floor(z / 4) + 4096));
    if (!cell) return false;
    for (let i = 0; i < cell.length; i += 5) {
      const ax = cell[i], az = cell[i + 1], bx = cell[i + 2], bz = cell[i + 3], rad = cell[i + 4];
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz || 1e-9;
      const f = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const ex = ax + dx * f - x, ez = az + dz * f - z;
      if (ex * ex + ez * ez < rad * rad) return true;
    }
    return false;
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
    const dressed = this.dress(lines, area, eye, tOf, cutOf, Math.round(eye.x * 13 + eye.z * 7));
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
      center: centroid, radius: 3, starPos, lit: new THREE.Color('#ffd9a0'), blink: 0, bad: new Set(), badThreads: new Set(), dirty: true, near: false, alpha: 0, drawnOn: {},
    });
    const p = this.pending.get(def.id);
    if (p) {
      this.pending.delete(def.id);
      this.restore(def.id, p.s, p.solved, p.revealed);
    }
  }

  /** Roots, vines and cracks that draw nothing at all (the island is full of them). */
  private scatterDecoys(area: AreaId, center: { x: number; z: number }, rMin: number, rMax: number, count: number, rnd: () => number) {
    const lines: { eye: THREE.Vector3; runs: Run[] }[] = [];
    const rec: PlaceRecord['decoys'][string] = [];
    for (let attempt = 0; attempt < count * 12 && lines.length < count; attempt++) {
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
      const half = THREE.MathUtils.degToRad(1.5 + rnd() * 4.5);
      const dA = d.clone().addScaledVector(side, -Math.tan(half)).add(new THREE.Vector3(0, tilt * Math.tan(half), 0)).normalize();
      const dB = d.clone().addScaledVector(side, Math.tan(half)).add(new THREE.Vector3(0, -tilt * Math.tan(half), 0)).normalize();
      const runs = this.traceLine(eye, dA, dB);
      if (!runs) continue;
      const ground = runs.filter((rr) => rr.kind !== 'sky');
      if (!ground.length) continue;
      lines.push({ eye, runs: ground });
      rec.push({
        e: [r2(eye.x), r2(eye.y), r2(eye.z)], a: [r5(dA.x), r5(dA.y), r5(dA.z)], b: [r5(dB.x), r5(dB.y), r5(dB.z)],
        l: ground.map(packRun),
      });
    }
    this.record.decoys[area] = rec;
    this.addDecoyMesh(area, lines);
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
