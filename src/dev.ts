/**
 * Developer helpers (only loaded with ?dev in the URL): skip intro, teleport, auto-solve, screenshots.
 *   ?dev&at=x,z,yawDeg,pitchDeg   start a fresh game at a position
 *   ?dev&p=0.5                    sky progress
 *   ?dev&solve=kinship            mark all panels of an area solved
 *   ?dev&engage=<panelId>         engage a panel
 *   ?dev&menu                     open the main menu instead
 *   ?dev&fly=x,y,z,tx,ty,tz       free camera shot
 *   ?dev&norender                 simulate without drawing (fast automated playtests)
 */
import type { Game } from './game/game';
import type { UI } from './ui/ui';
import { skyForProgress } from './world/sky';
import { newSave } from './core/save';

export async function devStart(game: Game, ui: UI, params: URLSearchParams) {
  if (params.has('norender')) game.engine.skipRender = true;
  if (params.has('menu')) {
    ui.openMenu();
    return;
  }
  const s = newSave(2);
  const at = params.get('at');
  if (at) {
    const [x, z, yaw, pitch] = at.split(',').map(Number);
    s.player = { x, y: NaN, z, yaw: ((yaw ?? 0) * Math.PI) / 180, pitch: ((pitch ?? 0) * Math.PI) / 180 };
  }
  game.applySave({ ...s, player: { ...s.player, y: isNaN(s.player.y) ? (undefined as unknown as number) : s.player.y } });
  if (at) {
    const [x, z, yaw, pitch] = at.split(',').map(Number);
    game.player.place(x, z, ((yaw ?? 0) * Math.PI) / 180);
    game.player.pitch = ((pitch ?? 0) * Math.PI) / 180;
  }
  const solve = params.get('solve');
  if (solve) {
    for (const id of solve.split(',')) {
      for (const p of game.pm.panels) if (p.area === id) {
        p.solved = true;
        p.view.setSolved(true, false);
        for (const c of p.cablesOut) c.flow(true);
      }
    }
    game.pm.refreshPower();
  }
  const p = params.get('p');
  if (p) game.world.sky.snap(skyForProgress(Number(p)));
  game.state = 'play';
  ui.hideAll();
  ui.setCrosshair('dot');
  const eng = params.get('engage');
  if (eng) {
    const panel = game.pm.byId.get(eng);
    if (panel) {
      panel.powered = true;
      panel.view.setPowered(true);
      setTimeout(() => game.pm.engage(panel), 500);
    }
  }
  const fly = params.get('fly');
  if (fly) {
    const f = fly.split(',').map(Number);
    game.state = 'pause';
    game.engine.onUpdate(() => {
      game.engine.camera.position.set(f[0], f[1], f[2]);
      game.engine.camera.lookAt(f[3], f[4], f[5]);
    });
  }
  // expose for console debugging and the photo tour
  (window as unknown as { dev: unknown }).dev = { game, ui };
  (window as unknown as { __setSky: (p: number) => void }).__setSky = (v: number) => game.world.sky.snap(skyForProgress(v));
}
