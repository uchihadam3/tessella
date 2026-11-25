/**
 * The Citadel (9, open from the start, no tutorial), the Resonant Hollow (10, inside the caldera,
 * opens with 7 totems) and the Sky Spire (11, the finale, opens when the Citadel is complete).
 */
import * as THREE from 'three';
import { AreaCtx, yawToward, Beam } from './common';
import { G, mtx, column, solidBox, wall, floorSlab, stairs, archGeometry, lantern } from '../arch';
import { M, mat } from '../materials';
import { CALDERA, CITADEL, NORTH_LANDING, SPIRE } from '../layout';
import type { World } from '../world';
import type { Panel, PanelManager } from '../../puzzle/panels';
import type { PuzzleDef } from '../../puzzle/types';
import { rng } from '../noise';

function ring(a: AreaCtx, defs: PuzzleDef[], group: string, cx: number, cz: number, r: number, a0: number, a1: number, y: number, inward = true): Panel[] {
  const n = defs.length;
  const gap = 3.6;
  const span = Math.abs(a1 - a0);
  if (n > 1 && ((n - 1) * gap) / span > r) r = ((n - 1) * gap) / span;
  return defs.map((d, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = a0 + (a1 - a0) * t;
    const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
    return a.panel(d, { x, z, y, yaw: inward ? yawToward(x, z, cx, cz) : yawToward(cx, cz, x, z) }, group);
  });
}

// ───────────────────────── 9. The Citadel ─────────────────────────

export function buildCitadel(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('citadel', world, pm);
  const b = a.build;
  const slate = mat('citSlate', { color: '#5d6068', roughness: 0.85, detail: 0.25, scale: 1.1, pattern: 'blocks' });
  const slateD = mat('citSlateD', { color: '#43464d', roughness: 0.85, detail: 0.25, scale: 1.1, pattern: 'blocks' });
  const bronze = M.bronze();
  a.frame = mat('citFrame', { color: '#4b4e56', roughness: 0.7, detail: 0.18, scale: 1.4 });
  const C = { x: CITADEL.x, z: CITADEL.z };
  const Y = CITADEL.y + 0.5;
  // ── the long bridge from the north landing ──
  const z0 = NORTH_LANDING.z - 4, z1 = C.z + CITADEL.r - 6;
  const yA = world.terrain.heightAt(0, z0) + 0.3;
  const len = z0 - z1;
  const bridgeTop = (_u: number, v: number) => yA + (Y - yA) * ((1 - v) / 2);
  // deck as a sloped slab made of segments
  const segs = 20;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const za = z0 - len * t0, zb = z0 - len * t1;
    const ya = yA + (Y - yA) * t0, yb = yA + (Y - yA) * t1;
    const zm = (za + zb) / 2, ym = (ya + yb) / 2;
    const slope = Math.atan2(yb - ya, za - zb);
    b.batch.add(G.box(5, 0.6, len / segs + 0.05), slateD, mtx(0, ym - 0.3, zm, 0, 1, 1, 1, slope));
    // parapets
    for (const sx of [-2.6, 2.6]) b.batch.add(G.box(0.4, 1.1, len / segs + 0.05), slate, mtx(sx, ym + 0.45, zm, 0, 1, 1, 1, slope));
    // piers
    if (i % 4 === 2) b.batch.add(G.box(3.4, 40, 3.4), slateD, mtx(0, ym - 20.6, zm));
  }
  b.col.addFloor({ x: 0, z: (z0 + z1) / 2, hw: 2.4, hd: len / 2, rot: 0, top: bridgeTop, bottom: -50, surface: 'stone' });
  for (const sx of [-2.6, 2.6]) b.col.addBlocker({ x: sx, z: (z0 + z1) / 2, hw: 0.2, hd: len / 2, rot: 0, y0: -50, y1: 200 });
  // arches along the bridge
  for (const t of [0.25, 0.5, 0.75]) {
    const zz = z0 - len * t, yy = yA + (Y - yA) * t;
    b.batch.add(archGeometry(5.4, 7, 0.7, 1.0), slate, mtx(0, yy - 0.2, zz, 0));
  }
  // ── walls ──
  const R = 40;
  const towers = 8;
  for (let i = 0; i < towers; i++) {
    const a0 = (i / towers) * Math.PI * 2 + Math.PI / 8, a1 = ((i + 1) / towers) * Math.PI * 2 + Math.PI / 8;
    const x0 = C.x + Math.cos(a0) * R, zz0 = C.z + Math.sin(a0) * R;
    const x1 = C.x + Math.cos(a1) * R, zz1 = C.z + Math.sin(a1) * R;
    const mid = (a0 + a1) / 2;
    const gateSide = Math.abs(Math.sin(mid) - 1) < 0.2; // south (+z) has the gate
    if (!gateSide) wall(b, slate, x0, zz0, x1, zz1, Y - 3, 9, 2.4, { cap: slateD });
    else {
      // wall with a gate gap
      const gx = C.x, gz = C.z + R * Math.sin(mid);
      wall(b, slate, x0, zz0, gx - 4, gz, Y - 3, 9, 2.4, { cap: slateD });
      wall(b, slate, gx + 4, gz, x1, zz1, Y - 3, 9, 2.4, { cap: slateD });
      b.batch.add(archGeometry(8, 9.5, 1.4, 2.6), slateD, mtx(gx, Y - 0.2, gz));
    }
    // round tower
    b.batch.add(G.cyl(3.4, 3.8, 16, 16), slate, mtx(x0, Y + 4, zz0));
    b.batch.add(G.cone(4.2, 5, 16), M.roofSlate(), mtx(x0, Y + 14.5, zz0));
    world.collision.addBlocker({ x: x0, z: zz0, r: 3.8, y0: Y - 5, y1: Y + 20 });
  }
  a.exclude(C.x, C.z, R + 6);
  // courtyard paving
  floorSlab(b, slateD, C.x, Y, C.z, 70, 70, 0, 4);
  // ── gate group: just inside the gate ──
  const gz = C.z + R - 7;
  const gate = ring(a, a.group('gate'), 'gate', C.x, gz + 26, 26, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42, Y);
  // ── court: around a central sunken basin with a bronze armillary ──
  b.batch.add(G.cyl(6, 6.4, 0.8, 32), slate, mtx(C.x, Y + 0.4, C.z + 6));
  b.col.addBlocker({ x: C.x, z: C.z + 6, r: 6.2, y0: Y - 1, y1: Y + 0.8 });
  const armillary = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const t = new THREE.Mesh(G.torus(2.4 - k * 0.3, 0.07, 48), bronze);
    t.rotation.set(k * 0.9, k * 0.6, 0);
    armillary.add(t);
  }
  armillary.position.set(C.x, Y + 3.4, C.z + 6);
  a.dynamic.add(armillary);
  a.onUpdate((dt) => {
    armillary.rotation.y += dt * 0.15;
    armillary.children.forEach((c, i) => (c.rotation.x += dt * 0.1 * (i + 1)));
  });
  const court = ring(a, a.group('court'), 'court', C.x, C.z + 6, 12, Math.PI * 0.15, Math.PI * 0.85, Y);
  // ── halls: two long colonnaded halls east and west ──
  const hallsDefs = a.group('halls');
  const halls: Panel[] = [];
  const half = Math.ceil(hallsDefs.length / 2);
  for (const sd of [-1, 1]) {
    const hx = C.x + sd * 22;
    floorSlab(b, slateD, hx, Y + 0.6, C.z - 4, 12, 30, 0, 0.6);
    for (let k = 0; k < 6; k++) {
      column(b, slate, hx - 5, Y + 0.6, C.z - 17 + k * 5.2, 7, 0.4);
      column(b, slate, hx + 5, Y + 0.6, C.z - 17 + k * 5.2, 7, 0.4);
    }
    b.batch.add(G.box(12.6, 0.8, 31), slateD, mtx(hx, Y + 8, C.z - 4));
    b.batch.add(G.box(13.4, 0.3, 32), bronze, mtx(hx, Y + 8.55, C.z - 4));
    const list = sd < 0 ? hallsDefs.slice(0, half) : hallsDefs.slice(half);
    list.forEach((d, k) => {
      const z = C.z - 14 + k * (24 / Math.max(1, list.length - 1));
      halls.push(a.panel(d, { x: hx, z, y: Y + 0.6, yaw: sd < 0 ? Math.PI / 2 : -Math.PI / 2 }, 'halls'));
    });
    // braziers
    for (const zz of [C.z - 19, C.z + 11]) {
      b.batch.add(G.cyl(0.6, 0.3, 1.2, 12), bronze, mtx(hx, Y + 1.2, zz));
      const fire = new THREE.Mesh(G.cone(0.5, 1.0, 10), M.glow('#ff9a3c', 3));
      fire.position.set(hx, Y + 2.3, zz);
      a.dynamic.add(fire);
      a.onUpdate((dt, t) => fire.scale.set(1, 0.85 + 0.25 * Math.sin(t * 9 + zz), 1));
    }
  }
  // ── the crown: a tall keep with a spiral of landings ──
  const kz = C.z - 26;
  solidBox(b, slateD, C.x, Y, kz, 16, 4.5, 12, 0);
  const st = stairs(b, slate, C.x, Y, kz + 10.5, 0, 4, 4.5 / 10, 0.42, 10);
  void st;
  const crownY = Y + 4.5;
  const crown = ring(a, a.group('crown'), 'crown', C.x, kz - 1, 5.2, Math.PI * 0.05, Math.PI * 0.95, crownY);
  b.batch.add(G.cyl(2.4, 3, 18, 12), slate, mtx(C.x, crownY + 9, kz - 4));
  b.batch.add(G.cone(3.4, 6, 12), M.roofSlate(), mtx(C.x, crownY + 21, kz - 4));
  world.collision.addBlocker({ x: C.x, z: kz - 4, r: 3, y0: Y, y1: Y + 40 });
  a.addTotem(C.x, kz - 4 + 4.2, crownY + 0.1);
  // chain everything: gate → court → halls → crown
  a.chain([...gate, ...court, ...halls, ...crown]);
  // lanterns on the bridge
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const zz = z0 - len * t, yy = yA + (Y - yA) * t;
    lantern(b, M.iron(), M.glow('#ffb35a', 2), 2.6, yy + 1.0, zz, 1.4);
    lantern(b, M.iron(), M.glow('#ffb35a', 2), -2.6, yy + 1.0, zz, 1.4);
  }
  return a;
}

// ───────────────────────── 10. The Resonant Hollow ─────────────────────────

export function buildEcho(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('echo', world, pm);
  const b = a.build;
  a.frame = mat('echoFrame', { color: '#3c3a4c', roughness: 0.4, detail: 0.15, scale: 2, metalness: 0.2 });
  const cx = CALDERA.x, cz = CALDERA.z;
  const F = CALDERA.floor;
  // crystals everywhere in the basin
  const rnd = rng(1010);
  const crystalCols = ['#63f0ff', '#8a6bff', '#b48cff', '#5fd2ff'];
  const cg = new THREE.OctahedronGeometry(1, 0);
  for (let i = 0; i < 70; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = 20 + rnd() * 28;
    const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
    const y = world.terrain.heightAt(x, z);
    if (Math.abs(x - cx) < 9 && z > cz) continue; // keep the gorge path clear
    const s = 0.6 + rnd() * 2.2;
    const col = crystalCols[i % crystalCols.length];
    const m = new THREE.Mesh(cg, M.crystal(col, 0.8 + rnd() * 1.2));
    m.scale.set(s * 0.45, s * 1.8, s * 0.45);
    m.position.set(x, y + s * 0.9, z);
    m.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
    m.castShadow = true;
    b.batch.addMesh(m);
    if (s > 1.2) world.collision.addBlocker({ x, z, r: s * 0.5, y0: y - 1, y1: y + 4 });
  }
  // stepping path from the gorge to the island (over the lake)
  const isl = { x: cx, z: cz };
  for (let i = 0; i < 9; i++) {
    const z = cz + 36 - i * 2.4;
    const y = Math.max(world.terrain.heightAt(cx, z), 5.9) + 0.25;
    floorSlab(b, mat('echoStep', { color: '#4a4860', roughness: 0.5, detail: 0.2, scale: 2 }), cx, y, z, 2.6, 2.0, 0, 3, 'crystal');
  }
  floorSlab(b, mat('echoIsle', { color: '#3e3c52', roughness: 0.6, detail: 0.2, scale: 1.5 }), isl.x, F + 1.2, isl.z, 26, 26, Math.PI / 4, 4, 'crystal');
  // groups around the basin floor
  const intro = ring(a, a.group('intro'), 'intro', cx, cz + 30, 9, -Math.PI * 0.95, -Math.PI * 0.05, F + 0.1);
  const practice = ring(a, a.group('practice'), 'practice', cx - 24, cz - 6, 8, -Math.PI * 0.4, Math.PI * 0.4, F + 0.1, true);
  const trial = ring(a, a.group('trial'), 'trial', cx + 24, cz - 6, 8, Math.PI * 0.6, Math.PI * 1.4, F + 0.1, true);
  const heart = ring(a, a.group('heart'), 'heart', isl.x, isl.z, 7.5, Math.PI * 0.25, Math.PI * 0.75, F + 1.2);
  for (const p of [...intro, ...practice, ...trial]) {
    const q = p.view.root.position;
    q.y = world.terrain.heightAt(q.x, q.z);
  }
  a.addTotem(isl.x - 6, isl.z - 2, F + 1.2);
  a.chain([...intro, ...practice, ...trial, ...heart]);
  // the hollow needs the great door open (set by the game)
  return a;
}

// ───────────────────────── 11. The Sky Spire ─────────────────────────

export interface SpireRuntime extends AreaCtx {
  setOpen(open: boolean, instant?: boolean): void;
  ignite(): void;
  topY: number;
}

export function buildSpire(world: World, pm: PanelManager): SpireRuntime {
  const a = new AreaCtx('spire', world, pm) as SpireRuntime;
  const b = a.build;
  const star = mat('spireStone', { color: '#e9e4d8', roughness: 0.55, metalness: 0.05, detail: 0.14, scale: 1.4, pattern: 'blocks' });
  const pale = mat('spirePale', { color: '#f2efe8', roughness: 0.5, detail: 0.1, scale: 2 });
  const rock = mat('spireRock', { color: '#7d7a86', roughness: 0.95, detail: 0.35, scale: 1.2, flat: true });
  a.frame = mat('spireFrame', { color: '#1f2230', roughness: 0.3, metalness: 0.4, detail: 0.1, scale: 2 });
  const cx = SPIRE.x, cz = SPIRE.z;
  const baseY = CALDERA.floor + 1.2;
  // the central tower
  const H = 150;
  b.batch.add(G.cyl(3.2, 7, H, 12), star, mtx(cx, baseY + H / 2, cz));
  world.collision.addBlocker({ x: cx, z: cz, r: 6.2, y0: baseY - 5, y1: baseY + H });
  for (let k = 0; k < 12; k++) b.batch.add(G.torus(6.6 - k * 0.3, 0.18, 32), M.gold(), mtx(cx, baseY + 10 + k * 11.5, cz, 0, 1, 1, 1, Math.PI / 2));
  // spiral of floating platforms (each a landing with panels); steps of light between them
  const groups: [string, number][] = [['ascent', 6], ['drums', 4], ['mirrors', 4], ['apex', 3]];
  const order: Panel[] = [];
  let ang = Math.PI / 2;
  let y = baseY;
  const lightStep = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#bfd4ff'), emissiveIntensity: 1.2, transparent: true, opacity: 0.85 });
  const stepMeshes: THREE.Mesh[] = [];
  const landings: { x: number; z: number; y: number; ang: number }[] = [];
  const nLand = 8;
  for (let l = 0; l < nLand; l++) {
    const r = 16;
    const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
    landings.push({ x, z, y, ang });
    b.batch.add(G.cyl(5.6, 4, 1.6, 8), pale, mtx(x, y - 0.8, z));
    b.batch.add(G.cone(5.2, 7, 7), rock, mtx(x, y - 5.1, z, l * 0.7, 1, 1, 1, Math.PI));
    b.batch.add(G.torus(5.6, 0.12, 40), M.gold(), mtx(x, y - 0.1, z, 0, 1, 1, 1, Math.PI / 2));
    world.collision.addFloor({ x, z, r: 5.6, top: y, bottom: y - 1.6, surface: 'crystal' });
    // steps of light to the next landing
    const nextAng = ang + Math.PI / 2.2;
    const ny = y + 16;
    if (l < nLand - 1) {
      const nx = cx + Math.cos(nextAng) * r, nz = cz + Math.sin(nextAng) * r;
      const steps = 22;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const aa = ang + (nextAng - ang) * t;
        const rr = r - Math.sin(t * Math.PI) * 2;
        const sx = cx + Math.cos(aa) * rr, sz = cz + Math.sin(aa) * rr;
        const sy = y + (ny - y) * t;
        const m = new THREE.Mesh(G.box(2.2, 0.18, 1.4, 0.04), lightStep);
        m.position.set(sx, sy - 0.09, sz);
        m.rotation.y = -aa;
        a.dynamic.add(m);
        stepMeshes.push(m);
        world.collision.addFloor({ x: sx, z: sz, hw: 1.3, hd: 1.0, rot: -aa, top: sy, bottom: sy - 0.3, surface: 'crystal', tag: 'spire.steps' });
      }
      void nx;
      void nz;
    }
    ang = nextAng;
    y = ny;
  }
  a.topY = y;
  // distribute panels over the landings
  let li = 0;
  for (const [key] of groups) {
    const defs = a.group(key);
    let i = 0;
    while (i < defs.length) {
      const L = landings[Math.min(li, landings.length - 1)];
      const take = Math.min(defs.length - i, key === 'apex' ? 3 : 2);
      const slice = defs.slice(i, i + take);
      slice.forEach((d, k) => {
        const off = (k - (take - 1) / 2) * 3.4;
        const tx = -Math.sin(L.ang), tz = Math.cos(L.ang);
        const px = L.x + tx * off + Math.cos(L.ang) * 1.2, pz = L.z + tz * off + Math.sin(L.ang) * 1.2;
        order.push(a.panel(d, { x: px, z: pz, y: L.y, yaw: yawToward(px, pz, cx, cz) + Math.PI }, key));
      });
      i += take;
      li++;
    }
  }
  a.chain(order);
  // the apex: a crown of light on top of the tower
  const crownGlow = new THREE.Mesh(new THREE.OctahedronGeometry(3, 0), M.crystal('#e8f0ff', 0.6));
  crownGlow.position.set(cx, baseY + H + 6, cz);
  crownGlow.scale.set(1, 1.6, 1);
  a.dynamic.add(crownGlow);
  let ignited = 0;
  a.ignite = () => {
    ignited = 0.0001;
  };
  a.onUpdate((dt, t) => {
    crownGlow.rotation.y += dt * (0.3 + ignited * 2);
    const mm = crownGlow.material as THREE.MeshStandardMaterial;
    if (ignited > 0 && ignited < 1) ignited = Math.min(1, ignited + dt * 0.4);
    mm.emissiveIntensity = 0.6 + 0.2 * Math.sin(t) + ignited * 7;
    crownGlow.scale.set(1 + ignited * 0.6, 1.6 + ignited, 1 + ignited * 0.6);
  });
  let open = false;
  a.setOpen = (o, instant = false) => {
    open = o;
    world.collision.setEnabledByTag('spire.steps', o);
    stepMeshes.forEach((m, i) => {
      m.visible = o;
      if (o && !instant) {
        m.scale.setScalar(0.01);
        const delay = i * 0.03;
        let t0 = -delay;
        a.onUpdate((dt) => {
          if (t0 >= 1) return;
          t0 += dt;
          const e = Math.max(0, Math.min(1, t0));
          m.scale.setScalar(Math.max(0.01, e));
        });
      }
    });
    (crownGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = o ? 1.6 : 0.6;
  };
  a.setOpen(false, true);
  // the first panel needs the spire open
  if (order[0]) order[0].extraPower = () => open;
  void Beam;
  return a;
}
