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
  /** surface of bare terrain at a point (set by the game from the terrain biome) */
  terrainSurface: (x: number, z: number) => Surface = () => 'grass';
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

    const before = { x: this.pos.x, z: this.pos.z };
    // move in small sub-steps so thin walls can never be skipped, sliding along obstacles
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / 0.18));
    let feet = this.pos.y;
    let ground = this.world.groundAt(this.pos.x, this.pos.z, feet + 0.05)[0];
    for (let k = 0; k < n; k++) {
      const sx = dx / n, sz = dz / n;
      let m = this.world.tryMove(this.pos.x, this.pos.z, feet, this.pos.x + sx, this.pos.z + sz, this.radius, this.step, this.height);
      if (!m) m = this.world.tryMove(this.pos.x, this.pos.z, feet, this.pos.x + sx, this.pos.z, this.radius, this.step, this.height);
      if (!m) m = this.world.tryMove(this.pos.x, this.pos.z, feet, this.pos.x, this.pos.z + sz, this.radius, this.step, this.height);
      if (!m) {
        this.vel.multiplyScalar(0.5);
        break;
      }
      this.pos.x = m.x;
      this.pos.z = m.z;
      ground = m.y;
      if (m.surface) this.surface = m.surface;
      else this.surface = this.terrainSurface(m.x, m.z);
      // stepping up happens immediately, stepping down is handled by gravity below
      if (ground > feet) feet = ground;
    }
    if (ground === -Infinity || !isFinite(ground)) ground = this.world.terrainHeight(this.pos.x, this.pos.z);
    const g = ground;
    this.pos.y = Math.max(this.pos.y, feet);
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
