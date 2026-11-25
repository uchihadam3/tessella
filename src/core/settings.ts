/** Player settings (persisted separately from saves). */
import type { Quality } from './engine';

export interface Settings {
  lang: 'pt' | 'en';
  sensitivity: number;
  invertY: boolean;
  fov: number;
  headBob: boolean;
  quality: Quality;
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  showFps: boolean;
}

const KEY = 'tessella.settings';

export const DEFAULT_SETTINGS: Settings = {
  lang: 'pt', sensitivity: 1, invertY: false, fov: 72, headBob: true, quality: 'high',
  master: 0.85, music: 0.7, sfx: 0.8, ambience: 0.7, showFps: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  const s = { ...DEFAULT_SETTINGS };
  if (typeof navigator !== 'undefined' && !navigator.language?.toLowerCase().startsWith('pt')) s.lang = 'en';
  // phones and tablets start on medium quality (automatic resolution keeps it smooth from there)
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
    s.quality = 'medium';
    s.sensitivity = 1.15;
  }
  return s;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
