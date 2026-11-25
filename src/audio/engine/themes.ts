/**
 * The music of TESSELLA. Each cue is a small composition: a form of sections with real chord
 * progressions, voice-led accompaniment, phrased melodies and the shared leitmotif.
 * Randomness is used for variation (ornaments, rests, which instrument answers), never for harmony.
 */
import type { MusicCue } from '../api';
import { arp, Form, human, motif, Melody, type BarInfo, type MNote, type Section } from './compose';
import { type BarCtx, Player, Theme } from './music';
import type { ReverbMode } from './core';
import {
  CHOIR, DRONE, drum, FLUTE, GLASSHARM, HORN, OBOE, PAD, REED, STRINGS, SUB,
  type BufInst, type StackOpts, waterDrop,
} from './synth';
import { bassNote, type Chord, chordTones, MODES, note, pcOf, Scale, voiceLead } from './theory';
import { chance, clamp, mtof, pick, rand } from './util';

type Inst = BufInst | StackOpts;

abstract class Song extends Theme {
  protected abstract readonly sections: Section[];
  protected abstract readonly order: string[];
  protected form!: Form;
  protected vl: Record<string, number[] | null> = {};
  private secCount: Record<string, number> = {};
  /** occurrence index of the current section (0 = first time it plays) */
  protected occ = 0;
  /** velocity multiplier per section (dynamics across the form) */
  protected readonly energy: Record<string, number> = {};
  private vmul = 1;
  /** per-section scripted lines (absolute beats from section start) */
  protected lines: Record<string, { notes: MNote[]; inst: Inst; ch: string; vel: number; opts?: { release?: number } }[]> = {};

  setup(p: Player): void {
    this.form = new Form(this.sections, this.order);
    this.init(p);
  }
  protected abstract init(p: Player): void;
  protected abstract arrange(b: BarCtx, f: BarInfo): void;
  /** called at the first bar of every section (good place to build scripted lines) */
  protected onSection(_b: BarCtx, _f: BarInfo): void {}

  compose(b: BarCtx): void {
    const f = this.form.current();
    if (f.i === 0) {
      this.secCount[f.sec] = (this.secCount[f.sec] ?? 0) + 1;
      this.occ = this.secCount[f.sec] - 1;
      this.lines = {};
      this.vmul = this.energy[f.sec] ?? 1;
      this.onSection(b, f);
    }
    this.arrange(b, f);
    // scripted lines
    for (const list of Object.values(this.lines)) {
      for (const line of list) {
        const from = f.i * b.beats;
        const to = from + b.beats;
        for (const n of line.notes) {
          if (n.beat >= from && n.beat < to) this.play(b, line.inst, line.ch, n.beat - from, n.midi, n.vel * line.vel, n.dur * b.spb * 0.98, line.opts?.release);
        }
      }
    }
    this.form.advance();
  }

  protected T(b: BarCtx, beat: number, h = 0.006): number {
    return Math.max(b.p.core.now, b.t + beat * b.spb + human(h));
  }

  protected play(b: BarCtx, inst: Inst, ch: string, beat: number, midi: number, vel: number, durSec: number, release?: number): void {
    const t = this.T(b, beat);
    vel *= this.vmul;
    if (typeof inst === 'string') b.p.buf(inst, ch, t, midi, vel, durSec, release !== undefined ? { release } : undefined);
    else b.p.rt(inst, ch, t, midi, vel, durSec);
  }

  protected notes(b: BarCtx, list: MNote[], inst: Inst, ch: string, velMul = 1, legato = 0.95, release?: number): void {
    for (const n of list) this.play(b, inst, ch, n.beat, n.midi, n.vel * velMul, n.dur * b.spb * legato, release);
  }

  /** Voice-led sustained chords for the bar. */
  protected chords(b: BarCtx, f: BarInfo, key: string, inst: Inst, ch: string, lo: number, hi: number, n: number, vel: number, overlap = 0.3): void {
    const k = f.chords.length;
    const sub = b.beats / k;
    f.chords.forEach((c, i) => {
      const v = voiceLead(this.vl[key] ?? null, c, lo, hi, n);
      this.vl[key] = v;
      for (const m of v) this.play(b, inst, ch, i * sub + rand(0, 0.03), m, vel * rand(0.9, 1.05), sub * b.spb + overlap);
    });
  }

  /** chord active at a beat */
  protected chordAt(f: BarInfo, beat: number, beats: number): Chord {
    const k = f.chords.length;
    return f.chords[Math.min(k - 1, Math.floor((beat / beats) * k))];
  }

  /** A composed signature: bars of [degree, beats] → absolute-beat notes starting at `startBar`. */
  protected sig(scale: Scale, tonic: number, beats: number, bars: [number, number][][], shift = 0, vel = 0.72, startBar = 0): MNote[] {
    const out: MNote[] = [];
    bars.forEach((bar, bi) => {
      for (const n of this.barNotes(scale, tonic, bar, shift, vel)) out.push({ ...n, beat: n.beat + (startBar + bi) * beats });
    });
    return out;
  }

  /** One composed bar: [degree, beats] pairs → bar-relative notes. */
  protected barNotes(scale: Scale, tonic: number, bar: [number, number][], shift = 0, vel = 0.72): MNote[] {
    const base = scale.degreeOf(tonic);
    const out: MNote[] = [];
    let beat = 0;
    for (const [d, len] of bar) {
      out.push({ beat, dur: len, midi: scale.deg(base + d + shift), vel: vel * (beat === 0 ? 1 : 0.9) });
      beat += len;
    }
    return out;
  }

  /** Builds an absolute-beat line from motif parts placed at bars. */
  protected motifLine(scale: Scale, tonic: number, beats: number, plan: { part: 'call' | 'answer' | 'close'; bar: number; shift?: number; stretch?: number; at?: number }[]): MNote[] {
    const out: MNote[] = [];
    for (const p of plan) {
      for (const n of motif(scale, p.part, tonic, p.shift ?? 0, p.stretch ?? 1)) {
        out.push({ ...n, beat: n.beat + p.bar * beats + (p.at ?? 0) });
      }
    }
    return out;
  }
}

// ═════════════════════════════════════ MENU ═════════════════════════════════════

class MenuTheme extends Song {
  readonly bpm = 60;
  readonly level = 0.55;
  protected readonly energy: Record<string, number> = { intro: 0.85, A: 1, B: 1.08, breath: 0.8 };
  readonly warm: [BufInst, number, number][] = [['piano', 38, 86], ['glass', 76, 96]];
  private scale = new Scale(note('D4'), MODES.major);
  private mel = new Melody(this.scale, 62, 81);
  protected readonly sections: Section[] = [
    { name: 'intro', bars: ['Dmaj9', 'Dmaj9'] },
    { name: 'A', bars: ['D', 'E/D', 'Bm7', 'Gmaj7', 'D/F#', 'Em9', 'Gmaj7', ['Asus4', 'A']] },
    { name: 'B', bars: ['Gmaj7', 'A', 'F#m7', 'Bm7', 'Em7', 'A/C#', 'Dmaj7', ['Asus4', 'A']] },
    { name: 'breath', bars: ['Dmaj9', 'G/D'] },
  ];
  protected readonly order = ['intro', 'A', 'B', 'A', 'breath'];
  protected init(p: Player): void {
    p.ch('pad', { gain: 0.9, wet: 0.35, filterLfoHz: 250, filterLfoRate: 0.05 });
    p.ch('piano', { gain: 0.62, wet: 0.32, pan: -0.08 });
    p.ch('bass', { gain: 0.65, wet: 0.1 });
    p.ch('bells', { gain: 0.22, wet: 0.6, pan: 0.35 });
    p.ch('choir', { gain: 0.5, wet: 0.45, vibratoCents: 7, vibratoRate: 4.8 });
    p.ch('strings', { gain: 0.55, wet: 0.38, vibratoCents: 9, pan: 0.15 });
  }
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') {
      const up = this.occ % 2 === 1 ? 7 : 0;
      this.lines.motif = [
        {
          notes: this.motifLine(this.scale, note('D4') + (up ? 12 : 0), b.beats, [
            { part: 'call', bar: 0 }, { part: 'answer', bar: 2 }, { part: 'call', bar: 4, shift: 2 }, { part: 'close', bar: 6, shift: 0, stretch: 1 },
          ]),
          inst: 'piano', ch: 'piano', vel: 0.78, opts: { release: 0.8 },
        },
      ];
    }
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    this.chords(b, f, 'pad', PAD(1150), 'pad', 50, 72, 4, 0.9);
    if (f.sec !== 'intro') this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 38), 0.65, b.beats * b.spb + 0.4);
    if (f.sec === 'B') {
      // left-hand broken chords on the piano + choir
      const tones = arp(f.chord, 50, 67, 'broken', 8);
      tones.forEach((m, i) => { if (!chance(0.12)) this.play(b, 'piano', 'piano', i * 0.5, m, 0.32 + (i % 2 ? 0 : 0.08), 0.9 * b.spb); });
      this.chords(b, f, 'choir', CHOIR('ah'), 'choir', 57, 74, 4, 0.55);
      if (f.i >= 4) {
        const nn = this.mel.bar(pick([[2, 2], [3, 1], [4]]), f.chord, { arch: f.i < 6 ? 1 : -1, vel: 0.6, cadence: f.last });
        this.notes(b, nn, STRINGS(0.6), 'strings', 0.9, 1.02);
      }
    }
    if (f.sec === 'A' && this.occ % 2 === 1) {
      if (chance(0.7)) {
        const tones = chordTones(f.chord, 79, 93);
        this.play(b, 'glass', 'bells', pick([0, 1, 2, 2.5]), pick(tones), 0.5, 2 * b.spb);
      }
    }
    if (f.sec === 'breath' || f.sec === 'intro') {
      if (chance(0.5)) this.play(b, 'piano', 'piano', 1 + rand(0, 1), pick(chordTones(f.chord, 74, 86)), 0.35, 2 * b.spb);
    }
  }
}

// ═════════════════════════════════════ PROLOGUE ═════════════════════════════════════

class PrologueTheme extends Song {
  readonly bpm = 56;
  readonly level = 0.8;
  protected readonly energy: Record<string, number> = { quiet: 0.85, A: 1, B: 1.05 };
  readonly warm: [BufInst, number, number][] = [['piano', 36, 88]];
  private scale = new Scale(note('F4'), MODES.lydian);
  private mel = new Melody(this.scale, 65, 84);
  protected readonly sections: Section[] = [
    { name: 'quiet', bars: ['Fmaj9', 'Fmaj9'] },
    { name: 'A', bars: ['Fmaj7', 'G/F', 'Fmaj7', 'G/F', 'Em7', 'Am7', 'Dm9', 'G'] },
    { name: 'B', bars: ['Am7', 'Cmaj7', 'Fmaj7#11', 'Em7', 'Dm7', 'Em7', 'Fmaj7', 'G6/9'] },
  ];
  protected readonly order = ['quiet', 'A', 'quiet', 'B', 'A'];
  protected init(p: Player): void {
    p.ch('pad', { gain: 0.75, wet: 0.42, filterLfoHz: 180, filterLfoRate: 0.04 });
    p.ch('piano', { gain: 0.6, wet: 0.36 });
  }
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A' && this.occ % 2 === 1) {
      this.lines.motif = [{ notes: this.motifLine(this.scale, note('F4'), b.beats, [{ part: 'call', bar: 4, stretch: 1.25 }]), inst: 'piano', ch: 'piano', vel: 0.62, opts: { release: 1 } }];
    }
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    this.chords(b, f, 'pad', PAD(850), 'pad', 53, 70, 4, 0.8, 0.8);
    if (f.sec === 'quiet') {
      if (chance(0.45)) this.play(b, 'piano', 'piano', rand(0.5, 2), pick(chordTones(f.chord, 72, 86)), 0.3, 3 * b.spb, 1.2);
      return;
    }
    // low single bass note from the piano
    if (chance(0.7)) this.play(b, 'piano', 'piano', 0, bassNote(f.chord, 41), 0.42, 3.5 * b.spb, 1.2);
    if (this.lines.motif && f.i >= 4 && f.i <= 5) return;
    // sparse, breathing melody: mostly 1-3 notes per bar, often resting
    if (chance(f.i % 4 === 3 ? 0.35 : 0.8)) {
      const rhythm = pick([[-1, 1, 2], [2, 2], [-2, 1, 1], [1.5, 0.5, 2], [-1, 3], [3, 1]]);
      const nn = this.mel.bar(rhythm, f.chord, { arch: f.i < 4 ? 0.6 : -0.6, vel: 0.5, cadence: f.last, leap: 0.05 });
      this.notes(b, nn, 'piano', 'piano', 1, 1.1, 1.0);
      // occasional dyad sparkle
      if (chance(0.2) && nn.length) {
        const last = nn[nn.length - 1];
        this.play(b, 'piano', 'piano', last.beat + 0.02, last.midi + (chance(0.5) ? 7 : 12), last.vel * 0.45, last.dur * b.spb);
      }
    }
  }
}

// ═════════════════════════════════════ HUB ═════════════════════════════════════

class HubTheme extends Song {
  readonly bpm = 72;
  readonly level = 0.78;
  protected readonly energy: Record<string, number> = { A: 1, B: 1.05, C: 1.08 };
  readonly warm: [BufInst, number, number][] = [['kalimba', 60, 90], ['harp', 38, 90], ['glass', 78, 96]];
  private scale = new Scale(note('D4'), MODES.major);
  private bellMel = new Melody(this.scale, 78, 91);
  private fluteMel = new Melody(this.scale, 69, 86);
  protected readonly sections: Section[] = [
    { name: 'A', bars: ['D', 'A/C#', 'Bm7', 'G', 'D/F#', 'Em7', 'G', ['Asus4', 'A']] },
    { name: 'B', bars: ['Gmaj7', 'A', 'F#m7', 'Bm7', 'Em7', 'A', 'Dmaj7/F#', ['Gmaj7', 'Asus4']] },
    { name: 'C', bars: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em7', 'A'] },
  ];
  protected readonly order = ['A', 'A', 'B', 'A', 'C', 'B'];
  protected init(p: Player): void {
    p.ch('pad', { gain: 0.75, wet: 0.35, filterLfoHz: 220, filterLfoRate: 0.06 });
    p.ch('arp', { gain: 0.36, wet: 0.3, pan: -0.2 });
    p.ch('harp', { gain: 0.38, wet: 0.32, pan: 0.2 });
    p.ch('lead', { gain: 0.55, wet: 0.34, vibratoCents: 10, vibratoRate: 5 });
    p.ch('bass', { gain: 0.6, wet: 0.08 });
    p.ch('strings', { gain: 0.42, wet: 0.36, vibratoCents: 9 });
    p.ch('bells', { gain: 0.22, wet: 0.55, pan: 0.3 });
    p.ch('choir', { gain: 0.4, wet: 0.45, vibratoCents: 6 });
    p.ch('horn', { gain: 0.45, wet: 0.4, vibratoCents: 5 });
  }
  private get lvl(): number {
    const pr = this.progressRef;
    return pr ? pr.totems + (pr.citadelDone ? 1 : 0) + (pr.echoOpen ? 0.5 : 0) + (pr.finale ? 3 : 0) : 0;
  }
  private progressRef: Player['progress'] | null = null;
  protected onSection(b: BarCtx, f: BarInfo): void {
    this.progressRef = b.p.progress;
    if (f.sec === 'A' && this.occ % 2 === 0) {
      const plan = [
        { part: 'call' as const, bar: 0 }, { part: 'answer' as const, bar: 2 },
        { part: 'call' as const, bar: 4, shift: 2 }, { part: 'close' as const, bar: 6 },
      ];
      this.lines.motif = [{ notes: this.motifLine(this.scale, note('D5'), b.beats, plan), inst: FLUTE(), ch: 'lead', vel: 0.85 }];
      if (b.p.progress.finale || b.p.progress.citadelDone) {
        this.lines.motif.push({ notes: this.motifLine(this.scale, note('D4'), b.beats, plan), inst: HORN(), ch: 'horn', vel: 0.75 });
      }
    }
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    this.progressRef = b.p.progress;
    const L = this.lvl;
    const bright = clamp(0.55 + L * 0.06, 0.55, 1.15);
    this.chords(b, f, 'pad', PAD(900 + 700 * bright), 'pad', 52, 71, 4, 0.75);
    // arpeggio: kalimba in A, harp in B/C
    const dense = (f.sec === 'C' && L >= 6) || L >= 10;
    const step = dense ? 0.25 : 0.5;
    const count = b.beats / step;
    const pattern = f.sec === 'C' ? 'up' : 'updown';
    const inst: BufInst = f.sec === 'A' ? 'kalimba' : 'harp';
    const ch = f.sec === 'A' ? 'arp' : 'harp';
    const k = f.chords.length;
    for (let i = 0; i < count; i++) {
      const beat = i * step;
      const c = this.chordAt(f, beat, b.beats);
      const tones = arp(c, 62, 86, pattern, count);
      if (chance(dense ? 0.22 : 0.14)) continue;
      const accent = i % (k === 2 ? 4 : 8) === 0 ? 1 : 0.78;
      this.play(b, inst, ch, beat, tones[i % tones.length], 0.5 * accent, 1.2 * b.spb);
    }
    if (L >= 1) this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 38), 0.6, b.beats * b.spb + 0.2);
    if (L >= 2) {
      const bn = bassNote(f.chord, 38) + 12;
      this.play(b, 'harp', 'harp', 0, bn, 0.42, 1.8 * b.spb);
      this.play(b, 'harp', 'harp', 2, bn + (chance(0.5) ? 7 : 12), 0.32, 1.8 * b.spb);
    }
    if (L >= 3) this.chords(b, f, 'strings', STRINGS(bright * 0.7), 'strings', 55, 76, 3, 0.75);
    if (L >= 5 && !this.lines.motif) {
      const nn = this.bellMel.bar(pick([[2, 2], [4], [3, 1], [1, 1, 2]]), f.chord, { vel: 0.55, arch: f.pos < 0.5 ? 1 : -1, cadence: f.last });
      this.notes(b, nn, 'glass', 'bells', 0.8, 1.2);
    }
    if (L >= 7) this.chords(b, f, 'choir', CHOIR(L >= 10 ? 'ah' : 'oo'), 'choir', 57, 74, 4, 0.6);
    // second A: a gentle flute variation instead of the motif
    if (f.sec === 'A' && this.occ % 2 === 1 && chance(0.8)) {
      const nn = this.fluteMel.bar(pick([[2, 2], [1.5, 0.5, 2], [-1, 1, 2], [1, 1, 1, 1]]), f.chord, { arch: f.pos < 0.5 ? 1 : -1, vel: 0.6, cadence: f.last });
      this.notes(b, nn, FLUTE(), 'lead', 0.8);
    }
    if (L >= 9 && f.i === 0) this.chords(b, f, 'horn', HORN(), 'horn', 50, 65, 3, 0.55);
  }
}

// ═════════════════════════════════════ KINSHIP (autumn grove) ═════════════════════════════════════

class KinshipTheme extends Song {
  readonly bpm = 72;
  readonly level = 1.6;
  protected readonly energy: Record<string, number> = { air: 0.85, A: 1, B: 1.08 };
  readonly warm: [BufInst, number, number][] = [['guitar', 38, 76]];
  private scale = new Scale(note('A4'), MODES.dorian);
  private mel = new Melody(this.scale, 64, 81);
  protected readonly sections: Section[] = [
    { name: 'air', bars: ['Am7', 'D9'] },
    { name: 'A', bars: ['Am7', 'D9', 'Am7', 'D9', 'Cmaj7', 'G', 'Em7', 'Am7'] },
    { name: 'B', bars: ['Cmaj7', 'D', 'Bm7', 'Em7', 'Cmaj7', 'D', ['Esus4', 'Em'], 'Am7'] },
  ];
  protected readonly order = ['air', 'A', 'A', 'B', 'A', 'air'];
  private static SIG: [number, number][][] = [
    [[4, 1.5], [3, 0.5], [2, 1], [1, 1]],
    [[2, 0.5], [3, 0.5], [4, 1], [5, 2]],
    [[4, 1], [3, 0.5], [2, 0.5], [0, 2]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') this.lines.sig = [{ notes: this.sig(this.scale, note('A4'), b.beats, KinshipTheme.SIG, this.occ % 2 ? -2 : 0, 0.66), inst: OBOE(), ch: 'lead', vel: 0.95 }];
  }
  protected init(p: Player): void {
    p.ch('guitar', { gain: 0.6, wet: 0.26, pan: -0.15 });
    p.ch('lead', { gain: 0.5, wet: 0.33, pan: 0.12, vibratoCents: 11, vibratoRate: 5.3 });
    p.ch('strings', { gain: 0.42, wet: 0.36, vibratoCents: 8 });
    p.ch('bass', { gain: 0.5, wet: 0.06 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    // Travis-style fingerpicking
    const bassA = bassNote(f.chord, 40);
    const fifth = chordTones(f.chord, bassA + 5, bassA + 9)[0] ?? bassA + 7;
    const treble = chordTones(f.chord, 57, 71);
    const pattern = [
      [0, bassA, 0.6], [0.5, treble[1], 0.32], [1, fifth, 0.45], [1.5, treble[2], 0.34],
      [2, bassA + (chance(0.3) ? 12 : 0), 0.52], [2.5, treble[3] ?? treble[1], 0.32], [3, fifth, 0.42], [3.5, treble[2], 0.3],
    ] as [number, number | undefined, number][];
    for (const [beat, m, v] of pattern) {
      if (m === undefined || (beat % 1 && chance(0.1))) continue;
      this.play(b, 'guitar', 'guitar', beat, m, v * rand(0.85, 1.1), 1.6 * b.spb);
    }
    if (chance(0.25)) this.play(b, 'guitar', 'guitar', 3.75, treble[0], 0.22, 0.6 * b.spb);
    if (f.sec === 'air') return;
    if (f.sec === 'B' || this.occ > 0) this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 33), 0.45, b.beats * b.spb);
    if (f.sec === 'B') this.chords(b, f, 'strings', STRINGS(0.4), 'strings', 52, 69, 3, 0.6);
    // oboe phrases: bars 0-2 and 4-6, guitar fills on 3 and 7
    const phraseBar = f.i % 4;
    if (phraseBar === 3) {
      if (chance(0.6)) {
        const run = [0, -1, -2, -3].map((d) => this.scale.deg(this.scale.degreeOf(treble[treble.length - 1] ?? 69) + d));
        run.forEach((m, i) => this.play(b, 'guitar', 'guitar', 2 + i * 0.5, m, 0.3, 0.6 * b.spb));
      }
      return;
    }
    if (this.lines.sig && f.i < 3) return;
    if (this.lines.sig && f.i === 4) this.mel.seat(note('A4'));
    const rhythm = pick([[1.5, 0.5, 1, 1], [2, 1, 1], [1, 1, 2], [0.5, 0.5, 1, 2], [3, 1], [-1, 1, 1, 1]]);
    const nn = this.mel.bar(rhythm, f.chord, { arch: phraseBar === 0 ? 0.8 : phraseBar === 1 ? 0.2 : -0.8, vel: 0.62, cadence: phraseBar === 2 });
    if (phraseBar === 2 && nn.length) nn[nn.length - 1].dur += 0.5;
    this.notes(b, nn, OBOE(), 'lead', 0.85, 1.0);
  }
}

// ═════════════════════════════════════ MEASURE (terraces) ═════════════════════════════════════

class MeasureTheme extends Song {
  readonly bpm = 84;
  readonly level = 1.05;
  protected readonly energy: Record<string, number> = { air: 0.85, A: 1, B: 1.06 };
  readonly warm: [BufInst, number, number][] = [['marimba', 43, 90]];
  private harm = new Scale(note('G4'), MODES.major);
  private pent = new Scale(note('G4'), MODES.majorPent);
  private mel = new Melody(this.pent, 67, 88);
  protected readonly sections: Section[] = [
    { name: 'air', bars: ['Cadd9', 'G'] },
    { name: 'A', bars: ['G', 'Em7', 'Cadd9', 'D', 'G/B', 'Cadd9', 'Am7', ['Dsus4', 'D']] },
    { name: 'B', bars: ['Em7', 'Cadd9', 'G', 'D/F#', 'Em7', 'Cadd9', 'Am7', 'D'] },
  ];
  protected readonly order = ['air', 'A', 'B', 'A', 'A'];
  private static SIG: [number, number][][] = [
    [[3, 0.5], [4, 0.5], [5, 1], [4, 0.5], [3, 0.5], [2, 1]],
    [[1, 0.5], [2, 0.5], [3, 1], [2, 2]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') this.lines.sig = [{ notes: this.sig(this.pent, note('G4'), b.beats, MeasureTheme.SIG, 0, 0.66), inst: FLUTE(true), ch: 'lead', vel: 0.95 }];
  }
  protected init(p: Player): void {
    p.ch('marimba', { gain: 0.42, wet: 0.28, pan: -0.12 });
    p.ch('lowmar', { gain: 0.5, wet: 0.15 });
    p.ch('drops', { gain: 0.3, wet: 0.5, pan: 0.3 });
    p.ch('lead', { gain: 0.55, wet: 0.35, pan: 0.1, vibratoCents: 14, vibratoRate: 5.6 });
    p.ch('pad', { gain: 0.45, wet: 0.35, filterLfoHz: 200 });
    p.ch('perc', { gain: 0.25, wet: 0.2, pan: 0.25 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    // rippling marimba
    for (let i = 0; i < 8; i++) {
      const beat = i * 0.5;
      const c = this.chordAt(f, beat, b.beats);
      const tones = arp(c, 60, 84, (f.i + this.occ) % 2 ? 'updown' : 'broken', 8);
      if (chance(0.15)) continue;
      this.play(b, 'marimba', 'marimba', beat, tones[i % tones.length], (i % 2 ? 0.38 : 0.5) * rand(0.85, 1.1), 0.5 * b.spb);
    }
    this.play(b, 'marimba', 'lowmar', 0, bassNote(f.chord, 43), 0.5, 1.5 * b.spb);
    if (chance(0.5)) this.play(b, 'marimba', 'lowmar', 2.5, bassNote(f.chord, 43) + 7, 0.32, b.spb);
    // water drops
    const nd = chance(0.5) ? 1 : chance(0.5) ? 2 : 0;
    const dropDest = b.p.channels.get('drops');
    for (let d = 0; d < nd && dropDest; d++) {
      const m = this.pent.deg(this.pent.degreeOf(rand(84, 96)));
      waterDrop(b.p.core, dropDest.input, this.T(b, rand(0, b.beats)), mtof(m), rand(0.4, 0.8));
    }
    if (f.sec === 'B') {
      this.chords(b, f, 'pad', PAD(1600), 'pad', 55, 74, 3, 0.55);
      const pc = b.p.channels.get('perc');
      if (pc) for (let i = 0; i < 8; i++) if (chance(0.55)) drum(b.p.core, pc.input, this.T(b, i * 0.5, 0.01), 'shaker', i % 2 ? 0.5 : 0.8);
    }
    if (f.sec === 'air') return;
    if (this.lines.sig && f.i < 2) return;
    // bamboo flute: 2-bar phrases with breath
    const phraseBar = f.i % 2;
    if (phraseBar === 1 && chance(0.35)) return;
    const rhythm = pick([[1, 0.5, 0.5, 2], [1.5, 0.5, 2], [0.5, 0.5, 1, 1, 1], [2, 1, 1], [-1, 1, 2], [1, 1, 2]]);
    const nn = this.mel.bar(rhythm, f.chord, { arch: phraseBar === 0 ? 0.7 : -0.7, vel: 0.62, cadence: phraseBar === 1 });
    for (const n of nn) {
      if (n.dur >= 1 && chance(0.35)) {
        // grace note from above
        const g = this.pent.deg(this.pent.degreeOf(n.midi) + 1);
        this.play(b, FLUTE(true), 'lead', Math.max(0, n.beat - 0.12), g, n.vel * 0.6, 0.1 * b.spb);
      }
    }
    this.notes(b, nn, FLUTE(true), 'lead', 0.9, 0.97);
  }
}

// ═════════════════════════════════════ MOLD (quarry) ═════════════════════════════════════

class MoldTheme extends Song {
  readonly bpm = 64;
  readonly level = 1.4;
  protected readonly energy: Record<string, number> = { stone: 0.92, A: 1, B: 1.08 };
  readonly warm: [BufInst, number, number][] = [['wood', 44, 72], ['bell', 36, 50]];
  private scale = new Scale(note('C4'), MODES.mixolydian);
  private cello = new Melody(this.scale, 48, 64);
  protected readonly sections: Section[] = [
    { name: 'stone', bars: ['Csus2', 'Csus2'] },
    { name: 'A', bars: ['Csus2', 'Bbsus2', 'Fsus2', 'Gsus4', 'Csus2', 'Dm7', 'Bbmaj7', ['Csus4', 'C']] },
    { name: 'B', bars: ['Fsus2', 'Gsus4', 'Am7', 'Bbsus2', 'Fsus2', 'Gsus4', 'Bbmaj7', 'Csus2'] },
  ];
  protected readonly order = ['stone', 'A', 'B', 'stone', 'A'];
  private static SIG: [number, number][][] = [
    [[-7, 2], [-3, 2]],
    [[-4, 1.5], [-1, 0.5], [0, 2]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') this.lines.sig = [{ notes: this.sig(this.scale, note('C4'), b.beats, MoldTheme.SIG, 0, 0.7), inst: STRINGS(0.3), ch: 'cello', vel: 1 }];
  }
  protected init(p: Player): void {
    p.ch('drone', { gain: 0.65, wet: 0.3, filterLfoHz: 120, filterLfoRate: 0.03 });
    p.ch('strings', { gain: 0.5, wet: 0.35, vibratoCents: 7 });
    p.ch('wood', { gain: 0.42, wet: 0.3, pan: -0.15 });
    p.ch('perc', { gain: 0.5, wet: 0.35 });
    p.ch('cello', { gain: 0.5, wet: 0.33, vibratoCents: 12, vibratoRate: 5 });
    p.ch('bell', { gain: 0.26, wet: 0.5, pan: 0.2 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    if (f.i % 4 === 0) {
      this.play(b, DRONE(380), 'drone', 0, note('C2'), 0.85, 4.2 * b.beats * b.spb);
      this.play(b, DRONE(380), 'drone', 0.1, note('G2'), 0.6, 4.2 * b.beats * b.spb);
    }
    const pc = b.p.channels.get('perc');
    if (pc && (f.sec === 'stone' || f.i % 2 === 0)) drum(b.p.core, pc.input, this.T(b, 0), 'stone', 0.7);
    if (f.sec === 'stone') {
      if (chance(0.6)) this.play(b, 'bell', 'bell', 0, note('C3'), 0.4, 6);
      return;
    }
    this.chords(b, f, 'strings', STRINGS(0.15), 'strings', 45, 63, 3, 0.62, 0.6);
    // stone/wood ostinato
    const tones = chordTones(f.chord, 52, 67);
    const rhythmBank = [[0, 1.5, 3], [0, 0.75, 1.5, 3], [0, 2, 2.5, 3.5], [0, 1, 1.5, 3]];
    const rh = rhythmBank[(f.i + this.occ) % rhythmBank.length];
    rh.forEach((beat, i) => this.play(b, 'wood', 'wood', beat, tones[(i * 2 + f.i) % tones.length], i === 0 ? 0.55 : 0.4, 0.3 * b.spb));
    if (f.sec === 'B') {
      const nn = this.cello.bar(pick([[2, 2], [3, 1], [4], [1.5, 0.5, 2]]), f.chord, { arch: f.pos < 0.5 ? 0.6 : -0.6, vel: 0.62, cadence: f.last });
      this.notes(b, nn, STRINGS(0.3), 'cello', 1, 1.02);
    }
    if (f.i % 4 === 0) this.play(b, 'bell', 'bell', 0, bassNote(f.chord, 36), 0.35, 5);
  }
}

// ═════════════════════════════════════ CONTOUR (hedge garden, baroque) ═════════════════════════════════════

class ContourTheme extends Song {
  readonly bpm = 90;
  readonly level = 1.0;
  protected readonly energy: Record<string, number> = { A: 1, B: 1.06, A2: 1.02 };
  readonly warm: [BufInst, number, number][] = [['harpsi', 56, 88], ['pizz', 30, 52], ['celesta', 70, 96]];
  private scale = new Scale(note('Bb4'), MODES.major);
  private mel = new Melody(this.scale, 72, 91);
  private lastBarMel: MNote[] = [];
  protected readonly sections: Section[] = [
    { name: 'A', bars: ['Bb', 'Eb', 'Cm7', 'F7', 'Dm', 'Gm', 'Eb', ['F', 'F7']] },
    { name: 'B', bars: ['Gm', 'Cm', 'F', 'Bb', 'Eb', 'Am7b5', 'D7', 'Gm'] },
    { name: 'A2', bars: ['Bb', 'F/A', 'Gm', 'Dm/F', 'Eb', 'Bb/D', 'Cm7', ['F7', 'Bb']] },
  ];
  protected readonly order = ['A', 'B', 'A2', 'A', 'B', 'A2'];
  private static SIG: [number, number][][] = [
    [[2, 0.5], [1, 0.25], [2, 0.25], [0, 0.5], [4, 0.5], [2, 0.5], [7, 0.5], [6, 0.5], [7, 0.5]],
    [[5, 1], [3, 0.5], [4, 0.5], [5, 0.5], [7, 0.5], [5, 1]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A' || f.sec === 'A2') this.lines.sig = [{ notes: this.sig(this.scale, note('Bb4'), b.beats, ContourTheme.SIG, 0, 0.66), inst: 'celesta', ch: 'celesta', vel: 1 }];
  }
  protected init(p: Player): void {
    p.ch('harpsi', { gain: 0.34, wet: 0.22, pan: -0.2 });
    p.ch('bass', { gain: 0.55, wet: 0.15, pan: 0.05 });
    p.ch('celesta', { gain: 0.42, wet: 0.3, pan: 0.22 });
    p.ch('strings', { gain: 0.35, wet: 0.35, vibratoCents: 8 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    // harpsichord broken chords (8ths)
    for (let i = 0; i < 8; i++) {
      const beat = i * 0.5;
      const c = this.chordAt(f, beat, b.beats);
      const tones = arp(c, 58, 74, 'alberti', 8);
      const m = tones[i % tones.length];
      this.play(b, 'harpsi', 'harpsi', beat, m, i % 2 ? 0.36 : 0.46, 0.55 * b.spb);
      if (i % 4 === 0) this.play(b, 'harpsi', 'harpsi', beat, m + 12, 0.14, 0.5 * b.spb);
    }
    // walking pizzicato bass
    const r0 = bassNote(f.chord, 34);
    const r1 = bassNote(f.next, 34);
    const walk = [r0, this.scale.snap(r0 + 2), this.scale.snap(r0 + 4), this.scale.snap(r1 + (r1 > r0 ? -1 : 1))];
    walk.forEach((m, i) => this.play(b, 'pizz', 'bass', i, i === 0 ? r0 : m, i === 0 ? 0.62 : 0.45, 0.9 * b.spb));
    if (f.sec === 'B') this.chords(b, f, 'strings', STRINGS(0.5), 'strings', 55, 72, 3, 0.55);
    // celesta melody with baroque sequences and ornaments
    if (this.lines.sig && f.i < 2) {
      this.lastBarMel = [];
      this.prevRoot = f.chord.root;
      if (f.i === 1) this.mel.seat(note('G5'));
      return;
    }
    let nn: MNote[];
    if (f.i % 2 === 1 && this.lastBarMel.length && f.sec !== 'B' && chance(0.6)) {
      // sequence: repeat previous bar transposed by the chord-root movement
      const shift = (((f.chord.root - this.prevRoot) % 12) + 12) % 12;
      const s = shift > 6 ? shift - 12 : shift;
      nn = this.lastBarMel.map((n) => ({ ...n, midi: this.scale.snap(n.midi + s) }));
    } else {
      const rhythm = pick([[1, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 2], [1.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 0.5, 0.5, 1]]);
      nn = this.mel.bar(rhythm, f.chord, { arch: f.pos < 0.5 ? 0.6 : -0.6, vel: 0.6, cadence: f.last });
    }
    this.lastBarMel = nn;
    this.prevRoot = f.chord.root;
    for (const n of nn) {
      if (n.dur >= 1 && chance(0.3)) {
        // mordent: note, upper neighbour, note
        const up = this.scale.deg(this.scale.degreeOf(n.midi) + 1);
        this.play(b, 'celesta', 'celesta', n.beat, n.midi, n.vel, 0.12 * b.spb);
        this.play(b, 'celesta', 'celesta', n.beat + 0.125, up, n.vel * 0.8, 0.12 * b.spb);
        this.play(b, 'celesta', 'celesta', n.beat + 0.25, n.midi, n.vel * 0.9, (n.dur - 0.25) * b.spb);
      } else {
        this.play(b, 'celesta', 'celesta', n.beat, n.midi, n.vel, n.dur * b.spb);
      }
    }
  }
  private prevRoot = 10;
}

// ═════════════════════════════════════ MOSAIC (sand temple) ═════════════════════════════════════

class MosaicTheme extends Song {
  readonly bpm = 76;
  readonly level = 1.6;
  protected readonly energy: Record<string, number> = { taqsim: 0.9, A: 1, B: 1.08 };
  readonly warm: [BufInst, number, number][] = [['oud', 40, 76]];
  private scale = new Scale(note('D4'), MODES.phrygianDominant);
  private oudMel = new Melody(this.scale, 50, 69);
  private neyMel = new Melody(this.scale, 62, 81);
  protected readonly sections: Section[] = [
    { name: 'taqsim', bars: ['D5', 'D5', 'D5', 'D5'] },
    { name: 'A', bars: ['D', 'D', 'Eb', 'D', 'Cm', 'D', 'Eb', 'D'] },
    { name: 'B', bars: ['Gm', 'Cm', 'D', 'D', 'Gm', 'Eb', 'Cm', 'D'] },
  ];
  protected readonly order = ['taqsim', 'A', 'B', 'A', 'taqsim'];
  private static SIG: [number, number][][] = [
    [[4, 1], [5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [1, 1]],
    [[2, 0.5], [1, 0.5], [0, 3]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') this.lines.sig = [{ notes: this.sig(this.scale, note('D4'), b.beats, MosaicTheme.SIG, 0, 0.7), inst: 'oud', ch: 'oud', vel: 1 }];
  }
  protected init(p: Player): void {
    p.ch('drone', { gain: 0.55, wet: 0.3, filterLfoHz: 160, filterLfoRate: 0.11 });
    p.ch('oud', { gain: 0.58, wet: 0.28, pan: -0.12 });
    p.ch('drum', { gain: 0.55, wet: 0.22, pan: 0.15 });
    p.ch('ney', { gain: 0.5, wet: 0.38, pan: 0.18, vibratoCents: 16, vibratoRate: 5.8 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    if (f.i % 4 === 0) {
      this.play(b, DRONE(520), 'drone', 0, note('D2'), 0.85, 4.3 * b.beats * b.spb);
      this.play(b, DRONE(520), 'drone', 0.05, note('A2'), 0.55, 4.3 * b.beats * b.spb);
    }
    const dr = b.p.channels.get('drum');
    if (dr && f.sec !== 'taqsim') {
      const pat: [number, 'dum' | 'tek', number][] = [[0, 'dum', 0.9], [0.5, 'tek', 0.5], [1.5, 'tek', 0.6], [2, 'dum', 0.8], [3, 'tek', 0.6], [3.5, 'tek', 0.3]];
      for (const [beat, k, v] of pat) if (!(k === 'tek' && chance(0.15))) drum(b.p.core, dr.input, this.T(b, beat, 0.008), k, v);
      if (chance(0.3)) drum(b.p.core, dr.input, this.T(b, 2.75, 0.005), 'tek', 0.25);
    }
    if (f.sec === 'taqsim' || (f.sec === 'A' && !(this.lines.sig && f.i < 2))) {
      // oud phrases with grace notes and slides
      const rhythm = f.sec === 'taqsim'
        ? pick([[-0.5, 0.5, 0.5, 0.5, 2], [1.5, 0.25, 0.25, 2], [-1, 0.5, 0.5, 2], [0.75, 0.25, 1, 2]])
        : pick([[0.5, 0.5, 1, 0.5, 0.5, 1], [1, 0.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 2]]);
      const nn = this.oudMel.bar(rhythm, f.chord, { arch: f.i % 2 ? -0.5 : 0.5, vel: 0.62, cadence: f.i % 2 === 1, leap: 0.04 });
      for (const n of nn) {
        if (chance(0.25)) {
          const g = this.scale.deg(this.scale.degreeOf(n.midi) + (chance(0.5) ? 1 : -1));
          this.play(b, 'oud', 'oud', Math.max(0, n.beat - 0.1), g, n.vel * 0.5, 0.08 * b.spb);
        }
        const t = this.T(b, n.beat);
        b.p.buf('oud', 'oud', t, n.midi, n.vel, n.dur * b.spb, chance(0.2) ? { bend: -60, bendTime: 0.12 } : undefined);
      }
      // low tremolo on the tonic at phrase ends
      if (f.i % 2 === 1) for (let k = 0; k < 4; k++) this.play(b, 'oud', 'oud', 3 + k * 0.25, note('D3'), 0.3, 0.2 * b.spb);
    }
    if (f.sec === 'B') {
      const nn = this.neyMel.bar(pick([[2, 1, 1], [3, 1], [1.5, 0.5, 2], [4]]), f.chord, { arch: f.pos < 0.5 ? 0.7 : -0.7, vel: 0.58, cadence: f.last });
      this.notes(b, nn, FLUTE(true), 'ney', 0.9, 1.0);
      // oud accompaniment on the beat
      const tones = chordTones(f.chord, 50, 62);
      [0, 1.5, 2, 3].forEach((beat, i) => this.play(b, 'oud', 'oud', beat, tones[i % tones.length], 0.38, 0.5 * b.spb));
    }
  }
}

// ═════════════════════════════════════ BEACON (lighthouse cliffs) ═════════════════════════════════════

class BeaconTheme extends Song {
  readonly bpm = 60;
  readonly level = 1.25;
  protected readonly energy: Record<string, number> = { wide: 0.85, A: 1, B: 1.1 };
  readonly warm: [BufInst, number, number][] = [['glass', 74, 90]];
  private scale = new Scale(note('E4'), MODES.mixolydian);
  private mel = new Melody(this.scale, 59, 76);
  protected readonly sections: Section[] = [
    { name: 'wide', bars: ['Esus2', 'D/E'] },
    { name: 'A', bars: ['E', 'D/E', 'A/E', 'E', 'C#m7', 'D', 'Bm7', ['Esus4', 'E']] },
    { name: 'B', bars: ['A', 'Bm7', 'C#m7', 'D', 'A/C#', 'Bm7', 'D', 'E'] },
  ];
  protected readonly order = ['wide', 'A', 'B', 'A', 'wide'];
  private static SIG: [number, number][][] = [
    [[4, 2], [7, 2]],
    [[6, 1.5], [5, 0.5], [4, 2]],
    [[3, 1], [4, 1], [5, 2]],
    [[4, 4]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') this.lines.sig = [{ notes: this.sig(this.scale, note('E4'), b.beats, BeaconTheme.SIG, 0, 0.72), inst: HORN(), ch: 'hornlead', vel: 1.05 }];
  }
  protected init(p: Player): void {
    p.ch('horns', { gain: 0.55, wet: 0.45, vibratoCents: 4 });
    p.ch('hornlead', { gain: 0.5, wet: 0.45, pan: -0.1, vibratoCents: 7, vibratoRate: 4.8 });
    p.ch('strings', { gain: 0.4, wet: 0.5, vibratoCents: 8, pan: 0.1 });
    p.ch('bells', { gain: 0.2, wet: 0.75, pan: 0.45 });
    p.ch('bass', { gain: 0.5, wet: 0.1 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    this.chords(b, f, 'horns', HORN(), 'horns', 52, 69, 3, 0.62, 0.5);
    this.chords(b, f, 'strings', STRINGS(0.45), 'strings', 64, 79, 3, 0.45, 0.8);
    this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 36), 0.5, b.beats * b.spb);
    if (f.i % 2 === 0 && chance(0.8)) this.play(b, 'glass', 'bells', rand(0, 1), pick(chordTones(f.chord, 76, 88)), 0.4, 4);
    if (f.sec === 'A' && !(this.lines.sig && f.i < 4)) {
      const nn = this.mel.bar(pick([[4], [2, 2], [3, 1], [2, 1, 1], [1.5, 0.5, 2]]), f.chord, { arch: f.pos < 0.5 ? 0.8 : -0.8, vel: 0.7, cadence: f.last });
      this.notes(b, nn, HORN(), 'hornlead', 1.05, 1.02);
    }
  }
}

// ═════════════════════════════════════ WEAVE (windmill vale, waltz) ═════════════════════════════════════

class WeaveTheme extends Song {
  readonly bpm = 100;
  readonly level = 2.0;
  protected readonly energy: Record<string, number> = { A: 1, A2: 1.04, B: 0.94 };
  readonly beats = 3;
  readonly warm: [BufInst, number, number][] = [['pizz', 34, 70], ['harp', 55, 70]];
  private scale = new Scale(note('F4'), MODES.major);
  private reed = new Melody(this.scale, 65, 84);
  private flute = new Melody(this.scale, 74, 89);
  private phrase: MNote[][] = [];
  protected readonly sections: Section[] = [
    { name: 'A', bars: ['F', 'Am', 'Bb', 'F', 'Gm7', 'C7', 'F', 'C7'] },
    { name: 'A2', bars: ['F', 'Dm', 'Gm7', 'C7', 'Am', 'Dm', 'Gm7', ['C7', 'F']] },
    { name: 'B', bars: ['Bb', 'Bbm', 'F/A', 'Dm', 'Gm7', 'C7', 'Fmaj7', 'C7sus4'] },
  ];
  protected readonly order = ['A', 'A2', 'B', 'A', 'A2'];
  private static SIG: [number, number][][] = [
    [[4, 1.5], [2, 0.5], [4, 1]],
    [[6, 2], [5, 1]],
    [[5, 1.5], [4, 0.5], [3, 1]],
    [[2, 3]],
  ];
  protected init(p: Player): void {
    p.ch('bass', { gain: 0.55, wet: 0.14 });
    p.ch('chords', { gain: 0.36, wet: 0.2, pan: 0.18 });
    p.ch('lead', { gain: 0.45, wet: 0.3, pan: -0.12, tremolo: 0.08, tremoloRate: 5.5 });
    p.ch('flute', { gain: 0.45, wet: 0.35, pan: 0.2, vibratoCents: 12 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    // oom-pah-pah
    const root = bassNote(f.chord, 36);
    const alt = f.i % 2 ? chordTones(f.chord, root + 5, root + 9)[0] ?? root + 7 : root;
    this.play(b, 'pizz', 'bass', 0, alt, 0.62, 0.9 * b.spb);
    const stab = chordTones(this.chordAt(f, 1.6, 3), 55, 67).slice(0, 3);
    for (const beat of [1, 2]) for (const m of stab) this.play(b, 'pizz', 'chords', beat, m, 0.34, 0.5 * b.spb);
    // reed melody in 4-bar phrases; bars 4-7 vary bars 0-3
    const pb = f.i % 4;
    let nn: MNote[];
    if (f.sec === 'A' && f.i < 4) {
      nn = this.barNotes(this.scale, note('F4'), WeaveTheme.SIG[f.i], 0, 0.64);
      this.phrase[pb] = nn;
      if (f.i === 3) this.reed.seat(note('A4'));
    } else if (f.i >= 4 && this.phrase[pb] && chance(0.65)) {
      nn = this.phrase[pb].map((n) => ({ ...n }));
      if (f.last && nn.length) {
        const lastN = nn[nn.length - 1];
        lastN.midi = chordTones(f.chord, lastN.midi - 4, lastN.midi + 4)[0] ?? lastN.midi;
      }
    } else {
      const rhythm = pick([[2, 1], [1, 1, 1], [1.5, 0.5, 1], [3], [1, 2], [0.5, 0.5, 1, 1]]);
      nn = this.reed.bar(rhythm, f.chord, { arch: pb < 2 ? 0.7 : -0.7, vel: 0.6, cadence: pb === 3, strong: [0] });
      this.phrase[pb] = nn;
    }
    if (f.sec !== 'B' || chance(0.4)) this.notes(b, nn, REED(), 'lead', 0.9, 0.92);
    if (f.sec === 'B') {
      const fl = this.flute.bar(pick([[3], [2, 1], [1.5, 1.5]]), f.chord, { arch: f.pos < 0.5 ? 0.6 : -0.6, vel: 0.55, cadence: f.last, strong: [0] });
      this.notes(b, fl, FLUTE(), 'flute', 0.85, 1);
    }
  }
}

// ═════════════════════════════════════ TWINS (mirror lake, canon) ═════════════════════════════════════

class TwinsTheme extends Song {
  readonly bpm = 66;
  readonly level = 1.25;
  protected readonly energy: Record<string, number> = { A: 1, B: 1.06 };
  readonly warm: [BufInst, number, number][] = [['koto', 55, 88], ['harp', 60, 90]];
  private harm = new Scale(note('Eb4'), MODES.major);
  private pent = new Scale(note('Eb4'), MODES.majorPent);
  private mel = new Melody(this.pent, 63, 82);
  protected readonly sections: Section[] = [
    { name: 'A', bars: ['Eb', 'Cm7', 'Abmaj7', 'Bb', 'Eb/G', 'Abmaj7', 'Fm7', ['Bbsus4', 'Bb']] },
    { name: 'B', bars: ['Abmaj7', 'Bb', 'Gm7', 'Cm7', 'Abmaj7', 'Bb', 'Ebmaj7', 'Ebmaj7'] },
  ];
  protected readonly order = ['A', 'B', 'A'];
  private static SIG: [number, number][][] = [
    [[2, 1], [3, 0.5], [4, 0.5], [3, 2]],
    [[5, 1], [4, 1], [3, 2]],
  ];
  protected init(p: Player): void {
    p.ch('kotoL', { gain: 0.5, wet: 0.35, pan: -0.45 });
    p.ch('kotoR', { gain: 0.46, wet: 0.45, pan: 0.45 });
    p.ch('glass', { gain: 0.4, wet: 0.5, tremolo: 0.12, tremoloRate: 3.2 });
    p.ch('pad', { gain: 0.5, wet: 0.4, filterLfoHz: 180 });
    p.ch('bass', { gain: 0.45, wet: 0.1 });
    p.ch('harp', { gain: 0.3, wet: 0.5 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    this.chords(b, f, 'pad', PAD(1000), 'pad', 55, 72, 3, 0.6);
    this.chords(b, f, 'glass', GLASSHARM(), 'glass', 67, 79, 2, 0.4, 0.6);
    this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 39), 0.45, b.beats * b.spb);
    const quarter = f.i % 4;
    if (quarter < 2) {
      // phrase (left koto); in B the right koto answers one bar later as a true canon
      const rhythm = pick([[1, 0.5, 0.5, 2], [1.5, 0.5, 1, 1], [1, 1, 2], [0.5, 0.5, 1, 2]]);
      const composed = f.sec === 'A' && this.occ % 2 === 0 && f.i < 2;
      const nn = composed
        ? this.barNotes(this.pent, note('Eb4'), TwinsTheme.SIG[f.i], 0, 0.62)
        : this.mel.bar(rhythm, f.chord, { arch: quarter === 0 ? 0.6 : -0.6, vel: 0.6, cadence: quarter === 1 });
      if (composed && f.i === 1) this.mel.seat(note('Bb4'));
      this.notes(b, nn, 'koto', 'kotoL', 1, 1.1);
      this.store[quarter] = nn;
      if (f.sec === 'B' && quarter === 1 && this.store[0]) this.notes(b, this.store[0], 'koto', 'kotoR', 0.8, 1.1);
    } else {
      // the mirror: invert the phrase around its first note (the lake's reflection)
      const src = this.store[quarter - 2];
      if (src && src.length) {
        const axis = this.pent.degreeOf(src[0].midi);
        const mirrored = src.map((n) => {
          const d = this.pent.degreeOf(n.midi);
          return { ...n, midi: this.pent.deg(2 * axis - d), vel: n.vel * 0.9 };
        });
        this.notes(b, mirrored, 'koto', 'kotoR', 0.95, 1.1);
      }
      if (f.last && chance(0.7)) {
        // harp glissando ripple to close the section
        for (let k = 0; k < 8; k++) this.play(b, 'harp', 'harp', 2 + k * 0.125, this.pent.deg(this.pent.degreeOf(note('Eb5')) + k), 0.25, 1.2 * b.spb);
      }
    }
  }
  private store: MNote[][] = [];
}

// ═════════════════════════════════════ CITADEL ═════════════════════════════════════

class CitadelTheme extends Song {
  readonly bpm = 56;
  readonly level = 0.85;
  protected readonly energy: Record<string, number> = { hush: 0.88, A: 1, B: 1.08 };
  readonly warm: [BufInst, number, number][] = [['bell', 30, 52]];
  private scale = new Scale(note('C4'), MODES.aeolian);
  private cello = new Melody(this.scale, 43, 60);
  protected readonly sections: Section[] = [
    { name: 'hush', bars: ['Cm', 'Cm'] },
    { name: 'A', bars: ['Cm', 'Ab', 'Eb', 'Bb', 'Fm', 'Ab', 'G', 'Cm'] },
    { name: 'B', bars: ['Ab', 'Fm', 'Cm', 'G', 'Ab', 'Bb', 'Eb', 'G'] },
  ];
  protected readonly order = ['hush', 'A', 'B', 'A', 'hush'];
  private static SIG: [number, number][][] = [
    [[4, 2], [2, 1], [3, 1]],
    [[4, 1.5], [5, 0.5], [4, 1], [3, 1]],
    [[2, 2], [1, 1], [2, 1]],
    [[1, 4]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A' && this.occ % 2 === 0) this.lines.sig = [{ notes: this.sig(this.scale, note('C3'), b.beats, CitadelTheme.SIG, 0, 0.72), inst: STRINGS(0.25), ch: 'cello', vel: 1 }];
  }
  protected init(p: Player): void {
    p.ch('choir', { gain: 0.62, wet: 0.48, vibratoCents: 6, vibratoRate: 4.6 });
    p.ch('bells', { gain: 0.34, wet: 0.55 });
    p.ch('drone', { gain: 0.5, wet: 0.25 });
    p.ch('cello', { gain: 0.5, wet: 0.35, vibratoCents: 12, vibratoRate: 5 });
    p.ch('strings', { gain: 0.38, wet: 0.4, vibratoCents: 8 });
    p.ch('drum', { gain: 0.55, wet: 0.4 });
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    if (f.i % 4 === 0 || (f.sec === 'hush' && f.i === 0)) this.play(b, DRONE(300), 'drone', 0, note('C2'), 1, 4.2 * b.beats * b.spb);
    if (f.sec === 'hush') {
      if (f.i === 0) this.play(b, 'bell', 'bells', 0, note('C3'), 0.7, 7);
      if (f.i === 1) this.play(b, 'bell', 'bells', 0.5, note('G2'), 0.5, 7);
      this.chords(b, f, 'choir', CHOIR('mm'), 'choir', 48, 63, 3, 0.38, 0.8);
      return;
    }
    this.chords(b, f, 'choir', CHOIR(f.sec === 'A' ? 'ah' : 'oo'), 'choir', 55, 74, 4, 0.66, 0.5);
    if (f.sec === 'A' || f.i % 2 === 0) this.play(b, 'bell', 'bells', 0, bassNote(f.chord, 36), 0.5, 6);
    if (f.sec === 'B') {
      const nn = this.cello.bar(pick([[2, 2], [3, 1], [4], [1, 1, 2]]), f.chord, { arch: f.pos < 0.5 ? 0.6 : -0.6, vel: 0.65, cadence: f.last });
      this.notes(b, nn, STRINGS(0.25), 'cello', 1, 1.02);
    }
    if (f.sec === 'A' && this.occ > 0) this.chords(b, f, 'strings', STRINGS(0.2), 'strings', 48, 64, 3, 0.5);
    const dr = b.p.channels.get('drum');
    if (dr && f.last) for (let k = 0; k < 6; k++) drum(b.p.core, dr.input, this.T(b, 2 + k * 0.33, 0.005), 'low', 0.25 + k * 0.1);
  }
}

// ═════════════════════════════════════ ECHO (resonant hollow) ═════════════════════════════════════

class EchoTheme extends Song {
  readonly bpm = 40;
  readonly level = 0.45;
  protected readonly energy: Record<string, number> = { A: 1, B: 1.06 };
  readonly reverb: ReverbMode = 'cave';
  readonly warm: [BufInst, number, number][] = [['glass', 80, 102]];
  private scale = new Scale(note('B4'), MODES.lydian);
  protected readonly sections: Section[] = [
    { name: 'A', bars: ['Bmaj7', 'C#/B', 'G#m7', 'D#m7', 'Bmaj9', 'C#/B', 'F#sus2', 'Bmaj7'] },
    { name: 'B', bars: ['G#m7', 'F#6/9', 'C#/B', 'Bmaj7', 'D#m7', 'G#m7', 'C#', 'Bmaj7'] },
  ];
  protected readonly order = ['A', 'B', 'A'];
  private delayIn: GainNode | null = null;
  private delayNodes: AudioNode[] = [];
  dispose(): void {
    for (const n of this.delayNodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.delayNodes = [];
  }
  protected init(p: Player): void {
    // ping-pong feedback delay shared by the crystal voices
    const ctx = p.core.ctx;
    const input = ctx.createGain();
    const dl = ctx.createDelay(3);
    const dr = ctx.createDelay(3);
    dl.delayTime.value = p.spb * 0.75;
    dr.delayTime.value = p.spb * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const pl = ctx.createStereoPanner();
    pl.pan.value = -0.7;
    const pr = ctx.createStereoPanner();
    pr.pan.value = 0.7;
    input.connect(dl);
    dl.connect(pl).connect(p.out);
    dl.connect(dr);
    dr.connect(pr).connect(p.out);
    dr.connect(lp).connect(fb).connect(dl);
    pl.connect(p.wetOut);
    pr.connect(p.wetOut);
    this.delayIn = input;
    this.delayNodes = [input, dl, dr, fb, lp, pl, pr];
    const glass = p.ch('glass', { gain: 0.5, wet: 0.6, tremolo: 0.1, tremoloRate: 3.5 });
    glass.panner.connect(input);
    const crys = p.ch('crystal', { gain: 0.3, wet: 0.7, pan: 0.2 });
    crys.panner.connect(input);
    p.ch('pad', { gain: 0.45, wet: 0.6, filterLfoHz: 200, filterLfoRate: 0.03 });
    p.ch('bass', { gain: 0.45, wet: 0.2 });
    p.ch('choir', { gain: 0.35, wet: 0.7, vibratoCents: 5 });
  }
  private static SIG: [number, number][][] = [
    [[2, 2], [3, 1], [4, 1]],
    [[1, 4]],
  ];
  protected onSection(b: BarCtx, f: BarInfo): void {
    if (f.sec === 'A') this.lines.sig = [{ notes: this.sig(this.scale, note('B4'), b.beats, EchoTheme.SIG, 0, 0.7), inst: GLASSHARM(), ch: 'glass', vel: 1 }];
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    this.chords(b, f, 'pad', PAD(800), 'pad', 54, 70, 3, 0.6, 1.5);
    if (f.i % 2 === 0) this.play(b, SUB(), 'bass', 0, note('B1'), 0.45, 2 * b.beats * b.spb);
    const tones = chordTones(f.chord, 64, 83);
    const n = this.lines.sig && f.i < 2 ? 0 : pick([2, 2, 3, 1]);
    const used = new Set<number>();
    for (let k = 0; k < n; k++) {
      let beat = pick([0, 1, 1.5, 2, 3]);
      while (used.has(beat)) beat = (beat + 1) % 4;
      used.add(beat);
      this.play(b, GLASSHARM(), 'glass', beat, pick(tones), 0.65, pick([2, 3, 4]) * b.spb);
    }
    for (let beat = 0; beat < 4; beat += 0.5) {
      if (chance(0.14)) this.play(b, 'glass', 'crystal', beat, this.scale.snap(Math.round(rand(84, 100))), 0.45, 3);
    }
    if (f.sec === 'B' && f.i % 2 === 0) this.chords(b, f, 'choir', CHOIR('mm'), 'choir', 50, 64, 3, 0.55, 2);
  }
}

// ═════════════════════════════════════ SPIRE (sky spire, the finale) ═════════════════════════════════════

class SpireTheme extends Song {
  readonly bpm = 70;
  readonly level = 0.85;
  readonly reverb: ReverbMode = 'spire';
  readonly warm: [BufInst, number, number][] = [['harp', 60, 96], ['glass', 76, 100]];
  private scale = new Scale(note('D4'), MODES.major);
  protected readonly sections: Section[] = [
    { name: 'A', bars: ['D', 'Bm7', 'Gmaj7', 'A', 'D/F#', 'Gmaj9', 'Em7', ['Asus4', 'A']] },
    { name: 'B', bars: ['Bm7', 'Gmaj7', 'D', 'A/C#', 'Bm7', 'Gmaj7', 'Em7', 'A'] },
  ];
  protected readonly order = ['A', 'B'];
  private barsPlayed = 0;
  protected init(p: Player): void {
    p.ch('shimmer', { gain: 0.5, wet: 0.55, filterLfoHz: 400, filterLfoRate: 0.05 });
    p.ch('arp', { gain: 0.34, wet: 0.45, pan: -0.25 });
    p.ch('arp2', { gain: 0.22, wet: 0.6, pan: 0.3 });
    p.ch('choir', { gain: 0.55, wet: 0.55, vibratoCents: 6 });
    p.ch('strings', { gain: 0.45, wet: 0.45, vibratoCents: 9 });
    p.ch('lead', { gain: 0.5, wet: 0.45, vibratoCents: 9 });
    p.ch('horn', { gain: 0.45, wet: 0.45, vibratoCents: 5 });
    p.ch('bass', { gain: 0.5, wet: 0.12 });
    p.ch('bells', { gain: 0.3, wet: 0.6 });
  }
  private get I(): number {
    const cyc = this.barsPlayed % 72;
    return clamp(0.15 + cyc / 52, 0.15, 1);
  }
  protected onSection(b: BarCtx, f: BarInfo): void {
    const I = this.I;
    if (f.sec !== 'A') return;
    const plan = [{ part: 'call' as const, bar: 0 }, { part: 'answer' as const, bar: 2 }, { part: 'call' as const, bar: 4, shift: 2 }, { part: 'close' as const, bar: 6 }];
    if (I < 0.55) this.lines.m = [{ notes: this.motifLine(this.scale, note('D5'), b.beats, plan), inst: 'glass', ch: 'bells', vel: 0.75 }];
    else
      this.lines.m = [
        { notes: this.motifLine(this.scale, note('D5'), b.beats, plan), inst: FLUTE(), ch: 'lead', vel: 0.85 },
        { notes: this.motifLine(this.scale, note('D4'), b.beats, plan), inst: HORN(), ch: 'horn', vel: 0.8 },
      ];
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    const I = this.I;
    this.barsPlayed++;
    this.chords(b, f, 'shimmer', PAD(1700 + 900 * I), 'shimmer', 62, 81, 4, 0.55);
    const step = I > 0.6 ? 0.25 : 0.5;
    const count = b.beats / step;
    for (let i = 0; i < count; i++) {
      const beat = i * step;
      const c = this.chordAt(f, beat, b.beats);
      const tones = arp(c, 62 + Math.floor(I * 6), 86 + Math.floor(I * 8), 'up', count);
      if (chance(0.12)) continue;
      this.play(b, 'harp', 'arp', beat, tones[i % tones.length], (i % 4 === 0 ? 0.5 : 0.38) * (0.8 + I * 0.3), 1.0 * b.spb);
    }
    if (I > 0.3 && chance(0.6)) this.play(b, 'glass', 'arp2', pick([0.5, 1.5, 2.5, 3.5]), pick(chordTones(f.chord, 84, 98)), 0.45, 2.5);
    if (I > 0.25) this.chords(b, f, 'choir', CHOIR(I > 0.7 ? 'ah' : 'oo'), 'choir', 57, 76, 4, 0.5 + I * 0.25);
    if (I > 0.35) this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 38), 0.55, b.beats * b.spb);
    if (I > 0.45) this.chords(b, f, 'strings', STRINGS(0.5 + I * 0.4), 'strings', 55, 74, 3, 0.6 + I * 0.2);
  }
}

// ═════════════════════════════════════ ENDING ═════════════════════════════════════

class EndingTheme extends Song {
  readonly bpm = 66;
  readonly level = 0.75;
  protected readonly energy: Record<string, number> = { s1: 0.88, s2: 0.94, s3: 1.0, s4: 1.12, s5: 1.15, s6: 0.85 };
  readonly reverb: ReverbMode = 'spire';
  readonly length = 48;
  readonly warm: [BufInst, number, number][] = [['piano', 36, 92], ['glass', 76, 100], ['harp', 55, 90]];
  private D = new Scale(note('D4'), MODES.major);
  private E = new Scale(note('E4'), MODES.major);
  private pmel = new Melody(this.D, 66, 86);
  private emel = new Melody(this.E, 71, 88);
  protected readonly sections: Section[] = [
    { name: 's1', bars: ['D', 'Bm', 'G', 'A', 'D/F#', 'G', 'Em7', ['Asus4', 'A']] },
    { name: 's2', bars: ['D', 'F#m', 'G', 'D/F#', 'Em7', 'A/C#', 'Bm7', ['G', 'A']] },
    { name: 's3', bars: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em7', 'B7'] },
    { name: 's4', bars: ['E', 'C#m', 'A', 'B', 'E/G#', 'A', 'F#m7', ['Bsus4', 'B']] },
    { name: 's5', bars: ['E', 'G#m', 'A', 'E/G#', 'F#m7', 'B/D#', 'C#m7', ['A', 'B']] },
    { name: 's6', bars: ['Emaj9', 'Amaj7', 'Emaj9', 'Amaj7', 'C#m7', 'Amaj7', 'Esus2', 'Emaj9'] },
  ];
  protected readonly order = ['s1', 's2', 's3', 's4', 's5', 's6'];
  protected init(p: Player): void {
    p.ch('piano', { gain: 0.68, wet: 0.36 });
    p.ch('pad', { gain: 0.6, wet: 0.45, filterLfoHz: 200 });
    p.ch('strings', { gain: 0.5, wet: 0.42, vibratoCents: 10 });
    p.ch('smel', { gain: 0.55, wet: 0.42, vibratoCents: 12, vibratoRate: 5.2 });
    p.ch('choir', { gain: 0.55, wet: 0.5, vibratoCents: 6 });
    p.ch('horn', { gain: 0.5, wet: 0.45, vibratoCents: 5 });
    p.ch('bass', { gain: 0.55, wet: 0.1 });
    p.ch('bells', { gain: 0.3, wet: 0.6 });
    p.ch('harp', { gain: 0.32, wet: 0.45 });
  }
  protected onSection(b: BarCtx, f: BarInfo): void {
    const plan = (s: number) => [
      { part: 'call' as const, bar: 0, shift: s }, { part: 'answer' as const, bar: 2, shift: s },
      { part: 'call' as const, bar: 4, shift: s + 2 }, { part: 'close' as const, bar: 6, shift: s },
    ];
    switch (f.sec) {
      case 's1':
        this.lines.m = [{ notes: this.motifLine(this.D, note('D5'), b.beats, plan(0)), inst: 'piano', ch: 'piano', vel: 0.8, opts: { release: 1 } }];
        break;
      case 's3':
        this.lines.m = [{ notes: this.motifLine(this.D, note('D5'), b.beats, plan(0)), inst: STRINGS(0.7), ch: 'smel', vel: 1 }];
        break;
      case 's4':
        this.lines.m = [
          { notes: this.motifLine(this.E, note('E5'), b.beats, plan(0)), inst: STRINGS(0.9), ch: 'smel', vel: 1.05 },
          { notes: this.motifLine(this.E, note('E4'), b.beats, plan(0)), inst: HORN(), ch: 'horn', vel: 0.95 },
        ];
        break;
      case 's6':
        this.lines.m = [
          {
            notes: this.motifLine(this.E, note('E5'), b.beats, [{ part: 'call', bar: 0, stretch: 1.3 }, { part: 'close', bar: 4, stretch: 1.6 }]),
            inst: 'piano', ch: 'piano', vel: 0.7, opts: { release: 1.6 },
          },
        ];
        break;
      default:
        break;
    }
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    const sec = f.sec;
    const late = sec === 's4' || sec === 's5' || sec === 's6';
    // piano left hand (all sections except the full climax)
    if (sec !== 's4' && sec !== 's5') {
      const tones = arp(f.chord, 43, 64, 'broken', 8);
      tones.forEach((m, i) => { if (i % 2 === 0 || chance(0.55)) this.play(b, 'piano', 'piano', i * 0.5, m, i === 0 ? 0.45 : 0.28, 1.2 * b.spb, 0.9); });
      if (sec === 's6' && f.last) this.play(b, 'piano', 'piano', 0, bassNote(f.chord, 28), 0.5, 8, 3);
    }
    if (sec !== 's1') this.chords(b, f, 'pad', PAD(late ? 1700 : 1200), 'pad', 52, 72, 4, sec === 's6' ? 0.55 : 0.7, 0.6);
    if (sec === 's2') {
      const nn = this.pmel.bar(pick([[2, 1, 1], [1.5, 0.5, 2], [1, 1, 2], [3, 1]]), f.chord, { arch: f.pos < 0.5 ? 0.6 : -0.6, vel: 0.62, cadence: f.last });
      this.notes(b, nn, 'piano', 'piano', 1, 1.05, 0.9);
      this.chords(b, f, 'strings', STRINGS(0.45), 'strings', 55, 72, 3, 0.55);
    }
    if (sec === 's3' || sec === 's4' || sec === 's5') {
      this.chords(b, f, 'choir', CHOIR(sec === 's3' ? 'oo' : 'ah'), 'choir', 55, 76, 4, sec === 's3' ? 0.6 : 0.8);
      this.chords(b, f, 'strings', STRINGS(0.7), 'strings', 50, 69, 3, 0.7);
      this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 36), 0.6, b.beats * b.spb);
    }
    if (sec === 's4' || sec === 's5') {
      for (let i = 0; i < 16; i++) {
        const tones = arp(this.chordAt(f, i * 0.25, 4), 64, 91, 'up', 16);
        if (!chance(0.12)) this.play(b, 'harp', 'harp', i * 0.25, tones[i % tones.length], i % 4 ? 0.34 : 0.48, 0.8 * b.spb);
      }
      if (f.i % 2 === 0) this.play(b, 'glass', 'bells', 0, pick(chordTones(f.chord, 79, 91)), 0.55, 4);
    }
    if (sec === 's5') {
      const nn = this.emel.bar(pick([[2, 2], [3, 1], [1, 1, 2]]), f.chord, { arch: f.pos < 0.5 ? 0.8 : -0.6, vel: 0.7, cadence: f.last });
      this.notes(b, nn, STRINGS(0.9), 'smel', 1, 1.02);
    }
    if (sec === 's6') {
      this.chords(b, f, 'choir', CHOIR('oo'), 'choir', 59, 76, 4, 0.5 * (1 - f.pos * 0.5), 1);
      if (f.last) this.play(b, 'glass', 'bells', 1, note('E6'), 0.4, 6);
    }
  }
}

// ═════════════════════════════════════ SECRET ENDING ═════════════════════════════════════

class SecretEndingTheme extends Song {
  readonly bpm = 60;
  readonly level = 0.8;
  protected readonly energy: Record<string, number> = { x1: 0.85, x2: 0.95, x3: 1.02, x4: 1.12, x5: 0.85 };
  readonly reverb: ReverbMode = 'spire';
  readonly length = 40;
  readonly warm: [BufInst, number, number][] = [['harp', 55, 96], ['glass', 76, 102], ['bell', 36, 60]];
  private B = new Scale(note('B4'), MODES.lydian);
  private D = new Scale(note('D4'), MODES.lydian);
  protected readonly sections: Section[] = [
    { name: 'x1', bars: ['Bmaj7', 'C#/B', 'G#m7', 'C#/B', 'Bmaj9', 'C#/B', 'D#m7', 'C#/B'] },
    { name: 'x2', bars: ['G#m7', 'Emaj7', 'B/D#', 'C#', 'G#m7', 'Emaj7', 'F#sus4', 'F#'] },
    { name: 'x3', bars: ['Gmaj7', 'A/G', 'F#m7', 'Bm7', 'Gmaj7', 'A/G', 'Em7', 'Asus4'] },
    { name: 'x4', bars: ['D', 'E/D', 'Bm7', 'E/D', 'Gmaj7', 'A', 'Dmaj7', 'E/D'] },
    { name: 'x5', bars: ['Dmaj9', 'E/D', 'Dmaj9', 'E/D', 'Gmaj7', 'E/D', 'Dmaj7#11', 'Dmaj7#11'] },
  ];
  protected readonly order = ['x1', 'x2', 'x3', 'x4', 'x5'];
  private delayNodes: AudioNode[] = [];
  protected init(p: Player): void {
    const ctx = p.core.ctx;
    const input = ctx.createGain();
    const dl = ctx.createDelay(3);
    dl.delayTime.value = p.spb * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    input.connect(dl).connect(lp).connect(fb).connect(dl);
    lp.connect(p.out);
    lp.connect(p.wetOut);
    this.delayNodes = [input, dl, fb, lp];
    const glass = p.ch('glass', { gain: 0.42, wet: 0.6, tremolo: 0.1, tremoloRate: 3.4 });
    glass.panner.connect(input);
    p.ch('pad', { gain: 0.5, wet: 0.55, filterLfoHz: 260, filterLfoRate: 0.04 });
    p.ch('harp', { gain: 0.3, wet: 0.55, pan: -0.2 });
    p.ch('choir', { gain: 0.55, wet: 0.55, vibratoCents: 6 });
    p.ch('strings', { gain: 0.45, wet: 0.5, vibratoCents: 9 });
    p.ch('smel', { gain: 0.5, wet: 0.5, vibratoCents: 11 });
    p.ch('horn', { gain: 0.42, wet: 0.5, vibratoCents: 5 });
    p.ch('bass', { gain: 0.5, wet: 0.12 });
    p.ch('bells', { gain: 0.3, wet: 0.65 });
  }
  dispose(): void {
    for (const n of this.delayNodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
  protected onSection(b: BarCtx, f: BarInfo): void {
    const plan = [
      { part: 'call' as const, bar: 0, stretch: 1.25 }, { part: 'answer' as const, bar: 2, stretch: 1.25 },
      { part: 'call' as const, bar: 4, shift: 2, stretch: 1.25 }, { part: 'close' as const, bar: 6, stretch: 1.25 },
    ];
    if (f.sec === 'x1') this.lines.m = [{ notes: this.motifLine(this.B, note('B4'), b.beats, plan), inst: GLASSHARM(), ch: 'glass', vel: 0.95 }];
    if (f.sec === 'x3') this.lines.m = [{ notes: this.motifLine(new Scale(note('D4'), MODES.major), note('D5'), b.beats, plan), inst: STRINGS(0.7), ch: 'smel', vel: 1 }];
    if (f.sec === 'x4')
      this.lines.m = [
        { notes: this.motifLine(this.D, note('D5'), b.beats, plan), inst: CHOIR('ah'), ch: 'choir', vel: 1.1 },
        { notes: this.motifLine(this.D, note('D4'), b.beats, plan), inst: HORN(), ch: 'horn', vel: 0.9 },
      ];
  }
  protected arrange(b: BarCtx, f: BarInfo): void {
    const sec = f.sec;
    this.chords(b, f, 'pad', PAD(sec === 'x4' ? 2200 : 1300), 'pad', 54, 74, 4, sec === 'x5' ? 0.6 * (1 - f.pos * 0.4) : 0.7, 0.8);
    if (sec !== 'x1') this.play(b, SUB(), 'bass', 0, bassNote(f.chord, 35), 0.5, b.beats * b.spb);
    // harp: slow rising arpeggios, denser at the climax
    const step = sec === 'x4' ? 0.25 : 0.5;
    const count = b.beats / step;
    for (let i = 0; i < count; i++) {
      if (sec === 'x1' && i % 2) continue;
      const tones = arp(this.chordAt(f, i * step, 4), 62, 90, 'up', count);
      if (!chance(0.15)) this.play(b, 'harp', 'harp', i * step, tones[i % tones.length], (i % 4 ? 0.3 : 0.42), 1.2 * b.spb);
    }
    if (sec === 'x2' || sec === 'x3') this.chords(b, f, 'choir', CHOIR('oo'), 'choir', 55, 74, 4, 0.55);
    if (sec === 'x3' || sec === 'x4') this.chords(b, f, 'strings', STRINGS(0.6), 'strings', 50, 70, 3, 0.62);
    if ((sec === 'x2' || sec === 'x4' || sec === 'x5') && f.i % 2 === 0) this.play(b, 'glass', 'bells', rand(0, 1.5), pick(chordTones(f.chord, 79, 95)), 0.45, 4);
    if (sec === 'x5') {
      this.chords(b, f, 'choir', CHOIR('oo'), 'choir', 59, 78, 4, 0.5 * (1 - f.pos * 0.5), 1);
      if (f.i % 2 === 0) this.play(b, GLASSHARM(), 'glass', rand(0, 2), pick(chordTones(f.chord, 74, 86)), 0.6, 3 * b.spb);
      if (f.last) this.play(b, 'bell', 'bells', 0, note('D3'), 0.6, 8);
    }
  }
}

// ═════════════════════════════════════ registry ═════════════════════════════════════

export function makeTheme(cue: MusicCue | 'ending' | 'secretEnding'): Theme | null {
  switch (cue) {
    case 'menu': return new MenuTheme();
    case 'prologue': return new PrologueTheme();
    case 'hub': return new HubTheme();
    case 'kinship': return new KinshipTheme();
    case 'measure': return new MeasureTheme();
    case 'mold': return new MoldTheme();
    case 'contour': return new ContourTheme();
    case 'mosaic': return new MosaicTheme();
    case 'beacon': return new BeaconTheme();
    case 'weave': return new WeaveTheme();
    case 'twins': return new TwinsTheme();
    case 'citadel': return new CitadelTheme();
    case 'echo': return new EchoTheme();
    case 'spire': return new SpireTheme();
    case 'ending': return new EndingTheme();
    case 'secretEnding': return new SecretEndingTheme();
    default: return null;
  }
}

/** Key/scale per area for tile notes and stingers (tonic MIDI around the 4th/5th octave). */
export const AREA_SCALES: Record<string, Scale> = {
  prologue: new Scale(note('F4'), MODES.lydian),
  hub: new Scale(note('D4'), MODES.major),
  kinship: new Scale(note('A4'), MODES.dorian),
  measure: new Scale(note('G4'), MODES.majorPent),
  mold: new Scale(note('C4'), MODES.mixolydian),
  contour: new Scale(note('Bb4'), MODES.major),
  mosaic: new Scale(note('D4'), MODES.phrygianDominant),
  beacon: new Scale(note('E4'), MODES.mixolydian),
  weave: new Scale(note('F4'), MODES.major),
  twins: new Scale(note('Eb4'), MODES.majorPent),
  citadel: new Scale(note('C4'), MODES.aeolian),
  echo: new Scale(note('B4'), MODES.lydian),
  spire: new Scale(note('D4'), MODES.major),
  menu: new Scale(note('D4'), MODES.major),
};

export { pcOf };
