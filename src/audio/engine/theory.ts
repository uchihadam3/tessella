/** Music theory helpers: scales, chord symbols, voice leading. */

const PC: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

/** 'D4' → 62 */
export function note(name: string): number {
  const m = name.match(/^([A-G](?:#|b)?)(-?\d)$/);
  if (!m) throw new Error(`bad note ${name}`);
  return PC[m[1]] + 12 * (Number(m[2]) + 1);
}

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  majorPent: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
} as const;

export class Scale {
  readonly steps: readonly number[];
  constructor(readonly tonic: number, steps: readonly number[]) {
    this.steps = steps;
  }
  /** Scale degree (0 = tonic, may be negative or > length) → MIDI. */
  deg(d: number): number {
    const n = this.steps.length;
    const o = Math.floor(d / n);
    const i = ((d % n) + n) % n;
    return this.tonic + 12 * o + this.steps[i];
  }
  /** Degree whose pitch is nearest to midi. */
  degreeOf(m: number): number {
    const n = this.steps.length;
    let best = 0;
    let bestDist = Infinity;
    const approx = Math.round(((m - this.tonic) / 12) * n);
    for (let d = approx - n; d <= approx + n; d++) {
      const dist = Math.abs(this.deg(d) - m);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }
  has(m: number): boolean {
    const pc = (((m - this.tonic) % 12) + 12) % 12;
    return this.steps.includes(pc);
  }
  snap(m: number): number {
    return this.deg(this.degreeOf(m));
  }
}

export interface Chord {
  sym: string;
  root: number; // pitch class
  bass: number; // pitch class (slash chords)
  pcs: number[]; // pitch classes, chord tones in priority order (root, 3rd, 5th, 7th, tensions)
  tones: number[]; // intervals above root (may exceed 12 for tensions)
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  '9sus4': [0, 5, 7, 10, 14],
  'maj7#11': [0, 4, 7, 11, 18],
  '6/9': [0, 4, 7, 9, 14],
  m11: [0, 3, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  'add11': [0, 4, 7, 17],
  'm(add11)': [0, 3, 7, 17],
};

const chordCache = new Map<string, Chord>();

/** Parses symbols like 'Dmaj9', 'E/D', 'Bm7', 'F#m7b5', 'Asus4', 'Ebmaj7', 'G6/9'. */
export function chord(sym: string): Chord {
  const hit = chordCache.get(sym);
  if (hit) return hit;
  const [main, slash] = sym.split('/').length > 1 && !sym.endsWith('6/9') ? splitSlash(sym) : [sym, undefined];
  const m = main.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m) throw new Error(`bad chord ${sym}`);
  const root = PC[m[1]];
  const q = QUALITY[m[2]];
  if (!q) throw new Error(`bad chord quality ${sym}`);
  const bass = slash ? PC[slash] : root;
  if (bass === undefined) throw new Error(`bad bass ${sym}`);
  const pcs: number[] = [];
  for (const iv of q) {
    const pc = (root + iv) % 12;
    if (!pcs.includes(pc)) pcs.push(pc);
  }
  const c: Chord = { sym, root, bass, pcs, tones: [...q] };
  chordCache.set(sym, c);
  return c;
}

function splitSlash(sym: string): [string, string | undefined] {
  // handle 'G6/9/B' style too
  if (sym.includes('6/9')) {
    const rest = sym.replace('6/9', '§');
    const [a, b] = rest.split('/');
    return [a.replace('§', '6/9'), b];
  }
  const i = sym.lastIndexOf('/');
  return [sym.slice(0, i), sym.slice(i + 1)];
}

export function pcOf(m: number): number {
  return ((m % 12) + 12) % 12;
}

/** Chord-tone MIDI notes within [lo, hi]. */
export function chordTones(c: Chord, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = Math.ceil(lo); m <= hi; m++) if (c.pcs.includes(pcOf(m))) out.push(m);
  return out;
}

/** Nearest chord tone to m (prefers below on ties). */
export function nearestChordTone(c: Chord, m: number): number {
  for (let d = 0; d < 12; d++) {
    if (c.pcs.includes(pcOf(m - d))) return m - d;
    if (c.pcs.includes(pcOf(m + d))) return m + d;
  }
  return m;
}

/** Lowest MIDI of the chord's bass pitch class in [lo, lo+11]. */
export function bassNote(c: Chord, lo: number): number {
  let m = lo;
  while (pcOf(m) !== c.bass) m++;
  return m;
}

/**
 * Smooth voice leading: moves each previous voice to a near chord tone, then makes sure the
 * essential tones (3rd, then root/5th/7th) are present. Returns sorted voicing.
 */
export function voiceLead(prev: number[] | null, c: Chord, lo: number, hi: number, n: number): number[] {
  const cands = chordTones(c, lo, hi);
  if (!cands.length) return [];
  let voices: number[];
  if (!prev || prev.length !== n) {
    // close-ish voicing starting around the lower third of the range
    const start = lo + Math.round((hi - lo) * 0.3);
    voices = [];
    const order = priorityPcs(c);
    let m = start;
    let k = 0;
    while (voices.length < n && m <= hi + 24) {
      const want = order[k % order.length];
      while (pcOf(m) !== want) m++;
      voices.push(m);
      m++;
      k++;
    }
    voices = voices.map((v) => (v > hi ? v - 12 : v));
  } else {
    voices = prev.map((p) => {
      let best = cands[0];
      for (const x of cands) if (Math.abs(x - p) < Math.abs(best - p)) best = x;
      return best;
    });
  }
  // remove unisons
  voices.sort((a, b) => a - b);
  for (let i = 1; i < voices.length; i++) {
    if (voices[i] <= voices[i - 1]) {
      const up = cands.find((x) => x > voices[i - 1]);
      voices[i] = up ?? voices[i] + 12;
    }
  }
  // ensure essential pitch classes
  const essentials = priorityPcs(c).slice(0, Math.min(n, c.pcs.length >= 4 ? 4 : 3));
  for (const pc of essentials) {
    if (voices.some((v) => pcOf(v) === pc)) continue;
    // find a doubled pitch class voice to move
    let bestI = -1;
    let bestM = 0;
    let bestCost = Infinity;
    for (let i = 0; i < voices.length; i++) {
      const vpc = pcOf(voices[i]);
      const dup = voices.filter((v) => pcOf(v) === vpc).length > 1;
      const isEss = essentials.includes(vpc);
      if (!dup && isEss) continue;
      for (const x of cands) {
        if (pcOf(x) !== pc || voices.includes(x)) continue;
        const cost = Math.abs(x - voices[i]);
        if (cost < bestCost) {
          bestCost = cost;
          bestI = i;
          bestM = x;
        }
      }
    }
    if (bestI >= 0) voices[bestI] = bestM;
  }
  voices.sort((a, b) => a - b);
  return voices.filter((v) => v >= lo - 12 && v <= hi + 12);
}

/** Pitch classes in voicing priority: 3rd, 7th, root, 5th, tensions. */
function priorityPcs(c: Chord): number[] {
  const byIv = (iv: number) => c.tones.find((t) => t % 12 === iv);
  const order: number[] = [];
  const add = (iv: number | undefined) => {
    if (iv === undefined) return;
    const pc = (c.root + iv) % 12;
    if (!order.includes(pc)) order.push(pc);
  };
  add(0);
  add(byIv(3) ?? byIv(4) ?? byIv(2) ?? byIv(5));
  add(byIv(10) ?? byIv(11) ?? byIv(9));
  add(byIv(7) ?? byIv(6) ?? byIv(8));
  for (const t of c.tones) add(t);
  // reorder: 3rd and 7th first (colour), then root, 5th, tensions
  const [root, third, seventh, ...rest] = order;
  return [third, seventh, root, ...rest].filter((x) => x !== undefined);
}
