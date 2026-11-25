/**
 * THE CONSTELLATIONS — world presence of the secret layer: stars (themed lamps), threads of
 * light (with knots / cuts), glyph sprites and bells. Never taught: the only hint is the crosshair
 * ring when you look at a star up close.
 */
import * as THREE from 'three';
import { CONSTELLATIONS } from '../data/constellations';
import type { ConstellationDef } from './types';
import { checkConstellation, initialState, isPressable, pressSet, stateString } from './graph';
import type { World } from '../world/world';
import type { AreaId } from '../data/areas';
import { AREA_BY_ID } from '../data/areas';
import { ANCHORS, AREA_RADIUS, CALDERA, CITADEL } from '../world/layout';
import { drawGlyph } from '../puzzle/glyphs';
import { rng } from '../world/noise';
import { audio } from '../audio';

export const VAULT_THRESHOLD = 100;

interface Theme {
  post: string;
  cap: string;
  lit: string;
  h: number;
}

const THEMES: Partial<Record<AreaId, Theme>> = {
  prologue: { post: '#cbb99a', cap: '#efe2c8', lit: '#ffd9a0', h: 0.75 },
  hub: { post: '#e3dccf', cap: '#c9a85a', lit: '#fff0c8', h: 1.0 },
  kinship: { post: '#5b3f2b', cap: '#a8352b', lit: '#ffb35a', h: 1.05 },
  measure: { post: '#6f8a3a', cap: '#c8ec6e', lit: '#e8ffb0', h: 0.95 },
  mold: { post: '#e9e2d3', cap: '#c9a46b', lit: '#fff6e0', h: 0.85 },
  contour: { post: '#2f6b35', cap: '#e8e2d6', lit: '#b9ffd8', h: 0.9 },
  mosaic: { post: '#d9b27a', cap: '#3fb6b8', lit: '#9ff6ff', h: 0.95 },
  beacon: { post: '#f1eee8', cap: '#c0392b', lit: '#ffe39a', h: 0.9 },
  weave: { post: '#8a6342', cap: '#b993ff', lit: '#e2d1ff', h: 1.0 },
  twins: { post: '#a8352b', cap: '#f4a3c4', lit: '#ffd1e6', h: 0.95 },
  citadel: { post: '#4a4c52', cap: '#b07a3f', lit: '#ffb070', h: 1.0 },
  echo: { post: '#3c3a4c', cap: '#63f0ff', lit: '#8ff6ff', h: 0.9 },
};

export interface CItem {
  def: ConstellationDef;
  area: AreaId;
  group: THREE.Group;
  bulbs: THREE.InstancedMesh;
  threads: THREE.Mesh;
  threadRanges: [number, number][]; // vertex ranges per thread
  bell: THREE.Mesh;
  state: Uint8Array;
  solved: boolean;
  center: THREE.Vector3;
  starPos: THREE.Vector3[];
  blink: number;
  bad: Set<number>;
  badThreads: Set<number>;
  theme: Theme;
  dirty: boolean;
  near: boolean;
}

export type CTarget = { item: CItem; star: number } | { item: CItem; bell: true };

const glyphTexCache = new Map<string, THREE.Texture>();
function glyphTexture(g: NonNullable<ConstellationDef['stars'][number]['glyph']>): THREE.Texture {
  const key = JSON.stringify(g);
  let t = glyphTexCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(18,17,24,0.82)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(233,199,125,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawGlyph(ctx, g as Parameters<typeof drawGlyph>[1], 64, 64, 104, false);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glyphTexCache.set(key, t);
  return t;
}

export class ConstellationSystem {
  readonly items: CItem[] = [];
  readonly group = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private cullTimer = 0;
  aimed: CTarget | null = null;
  onSolved: (item: CItem) => void = () => {};
  onChanged: (item: CItem) => void = () => {};

  constructor(private world: World) {
    world.root.add(this.group);
  }

  // ───────────────────────── placement ─────────────────────────

  private groundAt(x: number, z: number): number {
    const t = this.world.terrain.heightAt(x, z);
    return this.world.collision.groundAt(x, z, t + 30)[0];
  }

  private okPoint(x: number, z: number, area: AreaId): number | null {
    const g = this.groundAt(x, z);
    if (!isFinite(g)) return null;
    if (g < this.world.waterAt(x, z) + 0.15) return null;
    if (g < 1.2) return null;
    // flat enough
    const d = 0.9;
    for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (Math.abs(this.groundAt(x + dx, z + dz) - g) > 0.55) return null;
    if (this.world.collision.blockedAt(x, z, 0.75, g + 0.2, g + 1.6)) return null;
    const onFloor = g > this.world.terrain.heightAt(x, z) + 0.05;
    if (!onFloor && this.world.terrain.pathAt(x, z) > 0.3) return null;
    void area;
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
        rMin = 6;
        rMax = 52;
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
            const g = this.okPoint(px, pz, area);
            if (g === null) {
              ok = false;
              break;
            }
            ys.push(g);
          }
          if (!ok) continue;
          if (Math.max(...ys) - Math.min(...ys) > 3.2) continue;
          placed.push({ x: cx, z: cz, r: foot });
          this.build(def, area, cx, cz, yaw, pts, ys);
          done = true;
        }
        if (!done) console.warn('constellation not placed', def.id);
      }
    }
  }

  private build(def: ConstellationDef, area: AreaId, cx: number, cz: number, yaw: number, pts: number[][], ys: number[]) {
    const theme = THEMES[area] ?? THEMES.hub!;
    const g = new THREE.Group();
    const n = def.stars.length;
    const starPos: THREE.Vector3[] = [];
    const postGeo: THREE.BufferGeometry[] = [];
    const postMat = new THREE.MeshStandardMaterial({ color: theme.post, roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: theme.cap, roughness: 0.5, metalness: 0.3 });
    const posts = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i];
      const y = ys[i];
      const top = y + theme.h;
      starPos.push(new THREE.Vector3(x, top + 0.12, z));
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, theme.h, 7), postMat);
      p.position.set(x, y + theme.h / 2, z);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.06, 10), capMat);
      cap.position.set(x, top, z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 20), capMat);
      ring.position.set(x, top + 0.12, z);
      ring.rotation.x = Math.PI / 2;
      posts.add(p, cap, ring);
      if (def.stars[i].lock !== undefined) {
        const stake = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#2c2a2a', metalness: 0.6, roughness: 0.4 }));
        stake.position.set(x + 0.22, y + 0.25, z);
        posts.add(stake);
      }
      void postGeo;
      this.world.collision.addBlocker({ x, z, r: 0.12, y0: y - 1, y1: top + 0.3 });
    }
    posts.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    g.add(posts);
    // bulbs
    const bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(starPos[i].x, starPos[i].y, starPos[i].z);
      bulbs.setMatrixAt(i, m);
      bulbs.setColorAt(i, new THREE.Color(0.2, 0.2, 0.25));
    }
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.computeBoundingSphere();
    bulbs.userData.citem = true;
    g.add(bulbs);
    // threads (gently sagging ropes of light); cut threads have a gap, knots a bead
    const tPos: number[] = [];
    const tCol: number[] = [];
    const ranges: [number, number][] = [];
    const beads: THREE.Vector3[] = [];
    const seg = 10;
    def.threads.forEach((t) => {
      const a = starPos[t.a], b = starPos[t.b];
      const start = tPos.length / 3;
      const pt = (u: number) => new THREE.Vector3().lerpVectors(a, b, u).add(new THREE.Vector3(0, -0.16 * Math.sin(Math.PI * u), 0));
      const pieces: [number, number][] = t.mark === 'diff' ? [[0.06, 0.43], [0.57, 0.94]] : [[0.06, 0.94]];
      for (const [u0, u1] of pieces) {
        for (let k = 0; k < seg; k++) {
          const p0 = pt(u0 + ((u1 - u0) * k) / seg), p1 = pt(u0 + ((u1 - u0) * (k + 1)) / seg);
          // a thin ribbon: two triangles facing up/sideways
          const dir = p1.clone().sub(p0).normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.012);
          const up = new THREE.Vector3(0, 0.012, 0);
          for (const off of [side, up]) {
            const q = [p0.clone().sub(off), p0.clone().add(off), p1.clone().add(off), p1.clone().sub(off)];
            for (const idx of [0, 1, 2, 0, 2, 3]) tPos.push(q[idx].x, q[idx].y, q[idx].z);
          }
        }
      }
      if (t.mark === 'same') beads.push(pt(0.5));
      const end = tPos.length / 3;
      ranges.push([start, end]);
      for (let v = start; v < end; v++) tCol.push(0.35, 0.33, 0.4);
    });
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
    const threads = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
    g.add(threads);
    for (const p of beads) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), capMat);
      bead.position.copy(p);
      g.add(bead);
    }
    // glyph sprites
    def.stars.forEach((st, i) => {
      if (!st.glyph) return;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(st.glyph), depthWrite: false }));
      sp.position.copy(starPos[i]).add(new THREE.Vector3(0, 0.42, 0));
      sp.scale.setScalar(0.42);
      g.add(sp);
    });
    // bell
    const [bx, bz] = pts[n];
    const by = ys[n];
    const frame = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#4b3626', roughness: 0.8 });
    for (const sx of [-0.35, 0.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), wood);
      post.position.set(sx, 0.7, 0);
      frame.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.1), wood);
    bar.position.set(0, 1.4, 0);
    frame.add(bar);
    const bellGeo = new THREE.LatheGeometry([new THREE.Vector2(0.02, 0.32), new THREE.Vector2(0.1, 0.3), new THREE.Vector2(0.14, 0.18), new THREE.Vector2(0.16, 0.05), new THREE.Vector2(0.21, 0)], 20);
    const bell = new THREE.Mesh(bellGeo, new THREE.MeshStandardMaterial({ color: '#c9973f', metalness: 0.85, roughness: 0.35 }));
    bell.position.set(0, 1.02, 0);
    bell.userData.bell = true;
    frame.add(bell);
    frame.position.set(bx, by, bz);
    frame.rotation.y = yaw;
    frame.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    g.add(frame);
    this.world.collision.addBlocker({ x: bx, z: bz, r: 0.45, y0: by - 1, y1: by + 1.5 });
    this.world.forest.exclude(cx, cz, Math.max(...pts.map(([x, z]) => Math.hypot(x - cx, z - cz))) + 1);
    this.group.add(g);
    const item: CItem = {
      def, area, group: g, bulbs, threads, threadRanges: ranges, bell, state: initialState(def), solved: false,
      center: new THREE.Vector3(cx, ys[0], cz), starPos, blink: 0, bad: new Set(), badThreads: new Set(), theme, dirty: true, near: false,
    };
    this.items.push(item);
  }

  // ───────────────────────── interaction ─────────────────────────

  aim(camera: THREE.Camera): CTarget | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    this.raycaster.far = 4.2;
    let best: CTarget | null = null;
    let bd = Infinity;
    for (const it of this.items) {
      if (!it.near) continue;
      const hits = this.raycaster.intersectObjects([it.bulbs, it.bell], false);
      for (const h of hits) {
        if (h.distance >= bd) continue;
        if (h.object === it.bell) best = { item: it, bell: true };
        else if (h.instanceId !== undefined) best = { item: it, star: h.instanceId };
        bd = h.distance;
      }
      // generous picking for bulbs: nearest star to the ray within 0.25 m
      for (let i = 0; i < it.starPos.length; i++) {
        const d = this.raycaster.ray.distanceToPoint(it.starPos[i]);
        const along = it.starPos[i].clone().sub(this.raycaster.ray.origin).dot(this.raycaster.ray.direction);
        if (d < 0.25 && along > 0 && along < 4.2 && along < bd) {
          best = { item: it, star: i };
          bd = along;
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
    const p = it.starPos[t.star];
    audio.tile(!!it.state[t.star], Math.round(p.y * 3) % 7, t.star % 9, 7, 9, it.area);
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

  restore(id: string, s: string | undefined, solved: boolean) {
    const it = this.items.find((x) => x.def.id === id);
    if (!it) return;
    if (s && s.length === it.state.length) for (let i = 0; i < s.length; i++) if (it.def.stars[i].lock === undefined) it.state[i] = s[i] === '1' ? 1 : 0;
    it.solved = solved;
    it.dirty = true;
  }

  stateOf(it: CItem) {
    return stateString(it.state);
  }

  get solvedCount() {
    return this.items.filter((i) => i.solved).length;
  }

  update(dt: number, t: number, cam: THREE.Vector3) {
    this.cullTimer -= dt;
    if (this.cullTimer <= 0) {
      this.cullTimer = 0.4;
      for (const it of this.items) {
        const d = it.center.distanceTo(cam);
        it.near = d < 16;
        it.group.visible = d < 140;
        // sprites/threads only up close
        it.group.children.forEach((c) => {
          if ((c as THREE.Sprite).isSprite) c.visible = d < 45;
        });
        it.threads.visible = d < 90;
      }
    }
    const c = new THREE.Color();
    for (const it of this.items) {
      if (!it.group.visible) continue;
      if (it.blink > 0) {
        it.blink = Math.max(0, it.blink - dt);
        it.dirty = true;
      }
      if (!it.dirty && !it.solved) continue;
      const blinkOn = it.blink > 0 && Math.floor(it.blink * 4) % 2 === 0;
      const lit = new THREE.Color(it.theme.lit);
      for (let i = 0; i < it.state.length; i++) {
        if (blinkOn && it.bad.has(i)) c.setRGB(2.2, 0.15, 0.1);
        else if (it.solved) c.copy(new THREE.Color('#fff2cf')).multiplyScalar(2.2 + 0.4 * Math.sin(t * 2 + i));
        else if (it.state[i]) c.copy(lit).multiplyScalar(2.4);
        else c.setRGB(0.16, 0.16, 0.2);
        it.bulbs.setColorAt(i, c);
      }
      if (it.bulbs.instanceColor) it.bulbs.instanceColor.needsUpdate = true;
      const col = it.threads.geometry.attributes.color as THREE.BufferAttribute;
      it.threadRanges.forEach(([a, b], k) => {
        let r = 0.35, g = 0.33, bl = 0.42;
        if (blinkOn && it.badThreads.has(k)) [r, g, bl] = [2, 0.15, 0.1];
        else if (it.solved) [r, g, bl] = [1.6, 1.35, 0.9];
        else {
          const th = it.def.threads[k];
          if (it.state[th.a] && it.state[th.b]) [r, g, bl] = [0.9, 0.8, 0.6];
        }
        for (let v = a; v < b; v++) col.setXYZ(v, r, g, bl);
      });
      col.needsUpdate = true;
      it.dirty = false;
    }
  }
}

export { AREA_BY_ID };
