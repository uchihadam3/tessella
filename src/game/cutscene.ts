/** Tiny camera-shot sequencer for wordless set-pieces. */
import * as THREE from 'three';

export interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  /** seconds to travel to this shot (from the previous one) and hold */
  dur: number;
  /** fraction 0..1 of this shot at which `fn` runs */
  at?: number;
  fn?: () => void;
  /** extra hold after arriving */
  hold?: number;
}

export class Cutscene {
  private i = 0;
  private t = 0;
  private fromPos = new THREE.Vector3();
  private fromQ = new THREE.Quaternion();
  private toQ = new THREE.Quaternion();
  private fired = false;
  private returnPos: THREE.Vector3;
  private returnQ: THREE.Quaternion;
  private returning = false;

  constructor(private cam: THREE.PerspectiveCamera, private shots: Shot[], private done: () => void, private returnAtEnd = true) {
    this.returnPos = cam.position.clone();
    this.returnQ = cam.quaternion.clone();
    this.begin();
  }

  private begin() {
    this.fromPos.copy(this.cam.position);
    this.fromQ.copy(this.cam.quaternion);
    if (this.returning) {
      this.toQ.copy(this.returnQ);
    } else {
      const s = this.shots[this.i];
      const m = new THREE.Matrix4().lookAt(s.pos, s.look, new THREE.Vector3(0, 1, 0));
      this.toQ.setFromRotationMatrix(m);
    }
    this.t = 0;
    this.fired = false;
  }

  update(dt: number) {
    if (this.returning) {
      this.t += dt / 1.6;
      const e = ease(Math.min(1, this.t));
      this.cam.position.lerpVectors(this.fromPos, this.returnPos, e);
      this.cam.quaternion.slerpQuaternions(this.fromQ, this.toQ, e);
      if (this.t >= 1) this.done();
      return;
    }
    const s = this.shots[this.i];
    this.t += dt / s.dur;
    const travel = Math.min(1, this.t / 0.55);
    const e = ease(travel);
    this.cam.position.lerpVectors(this.fromPos, s.pos, e);
    this.cam.quaternion.slerpQuaternions(this.fromQ, this.toQ, e);
    if (!this.fired && s.fn && this.t >= (s.at ?? 0)) {
      this.fired = true;
      s.fn();
    }
    if (this.t >= 1 + (s.hold ?? 0) / s.dur) {
      this.i++;
      if (this.i >= this.shots.length) {
        if (this.returnAtEnd) {
          this.returning = true;
          this.begin();
        } else this.done();
        return;
      }
      this.begin();
    }
  }
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
