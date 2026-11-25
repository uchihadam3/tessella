/**
 * O Despertar — a roofless ruined sanctuary on the dunes above the southern beach.
 * You wake inside it at dawn. Cave group: 5 panels (the 5th reads a pattern cast by the rising
 * sun through a lattice window). Shore: standing stones on the beach. Gate: two outline panels
 * that open the way north to the island.
 */
import * as THREE from 'three';
import { AreaCtx, yawToward } from './common';
import { G, mtx, solidBox, floorSlab, column, wall } from '../arch';
import { M, mat } from '../materials';
import type { World } from '../world';
import type { PanelManager } from '../../puzzle/panels';

export const PROLOGUE_START = { x: 0, z: 279.5, yaw: Math.PI, floorY: 7.2 };

export function buildPrologue(world: World, pm: PanelManager): AreaCtx {
  const a = new AreaCtx('prologue', world, pm);
  const b = a.build;
  const stone = mat('prologueStone', { color: '#d8cdb8', roughness: 0.92, detail: 0.26, scale: 1.3, pattern: 'blocks' });
  const stoneDark = mat('prologueStoneDark', { color: '#a99f8e', roughness: 0.95, detail: 0.3, scale: 1.1, pattern: 'blocks' });
  a.frame = stone;
  const F = PROLOGUE_START.floorY;
  const cx = 0, cz = 285;

  // ── sanctuary platform ──
  floorSlab(b, stone, cx, F, cz, 22, 20, 0, 4);
  b.batch.add(G.box(23, 0.4, 21, 0.06), stoneDark, mtx(cx, F - 3.8, cz));
  a.exclude(cx, cz, 15);
  // ruined walls around (west, north, east with the lattice window), varying heights
  const wallH = [3.4, 2.2, 3.8, 1.4, 3.0];
  wall(b, stone, -10.5, 275.5, -10.5, 294.5, F, 3.2, 0.9, { cap: stoneDark });
  wall(b, stone, -10.5, 275.5, 10.5, 275.5, F, 3.6, 0.9, { cap: stoneDark });
  wall(b, stone, 10.5, 275.5, 10.5, 281.2, F, wallH[0], 0.9, { cap: stoneDark });
  wall(b, stone, 10.5, 288.8, 10.5, 294.5, F, wallH[2], 0.9, { cap: stoneDark });
  // south wall with the exit (door at x=0)
  wall(b, stone, -10.5, 294.5, -2.2, 294.5, F, 2.8, 0.9, { cap: stoneDark });
  wall(b, stone, 2.2, 294.5, 10.5, 294.5, F, 2.4, 0.9, { cap: stoneDark });
  // broken pillars
  column(b, stoneDark, -7.5, F, 278.5, 4.2, 0.32);
  column(b, stoneDark, 7.5, F, 278.5, 2.6, 0.32);
  column(b, stoneDark, -7.5, F, 291.5, 3.4, 0.32);
  column(b, stoneDark, 7.5, F, 291.5, 4.6, 0.32);
  // gate pillars of the exit
  solidBox(b, stoneDark, -2.6, F, 294.5, 0.9, 4.2, 1.2);
  solidBox(b, stoneDark, 2.6, F, 294.5, 0.9, 4.2, 1.2);
  b.batch.add(G.box(6.2, 0.7, 1.3, 0.05), stoneDark, mtx(0, F + 4.55, 294.5));
  const exitDoor = a.stoneDoor('pro.exit', 0, F, 294.5, 4.3, 4.2, 0, stone, 0.6);

  // ── the lattice window on the east wall (x = 10.5, z 281.2..288.8) ──
  const latticeTarget = (a.group('cave')[4]?.target ?? '010111010').replace(/#/g, '0');
  const winZ0 = 281.2, winZ1 = 288.8;
  const winY0 = F + 0.0, winH = 4.6;
  // frame around the window
  b.batch.add(G.box(0.9, winH + 0.8, 0.8), stoneDark, mtx(10.5, F + (winH + 0.8) / 2, winZ0 - 0.0));
  b.batch.add(G.box(0.9, winH + 0.8, 0.8), stoneDark, mtx(10.5, F + (winH + 0.8) / 2, winZ1));
  b.batch.add(G.box(0.9, 0.8, winZ1 - winZ0 + 0.8), stoneDark, mtx(10.5, F + winH + 0.4, (winZ0 + winZ1) / 2));
  b.col.addBlocker({ x: 10.5, z: (winZ0 + winZ1) / 2, hw: 0.45, hd: (winZ1 - winZ0) / 2, rot: 0, y0: F - 1, y1: F + winH + 1 });
  // 3x3 lattice: closed cells are stone blocks, open cells let the light in
  const lw = (winZ1 - winZ0 - 0.6) / 3;
  const lh = (winH - 1.4) / 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const open = latticeTarget[r * 3 + c] === '1';
      const zc = winZ0 + 0.3 + lw * (c + 0.5);
      const yc = winY0 + 1.0 + lh * (2 - r + 0.5);
      if (!open) b.batch.add(G.box(0.6, lh, lw), stone, mtx(10.5, yc, zc));
    }
  }
  // mullions
  for (let k = 0; k <= 3; k++) b.batch.add(G.box(0.7, winH - 1.2, 0.12), stoneDark, mtx(10.5, winY0 + 1.0 + (winH - 1.4) / 2, winZ0 + 0.3 + lw * k));
  for (let k = 0; k <= 3; k++) b.batch.add(G.box(0.7, 0.12, winZ1 - winZ0 - 0.5), stoneDark, mtx(10.5, winY0 + 1.0 + lh * k, (winZ0 + winZ1) / 2));
  b.batch.add(G.box(0.9, 1.0, winZ1 - winZ0 + 0.8), stoneDark, mtx(10.5, F + 0.5, (winZ0 + winZ1) / 2));
  // the pattern of light on the floor + light shafts (fake volumetrics)
  const pattern = new THREE.Group();
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.68, 0.38), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const shaftMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.36, 0.2), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cell = 0.9;
  const px0 = 5.6, pz0 = 285 - cell * 1.5;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (latticeTarget[r * 3 + c] !== '1') continue;
      // floor square: rows map to the floor's x (near->far from the wall), columns to z
      const fx = px0 + (r - 1) * cell * 1.05, fz = pz0 + (c + 0.5) * cell * 1.05;
      const sq = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), lightMat);
      sq.rotation.x = -Math.PI / 2;
      sq.position.set(fx, F + 0.02, fz);
      pattern.add(sq);
      // shaft from the window cell to the floor square
      const wz = winZ0 + 0.3 + lw * (c + 0.5);
      const wy = winY0 + 1.0 + lh * (2 - r + 0.5);
      const from = new THREE.Vector3(10.1, wy, wz);
      const to = new THREE.Vector3(fx, F + 0.05, fz);
      const len = from.distanceTo(to);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.7, len, cell * 0.7), shaftMat);
      shaft.position.copy(from).lerp(to, 0.5);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      pattern.add(shaft);
    }
  }
  a.dynamic.add(pattern);
  // dust motes in the light
  const dustGeo = new THREE.BufferGeometry();
  const dp: number[] = [];
  for (let i = 0; i < 120; i++) dp.push(5 + Math.random() * 5, F + Math.random() * 4, 282 + Math.random() * 6);
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffe2b0', size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  a.dynamic.add(dust);
  a.onUpdate((dt, t) => {
    const p = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.05 * Math.sin(t * 0.3 + i);
      if (y > F + 4.2) y = F;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.2 + i * 1.7) * dt * 0.03);
    }
    p.needsUpdate = true;
  });

  // ── cave panels (inside the sanctuary) ──
  const cave = a.group('cave');
  const spots: [number, number][] = [[0, 283.2], [-5.2, 284.2], [-5.6, 289.2], [-1.8, 291.0], [3.2, 287.6]];
  const cavePanels = cave.map((def, i) => {
    const [x, z] = spots[i] ?? [i * 2 - 4, 288];
    const yaw = i === 0 ? Math.PI : i === 4 ? yawToward(x, z, 0, 280) : yawToward(x, z, 0, 281.5);
    return a.panel(def, { x, z, yaw, y: F, tilt: 26 }, 'cave');
  });
  // first panel is powered from the start
  a.chain(cavePanels);
  const last = cavePanels[cavePanels.length - 1];
  last?.onSolved.push(() => exitDoor.openNow());

  // ── stairs down to the beach ──
  // steps from the exit down the dune to the beach
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const z = 295.2 + i * 0.75;
    const y = F - 0.36 * (i + 1);
    b.batch.add(G.box(4.6, 0.36 + 2, 0.78, 0.03), stoneDark, mtx(0, y + 0.18 - 1, z));
  }
  b.col.addFloor({ x: 0, z: 295.2 + (steps * 0.75) / 2 - 0.37, hw: 2.3, hd: (steps * 0.75) / 2, rot: 0, top: (_u, v) => F - 0.18 - ((v + 1) / 2) * 0.36 * steps, bottom: F - 9, surface: 'stone' });

  // ── shore: standing stones ──
  const shore = a.group('shore')[0];
  if (shore) {
    const t = (shore.target ?? '').replace(/#/g, '0');
    const n = shore.w, mH = shore.h;
    const sx0 = -((n - 1) * 2.2) / 2, sz0 = 312.5;
    const sp = 2.2;
    for (let r = 0; r < mH; r++) {
      for (let c = 0; c < n; c++) {
        const x = sx0 + c * sp, z = sz0 + r * sp;
        const y = a.y(x, z);
        const up = t[r * n + c] === '1';
        if (up) {
          b.batch.add(G.box(0.7, 2.1, 0.5, 0.08), stoneDark, mtx(x, y + 1.0, z, 0.1 * (r - c)));
          b.col.addBlocker({ x, z, r: 0.45, y0: y - 1, y1: y + 2.2 });
        } else {
          b.batch.add(G.box(0.7, 0.45, 1.9, 0.08), stoneDark, mtx(x, y + 0.15, z, 0.4 * (c - r), 1, 1, 1, 0.08));
        }
      }
    }
    a.exclude(0, sz0 + 3, 8);
    // the panel stands south of the stones, facing the sea: looking north past it you read the stones like a map
    const p6 = a.panel(shore, { x: -6.2, z: sz0 + mH * sp + 2.2, yaw: 0 }, 'shore');
    // powered when the sanctuary exit opens (the last cave panel)
    if (last) a.chain([p6], last);
    // gate panels at the top of the dunes
    const gate = a.group('gate');
    const g1 = gate[0] ? a.panel(gate[0], { x: -3.6, z: 254.5, yaw: 0 }, 'gate') : null;
    const g2 = gate[1] ? a.panel(gate[1], { x: 3.6, z: 254.5, yaw: 0 }, 'gate') : null;
    const gps = [g1, g2].filter(Boolean) as NonNullable<typeof g1>[];
    a.chain(gps, p6);
    // the gate itself
    const gy = a.y(0, 251);
    solidBox(b, stoneDark, -3.6, gy - 1, 251, 1.4, 7.2, 1.6);
    solidBox(b, stoneDark, 3.6, gy - 1, 251, 1.4, 7.2, 1.6);
    b.batch.add(G.box(9.2, 1.1, 1.9, 0.06), stoneDark, mtx(0, gy + 6.4, 251));
    const gateDoor = a.stoneDoor('pro.gate', 0, gy - 0.2, 251, 5.8, 6.2, 0, stone, 0.7);
    gps[gps.length - 1]?.onSolved.push(() => gateDoor.openNow());
    // enclosing rocks so the only way out is the gate
    const ring: [number, number][] = [];
    for (let i = 0; i <= 26; i++) {
      const tt = i / 26;
      ring.push([-6 - 40 * Math.pow(tt, 0.8) - 5, 251 + tt * 95]);
    }
    for (let i = 0; i <= 26; i++) {
      const tt = i / 26;
      ring.push([6 + 40 * Math.pow(tt, 0.8) + 5, 251 + tt * 95]);
    }
    for (const [x, z] of ring) {
      const s = 2.6 + ((x * 7 + z * 3) % 1.6);
      world.forest.add('rock', x, z, s);
      world.collision.addBlocker({ x, z, r: s * 1.05, y0: -50, y1: 200 });
    }
    wall(b, stoneDark, -11, 251, -4.3, 251, gy - 1, 4.5, 1.4);
    wall(b, stoneDark, 4.3, 251, 11, 251, gy - 1, 4.5, 1.4);
  }
  // palms and driftwood for flavour
  world.forest.add('palm', -14, 300, 1.1);
  world.forest.add('palm', 15, 302, 1.0);
  world.forest.add('palm', 19, 296, 0.9);
  world.forest.add('rockflat', 6, 326, 1.4);
  world.forest.add('rockflat', -9, 330, 1.8);
  return a;
}
