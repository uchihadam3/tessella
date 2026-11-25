/**
 * Audio lab — a listening page for every cue, sound effect and ambience layer.
 * Open with `npm run dev` → http://localhost:5173/tools/audio-lab.html
 * Also used by tools/audio-check.mjs for automated level checks.
 */
import { audio } from './index';
import type { AmbienceLayer, MusicCue, SpatialHandle, Surface } from './api';
import { analyzeCue, audioDebug } from './engine/engine';
import type { AreaId } from '../data/areas';

const CUES: MusicCue[] = ['menu', 'prologue', 'hub', 'kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins', 'citadel', 'echo', 'spire', 'silence'];
const AREAS: AreaId[] = ['prologue', 'hub', 'kinship', 'measure', 'mold', 'contour', 'mosaic', 'beacon', 'weave', 'twins', 'citadel', 'echo', 'spire'];
const LAYERS: AmbienceLayer[] = ['wind', 'sea', 'birds', 'stream', 'insects', 'cave', 'leaves', 'night', 'gulls', 'chimes'];
const SURFACES: Surface[] = ['grass', 'stone', 'sand', 'wood', 'gravel', 'water', 'leaves', 'crystal', 'marble'];
const SOURCES = ['waterfall', 'windmill', 'fountain', 'brook', 'surf', 'crystal', 'fire'] as const;

// ───────────── meter (also used by the automated check) ─────────────
const meter = { peak: 0, sum: 0, n: 0, nan: 0 };
const uiMeter = { peak: 0 };
let buf: Float32Array<ArrayBuffer> | null = null;
setInterval(() => {
  const d = audioDebug();
  if (!d) return;
  if (!buf) buf = new Float32Array(d.tap.fftSize);
  d.tap.getFloatTimeDomainData(buf);
  for (let i = 0; i < buf.length; i += 2) {
    const v = buf[i];
    if (Number.isNaN(v)) meter.nan++;
    const a = Math.abs(v);
    if (a > meter.peak) meter.peak = a;
    if (a > uiMeter.peak) uiMeter.peak = a;
    meter.sum += v * v;
    meter.n++;
  }
}, 15);

const lab = {
  audio,
  debug: audioDebug,
  analyze: analyzeCue,
  reset() {
    meter.peak = 0;
    meter.sum = 0;
    meter.n = 0;
    meter.nan = 0;
  },
  read() {
    return { peak: meter.peak, rms: Math.sqrt(meter.sum / Math.max(1, meter.n)), nan: meter.nan, voices: audioDebug()?.voices() ?? {} };
  },
  sources: [] as SpatialHandle[],
};
(window as unknown as { __lab: typeof lab }).__lab = lab;

// ───────────── UI ─────────────
const root = document.getElementById('lab')!;
const h = (tag: string, attrs: Record<string, string> = {}, text = ''): HTMLElement => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
};
const section = (title: string): HTMLElement => {
  const s = h('section');
  s.append(h('h2', {}, title));
  root.append(s);
  return s;
};
const button = (parent: HTMLElement, label: string, fn: () => void, id?: string): HTMLButtonElement => {
  const b = h('button', id ? { id } : {}, label) as HTMLButtonElement;
  b.addEventListener('click', fn);
  parent.append(b);
  return b;
};
const slider = (parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, fn: (v: number) => void): HTMLInputElement => {
  const wrap = h('label', { class: 'slider' });
  const span = h('span', {}, `${label}: ${value}`);
  const inp = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) }) as HTMLInputElement;
  inp.addEventListener('input', () => {
    span.textContent = `${label}: ${inp.value}`;
    fn(Number(inp.value));
  });
  wrap.append(span, inp);
  parent.append(wrap);
  return inp;
};
const select = <T extends string>(parent: HTMLElement, options: readonly T[], value: T): HTMLSelectElement => {
  const s = h('select') as HTMLSelectElement;
  for (const o of options) s.append(h('option', { value: o }, o));
  s.value = value;
  parent.append(s);
  return s;
};

const top = section('Start');
button(top, '▶ Unlock audio', () => void audio.unlock(), 'unlock');
const status = h('span', { class: 'status' }, 'locked');
top.append(status);
setInterval(() => {
  const r = lab.read();
  status.textContent = `${audio.ready ? 'running' : 'locked'} · peak ${uiMeter.peak.toFixed(3)} · voices ${Object.entries(r.voices).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(' ')}`;
  uiMeter.peak = 0;
}, 500);

const vol = { master: 1, music: 0.8, sfx: 0.9, ambience: 0.8 };
const vs = section('Volumes');
for (const k of Object.keys(vol) as (keyof typeof vol)[]) slider(vs, k, 0, 1, 0.01, vol[k], (v) => { vol[k] = v; audio.setVolumes(vol); });

const ms = section('Music');
for (const c of CUES) button(ms, c, () => audio.setMusic(c, 3));
button(ms, 'ENDING', () => audio.playEnding());
button(ms, 'SECRET ENDING', () => audio.playSecretEnding?.());
button(ms, 'duck', () => audio.duck(0.7, 3));
const prog = { totems: 0, citadelDone: false, echoOpen: false, finale: false };
slider(ms, 'totems', 0, 8, 1, 0, (v) => { prog.totems = v; audio.setProgress(prog); });
for (const k of ['citadelDone', 'echoOpen', 'finale'] as const) {
  const l = h('label');
  const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
  cb.addEventListener('change', () => { prog[k] = cb.checked; audio.setProgress(prog); });
  l.append(cb, document.createTextNode(k));
  ms.append(l);
}

const intro = section('Intro');
button(intro, 'studio sting', () => audio.studioSting());
button(intro, 'title (9 tiles + resolve)', () => {
  for (let i = 0; i < 9; i++) setTimeout(() => audio.titleTile(i), i * 330);
  setTimeout(() => audio.titleResolve(), 9 * 330 + 300);
});

const sf = section('SFX');
const areaSel = select(sf, AREAS, 'hub');
let big = 0.5;
slider(sf, 'bigness', 0, 1, 0.05, 0.5, (v) => { big = v; });
button(sf, 'engage', () => audio.panelEngage());
button(sf, 'leave', () => audio.panelLeave());
button(sf, 'solved', () => audio.panelSolved(areaSel.value as AreaId, big));
button(sf, 'failed', () => audio.panelFailed());
button(sf, 'powered', () => audio.panelPowered());
button(sf, 'cable 2s', () => audio.cable(2));
for (const k of ['stone', 'wood', 'light', 'water'] as const) button(sf, `door ${k}`, () => audio.door(k));
button(sf, 'totem', () => audio.totem(areaSel.value as AreaId));
button(sf, 'great unlock', () => audio.greatUnlock());
button(sf, 'secret', () => audio.secretSolved());
button(sf, 'ui hover', () => audio.uiHover());
button(sf, 'ui click', () => audio.uiClick());
button(sf, 'ui back', () => audio.uiBack());
button(sf, 'achievement', () => audio.achievement());
button(sf, 'save', () => audio.save());

const tiles = section('Tiles (click to toggle — drag across for speed)');
const grid = h('div', { class: 'grid' });
tiles.append(grid);
let dragging = false;
window.addEventListener('mouseup', () => { dragging = false; });
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const cell = h('div', { class: 'cell' });
    let on = false;
    const toggle = () => {
      on = !on;
      cell.classList.toggle('on', on);
      audio.tile(on, r, c, 5, 5, areaSel.value as AreaId);
    };
    cell.addEventListener('mousedown', () => { dragging = true; toggle(); });
    cell.addEventListener('mouseenter', () => { if (dragging) toggle(); });
    grid.append(cell);
  }
}

const st = section('Footsteps');
const surf = select(st, SURFACES, 'grass');
let walk: number | null = null;
button(st, 'walk / stop', () => {
  if (walk) { clearInterval(walk); walk = null; return; }
  walk = window.setInterval(() => audio.footstep(surf.value as Surface, 1), 480);
});
button(st, 'one step', () => audio.footstep(surf.value as Surface, 1));

const am = section('Ambience');
const levels: Partial<Record<AmbienceLayer, number>> = {};
for (const l of LAYERS) slider(am, l, 0, 1, 0.05, 0, (v) => { levels[l] = v; audio.setAmbience(levels); });

const sp = section('Positional sources (listener moves along x)');
const kind = select(sp, SOURCES, 'waterfall');
button(sp, 'add at x=0', () => lab.sources.push(audio.addSource(kind.value as (typeof SOURCES)[number], 0, 0, -5, 40)));
button(sp, 'stop all', () => { lab.sources.forEach((s) => s.stop()); lab.sources = []; });
slider(sp, 'listener x', -60, 60, 1, 0, (v) => audio.setListener(v, 1.6, 0, 0, 0, -1));
