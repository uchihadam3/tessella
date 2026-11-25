/**
 * The 150 constellation drawings — one line drawing per constellation, themed to its place.
 *
 * Coordinates are on paper: x to the right, z downward (z = screen y). Strokes: "x,z x,z ...;
 * x,z ..." — equal coordinates are the same star, consecutive points are joined by a thread.
 * `bell` is the orb's spot (an eye, the centre of a wheel, inside a shape).
 * Readability rules: tools/lib/drawing-rules.ts (checked by tools/art-check.ts and the tests).
 */
import type { AreaId } from '../../src/data/areas';
import { parseStrokes, type P } from './drawing-rules';

export interface Art {
  area: AreaId;
  name: { pt: string; en: string };
  strokes: string;
  bell: P;
}

const A = (area: AreaId, pt: string, en: string, strokes: string, bell: P): Art => ({ area, name: { pt, en }, strokes, bell });

export const ART: Art[] = [
  // ── O Despertar (praia) ──────────────────────────────────────────────
  A('prologue', 'Gaivota', 'Gull', '0,4 3,1.5 6,4 9,1.5 12,4', [6, 1.7]),
  A('prologue', 'Veleiro', 'Sailboat', '5,0.5 9,4.5 5,7 5,0.5; 1,7 5,7 11,7 9.5,9 2.5,9 1,7', [6.4, 4.3]),
  A('prologue', 'Concha', 'Scallop shell', '1,5 3.5,1.8 6,0.8 8.5,1.8 11,5; 6,10 1,5; 6,10 3.5,1.8; 6,10 8.5,1.8; 6,10 11,5', [6, 3.8]),
  A('prologue', 'Guarda-sol', 'Beach umbrella', '1,5 6,0.5 11,5 6,4.2 1,5; 6,0.5 6,4.2 6,10', [8.6, 7.4]),

  // ── Pátio das Nove Luzes ─────────────────────────────────────────────
  A('hub', 'Estrela', 'Star', STAR(6, 6, 6, 2.6, 5) + '; ' + POLY(6, 6, 2.6, 5, -90 + 36), [6, 6]),
  A('hub', 'Coração', 'Heart', '6,11 1.6,6.8 0.8,3.6 2.6,1.2 4.8,1.4 6,3.2 7.2,1.4 9.4,1.2 11.2,3.6 10.4,6.8 6,11', [6, 5.6]),
  A('hub', 'Ampulheta', 'Hourglass', '2.5,1.5 9.5,1.5 7,6 5,6 2.5,1.5; 5,6 3.61,8.5 2.5,10.5 9.5,10.5 8.39,8.5 7,6; 3.61,8.5 8.39,8.5', [6, 3.6]),
  A('hub', 'Mão', 'Hand', '3.2,11.5 2.2,8.6 3.2,5 5,4.4 7,4.4 8.8,5 8.6,11.5 3.2,11.5; 2.2,8.6 0.4,5.6; 3.2,5 2.4,1; 5,4.4 4.6,0.2; 7,4.4 7,0.4; 8.8,5 9.4,1.6', [6, 8]),
  A('hub', 'Espiral', 'Spiral', SPIRAL(6, 6, 1.7, 0.62, 0, 10, 62), [6, 6]),
  A('hub', 'Árvore', 'Tree', '6,12 6,8 3.2,5.6 1.2,3.4; 3.2,5.6 3.6,2.4; 6,8 8.8,5.6 10.8,3.4; 8.8,5.6 8.4,2.4; 6,8 6,4.2 6,1; 6,12 4,12.8; 6,12 8,12.8', [4.7, 5.2]),
  A('hub', 'Vela', 'Candle', '2.2,12 4,12 8,12 9.8,12; 4,12 4,7 6,7 8,7 8,12; 6,7 6,5.6 3.8,4 6,0.4 8.2,4 6,5.6', [6, 3.4]),
  A('hub', 'Balança', 'Scales', '1,3.5 6,2 11,3.5; 6,2 6,12; 4,12 6,12 8,12; 1,3.5 -1,8.4 4,8.4 1,3.5; 11,3.5 8,8.4 13,8.4 11,3.5', [1.4, 6.9]),
  A('hub', 'Infinito', 'Infinity', '6,6 4,3.6 1.8,3.4 0.4,6 1.8,8.6 4,8.4 6,6 8,3.6 10.2,3.4 11.6,6 10.2,8.6 8,8.4 6,6', [2.3, 6]),
  A('hub', 'Lanterna', 'Lantern', '5,0.3 7,0.3 6,2 5,0.3; 6,2 2.6,4.2 9.4,4.2 6,2; 2.6,4.2 3.8,10.2 8.2,10.2 9.4,4.2; 3.8,10.2 3,11.6 9,11.6 8.2,10.2', [6, 7.2]),
];

/** A star outline (n points) centred at (cx,cz): outer radius R, inner radius r. */
function STAR(cx: number, cz: number, R: number, r: number, n: number): string {
  const pts: string[] = [];
  for (let k = 0; k <= 2 * n; k++) {
    const a = ((-90 + (k * 180) / n) * Math.PI) / 180;
    const rad = k % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cz + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** A closed regular polygon (n points) at angle a0 (degrees). */
function POLY(cx: number, cz: number, r: number, n: number, a0: number): string {
  const pts: string[] = [];
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + (k * 360) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cz + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** An Archimedean spiral polyline: radius r0 + b·θ, from step k0 to k1 of `deg` degrees. */
function SPIRAL(cx: number, cz: number, r0: number, b: number, k0: number, k1: number, deg: number): string {
  const pts: string[] = [];
  for (let k = k0; k <= k1; k++) {
    const t = (k * deg * Math.PI) / 180;
    const rad = r0 + b * t;
    pts.push(`${(cx + rad * Math.cos(t)).toFixed(2)},${(cz + rad * Math.sin(t)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function artDrawing(a: Art): { pts: P[]; edges: [number, number][] } {
  return parseStrokes(a.strokes);
}
