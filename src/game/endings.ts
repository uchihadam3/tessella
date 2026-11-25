/**
 * The two endings.
 *  - "Um Novo Dia" (main): the crown of the Sky Spire ignites, every beam converges, a wave of
 *    light rolls over the island while night turns into a new dawn; the camera glides home to the
 *    beach where you woke. Credits roll over the living island.
 *  - "Firmamento" (secret): after the Hidden Vault, night falls, every constellation on the
 *    island blazes, their light rises into the sky and assembles the emblem — with a tenth tile.
 */
import * as THREE from 'three';
import type { Game } from './game';
import { Cutscene, type Shot } from './cutscene';
import { SKY_KEYS, lerpSky } from '../world/sky';
import { SPIRE, CALDERA, HUB } from '../world/layout';
import { AREA_BY_ID, TEACHING_AREAS } from '../data/areas';
import { audio } from '../audio';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function runShots(game: Game, shots: Shot[]): Promise<void> {
  return new Promise((res) => {
    const cs = new Cutscene(game.engine.camera, shots, () => res(), false);
    const tick = (dt: number) => cs.update(dt);
    game.endingTick = tick;
  });
}

/** Expanding ring of light (the wave) */
function lightWave(scene: THREE.Scene, center: THREE.Vector3, color: string) {
  const u = { uR: { value: 1 }, uColor: { value: new THREE.Color(color) }, uFade: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uR; uniform vec3 uColor; uniform float uFade; varying vec3 vP;
      void main(){ float d = length(vP.xz); float band = exp(-pow((d - uR) / (6.0 + uR * 0.03), 2.0));
      float h = 1.0 - smoothstep(0.0, 60.0, abs(vP.y)); gl_FragColor = vec4(uColor * band * h * 2.2 * uFade, band * h * uFade); }`,
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 120, 96, 1, true), mat);
  mesh.position.copy(center);
  mesh.scale.set(700, 1, 700);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh,
    set(r: number, fade: number) {
      u.uR.value = r;
      u.uFade.value = fade;
    },
    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

export async function playMainEnding(game: Game) {
  const ui = game.ui;
  const scene = game.engine.scene;
  game.state = 'ending';
  game.player.frozen = true;
  ui.setCinematic(true);
  audio.playEnding();
  const sky = game.world.sky;
  const top = new THREE.Vector3(SPIRE.x, 168, SPIRE.z);
  // all beams on for the finale
  for (const id of [...TEACHING_AREAS, 'citadel', 'echo'] as const) game.areas.get(id)?.totem?.activate(true);
  // 1 — the crown ignites
  const shotsA: Shot[] = [
    { pos: new THREE.Vector3(SPIRE.x + 26, 150, SPIRE.z + 30), look: top, dur: 5 },
    { pos: new THREE.Vector3(SPIRE.x + 70, 175, SPIRE.z + 95), look: top, dur: 7 },
  ];
  const pA = runShots(game, shotsA);
  game.spireCrown(1);
  await wait(4200);
  // 2 — the wave and the dawn
  const wave = lightWave(scene, new THREE.Vector3(SPIRE.x, CALDERA.floor + 20, SPIRE.z), '#ffe7b0');
  const start = performance.now();
  const waveTick = setInterval(() => {
    const t = (performance.now() - start) / 1000;
    wave.set(4 + t * 62, Math.max(0, 1 - t / 11));
    if (t > 11.5) clearInterval(waveTick);
  }, 16);
  sky.setTarget(SKY_KEYS.newdawn, 16);
  await pA;
  const shotsB: Shot[] = [
    { pos: new THREE.Vector3(160, 210, 260), look: new THREE.Vector3(0, 40, -40), dur: 9 },
    { pos: new THREE.Vector3(-120, 120, 330), look: new THREE.Vector3(0, 20, 120), dur: 9 },
    { pos: new THREE.Vector3(0, 14, 300), look: new THREE.Vector3(0, 12, 420), dur: 8, hold: 2 },
  ];
  await runShots(game, shotsB);
  wave.dispose();
  // 3 — credits over the living island
  await ui.fadeTo(1, 2400, true);
  game.endingOrbit = true;
  ui.setCinematic(false);
  await ui.creditsRoll('main');
  game.endingOrbit = false;
  game.endingTick = null;
  game.afterEnding();
}

export async function playSecretEnding(game: Game) {
  const ui = game.ui;
  const scene = game.engine.scene;
  game.state = 'ending';
  game.player.frozen = true;
  ui.setCinematic(true);
  const a = audio as unknown as { playSecretEnding?: () => void };
  if (a.playSecretEnding) a.playSecretEnding();
  else audio.playEnding();
  const sky = game.world.sky;
  // the deepest night, full of stars
  const night = { ...SKY_KEYS.dusk, sunElev: -18, zenith: '#03040c', horizon: '#1a1840', stars: 1.4, aurora: 1.2, exposure: 1.5, fog: '#0d0d22', fogDensity: 0.0008 };
  sky.setTarget(night, 6);
  const v = game.vaultCenter();
  // 1 — look up through the oculus
  const p1 = runShots(game, [
    { pos: v.clone().add(new THREE.Vector3(1.5, 1.6, 1.5)), look: v.clone().add(new THREE.Vector3(0, 30, 0)), dur: 6 },
    { pos: v.clone().add(new THREE.Vector3(0, 40, 0)), look: v.clone().add(new THREE.Vector3(0, 0, -60)), dur: 6 },
    { pos: new THREE.Vector3(0, 420, 120), look: new THREE.Vector3(0, 0, -40), dur: 10, hold: 3 },
  ]);
  await wait(7000);
  // 2 — every constellation blazes
  game.blazeConstellations();
  await p1;
  // 3 — their light rises and draws the emblem in the sky (with a tenth tile)
  const pts = game.constellationPoints();
  const n = pts.length;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const from = new Float32Array(n * 3);
  const to = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const order = ['kinship', 'mold', 'measure', 'twins', 'echo', 'beacon', 'contour', 'weave', 'mosaic'] as const;
  const emblemC = new THREE.Vector3(0, 300, -120);
  const tileSize = 46;
  for (let i = 0; i < n; i++) {
    from.set([pts[i].x, pts[i].y, pts[i].z], i * 3);
    const tile = i % 10; // 9 tiles + the hidden tenth
    let tx: number, ty: number;
    if (tile < 9) {
      const r = Math.floor(tile / 3), c = tile % 3;
      // diamond: rotate the 3x3 grid by 45°
      const gx = (c - 1) * tileSize, gy = (1 - r) * tileSize;
      const jx = (Math.random() - 0.5) * tileSize * 0.8, jy = (Math.random() - 0.5) * tileSize * 0.8;
      const ux = gx + jx, uy = gy + jy;
      tx = (ux - uy) * 0.7071;
      ty = (ux + uy) * 0.7071;
      const cc = new THREE.Color(AREA_BY_ID[order[tile]].lit);
      col.set([cc.r * 2.2, cc.g * 2.2, cc.b * 2.2], i * 3);
    } else {
      // the tenth tile: above the emblem, pure white
      tx = (Math.random() - 0.5) * tileSize * 0.6;
      ty = tileSize * 2.6 + (Math.random() - 0.5) * tileSize * 0.6;
      col.set([2.6, 2.6, 2.8], i * 3);
    }
    to.set([emblemC.x + tx, emblemC.y + ty, emblemC.z + (Math.random() - 0.5) * 10], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  const t0 = performance.now();
  const anim = setInterval(() => {
    const t = Math.min(1, (performance.now() - t0) / 14000);
    for (let i = 0; i < n; i++) {
      const delay = (i % 37) / 37 * 0.35;
      const k = Math.max(0, Math.min(1, (t - delay) / (1 - 0.35)));
      const e = k * k * (3 - 2 * k);
      const lift = Math.sin(e * Math.PI) * 80;
      pos[i * 3] = from[i * 3] + (to[i * 3] - from[i * 3]) * e;
      pos[i * 3 + 1] = from[i * 3 + 1] + (to[i * 3 + 1] - from[i * 3 + 1]) * e + lift;
      pos[i * 3 + 2] = from[i * 3 + 2] + (to[i * 3 + 2] - from[i * 3 + 2]) * e;
    }
    geo.attributes.position.needsUpdate = true;
    if (t >= 1) clearInterval(anim);
  }, 16);
  await runShots(game, [
    { pos: new THREE.Vector3(0, 160, 420), look: emblemC, dur: 8 },
    { pos: new THREE.Vector3(0, 250, 260), look: emblemC, dur: 9, hold: 4 },
  ]);
  // 4 — secret credits
  await ui.fadeTo(1, 2600);
  scene.remove(sparks);
  geo.dispose();
  ui.setCinematic(false);
  sky.setTarget(lerpSky(SKY_KEYS.dusk, SKY_KEYS.newdawn, 0.35), 20);
  game.endingOrbit = true;
  await ui.creditsRoll('secret');
  game.endingOrbit = false;
  game.endingTick = null;
  game.afterEnding();
}

export { HUB };
