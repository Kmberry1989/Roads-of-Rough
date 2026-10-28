import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.GAME_URL || 'http://127.0.0.1:4173';
const out = path.resolve(process.env.QA_OUTPUT || 'output/playwright/fixes-2026-10-11');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { errors: [], checks: {} };
async function make(options = {}, diagnostic = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  const page = await context.newPage();
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) results.errors.push(message.text()); });
  if (diagnostic) await page.route('**/game.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace('  window.render_game_to_text = renderGameToText;',
      '  window.__audit = {state, drawAnimatedSprite, drawSprite, image, heroFrames, specialFrames, createEnemy, beginRun, updatePlayer, startAttack, keys, heldActions, pressedActions};\n  window.render_game_to_text = renderGameToText;') });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode === 'select');
  await page.evaluate(() => window.advanceTime(0));
  return { page, context };
}
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const step = (page, ms) => page.evaluate(ms => window.advanceTime(ms), ms);
async function start(page) { await page.keyboard.press('Enter'); await step(page, 1000 / 60); }
async function checkLayout(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const rect = await page.evaluate(() => {
    const r = document.querySelector('#game').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, viewport: [innerWidth, innerHeight], intrinsic: [game.width, game.height] };
  });
  assert.ok(rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= rect.viewport[0] + 1 && rect.y + rect.height <= rect.viewport[1] + 1, 'canvas must fit viewport');
  assert.ok(Math.abs(rect.width / rect.height - rect.intrinsic[0] / rect.intrinsic[1]) < .001, 'canvas must preserve its intrinsic aspect ratio');
  return rect;
}
try {
  {
    const { page, context } = await make(); await start(page);
    results.checks.resize = [];
    for (const size of [{ width: 900, height: 500 }, { width: 1280, height: 300 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(size); results.checks.resize.push(await checkLayout(page));
      if (size.width === 900) await page.screenshot({ path: path.join(out, 'desktop-resized.png') });
    }
    await page.keyboard.press('f'); await page.waitForFunction(() => Boolean(document.fullscreenElement));
    results.checks.fullscreen = { entered: true, rect: await checkLayout(page) };
    await page.keyboard.press('f'); await page.waitForFunction(() => !document.fullscreenElement); results.checks.fullscreen.exited = true;
    await page.keyboard.down('ArrowRight'); await step(page, 250); const before = await read(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await step(page, 750); const after = await read(page);
    assert.equal(after.mode, 'paused'); assert.deepEqual(after.player, before.player);
    await page.keyboard.up('ArrowRight'); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.keyboard.press('p'); await step(page, 250); const resumed = await read(page);
    assert.equal(resumed.mode, 'play'); assert.equal(resumed.player.x, before.player.x);
    results.checks.blur = { before: before.player, paused: after.player, resumed: resumed.player };
    await page.keyboard.press('p'); const paused = await read(page); await step(page, 500);
    assert.deepEqual((await read(page)).player, paused.player); await page.keyboard.press('p'); assert.equal((await read(page)).mode, 'play');
    await page.click('#audio-toggle'); await page.locator('#audio-volume').focus(); const volume = await page.locator('#audio-volume').inputValue(); const x = (await read(page)).player.x;
    await page.keyboard.down('ArrowRight'); await step(page, 250); await page.keyboard.up('ArrowRight');
    assert.ok(Number(await page.locator('#audio-volume').inputValue()) > Number(volume)); assert.equal((await read(page)).player.x, x);
    await page.locator('#audio-mute').focus(); await page.keyboard.press('Space'); assert.equal((await read(page)).audio.muted, true);
    await page.keyboard.press('Enter'); assert.equal((await read(page)).audio.muted, false);
    results.checks.audioKeyboard = { volumeBefore: volume, volumeAfter: await page.locator('#audio-volume').inputValue(), playerX: x };
    await page.locator('#game').focus(); await page.keyboard.press('r'); assert.equal((await read(page)).player.x, 330);
    await context.close();
  }
  {
    const { page, context } = await make({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, true);
    await page.locator('[data-hero="2"]').tap(); await step(page, 1000 / 60);
    assert.equal((await read(page)).selectedHero, 'KRISTEN'); results.checks.rotation = [await checkLayout(page)];
    await page.screenshot({ path: path.join(out, 'touch-portrait.png') });
    for (const size of [{ width: 844, height: 390 }, { width: 320, height: 568 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size); results.checks.rotation.push(await checkLayout(page));
      for (const b of await page.locator('#touch-controls button').all()) { const rect = await b.boundingBox(); assert.ok(rect.x >= -1 && rect.x + rect.width <= size.width + 1, 'touch control must fit viewport'); }
      if (size.width === 844) await page.screenshot({ path: path.join(out, 'touch-landscape.png') });
      if (size.width === 320) await page.screenshot({ path: path.join(out, 'touch-small.png') });
    }
    const right = await page.locator('[data-action="right"]').boundingBox(), light = await page.locator('[data-action="light"]').boundingBox();
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 }, { x: light.x + light.width / 2, y: light.y + light.height / 2, id: 2 }] });
    await step(page, 100);
    const simultaneous = await page.evaluate(() => ({ state: JSON.parse(window.render_game_to_text()), held: [...window.__audit.heldActions] }));
    assert.equal(simultaneous.state.player.action, 'light'); assert.ok(simultaneous.held.includes('right') && simultaneous.held.includes('light'));
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await step(page, 500);
    assert.deepEqual(await page.evaluate(() => [...window.__audit.heldActions]), []);
    results.checks.multiTouch = simultaneous;
    await page.locator('[data-action="right"]').dispatchEvent('pointerdown', { pointerId: 3 }); await step(page, 100);
    const oldX = (await read(page)).player.x; await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await step(page, 500);
    assert.equal((await read(page)).player.x, oldX); assert.equal(await page.locator('#touch-controls .is-held').count(), 0);
    await context.close();
  }
  {
    const { page, context } = await make({}, true); await start(page);
    results.checks.drawing = await page.evaluate(() => {
      const a = window.__audit, ctx = game.getContext('2d'), original = ctx.drawImage.bind(ctx), trace = [];
      ctx.drawImage = (...args) => { const t = ctx.getTransform(); trace.push({ sourceX: args[1], alpha: ctx.globalAlpha, centre: t.a * (args[5] + args[7] / 2) + t.e }); original(...args); };
      const loops = [];
      for (const progress of [0, 1, 2, 3, 4, 8, 8.5]) { trace.length = 0; a.drawAnimatedSprite(a.image('player_kyle.png'), a.heroFrames.idle, progress, 330, 560, 210); loops.push({ progress, draws: [...trace] }); }
      const anchors = [];
      for (const frames of [a.heroFrames.idle, a.heroFrames.punch, a.heroFrames.kick, a.specialFrames]) for (const frame of frames) {
        trace.length = 0; a.drawSprite(a.image('player_kyle.png'), frame, 330, 560, 210, 1); a.drawSprite(a.image('player_kyle.png'), frame, 330, 560, 210, -1); anchors.push([...trace]);
      }
      trace.length = 0; a.drawAnimatedSprite(a.image('player_kyle.png'), a.heroFrames.kick, 20, 330, 560, 210, 1, 1, false); const nonLoop = [...trace];
      ctx.drawImage = original; return { loops, anchors, nonLoop };
    });
    const loops = results.checks.drawing.loops;
    assert.deepEqual(loops[0].draws, loops[2].draws); assert.deepEqual(loops[1].draws, loops[3].draws); assert.deepEqual(loops[0].draws, loops[5].draws);
    assert.equal(loops[6].draws.length, 1); assert.deepEqual(loops[6].draws.map(d => d.alpha), [1]);
    for (const pair of results.checks.drawing.anchors) for (const draw of pair) assert.ok(Math.abs(draw.centre - 330) < .001);
    assert.equal(results.checks.drawing.nonLoop.length, 1); assert.equal(results.checks.drawing.nonLoop[0].sourceX, 640);
    results.checks.combos = await page.evaluate(() => {
      const a = window.__audit, s = a.state, p = s.player, e = a.createEnemy(0, 398, 560); s.enemies = [e]; s.spawnQueue = [];
      p.x = 330; p.y = 560; p.invuln = 10; e.health = 1000; e.maxHealth = 1000; e.speed = 0; e.attackCooldown = 99;
      const hits = [];
      for (let hit = 0; hit < 3; hit++) { e.x = 398; e.invuln = 0; const before = e.health; a.startAttack('light'); for (let frame = 0; frame < 16; frame++) a.updatePlayer(1 / 60); hits.push({ combo: p.combo, damage: before - e.health }); }
      for (let frame = 0; frame < 90; frame++) a.updatePlayer(1 / 60);
      const expired = p.combo; e.x = 398; e.invuln = 0; const before = e.health; a.startAttack('light'); for (let frame = 0; frame < 16; frame++) a.updatePlayer(1 / 60);
      return { hits, expired, nextDamage: before - e.health };
    });
    assert.deepEqual(results.checks.combos.hits, [{ combo: 1, damage: 14 }, { combo: 2, damage: 16 }, { combo: 3, damage: 18 }]);
    assert.equal(results.checks.combos.expired, 0); assert.equal(results.checks.combos.nextDamage, 14);
    results.checks.hitVolumes = await page.evaluate(() => {
      const a = window.__audit, s = a.state, trials = [];
      for (const facing of [1, -1]) for (const attack of ['light', 'heavy', 'special']) for (const [distance, lane] of [[0, 0], [20, 0], [68, 0], [100, 0], [-20, 0], [400, 0], [68, 60]]) {
        a.beginRun(); const p = s.player, e = a.createEnemy(0, 330 + facing * distance, 560 + lane); s.enemies = [e]; s.spawnQueue = []; e.health = 1000; p.meter = 100; p.facing = facing;
        a.startAttack(attack); for (let i = 0; i < 20; i++) a.updatePlayer(1 / 60);
        trials.push({ facing, attack, distance, lane, damage: 1000 - e.health, meter: p.meter });
      }
      return trials;
    });
    for (const t of results.checks.hitVolumes) {
      const expected = t.distance >= 0 && t.distance <= 100 && t.lane === 0 ? { light: 14, heavy: 20, special: 36 }[t.attack] : 0;
      assert.equal(t.damage, expected, `hit volume ${JSON.stringify(t)}`);
      if (t.attack === 'special' && expected > 0) assert.equal(t.meter, 5);
    }
    await context.close();
  }
  {
    const { page, context } = await make({}, true);
    await page.evaluate(() => { window.pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }; navigator.getGamepads = () => [null, window.pad]; });
    const button = async (index, down, ms = 1000 / 60) => { await page.evaluate(({ index, down }) => { window.pad.buttons[index].pressed = down; }, { index, down }); await step(page, ms); };
    await page.evaluate(() => { window.pad.axes[0] = 1; }); await step(page, 500); assert.equal((await read(page)).selectedHero, 'ERIC');
    await page.evaluate(() => { window.pad.axes[0] = 0; }); await step(page, 16);
    await button(0, true); assert.equal((await read(page)).mode, 'play'); await button(0, false);
    await button(0, true, 100); assert.equal((await read(page)).player.action, 'light'); await button(0, false); await step(page, 450);
    await button(1, true, 100); assert.equal((await read(page)).player.action, 'heavy'); await button(1, false); await step(page, 650);
    await button(6, true, 100); assert.equal((await read(page)).player.state, 'dodge'); await button(6, false); await step(page, 350);
    await button(9, true, 500); assert.equal((await read(page)).mode, 'paused'); await button(9, false); await button(9, true); assert.equal((await read(page)).mode, 'play'); await button(9, false);
    await page.evaluate(() => { window.__audit.state.player.meter = 100; }); await button(5, true, 100); assert.equal((await read(page)).player.action, 'special'); await button(5, false);
    await button(8, true); assert.equal((await read(page)).player.x, 330); assert.equal((await read(page)).player.health, 125); await button(8, false);
    // Gamepad polling must not erase another input source's held movement or attack.
    await page.locator('[data-action="right"]').dispatchEvent('pointerdown', { pointerId: 1 }); await step(page, 100);
    assert.ok((await read(page)).player.x > 330); await page.locator('[data-action="right"]').dispatchEvent('pointerup', { pointerId: 1 });
    await page.locator('[data-action="light"]').dispatchEvent('pointerdown', { pointerId: 2 }); await step(page, 16);
    assert.ok((await page.evaluate(() => [...window.__audit.heldActions])).includes('light')); await page.locator('[data-action="light"]').dispatchEvent('pointerup', { pointerId: 2 });
    await page.evaluate(() => { window.__audit.state.player.health = 0; window.__audit.state.player.state = 'defeat'; }); await button(0, true); assert.equal((await read(page)).player.health, 125); await button(0, false);
    await page.evaluate(() => { window.__audit.state.mode = 'victory'; }); await button(9, true); assert.equal((await read(page)).mode, 'play'); assert.equal((await read(page)).wave, 1); await button(9, false);
    await page.evaluate(() => { navigator.getGamepads = () => []; }); await step(page, 100); assert.equal((await read(page)).player.action, null);
    results.checks.gamepad = { selection: 'ERIC', start: true, light: true, heavy: true, special: true, dodge: true, pauseResume: true, restart: true, defeatConfirm: true, victoryConfirm: true, sourceIsolation: true, disconnect: true };
    await context.close();
  }
  // Full routes use the normal keyboard/touch handlers, without diagnostic access or state mutation.
  for (const touch of [false, true]) {
    const { page, context } = await make(touch ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
    if (touch) { await page.locator('[data-hero="1"]').tap(); }
    else { await page.keyboard.press('ArrowRight'); await start(page); }
    const route = await page.evaluate(touch => {
      const read = () => JSON.parse(window.render_game_to_text());
      const mapping = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', k: 'heavy', l: 'special' };
      const key = (k, down) => touch
        ? document.querySelector(`[data-action="${mapping[k]}"]`).dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup', { bubbles: true, cancelable: true, pointerId: Object.keys(mapping).indexOf(k) + 1, pointerType: 'touch' }))
        : window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }));
      const waves = []; let previousWave = 0, facing = 1;
      for (let tick = 0; tick < 1800; tick++) {
        const s = read(), p = s.player; if (s.mode === 'victory' || p.health <= 0) return { ticks: tick, state: s, waves };
        if (s.wave !== previousWave) { waves.push({ wave: s.wave, health: p.health, score: s.score }); previousWave = s.wave; }
        const keys = []; let attack = '';
        if (s.enemies.length) {
          const enemy = [...s.enemies].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0], dx = enemy.x - p.x, dy = enemy.y - p.y;
          if (!p.action && p.state !== 'hurt') {
            const direction = dx < 0 ? -1 : 1, gap = p.meter >= 100 ? 210 : 105;
            if (Math.abs(dy) > 16) keys.push(dy < 0 ? 'ArrowUp' : 'ArrowDown');
            if (Math.abs(dx) > gap + 15) keys.push(dx < 0 ? 'ArrowLeft' : 'ArrowRight');
            else if (Math.abs(dx) < gap - 20) keys.push(dx < 0 ? 'ArrowRight' : 'ArrowLeft');
            else if (Math.abs(dy) < 30) {
              if (facing !== direction) { const turn = direction < 0 ? 'ArrowLeft' : 'ArrowRight'; key(turn, true); window.advanceTime(1000 / 60); key(turn, false); facing = direction; }
              attack = p.meter >= 100 ? 'l' : 'k';
            }
            if (keys.includes('ArrowRight')) facing = 1; if (keys.includes('ArrowLeft')) facing = -1;
          }
        } else { keys.push('ArrowRight'); facing = 1; }
        for (const k of keys) key(k, true); if (attack) key(attack, true); window.advanceTime(100); for (const k of keys) key(k, false); if (attack) key(attack, false);
      }
      return { timeout: true, state: read(), waves };
    }, touch);
    assert.equal(route.state.mode, 'victory', `${touch ? 'touch' : 'desktop'} route must win`); assert.equal(route.state.bossDefeated, true); assert.equal(route.state.queuedEnemies, 0); assert.equal(route.state.enemies.length, 0);
    assert.deepEqual(route.waves.map(w => w.wave), [1, 2, 3, 4]); results.checks[touch ? 'touchRoute' : 'desktopRoute'] = route;
    await page.screenshot({ path: path.join(out, touch ? 'touch-victory.png' : 'desktop-victory.png') });
    if (!touch) {
      await page.keyboard.press('r'); await step(page, 60000); const dead = await read(page); assert.equal(dead.player.health, 0);
      await page.keyboard.press('r'); assert.equal((await read(page)).player.health, 125); results.checks.defeatRestart = true;
    }
    await context.close();
  }
  assert.deepEqual(results.errors, []);
  results.passed = true;
} finally {
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: results.passed, checks: Object.keys(results.checks), desktop: results.checks.desktopRoute?.state.player, touch: results.checks.touchRoute?.state.player, errors: results.errors }, null, 2));
