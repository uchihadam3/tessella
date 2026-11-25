/**
 * THE CONSTELLATIONS — the secret layer, hidden in plain sight.
 *
 * Every constellation is made of ordinary things that belong to its place (mushrooms in the
 * grove, shells on the beach, clay jars at the temple, roses in the garden, crystals in the
 * hollow…). Nothing gives them away: no threads, no glyphs, no bell.
 * The island reveals them only to someone who STOPS and LOOKS: stand still with a group in view
 * and, after a few seconds, threads of light draw themselves between the objects, the glyphs
 * appear and a small orb of light rises (ring it to check). Move, and the vision fades.
 * Once revealed, a constellation stays revealed. Never taught anywhere.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONSTELLATIONS } from '../data/constellations';
import type { ConstellationDef } from './types';
import { checkConstellation, initialState, isPressable, pressSet, stateString } from './graph';
import type { World } from '../world/world';
import type { AreaId } from '../data/areas';
import { ANCHORS, AREA_RADIUS, CALDERA, CITADEL, NORTH_LANDING } from '../world/layout';
import { drawGlyph } from '../puzzle/glyphs';
import { rng, simplex } from '../world/noise';
import { audio } from '../audio';

export const VAULT_THRESHOLD = 100;
const REVEAL_SECONDS = 3.4;

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

// ───────────────────────── threads (revealed progressively) ─────────────────────────

const threadVert = /* glsl */ `
attribute float aT; attribute vec3 color;
varying float vT; varying vec3 vC;
void main(){ vT = aT; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const threadFrag = /* glsl */ `
uniform float uReveal; varying float vT; varying vec3 vC;
void main(){
  if (vT > uReveal) discard;
  float head = smoothstep(uReveal - 0.08, uReveal, vT) * step(uReveal, 0.999);
  gl_FragColor = vec4(vC * (1.0 + head * 3.0), 1.0);
}`;

export interface CItem {
  def: ConstellationDef;
  area: AreaId;
  group: THREE.Group;
  glows: THREE.InstancedMesh;
  threads: THREE.Mesh;
  threadU: { uReveal: { value: number } };
  threadRanges: [number, number][];
  sprites: THREE.Sprite[];
  orb: THREE.Mesh;
  orbBase: THREE.Vector3;
  state: Uint8Array;
  solved: boolean;
  revealed: boolean;
  reveal: number;
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
  private raycaster = new THREE.Raycaster();
  private cullTimer = 0;
  private stillTime = 0;
  aimed: CTarget | null = null;
  onSolved: (item: CItem) => void = () => {};
  onChanged: (item: CItem) => void = () => {};
  onRevealed: (item: CItem) => void = () => {};
  private bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

  constructor(private world: World) {
    world.root.add(this.group);
  }

  // ───────────────────────── placement ─────────────────────────

  private groundAt(x: number, z: number): number {
    const t = this.world.terrain.heightAt(x, z);
    return this.world.collision.groundAt(x, z, t + 30)[0];
  }

  private okPoint(x: number, z: number): number | null {
    const g = this.groundAt(x, z);
    if (!isFinite(g)) return null;
    if (g < this.world.waterAt(x, z) + 0.15) return null;
    if (g < 1.2) return null;
    const d = 0.9;
    for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (Math.abs(this.groundAt(x + dx, z + dz) - g) > 0.5) return null;
    if (this.world.collision.blockedAt(x, z, 0.8, g + 0.2, g + 1.6)) return null;
    const onFloor = g > this.world.terrain.heightAt(x, z) + 0.05;
    if (!onFloor && this.world.terrain.pathAt(x, z) > 0.3) return null;
    return g;
  }

  place() {
    const byArea = new Map<AreaId, ConstellationDef[]>();
    for (const d of CONSTELLATIONS) {
      if (!byArea.has(d.area)) byArea.set(d.area, []);
      byArea.get(d.area)!.push(d);
    }
    const placed: { x: number; z: number; r: number }[] = [];
    for (const [area, defs] of byArea) {
      const rnd = rng(area.length * 977 + 13);
      let center = ANCHORS[area];
      let rMin = 14, rMax = (AREA_RADIUS[area] ?? 80) + 18;
      if (area === 'prologue') {
        center = { x: 0, z: 316 };
        rMin = 0;
        rMax = 28;
      } else if (area === 'echo') {
        center = { x: CALDERA.x, z: CALDERA.z };
        rMin = 16;
        rMax = 47;
      } else if (area === 'citadel') {
        center = { x: CITADEL.x, z: CITADEL.z };
        rMin = 4;
        rMax = 35;
      } else if (area === 'hub') {
        rMin = 34;
        rMax = 70;
      }
      for (const def of defs) {
        let done = false;
        const foot = Math.max(...def.stars.map((s) => Math.hypot(s.x, s.z)), Math.hypot(def.bell.x, def.bell.z)) + 1.2;
        for (let attempt = 0; attempt < 1500 && !done; attempt++) {
          const ang = rnd() * Math.PI * 2;
          const r = rMin + Math.sqrt(rnd()) * (rMax - rMin);
          const cx = center.x + Math.cos(ang) * r, cz = center.z + Math.sin(ang) * r;
          if (placed.some((p) => Math.hypot(p.x - cx, p.z - cz) < p.r + foot + 3)) continue;
          if (area === 'prologue' && (Math.abs(cx) > 30 || cz < 300 || cz > 336)) continue;
          const yaw = rnd() * Math.PI * 2;
          const c = Math.cos(yaw), s = Math.sin(yaw);
          const pts = [...def.stars.map((st) => [st.x, st.z]), [def.bell.x, def.bell.z]].map(([lx, lz]) => [cx + lx * c + lz * s, cz - lx * s + lz * c]);
          const ys: number[] = [];
          let ok = true;
          for (const [px, pz] of pts) {
            const g = this.okPoint(px, pz);
            if (g === null) {
              ok = false;
              break;
            }
            ys.push(g);
          }
          if (!ok) continue;
          if (Math.max(...ys) - Math.min(...ys) > 3.2) continue;
          placed.push({ x: cx, z: cz, r: foot });
          this.build(def, area, cx, cz, pts, ys, foot);
          done = true;
        }
        // crowded places spill over to a nearby fallback spot (e.g. the citadel's landing headland)
        if (!done && area === 'citadel') {
          for (let attempt = 0; attempt < 1500 && !done; attempt++) {
            const ang = rnd() * Math.PI * 2;
            const r = Math.sqrt(rnd()) * 34;
            const cx = NORTH_LANDING.x + Math.cos(ang) * r, cz = NORTH_LANDING.z + 10 + Math.sin(ang) * r;
            if (placed.some((p) => Math.hypot(p.x - cx, p.z - cz) < p.r + foot + 3)) continue;
            const yaw = rnd() * Math.PI * 2;
            const c = Math.cos(yaw), s = Math.sin(yaw);
            const pts = [...def.stars.map((st) => [st.x, st.z]), [def.bell.x, def.bell.z]].map(([lx, lz]) => [cx + lx * c + lz * s, cz - lx * s + lz * c]);
            const ys: number[] = [];
            let ok = true;
            for (const [px, pz] of pts) {
              const g = this.okPoint(px, pz);
              if (g === null) { ok = false; break; }
              ys.push(g);
            }
            if (!ok || Math.max(...ys) - Math.min(...ys) > 3.2) continue;
            placed.push({ x: cx, z: cz, r: foot });
            this.build(def, area, cx, cz, pts, ys, foot);
            done = true;
          }
        }
        // last resort: search a wider ring around the area
        for (let attempt = 0; attempt < 3000 && !done && area !== 'prologue'; attempt++) {
          const ang = rnd() * Math.PI * 2;
          const onIsle = area === 'echo' && attempt % 2 === 1;
          const r = area === 'echo' ? (onIsle ? 7.5 + rnd() * 5 : rnd() * 14) : rMax * 0.5 + rnd() * (rMax + 30);
          const base = area === 'citadel' ? { x: NORTH_LANDING.x, z: NORTH_LANDING.z + 30 } : area === 'echo' ? (onIsle ? { x: CALDERA.x, z: CALDERA.z } : { x: CALDERA.x, z: CALDERA.z + 70 }) : center;
          const cx = base.x + Math.cos(ang) * r, cz = base.z + Math.sin(ang) * r;
          if (placed.some((p) => Math.hypot(p.x - cx, p.z - cz) < p.r + foot + 3)) continue;
          const yaw = rnd() * Math.PI * 2;
          const c = Math.cos(yaw), s = Math.sin(yaw);
          const pts = [...def.stars.map((st) => [st.x, st.z]), [def.bell.x, def.bell.z]].map(([lx, lz]) => [cx + lx * c + lz * s, cz - lx * s + lz * c]);
          const ys: number[] = [];
          let ok = true;
          for (const [px, pz] of pts) {
            const g = this.okPoint(px, pz);
            if (g === null) { ok = false; break; }
            ys.push(g);
          }
          if (!ok || Math.max(...ys) - Math.min(...ys) > 3.2) continue;
          placed.push({ x: cx, z: cz, r: foot });
          this.build(def, area, cx, cz, pts, ys, foot);
          done = true;
        }
        if (!done) console.warn('constellation not placed', def.id);
      }
    }
  }

  private build(def: ConstellationDef, area: AreaId, cx: number, cz: number, pts: number[][], ys: number[], foot: number) {
    const g = new THREE.Group();
    const n = def.stars.length;
    const starPos: THREE.Vector3[] = [];
    const bodies: THREE.BufferGeometry[] = [];
    const glowGeo = makeProp(area, 1).glow;
    const glows = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
    let rest = '#888', lit = '#fff';
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i];
      const y = ys[i];
      const prop = makeProp(area, Math.round(x * 13 + z * 7) + i);
      rest = prop.rest;
      lit = prop.lit;
      const rot = (x * 1.7 + z) % (Math.PI * 2);
      const body = prop.body.clone().rotateY(rot).translate(x, y, z);
      bodies.push(body);
      const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y + prop.glowAt, z);
      glows.setMatrixAt(i, m);
      glows.setColorAt(i, new THREE.Color(prop.rest));
      starPos.push(new THREE.Vector3(x, y + prop.glowAt, z));
      if (def.stars[i].lock !== undefined) {
        // a small iron stake driven into the ground beside it
        bodies.push(colored(new THREE.ConeGeometry(0.035, 0.42, 6).translate(x + 0.24, y + 0.2, z), '#2c2a2a'));
      }
      this.world.collision.addBlocker({ x, z, r: 0.14, y0: y - 1, y1: y + prop.glowAt + 0.2 });
    }
    const merged = mergeGeometries(bodies, false);
    if (merged) {
      const bm = new THREE.Mesh(merged, this.bodyMat);
      bm.castShadow = true;
      bm.receiveShadow = true;
      g.add(bm);
    }
    glows.instanceMatrix.needsUpdate = true;
    if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    glows.computeBoundingSphere();
    g.add(glows);
    // threads: ribbons of light with a 0..1 parameter across the whole constellation (for the reveal)
    const tPos: number[] = [];
    const tCol: number[] = [];
    const tT: number[] = [];
    const ranges: [number, number][] = [];
    const beads: THREE.Vector3[] = [];
    const seg = 10;
    const nT = def.threads.length;
    def.threads.forEach((t, ti) => {
      const a = starPos[t.a], b = starPos[t.b];
      const start = tPos.length / 3;
      const pt = (u: number) => new THREE.Vector3().lerpVectors(a, b, u).add(new THREE.Vector3(0, -0.12 * Math.sin(Math.PI * u), 0));
      const pieces: [number, number][] = t.mark === 'diff' ? [[0.05, 0.42], [0.58, 0.95]] : [[0.05, 0.95]];
      for (const [u0, u1] of pieces) {
        for (let k = 0; k < seg; k++) {
          const ua = u0 + ((u1 - u0) * k) / seg, ub = u0 + ((u1 - u0) * (k + 1)) / seg;
          const p0 = pt(ua), p1 = pt(ub);
          const dir = p1.clone().sub(p0).normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.011);
          const up = new THREE.Vector3(0, 0.011, 0);
          for (const off of [side, up]) {
            const q = [p0.clone().sub(off), p0.clone().add(off), p1.clone().add(off), p1.clone().sub(off)];
            const qu = [ua, ua, ub, ub];
            for (const idx of [0, 1, 2, 0, 2, 3]) {
              tPos.push(q[idx].x, q[idx].y, q[idx].z);
              // threads appear one after another during the reveal
              tT.push((ti + qu[idx]) / nT);
            }
          }
        }
      }
      if (t.mark === 'same') beads.push(pt(0.5));
      const end = tPos.length / 3;
      ranges.push([start, end]);
      for (let v = start; v < end; v++) tCol.push(0.55, 0.52, 0.62);
    });
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
    tg.setAttribute('aT', new THREE.Float32BufferAttribute(tT, 1));
    const threadU = { uReveal: { value: 0 } };
    const threads = new THREE.Mesh(tg, new THREE.ShaderMaterial({ uniforms: threadU, vertexShader: threadVert, fragmentShader: threadFrag, side: THREE.DoubleSide, toneMapped: false }));
    threads.frustumCulled = false;
    g.add(threads);
    for (const p of beads) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.2, 0.8), toneMapped: false }));
      bead.position.copy(p);
      bead.userData.revealPart = true;
      g.add(bead);
    }
    // glyph sprites
    const sprites: THREE.Sprite[] = [];
    def.stars.forEach((st, i) => {
      if (!st.glyph) return;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(st.glyph), depthWrite: false, transparent: true, opacity: 0 }));
      sp.position.copy(starPos[i]).add(new THREE.Vector3(0, 0.42, 0));
      sp.scale.setScalar(0.44);
      sp.visible = false;
      g.add(sp);
      sprites.push(sp);
    });
    // the orb (rung to check) rises where the bell would be
    const [bx, bz] = pts[n];
    const orbBase = new THREE.Vector3(bx, ys[n] + 1.15, bz);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.65, 1.3), toneMapped: false, transparent: true, opacity: 0.95 }));
    orb.position.copy(orbBase);
    orb.visible = false;
    orb.userData.bell = true;
    g.add(orb);
    this.world.forest.exclude(cx, cz, foot);
    this.group.add(g);
    const centroid = starPos.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
    this.items.push({
      def, area, group: g, glows, threads, threadU, threadRanges: ranges, sprites, orb, orbBase, state: initialState(def), solved: false,
      revealed: false, reveal: 0, center: centroid, radius: foot, starPos, rest: new THREE.Color(rest), lit: new THREE.Color(lit),
      blink: 0, bad: new Set(), badThreads: new Set(), dirty: true, near: false,
    });
  }

  // ───────────────────────── seeing ─────────────────────────

  /** Called every frame while walking: standing still and looking at a hidden group reveals it. */
  watch(dt: number, camera: THREE.PerspectiveCamera, playerSpeed: number) {
    if (playerSpeed < 0.12) this.stillTime += dt;
    else this.stillTime = 0;
    const still = this.stillTime > 0.9;
    const v = new THREE.Vector3();
    for (const it of this.items) {
      if (it.revealed || !it.near) {
        if (!it.revealed && it.reveal > 0) {
          it.reveal = Math.max(0, it.reveal - dt * 0.9);
          it.dirty = true;
        }
        continue;
      }
      let looking = false;
      if (still) {
        const d = it.center.distanceTo(camera.position);
        if (d < 11 && d > 0.8) {
          v.copy(it.center).project(camera);
          looking = v.z < 1 && Math.abs(v.x) < 0.24 && Math.abs(v.y) < 0.32;
        }
      }
      const before = it.reveal;
      if (looking) it.reveal = Math.min(1, it.reveal + dt / REVEAL_SECONDS);
      else it.reveal = Math.max(0, it.reveal - dt * 0.9);
      if (it.reveal !== before) it.dirty = true;
      if (it.reveal >= 1) {
        it.revealed = true;
        audio.panelPowered();
        this.onRevealed(it);
      }
    }
  }

  // ───────────────────────── interaction ─────────────────────────

  /** what the crosshair (or, on touch, the finger at `ndc`) points at */
  aim(camera: THREE.Camera, ndc = new THREE.Vector2(0, 0)): CTarget | null {
    this.raycaster.setFromCamera(ndc, camera);
    const ray = this.raycaster.ray;
    let best: CTarget | null = null;
    let bd = 4.2;
    for (const it of this.items) {
      if (!it.near || !it.revealed) continue;
      for (let i = 0; i < it.starPos.length; i++) {
        const p = it.starPos[i];
        const along = p.clone().sub(ray.origin).dot(ray.direction);
        if (along <= 0 || along >= bd) continue;
        if (ray.distanceToPoint(p) < 0.28) {
          best = { item: it, star: i };
          bd = along;
        }
      }
      const o = it.orb.position;
      const along = o.clone().sub(ray.origin).dot(ray.direction);
      if (along > 0 && along < bd && ray.distanceToPoint(o) < 0.3) {
        best = { item: it, bell: true };
        bd = along;
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
    it.reveal = it.revealed ? 1 : 0;
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

  update(dt: number, t: number, cam: THREE.Vector3) {
    this.cullTimer -= dt;
    if (this.cullTimer <= 0) {
      this.cullTimer = 0.4;
      for (const it of this.items) {
        const d = it.center.distanceTo(cam);
        it.near = d < 18;
        it.group.visible = d < 150;
        const close = d < 45;
        for (const s of it.sprites) s.visible = close && it.reveal > 0.05;
        it.threads.visible = d < 110 && it.reveal > 0.001;
      }
    }
    const c = new THREE.Color();
    for (const it of this.items) {
      if (!it.group.visible) continue;
      // the orb bobs gently once revealed
      if (it.reveal > 0) {
        it.orb.visible = true;
        it.orb.position.set(it.orbBase.x, it.orbBase.y - 0.6 * (1 - it.reveal) + Math.sin(t * 1.6 + it.orbBase.x) * 0.06, it.orbBase.z);
        it.orb.scale.setScalar(Math.max(0.01, it.reveal));
      } else it.orb.visible = false;
      if (it.blink > 0) {
        it.blink = Math.max(0, it.blink - dt);
        it.dirty = true;
      }
      if (!it.dirty && !it.solved) continue;
      it.threadU.uReveal.value = it.reveal;
      for (const s of it.sprites) (s.material as THREE.SpriteMaterial).opacity = Math.min(1, it.reveal * 1.4);
      it.group.children.forEach((ch) => {
        if (ch.userData.revealPart) ch.visible = it.reveal > 0.6;
      });
      const blinkOn = it.blink > 0 && Math.floor(it.blink * 4) % 2 === 0;
      for (let i = 0; i < it.state.length; i++) {
        if (blinkOn && it.bad.has(i)) c.setRGB(2.2, 0.15, 0.1);
        else if (it.solved) c.set('#fff2cf').multiplyScalar(2.1 + 0.4 * Math.sin(t * 2 + i));
        else if (it.state[i]) c.copy(it.lit).multiplyScalar(2.4);
        else c.copy(it.rest);
        it.glows.setColorAt(i, c);
      }
      if (it.glows.instanceColor) it.glows.instanceColor.needsUpdate = true;
      const col = it.threads.geometry.attributes.color as THREE.BufferAttribute;
      it.threadRanges.forEach(([a, b], k) => {
        let r = 0.55, gg = 0.52, bl = 0.66;
        if (blinkOn && it.badThreads.has(k)) [r, gg, bl] = [2, 0.15, 0.1];
        else if (it.solved) [r, gg, bl] = [1.7, 1.45, 1.0];
        else {
          const th = it.def.threads[k];
          if (it.state[th.a] && it.state[th.b]) [r, gg, bl] = [1.1, 1.0, 0.8];
        }
        for (let v = a; v < b; v++) col.setXYZ(v, r, gg, bl);
      });
      col.needsUpdate = true;
      it.dirty = false;
    }
  }
}
