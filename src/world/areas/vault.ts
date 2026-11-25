/**
 * The Hidden Vault: a domed observatory beside the court whose round door carries a ring of
 * small lights — one for each constellation solved. With enough stars it opens; inside, under an
 * oculus and a painted star ceiling, waits the hardest panel of the island (hub.vault).
 */
import * as THREE from 'three';
import { AreaCtx, yawToward } from './common';
import { G, mtx, column, floorSlab, wall } from '../arch';
import { M, mat } from '../materials';
import type { World } from '../world';
import type { Panel, PanelManager } from '../../puzzle/panels';
import { PUZZLES } from '../../data/puzzles';
import { HUB } from '../layout';

export interface VaultRuntime extends AreaCtx {
  setStars(n: number, threshold: number, visible: boolean): void;
  open(instant?: boolean): void;
  vaultPanel: Panel | null;
  door: THREE.Vector3;
  center: THREE.Vector3;
}

export const VAULT_POS = { x: 42, z: 56 };

export function buildVault(world: World, pm: PanelManager): VaultRuntime {
  const a = new AreaCtx('hub', world, pm) as VaultRuntime;
  const b = a.build;
  const stone = mat('vaultStone', { color: '#d9d2c4', roughness: 0.85, detail: 0.2, scale: 1.3, pattern: 'blocks' });
  const dark = mat('vaultDark', { color: '#2b2d3a', roughness: 0.6, detail: 0.1, scale: 2 });
  a.frame = mat('vaultFrame', { color: '#23242f', roughness: 0.35, metalness: 0.4, detail: 0.1, scale: 2 });
  const { x: cx, z: cz } = VAULT_POS;
  const y = world.terrain.heightAt(cx, cz) + 0.4;
  const R = 6.5;
  // floor + ring wall (16 segments, one is the door)
  floorSlab(b, stone, cx, y, cz, 16, 16, 0, 2);
  const doorAng = Math.atan2(HUB.z - cz, HUB.x - cx);
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const diff = Math.atan2(Math.sin(mid - doorAng), Math.cos(mid - doorAng));
    if (Math.abs(diff) < Math.PI / segs + 0.01) continue; // door gap
    wall(b, stone, cx + Math.cos(a0) * R, cz + Math.sin(a0) * R, cx + Math.cos(a1) * R, cz + Math.sin(a1) * R, y, 5.5, 0.8);
  }
  // dome with an oculus
  const dome = new THREE.SphereGeometry(R + 0.4, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2 - 0.16);
  b.batch.add(dome, M.roofSlate(), mtx(cx, y + 5.3, cz, 0, 1, 0.75, 1));
  const inner = new THREE.Mesh(new THREE.SphereGeometry(R - 0.1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2 - 0.16), new THREE.MeshBasicMaterial({ color: '#0d1024', side: THREE.BackSide }));
  inner.scale.set(1, 0.75, 1);
  inner.position.set(cx, y + 5.3, cz);
  a.dynamic.add(inner);
  // painted stars on the ceiling
  const sp: number[] = [];
  for (let i = 0; i < 260; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * (Math.PI / 2 - 0.25);
    const r = R - 0.2;
    sp.push(cx + Math.cos(th) * Math.sin(ph) * r, y + 5.3 + Math.cos(ph) * r * 0.75, cz + Math.sin(th) * Math.sin(ph) * r);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  a.dynamic.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#cfe0ff', size: 0.06, toneMapped: false })));
  // portico columns
  for (const s of [-1, 1]) {
    const ang = doorAng + s * 0.32;
    column(b, stone, cx + Math.cos(ang) * (R + 1.4), y, cz + Math.sin(ang) * (R + 1.4), 5.4, 0.3);
  }
  // the round door with its ring of lights
  const doorG = new THREE.Group();
  doorG.position.set(cx + Math.cos(doorAng) * R, y, cz + Math.sin(doorAng) * R);
  doorG.rotation.y = Math.PI / 2 - doorAng;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.5, 48), dark);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 2.0;
  disc.castShadow = true;
  doorG.add(disc);
  const ringLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 150);
  for (let i = 0; i < 150; i++) {
    const ang = (i / 150) * Math.PI * 2;
    const r = i % 2 ? 1.62 : 1.5;
    ringLights.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(ang) * r, 2.0 + Math.sin(ang) * r, 0.27));
    ringLights.setColorAt(i, new THREE.Color(0.12, 0.12, 0.16));
  }
  doorG.add(ringLights);
  // star emblem in the middle
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), M.crystal('#cfe3ff', 0.4));
  emblem.position.set(0, 2.0, 0.3);
  doorG.add(emblem);
  a.dynamic.add(doorG);
  const tag = 'vault.door';
  world.collision.addBlocker({ x: doorG.position.x, z: doorG.position.z, hw: 2.0, hd: 0.4, rot: doorG.rotation.y, y0: y - 1, y1: y + 4.5, tag });
  a.door = doorG.position.clone();
  let opening = 0;
  let isOpen = false;
  a.open = (instant = false) => {
    if (isOpen) return;
    isOpen = true;
    world.collision.setEnabledByTag(tag, false);
    opening = instant ? 1 : 0.0001;
  };
  a.onUpdate((dt, t) => {
    if (opening > 0 && opening < 1) opening = Math.min(1, opening + dt * 0.35);
    if (opening > 0) {
      disc.position.y = 2.0 - 4.2 * opening * opening;
      disc.rotation.z = opening * Math.PI;
    }
    emblem.rotation.z += dt * 0.5;
    (emblem.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 0.2 * Math.sin(t * 1.3);
  });
  a.setStars = (n, threshold, visible) => {
    ringLights.visible = visible;
    for (let i = 0; i < 150; i++) {
      const on = i < n;
      const c = on ? (i < threshold ? new THREE.Color(1.6, 1.4, 1.0) : new THREE.Color(0.9, 1.3, 2.0)) : new THREE.Color(0.12, 0.12, 0.16);
      ringLights.setColorAt(i, c);
    }
    if (ringLights.instanceColor) ringLights.instanceColor.needsUpdate = true;
  };
  // inside: the vault panel under the oculus
  const def = PUZZLES.hub.vault?.[0];
  a.vaultPanel = null;
  a.center = new THREE.Vector3(cx, y, cz);
  if (def) {
    const px = cx - Math.cos(doorAng) * 1.2, pz = cz - Math.sin(doorAng) * 1.2;
    const p = a.panel(def, { x: px, z: pz, y, yaw: yawToward(px, pz, doorG.position.x, doorG.position.z), maxSize: 1.6, tilt: 30 }, 'vault');
    a.vaultPanel = p;
    p.extraPower = () => isOpen;
  }
  // light shaft from the oculus
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.45, 0.35), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shaft.position.set(cx, y + 3.2, cz);
  a.dynamic.add(shaft);
  a.exclude(cx, cz, 10);
  void G;
  return a;
}
