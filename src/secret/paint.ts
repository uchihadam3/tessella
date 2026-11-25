/**
 * The scenery itself, drawing: a band of a slightly different shade on the very surface a line
 * crosses — some of a crown's leaves turning another colour, a damp stain or lichen on stone,
 * darker sand — as seen from the picture's spot. Nothing is added: the surface is drawn once more
 * over itself (the same geometry, swaying with it in the wind), coloured only along the line, with
 * soft uneven edges like natural colouring.
 */
import * as THREE from 'three';
import { windUniforms } from '../world/vegetation';

export const MAX_PAINT_POINTS = 64;
export const MAX_PAINT_LINES = 28;

export interface PaintSpec {
  /** the line's points on the surface (as seen from the spot), in order */
  points: THREE.Vector3[];
  /** the light's sweep parameter at each point */
  ts: number[];
  /** "cut" (the middle of a line that must stay dark when lit) per point */
  cuts: number[];
  /** which line of the picture each point belongs to; a point that starts a new stretch breaks the band */
  lines: number[];
  breaks: boolean[];
  /** the glow of each line of the picture (shared, updated as the puzzle is played) */
  lineGlow: THREE.Color[];
  eye: THREE.Vector3;
  /** half-width of the band as seen from the spot (radians) */
  halfAngle: number;
  color: THREE.Color;
  /** the surface sways like a tree (its geometry has aSway) */
  wind: boolean;
  u: { uLit: { value: number }; uReveal: { value: number } };
  seed: number;
}

export function paintMaterial(spec: PaintSpec): THREE.MeshStandardMaterial {
  const pts = spec.points.slice(0, MAX_PAINT_POINTS);
  const n = pts.length;
  const pv = Array.from({ length: MAX_PAINT_POINTS }, (_, i) => (pts[Math.min(i, n - 1)] ?? new THREE.Vector3()).clone());
  const tv = Array.from({ length: MAX_PAINT_POINTS }, (_, i) => spec.ts[Math.min(i, n - 1)] ?? 0);
  const cv = Array.from({ length: MAX_PAINT_POINTS }, (_, i) => spec.cuts[Math.min(i, n - 1)] ?? 0);
  const lv = Array.from({ length: MAX_PAINT_POINTS }, (_, i) => spec.lines[Math.min(i, n - 1)] ?? 0);
  // segment i→i+1 is part of the band unless point i+1 starts another stretch
  const bv = Array.from({ length: MAX_PAINT_POINTS }, (_, i) => (spec.breaks[i + 1] ? 1 : 0));
  const m = new THREE.MeshStandardMaterial({
    color: spec.color, roughness: 0.9, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
  });
  const glow = { value: spec.lineGlow };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPts = { value: pv };
    sh.uniforms.uTs = { value: tv };
    sh.uniforms.uCuts = { value: cv };
    sh.uniforms.uLines = { value: lv };
    sh.uniforms.uBreaks = { value: bv };
    sh.uniforms.uN = { value: n };
    sh.uniforms.uEye = { value: spec.eye.clone() };
    sh.uniforms.uHalf = { value: spec.halfAngle };
    sh.uniforms.uSeed = { value: spec.seed };
    sh.uniforms.uLit = spec.u.uLit;
    sh.uniforms.uReveal = spec.u.uReveal;
    sh.uniforms.uLineGlow = glow;
    sh.uniforms.uTime = windUniforms.uTime;
    sh.uniforms.uWind = windUniforms.uWind;
    const wind = spec.wind
      ? `{
  vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float ph = origin.x * 0.071 + origin.z * 0.053;
  float w = sin(uTime * 1.2 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25 + sin(uTime * 0.5 + ph * 0.3) * 0.4;
  float s = aSway * aSway;
  transformed.x += w * s * uWind * 0.22;
  transformed.z += cos(uTime * 1.05 + ph) * s * uWind * 0.14;
  vec3 fl = vec3(sin(uTime * 5.5 + position.y * 2.7 + ph * 9.0), sin(uTime * 4.7 + position.x * 2.3 + ph * 7.0) * 0.6, sin(uTime * 5.1 + position.z * 2.5 + ph * 8.0));
  transformed += fl * 0.03 * aSway;
}`
      : '';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldP;\nuniform float uTime;\nuniform float uWind;\n${spec.wind ? 'attribute float aSway;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${wind}\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldP;
uniform vec3 uPts[${MAX_PAINT_POINTS}];
uniform float uTs[${MAX_PAINT_POINTS}];
uniform float uCuts[${MAX_PAINT_POINTS}];
uniform float uLines[${MAX_PAINT_POINTS}];
uniform float uBreaks[${MAX_PAINT_POINTS}];
uniform vec3 uLineGlow[${MAX_PAINT_LINES}];
uniform int uN;
uniform vec3 uEye;
uniform float uHalf;
uniform float uSeed;
uniform float uLit;
uniform float uReveal;
float pHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)) + uSeed) * 43758.5453); }
float pNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), f.x), mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), f.x), mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float bandD = 1e9, bandT = 0.0, bandCut = 0.0;
int bandLine = 0;
for (int i = 0; i < ${MAX_PAINT_POINTS - 1}; i++) {
  if (i >= uN - 1) break;
  vec3 a = uPts[i];
  vec3 b = uBreaks[i] > 0.5 ? a : uPts[i + 1];
  vec3 ab = b - a;
  float h = clamp(dot(vWorldP - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vWorldP - a - ab * h);
  if (d < bandD) { bandD = d; bandT = mix(uTs[i], uBreaks[i] > 0.5 ? uTs[i] : uTs[i + 1], h); bandCut = uCuts[i]; bandLine = int(uLines[i] + 0.5); }
}
{
  vec3 a = uPts[uN - 1];
  float d = length(vWorldP - a);
  if (d < bandD) { bandD = d; bandT = uTs[uN - 1]; bandCut = uCuts[uN - 1]; bandLine = int(uLines[uN - 1] + 0.5); }
}
float bandW = uHalf * length(vWorldP - uEye);
float wob = (pNoise(vWorldP * 3.1) - 0.5) * 0.7 + (pNoise(vWorldP * 9.7) - 0.5) * 0.35;
float bandMask = 1.0 - smoothstep(bandW * 0.55, bandW * 1.0, bandD + wob * bandW);
if (bandMask < 0.02) discard;
diffuseColor.a *= bandMask;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += uLineGlow[bandLine] * step(bandT, uReveal) * uLit * (1.0 - bandCut) * bandMask;`,
      );
  };
  return m;
}
