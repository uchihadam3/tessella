/**
 * Audio contract between the game and the audio engine (src/audio/engine/*).
 * The game ONLY talks to audio through this interface.
 * Everything is synthesised with the Web Audio API — no audio files — so the game stays a
 * single offline HTML file.
 */
import type { AreaId } from '../data/areas';

export type MusicCue =
  | AreaId            // area themes (hub theme grows with progress)
  | 'menu'            // main menu over the island
  | 'silence';

export type Surface = 'grass' | 'stone' | 'sand' | 'wood' | 'gravel' | 'water' | 'leaves' | 'crystal' | 'marble';

export type AmbienceLayer = 'wind' | 'sea' | 'birds' | 'stream' | 'insects' | 'cave' | 'leaves' | 'night' | 'gulls' | 'chimes';

export interface Volumes {
  master: number;   // 0..1
  music: number;
  sfx: number;
  ambience: number;
}

export interface SpatialHandle {
  setPosition(x: number, y: number, z: number): void;
  setGain(g: number): void;
  stop(): void;
}

export interface AudioAPI {
  /** Must be called from a user gesture (click/keydown). Safe to call more than once. */
  unlock(): Promise<void>;
  readonly ready: boolean;
  setVolumes(v: Volumes): void;
  /** Pause everything (game paused / tab hidden) and resume. */
  suspend(): void;
  resume(): void;

  // ── music ─────────────────────────────────────────────
  /** Crossfade to the theme of a place. Calling with the current cue is a no-op. */
  setMusic(cue: MusicCue, fadeSeconds?: number): void;
  /** Progress drives extra layers in the hub theme and the brightness of all themes.
   *  totems 0..8, plus flags for late game. */
  setProgress(p: { totems: number; citadelDone: boolean; echoOpen: boolean; finale: boolean }): void;
  /** Duck music briefly (e.g. during a cutscene sting). */
  duck(amount: number, seconds: number): void;

  // ── intro / title ─────────────────────────────────────
  /** Deep warm swell + ember crackle for the Uchihadam Production logo (~6 s). */
  studioSting(): void;
  /** One of the nine title-logo tiles lighting up (index 0..8 forms a rising chord). */
  titleTile(index: number): void;
  /** Gentle swell when the TESSELLA wordmark resolves. */
  titleResolve(): void;
  /** Ending / credits music (long, emotional). */
  playEnding(): void;

  // ── panels ────────────────────────────────────────────
  /** Tile toggled. Pitch from the tile position in the area's scale. */
  tile(on: boolean, row: number, col: number, rows: number, cols: number, area: AreaId): void;
  panelEngage(): void;
  panelLeave(): void;
  panelSolved(area: AreaId, bigness?: number): void;
  panelFailed(): void;
  panelPowered(): void;
  /** Light running along a cable for `seconds`. */
  cable(seconds: number): void;
  door(kind: 'stone' | 'wood' | 'light' | 'water'): void;
  totem(area: AreaId): void;
  /** Area 10 / 11 opening set-piece. */
  greatUnlock(): void;
  secretSolved(): void;

  // ── ui ────────────────────────────────────────────────
  uiHover(): void;
  uiClick(): void;
  uiBack(): void;
  achievement(): void;
  save(): void;

  // ── player / world ────────────────────────────────────
  footstep(surface: Surface, speed: number): void;
  /** Target levels 0..1 for each ambience layer (missing layers fade to 0). Smoothly crossfaded. */
  setAmbience(levels: Partial<Record<AmbienceLayer, number>>): void;
  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void;
  /** Looping positional source (waterfall, windmill, fountain, brook, surf, crystal hum). */
  addSource(kind: 'waterfall' | 'windmill' | 'fountain' | 'brook' | 'surf' | 'crystal' | 'fire', x: number, y: number, z: number, radius: number): SpatialHandle;
}
