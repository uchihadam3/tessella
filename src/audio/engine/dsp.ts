/**
 * Pure DSP (no Web Audio objects): instrument renderers, impulse responses, noise.
 * Runs in the render worker (off the main thread) and as a main-thread fallback.
 */
import { clamp, mtof } from './util';

export type BufInst =
  | 'piano' | 'epiano' | 'harp' | 'guitar' | 'koto' | 'oud' | 'pizz' | 'harpsi'
  | 'kalimba' | 'marimba' | 'celesta' | 'glass' | 'bell' | 'tile' | 'wood';

export interface Rendered {
  data: Float32Array;
  sr: number;
}

interface InstSpec {
  lo: number;
  hi: number;
  step: number;
  render: (midi: number) => Rendered;
}

/** Additive synthesis with phasor recurrences (fast, accurate). partials: [ratio, amp, tau, cents] */
function additive(
  sr: number,
  dur: number,
  f0: number,
  partials: [number, number, number, number?][],
  opt: { attack?: number; noise?: number; noiseTau?: number; noiseLp?: number } = {},
): Float32Array {
  const n = Math.max(16, Math.floor(sr * dur));
  const out = new Float32Array(n);
  for (const [ratio, amp, tau, cents = 0] of partials) {
    const f = f0 * ratio * Math.pow(2, cents / 1200);
    if (f >= sr * 0.46 || amp <= 0) continue;
    const w = (2 * Math.PI * f) / sr;
    const c = Math.cos(w);
    const s = Math.sin(w);
    const ph = Math.random() * Math.PI * 2;
    let x = Math.cos(ph);
    let y = Math.sin(ph);
    let env = amp;
    const k = Math.exp(-1 / (Math.max(0.002, tau) * sr));
    for (let i = 0; i < n; i++) {
      out[i] += env * y;
      const nx = x * c - y * s;
      y = x * s + y * c;
      x = nx;
      env *= k;
      if (env < 2e-5) break;
    }
  }
  if (opt.noise) {
    const k = Math.exp(-1 / ((opt.noiseTau ?? 0.004) * sr));
    const a = 1 - Math.exp((-2 * Math.PI * (opt.noiseLp ?? 3000)) / sr);
    let env = opt.noise;
    let lp = 0;
    for (let i = 0; i < n && env > 1e-5; i++) {
      lp += a * (Math.random() * 2 - 1 - lp);
      out[i] += lp * env;
      env *= k;
    }
  }
  finish(out, sr, opt.attack ?? 0.002);
  return out;
}

/** Attack ramp, peak normalisation to 0.9 and an end fade. */
function finish(out: Float32Array, sr: number, attack: number): void {
  const na = Math.max(1, Math.floor(attack * sr));
  for (let i = 0; i < na && i < out.length; i++) out[i] *= i / na;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const v = Math.abs(out[i]);
    if (v > peak) peak = v;
  }
  if (peak > 0) {
    const g = 0.9 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  const nf = Math.min(out.length, Math.floor(0.03 * sr));
  for (let i = 0; i < nf; i++) out[out.length - 1 - i] *= i / nf;
}

/** Karplus-Strong pluck, tuned exactly by choosing the buffer sample rate. */
function ks(
  f0: number,
  o: { dur: number; t60: number; bright: number; pick: number; srTarget?: number; nasal?: number; soft?: number },
): Rendered {
  const target = o.srTarget ?? 32000;
  const N = Math.max(4, Math.round(target / f0 - 0.5));
  const sr = clamp((N + 0.5) * f0, 8000, 96000);
  const len = Math.floor(sr * o.dur);
  const y = new Float32Array(len);
  // excitation
  const exc = new Float32Array(N);
  const a = 0.08 + 0.92 * o.bright;
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < N; i++) {
    lp += a * (Math.random() * 2 - 1 - lp);
    exc[i] = lp;
    mean += lp;
  }
  mean /= N;
  for (let i = 0; i < N; i++) exc[i] -= mean;
  const p = Math.max(1, Math.round(o.pick * N));
  const orig = exc.slice();
  for (let i = p; i < N; i++) exc[i] = orig[i] - orig[i - p];
  for (let i = 0; i < N && i < len; i++) y[i] = exc[i];
  const g = Math.pow(0.001, 1 / (f0 * o.t60));
  const S = 0.5;
  for (let i = N; i < len; i++) {
    const a1 = y[i - N];
    const a2 = i - N - 1 >= 0 ? y[i - N - 1] : 0;
    y[i] = g * (S * a1 + (1 - S) * a2);
  }
  // gentle post filtering: soft lowpass (nylon) and/or nasal resonance (oud)
  if (o.soft) {
    const k = 1 - Math.exp((-2 * Math.PI * o.soft) / sr);
    let z = 0;
    for (let i = 0; i < len; i++) {
      z += k * (y[i] - z);
      y[i] = z;
    }
  }
  if (o.nasal) {
    // RBJ peaking EQ at o.nasal Hz, +7 dB, Q 1.4
    const w0 = (2 * Math.PI * o.nasal) / sr;
    const A = Math.pow(10, 7 / 40);
    const alpha = Math.sin(w0) / (2 * 1.4);
    const b0 = 1 + alpha * A, b1 = -2 * Math.cos(w0), b2 = 1 - alpha * A;
    const a0 = 1 + alpha / A, a1c = -2 * Math.cos(w0), a2c = 1 - alpha / A;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = y[i];
      const v = (b0 * x + b1 * x1 + b2 * x2 - a1c * y1 - a2c * y2) / a0;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
  }
  finish(y, sr, 0.0008);
  return { data: y, sr };
}

export const SPECS: Record<BufInst, InstSpec> = {
  piano: {
    lo: 33, hi: 100, step: 3,
    render: (m) => {
      const f0 = mtof(m);
      const sr = m < 84 ? 24000 : 32000;
      const tau1 = clamp(3.4 * Math.pow(2, -(m - 48) / 22), 0.7, 5.2);
      const B = 0.00018 + 0.0007 * Math.max(0, (m - 72) / 24);
      const np = Math.max(3, Math.min(14, Math.floor(5200 / f0)));
      const partials: [number, number, number, number?][] = [];
      for (let k = 1; k <= np; k++) {
        const ratio = k * Math.sqrt(1 + B * k * k);
        const felt = 1 / (1 + Math.pow((k * f0) / 1700, 2));
        const amp = (1 / Math.pow(k, 1.15)) * felt * (k === 1 ? 1.1 : 1);
        const tau = tau1 / (1 + 0.22 * (k - 1) + (k * f0) / 3500);
        partials.push([ratio, amp * 0.6, tau * 0.42, 0.4]);
        partials.push([ratio, amp * 0.42, tau * 1.15, -0.4]);
      }
      const dur = Math.min(5, tau1 * 1.4 + 0.4);
      return { data: additive(sr, dur, f0, partials, { attack: 0.0025, noise: 0.05, noiseTau: 0.005, noiseLp: 1400 }), sr };
    },
  },
  epiano: {
    lo: 40, hi: 96, step: 4,
    render: (m) => {
      const f = mtof(m);
      const sr = 28000;
      const dur = clamp(3.6 - (m - 48) * 0.03, 1.4, 3.6);
      const n = Math.floor(sr * dur);
      const out = new Float32Array(n);
      const tauC = clamp(2.2 - (m - 48) * 0.02, 0.8, 2.4);
      const I0 = 1.6;
      const tine = f * 7 < sr * 0.45;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const I = I0 * Math.exp(-t / 0.35) + 0.25;
        const ph = 2 * Math.PI * f * t;
        out[i] =
          Math.sin(ph + I * Math.sin(ph)) * Math.exp(-t / tauC) +
          (tine ? 0.12 * Math.sin(ph * 7.0) * Math.exp(-t / 0.012) : 0) +
          0.18 * Math.sin(ph * 2) * Math.exp(-t / 0.4);
      }
      finish(out, sr, 0.002);
      return { data: out, sr };
    },
  },
  harp: { lo: 36, hi: 100, step: 4, render: (m) => ks(mtof(m), { dur: clamp(5 - (m - 48) * 0.05, 1.6, 5), t60: clamp(4.2 - (m - 48) * 0.06, 1.2, 4.5), bright: 0.55, pick: 0.3, soft: 5000 }) },
  guitar: { lo: 38, hi: 88, step: 4, render: (m) => ks(mtof(m), { dur: clamp(4 - (m - 45) * 0.05, 1.4, 4), t60: clamp(3.2 - (m - 45) * 0.05, 0.9, 3.4), bright: 0.32, pick: 0.17, soft: 3200 }) },
  koto: { lo: 48, hi: 96, step: 4, render: (m) => ks(mtof(m), { dur: clamp(3.2 - (m - 55) * 0.03, 1.2, 3.2), t60: clamp(2.6 - (m - 55) * 0.03, 0.9, 2.8), bright: 0.75, pick: 0.1, soft: 6500 }) },
  oud: { lo: 40, hi: 84, step: 4, render: (m) => ks(mtof(m), { dur: clamp(2.2 - (m - 50) * 0.02, 0.9, 2.2), t60: clamp(1.7 - (m - 50) * 0.02, 0.6, 1.8), bright: 0.62, pick: 0.12, nasal: 850, soft: 4200 }) },
  pizz: { lo: 28, hi: 88, step: 4, render: (m) => ks(mtof(m), { dur: 0.9, t60: clamp(0.65 - (m - 40) * 0.006, 0.25, 0.7), bright: 0.3, pick: 0.24, soft: 2400 }) },
  harpsi: { lo: 36, hi: 96, step: 4, render: (m) => ks(mtof(m), { dur: clamp(2.6 - (m - 48) * 0.02, 1.2, 2.6), t60: clamp(2.1 - (m - 48) * 0.025, 0.8, 2.2), bright: 0.96, pick: 0.07, soft: 9000 }) },
  kalimba: {
    lo: 48, hi: 100, step: 4,
    render: (m) => {
      const f = mtof(m);
      const tau = clamp(1.5 - (m - 60) * 0.015, 0.5, 1.6);
      return { data: additive(32000, tau * 2.2, f, [[1, 1, tau], [2.0, 0.05, 0.35], [5.4, 0.2, 0.07], [9.6, 0.05, 0.03]], { noise: 0.05, noiseTau: 0.002, noiseLp: 4000 }), sr: 32000 };
    },
  },
  marimba: {
    lo: 40, hi: 100, step: 4,
    render: (m) => {
      const f = mtof(m);
      const tau = clamp(1.0 - (m - 55) * 0.012, 0.18, 1.1);
      return { data: additive(28000, tau * 2.6 + 0.1, f, [[1, 1, tau], [3.93, 0.32, tau * 0.14], [9.2, 0.1, 0.035]], { noise: 0.06, noiseTau: 0.003, noiseLp: 2000 }), sr: 28000 };
    },
  },
  celesta: {
    lo: 55, hi: 108, step: 4,
    render: (m) => {
      const f = mtof(m);
      const tau = clamp(1.6 - (m - 72) * 0.015, 0.5, 1.8);
      return { data: additive(36000, tau * 2.4, f, [[1, 1, tau], [2.0, 0.22, tau * 0.35], [3.0, 0.07, tau * 0.18], [4.16, 0.05, 0.08]], { noise: 0.03, noiseTau: 0.0015, noiseLp: 6000 }), sr: 36000 };
    },
  },
  glass: {
    lo: 52, hi: 108, step: 4,
    render: (m) => {
      const f = mtof(m);
      const tau = clamp(3.0 - (m - 72) * 0.03, 0.9, 3.4);
      return {
        data: additive(36000, tau * 2.2, f, [[1, 1, tau], [2.756, 0.42, tau * 0.5], [5.404, 0.2, tau * 0.25], [8.933, 0.09, tau * 0.12]], { noise: 0.02, noiseTau: 0.001, noiseLp: 7000, attack: 0.003 }),
        sr: 36000,
      };
    },
  },
  bell: {
    lo: 28, hi: 84, step: 4,
    render: (m) => {
      const f = mtof(m);
      const T = clamp(6 - (m - 48) * 0.06, 2.5, 7);
      const P: [number, number, number][] = [
        [0.5, 0.35, T], [1.0, 0.6, T * 0.7], [1.183, 0.45, T * 0.5], [1.506, 0.3, T * 0.42], [2.0, 0.5, T * 0.36],
        [2.514, 0.2, T * 0.24], [2.662, 0.18, T * 0.2], [3.011, 0.14, T * 0.16], [4.166, 0.1, T * 0.1], [5.433, 0.06, T * 0.06],
      ];
      return { data: additive(24000, Math.min(8, T * 1.2), f, P, { noise: 0.04, noiseTau: 0.004, noiseLp: 2500, attack: 0.002 }), sr: 24000 };
    },
  },
  tile: {
    lo: 48, hi: 108, step: 4,
    render: (m) => {
      const f = mtof(m);
      const tau = clamp(0.9 - (m - 72) * 0.01, 0.35, 1.0);
      return { data: additive(36000, tau * 2.2, f, [[1, 1, tau], [2.0, 0.12, tau * 0.3], [4.07, 0.16, tau * 0.13], [6.8, 0.04, 0.04]], { noise: 0.025, noiseTau: 0.0012, noiseLp: 5000 }), sr: 36000 };
    },
  },
  wood: {
    lo: 36, hi: 96, step: 6,
    render: (m) => {
      const f = mtof(m);
      return { data: additive(28000, 0.45, f, [[1, 1, 0.11], [2.45, 0.45, 0.05], [4.6, 0.22, 0.025], [7.1, 0.08, 0.012]], { noise: 0.12, noiseTau: 0.002, noiseLp: 3000 }), sr: 28000 };
    },
  },
};

/** Zone (pitch the buffer is rendered at) used for a MIDI note. */
export function zoneOf(inst: BufInst, midi: number): number {
  const s = SPECS[inst];
  const z = s.lo + Math.round((midi - s.lo) / s.step) * s.step;
  return clamp(z, s.lo, s.lo + Math.floor((s.hi - s.lo) / s.step) * s.step);
}

export function zonesIn(inst: BufInst, lo: number, hi: number): number[] {
  const s = SPECS[inst];
  const out: number[] = [];
  for (let m = Math.max(lo, s.lo); m <= Math.min(hi, s.hi) + s.step; m += s.step) {
    const z = zoneOf(inst, m);
    if (!out.includes(z)) out.push(z);
  }
  return out;
}

export function renderZone(inst: BufInst, zone: number): Rendered {
  return SPECS[inst].render(zone);
}

export type ReverbKind = 'hall' | 'cave' | 'spire';

/** Procedural stereo impulse response (diffuse tail with frequency-dependent damping). */
export function makeImpulseData(mode: ReverbKind, sr: number): [Float32Array, Float32Array] {
  const spec = {
    hall: { len: 2.9, pre: 0.014, decay: 2.3, damp0: 0.55, damp1: 0.12, er: 6, bright: 0.0 },
    cave: { len: 6.5, pre: 0.035, decay: 5.4, damp0: 0.45, damp1: 0.08, er: 10, bright: 0.0 },
    spire: { len: 5.2, pre: 0.03, decay: 4.2, damp0: 0.85, damp1: 0.35, er: 4, bright: 0.25 },
  }[mode];
  const n = Math.floor(sr * spec.len);
  const pre = Math.floor(spec.pre * sr);
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    const d = out[ch];
    let lp = 0;
    let lp2 = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.9 * t) / spec.decay);
      const k = spec.damp1 + (spec.damp0 - spec.damp1) * Math.exp(-t / (spec.decay * 0.35));
      const x = Math.random() * 2 - 1;
      lp += k * (x - lp);
      lp2 += 0.5 * (lp - lp2);
      const fadeIn = Math.min(1, t / 0.02);
      const shimmer = spec.bright > 0 ? spec.bright * Math.sin(t * 1300 + ch) * (x * 0.5) : 0;
      d[i] = (lp2 * 0.85 + lp * 0.15 + shimmer * env) * env * fadeIn;
    }
    for (let e = 0; e < spec.er; e++) {
      const idx = pre + Math.floor((0.004 + Math.random() * 0.07) * sr);
      if (idx < n) d[idx] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - e * 0.03) * 0.6;
    }
    const fade = Math.floor(0.08 * sr);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
  }
  return out;
}

/** Fast seeded noise (xorshift) for loopable noise beds. */
export function makeNoiseData(kind: 'white' | 'pink' | 'brown', n: number, sr: number): Float32Array {
  const d = new Float32Array(n);
  let s = (Math.random() * 0xffffffff) >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
  if (kind === 'white') {
    for (let i = 0; i < n; i++) d[i] = rnd();
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = (last + 0.02 * rnd()) / 1.02;
      d[i] = last * 3.5;
    }
  }
  const xf = Math.min(n >> 1, Math.floor(sr * 0.05));
  for (let i = 0; i < xf; i++) {
    const a = i / xf;
    d[n - xf + i] = d[n - xf + i] * (1 - a) + d[i] * a;
  }
  return d;
}
