/**
 * Core audio graph:
 *
 *   music voices ─▶ musicDry ─▶ musicDuck ─▶ musicVol ─┐
 *               └▶ musicWet ─▶ musicDuckW ─▶ musicVolW ─┼─▶ wetSum ─▶ [hall | cave | spire] convolvers ─┐
 *   sfx voices   ─▶ sfxDry ─▶ sfxVol ────────────────────┤                                            │
 *               └▶ sfxWet ─▶ sfxVolW ───────────────────┘                                            │
 *   ambience     ─▶ ambDry ─▶ ambVol ─┐  (ambWet ─▶ ambVolW ─▶ wetSum)                                │
 *                                     ▼                                                              ▼
 *                                   master ─▶ glue compressor ─▶ limiter ─▶ destination (+ debug tap)
 *
 * Volumes apply before the reverb so the sliders scale dry and wet together.
 */
import type { Volumes } from '../api';
import { makeImpulseData, makeNoiseData } from './dsp';
import type { Renderer } from './render';
import { clamp, disconnectAll, report } from './util';

export type ReverbMode = 'hall' | 'cave' | 'spire';

interface ReverbUnit {
  mode: ReverbMode;
  send: GainNode;
  conv: ConvolverNode | null;
  connected: boolean;
  level: number;
  disconnectTimer: number | null;
}

export class Core {
  readonly ctx: BaseAudioContext;
  readonly master: GainNode;
  readonly glue: DynamicsCompressorNode;
  readonly limiter: DynamicsCompressorNode;
  readonly tap: AnalyserNode;

  readonly musicDry: GainNode;
  readonly musicWet: GainNode;
  readonly sfxDry: GainNode;
  readonly sfxWet: GainNode;
  readonly ambDry: GainNode;
  readonly ambWet: GainNode;

  private readonly musicDuck: GainNode;
  private readonly musicTone: BiquadFilterNode;
  private readonly musicDuckW: GainNode;
  private readonly musicVol: GainNode;
  private readonly musicVolW: GainNode;
  private readonly sfxVol: GainNode;
  private readonly sfxVolW: GainNode;
  private readonly ambVol: GainNode;
  private readonly ambVolW: GainNode;
  private readonly wetSum: GainNode;
  private readonly reverbOut: GainNode;
  private readonly reverbs: Record<ReverbMode, ReverbUnit>;
  reverbMode: ReverbMode = 'hall';

  /** Shared noise buffers. */
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  readonly brown: AudioBuffer;

  /** Active voice counters per category (for polyphony caps). */
  private readonly voices: Record<string, number> = {};

  /** `renderer` = async synthesis (render worker); null = synchronous (offline analysis). */
  constructor(ctx: BaseAudioContext, private readonly renderer: Renderer | null = null) {
    this.ctx = ctx;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    this.master = g(0.9);
    this.glue = ctx.createDynamicsCompressor();
    this.glue.threshold.value = -16;
    this.glue.knee.value = 12;
    this.glue.ratio.value = 2.5;
    this.glue.attack.value = 0.02;
    this.glue.release.value = 0.3;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.tap = ctx.createAnalyser();
    this.tap.fftSize = 2048;
    this.master.connect(this.glue);
    this.glue.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.limiter.connect(this.tap);

    this.musicDry = g();
    this.musicWet = g();
    this.musicDuck = g();
    this.musicDuckW = g();
    this.musicVol = g(0.8);
    this.musicVolW = g(0.8);
    this.sfxDry = g();
    this.sfxWet = g();
    this.sfxVol = g(0.9);
    this.sfxVolW = g(0.9);
    this.ambDry = g();
    this.ambWet = g();
    this.ambVol = g(0.8);
    this.ambVolW = g(0.8);
    this.wetSum = g();
    this.reverbOut = g(1);

    // gentle global "brightness" of the music that grows as the island wakes up
    this.musicTone = ctx.createBiquadFilter();
    this.musicTone.type = 'highshelf';
    this.musicTone.frequency.value = 3200;
    this.musicTone.gain.value = -2.5;
    this.musicDry.connect(this.musicDuck).connect(this.musicTone).connect(this.musicVol).connect(this.master);
    this.musicWet.connect(this.musicDuckW).connect(this.musicVolW).connect(this.wetSum);
    this.sfxDry.connect(this.sfxVol).connect(this.master);
    this.sfxWet.connect(this.sfxVolW).connect(this.wetSum);
    this.ambDry.connect(this.ambVol).connect(this.master);
    this.ambWet.connect(this.ambVolW).connect(this.wetSum);
    this.reverbOut.connect(this.master);

    // small, fast noise beds (a few ms) — needed immediately by the intro sting
    this.white = this.makeNoise('white', 1.5);
    this.pink = this.makeNoise('pink', 2.5);
    this.brown = this.makeNoise('brown', 2.5);

    const unit = (mode: ReverbMode): ReverbUnit => ({ mode, send: g(0), conv: null, connected: false, level: 0, disconnectTimer: null });
    this.reverbs = { hall: unit('hall'), cave: unit('cave'), spire: unit('spire') };
    for (const r of Object.values(this.reverbs)) this.wetSum.connect(r.send);
    this.setReverbMode('hall', 0.01);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  // ───────────────────────────── volumes / duck ─────────────────────────────

  setVolumes(v: Volumes): void {
    const t = this.now;
    const set = (p: AudioParam, x: number) => p.setTargetAtTime(clamp(x, 0, 1.5), t, 0.05);
    const shape = (x: number) => Math.pow(clamp(x, 0, 1), 1.6); // perceptual curve
    set(this.master.gain, 0.9 * shape(v.master));
    set(this.musicVol.gain, 0.8 * shape(v.music));
    set(this.musicVolW.gain, 0.8 * shape(v.music));
    set(this.sfxVol.gain, 0.9 * shape(v.sfx));
    set(this.sfxVolW.gain, 0.9 * shape(v.sfx));
    set(this.ambVol.gain, 0.8 * shape(v.ambience));
    set(this.ambVolW.gain, 0.8 * shape(v.ambience));
  }

  /** 0 = darker (start of the game) … 1 = brightest (late game). */
  setBrightness(b: number): void {
    const db = -2.5 + clamp(b, 0, 1) * 3.5;
    this.musicTone.gain.setTargetAtTime(db, this.now, 2);
  }

  duck(amount: number, seconds: number): void {
    const t = this.now;
    const low = clamp(1 - amount, 0.05, 1);
    for (const p of [this.musicDuck.gain, this.musicDuckW.gain]) {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(low, t, 0.12);
      p.setTargetAtTime(1, t + Math.max(0.2, seconds), 0.6);
    }
  }

  // ───────────────────────────── reverb ─────────────────────────────

  setReverbMode(mode: ReverbMode, fade = 3): void {
    this.reverbMode = mode;
    const t = this.now;
    const levels: Record<ReverbMode, number> = {
      hall: mode === 'hall' ? 1 : 0,
      cave: mode === 'cave' ? 1 : 0,
      spire: mode === 'spire' ? 1 : 0,
    };
    for (const r of Object.values(this.reverbs)) {
      const target = levels[r.mode];
      if (target > 0) this.ensureReverb(r);
      r.level = target;
      r.send.gain.cancelScheduledValues(t);
      r.send.gain.setTargetAtTime(target * 0.9, t, Math.max(0.01, fade / 3));
      if (r.disconnectTimer !== null) {
        clearTimeout(r.disconnectTimer);
        r.disconnectTimer = null;
      }
      if (target === 0 && r.connected) {
        // Disconnect the idle convolver once its send has faded and its tail is gone (saves CPU).
        r.disconnectTimer = window.setTimeout(() => {
          r.disconnectTimer = null;
          if (r.level === 0 && r.connected && r.conv) {
            try {
              r.send.disconnect(r.conv);
            } catch {
              /* ignore */
            }
            r.connected = false;
          }
        }, (fade + 1) * 1000);
      }
    }
  }

  private ensureReverb(r: ReverbUnit): void {
    try {
      if (!r.conv) {
        const conv = this.ctx.createConvolver();
        conv.normalize = true;
        conv.connect(this.reverbOut);
        r.conv = conv;
        const sr = this.ctx.sampleRate;
        const apply = ([L, R]: [Float32Array, Float32Array]) => {
          const buf = this.ctx.createBuffer(2, L.length, sr);
          buf.getChannelData(0).set(L);
          buf.getChannelData(1).set(R);
          conv.buffer = buf; // until now the convolver is silent (dry signal only)
        };
        if (this.renderer) this.renderer.impulse(r.mode, sr, r.mode === this.reverbMode ? 0 : 3).then(apply).catch((e) => report('impulse', e));
        else apply(makeImpulseData(r.mode, sr));
      }
      if (!r.connected) {
        r.send.connect(r.conv);
        r.connected = true;
      }
    } catch (e) {
      report('reverb', e);
    }
  }

  private makeNoise(kind: 'white' | 'pink' | 'brown', seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const n = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, n, sr);
    buf.getChannelData(0).set(makeNoiseData(kind, n, sr));
    return buf;
  }

  /** A looping noise source (caller must stop it). */
  noise(kind: 'white' | 'pink' | 'brown', t: number, offset = Math.random()): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = kind === 'white' ? this.white : kind === 'pink' ? this.pink : this.brown;
    src.loop = true;
    src.start(t, offset * (src.buffer.duration - 0.1));
    return src;
  }

  // ───────────────────────────── voices ─────────────────────────────

  /** Offline renders schedule everything up-front, so polyphony caps must be disabled there. */
  capsEnabled = true;

  voiceCount(cat: string): number {
    return this.capsEnabled ? (this.voices[cat] ?? 0) : 0;
  }

  /**
   * Registers a voice: when `ender` ends, all `nodes` are disconnected and the counter drops.
   * Returns false (and does nothing) if the category is over its cap.
   */
  track(cat: string, ender: AudioScheduledSourceNode, nodes: (AudioNode | null | undefined)[]): void {
    this.voices[cat] = (this.voices[cat] ?? 0) + 1;
    ender.onended = () => {
      this.voices[cat] = Math.max(0, (this.voices[cat] ?? 1) - 1);
      disconnectAll(nodes);
      ender.onended = null;
    };
  }

  dispose(): void {
    try {
      const c = this.ctx as AudioContext;
      if (typeof c.close === 'function') void c.close();
    } catch {
      /* ignore */
    }
  }
}
