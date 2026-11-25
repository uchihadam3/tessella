/** Shared material factory: stone, marble, wood, metal… with world-space procedural detail (no UVs needed). */
import * as THREE from 'three';

const cache = new Map<string, THREE.MeshStandardMaterial>();

export interface MatOpts {
  color: string;
  roughness?: number;
  metalness?: number;
  /** detail noise strength (0..1) */
  detail?: number;
  /** detail scale (higher = finer) */
  scale?: number;
  /** wood grain / stone blocks pattern */
  pattern?: 'none' | 'blocks' | 'grain' | 'veins';
  emissive?: string;
  emissiveIntensity?: number;
  flat?: boolean;
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

export function mat(key: string, o: MatOpts): THREE.MeshStandardMaterial {
  const full = `${key}|${JSON.stringify(o)}`;
  const c = cache.get(full);
  if (c) return c;
  const m = new THREE.MeshStandardMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.85,
    metalness: o.metalness ?? 0,
    flatShading: o.flat ?? false,
    vertexColors: o.vertexColors ?? false,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
  if (o.emissive) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  const detail = o.detail ?? 0.18;
  const scale = o.scale ?? 1.6;
  const pattern = o.pattern ?? 'none';
  if (detail > 0) {
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
vec4 wpp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpp = instanceMatrix * wpp;
#endif
vWP = (modelMatrix * wpp).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWP;
varying vec3 vWN;
float mh(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float mn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(mh(i+vec3(0,0,0)),mh(i+vec3(1,0,0)),f.x),mix(mh(i+vec3(0,1,0)),mh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(mh(i+vec3(0,0,1)),mh(i+vec3(1,0,1)),f.x),mix(mh(i+vec3(0,1,1)),mh(i+vec3(1,1,1)),f.x),f.y),f.z); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  vec3 p = vWP * ${scale.toFixed(3)};
  float n = mn(p) * 0.5 + mn(p * 2.7) * 0.3 + mn(p * 7.1) * 0.2;
  float k = 1.0 + (n - 0.5) * ${(detail * 2).toFixed(3)};
  ${
    pattern === 'blocks'
      ? `vec3 an = abs(vWN);
  vec2 q = an.y > 0.6 ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy);
  q *= vec2(1.0, 1.6) * ${(scale * 0.55).toFixed(3)};
  q.x += floor(q.y) * 0.5;
  vec2 fq = fract(q);
  float edge = min(min(fq.x, 1.0 - fq.x) * 2.2, min(fq.y, 1.0 - fq.y));
  k *= mix(0.72, 1.0, smoothstep(0.0, 0.06, edge));
  k *= 0.92 + 0.16 * mh(floor(vec3(q, 1.0)));`
      : pattern === 'grain'
        ? `float g = sin((vWP.x + vWP.z) * ${(scale * 9).toFixed(2)} + mn(p * 1.3) * 6.0);
  k *= 0.9 + 0.1 * g;`
        : pattern === 'veins'
          ? `float v = abs(sin(p.x * 1.7 + mn(p * 1.9) * 6.0 + p.y));
  k *= mix(0.86, 1.0, smoothstep(0.02, 0.12, v));`
          : ''
  }
  diffuseColor.rgb *= k;
}`,
        );
    };
    m.customProgramCacheKey = () => `tess-${pattern}-${detail}-${scale}`;
  }
  cache.set(full, m);
  return m;
}

/** Commonly used materials. */
export const M = {
  stone: () => mat('stone', { color: '#cfc6b6', roughness: 0.9, detail: 0.22, scale: 1.4, pattern: 'blocks' }),
  stoneSmooth: () => mat('stoneSmooth', { color: '#d6cfc2', roughness: 0.88, detail: 0.16, scale: 1.8 }),
  stoneDark: () => mat('stoneDark', { color: '#5f5f66', roughness: 0.9, detail: 0.2, scale: 1.4, pattern: 'blocks' }),
  slate: () => mat('slate', { color: '#3f4248', roughness: 0.75, detail: 0.15, scale: 2.2 }),
  marble: () => mat('marble', { color: '#efebe4', roughness: 0.4, detail: 0.12, scale: 0.9, pattern: 'veins' }),
  sandstone: () => mat('sandstone', { color: '#d9b27a', roughness: 0.95, detail: 0.25, scale: 1.2, pattern: 'blocks' }),
  sandSmooth: () => mat('sandSmooth', { color: '#e2bf88', roughness: 0.95, detail: 0.2, scale: 1.5 }),
  wood: () => mat('wood', { color: '#8a6342', roughness: 0.8, detail: 0.2, scale: 1.0, pattern: 'grain' }),
  woodDark: () => mat('woodDark', { color: '#5b3f2b', roughness: 0.8, detail: 0.2, scale: 1.0, pattern: 'grain' }),
  woodRed: () => mat('woodRed', { color: '#a8352b', roughness: 0.7, detail: 0.12, scale: 1.0, pattern: 'grain' }),
  bronze: () => mat('bronze', { color: '#b07a3f', roughness: 0.38, metalness: 0.85, detail: 0.15, scale: 3 }),
  gold: () => mat('gold', { color: '#e0b25a', roughness: 0.3, metalness: 0.9, detail: 0.08, scale: 3 }),
  iron: () => mat('iron', { color: '#4a4c52', roughness: 0.5, metalness: 0.7, detail: 0.12, scale: 3 }),
  plaster: () => mat('plaster', { color: '#f1e9da', roughness: 0.92, detail: 0.1, scale: 2 }),
  roofTerracotta: () => mat('roofTerracotta', { color: '#b8563a', roughness: 0.8, detail: 0.14, scale: 2.5 }),
  roofSlate: () => mat('roofSlate', { color: '#4b5160', roughness: 0.7, detail: 0.14, scale: 2.5 }),
  roofTeal: () => mat('roofTeal', { color: '#3f7f7a', roughness: 0.6, detail: 0.1, scale: 2.5 }),
  cloth: (c: string) => mat('cloth' + c, { color: c, roughness: 0.95, detail: 0.08, scale: 4, side: THREE.DoubleSide }),
  crystal: (c: string, e = 0.9) => mat('crystal' + c, { color: c, roughness: 0.15, metalness: 0.1, detail: 0.05, emissive: c, emissiveIntensity: e }),
  glow: (c: string, e = 2.2) => mat('glow' + c, { color: '#000000', roughness: 1, detail: 0, emissive: c, emissiveIntensity: e }),
  hedge: () => mat('hedge', { color: '#3f7f3a', roughness: 0.95, detail: 0.35, scale: 3.5 }),
  water: () => mat('waterFlat', { color: '#5fb7c9', roughness: 0.1, metalness: 0.2, detail: 0 }),
};
