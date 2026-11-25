/**
 * The AudioAPI implementation. Everything before unlock() is remembered (volumes, music cue,
 * progress, ambience, listener) and applied once the AudioContext exists.
 */
import type { AreaId } from '../../data/areas';
import type { AmbienceLayer, AudioAPI, MusicCue, SpatialHandle, Surface, Volumes } from '../api';
import { Ambience, Spatial } from './ambience';
import { Core } from './core';
import { type Cue, Director, type Progress } from './music';
import { Sfx } from './sfx';
import { Renderer } from './render';
import { BufferBank } from './synth';
import { makeTheme } from './themes';
import { guard, report } from './util';

const LOOKAHEAD = 0.18;
const TICK_MS = 25;

type SourceKind = 'waterfall' | 'windmill' | 'fountain' | 'brook' | 'surf' | 'crystal' | 'fire';

/** Handle returned before unlock: remembers its state and binds to a real source later. */
class DeferredSource implements SpatialHandle {
  real: SpatialHandle | null = null;
  dead = false;
  constructor(
    public kind: SourceKind,
    public x: number,
    public y: number,
    public z: number,
    public radius: number,
    public gain = 1,
  ) {}
  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.real?.setPosition(x, y, z);
  }
  setGain(g: number): void {
    this.gain = g;
    this.real?.setGain(g);
  }
  stop(): void {
    this.dead = true;
    this.real?.stop();
  }
}

class Engine {
  core: Core | null = null;
  bank: BufferBank | null = null;
  director: Director | null = null;
  sfx: Sfx | null = null;
  amb: Ambience | null = null;
  spatial: Spatial | null = null;
  private timer: number | null = null;
  private renderer: Renderer | null = null;
  get rendererUsesWorker(): boolean {
    return !!this.renderer?.usesWorker;
  }
  private unlocking: Promise<void> | null = null;

  // remembered state
  volumes: Volumes = { master: 1, music: 0.8, sfx: 0.9, ambience: 0.8 };
  cue: { cue: Cue; fade: number } | null = null;
  progress: Progress = { totems: 0, citadelDone: false, echoOpen: false, finale: false };
  ambience: Partial<Record<AmbienceLayer, number>> = {};
  listener: [number, number, number, number, number, number] = [0, 1.6, 0, 0, 0, -1];
  pending: DeferredSource[] = [];

  get ctx(): AudioContext | null {
    return this.core ? (this.core.ctx as AudioContext) : null;
  }

  get ready(): boolean {
    return !!this.core && this.core.ctx.state === 'running';
  }

  /**
   * Fast: creates the context and the (light) graph synchronously, never waits on heavy work.
   * Instruments and impulse responses are prepared asynchronously (render worker); until a sound
   * is ready a light stand-in voice plays. ctx.resume() is never awaited for more than ~150 ms
   * (it can hang forever on machines without an audio device).
   */
  async unlock(): Promise<void> {
    if (this.core) {
      const c = this.core.ctx as AudioContext;
      if (c.state !== 'running' && c.state !== 'closed') await settle(c.resume(), 150);
      return;
    }
    if (this.unlocking) return this.unlocking;
    this.unlocking = (async () => {
      try {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC({ latencyHint: 'interactive' });
        // start resuming right away (inside the user gesture), but do not block on it
        const resuming = ctx.state !== 'running' ? ctx.resume() : Promise.resolve();
        const renderer = new Renderer();
        this.renderer = renderer;
        const core = new Core(ctx, renderer);
        this.core = core;
        const bank = new BufferBank(core, renderer);
        this.bank = bank;
        // intro-critical sounds first (studio sting gleam, title chord, first menu notes)
        bank.warm('glass', 76, 96, 1);
        bank.warm('celesta', 62, 96, 1);
        bank.warm('piano', 48, 76, 1);
        this.director = new Director(core, bank, makeTheme);
        this.sfx = new Sfx(core, bank);
        this.amb = new Ambience(core, bank);
        this.spatial = new Spatial(core, bank);
        core.setVolumes(this.volumes);
        Object.assign(this.director.progress, this.progress);
        core.setBrightness(brightnessOf(this.progress));
        this.spatial.setListener(...this.listener);
        this.amb.setLevels(this.ambience);
        for (const d of this.pending) {
          if (!d.dead) {
            d.real = this.spatial.add(d.kind, d.x, d.y, d.z, d.radius);
            d.real.setGain(d.gain);
          }
        }
        this.pending = [];
        this.timer = window.setInterval(() => this.tick(), TICK_MS);
        if (this.cue) this.director.set(this.cue.cue, this.cue.fade);
        await settle(resuming, 150);
      } catch (e) {
        report('unlock', e);
      }
    })();
    return this.unlocking;
  }

  private tick(): void {
    const core = this.core;
    if (!core) return;
    try {
      if (core.ctx.state !== 'running') return;
      this.director?.tick(LOOKAHEAD);
      this.amb?.tick();
      this.spatial?.tick();
      this.bank?.pump(4);
    } catch (e) {
      report('tick', e);
    }
  }

  setMusic(cue: Cue, fade = 4): void {
    this.cue = { cue, fade };
    this.director?.set(cue, fade);
  }
}

/** Waits for a promise at most `ms` milliseconds; never throws. */
function settle(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    p.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

const E = new Engine();

function brightnessOf(p: Progress): number {
  return Math.min(1, (p.totems ?? 0) / 8 * 0.8 + (p.citadelDone ? 0.1 : 0) + (p.echoOpen ? 0.05 : 0) + (p.finale ? 0.2 : 0));
}

const api: AudioAPI = {
  get ready() {
    return E.ready;
  },
  unlock: () => E.unlock().catch((e) => report('unlock', e)),
  setVolumes: guard('setVolumes', (v: Volumes) => {
    E.volumes = { ...v };
    E.core?.setVolumes(v);
  }),
  suspend: guard('suspend', () => {
    const c = E.ctx;
    if (c && c.state === 'running') void c.suspend().catch(() => undefined);
  }),
  resume: guard('resume', () => {
    const c = E.ctx;
    if (c && c.state !== 'running' && c.state !== 'closed') void c.resume().catch(() => undefined);
  }),

  setMusic: guard('setMusic', (cue: MusicCue, fadeSeconds?: number) => E.setMusic(cue, fadeSeconds ?? 4)),
  setProgress: guard('setProgress', (p: { totems: number; citadelDone: boolean; echoOpen: boolean; finale: boolean }) => {
    E.progress = { ...p };
    if (E.director) Object.assign(E.director.progress, p);
    E.core?.setBrightness(brightnessOf(p));
  }),
  duck: guard('duck', (amount: number, seconds: number) => E.core?.duck(amount, seconds)),

  studioSting: guard('studioSting', () => E.sfx?.studioSting()),
  titleTile: guard('titleTile', (i: number) => E.sfx?.titleTile(i)),
  titleResolve: guard('titleResolve', () => E.sfx?.titleResolve()),
  playEnding: guard('playEnding', () => E.setMusic('ending', 3)),
  playSecretEnding: guard('playSecretEnding', () => E.setMusic('secretEnding', 3)),

  tile: guard('tile', (on: boolean, row: number, col: number, rows: number, cols: number, area: AreaId) => E.sfx?.tile(on, row, col, rows, cols, area)),
  panelEngage: guard('panelEngage', () => E.sfx?.panelEngage()),
  panelLeave: guard('panelLeave', () => E.sfx?.panelLeave()),
  panelSolved: guard('panelSolved', (area: AreaId, bigness?: number) => E.sfx?.panelSolved(area, bigness)),
  panelFailed: guard('panelFailed', () => E.sfx?.panelFailed()),
  panelPowered: guard('panelPowered', () => E.sfx?.panelPowered()),
  cable: guard('cable', (seconds: number) => E.sfx?.cable(seconds)),
  door: guard('door', (kind: 'stone' | 'wood' | 'light' | 'water') => E.sfx?.door(kind)),
  totem: guard('totem', (area: AreaId) => E.sfx?.totem(area)),
  greatUnlock: guard('greatUnlock', () => E.sfx?.greatUnlock()),
  secretSolved: guard('secretSolved', () => E.sfx?.secretSolved()),

  uiHover: guard('uiHover', () => E.sfx?.uiHover()),
  uiClick: guard('uiClick', () => E.sfx?.uiClick()),
  uiBack: guard('uiBack', () => E.sfx?.uiBack()),
  achievement: guard('achievement', () => E.sfx?.achievement()),
  save: guard('save', () => E.sfx?.save()),

  footstep: guard('footstep', (surface: Surface, speed: number) => E.sfx?.footstep(surface, speed)),
  setAmbience: guard('setAmbience', (levels: Partial<Record<AmbienceLayer, number>>) => {
    E.ambience = { ...levels };
    E.amb?.setLevels(levels);
  }),
  setListener: guard('setListener', (x: number, y: number, z: number, fx: number, fy: number, fz: number) => {
    E.listener = [x, y, z, fx, fy, fz];
    E.spatial?.setListener(x, y, z, fx, fy, fz);
  }),
  addSource: (kind, x, y, z, radius) => {
    try {
      if (E.spatial) return E.spatial.add(kind, x, y, z, radius);
      const d = new DeferredSource(kind, x, y, z, radius);
      E.pending.push(d);
      return d;
    } catch (e) {
      report('addSource', e);
      return { setPosition() {}, setGain() {}, stop() {} };
    }
  },
};

export const engineApi: AudioAPI = api;

/** Debug access for the lab page and automated checks (not part of the game API). */
export function audioDebug(): { ctx: AudioContext; tap: AnalyserNode; worker: boolean; voices: () => Record<string, number> } | null {
  if (!E.core) return null;
  const core = E.core;
  return {
    ctx: core.ctx as AudioContext,
    worker: E.rendererUsesWorker,
    tap: core.tap,
    voices: () => {
      const out: Record<string, number> = {};
      for (const k of ['music', 'pad', 'strings', 'choir', 'lead', 'bass', 'rt', 'tile', 'sfx', 'sfxbuf', 'amb', 'perc', 'fx', 'step', 'horn', 'glassh', 'drone', 'lite']) out[k] = core.voiceCount(k);
      return out;
    },
  };
}

/**
 * Renders a music cue offline (faster than real time) and returns loudness statistics.
 * Used by the lab / tools/audio-levels.mjs to balance the themes.
 */
export async function analyzeCue(cue: Cue, seconds: number, progress?: Partial<Progress>): Promise<{ rms: number; peak: number; windows: number[]; load: number }> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
  const core = new Core(ctx, null);
  const bank = new BufferBank(core, null);
  bank.sync = true;
  const dir = new Director(core, bank, makeTheme);
  if (progress) Object.assign(dir.progress, progress);
  // Schedule incrementally, exactly like the real-time scheduler does (suspend every 100 ms),
  // so node density — and therefore render time — reflects real playback.
  const step = 0.1;
  for (let k = 1; (k + 1) * step < seconds; k++) {
    void ctx.suspend(k * step).then(() => {
      dir.tick(LOOKAHEAD);
      void ctx.resume();
    });
  }
  dir.set(cue, 0.05);
  dir.tick(LOOKAHEAD);
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const renderMs = performance.now() - t0;
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  let sum = 0;
  let peak = 0;
  const win = Math.floor(sr * 8);
  const windows: number[] = [];
  let wsum = 0;
  for (let i = 0; i < L.length; i++) {
    const v = (L[i] * L[i] + R[i] * R[i]) / 2;
    sum += v;
    wsum += v;
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
    if ((i + 1) % win === 0) {
      windows.push(10 * Math.log10(wsum / win + 1e-12));
      wsum = 0;
    }
  }
  return { rms: 10 * Math.log10(sum / L.length + 1e-12), peak, windows, load: renderMs / 1000 / seconds };
}
