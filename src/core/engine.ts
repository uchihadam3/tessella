/** Renderer, camera, post-processing, resize and the main loop. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type Quality = 'low' | 'medium' | 'high';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.08 },
    uWarmth: { value: 0.02 },
    uGrain: { value: 0.035 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
    uLift: { value: new THREE.Vector3(0.0, 0.0, 0.01) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uSaturation; uniform float uWarmth;
uniform float uGrain; uniform float uFade; uniform vec3 uFadeColor; uniform vec3 uLift;
varying vec2 vUv;
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*0.37) * 43758.5453); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
  c.rgb = mix(vec3(l), c.rgb, uSaturation);
  c.rgb += vec3(uWarmth, uWarmth*0.4, -uWarmth*0.6) * (1.0 - l);
  c.rgb += uLift * (1.0 - l);
  vec2 d = vUv - 0.5;
  float v = 1.0 - dot(d, d) * uVignette * 2.2;
  c.rgb *= clamp(v, 0.0, 1.0);
  c.rgb += (rnd(vUv * 731.0) - 0.5) * uGrain * (0.35 + 0.65 * (1.0 - l));
  c.rgb = mix(c.rgb, uFadeColor, uFade);
  gl_FragColor = c;
}`,
};

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  private renderPass: RenderPass;
  private output: OutputPass;
  private updaters: ((dt: number, t: number) => void)[] = [];
  private last = performance.now();
  time = 0;
  quality: Quality = 'high';
  running = false;
  /** frames-per-second (smoothed) */
  fps = 60;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 6000);
    this.scene.add(this.camera);

    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 0.85) : q === 'medium' ? Math.min(dpr, 1) : Math.min(dpr, 1.5));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.bloom.enabled = q !== 'low';
    const rt = this.composer.renderTarget1 as THREE.WebGLRenderTarget;
    const rt2 = this.composer.renderTarget2 as THREE.WebGLRenderTarget;
    rt.samples = rt2.samples = q === 'high' ? 4 : q === 'medium' ? 2 : 0;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  onUpdate(fn: (dt: number, t: number) => void) {
    this.updaters.push(fn);
  }

  setFade(v: number, color = 0x000000) {
    this.grade.uniforms.uFade.value = v;
    (this.grade.uniforms.uFadeColor.value as THREE.Color).set(color);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
      for (const u of this.updaters) u(dt, this.time);
      this.grade.uniforms.uTime.value = this.time;
      this.composer.render(dt);
    };
    requestAnimationFrame(loop);
  }

  /** Render one frame immediately (used for screenshots / loading). */
  renderOnce() {
    this.composer.render(0.016);
  }
}
