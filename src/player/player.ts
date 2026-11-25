/** First-person walker: smooth movement, collision, stairs, head bob, footsteps. */
import * as THREE from 'three';
import type { CollisionWorld } from './collision';
import type { Input } from '../core/input';
import type { Surface } from '../audio/api';

export interface PlayerSettings {
  sensitivity: number; // 1 = default
  invertY: boolean;
  headBob: boolean;
  fov: number;
}

export class Player {
  readonly pos = new THREE.Vector3(); // feet
  yaw = 0;
  pitch = 0;
  readonly vel = new THREE.Vector3();
  vy = 0;
  readonly radius = 0.32;
  readonly height = 1.7;
  readonly eye = 1.62;
  readonly step = 0.55;
  walkSpeed = 4.3;
  runSpeed = 7.6;
  frozen = false;
  /** look-only mode (in a panel / cutscene) */
  lookLocked = false;
  surface: Surface = 'grass';
  private bobPhase = 0;
  private stepAcc = 0;
  private eyeY = 0;
  onFootstep: (s: Surface, speed: number) => void = () => {};
  settings: PlayerSettings = { sensitivity: 1, invertY: false, headBob: true, fov: 72 };
  /** last frame's horizontal speed */
  speed = 0;

  constructor(private world: CollisionWorld, private input: Input) {}

  place(x: number, z: number, yaw = 0, y?: number) {
    const [g] = this.world.groundAt(x, z, y !== undefined ? y + this.step : 9999);
    this.pos.set(x, y ?? g, z);
    if (y === undefined) this.pos.y = g;
    this.yaw = yaw;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.eyeY = this.pos.y + this.eye;
  }

  look(dx: number, dy: number) {
    const s = 0.0022 * this.settings.sensitivity;
    this.yaw -= dx * s;
    this.pitch -= dy * s * (this.settings.invertY ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  update(dt: number) {
    if (this.frozen) {
      this.vel.set(0, 0, 0);
      this.speed = 0;
      return;
    }
    const ax = this.input.axis();
    const target = new THREE.Vector3();
    if (!this.lookLocked) {
      const sp = this.input.running ? this.runSpeed : this.walkSpeed;
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      target.addScaledVector(fwd, ax.y * sp).addScaledVector(right, ax.x * sp);
    }
    const accel = target.lengthSq() > 0.01 ? 10 : 12;
    this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);

    const feet = this.pos.y;
    const p = { x: this.pos.x + this.vel.x * dt, z: this.pos.z + this.vel.z * dt };
    this.world.resolve(p, this.radius, feet + this.step * 0.9, feet + this.height);
    // ground at the new spot
    const moved = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    const climb = this.step + moved * 1.15; // allows ~49° slopes
    let [g, surf] = this.world.groundAt(p.x, p.z, feet + climb);
    const [gHere] = this.world.groundAt(this.pos.x, this.pos.z, feet + this.step);
    const terr = this.world.terrainHeight(p.x, p.z);
    // terrain too steep to climb counts as a wall (unless we stand on a floor above it)
    const blockedTerrain = terr > feet + climb && g < terr - 0.01 && g < feet - 2.5;
    // deep water blocks
    const water = this.world.waterAt(p.x, p.z);
    const deepWater = g < water - 0.75 && g === terr;
    const ceiling = this.world.ceilingAt(p.x, p.z, feet + this.step, feet + this.height);
    if (g === -Infinity || blockedTerrain || deepWater || ceiling) {
      // try sliding along each axis
      let slid = false;
      for (const [tx, tz] of [[p.x, this.pos.z], [this.pos.x, p.z]] as [number, number][]) {
        const q = { x: tx, z: tz };
        this.world.resolve(q, this.radius, feet + this.step * 0.9, feet + this.height);
        const mv = Math.hypot(q.x - this.pos.x, q.z - this.pos.z);
        const [g2, s2] = this.world.groundAt(q.x, q.z, feet + this.step + mv * 1.15);
        const t2 = this.world.terrainHeight(q.x, q.z);
        const w2 = this.world.waterAt(q.x, q.z);
        if (g2 !== -Infinity && !(g2 < w2 - 0.75 && g2 === t2) && !this.world.ceilingAt(q.x, q.z, feet + this.step, feet + this.height)) {
          p.x = q.x;
          p.z = q.z;
          g = g2;
          surf = s2;
          slid = true;
          break;
        }
      }
      if (!slid) {
        p.x = this.pos.x;
        p.z = this.pos.z;
        g = gHere;
        this.vel.multiplyScalar(0.5);
      }
    }
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x = p.x;
    this.pos.z = p.z;
    if (surf) this.surface = surf;
    // vertical
    if (g < this.pos.y - 0.05) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y < g) {
        this.pos.y = g;
        this.vy = 0;
      }
    } else {
      this.pos.y = g;
      this.vy = 0;
    }
    if (!isFinite(this.pos.y)) this.pos.y = this.world.terrainHeight(this.pos.x, this.pos.z);

    // footsteps + bob
    const dist = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.speed = dt > 0 ? dist / dt : 0;
    const onGround = Math.abs(this.vy) < 0.01;
    if (onGround && this.speed > 0.6) {
      this.bobPhase += dist * (this.input.running ? 1.75 : 2.05);
      this.stepAcc += dist;
      const stride = this.input.running ? 1.05 : 0.78;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        this.onFootstep(this.surface, this.speed);
      }
    } else {
      this.bobPhase *= 0.9;
    }
    // smooth eye height (stairs feel nice)
    const targetEye = this.pos.y + this.eye;
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 14);
    if (Math.abs(targetEye - this.eyeY) > 2) this.eyeY = targetEye;
  }

  applyCamera(cam: THREE.PerspectiveCamera) {
    const bob = this.settings.headBob ? Math.sin(this.bobPhase * Math.PI) * 0.035 * Math.min(1, this.speed / 4) : 0;
    const sway = this.settings.headBob ? Math.cos(this.bobPhase * Math.PI * 0.5) * 0.02 * Math.min(1, this.speed / 4) : 0;
    cam.position.set(this.pos.x, this.eyeY + bob, this.pos.z);
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = sway * 0.3;
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }
}
