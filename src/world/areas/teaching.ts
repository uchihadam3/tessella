/**
 * The eight open teaching areas. Each has the same didactic spine (intro → practice → trial →
 * heart, one powered chain) but its own landscape and set-pieces.
 */
import * as THREE from 'three';
import { AreaCtx, yawToward } from './common';
import { G, mtx, column, solidBox, wall, lantern, floorSlab, archGeometry, gableRoof, pagodaRoof, stairs, type BuildCtx } from '../arch';
import { M, mat } from '../materials';
import { ANCHORS, HUB } from '../layout';
import type { World } from '../world';
import type { Panel, PanelManager } from '../../puzzle/panels';
import type { PuzzleDef } from '../../puzzle/types';
import type { AreaId } from '../../data/areas';
import { rng } from '../noise';
import { audio } from '../../audio';
import { drawGlyph } from '../../puzzle/glyphs';

// ───────────────────────── station helpers ─────────────────────────

/** Panels in a line centred at (cx,cz) along angle `ang` (radians, 0 = +x), all facing (fx,fz). */
function row(a: AreaCtx, defs: PuzzleDef[], group: string, cx: number, cz: number, ang: number, spacing: number, fx: number, fz: number, frame?: THREE.Material): Panel[] {
  const n = defs.length;
  return defs.map((d, i) => {
    const t = i - (n - 1) / 2;
    const x = cx + Math.cos(ang) * spacing * t, z = cz + Math.sin(ang) * spacing * t;
    return a.panel(d, { x, z, yaw: yawToward(x, z, fx + Math.cos(ang) * spacing * t, fz + Math.sin(ang) * spacing * t), frame }, group);
  });
}

/**
 * The introduction: one row across the way in, or — when it is long — two rows, the first farther
 * out (you meet it first), the second nearer the gateway, all facing the way you come from.
 */
function introRows(a: AreaCtx, ax: { ang: number; f: { x: number; z: number } }, ip: { x: number; z: number }, key = 'intro'): Panel[] {
  const defs = a.group(key);
  const ang = ax.ang + Math.PI / 2;
  if (defs.length <= 11) return row(a, defs, key, ip.x, ip.z, ang, 3.1, ip.x - ax.f.x * 6, ip.z - ax.f.z * 6);
  const half = Math.ceil(defs.length / 2);
  const ox = ip.x - ax.f.x * 7, oz = ip.z - ax.f.z * 7;
  const first = row(a, defs.slice(0, half), key, ox, oz, ang, 3.1, ox - ax.f.x * 6, oz - ax.f.z * 6);
  const second = row(a, defs.slice(half), key, ip.x, ip.z, ang, 3.1, ip.x - ax.f.x * 6, ip.z - ax.f.z * 6);
  return [...first, ...second];
}

/** Panels on an arc around (cx,cz), facing the centre (inward) or outward. */
function arc(a: AreaCtx, defs: PuzzleDef[], group: string, cx: number, cz: number, r: number, a0: number, a1: number, inward = true, frame?: THREE.Material, yFn?: (x: number, z: number) => number, maxR?: number): Panel[] {
  const n = defs.length;
  // keep ~3.6 m between neighbours: grow the radius, or (on platforms) widen the arc instead
  const gap = 3.6;
  const span = Math.abs(a1 - a0) || 1;
  const need = ((n - 1) * gap) / span;
  if (need > r) {
    if (maxR !== undefined && need > maxR) {
      r = maxR;
      const newSpan = Math.min(Math.PI * 1.75, ((n - 1) * gap) / r);
      const mid = (a0 + a1) / 2;
      a0 = mid - newSpan / 2;
      a1 = mid + newSpan / 2;
    } else r = need;
  }
  return defs.map((d, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = a0 + (a1 - a0) * t;
    const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
    const yaw = inward ? yawToward(x, z, cx, cz) : yawToward(cx, cz, x, z);
    return a.panel(d, { x, z, yaw, frame, y: yFn ? yFn(x, z) : undefined }, group);
  });
}

/** Direction helpers relative to the hub → anchor axis of an area. */
function axes(id: AreaId) {
  const A = ANCHORS[id];
  const dx = A.x - HUB.x, dz = A.z - HUB.z;
  const l = Math.hypot(dx, dz);
  const f = { x: dx / l, z: dz / l }; // forward (away from hub)
  const r = { x: -f.z, z: f.x }; // right-hand side
  const at = (fw: number, side: number) => ({ x: A.x + f.x * fw + r.x * side, z: A.z + f.z * fw + r.z * side });
  const ang = Math.atan2(f.z, f.x);
  return { A, f, r, at, ang };
}

/** A stone gateway arch with a door that sinks when the intro chain is done. */
function gateway(a: AreaCtx, x: number, z: number, faceAng: number, w: number, h: number, stoneMat: THREE.Material, doorMat: THREE.Material) {
  const b = a.build;
  const y = a.y(x, z);
  const ry = -faceAng + Math.PI / 2; // arch spans perpendicular to the approach
  b.batch.add(archGeometry(w, h, 1.1, 1.6), stoneMat, mtx(x, y - 0.3, z, ry));
  const px = Math.cos(ry) * (w / 2 + 0.55), pz = -Math.sin(ry) * (w / 2 + 0.55);
  a.world.collision.addBlocker({ x: x + px, z: z + pz, r: 0.9, y0: y - 1, y1: y + h + 2 });
  a.world.collision.addBlocker({ x: x - px, z: z - pz, r: 0.9, y0: y - 1, y1: y + h + 2 });
  a.exclude(x, z, w);
  return a.stoneDoor(`${a.id}.gate`, x, y - 0.3, z, w - 0.1, h - w / 2 + 0.2, ry, doorMat, 0.45);
}


/** The 'mastery' station: a half ring of panels opening towards the hub side. */
function masteryArc(a: AreaCtx, ax: ReturnType<typeof axes>, fw: number, side: number, y?: number): Panel[] {
  const m = ax.at(fw, side);
  const yy = y;
  return arc(a, a.group('mastery'), 'mastery', m.x, m.z, 8, ax.ang + Math.PI * 0.5, ax.ang + Math.PI * 1.5, true, undefined, yy !== undefined ? () => yy : undefined);
}

function finishChain(a: AreaCtx, groups: Panel[][], gateAfterIntro?: { openNow: () => void }) {
  const all = groups.flat();
  a.chain(all);
  const lastIntro = groups[0][groups[0].length - 1];
  if (gateAfterIntro && lastIntro) lastIntro.onSolved.push(() => gateAfterIntro.openNow());
}

function scatterBox(b: BuildCtx, matl: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry: number) {
  b.batch.add(G.box(w, h, d, 0.04), matl, mtx(x, y + h / 2, z, ry));
}

// ───────────────────────── 1. Kinship — the Autumn Grove ─────────────────────────

export function buildKinship(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('kinship', world, pm);
  const b = a.build;
  const stone = mat('kinStone', { color: '#b9ab94', roughness: 0.92, detail: 0.28, scale: 1.2, pattern: 'blocks' });
  const moss = mat('kinMoss', { color: '#8f8a6a', roughness: 0.95, detail: 0.3, scale: 1.5 });
  a.frame = mat('kinFrame', { color: '#a38b6d', roughness: 0.85, detail: 0.22, scale: 1.4 });
  const ax = axes('kinship');
  // gate + intro row in front of it
  const gp = ax.at(-46, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.4, 6.2, stone, M.woodDark());
  const ip = ax.at(-55, 0);
  const intro = introRows(a, ax, ip);
  // low mossy wall behind the intro row
  const w0 = ax.at(-51.5, -13), w1 = ax.at(-51.5, 13);
  wall(b, moss, w0.x, w0.z, ax.at(-51.5, -3).x, ax.at(-51.5, -3).z, a.y(w0.x, w0.z) - 0.5, 1.6, 0.7, { cap: stone });
  wall(b, moss, ax.at(-51.5, 3).x, ax.at(-51.5, 3).z, w1.x, w1.z, a.y(w1.x, w1.z) - 0.5, 1.6, 0.7, { cap: stone });
  // the brook: a strip of water crossing the grove, with stepping stones (practice)
  const brookPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p = ax.at(-30 + t * 60, -32 + t * 64 + Math.sin(t * 7) * 5);
    brookPts.push(new THREE.Vector3(p.x, 0, p.z));
  }
  const brook = new THREE.CatmullRomCurve3(brookPts);
  const bw = new THREE.Group();
  for (let i = 0; i < 60; i++) {
    const p = brook.getPoint(i / 60), q = brook.getPoint((i + 1) / 60);
    const y = Math.min(a.y(p.x, p.z), a.y(q.x, q.z)) + 0.12;
    const len = p.distanceTo(q) + 0.4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len), new THREE.MeshStandardMaterial({ color: '#4fa7b8', roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(q.x - p.x, q.z - p.z);
    m.position.set((p.x + q.x) / 2, y, (p.z + q.z) / 2);
    bw.add(m);
  }
  a.dynamic.add(bw);
  {
    const mid = brook.getPoint(0.5);
    audio.addSource('brook', mid.x, a.y(mid.x, mid.z) + 0.3, mid.z, 34);
  }
  const pr = ax.at(-12, -14);
  const practice = arc(a, a.group('practice'), 'practice', pr.x, pr.z, 8, ax.ang + Math.PI * 0.55, ax.ang + Math.PI * 1.25, true);
  // ring of standing stones around the giant tree (trial)
  const tr = ax.at(8, 16);
  world.forest.add('autumn', tr.x, tr.z, 2.6);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    const x = tr.x + Math.cos(ang) * 11, z = tr.z + Math.sin(ang) * 11;
    solidBox(b, stone, x, a.y(x, z) - 0.4, z, 0.9, 2.6 + (i % 3) * 0.5, 0.7, ang, { walk: false });
  }
  const trial = arc(a, a.group('trial'), 'trial', tr.x, tr.z, 7.5, ax.ang + Math.PI * 0.75, ax.ang + Math.PI * 1.35, true);
  // the heart: round platform with steps and the totem
  const hp = ax.at(30, -4);
  const hy = a.y(hp.x, hp.z) + 0.9;
  b.batch.add(G.cyl(9, 9.6, 1.6, 40), stone, mtx(hp.x, hy - 0.8, hp.z));
  b.col.addFloor({ x: hp.x, z: hp.z, r: 9, top: hy, bottom: hy - 2, surface: 'stone' });
  for (let i = 0; i < 3; i++) b.batch.add(G.cyl(9.6 + i * 0.7, 10 + i * 0.7, 0.3, 40), moss, mtx(hp.x, hy - 0.95 - i * 0.3, hp.z));
  a.exclude(hp.x, hp.z, 12);
  const heart = arc(a, a.group('heart'), 'heart', hp.x, hp.z, 5.2, ax.ang + Math.PI * 0.7, ax.ang + Math.PI * 1.3, true, undefined, () => hy, 6);
  a.addTotem(hp.x + ax.f.x * 2.5, hp.z + ax.f.z * 2.5, hy);
  const mastery = masteryArc(a, ax, -10, 30);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  // lanterns along the path inside
  for (let i = 0; i < 6; i++) {
    const p = ax.at(-40 + i * 12, (i % 2 ? 1 : -1) * 4.5);
    lantern(b, M.woodDark(), M.glow('#ffb35a', 2.2), p.x, a.y(p.x, p.z), p.z, 1.5);
  }
  // falling leaves
  addParticles(a, ax.A.x, ax.A.z, 70, 18, ['#e2662f', '#f0a033', '#c9412a', '#f2c14e'], 'leaves');
  return a;
}

// ───────────────────────── 2. Measure — the Terraces ─────────────────────────

export function buildMeasure(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('measure', world, pm);
  const b = a.build;
  const stone = mat('meaStone', { color: '#c3bba6', roughness: 0.9, detail: 0.25, scale: 1.3, pattern: 'blocks' });
  a.frame = mat('meaFrame', { color: '#b7ae96', roughness: 0.85, detail: 0.2, scale: 1.4 });
  const ax = axes('measure');
  const gp = ax.at(-48, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.4, 6.4, stone, M.wood());
  const ip = ax.at(-56, 0);
  const intro = introRows(a, ax, ip);
  // paddies: shallow water planes on several terrace steps
  const rnd = rng(41);
  for (let i = 0; i < 26; i++) {
    const p = ax.at(-30 + rnd() * 70, -40 + rnd() * 80);
    const y = a.y(p.x, p.z);
    const ok = [[2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dz]) => Math.abs(a.y(p.x + dx, p.z + dz) - y) < 0.3);
    if (!ok) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5 + rnd() * 4, 3 + rnd() * 3), new THREE.MeshStandardMaterial({ color: '#7fc7c9', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rnd() * Math.PI;
    m.position.set(p.x, y + 0.06, p.z);
    a.dynamic.add(m);
  }
  const pr = ax.at(-18, 16);
  const practice = row(a, a.group('practice'), 'practice', pr.x, pr.z, ax.ang, 4.2, pr.x - ax.r.x * 8, pr.z - ax.r.z * 8);
  // waterfall: a glowing sheet down a cliff face to the east
  const wf = ax.at(14, -22);
  const wy = a.y(wf.x, wf.z);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(4, 9, 1, 16), new THREE.MeshStandardMaterial({ color: '#d8f3ff', emissive: '#6fb8d8', emissiveIntensity: 0.25, transparent: true, opacity: 0.75, roughness: 0.2 }));
  fall.position.set(wf.x, wy + 4.5, wf.z);
  fall.rotation.y = ax.ang - Math.PI / 2;
  a.dynamic.add(fall);
  audio.addSource('waterfall', wf.x, wy + 3, wf.z, 48);
  a.onUpdate((dt) => {
    const mm = fall.material as THREE.MeshStandardMaterial;
    mm.opacity = 0.65 + 0.1 * Math.sin(performance.now() / 300);
    void dt;
  });
  const tr = ax.at(10, -12);
  const trial = arc(a, a.group('trial'), 'trial', tr.x, tr.z, 7, ax.ang + Math.PI * 0.6, ax.ang + Math.PI * 1.1, true);
  // the top shrine: a small pagoda on the highest terrace
  const hp = ax.at(34, 8);
  const hy = a.y(hp.x, hp.z) + 0.6;
  floorSlab(b, stone, hp.x, hy, hp.z, 18, 18, ax.ang, 3);
  a.exclude(hp.x, hp.z, 12);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) column(b, M.woodRed(), hp.x + sx * 3, hy, hp.z + sz * 3, 4.2, 0.22);
  b.batch.add(pagodaRoof(9, 2.6, 0.5), M.roofTeal(), mtx(hp.x, hy + 5.4, hp.z, ax.ang));
  b.batch.add(pagodaRoof(5.4, 2.0, 0.45), M.roofTeal(), mtx(hp.x, hy + 7.3, hp.z, ax.ang));
  const heart = arc(a, a.group('heart'), 'heart', hp.x, hp.z, 6.6, ax.ang + Math.PI * 0.65, ax.ang + Math.PI * 1.35, true, undefined, () => hy, 6);
  a.addTotem(hp.x, hp.z, hy);
  const mastery = masteryArc(a, ax, 14, 28);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  addParticles(a, ax.A.x, ax.A.z, 50, 14, ['#ffffff', '#e8ffd0'], 'pollen');
  return a;
}

// ───────────────────────── 3. Mold — the Quarry ─────────────────────────

const POLY: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2], [1, 1]], // T
  [[0, 0], [1, 0], [2, 0], [2, 1]], // L
  [[0, 1], [0, 2], [1, 0], [1, 1]], // S
  [[0, 0], [0, 1], [1, 0], [1, 1]], // O
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I
];

export function buildMold(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('mold', world, pm);
  const b = a.build;
  const marble = M.marble();
  const block = mat('moldBlock', { color: '#e9e2d3', roughness: 0.75, detail: 0.2, scale: 1.1, pattern: 'veins' });
  a.frame = mat('moldFrame', { color: '#ddd5c4', roughness: 0.6, detail: 0.15, scale: 1.2, pattern: 'veins' });
  const ax = axes('mold');
  const gp = ax.at(-40, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.6, 6.4, marble, M.woodDark());
  const ip = ax.at(-48, 0);
  const intro = introRows(a, ax, ip);
  // giant polyomino blocks on the quarry floor
  const rnd = rng(77);
  for (let i = 0; i < 14; i++) {
    const p = ax.at(-20 + rnd() * 50, -26 + rnd() * 52);
    if (Math.hypot(p.x - ax.A.x, p.z - ax.A.z) < 7) continue;
    const shape = POLY[i % POLY.length];
    const s = 1.6 + rnd() * 0.8;
    const ry = Math.floor(rnd() * 4) * (Math.PI / 2);
    const y = a.y(p.x, p.z);
    for (const [r, c] of shape) {
      const lx = (c - 1) * s, lz = (r - 1) * s;
      const x = p.x + lx * Math.cos(ry) + lz * Math.sin(ry);
      const z = p.z - lx * Math.sin(ry) + lz * Math.cos(ry);
      solidBox(b, block, x, y - 0.2, z, s * 0.98, s * 0.98, s * 0.98, ry);
    }
    a.exclude(p.x, p.z, s * 3);
  }
  // cranes: wooden A-frames with a hanging block
  for (let k = 0; k < 2; k++) {
    const p = ax.at(-6 + k * 26, k ? 18 : -20);
    const y = a.y(p.x, p.z);
    const wood = M.wood();
    for (const sgn of [-1, 1]) {
      const g = G.box(0.35, 11, 0.35);
      b.batch.add(g, wood, mtx(p.x + sgn * 2.2, y + 5.2, p.z, 0, 1, 1, 1, 0, sgn * 0.2));
    }
    b.batch.add(G.box(0.4, 0.4, 9), wood, mtx(p.x, y + 10.6, p.z + 2.5));
    b.batch.add(G.box(0.05, 4, 0.05), M.iron(), mtx(p.x, y + 8.4, p.z + 6));
    b.batch.add(G.box(1.6, 1.6, 1.6), block, mtx(p.x, y + 5.6, p.z + 6));
    a.world.collision.addBlocker({ x: p.x - 2.2, z: p.z, r: 0.4, y0: y, y1: y + 10 });
    a.world.collision.addBlocker({ x: p.x + 2.2, z: p.z, r: 0.4, y0: y, y1: y + 10 });
  }
  const pr = ax.at(-14, 12);
  const practice = arc(a, a.group('practice'), 'practice', pr.x, pr.z, 7.5, ax.ang + Math.PI * 0.5, ax.ang + Math.PI * 1.1, true);
  const tr = ax.at(4, -14);
  const trial = arc(a, a.group('trial'), 'trial', tr.x, tr.z, 6.5, ax.ang + Math.PI * 0.85, ax.ang + Math.PI * 1.4, true);
  // heart: a tower of stacked blocks with stairs, totem on top
  const hp = ax.at(24, 2);
  const hy0 = a.y(hp.x, hp.z);
  const H1 = 3.2;
  solidBox(b, block, hp.x, hy0 - 0.5, hp.z, 14, H1 + 0.5, 14, -ax.ang);
  const st = stairs(b, marble, hp.x - ax.f.x * 10.6, hy0, hp.z - ax.f.z * 10.6, Math.atan2(-ax.f.x, -ax.f.z), 3.2, H1 / 8, 0.45, 8);
  void st;
  a.exclude(hp.x, hp.z, 12);
  const heart = arc(a, a.group('heart'), 'heart', hp.x, hp.z, 4.6, ax.ang + Math.PI * 0.6, ax.ang + Math.PI * 1.4, true, undefined, () => hy0 + H1, 6);
  a.addTotem(hp.x + ax.f.x * 2.2, hp.z + ax.f.z * 2.2, hy0 + H1);
  const mastery = masteryArc(a, ax, -24, -16);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  addParticles(a, ax.A.x, ax.A.z, 40, 10, ['#fffaf0'], 'dust');
  return a;
}

// ───────────────────────── 4. Contour — the Hedge Garden ─────────────────────────

export function buildContour(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('contour', world, pm);
  const b = a.build;
  const hedge = M.hedge();
  const white = mat('contourGravel', { color: '#eee9dd', roughness: 0.95, detail: 0.3, scale: 6 });
  const stone = mat('contourStone', { color: '#e8e2d6', roughness: 0.8, detail: 0.15, scale: 1.4 });
  a.frame = stone;
  const ax = axes('contour');
  const gp = ax.at(-44, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.2, 6.0, stone, M.iron());
  // hedge wall along the garden front (with the gate opening)
  const hw = (s0: number, s1: number, fw: number, h = 2.4) => {
    const p0 = ax.at(fw, s0), p1 = ax.at(fw, s1);
    const y = Math.min(a.y(p0.x, p0.z), a.y(p1.x, p1.z));
    wall(b, hedge, p0.x, p0.z, p1.x, p1.z, y - 0.3, h, 1.4);
  };
  hw(-34, -3.2, -44);
  hw(3.2, 34, -44);
  const ip = ax.at(-52, 0);
  const intro = introRows(a, ax, ip);
  // gravel avenue + parterres (low hedges in a geometric pattern)
  const g0 = ax.at(-10, 0);
  floorSlab(b, white, g0.x, a.y(g0.x, g0.z) + 0.05, g0.z, 8, 64, -ax.ang + Math.PI / 2, 0.3, 'gravel');
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const c = ax.at(-30 + k * 16, side * 14);
      const y = a.y(c.x, c.z);
      for (let e = 0; e < 4; e++) {
        const ang = ax.ang + (e * Math.PI) / 2;
        const p0 = { x: c.x + Math.cos(ang) * 5 - Math.sin(ang) * 5, z: c.z + Math.sin(ang) * 5 + Math.cos(ang) * 5 };
        const p1 = { x: c.x + Math.cos(ang) * 5 + Math.sin(ang) * 5, z: c.z + Math.sin(ang) * 5 - Math.cos(ang) * 5 };
        wall(b, hedge, p0.x, p0.z, p1.x, p1.z, y - 0.2, 0.9, 0.8);
      }
      world.forest.add('cypress', c.x, c.z, 0.7);
    }
  }
  // practice: inside a small maze of hedges
  const pr = ax.at(-14, 14);
  const practice = row(a, a.group('practice'), 'practice', pr.x, pr.z, ax.ang, 3.6, pr.x - ax.r.x * 6, pr.z - ax.r.z * 6);
  // fountain (trial ring)
  const fp = ax.at(6, -8);
  const fy = a.y(fp.x, fp.z);
  b.batch.add(G.cyl(4.6, 4.9, 0.8, 40), stone, mtx(fp.x, fy + 0.4, fp.z));
  b.col.addBlocker({ x: fp.x, z: fp.z, r: 4.7, y0: fy - 1, y1: fy + 0.8 });
  b.batch.add(G.cyl(0.6, 0.9, 2.2, 16), stone, mtx(fp.x, fy + 1.1, fp.z));
  b.batch.add(G.cyl(1.8, 0.4, 0.4, 24), stone, mtx(fp.x, fy + 2.3, fp.z));
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.3, 40), new THREE.MeshStandardMaterial({ color: '#6cc6d8', roughness: 0.05, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(fp.x, fy + 0.7, fp.z);
  a.dynamic.add(water);
  audio.addSource('fountain', fp.x, fy + 1.2, fp.z, 26);
  const trial = arc(a, a.group('trial'), 'trial', fp.x, fp.z, 8.2, ax.ang + Math.PI * 0.2, ax.ang + Math.PI * 0.8, true);
  // gazebo (heart)
  const hp = ax.at(26, 4);
  const hy = a.y(hp.x, hp.z) + 0.5;
  b.batch.add(G.cyl(8, 8.4, 1.0, 40), stone, mtx(hp.x, hy - 0.5, hp.z));
  b.col.addFloor({ x: hp.x, z: hp.z, r: 8, top: hy, bottom: hy - 2 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    column(b, stone, hp.x + Math.cos(ang) * 7.2, hy, hp.z + Math.sin(ang) * 7.2, 5, 0.26);
  }
  b.batch.add(G.torus(7.2, 0.35, 48), stone, mtx(hp.x, hy + 5.1, hp.z, 0, 1, 1, 1, Math.PI / 2));
  const dome = new THREE.SphereGeometry(7.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  b.batch.add(dome, M.roofTeal(), mtx(hp.x, hy + 5.2, hp.z, 0, 1, 0.45, 1));
  a.exclude(hp.x, hp.z, 11);
  const heart = arc(a, a.group('heart'), 'heart', hp.x, hp.z, 4.4, ax.ang + Math.PI * 0.65, ax.ang + Math.PI * 1.35, true, undefined, () => hy, 6);
  a.addTotem(hp.x + ax.f.x * 1.6, hp.z + ax.f.z * 1.6, hy);
  const mastery = masteryArc(a, ax, -22, -20);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  addParticles(a, ax.A.x, ax.A.z, 40, 12, ['#ffffff', '#ffd1dc'], 'pollen');
  return a;
}

// ───────────────────────── 5. Mosaic — the Sand Temple ─────────────────────────

export function buildMosaic(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('mosaic', world, pm);
  const b = a.build;
  const sand = M.sandstone();
  const sandS = M.sandSmooth();
  a.frame = sandS;
  const ax = axes('mosaic');
  const gp = ax.at(-40, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.4, 6.6, sand, M.woodDark());
  // temple court: raised square platform with a colonnade; the front half keeps its old ring
  // mosaic (three windows of it, framed in gold, are the heart's drawings)
  const C = ax.at(0, 0);
  const cy = a.y(C.x, C.z) + 0.8;
  const rot = -ax.ang;
  floorSlab(b, sand, C.x, cy, C.z, 40, 40, rot, 2.5);
  const tileMats = [mat('mosT', { color: '#3fb6b8', roughness: 0.4, detail: 0.08, scale: 3 }), mat('mosG', { color: '#d9a441', roughness: 0.4, detail: 0.08, scale: 3 }), mat('mosW', { color: '#efe4cc', roughness: 0.5, detail: 0.08, scale: 3 })];
  const L = (fw: number, side: number) => ax.at(fw, side);
  for (let i = -9; i <= -1; i++) {
    for (let j = -9; j <= 9; j++) {
      const d = Math.max(Math.abs(i), Math.abs(j));
      const k = (d + (Math.abs(i) === Math.abs(j) ? 1 : 0)) % 3;
      const q = L(i * 1.2, j * 1.2);
      b.batch.add(G.box(1.12, 0.06, 1.12), tileMats[k], mtx(q.x, cy + 0.0, q.z, rot));
    }
  }
  for (let i = 0; i < 16; i++) {
    const side = Math.floor(i / 4), k = i % 4;
    const t = -15 + k * 10;
    const local: [number, number] = side === 0 ? [t, -17] : side === 1 ? [17, t] : side === 2 ? [-t, 17] : [-17, -t];
    const q = L(local[0], local[1]);
    column(b, sand, q.x, cy, q.z, 6.5, 0.5);
  }
  // the sanctuary at the far side, tall enough to look down on the court from its roof
  const S = ax.at(28, 0);
  const sy = a.y(S.x, S.z) + 0.8;
  const roofY = sy + 9;
  solidBox(b, sand, S.x, sy - 1, S.z, 18, 10, 18, rot);
  for (let k = 0; k < 4; k++) solidBox(b, sandS, S.x, roofY + k * 1.2, S.z, 6 - k * 1.3, 1.2, 6 - k * 1.3, rot);
  // stairs up along its flank
  const steps = 20, run = 0.6;
  const stBase = L(22 - steps * run, -10.35);
  stairs(b, sandS, stBase.x, cy, stBase.z, Math.atan2(-ax.f.x, -ax.f.z), 2.6, (roofY - cy) / steps, run, steps);
  const land = L(22.6, -10.35);
  solidBox(b, sandS, land.x, cy, land.z, 1.4, roofY - cy, 2.6, rot);

  // ── 0. before the gate: the language, taught one idea at a time ──
  const gateG = introRows(a, ax, ax.at(-48, 0), 'gate');

  // ── 1. light: stone pergolas along the avenue; their lattice draws the answer on the floor ──
  const buried: Record<string, string> = { 'mosaic.light.2': '..../..../..??/..??', 'mosaic.light.3': '..../..../????/????' };
  const light = a.group('light').map((def, i) => {
    const fw = i < 2 ? -34 : -25;
    const sd = i % 2 === 0 ? 1 : -1;
    if (def.targetDisplay !== 'world') {
      const P = L(fw, sd * 4);
      return a.panel(def, { x: P.x, z: P.z, yaw: yawToward(P.x, P.z, P.x - ax.f.x, P.z - ax.f.z) }, 'light');
    }
    return pergolaStation(a, def, 'light', L(fw, sd * 3.6), { x: ax.r.x * sd, z: ax.r.z * sd }, sand, sandS, buried[def.id]);
  });

  // ── 2. the watchtower in the dunes: fields of glazed flagstones seen from its top ──
  const T = L(4, -36);
  const ty = a.y(T.x, T.z) - 0.3;
  const TH = 7.4, topY = ty + TH;
  solidBox(b, sand, T.x, ty, T.z, 7, TH, 7, rot);
  for (const [cx, cz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const q = { x: T.x + ax.f.x * cx * 3.2 + ax.r.x * cz * 3.2, z: T.z + ax.f.z * cx * 3.2 + ax.r.z * cz * 3.2 };
    solidBox(b, sandS, q.x, topY, q.z, 0.6, 0.9, 0.6, rot, { walk: false });
  }
  // stairs along the tower's court-facing side, rising towards the hub
  const tSteps = 17, tRun = 0.55;
  const tBase = { x: T.x + ax.r.x * 4.75 + ax.f.x * (tSteps * tRun - 2.9), z: T.z + ax.r.z * 4.75 + ax.f.z * (tSteps * tRun - 2.9) };
  stairs(b, sandS, tBase.x, ty, tBase.z, Math.atan2(ax.f.x, ax.f.z), 2.5, TH / tSteps, tRun, tSteps);
  const tLand = { x: T.x + ax.r.x * 4.75 - ax.f.x * 3.6, z: T.z + ax.r.z * 4.75 - ax.f.z * 3.6 };
  solidBox(b, sandS, tLand.x, ty, tLand.z, 1.6, TH, 2.5, rot);
  a.exclude(T.x, T.z, 10);
  // three fields around it (the fourth side has the stairs)
  const towerDirs = [{ x: -ax.r.x, z: -ax.r.z }, { x: -ax.f.x, z: -ax.f.z }, { x: ax.f.x, z: ax.f.z }];
  const tower = a.group('tower').map((def, i) => {
    const v = towerDirs[i];
    const u = { x: -v.z, z: v.x };
    // the panel at the left end of its edge, turned towards the middle of the top
    const P = { x: T.x + v.x * 2.3 - u.x * 2.15, z: T.z + v.z * 2.3 - u.z * 2.15 };
    const panel = a.panel(def, { x: P.x, z: P.z, y: topY, yaw: yawToward(P.x, P.z, T.x + v.x * 1.2, T.z + v.z * 1.2) }, 'tower');
    if (def.targetDisplay !== 'world') return panel;
    const cell = 1.8;
    const F = { x: T.x + v.x * (9.6 + (def.h * cell) / 2), z: T.z + v.z * (9.6 + (def.h * cell) / 2) };
    flagField(a, def, F, v, cell, sand, i === 1);
    panel.view.root.userData.clue = { x: T.x + v.x * 3.0, z: T.z + v.z * 3.0, tx: F.x, tz: F.z };
    return panel;
  });

  // ── 3. the roof: boards of glazed tiles below each edge, seen from the brink ──
  const roofDefs = a.group('roof');
  // one board below each edge of the roof — the left one (where the stairs arrive), the court in
  // front, the right, the back — and one panel at that edge: you stand at the brink looking down
  // at the board, the panel just to your left, turned towards you. From each edge only its own
  // board can be seen.
  const edges = [{ x: -ax.r.x, z: -ax.r.z }, { x: -ax.f.x, z: -ax.f.z }, { x: ax.r.x, z: ax.r.z }, { x: ax.f.x, z: ax.f.z }];
  const roof = roofDefs.map((def, i) => {
    const v = edges[i % 4];
    const u = { x: -v.z, z: v.x };
    const V = { x: S.x + v.x * 8.3, z: S.z + v.z * 8.3 };
    const depth = def.h * 1.1;
    const B = { x: S.x + v.x * (9 + 4.6 + depth / 2), z: S.z + v.z * (9 + 4.6 + depth / 2) };
    const P = { x: V.x - u.x * 1.7 - v.x * 0.7, z: V.z - u.z * 1.7 - v.z * 0.7 };
    const panel = a.panel(def, { x: P.x, z: P.z, y: roofY, yaw: yawToward(P.x, P.z, V.x - v.x * 0.6, V.z - v.z * 0.6) }, 'roof');
    let by = cy;
    if (i !== 1) {
      // outside the court: a paved pad on the sand for the board
      const half = (Math.max(def.w, def.h) * 1.1) / 2 + 1.0;
      let top = -Infinity;
      for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) top = Math.max(top, a.y(B.x + dx * half, B.z + dz * half));
      by = top + 0.15;
      floorSlab(b, sand, B.x, by, B.z, half * 2, half * 2, Math.atan2(-v.x, -v.z), 1.4);
      a.exclude(B.x, B.z, half + 1.5);
    }
    floorBoard(a, def, B, v, 1.1, by + 0.075);
    panel.view.root.userData.clue = { x: V.x, z: V.z, tx: B.x, tz: B.z };
    return panel;
  });
  // ── 4. the heart: three big ornaments in a half ring on the old mosaic floor of the court ──
  const heart = arc(a, a.group('heart'), 'heart', C.x, C.z, 8.0, ax.ang + Math.PI * 0.62, ax.ang + Math.PI * 1.38, true, undefined, () => cy);
  a.addTotem(S.x, S.z, roofY + 4.8);
  a.exclude(C.x, C.z, 26);
  a.exclude(S.x, S.z, 12);
  // obelisks at the entrance
  for (const sd of [-1, 1]) {
    const p = ax.at(-24, sd * 11);
    const y = a.y(p.x, p.z);
    b.batch.add(G.cyl(0.25, 0.9, 9, 4), sand, mtx(p.x, y + 4.5, p.z, Math.PI / 4));
    b.batch.add(G.cone(0.32, 1.0, 4), M.gold(), mtx(p.x, y + 9.5, p.z, Math.PI / 4));
    a.world.collision.addBlocker({ x: p.x, z: p.z, r: 1, y0: y, y1: y + 10 });
  }
  finishChain(a, [gateG, light, tower, roof, heart], gate);
  addParticles(a, ax.A.x, ax.A.z, 60, 16, ['#f4dca8'], 'dust');
  desertRuins(a, sand);
  return a;
}

/**
 * A pergola and its panel: you stand at V looking out along v — the light on the floor is straight
 * ahead, the panel stands on the pergola's floor to the left of it, turned towards you, with a gold
 * line inlaid from its foot to the light.
 */
function pergolaStation(a: AreaCtx, def: PuzzleDef, group: string, V: { x: number; z: number }, v: { x: number; z: number }, stone: THREE.Material, stoneS: THREE.Material, bury?: string): Panel {
  const u = { x: -v.z, z: v.x };
  const half = (def.w * 0.9) / 2;
  const pc = { x: V.x + v.x * (1.8 + half), z: V.z + v.z * (1.8 + half) };
  const P = { x: V.x + v.x * 1.5 - u.x * (half + 1.3), z: V.z + v.z * 1.5 - u.z * (half + 1.3) };
  // (the pergola first: the panel stands on its floor, never sunk in it)
  lightPergola(a, def, pc, v, 0.9, stone, stoneS, bury);
  let py = -Infinity;
  for (const dx of [-0.9, 0, 0.9]) for (const dz of [-0.9, 0, 0.9]) py = Math.max(py, a.world.collision.groundAt(P.x + dx, P.z + dz, 9999)[0]);
  const panel = a.panel(def, { x: P.x, z: P.z, y: py + 0.02, yaw: yawToward(P.x, P.z, V.x, V.z) }, group);
  const e = { x: pc.x - v.x * half - u.x * half, z: pc.z - v.z * half - u.z * half };
  const len = Math.hypot(e.x - P.x, e.z - P.z);
  a.build.batch.add(G.box(0.07, 0.03, len), M.gold(), mtx((P.x + e.x) / 2, panel.view.root.position.y + 0.005, (P.z + e.z) / 2, Math.atan2(e.x - P.x, e.z - P.z)));
  panel.view.root.userData.clue = { x: V.x, z: V.z, tx: pc.x, tz: pc.z };
  return panel;
}

/** Which way the light comes from, for the pergolas (a fixed high afternoon sun from the south-west). */
const PERGOLA_SUN = new THREE.Vector3(-0.42, 0.82, 0.39).normalize();

/**
 * A stone pergola: four posts and a lattice roof. The open cells of the lattice are the panel's
 * pattern; the light through them falls as bright squares on a flagstone floor (a fixed afternoon
 * sun), seen from the panel just beyond it — top row farthest, left on the left. Cells marked '?'
 * in `bury` are under a drift of sand: there the lattice itself has to be read, from below.
 */
function lightPergola(a: AreaCtx, def: PuzzleDef, pc: { x: number; z: number }, v: { x: number; z: number }, cs: number, stone: THREE.Material, stoneS: THREE.Material, bury?: string) {
  const b = a.build;
  const w = def.w, h = def.h;
  const t = def.target ?? '';
  const hid = (bury ?? '').replace(/\//g, '');
  const u = { x: -v.z, z: v.x };
  const H = 2.7;
  const shift = { x: (PERGOLA_SUN.x / PERGOLA_SUN.y) * H, z: (PERGOLA_SUN.z / PERGOLA_SUN.y) * H };
  const lc = { x: pc.x + shift.x, z: pc.z + shift.z };
  const at = (o: { x: number; z: number }, r: number, c: number, s = cs) => ({ x: o.x + u.x * (c - (w - 1) / 2) * s + v.x * ((h - 1) / 2 - r) * s, z: o.z + u.z * (c - (w - 1) / 2) * s + v.z * ((h - 1) / 2 - r) * s });
  const ry = Math.atan2(-v.x, -v.z); // box local x along u, local z along v
  const span = Math.max(w, h) * cs;
  // flagstone floor big enough for the lattice and its light
  const mid = { x: (pc.x + lc.x) / 2, z: (pc.z + lc.z) / 2 };
  let fy = -Infinity;
  for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) fy = Math.max(fy, a.y(mid.x + dx * (span / 2 + 1.5), mid.z + dz * (span / 2 + 1.5)));
  fy += 0.12;
  const fsz = span + Math.hypot(shift.x, shift.z) + 2.6;
  floorSlab(b, stoneS, mid.x, fy, mid.z, fsz, fsz, ry, 1.2);
  a.exclude(mid.x, mid.z, fsz / 2 + 1);
  // posts and the lattice (the lattice casts no real shadow: its light is drawn, so it stays readable)
  const half = span / 2 + 0.25;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const q = { x: lc.x + u.x * sx * half + v.x * sz * half, z: lc.z + u.z * sx * half + v.z * sz * half };
    column(b, stone, q.x, fy, q.z, H + 0.35, 0.2);
  }
  const lat = new THREE.Group();
  const latMat = stone;
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, latMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    lat.add(m);
  };
  const ly = fy + H + 0.35;
  // frame
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(span + 0.7, 0.3, 0.3), lc.x + v.x * s * (span / 2 + 0.15), ly, lc.z + v.z * s * (span / 2 + 0.15));
    add(new THREE.BoxGeometry(0.3, 0.3, span + 0.7), lc.x + u.x * s * (span / 2 + 0.15), ly, lc.z + u.z * s * (span / 2 + 0.15));
  }
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const q = at(lc, r, c);
    if (t[r * w + c] !== '1') add(new THREE.BoxGeometry(cs * 0.98, 0.22, cs * 0.98), q.x, ly, q.z);
  }
  // mullions between all cells
  for (let k = 1; k < w; k++) { const q = at(lc, (h - 1) / 2, k - 0.5); add(new THREE.BoxGeometry(0.08, 0.24, span), q.x, ly, q.z); }
  for (let k = 1; k < h; k++) { const q = at(lc, k - 0.5, (w - 1) / 2); add(new THREE.BoxGeometry(span, 0.24, 0.08), q.x, ly, q.z); }
  a.dynamic.add(lat);
  // the shade of the roof and the squares of light on the floor
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(span + 0.6, span + 0.6), new THREE.MeshBasicMaterial({ color: '#2a1a0c', transparent: true, opacity: 0.38, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2;
  shade.rotation.z = ry;
  shade.position.set(pc.x, fy + 0.015, pc.z);
  a.dynamic.add(shade);
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.78, 0.45), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = hid[r * w + c] === '?' ? '?' : t[r * w + c];
    const q = at(pc, r, c);
    if (ch === '1') {
      const sq = new THREE.Mesh(new THREE.PlaneGeometry(cs * 0.9, cs * 0.9), lightMat);
      sq.rotation.x = -Math.PI / 2;
      sq.rotation.z = ry;
      sq.position.set(q.x, fy + 0.025, q.z);
      a.dynamic.add(sq);
    }
  }
  if (hid) sandDrift(a, hid, w, h, (r, c) => at(pc, r, c), cs, fy, ry);
}

/**
 * A drift of sand over the cells marked '?': one long smooth heap over them (they always form a
 * block), with a lower skirt blown a little further, as if the wind had piled it there.
 */
function sandDrift(a: AreaCtx, t: string, w: number, h: number, at: (r: number, c: number) => { x: number; z: number }, cs: number, y: number | null, ry: number) {
  let r0 = h, r1 = -1, c0 = w, c1 = -1;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (t[r * w + c] === '?') {
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
  }
  if (r1 < 0) return;
  const q = at((r0 + r1) / 2, (c0 + c1) / 2);
  const gy = y ?? a.y(q.x, q.z);
  const ext = { u: ((c1 - c0 + 1) * cs) / 2, v: ((r1 - r0 + 1) * cs) / 2 };
  const sandM = M.sandSmooth();
  // (local x of the heap along the columns, local z along the rows)
  a.build.batch.add(G.sphere(1, 20), sandM, mtx(q.x, gy - 0.18, q.z, ry, ext.u * 1.28, 0.62, ext.v * 1.32));
  a.build.batch.add(G.sphere(1, 20), sandM, mtx(q.x, gy - 0.1, q.z, ry, ext.u * 1.6, 0.3, ext.v * 1.55));
}

/**
 * A field of flagstones in the sand: glazed turquoise ones are lit, plain ones dark. Seen from the
 * tower top just beyond its panel (top row farthest). '?' stones are under a dune. With `awning`,
 * a cloth awning on poles hides a corner of the field from above — walk under it to see.
 */
function flagField(a: AreaCtx, def: PuzzleDef, fc: { x: number; z: number }, v: { x: number; z: number }, cs: number, stone: THREE.Material, awning: boolean) {
  const b = a.build;
  const w = def.w, h = def.h, t = def.target ?? '';
  const u = { x: -v.z, z: v.x };
  const ry = Math.atan2(-v.x, -v.z);
  const at = (r: number, c: number) => ({ x: fc.x + u.x * (c - (w - 1) / 2) * cs + v.x * ((h - 1) / 2 - r) * cs, z: fc.z + u.z * (c - (w - 1) / 2) * cs + v.z * ((h - 1) / 2 - r) * cs });
  const glaze = mat('mosGlaze', { color: '#37c3c9', roughness: 0.25, detail: 0.1, scale: 3 });
  const rim = M.gold();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const q = at(r, c);
    const y = a.y(q.x, q.z);
    const ch = t[r * w + c];
    b.batch.add(G.box(cs * 0.94, 0.5, cs * 0.94, 0.04), stone, mtx(q.x, y - 0.12, q.z, ry));
    if (ch === '1') {
      b.batch.add(G.box(cs * 0.94, 0.06, cs * 0.94), rim, mtx(q.x, y + 0.14, q.z, ry));
      b.batch.add(G.box(cs * 0.78, 0.08, cs * 0.78), glaze, mtx(q.x, y + 0.16, q.z, ry));
    }
  }
  sandDrift(a, t, w, h, at, cs, null, ry);
  a.exclude(fc.x, fc.z, (Math.max(w, h) * cs) / 2 + 1);
  if (awning) {
    // over the corner cells nearest the tower on the right (bottom-right 2x2)
    const q0 = at(h - 2, w - 2), q1 = at(h - 1, w - 1);
    const mc = { x: (q0.x + q1.x) / 2, z: (q0.z + q1.z) / 2 };
    const y = a.y(mc.x, mc.z);
    const hs = cs * 1.15;
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const p = { x: mc.x + u.x * sx * hs + v.x * sz * hs, z: mc.z + u.z * sx * hs + v.z * sz * hs };
      b.batch.add(G.cyl(0.06, 0.07, 2.6, 6), M.woodDark(), mtx(p.x, a.y(p.x, p.z) + 1.3, p.z));
      a.world.collision.addBlocker({ x: p.x, z: p.z, r: 0.1, y0: y - 1, y1: y + 2.6 });
    }
    b.batch.add(G.box(hs * 2.3, 0.05, hs * 2.3), M.cloth('#c8553d'), mtx(mc.x, y + 2.62, mc.z, ry, 1, 1, 1, 0, 0.05));
  }
}

/** A board inlaid in the floor: glazed turquoise tiles are the lit ones (or, for a panel that shows
 *  no symbols, its symbols). */
function floorBoard(a: AreaCtx, def: PuzzleDef, bc: { x: number; z: number }, v: { x: number; z: number }, cs: number, y: number) {
  const w = def.w, h = def.h;
  const px = 128;
  const cv = document.createElement('canvas');
  cv.width = w * px;
  cv.height = h * px;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#2f7f84';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const g = def.cells[r * w + c].glyph;
    const x0 = c * px, y0 = r * px;
    const lit = def.target?.[r * w + c] === '1';
    ctx.fillStyle = lit ? '#37c3c9' : g ? '#24575c' : (r + c) % 2 ? '#e9dcc0' : '#efe4cc';
    ctx.fillRect(x0 + 5, y0 + 5, px - 10, px - 10);
    if (lit) {
      // glazed: a lighter sheen in one corner
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x0 + 10, y0 + 10, px * 0.35, px * 0.12);
    }
    if (g?.kind === 'mosaic') {
      // the panel's window sign, drawn big enough to read from the roof: its frame and its number
      ctx.strokeStyle = '#f3e7c8';
      ctx.lineWidth = px * 0.06;
      ctx.strokeRect(x0 + px * 0.16, y0 + px * 0.16, px * 0.68, px * 0.68);
      ctx.fillStyle = '#f6efd9';
      ctx.font = `bold ${Math.round(px * 0.56)}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(g.n), x0 + px / 2, y0 + px * 0.53);
    } else if (g) drawGlyph(ctx, g, x0 + px / 2, y0 + px / 2, px * 0.9, false);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * cs, h * cs), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  // plane: local +x along u (columns), local +y (texture top) along v (far rows)
  const u = new THREE.Vector3(-v.z, 0, v.x), vv = new THREE.Vector3(v.x, 0, v.z), up = new THREE.Vector3(0, 1, 0);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, vv, up));
  m.position.set(bc.x, y, bc.z);
  m.receiveShadow = true;
  a.dynamic.add(m);
  // a gold frame
  const rim = M.gold();
  const ry = Math.atan2(-v.x, -v.z);
  const W = w * cs, Hh = h * cs;
  for (const s of [-1, 1]) {
    a.build.batch.add(G.box(W + 0.32, 0.05, 0.16), rim, mtx(bc.x + v.x * s * (Hh / 2 + 0.08), y - 0.01, bc.z + v.z * s * (Hh / 2 + 0.08), ry));
    a.build.batch.add(G.box(0.16, 0.05, Hh + 0.32), rim, mtx(bc.x + u.x * s * (W / 2 + 0.08), y - 0.01, bc.z + u.z * s * (W / 2 + 0.08), ry));
  }
}

/**
 * What is left of the old town around the temple, half buried in the dunes: broken walls of
 * sandstone (stepped where they crumbled), fallen blocks and column drums — weathered and cracked
 * like every old wall on the island.
 */
function desertRuins(a: AreaCtx, sand: THREE.Material) {
  const b = a.build, w = a.world;
  const A = ANCHORS.mosaic;
  const rnd = rng(7311);
  const placed: { x: number; z: number; r: number }[] = [];
  for (let attempt = 0, made = 0; attempt < 400 && made < 26; attempt++) {
    const ang = rnd() * Math.PI * 2, r = 34 + Math.sqrt(rnd()) * 62;
    const x = A.x + Math.cos(ang) * r, z = A.z + Math.sin(ang) * r;
    const len = 3 + rnd() * 6;
    const reach = len / 2 + 2.5;
    if (w.terrain.pathAt(x, z) > 0.12 || w.forest.isExcluded(x, z, reach) || w.waterAt(x, z) > 0) continue;
    if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + reach + 4)) continue;
    // level enough for a wall to stand
    const ry = rnd() * Math.PI;
    const ca = Math.cos(ry), sa = Math.sin(ry);
    const ends = [-len / 2, len / 2].map((t) => w.terrain.heightAt(x + ca * t, z - sa * t));
    if (Math.abs(ends[0] - ends[1]) > 1.2) continue;
    const y = Math.min(...ends) - 0.4;
    // the wall, broken into steps where it crumbled
    const steps = 2 + Math.floor(rnd() * 3);
    let h = 2.2 + rnd() * 2.4;
    for (let k = 0; k < steps; k++) {
      const seg = len / steps, t = -len / 2 + seg * (k + 0.5);
      solidBox(b, sand, x + ca * t, y, z - sa * t, seg + 0.02, h + 0.4, 0.9, ry, { walk: false });
      h = Math.max(0.9, h * (0.55 + rnd() * 0.4));
    }
    // a few blocks fallen from it, a column drum lying in the sand
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) {
      const t = (rnd() - 0.5) * len, off = (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 2);
      const bx = x + ca * t + sa * off, bz = z - sa * t + ca * off;
      const by = w.terrain.heightAt(bx, bz) - 0.25;
      b.batch.add(G.box(0.9 + rnd() * 0.5, 0.55 + rnd() * 0.3, 0.7 + rnd() * 0.4, 0.04), sand, mtx(bx, by + 0.3, bz, rnd() * Math.PI, 1, 1, 1, (rnd() - 0.5) * 0.4));
    }
    if (rnd() < 0.45) {
      const t = (rnd() - 0.5) * len, off = (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * 1.5);
      const cx = x + ca * t + sa * off, cz = z - sa * t + ca * off;
      b.batch.add(G.cyl(0.55, 0.55, 1.6 + rnd(), 12), sand, mtx(cx, w.terrain.heightAt(cx, cz) + 0.3, cz, rnd() * Math.PI, 1, 1, 1, Math.PI / 2));
    }
    a.exclude(x, z, reach);
    placed.push({ x, z, r: reach });
    made++;
  }
}

// ───────────────────────── 6. Beacon — the Lighthouse Cliffs ─────────────────────────

function lighthouse(a: AreaCtx, x: number, z: number, h: number, y: number) {
  const b = a.build;
  const white = mat('lhWhite', { color: '#f1eee8', roughness: 0.7, detail: 0.12, scale: 2 });
  const red = mat('lhRed', { color: '#c0392b', roughness: 0.7, detail: 0.12, scale: 2 });
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const r0 = 2.6 - (i / segs) * 1.1, r1 = 2.6 - ((i + 1) / segs) * 1.1;
    b.batch.add(G.cyl(r1, r0, h / segs, 24), i % 2 ? red : white, mtx(x, y + (h / segs) * (i + 0.5), z));
  }
  b.batch.add(G.cyl(1.9, 1.9, 0.3, 24), M.iron(), mtx(x, y + h + 0.15, z));
  const lamp = new THREE.Mesh(G.cyl(1.0, 1.0, 1.6, 16), new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd66b', emissiveIntensity: 2.6 }));
  lamp.position.set(x, y + h + 1.1, z);
  a.dynamic.add(lamp);
  b.batch.add(G.cone(1.4, 1.4, 16), red, mtx(x, y + h + 2.6, z));
  a.world.collision.addBlocker({ x, z, r: 2.7, y0: y - 2, y1: y + h + 3 });
  a.exclude(x, z, 5);
  return lamp;
}

export function buildBeacon(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('beacon', world, pm);
  const b = a.build;
  const stone = mat('beaStone', { color: '#b5b3ac', roughness: 0.92, detail: 0.28, scale: 1.2, pattern: 'blocks' });
  a.frame = mat('beaFrame', { color: '#c9c6bd', roughness: 0.85, detail: 0.2, scale: 1.4 });
  const ax = axes('beacon');
  const gp = ax.at(-30, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.2, 6.2, stone, M.woodDark());
  const ip = ax.at(-38, 0);
  const intro = introRows(a, ax, ip);
  // the main lighthouse on the cliff edge + two small ones on sea stacks
  const L1 = ax.at(24, 6);
  const lamps = [lighthouse(a, L1.x, L1.z, 22, a.y(L1.x, L1.z) - 0.5)];
  for (const [fw, sd] of [[58, -30], [52, 34]] as [number, number][]) {
    const p = ax.at(fw, sd);
    // sea stack
    b.batch.add(G.cyl(4, 6, 20, 9), stone, mtx(p.x, -6, p.z));
    lamps.push(lighthouse(a, p.x, p.z, 9, 4));
  }
  a.onUpdate((dt, t) => lamps.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + 0.8 * Math.sin(t * 1.5 + i * 2))));
  {
    const sp = ax.at(44, 0);
    audio.addSource('surf', sp.x, 1, sp.z, 90);
  }
  // cliff-edge railing
  for (let i = 0; i < 20; i++) {
    const p = ax.at(12 + (i % 2) * 0.1, -30 + i * 3.2);
    const y = a.y(p.x, p.z);
    b.batch.add(G.box(0.18, 1.1, 0.18), M.woodDark(), mtx(p.x, y + 0.55, p.z));
    if (i < 19) {
      const q = ax.at(12, -30 + (i + 1) * 3.2);
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      b.batch.add(G.box(0.1, 0.1, len), M.woodDark(), mtx((p.x + q.x) / 2, (y + a.y(q.x, q.z)) / 2 + 1.0, (p.z + q.z) / 2, Math.atan2(q.x - p.x, q.z - p.z)));
      a.world.collision.addBlocker({ x: (p.x + q.x) / 2, z: (p.z + q.z) / 2, hw: 0.08, hd: len / 2, rot: Math.atan2(q.x - p.x, q.z - p.z), y0: y - 1, y1: y + 1.2 });
    }
  }
  const pr = ax.at(-16, -18);
  const practice = arc(a, a.group('practice'), 'practice', pr.x, pr.z, 7.5, ax.ang + Math.PI * 0.2, ax.ang + Math.PI * 0.85, true);
  const tr = ax.at(-6, 20);
  const trial = arc(a, a.group('trial'), 'trial', tr.x, tr.z, 7, ax.ang - Math.PI * 0.85, ax.ang - Math.PI * 0.2, true);
  // heart: a round terrace at the lighthouse foot
  const hp = ax.at(14, 6);
  const hy = a.y(hp.x, hp.z) + 0.4;
  b.batch.add(G.cyl(8.5, 9, 1.2, 40), stone, mtx(hp.x, hy - 0.6, hp.z));
  b.col.addFloor({ x: hp.x, z: hp.z, r: 8.5, top: hy, bottom: hy - 2 });
  a.exclude(hp.x, hp.z, 11);
  const heart = arc(a, a.group('heart'), 'heart', hp.x, hp.z, 5, ax.ang + Math.PI * 0.6, ax.ang + Math.PI * 1.4, true, undefined, () => hy, 6);
  a.addTotem(hp.x - ax.r.x * 4.5, hp.z - ax.r.z * 4.5, hy);
  const mastery = masteryArc(a, ax, -28, 4);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  return a;
}

// ───────────────────────── 7. Weave — the Windmill Vale ─────────────────────────

function windmill(a: AreaCtx, x: number, z: number, faceAng: number, scale = 1) {
  const b = a.build;
  const y = a.y(x, z);
  const plaster = M.plaster();
  b.batch.add(G.cyl(2.2 * scale, 3.2 * scale, 9 * scale, 16), plaster, mtx(x, y + 4.5 * scale, z));
  b.batch.add(G.cone(3.0 * scale, 3.2 * scale, 16), M.roofTerracotta(), mtx(x, y + 10.6 * scale, z));
  a.world.collision.addBlocker({ x, z, r: 3.2 * scale, y0: y - 1, y1: y + 12 * scale });
  a.exclude(x, z, 6 * scale);
  const hubG = new THREE.Group();
  hubG.position.set(x + Math.cos(faceAng) * 3.2 * scale, y + 9.2 * scale, z + Math.sin(faceAng) * 3.2 * scale);
  hubG.rotation.y = -faceAng + Math.PI / 2;
  const sails = new THREE.Group();
  hubG.add(sails);
  const wood = M.wood();
  const cloth = M.cloth('#f3ead6');
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const spar = new THREE.Mesh(G.box(0.25, 8 * scale, 0.2), wood);
    spar.position.y = 4 * scale;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8 * scale, 6 * scale), cloth);
    sail.position.set(1.0 * scale, 4.6 * scale, 0.05);
    spar.castShadow = sail.castShadow = true;
    arm.add(spar, sail);
    sails.add(arm);
  }
  a.dynamic.add(hubG);
  a.onUpdate((dt) => (sails.rotation.z += dt * 0.35));
  audio.addSource('windmill', x, y + 8 * scale, z, 32);
}

export function buildWeave(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('weave', world, pm);
  const b = a.build;
  const wood = M.wood();
  a.frame = mat('weaveFrame', { color: '#9b7650', roughness: 0.8, detail: 0.2, scale: 1.0, pattern: 'grain' });
  const ax = axes('weave');
  const gp = ax.at(-40, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.2, 6.0, mat('weaveStone', { color: '#c8bfa8', roughness: 0.9, detail: 0.25, scale: 1.2, pattern: 'blocks' }), wood);
  const ip = ax.at(-48, 0);
  const intro = introRows(a, ax, ip);
  // windmills
  windmill(a, ax.at(-12, -26).x, ax.at(-12, -26).z, ax.ang + Math.PI, 1);
  windmill(a, ax.at(10, 30).x, ax.at(10, 30).z, ax.ang + Math.PI, 0.9);
  const big = ax.at(32, -6);
  windmill(a, big.x, big.z, ax.ang + Math.PI, 1.35);
  // weaving house (barn) with a gable roof
  const bh = ax.at(-12, 16);
  const by = a.y(bh.x, bh.z);
  const rotb = -ax.ang;
  solidBox(b, M.plaster(), bh.x, by - 0.5, bh.z, 12, 5.2, 8, rotb, { walk: false });
  b.batch.add(gableRoof(12, 8, 3.4, 0.6), M.roofTerracotta(), mtx(bh.x, by + 4.7, bh.z, rotb));
  {
    // windows with teal shutters, a big barn door facing the path, timber corners: a lived-in barn
    const loc = (lx: number, lz: number) => ({ x: bh.x + lx * Math.cos(rotb) + lz * Math.sin(rotb), z: bh.z - lx * Math.sin(rotb) + lz * Math.cos(rotb) });
    const glass = mat('barnGlass', { color: '#1d2530', roughness: 0.25, metalness: 0.3, detail: 0.02, scale: 2 });
    const shutter = mat('barnShutter', { color: '#3f7f7a', roughness: 0.75, detail: 0.15, scale: 1, pattern: 'grain' });
    const frame = M.woodDark();
    const winSide = (lx: number, side: number) => {
      const p = loc(lx, side * 4.02), q = loc(lx, side * 4.05);
      b.batch.add(G.box(1.15, 1.35, 0.06), frame, mtx(p.x, by + 2.3, p.z, rotb));
      b.batch.add(G.box(0.9, 1.1, 0.05), glass, mtx(q.x, by + 2.3, q.z, rotb));
      for (const sx of [-0.88, 0.88]) {
        const r = loc(lx + sx, side * 4.05);
        b.batch.add(G.box(0.5, 1.3, 0.05), shutter, mtx(r.x, by + 2.3, r.z, rotb));
      }
    };
    for (const side of [-1, 1]) for (const lx of [-3.6, 0, 3.6]) winSide(lx, side);
    const endItem = (lx: number, lz: number, w: number, h: number, y: number, m: THREE.Material, t = 0.06) => {
      const p = loc(lx, lz);
      b.batch.add(G.box(t, h, w), m, mtx(p.x, y, p.z, rotb));
    };
    // barn door on the end that faces the path (toward the hub), with a lintel and cross braces
    endItem(-6.03, 0, 3.0, 3.4, by + 1.2, frame, 0.08);
    endItem(-6.07, 0, 2.7, 3.1, by + 1.05, M.wood(), 0.06);
    endItem(-6.1, 0, 3.3, 0.28, by + 2.75, frame, 0.08);
    for (const k of [-1, 1]) {
      const p = loc(-6.1, k * 0.67);
      b.batch.add(G.box(0.05, 0.16, 1.75), frame, mtx(p.x, by + 1.05, p.z, rotb).multiply(new THREE.Matrix4().makeRotationX(k * 0.95)));
    }
    // round-ish window up in each gable
    for (const lx of [-6.03, 6.03]) {
      endItem(lx, 0, 1.1, 1.1, by + 5.6, frame, 0.07);
      endItem(lx + Math.sign(lx) * 0.03, 0, 0.85, 0.85, by + 5.6, glass, 0.05);
    }
    endItem(6.03, 0, 1.15, 1.35, by + 2.3, frame);
    endItem(6.06, 0, 0.9, 1.1, by + 2.3, glass, 0.05);
    // timber corner posts
    for (const lx of [-6, 6]) for (const lz of [-4, 4]) {
      const p = loc(lx, lz);
      b.batch.add(G.box(0.32, 5.2, 0.32), frame, mtx(p.x, by + 2.1, p.z, rotb));
    }
  }
  a.exclude(bh.x, bh.z, 9);
  // fabrics drying on lines (colourful)
  const colors = ['#b993ff', '#e7c35a', '#e05a5a', '#5aa9e0', '#7fd18b'];
  for (let i = 0; i < 5; i++) {
    const p = ax.at(-28 + i * 3, -10);
    const y = a.y(p.x, p.z);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2, 1, 4), M.cloth(colors[i]));
    cl.position.set(p.x, y + 1.6, p.z);
    cl.rotation.y = -ax.ang;
    cl.castShadow = true;
    a.dynamic.add(cl);
    a.onUpdate((dt, t) => (cl.rotation.x = Math.sin(t * 1.4 + i) * 0.12));
    b.batch.add(G.box(0.1, 2.9, 0.1), wood, mtx(p.x - Math.sin(ax.ang) * 0.9, y + 1.45, p.z + Math.cos(ax.ang) * 0.9));
  }
  const pr = ax.at(-12, 9);
  const practice = row(a, a.group('practice'), 'practice', pr.x, pr.z, ax.ang, 3.8, pr.x - ax.r.x * 6, pr.z - ax.r.z * 6);
  const tr = ax.at(8, -18);
  const trial = arc(a, a.group('trial'), 'trial', tr.x, tr.z, 7.2, ax.ang + Math.PI * 0.3, ax.ang + Math.PI * 0.9, true);
  const hp = ax.at(24, -4);
  const hy = a.y(hp.x, hp.z) + 0.4;
  b.batch.add(G.cyl(8.5, 9, 1.2, 40), mat('weaveDeck', { color: '#a67c52', roughness: 0.85, detail: 0.2, scale: 1, pattern: 'grain' }), mtx(hp.x, hy - 0.6, hp.z));
  b.col.addFloor({ x: hp.x, z: hp.z, r: 8.5, top: hy, bottom: hy - 2, surface: 'wood' });
  a.exclude(hp.x, hp.z, 11);
  const heart = arc(a, a.group('heart'), 'heart', hp.x, hp.z, 5, ax.ang + Math.PI * 0.55, ax.ang + Math.PI * 1.45, true, undefined, () => hy, 6);
  a.addTotem(hp.x + ax.f.x * 1.5, hp.z + ax.f.z * 1.5, hy);
  const mastery = masteryArc(a, ax, -26, -24);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  addParticles(a, ax.A.x, ax.A.z, 50, 14, ['#c9b6ff', '#ffffff'], 'pollen');
  return a;
}

// ───────────────────────── 8. Twins — the Mirror Lake ─────────────────────────

function pavilion(a: AreaCtx, x: number, z: number, y: number, rot: number, s = 1) {
  const b = a.build;
  const red = M.woodRed();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * 2.4 * s, lz = sz * 2.4 * s;
    column(b, red, x + lx * Math.cos(rot) + lz * Math.sin(rot), y, z - lx * Math.sin(rot) + lz * Math.cos(rot), 3.4 * s, 0.18 * s);
  }
  b.batch.add(pagodaRoof(7.4 * s, 2.2 * s, 0.5), M.roofSlate(), mtx(x, y + 4.4 * s, z, rot));
}

export function buildTwins(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('twins', world, pm);
  const b = a.build;
  const deck = mat('twinDeck', { color: '#8d5f45', roughness: 0.8, detail: 0.2, scale: 1, pattern: 'grain' });
  a.frame = mat('twinFrame', { color: '#c9b9a8', roughness: 0.75, detail: 0.15, scale: 1.4 });
  const ax = axes('twins');
  const L = ANCHORS.twins;
  const level = 7.5;
  const gp = ax.at(-60, 0);
  const gate = gateway(a, gp.x, gp.z, ax.ang, 4.2, 6.0, mat('twinStone', { color: '#d6ccbe', roughness: 0.85, detail: 0.2, scale: 1.3, pattern: 'blocks' }), M.woodRed());
  const ip = ax.at(-68, 0);
  const intro = introRows(a, ax, ip);
  // long bridge across the lake through the island
  const b0 = ax.at(-50, 0), b1 = ax.at(50, 0);
  const len = Math.hypot(b1.x - b0.x, b1.z - b0.z);
  const bry = Math.atan2(b1.x - b0.x, b1.z - b0.z);
  const bm = { x: (b0.x + b1.x) / 2, z: (b0.z + b1.z) / 2 };
  const deckY = level + 0.9;
  b.batch.add(G.box(3.2, 0.3, len), deck, mtx(bm.x, deckY - 0.15, bm.z, bry));
  b.col.addFloor({ x: bm.x, z: bm.z, hw: 1.6, hd: len / 2, rot: bry, top: deckY, bottom: deckY - 0.4, surface: 'wood' });
  for (let i = 0; i <= 28; i++) {
    const t = i / 28 - 0.5;
    for (const sd of [-1.5, 1.5]) {
      const x = bm.x + Math.sin(bry) * len * t + Math.cos(bry) * sd;
      const z = bm.z + Math.cos(bry) * len * t - Math.sin(bry) * sd;
      b.batch.add(G.box(0.14, 1.0, 0.14), M.woodRed(), mtx(x, deckY + 0.5, z));
      b.batch.add(G.box(0.22, 2.4, 0.22), deck, mtx(x, deckY - 1.6, z));
    }
  }
  // hand rails (with openings where walkways and landings join the bridge)
  const openings: [number, number][] = [[-31.6, -28.4], [-21.2, -8.8], [5.8, 18.2]];
  for (const sd of [-1.5, 1.5]) {
    const x = bm.x + Math.cos(bry) * sd, z = bm.z - Math.sin(bry) * sd;
    b.batch.add(G.box(0.1, 0.1, len), M.woodRed(), mtx(x, deckY + 1.0, z, bry));
    let from = -len / 2 + 3;
    const segs: [number, number][] = [];
    for (const [o0, o1] of openings) {
      segs.push([from, o0]);
      from = o1;
    }
    segs.push([from, len / 2 - 3]);
    for (const [f0, f1] of segs) {
      if (f1 <= f0) continue;
      const mid = (f0 + f1) / 2;
      const px = x + Math.sin(bry) * mid, pz = z + Math.cos(bry) * mid;
      a.world.collision.addBlocker({ x: px, z: pz, hw: 0.08, hd: (f1 - f0) / 2, rot: bry, y0: deckY - 0.2, y1: deckY + 1.1 });
    }
  }
  // island platform in the middle
  floorSlab(b, deck, L.x, deckY, L.z, 14, 14, bry, 0.4, 'wood');
  b.batch.add(G.cyl(7.5, 8.2, 6, 24), mat('twinIsle', { color: '#7a8a5a', roughness: 0.95, detail: 0.3, scale: 1 }), mtx(L.x, deckY - 3.4, L.z));
  // twin pavilions standing on decks over the water, mirrored across the bridge
  const practice: Panel[] = [];
  const pdefs = a.group('practice');
  const half = Math.ceil(pdefs.length / 2);
  for (const sd of [-1, 1]) {
    const p = ax.at(-30, sd * 17);
    const y = Math.max(a.y(p.x, p.z) + 0.3, deckY);
    floorSlab(b, deck, p.x, y, p.z, 16, 10, bry, 0.5, 'wood');
    // stilts
    for (const [u, v] of [[-7, -4], [7, -4], [-7, 4], [7, 4], [0, -4], [0, 4]]) {
      const x = p.x + u * Math.cos(bry) + v * Math.sin(bry), z = p.z - u * Math.sin(bry) + v * Math.cos(bry);
      b.batch.add(G.box(0.3, 4, 0.3), deck, mtx(x, y - 2.2, z));
    }
    // walkway to the bridge
    const wx = (p.x + ax.at(-30, 0).x) / 2, wz = (p.z + ax.at(-30, 0).z) / 2;
    floorSlab(b, deck, wx, deckY, wz, 2.4, 16.5, bry + Math.PI / 2, 0.3, 'wood');
    const pv = ax.at(-30 + 4.5, sd * 17);
    pavilion(a, pv.x, pv.z, y, bry, 0.9);
    a.exclude(p.x, p.z, 9);
    const mine = sd < 0 ? pdefs.slice(0, half) : pdefs.slice(half);
    mine.forEach((d, k) => {
      const q = ax.at(-37.2 + k * 2.85, sd * 17 + sd * -2.5);
      practice.push(a.panel(d, { x: q.x, z: q.z, yaw: yawToward(q.x, q.z, q.x + ax.r.x * sd * 6, q.z + ax.r.z * sd * 6), y }, 'practice'));
    });
  }
  // trial: two wide landings on the bridge
  const trial: Panel[] = [];
  const tdefs = a.group('trial');
  const tHalf = Math.ceil(tdefs.length / 2);
  [-15, 12].forEach((fw, li) => {
    const c = ax.at(fw, 0);
    floorSlab(b, deck, c.x, deckY, c.z, 12, 9, bry, 0.4, 'wood');
    const list = li === 0 ? tdefs.slice(0, tHalf) : tdefs.slice(tHalf);
    list.forEach((d, k) => {
      const side = k % 2 ? 1 : -1;
      const q = ax.at(fw - 3 + Math.floor(k / 2) * 4, side * 3.3);
      trial.push(a.panel(d, { x: q.x, z: q.z, yaw: yawToward(q.x, q.z, q.x - ax.r.x * side * 5, q.z - ax.r.z * side * 5), y: deckY }, 'trial'));
    });
  });
  // heart: on the island between two small towers
  const heart = arc(a, a.group('heart'), 'heart', L.x, L.z, 4.6, ax.ang + Math.PI * 0.6, ax.ang + Math.PI * 1.4, true, undefined, () => deckY, 6);
  for (const sd of [-1, 1]) {
    const p = { x: L.x + ax.r.x * sd * 5.2, z: L.z + ax.r.z * sd * 5.2 };
    pavilion(a, p.x, p.z, deckY, bry, 0.55);
  }
  a.addTotem(L.x + ax.f.x * 2.5, L.z + ax.f.z * 2.5, deckY);
  const mastery = masteryArc(a, ax, 64, 0);
  finishChain(a, [intro, practice, trial, mastery, heart], gate);
  addParticles(a, L.x, L.z, 90, 22, ['#ffc0d8', '#ffffff', '#ffb0cc'], 'petals');
  return a;
}

// ───────────────────────── particles ─────────────────────────

function addParticles(a: AreaCtx, cx: number, cz: number, count: number, radius: number, colors: string[], kind: 'leaves' | 'petals' | 'pollen' | 'dust') {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const R = radius * 3;
  const rnd = rng(Math.round(cx * 13 + cz * 7));
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = cx + (rnd() - 0.5) * R * 2;
    pos[i * 3 + 2] = cz + (rnd() - 0.5) * R * 2;
    pos[i * 3 + 1] = a.y(pos[i * 3], pos[i * 3 + 2]) + rnd() * 8;
    c.set(colors[i % colors.length]);
    col.set([c.r, c.g, c.b], i * 3);
    seed[i] = rnd() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const size = kind === 'leaves' || kind === 'petals' ? 0.16 : 0.05;
  const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: kind === 'dust' ? 0.5 : 0.95, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  a.dynamic.add(pts);
  const fall = kind === 'leaves' ? 0.6 : kind === 'petals' ? 0.35 : 0.04;
  a.onUpdate((dt, t) => {
    for (let i = 0; i < count; i++) {
      let y = pos[i * 3 + 1] - fall * dt;
      pos[i * 3] += Math.sin(t * 0.7 + seed[i]) * dt * 0.6;
      pos[i * 3 + 2] += Math.cos(t * 0.5 + seed[i] * 1.3) * dt * 0.4;
      const g = a.y(pos[i * 3], pos[i * 3 + 2]);
      if (y < g) y = g + 6 + (seed[i] % 3);
      if (kind === 'pollen' || kind === 'dust') y += Math.sin(t + seed[i]) * dt * 0.2;
      pos[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

export const TEACHING_BUILDERS: Record<string, (w: World, pm: PanelManager) => AreaCtx> = {
  kinship: buildKinship,
  measure: buildMeasure,
  mold: buildMold,
  contour: buildContour,
  mosaic: buildMosaic,
  beacon: buildBeacon,
  weave: buildWeave,
  twins: buildTwins,
};
