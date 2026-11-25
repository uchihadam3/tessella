/** Stylised water: depth-tinted (from the terrain height texture), shore foam, sky reflection, sun glints. */
import * as THREE from 'three';
import { WORLD_HALF } from './layout';

const vert = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uHeight; uniform float uHalf; uniform float uLevel; uniform float uTime;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uSkyTop; uniform vec3 uSkyHorizon;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uOpacity; uniform float uWaveScale; uniform float uCalm;
varying vec3 vWorld;
float wh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float wn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(wh(i),wh(i+vec2(1,0)),u.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),u.x), u.y); }
float waves(vec2 p){
  float t = uTime;
  return wn(p*0.35 + vec2(t*0.05, t*0.03))*0.5 + wn(p*0.9 - vec2(t*0.08, -t*0.06))*0.3 + wn(p*2.3 + vec2(-t*0.13, t*0.11))*0.2;
}
void main() {
  vec2 uv = (vWorld.xz + uHalf) / (2.0 * uHalf);
  float ground = texture2D(uHeight, uv).r;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ground = -30.0;
  float depth = uLevel - ground;
  if (depth < -0.05) discard;
  // normal from wave field
  vec2 p = vWorld.xz * uWaveScale;
  float e = 0.15;
  float h0 = waves(p);
  float hx = waves(p + vec2(e, 0.0));
  float hz = waves(p + vec2(0.0, e));
  float amp = mix(0.55, 0.18, uCalm);
  vec3 n = normalize(vec3((h0 - hx) * amp / e, 1.0, (h0 - hz) * amp / e));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(clamp(R.y, 0.0, 1.0), 0.6));
  // body colour by depth
  float d01 = 1.0 - exp(-depth * 0.32);
  vec3 body = mix(uShallow, uDeep, d01);
  // caustic-ish shimmer in shallows
  float caust = pow(wn(vWorld.xz * 0.7 + uTime * 0.25) * wn(vWorld.xz * 0.9 - uTime * 0.2), 2.0);
  body += uShallow * caust * (1.0 - d01) * 0.6;
  vec3 col = mix(body, sky, clamp(fres * 0.85 + 0.08, 0.0, 1.0));
  // sun glints
  float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0);
  col += uSunColor * spec * 2.2;
  // shore foam
  float foamBand = smoothstep(0.75, 0.0, depth);
  float foamNoise = wn(vWorld.xz * 1.6 + vec2(uTime * 0.3, 0.0)) * 0.6 + wn(vWorld.xz * 4.0 - uTime * 0.2) * 0.4;
  float pulse = 0.5 + 0.5 * sin(depth * 9.0 - uTime * 1.6);
  float foam = foamBand * smoothstep(0.35, 0.75, foamNoise * (0.6 + 0.6 * pulse));
  col = mix(col, uFoam, foam * mix(0.85, 0.45, uCalm));
  float alpha = mix(0.55, 1.0, smoothstep(0.0, 2.5, depth)) * uOpacity;
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export interface WaterOptions {
  level: number;
  shallow?: string;
  deep?: string;
  foam?: string;
  waveScale?: number;
  calm?: number;
  opacity?: number;
}

export function makeWaterMaterial(heightTex: THREE.Texture, o: WaterOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uHeight: { value: null }, uHalf: { value: WORLD_HALF }, uLevel: { value: o.level }, uTime: { value: 0 },
        uShallow: { value: new THREE.Color(o.shallow ?? '#46d0c6') }, uDeep: { value: new THREE.Color(o.deep ?? '#14558f') },
        uFoam: { value: new THREE.Color(o.foam ?? '#f6fbff') }, uSkyTop: { value: new THREE.Color('#4a7fd0') },
        uSkyHorizon: { value: new THREE.Color('#d8e8f5') }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: o.opacity ?? 1 }, uWaveScale: { value: o.waveScale ?? 0.5 },
        uCalm: { value: o.calm ?? 0 },
      },
    ]),
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    fog: true,
    depthWrite: false,
  });
}

export class WaterSystem {
  readonly materials: THREE.ShaderMaterial[] = [];
  readonly group = new THREE.Group();
  constructor(private heightTex: THREE.Texture) {}

  add(geo: THREE.BufferGeometry, o: WaterOptions): THREE.Mesh {
    const m = makeWaterMaterial(this.heightTex, o);
    m.uniforms.uHeight.value = this.heightTex;
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = o.level;
    mesh.renderOrder = 5;
    this.materials.push(m);
    this.group.add(mesh);
    return mesh;
  }

  /** Big sea plane. */
  addSea(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2);
    return this.add(geo, { level: 0, shallow: '#43d3c4', deep: '#12528e', waveScale: 0.45 });
  }

  update(time: number, sunDir: THREE.Vector3, sunColor: THREE.Color, skyTop: THREE.Color, skyHorizon: THREE.Color) {
    for (const m of this.materials) {
      m.uniforms.uTime.value = time;
      (m.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
      (m.uniforms.uSunColor.value as THREE.Color).copy(sunColor);
      (m.uniforms.uSkyTop.value as THREE.Color).copy(skyTop);
      (m.uniforms.uSkyHorizon.value as THREE.Color).copy(skyHorizon);
    }
  }
}
