/**
 * THE CONSTELLATIONS — the secret layer, hidden in plain sight.
 *
 * Each constellation is a handful of ordinary things scattered through the scenery: a shell on
 * the sand, a stone boss on a ruined wall, a jar on a terrace, a speck in the sky… They sit at
 * very different distances, so from almost everywhere they are just things that belong to the
 * place (and the same things lie around everywhere else for no reason at all).
 *
 * From ONE spot, looking in ONE direction, they line up into a figure. Stand exactly there and
 * keep looking: threads of light begin to draw themselves between them, faintly at first; hold
 * still for several seconds and the vision completes — the glyphs light up and a small orb
 * appears (ring it to check). The figure only makes sense from that spot, so that is where it is
 * solved. Never taught anywhere.
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
import { rng, simplex } from '../world/noise';
import { audio } from '../audio';

export const VAULT_THRESHOLD = 100;
/** the player's eye height (see Player.eye) */
const EYE_H = 1.62;
/** half-width of a figure as seen from its spot (degrees, centre to the farthest object) */
const SPAN_DEG = 24;
/** how close to the spot you must stand (metres) and how straight you must look (degrees) */
const SPOT_TOL = 0.42;
const LOOK_TOL = 4;
/** seconds of steady looking for the vision to complete */
const REVEAL_SECONDS = 6;
/** viewing spots this far apart at least: the figures are spread over the whole island */
const SPOT_SPACING = 16;
/** threads are this thin (radians) seen from the spot, whatever their distance */
const THREAD_W = 0.0062;

// ───────────────────────── per-place objects ─────────────────────────

interface Prop {
  /** non-glowing parts, already coloured (vertex colours), base at y = 0 */
  body: THREE.BufferGeometry;
  /** the part that lights up */
  glow: THREE.BufferGeometry;
  glowAt: number; // height of the glow part
  rest: string; // natural colour of the glow part (unlit)
  lit: string; // colour when lit
}

function colored(g: THREE.BufferGeometry, color: string, shade = true): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const c = new THREE.Color(color);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  for (let i = 0; i < pos.count; i++) {
    const t = shade && maxY > minY ? 0.72 + 0.35 * ((pos.getY(i) - minY) / (maxY - minY)) : 1;
    col.set([c.r * t, c.g * t, c.b * t], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function rock(r: number, flat: number, seed: number, color: string) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.22 * simplex.noise(v.x * 3 + seed, v.z * 3 + v.y));
    v.y *= flat;
    p.setXYZ(i, v.x, v.y + r * flat * 0.55, v.z);
  }
  g.computeVertexNormals();
  return colored(g, color);
}

function makeProp(area: AreaId, seed: number): Prop {
  const rnd = rng(seed);
  const j = (a: number, b: number) => a + rnd() * (b - a);
  switch (area) {
    case 'prologue': {
      // a spiral shell resting on a wet stone
      const body = rock(0.28, 0.45, seed, '#8f8a80');
      const shell = new THREE.ConeGeometry(0.11, 0.26, 9, 3);
      shell.rotateZ(Math.PI / 2.4);
      return { body, glow: shell, glowAt: 0.24, rest: '#efe2c8', lit: '#ffd9a0' };
    }
    case 'hub': {
      const body = colored(new THREE.CylinderGeometry(0.13, 0.17, 0.7, 10).translate(0, 0.35, 0), '#e3dccf');
      const dome = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      return { body, glow: dome, glowAt: 0.7, rest: '#cdd3d8', lit: '#fff0c8' };
    }
    case 'kinship': {
      // a fat forest mushroom
      const h = j(0.22, 0.38);
      const body = colored(new THREE.CylinderGeometry(0.05, 0.07, h, 8).translate(0, h / 2, 0), '#efe6d2');
      const cap = new THREE.SphereGeometry(j(0.14, 0.2), 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.75, 1);
      return { body, glow: cap, glowAt: h - 0.02, rest: '#b5432b', lit: '#ffb35a' };
    }
    case 'measure': {
      // bamboo stake with a little paper lamp
      const h = j(0.8, 1.0);
      const parts = [new THREE.CylinderGeometry(0.03, 0.035, h, 7).translate(0, h / 2, 0)];
      for (let k = 1; k < 4; k++) parts.push(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 7).translate(0, (h * k) / 4, 0));
      const body = colored(mergeGeometries(parts.map((p) => p.toNonIndexed()))!, '#7f9a46');
      const lamp = new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10);
      return { body, glow: lamp, glowAt: h + 0.06, rest: '#e9e2c6', lit: '#f2ffb8' };
    }
    case 'mold': {
      // a fallen marble offcut with a vein of light
      const s = j(0.3, 0.45);
      const body = colored(new THREE.BoxGeometry(s, s * 0.7, s * 0.9).translate(0, s * 0.3, 0).rotateY(rnd() * 3), '#e6dfd0');
      const vein = new THREE.BoxGeometry(s * 1.02, 0.04, s * 0.2);
      return { body, glow: vein, glowAt: s * 0.45, rest: '#c9b89a', lit: '#fff6e0' };
    }
    case 'contour': {
      // a little round shrub with one rose
      const r = j(0.24, 0.32);
      const body = colored(new THREE.IcosahedronGeometry(r, 1).translate(0, r, 0), '#3f7f3a');
      const rose = new THREE.DodecahedronGeometry(0.08, 0);
      return { body, glow: rose, glowAt: r * 2 - 0.02, rest: '#c93a4e', lit: '#ffd0dc' };
    }
    case 'mosaic': {
      // a clay jar; its mouth holds the light
      const pts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.2, 0.16), new THREE.Vector2(0.17, 0.34), new THREE.Vector2(0.09, 0.42), new THREE.Vector2(0.1, 0.48)];
      const body = colored(new THREE.LatheGeometry(pts, 14), '#b8693f');
      const mouth = new THREE.CircleGeometry(0.085, 12).rotateX(-Math.PI / 2);
      return { body, glow: mouth, glowAt: 0.47, rest: '#3a2418', lit: '#9ff6ff' };
    }
    case 'beacon': {
      // a rock holding a small tide pool
      const body = rock(0.42, 0.45, seed, '#7f7c76');
      const pool = new THREE.CircleGeometry(0.17, 14).rotateX(-Math.PI / 2);
      return { body, glow: pool, glowAt: 0.36, rest: '#2f5d6e', lit: '#ffe39a' };
    }
    case 'weave': {
      // a post with a spool of thread
      const body = colored(new THREE.CylinderGeometry(0.04, 0.05, 0.85, 7).translate(0, 0.42, 0), '#8a6342');
      const spool = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12);
      return { body, glow: spool, glowAt: 0.92, rest: '#8b6fc4', lit: '#e2d1ff' };
    }
    case 'twins': {
      // a stone pot with a lotus bud
      const pts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.2, 0.0), new THREE.Vector2(0.24, 0.22), new THREE.Vector2(0.22, 0.26)];
      const body = colored(new THREE.LatheGeometry(pts, 14), '#c9b9a8');
      const bud = new THREE.SphereGeometry(0.09, 10, 8).scale(1, 1.4, 1);
      return { body, glow: bud, glowAt: 0.36, rest: '#f1a7c6', lit: '#ffd1e6' };
    }
    case 'citadel': {
      // a small bronze brazier on a tripod: the coals catch fire
      const parts = [new THREE.CylinderGeometry(0.2, 0.12, 0.14, 12).translate(0, 0.62, 0)];
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        parts.push(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 5).rotateZ(0.25).rotateY(a).translate(Math.cos(a) * 0.08, 0.31, Math.sin(a) * 0.08));
      }
      const body = colored(mergeGeometries(parts.map((p) => p.toNonIndexed()))!, '#8a5d2c');
      const coals = new THREE.ConeGeometry(0.13, 0.2, 9);
      return { body, glow: coals, glowAt: 0.74, rest: '#2a1d18', lit: '#ffb070' };
    }
    case 'echo':
    default: {
      // a crystal shard
      const body = rock(0.22, 0.5, seed, '#3c3a4c');
      const shard = new THREE.OctahedronGeometry(0.12, 0).scale(0.8, 2.4, 0.8).rotateZ(j(-0.3, 0.3));
      return { body, glow: shard, glowAt: 0.38, rest: '#5a6a8a', lit: '#8ff6ff' };
    }
  }
}

/** Lit like everything else while unlit (so the objects blend in); glows once lit. */
function glowMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
  };
  return m;
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

/** what hangs in the trees of each place (berries, fruit, pods…), unlit colour */
const FRUIT: Partial<Record<AreaId, string>> = {
  prologue: '#8a6d4b', hub: '#a8452f', kinship: '#b8452b', measure: '#c9b25a', mold: '#9a8f7c', contour: '#7a2f45',
  mosaic: '#c98d3a', beacon: '#6b4a32', weave: '#b8793a', twins: '#e59bbd', citadel: '#5d4a3a', echo: '#4c5a78',
};

// a soft round speck for objects that sit in the sky
let dotTex: THREE.Texture | null = null;
function dotTexture(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// a thin ring that marks each object once the figure has been seen
let ringTex: THREE.Texture | null = null;
function ringTexture(): THREE.Texture {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  // a dark rim first so the ring reads on bright sky and grass alike
  ctx.strokeStyle = 'rgba(10,10,20,0.55)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(32, 32, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(255,240,210,0.9)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(32, 32, 22, 0, Math.PI * 2);
  ctx.stroke();
  ringTex = new THREE.CanvasTexture(c);
  return ringTex;
}

// ───────────────────────── threads ─────────────────────────

const threadVert = /* glsl */ `
attribute float aT; attribute vec3 color;
varying float vT; varying vec3 vC;
void main(){ vT = aT; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const threadFrag = /* glsl */ `
uniform float uReveal; uniform float uAlpha; uniform float uLit; varying float vT; varying vec3 vC;
void main(){
  if (vT > uReveal || uAlpha <= 0.001) discard;
  float head = smoothstep(uReveal - 0.08, uReveal, vT) * step(uReveal, 0.999);
  // unlit: a quiet ink line in the scenery; lit: light
  vec3 ink = vec3(0.30, 0.29, 0.36);
  gl_FragColor = vec4(mix(ink, vC * (1.0 + head * 3.0), uLit), uAlpha);
}`;

type HitKind = 'ground' | 'floor' | 'wall' | 'tree' | 'rock' | 'sky';
interface Hit {
  kind: HitKind;
  p: THREE.Vector3;
  dist: number;
}

export interface CItem {
  def: ConstellationDef;
  area: AreaId;
  group: THREE.Group;
  /** how each object glows: an instance of the area's prop, a boss on a wall, or a speck in the sky */
  vis: { kind: 'prop' | 'disc' | 'fruit' | 'sky'; idx: number }[];
  props: THREE.InstancedMesh | null;
  discs: THREE.InstancedMesh | null;
  fruits: THREE.InstancedMesh | null;
  /** each object's own colour while unlit (they blend into what they sit on) */
  restColors: THREE.Color[];
  specks: THREE.Sprite[];
  threads: THREE.Mesh;
  threadShadow: THREE.Mesh;
  threadU: { uReveal: { value: number }; uAlpha: { value: number }; uLit: { value: number } };
  threadRanges: [number, number][];
  sprites: THREE.Sprite[];
  /** a ring around each object, drawn with the threads */
  rings: THREE.Sprite[];
  orb: THREE.Mesh;
  orbBase: THREE.Vector3;
  state: Uint8Array;
  solved: boolean;
  revealed: boolean;
  /** 0..1: the threads drawing themselves out after the vision completes */
  reveal: number;
  /** 0..1: how far the vision has come while looking from the spot */
  hold: number;
  /** 0..1: how well the figure's points line up from where you stand (1 = on the spot, facing it) */
  seen: number;
  /** where to stand (feet), the eye there, and the way to look */
  view: { spot: THREE.Vector3; eye: THREE.Vector3; dir: THREE.Vector3 };
  center: THREE.Vector3;
  radius: number;
  starPos: THREE.Vector3[];
  rest: THREE.Color;
  lit: THREE.Color;
  blink: number;
  bad: Set<number>;
  badThreads: Set<number>;
  dirty: boolean;
  near: boolean;
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
  private bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  private glowMat = glowMaterial();
  private discGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14).rotateX(Math.PI / 2);
  private fruitGeo = new THREE.IcosahedronGeometry(0.1, 1);
  private spots: { x: number; z: number }[] = [];
  /** a veil over the world (drawn just before the figures) that dims it while a figure is in view */
  private veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float uOpacity; varying vec2 vUv; void main(){ float d = length(vUv - 0.5); gl_FragColor = vec4(0.015, 0.02, 0.05, uOpacity * (0.62 + 0.75 * d)); }',
      transparent: true, depthTest: false, depthWrite: false,
    }),
  );
  private taken: THREE.Vector3[] = [];
  private lastFwd = new THREE.Vector3();

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

  /** flat, free, dry ground off the paths (for props); `onPath` also accepts paths (for standing spots) */
  private okPoint(x: number, z: number, onPath = false): number | null {
    const g = this.groundAt(x, z);
    if (!isFinite(g)) return null;
    if (g < this.world.waterAt(x, z) + 0.15) return null;
    if (g < 1.2) return null;
    const d = 0.9;
    for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (Math.abs(this.groundAt(x + dx, z + dz) - g) > 0.5) return null;
    if (this.world.collision.blockedAt(x, z, 0.8, g + 0.2, g + 1.6)) return null;
    const onFloor = g > this.world.terrain.heightAt(x, z) + 0.05;
    if (!onPath && !onFloor && this.world.terrain.pathAt(x, z) > 0.3) return null;
    return g;
  }

  /**
   * Can someone walk onto this spot from its surroundings? (Rules out the top of a tall block, a
   * ledge or a pit.) Walks in from eight directions with the player's own movement rule.
   */
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

  /**
   * Is the spot connected on foot to the rest of the island? Walks out from it (the player's own
   * movement rule, 1 m steps, up to ~30 m) until it meets a path or a panel's standing place.
   */
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

  /** where a line of sight from the spot first meets the scenery */
  private castRay(eye: THREE.Vector3, dir: THREE.Vector3, tMin: number, tMax: number): Hit | null {
    const col = this.world.collision;
    const p = new THREE.Vector3();
    let t = tMin;
    // tree crowns and rocks are part of the scenery too
    const veg = this.world.forest.raycast(eye, dir, tMax);
    const vegT = veg && veg.t > tMin ? veg.t : Infinity;
    p.copy(eye).addScaledVector(dir, t);
    if (p.y <= this.world.terrain.heightAt(p.x, p.z) || col.blockedAt(p.x, p.z, 0.04, p.y - 0.04, p.y + 0.04)) return null;
    while (t < tMax) {
      const step = t < 14 ? 0.22 : 0.45;
      t += step;
      if (t >= vegT) {
        const back = veg!.kind === 'tree' ? 0.12 : 0.06;
        return { kind: veg!.kind, p: eye.clone().addScaledVector(dir, vegT - back), dist: vegT - back };
      }
      p.copy(eye).addScaledVector(dir, t);
      const terr = this.world.terrain.heightAt(p.x, p.z);
      if (p.y <= terr) {
        if (terr < this.world.waterAt(p.x, p.z) + 0.05) return null; // into the water
        return { kind: 'ground', p: new THREE.Vector3(p.x, terr, p.z), dist: t };
      }
      const [g, surf] = col.groundAt(p.x, p.z, p.y + 0.01);
      if (surf !== null && p.y - g < step * Math.abs(dir.y) + 0.04) return { kind: 'floor', p: new THREE.Vector3(p.x, g, p.z), dist: t };
      if (col.blockedAt(p.x, p.z, 0.04, p.y - 0.04, p.y + 0.04)) {
        const q = eye.clone().addScaledVector(dir, t - 0.12);
        return { kind: 'wall', p: q, dist: t - 0.12 };
      }
    }
    return { kind: 'sky', p: eye.clone().addScaledVector(dir, 420), dist: 420 };
  }

  private region(area: AreaId): { center: { x: number; z: number }; rMin: number; rMax: number } {
    // each place keeps its figures, but they spread over its whole surroundings, wild parts included
    if (area === 'prologue') return { center: { x: 0, z: 300 }, rMin: 0, rMax: 62 };
    if (area === 'echo') return { center: { x: CALDERA.x, z: CALDERA.z }, rMin: 10, rMax: 50 };
    if (area === 'citadel') return { center: { x: CITADEL.x, z: CITADEL.z - 10 }, rMin: 0, rMax: 75 };
    if (area === 'hub') return { center: ANCHORS.hub, rMin: 26, rMax: 120 };
    return { center: ANCHORS[area], rMin: 0, rMax: (AREA_RADIUS[area] ?? 80) + 60 };
  }

  place() {
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
        // strict first (objects at very different depths, some off the ground), then relaxed, then wider
        for (let pass = 0; pass < 4 && !done; pass++) {
          for (let attempt = 0; attempt < (pass === 3 ? 1600 : 260) && !done; attempt++) {
            const ang = rnd() * Math.PI * 2;
            const wide = pass >= 2 ? 1.6 : 1;
            let r = rMin + Math.sqrt(rnd()) * (rMax - rMin) * wide;
            let base = center;
            if (pass === 2 && area === 'citadel' && attempt % 2) base = { x: NORTH_LANDING.x, z: NORTH_LANDING.z + 20 };
            if (pass >= 2 && area === 'echo' && attempt % 2) {
              // the caldera is cramped: its outer slopes belong to the hollow too
              base = { x: CALDERA.x, z: CALDERA.z };
              r = 70 + rnd() * (pass === 3 ? 90 : 45);
            }
            const vx = base.x + Math.cos(ang) * r, vz = base.z + Math.sin(ang) * r;
            if (Math.hypot(vx, vz - 20) > 520) continue; // stay on the island
            done = this.tryPlace(def, area, vx, vz, rnd, pass);
          }
        }
        if (!done) console.warn('constellation not placed', def.id);
      }
      const nStars = defs.reduce((a, d) => a + d.stars.length, 0);
      this.scatterDecoys(area, center, rMin, rMax, Math.round(nStars * 0.8), rnd);
    }
  }

  private tryPlace(def: ConstellationDef, area: AreaId, vx: number, vz: number, rnd: () => number, pass: number): boolean {
    const gy = this.okPoint(vx, vz, true);
    if (gy === null) return false;
    // not on the Sky Spire: its landings only exist once the stair of light is lit
    if (Math.hypot(vx - SPIRE.x, vz - SPIRE.z) < 26) return false; // the Spire's island and landings
    // the crater floor belongs to the Resonant Hollow alone
    if (area !== 'echo' && Math.hypot(vx - CALDERA.x, vz - CALDERA.z) < CALDERA.inner + 6) return false;
    // (in the last, most relaxed pass a crowded place may keep its figures a little closer)
    const spacing = pass === 3 ? SPOT_SPACING * 0.7 : SPOT_SPACING;
    if (this.spots.some((v) => Math.hypot(v.x - vx, v.z - vz) < spacing)) return false;
    if (!this.enterable(vx, vz, gy)) return false;
    const eye = new THREE.Vector3(vx, gy + EYE_H, vz);
    // a clear place to stand: no branches in your face
    if (this.world.forest.crownNear(eye, 2.2)) return false;
    const yaw = rnd() * Math.PI * 2;
    const pitch = THREE.MathUtils.degToRad(-11 + rnd() * 25);
    const fwd = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // the figure's layout, centred and scaled to the angle it covers from the spot
    const pts2 = [...def.stars.map((st) => [st.x, st.z]), [def.bell.x, def.bell.z]];
    const mx = pts2.reduce((a, q) => a + q[0], 0) / pts2.length, mz = pts2.reduce((a, q) => a + q[1], 0) / pts2.length;
    const maxR = Math.max(0.3, ...pts2.map((q) => Math.hypot(q[0] - mx, q[1] - mz)));
    const k = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG)) / maxR;
    const hits: Hit[] = [];
    for (const [x, z] of pts2) {
      const dir = fwd.clone().addScaledVector(right, (x - mx) * k).addScaledVector(up, -(z - mz) * k).normalize();
      const h = this.castRay(eye, dir, 3.2, 46);
      if (!h) return false;
      hits.push(h);
    }
    // a good frame: nothing big right in your face around the figure (a wall, a trunk, a rock)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const t = Math.tan(THREE.MathUtils.degToRad(SPAN_DEG * 1.35));
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * t).addScaledVector(up, Math.sin(a) * t).normalize();
      const h = this.castRay(eye, dir, 0.4, 4.5);
      if (h && (h.kind === 'wall' || h.kind === 'tree' || h.kind === 'rock')) return false;
    }
    const stars = hits.slice(0, -1);
    const offGround = stars.filter((h) => h.kind !== 'ground').length;
    const near = stars.filter((h) => h.kind !== 'sky').map((h) => h.dist);
    const spread = near.length ? Math.max(...near) / Math.max(0.5, Math.min(...near)) : 1;
    const skies = stars.filter((h) => h.kind === 'sky').length;
    if (skies > Math.max(1, stars.length / 3)) return false; // mostly in the scenery, not the sky
    // everywhere, not only on the ground: most points sit in trees, on rocks, walls, ruins, decks or the sky
    if (pass === 0 && (offGround < Math.ceil(stars.length * 0.55) || spread < 2.2)) return false;
    if (pass === 1 && (offGround < Math.ceil(stars.length * 0.4) || spread < 1.8)) return false;
    if (pass === 2 && offGround < Math.ceil(stars.length * 0.25)) return false;
    if (pass === 3 && offGround < 1 && stars.length > 3) return false;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (h.kind === 'sky') continue;
      if (h.p.distanceTo(eye) < 3) return false;
      // never on a panel (they are solid too): a boss on a panel would read as part of the puzzle
      if (h.kind === 'wall' && this.nearAnchor(h.p.x, h.p.z, h.p.y - 1.2)) return false;
      if (this.taken.some((q) => q.distanceTo(h.p) < 1.1)) return false;
      if ((h.kind === 'ground' || h.kind === 'floor') && this.world.terrain.pathAt(h.p.x, h.p.z) > 0.35 && h.kind === 'ground') return false;
      for (let j = 0; j < i; j++) if (hits[j].kind !== 'sky' && hits[j].p.distanceTo(h.p) < 0.45) return false;
    }
    // last (the slowest check): the spot must be walkable-to from the rest of the island
    if (!this.connected(vx, vz, gy)) return false;
    this.spots.push({ x: vx, z: vz });
    this.build(def, area, eye, gy, fwd, hits);
    return true;
  }

  private build(def: ConstellationDef, area: AreaId, eye: THREE.Vector3, gy: number, fwd: THREE.Vector3, hits: Hit[]) {
    const g = new THREE.Group();
    const n = def.stars.length;
    const starPos: THREE.Vector3[] = [];
    const bodies: THREE.BufferGeometry[] = [];
    const vis: CItem['vis'] = [];
    const propMats: THREE.Matrix4[] = [];
    const discMats: THREE.Matrix4[] = [];
    const fruitMats: THREE.Matrix4[] = [];
    const specks: THREE.Sprite[] = [];
    const restColors: THREE.Color[] = [];
    const sample = makeProp(area, 1);
    let rest = new THREE.Color(sample.rest), lit = new THREE.Color(sample.lit);
    for (let i = 0; i < n; i++) {
      const h = hits[i];
      if (h.kind === 'ground' || h.kind === 'floor') {
        const { x, z } = h.p;
        const y = h.p.y;
        const prop = makeProp(area, Math.round(x * 13 + z * 7) + i);
        rest = new THREE.Color(prop.rest);
        lit = new THREE.Color(prop.lit);
        const rot = (x * 1.7 + z) % (Math.PI * 2);
        bodies.push(prop.body.clone().rotateY(rot).translate(x, y, z));
        propMats.push(new THREE.Matrix4().makeRotationY(rot).setPosition(x, y + prop.glowAt, z));
        vis.push({ kind: 'prop', idx: propMats.length - 1 });
        restColors.push(new THREE.Color(prop.rest));
        starPos.push(new THREE.Vector3(x, y + prop.glowAt, z));
        this.world.collision.addBlocker({ x, z, r: 0.14, y0: y - 1, y1: y + prop.glowAt + 0.2 });
        this.world.forest.removeNear(x, z, 0.5);
      } else if (h.kind === 'tree') {
        // something hanging in the crown: a cluster of berries / fruit / pods, the biggest one glows
        const fc = FRUIT[area] ?? '#a8452f';
        fruitMats.push(new THREE.Matrix4().setPosition(h.p));
        vis.push({ kind: 'fruit', idx: fruitMats.length - 1 });
        restColors.push(new THREE.Color(fc));
        for (const [ox, oy, oz] of [[0.11, -0.06, 0.02], [-0.09, -0.08, -0.04]]) {
          bodies.push(colored(new THREE.IcosahedronGeometry(0.07, 1).translate(h.p.x + ox, h.p.y + oy, h.p.z + oz), fc, false));
        }
        bodies.push(colored(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4).translate(h.p.x, h.p.y + 0.13, h.p.z), '#4a3a2a', false));
        starPos.push(h.p.clone());
      } else if (h.kind === 'rock') {
        // a round patch of lichen on the rock, facing the spot
        const m = new THREE.Matrix4().lookAt(h.p, eye, new THREE.Vector3(0, 1, 0)).setPosition(h.p).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
        discMats.push(m);
        vis.push({ kind: 'disc', idx: discMats.length - 1 });
        restColors.push(new THREE.Color('#9aa36a'));
        starPos.push(h.p.clone());
      } else if (h.kind === 'wall') {
        // a round boss set into the wall, facing the spot
        const m = new THREE.Matrix4().lookAt(h.p, eye, new THREE.Vector3(0, 1, 0)).setPosition(h.p);
        // three's lookAt(eye, target) points -Z at the target; the disc faces +Z: flip it
        m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
        const rim = new THREE.TorusGeometry(0.12, 0.035, 6, 16).applyMatrix4(m);
        bodies.push(colored(rim, '#8d8578', false));
        discMats.push(m);
        vis.push({ kind: 'disc', idx: discMats.length - 1 });
        restColors.push(new THREE.Color('#9b9284'));
        starPos.push(h.p.clone());
      } else {
        // barely there until the vision completes: a speck you would take for a far bird or a star
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
        sp.position.copy(h.p);
        sp.scale.setScalar(h.dist * 0.0048);
        g.add(sp);
        specks.push(sp);
        vis.push({ kind: 'sky', idx: specks.length - 1 });
        restColors.push(new THREE.Color('#ffffff'));
        starPos.push(h.p.clone());
      }
      if (def.stars[i].lock !== undefined && h.kind !== 'sky') {
        // a small iron nail beside it marks the ones that never change
        bodies.push(colored(new THREE.ConeGeometry(0.03, 0.3, 6).translate(starPos[i].x + 0.2, starPos[i].y - 0.05, starPos[i].z), '#2c2a2a'));
      }
      if (h.kind !== 'sky') this.taken.push(h.p.clone());
    }
    const merged = bodies.length ? mergeGeometries(bodies.map((b) => (b.index ? b.toNonIndexed() : b)), false) : null;
    if (merged) {
      const bm = new THREE.Mesh(merged, this.bodyMat);
      bm.castShadow = true;
      bm.receiveShadow = true;
      g.add(bm);
    }
    const mkInst = (geo: THREE.BufferGeometry, mats: THREE.Matrix4[]) => {
      if (!mats.length) return null;
      const gg = geo.clone();
      gg.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(mats.length), 1));
      const im = new THREE.InstancedMesh(gg, this.glowMat, mats.length);
      mats.forEach((m, i) => {
        im.setMatrixAt(i, m);
        im.setColorAt(i, rest);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true;
      g.add(im);
      return im;
    };
    const props = mkInst(sample.glow, propMats);
    const discs = mkInst(this.discGeo, discMats);
    const fruits = mkInst(this.fruitGeo, fruitMats);
    // threads: straight between the objects; widened with distance so from the spot they all look thin
    const tPos: number[] = [];
    const tCol: number[] = [];
    const tT: number[] = [];
    const ranges: [number, number][] = [];
    const nT = def.threads.length;
    const side = new THREE.Vector3();
    const toEye = new THREE.Vector3();
    def.threads.forEach((t, ti) => {
      const a = starPos[t.a], b = starPos[t.b];
      const start = tPos.length / 3;
      const seg = 14;
      const pieces: [number, number][] = t.mark === 'diff' ? [[0.04, 0.42], [0.58, 0.96]] : [[0.04, 0.96]];
      for (const [u0, u1] of pieces) {
        for (let kk = 0; kk < seg; kk++) {
          const ua = u0 + ((u1 - u0) * kk) / seg, ub = u0 + ((u1 - u0) * (kk + 1)) / seg;
          const p0 = new THREE.Vector3().lerpVectors(a, b, ua), p1 = new THREE.Vector3().lerpVectors(a, b, ub);
          const dir = p1.clone().sub(p0).normalize();
          const w0 = p0.distanceTo(eye) * THREAD_W, w1 = p1.distanceTo(eye) * THREAD_W;
          side.crossVectors(dir, toEye.copy(p0).sub(eye).normalize()).normalize();
          const q = [p0.clone().addScaledVector(side, -w0), p0.clone().addScaledVector(side, w0), p1.clone().addScaledVector(side, w1), p1.clone().addScaledVector(side, -w1)];
          const qu = [ua, ua, ub, ub];
          for (const idx of [0, 1, 2, 0, 2, 3]) {
            tPos.push(q[idx].x, q[idx].y, q[idx].z);
            tT.push((ti + qu[idx]) / nT);
          }
        }
      }
      if (t.mark === 'same') {
        // a knot: a small diamond in the middle of the thread
        const m = new THREE.Vector3().lerpVectors(a, b, 0.5);
        const r = m.distanceTo(eye) * THREAD_W * 3.2;
        const dir = b.clone().sub(a).normalize();
        side.crossVectors(dir, toEye.copy(m).sub(eye).normalize()).normalize();
        const q = [m.clone().addScaledVector(dir, -r), m.clone().addScaledVector(side, r), m.clone().addScaledVector(dir, r), m.clone().addScaledVector(side, -r)];
        for (const idx of [0, 1, 2, 0, 2, 3]) {
          tPos.push(q[idx].x, q[idx].y, q[idx].z);
          tT.push((ti + 0.5) / nT);
        }
      }
      const end = tPos.length / 3;
      ranges.push([start, end]);
      for (let v = start; v < end; v++) tCol.push(1.25, 1.2, 1.45);
    });
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
    tg.setAttribute('aT', new THREE.Float32BufferAttribute(tT, 1));
    const threadU = { uReveal: { value: 1 }, uAlpha: { value: 0 }, uLit: { value: 0 } };
    // a soft dark band under each thread keeps it readable against bright sky or sand
    const shadowGeo = tg.clone();
    {
      const pa = shadowGeo.attributes.position as THREE.BufferAttribute;
      const pb = tg.attributes.position as THREE.BufferAttribute;
      // widen each quad around its centre line (vertices come in pairs across the ribbon)
      for (let i = 0; i < pa.count; i += 6) {
        const idx = [0, 1, 2, 0, 2, 3];
        const q: THREE.Vector3[] = [];
        for (let k = 0; k < 6; k++) q[idx[k]] = new THREE.Vector3().fromBufferAttribute(pb, i + k);
        const m01 = q[0].clone().add(q[1]).multiplyScalar(0.5), m32 = q[3].clone().add(q[2]).multiplyScalar(0.5);
        const w = [q[0].clone().sub(m01).multiplyScalar(2.4).add(m01), q[1].clone().sub(m01).multiplyScalar(2.4).add(m01), q[2].clone().sub(m32).multiplyScalar(2.4).add(m32), q[3].clone().sub(m32).multiplyScalar(2.4).add(m32)];
        for (let k = 0; k < 6; k++) pa.setXYZ(i + k, w[idx[k]].x, w[idx[k]].y, w[idx[k]].z);
      }
    }
    const shadowMat = new THREE.ShaderMaterial({
      uniforms: threadU, vertexShader: threadVert,
      fragmentShader: threadFrag.replace('gl_FragColor = vec4(mix(ink, vC * (1.0 + head * 3.0), uLit), uAlpha);', 'gl_FragColor = vec4(0.02, 0.02, 0.05, uAlpha * (0.4 + 0.2 * uLit));'),
      side: THREE.DoubleSide, toneMapped: false, transparent: true, depthTest: false, depthWrite: false,
    });
    const threadShadow = new THREE.Mesh(shadowGeo, shadowMat);
    threadShadow.frustumCulled = false;
    threadShadow.renderOrder = 19;
    threadShadow.visible = false;
    g.add(threadShadow);
    const threads = new THREE.Mesh(tg, new THREE.ShaderMaterial({
      uniforms: threadU, vertexShader: threadVert, fragmentShader: threadFrag, side: THREE.DoubleSide, toneMapped: false,
      transparent: true, depthTest: false, depthWrite: false,
    }));
    threads.frustumCulled = false;
    threads.renderOrder = 20;
    threads.visible = false;
    g.add(threads);
    // glyphs: sized by distance so they all look the same from the spot
    const sprites: THREE.Sprite[] = [];
    def.stars.forEach((st, i) => {
      if (!st.glyph) return;
      const d = starPos[i].distanceTo(eye);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(st.glyph), depthWrite: false, depthTest: false, transparent: true, opacity: 0, fog: false }));
      const toE = eye.clone().sub(starPos[i]).normalize();
      sp.position.copy(starPos[i]).addScaledVector(toE, 0.05).add(new THREE.Vector3(0, d * 0.022, 0));
      sp.scale.setScalar(d * 0.028);
      sp.renderOrder = 21;
      sp.visible = false;
      g.add(sp);
      sprites.push(sp);
    });
    const rings = starPos.map((p) => {
      const d = p.distanceTo(eye);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), color: 0xfff1d6, depthWrite: false, depthTest: false, transparent: true, opacity: 0, fog: false, toneMapped: false }));
      sp.position.copy(p);
      sp.scale.setScalar(d * 0.05);
      sp.renderOrder = 21;
      sp.visible = false;
      g.add(sp);
      return sp;
    });
    // the orb (rung to check) appears where the figure says
    const orbHit = hits[n];
    const orbBase = orbHit.kind === 'sky' ? eye.clone().addScaledVector(orbHit.p.clone().sub(eye).normalize(), 18) : orbHit.p.clone().add(new THREE.Vector3(0, 0.35, 0));
    const od = orbBase.distanceTo(eye);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(0.12, od * 0.012), 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.65, 1.3), toneMapped: false, transparent: true, opacity: 0.95, depthTest: false, fog: false }));
    orb.renderOrder = 22;
    orb.position.copy(orbBase);
    orb.visible = false;
    orb.userData.bell = true;
    g.add(orb);
    this.group.add(g);
    const centroid = starPos.filter((_, i) => hits[i].kind !== 'sky').reduce((acc, q) => acc.add(q), new THREE.Vector3());
    const nonSky = starPos.filter((_, i) => hits[i].kind !== 'sky').length;
    if (nonSky) centroid.multiplyScalar(1 / nonSky);
    else centroid.copy(eye);
    this.items.push({
      def, area, group: g, vis, props, discs, fruits, restColors, specks, threads, threadShadow, threadU, threadRanges: ranges, sprites, rings, orb, orbBase,
      state: initialState(def), solved: false, revealed: false, reveal: 1, hold: 0, seen: 0,
      view: { spot: new THREE.Vector3(eye.x, gy, eye.z), eye: eye.clone(), dir: fwd.clone() },
      center: centroid, radius: 3, starPos, rest, lit, blink: 0, bad: new Set(), badThreads: new Set(), dirty: true, near: false,
    });
  }

  /** The same objects (and stone bosses on walls), scattered for no reason at all. */
  private scatterDecoys(area: AreaId, center: { x: number; z: number }, rMin: number, rMax: number, count: number, rnd: () => number) {
    const parts: THREE.BufferGeometry[] = [];
    let made = 0;
    for (let attempt = 0; attempt < count * 40 && made < count; attempt++) {
      const ang = rnd() * Math.PI * 2;
      const r = rMin + Math.sqrt(rnd()) * (rMax - rMin);
      const cx = center.x + Math.cos(ang) * r, cz = center.z + Math.sin(ang) * r;
      if (Math.hypot(cx, cz - 20) > 520) continue;
      if (rnd() < 0.55) {
        // whatever a random glance meets: a boss on a wall, fruit in a tree, lichen on a rock
        const y0 = this.groundAt(cx, cz);
        if (!isFinite(y0)) continue;
        const eye = new THREE.Vector3(cx, y0 + EYE_H, cz);
        const a2 = rnd() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.sin(a2), -0.15 + rnd() * 0.6, Math.cos(a2)).normalize();
        const h = this.castRay(eye, dir, 2, 26);
        if (!h || h.kind === 'ground' || h.kind === 'floor' || h.kind === 'sky' || this.taken.some((q) => q.distanceTo(h.p) < 1.5)) continue;
        const m = new THREE.Matrix4().lookAt(h.p, eye, new THREE.Vector3(0, 1, 0)).setPosition(h.p).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
        if (h.kind === 'wall') {
          parts.push(colored(new THREE.TorusGeometry(0.12, 0.035, 6, 16).applyMatrix4(m), '#8d8578', false));
          parts.push(colored(this.discGeo.clone().applyMatrix4(m), '#9b9284', false));
        } else if (h.kind === 'rock') {
          parts.push(colored(this.discGeo.clone().applyMatrix4(m), '#9aa36a', false));
        } else {
          const fc = FRUIT[area] ?? '#a8452f';
          parts.push(colored(this.fruitGeo.clone().translate(h.p.x, h.p.y, h.p.z), fc, false));
          for (const [ox, oy, oz] of [[0.11, -0.06, 0.02], [-0.09, -0.08, -0.04]]) parts.push(colored(new THREE.IcosahedronGeometry(0.07, 1).translate(h.p.x + ox, h.p.y + oy, h.p.z + oz), fc, false));
        }
        made++;
        continue;
      }
      const k = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < k && made < count; i++) {
        const x = cx + (rnd() - 0.5) * 4, z = cz + (rnd() - 0.5) * 4;
        const y = this.okPoint(x, z);
        if (y === null || this.taken.some((q) => Math.hypot(q.x - x, q.z - z) < 1.2)) continue;
        const prop = makeProp(area, Math.round(x * 31 + z * 17) + i * 7);
        const rot = rnd() * Math.PI * 2;
        parts.push(prop.body.clone().rotateY(rot).translate(x, y, z));
        parts.push(colored(prop.glow.clone(), prop.rest, false).rotateY(rot).translate(x, y + prop.glowAt, z));
        this.world.collision.addBlocker({ x, z, r: 0.14, y0: y - 1, y1: y + prop.glowAt + 0.2 });
        this.world.forest.removeNear(x, z, 0.4);
        made++;
      }
    }
    if (!parts.length) return;
    const merged = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)), false);
    if (!merged) return;
    const m = new THREE.Mesh(merged, this.bodyMat);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  // ───────────────────────── seeing ─────────────────────────

  /**
   * Called every frame while walking. Standing on a figure's spot and looking its way, steadily,
   * draws it out of the scenery: faint at first, complete after REVEAL_SECONDS.
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
        continue;
      }
      const dh = Math.hypot(cam.x - it.view.eye.x, cam.z - it.view.eye.z);
      const dv = Math.abs(cam.y - it.view.eye.y);
      const ang = THREE.MathUtils.radToDeg(fwd.angleTo(it.view.dir));
      const aligned = dh < SPOT_TOL && dv < 0.45 && ang < LOOK_TOL;
      // seen from the right place the figure is there in the scenery, unlit: it sharpens as you
      // step onto the spot and face it, and is gone a step or two away
      const place = THREE.MathUtils.clamp(1 - (dh - SPOT_TOL) / 0.9, 0, 1);
      const facing = THREE.MathUtils.clamp(1 - (ang - LOOK_TOL) / 8, 0, 1);
      const seen = Math.pow(place * facing, 1.6) * (dv < 0.6 ? 1 : 0);
      if (Math.abs(seen - it.seen) > 1e-3) {
        it.seen = seen;
        it.dirty = true;
      }
      let alpha: number, lit: number;
      if (this.blaze) {
        alpha = 0.9;
        lit = 1;
      } else if (it.revealed) {
        alpha = THREE.MathUtils.clamp(1 - (dh - 1.2) / 2.2, 0, 1) * THREE.MathUtils.clamp(1 - (ang - 25) / 25, 0, 1);
        lit = 1;
      } else {
        const before = it.hold;
        if (this.holdPaused) {
          /* keep it */
        } else if (aligned && steady) it.hold = Math.min(1, it.hold + dt / REVEAL_SECONDS);
        else it.hold = Math.max(0, it.hold - dt * (aligned ? 0.15 : 0.5));
        if (it.hold !== before) it.dirty = true;
        // before it lights there are only the points; the lines draw themselves, already lit,
        // one after another while you keep looking
        alpha = it.hold > 0.002 ? Math.min(1, 0.35 + it.hold) : 0;
        lit = 1;
        if (it.hold >= 1) {
          it.revealed = true;
          it.reveal = 0;
          it.dirty = true;
          audio.panelPowered();
          this.onRevealed(it);
        }
      }
      if (Math.abs(alpha - it.threadU.uAlpha.value) > 1e-3 || Math.abs(lit - it.threadU.uLit.value) > 1e-3) {
        it.threadU.uAlpha.value = alpha;
        it.threadU.uLit.value = lit;
        it.threads.visible = it.threadShadow.visible = alpha > 0.002;
      }
      if (!this.blaze) focus = Math.max(focus, alpha * lit);
    }
    // the world quietly dims as a figure lights up
    const veil = this.veil.material as THREE.ShaderMaterial;
    const target = 0.42 * Math.min(1, focus * 1.15);
    const cur = veil.uniforms.uOpacity.value as number;
    veil.uniforms.uOpacity.value = cur + (target - cur) * Math.min(1, dt * 3);
    this.veil.visible = veil.uniforms.uOpacity.value > 0.004;
  }

  // ───────────────────────── interaction ─────────────────────────

  /** what the crosshair (or, on touch, the finger at `ndc`) points at — from the figure's spot */
  private raycaster = new THREE.Raycaster();
  aim(camera: THREE.Camera, ndc = new THREE.Vector2(0, 0)): CTarget | null {
    const ray = this.raycaster;
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let best: CTarget | null = null;
    let bestA = THREE.MathUtils.degToRad(1.7);
    const v = new THREE.Vector3();
    for (const it of this.items) {
      if (!it.near || !it.revealed) continue;
      if (Math.hypot(o.x - it.view.eye.x, o.z - it.view.eye.z) > 2.2) continue;
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
    if (!it) return;
    it.state = initialState(it.def);
    if (s && s.length === it.state.length) for (let i = 0; i < s.length; i++) if (it.def.stars[i].lock === undefined) it.state[i] = s[i] === '1' ? 1 : 0;
    it.solved = solved;
    it.revealed = revealed || solved;
    it.reveal = 1;
    it.hold = it.revealed ? 1 : 0;
    it.dirty = true;
  }

  stateOf(it: CItem) {
    return stateString(it.state);
  }

  get solvedCount() {
    return this.items.filter((i) => i.solved).length;
  }

  get revealedCount() {
    return this.items.filter((i) => i.revealed).length;
  }

  private setGlow(it: CItem, i: number, c: THREE.Color, glow: number) {
    const v = it.vis[i];
    if (v.kind === 'sky') {
      const m = it.specks[v.idx].material as THREE.SpriteMaterial;
      m.color.copy(c).multiplyScalar(glow > 0 ? 1 : 0.9);
      m.opacity = glow > 0 ? 1 : it.revealed ? 0.5 : 0.22;
      return;
    }
    const im = v.kind === 'prop' ? it.props! : v.kind === 'fruit' ? it.fruits! : it.discs!;
    im.setColorAt(v.idx, c);
    (im.geometry.attributes.aGlow as THREE.InstancedBufferAttribute).setX(v.idx, glow);
  }

  update(dt: number, t: number, cam: THREE.Vector3) {
    this.cullTimer -= dt;
    if (this.cullTimer <= 0) {
      this.cullTimer = 0.4;
      for (const it of this.items) {
        const d = Math.hypot(it.view.eye.x - cam.x, it.view.eye.z - cam.z);
        it.near = d < 14 || this.blaze;
        it.group.visible = d < 170 || this.blaze;
      }
    }
    const c = new THREE.Color();
    for (const it of this.items) {
      if (!it.group.visible) continue;
      if (this.blaze && it.threadU.uAlpha.value < 0.9) {
        it.threadU.uAlpha.value = 0.9;
        it.threads.visible = it.threadShadow.visible = true;
      }
      if (it.revealed && it.reveal < 1) {
        // the threads draw themselves out once the vision completes
        it.reveal = Math.min(1, it.reveal + dt / 1.6);
        it.dirty = true;
      }
      const show = (it.revealed || this.blaze) && it.threadU.uAlpha.value > 0.02;
      const ghost = !show && !it.revealed && it.seen > 0.02;
      it.orb.visible = show && !it.solved;
      if (it.orb.visible) {
        const bob = Math.sin(t * 1.6 + it.orbBase.x) * 0.04 * Math.max(1, it.orbBase.distanceTo(it.view.eye) / 6);
        it.orb.position.set(it.orbBase.x, it.orbBase.y + bob, it.orbBase.z);
        it.orb.scale.setScalar(Math.max(0.01, it.reveal));
        (it.orb.material as THREE.MeshBasicMaterial).opacity = 0.95 * it.threadU.uAlpha.value;
      }
      for (const s of it.sprites) {
        s.visible = show;
        (s.material as THREE.SpriteMaterial).opacity = Math.min(1, it.reveal * 1.4) * it.threadU.uAlpha.value;
      }
      it.rings.forEach((r, i) => {
        r.visible = show || ghost;
        const m = r.material as THREE.SpriteMaterial;
        if (ghost) {
          // unlit: only the points, quiet grey rings on the objects, brightening as you hold
          m.opacity = Math.min(1, 0.7 * it.seen + 0.3 * it.hold);
          m.color.setRGB(0.6, 0.6, 0.66).lerp(new THREE.Color(1.3, 1.22, 1.05), it.hold);
          return;
        }
        m.opacity = Math.min(1, it.reveal * 1.4) * it.threadU.uAlpha.value * (it.state[i] ? 1 : 0.55);
        if (it.solved || this.blaze) m.color.setRGB(1.6, 1.4, 1.0);
        else if (it.state[i]) m.color.copy(it.lit).multiplyScalar(1.8);
        else m.color.setRGB(0.95, 0.92, 0.86);
      });
      if (it.blink > 0) {
        it.blink = Math.max(0, it.blink - dt);
        it.dirty = true;
      }
      if (!it.dirty && !it.solved) continue;
      it.threadU.uReveal.value = it.revealed || this.blaze ? it.reveal : it.hold;
      const blinkOn = it.blink > 0 && Math.floor(it.blink * 4) % 2 === 0;
      for (let i = 0; i < it.state.length; i++) {
        if (blinkOn && it.bad.has(i)) this.setGlow(it, i, c.setRGB(1, 0.08, 0.05), 2.2);
        else if (it.solved || this.blaze) this.setGlow(it, i, c.set('#fff2cf'), 1.6 + 0.4 * Math.sin(t * 2 + i));
        else if (it.revealed && it.state[i]) this.setGlow(it, i, c.copy(it.lit), 2.4);
        else this.setGlow(it, i, c.copy(it.restColors[i] ?? it.rest), 0);
      }
      for (const im of [it.props, it.discs, it.fruits]) {
        if (!im) continue;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        (im.geometry.attributes.aGlow as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
      const col = it.threads.geometry.attributes.color as THREE.BufferAttribute;
      it.threadRanges.forEach(([a, b], k) => {
        let r = 1.25, gg = 1.2, bl = 1.45;
        if (blinkOn && it.badThreads.has(k)) [r, gg, bl] = [2.6, 0.2, 0.12];
        else if (it.solved || this.blaze) [r, gg, bl] = [2.3, 1.95, 1.3];
        else {
          const th = it.def.threads[k];
          if (it.state[th.a] && it.state[th.b]) [r, gg, bl] = [2.4, 2.1, 1.5];
        }
        for (let v = a; v < b; v++) col.setXYZ(v, r, gg, bl);
      });
      col.needsUpdate = true;
      it.dirty = false;
    }
  }
}
