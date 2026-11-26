/** Shared helpers for area builders: placing panels, cables, doors, totems, waystones. */
import * as THREE from 'three';
import { Batcher, G, mtx, type BuildCtx } from '../arch';
import type { World } from '../world';
import { Panel, type PanelManager } from '../../puzzle/panels';
import type { PanelMount } from '../../puzzle/panelView';
import { AREA_BY_ID, type AreaId, type AreaSpec } from '../../data/areas';
import { PUZZLES } from '../../data/puzzles';
import type { PuzzleDef } from '../../puzzle/types';
import { M } from '../materials';
import { audio } from '../../audio';
import { SPIRE } from '../layout';

export interface PanelPlace {
  x: number;
  z: number;
  yaw: number;
  y?: number;
  mount?: PanelMount;
  frame?: THREE.Material;
  maxSize?: number;
  tilt?: number;
}

export function yawToward(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(tx - x, tz - z);
}

// ───────────────────────── doors ─────────────────────────

export class Door {
  readonly mesh: THREE.Object3D;
  open = false;
  private t = 0;
  private closedY: number;
  constructor(private ctx: AreaCtx, obj: THREE.Object3D, private tag: string, private drop: number, private kind: 'stone' | 'wood' | 'light' | 'water' = 'stone') {
    this.mesh = obj;
    this.closedY = obj.position.y;
    ctx.dynamic.add(obj);
  }
  openNow(animate = true) {
    if (this.open) return;
    this.open = true;
    this.ctx.world.collision.setEnabledByTag(this.tag, false);
    if (!animate) {
      this.t = 1;
      this.apply();
    } else audio.door(this.kind);
  }
  update(dt: number) {
    if (this.open && this.t < 1) {
      this.t = Math.min(1, this.t + dt * 0.45);
      this.apply();
    }
  }
  private apply() {
    const e = this.t * this.t * (3 - 2 * this.t);
    this.mesh.position.y = this.closedY - this.drop * e;
    if (this.t >= 1 && this.drop > 0) this.mesh.visible = this.drop < 0.01;
  }
}

// ───────────────────────── light beam ─────────────────────────

const beamVert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const beamFrag = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float flow = 0.75 + 0.25 * sin(vUv.x * 80.0 - uTime * 5.0);
  float fade = smoothstep(0.0, 0.03, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
  float a = edge * flow * fade * uOn;
  gl_FragColor = vec4(uColor * (1.5 + 2.0 * edge) * a, a);
}`;

export class Beam {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;
  private on = 0;
  private target = 0;
  constructor(from: THREE.Vector3, to: THREE.Vector3, color: string, radius = 0.35) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y = Math.max(from.y, to.y) + from.distanceTo(to) * 0.22;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const geo = new THREE.TubeGeometry(curve, 96, radius, 10, false);
    this.u = { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOn: { value: 0 } };
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
  }
  activate(instant = false) {
    this.target = 1;
    if (instant) this.on = 1;
    this.mesh.visible = true;
  }
  update(dt: number, t: number) {
    this.u.uTime.value = t;
    if (this.on < this.target) this.on = Math.min(this.target, this.on + dt * 0.5);
    this.u.uOn.value = this.on;
  }
}

// ───────────────────────── totem ─────────────────────────

export class Totem {
  readonly group = new THREE.Group();
  active = false;
  private crystal: THREE.Mesh;
  private ring: THREE.Mesh;
  private crystalMat: THREE.MeshStandardMaterial;
  private glowT = 0;
  readonly beam: Beam;
  readonly top = new THREE.Vector3();
  constructor(private ctx: AreaCtx, x: number, z: number, y?: number) {
    const base = y ?? ctx.y(x, z);
    const spec = ctx.spec;
    const stone = ctx.frame;
    const b = ctx.build;
    // stepped base
    b.batch.add(G.box(3.2, 0.35, 3.2, 0.05), stone, mtx(x, base + 0.175, z));
    b.batch.add(G.box(2.4, 0.35, 2.4, 0.05), stone, mtx(x, base + 0.525, z));
    b.col.addSolidBox(x, z, 1.6, 1.6, 0, base - 2, base + 0.35);
    b.col.addSolidBox(x, z, 1.2, 1.2, 0, base - 2, base + 0.7);
    // octagonal shaft
    b.batch.add(G.cyl(0.55, 0.7, 3.4, 8), stone, mtx(x, base + 0.7 + 1.7, z));
    b.batch.add(G.cyl(0.85, 0.75, 0.3, 8), stone, mtx(x, base + 4.25, z));
    b.col.addBlocker({ x, z, r: 0.75, y0: base, y1: base + 6 });
    // emblem band
    b.batch.add(G.cyl(0.72, 0.72, 0.16, 8), M.gold(), mtx(x, base + 2.0, z));
    this.crystalMat = new THREE.MeshStandardMaterial({ color: '#3a3d48', roughness: 0.2, metalness: 0.2, emissive: new THREE.Color(spec.lit), emissiveIntensity: 0 });
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), this.crystalMat);
    this.crystal.scale.set(1, 1.6, 1);
    this.crystal.position.set(x, base + 5.6, z);
    this.crystal.castShadow = true;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 48), M.gold());
    this.ring.position.copy(this.crystal.position);
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.crystal, this.ring);
    ctx.dynamic.add(this.group);
    this.top.copy(this.crystal.position);
    const spireTop = new THREE.Vector3(SPIRE.x, 168, SPIRE.z);
    this.beam = new Beam(this.top.clone().add(new THREE.Vector3(0, 0.8, 0)), spireTop, spec.lit, 0.45);
    ctx.world.engine.scene.add(this.beam.mesh);
  }
  activate(instant = false) {
    if (this.active) return;
    this.active = true;
    this.glowT = instant ? 1 : 0;
    this.beam.activate(instant);
    if (!instant) audio.totem(this.ctx.spec.id);
  }
  update(dt: number, t: number) {
    this.crystal.rotation.y += dt * (this.active ? 0.8 : 0.15);
    this.crystal.position.y = this.top.y + Math.sin(t * 1.3) * 0.08;
    this.ring.rotation.z += dt * (this.active ? 1.2 : 0.1);
    if (this.active && this.glowT < 1) this.glowT = Math.min(1, this.glowT + dt * 0.6);
    this.crystalMat.emissiveIntensity = this.glowT * (2.4 + 0.4 * Math.sin(t * 2));
    this.crystalMat.color.set(this.active ? '#ffffff' : '#3a3d48');
    this.beam.update(dt, t);
  }
}

// ───────────────────────── area context ─────────────────────────

export interface AreaRuntime {
  id: AreaId;
  panels: Panel[];
  secret?: Panel | null;
  totem?: Totem | null;
  doors: Map<string, Door>;
  update(dt: number, t: number): void;
  /** called whenever any panel in the game is solved (or on load) */
  onProgress?(): void;
}

export class AreaCtx implements AreaRuntime {
  readonly build: BuildCtx;
  readonly dynamic = new THREE.Group();
  readonly panels: Panel[] = [];
  readonly doors = new Map<string, Door>();
  readonly spec: AreaSpec;
  readonly puzzles: Record<string, PuzzleDef[]>;
  secret: Panel | null = null;
  totem: Totem | null = null;
  frame: THREE.Material = M.stone();
  private updaters: ((dt: number, t: number) => void)[] = [];
  onProgress?: () => void;

  constructor(readonly id: AreaId, readonly world: World, readonly pm: PanelManager) {
    this.spec = AREA_BY_ID[id];
    this.puzzles = PUZZLES[id];
    this.build = { batch: new Batcher(), col: world.collision };
    // doors, water wheels, lamps, crystals…: they move, so no constellation line is ever drawn on them
    this.dynamic.userData.castAs = 'bad';
    world.root.add(this.dynamic);
  }

  y(x: number, z: number): number {
    return this.world.terrain.heightAt(x, z);
  }

  group(key: string): PuzzleDef[] {
    return this.puzzles[key] ?? [];
  }

  exclude(x: number, z: number, r: number) {
    this.world.forest.exclude(x, z, r);
  }

  panel(def: PuzzleDef, place: PanelPlace, group: string): Panel {
    const p = new Panel(def, this.id, group, {
      lit: this.spec.lit,
      accent: this.spec.accent,
      frame: place.frame ?? this.frame,
      mount: place.mount,
      maxSize: place.maxSize,
      tilt: place.tilt,
    });
    let y = place.y ?? this.y(place.x, place.z);
    // never sunk: if the ground rises anywhere under the panel's base or just in front of it (a
    // slope, a terrace step through a platform), the panel stands on the highest of it
    if (p.view.mount !== 'wall') {
      const c = Math.cos(place.yaw), s = Math.sin(place.yaw);
      let top = -Infinity;
      for (const lx of [-0.8, -0.4, 0, 0.4, 0.8]) for (const lz of [-0.45, 0, 0.45, 0.9]) {
        top = Math.max(top, this.y(place.x + lx * c + lz * s, place.z - lx * s + lz * c));
      }
      if (top > y - 0.04) y = top + 0.03;
    }
    p.view.root.position.set(place.x, y, place.z);
    p.view.root.rotation.y = place.yaw;
    p.view.root.updateMatrixWorld(true);
    p.view.updateWorld();
    const mount = p.view.mount;
    if (mount === 'pedestal' || mount === 'lectern' || mount === 'drum') {
      this.world.collision.addBlocker({ x: place.x, z: place.z, hw: 0.42, hd: 0.36, rot: place.yaw, y0: y - 1, y1: y + 2.2 });
    }
    this.exclude(place.x, place.z, 2.2);
    this.pm.add(p);
    if (group === 'secret') this.secret = p;
    else this.panels.push(p);
    return p;
  }

  /** Cable along the ground between two points (sampled every ~1.5 m). */
  groundRoute(ax: number, az: number, bx: number, bz: number, lift = 0.03, yA?: number, yB?: number): THREE.Vector3[] {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(d / 1.5));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      let y = this.world.collision.groundAt(x, z, 9999)[0];
      if (i === 0 && yA !== undefined) y = yA;
      if (i === n && yB !== undefined) y = yB;
      pts.push(new THREE.Vector3(x, y + lift, z));
    }
    return pts;
  }

  /** Link panels in order with cables running between their bases (slightly behind them). */
  chain(list: Panel[], first?: Panel | null) {
    let prev = first ?? null;
    for (const p of list) {
      if (prev) {
        const a = prev.view.root.position, b = p.view.root.position;
        // (a panel lying on the floor: from beyond its far edge, so the cable never crosses its face)
        const off = (q: Panel) => (q.view.mount === 'floor' ? q.view.faceH / 2 + 0.35 : 0.35);
        const back = (q: Panel) => new THREE.Vector3(-Math.sin(q.view.root.rotation.y) * off(q), 0, -Math.cos(q.view.root.rotation.y) * off(q));
        const ba = back(prev), bb = back(p);
        const pts = this.groundRoute(a.x + ba.x, a.z + ba.z, b.x + bb.x, b.z + bb.z, 0.03, a.y + 0.03, b.y + 0.03);
        this.pm.link(prev, p, pts, this.spec.lit);
      }
      prev = p;
    }
  }

  /** A stone door slab that sinks into the ground when opened. */
  stoneDoor(tag: string, x: number, y: number, z: number, w: number, h: number, ry: number, mat: THREE.Material = this.frame, thick = 0.5): Door {
    const m = new THREE.Mesh(G.box(w, h, thick, 0.05), mat);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    // glyph-like inlay on the door
    const inlay = new THREE.Mesh(G.box(w * 0.5, w * 0.5, 0.04), M.glow(this.spec.lit, 0.6));
    inlay.position.set(0, h * 0.05, thick / 2 + 0.01);
    inlay.rotation.z = Math.PI / 4;
    m.add(inlay);
    this.world.collision.addBlocker({ x, z, hw: w / 2, hd: thick / 2 + 0.05, rot: ry, y0: y - 1, y1: y + h, tag });
    const d = new Door(this, m, tag, h + 0.1, 'stone');
    this.doors.set(tag, d);
    return d;
  }

  addTotem(x: number, z: number, y?: number): Totem {
    this.totem = new Totem(this, x, z, y);
    this.exclude(x, z, 4);
    return this.totem;
  }

  onUpdate(fn: (dt: number, t: number) => void) {
    this.updaters.push(fn);
  }

  update(dt: number, t: number) {
    for (const d of this.doors.values()) d.update(dt);
    this.totem?.update(dt, t);
    for (const u of this.updaters) u(dt, t);
  }

  finalize(): AreaRuntime {
    this.world.root.add(this.build.batch.finalize());
    return this;
  }

  /** All panels of the area solved? */
  get complete(): boolean {
    return this.panels.length > 0 && this.panels.every((p) => p.solved);
  }
}
