/**
 * TESSELLA — entry point.
 * Uchihadam Production.
 */
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import { Game } from './game/game';
import { UI } from './ui/ui';
import { skyForProgress } from './world/sky';

declare global {
  interface Window {
    __ready?: boolean;
    __game?: Game;
  }
}

async function boot() {
  const app = document.getElementById('app')!;
  const ui = new UI();
  const game = new Game(app);
  const query = new URLSearchParams(location.search);
  // screenshots and tests want the full resolution every frame
  if (query.has('dev') || query.has('fullres')) game.engine.autoResolution = false;
  ui.bind(game);
  window.__game = game;
  ui.loading(0.02, 'terrain');
  await Promise.all([
    document.fonts.load('700 40px "Cormorant Garamond"'),
    document.fonts.load('600 40px "Cormorant Garamond"'),
    document.fonts.load('400 16px "Nunito Sans"'),
  ]).catch(() => {});
  game.engine.start();
  await game.build((f, label) => ui.loading(f, label));
  game.world.sky.snap(skyForProgress(0.85));

  // ── input routing ──
  const input = game.input;
  let expectUnlock = false;
  const canvas = game.engine.renderer.domElement;
  canvas.addEventListener('click', () => {
    if (game.state !== 'play' || game.pm.engaged || game.pm.controllingCamera) return;
    // without pointer lock the mouse looks by dragging: releasing a drag is not a click
    if (input.dragLook && !input.locked && input.pressTravel > 8) return;
    if (game.pm.aimed) {
      expectUnlock = true;
      game.pm.engage(game.pm.aimed);
      ui.setCrosshair('hidden');
    } else if (!game.secretClick?.()) input.lock();
  });
  // touch: tap a panel (anywhere on screen, within reach) to use it; otherwise a tap touches the
  // constellation star or orb under the finger
  input.onTap = (x, y) => {
    if (game.state !== 'play' || game.pm.engaged || game.pm.controllingCamera) return;
    const p = game.pm.pickAt(x, y);
    if (p) {
      game.pm.engage(p);
      ui.setCrosshair('hidden');
      return;
    }
    game.secretTap(x, y);
  };
  // touch while a panel is engaged: press/drag paints tiles, the seal submits, a tap off the panel leaves
  input.onPointerDown = (x, y) => {
    if (game.state === 'play' && game.pm.engaged) game.pm.pointerDown(x, y, 0);
  };
  input.onPointerMove = (x, y) => {
    if (game.pm.engaged) game.pm.pointerMove(x, y);
  };
  input.onPointerUp = (x, y, tap) => {
    game.pm.pointerUp();
    if (tap && game.state === 'play' && game.pm.engaged && !game.pm.tweening && !game.pm.faceAt(x, y)) game.pm.leave();
  };
  input.onTouchMode = () => ui.setTouch(true);
  input.on('mousedown', (e) => {
    const m = e as MouseEvent;
    if (game.state === 'play' && game.pm.engaged) game.pm.pointerDown(m.clientX, m.clientY, m.button);
  });
  input.on('mouseup', () => game.pm.pointerUp());
  input.on('mousemove', (e) => {
    const m = e as MouseEvent;
    if (game.pm.engaged) game.pm.pointerMove(m.clientX, m.clientY);
  });
  input.on('wheel', (e) => {
    if (game.pm.engaged) game.pm.spinDrum((e as WheelEvent).deltaY > 0 ? 0.25 : -0.25);
  });
  input.on('lockchange', () => {
    if (input.locked) return;
    if (expectUnlock) {
      expectUnlock = false;
      return;
    }
    // Esc released the pointer while walking → pause
    if (game.state === 'play' && !game.pm.engaged && !game.pm.controllingCamera) ui.pause();
  });
  game.pm.events.engage = (p) => {
    if (p) {
      expectUnlock = true;
      input.unlock();
    } else if (game.state === 'play') input.lock();
    ui.setEngaged(!!p);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'play') {
      game.saveNow();
      if (!game.pm.engaged) ui.pause();
    }
  });
  window.addEventListener('beforeunload', () => {
    if (game.state === 'play' || game.state === 'pause') game.saveNow();
  });

  // if the GPU resets the WebGL context, save and reload instead of showing a frozen frame
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost: saving and reloading');
    try {
      if (game.state === 'play' || game.state === 'pause') game.saveNow();
    } catch {
      /* ignore */
    }
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#050507;color:#e9c77d;font:20px Georgia,serif;z-index:100;text-align:center;padding:20px';
    msg.textContent = game.settings.lang === 'pt' ? 'A placa de vídeo reiniciou. Seu progresso foi salvo — recarregando…' : 'The graphics card was reset. Your progress is saved — reloading…';
    document.body.appendChild(msg);
    setTimeout(() => location.reload(), 2500);
  });

  // the installed game: offline copy + automatic updates (hosted site only; not the offline file or
  // an embedded preview)
  let topLevel = false;
  try {
    topLevel = window.top === window.self;
  } catch {
    topLevel = false;
  }
  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  if (import.meta.env.PROD && 'serviceWorker' in navigator && secure && topLevel) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && game.state !== 'boot') ui.toast(ui.t('updateReady'), 'info');
    });
  }
  // say so once after an update arrived
  try {
    const prev = localStorage.getItem('tessella.version');
    if (prev && prev !== __BUILD__) setTimeout(() => ui.toast(ui.t('updated'), 'info'), 12000);
    localStorage.setItem('tessella.version', __BUILD__);
  } catch {
    /* storage blocked */
  }

  game.state = 'boot';
  window.__ready = true;
  const params = new URLSearchParams(location.search);
  if (params.has('dev')) {
    // developer shortcut: skip the intro, start or continue directly
    await (await import('./dev')).devStart(game, ui, params);
    return;
  }
  await ui.intro();
}

boot().catch((e) => {
  console.error(e);
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;inset:20px;color:#f88;font:12px monospace;white-space:pre-wrap;z-index:99';
  el.textContent = 'TESSELLA failed to start:\n' + (e?.stack ?? e);
  document.body.appendChild(el);
});
