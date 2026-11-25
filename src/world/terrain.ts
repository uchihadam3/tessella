/**
 * Island terrain: an analytic height function sampled on a grid, smoothed along paths,
 * coloured per biome, rendered in chunks. heightAt() samples the same grid (bilinear) so
 * gameplay and visuals always agree.
 */
import * as THREE from 'three';
import { simplex, smoothstep, lerp, clamp } from './noise';
import {
  WORLD_HALF, CELL, HUB, CALDERA, CITADEL, NORTH_LANDING, GROUNDS, MEADOW, SAND, WET_SAND, ROCK, PATH, PATHS, ANCHORS,
} from './layout';
import type { Surface } from '../audio/api';

const N = Math.round((WORLD_HALF * 2) / CELL); // cells per side
const V = N + 1; // vertices per side

function dist(x: number, z: number, ax: number, az: number) {
  return Math.hypot(x - ax, z - az);
}

/** Raw analytic height (before path smoothing). */
export function rawHeight(x: number, z: number): number {
  // ── island silhouette ──
  const d = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  let R = 332 + 16 * simplex.noise(Math.cos(ang) * 1.4 + 3.1, Math.sin(ang) * 1.4 - 2.7) + 8 * simplex.noise(Math.cos(ang) * 4 + 9, Math.sin(ang) * 4 + 1);
  // a broad sandy bay in the south for the awakening beach
  R += 18 * Math.exp(-Math.pow((ang - Math.PI / 2) / 0.35, 2));
  const land = smoothstep(R + 34, R - 28, d);
  let h = lerp(-24, 8.5, land);
  const hills = 5.5 * simplex.fbm(x / 190 + 11, z / 190 - 7, 4) + 2.2 * simplex.fbm(x / 55, z / 55, 3);
  const inland = smoothstep(R - 10, R - 90, d);
  h += hills * inland + 3 * inland;

  // ── hub plateau ──
  {
    const dh = dist(x, z, HUB.x, HUB.z);
    const w = smoothstep(95, 44, dh);
    h = lerp(h, HUB.y + 0.25 * simplex.noise(x / 9, z / 9) * smoothstep(31, 36, dh) - 0.18 * smoothstep(36, 31, dh), w);
  }

  // ── areas ──
  // kinship: autumn hills
  {
    const a = ANCHORS.kinship;
    const w = smoothstep(130, 70, dist(x, z, a.x, a.z));
    const t = 15 + 4.5 * simplex.fbm(x / 70 + 3, z / 70 + 8, 3);
    h = lerp(h, t, w);
  }
  // measure: terraces rising to the east
  {
    const a = ANCHORS.measure;
    const w = smoothstep(125, 72, dist(x, z, a.x, a.z));
    const raw = clamp(11 + (x - a.x + 70) * 0.19 + 2 * simplex.noise(x / 80, z / 80), 9, 40);
    const step = 3.2;
    const k = raw / step;
    const fl = Math.floor(k);
    const q = (fl + smoothstep(0.82, 1.0, k - fl)) * step;
    h = lerp(h, q, w);
  }
  // mold: quarry pit cut into the caldera's foot
  {
    const a = ANCHORS.mold;
    const r = dist(x, z, a.x, a.z);
    const w = smoothstep(100, 62, r);
    const wall = 9 + 22 * smoothstep(36, 58, r);
    const bench = Math.floor(wall / 5.5) * 5.5 + 5.5 * smoothstep(0.8, 1, wall / 5.5 - Math.floor(wall / 5.5));
    h = lerp(h, Math.max(9, bench), w);
  }
  // weave: rolling vale
  {
    const a = ANCHORS.weave;
    const w = smoothstep(115, 62, dist(x, z, a.x, a.z));
    const t = 12.5 + 3.2 * simplex.fbm(x / 48 - 4, z / 48 + 4, 3);
    h = lerp(h, t, w);
  }
  // contour: flat formal garden
  {
    const a = ANCHORS.contour;
    const w = smoothstep(105, 58, dist(x, z, a.x, a.z));
    h = lerp(h, 11 + 0.15 * simplex.noise(x / 20, z / 20), w);
  }
  // mosaic: dunes around the temple
  {
    const a = ANCHORS.mosaic;
    const r = dist(x, z, a.x, a.z);
    const w = smoothstep(120, 64, r);
    const dune = 3.2 * Math.pow(1 - Math.abs(Math.sin(x * 0.045 + z * 0.018 + 2.2 * simplex.noise(x / 60, z / 60))), 2.2);
    const plaza = smoothstep(34, 24, r);
    const t = 9.5 + dune * (1 - plaza) + 1.2 * simplex.fbm(x / 40, z / 40, 2) * (1 - plaza);
    h = lerp(h, t, w);
  }
  // twins: lake basin (water at 7.5)
  {
    const a = ANCHORS.twins;
    const r = dist(x, z, a.x, a.z) * (1 + 0.12 * simplex.noise(x / 40, z / 40));
    const w = smoothstep(110, 66, dist(x, z, a.x, a.z));
    const t = 3.5 + 6.4 * smoothstep(30, 60, r) + 1.2 * simplex.fbm(x / 50, z / 50, 2) * smoothstep(55, 80, r);
    h = lerp(h, t, w);
  }
  // beacon: high cliffs on the east coast
  {
    const a = ANCHORS.beacon;
    const ex = (x - a.x) / 95;
    const ez = (z - a.z) / 140;
    const er = Math.sqrt(ex * ex + ez * ez);
    const w = smoothstep(1.25, 0.7, er);
    const edge = 316 + 6 * simplex.noise(z / 25, 3.3);
    const top = 26 + 2.5 * simplex.fbm(x / 35, z / 35, 3);
    const cliff = lerp(top, -8, smoothstep(edge - 3, edge + 12, x));
    h = lerp(h, cliff, w);
  }
  // prologue: soft dunes behind the beach
  {
    const a = ANCHORS.prologue;
    const w = smoothstep(90, 40, dist(x, z, a.x, a.z));
    const t = lerp(9, -2, smoothstep(250, 344, z)) + 0.8 * simplex.fbm(x / 25, z / 25, 2);
    h = lerp(h, t, w * 0.9);
  }
  // north landing headland
  {
    const w = smoothstep(42, 18, dist(x, z, NORTH_LANDING.x, NORTH_LANDING.z));
    h = lerp(h, 6.5, w);
  }

  // ── caldera (ring mountain) ──
  {
    const dx = x - CALDERA.x, dz = z - CALDERA.z;
    const r = Math.hypot(dx, dz);
    if (r < CALDERA.outer + 40) {
      const th = Math.atan2(dz, dx);
      const cx = Math.cos(th), sz = Math.sin(th);
      // rim height varies around the ring: high peaks to the north, a low saddle at the gorge (south)
      const southness = Math.max(0, sz); // +z = south
      let rimH = CALDERA.rimH + 22 * simplex.noise(cx * 1.3 + 7, sz * 1.3 - 3) + 10 * simplex.noise(cx * 3.1 - 2, sz * 3.1 + 5);
      rimH -= 28 * Math.pow(southness, 6);
      rimH += 5 * (simplex.ridged(x / 22, z / 22, 3) - 0.5);
      // radial gullies on the outer slope
      const gully = 7 * (simplex.ridged(th * 5.5 + 3, r / 28, 3) - 0.5);
      let m: number;
      if (r < CALDERA.inner) {
        // basin floor with a crystal lake ringing the spire's island
        const lake = smoothstep(14, 19, r) * smoothstep(40, 31, r + 3 * simplex.noise(x / 18, z / 18));
        m = CALDERA.floor + 0.5 * simplex.noise(x / 12, z / 12) - 4.2 * lake;
      }
      else if (r < CALDERA.rim) {
        const t = smoothstep(CALDERA.inner, CALDERA.rim, r);
        m = lerp(CALDERA.floor, rimH, Math.pow(t, 0.62)) + 3 * simplex.noise(x / 9, z / 9) * t;
      } else {
        const t = smoothstep(CALDERA.rim, CALDERA.outer + 40, r);
        m = lerp(rimH, h, Math.pow(t, 0.7)) + gully * (1 - t) * t * 4;
      }
      if (r < CALDERA.rim) h = m;
      else h = Math.max(h, m);
      // the gorge from the hub into the basin
      const gw = smoothstep(16, 7.5, Math.abs(x - CALDERA.x) + 2 * simplex.noise(z / 15, 0.5));
      const gz0 = HUB.z - 26; // gorge mouth
      const gz1 = CALDERA.z + CALDERA.inner - 2;
      if (z < gz0 + 8 && z > gz1 - 10) {
        const t = clamp((gz0 - z) / (gz0 - gz1), 0, 1);
        const floorY = lerp(HUB.y, CALDERA.floor, smoothstep(0.15, 1, t));
        const along = smoothstep(gz0 + 8, gz0, z) * smoothstep(gz1 - 10, gz1, z);
        h = lerp(h, floorY, gw * along);
      }
    }
  }

  // ── citadel islet ──
  {
    const r = dist(x, z, CITADEL.x, CITADEL.z) * (1 + 0.08 * simplex.noise(x / 30, z / 30));
    const isle = CITADEL.y + 1.5 * simplex.fbm(x / 30, z / 30, 2);
    const t = lerp(isle, -14, smoothstep(CITADEL.r - 8, CITADEL.r + 8, r));
    h = Math.max(h, t);
  }
  return h;
}

// ───────────────────────────── grid ─────────────────────────────

export class Terrain {
  readonly heights = new Float32Array(V * V);
  readonly pathMask = new Float32Array(V * V);
  /** vertex colours (linear RGB), filled by build() */
  colors: Float32Array = new Float32Array(0);
  readonly group = new THREE.Group();
  heightTexture!: THREE.DataTexture;
  material!: THREE.MeshStandardMaterial;

  constructor() {
    this.bake();
  }

  private bake() {
    const H = this.heights;
    for (let j = 0; j < V; j++) {
      const z = -WORLD_HALF + j * CELL;
      for (let i = 0; i < V; i++) {
        const x = -WORLD_HALF + i * CELL;
        H[j * V + i] = rawHeight(x, z);
      }
    }
    // path mask
    const M = this.pathMask;
    for (const path of PATHS) {
      for (let s = 0; s < path.length - 1; s++) {
        const [ax, az] = path[s];
        const [bx, bz] = path[s + 1];
        const minX = Math.min(ax, bx) - 10, maxX = Math.max(ax, bx) + 10;
        const minZ = Math.min(az, bz) - 10, maxZ = Math.max(az, bz) + 10;
        const i0 = Math.max(0, Math.floor((minX + WORLD_HALF) / CELL));
        const i1 = Math.min(V - 1, Math.ceil((maxX + WORLD_HALF) / CELL));
        const j0 = Math.max(0, Math.floor((minZ + WORLD_HALF) / CELL));
        const j1 = Math.min(V - 1, Math.ceil((maxZ + WORLD_HALF) / CELL));
        const dx = bx - ax, dz = bz - az;
        const len2 = dx * dx + dz * dz;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const x = -WORLD_HALF + i * CELL;
            const z = -WORLD_HALF + j * CELL;
            const t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
            const px = ax + dx * t, pz = az + dz * t;
            const dd = Math.hypot(x - px, z - pz) + 0.8 * simplex.noise(x / 6, z / 6);
            const m = smoothstep(4.2, 1.6, dd);
            if (m > M[j * V + i]) M[j * V + i] = m;
          }
        }
      }
    }
    // smooth heights along paths (blend with a blurred copy)
    const blurred = boxBlur(H, V, 4);
    const blurred2 = boxBlur(H, V, 2);
    for (let k = 0; k < H.length; k++) {
      const m = M[k];
      if (m > 0) {
        // widen influence a little so the shoulders are smooth too
        H[k] = lerp(H[k], blurred[k] - 0.05, m * 0.85);
      }
    }
    // a very light general smoothing to remove grid aliasing on crags
    for (let k = 0; k < H.length; k++) H[k] = lerp(H[k], blurred2[k], 0.25);
  }

  /** Bilinear height at world (x,z). */
  heightAt(x: number, z: number): number {
    const fx = (x + WORLD_HALF) / CELL;
    const fz = (z + WORLD_HALF) / CELL;
    const i = clamp(Math.floor(fx), 0, V - 2);
    const j = clamp(Math.floor(fz), 0, V - 2);
    const tx = clamp(fx - i, 0, 1);
    const tz = clamp(fz - j, 0, 1);
    const H = this.heights;
    const a = H[j * V + i], b = H[j * V + i + 1], c = H[(j + 1) * V + i], d = H[(j + 1) * V + i + 1];
    // match the triangle split used by the mesh (diagonal from (i,j+1) to (i+1,j))
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = CELL;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  colorAt(x: number, z: number, out = new THREE.Color()): THREE.Color {
    const i = clamp(Math.round((x + WORLD_HALF) / CELL), 0, V - 1);
    const j = clamp(Math.round((z + WORLD_HALF) / CELL), 0, V - 1);
    const k = (j * V + i) * 3;
    return out.setRGB(this.colors[k], this.colors[k + 1], this.colors[k + 2]);
  }

  pathAt(x: number, z: number): number {
    const i = clamp(Math.round((x + WORLD_HALF) / CELL), 0, V - 1);
    const j = clamp(Math.round((z + WORLD_HALF) / CELL), 0, V - 1);
    return this.pathMask[j * V + i];
  }

  surfaceAt(x: number, z: number): Surface {
    const h = this.heightAt(x, z);
    if (h < 0.25) return 'water';
    if (h < 2.4 && Math.hypot(x, z) > 250) return 'sand';
    const p = this.pathAt(x, z);
    const near = (id: keyof typeof GROUNDS, r: number) => {
      const g = GROUNDS[id]!;
      return Math.hypot(x - g.x, z - g.z) < r;
    };
    if (near('mosaic', 110) || near('prologue', 70)) return 'sand';
    if (near('mold', 80)) return p > 0.4 ? 'gravel' : 'stone';
    if (near('echo', 95)) return 'stone';
    if (near('citadel', 70)) return 'stone';
    if (p > 0.45) return near('hub', 90) ? 'stone' : 'gravel';
    if (near('kinship', 115)) return 'leaves';
    return 'grass';
  }

  /** Builds the chunked meshes. */
  build(): THREE.Group {
    const H = this.heights;
    // normals for the whole grid
    const normals = new Float32Array(V * V * 3);
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < V; i++) {
        const hl = H[j * V + Math.max(0, i - 1)], hr = H[j * V + Math.min(V - 1, i + 1)];
        const hd = H[Math.max(0, j - 1) * V + i], hu = H[Math.min(V - 1, j + 1) * V + i];
        const nx = hl - hr, ny = 2 * CELL, nz = hd - hu;
        const l = Math.hypot(nx, ny, nz);
        const k = (j * V + i) * 3;
        normals[k] = nx / l;
        normals[k + 1] = ny / l;
        normals[k + 2] = nz / l;
      }
    }
    const colors = this.computeColors(normals);
    this.colors = colors;

    this.material = makeTerrainMaterial();
    const CH = 70; // cells per chunk
    for (let cj = 0; cj < N; cj += CH) {
      for (let ci = 0; ci < N; ci += CH) {
        const nI = Math.min(CH, N - ci);
        const nJ = Math.min(CH, N - cj);
        // skip chunks that are entirely deep sea
        let maxH = -Infinity;
        for (let j = cj; j <= cj + nJ; j++) for (let i = ci; i <= ci + nI; i++) maxH = Math.max(maxH, H[j * V + i]);
        if (maxH < -10) continue;
        const vw = nI + 1, vh = nJ + 1;
        const pos = new Float32Array(vw * vh * 3);
        const nor = new Float32Array(vw * vh * 3);
        const col = new Float32Array(vw * vh * 3);
        for (let j = 0; j < vh; j++) {
          for (let i = 0; i < vw; i++) {
            const gi = ci + i, gj = cj + j;
            const g = gj * V + gi;
            const k = (j * vw + i) * 3;
            pos[k] = -WORLD_HALF + gi * CELL;
            pos[k + 1] = H[g];
            pos[k + 2] = -WORLD_HALF + gj * CELL;
            nor[k] = normals[g * 3];
            nor[k + 1] = normals[g * 3 + 1];
            nor[k + 2] = normals[g * 3 + 2];
            col[k] = colors[g * 3];
            col[k + 1] = colors[g * 3 + 1];
            col[k + 2] = colors[g * 3 + 2];
          }
        }
        const idx: number[] = [];
        for (let j = 0; j < nJ; j++) {
          for (let i = 0; i < nI; i++) {
            const a = j * vw + i, b = a + 1, c = a + vw, d = c + 1;
            idx.push(a, c, b, b, c, d);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setIndex(idx);
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.name = `terrain_${ci}_${cj}`;
        this.group.add(mesh);
      }
    }
    this.buildHeightTexture();
    return this.group;
  }

  private computeColors(normals: Float32Array): Float32Array {
    const H = this.heights;
    const out = new Float32Array(V * V * 3);
    const c = new THREE.Color();
    const tmp = new THREE.Color();
    const meadow1 = new THREE.Color(MEADOW.c1), meadow2 = new THREE.Color(MEADOW.c2);
    const sand = new THREE.Color(SAND), wet = new THREE.Color(WET_SAND), rock = new THREE.Color(ROCK), path = new THREE.Color(PATH);
    const seabed = new THREE.Color('#9c8a62');
    const grounds = Object.values(GROUNDS).map((g) => ({ ...g!, col1: new THREE.Color(g!.c1), col2: new THREE.Color(g!.c2) }));
    const darkRock = new THREE.Color('#5d5852');
    for (let j = 0; j < V; j++) {
      const z = -WORLD_HALF + j * CELL;
      for (let i = 0; i < V; i++) {
        const x = -WORLD_HALF + i * CELL;
        const k = j * V + i;
        const h = H[k];
        const n1 = simplex.noise(x / 23, z / 23);
        const n2 = simplex.noise(x / 6.5 + 40, z / 6.5 - 40);
        // base meadow with large painterly patches
        c.copy(meadow1).lerp(meadow2, clamp(0.5 + 0.5 * n1, 0, 1));
        const n3 = simplex.noise(x / 70 + 13, z / 70 - 9);
        c.offsetHSL(0.025 * n3, 0.04 * simplex.noise(x / 45 - 3, z / 45 + 2), 0.02 * n3);
        // biome blend
        for (const g of grounds) {
          const d = Math.hypot(x - g.x, z - g.z);
          const w = smoothstep(g.r1, g.r0, d + 10 * n2);
          if (w <= 0) continue;
          tmp.copy(g.col1).lerp(g.col2, clamp(0.5 + 0.6 * n1, 0, 1));
          c.lerp(tmp, w);
        }
        // beach / underwater
        const coastal = Math.hypot(x, z) > 200;
        if (coastal) {
          const sw = smoothstep(3.2, 1.4, h);
          c.lerp(sand, sw);
          c.lerp(wet, smoothstep(0.9, 0.0, h) * 0.8);
        }
        if (h < -0.5) c.lerp(seabed, smoothstep(-0.5, -6, h));
        // slopes -> rock
        const ny = normals[k * 3 + 1];
        const steep = smoothstep(0.86, 0.6, ny + 0.04 * n2);
        if (steep > 0) {
          tmp.copy(rock).lerp(darkRock, clamp(0.5 + 0.5 * simplex.noise(x / 9, z / 9 + h / 5), 0, 1));
          c.lerp(tmp, steep);
        }
        // paths
        const p = this.pathMask[k];
        if (p > 0) c.lerp(path, p * 0.85);
        // subtle variation
        const v = 1 + 0.06 * n2;
        out[k * 3] = c.r * v;
        out[k * 3 + 1] = c.g * v;
        out[k * 3 + 2] = c.b * v;
      }
    }
    return out;
  }

  private buildHeightTexture() {
    const data = new Uint16Array(V * V);
    for (let k = 0; k < V * V; k++) data[k] = THREE.DataUtils.toHalfFloat(this.heights[k]);
    const tex = new THREE.DataTexture(data, V, V, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.heightTexture = tex;
  }
}

function boxBlur(src: Float32Array, size: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  // horizontal
  for (let j = 0; j < size; j++) {
    let acc = 0;
    let cnt = 0;
    for (let i = -r; i <= r; i++) {
      const ii = clamp(i, 0, size - 1);
      acc += src[j * size + ii];
      cnt++;
    }
    for (let i = 0; i < size; i++) {
      tmp[j * size + i] = acc / cnt;
      const add = clamp(i + r + 1, 0, size - 1);
      const rem = clamp(i - r, 0, size - 1);
      acc += src[j * size + add] - src[j * size + rem];
    }
  }
  // vertical
  for (let i = 0; i < size; i++) {
    let acc = 0;
    let cnt = 0;
    for (let j = -r; j <= r; j++) {
      const jj = clamp(j, 0, size - 1);
      acc += tmp[jj * size + i];
      cnt++;
    }
    for (let j = 0; j < size; j++) {
      out[j * size + i] = acc / cnt;
      const add = clamp(j + r + 1, 0, size - 1);
      const rem = clamp(j - r, 0, size - 1);
      acc += tmp[add * size + i] - tmp[rem * size + i];
    }
  }
  return out;
}

/** Terrain material: vertex colours + world-space detail noise for a painterly look. */
function makeTerrainMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
float th_hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float th_noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(th_hash(i),th_hash(i+vec2(1,0)),u.x),mix(th_hash(i+vec2(0,1)),th_hash(i+vec2(1,1)),u.x),u.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 wp = vWorldPos.xz;
  float n = th_noise(wp*0.9)*0.5 + th_noise(wp*2.7)*0.3 + th_noise(wp*0.21)*0.2;
  float slope = 1.0 - clamp(vWorldNormal.y, 0.0, 1.0);
  // rock strata on cliffs
  float strata = th_noise(vec2(vWorldPos.y*1.7, (wp.x+wp.y)*0.05));
  diffuseColor.rgb *= mix(0.86, 1.1, n);
  diffuseColor.rgb *= mix(1.0, mix(0.82, 1.08, strata), smoothstep(0.25, 0.55, slope));
}`,
      );
  };
  return mat;
}
