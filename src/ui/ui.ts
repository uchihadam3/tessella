/** DOM user interface: intro, menus, HUD, journal, map, options, saves, achievements, ending. */
import './ui.css';
import studioLogo from '../assets/uchihadam-production.webp';
import { STRINGS, type StringKey } from './i18n';
import type { Game } from '../game/game';
import { AREAS, AREA_BY_ID, TEACHING_AREAS, type AreaId } from '../data/areas';
import { ACHIEVEMENTS, type AchievementId } from '../game/achievements';
import { listSlots, loadSlot, deleteSlot, exportSave, importSave, writeSlot, lastSlot, SLOT_COUNT, saveToCode, saveFromCode } from '../core/save';
import type { SaveData } from '../core/save';
import { audio } from '../audio';
import { WAYSTONES, ANCHORS, WORLD_HALF } from '../world/layout';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Where the installable, self-updating copy of the game lives. */
export const INSTALL_URL = 'https://uchihadam3.github.io/tessella/';

/** How this copy can be installed: already installed, the browser's prompt, iPhone steps, or not here. */
function installMode(hasPrompt: boolean): 'installed' | 'prompt' | 'ios' | 'elsewhere' | 'unsupported' {
  const nav = navigator as Navigator & { standalone?: boolean };
  // (a browser tab made fullscreen by the game itself also reports display-mode: fullscreen)
  const appWindow = matchMedia('(display-mode: standalone), (display-mode: minimal-ui)').matches || (matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement);
  if (appWindow || nav.standalone) return 'installed';
  if (hasPrompt) return 'prompt';
  let embedded = false;
  try {
    embedded = window.top !== window.self;
  } catch {
    embedded = true;
  }
  const official = location.protocol === 'https:' && location.href.startsWith(INSTALL_URL.replace(/\/$/, ''));
  if (embedded || !official) return 'elsewhere';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  return 'unsupported';
}

/** Phones: go fullscreen and hold landscape when the browser allows it (Android); ignored elsewhere. */
function enterFullscreen() {
  try {
    const d = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    if (standalone || document.fullscreenElement) return;
    const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : (d.webkitRequestFullscreen?.(), undefined);
    Promise.resolve(p)
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
      .catch(() => {});
  } catch {
    /* not supported: play in the browser window */
  }
}

/** The TESSELLA emblem: nine tiles in a diamond (one per language). */
export function emblemSVG(): string {
  const order: AreaId[] = ['kinship', 'mold', 'measure', 'twins', 'echo', 'beacon', 'contour', 'weave', 'mosaic'];
  let tiles = '';
  order.forEach((id, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const col = AREA_BY_ID[id].lit;
    tiles += `<rect class="tile" data-i="${i}" x="${c * 36}" y="${r * 36}" width="30" height="30" rx="6" fill="${col}" style="color:${col}"/>`;
  });
  return `<svg class="emblem" viewBox="-30 -30 166 166"><g transform="translate(53 -22) rotate(45)">
    <rect x="-8" y="-8" width="118" height="118" rx="10" fill="none" stroke="#e9c77d" stroke-width="1.6" opacity=".8"/>
    ${tiles}</g></svg>`;
}

function logoHTML(sub: string) {
  return `<div class="logo">${emblemSVG()}<div class="word">TESSELLA</div><div class="orn"><i></i><b></b><i></i></div><div class="sub">${sub}</div></div>`;
}

export class UI {
  root: HTMLElement;
  private screens = new Map<string, HTMLElement>();
  private stack: string[] = [];
  private game!: Game;
  private titleTimer = 0;
  private skipIntro = false;
  /** touch layout (phones/tablets): no keyboard hints, tap controls */
  touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  /** the browser's install offer (Chrome, Edge, Android), kept until the player asks for it */
  private installEvt: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;

  constructor() {
    this.root = h(`<div id="ui">
      <div id="hud">
        <div class="cine top"></div><div class="cine bottom"></div>
        <div id="crosshair" class="hidden"></div>
        <div id="area-title"><div class="n"></div><div class="t"></div><div class="r"></div></div>
        <div id="toasts"></div>
        <div id="ach-pop"><small></small><b></b><span></span></div>
        <div id="engage-hint"></div>
        <div id="stick"><i></i></div>
        <div id="rotate-hint"><b>⟳</b><span></span></div>
        <div id="fps"></div>
      </div>
      <button id="tpause" aria-label="menu">${emblemSVG()}</button>
      <div id="fade"></div>
    </div>`);
    document.body.appendChild(this.root);
  }

  bind(game: Game) {
    this.game = game;
    game.ui = this;
    this.buildScreens();
    this.setTouch(this.touch);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installEvt = e as typeof this.installEvt;
      if (this.game.state === 'menu') this.renderMenu();
    });
    window.addEventListener('appinstalled', () => {
      this.installEvt = null;
      this.toast(this.t('installed'), 'unlock');
      if (this.game.state === 'menu') this.renderMenu();
    });
    $('#tpause', this.root).addEventListener('click', (e) => {
      e.stopPropagation();
      audio.uiClick();
      this.pause();
    });
    const hudLoop = () => {
      requestAnimationFrame(hudLoop);
      this.updateTouchHud();
    };
    requestAnimationFrame(hudLoop);
    window.addEventListener('resize', () => this.maybeRotateHint());
    window.addEventListener('keydown', (e) => this.onKey(e));
    setInterval(() => {
      const f = $('#fps');
      f.textContent = this.game.settings.showFps ? `${Math.round(this.game.engine.fps)} fps` : '';
    }, 500);
  }

  t(k: StringKey): string {
    return STRINGS[this.game?.settings.lang ?? 'pt'][k] as string;
  }

  // ───────────────────────── screens ─────────────────────────

  private add(id: string, el: HTMLElement) {
    el.id = id;
    el.classList.add('screen');
    this.root.insertBefore(el, $('#fade', this.root));
    this.screens.set(id, el);
    return el;
  }

  show(id: string, push = true) {
    for (const [k, el] of this.screens) el.classList.toggle('on', k === id);
    if (push) this.stack.push(id);
    const el = this.screens.get(id);
    (el?.querySelector('button, .slotcard') as HTMLElement | null)?.focus?.();
  }

  hideAll() {
    for (const el of this.screens.values()) el.classList.remove('on');
    this.stack = [];
  }

  back() {
    audio.uiBack();
    this.stack.pop();
    const prev = this.stack.pop();
    if (prev) {
      if (prev === 'menu') this.renderMenu();
      if (prev === 'pause') this.renderPause();
      this.show(prev);
    } else if (this.game.state === 'pause') this.resume();
  }

  private buildScreens() {
    this.add('loading', h(`<div class="center"><div class="logo">${emblemSVG()}</div><div class="lbar"><i></i></div><p></p></div>`));
    this.add('gate', h(`<div class="center"><div class="seal"></div><p></p><small></small></div>`));
    this.add('studio', h(`<div class="center"><img alt="Uchihadam Production" src="${studioLogo}"></div>`));
    this.add('title', h(`<div class="center">${logoHTML('')}</div>`));
    this.add('menu', h(`<div><div class="mwrap">${logoHTML('')}<div class="menu-items"></div></div><div class="foot"><b>Uchihadam Production</b> · TESSELLA</div></div>`));
    this.add('pause', h(`<div class="center dim-bg"><div class="dialog" style="min-width:min(420px,92vw)"><h2>TESSELLA</h2><div class="menu-items" style="margin-top:0"></div></div></div>`));
    this.add('slots', h(`<div class="center dim-bg"><div class="dialog"><h2></h2><div class="slots"></div><div class="row" style="margin-top:18px"><button class="btn imp"></button><input type="file" accept=".json,application/json" hidden><span class="spacer"></span><button class="btn bk"></button></div></div></div>`));
    this.add('options', h(`<div class="center dim-bg"><div class="dialog"><h2></h2><div class="opt"></div><h3></h3><div class="note ctl"></div><div class="row" style="margin-top:20px"><span class="spacer"></span><button class="btn bk"></button></div></div></div>`));
    this.add('journal', h(`<div class="center dim-bg"><div class="dialog"><h2></h2><div class="sum"></div><div class="areas"></div><div class="row" style="margin-top:18px"><span class="spacer"></span><button class="btn bk"></button></div></div></div>`));
    this.add('map', h(`<div class="center dim-bg"><div class="dialog"><div class="mapwrap"><canvas width="900" height="900"></canvas></div><div class="row" style="margin-top:12px"><span class="note mapnote" style="margin:0"></span><span class="spacer"></span><button class="btn bk"></button></div></div></div>`));
    this.add('achievements', h(`<div class="center dim-bg"><div class="dialog"><h2></h2><div class="ach"></div><div class="row" style="margin-top:18px"><span class="spacer"></span><button class="btn bk"></button></div></div></div>`));
    this.add('credits', h(`<div class="center"><div class="roll"></div><div class="row" style="position:absolute;bottom:30px;right:30px"><button class="btn bk"></button></div></div>`));
    this.add('ending', h(`<div class="center" style="overflow:hidden"><div class="roll"></div></div>`));
    for (const el of this.screens.values()) {
      el.querySelectorAll('.bk').forEach((b) => b.addEventListener('click', () => this.back()));
    }
    // map: travel by clicking guide stones
    const mapEl = this.screens.get('map')!;
    mapEl.addEventListener('click', (e) => {
      const ws = (e.target as HTMLElement).closest('.ws') as HTMLElement | null;
      if (!ws) return;
      const w = WAYSTONES.find((x) => x.id === ws.dataset.id);
      if (!w) return;
      this.fadeTo(1, 400).then(() => {
        // arrive looking into the area
        const A = ANCHORS[w.area];
        this.game.teleport(w.x, w.z, Math.atan2(-(A.x - w.x), -(A.z - w.z)));
        this.resume();
        this.fadeTo(0, 700);
      });
    });
    const imp = this.screens.get('slots')!;
    const file = $('input[type=file]', imp) as HTMLInputElement;
    $('.imp', imp).addEventListener('click', () => this.importDialog(file));
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      const d = await importSave(f);
      file.value = '';
      this.root.querySelector('.save-io')?.remove();
      this.acceptImported(d);
    });
    this.setTexts();
  }

  private setTexts() {
    $('#gate p', this.root).textContent = this.t(this.touch ? 'tapToBegin' : 'clickToBegin');
    $('#gate small', this.root).textContent = this.t('headphones');
    $('#loading p', this.root).textContent = this.t('loading');
    this.root.querySelectorAll('.bk').forEach((b) => (b.textContent = this.t('back')));
    $('.imp', this.screens.get('slots')!).textContent = this.t('importSave');
    const sub = this.game.settings.lang === 'pt' ? 'Uma ilha de luz. Nove linguagens. Nenhuma palavra.' : 'An island of light. Nine languages. No words.';
    this.root.querySelectorAll('.logo .sub').forEach((s) => (s.textContent = sub));
  }

  // ───────────────────────── loading & intro ─────────────────────────

  loading(f: number, label: string) {
    this.show('loading', false);
    ($('#loading .lbar i', this.root) as HTMLElement).style.width = `${Math.round(f * 100)}%`;
    const map: Record<string, StringKey> = { terrain: 'loadingTerrain', areas: 'loadingAreas', vegetation: 'loadingVeg', light: 'loadingLight' };
    if (map[label]) $('#loading p', this.root).textContent = this.t(map[label]);
  }

  /** Click-to-begin gate (needed to start audio), then studio logo, then title, then menu. */
  async intro() {
    this.show('gate', false);
    this.game.engine.paused = true; // the intro screens are opaque
    await new Promise<void>((res) => {
      const go = () => {
        this.screens.get('gate')!.removeEventListener('click', go);
        window.removeEventListener('keydown', go);
        if (this.touch) enterFullscreen();
        res();
      };
      this.screens.get('gate')!.addEventListener('click', go);
      window.addEventListener('keydown', go);
    });
    // never let a missing/blocked audio device stall the intro
    await Promise.race([audio.unlock(), sleep(1500)]);
    const skip = () => (this.skipIntro = true);
    // arm the skip only after the click that opened the gate has finished propagating
    setTimeout(() => {
      window.addEventListener('keydown', skip, { once: true });
      this.root.addEventListener('click', skip, { once: true });
    }, 400);
    // studio
    this.show('studio', false);
    const studio = this.screens.get('studio')!;
    await sleep(700);
    audio.studioSting();
    studio.classList.add('play');
    await this.wait(6300);
    studio.classList.remove('play');
    this.show('title', false);
    // title: nine tiles light up one by one, then the wordmark
    const title = this.screens.get('title')!;
    const word = $('.word', title);
    word.classList.add('hide');
    await this.wait(700);
    const tiles = [...title.querySelectorAll('.tile')];
    const order = [4, 1, 5, 7, 3, 2, 8, 6, 0];
    for (let k = 0; k < order.length; k++) {
      if (this.skipIntro) break;
      tiles[order[k]].classList.add('on');
      audio.titleTile(k);
      await this.wait(280);
    }
    tiles.forEach((t) => t.classList.add('on'));
    word.classList.remove('hide');
    word.classList.add('reveal');
    audio.titleResolve();
    $('.orn', title).classList.add('on');
    $('.sub', title).classList.add('on');
    await this.wait(3600);
    this.fadeTo(1, 900);
    await sleep(950);
    this.game.engine.paused = false;
    this.openMenu();
    this.fadeTo(0, 1600);
  }

  private async wait(ms: number) {
    const step = 50;
    for (let t = 0; t < ms; t += step) {
      if (this.skipIntro) return;
      await sleep(step);
    }
  }

  fadeTo(v: number, ms = 1000, white = false): Promise<void> {
    const f = $('#fade', this.root);
    f.classList.toggle('white', white);
    f.style.transition = `opacity ${ms}ms ease`;
    f.style.opacity = String(v);
    return sleep(ms);
  }

  // ───────────────────────── main menu ─────────────────────────

  openMenu() {
    this.game.state = 'menu';
    this.game.input.unlock();
    $('#crosshair', this.root).classList.add('hidden');
    audio.setMusic('menu', 3);
    audio.setAmbience({ wind: 0.4, sea: 0.5 });
    this.stack = [];
    this.renderMenu();
    this.show('menu');
  }

  private menuButton(label: string, fn: () => void, disabled = false) {
    const b = h(`<button class="mi">${label}</button>`) as HTMLButtonElement;
    b.disabled = disabled;
    b.addEventListener('mouseenter', () => audio.uiHover());
    b.addEventListener('click', () => {
      audio.uiClick();
      fn();
    });
    return b;
  }

  private renderMenu() {
    const box = $('#menu .menu-items', this.root);
    box.innerHTML = '';
    const last = lastSlot();
    if (last !== null) box.append(this.menuButton(this.t('continue'), () => this.startFromSlot(last)));
    box.append(this.menuButton(this.t('newGame'), () => this.renderSlots('new')));
    box.append(this.menuButton(this.t('load'), () => this.renderSlots('load'), listSlots().every((s) => !s.data)));
    box.append(this.menuButton(this.t('options'), () => this.renderOptions()));
    box.append(this.menuButton(this.t('achievements'), () => this.renderAchievements()));
    box.append(this.menuButton(this.t('credits'), () => this.renderCredits()));
    if (installMode(!!this.installEvt) !== 'installed') box.append(this.menuButton(this.t('install'), () => this.install()));
    const tiles = this.screens.get('menu')!.querySelectorAll('.tile');
    tiles.forEach((t) => t.classList.add('on'));
  }

  private slotMode: 'new' | 'load' = 'load';

  private renderSlots(mode: 'new' | 'load') {
    this.slotMode = mode;
    const el = this.screens.get('slots')!;
    $('h2', el).textContent = mode === 'new' ? this.t('newGame') : this.t('load');
    const box = $('.slots', el);
    box.innerHTML = '';
    for (const s of listSlots()) {
      const d = s.data;
      const info = d
        ? `<b>${this.t('slot')} ${s.slot + 1} · ${s.solved} ${this.t('panels')}</b><span>${new Date(d.updated).toLocaleString()} · ${this.t('playTime')} ${fmtTime(d.playTime)} · ${d.totems.length} ${this.t('totem').toLowerCase()}${d.totems.length === 1 ? '' : 's'}</span>`
        : `<b>${this.t('slot')} ${s.slot + 1}</b><span>${this.t('empty')}</span>`;
      const card = h(`<div class="slotcard" tabindex="0"><div class="num">${ROMAN[s.slot + 1]}</div><div class="info">${info}</div><div class="row"></div></div>`);
      const actions = $('.row', card);
      if (d) {
        const ex = h(`<button class="btn">${this.t('exportSave')}</button>`);
        ex.addEventListener('click', (e) => {
          e.stopPropagation();
          this.exportDialog(d);
        });
        const del = h(`<button class="btn">${this.t('delete')}</button>`);
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirm(`${this.t('delete')}?`, () => {
            deleteSlot(s.slot);
            this.renderSlots(mode);
          });
        });
        actions.append(ex, del);
      }
      card.addEventListener('mouseenter', () => audio.uiHover());
      card.addEventListener('click', () => {
        audio.uiClick();
        if (mode === 'load') {
          if (d) this.startFromSlot(s.slot);
        } else if (d) this.confirm(this.t('overwrite'), () => this.startNew(s.slot));
        else this.startNew(s.slot);
      });
      box.append(card);
    }
    if (this.stack[this.stack.length - 1] !== 'slots') this.show('slots');
  }

  /** puts an imported save into the first empty slot (or the slot it came from) */
  private acceptImported(d: SaveData | null) {
    if (!d) return this.toast(this.t('importFail'), 'warn');
    const empty = listSlots().find((s) => !s.data);
    d.slot = empty ? empty.slot : d.slot % SLOT_COUNT;
    writeSlot(d);
    this.toast(this.t('importOk'), 'save');
    this.renderSlots(this.slotMode);
  }

  /** shows the save as a copyable code (downloads are often blocked inside embedded pages) */
  private exportDialog(d: SaveData) {
    const el = h(`<div class="screen on center dim-bg save-io" style="z-index:40"><div class="dialog" style="min-width:min(520px,92vw)"><h2 style="font-size:28px">${this.t('exportSave')}</h2><p class="io-help"></p><textarea class="io-code" readonly spellcheck="false"></textarea><div class="row" style="margin-top:14px"><button class="btn dl"></button><span class="spacer"></span><button class="btn x"></button><button class="btn primary cp"></button></div></div></div>`);
    $('.io-help', el).textContent = this.t('exportHelp');
    const ta = $('.io-code', el) as HTMLTextAreaElement;
    ta.value = saveToCode(d);
    $('.dl', el).textContent = this.t('download');
    $('.x', el).textContent = this.t('close');
    $('.cp', el).textContent = this.t('copy');
    $('.dl', el).addEventListener('click', () => exportSave(d));
    $('.x', el).addEventListener('click', () => el.remove());
    $('.cp', el).addEventListener('click', async () => {
      ta.focus();
      ta.select();
      let ok = false;
      try {
        await navigator.clipboard.writeText(ta.value);
        ok = true;
      } catch {
        try {
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
      }
      if (ok) this.toast(this.t('copied'), 'save');
    });
    this.root.append(el);
    setTimeout(() => ta.select(), 50);
  }

  private importDialog(file: HTMLInputElement) {
    const el = h(`<div class="screen on center dim-bg save-io" style="z-index:40"><div class="dialog" style="min-width:min(520px,92vw)"><h2 style="font-size:28px">${this.t('importSave')}</h2><p class="io-help"></p><textarea class="io-code" spellcheck="false" placeholder="TESSELLA1:…"></textarea><div class="row" style="margin-top:14px"><button class="btn fl"></button><span class="spacer"></span><button class="btn x"></button><button class="btn primary go"></button></div></div></div>`);
    $('.io-help', el).textContent = this.t('importHelp');
    $('.fl', el).textContent = this.t('chooseFile');
    $('.x', el).textContent = this.t('back');
    $('.go', el).textContent = this.t('doImport');
    $('.fl', el).addEventListener('click', () => file.click());
    $('.x', el).addEventListener('click', () => el.remove());
    $('.go', el).addEventListener('click', () => {
      const d = saveFromCode(($('.io-code', el) as HTMLTextAreaElement).value);
      if (d) el.remove();
      this.acceptImported(d);
    });
    this.root.append(el);
    setTimeout(() => ($('.io-code', el) as HTMLTextAreaElement).focus(), 50);
  }

  /** "Install the game": the browser's own install prompt where it exists, clear steps elsewhere */
  private async install() {
    const mode = installMode(!!this.installEvt);
    if (mode === 'prompt' && this.installEvt) {
      const ev = this.installEvt;
      try {
        await ev.prompt();
        const choice = await ev.userChoice;
        if (choice.outcome === 'accepted') this.installEvt = null;
      } catch {
        /* the browser refused to show it again; fall through to the steps */
      }
      this.renderMenu();
      return;
    }
    const key = mode === 'ios' ? 'installIos' : mode === 'elsewhere' ? 'installElsewhere' : 'installUnsupported';
    const el = h(`<div class="screen on center dim-bg save-io" style="z-index:40"><div class="dialog" style="min-width:min(520px,92vw);max-width:min(620px,94vw)"><h2 style="font-size:28px">${this.t('install')}</h2><p class="io-help"></p><p class="io-url"></p><div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn x"></button><button class="btn primary go"></button></div></div></div>`);
    $('.io-help', el).textContent = this.t(key);
    $('.io-help', el).insertAdjacentHTML('afterend', `<p class="io-help" style="margin-top:-2px">${this.t('installWhy')}</p>`);
    const url = $('.io-url', el);
    url.textContent = INSTALL_URL;
    url.style.display = mode === 'ios' ? 'none' : '';
    $('.x', el).textContent = this.t('close');
    const go = $('.go', el) as HTMLButtonElement;
    go.textContent = this.t('openSite');
    go.style.display = mode === 'elsewhere' ? '' : 'none';
    go.addEventListener('click', () => {
      try {
        window.open(INSTALL_URL, '_blank', 'noopener');
      } catch {
        /* popups blocked: the address is on screen */
      }
    });
    $('.x', el).addEventListener('click', () => el.remove());
    this.root.append(el);
  }

  private confirm(text: string, yes: () => void) {
    const el = h(`<div class="screen on center dim-bg" style="z-index:40"><div class="dialog" style="min-width:min(440px,92vw)"><p style="font-size:18px;line-height:1.5">${text}</p><div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn n">${this.t('no')}</button><button class="btn primary y">${this.t('yes')}</button></div></div></div>`);
    this.root.append(el);
    $('.n', el).addEventListener('click', () => el.remove());
    $('.y', el).addEventListener('click', () => {
      el.remove();
      yes();
    });
  }

  private async startNew(slot: number) {
    await this.fadeTo(1, 900);
    this.hideAll();
    this.game.newGame(slot);
    this.enterPlay(true);
  }

  private async startFromSlot(slot: number) {
    const d = loadSlot(slot);
    if (!d) return;
    await this.fadeTo(1, 900);
    this.hideAll();
    this.game.applySave(d);
    this.enterPlay(false);
  }

  private enterPlay(fresh: boolean) {
    const g = this.game;
    g.state = 'play';
    $('#crosshair', this.root).classList.remove('hidden');
    audio.setMusic(g.currentArea, 4);
    g.player.applyCamera(g.engine.camera);
    if (fresh) {
      // waking up: slow fade from white
      this.fadeTo(1, 10, true);
      setTimeout(() => this.fadeTo(0, 4200, true), 400);
    } else this.fadeTo(0, 1400);
    g.input.lock();
    g.engine.renderer.domElement.focus?.();
    setTimeout(() => this.maybeRotateHint(), 1500);
  }

  // ───────────────────────── pause ─────────────────────────

  pause() {
    const g = this.game;
    if (g.state !== 'play') return;
    if (g.pm.engaged) return;
    g.state = 'pause';
    g.input.unlock();
    g.saveNow();
    audio.duck(0.5, 0.4);
    this.renderPause();
    this.stack = [];
    this.show('pause');
  }

  resume() {
    const g = this.game;
    this.hideAll();
    if (g.state === 'pause') {
      g.state = 'play';
      audio.duck(1, 0.4);
      g.input.lock();
    }
  }

  private renderPause() {
    const box = $('#pause .menu-items', this.root);
    box.innerHTML = '';
    box.append(this.menuButton(this.t('resume'), () => this.resume()));
    box.append(this.menuButton(this.t('journal'), () => this.renderJournal()));
    box.append(this.menuButton(this.t('map'), () => this.renderMap()));
    box.append(this.menuButton(this.t('saveGame'), () => this.game.saveNow(true)));
    box.append(this.menuButton(this.t('load'), () => this.renderSlots('load')));
    box.append(this.menuButton(this.t('options'), () => this.renderOptions()));
    box.append(this.menuButton(this.t('achievements'), () => this.renderAchievements()));
    box.append(
      this.menuButton(this.t('mainMenu'), async () => {
        this.game.saveNow();
        await this.fadeTo(1, 700);
        this.openMenu();
        this.fadeTo(0, 900);
      }),
    );
  }

  // ───────────────────────── options ─────────────────────────

  private renderOptions() {
    const g = this.game;
    const s = g.settings;
    const el = this.screens.get('options')!;
    $('h2', el).textContent = this.t('options');
    $('h3', el).textContent = this.t('controls');
    $('.ctl', el).textContent = this.t(this.touch ? 'controlsTouch' : 'controlsText');
    const box = $('.opt', el);
    box.innerHTML = '';
    const row = (label: string, input: HTMLElement) => {
      box.append(h(`<label>${label}</label>`), input);
    };
    const range = (key: 'sensitivity' | 'fov' | 'master' | 'music' | 'sfx' | 'ambience', min: number, max: number, step: number) => {
      const i = h(`<input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}">`) as HTMLInputElement;
      i.addEventListener('input', () => {
        (s[key] as number) = Number(i.value);
        g.applySettings();
      });
      return i;
    };
    const check = (key: 'invertY' | 'headBob' | 'showFps') => {
      const i = h(`<input type="checkbox" ${s[key] ? 'checked' : ''}>`) as HTMLInputElement;
      i.addEventListener('change', () => {
        (s[key] as boolean) = i.checked;
        g.applySettings();
      });
      return i;
    };
    const lang = h(`<select><option value="pt">Português</option><option value="en">English</option></select>`) as HTMLSelectElement;
    lang.value = s.lang;
    lang.addEventListener('change', () => {
      s.lang = lang.value as 'pt' | 'en';
      g.applySettings();
      this.setTexts();
      this.renderOptions();
      g.refreshHub();
    });
    const q = h(`<select><option value="low">${this.t('low')}</option><option value="medium">${this.t('medium')}</option><option value="high">${this.t('high')}</option></select>`) as HTMLSelectElement;
    q.value = s.quality;
    q.addEventListener('change', () => {
      s.quality = q.value as 'low' | 'medium' | 'high';
      g.applySettings();
    });
    row(this.t('language'), lang);
    row(this.t('quality'), q);
    row(this.t('sensitivity'), range('sensitivity', 0.2, 3, 0.05));
    row(this.t('invertY'), check('invertY'));
    row(this.t('fov'), range('fov', 55, 100, 1));
    row(this.t('headBob'), check('headBob'));
    row(this.t('master'), range('master', 0, 1, 0.01));
    row(this.t('music'), range('music', 0, 1, 0.01));
    row(this.t('sfx'), range('sfx', 0, 1, 0.01));
    row(this.t('ambience'), range('ambience', 0, 1, 0.01));
    row(this.t('showFps'), check('showFps'));
    if (this.stack[this.stack.length - 1] !== 'options') this.show('options');
  }

  // ───────────────────────── journal ─────────────────────────

  private renderJournal() {
    const g = this.game;
    const el = this.screens.get('journal')!;
    $('h2', el).textContent = this.t('journal');
    const prog = g.areaProgress();
    const total = prog.reduce((s, a) => s + a.solved.length, 0);
    const done = prog.reduce((s, a) => s + a.solved.filter(Boolean).length, 0);
    const totems = g.save.totems.filter((t) => TEACHING_AREAS.includes(t)).length;
    $('.sum', el).innerHTML = `<div><b>${done} / ${total}</b>${this.t('panels')}</div><div><b>${totems} / 8</b>${this.t('totem')}s</div><div><b>${fmtTime(g.save.playTime)}</b>${this.t('playTime')}</div>`;
    const box = $('.areas', el);
    box.innerHTML = '';
    const lang = g.settings.lang;
    for (const a of prog) {
      const spec = AREA_BY_ID[a.id];
      const n = a.solved.length;
      const d = a.solved.filter(Boolean).length;
      const pct = n ? (d / n) * 100 : 0;
      const locked = !a.open;
      box.append(
        h(`<div class="arow ${locked ? 'locked' : ''}"><div class="n">${spec.number ? ROMAN[spec.number] : '·'}</div>
        <div class="t"><b>${locked ? this.t('locked') : spec.name[lang]}</b><span>${spec.rule && !locked ? spec.rule[lang] : ''}</span></div>
        <div><div class="bar"><i style="width:${pct}%;background:${spec.lit};box-shadow:0 0 8px ${spec.lit}"></i></div></div>
        <div class="c">${d}/${n} ${spec.totem ? `<span class="tot ${a.totem ? 'on' : ''}"></span>` : ''}</div></div>`),
      );
    }
    const extra = g.secretSummary?.();
    if (extra && extra.found > 0) {
      box.append(h(`<div class="arow"><div class="n">✦</div><div class="t"><b>${this.t('constellations')}</b><span></span></div><div><div class="bar"><i style="width:${(extra.solved / extra.total) * 100}%;background:#cfe3ff"></i></div></div><div class="c">${extra.solved}/${extra.total}</div></div>`));
    }
    if (this.stack[this.stack.length - 1] !== 'journal') this.show('journal');
  }

  // ───────────────────────── map ─────────────────────────

  private mapImage: ImageData | null = null;

  private renderMap() {
    const g = this.game;
    const el = this.screens.get('map')!;
    const canvas = $('canvas', el) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const N = canvas.width;
    const R = 400; // world metres shown from the centre (+ citadel)
    const cx = 0, cz = -60;
    const toPx = (x: number, z: number) => [((x - cx) / (R * 2) + 0.5) * N, ((z - cz) / (R * 2) + 0.5) * N];
    if (!this.mapImage) {
      const img = ctx.createImageData(N, N);
      const t = g.world.terrain;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = cx + (i / N - 0.5) * R * 2, z = cz + (j / N - 0.5) * R * 2;
          const hgt = Math.abs(x) < WORLD_HALF && Math.abs(z) < WORLD_HALF ? t.heightAt(x, z) : -30;
          let r: number, gg: number, b: number;
          if (hgt < 0.2) {
            const d = Math.min(1, -hgt / 20);
            r = 120 - 60 * d; gg = 170 - 50 * d; b = 180 - 30 * d;
          } else {
            const c = t.colorAt(x, z);
            const shade = 0.85 + Math.min(0.3, hgt / 120);
            r = Math.pow(c.r, 1 / 2.2) * 255 * shade; gg = Math.pow(c.g, 1 / 2.2) * 255 * shade; b = Math.pow(c.b, 1 / 2.2) * 255 * shade;
            // sepia toning
            const l = 0.3 * r + 0.59 * gg + 0.11 * b;
            r = r * 0.6 + l * 0.4 * 1.08; gg = gg * 0.6 + l * 0.4 * 0.98; b = b * 0.6 + l * 0.4 * 0.8;
            // contour lines
            if (Math.abs(((hgt + 1000) % 6) - 0.5) < 0.35) { r *= 0.86; gg *= 0.86; b *= 0.86; }
          }
          const k = (j * N + i) * 4;
          img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
        }
      }
      this.mapImage = img;
    }
    ctx.putImageData(this.mapImage, 0, 0);
    const wrap = $('.mapwrap', el);
    wrap.querySelectorAll('.pin, .ws, .me').forEach((p) => p.remove());
    const scale = () => canvas.getBoundingClientRect().width / N;
    requestAnimationFrame(() => {
      const s = scale();
      const lang = g.settings.lang;
      for (const id of Object.keys(ANCHORS) as AreaId[]) {
        if (id === 'echo' || id === 'spire') continue;
        if (!g.save.visited.includes(id) && id !== 'hub' && id !== 'citadel') continue;
        const [px, py] = toPx(ANCHORS[id].x, ANCHORS[id].z);
        const spec = AREA_BY_ID[id];
        wrap.append(h(`<div class="pin" style="left:${px * s}px;top:${py * s - 14}px">${spec.number ? ROMAN[spec.number] + ' · ' : ''}${spec.name[lang]}</div>`));
      }
      for (const w of WAYSTONES) {
        if (!g.save.waystones.includes(w.id)) continue;
        const [px, py] = toPx(w.x, w.z);
        wrap.append(h(`<div class="ws" data-id="${w.id}" title="${this.t('travel')}" style="left:${px * s}px;top:${py * s}px"></div>`));
      }
      const p = g.player.pos;
      const [mx, my] = toPx(p.x, p.z);
      const me = h(`<div class="me" style="left:${mx * s - 7}px;top:${my * s - 12}px"></div>`);
      me.style.transform = `rotate(${-g.player.yaw}rad)`;
      wrap.append(me);
    });
    $('.mapnote', el).textContent = this.t('travel') + ': ◆';
    if (this.stack[this.stack.length - 1] !== 'map') this.show('map');
  }

  // ───────────────────────── achievements / credits ─────────────────────────

  private renderAchievements() {
    const el = this.screens.get('achievements')!;
    $('h2', el).textContent = this.t('achievements');
    const box = $('.ach', el);
    box.innerHTML = '';
    const got = this.game.save.achievements;
    const lang = this.game.settings.lang;
    for (const a of ACHIEVEMENTS) {
      const on = !!got[a.id];
      const secret = a.id.startsWith('stars') || a.id === 'first_star' || a.id === 'vault';
      const [title, desc] = a[lang];
      box.append(h(`<div class="${on ? 'on' : ''}"><b>${secret && !on ? '???' : title}</b><span>${secret && !on ? '' : desc}</span></div>`));
    }
    if (this.stack[this.stack.length - 1] !== 'achievements') this.show('achievements');
  }

  private creditsHTML() {
    const lines = STRINGS[this.game.settings.lang].creditsText;
    return `${logoHTML('')}${lines.map(([a, b]) => `<div class="cl"><span>${a}</span><b>${b}</b></div>`).join('')}`;
  }

  private renderCredits() {
    const el = this.screens.get('credits')!;
    $('.roll', el).innerHTML = this.creditsHTML();
    el.querySelectorAll('.tile').forEach((t) => t.classList.add('on'));
    el.querySelectorAll('.orn, .sub').forEach((t) => t.classList.add('on'));
    this.show('credits');
  }

  // ───────────────────────── ending credits ─────────────────────────

  private creditLines(kind: 'main' | 'secret'): string {
    const pt = this.game.settings.lang === 'pt';
    const L = (a: string, b: string) => `<div class="cl"><span>${a}</span><b>${b}</b></div>`;
    const big = (t: string) => `<div class="cl"><b style="font-size:44px;letter-spacing:.06em">${t}</b></div>`;
    const quote = (t: string) => `<div class="cl"><b style="font-style:italic;font-weight:500;font-size:26px;max-width:640px;margin:0 auto;line-height:1.5">${t}</b></div>`;
    const langs = pt ? 'Afinidade · Medida · Forma · Contorno · Mosaico · Farol · Trama · Gêmeos · Eco' : 'Kinship · Measure · Mold · Contour · Mosaic · Beacon · Weave · Twins · Echo';
    const places = AREAS.filter((a) => a.id !== 'hub').map((a) => a.name[pt ? 'pt' : 'en']).join(' · ');
    const common =
      L(pt ? 'Uma produção' : 'A production by', 'Uchihadam Production') +
      L(pt ? 'Criado e dirigido por' : 'Created and directed by', 'Uchihadam') +
      L(pt ? 'Design de puzzles e do mundo' : 'Puzzle and world design', 'Uchihadam Production') +
      L(pt ? 'Programação, arte e música' : 'Code, art and music', 'Uchihadam Production ' + (pt ? 'com' : 'with') + ' Claude') +
      L(pt ? 'As nove linguagens' : 'The nine languages', langs) +
      L(pt ? 'A ilha' : 'The island', places) +
      L(pt ? 'Inspirado pelo jeito de ensinar sem palavras de' : 'Inspired by the wordless teaching of', 'The Witness (Thekla, Inc.)') +
      L(pt ? 'Feito com' : 'Made with', 'Three.js · Web Audio · TypeScript') +
      quote(pt
        ? 'A Uchihadam Production faz jogos para quem gosta de descobrir as coisas sozinho — sem tutoriais, sem pressa, com o mundo inteiro como professor.'
        : 'Uchihadam Production makes games for people who like to figure things out on their own — no tutorials, no hurry, the whole world as the teacher.');
    if (kind === 'main') {
      return `${logoHTML('')}${big(pt ? 'Um Novo Dia' : 'A New Day')}${common}
        ${L(pt ? 'Agradecimento especial' : 'Special thanks', pt ? 'A você, que olhou com atenção.' : 'To you, who looked closely.')}
        <div class="cl" style="margin-top:80px"><img src="${studioLogo}" style="width:min(420px,70vw)"></div>
        ${L('© 2026', 'Uchihadam Production')}
        <div class="cl" style="margin-top:70px"><b style="font-size:42px">${this.t('endingThanks')}</b></div>`;
    }
    return `${logoHTML('')}${big(pt ? 'Firmamento' : 'Firmament')}
      ${quote(pt ? 'Você encontrou o que nunca foi ensinado.' : 'You found what was never taught.')}
      ${L(pt ? 'A camada secreta' : 'The secret layer', pt ? '150 constelações · 1 cofre · nenhuma palavra' : '150 constellations · 1 vault · no words')}
      ${quote(pt ? 'Para quem olha o mundo com atenção — e para quem não desiste.' : 'For those who look at the world closely — and never give up.')}
      ${common}
      ${L(pt ? 'Uma décima luz espera' : 'A tenth light waits', '…')}
      <div class="cl" style="margin-top:80px"><img src="${studioLogo}" style="width:min(420px,70vw)"></div>
      ${L(pt ? 'Com gratidão de verdade' : 'With true gratitude', 'Uchihadam Production')}
      <div class="cl" style="margin-top:70px"><b style="font-size:42px">${this.t('endingThanks')}</b></div>`;
  }

  /** Rolls the credits over the living island; resolves when the player chooses to continue. */
  async creditsRoll(kind: 'main' | 'secret'): Promise<void> {
    const el = this.screens.get('ending')!;
    el.style.background = kind === 'secret' ? 'rgba(3,4,14,0.55)' : 'rgba(10,8,6,0.38)';
    const roll = $('.roll', el);
    roll.innerHTML = this.creditLines(kind);
    roll.style.animation = 'none';
    void roll.offsetWidth;
    roll.style.animation = '';
    el.querySelectorAll('.tile').forEach((t) => t.classList.add('on'));
    el.querySelectorAll('.orn, .sub').forEach((t) => t.classList.add('on'));
    if (kind === 'secret') {
      // the tenth tile appears above the emblem
      el.querySelectorAll('svg.emblem g').forEach((g) => {
        g.insertAdjacentHTML('beforeend', '<rect class="tile on" x="36" y="-44" width="30" height="30" rx="6" fill="#ffffff" style="color:#ffffff"/>');
      });
    }
    this.show('ending', false);
    $('#crosshair', this.root).classList.add('hidden');
    await this.fadeTo(0, 2500, true);
    await sleep(82000);
    return new Promise<void>((res) => {
      const btn = h(`<button class="btn primary" style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%)">${this.t('keepExploring')}</button>`);
      el.append(btn);
      btn.addEventListener('click', async () => {
        btn.remove();
        await this.fadeTo(1, 900);
        this.hideAll();
        el.style.background = '';
        $('#crosshair', this.root).classList.remove('hidden');
        res();
        this.fadeTo(0, 1400);
      });
    });
  }

  // ───────────────────────── HUD ─────────────────────────

  setCrosshair(mode: 'dot' | 'ring' | 'hidden') {
    const c = $('#crosshair', this.root);
    c.classList.toggle('ring', mode === 'ring');
    c.classList.toggle('hidden', mode === 'hidden');
  }

  setEngaged(on: boolean) {
    const hint = $('#engage-hint', this.root);
    hint.classList.toggle('on', on);
    hint.innerHTML = '';
    if (on && this.touch) {
      // touch: three quiet glyphs (undo, clear, leave) + drum spin when the panel is a drum
      const g = this.game;
      const drum = g.pm.engaged?.view.mount === 'drum';
      const btn = (glyph: string, fn: () => void, cls = '') => {
        const b = h(`<button class="tb ${cls}">${glyph}</button>`);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        hint.append(b);
      };
      if (drum) btn('‹', () => g.pm.spinDrum(-0.25), 'spin');
      btn('↺', () => g.pm.undo());
      btn('⟲', () => g.pm.reset());
      btn('✕', () => g.pm.leave(), 'leave');
      if (drum) btn('›', () => g.pm.spinDrum(0.25), 'spin');
    } else if (on) hint.innerHTML = `<span>Z ↺</span><span>R ⟲</span><span>␣ ◎</span><span>Esc ✕</span>`;
    $('#crosshair', this.root).classList.toggle('hidden', on);
  }

  /** switch between the keyboard/mouse and the touch layout */
  setTouch(on: boolean) {
    this.touch = on;
    this.root.classList.toggle('touch', on);
    $('#gate p', this.root).textContent = this.t(on ? 'tapToBegin' : 'clickToBegin');
    const ctl = this.screens.get('options')?.querySelector('.ctl');
    if (ctl) ctl.textContent = this.t(on ? 'controlsTouch' : 'controlsText');
  }

  /** thumb-stick ring and the pause emblem (touch only) */
  private updateTouchHud() {
    if (!this.touch || !this.game) return;
    const g = this.game;
    const st = g.input.stick;
    const el = $('#stick', this.root);
    if (st && g.state === 'play' && !g.pm.engaged) {
      const R = g.input.stickRadius;
      let dx = st.x - st.ox, dy = st.y - st.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) {
        dx *= R / l;
        dy *= R / l;
      }
      el.style.transform = `translate(${st.ox}px, ${st.oy}px)`;
      ($('i', el) as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
      el.classList.add('on');
    } else el.classList.remove('on');
    const showPause = g.state === 'play' && !g.pm.engaged && !g.pm.controllingCamera && !$('#hud', this.root).classList.contains('cinematic');
    $('#tpause', this.root).classList.toggle('on', showPause);
  }

  /** phones held upright get a gentle hint that the island is meant to be seen sideways */
  private rotateShown = 0;
  private maybeRotateHint() {
    if (!this.touch || !this.game || this.game.state !== 'play') return;
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    const el = $('#rotate-hint', this.root);
    if (!portrait) {
      el.classList.remove('on');
      return;
    }
    if (performance.now() - this.rotateShown < 60000) return;
    this.rotateShown = performance.now();
    $('span', el).textContent = this.t('rotateHint');
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 5000);
  }

  setCinematic(on: boolean) {
    $('#hud', this.root).classList.toggle('cinematic', on);
    $('#crosshair', this.root).classList.toggle('hidden', on);
  }

  toast(text: string, _kind: 'save' | 'warn' | 'totem' | 'unlock' | 'info' = 'info') {
    const el = h(`<div class="toast"><i></i><span></span></div>`);
    $('span', el).textContent = text;
    $('#toasts', this.root).append(el);
    setTimeout(() => el.remove(), 4300);
  }

  achievement(id: AchievementId) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    const pop = $('#ach-pop', this.root);
    const [title, desc] = a[this.game.settings.lang];
    $('small', pop).textContent = this.t('unlocked');
    $('b', pop).textContent = title;
    $('span', pop).textContent = desc;
    pop.classList.remove('on');
    void pop.offsetWidth;
    pop.classList.add('on');
  }

  areaTitle(id: AreaId) {
    const spec = AREA_BY_ID[id];
    const el = $('#area-title', this.root);
    const lang = this.game.settings.lang;
    $('.n', el).textContent = spec.number ? ROMAN[spec.number] : '';
    $('.t', el).textContent = spec.name[lang];
    $('.r', el).textContent = spec.rule ? spec.rule[lang] : '';
    el.classList.add('on');
    clearTimeout(this.titleTimer);
    this.titleTimer = window.setTimeout(() => el.classList.remove('on'), 4200);
  }

  // ───────────────────────── keys ─────────────────────────

  private onKey(e: KeyboardEvent) {
    const g = this.game;
    if (!g?.built) return;
    if (g.state === 'play') {
      if (g.pm.engaged) {
        if (e.code === 'Escape' || e.code === 'KeyQ') g.pm.leave();
        else if (e.code === 'Space' || e.code === 'Enter') g.pm.submit();
        else if (e.code === 'KeyZ') g.pm.undo();
        else if (e.code === 'KeyR') g.pm.reset();
        else if (e.code === 'ArrowLeft') g.pm.spinDrum(-0.3);
        else if (e.code === 'ArrowRight') g.pm.spinDrum(0.3);
        e.preventDefault();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        // pointer lock already released by Esc: open pause
        this.pause();
        e.preventDefault();
      } else if (e.code === 'Tab' || e.code === 'KeyJ') {
        this.pause();
        this.renderJournal();
        e.preventDefault();
      } else if (e.code === 'KeyM') {
        this.pause();
        this.renderMap();
        e.preventDefault();
      }
    } else if (g.state === 'pause') {
      if (e.code === 'Escape') {
        if (this.stack.length > 1) this.back();
        else this.resume();
        e.preventDefault();
      }
    } else if (g.state === 'menu') {
      if (e.code === 'Escape' && this.stack.length > 1) this.back();
    }
  }
}

function fmtTime(s: number) {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return hh ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
}

export { AREAS };
