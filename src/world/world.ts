/** Assembles the island: terrain, sky, water, vegetation, collision. Areas plug in via build hooks. */
import * as THREE from 'three';
import type { Engine } from '../core/engine';
import { Terrain } from './terrain';
import { Sky } from './sky';
import { WaterSystem } from './water';
import { BlossomField, Forest, GrassField, windUniforms } from './vegetation';
import { Weathering } from './weathering';
import { scatterVegetation, grassRules } from './biomes';
import { CollisionWorld } from '../player/collision';
import { ANCHORS, CALDERA } from './layout';

export interface WaterBody {
  x: number;
  z: number;
  r: number;
  level: number;
}

export class World {
  readonly terrain: Terrain;
  readonly sky: Sky;
  readonly water: WaterSystem;
  readonly forest: Forest;
  readonly grass: GrassField;
  /** the blossom trees in flower (around the player) */
  blossoms: BlossomField | null = null;
  /** cracks on the old stone walls (around the player) */
  weathering: Weathering | null = null;
  private weatherTimer = 0;
  readonly collision: CollisionWorld;
  readonly root = new THREE.Group();
  readonly waterBodies: WaterBody[] = [];
  private tmpC1 = new THREE.Color();
  private tmpC2 = new THREE.Color();
  private tmpC3 = new THREE.Color();
  private updaters: ((dt: number, t: number) => void)[] = [];

  constructor(readonly engine: Engine) {
    this.terrain = new Terrain();
    this.root.add(this.terrain.build());
    this.sky = new Sky(engine.scene);
    this.water = new WaterSystem(this.terrain.heightTexture);
    this.water.addSea();
    this.collision = new CollisionWorld((x, z) => this.terrain.heightAt(x, z));
    this.collision.waterAt = (x, z) => this.waterAt(x, z);
    this.forest = new Forest(this.terrain);
    this.grass = new GrassField(this.terrain, grassRules, (x, z, out) => this.terrain.colorAt(x, z, out));
    // fixed water bodies
    const tw = ANCHORS.twins;
    this.addLake(tw.x, tw.z, 74, 7.5, { shallow: '#86d9cf', deep: '#2f6f95', calm: 1, waveScale: 0.9 });
    this.addLake(CALDERA.x, CALDERA.z, 44, 5.9, { shallow: '#5fe0e6', deep: '#163d6e', calm: 0.8, waveScale: 0.8 });
    this.root.add(this.water.group);
    engine.scene.add(this.root);
  }

  addLake(x: number, z: number, r: number, level: number, o: { shallow?: string; deep?: string; calm?: number; waveScale?: number } = {}) {
    const m = this.water.add(new THREE.CircleGeometry(r, 72).rotateX(-Math.PI / 2), { level, ...o });
    m.position.x = x;
    m.position.z = z;
    this.waterBodies.push({ x, z, r, level });
    return m;
  }

  waterAt(x: number, z: number): number {
    let lvl = 0;
    for (const b of this.waterBodies) {
      if ((x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) lvl = Math.max(lvl, b.level);
    }
    return lvl;
  }

  /** After areas registered their exclusions & explicit plants. */
  private scattered = false;
  /** plant trees and rocks (before anything that wants to sit in them, e.g. the constellations) */
  scatter() {
    if (this.scattered) return;
    this.scattered = true;
    scatterVegetation(this.forest);
  }

  finalize() {
    this.scatter();
    this.root.add(this.forest.build());
    this.blossoms = new BlossomField(this.forest);
    this.blossoms.group.userData.castAs = 'skip';
    this.root.add(this.blossoms.group);
    this.weathering = new Weathering(this);
    this.root.add(this.weathering.group);
    for (const c of this.forest.colliders) this.collision.addBlocker({ x: c.x, z: c.z, r: c.r, y0: -100, y1: 400 });
    // no grass where floors/plazas/decks cover the ground
    this.grass.covered = (x, z, h) => this.collision.groundAt(x, z, h + 40)[0] > h + 0.03 || this.forest.isExcluded(x, z, -1.2);
    this.root.add(this.grass.group);
  }

  onUpdate(fn: (dt: number, t: number) => void) {
    this.updaters.push(fn);
  }

  update(dt: number, t: number, focus: THREE.Vector3) {
    windUniforms.uTime.value = t;
    this.sky.update(dt, t, focus);
    const s = this.sky.current();
    this.water.update(t, this.sky.sunDir, this.tmpC1.set(s.sunColor), this.tmpC2.set(s.zenith), this.tmpC3.set(s.horizon));
    this.engine.renderer.toneMappingExposure = s.exposure;
    this.grass.update(focus.x, focus.z);
    this.blossoms?.update(focus.x, focus.z);
    this.weatherTimer -= dt;
    if (this.weathering && this.weatherTimer <= 0) {
      this.weatherTimer = 0.5;
      this.weathering.update(focus);
    }
    for (const u of this.updaters) u(dt, t);
  }
}
