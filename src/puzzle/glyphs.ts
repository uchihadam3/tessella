/**
 * Canvas drawing of every glyph. Each language has its own silhouette so mixed panels stay
 * readable at a glance. `ink` adapts to the tile underneath (dark ink on lit tiles, ivory on dark).
 */
import type { EchoDir, GemColor, Glyph, TwinSymbol } from './types';

export const GEM_RGB: Record<GemColor, [string, string, string]> = {
  // [light facet, base, dark facet]
  amber: ['#ffe08a', '#f5a524', '#b86a0e'],
  azure: ['#a8dcff', '#3a8ff0', '#1d4fa8'],
  crimson: ['#ff9aa0', '#e2343f', '#8f1420'],
  jade: ['#a6f5c2', '#2fbf6a', '#147040'],
  ivory: ['#ffffff', '#ebe6da', '#a9a294'],
  violet: ['#e2c3ff', '#9a5af0', '#5a2aa6'],
};

export interface InkStyle {
  fill: string;
  stroke: string;
  accent: string;
}

export const INK_ON_DARK: InkStyle = { fill: '#f6f0e1', stroke: 'rgba(0,0,0,0.65)', accent: '#ffd88a' };
export const INK_ON_LIT: InkStyle = { fill: '#1b1a22', stroke: 'rgba(255,255,255,0.55)', accent: '#5a3a10' };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export { roundRect };

function numeral(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, size: number, ink: InkStyle) {
  ctx.save();
  ctx.font = `700 ${Math.round(size)}px "Cormorant Garamond", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.strokeStyle = ink.stroke;
  ctx.strokeText(String(n), cx, cy + size * 0.04);
  ctx.fillStyle = ink.fill;
  ctx.fillText(String(n), cx, cy + size * 0.04);
  ctx.restore();
}

export function drawGem(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: GemColor) {
  const [lt, base, dk] = GEM_RGB[color];
  const w = s * 0.42, h = s * 0.5, crown = s * 0.12;
  ctx.save();
  ctx.lineJoin = 'round';
  // shadow
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = s * 0.08;
  ctx.shadowOffsetY = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - crown);
  ctx.lineTo(cx - w * 0.55, cy - h * 0.62);
  ctx.lineTo(cx + w * 0.55, cy - h * 0.62);
  ctx.lineTo(cx + w, cy - crown);
  ctx.lineTo(cx, cy + h * 0.78);
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // facets
  ctx.fillStyle = lt;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, cy - h * 0.62);
  ctx.lineTo(cx + w * 0.55, cy - h * 0.62);
  ctx.lineTo(cx + w * 0.3, cy - crown);
  ctx.lineTo(cx - w * 0.3, cy - crown);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.3, cy - crown);
  ctx.lineTo(cx + w, cy - crown);
  ctx.lineTo(cx, cy + h * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = lt;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - crown);
  ctx.lineTo(cx - w * 0.3, cy - crown);
  ctx.lineTo(cx, cy + h * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(20,14,10,0.85)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - crown);
  ctx.lineTo(cx - w * 0.55, cy - h * 0.62);
  ctx.lineTo(cx + w * 0.55, cy - h * 0.62);
  ctx.lineTo(cx + w, cy - crown);
  ctx.lineTo(cx, cy + h * 0.78);
  ctx.closePath();
  ctx.moveTo(cx - w, cy - crown);
  ctx.lineTo(cx + w, cy - crown);
  ctx.stroke();
  // sparkle
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(cx - w * 0.25, cy - h * 0.42, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMeasure(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, n: number, ink: InkStyle) {
  ctx.save();
  const r = s * 0.36;
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.strokeStyle = ink.stroke;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = ink.fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // seed dots around the ring
  ctx.fillStyle = ink.fill;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 1.22, cy + Math.sin(a) * r * 1.22, s * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  numeral(ctx, n, cx, cy, s * (n >= 10 ? 0.4 : 0.5), ink);
  ctx.restore();
}

export function drawMold(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, cells: [number, number][], free: boolean | undefined, ink: InkStyle) {
  const h = Math.max(...cells.map((c) => c[0])) + 1;
  const w = Math.max(...cells.map((c) => c[1])) + 1;
  const span = Math.max(w, h);
  const box = s * (free ? 0.5 : 0.62);
  const u = box / span;
  const ox = cx - (w * u) / 2, oy = cy - (h * u) / 2;
  ctx.save();
  for (const [r, c] of cells) {
    const x = ox + c * u, y = oy + r * u;
    roundRect(ctx, x + u * 0.06, y + u * 0.06, u * 0.88, u * 0.88, u * 0.15);
    ctx.fillStyle = ink.fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, u * 0.12);
    ctx.strokeStyle = ink.stroke;
    ctx.stroke();
  }
  if (free) {
    ctx.lineWidth = Math.max(1.2, s * 0.035);
    ctx.strokeStyle = ink.fill;
    const r = s * 0.4;
    for (let k = 0; k < 2; k++) {
      const a0 = k * Math.PI + 0.25, a1 = a0 + Math.PI - 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
      // arrow head
      const ax = cx + Math.cos(a1) * r, ay = cy + Math.sin(a1) * r;
      const tx = -Math.sin(a1), ty = Math.cos(a1);
      ctx.beginPath();
      ctx.moveTo(ax + tx * s * 0.07, ay + ty * s * 0.07);
      ctx.lineTo(ax + Math.cos(a1) * s * 0.06, ay + Math.sin(a1) * s * 0.06);
      ctx.lineTo(ax - Math.cos(a1) * s * 0.06, ay - Math.sin(a1) * s * 0.06);
      ctx.closePath();
      ctx.fillStyle = ink.fill;
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawContour(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, n: number, ink: InkStyle) {
  ctx.save();
  const half = s * 0.32;
  // corner brackets
  ctx.lineCap = 'round';
  const L = half * 0.55;
  const corners: [number, number, number, number][] = [[-1, -1, 1, 1], [1, -1, -1, 1], [-1, 1, 1, -1], [1, 1, -1, -1]];
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass === 0 ? Math.max(2, s * 0.085) : Math.max(1, s * 0.045);
    ctx.strokeStyle = pass === 0 ? ink.stroke : ink.fill;
    for (const [sx, sy, dx, dy] of corners) {
      const x = cx + sx * half, y = cy + sy * half;
      ctx.beginPath();
      ctx.moveTo(x + dx * L, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * L);
      ctx.stroke();
    }
    // tally bars
    const gap = s * 0.12;
    const total = (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const x = cx - total / 2 + i * gap;
      ctx.beginPath();
      ctx.moveTo(x, cy - half * 0.55);
      ctx.lineTo(x, cy + half * 0.55);
      ctx.lineWidth = pass === 0 ? Math.max(3, s * 0.11) : Math.max(1.5, s * 0.065);
      ctx.stroke();
    }
    if (n === 0) {
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.3, cy);
      ctx.lineTo(cx + half * 0.3, cy);
      ctx.lineWidth = pass === 0 ? Math.max(2, s * 0.06) : Math.max(1, s * 0.03);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawMosaic(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, n: number, ink: InkStyle) {
  ctx.save();
  const step = s * 0.24;
  ctx.fillStyle = ink.fill;
  ctx.globalAlpha = 0.65;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      ctx.beginPath();
      roundRect(ctx, cx + i * step - s * 0.05, cy + j * step - s * 0.05, s * 0.1, s * 0.1, s * 0.02);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = ink.fill;
  roundRect(ctx, cx - step * 1.55, cy - step * 1.55, step * 3.1, step * 3.1, s * 0.06);
  ctx.stroke();
  numeral(ctx, n, cx, cy, s * 0.42, ink);
  ctx.restore();
}

export function drawBeacon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, n: number, ink: InkStyle) {
  ctx.save();
  // four sight rays
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? ink.stroke : ink.accent;
    ctx.lineWidth = pass === 0 ? Math.max(3, s * 0.09) : Math.max(1.5, s * 0.05);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.27, cy + Math.sin(a) * s * 0.27);
      ctx.lineTo(cx + Math.cos(a) * s * 0.44, cy + Math.sin(a) * s * 0.44);
      ctx.stroke();
    }
  }
  // lamp ring
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = ink === INK_ON_LIT ? 'rgba(40,28,8,0.85)' : 'rgba(255,214,120,0.18)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.strokeStyle = ink.accent;
  ctx.stroke();
  numeral(ctx, n, cx, cy, s * 0.34, ink === INK_ON_LIT ? { ...INK_ON_DARK, fill: '#ffe7a8' } : { ...ink, fill: '#ffe7a8' });
  ctx.restore();
}

function symbolPath(ctx: CanvasRenderingContext2D, sym: TwinSymbol, cx: number, cy: number, s: number) {
  const r = s * 0.3;
  ctx.beginPath();
  switch (sym) {
    case 'moon':
      ctx.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.65, false);
      ctx.arc(cx + r * 0.45, cy - r * 0.1, r * 0.78, Math.PI * 1.45, Math.PI * 0.55, true);
      ctx.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r * 1.1 : r * 0.45;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case 'leaf':
      ctx.moveTo(cx - r * 0.9, cy + r * 0.8);
      ctx.quadraticCurveTo(cx - r * 1.0, cy - r * 0.9, cx + r * 0.95, cy - r * 0.95);
      ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.85, cx - r * 0.9, cy + r * 0.8);
      ctx.closePath();
      break;
    case 'drop':
      ctx.moveTo(cx, cy - r * 1.15);
      ctx.bezierCurveTo(cx + r * 0.3, cy - r * 0.5, cx + r * 0.95, cy + r * 0.05, cx + r * 0.75, cy + r * 0.55);
      ctx.arc(cx, cy + r * 0.35, r * 0.78, Math.PI * 0.05, Math.PI * 0.95);
      ctx.bezierCurveTo(cx - r * 0.95, cy + r * 0.05, cx - r * 0.3, cy - r * 0.5, cx, cy - r * 1.15);
      ctx.closePath();
      break;
    case 'sun':
      // spiral-like sun: circle with a notch (asymmetric so mirroring is visible)
      ctx.arc(cx, cy, r * 0.62, 0.35, Math.PI * 2 - 0.35);
      ctx.lineTo(cx + r * 1.05, cy - r * 0.15);
      ctx.lineTo(cx + r * 1.05, cy + r * 0.15);
      ctx.closePath();
      break;
    case 'wave':
      ctx.moveTo(cx - r * 1.1, cy + r * 0.2);
      ctx.bezierCurveTo(cx - r * 0.6, cy - r * 0.9, cx - r * 0.1, cy - r * 0.9, cx + r * 0.05, cy - r * 0.1);
      ctx.bezierCurveTo(cx + r * 0.2, cy + r * 0.5, cx + r * 0.7, cy + r * 0.5, cx + r * 1.1, cy - r * 0.35);
      ctx.lineTo(cx + r * 1.1, cy + r * 0.25);
      ctx.bezierCurveTo(cx + r * 0.7, cy + r * 1.0, cx + r * 0.1, cy + r * 1.0, cx - r * 0.1, cy + r * 0.3);
      ctx.bezierCurveTo(cx - r * 0.3, cy - r * 0.3, cx - r * 0.7, cy - r * 0.2, cx - r * 1.1, cy + r * 0.75);
      ctx.closePath();
      break;
  }
}

export function drawTwin(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, sym: TwinSymbol, mirror: boolean | undefined, ink: InkStyle) {
  ctx.save();
  if (mirror) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }
  symbolPath(ctx, sym, cx, cy, s);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.strokeStyle = ink.stroke;
  ctx.stroke();
  ctx.fillStyle = ink === INK_ON_LIT ? '#2a2440' : '#dfe6ff';
  ctx.fill();
  ctx.restore();
  if (mirror) {
    // the mirror mark: a thin vertical line with two ticks beside the symbol
    ctx.save();
    const x = cx + s * 0.42;
    ctx.strokeStyle = ink.stroke;
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, cy - s * 0.3);
    ctx.lineTo(x, cy + s * 0.3);
    ctx.stroke();
    ctx.strokeStyle = ink === INK_ON_LIT ? '#2a2440' : '#dfe6ff';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph, cx: number, cy: number, s: number, lit: boolean) {
  const ink = lit ? INK_ON_LIT : INK_ON_DARK;
  switch (g.kind) {
    case 'gem': return drawGem(ctx, cx, cy, s, g.color);
    case 'measure': return drawMeasure(ctx, cx, cy, s, g.n, ink);
    case 'mold': return drawMold(ctx, cx, cy, s, g.cells, g.free, ink);
    case 'contour': return drawContour(ctx, cx, cy, s, g.n, ink);
    case 'mosaic': return drawMosaic(ctx, cx, cy, s, g.n, ink);
    case 'beacon': return drawBeacon(ctx, cx, cy, s, g.n, ink);
    case 'twin': return drawTwin(ctx, cx, cy, s, g.symbol, g.mirror, ink);
  }
}

/** Small marks on the tile edges showing which tiles echo when this one is pressed. */
export function drawEcho(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dirs: EchoDir[], lit: boolean) {
  ctx.save();
  const col = lit ? 'rgba(20,30,40,0.85)' : 'rgba(150,240,255,0.95)';
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  const cx = x + size / 2, cy = y + size / 2;
  const t = size * 0.09;
  for (const d of dirs) {
    if (d === 'row' || d === 'col') {
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.setLineDash([size * 0.06, size * 0.05]);
      ctx.beginPath();
      if (d === 'row') {
        ctx.moveTo(x + size * 0.08, cy + size * 0.36);
        ctx.lineTo(x + size * 0.92, cy + size * 0.36);
      } else {
        ctx.moveTo(cx + size * 0.36, y + size * 0.08);
        ctx.lineTo(cx + size * 0.36, y + size * 0.92);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const dx = d.includes('e') ? 1 : d.includes('w') ? -1 : 0;
    const dy = d.includes('s') ? 1 : d.includes('n') ? -1 : 0;
    const px = cx + dx * size * 0.42, py = cy + dy * size * 0.42;
    // small triangle pointing outwards
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(ang) * t, py + Math.sin(ang) * t);
    ctx.lineTo(px + Math.cos(ang + 2.3) * t, py + Math.sin(ang + 2.3) * t);
    ctx.lineTo(px + Math.cos(ang - 2.3) * t, py + Math.sin(ang - 2.3) * t);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
