/**
 * Instruments.
 *  - Buffer instruments are rendered once per pitch zone in JS (additive synthesis or
 *    Karplus-Strong) and replayed with a tiny playback-rate transposition. Very cheap at runtime.
 *  - Real-time instruments (pads, strings, choir, winds, horns, drones) are small oscillator graphs
 *    sharing per-channel LFOs (vibrato in cents, filter motion, tremolo).
 */
import type { Core } from './core';
import { type BufInst, type Rendered, renderZone, zoneOf, zonesIn } from './dsp';
import type { Renderer } from './render';
import { clamp, mtof, report } from './util';

// ───────────────────────────── channel strip ─────────────────────────────

export interface ChannelOpts {
  pan?: number;
  wet?: number;
  gain?: number;
  vibratoCents?: number;
  vibratoRate?: number;
  filterLfoHz?: number;
  filterLfoRate?: number;
  tremolo?: number;
  tremoloRate?: number;
}

/** A mixer channel: input → (tremolo) → pan → dry + wet sends. Holds shared LFOs. */
export class Channel {
  readonly input: GainNode;
  readonly panner: StereoPannerNode;
  readonly dry: GainNode;
  readonly wet: GainNode;
  readonly vib: GainNode | null = null;
  readonly filt: GainNode | null = null;
  private readonly lfos: OscillatorNode[] = [];
  private readonly extra: AudioNode[] = [];

  constructor(readonly core: Core, dryOut: AudioNode, wetOut: AudioNode, o: ChannelOpts = {}) {
    const ctx = core.ctx;
    this.input = ctx.createGain();
    this.input.gain.value = o.gain ?? 1;
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = clamp(o.pan ?? 0, -1, 1);
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = o.wet ?? 0.3;
    this.input.connect(this.panner);
    this.panner.connect(this.dry).connect(dryOut);
    this.panner.connect(this.wet).connect(wetOut);
    const t = ctx.currentTime;
    if (o.vibratoCents) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vibratoRate ?? 5.2;
      const g = ctx.createGain();
      g.gain.value = o.vibratoCents;
      lfo.connect(g);
      lfo.start(t);
      this.lfos.push(lfo);
      this.extra.push(g);
      (this as { vib: GainNode | null }).vib = g;
    }
    if (o.filterLfoHz) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.filterLfoRate ?? 0.07;
      const g = ctx.createGain();
      g.gain.value = o.filterLfoHz;
      lfo.connect(g);
      lfo.start(t);
      this.lfos.push(lfo);
      this.extra.push(g);
      (this as { filt: GainNode | null }).filt = g;
    }
    if (o.tremolo) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.tremoloRate ?? 4;
      const g = ctx.createGain();
      g.gain.value = o.tremolo;
      lfo.connect(g).connect(this.input.gain);
      lfo.start(t);
      this.lfos.push(lfo);
      this.extra.push(g);
    }
  }

  setPan(p: number, t: number): void {
    this.panner.pan.setTargetAtTime(clamp(p, -1, 1), t, 0.2);
  }

  dispose(): void {
    for (const l of this.lfos) {
      try {
        l.stop();
      } catch {
        /* ignore */
      }
    }
    for (const n of [...this.lfos, ...this.extra, this.input, this.panner, this.dry, this.wet]) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}

// ───────────────────────────── periodic waves ─────────────────────────────

const waveCache = new WeakMap<BaseAudioContext, Record<string, PeriodicWave>>();
export type WaveName = 'warm' | 'softsaw' | 'reed' | 'nasal' | 'glottal' | 'organ' | 'hollow';

export function wave(ctx: BaseAudioContext, name: WaveName): PeriodicWave {
  let set = waveCache.get(ctx);
  if (!set) {
    set = {};
    waveCache.set(ctx, set);
  }
  if (set[name]) return set[name];
  const N = 40;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    let a = 0;
    switch (name) {
      case 'warm':
        a = 1 / (n * n) + (n === 2 ? 0.15 : 0);
        break;
      case 'softsaw':
        a = (1 / n) * Math.exp(-n / 14);
        break;
      case 'reed':
        a = (n % 2 ? 1 : 0.55) / Math.pow(n, 0.95) * Math.exp(-n / 22);
        break;
      case 'nasal':
        a = n === 1 ? 0.5 : n <= 5 ? 0.9 / n * 2.2 : 0.8 / (n * n) * 6;
        break;
      case 'glottal':
        a = 1 / Math.pow(n, 1.9);
        break;
      case 'organ':
        a = [0, 1, 0.5, 0.3, 0.25, 0, 0.12, 0, 0.1][n] ?? 0;
        break;
      case 'hollow':
        a = n % 2 ? 1 / (n * n) : 0;
        break;
    }
    imag[n] = a;
  }
  set[name] = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  return set[name];
}

// ───────────────────────────── buffer instruments ─────────────────────────────

export type { BufInst };

/**
 * Pitch-zone buffers. Rendering is asynchronous (render worker / idle slices); until a zone is
 * ready, notes fall back to a light real-time voice so nothing is ever silent or blocking.
 */
export class BufferBank {
  private readonly cache = new Map<string, AudioBuffer>();
  private readonly pending = new Set<string>();
  /** render synchronously on demand (offline analysis only) */
  sync = false;

  constructor(
    private readonly core: Core,
    private readonly renderer: Renderer | null,
  ) {}

  private store(inst: BufInst, zone: number, r: Rendered): void {
    try {
      const buf = this.core.ctx.createBuffer(1, r.data.length, r.sr);
      buf.getChannelData(0).set(r.data);
      this.cache.set(`${inst}:${zone}`, buf);
    } catch (e) {
      report(`store ${inst}:${zone}`, e);
    }
  }

  private request(inst: BufInst, zone: number, prio: number): void {
    const key = `${inst}:${zone}`;
    if (this.cache.has(key)) return;
    if (this.pending.has(key)) {
      this.renderer?.bump(`z:${inst}:${zone}`, prio);
      return;
    }
    if (this.sync || !this.renderer) {
      try {
        this.store(inst, zone, renderZone(inst, zone));
      } catch (e) {
        report(`render ${key}`, e);
      }
      return;
    }
    this.pending.add(key);
    this.renderer
      .zone(inst, zone, prio)
      .then((r) => {
        this.pending.delete(key);
        this.store(inst, zone, r);
      })
      .catch((e) => {
        this.pending.delete(key);
        report(`render ${key}`, e);
      });
  }

  /** The buffer for a note, or null if its zone is still being prepared (requested urgently). */
  get(inst: BufInst, midi: number): { buf: AudioBuffer; rate: number } | null {
    const z = zoneOf(inst, midi);
    let buf = this.cache.get(`${inst}:${z}`);
    if (!buf) {
      this.request(inst, z, 0);
      buf = this.cache.get(`${inst}:${z}`);
      if (!buf) return null;
    }
    return { buf, rate: Math.pow(2, (midi - z) / 12) };
  }

  /** Prepare the zones covering [lo, hi] in the background (lower prio = sooner). */
  warm(inst: BufInst, lo: number, hi: number, prio = 5): void {
    for (const z of zonesIn(inst, lo, hi)) this.request(inst, z, prio);
  }

  ready(inst: BufInst, midi: number): boolean {
    return this.cache.has(`${inst}:${zoneOf(inst, midi)}`);
  }

  /** Main-thread fallback slices (only does work when no worker is available). */
  pump(budgetMs: number): void {
    this.renderer?.pump(budgetMs);
  }
}

/** Light real-time stand-in for a buffer instrument whose zone is not rendered yet. */
function liteVoice(core: Core, inst: BufInst, dest: AudioNode, t: number, midi: number, vel: number, dur: number, rel: number): void {
  if (core.voiceCount('lite') >= 24) return;
  const ctx = core.ctx;
  const f = mtof(midi);
  const plucked = inst === 'piano' || inst === 'epiano' || inst === 'harp' || inst === 'guitar' || inst === 'koto' || inst === 'oud' || inst === 'pizz' || inst === 'harpsi';
  const tau = inst === 'bell' ? 2.5 : inst === 'glass' ? 1.4 : inst === 'wood' ? 0.07 : inst === 'pizz' ? 0.2 : plucked ? clamp(1.4 - (midi - 60) * 0.02, 0.3, 1.6) : 0.7;
  const o = ctx.createOscillator();
  o.type = plucked ? 'triangle' : 'sine';
  o.frequency.value = f;
  const g = ctx.createGain();
  const peak = clamp(vel, 0, 1.4) * (plucked ? 0.42 : 0.5);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.004, tau / 2.2);
  const off = t + Math.max(0.03, dur);
  g.gain.setTargetAtTime(0, off, Math.min(rel, tau) / 4);
  const end = Math.min(t + tau * 3 + 0.05, off + rel + 0.05);
  const nodes: AudioNode[] = [o, g];
  if (plucked) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, f * 6);
    o.connect(lp).connect(g);
    nodes.push(lp);
  } else {
    o.connect(g);
    if (inst === 'bell' || inst === 'glass' || inst === 'celesta' || inst === 'kalimba') {
      const o2 = ctx.createOscillator();
      o2.frequency.value = f * (inst === 'bell' ? 2 : inst === 'glass' ? 2.756 : 4);
      const g2 = ctx.createGain();
      g2.gain.value = 0.18;
      o2.connect(g2).connect(g);
      o2.start(t);
      o2.stop(end);
      nodes.push(o2, g2);
    }
  }
  g.connect(dest);
  o.start(t);
  o.stop(end);
  core.track('lite', o, nodes);
}

export interface BufNoteOpts {
  release?: number;
  /** lowpass cutoff (Hz) — for velocity-dependent brightness */
  lp?: number;
  /** pitch bend: start this many cents off and glide to pitch in `bendTime` */
  bend?: number;
  bendTime?: number;
  /** detune in cents (humanisation) */
  cents?: number;
  cat?: string;
  /** hard cap for this category */
  cap?: number;
}

/** Plays a buffer instrument note. dur = time until note-off (release follows). */
export function playBuf(
  core: Core,
  bank: BufferBank,
  inst: BufInst,
  dest: AudioNode,
  t: number,
  midi: number,
  vel: number,
  dur: number,
  o: BufNoteOpts = {},
): void {
  const cat = o.cat ?? 'buf';
  if (core.voiceCount(cat) >= (o.cap ?? 72)) return;
  const z = bank.get(inst, midi);
  if (!z) {
    liteVoice(core, inst, dest, t, midi, vel, dur, o.release ?? 0.4);
    return;
  }
  const ctx = core.ctx;
  const src = ctx.createBufferSource();
  src.buffer = z.buf;
  const rate = z.rate * Math.pow(2, (o.cents ?? 0) / 1200);
  if (o.bend) {
    src.playbackRate.setValueAtTime(rate * Math.pow(2, o.bend / 1200), t);
    src.playbackRate.exponentialRampToValueAtTime(rate, t + (o.bendTime ?? 0.08));
  } else {
    src.playbackRate.value = rate;
  }
  const g = ctx.createGain();
  const rel = o.release ?? 0.4;
  const natural = z.buf.duration / rate;
  const off = Math.min(t + Math.max(0.02, dur), t + natural);
  g.gain.setValueAtTime(clamp(vel, 0, 1.5), t);
  g.gain.setValueAtTime(clamp(vel, 0, 1.5), off);
  g.gain.setTargetAtTime(0, off, rel / 4);
  let lpNode: BiquadFilterNode | null = null;
  if (o.lp) {
    lpNode = ctx.createBiquadFilter();
    lpNode.type = 'lowpass';
    lpNode.frequency.value = o.lp;
    lpNode.Q.value = 0.4;
    src.connect(lpNode).connect(g);
  } else {
    src.connect(g);
  }
  g.connect(dest);
  const end = Math.min(t + natural, off + rel * 1.3) + 0.02;
  src.start(t);
  src.stop(end);
  core.track(cat, src, [src, g, lpNode]);
}

// ───────────────────────────── real-time instruments ─────────────────────────────

export interface StackOpts {
  waves: (OscillatorType | WaveName)[];
  detunes?: number[];
  ratios?: number[];
  gains?: number[];
  attack: number;
  decay?: number;
  sustain?: number;
  release: number;
  peak?: number;
  /** main filter */
  type?: BiquadFilterType;
  cutoff?: number;
  q?: number;
  /** filter sweep from `cutoff*envFrom` to `cutoff` across the attack */
  envFrom?: number;
  envTime?: number;
  hp?: number;
  /** parallel formant bandpasses [freq, Q, gain] */
  formants?: [number, number, number][];
  /** breath noise amount (bandpassed at pitch) */
  breath?: number;
  /** pitch scoop in cents at onset */
  scoop?: number;
  cat?: string;
  cap?: number;
}

export function oscStack(core: Core, ch: Channel, t: number, midi: number, vel: number, dur: number, o: StackOpts): void {
  const cat = o.cat ?? 'rt';
  if (core.voiceCount(cat) >= (o.cap ?? 40)) return;
  const ctx = core.ctx;
  const f = mtof(midi);
  const attack = Math.min(o.attack, Math.max(0.005, dur * 0.85));
  const peak = clamp(vel, 0, 1.4) * (o.peak ?? 0.25);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + attack);
  if (o.decay) env.gain.setTargetAtTime(peak * (o.sustain ?? 0.7), t + attack, o.decay / 3);
  const off = t + Math.max(dur, attack + 0.01);
  env.gain.setTargetAtTime(0, off, o.release / 4);
  const stopAt = off + o.release * 1.4 + 0.05;

  const nodes: AudioNode[] = [env];
  const mix = ctx.createGain();
  nodes.push(mix);
  const oscs: OscillatorNode[] = [];
  o.waves.forEach((w, i) => {
    const osc = ctx.createOscillator();
    if (w === 'sine' || w === 'square' || w === 'sawtooth' || w === 'triangle') osc.type = w;
    else osc.setPeriodicWave(wave(ctx, w as WaveName));
    const ratio = o.ratios?.[i] ?? 1;
    if (o.scoop) {
      osc.frequency.setValueAtTime(f * ratio * Math.pow(2, -o.scoop / 1200), t);
      osc.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.09);
    } else {
      osc.frequency.value = f * ratio;
    }
    osc.detune.value = o.detunes?.[i] ?? 0;
    if (ch.vib) ch.vib.connect(osc.detune);
    let out: AudioNode = osc;
    const gv = o.gains?.[i];
    if (gv !== undefined && gv !== 1) {
      const gg = ctx.createGain();
      gg.gain.value = gv;
      osc.connect(gg);
      out = gg;
      nodes.push(gg);
    }
    out.connect(mix);
    osc.start(t);
    osc.stop(stopAt);
    oscs.push(osc);
    nodes.push(osc);
  });

  let head: AudioNode = mix;
  let filt: BiquadFilterNode | null = null;
  if (o.formants) {
    const sum = ctx.createGain();
    nodes.push(sum);
    for (const [ff, q, gain] of o.formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = q;
      const gg = ctx.createGain();
      gg.gain.value = gain * 2.2;
      mix.connect(bp).connect(gg).connect(sum);
      nodes.push(bp, gg);
    }
    head = sum;
  }
  if (o.cutoff) {
    filt = ctx.createBiquadFilter();
    filt.type = o.type ?? 'lowpass';
    filt.Q.value = o.q ?? 0.5;
    if (o.envFrom !== undefined) {
      filt.frequency.setValueAtTime(o.cutoff * o.envFrom, t);
      filt.frequency.exponentialRampToValueAtTime(o.cutoff, t + (o.envTime ?? attack));
    } else {
      filt.frequency.value = o.cutoff;
    }
    if (ch.filt) ch.filt.connect(filt.frequency);
    head.connect(filt);
    head = filt;
    nodes.push(filt);
  }
  if (o.hp) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = o.hp;
    hp.Q.value = 0.5;
    head.connect(hp);
    head = hp;
    nodes.push(hp);
  }
  head.connect(env);
  env.connect(ch.input);

  let noiseSrc: AudioBufferSourceNode | null = null;
  if (o.breath) {
    noiseSrc = core.noise('white', t);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 1.5;
    bp.Q.value = 1.6;
    const ng = ctx.createGain();
    ng.gain.value = o.breath;
    noiseSrc.connect(bp).connect(ng).connect(env);
    noiseSrc.stop(stopAt);
    nodes.push(noiseSrc, bp, ng);
  }

  const vib = ch.vib;
  const flt = ch.filt;
  core.track(cat, oscs[0], nodes);
  // detach shared LFOs from this voice when it ends (prevents leaks)
  const prev = oscs[0].onended;
  oscs[0].onended = (ev) => {
    try {
      if (vib) for (const osc of oscs) vib.disconnect(osc.detune);
      if (flt && filt) flt.disconnect(filt.frequency);
    } catch {
      /* ignore */
    }
    if (prev) (prev as (e: Event) => void)(ev);
  };
}

// presets ------------------------------------------------------------

export const PAD = (cutoff = 1400): StackOpts => ({
  waves: ['warm', 'warm', 'triangle'],
  detunes: [-7, 7, 0],
  ratios: [1, 1, 0.5],
  gains: [1, 1, 0.5],
  attack: 2.2,
  release: 3.2,
  peak: 0.11,
  cutoff,
  q: 0.4,
  cat: 'pad',
  cap: 28,
});

export const STRINGS = (bright = 1): StackOpts => ({
  waves: ['sawtooth', 'sawtooth', 'sawtooth'],
  detunes: [-9, 0, 9],
  attack: 0.9,
  release: 1.4,
  peak: 0.07,
  cutoff: 1500 + 1300 * bright,
  q: 0.4,
  hp: 140,
  cat: 'strings',
  cap: 24,
});

export const CHOIR = (vowel: 'oo' | 'ah' | 'mm' = 'oo'): StackOpts => ({
  waves: ['glottal', 'glottal'],
  detunes: [-6, 6],
  attack: 1.1,
  release: 1.8,
  peak: 0.22,
  formants:
    vowel === 'oo'
      ? [[330, 7, 1], [780, 8, 0.38], [2450, 10, 0.1]]
      : vowel === 'ah'
        ? [[720, 7, 1], [1150, 8, 0.55], [2650, 10, 0.16]]
        : [[260, 4, 1], [1500, 9, 0.08], [2500, 10, 0.04]],
  cutoff: 3200,
  q: 0.3,
  cat: 'choir',
  cap: 16,
});

export const FLUTE = (bamboo = false): StackOpts => ({
  waves: ['sine', 'triangle'],
  ratios: [1, 2],
  gains: [1, 0.07],
  attack: bamboo ? 0.06 : 0.08,
  release: 0.25,
  peak: 0.2,
  breath: bamboo ? 0.28 : 0.14,
  scoop: bamboo ? 45 : 0,
  cutoff: 5000,
  cat: 'lead',
  cap: 8,
});

export const HORN = (): StackOpts => ({
  waves: ['sawtooth', 'sawtooth'],
  detunes: [-5, 5],
  attack: 0.45,
  release: 0.9,
  peak: 0.085,
  cutoff: 1250,
  envFrom: 0.3,
  envTime: 0.6,
  q: 0.7,
  hp: 70,
  cat: 'horn',
  cap: 12,
});

export const REED = (): StackOpts => ({
  waves: ['reed', 'reed'],
  detunes: [-8, 8],
  attack: 0.04,
  release: 0.16,
  peak: 0.16,
  cutoff: 3400,
  q: 0.4,
  hp: 180,
  cat: 'lead',
  cap: 8,
});

export const OBOE = (): StackOpts => ({
  waves: ['nasal'],
  attack: 0.07,
  release: 0.22,
  peak: 0.2,
  type: 'lowpass',
  cutoff: 3000,
  q: 0.6,
  hp: 220,
  breath: 0.05,
  cat: 'lead',
  cap: 8,
});

export const SUB = (): StackOpts => ({
  waves: ['sine', 'triangle'],
  gains: [1, 0.18],
  attack: 0.04,
  release: 0.5,
  peak: 0.32,
  cutoff: 260,
  cat: 'bass',
  cap: 6,
});

export const DRONE = (cutoff = 420): StackOpts => ({
  waves: ['sawtooth', 'sawtooth', 'sine'],
  detunes: [-4, 4, 0],
  gains: [0.6, 0.6, 1],
  attack: 3.5,
  release: 4,
  peak: 0.08,
  cutoff,
  q: 0.6,
  cat: 'drone',
  cap: 8,
});

export const GLASSHARM = (): StackOpts => ({
  waves: ['sine', 'sine', 'sine'],
  ratios: [1, 2, 3],
  gains: [1, 0.18, 0.06],
  attack: 0.4,
  release: 1.8,
  peak: 0.17,
  cat: 'glassh',
  cap: 14,
});

// percussion & effects ------------------------------------------------------------

export function waterDrop(core: Core, dest: AudioNode, t: number, freq: number, vel: number): void {
  if (core.voiceCount('fx') > 40) return;
  const ctx = core.ctx;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 0.75, t);
  o.frequency.exponentialRampToValueAtTime(freq * 1.7, t + 0.035);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.2);
  core.track('fx', o, [o, g]);
}

export function drum(core: Core, dest: AudioNode, t: number, kind: 'dum' | 'tek' | 'low' | 'stone' | 'shaker', vel: number): void {
  if (core.voiceCount('perc') > 24) return;
  const ctx = core.ctx;
  const nodes: AudioNode[] = [];
  let ender: AudioScheduledSourceNode;
  const out = ctx.createGain();
  out.gain.value = vel;
  out.connect(dest);
  nodes.push(out);
  if (kind === 'dum' || kind === 'low' || kind === 'stone') {
    const f0 = kind === 'dum' ? 115 : kind === 'low' ? 62 : 90;
    const f1 = kind === 'dum' ? 68 : kind === 'low' ? 42 : 58;
    const len = kind === 'low' ? 0.9 : kind === 'stone' ? 0.3 : 0.45;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    ender = o;
    nodes.push(o, g);
    const n = core.noise('pink', t);
    const bp = ctx.createBiquadFilter();
    bp.type = kind === 'stone' ? 'bandpass' : 'lowpass';
    bp.frequency.value = kind === 'stone' ? 700 : 380;
    bp.Q.value = kind === 'stone' ? 2.5 : 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(kind === 'stone' ? 0.5 : 0.25, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'stone' ? 0.22 : 0.1));
    n.connect(bp).connect(ng).connect(out);
    n.stop(t + 0.3);
    nodes.push(n, bp, ng);
  } else {
    const n = core.noise('white', t);
    const bp = ctx.createBiquadFilter();
    bp.type = kind === 'shaker' ? 'highpass' : 'bandpass';
    bp.frequency.value = kind === 'shaker' ? 5200 : 2300;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    const len = kind === 'shaker' ? 0.07 : 0.06;
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(kind === 'shaker' ? 0.18 : 0.35, t + (kind === 'shaker' ? 0.02 : 0.002));
    ng.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(bp).connect(ng).connect(out);
    n.stop(t + len + 0.05);
    ender = n;
    nodes.push(n, bp, ng);
  }
  core.track('perc', ender, nodes);
}
