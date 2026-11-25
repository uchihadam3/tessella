/** Music director: theme players, crossfades, lookahead scheduling. */
import type { MusicCue } from '../api';
import type { Core, ReverbMode } from './core';
import { BufferBank, Channel, type BufInst, type BufNoteOpts, type ChannelOpts, oscStack, playBuf, type StackOpts } from './synth';
import { report } from './util';

export interface Progress {
  totems: number;
  citadelDone: boolean;
  echoOpen: boolean;
  finale: boolean;
}

export interface BarCtx {
  t: number;
  spb: number;
  beats: number;
  bar: number;
  p: Player;
}

export abstract class Theme {
  abstract readonly bpm: number;
  readonly beats: number = 4;
  readonly reverb: ReverbMode = 'hall';
  /** buffer instruments to pre-render [inst, lo, hi] */
  readonly warm: [BufInst, number, number][] = [];
  /** if set, the theme ends after this many bars */
  readonly length: number | undefined = undefined;
  /** overall loudness trim (linear) applied to every channel of the theme */
  readonly level: number = 1;
  abstract setup(p: Player): void;
  abstract compose(b: BarCtx): void;
  /** release any extra nodes created in setup */
  dispose(): void {}
}

export class Player {
  readonly out: GainNode;
  readonly wetOut: GainNode;
  readonly channels = new Map<string, Channel>();
  bar = 0;
  private nextBar = 0;
  private started = false;
  stopped = false;
  private finishedAt = Infinity;
  readonly spb: number;

  constructor(
    readonly core: Core,
    readonly bank: BufferBank,
    readonly theme: Theme,
    readonly director: Director,
  ) {
    const ctx = core.ctx;
    this.out = ctx.createGain();
    this.wetOut = ctx.createGain();
    this.out.gain.value = 0;
    this.wetOut.gain.value = 0;
    this.out.connect(core.musicDry);
    this.wetOut.connect(core.musicWet);
    this.spb = 60 / theme.bpm;
  }

  get progress(): Progress {
    return this.director.progress;
  }

  ch(name: string, o: ChannelOpts = {}): Channel {
    let c = this.channels.get(name);
    if (!c) {
      c = new Channel(this.core, this.out, this.wetOut, { ...o, gain: (o.gain ?? 1) * this.theme.level });
      this.channels.set(name, c);
    }
    return c;
  }

  start(at: number, fade: number): void {
    for (const [inst, lo, hi] of this.theme.warm) this.bank.warm(inst, lo, hi, 2);
    try {
      this.theme.setup(this);
    } catch (e) {
      report('theme setup', e);
    }
    const t = this.core.now;
    for (const g of [this.out.gain, this.wetOut.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(1, at + Math.max(0.05, fade));
    }
    this.nextBar = at;
    this.started = true;
  }

  /** Fade out. `at` = when the fade starts (defaults to now; used when a theme ends by itself). */
  stop(fade: number, at?: number): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.core.now;
    const t = Math.max(now, at ?? now);
    for (const g of [this.out.gain, this.wetOut.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(at === undefined ? g.value : 1, t);
      g.linearRampToValueAtTime(0, t + Math.max(0.05, fade));
    }
    this.finishedAt = t + Math.max(0.05, fade) + 6;
  }

  /** true when the player can be disposed */
  done(now: number): boolean {
    return this.stopped && now > this.finishedAt;
  }

  dispose(): void {
    try {
      this.theme.dispose();
    } catch (e) {
      report('theme dispose', e);
    }
    for (const c of this.channels.values()) c.dispose();
    this.channels.clear();
    try {
      this.out.disconnect();
      this.wetOut.disconnect();
    } catch {
      /* ignore */
    }
  }

  schedule(until: number): void {
    if (!this.started || this.stopped) return;
    const now = this.core.now;
    const barDur = this.spb * this.theme.beats;
    // if the tab slept, skip missed bars instead of bursting them
    if (this.nextBar < now - barDur) this.nextBar = now + 0.05;
    let guard = 0;
    while (this.nextBar < until && guard++ < 4) {
      if (this.theme.length !== undefined && this.bar >= this.theme.length) {
        this.stop(5, this.nextBar);
        this.director.onThemeEnded(this);
        return;
      }
      try {
        this.theme.compose({ t: this.nextBar, spb: this.spb, beats: this.theme.beats, bar: this.bar, p: this });
      } catch (e) {
        report('compose', e);
      }
      this.bar++;
      this.nextBar += barDur;
    }
  }

  // convenience players ------------------------------------------------
  buf(inst: BufInst, ch: string, t: number, midi: number, vel: number, dur: number, o?: BufNoteOpts): void {
    const c = this.channels.get(ch);
    if (!c || t < this.core.now - 0.01) return;
    playBuf(this.core, this.bank, inst, c.input, t, midi, vel, dur, { cat: 'music', cap: 80, ...o });
  }

  rt(preset: StackOpts, ch: string, t: number, midi: number, vel: number, dur: number): void {
    const c = this.channels.get(ch);
    if (!c || t < this.core.now - 0.01) return;
    oscStack(this.core, c, t, midi, vel, dur, preset);
  }
}

export type Cue = MusicCue | 'ending' | 'secretEnding';
export type ThemeFactory = (cue: Cue) => Theme | null;

export class Director {
  cue: Cue = 'silence';
  readonly progress: Progress = { totems: 0, citadelDone: false, echoOpen: false, finale: false };
  private players: Player[] = [];
  private current: Player | null = null;

  constructor(
    private readonly core: Core,
    private readonly bank: BufferBank,
    private readonly factory: ThemeFactory,
  ) {}

  /** cue requested while the ending was playing (applied when it finishes) */
  private deferred: { cue: MusicCue; fade: number } | null = null;

  set(cue: Cue, fade = 4): void {
    // The ending pieces are not interrupted by area cues (the game may keep reporting the area
    // the player stands in); only 'menu' / 'silence' or another ending replace them.
    const isEnding = (c: Cue) => c === 'ending' || c === 'secretEnding';
    if (isEnding(this.cue) && this.current && cue !== 'menu' && cue !== 'silence' && !isEnding(cue)) {
      this.deferred = { cue, fade };
      return;
    }
    if (cue === this.cue && (this.current || cue === 'silence')) return;
    this.deferred = null;
    this.cue = cue;
    const f = Math.max(0.05, fade);
    if (this.current) this.current.stop(f);
    this.current = null;
    if (cue === 'silence') return;
    const theme = this.factory(cue);
    if (!theme) return;
    const p = new Player(this.core, this.bank, theme, this);
    this.players.push(p);
    this.current = p;
    this.core.setReverbMode(theme.reverb, f);
    // start on the next "beat" after a short delay, overlapping the outgoing fade
    p.start(this.core.now + 0.12, f * 0.8);
  }

  onThemeEnded(p: Player): void {
    if (p === this.current) {
      this.current = null;
      this.cue = 'silence';
      const d = this.deferred;
      this.deferred = null;
      if (d) this.set(d.cue, Math.max(4, d.fade));
    }
  }

  tick(lookahead: number): void {
    const now = this.core.now;
    for (const p of this.players) p.schedule(now + lookahead);
    // dispose finished players
    const keep: Player[] = [];
    for (const p of this.players) {
      if (p.done(now)) p.dispose();
      else keep.push(p);
    }
    this.players = keep;
  }

  get activePlayer(): Player | null {
    return this.current;
  }
}
