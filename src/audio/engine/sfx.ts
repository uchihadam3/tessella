/** Sound effects: panels, world, UI, footsteps, intro stings. */
import type { AreaId } from '../../data/areas';
import type { Surface } from '../api';
import type { Core } from './core';
import { AREA_SCALES } from './themes';
import { BufferBank, Channel, CHOIR, drum, HORN, oscStack, PAD, playBuf, STRINGS, SUB, waterDrop, type BufInst } from './synth';
import { note, type Scale } from './theory';
import { chance, clamp, pick, rand } from './util';

export class Sfx {
  private readonly ui: Channel;
  private readonly panel: Channel;
  private readonly world: Channel;
  private readonly big: Channel;
  private readonly steps: Channel;
  private recentTiles: number[] = [];
  private lastHover = 0;
  private lastStep = 0;

  constructor(
    private readonly core: Core,
    private readonly bank: BufferBank,
  ) {
    const mk = (pan: number, wet: number, gain: number) => new Channel(core, core.sfxDry, core.sfxWet, { pan, wet, gain });
    this.ui = mk(0, 0.08, 0.8);
    this.panel = mk(0, 0.25, 0.8);
    this.world = mk(0, 0.35, 0.9);
    this.big = new Channel(core, core.sfxDry, core.sfxWet, { wet: 0.6, gain: 0.85, vibratoCents: 6 });
    this.steps = mk(0, 0.06, 1.5);
    // warm the most used sounds
    bank.warm('tile', 60, 96);
    bank.warm('glass', 72, 100);
    bank.warm('celesta', 72, 96);
    bank.warm('wood', 60, 90);
  }

  private get now(): number {
    return this.core.now;
  }

  private scale(area: string): Scale {
    return AREA_SCALES[area] ?? AREA_SCALES.hub;
  }

  // ───────────────────────────── primitives ─────────────────────────────

  private burst(dest: AudioNode, t: number, o: { noise?: 'white' | 'pink' | 'brown'; type?: BiquadFilterType; f: number; q?: number; a?: number; d: number; g: number; f1?: number; cat?: string }): void {
    const ctx = this.core.ctx;
    const cat = o.cat ?? 'sfx';
    if (this.core.voiceCount(cat) > 60) return;
    const src = this.core.noise(o.noise ?? 'white', t);
    const flt = ctx.createBiquadFilter();
    flt.type = o.type ?? 'bandpass';
    flt.frequency.setValueAtTime(o.f, t);
    if (o.f1) flt.frequency.exponentialRampToValueAtTime(o.f1, t + (o.a ?? 0.005) + o.d);
    flt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const a = o.a ?? 0.003;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.g, t + a);
    g.gain.exponentialRampToValueAtTime(0.0005, t + a + o.d);
    src.connect(flt).connect(g).connect(dest);
    src.stop(t + a + o.d + 0.05);
    this.core.track(cat, src, [src, flt, g]);
  }

  private tone(dest: AudioNode, t: number, o: { type?: OscillatorType; f: number; f1?: number; a?: number; d: number; g: number; lp?: number; cat?: string }): void {
    const ctx = this.core.ctx;
    const cat = o.cat ?? 'sfx';
    if (this.core.voiceCount(cat) > 60) return;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.a ?? 0.005) + o.d);
    const g = ctx.createGain();
    const a = o.a ?? 0.004;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.g, t + a);
    g.gain.exponentialRampToValueAtTime(0.0005, t + a + o.d);
    let lp: BiquadFilterNode | null = null;
    if (o.lp) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      osc.connect(lp).connect(g);
    } else osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + a + o.d + 0.05);
    this.core.track(cat, osc, [osc, g, lp]);
  }

  private buf(inst: BufInst, dest: Channel, t: number, midi: number, vel: number, dur: number, extra: { release?: number; lp?: number; cat?: string; cap?: number } = {}): void {
    playBuf(this.core, this.bank, inst, dest.input, t, midi, vel, dur, { cat: extra.cat ?? 'sfxbuf', cap: extra.cap ?? 48, release: extra.release, lp: extra.lp });
  }

  private triad(sc: Scale, octaveUp: number, degs: number[]): number[] {
    const base = sc.degreeOf(sc.tonic) + octaveUp * sc.steps.length;
    return degs.map((d) => sc.deg(base + d));
  }

  // ───────────────────────────── panels ─────────────────────────────

  tile(on: boolean, row: number, col: number, rows: number, cols: number, area: AreaId): void {
    const t = this.now + 0.004;
    this.recentTiles = this.recentTiles.filter((x) => t - x < 0.14);
    this.recentTiles.push(t);
    const crowd = this.recentTiles.length;
    const sc = this.scale(area);
    const fx = cols > 1 ? col / (cols - 1) : 0.5;
    const fy = rows > 1 ? (rows - 1 - row) / (rows - 1) : 0.5;
    const deg = Math.round(fx * 6 + fy * 4);
    const midi = sc.deg(sc.degreeOf(sc.tonic) + deg) + (on ? 12 : 0);
    let vel = on ? 0.32 : 0.2;
    if (crowd > 2) vel *= Math.sqrt(2 / crowd);
    this.buf('tile', this.panel, t, midi, vel, on ? 0.7 : 0.3, { release: on ? 0.6 : 0.25, lp: on ? undefined : 1800, cat: 'tile', cap: 14 });
    if (on && crowd <= 3) this.buf('glass', this.panel, t + 0.01, midi + 12, vel * 0.12, 0.4, { cat: 'tile', cap: 14 });
    if (!on) this.burst(this.panel.input, t, { noise: 'pink', type: 'lowpass', f: 700, d: 0.05, g: 0.05 * vel });
  }

  panelEngage(): void {
    const t = this.now;
    this.burst(this.ui.input, t, { noise: 'pink', f: 350, f1: 1500, q: 0.8, a: 0.08, d: 0.22, g: 0.08 });
    this.buf('tile', this.ui, t + 0.12, note('A6'), 0.12, 0.2);
  }

  panelLeave(): void {
    const t = this.now;
    this.burst(this.ui.input, t, { noise: 'pink', f: 1400, f1: 320, q: 0.8, a: 0.04, d: 0.2, g: 0.11 });
  }

  panelSolved(area: AreaId, bigness = 0.5): void {
    const t = this.now + 0.01;
    const b = clamp(bigness, 0, 1);
    const sc = this.scale(area);
    const degs = [0, 2, 4, 7];
    if (b > 0.35) degs.push(9);
    if (b > 0.65) degs.push(11, 14);
    const ms = this.triad(sc, 1, degs);
    const step = 0.065 - b * 0.015;
    ms.forEach((m, i) => {
      this.buf('celesta', this.panel, t + i * step, m, 0.4 - i * 0.018, 1.2, { release: 1.2 });
      if (b > 0.3) this.buf('glass', this.world, t + i * step + 0.02, m + 12, 0.18, 1.5, { release: 1.5 });
    });
    if (b > 0.45) {
      const chordMs = this.triad(sc, 0, [0, 2, 4, 6]);
      for (const m of chordMs) oscStack(this.core, this.big, t, m, 0.6 + b * 0.4, 1.2 + b * 1.5, { ...PAD(2200), attack: 0.25, release: 1.8 });
    }
    if (b > 0.75) this.buf('bell', this.big, t, sc.tonic - 12, 0.4, 3, { release: 2 });
  }

  panelFailed(): void {
    const t = this.now;
    this.tone(this.panel.input, t, { f: 78, f1: 48, d: 0.28, g: 0.32 });
    this.burst(this.panel.input, t, { noise: 'pink', type: 'lowpass', f: 320, d: 0.06, g: 0.18 });
    this.tone(this.panel.input, t + 0.02, { type: 'triangle', f: 196, d: 0.35, g: 0.035, lp: 900, a: 0.02 });
    this.tone(this.panel.input, t + 0.02, { type: 'triangle', f: 207.65, d: 0.35, g: 0.032, lp: 900, a: 0.02 });
  }

  panelPowered(): void {
    const t = this.now;
    const ctx = this.core.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.9);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.2);
    osc.connect(lp).connect(g).connect(this.world.input);
    osc.start(t);
    osc.stop(t + 1.3);
    this.core.track('sfx', osc, [osc, lp, g]);
    this.buf('glass', this.world, t + 0.85, note('D6'), 0.22, 0.8);
  }

  cable(seconds: number): void {
    const t = this.now;
    const d = clamp(seconds, 0.2, 8);
    this.burst(this.world.input, t, { noise: 'white', f: 1400, f1: 4200, q: 3, a: Math.min(0.3, d * 0.3), d: d, g: 0.035 });
    const n = Math.floor(d / 0.13);
    const sc = this.scale('hub');
    for (let i = 0; i < n; i++) {
      const m = sc.deg(sc.degreeOf(note('D6')) + Math.floor(rand(0, 7)));
      if (chance(0.6)) this.buf('glass', this.world, t + i * 0.13 + rand(0, 0.05), m, 0.08 + 0.06 * (i / n), 0.3, { cat: 'cable', cap: 10 });
    }
  }

  door(kind: 'stone' | 'wood' | 'light' | 'water'): void {
    const t = this.now;
    const w = this.world.input;
    switch (kind) {
      case 'stone': {
        this.burst(w, t, { noise: 'brown', type: 'lowpass', f: 140, a: 0.3, d: 2.4, g: 0.5 });
        for (let i = 0; i < 9; i++) this.burst(w, t + 0.15 + i * 0.22 + rand(0, 0.1), { noise: 'pink', f: rand(380, 700), q: 3, a: 0.04, d: 0.2, g: 0.06 });
        drum(this.core, w, t + 2.4, 'low', 0.6);
        drum(this.core, w, t + 2.42, 'stone', 0.4);
        break;
      }
      case 'wood': {
        const ctx = this.core.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const curve = new Float32Array(32).map((_, i) => 85 + Math.sin(i * 1.7) * 18 + rand(-8, 8));
        osc.frequency.setValueCurveAtTime(curve, t, 1.2);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 720;
        bp.Q.value = 6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.07, t + 0.15);
        g.gain.linearRampToValueAtTime(0.0, t + 1.25);
        osc.connect(bp).connect(g).connect(w);
        osc.start(t);
        osc.stop(t + 1.3);
        this.core.track('sfx', osc, [osc, bp, g]);
        this.buf('wood', this.world, t + 1.3, note('G3'), 0.5, 0.3);
        this.buf('wood', this.world, t + 1.45, note('D3'), 0.4, 0.3);
        break;
      }
      case 'light': {
        const sc = this.scale('hub');
        const ms = this.triad(sc, 1, [0, 2, 4, 7, 9, 11]);
        ms.forEach((m, i) => this.buf('glass', this.big, t + i * 0.09, m, 0.24, 2, { release: 1.5 }));
        for (const m of this.triad(sc, 0, [0, 4, 7])) oscStack(this.core, this.big, t, m, 0.6, 1.8, { ...PAD(2600), attack: 0.4, release: 2 });
        this.burst(this.big.input, t, { noise: 'white', type: 'highpass', f: 2500, f1: 7000, a: 0.4, d: 1.2, g: 0.05 });
        break;
      }
      case 'water': {
        this.burst(w, t, { noise: 'pink', type: 'lowpass', f: 2200, f1: 280, a: 0.25, d: 2.2, g: 0.25 });
        for (let i = 0; i < 12; i++) waterDrop(this.core, w, t + rand(0.1, 1.8), rand(500, 1400), rand(0.3, 0.7));
        break;
      }
    }
  }

  totem(area: AreaId): void {
    const t = this.now + 0.02;
    const sc = this.scale(area);
    const bigIn = this.big.input;
    this.core.duck(0.6, 5);
    drum(this.core, bigIn, t, 'low', 0.9);
    this.tone(bigIn, t, { f: 55, f1: 38, a: 0.01, d: 3, g: 0.35 });
    const chord = this.triad(sc, 0, [0, 2, 4, 7, 9]);
    for (const m of chord) oscStack(this.core, this.big, t + 0.1, m, 0.9, 3.4, { ...PAD(2400), attack: 1.3, release: 2.8, cat: 'sfxpad', cap: 20 });
    for (const m of chord.slice(0, 4)) oscStack(this.core, this.big, t + 0.4, m, 0.6, 3, { ...CHOIR('ah'), release: 2.5, cat: 'sfxchoir', cap: 12 });
    this.burst(bigIn, t, { noise: 'white', f: 700, f1: 6500, q: 1.2, a: 2.2, d: 1.2, g: 0.06 });
    const up = this.triad(sc, 1, [0, 2, 4, 7, 9, 11, 14, 16]);
    up.forEach((m, i) => this.buf('glass', this.big, t + 1.2 + i * 0.11, m, 0.36, 2.5, { release: 2 }));
    for (let i = 0; i < 14; i++) this.buf('celesta', this.big, t + 2.4 + rand(0, 2.2), pick(up) + 12, rand(0.08, 0.18), 1, { cat: 'spark', cap: 16 });
    oscStack(this.core, this.big, t, sc.tonic - 24, 0.8, 4, { ...SUB(), attack: 0.6, release: 2 });
  }

  greatUnlock(): void {
    const t = this.now + 0.02;
    const sc = AREA_SCALES.spire;
    const bigIn = this.big.input;
    this.core.duck(0.75, 8);
    drum(this.core, bigIn, t, 'low', 1);
    drum(this.core, bigIn, t + 2.2, 'low', 0.8);
    this.tone(bigIn, t, { f: 48, f1: 30, a: 0.02, d: 5, g: 0.38 });
    this.burst(bigIn, t, { noise: 'brown', type: 'lowpass', f: 180, a: 0.8, d: 4, g: 0.35 });
    const chord = [note('D3'), note('A3'), note('D4'), note('F#4'), note('A4'), note('E5')];
    for (const m of chord) oscStack(this.core, this.big, t + 0.6, m, 0.9, 6, { ...STRINGS(0.9), attack: 2.4, release: 3, cat: 'sfxstr', cap: 16 });
    for (const m of chord.slice(1, 5)) oscStack(this.core, this.big, t + 1.2, m, 0.8, 5.2, { ...CHOIR('ah'), attack: 1.6, release: 3, cat: 'sfxchoir', cap: 12 });
    // the leitmotif on horns: A D E F# A
    const mot = [note('A3'), note('D4'), note('E4'), note('F#4'), note('A4')];
    const beats = [0.5, 0.5, 1, 1.5, 2.5];
    let tt = t + 2.4;
    mot.forEach((m, i) => {
      const d = beats[i] * 0.55;
      oscStack(this.core, this.big, tt, m, 0.85, d * 0.98, { ...HORN(), cat: 'sfxhorn', cap: 10 });
      tt += d;
    });
    const up = this.triad(sc, 1, [0, 2, 4, 7, 9, 11, 14]);
    up.forEach((m, i) => this.buf('glass', this.big, t + 4.6 + i * 0.12, m, 0.36, 3, { release: 2.5 }));
    this.burst(bigIn, t + 3, { noise: 'white', f: 900, f1: 7000, q: 1, a: 2.5, d: 2.5, g: 0.05 });
    this.buf('bell', this.big, t + 6, note('D3'), 0.5, 5, { release: 3 });
  }

  secretSolved(): void {
    const t = this.now;
    const sc = AREA_SCALES.twins; // pentatonic sparkle
    for (let i = 0; i < 12; i++) {
      const m = sc.deg(sc.degreeOf(note('Eb5')) + i);
      this.buf('glass', this.big, t + i * 0.045, m, 0.3 - i * 0.012, 1.4, { release: 1.2 });
    }
    this.burst(this.big.input, t, { noise: 'white', type: 'highpass', f: 4000, f1: 9000, a: 0.2, d: 1.4, g: 0.04 });
    this.buf('celesta', this.big, t + 0.6, note('Bb6'), 0.25, 1.5);
  }

  // ───────────────────────────── ui ─────────────────────────────

  uiHover(): void {
    const t = this.now;
    if (t - this.lastHover < 0.045) return;
    this.lastHover = t;
    this.tone(this.ui.input, t, { f: 2300, d: 0.03, g: 0.018, cat: 'ui' });
  }

  uiClick(): void {
    const t = this.now;
    this.buf('wood', this.ui, t, note('G5'), 0.28, 0.2);
    this.buf('tile', this.ui, t + 0.005, note('D6'), 0.12, 0.2);
  }

  uiBack(): void {
    const t = this.now;
    this.buf('wood', this.ui, t, note('D5'), 0.24, 0.2);
    this.buf('tile', this.ui, t + 0.005, note('A5'), 0.08, 0.2);
  }

  achievement(): void {
    const t = this.now;
    [note('G5'), note('B5'), note('D6'), note('G6')].forEach((m, i) => this.buf('glass', this.big, t + i * 0.09, m, 0.32, 1.5, { release: 1.4 }));
    this.burst(this.big.input, t + 0.1, { noise: 'white', type: 'highpass', f: 5000, a: 0.3, d: 0.8, g: 0.025 });
  }

  save(): void {
    const t = this.now;
    this.buf('celesta', this.ui, t, note('D6'), 0.25, 0.4);
    this.buf('celesta', this.ui, t + 0.11, note('A6'), 0.22, 0.6);
  }

  // ───────────────────────────── intro ─────────────────────────────

  studioSting(): void {
    const t = this.now + 0.05;
    const ctx = this.core.ctx;
    const out = this.big.input;
    // deep boom
    this.tone(out, t, { f: 58, f1: 31, a: 0.01, d: 3.2, g: 0.45 });
    drum(this.core, out, t, 'low', 0.8);
    // warm dark-gold swell (A minor add9, low register, filter opening)
    const notes = [note('A1'), note('E2'), note('A2'), note('C3'), note('B3')];
    for (const m of notes) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      const f = 440 * Math.pow(2, (m - 69) / 12);
      osc1.frequency.value = f;
      osc2.frequency.value = f;
      osc1.detune.value = -7;
      osc2.detune.value = 7;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(140, t);
      lp.frequency.exponentialRampToValueAtTime(1300, t + 3.2);
      lp.frequency.exponentialRampToValueAtTime(300, t + 6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 2.4);
      g.gain.linearRampToValueAtTime(0.03, t + 4.2);
      g.gain.linearRampToValueAtTime(0, t + 6.2);
      osc1.connect(lp);
      osc2.connect(lp);
      lp.connect(g).connect(out);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 6.4);
      osc2.stop(t + 6.4);
      this.core.track('sting', osc1, [osc1, osc2, lp, g]);
    }
    // fire roar
    this.burst(out, t + 0.3, { noise: 'pink', type: 'lowpass', f: 500, a: 1.5, d: 4, g: 0.05 });
    // ember crackle
    for (let i = 0; i < 70; i++) {
      const tt = t + 0.4 + Math.pow(Math.random(), 1.3) * 5.2;
      this.burst(out, tt, { noise: 'white', type: 'highpass', f: rand(1500, 4500), q: 0.7, a: 0.0008, d: rand(0.002, 0.012), g: rand(0.02, 0.09), cat: 'crackle' });
    }
    // a faint metallic gleam as the gold catches light
    this.buf('glass', this.big, t + 1.6, note('E6'), 0.14, 3, { release: 2 });
    this.buf('glass', this.big, t + 1.75, note('A6'), 0.1, 3, { release: 2 });
  }

  private static TITLE = ['D4', 'A4', 'D5', 'E5', 'F#5', 'A5', 'D6', 'E6', 'A6'];

  titleTile(index: number): void {
    const i = clamp(Math.round(index), 0, 8);
    const m = note(Sfx.TITLE[i]);
    const t = this.now;
    this.buf('glass', this.big, t, m, 0.38, 3, { release: 2.5 });
    this.buf('celesta', this.panel, t + 0.005, m, 0.22, 1.5, { release: 1.5 });
    if (i % 3 === 0) this.buf('piano', this.big, t, m - 12, 0.25, 2, { release: 2 });
  }

  titleResolve(): void {
    const t = this.now;
    for (const m of [note('D3'), note('A3'), note('E4'), note('F#4'), note('C#5')]) {
      oscStack(this.core, this.big, t, m, 0.9, 4.5, { ...PAD(2000), attack: 1.6, release: 3.5, cat: 'sfxpad', cap: 20 });
    }
    for (const m of [note('A3'), note('D4'), note('F#4'), note('A4')]) oscStack(this.core, this.big, t + 0.3, m, 0.5, 4, { ...CHOIR('oo'), release: 3, cat: 'sfxchoir', cap: 12 });
    oscStack(this.core, this.big, t, note('D2'), 0.6, 4.5, { ...SUB(), attack: 1, release: 2.5 });
    this.burst(this.big.input, t, { noise: 'white', type: 'highpass', f: 3000, f1: 8000, a: 1.2, d: 1.5, g: 0.03 });
  }

  // ───────────────────────────── footsteps ─────────────────────────────

  footstep(surface: Surface, speed: number): void {
    const t = this.now;
    if (t - this.lastStep < 0.08) return;
    this.lastStep = t;
    const s = clamp(speed, 0, 1.5);
    const g = 0.6 + 0.4 * Math.min(1, s);
    const v = rand(0.85, 1.15);
    const out = this.steps.input;
    const cat = 'step';
    switch (surface) {
      case 'grass':
        this.burst(out, t, { noise: 'pink', f: 2200 * v, q: 0.7, a: 0.012, d: 0.09, g: 0.13 * g, cat });
        this.burst(out, t + 0.03, { noise: 'pink', f: 3200 * v, q: 0.9, a: 0.01, d: 0.06, g: 0.07 * g, cat });
        this.tone(out, t, { f: 85, d: 0.05, g: 0.05 * g, cat });
        break;
      case 'stone':
        this.burst(out, t, { noise: 'white', type: 'highpass', f: 2500, a: 0.001, d: 0.012, g: 0.06 * g, cat });
        this.tone(out, t, { f: 120 * v, f1: 75, d: 0.06, g: 0.12 * g, cat });
        this.burst(out, t, { noise: 'pink', f: 850 * v, q: 1.4, a: 0.002, d: 0.045, g: 0.08 * g, cat });
        break;
      case 'marble':
        this.burst(out, t, { noise: 'white', type: 'highpass', f: 3500, a: 0.001, d: 0.015, g: 0.07 * g, cat });
        this.tone(out, t, { f: 140 * v, f1: 90, d: 0.05, g: 0.1 * g, cat });
        this.burst(this.world.input, t, { noise: 'pink', f: 1200 * v, q: 1.6, a: 0.002, d: 0.05, g: 0.05 * g, cat });
        break;
      case 'sand':
        this.burst(out, t, { noise: 'pink', f: 1300 * v, q: 0.6, a: 0.025, d: 0.12, g: 0.15 * g, cat });
        this.burst(out, t + 0.04, { noise: 'white', f: 2600 * v, q: 0.8, a: 0.02, d: 0.08, g: 0.06 * g, cat });
        break;
      case 'wood':
        this.tone(out, t, { f: 150 * v, f1: 95, d: 0.09, g: 0.14 * g, cat });
        this.burst(out, t, { noise: 'pink', f: 320 * v, q: 3.5, a: 0.002, d: 0.1, g: 0.1 * g, cat });
        if (chance(0.08)) this.tone(out, t + 0.05, { type: 'sawtooth', f: 110, f1: 135, a: 0.05, d: 0.25, g: 0.012, lp: 900, cat });
        break;
      case 'gravel':
        for (let i = 0; i < 8; i++) this.burst(out, t + rand(0, 0.08), { noise: 'white', type: 'highpass', f: rand(1500, 4000), a: 0.0008, d: rand(0.003, 0.01), g: rand(0.035, 0.08) * g, cat });
        this.burst(out, t, { noise: 'pink', f: 1100 * v, q: 0.8, a: 0.01, d: 0.07, g: 0.08 * g, cat });
        break;
      case 'water':
        this.burst(out, t, { noise: 'white', f: 1500 * v, q: 0.7, a: 0.01, d: 0.16, g: 0.08 * g, cat });
        this.burst(out, t + 0.05, { noise: 'pink', type: 'lowpass', f: 600, a: 0.02, d: 0.12, g: 0.06 * g, cat });
        if (chance(0.6)) waterDrop(this.core, out, t + rand(0.03, 0.12), rand(600, 1300), 0.35 * g);
        break;
      case 'leaves':
        for (let i = 0; i < 5; i++) this.burst(out, t + rand(0, 0.07), { noise: 'white', type: 'highpass', f: rand(2500, 5000), a: 0.002, d: rand(0.01, 0.03), g: rand(0.045, 0.09) * g, cat });
        this.burst(out, t, { noise: 'pink', f: 3800 * v, q: 0.8, a: 0.01, d: 0.08, g: 0.04 * g, cat });
        break;
      case 'crystal': {
        this.tone(out, t, { f: 130 * v, f1: 85, d: 0.05, g: 0.08 * g, cat });
        const sc = AREA_SCALES.echo;
        this.buf('glass', this.world, t + 0.005, sc.deg(sc.degreeOf(note('B5')) + Math.floor(rand(0, 7))), 0.07 * g, 0.6, { cat: 'step', cap: 8 });
        break;
      }
    }
  }
}
