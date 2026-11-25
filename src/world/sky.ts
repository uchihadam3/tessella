/**
 * Sky dome (gradient + sun + clouds + stars + aurora), sun light, hemisphere light, fog,
 * and a time-of-day system driven by game progress.
 */
import * as THREE from 'three';

export interface SkyState {
  /** sun elevation in degrees (negative = below horizon) */
  sunElev: number;
  /** sun azimuth in degrees (0 = north, 90 = east) */
  sunAzim: number;
  zenith: string;
  horizon: string;
  ground: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogDensity: number;
  stars: number;
  aurora: number;
  clouds: number;
  exposure: number;
}

/** Keyframes along the island's "day" (0 = first dawn, 1 = golden hour, then dusk/night/new dawn). */
export const SKY_KEYS: Record<string, SkyState> = {
  dawn: {
    sunElev: 6, sunAzim: 96, zenith: '#5b78b3', horizon: '#f4b48f', ground: '#6c6a74', sunColor: '#ffb98a', sunIntensity: 2.2,
    hemiSky: '#a9b8e8', hemiGround: '#6a5a50', hemiIntensity: 0.9, fog: '#d9b4a6', fogDensity: 0.00151, stars: 0.05, aurora: 0, clouds: 0.55, exposure: 1.0,
  },
  morning: {
    sunElev: 24, sunAzim: 112, zenith: '#4d86d6', horizon: '#cfe0f0', ground: '#7b7f72', sunColor: '#fff0d6', sunIntensity: 3.0,
    hemiSky: '#b9d4f5', hemiGround: '#7a6f5a', hemiIntensity: 1.0, fog: '#c6d8e6', fogDensity: 0.00115, stars: 0, aurora: 0, clouds: 0.5, exposure: 1.0,
  },
  noon: {
    sunElev: 52, sunAzim: 160, zenith: '#3a7fdc', horizon: '#cfe6f7', ground: '#848675', sunColor: '#fff7e8', sunIntensity: 3.3,
    hemiSky: '#c0dcff', hemiGround: '#7e7663', hemiIntensity: 1.05, fog: '#c9dff0', fogDensity: 0.00101, stars: 0, aurora: 0, clouds: 0.45, exposure: 0.95,
  },
  afternoon: {
    sunElev: 30, sunAzim: 228, zenith: '#4479cf', horizon: '#f0dcc0', ground: '#827a68', sunColor: '#ffe3b8', sunIntensity: 3.1,
    hemiSky: '#bcd2f2', hemiGround: '#7f6c55', hemiIntensity: 1.0, fog: '#e2d7c6', fogDensity: 0.00115, stars: 0, aurora: 0, clouds: 0.5, exposure: 1.0,
  },
  golden: {
    sunElev: 11, sunAzim: 252, zenith: '#4d6db8', horizon: '#ffc07a', ground: '#7a6656', sunColor: '#ffb465', sunIntensity: 2.9,
    hemiSky: '#a9b7e0', hemiGround: '#7d5f48', hemiIntensity: 0.95, fog: '#f1c697', fogDensity: 0.00137, stars: 0, aurora: 0, clouds: 0.6, exposure: 1.05,
  },
  sunset: {
    sunElev: 2, sunAzim: 262, zenith: '#33407a', horizon: '#ff8a5c', ground: '#5d4a4a', sunColor: '#ff8c4a', sunIntensity: 2.0,
    hemiSky: '#7f83c2', hemiGround: '#5e4038', hemiIntensity: 0.8, fog: '#d98a78', fogDensity: 0.00151, stars: 0.15, aurora: 0, clouds: 0.65, exposure: 1.1,
  },
  dusk: {
    sunElev: -8, sunAzim: 275, zenith: '#0e1233', horizon: '#5a4a86', ground: '#2a2a3a', sunColor: '#9fb2ff', sunIntensity: 0.65,
    hemiSky: '#5a63b0', hemiGround: '#2c2838', hemiIntensity: 0.75, fog: '#3a3a66', fogDensity: 0.00130, stars: 1, aurora: 1, clouds: 0.3, exposure: 1.35,
  },
  newdawn: {
    sunElev: 8, sunAzim: 90, zenith: '#6f8fd0', horizon: '#ffcf9a', ground: '#77706a', sunColor: '#ffd3a0', sunIntensity: 2.6,
    hemiSky: '#b6c6ef', hemiGround: '#6f6052', hemiIntensity: 1.0, fog: '#ecd0b4', fogDensity: 0.00122, stars: 0.0, aurora: 0.15, clouds: 0.5, exposure: 1.0,
  },
};

export function lerpSky(a: SkyState, b: SkyState, t: number): SkyState {
  const c = (x: string, y: string) => '#' + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    sunElev: n(a.sunElev, b.sunElev), sunAzim: n(a.sunAzim, b.sunAzim), zenith: c(a.zenith, b.zenith), horizon: c(a.horizon, b.horizon),
    ground: c(a.ground, b.ground), sunColor: c(a.sunColor, b.sunColor), sunIntensity: n(a.sunIntensity, b.sunIntensity),
    hemiSky: c(a.hemiSky, b.hemiSky), hemiGround: c(a.hemiGround, b.hemiGround), hemiIntensity: n(a.hemiIntensity, b.hemiIntensity),
    fog: c(a.fog, b.fog), fogDensity: n(a.fogDensity, b.fogDensity), stars: n(a.stars, b.stars), aurora: n(a.aurora, b.aurora),
    clouds: n(a.clouds, b.clouds), exposure: n(a.exposure, b.exposure),
  };
}

/** Sky state for a progress value: 0 dawn → 1 golden; 1.25 sunset; 1.5 dusk; 2 new dawn. */
export function skyForProgress(p: number): SkyState {
  const k = SKY_KEYS;
  const seq: [number, SkyState][] = [
    [0, k.dawn], [0.2, k.morning], [0.45, k.noon], [0.75, k.afternoon], [1, k.golden], [1.25, k.sunset], [1.5, k.dusk], [2, k.newdawn],
  ];
  if (p <= 0) return k.dawn;
  for (let i = 0; i < seq.length - 1; i++) {
    const [a, sa] = seq[i];
    const [b, sb] = seq[i + 1];
    if (p <= b) return lerpSky(sa, sb, (p - a) / (b - a));
  }
  return k.newdawn;
}

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunColor; uniform vec3 uSunDir;
uniform float uTime; uniform float uStars; uniform float uAurora; uniform float uClouds;
varying vec3 vDir;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h1(i),h1(i+vec2(1,0)),u.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  // gradient
  float t = pow(clamp(y, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uGround, smoothstep(0.0, -0.25, y));
  // sun glow / disc
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float horizonGlow = pow(sd, 6.0) * (1.0 - smoothstep(0.0, 0.5, y)) ;
  col += uSunColor * (pow(sd, 900.0) * 18.0 + pow(sd, 64.0) * 0.55 + horizonGlow * 0.35);
  // clouds (flat layer projection)
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.12) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
    float c = fbm(uv * 0.9);
    float cov = smoothstep(0.62 - uClouds * 0.25, 0.92, c);
    vec3 cloudLit = mix(vec3(1.0), uSunColor, 0.35) * (0.8 + 0.4 * pow(sd, 3.0));
    vec3 cloudCol = mix(uHorizon * 0.9, cloudLit, 0.65 + 0.35 * fbm(uv * 2.1));
    col = mix(col, cloudCol, cov * smoothstep(0.0, 0.25, y) * 0.85);
  }
  // stars
  if (uStars > 0.001 && y > 0.0) {
    vec2 sp = vec2(atan(d.z, d.x) * 160.0, asin(clamp(y, -1.0, 1.0)) * 160.0);
    vec2 ci = floor(sp);
    float r = h1(ci);
    float star = step(0.985, r) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + r * 50.0);
    col += vec3(0.9, 0.95, 1.0) * star * tw * uStars * smoothstep(0.0, 0.3, y) * 1.6;
    // milky band
    float band = exp(-pow((d.x * 0.6 + d.z * 0.8) / 0.25, 2.0)) * fbm(sp * 0.02) * 0.25;
    col += vec3(0.55, 0.5, 0.8) * band * uStars * smoothstep(0.05, 0.4, y);
  }
  // aurora
  if (uAurora > 0.001 && y > 0.05) {
    vec2 ap = d.xz / (y + 0.3);
    float wave = sin(ap.x * 2.2 + uTime * 0.15 + fbm(ap * 1.2 + uTime * 0.03) * 4.0);
    float curtain = smoothstep(0.3, 1.0, wave) * fbm(vec2(ap.x * 6.0, uTime * 0.2));
    float h = smoothstep(0.05, 0.35, y) * smoothstep(0.85, 0.35, y);
    vec3 ac = mix(vec3(0.15, 0.95, 0.6), vec3(0.55, 0.35, 1.0), smoothstep(0.2, 0.7, y));
    col += ac * curtain * h * uAurora * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly sunDir = new THREE.Vector3();
  /** direction the directional light comes from (never too close to the horizon) */
  readonly lightDir = new THREE.Vector3(0, 1, 0);
  state: SkyState = SKY_KEYS.dawn;
  private target: SkyState = SKY_KEYS.dawn;
  private from: SkyState = SKY_KEYS.dawn;
  private blend = 1;
  private blendSpeed = 0.05;
  /** local override (e.g. the spire is always at dusk, the cavern is dim) */
  override: SkyState | null = null;
  private overrideW = 0;

  constructor(private scene: THREE.Scene) {
    this.uniforms = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 },
      uStars: { value: 0 }, uAurora: { value: 0 }, uClouds: { value: 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, depthTest: true,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.mesh.scale.setScalar(4000);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -70; cam.right = 70; cam.top = 70; cam.bottom = -70; cam.near = 1; cam.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xffffff, 0.002);
    this.apply(this.state);
  }

  setTarget(s: SkyState, seconds = 20) {
    this.from = this.state;
    this.target = s;
    this.blend = 0;
    this.blendSpeed = 1 / Math.max(0.01, seconds);
  }

  snap(s: SkyState) {
    this.from = this.target = this.state = s;
    this.blend = 1;
    this.apply(s);
  }

  /** Local override weight 0..1 (e.g. inside the spire area). */
  setOverride(s: SkyState | null, w: number) {
    this.override = s;
    this.overrideW = w;
  }

  update(dt: number, time: number, focus: THREE.Vector3) {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * this.blendSpeed);
      const e = this.blend * this.blend * (3 - 2 * this.blend);
      this.state = lerpSky(this.from, this.target, e);
    }
    let s = this.state;
    if (this.override && this.overrideW > 0.001) s = lerpSky(s, this.override, this.overrideW);
    this.apply(s);
    this.uniforms.uTime.value = time;
    this.mesh.position.copy(focus);
    // shadow camera follows the focus, snapped to texels to avoid shimmering
    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    const texel = (cam.right - cam.left) / this.sun.shadow.mapSize.x;
    const snap = (v: number) => Math.round(v / texel) * texel;
    const fx = snap(focus.x), fz = snap(focus.z);
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.lightDir.x * 300, focus.y + this.lightDir.y * 300, fz + this.lightDir.z * 300);
  }

  current(): SkyState {
    return this.override && this.overrideW > 0.001 ? lerpSky(this.state, this.override, this.overrideW) : this.state;
  }

  private apply(s: SkyState) {
    const el = THREE.MathUtils.degToRad(Math.max(s.sunElev, -20));
    const az = THREE.MathUtils.degToRad(s.sunAzim);
    // azimuth 0 = north (-z), 90 = east (+x)
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    const u = this.uniforms;
    (u.uZenith.value as THREE.Color).set(s.zenith);
    (u.uHorizon.value as THREE.Color).set(s.horizon);
    (u.uGround.value as THREE.Color).set(s.ground);
    (u.uSunColor.value as THREE.Color).set(s.sunColor);
    (u.uSunDir.value as THREE.Vector3).copy(this.sunDir);
    u.uStars.value = s.stars;
    u.uAurora.value = s.aurora;
    u.uClouds.value = s.clouds;
    this.sun.color.set(s.sunColor);
    // keep the light a little above the horizon (and become moonlight from above at night)
    this.lightDir.copy(this.sunDir);
    if (this.lightDir.y < 0.2) this.lightDir.y = 0.2 + (0.2 - this.lightDir.y) * 1.5;
    this.lightDir.normalize();
    this.sun.intensity = s.sunIntensity;
    this.hemi.color.set(s.hemiSky);
    this.hemi.groundColor.set(s.hemiGround);
    this.hemi.intensity = s.hemiIntensity;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.set(s.fog);
    fog.density = s.fogDensity;
  }
}
