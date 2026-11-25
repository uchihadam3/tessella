/**
 * Simple 2.5D collision world for a walking game: vertical circles/boxes block, walkable
 * surfaces (floors, stairs, bridges) give ground height. Terrain height comes from the heightmap.
 */
import type { Surface } from '../audio/api';

export interface Blocker {
  /** circle when r is set, otherwise oriented box (rot = THREE rotation.y of the box) */
  x: number;
  z: number;
  r?: number;
  hw?: number;
  hd?: number;
  rot?: number;
  y0: number;
  y1: number;
  enabled?: boolean;
  tag?: string;
}

export interface Floor {
  x: number;
  z: number;
  /** circle radius or box half sizes */
  r?: number;
  hw?: number;
  hd?: number;
  rot?: number;
  /** walkable top height: constant or a function of local coords (u along hw axis, v along hd axis, both in [-1,1]) */
  top: number | ((u: number, v: number) => number);
  /** lowest point you can stand under it (ceiling bottom); defaults to top - 0.6 */
  bottom?: number;
  surface?: Surface;
  enabled?: boolean;
  tag?: string;
}

const CELL = 16;

export class CollisionWorld {
  private blockers: Blocker[] = [];
  private floors: Floor[] = [];
  private grid = new Map<string, { b: Blocker[]; f: Floor[] }>();
  waterAt: (x: number, z: number) => number = () => 0;

  constructor(public terrainHeight: (x: number, z: number) => number) {}

  private cellsFor(x: number, z: number, rad: number): string[] {
    const out: string[] = [];
    const i0 = Math.floor((x - rad) / CELL), i1 = Math.floor((x + rad) / CELL);
    const j0 = Math.floor((z - rad) / CELL), j1 = Math.floor((z + rad) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(`${i},${j}`);
    return out;
  }
  private bucket(k: string) {
    let b = this.grid.get(k);
    if (!b) {
      b = { b: [], f: [] };
      this.grid.set(k, b);
    }
    return b;
  }

  addBlocker(b: Blocker): Blocker {
    if (b.enabled === undefined) b.enabled = true;
    this.blockers.push(b);
    const rad = b.r ?? Math.hypot(b.hw ?? 0, b.hd ?? 0);
    for (const k of this.cellsFor(b.x, b.z, rad + 1)) this.bucket(k).b.push(b);
    return b;
  }
  addFloor(f: Floor): Floor {
    if (f.enabled === undefined) f.enabled = true;
    this.floors.push(f);
    const rad = f.r ?? Math.hypot(f.hw ?? 0, f.hd ?? 0);
    for (const k of this.cellsFor(f.x, f.z, rad + 1)) this.bucket(k).f.push(f);
    return f;
  }
  /** Convenience: a solid box that blocks AND can be stood on (walls you can climb onto aren't wanted, so top is only used when you're already above). */
  addSolidBox(x: number, z: number, hw: number, hd: number, rot: number, y0: number, y1: number, surface: Surface = 'stone', tag?: string) {
    this.addBlocker({ x, z, hw, hd, rot, y0, y1, tag });
    this.addFloor({ x, z, hw, hd, rot, top: y1, bottom: y0, surface, tag });
  }

  setEnabledByTag(tag: string, enabled: boolean) {
    for (const b of this.blockers) if (b.tag === tag) b.enabled = enabled;
    for (const f of this.floors) if (f.tag === tag) f.enabled = enabled;
  }

  /** World -> local, using the same convention as THREE's rotation.y (rot = object.rotation.y). */
  private local(x: number, z: number, cx: number, cz: number, rot = 0): [number, number] {
    const dx = x - cx, dz = z - cz;
    const c = Math.cos(rot), s = Math.sin(rot);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  /** Highest walkable height at (x,z) that is <= maxY. Returns [height, surface|null]. */
  groundAt(x: number, z: number, maxY: number): [number, Surface | null] {
    let best = -Infinity;
    let surf: Surface | null = null;
    const t = this.terrainHeight(x, z);
    if (t <= maxY) best = t;
    const b = this.grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (b) {
      for (const f of b.f) {
        if (!f.enabled) continue;
        let u: number, v: number;
        if (f.r !== undefined) {
          const dx = x - f.x, dz = z - f.z;
          if (dx * dx + dz * dz > f.r * f.r) continue;
          u = dx / f.r;
          v = dz / f.r;
        } else {
          const [lx, lz] = this.local(x, z, f.x, f.z, f.rot);
          if (Math.abs(lx) > f.hw! || Math.abs(lz) > f.hd!) continue;
          u = lx / f.hw!;
          v = lz / f.hd!;
        }
        const top = typeof f.top === 'number' ? f.top : f.top(u, v);
        if (top <= maxY && top > best) {
          best = top;
          surf = f.surface ?? 'stone';
        }
      }
    }
    return [best, surf];
  }

  /** Is there a ceiling (floor bottom) between y0 and y1 at x,z? */
  ceilingAt(x: number, z: number, y0: number, y1: number): boolean {
    const b = this.grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!b) return false;
    for (const f of b.f) {
      if (!f.enabled) continue;
      const bottom = f.bottom ?? (typeof f.top === 'number' ? f.top - 0.6 : -Infinity);
      if (bottom <= y0 || bottom >= y1) continue;
      if (f.r !== undefined) {
        if ((x - f.x) ** 2 + (z - f.z) ** 2 > f.r * f.r) continue;
      } else {
        const [lx, lz] = this.local(x, z, f.x, f.z, f.rot);
        if (Math.abs(lx) > f.hw! || Math.abs(lz) > f.hd!) continue;
      }
      return true;
    }
    return false;
  }

  /** Push a circle (player) out of blockers overlapping [y0,y1]. Mutates pos. */
  resolve(pos: { x: number; z: number }, radius: number, y0: number, y1: number) {
    for (let iter = 0; iter < 3; iter++) {
      const keys = this.cellsFor(pos.x, pos.z, radius + 1);
      let moved = false;
      const seen = new Set<Blocker>();
      for (const k of keys) {
        const b = this.grid.get(k);
        if (!b) continue;
        for (const o of b.b) {
          if (seen.has(o) || !o.enabled) continue;
          seen.add(o);
          if (o.y1 <= y0 || o.y0 >= y1) continue;
          if (o.r !== undefined) {
            const dx = pos.x - o.x, dz = pos.z - o.z;
            const d = Math.hypot(dx, dz);
            const min = o.r + radius;
            if (d < min && d > 1e-6) {
              pos.x = o.x + (dx / d) * min;
              pos.z = o.z + (dz / d) * min;
              moved = true;
            }
          } else {
            const rot = o.rot ?? 0;
            const [lx, lz] = this.local(pos.x, pos.z, o.x, o.z, rot);
            const hw = o.hw!, hd = o.hd!;
            const cx = Math.max(-hw, Math.min(hw, lx));
            const cz = Math.max(-hd, Math.min(hd, lz));
            let ddx = lx - cx, ddz = lz - cz;
            let d = Math.hypot(ddx, ddz);
            let nlx = lx, nlz = lz;
            if (d < radius) {
              if (d < 1e-6) {
                // inside: push out along the smallest penetration axis
                const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
                if (px < pz) nlx = Math.sign(lx || 1) * (hw + radius);
                else nlz = Math.sign(lz || 1) * (hd + radius);
              } else {
                ddx /= d;
                ddz /= d;
                nlx = cx + ddx * radius;
                nlz = cz + ddz * radius;
              }
              const c = Math.cos(rot), s = Math.sin(rot);
              pos.x = o.x + nlx * c + nlz * s;
              pos.z = o.z - nlx * s + nlz * c;
              moved = true;
            }
          }
        }
      }
      if (!moved) break;
    }
  }
}
