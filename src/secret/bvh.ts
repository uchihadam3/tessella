/**
 * A small bounding volume hierarchy over a mesh's triangles, for fast and exact lines of sight
 * (where does a ray from a viewing spot first meet what is actually drawn on screen).
 */
export class TriBVH {
  /** triangle ids, reordered so every node covers a contiguous range */
  private tris: Uint32Array;
  /** per node: min xyz, max xyz */
  private bounds: Float32Array;
  /** per node: leaf → [first, -count]; inner → [left child, right child] */
  private links: Int32Array;
  private stack = new Int32Array(96);
  /** the triangle of the last hit */
  lastTri = -1;

  constructor(readonly pos: ArrayLike<number>, readonly index: ArrayLike<number> | null) {
    const n = index ? Math.floor(index.length / 3) : Math.floor(pos.length / 9);
    this.tris = new Uint32Array(n);
    const cen = new Float32Array(n * 3);
    const tb = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      this.tris[i] = i;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const v = (index ? index[i * 3 + k] : i * 3 + k) * 3;
        const x = pos[v], y = pos[v + 1], z = pos[v + 2];
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (z < z0) z0 = z;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
        if (z > z1) z1 = z;
      }
      tb.set([x0, y0, z0, x1, y1, z1], i * 6);
      cen[i * 3] = (x0 + x1) / 2;
      cen[i * 3 + 1] = (y0 + y1) / 2;
      cen[i * 3 + 2] = (z0 + z1) / 2;
    }
    const maxNodes = Math.max(1, 2 * n);
    this.bounds = new Float32Array(maxNodes * 6);
    this.links = new Int32Array(maxNodes * 2);
    let count = 1;
    const work: number[] = [0, 0, n]; // node, start, end
    while (work.length) {
      const end = work.pop()!, start = work.pop()!, node = work.pop()!;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
      for (let i = start; i < end; i++) {
        const t = this.tris[i];
        const o = t * 6;
        if (tb[o] < x0) x0 = tb[o];
        if (tb[o + 1] < y0) y0 = tb[o + 1];
        if (tb[o + 2] < z0) z0 = tb[o + 2];
        if (tb[o + 3] > x1) x1 = tb[o + 3];
        if (tb[o + 4] > y1) y1 = tb[o + 4];
        if (tb[o + 5] > z1) z1 = tb[o + 5];
        const c = t * 3;
        if (cen[c] < cx0) cx0 = cen[c];
        if (cen[c] > cx1) cx1 = cen[c];
        if (cen[c + 1] < cy0) cy0 = cen[c + 1];
        if (cen[c + 1] > cy1) cy1 = cen[c + 1];
        if (cen[c + 2] < cz0) cz0 = cen[c + 2];
        if (cen[c + 2] > cz1) cz1 = cen[c + 2];
      }
      this.bounds.set([x0, y0, z0, x1, y1, z1], node * 6);
      const cnt = end - start;
      if (cnt <= 6) {
        this.links[node * 2] = start;
        this.links[node * 2 + 1] = -cnt;
        continue;
      }
      const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0;
      const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
      const mid = axis === 0 ? (cx0 + cx1) / 2 : axis === 1 ? (cy0 + cy1) / 2 : (cz0 + cz1) / 2;
      let i = start, j = end - 1;
      while (i <= j) {
        if (cen[this.tris[i] * 3 + axis] < mid) i++;
        else {
          const tmp = this.tris[i];
          this.tris[i] = this.tris[j];
          this.tris[j] = tmp;
          j--;
        }
      }
      let split = i;
      if (split === start || split === end) split = (start + end) >> 1; // all centres alike
      const left = count++, right = count++;
      this.links[node * 2] = left;
      this.links[node * 2 + 1] = right;
      work.push(left, start, split, right, split, end);
    }
    this.bounds = this.bounds.slice(0, count * 6);
    this.links = this.links.slice(0, count * 2);
  }

  /** box of the whole mesh (local units) */
  box(): number[] {
    return Array.from(this.bounds.subarray(0, 6));
  }

  private vtx(tri: number, k: number): number {
    return (this.index ? this.index[tri * 3 + k] : tri * 3 + k) * 3;
  }

  /** nearest hit along o + t·d with tMin < t < tMax (both sides of every triangle); Infinity if none */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const B = this.bounds, L = this.links, P = this.pos, T = this.tris;
    // (a direction exactly along an axis would make 0·∞ in the slab test)
    const ix = 1 / (Math.abs(dx) < 1e-12 ? 1e-12 : dx), iy = 1 / (Math.abs(dy) < 1e-12 ? 1e-12 : dy), iz = 1 / (Math.abs(dz) < 1e-12 ? 1e-12 : dz);
    let best = tMax;
    this.lastTri = -1;
    const st = this.stack;
    let sp = 0;
    st[sp++] = 0;
    while (sp > 0) {
      const node = st[--sp];
      const o = node * 6;
      // slab test
      let t0 = (B[o] - ox) * ix, t1 = (B[o + 3] - ox) * ix;
      let lo = t0 < t1 ? t0 : t1, hi = t0 < t1 ? t1 : t0;
      t0 = (B[o + 1] - oy) * iy;
      t1 = (B[o + 4] - oy) * iy;
      lo = Math.max(lo, t0 < t1 ? t0 : t1);
      hi = Math.min(hi, t0 < t1 ? t1 : t0);
      t0 = (B[o + 2] - oz) * iz;
      t1 = (B[o + 5] - oz) * iz;
      lo = Math.max(lo, t0 < t1 ? t0 : t1);
      hi = Math.min(hi, t0 < t1 ? t1 : t0);
      if (!(hi >= lo) || hi < tMin || lo > best) continue;
      const a = L[node * 2], b = L[node * 2 + 1];
      if (b <= 0) {
        for (let i = a; i < a - b; i++) {
          const tri = T[i];
          const v0 = this.vtx(tri, 0), v1 = this.vtx(tri, 1), v2 = this.vtx(tri, 2);
          const e1x = P[v1] - P[v0], e1y = P[v1 + 1] - P[v0 + 1], e1z = P[v1 + 2] - P[v0 + 2];
          const e2x = P[v2] - P[v0], e2y = P[v2 + 1] - P[v0 + 1], e2z = P[v2 + 2] - P[v0 + 2];
          const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const inv = 1 / det;
          const sx = ox - P[v0], sy = oy - P[v0 + 1], sz = oz - P[v0 + 2];
          const u = (sx * px + sy * py + sz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t > tMin && t < best) {
            best = t;
            this.lastTri = tri;
          }
        }
      } else if (sp < st.length - 2) {
        st[sp++] = b;
        st[sp++] = a;
      }
    }
    return this.lastTri >= 0 ? best : Infinity;
  }

  /** unit normal of a triangle (local units) */
  normal(tri: number, out: number[]): number[] {
    const P = this.pos;
    const v0 = this.vtx(tri, 0), v1 = this.vtx(tri, 1), v2 = this.vtx(tri, 2);
    const e1x = P[v1] - P[v0], e1y = P[v1 + 1] - P[v0 + 1], e1z = P[v1 + 2] - P[v0 + 2];
    const e2x = P[v2] - P[v0], e2y = P[v2 + 1] - P[v0 + 1], e2z = P[v2 + 2] - P[v0 + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / l;
    out[1] = ny / l;
    out[2] = nz / l;
    return out;
  }

  /** the largest of a per-vertex value over a triangle's corners */
  maxOver(tri: number, values: ArrayLike<number>): number {
    const a = this.vtx(tri, 0) / 3, b = this.vtx(tri, 1) / 3, c = this.vtx(tri, 2) / 3;
    return Math.max(values[a], values[b], values[c]);
  }
}
