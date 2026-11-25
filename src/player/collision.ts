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

  /** Minimum terrain normal.y you can walk up (0.6 ≈ 53°). */
  maxSlopeNY = 0.6;

  /**
   * The single movement rule shared by the player and the reachability checker:
   * try to move a body (feet at fy) from (fx,fz) to (tx,tz). Steps up to `step` are fine on
   * floors/stairs; on bare terrain you can only walk up slopes gentler than maxSlopeNY; deep
   * water and low ceilings block. Returns the new position (after sliding out of blockers) or null.
   */
  tryMove(fx: number, fz: number, fy: number, tx: number, tz: number, radius: number, step: number, height: number): { x: number; z: number; y: number; surface: Surface | null } | null {
    const p = { x: tx, z: tz };
    this.resolve(p, radius, fy + step * 0.9, fy + height);
    const [g, surf] = this.groundAt(p.x, p.z, fy + step);
    if (g === -Infinity) return null;
    if (surf === null) {
      if (g > fy + 0.005) {
        const e = 0.6;
        const hx = this.terrainHeight(p.x + e, p.z) - this.terrainHeight(p.x - e, p.z);
        const hz = this.terrainHeight(p.x, p.z + e) - this.terrainHeight(p.x, p.z - e);
        const ny = (2 * e) / Math.hypot(hx, hz, 2 * e);
        if (ny < this.maxSlopeNY) return null;
      }
      if (g < this.waterAt(p.x, p.z) - 0.75) return null;
    }
    if (this.ceilingAt(p.x, p.z, Math.max(fy, g) + step, Math.max(fy, g) + height)) return null;
    void fx;
    void fz;
    return { x: p.x, z: p.z, y: g, surface: surf };
  }

  /** A number that changes whenever the solid world changes (for caches built from it). */
  fingerprint(): number {
    let h = this.blockers.length * 7 + this.floors.length * 13;
    for (const b of this.blockers) h = (h * 31 + Math.round(b.x * 3 + b.z * 7 + b.y1 * 11 + (b.r ?? b.hw ?? 0) * 13)) % 1000000007;
    for (const f of this.floors) h = (h * 37 + Math.round(f.x * 5 + f.z * 3 + (typeof f.top === 'number' ? f.top : 1) * 17)) % 1000000007;
    return h;
  }

  /**
   * What is at this point, for lines of sight (one grid lookup): 0 nothing, 1 a fixed solid,
   * 2 something that moves or appears later (a door, a gate, steps that rise) — open or not,
   * with a margin, so nothing is ever drawn on, or hidden by, a thing that will move.
   */
  solidAt(x: number, y: number, z: number): 0 | 1 | 2 {
    const b = this.grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!b) return 0;
    let hit: 0 | 1 = 0;
    for (const o of b.b) {
      const m = o.tag ? 0.4 : 0;
      if (y < o.y0 - m || y > o.y1 + m) continue;
      if (!o.tag && !o.enabled) continue;
      let inside: boolean;
      if (o.r !== undefined) {
        const dx = x - o.x, dz = z - o.z;
        inside = dx * dx + dz * dz <= (o.r + m) * (o.r + m);
      } else {
        const [lx, lz] = this.local(x, z, o.x, o.z, o.rot);
        inside = Math.abs(lx) <= o.hw! + m && Math.abs(lz) <= o.hd! + m;
      }
      if (!inside) continue;
      if (o.tag) return 2;
      hit = 1;
    }
    for (const f of b.f) {
      if (!f.tag) continue;
      let u: number, v: number;
      if (f.r !== undefined) {
        const dx = x - f.x, dz = z - f.z;
        if (dx * dx + dz * dz > (f.r + 0.4) * (f.r + 0.4)) continue;
        u = Math.max(-1, Math.min(1, dx / f.r));
        v = Math.max(-1, Math.min(1, dz / f.r));
      } else {
        const [lx, lz] = this.local(x, z, f.x, f.z, f.rot);
        if (Math.abs(lx) > f.hw! + 0.4 || Math.abs(lz) > f.hd! + 0.4) continue;
        u = Math.max(-1, Math.min(1, lx / f.hw!));
        v = Math.max(-1, Math.min(1, lz / f.hd!));
      }
      const top = typeof f.top === 'number' ? f.top : f.top(u, v);
      if (y <= top + 0.5 && y >= top - 1.1) return 2;
    }
    return hit;
  }

  /** Top of the highest fixed (untagged, enabled) floor at (x,z) that is at or below y (-Infinity if none). */
  floorBelow(x: number, y: number, z: number): number {
    const b = this.grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    let best = -Infinity;
    if (!b) return best;
    for (const f of b.f) {
      if (!f.enabled || f.tag) continue;
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
      if (top <= y && top > best) best = top;
    }
    return best;
  }

  /** Is a circle at (x,z) with radius r overlapping any enabled blocker within [y0,y1]? */
  blockedAt(x: number, z: number, r: number, y0: number, y1: number): boolean {
    const p = { x, z };
    this.resolve(p, r, y0, y1);
    return Math.hypot(p.x - x, p.z - z) > 1e-4;
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
