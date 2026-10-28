import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(process.env.QA_OUTPUT || 'output/playwright/visual-fixes-2026-10-12/focused');
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const results = {errors:[],checks:{}};
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const step = (page,ms) => page.evaluate(ms => window.advanceTime(ms),ms);
async function open(options={}) {
  const context=await browser.newContext({viewport:{width:1280,height:720},...options});const page=await context.newPage();
  page.on('pageerror',e=>results.errors.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))results.errors.push(e.text());});
  await page.route('**/game.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('  window.render_game_to_text = renderGameToText;', '  window.__visual = {state, HEROES, heroFrames, specialFrames, beginRun, createEnemy, drawAnimatedSprite, image, drawPlayer};\n  window.render_game_to_text = renderGameToText;')});});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4173');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='select');await step(page,0);return {page,context};
}
try {
  const manifest=JSON.parse(await fs.readFile('sprites/runtime/hero-frames.json','utf8'));
  for(const [name,hero] of Object.entries(manifest.heroes)) {
    for (const source of [hero.source,hero.specialSource]) assert.equal(execFileSync('git',['hash-object',source],{encoding:'utf8'}).trim(),execFileSync('git',['rev-parse',`HEAD:${source}`],{encoding:'utf8'}).trim(),'original hero sheet must remain unchanged');
    assert.equal(hero.specialFrames.length,3);
    assert.equal(hero.frames.length,25);for(const frame of hero.frames){assert.ok(frame.baseline>frame.source.y);assert.ok(frame.anchorX>=frame.source.x&&frame.anchorX<frame.source.x+frame.source.w);}
  }
  results.checks.originalsAndMeasurements=true;
  {
    const {page,context}=await open();await page.screenshot({path:path.join(out,'desktop-select.png')});
    const poses=await page.evaluate(()=>{
      const a=window.__visual,c=game.getContext('2d'),original=c.drawImage.bind(c),trials=[];
      c.drawImage=(...args)=>{const t=c.getTransform();trials.push({sourceX:args[1],alpha:c.globalAlpha,centre:t.a*(args[5]+args[7]/2)+t.e});original(...args);};
      for(const hero of a.HEROES)for(const facing of [1,-1])for(let i=0;i<a.heroFrames.walk.length;i++)a.drawAnimatedSprite(a.image(hero.base),a.heroFrames.walk,i+.5,330,560,245,facing);
      for(const hero of a.HEROES)for(const facing of [1,-1])for(let i=0;i<a.specialFrames.length;i++)a.drawAnimatedSprite(a.image(hero.special),a.specialFrames,i+.5,330,560,245,facing,1,false);
      c.drawImage=original;return trials;
    });
    assert.equal(poses.length,90,'walk and special clips for every hero in both directions must draw one pose each');
    for(const pose of poses){assert.equal(pose.alpha,1);assert.ok(Math.abs(pose.centre-330)<.001);}
    results.checks.crispAnchoredPoses=poses;
    for(let hero=0;hero<5;hero++)for(const facing of [1,-1]){
      await page.evaluate(({hero,facing})=>{const a=window.__visual,s=a.state;s.selectedHero=hero;a.beginRun();s.enemies=[];s.spawnQueue=[];s.goTimer=0;s.messageTimer=0;s.player.state='walk';s.player.anim=3.5;s.player.facing=facing;}, {hero,facing});
      // A zero update could change the walking state: render through the normal RAF instead.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await page.screenshot({path:path.join(out,`hero-${hero}-${facing===1?'right':'left'}.png`)});
    }
    await page.keyboard.press('p');const paused=await read(page);
    const captions=await page.evaluate(()=>{const c=game.getContext('2d'),original=c.fillText.bind(c),seen=[];c.fillText=(text,...args)=>{if(text.includes('RESUME'))seen.push(text);original(text,...args);};window.advanceTime(0);c.fillText=original;return seen;});
    assert.ok(captions.some(text=>text.includes('TAP TO RESUME')&&text.includes('R TO RESTART')));
    await page.screenshot({path:path.join(out,'desktop-pause.png')});await page.locator('#game').click();const resumed=await read(page);assert.equal(resumed.mode,'play');assert.deepEqual(resumed.player,paused.player);results.checks.desktopPauseTap=true;
    await context.close();
  }
  for(const viewport of [{width:390,height:844},{width:320,height:568}]){
    const {page,context}=await open({viewport,hasTouch:true,isMobile:true});
    const prefix=`phone-${viewport.width}`;
    const roster=await page.locator('#portrait-roster button').all();assert.equal(roster.length,5);
    for(const button of roster){assert.ok(await button.isVisible());const box=await button.boundingBox();assert.ok(box.height>=44);}
    await page.screenshot({path:path.join(out,`${prefix}-select.png`)});await roster[0].tap();await step(page,16);
    const layout=await page.evaluate(()=>{
      const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {canvas:rect('game'),hud:rect('portrait-hud'),pad:rect('touch-controls'),audio:rect('audio-controls'),labels:[...document.querySelectorAll('#portrait-hud label')].map(e=>parseFloat(getComputedStyle(e).fontSize)),buttons:[...document.querySelectorAll('#touch-controls button')].map(e=>e.getBoundingClientRect().height),ratio:game.width/game.height};
    });
    assert.ok(layout.canvas.height>viewport.width*.9,'portrait combat must be taller than the old letterbox');
    assert.ok(layout.hud.bottom<=layout.canvas.top&&layout.audio.bottom<=layout.canvas.top&&layout.canvas.bottom<=layout.pad.top,'HUD/audio/pad must stay outside combat');
    assert.ok(Math.abs(layout.canvas.width/layout.canvas.height-layout.ratio)<.001,'portrait camera must not stretch sprites');
    assert.ok(layout.labels.every(size=>size>=12)&&layout.buttons.every(size=>size>=44));results.checks[prefix]=layout;
    for(const lane of [470,635]){
      await page.evaluate(lane=>{const a=window.__visual,s=a.state;a.beginRun();s.player.y=lane;s.spawnQueue=[];s.goTimer=0;s.messageTimer=0;const v=JSON.parse(window.render_game_to_text()).view;s.cameraX=Math.max(0,s.player.x-v.width*.32);s.enemies=[a.createEnemy(0,s.player.x+v.width*.45,lane,'thrower')];s.enemies[0].attackCooldown=0;window.advanceTime(150);},lane);
      assert.equal((await read(page)).enemies[0].state,'windup');
      const warning=await page.evaluate(()=>{const c=game.getContext('2d'),original=c.fillText.bind(c),seen=[];c.fillText=(text,...args)=>{if(text.includes('BOTTLE'))seen.push(parseFloat(c.font.match(/([\d.]+)px/)[1])*game.getBoundingClientRect().width/game.width);original(text,...args);};window.advanceTime(16);c.fillText=original;return seen;});
      assert.ok(warning.length&&warning.every(size=>size>=11.99));
      await page.screenshot({path:path.join(out,`${prefix}-tell-${lane}.png`)});
      await page.locator('#audio-toggle').click();const panel=await page.locator('#audio-panel').boundingBox();assert.ok(panel.y+panel.height<=layout.canvas.top,'expanded mixer must stay above combat');await page.locator('#audio-toggle').click();
    }
    await page.locator('#portrait-pause').click();assert.equal((await read(page)).mode,'paused');assert.equal(await page.locator('#touch-controls').isVisible(),false);
    await page.screenshot({path:path.join(out,`${prefix}-pause.png`)});
    const before=await read(page);await page.locator('#portrait-overlay').tap({position:{x:20,y:20}});assert.equal((await read(page)).mode,'play');assert.deepEqual((await read(page)).player,before.player);
    await page.locator('#portrait-pause').click();await page.locator('#portrait-resume').click();assert.equal((await read(page)).mode,'play');
    await page.locator('#portrait-pause').click();await page.locator('#portrait-restart').click();assert.equal((await read(page)).player.x,330);
    results.checks[`${prefix}-pauseResumeRestart`]=true;
    await context.close();
  }
  assert.deepEqual(results.errors,[]);results.passed=true;
}finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify({passed:results.passed,checks:Object.keys(results.checks),errors:results.errors},null,2));
