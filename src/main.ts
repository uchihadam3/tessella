// Temporary bootstrap: walkable island + test panels (replaced by the game shell).
import * as THREE from 'three';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { World } from './world/world';
import { skyForProgress } from './world/sky';
import { Player } from './player/player';
import { Panel, PanelManager } from './puzzle/panels';
import { puzzle } from './puzzle/board';
import { M } from './world/materials';

await document.fonts.load('700 40px "Cormorant Garamond"').catch(() => {});
const app = document.getElementById('app')!;
const engine = new Engine(app);
const input = new Input(engine.renderer.domElement);
const world = new World(engine);
const pm = new PanelManager(engine.camera, engine.renderer.domElement);
engine.scene.add(pm.group);

const tests = [
  puzzle('t.gem', { grid: '@a . @b .\n. . . .\n@b . . @a\n. @c . .' }),
  puzzle('t.mix', { grid: "m3 . c2 .\n. fT . x4\nb3 . . tm\n. # tm' .", shapes: { T: 'xxx/.x.' } }),
  puzzle('t.weave', { grid: '. . . . .\n. . . . .\n. . . . .\n. . . . .\n. . . . .', rows: '1 1|5|3|1 1 1|1', cols: '2|1 2|4|1 2|2' }),
  puzzle('t.plate', { grid: '. . .\n. . .\n. . .', target: '010/111/010' }),
  puzzle('t.echo', { grid: '.{+} .{+} .{+}\n.{+} ~.{+} .{+}\n.{+} .{+} .{+}', target: '111/101/111' }),
  puzzle('t.drum', { grid: '@a . . @a . . @b .\n. . . . . . . .\n@b . . . . . . .', wrap: true }),
];
const colors = ['#ffa94d', '#c8ec6e', '#b993ff', '#ffd29a', '#63f0ff', '#e8f0ff'];
let prev: Panel | null = null;
tests.forEach((def, k) => {
  const p = new Panel(def, 'hub', 't', { lit: colors[k], accent: '#e7c35a', frame: k % 2 ? M.marble() : M.stone() });
  const x = -9 + k * 3.6;
  p.view.root.position.set(x, world.terrain.heightAt(x, 34), 34);
  p.view.root.rotation.y = 0;
  pm.add(p);
  p.powered = true;
  p.view.setPowered(true);
  world.collision.addBlocker({ x, z: 34, r: 0.45, y0: -10, y1: 100 });
  world.forest.exclude(x, 34, 3);
  if (prev) pm.link(prev, p, [new THREE.Vector3(x - 3.6, world.terrain.heightAt(x - 3.6, 34.6) + 0.02, 34.6), new THREE.Vector3(x - 1.8, world.terrain.heightAt(x - 1.8, 35) + 0.02, 35), new THREE.Vector3(x, world.terrain.heightAt(x, 34.6) + 0.02, 34.6)]);
  prev = p;
});
world.finalize();
pm.refreshPower();
for (const p of pm.panels) {
  p.powered = true;
  p.view.setPowered(true);
}

const player = new Player(world.collision, input);
const params = new URLSearchParams(location.search);
world.sky.snap(skyForProgress(Number(params.get('p') ?? '0.3')));
const at = (params.get('at') ?? '0,40,0,-5').split(',').map(Number);
player.place(at[0], at[1], (at[2] * Math.PI) / 180);
player.pitch = (at[3] * Math.PI) / 180;
pm.returnView = () => {
  player.applyCamera(engine.camera);
  return { pos: engine.camera.position.clone(), quat: engine.camera.quaternion.clone() };
};

// demo state for screenshots
if (params.get('demo')) {
  const s = (id: string, str: string) => {
    const p = pm.byId.get(id)!;
    p.state = Uint8Array.from(str.split('').map((c) => (c === '1' ? 1 : 0)));
    p.view.setState(p.state, true);
  };
  s('t.gem', '1100010001100001');
  s('t.mix', '1110010010001000');
  s('t.weave', '1010011111011101010100100');
}

engine.renderer.domElement.addEventListener('click', () => {
  if (!pm.engaged) {
    if (pm.aimed) pm.engage(pm.aimed);
    else input.lock();
  }
});
input.on('mousedown', (e) => pm.pointerDown((e as MouseEvent).clientX, (e as MouseEvent).clientY, (e as MouseEvent).button));
input.on('mouseup', () => pm.pointerUp());
input.on('mousemove', (e) => pm.pointerMove((e as MouseEvent).clientX, (e as MouseEvent).clientY));
input.on('keydown', (e) => {
  const k = (e as KeyboardEvent).code;
  if (pm.engaged) {
    if (k === 'Space' || k === 'Enter') pm.submit();
    if (k === 'KeyZ') pm.undo();
    if (k === 'KeyR') pm.reset();
    if (k === 'Escape' || k === 'KeyQ') pm.leave();
  }
});
pm.events.engage = (p) => {
  if (p) input.unlock();
};

const engageIdx = params.get('engage');
let engagedOnce = false;
engine.onUpdate((dt, t) => {
  const [mx, my] = input.consumeMouse();
  if (!pm.controllingCamera) {
    if (input.locked) player.look(mx, my);
    player.update(dt);
    player.applyCamera(engine.camera);
    pm.updateAim();
  }
  if (engageIdx !== null && !engagedOnce && t > 1) {
    engagedOnce = true;
    pm.engage(pm.panels[Number(engageIdx)]);
  }
  pm.update(dt, t);
  engine.bloom.strength = 0.42 - 0.24 * pm.closeUp;
  world.update(dt, t, engine.camera.position);
  input.endFrame();
});
engine.start();
(window as unknown as { __dbg: unknown }).__dbg = { engine, pm, world, player };
(window as unknown as { __ready: boolean }).__ready = true;
