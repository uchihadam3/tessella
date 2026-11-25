/**
 * The 3D tessela: frame + canvas-rendered face (+ additive glow layer for bloom) + optional
 * target plate. Pure view: state lives in PanelState (see panels.ts).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PuzzleDef, WeaveClue } from './types';
import { drawEcho, drawGlyph, roundRect } from './glyphs';
import { geometryOf } from './rules';
import { M } from '../world/materials';

export type PanelMount = 'pedestal' | 'wall' | 'floor' | 'drum' | 'lectern';

export interface PanelOptions {
  def: PuzzleDef;
  lit: string;
  accent: string;
  frame?: THREE.Material;
  mount?: PanelMount;
  /** pedestal tilt in degrees (default 24) */
  tilt?: number;
  /** max size of the face in metres */
  maxSize?: number;
  /** pedestal height (m) */
  standHeight?: number;
}

interface Layout {
  W: number; // units
  H: number;
  gx: number;
  gy: number;
  sealX: number;
  sealY: number;
  sealR: number;
  rowClueRight: number; // x where row clues end
  colClueBottom: number;
  hasSeal: boolean;
}

const BEAD = 0.27; // bead spacing for weave clues (units)
const RUN_GAP = 0.3;

function clueUnits(c: WeaveClue | null | undefined): number {
  if (!c) return 0;
  if (c.length === 0) return 0.5;
  return c.reduce((s, r) => s + r * BEAD, 0) + (c.length - 1) * RUN_GAP + 0.25;
}

function computeLayout(p: PuzzleDef, seal: boolean, drum = false): Layout {
  if (drum) {
    return { W: p.w, H: p.h + 0.6, gx: 0, gy: 0.3, sealX: 0, sealY: 0, sealR: 0, rowClueRight: 0, colClueBottom: 0, hasSeal: false };
  }
  const pad = 0.42;
  const left = p.rowClues ? Math.max(0, ...p.rowClues.map(clueUnits)) + 0.2 : 0;
  const top = p.colClues ? Math.max(0, ...p.colClues.map(clueUnits)) + 0.2 : 0;
  const sealH = seal ? 1.55 : 0;
  const W = pad + left + p.w + pad;
  const H = pad + top + p.h + sealH + pad;
  return {
    W, H, gx: pad + left, gy: pad + top, sealX: pad + left + p.w / 2, sealY: pad + top + p.h + sealH * 0.52,
    sealR: 0.5, rowClueRight: pad + left - 0.2, colClueBottom: pad + top - 0.2, hasSeal: seal,
  };
}

export type Hit = { kind: 'tile'; index: number } | { kind: 'seal' };

export class PanelView {
  readonly root = new THREE.Group();
  readonly face: THREE.Mesh;
  readonly glow: THREE.Mesh;
  readonly layout: Layout;
  readonly faceW: number;
  readonly faceH: number;
  readonly unitM: number;
  plate: THREE.Mesh | null = null;
  sealMesh: THREE.Mesh | null = null;
  /** objects to raycast against */
  readonly pickables: THREE.Object3D[] = [];

  state: Uint8Array;
  anim: Float32Array;
  powered = false;
  solved = false;
  hover: number = -1; // tile index, -2 seal
  pressFlash = 0;
  private blinkTiles = new Set<number>();
  private blinkRows = new Set<number>();
  private blinkCols = new Set<number>();
  private blinkT = 0;
  private solveT = 0;
  private canvas: HTMLCanvasElement;
  private glowCanvas: HTMLCanvasElement;
  private tex: THREE.CanvasTexture;
  private glowTex: THREE.CanvasTexture;
  private res = 0;
  private dirty = true;
  private litColor: THREE.Color;
  private litCss: string;
  private borderCss: string;
  private accentCss: string;
  readonly def: PuzzleDef;
  readonly mount: PanelMount;
  /** world-space centre and normal of the face (updated by updateWorld) */
  readonly center = new THREE.Vector3();
  readonly normal = new THREE.Vector3();
  /** drum rotation (radians) for wrap panels */
  drumAngle = 0;
  /** glow multiplier (lowered while the camera is right in front of the panel) */
  glowScale = 1;

  constructor(readonly opts: PanelOptions) {
    const p = opts.def;
    this.def = p;
    this.mount = opts.mount ?? (p.wrap ? 'drum' : 'pedestal');
    this.layout = computeLayout(p, this.mount !== 'drum', this.mount === 'drum');
    const maxSize = opts.maxSize ?? (Math.max(p.w, p.h) >= 8 ? 1.45 : 1.2);
    this.unitM = Math.min(0.2, maxSize / Math.max(this.layout.W, this.layout.H));
    this.faceW = this.layout.W * this.unitM;
    this.faceH = this.layout.H * this.unitM;
    this.state = new Uint8Array(p.w * p.h);
    this.anim = new Float32Array(p.w * p.h);
    this.litColor = new THREE.Color(opts.lit);
    this.litCss = opts.lit;
    this.borderCss = '#' + this.litColor.clone().lerp(new THREE.Color('#ffffff'), 0.65).getHexString();
    this.accentCss = opts.accent;

    this.canvas = document.createElement('canvas');
    this.glowCanvas = document.createElement('canvas');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.glowTex = new THREE.CanvasTexture(this.glowCanvas);
    this.glowTex.colorSpace = THREE.SRGBColorSpace;
    this.setResolution(320);

    const faceMat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: true });
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(0.75, 0.75, 0.75),
    });
    let faceGeo: THREE.BufferGeometry;
    if (this.mount === 'drum') {
      const circumference = p.w * this.unitM * 1.0;
      const radius = circumference / (2 * Math.PI);
      const height = p.h * this.unitM + 0.3 * this.unitM * 2;
      faceGeo = new THREE.CylinderGeometry(radius, radius, height, Math.max(32, p.w * 6), 1, true);
      // flip u so the canvas reads left->right around the drum
      const uv = faceGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    } else {
      faceGeo = new THREE.PlaneGeometry(this.faceW, this.faceH);
    }
    this.face = new THREE.Mesh(faceGeo, faceMat);
    this.glow = new THREE.Mesh(faceGeo, glowMat);
    this.glow.renderOrder = 2;
    this.face.userData.panel = this;
    this.pickables.push(this.face);
    this.buildMount();
    this.redraw();
  }

  private buildMount() {
    const frameMat = this.opts.frame ?? M.stone();
    const fw = this.faceW, fh = this.faceH;
    const holder = new THREE.Group();
    this.root.add(holder);
    if (this.mount === 'pedestal' || this.mount === 'lectern') {
      const tilt = THREE.MathUtils.degToRad(this.opts.tilt ?? (this.mount === 'lectern' ? 55 : 24));
      const standH = this.opts.standHeight ?? (this.mount === 'lectern' ? 0.95 : 0.82);
      const ped = new THREE.Mesh(new RoundedBoxGeometry(Math.min(0.55, fw * 0.5), standH, 0.34, 2, 0.04), frameMat);
      ped.position.set(0, standH / 2, -0.02);
      ped.castShadow = ped.receiveShadow = true;
      holder.add(ped);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(Math.min(0.8, fw * 0.7), 0.12, 0.6, 2, 0.03), frameMat);
      foot.position.set(0, 0.06, 0);
      foot.receiveShadow = true;
      holder.add(foot);
      const tiltG = new THREE.Group();
      tiltG.position.set(0, standH, 0.02);
      tiltG.rotation.x = -tilt;
      holder.add(tiltG);
      const slab = new THREE.Mesh(new RoundedBoxGeometry(fw + 0.14, fh + 0.14, 0.12, 3, 0.035), frameMat);
      slab.position.set(0, fh / 2 + 0.05, 0);
      slab.castShadow = slab.receiveShadow = true;
      tiltG.add(slab);
      this.face.position.set(0, fh / 2 + 0.05, 0.0615);
      this.glow.position.copy(this.face.position).add(new THREE.Vector3(0, 0, 0.002));
      tiltG.add(this.face, this.glow);
      // a thin gold inlay framing the face
      const t = 0.018;
      const bars = ([
        [fw + 0.05, t, 0, fh + 0.075], [fw + 0.05, t, 0, 0.025],
        [t, fh + 0.05, -fw / 2 - 0.025, fh / 2 + 0.05], [t, fh + 0.05, fw / 2 + 0.025, fh / 2 + 0.05],
      ] as [number, number, number, number][]).map(([w, h, x, y]) => new THREE.BoxGeometry(w, h, 0.012).translate(x, y, 0.064));
      const inlay = new THREE.Mesh(mergeGeometries(bars)!, M.gold());
      tiltG.add(inlay);
    } else if (this.mount === 'wall' || this.mount === 'floor') {
      const g = new THREE.Group();
      if (this.mount === 'floor') g.rotation.x = -Math.PI / 2;
      holder.add(g);
      const slab = new THREE.Mesh(new RoundedBoxGeometry(fw + 0.16, fh + 0.16, 0.1, 3, 0.03), frameMat);
      slab.position.z = -0.03;
      slab.castShadow = slab.receiveShadow = true;
      g.add(slab);
      this.face.position.set(0, 0, 0.0225);
      this.glow.position.set(0, 0, 0.0245);
      g.add(this.face, this.glow);
    } else {
      // drum: a vertical cylinder on a base; the seal is a separate disc on the base
      const p = this.def;
      const radius = (p.w * this.unitM) / (2 * Math.PI);
      const height = p.h * this.unitM + 0.6 * this.unitM;
      const baseH = 0.85;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.12, radius + 0.2, baseH, 32), frameMat);
      base.position.y = baseH / 2;
      base.castShadow = base.receiveShadow = true;
      holder.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.1, radius + 0.1, 0.1, 32), frameMat);
      cap.position.y = baseH + height + 0.05;
      cap.castShadow = true;
      holder.add(cap);
      const drumG = new THREE.Group();
      drumG.position.y = baseH + height / 2;
      drumG.name = 'drum';
      holder.add(drumG);
      drumG.add(this.face, this.glow);
      this.glow.scale.setScalar(1.002);
      // seal disc on the base, facing the viewer
      const sealCanvas = document.createElement('canvas');
      sealCanvas.width = sealCanvas.height = 128;
      const sealMesh = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      sealMesh.position.set(0, baseH * 0.62, radius + 0.17);
      sealMesh.userData.seal = true;
      sealMesh.userData.panel = this;
      holder.add(sealMesh);
      this.sealMesh = sealMesh;
      this.pickables.push(sealMesh);
    }
  }

  /** Adds a target plate showing the pattern (or only its outline). */
  addPlate(mode: 'plate' | 'outline', offset = new THREE.Vector3(-0.95, 0, 0.15), yaw = 0.35) {
    const p = this.def;
    const c = document.createElement('canvas');
    const px = 48;
    c.width = (p.w + 1) * px;
    c.height = (p.h + 1) * px;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(0, 0, c.width, c.height);
    const t = p.target ?? '';
    const isLit = (r: number, col: number) => (r >= 0 && r < p.h && col >= 0 && col < p.w ? t[r * p.w + col] === '1' : false);
    for (let r = 0; r < p.h; r++) {
      for (let col = 0; col < p.w; col++) {
        const ch = t[r * p.w + col];
        if (ch === '#') continue;
        const x = (col + 0.5) * px, y = (r + 0.5) * px;
        roundRect(ctx, x + 3, y + 3, px - 6, px - 6, 7);
        ctx.fillStyle = mode === 'plate' && ch === '1' ? this.litCss : '#2a2b33';
        ctx.fill();
      }
    }
    // outline borders
    ctx.strokeStyle = mode === 'outline' ? this.borderCss : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = mode === 'outline' ? 4 : 2;
    ctx.lineCap = 'round';
    for (let r = 0; r < p.h; r++) {
      for (let col = 0; col < p.w; col++) {
        const s = isLit(r, col);
        const x = (col + 0.5) * px, y = (r + 0.5) * px;
        const sides: [boolean, number, number, number, number][] = [
          [isLit(r - 1, col) !== s, x, y, x + px, y],
          [isLit(r + 1, col) !== s, x, y + px, x + px, y + px],
          [isLit(r, col - 1) !== s, x, y, x, y + px],
          [isLit(r, col + 1) !== s, x + px, y, x + px, y + px],
        ];
        for (const [b, x0, y0, x1, y1] of sides) {
          if (!b || !s) continue;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const w = Math.min(0.7, this.faceW * 0.6);
    const h = (w * c.height) / c.width;
    const plateG = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, h + 0.08, 0.06, 2, 0.02), this.opts.frame ?? M.stone());
    frame.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25) }));
    face.position.z = 0.031;
    plateG.add(frame, face);
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.12, 1.15, 0.12, 2, 0.02), this.opts.frame ?? M.stone());
    post.position.y = -0.6 - h / 2;
    post.castShadow = true;
    plateG.add(post);
    plateG.position.set(offset.x, 1.2 + h / 2 + offset.y, offset.z);
    plateG.rotation.y = yaw;
    plateG.rotation.x = -0.2;
    this.root.add(plateG);
    this.plate = face;
  }

  setResolution(px: number) {
    if (px === this.res) return;
    this.res = px;
    const L = this.layout;
    const w = Math.round(px);
    const h = Math.round((px * L.H) / L.W);
    this.canvas.width = w;
    this.canvas.height = h;
    this.glowCanvas.width = Math.max(16, Math.round(w / 2));
    this.glowCanvas.height = Math.max(16, Math.round(h / 2));
    // canvas textures must be re-created when the size changes
    this.tex.dispose();
    this.glowTex.dispose();
    const t = new THREE.CanvasTexture(this.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const g = new THREE.CanvasTexture(this.glowCanvas);
    g.colorSpace = THREE.SRGBColorSpace;
    this.tex = t;
    this.glowTex = g;
    if (this.face) {
      (this.face.material as THREE.MeshBasicMaterial).map = t;
      (this.glow.material as THREE.MeshBasicMaterial).map = g;
      (this.face.material as THREE.MeshBasicMaterial).needsUpdate = true;
      (this.glow.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    this.dirty = true;
  }

  get resolution() {
    return this.res;
  }

  setState(s: ArrayLike<number>, instant = false) {
    for (let i = 0; i < this.state.length; i++) {
      this.state[i] = s[i] ? 1 : 0;
      if (instant) this.anim[i] = this.state[i];
    }
    this.dirty = true;
  }

  setPowered(on: boolean) {
    if (this.powered === on) return;
    this.powered = on;
    this.dirty = true;
  }

  setSolved(on: boolean, animate = true) {
    this.solved = on;
    this.solveT = animate && on ? 1 : 0;
    this.dirty = true;
  }

  setHover(h: number) {
    if (h === this.hover) return;
    this.hover = h;
    this.dirty = true;
  }

  blink(tiles: number[], rows: number[] = [], cols: number[] = []) {
    this.blinkTiles = new Set(tiles);
    this.blinkRows = new Set(rows);
    this.blinkCols = new Set(cols);
    this.blinkT = 2.2;
    this.dirty = true;
  }

  clearBlink() {
    this.blinkT = 0;
    this.dirty = true;
  }

  /** Per-frame animation; returns true if something changed. */
  update(dt: number, time: number): boolean {
    let changed = this.dirty;
    for (let i = 0; i < this.anim.length; i++) {
      const target = this.state[i];
      const a = this.anim[i];
      if (a !== target) {
        const na = a + Math.sign(target - a) * dt * 9;
        this.anim[i] = target > a ? Math.min(target, na) : Math.max(target, na);
        changed = true;
      }
    }
    if (this.blinkT > 0) {
      this.blinkT = Math.max(0, this.blinkT - dt);
      changed = true;
    }
    if (this.solveT > 0) {
      this.solveT = Math.max(0, this.solveT - dt * 0.7);
      changed = true;
    }
    if (this.pressFlash > 0) {
      this.pressFlash = Math.max(0, this.pressFlash - dt * 3);
      changed = true;
    }
    // glow breathing (cheap, no redraw)
    const gm = this.glow.material as THREE.MeshBasicMaterial;
    const breathe = this.powered && !this.solved ? 0.72 + 0.07 * Math.sin(time * 2.2) : this.solved ? 0.95 : 0.6;
    gm.color.setScalar(breathe * this.glowScale);
    this.glow.visible = this.powered || this.solved;
    if (changed) {
      this.redraw(time);
      this.dirty = false;
    }
    return changed;
  }

  markDirty() {
    this.dirty = true;
  }

  // ───────────────────────── drawing ─────────────────────────

  redraw(time = 0) {
    const p = this.def;
    const L = this.layout;
    const c = this.canvas;
    const ctx = c.getContext('2d')!;
    const S = c.width / L.W; // px per unit
    const gctx = this.glowCanvas.getContext('2d')!;
    const GS = this.glowCanvas.width / L.W;
    const on = this.powered || this.solved;
    const blinkOn = this.blinkT > 0 && Math.floor(this.blinkT * 4) % 2 === 0;
    const geo = geometryOf(p);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, on ? '#272932' : '#1b1c21');
    bg.addColorStop(1, on ? '#1c1d24' : '#141418');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    gctx.fillStyle = '#000';
    gctx.fillRect(0, 0, this.glowCanvas.width, this.glowCanvas.height);

    // grid well
    ctx.save();
    roundRect(ctx, (L.gx - 0.14) * S, (L.gy - 0.14) * S, (p.w + 0.28) * S, (p.h + 0.28) * S, 0.2 * S);
    ctx.fillStyle = '#0d0e12';
    ctx.fill();
    ctx.strokeStyle = this.solved ? 'rgba(255,214,140,0.9)' : on ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = Math.max(1, 0.05 * S);
    ctx.stroke();
    ctx.restore();

    const lit = this.litColor;
    const tileCol = (a: number, hov: boolean) => {
      if (!on) return '#1c1d23';
      const dark = new THREE.Color('#2b2d38');
      const col = dark.lerp(lit, a);
      if (hov) col.lerp(new THREE.Color('#ffffff'), 0.12);
      return '#' + col.getHexString();
    };

    for (let r = 0; r < p.h; r++) {
      for (let col = 0; col < p.w; col++) {
        const i = r * p.w + col;
        const cell = p.cells[i];
        if (cell.hole) continue;
        const a = on ? this.anim[i] : 0;
        const x = (L.gx + col) * S, y = (L.gy + r) * S;
        const inset = 0.07 * S;
        const tw = S - inset * 2;
        const hov = this.hover === i && on;
        roundRect(ctx, x + inset, y + inset, tw, tw, 0.13 * S);
        ctx.fillStyle = tileCol(a, hov);
        ctx.fill();
        if (on && a > 0.02) {
          // inner glow
          const rg = ctx.createRadialGradient(x + S / 2, y + S / 2, 0, x + S / 2, y + S / 2, S * 0.6);
          rg.addColorStop(0, `rgba(255,255,255,${0.16 * a})`);
          rg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = rg;
          roundRect(ctx, x + inset, y + inset, tw, tw, 0.13 * S);
          ctx.fill();
          // glow layer
          const gx = (L.gx + col) * GS, gy = (L.gy + r) * GS;
          gctx.globalAlpha = a * (this.solved ? 0.95 : 0.8);
          gctx.fillStyle = this.litCss;
          roundRect(gctx, gx + 0.1 * GS, gy + 0.1 * GS, GS * 0.8, GS * 0.8, 0.15 * GS);
          gctx.fill();
          gctx.globalAlpha = 1;
          if (cell.glyph) {
            // keep glyphs crisp: no glow over them
            gctx.save();
            gctx.globalCompositeOperation = 'destination-out';
            gctx.beginPath();
            gctx.arc(gx + GS / 2, gy + GS / 2, GS * 0.36, 0, Math.PI * 2);
            gctx.fill();
            gctx.restore();
          }
        } else if (on) {
          // subtle top bevel on dark tiles
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = Math.max(1, 0.03 * S);
          ctx.beginPath();
          ctx.moveTo(x + inset + 0.1 * S, y + inset + 0.02 * S);
          ctx.lineTo(x + S - inset - 0.1 * S, y + inset + 0.02 * S);
          ctx.stroke();
        }
        if (hov) {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = Math.max(1, 0.035 * S);
          roundRect(ctx, x + inset, y + inset, tw, tw, 0.13 * S);
          ctx.stroke();
        }
        // mute hatch
        if (cell.mute) {
          ctx.save();
          roundRect(ctx, x + inset, y + inset, tw, tw, 0.13 * S);
          ctx.clip();
          ctx.strokeStyle = a > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.09)';
          ctx.lineWidth = Math.max(1, 0.04 * S);
          for (let k = -1; k < 4; k++) {
            ctx.beginPath();
            ctx.moveTo(x + k * 0.3 * S, y + S);
            ctx.lineTo(x + k * 0.3 * S + S, y);
            ctx.stroke();
          }
          ctx.restore();
        }
        // rivets for locked tiles
        if (cell.lock !== undefined && cell.glyph?.kind !== 'beacon') {
          ctx.fillStyle = a > 0.5 ? 'rgba(60,40,20,0.75)' : 'rgba(200,200,210,0.55)';
          for (const [ox, oy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
            ctx.beginPath();
            ctx.arc(x + ox * S, y + oy * S, 0.045 * S, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (on && cell.echo?.length) drawEcho(ctx, x, y, S, cell.echo, a > 0.5);
        if (cell.glyph) {
          ctx.globalAlpha = on ? 1 : 0.28;
          drawGlyph(ctx, cell.glyph, x + S / 2, y + S / 2, S * 0.92, a > 0.5);
          ctx.globalAlpha = 1;
        }
        // error blink
        if (blinkOn && this.blinkTiles.has(i)) {
          ctx.save();
          roundRect(ctx, x + inset * 0.4, y + inset * 0.4, S - inset * 0.8, S - inset * 0.8, 0.16 * S);
          ctx.strokeStyle = '#ff3b3b';
          ctx.lineWidth = Math.max(2, 0.09 * S);
          ctx.shadowColor = '#ff2020';
          ctx.shadowBlur = 0.25 * S;
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,40,40,0.22)';
          ctx.fill();
          ctx.restore();
          gctx.fillStyle = '#ff2a2a';
          roundRect(gctx, (L.gx + col) * GS, (L.gy + r) * GS, GS, GS, 0.15 * GS);
          gctx.fill();
        }
      }
    }

    // region borders (between lit and dark; outside counts as dark)
    if (on) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.borderCss;
      ctx.lineWidth = Math.max(1.5, 0.055 * S);
      ctx.shadowColor = this.litCss;
      ctx.shadowBlur = 0.12 * S;
      gctx.strokeStyle = this.borderCss;
      gctx.lineWidth = Math.max(1, 0.06 * GS);
      ctx.beginPath();
      gctx.beginPath();
      for (let r = 0; r < p.h; r++) {
        for (let col = 0; col < p.w; col++) {
          const i = r * p.w + col;
          if (p.cells[i].hole) continue;
          const s = this.anim[i] > 0.5 ? 1 : 0;
          if (!s) continue;
          const d = geo.dir4[i];
          const x = (L.gx + col) * S, y = (L.gy + r) * S;
          const gxp = (L.gx + col) * GS, gyp = (L.gy + r) * GS;
          // N E S W
          const segs: [number, number, number, number][] = [[0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 1], [0, 0, 0, 1]];
          for (let k = 0; k < 4; k++) {
            const j = d[k];
            const ns = j < 0 ? 0 : this.anim[j] > 0.5 ? 1 : 0;
            if (ns === s) continue;
            const [a0, b0, a1, b1] = segs[k];
            ctx.moveTo(x + a0 * S, y + b0 * S);
            ctx.lineTo(x + a1 * S, y + b1 * S);
            gctx.moveTo(gxp + a0 * GS, gyp + b0 * GS);
            gctx.lineTo(gxp + a1 * GS, gyp + b1 * GS);
          }
        }
      }
      ctx.stroke();
      gctx.stroke();
      ctx.restore();
    }

    // mirror axis
    if (p.mirror && on) {
      ctx.save();
      ctx.setLineDash([0.12 * S, 0.1 * S]);
      ctx.strokeStyle = 'rgba(200,220,255,0.6)';
      ctx.lineWidth = Math.max(1, 0.035 * S);
      ctx.beginPath();
      if (p.mirror === 'v' || p.mirror === 'rot') {
        ctx.moveTo((L.gx + p.w / 2) * S, (L.gy - 0.25) * S);
        ctx.lineTo((L.gx + p.w / 2) * S, (L.gy + p.h + 0.25) * S);
      }
      if (p.mirror === 'h' || p.mirror === 'rot') {
        ctx.moveTo((L.gx - 0.25) * S, (L.gy + p.h / 2) * S);
        ctx.lineTo((L.gx + p.w + 0.25) * S, (L.gy + p.h / 2) * S);
      }
      ctx.stroke();
      ctx.restore();
    }

    // weave clues: threads of beads
    const drawClue = (clue: WeaveClue | null | undefined, horizontal: boolean, index: number, bad: boolean) => {
      if (!clue) return;
      ctx.save();
      const ink = bad ? '#ff4a4a' : on ? '#f1e8d2' : 'rgba(241,232,210,0.3)';
      const thread = bad ? '#ff4a4a' : on ? this.accentCss : 'rgba(150,140,120,0.3)';
      const beadR = 0.105 * S;
      if (clue.length === 0) {
        const cx = horizontal ? (L.rowClueRight - 0.2) * S : (L.gx + index + 0.5) * S;
        const cy = horizontal ? (L.gy + index + 0.5) * S : (L.colClueBottom - 0.2) * S;
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1, 0.04 * S);
        ctx.beginPath();
        ctx.arc(cx, cy, beadR * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      // lay out from the grid outward (last run nearest to the grid)
      let pos = horizontal ? L.rowClueRight : L.colClueBottom;
      for (let k = clue.length - 1; k >= 0; k--) {
        const run = clue[k];
        const len = run * BEAD;
        const start = pos - len;
        const mid = horizontal ? (L.gy + index + 0.5) * S : (L.gx + index + 0.5) * S;
        // thread
        ctx.strokeStyle = thread;
        ctx.lineWidth = Math.max(1, 0.05 * S);
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo((start + BEAD * 0.5) * S, mid);
          ctx.lineTo((pos - BEAD * 0.5) * S, mid);
        } else {
          ctx.moveTo(mid, (start + BEAD * 0.5) * S);
          ctx.lineTo(mid, (pos - BEAD * 0.5) * S);
        }
        ctx.stroke();
        for (let b = 0; b < run; b++) {
          const t = start + BEAD * (b + 0.5);
          ctx.beginPath();
          if (horizontal) ctx.arc(t * S, mid, beadR, 0, Math.PI * 2);
          else ctx.arc(mid, t * S, beadR, 0, Math.PI * 2);
          ctx.fillStyle = ink;
          ctx.fill();
        }
        pos = start - RUN_GAP;
      }
      ctx.restore();
    };
    const badRowBlink = blinkOn ? this.blinkRows : new Set<number>();
    const badColBlink = blinkOn ? this.blinkCols : new Set<number>();
    p.rowClues?.forEach((cl, r) => drawClue(cl, true, r, badRowBlink.has(r)));
    p.colClues?.forEach((cl, cc) => drawClue(cl, false, cc, badColBlink.has(cc)));

    // the seal
    if (L.hasSeal) {
      const sx = L.sealX * S, sy = L.sealY * S, sr = L.sealR * S;
      ctx.save();
      const hov = this.hover === -2 && this.powered && !this.solved;
      const g = ctx.createRadialGradient(sx, sy - sr * 0.3, sr * 0.1, sx, sy, sr);
      g.addColorStop(0, this.solved ? '#fff2c8' : on ? '#3a3d4a' : '#202127');
      g.addColorStop(1, this.solved ? '#d9a441' : on ? '#23252e' : '#17181c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, 0.06 * S);
      ctx.strokeStyle = this.solved ? '#fff1c2' : hov ? '#ffffff' : on ? this.borderCss : 'rgba(255,255,255,0.08)';
      if (on && !this.solved) {
        ctx.shadowColor = this.litCss;
        ctx.shadowBlur = (hov ? 0.4 : 0.22) * S;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // emblem: ring + dot
      ctx.strokeStyle = this.solved ? '#7a4f12' : on ? this.borderCss : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = Math.max(1, 0.04 * S);
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 0.16, 0, Math.PI * 2);
      ctx.fill();
      if (this.pressFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 * this.pressFlash})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (on) {
        gctx.globalAlpha = this.solved ? 0.9 : hov ? 0.7 : 0.35;
        gctx.fillStyle = this.solved ? '#ffcf70' : this.litCss;
        gctx.beginPath();
        gctx.arc(L.sealX * GS, L.sealY * GS, L.sealR * GS * 1.05, 0, Math.PI * 2);
        gctx.fill();
        gctx.globalAlpha = 1;
      }
    }

    // solve sweep
    if (this.solveT > 0) {
      const t = 1 - this.solveT;
      const x = (t * 1.6 - 0.3) * c.width;
      const sweep = ctx.createLinearGradient(x - c.width * 0.25, 0, x + c.width * 0.25, 0);
      sweep.addColorStop(0, 'rgba(255,240,200,0)');
      sweep.addColorStop(0.5, `rgba(255,240,200,${0.45 * this.solveT})`);
      sweep.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    this.tex.needsUpdate = true;
    this.glowTex.needsUpdate = true;
    if (this.sealMesh) {
      (this.sealMesh.material as THREE.MeshBasicMaterial).color.set(this.solved ? '#ffd27a' : this.powered ? this.litCss : '#2a2a30');
    }
  }

  // ───────────────────────── picking ─────────────────────────

  hitTest(hit: THREE.Intersection): Hit | null {
    if (hit.object.userData.seal) return { kind: 'seal' };
    if (hit.object !== this.face || !hit.uv) return null;
    const L = this.layout;
    const p = this.def;
    let ux: number, uy: number;
    if (this.mount === 'drum') {
      // u wraps around the drum; v spans the height incl. a small margin
      const totalH = p.h + 0.6;
      ux = hit.uv.x * p.w;
      uy = (1 - hit.uv.y) * totalH - 0.3;
      const col = Math.floor(ux), row = Math.floor(uy);
      if (row < 0 || row >= p.h) return null;
      const i = row * p.w + ((col % p.w) + p.w) % p.w;
      return p.cells[i].hole ? null : { kind: 'tile', index: i };
    }
    ux = hit.uv.x * L.W;
    uy = (1 - hit.uv.y) * L.H;
    if (L.hasSeal && Math.hypot(ux - L.sealX, uy - L.sealY) < L.sealR * 1.15) return { kind: 'seal' };
    const col = Math.floor(ux - L.gx), row = Math.floor(uy - L.gy);
    if (col < 0 || row < 0 || col >= p.w || row >= p.h) return null;
    const i = row * p.w + col;
    return p.cells[i].hole ? null : { kind: 'tile', index: i };
  }

  /** Updates world centre/normal of the face. */
  updateWorld() {
    this.face.updateWorldMatrix(true, false);
    this.face.getWorldPosition(this.center);
    if (this.mount === 'drum') {
      // the "face" of a drum is its front, toward the root's +z
      const q = new THREE.Quaternion();
      this.root.getWorldQuaternion(q);
      this.normal.set(0, 0, 1).applyQuaternion(q);
      const radius = (this.def.w * this.unitM) / (2 * Math.PI);
      this.center.addScaledVector(this.normal, radius);
    } else {
      const q = new THREE.Quaternion();
      this.face.getWorldQuaternion(q);
      this.normal.set(0, 0, 1).applyQuaternion(q);
    }
  }

  /** Camera position/target that frames the face nicely. */
  engageView(cam: THREE.PerspectiveCamera): { pos: THREE.Vector3; target: THREE.Vector3 } {
    this.updateWorld();
    const vfov = THREE.MathUtils.degToRad(cam.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    const w = this.mount === 'drum' ? (this.def.w * this.unitM) / Math.PI : this.faceW;
    const h = this.mount === 'drum' ? this.def.h * this.unitM + 0.45 : this.faceH;
    const dist = Math.max((h / 2) / Math.tan(vfov / 2), (w / 2) / Math.tan(hfov / 2)) * 1.18 + 0.05;
    const target = this.center.clone();
    if (this.mount === 'drum') target.y -= 0.12;
    const pos = target.clone().addScaledVector(this.normal, dist);
    return { pos, target };
  }

  dispose() {
    this.tex.dispose();
    this.glowTex.dispose();
  }
}
