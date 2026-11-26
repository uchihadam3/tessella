// Starting over really starts over: play (solve panels, open a door), clear the save and start a
// new game in the same slot → nothing solved, nothing open; and clearing the game being played
// (from the pause menu) never brings it back.
// Usage: BASE=http://localhost:5180/ node scripts/newgame-e2e.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:5180/';
const results = [];
const ok = (name, cond, extra = '') => {
  results.push(cond);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, locale: 'pt-BR' });
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const click = async (sel) => {
    const el = typeof sel === 'string' ? await page.waitForSelector(sel, { state: 'visible' }) : sel;
    const b = await el.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const gate = async () => {
    await page.waitForFunction(() => window.__ready === true);
    await page.waitForTimeout(1200);
    await page.mouse.click(480, 300);
  };
  const waitPlay = () => page.waitForFunction(() => window.__game?.state === 'play' && !window.__game.pm.controllingCamera, null, { timeout: 180000 });
  const progress = () => page.evaluate(() => {
    const g = window.__game;
    const doors = [...g.areas.values()].flatMap((a) => [...a.doors.values()]).filter((d) => d.open).length;
    return { solved: g.pm.panels.filter((p) => p.solved).length, doors, slot0: !!localStorage.getItem('tessella.save.0') };
  });
  const clearSlot0 = async () => {
    const btn = await page.waitForSelector('#slots.on .slotcard >> nth=0 >> .row button >> nth=1');
    await click(btn);
    await click('.dialog .y');
    await page.waitForTimeout(600);
  };

  await page.goto(BASE, { waitUntil: 'load' });
  await gate();
  await page.waitForSelector('#menu.on', { timeout: 180000 });
  await page.waitForTimeout(1500);
  await click('#menu .menu-items button:has-text("Novo jogo")');
  await page.waitForSelector('#slots.on .slotcard');
  await click((await page.$$('.slotcard'))[0]);
  await waitPlay();
  // play: the whole prologue solved at once (opens its gate)
  await page.evaluate(() => {
    const g = window.__game;
    for (const p of g.pm.panels) if (p.area === 'prologue') {
      p.solved = true;
      p.view.setSolved(true, false);
      for (const f of p.onSolved) f(p);
    }
    g.pm.refreshPower();
    g.saveNow();
  });
  const played = await progress();
  ok('played: panels solved and a door open', played.solved > 0 && played.doors > 0, JSON.stringify(played));

  // pause → main menu → new game → clear slot 0 → start in it
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause.on');
  await click('#pause .menu-items button >> nth=-1');
  await page.waitForSelector('#menu.on');
  await page.waitForTimeout(1200);
  await click('#menu .menu-items button:has-text("Novo jogo")');
  await page.waitForSelector('#slots.on .slotcard');
  await clearSlot0();
  // a fresh page comes back: tap, then straight into the new game
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), click((await page.$$('.slotcard'))[0])]);
  await gate();
  await waitPlay();
  await page.waitForTimeout(1500);
  const fresh = await progress();
  ok('new game after clearing the save: nothing solved, nothing open', fresh.solved === 0 && fresh.doors === 0, JSON.stringify(fresh));
  const pos = await page.evaluate(() => [window.__game.player.pos.x, window.__game.player.pos.z].map((v) => +v.toFixed(1)));
  ok('new game starts in the cave', Math.abs(pos[1] - 279.5) < 1, JSON.stringify(pos));

  // clearing the game being played (pause → load → clear) does not bring it back
  await page.evaluate(() => {
    const g = window.__game;
    const p = g.pm.panels.find((q) => q.area === 'prologue');
    p.solved = true;
    p.view.setSolved(true, false);
    g.saveNow();
  });
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause.on');
  await click('#pause .menu-items button:has-text("Carregar")');
  await page.waitForSelector('#slots.on .slotcard');
  await clearSlot0();
  await page.evaluate(() => {
    window.__game.saveNow();
    dispatchEvent(new Event('beforeunload'));
  });
  const gone = await page.evaluate(() => !localStorage.getItem('tessella.save.0'));
  ok('the cleared game is not written back', gone);
  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(results.every(Boolean) ? 'NEWGAME: ALL PASS' : 'NEWGAME: FAILURES');
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => {
  console.log('crashed', e.message.split('\n')[0]);
  process.exit(1);
});
