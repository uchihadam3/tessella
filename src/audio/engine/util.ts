/** Small shared helpers for the audio engine. */

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db: number): number => Math.pow(10, db / 20);

export function rand(a = 0, b = 1): number {
  return a + Math.random() * (b - a);
}
export function randInt(a: number, b: number): number {
  return Math.floor(a + Math.random() * (b - a + 1));
}
export function chance(p: number): boolean {
  return Math.random() < p;
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
/** Weighted pick: items [value, weight]. */
export function wpick<T>(items: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = Math.random() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

let warned = 0;
/** Logs at most a handful of audio errors so a broken voice never spams or throws. */
export function report(where: string, e: unknown): void {
  if (warned < 8) {
    warned++;
    console.warn(`[audio] ${where}:`, e);
  }
}

/** Wraps a function so it never throws (audio must never break the game). */
export function guard<A extends unknown[], R>(where: string, fn: (...a: A) => R, fallback?: R): (...a: A) => R {
  return (...a: A): R => {
    try {
      return fn(...a);
    } catch (e) {
      report(where, e);
      return fallback as R;
    }
  };
}

/** Sets an AudioParam immediately in a click-free way. */
export function setNow(p: AudioParam, v: number, t: number, tau = 0.02): void {
  p.cancelScheduledValues(t);
  p.setTargetAtTime(v, t, tau);
}

/** Exponential-ish ramp safe for zero targets. */
export function rampTo(p: AudioParam, v: number, t0: number, t1: number): void {
  p.cancelScheduledValues(t0);
  p.setValueAtTime(p.value, t0);
  p.linearRampToValueAtTime(v, t1);
}

export function disconnectAll(nodes: (AudioNode | null | undefined)[]): void {
  for (const n of nodes) {
    if (!n) continue;
    try {
      n.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}
