/**
 * Weathered ruins: the stone walls of the old places (the castle, the citadel, the desert temple,
 * the crater, the lighthouse cliffs) are cracked here and there, all of them — so a crack is just
 * a crack, wherever it is. Built around the player, in patches, from the walls' own shapes.
 */
import * as THREE from 'three';
import type { World } from './world';
import { ANCHORS } from './layout';
import { rng } from './noise';

const STONE = new Set(['mold', 'citadel', 'echo', 'mosaic', 'beacon', 'spire']);
const CELL = 48;

/** is (x,z) in one of the old stone places? */
export function stonePlace(x: number, z: number): boolean {
  let best = '', bd = Infinity;
  for (const [id, a] of Object.entries(ANCHORS)) {
    const d = (a.x - x) ** 2 + (a.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return STONE.has(best);
}

/** the colour of a crack: a dark shade of weathered stone */
export const CRACK_COLOR = new THREE.Color('#3b352e');

interface Face {
  c: THREE.Vector3;
  /** along the face (horizontal), up, and out of it */
  u: THREE.Vector3;
  n: THREE.Vector3;
  w: number;
  y0: number;
  y1: number;
  seed: number;
}

export class Weathering {
  private cells = new Map<string, { x: number; z: number; faces: Face[]; mesh: THREE.Mesh | null }>();
  private mat = new THREE.MeshStandardMaterial({ color: CRACK_COLOR, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  readonly group = new THREE.Group();
  private ready = false;

  constructor(private world: World) {
    this.group.userData.castAs = 'skip';
  }

  /** collect the walls' faces (once the island is built) */
  private collect() {
    this.ready = true;
    const col = this.world.collision;
    for (const b of col.allBlockers()) {
      if (b.r !== undefined || b.tag || b.hw === undefined || b.hd === undefined) continue;
      if (b.y1 - b.y0 < 1.4) continue;
      if (!stonePlace(b.x, b.z)) continue;
      const rot = b.rot ?? 0;
      // the box's local axes in the world (rot = THREE rotation.y)
      const ax = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
      const az = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
      const ground = this.world.terrain.heightAt(b.x, b.z);
      const y0 = Math.max(b.y0, ground) + 0.15, y1 = b.y1 - 0.15;
      if (y1 - y0 < 1) continue;
      const faces: [THREE.Vector3, THREE.Vector3, number, number][] = [
        [az, ax, b.hd, b.hw], [az.clone().negate(), ax, b.hd, b.hw], [ax, az, b.hw, b.hd], [ax.clone().negate(), az, b.hw, b.hd],
      ];
      faces.forEach(([n, u, off, half], i) => {
        if (half < 0.9) return; // too narrow to crack
        const c = new THREE.Vector3(b.x, 0, b.z).addScaledVector(n, off + 0.012);
        const f: Face = { c, u, n, w: half, y0, y1, seed: Math.round(b.x * 13 + b.z * 7) * 4 + i };
        const k = `${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}`;
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = { x: Math.floor(c.x / CELL) * CELL + CELL / 2, z: Math.floor(c.z / CELL) * CELL + CELL / 2, faces: [], mesh: null }));
        cell.faces.push(f);
      });
    }
  }

  private build(faces: Face[]): THREE.BufferGeometry {
    const pos: number[] = [], nrm: number[] = [];
    const push = (p: THREE.Vector3, n: THREE.Vector3) => {
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
    };
    const ribbon = (pts: THREE.Vector3[], w: number[], f: Face) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const t = pts[i + 1].clone().sub(pts[i]).normalize();
        const s = new THREE.Vector3().crossVectors(f.n, t).normalize();
        const a0 = pts[i].clone().addScaledVector(s, -w[i]), a1 = pts[i].clone().addScaledVector(s, w[i]);
        const b0 = pts[i + 1].clone().addScaledVector(s, -w[i + 1]), b1 = pts[i + 1].clone().addScaledVector(s, w[i + 1]);
        for (const q of [a0, b0, b1, a0, b1, a1]) push(q, f.n);
      }
    };
    for (const f of faces) {
      const rnd = rng(f.seed);
      // about one crack per 4 m² of wall
      const area = f.w * 2 * (f.y1 - f.y0);
      const count = Math.floor(area / 4 + rnd());
      for (let k = 0; k < count; k++) {
        // from an edge (top or bottom) or anywhere, wandering down or up
        const fromTop = rnd() < 0.55;
        let x = (rnd() * 2 - 1) * f.w * 0.9;
        let y = fromTop ? f.y1 - rnd() * 0.2 : rnd() < 0.5 ? f.y0 + rnd() * 0.2 : f.y0 + rnd() * (f.y1 - f.y0);
        const dir = fromTop ? -1 : 1;
        const len = 0.4 + rnd() * 1.3;
        const steps = 5 + Math.floor(len * 6);
        const pts: THREE.Vector3[] = [], w: number[] = [];
        let drift = (rnd() - 0.5) * 0.6;
        for (let i = 0; i <= steps; i++) {
          pts.push(f.c.clone().addScaledVector(f.u, x).setY(y));
          w.push(0.006 + 0.02 * Math.sin((i / steps) * Math.PI) * (0.6 + rnd() * 0.6));
          drift += (rnd() - 0.5) * 0.5;
          x = Math.max(-f.w, Math.min(f.w, x + drift * (len / steps)));
          y = Math.max(f.y0, Math.min(f.y1, y + dir * (len / steps) * (0.7 + rnd() * 0.4)));
        }
        ribbon(pts, w, f);
        // a branch now and then
        if (rnd() < 0.4 && pts.length > 4) {
          const i0 = 2 + Math.floor(rnd() * (pts.length - 4));
          const bl = 0.15 + rnd() * 0.4;
          const side = rnd() < 0.5 ? -1 : 1;
          const bp = [pts[i0], pts[i0].clone().addScaledVector(f.u, side * bl * 0.5).setY(pts[i0].y + dir * bl * 0.4), pts[i0].clone().addScaledVector(f.u, side * bl).setY(pts[i0].y + dir * bl * 0.7)];
          ribbon(bp, [w[i0] * 0.8, w[i0] * 0.5, 0.002], f);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  }

  /** build the cracks near the player, drop the far ones */
  update(cam: THREE.Vector3) {
    if (!this.ready) this.collect();
    for (const cell of this.cells.values()) {
      const d = Math.hypot(cell.x - cam.x, cell.z - cam.z);
      if (d < 150 && !cell.mesh) {
        cell.mesh = new THREE.Mesh(this.build(cell.faces), this.mat);
        cell.mesh.receiveShadow = true;
        this.group.add(cell.mesh);
      } else if (d > 200 && cell.mesh) {
        this.group.remove(cell.mesh);
        cell.mesh.geometry.dispose();
        cell.mesh = null;
      }
    }
  }
}
