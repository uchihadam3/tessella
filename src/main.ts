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
    if (game.pm.aimed) {
      expectUnlock = true;
      game.pm.engage(game.pm.aimed);
      ui.setCrosshair('hidden');
    } else if (!game.secretClick?.()) input.lock();
  });
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
