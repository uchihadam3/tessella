/** Ambience layers (continuous beds + scheduled events) and positional loop sources. */
import type { AmbienceLayer, SpatialHandle } from '../api';
import type { Core } from './core';
import type { BufferBank } from './synth';
import { playBuf, waterDrop } from './synth';
import { note, Scale, MODES } from './theory';
import { chance, clamp, disconnectAll, pick, rand, report } from './util';

interface Bed {
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  /** per-tick modulation */
  mod?: (now: number) => void;
}

class Layer {
  target = 0;
  readonly gain: GainNode;
  private bed: Bed | null = null;
  private silentSince = 0;
  nextEvent = 0;

  constructor(
    readonly name: AmbienceLayer,
    private readonly core: Core,
    private readonly build: ((dest: AudioNode, t: number) => Bed) | null,
    readonly event: ((now: number, level: number) => number) | null,
  ) {
    this.gain = core.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(core.ambDry);
  }

  set(level: number, now: number): void {
    const v = clamp(level, 0, 1);
    if (Math.abs(v - this.target) < 0.005) return;
    this.target = v;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(v, now, 1.3);
    if (v > 0.001 && !this.bed && this.build) {
      try {
        this.bed = this.build(this.gain, now);
      } catch (e) {
        report(`ambience ${this.name}`, e);
      }
    }
    if (v > 0.001) this.silentSince = 0;
  }

  tick(now: number): void {
    if (this.target <= 0.001) {
      if (!this.silentSince) this.silentSince = now;
      if (this.bed && now - this.silentSince > 9) this.stopBed();
    }
    if (this.bed?.mod && this.target > 0.001) this.bed.mod(now);
    if (this.event && this.target > 0.02 && now >= this.nextEvent) {
      try {
        const wait = this.event(now + 0.05, this.target);
        this.nextEvent = now + Math.max(0.05, wait);
      } catch (e) {
        report(`ambience event ${this.name}`, e);
        this.nextEvent = now + 5;
      }
    }
  }

  private stopBed(): void {
    if (!this.bed) return;
    for (const s of this.bed.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    disconnectAll(this.bed.nodes);
    this.bed = null;
  }
}

export class Ambience {
  private readonly layers = new Map<AmbienceLayer, Layer>();
  private readonly wetSend: GainNode;
  private readonly chimeScale = new Scale(note('D6'), MODES.majorPent);

  constructor(
    private readonly core: Core,
    private readonly bank: BufferBank,
  ) {
    this.wetSend = core.ctx.createGain();
    this.wetSend.gain.value = 1;
    this.wetSend.connect(core.ambWet);
    const L = (name: AmbienceLayer, build: ((d: AudioNode, t: number) => Bed) | null, ev: ((now: number, level: number) => number) | null) => {
      const layer = new Layer(name, core, build, ev);
      this.layers.set(name, layer);
    };
    L('wind', (d, t) => this.wind(d, t), null);
    L('sea', (d, t) => this.sea(d, t), null);
    L('stream', (d, t) => this.stream(d, t), (now, lv) => this.bubble(now, lv));
    L('leaves', (d, t) => this.leaves(d, t), null);
    L('insects', (d, t) => this.insects(d, t), null);
    L('cave', (d, t) => this.caveBed(d, t), (now, lv) => this.drip(now, lv));
    L('birds', null, (now, lv) => this.bird(now, lv));
    L('gulls', null, (now, lv) => this.gull(now, lv));
    L('night', null, (now, lv) => this.cricket(now, lv));
    L('chimes', null, (now, lv) => this.chime(now, lv));
    bank.warm('glass', 84, 100);
  }

  setLevels(levels: Partial<Record<AmbienceLayer, number>>): void {
    const now = this.core.now;
    for (const [name, layer] of this.layers) layer.set(levels[name] ?? 0, now);
  }

  tick(): void {
    const now = this.core.now;
    for (const l of this.layers.values()) l.tick(now);
  }

  private layerGain(name: AmbienceLayer): GainNode {
    return this.layers.get(name)!.gain;
  }

  // ───────────────────────────── beds ─────────────────────────────

  private filtered(dest: AudioNode, t: number, kind: 'white' | 'pink' | 'brown', type: BiquadFilterType, f: number, q: number, gain: number, pan = 0): { src: AudioBufferSourceNode; flt: BiquadFilterNode; g: GainNode; p: StereoPannerNode } {
    const ctx = this.core.ctx;
    const src = this.core.noise(kind, t);
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(flt).connect(g).connect(p).connect(dest);
    return { src, flt, g, p };
  }

  private wind(d: AudioNode, t: number): Bed {
    const a = this.filtered(d, t, 'pink', 'bandpass', 420, 0.6, 0.55, -0.5);
    const b = this.filtered(d, t, 'pink', 'bandpass', 560, 0.6, 0.5, 0.5);
    const w = this.filtered(d, t, 'white', 'bandpass', 1900, 7, 0.05, 0.2);
    let next = 0;
    return {
      nodes: [a.src, a.flt, a.g, a.p, b.src, b.flt, b.g, b.p, w.src, w.flt, w.g, w.p],
      sources: [a.src, b.src, w.src],
      mod: (now) => {
        if (now < next) return;
        next = now + rand(0.8, 2.2);
        const gust = rand(0.35, 1);
        a.flt.frequency.setTargetAtTime(rand(260, 820), now, 1.2);
        b.flt.frequency.setTargetAtTime(rand(300, 900), now, 1.4);
        a.g.gain.setTargetAtTime(0.25 + 0.5 * gust, now, 1.1);
        b.g.gain.setTargetAtTime(0.25 + 0.45 * rand(0.3, 1), now, 1.3);
        w.flt.frequency.setTargetAtTime(rand(1300, 2600), now, 1.5);
        w.g.gain.setTargetAtTime(gust > 0.8 ? 0.06 : 0.015, now, 0.9);
      },
    };
  }

  private sea(d: AudioNode, t: number): Bed {
    const body = this.filtered(d, t, 'brown', 'lowpass', 520, 0.5, 0.35, -0.15);
    const foam = this.filtered(d, t, 'white', 'highpass', 2300, 0.5, 0.0, 0.15);
    let next = 0;
    return {
      nodes: [body.src, body.flt, body.g, body.p, foam.src, foam.flt, foam.g, foam.p],
      sources: [body.src, foam.src],
      mod: (now) => {
        if (now < next) return;
        const period = rand(5.5, 9.5);
        next = now + period;
        const peak = rand(0.55, 1);
        const g = body.g.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0.35 + 0.65 * peak, now + period * 0.38);
        g.linearRampToValueAtTime(0.22, now + period * 0.98);
        const fg = foam.g.gain;
        fg.cancelScheduledValues(now);
        fg.setValueAtTime(fg.value, now);
        fg.linearRampToValueAtTime(0.0, now + period * 0.3);
        fg.linearRampToValueAtTime(0.16 * peak, now + period * 0.45);
        fg.linearRampToValueAtTime(0.0, now + period * 0.95);
        body.p.pan.setTargetAtTime(rand(-0.4, 0.4), now, 2);
      },
    };
  }

  private stream(d: AudioNode, t: number): Bed {
    const a = this.filtered(d, t, 'white', 'bandpass', 2100, 0.8, 0.22, -0.2);
    const b = this.filtered(d, t, 'white', 'bandpass', 900, 2.2, 0.25, 0.2);
    return {
      nodes: [a.src, a.flt, a.g, a.p, b.src, b.flt, b.g, b.p],
      sources: [a.src, b.src],
      mod: (now) => {
        b.flt.frequency.setTargetAtTime(rand(600, 1500), now, 0.05);
        a.g.gain.setTargetAtTime(rand(0.15, 0.28), now, 0.08);
      },
    };
  }

  private leaves(d: AudioNode, t: number): Bed {
    const a = this.filtered(d, t, 'pink', 'highpass', 1800, 0.5, 0.0, -0.3);
    const b = this.filtered(d, t, 'white', 'bandpass', 4200, 0.6, 0.0, 0.3);
    let next = 0;
    return {
      nodes: [a.src, a.flt, a.g, a.p, b.src, b.flt, b.g, b.p],
      sources: [a.src, b.src],
      mod: (now) => {
        if (now < next) return;
        next = now + rand(0.4, 2.5);
        const lv = chance(0.35) ? rand(0.3, 0.6) : rand(0.04, 0.15);
        a.g.gain.setTargetAtTime(lv * 0.6, now, rand(0.2, 0.8));
        b.g.gain.setTargetAtTime(lv * 0.25, now, rand(0.2, 0.8));
      },
    };
  }

  private insects(d: AudioNode, t: number): Bed {
    const ctx = this.core.ctx;
    const n = this.filtered(d, t, 'white', 'bandpass', 5200, 9, 0.0, 0.25);
    const am = ctx.createOscillator();
    am.type = 'square';
    am.frequency.value = 42;
    const amg = ctx.createGain();
    amg.gain.value = 0.08;
    am.connect(amg).connect(n.g.gain);
    am.start(t);
    let next = 0;
    return {
      nodes: [n.src, n.flt, n.g, n.p, am, amg],
      sources: [n.src, am],
      mod: (now) => {
        if (now < next) return;
        next = now + rand(3, 7);
        amg.gain.setTargetAtTime(rand(0.05, 0.12), now, 1.5);
        n.flt.frequency.setTargetAtTime(rand(4600, 6200), now, 2);
        am.frequency.setTargetAtTime(rand(35, 55), now, 1);
      },
    };
  }

  private caveBed(d: AudioNode, t: number): Bed {
    const r = this.filtered(d, t, 'brown', 'lowpass', 95, 0.7, 0.55, 0);
    const air = this.filtered(d, t, 'pink', 'bandpass', 300, 1.2, 0.08, 0);
    return { nodes: [r.src, r.flt, r.g, r.p, air.src, air.flt, air.g, air.p], sources: [r.src, air.src] };
  }

  // ───────────────────────────── events ─────────────────────────────

  private out(name: AmbienceLayer, pan: number, wet: number): { dest: GainNode; nodes: AudioNode[] } {
    const ctx = this.core.ctx;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(p).connect(this.layerGain(name));
    const w = ctx.createGain();
    w.gain.value = wet;
    p.connect(w).connect(this.wetSend);
    return { dest: g, nodes: [p, g, w] };
  }

  /** schedules an FM-ish chirp (frequency path) into dest */
  private chirp(dest: AudioNode, t: number, path: [number, number][], dur: number, gain: number, cleanup: AudioNode[] | null): OscillatorNode {
    const ctx = this.core.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(path[0][1], t);
    for (const [frac, f] of path.slice(1)) o.frequency.linearRampToValueAtTime(f, t + frac * dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2));
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.core.track('amb', o, [o, g, ...(cleanup ?? [])]);
    return o;
  }

  private bird(now: number, lv: number): number {
    if (this.core.voiceCount('amb') > 40) return 1;
    const { dest, nodes } = this.out('birds', rand(-0.9, 0.9), 0.35);
    const dist = rand(0.25, 1);
    const g = 0.09 * dist;
    const species = pick(['warbler', 'whistle', 'chirp', 'dove', 'trill'] as const);
    let t = now;
    let last: OscillatorNode | null = null;
    const base = rand(0.85, 1.2);
    switch (species) {
      case 'warbler': {
        const n = Math.floor(rand(5, 11));
        for (let i = 0; i < n; i++) {
          const f = rand(2800, 4800) * base;
          last = this.chirp(dest, t, [[0, f], [0.5, f * rand(1.1, 1.35)], [1, f * rand(0.8, 1)]], rand(0.04, 0.08), g, null);
          t += rand(0.06, 0.11);
        }
        break;
      }
      case 'whistle': {
        const f = rand(1800, 2600) * base;
        last = this.chirp(dest, t, [[0, f], [1, f * 1.3]], 0.35, g * 1.1, null);
        last = this.chirp(dest, t + 0.45, [[0, f * 1.25], [1, f * 0.95]], 0.4, g, null);
        break;
      }
      case 'chirp': {
        const n = Math.floor(rand(1, 4));
        for (let i = 0; i < n; i++) {
          const f = rand(3200, 5200) * base;
          last = this.chirp(dest, t, [[0, f * 0.8], [0.3, f * 1.2], [1, f]], rand(0.05, 0.09), g, null);
          t += rand(0.12, 0.25);
        }
        break;
      }
      case 'dove': {
        const f = rand(480, 620);
        const pattern = [0.3, 0.25, 0.6];
        for (const d of pattern) {
          last = this.chirp(dest, t, [[0, f * 0.95], [0.3, f], [1, f * 0.9]], d, g * 1.4, null);
          t += d + 0.12;
        }
        break;
      }
      case 'trill': {
        const f = rand(3000, 4200) * base;
        for (let i = 0; i < 14; i++) {
          last = this.chirp(dest, t, [[0, f], [1, f * 0.92]], 0.025, g * 0.8, null);
          t += 0.035;
        }
        break;
      }
    }
    if (last) {
      const prev = last.onended;
      last.onended = (e) => {
        if (prev) (prev as (ev: Event) => void)(e);
        disconnectAll(nodes);
      };
    } else disconnectAll(nodes);
    return rand(1.5, 5.5) / Math.max(0.2, lv);
  }

  private gull(now: number, lv: number): number {
    const ctx = this.core.ctx;
    const { dest, nodes } = this.out('gulls', rand(-0.8, 0.8), 0.5);
    const reps = Math.floor(rand(2, 5));
    let t = now;
    let last: OscillatorNode | null = null;
    for (let i = 0; i < reps; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = rand(1100, 1500);
      o.frequency.setValueAtTime(f0 * 0.9, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.15, t + 0.06);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.38);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1900;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.05);
      g.gain.linearRampToValueAtTime(0, t + 0.4);
      o.connect(bp).connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.45);
      this.core.track('amb', o, [o, bp, g]);
      last = o;
      t += rand(0.45, 0.7);
    }
    if (last) {
      const prev = last.onended;
      last.onended = (e) => {
        if (prev) (prev as (ev: Event) => void)(e);
        disconnectAll(nodes);
      };
    }
    return rand(5, 14) / Math.max(0.25, lv);
  }

  private cricket(now: number, lv: number): number {
    const { dest, nodes } = this.out('night', rand(-0.9, 0.9), 0.15);
    const f = rand(4100, 4700);
    let t = now;
    let last: OscillatorNode | null = null;
    const groups = Math.floor(rand(2, 5));
    for (let gI = 0; gI < groups; gI++) {
      for (let p = 0; p < 3; p++) {
        last = this.chirp(dest, t, [[0, f], [1, f * 0.98]], 0.018, 0.036, null);
        t += 0.04;
      }
      t += rand(0.25, 0.45);
    }
    if (last) {
      const prev = last.onended;
      last.onended = (e) => {
        if (prev) (prev as (ev: Event) => void)(e);
        disconnectAll(nodes);
      };
    }
    return rand(0.3, 1.2) / Math.max(0.3, lv);
  }

  private chime(now: number, lv: number): number {
    const dest = this.layerGain('chimes');
    const n = Math.floor(rand(3, 8));
    let t = now;
    for (let i = 0; i < n; i++) {
      const m = this.chimeScale.deg(Math.floor(rand(-3, 6)));
      playBuf(this.core, this.bank, 'glass', dest, t, m, rand(0.05, 0.12), 2.5, { cat: 'amb', cap: 30, release: 2 });
      t += rand(0.06, 0.35);
    }
    return rand(4, 12) / Math.max(0.25, lv);
  }

  private drip(now: number, lv: number): number {
    const { dest, nodes } = this.out('cave', rand(-0.8, 0.8), 0.8);
    waterDrop(this.core, dest, now, rand(1200, 3200), rand(0.3, 0.8));
    // release the temporary panner after the drop
    window.setTimeout(() => disconnectAll(nodes), 1500);
    return rand(0.5, 2.6) / Math.max(0.3, lv);
  }

  private bubble(now: number, lv: number): number {
    const { dest, nodes } = this.out('stream', rand(-0.5, 0.5), 0.1);
    waterDrop(this.core, dest, now, rand(500, 1100), rand(0.25, 0.6));
    window.setTimeout(() => disconnectAll(nodes), 800);
    return rand(0.15, 0.8) / Math.max(0.3, lv);
  }
}

// ═════════════════════════════════════ positional sources ═════════════════════════════════════

type SourceKind = 'waterfall' | 'windmill' | 'fountain' | 'brook' | 'surf' | 'crystal' | 'fire';

class Source implements SpatialHandle {
  readonly panner: PannerNode;
  readonly gain: GainNode;
  private gen: Bed | null = null;
  private stopped = false;
  private nextEvent = 0;
  x: number;
  y: number;
  z: number;
  private userGain = 1;

  constructor(
    private readonly sp: Spatial,
    private readonly core: Core,
    readonly kind: SourceKind,
    x: number,
    y: number,
    z: number,
    readonly radius: number,
  ) {
    const ctx = core.ctx;
    this.x = x;
    this.y = y;
    this.z = z;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'equalpower';
    this.panner.distanceModel = 'linear';
    this.panner.refDistance = Math.max(1, radius * 0.12);
    this.panner.maxDistance = Math.max(2, radius);
    this.panner.rolloffFactor = 1;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.panner).connect(core.ambDry);
    this.setPosition(x, y, z);
  }

  setPosition(x: number, y: number, z: number): void {
    if (this.stopped) return;
    this.x = x;
    this.y = y;
    this.z = z;
    const p = this.panner;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else (p as unknown as { setPosition(a: number, b: number, c: number): void }).setPosition(x, y, z);
  }

  setGain(g: number): void {
    this.userGain = clamp(g, 0, 2);
    if (this.gen) this.gain.gain.setTargetAtTime(this.userGain, this.core.now, 0.3);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.deactivate();
    window.setTimeout(() => disconnectAll([this.gain, this.panner]), 1500);
    this.sp.remove(this);
  }

  /** called with the listener distance */
  update(dist: number, now: number): void {
    if (this.stopped) return;
    if (!this.gen && dist < this.radius * 1.1) this.activate(now);
    else if (this.gen && dist > this.radius * 1.3) this.deactivate();
    if (this.gen && now >= this.nextEvent) this.nextEvent = now + this.event(now);
  }

  private activate(now: number): void {
    try {
      this.gen = this.sp.build(this.kind, this.gain, now);
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(this.userGain, now, 0.4);
    } catch (e) {
      report(`source ${this.kind}`, e);
    }
  }

  private deactivate(): void {
    const gen = this.gen;
    if (!gen) return;
    this.gen = null;
    const now = this.core.now;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(0, now, 0.25);
    window.setTimeout(() => {
      for (const s of gen.sources) {
        try {
          s.stop();
        } catch {
          /* ignore */
        }
      }
      disconnectAll(gen.nodes);
    }, 1200);
  }

  private event(now: number): number {
    if (this.gen?.mod) this.gen.mod(now);
    return this.sp.event(this.kind, this.gain, now);
  }
}

export class Spatial {
  private readonly sources = new Set<Source>();
  private lx = 0;
  private ly = 0;
  private lz = 0;
  private lastUpdate = 0;

  constructor(
    private readonly core: Core,
    private readonly bank: BufferBank,
  ) {}

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    this.lx = x;
    this.ly = y;
    this.lz = z;
    const l = this.core.ctx.listener;
    const len = Math.hypot(fx, fy, fz) || 1;
    if (l.positionX) {
      // direct assignment: cheap enough to call every frame, no automation-event build-up
      l.positionX.value = x;
      l.positionY.value = y;
      l.positionZ.value = z;
      l.forwardX.value = fx / len;
      l.forwardY.value = fy / len;
      l.forwardZ.value = fz / len;
      if (l.upY.value !== 1) {
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      }
    } else {
      const ll = l as unknown as { setPosition(a: number, b: number, c: number): void; setOrientation(a: number, b: number, c: number, d: number, e: number, f: number): void };
      ll.setPosition(x, y, z);
      ll.setOrientation(fx / len, fy / len, fz / len, 0, 1, 0);
    }
  }

  add(kind: SourceKind, x: number, y: number, z: number, radius: number): SpatialHandle {
    const s = new Source(this, this.core, kind, x, y, z, Math.max(2, radius));
    this.sources.add(s);
    return s;
  }

  remove(s: Source): void {
    this.sources.delete(s);
  }

  tick(): void {
    const now = this.core.now;
    if (now - this.lastUpdate < 0.2) return;
    this.lastUpdate = now;
    for (const s of this.sources) {
      const d = Math.hypot(s.x - this.lx, s.y - this.ly, s.z - this.lz);
      s.update(d, now);
    }
  }

  build(kind: SourceKind, dest: AudioNode, t: number): Bed {
    const ctx = this.core.ctx;
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const noise = (k: 'white' | 'pink' | 'brown', type: BiquadFilterType, f: number, q: number, g: number) => {
      const src = this.core.noise(k, t);
      const flt = ctx.createBiquadFilter();
      flt.type = type;
      flt.frequency.value = f;
      flt.Q.value = q;
      const gg = ctx.createGain();
      gg.gain.value = g;
      src.connect(flt).connect(gg).connect(dest);
      nodes.push(src, flt, gg);
      sources.push(src);
      return { src, flt, g: gg };
    };
    switch (kind) {
      case 'waterfall': {
        noise('white', 'lowpass', 3200, 0.4, 0.35);
        noise('pink', 'bandpass', 900, 0.5, 0.45);
        noise('brown', 'lowpass', 180, 0.7, 0.6);
        return { nodes, sources };
      }
      case 'brook': {
        const a = noise('white', 'bandpass', 2000, 0.9, 0.25);
        const b = noise('white', 'bandpass', 900, 2.2, 0.3);
        return {
          nodes, sources,
          mod: () => {
            b.flt.frequency.setTargetAtTime(rand(600, 1500), this.core.now, 0.05);
            a.g.gain.setTargetAtTime(rand(0.15, 0.3), this.core.now, 0.08);
          },
        };
      }
      case 'fountain': {
        noise('white', 'bandpass', 2600, 0.7, 0.3);
        noise('white', 'highpass', 5000, 0.5, 0.08);
        return { nodes, sources };
      }
      case 'surf': {
        const body = noise('brown', 'lowpass', 600, 0.5, 0.3);
        const foam = noise('white', 'highpass', 2000, 0.5, 0.02);
        return {
          nodes, sources,
          mod: (now) => {
            const p = rand(5, 8);
            body.g.gain.cancelScheduledValues(now);
            body.g.gain.setValueAtTime(body.g.gain.value, now);
            body.g.gain.linearRampToValueAtTime(rand(0.5, 0.9), now + p * 0.4);
            body.g.gain.linearRampToValueAtTime(0.2, now + p);
            foam.g.gain.cancelScheduledValues(now);
            foam.g.gain.setValueAtTime(0.02, now);
            foam.g.gain.linearRampToValueAtTime(rand(0.12, 0.2), now + p * 0.45);
            foam.g.gain.linearRampToValueAtTime(0.01, now + p);
          },
        };
      }
      case 'windmill': {
        const whoosh = noise('pink', 'bandpass', 320, 1.1, 0.0);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.75;
        const lg = ctx.createGain();
        lg.gain.value = 0.45;
        lfo.connect(lg).connect(whoosh.g.gain);
        lfo.start(t);
        nodes.push(lfo, lg);
        sources.push(lfo);
        return { nodes, sources };
      }
      case 'crystal': {
        for (const [f, det] of [[note('B3'), 0], [note('F#4'), 3], [note('D#5'), -4], [note('B5'), 2]] as [number, number][]) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 440 * Math.pow(2, (f - 69) / 12);
          o.detune.value = det;
          const g = ctx.createGain();
          g.gain.value = f > 80 ? 0.03 : 0.06;
          o.connect(g).connect(dest);
          o.start(t);
          nodes.push(o, g);
          sources.push(o);
        }
        return { nodes, sources };
      }
      case 'fire': {
        noise('pink', 'lowpass', 500, 0.6, 0.25);
        return { nodes, sources };
      }
    }
  }

  /** periodic events for a source; returns seconds to the next call */
  event(kind: SourceKind, dest: AudioNode, now: number): number {
    const ctx = this.core.ctx;
    switch (kind) {
      case 'windmill': {
        if (chance(0.7)) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(rand(80, 120), now);
          o.frequency.linearRampToValueAtTime(rand(100, 150), now + 0.35);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = rand(500, 800);
          bp.Q.value = 7;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.2, now + 0.08);
          g.gain.linearRampToValueAtTime(0, now + 0.4);
          o.connect(bp).connect(g).connect(dest);
          o.start(now);
          o.stop(now + 0.45);
          this.core.track('amb', o, [o, bp, g]);
        }
        return rand(2.5, 5);
      }
      case 'fountain': {
        for (let i = 0; i < 3; i++) waterDrop(this.core, dest, now + rand(0, 0.3), rand(700, 1600), rand(0.2, 0.5));
        return rand(0.2, 0.6);
      }
      case 'fire': {
        const n = Math.floor(rand(1, 5));
        for (let i = 0; i < n; i++) {
          const src = this.core.noise('white', now + rand(0, 0.2));
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = rand(1200, 3500);
          const g = ctx.createGain();
          const tt = now + rand(0, 0.2);
          g.gain.setValueAtTime(0, tt);
          g.gain.linearRampToValueAtTime(rand(0.02, 0.06), tt + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0005, tt + rand(0.004, 0.02));
          src.connect(hp).connect(g).connect(dest);
          src.stop(tt + 0.05);
          this.core.track('amb', src, [src, hp, g]);
        }
        return rand(0.08, 0.35);
      }
      case 'crystal': {
        if (chance(0.5)) {
          const sc = new Scale(note('B5'), MODES.lydian);
          playBuf(this.core, this.bank, 'glass', dest, now, sc.deg(Math.floor(rand(0, 9))), rand(0.06, 0.14), 2, { cat: 'amb', cap: 30 });
        }
        return rand(1.5, 4);
      }
      case 'surf':
        return rand(5, 8);
      case 'brook':
        return rand(0.06, 0.12);
      default:
        return 5;
    }
  }
}
