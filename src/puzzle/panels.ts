/**
 * Panel logic + interaction: power chains, engaging (camera framing), pressing tiles,
 * drag painting, undo/reset, submitting with the seal, error feedback, cables.
 */
import * as THREE from 'three';
import { PanelView, type PanelOptions } from './panelView';
import { check, geometryOf } from './rules';
import { initialState, isPressable, pressSet } from './board';
import type { PuzzleDef } from './types';
import type { AreaId } from '../data/areas';
import { audio } from '../audio';

export class Panel {
  readonly view: PanelView;
  state: Uint8Array;
  solved = false;
  /** a solved panel being drawn again (as in The Witness: what it opened stays open) */
  replaying = false;
  powered = false;
  /** panels (or predicates) that must be solved for this one to have power */
  sources: Panel[] = [];
  extraPower: (() => boolean) | null = null;
  private undo: Uint8Array[] = [];
  readonly onSolved: ((p: Panel) => void)[] = [];
  readonly cablesOut: Cable[] = [];
  /** cables feeding this panel; it powers once all of them have finished flowing */
  readonly cablesIn: Cable[] = [];

  constructor(readonly def: PuzzleDef, readonly area: AreaId, readonly group: string, opts: Omit<PanelOptions, 'def'>) {
    this.view = new PanelView({ ...opts, def });
    this.state = initialState(def);
    this.view.setState(this.state, true);
    if (def.target && def.targetDisplay !== 'world') this.view.addPlate(def.targetDisplay === 'outline' ? 'outline' : 'plate');
  }

  get id() {
    return this.def.id;
  }

  computePowered(): boolean {
    if (this.solved) return true;
    const srcOk = this.sources.every((s) => s.solved);
    const cablesOk = this.cablesIn.every((c) => c.progress >= 1);
    const extraOk = this.extraPower ? this.extraPower() : true;
    return srcOk && cablesOk && extraOk;
  }

  press(i: number): number[] {
    if (!isPressable(this.def, i)) return [];
    const set = pressSet(this.def, geometryOf(this.def), i);
    this.pushUndo();
    for (const t of set) this.state[t] ^= 1;
    this.view.setState(this.state);
    return set;
  }

  setTile(i: number, v: number): boolean {
    if (!isPressable(this.def, i) || this.state[i] === v) return false;
    this.state[i] = v;
    this.view.setState(this.state);
    return true;
  }

  pushUndo() {
    this.undo.push(this.state.slice());
    if (this.undo.length > 200) this.undo.shift();
  }

  undoLast(): boolean {
    const s = this.undo.pop();
    if (!s) return false;
    this.state = s;
    this.view.setState(this.state);
    return true;
  }

  /** start drawing a solved panel again */
  beginReplay() {
    if (!this.solved || this.replaying) return;
    this.replaying = true;
    this.undo = [];
    this.view.setSolved(false, false);
  }

  /** can its tiles be changed now? */
  get editable() {
    return !this.solved || this.replaying;
  }

  reset() {
    this.pushUndo();
    this.state = initialState(this.def);
    this.view.setState(this.state);
  }

  load(stateStr: string | undefined, solved: boolean) {
    if (stateStr && stateStr.length === this.state.length) {
      for (let i = 0; i < this.state.length; i++) {
        const c = this.def.cells[i];
        if (c.hole) continue;
        this.state[i] = c.lock !== undefined ? c.lock : stateStr[i] === '1' ? 1 : 0;
      }
    }
    this.solved = solved;
    this.replaying = false;
    this.view.setState(this.state, true);
    this.view.setSolved(solved, false);
  }

  stateString(): string {
    let s = '';
    for (let i = 0; i < this.state.length; i++) s += this.state[i] ? '1' : '0';
    return s;
  }
}

// ───────────────────────── cables ─────────────────────────

const cableVert = /* glsl */ `
attribute float aT;
varying float vT;
varying vec3 vN;
#include <fog_pars_vertex>
void main(){
  vT = aT;
  vN = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const cableFrag = /* glsl */ `
uniform float uProgress; uniform vec3 uColor; uniform float uTime; uniform vec3 uBase;
varying float vT; varying vec3 vN;
#include <fog_pars_fragment>
void main(){
  float lit = step(vT, uProgress);
  float head = smoothstep(uProgress - 0.04, uProgress, vT) * step(vT, uProgress) * step(uProgress, 0.999);
  float pulse = 0.75 + 0.25 * sin(vT * 60.0 - uTime * 6.0);
  float shade = 0.55 + 0.45 * max(vN.y, 0.0);
  vec3 base = uBase * shade;
  vec3 col = mix(base, uColor * (1.6 * pulse + head * 3.0), lit);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Cable {
  readonly mesh: THREE.Mesh;
  progress = 0;
  private target = 0;
  readonly length: number;
  onArrive: (() => void)[] = [];
  private arrived = false;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(points: THREE.Vector3[], color: string, radius = 0.045) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.3);
    this.length = curve.getLength();
    const segs = Math.max(8, Math.round(this.length * 3));
    const geo = new THREE.TubeGeometry(curve, segs, radius, 6, false);
    // per-vertex parameter along the curve from uv.x
    const uv = geo.attributes.uv;
    const t = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) t[i] = uv.getX(i);
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uProgress: { value: 0 }, uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uBase: { value: new THREE.Color('#3b3a3f') } },
    ]);
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: cableVert, fragmentShader: cableFrag, fog: true });
    this.mesh = new THREE.Mesh(geo, m);
    this.mesh.receiveShadow = true;
  }

  /** start flowing (speed m/s) */
  flow(instant = false) {
    this.target = 1;
    if (instant) {
      this.progress = 1;
      this.uniforms.uProgress.value = 1;
      if (!this.arrived) {
        this.arrived = true;
        for (const f of this.onArrive) f();
      }
    } else {
      audio.cable(Math.min(6, this.length / 9));
    }
  }

  update(dt: number, time: number) {
    this.uniforms.uTime.value = time;
    if (this.progress < this.target) {
      this.progress = Math.min(this.target, this.progress + (dt * 9) / Math.max(1, this.length));
      this.uniforms.uProgress.value = this.progress;
      if (this.progress >= 1 && !this.arrived) {
        this.arrived = true;
        for (const f of this.onArrive) f();
      }
    }
  }
}

// ───────────────────────── manager ─────────────────────────

export interface PanelEvents {
  solved: (p: Panel) => void;
  failed: (p: Panel) => void;
  changed: (p: Panel) => void;
  engage: (p: Panel | null) => void;
}

export class PanelManager {
  readonly panels: Panel[] = [];
  readonly byId = new Map<string, Panel>();
  readonly cables: Cable[] = [];
  readonly group = new THREE.Group();
  engaged: Panel | null = null;
  aimed: Panel | null = null;
  private raycaster = new THREE.Raycaster();
  private camFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private camTo = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private camT = 1;
  private leaving = false;
  private dragging = false;
  private dragValue = 0;
  private dragVisited = new Set<number>();
  private lodTimer = 0;
  events: Partial<PanelEvents> = {};
  /** where the camera returns to when leaving a panel */
  returnView: () => { pos: THREE.Vector3; quat: THREE.Quaternion } = () => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
  reach = 4.2;

  constructor(private camera: THREE.PerspectiveCamera, private dom: HTMLElement) {
    this.raycaster.far = 60;
  }

  add(p: Panel): Panel {
    this.panels.push(p);
    this.byId.set(p.id, p);
    this.group.add(p.view.root);
    return p;
  }

  /** Power chain: `to` gets power when `from` is solved (and the cable finished flowing). */
  link(from: Panel, to: Panel, points?: THREE.Vector3[], color?: string): Cable | null {
    to.sources.push(from);
    if (!points || points.length < 2) return null;
    const cable = this.addCable(points, color ?? from.view.opts.lit);
    from.cablesOut.push(cable);
    to.cablesIn.push(cable);
    cable.onArrive.push(() => this.refreshPower());
    return cable;
  }

  addCable(points: THREE.Vector3[], color: string): Cable {
    const c = new Cable(points, color);
    this.cables.push(c);
    this.group.add(c.mesh);
    return c;
  }

  refreshPower() {
    for (const p of this.panels) {
      const on = p.computePowered();
      if (on !== p.powered) {
        p.powered = on;
        p.view.setPowered(on);
        if (on && !p.solved) audio.panelPowered();
      }
    }
  }

  /** Mark a panel solved from a save (no events/animations except cables jumping to full). */
  restore(p: Panel, stateStr: string | undefined, solved: boolean) {
    p.load(stateStr, solved);
    if (solved) for (const c of p.cablesOut) c.flow(true);
  }

  // ── aiming / engaging ──

  /** Raycast from screen centre (not engaged) to find an interactable panel. */
  updateAim(): Panel | null {
    if (this.engaged) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = this.reach + 1.5;
    const objs: THREE.Object3D[] = [];
    const camPos = this.camera.position;
    for (const p of this.panels) {
      if (p.view.root.position.distanceToSquared(camPos) > 64) continue;
      objs.push(...p.view.pickables);
    }
    const hits = this.raycaster.intersectObjects(objs, false);
    let found: Panel | null = null;
    for (const h of hits) {
      const pv = h.object.userData.panel as PanelView | undefined;
      if (!pv) continue;
      if (h.distance > this.reach + (pv.faceH > 1 ? 1 : 0)) break;
      found = this.panels.find((p) => p.view === pv) ?? null;
      break;
    }
    this.aimed = found && found.powered ? found : null;
    return this.aimed;
  }

  private ndcOf(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.dom.getBoundingClientRect();
    return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** Touch: the powered panel under a screen point, within reach (tap a panel to use it). */
  pickAt(clientX: number, clientY: number): Panel | null {
    if (this.engaged) return null;
    this.raycaster.setFromCamera(this.ndcOf(clientX, clientY), this.camera);
    this.raycaster.far = this.reach + 3;
    const objs: THREE.Object3D[] = [];
    const camPos = this.camera.position;
    for (const p of this.panels) {
      if (p.view.root.position.distanceToSquared(camPos) > 100) continue;
      objs.push(...p.view.pickables);
    }
    for (const h of this.raycaster.intersectObjects(objs, false)) {
      const pv = h.object.userData.panel as PanelView | undefined;
      if (!pv) continue;
      // a finger is less precise than a crosshair: allow a little more distance
      if (h.distance > this.reach + 1 + (pv.faceH > 1 ? 1 : 0)) return null;
      const p = this.panels.find((q) => q.view === pv) ?? null;
      return p && p.powered ? p : null;
    }
    return null;
  }

  /** Touch: does a screen point land on the engaged panel at all (face or seal)? */
  faceAt(clientX: number, clientY: number): boolean {
    const p = this.engaged;
    if (!p) return false;
    this.raycaster.setFromCamera(this.ndcOf(clientX, clientY), this.camera);
    this.raycaster.far = 20;
    return this.raycaster.intersectObjects(p.view.pickables, false).length > 0;
  }

  engage(p: Panel) {
    if (!p.powered) return;
    this.engaged = p;
    this.leaving = false;
    this.camFrom.pos.copy(this.camera.position);
    this.camFrom.quat.copy(this.camera.quaternion);
    const v = p.view.engageView(this.camera);
    this.camTo.pos.copy(v.pos);
    const m = new THREE.Matrix4().lookAt(v.pos, v.target, new THREE.Vector3(0, 1, 0));
    this.camTo.quat.setFromRotationMatrix(m);
    this.camT = 0;
    p.view.setResolution(this.hiRes(p));
    p.view.glowScale = 0.55;
    audio.panelEngage();
    this.events.engage?.(p);
  }

  private hiRes(p: Panel): number {
    const L = p.view.layout;
    return Math.min(1600, Math.max(768, Math.round(150 * Math.max(L.W, L.H))));
  }

  leave() {
    if (!this.engaged) return;
    const p = this.engaged;
    p.view.setHover(-1);
    this.leaving = true;
    this.camFrom.pos.copy(this.camera.position);
    this.camFrom.quat.copy(this.camera.quaternion);
    const r = this.returnView();
    this.camTo.pos.copy(r.pos);
    this.camTo.quat.copy(r.quat);
    this.camT = 0;
    this.dragging = false;
    audio.panelLeave();
  }

  /** 0..1 how "close-up" the camera is on a panel (used to soften bloom) */
  get closeUp(): number {
    if (!this.engaged) return 0;
    const e = 1 - Math.pow(1 - this.camT, 3);
    return this.leaving ? 1 - e : e;
  }

  /** true while the camera glides to or from a panel */
  get tweening(): boolean {
    return this.camT < 1;
  }

  /** true while the camera is controlled by the panel system */
  get controllingCamera(): boolean {
    return !!this.engaged || this.camT < 1;
  }

  // ── pointer handling while engaged ──

  private pick(clientX: number, clientY: number) {
    const p = this.engaged;
    if (!p) return null;
    this.raycaster.setFromCamera(this.ndcOf(clientX, clientY), this.camera);
    this.raycaster.far = 20;
    const hits = this.raycaster.intersectObjects(p.view.pickables, false);
    for (const h of hits) {
      const r = p.view.hitTest(h);
      if (r) return r;
    }
    return null;
  }

  pointerMove(x: number, y: number) {
    const p = this.engaged;
    if (!p || this.leaving || this.camT < 0.6) return;
    const hit = this.pick(x, y);
    p.view.setHover(hit ? (hit.kind === 'seal' ? -2 : hit.index) : -1);
    if (this.dragging && hit?.kind === 'tile' && !this.dragVisited.has(hit.index)) {
      this.dragVisited.add(hit.index);
      if (p.setTile(hit.index, this.dragValue)) {
        const r = Math.floor(hit.index / p.def.w), c = hit.index % p.def.w;
        audio.tile(!!this.dragValue, r, c, p.def.h, p.def.w, p.area);
        this.events.changed?.(p);
      }
    }
  }

  pointerDown(x: number, y: number, button: number) {
    const p = this.engaged;
    if (!p || this.leaving) return;
    if (button === 2) {
      this.leave();
      return;
    }
    const hit = this.pick(x, y);
    if (!hit) return;
    if (hit.kind === 'seal') {
      this.submit();
      return;
    }
    // a solved panel can be drawn again: touching it starts over
    if (p.solved) p.beginReplay();
    const pressed = p.press(hit.index);
    if (!pressed.length) return;
    p.view.clearBlink();
    const r = Math.floor(hit.index / p.def.w), c = hit.index % p.def.w;
    audio.tile(!!p.state[hit.index], r, c, p.def.h, p.def.w, p.area);
    // drag painting only for plain panels
    const simple = !p.def.mirror && !p.def.cells.some((cl) => cl.echo?.length);
    if (simple) {
      this.dragging = true;
      this.dragValue = p.state[hit.index];
      this.dragVisited = new Set([hit.index]);
    }
    this.events.changed?.(p);
  }

  pointerUp() {
    this.dragging = false;
  }

  submit() {
    const p = this.engaged;
    if (!p || !p.editable || this.leaving) return;
    p.view.pressFlash = 1;
    const res = check(p.def, p.state);
    if (res.ok && p.replaying) {
      // solved again: only the panel itself shows it (what it opened stays as it is)
      p.replaying = false;
      p.view.setSolved(true);
      p.view.clearBlink();
      audio.panelSolved(p.area, Math.min(1, (p.def.difficulty ?? 3) / 10));
      this.events.changed?.(p);
      setTimeout(() => {
        if (this.engaged === p && !this.leaving) this.leave();
      }, 1100);
    } else if (res.ok) {
      p.solved = true;
      p.view.setSolved(true);
      p.view.clearBlink();
      audio.panelSolved(p.area, Math.min(1, (p.def.difficulty ?? 3) / 10));
      for (const c of p.cablesOut) c.flow();
      for (const f of p.onSolved) f(p);
      this.events.solved?.(p);
      this.refreshPower();
      // step back automatically after a moment
      setTimeout(() => {
        if (this.engaged === p && !this.leaving) this.leave();
      }, 1100);
    } else {
      const tiles = new Set<number>();
      const rows: number[] = [];
      const cols: number[] = [];
      for (const v of res.violations) {
        v.tiles.forEach((t) => tiles.add(t));
        if (v.rows) rows.push(...v.rows);
        if (v.cols) cols.push(...v.cols);
        // the whole answer is wrong: the whole board blinks (it tells nothing about which tiles)
        if (v.whole) p.def.cells.forEach((c, i) => !c.hole && tiles.add(i));
      }
      p.view.blink([...tiles], rows, cols);
      audio.panelFailed();
      this.events.failed?.(p);
    }
  }

  undo() {
    const p = this.engaged;
    if (p && p.editable && p.undoLast()) {
      audio.uiBack();
      this.events.changed?.(p);
    }
  }

  reset() {
    const p = this.engaged;
    if (p) {
      p.beginReplay();
      p.reset();
      p.view.clearBlink();
      audio.uiBack();
      this.events.changed?.(p);
    }
  }

  /** Rotate a drum panel (wheel / keys). */
  spinDrum(delta: number) {
    const p = this.engaged;
    if (!p || p.view.mount !== 'drum') return;
    const drum = p.view.root.getObjectByName('drum');
    if (drum) drum.rotation.y += delta;
  }

  update(dt: number, time: number) {
    // camera tween
    if (this.camT < 1) {
      this.camT = Math.min(1, this.camT + dt * 2.6);
      const e = 1 - Math.pow(1 - this.camT, 3);
      this.camera.position.lerpVectors(this.camFrom.pos, this.camTo.pos, e);
      this.camera.quaternion.slerpQuaternions(this.camFrom.quat, this.camTo.quat, e);
      if (this.camT >= 1 && this.leaving) {
        const p = this.engaged;
        this.engaged = null;
        this.leaving = false;
        if (p) {
          p.view.setResolution(this.lodFor(p));
          p.view.glowScale = 1;
        }
        this.events.engage?.(null);
      }
    } else if (this.engaged) {
      this.camera.position.copy(this.camTo.pos);
      this.camera.quaternion.copy(this.camTo.quat);
    }
    for (const c of this.cables) c.update(dt, time);
    // panel animations: only nearby ones
    const cp = this.camera.position;
    this.lodTimer -= dt;
    const doLod = this.lodTimer <= 0;
    if (doLod) this.lodTimer = 0.5;
    for (const p of this.panels) {
      const d2 = p.view.root.position.distanceToSquared(cp);
      if (p === this.engaged || d2 < 60 * 60) p.view.update(dt, time);
      if (doLod && p !== this.engaged) p.view.setResolution(this.lodFor(p, d2));
    }
  }

  private lodFor(p: Panel, d2 = p.view.root.position.distanceToSquared(this.camera.position)): number {
    const L = p.view.layout;
    const big = Math.max(L.W, L.H);
    if (d2 < 12 * 12) return Math.min(900, Math.round(64 * big));
    if (d2 < 45 * 45) return Math.min(512, Math.round(36 * big));
    return Math.min(192, Math.round(18 * big));
  }
}
