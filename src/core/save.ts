/**
 * Save system: 3 slots in localStorage, autosave, manual save, export/import to a file.
 * Never throws: storage failures fall back to memory and are reported to the UI.
 */
import type { AreaId } from '../data/areas';

export const SAVE_VERSION = 7;
export const SLOT_COUNT = 3;
const KEY = (slot: number) => `tessella.save.${slot}`;
const LAST = 'tessella.lastSlot';

export interface SaveData {
  version: number;
  slot: number;
  created: number;
  updated: number;
  playTime: number; // seconds
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  /** per panel: state string and solved flag */
  panels: Record<string, { s?: string; done?: 1 }>;
  totems: AreaId[];
  flags: Record<string, boolean>;
  waystones: string[];
  visited: AreaId[];
  achievements: Record<string, number>;
  stats: { solves: number; fails: number; distance: number };
}


/**
 * Version 2 gave every teaching place four more, simpler introduction panels: what each new
 * position held before (its old number, 0 for a new panel). A new panel inside a stretch already
 * solved counts as solved, so nobody loses their way.
 */
const INTRO_V2: Record<string, number[]> = {
  mosaic: [1, 0, 2, 0, 0, 3, 4, 0, 5, 6, 7],
  kinship: [1, 2, 0, 0, 0, 3, 0, 4, 5, 6, 7],
  measure: [1, 0, 2, 0, 0, 3, 0, 4, 5, 6, 7],
  mold: [0, 1, 0, 2, 0, 3, 0, 4, 5, 6, 7],
  contour: [1, 2, 0, 0, 0, 3, 0, 4, 5, 6, 7],
  beacon: [0, 1, 2, 0, 0, 3, 0, 4, 5, 6, 7],
  weave: [1, 0, 2, 0, 3, 0, 4, 0, 5, 6, 7],
  twins: [0, 1, 0, 0, 2, 0, 3, 4, 5, 6, 7],
};

/** version 3: every introduction, 11 → 20 panels (what each new position held in version 2) */
const INTRO_V3: Record<string, number[]> = {
  kinship: [1, 4, 0, 0, 0, 2, 3, 0, 0, 5, 0, 0, 0, 6, 0, 0, 7, 9, 10, 11],
  measure: [1, 3, 0, 0, 2, 5, 4, 0, 7, 0, 0, 0, 0, 0, 0, 6, 8, 9, 10, 11],
  mold: [1, 2, 0, 3, 5, 0, 4, 0, 6, 0, 0, 7, 8, 0, 0, 0, 9, 0, 10, 11],
  contour: [1, 2, 5, 0, 4, 3, 0, 0, 6, 7, 0, 0, 0, 0, 0, 0, 8, 9, 10, 11],
  mosaic: [1, 0, 0, 3, 0, 0, 4, 5, 0, 0, 8, 0, 0, 0, 0, 6, 7, 9, 10, 11],
  beacon: [1, 3, 2, 4, 0, 0, 5, 0, 0, 10, 6, 0, 7, 0, 0, 0, 0, 8, 9, 11],
  weave: [0, 0, 0, 1, 2, 3, 0, 4, 0, 6, 0, 5, 0, 7, 0, 8, 0, 9, 10, 11],
  twins: [0, 3, 2, 1, 4, 0, 0, 6, 0, 0, 5, 7, 0, 0, 8, 0, 9, 0, 10, 11],
};

function remap(d: SaveData, table: Record<string, number[]>): SaveData {
  const panels = { ...d.panels };
  for (const [area, from] of Object.entries(table)) {
    const old = (n: number) => d.panels[`${area}.intro.${n}`];
    for (let i = 0; i < Math.max(from.length, 40); i++) delete panels[`${area}.intro.${i + 1}`];
    from.forEach((n, i) => {
      const id = `${area}.intro.${i + 1}`;
      if (n > 0) {
        if (old(n)) panels[id] = old(n);
      } else {
        // a new panel: solved if the next old one after it was solved
        const next = from.slice(i + 1).find((m) => m > 0);
        if (next && old(next)?.done) panels[id] = { done: 1 };
      }
    });
  }
  return { ...d, panels };
}

/**
 * version 4: the desert's long generated series (practice, trial, mastery, heart) gave way to a few
 * puzzles made with its scenery (light, tower, roof). A desert finished before stays finished.
 */
const SCENERY_V4: Record<string, { old: string[]; last: string; now: Record<string, number> }> = {
  mosaic: { old: ['practice', 'trial', 'mastery', 'heart'], last: 'heart.6', now: { light: 4, tower: 3, roof: 4, heart: 3 } },
};

function sceneryV4(d: SaveData): SaveData {
  const panels = { ...d.panels };
  for (const [area, m] of Object.entries(SCENERY_V4)) {
    const finished = !!d.panels[`${area}.${m.last}`]?.done;
    for (const id of Object.keys(panels)) if (m.old.some((g) => id.startsWith(`${area}.${g}.`))) delete panels[id];
    if (finished) for (const [g, n] of Object.entries(m.now)) for (let i = 1; i <= n; i++) panels[`${area}.${g}.${i}`] = { done: 1 };
  }
  return { ...d, panels };
}

/**
 * version 5: the desert's introduction became its gate (12 of the 20 teaching panels), and one
 * pergola moved: what was solved stays solved where it went.
 */
const DESERT_V5: Record<string, string> = {
  ...Object.fromEntries([1, 2, 4, 5, 7, 8, 11, 12, 14, 16, 17, 20].map((n, i) => [`mosaic.gate.${i + 1}`, `mosaic.intro.${n}`])),
  'mosaic.light.1': 'mosaic.light.1', 'mosaic.light.2': 'mosaic.light.3', 'mosaic.light.4': 'mosaic.light.4',
  ...Object.fromEntries(['tower.1', 'tower.2', 'tower.3', 'roof.1', 'roof.2', 'roof.3', 'roof.4', 'heart.1', 'heart.2', 'heart.3'].map((k) => [`mosaic.${k}`, `mosaic.${k}`])),
};
function desertV5(d: SaveData): SaveData {
  const panels: SaveData['panels'] = {};
  for (const [id, v] of Object.entries(d.panels)) if (!id.startsWith('mosaic.')) panels[id] = v;
  for (const [now, was] of Object.entries(DESERT_V5)) if (d.panels[was]) panels[now] = d.panels[was];
  // the one new pergola counts as solved if the desert went on past it
  if (d.panels['mosaic.light.4']?.done) panels['mosaic.light.3'] = { done: 1 };
  return { ...d, panels };
}

/**
 * version 6: the desert's gate grew into five slow teaching sequences (gate, rivets, marks,
 * apart, pairs) and its scenery panels got puzzles of their own: what was solved there before
 * counts for the teaching that leads to it; a finished desert stays finished.
 */
const DESERT_V6 = { gate: 8, rivets: 6, marks: 6, apart: 4, pairs: 6, light: 4, tower: 3, roof: 4, heart: 3 };
function desertV6(d: SaveData): SaveData {
  const was = (k: string) => !!d.panels[`mosaic.${k}`]?.done;
  const panels: SaveData['panels'] = {};
  for (const [id, v] of Object.entries(d.panels)) if (!id.startsWith('mosaic.')) panels[id] = v;
  const finished = was('heart.3');
  const pastGate = finished || was('gate.12') || was('light.1');
  for (const [g, n] of Object.entries(DESERT_V6)) {
    const keep = finished || (pastGate && ['gate', 'rivets', 'marks', 'apart', 'pairs'].includes(g));
    if (keep) for (let i = 1; i <= n; i++) panels[`mosaic.${g}.${i}`] = { done: 1 };
  }
  return { ...d, panels };
}

/**
 * version 7: the desert's teaching became open panels (gate 8, marks 7, rivets 7, pairs 5); a
 * teaching sequence finished before stays finished; its scenery and heart did not change.
 */
function desertV7(d: SaveData): SaveData {
  const panels: SaveData['panels'] = {};
  for (const [id, v] of Object.entries(d.panels)) if (!/^mosaic\.(gate|rivets|marks|apart|pairs)\./.test(id)) panels[id] = v;
  const done = (k: string) => !!d.panels[`mosaic.${k}`]?.done;
  const now: [string, number, string][] = [['gate', 8, 'gate.8'], ['marks', 7, 'marks.6'], ['rivets', 7, 'rivets.6'], ['pairs', 5, 'pairs.6']];
  for (const [g, n, last] of now) if (done(last) || done('light.1')) for (let i = 1; i <= n; i++) panels[`mosaic.${g}.${i}`] = { done: 1 };
  return { ...d, panels };
}

function migrate(d: SaveData): SaveData {
  if (d.version < 2) d = { ...migrateV2(d), version: 2 };
  if (d.version < 3) d = { ...remap(d, INTRO_V3), version: 3 };
  if (d.version < 4) d = { ...sceneryV4(d), version: 4 };
  if (d.version < 5) d = { ...desertV5(d), version: 5 };
  if (d.version < 6) d = { ...desertV6(d), version: 6 };
  if (d.version < 7) d = { ...desertV7(d), version: 7 };
  return d;
}

function migrateV2(d: SaveData): SaveData {
  if (d.version >= 2) return d;
  const panels = { ...d.panels };
  for (const [area, from] of Object.entries(INTRO_V2)) {
    const old = (n: number) => d.panels[`${area}.intro.${n}`];
    for (let i = 0; i < from.length; i++) delete panels[`${area}.intro.${i + 1}`];
    from.forEach((n, i) => {
      const id = `${area}.intro.${i + 1}`;
      if (n > 0) {
        if (old(n)) panels[id] = old(n);
      } else {
        // a new panel: solved if the next old one after it was solved
        const next = from.slice(i + 1).find((m) => m > 0);
        if (next && old(next)?.done) panels[id] = { done: 1 };
      }
    });
  }
  return { ...d, version: 2, panels };
}

export function newSave(slot: number): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION, slot, created: now, updated: now, playTime: 0,
    player: { x: 0, y: 7.2, z: 279.5, yaw: Math.PI, pitch: 0 },
    panels: {}, totems: [], flags: {}, waystones: [], visited: [], achievements: {},
    stats: { solves: 0, fails: 0, distance: 0 },
  };
}

const memory = new Map<string, string>();
function store(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__tessella_probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

function getItem(k: string): string | null {
  const s = store();
  try {
    return s ? s.getItem(k) : memory.get(k) ?? null;
  } catch {
    return memory.get(k) ?? null;
  }
}
function setItem(k: string, v: string): boolean {
  memory.set(k, v);
  const s = store();
  if (!s) return false;
  try {
    s.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}

export function validate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<SaveData>;
  if (typeof d.version !== 'number' || typeof d.panels !== 'object' || !d.player) return null;
  const base = newSave(typeof d.slot === 'number' ? d.slot : 0);
  return migrate({
    ...base,
    ...d,
    player: { ...base.player, ...d.player },
    panels: d.panels ?? {},
    totems: Array.isArray(d.totems) ? d.totems : [],
    flags: d.flags ?? {},
    waystones: Array.isArray(d.waystones) ? d.waystones : [],
    visited: Array.isArray(d.visited) ? d.visited : [],
    achievements: d.achievements ?? {},
    stats: { ...base.stats, ...(d.stats ?? {}) },
  } as SaveData);
}

export function loadSlot(slot: number): SaveData | null {
  const raw = getItem(KEY(slot));
  if (!raw) return null;
  try {
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSlot(data: SaveData): boolean {
  data.updated = Date.now();
  const ok = setItem(KEY(data.slot), JSON.stringify(data));
  setItem(LAST, String(data.slot));
  return ok;
}

export function deleteSlot(slot: number) {
  memory.delete(KEY(slot));
  try {
    store()?.removeItem(KEY(slot));
  } catch {
    /* ignore */
  }
}

export function lastSlot(): number | null {
  const v = getItem(LAST);
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < SLOT_COUNT && loadSlot(n) ? n : null;
}

export interface SlotSummary {
  slot: number;
  data: SaveData | null;
  solved: number;
}

export function listSlots(): SlotSummary[] {
  const out: SlotSummary[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const d = loadSlot(i);
    out.push({ slot: i, data: d, solved: d ? Object.values(d.panels).filter((p) => p.done).length : 0 });
  }
  return out;
}

export function exportSave(data: SaveData) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tessella-save-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A save as a copyable text code: works where file downloads are blocked (embedded pages). */
export function saveToCode(data: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'TESSELLA1:' + btoa(bin);
}

/** Reads a save code (or raw save JSON) back; null when it is not a valid save. */
export function saveFromCode(text: string): SaveData | null {
  try {
    const t = text.trim();
    if (t.startsWith('{')) return validate(JSON.parse(t));
    const bin = atob(t.replace(/^TESSELLA1:/, '').replace(/\s+/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return validate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function importSave(file: File): Promise<SaveData | null> {
  return file
    .text()
    .then((t) => validate(JSON.parse(t)))
    .catch(() => null);
}

export function storageAvailable(): boolean {
  return store() !== null;
}
