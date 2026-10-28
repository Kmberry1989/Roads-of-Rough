import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(process.env.QA_OUTPUT || 'output/playwright/thrower-2026-10-12/focused');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { checks: {}, errors: [] };
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    page.on('pageerror', e => results.errors.push(e.message));
    page.on('console', e => { if (['error', 'warning'].includes(e.type())) results.errors.push(e.text()); });
    // Private diagnostic access exists only in this intercepted test response.
    await page.route('**/game.js', async route => {
      const response = await route.fetch(), body = await response.text();
      await route.fulfill({ response, body: body.replace('  window.render_game_to_text = renderGameToText;', '  window.__qa = { state, createEnemy, beginRun, hitEnemy, spawnWave, image, throwerFrames, launchBottle, updateProjectiles, updateEnemy };\n  window.render_game_to_text = renderGameToText;') });
    });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'select');
    const step = ms => page.evaluate(ms => window.advanceTime(ms), ms);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const setup = async () => page.evaluate(() => {
      const a = window.__qa; a.beginRun(); const s = a.state;
      s.spawnQueue = []; s.goTimer = 0; s.messageTimer = 0;
      const view = JSON.parse(window.render_game_to_text()).view;
      s.cameraX = Math.max(0, s.player.x - (view.portrait ? view.width * .32 : 370));
      s.enemies = [a.createEnemy(0, 330 + Math.min(360, view.width * .5), 560, 'thrower')]; s.enemies[0].attackCooldown = 0;
      window.advanceTime(1000 / 60);
    });
    await setup();
    const initial = await read(); assert.equal(initial.enemies[0].state, 'windup'); assert.deepEqual(initial.enemies[0].tell.target, { x: 330, y: 560 });
    await step(450); await page.screenshot({ path: path.join(out, touch ? 'touch-tell.png' : 'desktop-tell.png') });
    await step(750); const flying = await read(); assert.equal(flying.projectiles.length, 1);
    await page.screenshot({ path: path.join(out, touch ? 'touch-flight.png' : 'desktop-flight.png') });
    // Pause freezes projectile travel as well as combat.
    await page.keyboard.press('p'); const paused = await read(); await step(1000); assert.deepEqual((await read()).projectiles, paused.projectiles); await page.keyboard.press('p');
    await step(flying.projectiles[0].remaining * 1000 + 20); const hit = await read(); assert.equal(hit.player.health, 88); assert.equal(hit.lastProjectileImpact.outcome, 'hit'); assert.equal(hit.projectiles.length, 0);
    await page.screenshot({ path: path.join(out, touch ? 'touch-hit.png' : 'desktop-hit.png') });
    results.checks[touch ? 'touchHit' : 'keyboardHit'] = { initial, flying, hit };
    // Moving to another lane escapes the fixed target without invulnerability.
    await setup();
    if (touch) await page.locator('[data-action="up"]').dispatchEvent('pointerdown', { pointerId: 11 }); else await page.keyboard.down('ArrowUp');
    await step(500);
    if (touch) await page.locator('[data-action="up"]').dispatchEvent('pointerup', { pointerId: 11 }); else await page.keyboard.up('ArrowUp');
    assert.deepEqual((await read()).enemies[0].tell.target, { x: 330, y: 560 });
    await step(1500); const miss = await read(); assert.equal(miss.player.health, 100); assert.equal(miss.lastProjectileImpact.outcome, 'miss');
    results.checks[touch ? 'touchLaneEscape' : 'keyboardLaneEscape'] = miss;
    // Timed dodge is effective at the original target, not just by moving away.
    await setup(); await step(1400);
    if (touch) await page.locator('[data-action="dodge"]').dispatchEvent('pointerdown', { pointerId: 12 }); else await page.keyboard.down('Shift');
    await step(16);
    if (touch) await page.locator('[data-action="dodge"]').dispatchEvent('pointerup', { pointerId: 12 }); else await page.keyboard.up('Shift');
    await page.evaluate(() => { const p = window.__qa.state.player; p.x = 330; p.dodgeVx = 0; });
    await step(250); const dodged = await read(); assert.equal(dodged.player.health, 100); assert.equal(dodged.lastProjectileImpact.outcome, 'dodged');
    results.checks[touch ? 'touchDodge' : 'keyboardDodge'] = dodged;
    await page.screenshot({ path: path.join(out, touch ? 'touch-dodge.png' : 'desktop-dodge.png') });
    await setup();
    await page.evaluate(() => { const a = window.__qa; a.hitEnemy(a.state.enemies[0], 14, 0); });
    await step(1000); assert.equal((await read()).projectiles.length, 0); assert.equal((await read()).enemies[0].tell, null);
    await setup();
    await page.evaluate(() => { const a = window.__qa; a.hitEnemy(a.state.enemies[0], 999, 0); });
    await step(2000); assert.equal((await read()).projectiles.length, 0); assert.equal((await read()).enemies.length, 0);
    await setup(); await step(1000);
    await page.evaluate(() => { const a = window.__qa; a.hitEnemy(a.state.enemies[0], 999, 0); });
    assert.equal((await read()).projectiles.length, 1); await step(1000); assert.equal((await read()).lastProjectileImpact.outcome, 'hit');
    await page.keyboard.press('r'); const restart = await read(); assert.equal(restart.projectiles.length, 0); assert.equal(restart.lastProjectileImpact, null);
    results.checks[touch ? 'touchLifecycle' : 'keyboardLifecycle'] = true;
    if (!touch) {
      results.checks.assetsAndWaves = await page.evaluate(() => {
        const a = window.__qa, s = a.state, sheet = a.image('expansion/runtime/enemy-thrower.png');
        const c = document.createElement('canvas'); c.width = sheet.width; c.height = sheet.height; const ctx = c.getContext('2d'); ctx.drawImage(sheet, 0, 0);
        const transparent = [...ctx.getImageData(0, 0, 1, 1).data];
        const waves = []; for (let i = 0; i < 4; i++) { a.beginRun(); a.spawnWave(i); waves.push([...s.enemies.filter(e => !e.dead).map(e => e.type), ...s.spawnQueue]); }
        a.beginRun(); s.spawnQueue = []; const e = a.createEnemy(0, -100, 560, 'thrower'); e.attackCooldown = 0; s.enemies = [e]; a.updateEnemy(e, 1 / 60);
        return { dimensions: [sheet.width, sheet.height], transparent, waves, offscreen: e.state };
      });
      assert.equal(results.checks.assetsAndWaves.transparent[3], 0);
      assert.equal(results.checks.assetsAndWaves.waves[0].includes('thrower'), false);
      for (const recipe of results.checks.assetsAndWaves.waves.slice(1)) assert.ok(recipe.includes('thrower'));
      assert.notEqual(results.checks.assetsAndWaves.offscreen, 'windup');
      // The existing gamepad dodge mapping must also evade a landing bottle.
      await setup(); await step(1400);
      await page.evaluate(() => { const pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 6 })) }; navigator.getGamepads = () => [pad]; });
      await step(16); await page.evaluate(() => { const p = window.__qa.state.player; p.x = 330; p.dodgeVx = 0; navigator.getGamepads = () => []; });
      await step(250); const gamepad = await read(); assert.equal(gamepad.lastProjectileImpact.outcome, 'dodged'); assert.equal(gamepad.player.health, 100); results.checks.gamepadDodge = gamepad;
    }
    await context.close();
  }
  assert.deepEqual(results.errors, []); results.passed = true;
} finally {
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: results.passed, checks: Object.keys(results.checks), errors: results.errors }, null, 2));
