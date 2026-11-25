/**
 * The game: builds the island, owns the progression rules, save/restore, the play loop,
 * area tracking (music/ambience/titles), unlock set-pieces and the ending.
 */
import * as THREE from 'three';
import { Engine } from '../core/engine';
import { Input } from '../core/input';
import { World } from '../world/world';
import { skyForProgress, SKY_KEYS } from '../world/sky';
import { Player } from '../player/player';
import { Panel, PanelManager } from '../puzzle/panels';
import { buildPrologue, PROLOGUE_START } from '../world/areas/prologue';
import { buildHub, type HubRuntime } from '../world/areas/hub';
import { TEACHING_BUILDERS } from '../world/areas/teaching';
import { buildCitadel, buildEcho, buildSpire, type SpireRuntime } from '../world/areas/special';
import type { AreaCtx } from '../world/areas/common';
import { AREAS, AREA_BY_ID, TEACHING_AREAS, TOTEMS_TO_OPEN_ECHO, type AreaId } from '../data/areas';
import { ANCHORS, AREA_RADIUS, WAYSTONES, HUB, SPIRE, CALDERA } from '../world/layout';
import { audio } from '../audio';
import type { AmbienceLayer } from '../audio/api';
import { newSave, writeSlot, type SaveData } from '../core/save';
import { loadSettings, saveSettings, type Settings } from '../core/settings';
import { Cutscene, type Shot } from './cutscene';
import { ACHIEVEMENTS, type AchievementId } from './achievements';
import type { UI } from '../ui/ui';
import { ConstellationSystem, VAULT_THRESHOLD, type CItem } from '../secret/constellations';
import { buildVault, type VaultRuntime } from '../world/areas/vault';
import { playMainEnding, playSecretEnding } from './endings';

export type GameState = 'boot' | 'menu' | 'play' | 'pause' | 'cutscene' | 'ending';

const AMBIENCE: Partial<Record<AreaId, Partial<Record<AmbienceLayer, number>>>> = {
  prologue: { sea: 0.9, wind: 0.4, gulls: 0.35, birds: 0.2 },
  hub: { wind: 0.45, birds: 0.5, chimes: 0.45, leaves: 0.2 },
  kinship: { leaves: 0.8, birds: 0.55, stream: 0.5, wind: 0.35 },
  measure: { stream: 0.7, birds: 0.6, insects: 0.35, wind: 0.3 },
  mold: { wind: 0.7, birds: 0.15 },
  contour: { birds: 0.7, insects: 0.4, stream: 0.25, wind: 0.25 },
  mosaic: { wind: 0.8, insects: 0.25 },
  beacon: { sea: 1, wind: 0.85, gulls: 0.8 },
  weave: { wind: 0.65, birds: 0.6, insects: 0.5, leaves: 0.2 },
  twins: { stream: 0.4, birds: 0.5, insects: 0.4, wind: 0.25, leaves: 0.3 },
  citadel: { wind: 0.9, sea: 0.4 },
  echo: { cave: 1, wind: 0.2 },
  spire: { wind: 0.6, night: 0.5 },
};

export class Game {
  readonly engine: Engine;
  readonly input: Input;
  world!: World;
  pm!: PanelManager;
  player!: Player;
  areas = new Map<AreaId, AreaCtx>();
  hub!: HubRuntime;
  spire!: SpireRuntime;
  save: SaveData = newSave(0);
  settings: Settings = loadSettings();
  state: GameState = 'boot';
  ui!: UI;
  currentArea: AreaId = 'prologue';
  private areaCandidate: AreaId = 'prologue';
  private areaTimer = 0;
  private autosaveTimer = 0;
  private cutscene: Cutscene | null = null;
  private lastPos = new THREE.Vector3();
  menuOrbit = 0;
  built = false;
  /** secret layer */
  stars!: ConstellationSystem;
  vault!: VaultRuntime;
  secretSummary = () => ({ found: this.stars?.solvedCount ?? 0, solved: this.stars?.solvedCount ?? 0, total: this.stars?.items.length ?? 0 });
  secretClick = (): boolean => (this.state === 'play' && !this.pm.engaged ? this.stars.click() : false);
  /** touch: use the constellation star / orb under the finger */
  secretTap = (clientX: number, clientY: number): boolean => {
    if (this.state !== 'play' || this.pm.engaged) return false;
    const r = this.engine.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.stars.aim(this.engine.camera, ndc);
    return this.stars.click();
  };
  /** ending helpers */
  endingTick: ((dt: number) => void) | null = null;
  endingOrbit = false;
  private crown = 0;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.input = new Input(this.engine.renderer.domElement);
  }

  // ───────────────────────── building ─────────────────────────

  async build(progress: (f: number, label: string) => void) {
    const tick = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    progress(0.05, 'terrain');
    await tick();
    this.world = new World(this.engine);
    this.pm = new PanelManager(this.engine.camera, this.engine.renderer.domElement);
    this.engine.scene.add(this.pm.group);
    progress(0.25, 'areas');
    await tick();
    const reg = (a: AreaCtx) => this.areas.set(a.id, a);
    reg(buildPrologue(this.world, this.pm));
    this.hub = buildHub(this.world, this.pm);
    reg(this.hub);
    let k = 0;
    for (const id of TEACHING_AREAS) {
      reg(TEACHING_BUILDERS[id](this.world, this.pm));
      progress(0.3 + (k++ / TEACHING_AREAS.length) * 0.35, 'areas');
      await tick();
    }
    reg(buildCitadel(this.world, this.pm));
    reg(buildEcho(this.world, this.pm));
    this.spire = buildSpire(this.world, this.pm);
    reg(this.spire);
    this.vault = buildVault(this.world, this.pm);
    progress(0.62, 'areas');
    await tick();
    this.stars = new ConstellationSystem(this.world);
    this.stars.place();
    this.stars.onSolved = (it) => this.onStarSolved(it);
    this.stars.onRevealed = (it) => {
      this.save.flags['r:' + it.def.id] = true;
      if (this.stars.revealedCount === 1) this.vault.setStars(this.stars.solvedCount, VAULT_THRESHOLD, true);
    };
    this.stars.onChanged = (it) => {
      this.save.panels['c:' + it.def.id] = { s: this.stars.stateOf(it) };
    };
    progress(0.7, 'vegetation');
    await tick();
    this.world.finalize();
    for (const a of this.areas.values()) a.finalize();
    this.vault.finalize();
    progress(0.9, 'light');
    await tick();
    // gating that depends on flags
    const echo = this.areas.get('echo')!;
    if (echo.panels[0]) echo.panels[0].extraPower = () => !!this.save.flags.hollowOpen;
    this.player = new Player(this.world.collision, this.input);
    this.player.onFootstep = (s, sp) => audio.footstep(s, sp);
    this.player.terrainSurface = (x, z) => this.world.terrain.surfaceAt(x, z);
    this.pm.returnView = () => {
      this.player.applyCamera(this.engine.camera);
      return { pos: this.engine.camera.position.clone(), quat: this.engine.camera.quaternion.clone() };
    };
    this.pm.events.solved = (p) => this.onSolved(p);
    this.pm.events.failed = () => this.save.stats.fails++;
    this.pm.events.changed = (p) => {
      this.save.panels[p.id] = { ...(this.save.panels[p.id] ?? {}), s: p.stateString() };
    };
    this.pm.events.engage = (p) => {
      if (p) this.input.unlock();
      else if (this.state === 'play') this.input.lock();
      this.ui?.setEngaged(!!p);
    };
    this.engine.onUpdate((dt, t) => this.update(dt, t));
    this.applySettings();
    this.built = true;
    progress(1, 'done');
  }

  // ───────────────────────── settings ─────────────────────────

  applySettings() {
    const s = this.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience });
    if (this.player) {
      this.player.settings.sensitivity = s.sensitivity;
      this.player.settings.invertY = s.invertY;
      this.player.settings.headBob = s.headBob;
    }
    this.engine.baseFov = s.fov;
    this.engine.camera.fov = window.innerWidth < window.innerHeight ? Math.min(100, s.fov * 1.3) : s.fov;
    this.engine.camera.updateProjectionMatrix();
    if (this.engine.quality !== s.quality) this.engine.setQuality(s.quality);
    if (this.world) {
      this.world.grass.densityScale = s.quality === 'low' ? 0.45 : s.quality === 'medium' ? 0.75 : 1;
      this.world.grass.radius = s.quality === 'low' ? 38 : s.quality === 'medium' ? 48 : 58;
      this.world.grass.update(this.player?.pos.x ?? 0, this.player?.pos.z ?? 0, true);
    }
    saveSettings(s);
  }

  // ───────────────────────── save / load ─────────────────────────

  /** Apply a save to the world (panels, totems, doors, flags, sky, player). */
  applySave(data: SaveData) {
    this.save = data;
    for (const p of this.pm.panels) {
      const rec = data.panels[p.id];
      this.pm.restore(p, rec?.s, !!rec?.done);
    }
    this.pm.refreshPower();
    for (const id of TEACHING_AREAS) {
      const lit = data.totems.includes(id);
      if (lit) this.areas.get(id)?.totem?.activate(true);
      this.hub.receivers.get(id)?.(lit, true);
    }
    for (const id of ['citadel', 'echo'] as AreaId[]) if (data.totems.includes(id)) this.areas.get(id)?.totem?.activate(true);
    // doors opened by chains
    for (const a of this.areas.values()) {
      for (const p of a.panels) if (p.solved) for (const f of p.onSolved) this.silently(() => f(p));
    }
    for (const a of this.areas.values()) for (const d of a.doors.values()) if (d.open) d.openNow(false);
    for (const it of this.stars.items) {
      const rec = data.panels['c:' + it.def.id];
      it.solved = false;
      it.state.fill(0);
      this.stars.restore(it.def.id, rec?.s, !!rec?.done, !!data.flags['r:' + it.def.id]);
    }
    this.updateVault(true);
    if (data.flags.hollowOpen) this.hub.openHollow(true);
    if (data.flags.spireOpen) this.spire.setOpen(true, true);
    this.pm.refreshPower();
    this.world.sky.snap(skyForProgress(this.dayProgress()));
    this.player.place(data.player.x, data.player.z, data.player.yaw, data.player.y);
    this.player.pitch = data.player.pitch;
    this.currentArea = this.areaAt(data.player.x, data.player.z);
    this.areaCandidate = this.currentArea;
    this.refreshHub();
    audio.setProgress(this.audioProgress());
  }

  /** Run something that would normally animate/sound, but instantly (used when loading). */
  private silently(fn: () => void) {
    const doors = [...this.areas.values()].flatMap((a) => [...a.doors.values()]);
    const before = doors.map((d) => d.open);
    fn();
    doors.forEach((d, i) => {
      if (!before[i] && d.open) d.openNow(false);
    });
  }

  saveNow(manual = false): boolean {
    if (!this.player) return false;
    const p = this.player.pos;
    this.save.player = { x: p.x, y: p.y, z: p.z, yaw: this.player.yaw, pitch: this.player.pitch };
    for (const panel of this.pm.panels) {
      if (panel.solved || panel.stateString().includes('1')) this.save.panels[panel.id] = { s: panel.stateString(), ...(panel.solved ? { done: 1 as const } : {}) };
    }
    const ok = writeSlot(this.save);
    if (manual) {
      audio.save();
      this.ui?.toast(ok ? this.ui.t('saved') : this.ui.t('saveFailed'), ok ? 'save' : 'warn');
    }
    return ok;
  }

  newGame(slot: number) {
    const s = newSave(slot);
    s.player = { x: PROLOGUE_START.x, y: PROLOGUE_START.floorY, z: PROLOGUE_START.z, yaw: PROLOGUE_START.yaw, pitch: -0.08 };
    // reset every panel
    for (const p of this.pm.panels) {
      p.solved = false;
      p.powered = false;
      p.reset();
      p.view.setSolved(false, false);
    }
    this.applySave(s);
    writeSlot(this.save);
  }

  // ───────────────────────── progression ─────────────────────────

  dayProgress(): number {
    const f = this.save.flags;
    if (f.ending) return 2;
    if (f.citadelDone) return 1.25;
    return Math.min(1, this.save.totems.filter((t) => TEACHING_AREAS.includes(t)).length / 8);
  }

  audioProgress() {
    const f = this.save.flags;
    return { totems: this.save.totems.filter((t) => TEACHING_AREAS.includes(t)).length, citadelDone: !!f.citadelDone, echoOpen: !!f.hollowOpen, finale: !!f.finale };
  }

  private onSolved(p: Panel) {
    this.save.panels[p.id] = { s: p.stateString(), done: 1 };
    this.save.stats.solves++;
    this.unlock('first_light');
    const total = this.solvedCount();
    if (total >= 50) this.unlock('fifty');
    if (total >= 150) this.unlock('hundred_fifty');
    const area = this.areas.get(p.area);
    if (area && area.complete && !this.save.totems.includes(p.area) && (AREA_BY_ID[p.area].totem || p.area === 'spire')) {
      setTimeout(() => this.completeArea(p.area), 1400);
    }
    if (p.area === 'prologue' && area?.complete) this.unlock('awakened');
    if (p.id === 'hub.vault') {
      this.unlock('vault');
      this.save.flags.secretEnding = true;
      this.saveNow();
      setTimeout(() => playSecretEnding(this), 1800);
      return;
    }
    if (this.solvedCount() >= this.pm.panels.length) this.unlock('every_panel');
    this.refreshHub();
    this.saveNow();
  }

  private completeArea(id: AreaId) {
    if (id === 'spire') {
      this.startEnding();
      return;
    }
    if (this.save.totems.includes(id)) return;
    this.save.totems.push(id);
    const a = this.areas.get(id)!;
    a.totem?.activate();
    this.hub.receivers.get(id)?.(true);
    this.ui?.toast(`${this.ui.t('totemLit')} — ${AREA_BY_ID[id].name[this.settings.lang]}`, 'totem');
    this.unlock(`area_${id}` as AchievementId);
    const lit = this.save.totems.filter((t) => TEACHING_AREAS.includes(t)).length;
    if (TEACHING_AREAS.includes(id)) {
      this.world.sky.setTarget(skyForProgress(this.dayProgress()), 25);
      if (lit >= TOTEMS_TO_OPEN_ECHO && !this.save.flags.hollowOpen) setTimeout(() => this.openHollow(), 6000);
      if (lit === 8) this.unlock('all_totems');
    }
    if (id === 'citadel') {
      this.save.flags.citadelDone = true;
      this.world.sky.setTarget(skyForProgress(this.dayProgress()), 30);
      setTimeout(() => this.openSpire(), 5000);
    }
    audio.setProgress(this.audioProgress());
    this.refreshHub();
    this.saveNow();
  }

  private openHollow() {
    this.save.flags.hollowOpen = true;
    const doorPos = new THREE.Vector3(0, HUB.y + 7, HUB.z - 31);
    this.playCutscene([
      { pos: new THREE.Vector3(0, HUB.y + 9, HUB.z + 12), look: doorPos, dur: 3 },
      { pos: new THREE.Vector3(0, HUB.y + 6, HUB.z - 6), look: doorPos, dur: 5, at: 0.6, fn: () => {
        this.hub.openHollow();
        audio.greatUnlock();
      } },
    ]);
    this.ui?.toast(this.ui.t('hollowOpen'), 'unlock');
    this.unlock('hollow');
    this.pm.refreshPower();
    this.saveNow();
  }

  private openSpire() {
    this.save.flags.spireOpen = true;
    const top = new THREE.Vector3(SPIRE.x, 60, SPIRE.z);
    this.playCutscene([
      { pos: new THREE.Vector3(SPIRE.x + 60, 70, SPIRE.z + 90), look: top, dur: 3 },
      { pos: new THREE.Vector3(SPIRE.x - 40, 110, SPIRE.z + 60), look: new THREE.Vector3(SPIRE.x, 100, SPIRE.z), dur: 6, at: 0.3, fn: () => {
        this.spire.setOpen(true);
        audio.greatUnlock();
        this.pm.refreshPower();
      } },
    ]);
    this.ui?.toast(this.ui.t('spireOpen'), 'unlock');
    this.unlock('spire_open');
    this.saveNow();
  }

  private startEnding() {
    if (this.save.flags.ending) return;
    this.save.flags.finale = true;
    this.save.flags.ending = true;
    this.unlock('the_end');
    this.saveNow();
    this.state = 'ending';
    void playMainEnding(this);
  }

  // ───────────────────────── secret layer ─────────────────────────

  private onStarSolved(it: CItem) {
    this.save.panels['c:' + it.def.id] = { s: this.stars.stateOf(it), done: 1 };
    const n = this.stars.solvedCount;
    const total = this.stars.items.length;
    this.ui?.toast(`✦  ${n} / ${total}`, 'info');
    if (n === 1) this.unlock('first_star');
    if (n >= 30) this.unlock('stars_30');
    if (n >= total) this.unlock('stars_all');
    const wasOpen = !!this.save.flags.vaultOpen;
    this.updateVault(false);
    if (!wasOpen && this.save.flags.vaultOpen) {
      this.unlock('stars_100');
      const d = this.vault.door;
      this.playCutscene([{ pos: d.clone().add(new THREE.Vector3(6, 4, 8)), look: d.clone().add(new THREE.Vector3(0, 2, 0)), dur: 5, at: 0.4, fn: () => {
        this.vault.open();
        audio.greatUnlock();
        this.pm.refreshPower();
      } }]);
    }
    this.saveNow();
  }

  private updateVault(instant: boolean) {
    const n = this.stars.solvedCount;
    this.vault.setStars(n, VAULT_THRESHOLD, n > 0);
    if (n >= VAULT_THRESHOLD && !this.save.flags.vaultOpen) {
      this.save.flags.vaultOpen = true;
      if (instant) this.vault.open(true);
    } else if (this.save.flags.vaultOpen && instant) this.vault.open(true);
    this.pm.refreshPower();
  }

  vaultCenter(): THREE.Vector3 {
    return this.vault.center.clone();
  }

  blazeConstellations() {
    this.stars.blaze = true;
    for (const it of this.stars.items) {
      it.solved = true;
      it.dirty = true;
      it.group.visible = true;
    }
  }

  constellationPoints(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    // the objects in the scenery (not the specks far off in the sky)
    for (const it of this.stars.items) for (const p of it.starPos) if (p.distanceTo(it.view.eye) < 80) out.push(p.clone());
    return out;
  }

  spireCrown(v: number) {
    this.crown = v;
    if (v > 0) this.spire.ignite();
  }

  afterEnding() {
    this.state = 'play';
    this.player.frozen = false;
    this.world.sky.setTarget(skyForProgress(this.dayProgress()), 4);
    this.teleport(HUB.x, HUB.z + 34, 0);
    this.player.applyCamera(this.engine.camera);
    this.ui?.setCrosshair('dot');
    this.input.lock();
    audio.setMusic('hub', 4);
    this.saveNow();
  }

  solvedCount(): number {
    return this.pm.panels.filter((p) => p.solved).length;
  }

  areaProgress() {
    return AREAS.filter((a) => a.groups.length).map((a) => {
      const area = this.areas.get(a.id);
      const panels = area?.panels ?? [];
      const open = a.id === 'echo' ? !!this.save.flags.hollowOpen || panels.some((p) => p.solved) : a.id === 'spire' ? !!this.save.flags.spireOpen : true;
      return { id: a.id, solved: panels.map((p) => p.solved), totem: this.save.totems.includes(a.id), open };
    });
  }

  refreshHub() {
    if (!this.hub) return;
    this.hub.setProgress(this.areaProgress(), { found: 0, total: 0 }, this.settings.lang);
  }

  unlock(id: AchievementId) {
    if (this.save.achievements[id]) return;
    if (!ACHIEVEMENTS.find((a) => a.id === id)) return;
    this.save.achievements[id] = Date.now();
    audio.achievement();
    this.ui?.achievement(id);
  }

  // ───────────────────────── areas / atmosphere ─────────────────────────

  areaAt(x: number, z: number): AreaId {
    let best: AreaId = this.currentArea;
    let bd = Infinity;
    // the spire area is above the caldera floor
    if (Math.hypot(x - SPIRE.x, z - SPIRE.z) < 30 && this.player && this.player.pos.y > CALDERA.floor + 4) return 'spire';
    for (const id of Object.keys(ANCHORS) as AreaId[]) {
      if (id === 'spire') continue;
      const a = ANCHORS[id];
      const r = AREA_RADIUS[id] ?? 80;
      const d = Math.hypot(x - a.x, z - a.z);
      if (d < r && d / r < bd) {
        bd = d / r;
        best = id;
      }
    }
    if (bd === Infinity) {
      // between areas: keep the nearest
      for (const id of Object.keys(ANCHORS) as AreaId[]) {
        const a = ANCHORS[id];
        const d = Math.hypot(x - a.x, z - a.z) / (AREA_RADIUS[id] ?? 80);
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
    }
    return best;
  }

  private updateArea(dt: number) {
    const p = this.player.pos;
    const id = this.areaAt(p.x, p.z);
    if (id !== this.areaCandidate) {
      this.areaCandidate = id;
      this.areaTimer = 0;
    } else this.areaTimer += dt;
    if (id !== this.currentArea && this.areaTimer > 1.2) {
      this.currentArea = id;
      audio.setMusic(id, 5);
      audio.setAmbience(AMBIENCE[id] ?? { wind: 0.5 });
      if (!this.save.visited.includes(id)) {
        this.save.visited.push(id);
        if (id !== 'hub' || this.save.visited.length > 1) this.ui?.areaTitle(id);
        const ws = WAYSTONES.find((w) => w.area === id);
        if (ws && !this.save.waystones.includes(ws.id)) this.save.waystones.push(ws.id);
        if (TEACHING_AREAS.every((a) => this.save.visited.includes(a))) this.unlock('explorer');
      }
    }
    // the spire is always at dusk
    const ds = Math.hypot(p.x - SPIRE.x, p.z - SPIRE.z);
    const spireW = this.currentArea === 'spire' ? THREE.MathUtils.clamp((p.y - CALDERA.floor - 4) / 30, 0, 1) : 0;
    this.world.sky.setOverride(SKY_KEYS.dusk, spireW * (ds < 40 ? 1 : 0));
  }

  // ───────────────────────── cutscenes ─────────────────────────

  playCutscene(shots: Shot[], onDone?: () => void) {
    if (this.pm.engaged) this.pm.leave();
    this.state = 'cutscene';
    this.player.frozen = true;
    this.ui?.setCinematic(true);
    this.cutscene = new Cutscene(this.engine.camera, shots, () => {
      this.cutscene = null;
      this.player.frozen = false;
      this.state = 'play';
      this.ui?.setCinematic(false);
      onDone?.();
    });
  }

  teleport(x: number, z: number, yaw?: number) {
    this.player.place(x, z, yaw ?? this.player.yaw);
    this.world.grass.update(x, z, true);
  }

  // ───────────────────────── loop ─────────────────────────

  private update(dt: number, t: number) {
    const w = this.world;
    if (!w) return;
    // touch: while a panel is engaged, fingers paint on it instead of walking and looking
    this.input.setPointerMode(this.state === 'play' && !!this.pm.engaged);
    if (this.state === 'play' || this.state === 'cutscene') {
      const [mx, my] = this.input.consumeMouse();
      if (this.state === 'play' && !this.pm.controllingCamera) {
        if (this.input.looking) this.player.look(mx, my);
        this.player.update(dt);
        this.player.applyCamera(this.engine.camera);
        const aimed = this.pm.updateAim();
        this.stars.watch(dt, this.engine.camera, this.player.speed);
        const star = aimed ? null : this.stars.aim(this.engine.camera);
        this.ui?.setCrosshair(aimed || star ? 'ring' : 'dot');
        this.updateArea(dt);
        this.save.playTime += dt;
        this.save.stats.distance += this.player.pos.distanceTo(this.lastPos) < 5 ? this.player.pos.distanceTo(this.lastPos) : 0;
        this.lastPos.copy(this.player.pos);
        this.autosaveTimer += dt;
        if (this.autosaveTimer > 25) {
          this.autosaveTimer = 0;
          this.saveNow();
        }
      }
      if (this.cutscene) this.cutscene.update(dt);
    } else if (this.state === 'menu' || this.state === 'boot') {
      // slow orbit over the island for the menu background
      this.menuOrbit += dt * 0.012;
      const r = 470;
      const cam = this.engine.camera;
      cam.position.set(Math.sin(this.menuOrbit) * r, 120 + Math.sin(this.menuOrbit * 0.7) * 15, Math.cos(this.menuOrbit) * r);
      cam.lookAt(0, 20, -40);
      this.input.consumeMouse();
    } else if (this.state === 'ending') {
      this.input.consumeMouse();
      if (this.endingOrbit) {
        this.menuOrbit += dt * 0.02;
        const cam = this.engine.camera;
        cam.position.set(Math.sin(this.menuOrbit) * 430, 140, Math.cos(this.menuOrbit) * 430 - 40);
        cam.lookAt(0, 30, -60);
      } else this.endingTick?.(dt);
    } else if (this.state === 'pause') {
      this.input.consumeMouse();
      if (this.cutscene) this.cutscene.update(dt);
    }
    this.pm.update(dt, t);
    this.engine.bloom.strength = 0.42 - 0.24 * this.pm.closeUp;
    w.update(dt, t, this.engine.camera.position);
    for (const a of this.areas.values()) a.update(dt, t);
    this.vault?.update(dt, t);
    this.stars?.update(dt, t, this.engine.camera.position);
    const cam = this.engine.camera;
    const f = new THREE.Vector3();
    cam.getWorldDirection(f);
    audio.setListener(cam.position.x, cam.position.y, cam.position.z, f.x, f.y, f.z);
    this.input.endFrame();
  }
}

export { HUB, SPIRE };
