/**
 * Save system: 3 slots in localStorage, autosave, manual save, export/import to a file.
 * Never throws: storage failures fall back to memory and are reported to the UI.
 */
import type { AreaId } from '../data/areas';

export const SAVE_VERSION = 1;
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
  return {
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
  } as SaveData;
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

export function importSave(file: File): Promise<SaveData | null> {
  return file
    .text()
    .then((t) => validate(JSON.parse(t)))
    .catch(() => null);
}

export function storageAvailable(): boolean {
  return store() !== null;
}
