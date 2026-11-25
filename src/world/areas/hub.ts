/**
 * O Pátio das Nove Luzes — the central court. Holds the Hall of Tesselas (progress steles for
 * every area + the great mosaic), the eight totem receivers, the sealed door of the Hollow
 * (opens with 7 totems) and the plaza-floor secret.
 */
import * as THREE from 'three';
import { AreaCtx } from './common';
import { G, mtx, column, floorSlab, solidBox, wall, lantern } from '../arch';
import { M, mat } from '../materials';
import { HUB, CALDERA } from '../layout';
import type { World } from '../world';
import type { PanelManager } from '../../puzzle/panels';
import { AREAS, AREA_BY_ID, TEACHING_AREAS, type AreaId } from '../../data/areas';

export interface AreaProgressInfo {
  id: AreaId;
  solved: boolean[];
  totem: boolean;
  open: boolean;
}

export interface HubRuntime extends AreaCtx {
  setProgress(info: AreaProgressInfo[], secrets: { found: number; total: number }, lang: 'pt' | 'en'): void;
  openHollow(instant?: boolean): void;
  receivers: Map<AreaId, (on: boolean, instant?: boolean) => void>;
}

const STELE_AREAS: AreaId[] = ['prologue', 'kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins', 'citadel', 'echo', 'spire'];

function drawStele(canvas: HTMLCanvasElement, info: AreaProgressInfo | undefined, id: AreaId, lang: 'pt' | 'en') {
  const spec = AREA_BY_ID[id];
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#22232b');
  g.addColorStop(1, '#15161b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const lit = spec.lit;
  const solved = info?.solved ?? [];
  const n = solved.length;
  const done = solved.filter(Boolean).length;
  const complete = n > 0 && done === n;
  // border
  ctx.strokeStyle = complete ? '#f3d38a' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  // number + name
  ctx.textAlign = 'center';
  ctx.fillStyle = complete ? '#ffe7ae' : '#efe6d2';
  ctx.font = '700 46px "Cormorant Garamond", Georgia, serif';
  const num = spec.number > 0 ? ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][spec.number] : '·';
  ctx.fillText(num, W / 2, 70);
  ctx.font = '600 34px "Cormorant Garamond", Georgia, serif';
  const name = spec.name[lang];
  wrapText(ctx, name, W / 2, 118, W - 50, 36);
  if (spec.rule) {
    ctx.font = 'italic 600 28px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = lit;
    ctx.fillText(spec.rule[lang], W / 2, 200);
  }
  // tiles: one per panel
  if (info && !info.open) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '600 120px "Cormorant Garamond", Georgia, serif';
    ctx.fillText('?', W / 2, H / 2 + 80);
  } else {
    const cols = n > 20 ? 6 : 5;
    const rows = Math.ceil(n / cols);
    const cell = Math.min((W - 80) / cols, (H - 380) / Math.max(rows, 1));
    const ox = (W - cols * cell) / 2, oy = 240;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const x = ox + c * cell, y = oy + r * cell;
      ctx.beginPath();
      const rr = cell * 0.14;
      ctx.roundRect(x + cell * 0.1, y + cell * 0.1, cell * 0.8, cell * 0.8, rr);
      ctx.fillStyle = solved[i] ? lit : '#2b2d36';
      if (solved[i]) {
        ctx.shadowColor = lit;
        ctx.shadowBlur = 18;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  // counter
  ctx.fillStyle = complete ? '#ffe7ae' : '#d9cfbb';
  ctx.font = '700 54px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(n ? `${done} / ${n}` : '—', W / 2, H - 92);
  // totem mark
  if (spec.totem) {
    ctx.beginPath();
    ctx.moveTo(W / 2, H - 62);
    ctx.lineTo(W / 2 + 14, H - 40);
    ctx.lineTo(W / 2, H - 18);
    ctx.lineTo(W / 2 - 14, H - 40);
    ctx.closePath();
    ctx.fillStyle = info?.totem ? lit : 'rgba(255,255,255,0.15)';
    ctx.fill();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  if (lines.length > 1) yy -= (lh * (lines.length - 1)) / 2;
  for (const l of lines) {
    ctx.fillText(l, x, yy);
    yy += lh;
  }
}

export function buildHub(world: World, pm: PanelManager): HubRuntime {
  const a = new AreaCtx('hub', world, pm) as HubRuntime;
  const b = a.build;
  const pave = mat('hubPave', { color: '#d9d0bf', roughness: 0.88, detail: 0.2, scale: 0.9, pattern: 'blocks' });
  const stone = mat('hubStone', { color: '#e6dccb', roughness: 0.85, detail: 0.18, scale: 1.4 });
  const dark = mat('hubDark', { color: '#7b7466', roughness: 0.9, detail: 0.2, scale: 1.4 });
  const gold = M.gold();
  a.frame = stone;
  const Y = HUB.y;
  const cx = HUB.x, cz = HUB.z;

  // ── plaza ──
  b.batch.add(G.cyl(30, 30.6, 1.2, 64), pave, mtx(cx, Y - 0.58, cz));
  b.col.addFloor({ x: cx, z: cz, r: 30, top: Y + 0.02, bottom: Y - 1.2, surface: 'stone' });
  for (const [r, t] of [[29.2, 0.25], [18.5, 0.18], [12.6, 0.2]] as [number, number][]) {
    b.batch.add(G.torus(r, t, 96), dark, mtx(cx, Y + 0.0, cz, 0, 1, 1, 1, Math.PI / 2));
  }
  a.exclude(cx, cz, 34);

  // ── Hall of Tesselas: colonnade ring with steles ──
  const R = 11;
  const nCol = 12;
  for (let i = 0; i < nCol; i++) {
    const ang = (i / nCol) * Math.PI * 2;
    column(b, stone, cx + Math.cos(ang) * R, Y, cz + Math.sin(ang) * R, 6.2, 0.36);
  }
  // entablature (ring of beams)
  for (let i = 0; i < nCol; i++) {
    const a0 = (i / nCol) * Math.PI * 2, a1 = ((i + 1) / nCol) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * R, z0 = cz + Math.sin(a0) * R;
    const x1 = cx + Math.cos(a1) * R, z1 = cz + Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    b.batch.add(G.box(len + 0.9, 0.8, 1.2, 0.05), stone, mtx((x0 + x1) / 2, Y + 6.6, (z0 + z1) / 2, ry));
    b.batch.add(G.box(len + 1.0, 0.18, 1.4, 0.03), dark, mtx((x0 + x1) / 2, Y + 7.1, (z0 + z1) / 2, ry));
  }
  b.batch.add(G.torus(R, 0.12, 96), gold, mtx(cx, Y + 6.25, cz, 0, 1, 1, 1, Math.PI / 2));
  // central basin with the great crystal
  b.batch.add(G.cyl(3.4, 3.8, 0.9, 32), stone, mtx(cx, Y + 0.45, cz));
  b.batch.add(G.cyl(3.0, 3.0, 0.2, 32), dark, mtx(cx, Y + 0.92, cz));
  b.col.addSolidBox(cx, cz, 2.6, 2.6, Math.PI / 4, Y - 1, Y + 0.9);
  b.col.addBlocker({ x: cx, z: cz, r: 3.6, y0: Y - 1, y1: Y + 3 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.15, metalness: 0.1, emissive: new THREE.Color('#ffe2a8'), emissiveIntensity: 0.4 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), crystalMat);
  crystal.scale.set(1, 1.8, 1);
  crystal.position.set(cx, Y + 3.4, cz);
  crystal.castShadow = true;
  a.dynamic.add(crystal);
  // orbiting nine tiles around the crystal (one per language); they light up as totems are lit
  const orbit = new THREE.Group();
  orbit.position.set(cx, Y + 3.4, cz);
  a.dynamic.add(orbit);
  const orbitTiles: THREE.Mesh[] = [];
  const nineIds: AreaId[] = [...TEACHING_AREAS, 'echo'];
  nineIds.forEach((id, i) => {
    const m = new THREE.Mesh(G.box(0.42, 0.42, 0.08, 0.05), new THREE.MeshStandardMaterial({ color: '#2a2b33', emissive: new THREE.Color(AREA_BY_ID[id].lit), emissiveIntensity: 0, roughness: 0.4 }));
    const ang = (i / 9) * Math.PI * 2;
    m.position.set(Math.cos(ang) * 2.2, Math.sin(ang * 2) * 0.25, Math.sin(ang) * 2.2);
    m.lookAt(0, m.position.y, 0);
    orbit.add(m);
    orbitTiles.push(m);
  });

  // steles between columns (facing the centre)
  const steles = new Map<AreaId, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>();
  STELE_AREAS.forEach((id, i) => {
    const ang = ((i + 0.5) / nCol) * Math.PI * 2;
    const x = cx + Math.cos(ang) * (R - 0.2), z = cz + Math.sin(ang) * (R - 0.2);
    const yaw = Math.atan2(cx - x, cz - z);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 900;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const g = new THREE.Group();
    g.position.set(x, Y, z);
    g.rotation.y = yaw;
    const slab = new THREE.Mesh(G.box(1.75, 3.2, 0.3, 0.05), dark);
    slab.position.y = 0.4 + 1.6;
    slab.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.64), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
    face.position.set(0, 2.0, 0.155);
    const base = new THREE.Mesh(G.box(2.0, 0.4, 0.6, 0.04), stone);
    base.position.y = 0.2;
    g.add(slab, face, base);
    a.dynamic.add(g);
    world.collision.addBlocker({ x, z, hw: 1.0, hd: 0.35, rot: yaw, y0: Y - 1, y1: Y + 4 });
    steles.set(id, { canvas, tex });
    drawStele(canvas, undefined, id, 'pt');
    tex.needsUpdate = true;
  });

  // ── receivers around the plaza (one per teaching area, in its direction) ──
  const receivers = new Map<AreaId, (on: boolean, instant?: boolean) => void>();
  for (const id of TEACHING_AREAS) {
    const spec = AREA_BY_ID[id];
    const ang = Math.atan2(spec.anchor[1] - cz, spec.anchor[0] - cx);
    const x = cx + Math.cos(ang) * 24.5, z = cz + Math.sin(ang) * 24.5;
    b.batch.add(G.box(1.3, 0.5, 1.3, 0.05), stone, mtx(x, Y + 0.25, z, ang));
    b.batch.add(G.cyl(0.32, 0.45, 2.6, 6), stone, mtx(x, Y + 1.8, z));
    b.batch.add(G.torus(0.42, 0.05, 24), gold, mtx(x, Y + 3.35, z, 0, 1, 1, 1, Math.PI / 2));
    world.collision.addBlocker({ x, z, r: 0.7, y0: Y - 1, y1: Y + 4 });
    const cm = new THREE.MeshStandardMaterial({ color: '#3a3d48', emissive: new THREE.Color(spec.lit), emissiveIntensity: 0, roughness: 0.2 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), cm);
    c.scale.set(1, 1.5, 1);
    c.position.set(x, Y + 3.6, z);
    a.dynamic.add(c);
    let target = 0;
    let cur = 0;
    receivers.set(id, (on, instant) => {
      target = on ? 1 : 0;
      if (instant) cur = target;
    });
    a.onUpdate((dt, t) => {
      cur += (target - cur) * Math.min(1, dt * 1.5);
      cm.emissiveIntensity = cur * (2.2 + 0.3 * Math.sin(t * 2 + x));
      cm.color.set(cur > 0.5 ? '#ffffff' : '#3a3d48');
      c.rotation.y += dt * (0.3 + cur);
    });
  }
  a.receivers = receivers;

  // lanterns on the outer ring
  const glowWarm = M.glow('#ffd38a', 2.0);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + Math.PI / 16;
    lantern(b, M.iron(), glowWarm, cx + Math.cos(ang) * 28.4, Y, cz + Math.sin(ang) * 28.4, 2.2);
  }

  // ── the sealed door of the Hollow (in the gorge north of the court) ──
  const doorZ = HUB.z - 31;
  const gy = world.terrain.heightAt(0, doorZ);
  // flanking pylons
  solidBox(b, dark, -9.5, gy - 2, doorZ, 4, 18, 5, 0, { walk: false });
  solidBox(b, dark, 9.5, gy - 2, doorZ, 4, 18, 5, 0, { walk: false });
  b.batch.add(G.box(23, 2.2, 5.4, 0.08), dark, mtx(0, gy + 16.9, doorZ));
  wall(b, dark, -11.5, doorZ, -24, doorZ + 2, gy - 2, 14, 3);
  wall(b, dark, 11.5, doorZ, 24, doorZ + 2, gy - 2, 14, 3);
  const doorMat = mat('hollowDoor', { color: '#8d8578', roughness: 0.8, detail: 0.25, scale: 0.8, pattern: 'blocks' });
  const door = a.stoneDoor('hub.hollow', 0, gy, doorZ, 15, 14, 0, doorMat, 1.4);
  // eight sockets on the door: light up per totem
  const sockets = new Map<AreaId, THREE.MeshStandardMaterial>();
  TEACHING_AREAS.forEach((id, i) => {
    const sm = new THREE.MeshStandardMaterial({ color: '#2b2c33', emissive: new THREE.Color(AREA_BY_ID[id].lit), emissiveIntensity: 0, roughness: 0.3 });
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), sm);
    const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
    s.position.set(Math.cos(ang) * 3.6, Math.sin(ang) * 3.6 + 0.6, 0.75);
    door.mesh.add(s);
    sockets.set(id, sm);
  });
  const ringM = new THREE.Mesh(G.torus(3.6, 0.12, 64), gold);
  ringM.position.set(0, 0.6, 0.72);
  door.mesh.add(ringM);
  a.openHollow = (instant = false) => door.openNow(!instant);
  const baseReceivers = new Map(receivers);
  for (const [id, fn] of baseReceivers) {
    receivers.set(id, (on, instant) => {
      fn(on, instant);
      const sm = sockets.get(id);
      if (sm) {
        sm.emissiveIntensity = on ? 2.4 : 0;
        sm.color.set(on ? '#ffffff' : '#2b2c33');
      }
      const idx = nineIds.indexOf(id);
      const tile = orbitTiles[idx];
      if (tile) (tile.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.2 : 0;
    });
  }

  // gentle animation of the central crystal
  a.onUpdate((dt, t) => {
    crystal.rotation.y += dt * 0.25;
    crystal.position.y = Y + 3.4 + Math.sin(t * 0.8) * 0.12;
    orbit.rotation.y -= dt * 0.12;
  });

  a.setProgress = (info, secrets, lang) => {
    for (const id of STELE_AREAS) {
      const st = steles.get(id);
      if (!st) continue;
      drawStele(st.canvas, info.find((x) => x.id === id), id, lang);
      st.tex.needsUpdate = true;
    }
    const lit = info.filter((x) => TEACHING_AREAS.includes(x.id) && x.totem).length;
    crystalMat.emissiveIntensity = 0.4 + lit * 0.35;
    void secrets;
  };

  // trees and benches around the court
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + 0.2;
    const r = 38 + (i % 3) * 4;
    const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
    if (z < cz - 20) continue;
    world.forest.add(i % 2 ? 'oak' : 'blossom', x, z, 1.1);
  }
  void CALDERA;
  void AREAS;
  return a;
}

export { floorSlab };
