/**
 * The desert's stations — "the sun shows the way". Every panel there is a path of light between
 * its two wells, and its answer is always the path the sun draws; each station shows that drawing
 * a different way, and from the second panel on, never the whole of it at once:
 *
 *   hood      a pierced stone canopy over the panel: the sun falls on the panel itself (the first
 *             one shows everything; then a palm frond blocks part of it, then a cloth all of it —
 *             the holes, seen from below, still tell)
 *   pergola   a pierced roof over a paved floor beside the panel: the sun falls on the floor, which
 *             has the panel's grid and its two wells. Variations: a stele throws a shadow over part
 *             (the whole drawing is carved on its back), sand covers part (the rest follows: a path
 *             joins the wells, one tile wide, never touching itself), sand covers all (read the
 *             roof from below), a wall stands in the way (the far rows climb the wall), two pierced
 *             roofs one above the other (light only where both are open), beams instead of a
 *             pierced roof (the path is the shadow), polished tiles that only gleam seen from one
 *             spot (marked by footprints)
 *   mirror    a bronze plate throws the sunlight far away, onto a wall
 *
 * Grids are laid out as seen by someone standing at the station's spot looking out along `v`:
 * row 0 farthest, column 0 on the left.
 */
import * as THREE from 'three';
import { AreaCtx, yawToward } from './common';
import { G, mtx, column, floorSlab } from '../arch';
import { M, mat } from '../materials';
import type { Panel } from '../../puzzle/panels';
import type { PuzzleDef } from '../../puzzle/types';

type V2 = { x: number; z: number };

/** Which way the sun's light comes from in the desert (high afternoon, from the south-west). */
export const DESERT_SUN = new THREE.Vector3(-0.42, 0.82, 0.39).normalize();

const lightMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.48), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const shadeMat = (o = 0.4) => new THREE.MeshBasicMaterial({ color: '#2a1a0c', transparent: true, opacity: o, depthWrite: false });

function frame(w: number, h: number, c: V2, v: V2, cs: number) {
  const u = { x: -v.z, z: v.x };
  return (r: number, col: number) => ({ x: c.x + u.x * (col - (w - 1) / 2) * cs + v.x * ((h - 1) / 2 - r) * cs, z: c.z + u.z * (col - (w - 1) / 2) * cs + v.z * ((h - 1) / 2 - r) * cs });
}
const flat = (geo: THREE.BufferGeometry) => geo.rotateX(-Math.PI / 2);
const answer = (def: PuzzleDef) => (def.target ?? '').replace(/\//g, '');
const isWell = (def: PuzzleDef, i: number) => def.cells[i].glyph?.kind === 'well';

/** the panel on its pedestal, standing to the left of the spot V (looking along v), turned to V */
function sidePanel(a: AreaCtx, def: PuzzleDef, group: string, V: V2, v: V2, half: number, y?: number): Panel {
  const u = { x: -v.z, z: v.x };
  const P = { x: V.x + v.x * 1.2 - u.x * (half + 1.2), z: V.z + v.z * 1.2 - u.z * (half + 1.2) };
  let py = y;
  if (py === undefined) {
    py = -Infinity;
    for (const dx of [-0.9, 0, 0.9]) for (const dz of [-0.9, 0, 0.9]) py = Math.max(py, a.world.collision.groundAt(P.x + dx, P.z + dz, 9999)[0]);
    py += 0.02;
  }
  return a.panel(def, { x: P.x, z: P.z, y: py, yaw: yawToward(P.x, P.z, V.x, V.z) }, group);
}

// ───────────────────────── hood: the sun on the panel itself ─────────────────────────

/**
 * A panel under a pierced stone canopy. mode 'full': sunlight on every tile of the path; 'frond':
 * a palm frond lies on the far half of the canopy (no light there); 'cloth': a cloth covers it all.
 * The holes can always be seen from below.
 */
export function hoodStation(a: AreaCtx, def: PuzzleDef, group: string, P: V2, facing: V2, mode: 'full' | 'frond' | 'cloth', stone: THREE.Material): Panel {
  const panel = a.panel(def, { x: P.x, z: P.z, yaw: yawToward(P.x, P.z, P.x + facing.x, P.z + facing.z) }, group);
  const t = answer(def);
  const w = def.w, h = def.h;
  const blocked = (r: number) => (mode === 'cloth' ? true : mode === 'frond' ? r >= Math.ceil(h / 2) : false);
  const sun = new Set<number>();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (t[r * w + c] === '1' && !blocked(r)) sun.add(r * w + c);
  panel.view.sunTiles = sun;
  panel.view.markDirty();
  // the canopy: above the panel, a little behind it, rows going away from the viewer
  const v = { x: -facing.x, z: -facing.z };
  const u = { x: -v.z, z: v.x };
  const cs = 0.26;
  const y0 = panel.view.root.position.y + 2.35;
  const c0 = { x: P.x + v.x * 0.25, z: P.z + v.z * 0.25 };
  const at = frame(w, h, c0, v, cs);
  const ry = Math.atan2(-v.x, -v.z);
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = stone) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.y = ry;
    g.add(me);
  };
  const W = w * cs, H = h * cs;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(W + 0.24, 0.12, 0.12), c0.x + v.x * s * (H / 2 + 0.06), y0, c0.z + v.z * s * (H / 2 + 0.06));
    add(new THREE.BoxGeometry(0.12, 0.12, H + 0.24), c0.x + u.x * s * (W / 2 + 0.06), y0, c0.z + u.z * s * (W / 2 + 0.06));
  }
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (t[r * w + c] === '1') continue;
    const q = at(r, c);
    add(new THREE.BoxGeometry(cs, 0.1, cs), q.x, y0, q.z);
  }
  // two posts behind the panel carry it
  for (const s of [-1, 1]) {
    const q = { x: c0.x + u.x * s * (W / 2 + 0.06) + v.x * (H / 2 + 0.06), z: c0.z + u.z * s * (W / 2 + 0.06) + v.z * (H / 2 + 0.06) };
    const by = a.y(q.x, q.z);
    a.build.batch.add(G.cyl(0.06, 0.08, y0 - by + 0.05, 8), stone, mtx(q.x, (y0 + by) / 2, q.z));
  }
  if (mode !== 'full') {
    // what blocks the sun: a palm frond over the far half, or a red cloth over everything
    const rows = mode === 'cloth' ? h : h - Math.ceil(h / 2);
    const cover = mode === 'cloth' ? M.cloth('#b8452f') : mat('frond', { color: '#5f8f3a', roughness: 0.8, detail: 0.2, scale: 2, side: THREE.DoubleSide });
    const depth = rows * cs + 0.1;
    const off = mode === 'cloth' ? 0 : -(H / 2) + depth / 2;
    const q = { x: c0.x - v.x * off, z: c0.z - v.z * off };
    add(new THREE.BoxGeometry(W + 0.2, 0.02, depth), q.x, y0 + 0.08, q.z, cover);
  }
  a.dynamic.add(g);
  panel.view.root.userData.clue = { x: P.x + facing.x * 1.4, z: P.z + facing.z * 1.4, tx: c0.x, tz: c0.z, up: y0 };
  return panel;
}

// ───────────────────────── pergola: the sun on a floor ─────────────────────────

export interface PergolaOpts {
  /** cells under sand ('?'), as rows separated by '/' */
  sand?: string;
  /** a stele throws its shadow over these columns (from this one on); the whole drawing is carved on its back */
  stele?: { fromCol: number; cols?: number; sandRows?: number };
  /** the roof's holes over sand-covered cells are clogged too (and beams there have fallen) */
  clog?: boolean;
  /** this many far rows climb a wall standing in the way */
  wall?: number;
  /** two pierced roofs, one above the other: light only where both are open */
  twoRoofs?: boolean;
  /** beams instead of a pierced roof: the path is the shadow */
  beams?: boolean;
  /** no roof: polished tiles that gleam only seen from the spot (footprints) */
  gleam?: boolean;
  /** cell size (m) */
  cs?: number;
  /** a fixed floor height (on a paved court) */
  y?: number;
}

/**
 * A pergola station: the viewer stands at V looking along v; the floor with the light (or shadow,
 * or gleam) lies straight ahead, the panel stands to the left, turned towards V.
 */
export function pergolaStation(a: AreaCtx, def: PuzzleDef, group: string, V: V2, v: V2, stone: THREE.Material, stoneS: THREE.Material, o: PergolaOpts = {}): Panel {
  const cs = o.cs ?? 0.9;
  const w = def.w, h = def.h;
  const t = answer(def);
  const hidden = (o.sand ?? '').replace(/\//g, '');
  const u = { x: -v.z, z: v.x };
  const half = (Math.max(w, h) * cs) / 2;
  const pc = { x: V.x + v.x * (1.6 + (h * cs) / 2), z: V.z + v.z * (1.6 + (h * cs) / 2) };
  const at = frame(w, h, pc, v, cs);
  const ry = Math.atan2(-v.x, -v.z);
  const H = 2.7;
  const shift = { x: (DESERT_SUN.x / DESERT_SUN.y) * H, z: (DESERT_SUN.z / DESERT_SUN.y) * H };
  const lc = { x: pc.x + shift.x, z: pc.z + shift.z };
  const lat = frame(w, h, lc, v, cs);
  const span = Math.max(w, h) * cs;

  // the paved floor: the panel's grid with its two wells
  let fy = o.y ?? -Infinity;
  const mid = { x: (pc.x + lc.x) / 2, z: (pc.z + lc.z) / 2 };
  const fsz = span + Math.hypot(shift.x, shift.z) + 2.8;
  if (o.y === undefined) {
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) fy = Math.max(fy, a.y(mid.x + dx * (span / 2 + 1.5), mid.z + dz * (span / 2 + 1.5)));
    fy += 0.12;
    floorSlab(a.build, stoneS, mid.x, fy, mid.z, fsz, fsz, ry, 1.2);
    a.exclude(mid.x, mid.z, fsz / 2 + 1);
  } else {
    // on the court: a plain paving of its own over the old mosaic, so nothing else is read there
    fy += 0.06;
    floorSlab(a.build, stoneS, mid.x, fy, mid.z, fsz, fsz, ry, 0.1);
  }
  const grout = M.sandstone();
  for (let k = 0; k <= w; k++) { const q = at((h - 1) / 2, k - 0.5); a.build.batch.add(G.box(0.05, 0.02, h * cs), grout, mtx(q.x, fy + 0.005, q.z, ry)); }
  for (let k = 0; k <= h; k++) { const q = at(k - 0.5, (w - 1) / 2); a.build.batch.add(G.box(w * cs, 0.02, 0.05), grout, mtx(q.x, fy + 0.005, q.z, ry)); }
  const water = mat('wellWater', { color: '#3e8fb0', roughness: 0.1, detail: 0, scale: 1 });
  for (let i = 0; i < w * h; i++) {
    if (!isWell(def, i)) continue;
    const q = at(Math.floor(i / w), i % w);
    a.build.batch.add(G.cyl(cs * 0.36, cs * 0.4, 0.22, 16), stone, mtx(q.x, fy + 0.11, q.z));
    a.build.batch.add(G.cyl(cs * 0.27, cs * 0.27, 0.05, 16), water, mtx(q.x, fy + 0.21, q.z));
  }

  // which cells get light on the floor
  const steleCols = o.stele ? (c: number) => c >= o.stele!.fromCol && c < o.stele!.fromCol + (o.stele!.cols ?? w) : () => false;
  // over shaded or clogged cells the roof shows nothing either: sand fills its holes
  const clogged = (r: number, c: number) => steleCols(c) || (!!o.clog && hidden[r * w + c] === '?');
  const wallRows = o.wall ?? 0;
  const lit = (r: number, c: number) => t[r * w + c] === '1' && hidden[r * w + c] !== '?' && !steleCols(c) && r >= wallRows && !isWell(def, r * w + c);
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material, rot = ry) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.y = rot;
    g.add(me);
    return me;
  };

  if (o.gleam) {
    // polished tiles: dull from everywhere but the footprints, where they flash in the sun
    const polish = mat('polished', { color: '#e9cf9a', roughness: 0.18, metalness: 0.2, detail: 0.05, scale: 3 });
    const glints: THREE.Mesh[] = [];
    const gm = lightMat();
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (t[r * w + c] !== '1' || isWell(def, r * w + c)) continue;
      const q = at(r, c);
      a.build.batch.add(G.box(cs * 0.9, 0.02, cs * 0.9), polish, mtx(q.x, fy + 0.012, q.z, ry));
      glints.push(add(flat(new THREE.PlaneGeometry(cs * 0.86, cs * 0.86)), q.x, fy + 0.03, q.z, gm));
    }
    // decoys: other polished tiles that never flash
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (t[r * w + c] === '1' || (r + 2 * c) % 3) continue;
      const q = at(r, c);
      a.build.batch.add(G.box(cs * 0.9, 0.02, cs * 0.9), polish, mtx(q.x, fy + 0.012, q.z, ry));
    }
    // footprints at the spot
    const foot = mat('footprint', { color: '#8a6a44', roughness: 0.95, detail: 0.1, scale: 2 });
    for (const s of [-1, 1]) a.build.batch.add(G.box(0.14, 0.02, 0.3), foot, mtx(V.x + u.x * s * 0.14, fy + 0.012, V.z + u.z * s * 0.14, ry));
    const cam = a.world.engine.camera;
    a.onUpdate(() => {
      const on = Math.hypot(cam.position.x - V.x, cam.position.z - V.z) < 0.7;
      for (const m of glints) m.visible = on;
    });
  } else if (o.beams) {
    // beams on four posts: the floor is all in the sun except the path, which is in their shadow
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const q = { x: lc.x + u.x * sx * (span / 2 + 0.25) + v.x * sz * (span / 2 + 0.25), z: lc.z + u.z * sx * (span / 2 + 0.25) + v.z * sz * (span / 2 + 0.25) };
      column(a.build, stone, q.x, fy, q.z, H + 0.35, 0.2);
    }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (t[r * w + c] !== '1' || clogged(r, c)) continue;
      const q = lat(r, c);
      add(new THREE.BoxGeometry(cs, 0.3, cs), q.x, fy + H + 0.35, q.z, stone);
    }
    const sunny = lightMat();
    sunny.opacity = 0.3;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (hidden[r * w + c] === '?') continue;
      const q = at(r, c);
      if (t[r * w + c] === '1') add(flat(new THREE.PlaneGeometry(cs * 0.94, cs * 0.94)), q.x, fy + 0.02, q.z, shadeMat(0.82));
      else add(flat(new THREE.PlaneGeometry(cs * 0.94, cs * 0.94)), q.x, fy + 0.02, q.z, sunny);
    }
  } else {
    // a pierced roof on four posts (or two, one above the other)
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const q = { x: lc.x + u.x * sx * (span / 2 + 0.25) + v.x * sz * (span / 2 + 0.25), z: lc.z + u.z * sx * (span / 2 + 0.25) + v.z * sz * (span / 2 + 0.25) };
      column(a.build, stone, q.x, fy, q.z, H + 0.35, 0.2);
    }
    const roof = (yy: number, open: (r: number, c: number) => boolean, m: THREE.Material) => {
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(span + 0.7, 0.26, 0.26), lc.x + v.x * s * (span / 2 + 0.13), yy, lc.z + v.z * s * (span / 2 + 0.13), m);
        add(new THREE.BoxGeometry(0.26, 0.26, span + 0.7), lc.x + u.x * s * (span / 2 + 0.13), yy, lc.z + u.z * s * (span / 2 + 0.13), m);
      }
      const sandFill = M.sandSmooth();
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const q = lat(r, c);
        if (!open(r, c)) add(new THREE.BoxGeometry(cs * 0.98, 0.2, cs * 0.98), q.x, yy, q.z, m);
        else if (clogged(r, c)) add(new THREE.BoxGeometry(cs * 0.98, 0.24, cs * 0.98), q.x, yy + 0.02, q.z, sandFill);
      }
      for (let k = 1; k < w; k++) { const q = lat((h - 1) / 2, k - 0.5); add(new THREE.BoxGeometry(0.07, 0.22, h * cs), q.x, yy, q.z, m); }
      for (let k = 1; k < h; k++) { const q = lat(k - 0.5, (w - 1) / 2); add(new THREE.BoxGeometry(w * cs, 0.22, 0.07), q.x, yy, q.z, m); }
    };
    const open = (r: number, c: number) => t[r * w + c] === '1';
    if (o.twoRoofs) {
      // each roof has extra holes of its own; only the path is open in both
      const extraA = (r: number, c: number) => (r * 3 + c * 5) % 4 === 1 && !open(r, c);
      const extraB = (r: number, c: number) => (r * 5 + c * 3) % 4 === 3 && !open(r, c) && !extraA(r, c);
      roof(H + 0.35, (r, c) => open(r, c) || extraA(r, c), stone);
      roof(H - 0.55, (r, c) => open(r, c) || extraB(r, c), mat('roofDark', { color: '#b98d58', roughness: 0.9, detail: 0.2, scale: 1.2 }));
    } else roof(H + 0.35, open, stone);
    add(flat(new THREE.PlaneGeometry(span + 0.5, span + 0.5)), pc.x, fy + 0.015, pc.z, shadeMat());
    const lm = lightMat();
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (!lit(r, c)) continue;
      const q = at(r, c);
      add(flat(new THREE.PlaneGeometry(cs * 0.88, cs * 0.88)), q.x, fy + 0.025, q.z, lm);
    }
  }

  // a stele beside the floor throws its shadow over the right-hand columns; the whole drawing is
  // carved on its far face — you walk round it to read it
  if (o.stele) {
    const n = o.stele.cols ?? w - o.stele.fromCol;
    const edge = at((h - 1) / 2, o.stele.fromCol + n - 1);
    const sp = { x: edge.x + u.x * (cs / 2 + 0.55), z: edge.z + u.z * (cs / 2 + 0.55) };
    const sw = h * cs * 0.9, sh = 2.4;
    a.build.batch.add(G.box(0.4, sh, sw, 0.03), stone, mtx(sp.x, fy + sh / 2, sp.z, ry));
    a.world.collision.addBlocker({ x: sp.x, z: sp.z, hw: 0.22, hd: sw / 2, rot: ry, y0: fy, y1: fy + sh });
    // its shadow over the shaded columns
    for (let r = 0; r < h; r++) for (let c = o.stele.fromCol; c < o.stele.fromCol + n; c++) {
      const q = at(r, c);
      add(flat(new THREE.PlaneGeometry(cs * 0.96, cs * 0.96)), q.x, fy + 0.02, q.z, shadeMat(0.35));
    }
    carvedPlate(a, def, { x: sp.x + u.x * 0.21, z: sp.z + u.z * 0.21 }, fy + 1.35, u, Math.min(sw - 0.2, 1.7), o.stele.sandRows ?? 0);
    if (o.stele.sandRows) {
      // a drift of sand blown against the foot of the carving
      a.build.batch.add(G.sphere(1, 16), M.sandSmooth(), mtx(sp.x + u.x * 0.5, fy + 0.2, sp.z + u.z * 0.5, ry, 0.9, 0.9, sw * 0.6));
    }
  }

  // a wall in the way: the far rows of the light climb it
  if (wallRows > 0) {
    const edge = at(wallRows - 0.5, (w - 1) / 2);
    const wy = fy;
    a.build.batch.add(G.box(w * cs + 1.2, 3.4, 0.5, 0.03), stone, mtx(edge.x + v.x * 0.25, wy + 1.7, edge.z + v.z * 0.25, ry));
    a.world.collision.addBlocker({ x: edge.x + v.x * 0.25, z: edge.z + v.z * 0.25, hw: (w * cs + 1.2) / 2, hd: 0.25, rot: ry, y0: wy, y1: wy + 3.4 });
    const lm = lightMat();
    for (let r = 0; r < wallRows; r++) for (let c = 0; c < w; c++) {
      if (t[r * w + c] !== '1') continue;
      const q = at(wallRows - 0.5, c);
      // row wallRows-1 lowest on the wall, row 0 highest
      const y = wy + 0.5 + (wallRows - 1 - r) * cs;
      const m = add(new THREE.PlaneGeometry(cs * 0.88, cs * 0.88), q.x - v.x * 0.01, y, q.z - v.z * 0.01, lm, Math.atan2(-v.x, -v.z));
      void m;
      if (isWell(def, r * w + c)) a.build.batch.add(G.cyl(cs * 0.3, cs * 0.3, 0.06, 16), M.bronze(), mtx(q.x - v.x * 0.04, y, q.z - v.z * 0.04, Math.atan2(-v.x, -v.z), 1, 1, 1, Math.PI / 2));
    }
  }

  // sand: one smooth heap over the hidden block
  if (hidden.includes('?')) {
    let r0 = h, r1 = -1, c0 = w, c1 = -1;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (hidden[r * w + c] === '?') { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    const q = at((r0 + r1) / 2, (c0 + c1) / 2);
    const eu = ((c1 - c0 + 1) * cs) / 2, ev = ((r1 - r0 + 1) * cs) / 2;
    a.build.batch.add(G.sphere(1, 20), M.sandSmooth(), mtx(q.x, fy - 0.15, q.z, ry, eu * 1.25, 0.6, ev * 1.3));
    a.build.batch.add(G.sphere(1, 20), M.sandSmooth(), mtx(q.x, fy - 0.08, q.z, ry, eu * 1.55, 0.28, ev * 1.55));
  }

  a.dynamic.add(g);
  const panel = sidePanel(a, def, group, V, v, (w * cs) / 2, o.y !== undefined ? o.y : undefined);
  panel.view.root.userData.clue = { x: V.x, z: V.z, tx: pc.x, tz: pc.z };
  return panel;
}

/** The drawing carved on a stone face (gold inlay on the path, rings for the wells); the bottom
 *  `sandRows` rows are under a little drift of sand. */
function carvedPlate(a: AreaCtx, def: PuzzleDef, c: V2, y: number, n: V2, size: number, sandRows: number) {
  const w = def.w, h = def.h, t = answer(def);
  const px = 64;
  const cv = document.createElement('canvas');
  cv.width = w * px;
  cv.height = h * px;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#c9a774';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < h; r++) for (let col = 0; col < w; col++) {
    const i = r * w + col;
    ctx.fillStyle = t[i] === '1' ? '#e8b64c' : '#a98656';
    ctx.fillRect(col * px + 4, r * px + 4, px - 8, px - 8);
    if (isWell(def, i)) {
      ctx.beginPath();
      ctx.arc(col * px + px / 2, r * px + px / 2, px * 0.28, 0, Math.PI * 2);
      ctx.strokeStyle = '#5a3a14';
      ctx.lineWidth = px * 0.08;
      ctx.stroke();
    }
  }
  if (sandRows > 0) {
    ctx.fillStyle = '#e2bf88';
    ctx.fillRect(0, (h - sandRows) * px - 6, cv.width, sandRows * px + 6);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cell = size / Math.max(w, h);
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w * cell, h * cell), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  me.position.set(c.x, y, c.z);
  me.rotation.y = Math.atan2(n.x, n.z);
  a.dynamic.add(me);
}

// ───────────────────────── mirror: the sun thrown onto a far wall ─────────────────────────

/**
 * A bronze plate on a post beside the spot V catches the sun and throws it along `beam` onto a
 * wall at `wall` (facing back along the beam): the drawing appears there, far from the panel.
 */
export function mirrorStation(a: AreaCtx, def: PuzzleDef, group: string, V: V2, v: V2, wall: { x: number; z: number; y: number }, y: number, stone: THREE.Material): Panel {
  const w = def.w, h = def.h, t = answer(def);
  const u = { x: -v.z, z: v.x };
  const plate = { x: V.x + u.x * 1.4 + v.x * 0.6, z: V.z + u.z * 1.4 + v.z * 0.6 };
  a.build.batch.add(G.cyl(0.07, 0.09, 1.6, 8), stone, mtx(plate.x, y + 0.8, plate.z));
  const disc = new THREE.Mesh(G.cyl(0.42, 0.42, 0.05, 24), M.bronze());
  disc.position.set(plate.x, y + 1.75, plate.z);
  disc.lookAt(wall.x, wall.y, wall.z);
  disc.rotateX(Math.PI / 2);
  a.dynamic.add(disc);
  // the beam of light
  const from = new THREE.Vector3(plate.x, y + 1.75, plate.z), to = new THREE.Vector3(wall.x, wall.y, wall.z);
  const len = from.distanceTo(to);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, len, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.2), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shaft.position.copy(from).lerp(to, 0.5);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  a.dynamic.add(shaft);
  // the drawing on the wall: row 0 at the top, as you see it from the spot
  const cs = 0.55;
  const lm = lightMat();
  const nx = -v.x, nz = -v.z;
  const rot = Math.atan2(nx, nz);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (t[i] !== '1') continue;
    const px = wall.x + u.x * (c - (w - 1) / 2) * cs, pz = wall.z + u.z * (c - (w - 1) / 2) * cs;
    const py = wall.y + ((h - 1) / 2 - r) * cs;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cs * 0.88, cs * 0.88), lm);
    m.position.set(px + nx * 0.03, py, pz + nz * 0.03);
    m.rotation.y = rot;
    a.dynamic.add(m);
    if (isWell(def, i)) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(cs * 0.3, 0.035, 8, 20), M.bronze());
      ring.position.set(px + nx * 0.05, py, pz + nz * 0.05);
      ring.rotation.y = rot;
      a.dynamic.add(ring);
    }
  }
  const panel = sidePanel(a, def, group, V, v, 0.6, y);
  panel.view.root.userData.clue = { x: V.x, z: V.z, tx: wall.x, tz: wall.z, up: wall.y };
  return panel;
}
