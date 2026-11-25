/** Composition toolkit: forms, melodies with real phrasing, arpeggios, the TESSELLA leitmotif. */
import { chord, chordTones, nearestChordTone, pcOf, type Chord, type Scale } from './theory';
import { chance, clamp, pick, rand, wpick } from './util';

/** One section of a form. A bar is a chord symbol or a list of chords splitting the bar evenly. */
export interface Section {
  name: string;
  bars: (string | string[])[];
}

export interface BarInfo {
  sec: string;
  /** bar index inside the section */
  i: number;
  /** section length */
  n: number;
  /** chords of this bar (split evenly across the bar) */
  chords: Chord[];
  chord: Chord;
  next: Chord;
  /** how many times the whole form has been played */
  cycle: number;
  /** 0..1 position in the section */
  pos: number;
  /** true on the last bar of the section */
  last: boolean;
}

export class Form {
  private si = 0;
  private bi = 0;
  cycle = 0;
  constructor(private readonly sections: Section[], private readonly order: string[]) {}

  current(): BarInfo {
    const sec = this.sec(this.si);
    const raw = sec.bars[this.bi];
    const chords = (Array.isArray(raw) ? raw : [raw]).map(chord);
    const nextRaw = this.peekNext();
    const nextChord = chord(Array.isArray(nextRaw) ? nextRaw[0] : nextRaw);
    return {
      sec: sec.name,
      i: this.bi,
      n: sec.bars.length,
      chords,
      chord: chords[0],
      next: nextChord,
      cycle: this.cycle,
      pos: sec.bars.length > 1 ? this.bi / (sec.bars.length - 1) : 0,
      last: this.bi === sec.bars.length - 1,
    };
  }

  advance(): void {
    this.bi++;
    if (this.bi >= this.sec(this.si).bars.length) {
      this.bi = 0;
      this.si++;
      if (this.si >= this.order.length) {
        this.si = 0;
        this.cycle++;
      }
    }
  }

  private sec(i: number): Section {
    const name = this.order[i];
    const s = this.sections.find((x) => x.name === name);
    if (!s) throw new Error(`no section ${name}`);
    return s;
  }

  private peekNext(): string | string[] {
    let bi = this.bi + 1;
    let si = this.si;
    if (bi >= this.sec(si).bars.length) {
      bi = 0;
      si = (si + 1) % this.order.length;
    }
    return this.sec(si).bars[bi];
  }
}

export interface MNote {
  beat: number;
  dur: number;
  midi: number;
  vel: number;
}

/**
 * Melody writer: a constrained random walk in scale degrees with phrase arches, strong-beat
 * chord tones, preferred steps, occasional leaps that recover by step, and cadential endings.
 */
export class Melody {
  pos: number;
  private lastStep = 0;
  constructor(
    readonly scale: Scale,
    readonly lo: number,
    readonly hi: number,
  ) {
    this.pos = scale.degreeOf((lo + hi) / 2);
  }

  /** Position the melody near a pitch. */
  seat(midi: number): void {
    this.pos = this.scale.degreeOf(clamp(midi, this.lo, this.hi));
  }

  /**
   * Writes one bar. rhythm = durations in beats (negative = rest).
   * arch: +1 tends upward, -1 downward. cadence: end on a stable chord tone.
   */
  bar(rhythm: number[], c: Chord, o: { arch?: number; leap?: number; vel?: number; cadence?: boolean; strong?: number[] } = {}): MNote[] {
    const out: MNote[] = [];
    let beat = 0;
    const arch = o.arch ?? 0;
    rhythm.forEach((d, idx) => {
      const dur = Math.abs(d);
      if (d < 0) {
        beat += dur;
        return;
      }
      const isLast = idx === rhythm.length - 1;
      const strong = (o.strong ?? [0, 2]).includes(beat) || dur >= 1.5;
      let step: number;
      if (Math.abs(this.lastStep) >= 3) {
        // recover from a leap by step in the opposite direction
        step = -Math.sign(this.lastStep);
      } else {
        const mag = wpick<number>([[0, 0.12], [1, 0.52], [2, 0.24], [3, 0.08 + (o.leap ?? 0)], [4, 0.04 + (o.leap ?? 0) * 0.5]]);
        const up = chance(0.5 + arch * 0.22);
        step = up ? mag : -mag;
      }
      let deg = this.pos + step;
      let midi = this.scale.deg(deg);
      if (strong || (isLast && o.cadence)) {
        const ct = nearestChordTone(c, midi);
        if (this.scale.has(ct) || Math.abs(ct - midi) <= 2) midi = ct;
        deg = this.scale.degreeOf(midi);
      }
      // keep inside range by reflecting
      while (midi > this.hi) {
        deg -= 2;
        midi = this.scale.deg(deg);
      }
      while (midi < this.lo) {
        deg += 2;
        midi = this.scale.deg(deg);
      }
      if (isLast && o.cadence) {
        // land on root or third if close
        const stable = chordTones(c, midi - 4, midi + 4).filter((m) => pcOf(m) === c.pcs[0] || pcOf(m) === c.pcs[1]);
        if (stable.length) midi = stable.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
        deg = this.scale.degreeOf(midi);
      }
      this.lastStep = deg - this.pos;
      this.pos = deg;
      const accent = strong ? 1 : 0.86;
      out.push({ beat, dur, midi, vel: (o.vel ?? 0.7) * accent * rand(0.9, 1.05) });
      beat += dur;
    });
    return out;
  }
}

/** Arpeggio pitch list over a chord within a range. */
export function arp(c: Chord, lo: number, hi: number, pattern: 'up' | 'down' | 'updown' | 'broken' | 'alberti' | 'random', count: number): number[] {
  const tones = chordTones(c, lo, hi);
  if (!tones.length) return [];
  const out: number[] = [];
  switch (pattern) {
    case 'up':
      for (let i = 0; i < count; i++) out.push(tones[i % tones.length]);
      break;
    case 'down':
      for (let i = 0; i < count; i++) out.push(tones[tones.length - 1 - (i % tones.length)]);
      break;
    case 'updown': {
      const cyc = [...tones, ...tones.slice(1, -1).reverse()];
      for (let i = 0; i < count; i++) out.push(cyc[i % cyc.length]);
      break;
    }
    case 'broken': {
      // low, high, mid, high...
      const lo3 = tones.slice(0, Math.max(3, Math.min(tones.length, 4)));
      const order = [0, 2, 1, 3, 2, 1];
      for (let i = 0; i < count; i++) out.push(lo3[order[i % order.length] % lo3.length]);
      break;
    }
    case 'alberti': {
      const t = tones.slice(0, 3);
      const order = [0, 2, 1, 2];
      for (let i = 0; i < count; i++) out.push(t[order[i % 4] % t.length]);
      break;
    }
    case 'random':
      for (let i = 0; i < count; i++) out.push(pick(tones));
      break;
  }
  return out;
}

/**
 * The TESSELLA leitmotif in scale degrees (major): 5 1 2 3 5 — rising and hopeful —
 * answered by 6 5 3 2 (and a closing 3 2 1).
 */
export const MOTIF = {
  call: { deg: [-3, 0, 1, 2, 4], beats: [0.5, 0.5, 1, 1.5, 2.5] },
  answer: { deg: [5, 4, 2, 1], beats: [1, 0.5, 0.5, 2] },
  close: { deg: [2, 1, 0], beats: [1, 1, 2] },
};

/** Motif notes with an optional transposition (in scale degrees) and rhythmic scaling. */
export function motif(scale: Scale, part: 'call' | 'answer' | 'close', octaveTonic: number, shift = 0, stretch = 1): MNote[] {
  const m = MOTIF[part];
  const out: MNote[] = [];
  let beat = 0;
  const base = scale.degreeOf(octaveTonic);
  m.deg.forEach((d, i) => {
    const dur = m.beats[i] * stretch;
    out.push({ beat, dur, midi: scale.deg(base + d + shift), vel: 0.72 + (i === m.deg.length - 1 ? 0.06 : 0) });
    beat += dur;
  });
  return out;
}

/** Small timing humanisation (seconds). */
export function human(amount = 0.008): number {
  return (Math.random() * 2 - 1) * amount;
}
