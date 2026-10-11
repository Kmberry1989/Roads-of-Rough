import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
const out=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true});
const evidence={errors:[], checks:{}};
async function pageFor(options={},diagnostic=false){
 const context=await browser.newContext({viewport:{width:1280,height:720},...options});
 const page=await context.newPage();
 page.on('pageerror',e=>evidence.errors.push(e.message));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))evidence.errors.push(m.text());});
 if(diagnostic)await page.route('**/game.js',async route=>{
  const res=await route.fetch();
  const source=await res.text();
  await route.fulfill({response:res,body:source.replace('  window.render_game_to_text = renderGameToText;','  window.__audit = {state, drawAnimatedSprite, drawSprite, image, heroFrames, startAttack, updatePlayer, updateEnemy};\n  window.render_game_to_text = renderGameToText;')});
 });
 await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).mode==='select');
 await page.evaluate(()=>window.advanceTime(0));
 return {page,context};
}
async function start(page){await page.keyboard.press('Enter');await page.evaluate(()=>window.advanceTime(1000/60));}
async function state(page){return JSON.parse(await page.evaluate(()=>window.render_game_to_text()));}
{
 const {page,context}=await pageFor();await start(page);
 await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.advanceTime(250));const before=await state(page);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.evaluate(()=>window.advanceTime(750));const after=await state(page);
 evidence.checks.blur={before:before.player,after:after.player};await page.keyboard.up('ArrowRight');
 await page.keyboard.press('p');const paused=await state(page);await page.evaluate(()=>window.advanceTime(500));const still=await state(page);
 await page.keyboard.press('p');evidence.checks.pause={paused:paused.mode,frozen:JSON.stringify(paused.player)===JSON.stringify(still.player),resumed:(await state(page)).mode};
 await page.click('#audio-toggle');await page.locator('#audio-volume').focus();const oldvol=await page.locator('#audio-volume').inputValue();const old=(await state(page)).player.x;
 await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowRight');
 evidence.checks.sliderKeyboard={beforeVolume:oldvol,afterVolume:await page.locator('#audio-volume').inputValue(),beforeX:old,afterX:(await state(page)).player.x};
 await page.screenshot({path:out+'/desktop.png'});
 await page.setViewportSize({width:900,height:500});
 evidence.checks.desktopResize=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],canvas:{width:game.getBoundingClientRect().width,height:game.getBoundingClientRect().height},shell:{width:document.querySelector('.game-shell').getBoundingClientRect().width,height:document.querySelector('.game-shell').getBoundingClientRect().height}}));
 await page.screenshot({path:out+'/desktop-resized.png'});await context.close();
}
{
 const {page,context}=await pageFor({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.screenshot({path:out+'/touch-select.png'});
 const canvas=await page.locator('#game').boundingBox();await page.touchscreen.tap(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);await page.evaluate(()=>window.advanceTime(1000/60));
 evidence.checks.touchPortrait=await page.evaluate(()=>({state:JSON.parse(window.render_game_to_text()),buttons:[...document.querySelectorAll('#touch-controls button')].map(b=>{const r=b.getBoundingClientRect();return {action:b.dataset.action,x:r.x,y:r.y,w:r.width,h:r.height}})}));
 await page.screenshot({path:out+'/touch-portrait.png'});
 await page.setViewportSize({width:844,height:390});
 evidence.checks.touchRotation=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],canvas:{width:game.getBoundingClientRect().width,height:game.getBoundingClientRect().height},shell:{width:document.querySelector('.game-shell').getBoundingClientRect().width,height:document.querySelector('.game-shell').getBoundingClientRect().height}}));
 await page.screenshot({path:out+'/touch-rotated.png'});await context.close();
}
{
 const {page,context}=await pageFor();
 await page.evaluate(()=>{window.__pad={axes:[1,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===0||i===9}))};navigator.getGamepads=()=>[window.__pad]});
 await page.evaluate(()=>window.advanceTime(2000));evidence.checks.gamepadSelect=await state(page);
 await start(page);await page.evaluate(()=>window.advanceTime(200));evidence.checks.gamepadPlay=await state(page);
 await page.evaluate(()=>{window.__pad.buttons[0].pressed=false;window.__pad.buttons[9].pressed=false;window.__pad.buttons[4].pressed=true;window.__pad.buttons[5].pressed=true});
 await page.evaluate(()=>window.advanceTime(1000));evidence.checks.gamepadShoulders=await state(page);
 await context.close();
}
{
 const {page,context}=await pageFor({},true);await start(page);
 evidence.checks.animation=await page.evaluate(()=>{
  const a=window.__audit,ctx=game.getContext('2d'),original=ctx.drawImage.bind(ctx),trace=[];
  ctx.drawImage=(...args)=>{trace.push({sourceX:args[1],sourceY:args[2],destinationX:args[5],alpha:ctx.globalAlpha});return original(...args)};
  for(const progress of [0,1,2,3,4,8]){trace.push({progress});a.drawAnimatedSprite(a.image('player_kyle.png'),a.heroFrames.idle,progress,330,560,210,1)};
  ctx.drawImage=original;return trace;
 });
 evidence.checks.facingAnchor=await page.evaluate(()=>{
  const a=window.__audit,ctx=game.getContext('2d'),orig=ctx.drawImage.bind(ctx),trace=[];
  ctx.drawImage=(...args)=>{const t=ctx.getTransform(),x=args[5]+args[7]/2;trace.push({centre:t.a*x+t.e,width:args[7]});return orig(...args)};
  a.drawSprite(a.image('player_kyle.png'),a.heroFrames.idle[0],330,560,210,1);a.drawSprite(a.image('player_kyle.png'),a.heroFrames.idle[0],330,560,210,-1);ctx.drawImage=orig;return trace;
 });
 // Controlled scene uses unchanged update/combat logic to isolate combo counters and hit geometry.
 evidence.checks.combo=await page.evaluate(()=>{
  const a=window.__audit,s=a.state,p=s.player,e=s.enemies[0];s.enemies=[e];s.spawnQueue=[];p.x=330;p.y=560;p.action='';p.hurtTimer=0;p.invuln=10;p.combo=0;p.comboTimer=0;e.x=398;e.y=560;e.health=100;e.maxHealth=100;e.speed=0;e.attackCooldown=99;
  const key=()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'j'}));const snap=()=>({combo:p.combo,comboTimer:p.comboTimer,actionTime:p.actionTime,enemyHealth:e.health});
  key();window.advanceTime(1000/60);const begin=snap();window.advanceTime(180);const hit=snap();window.advanceTime(80);key();window.advanceTime(1000/60);const chain=snap();window.advanceTime(180);return {begin,hit,chain,secondHit:snap()};
 });
 evidence.checks.closeRange=await page.evaluate(()=>{
  const a=window.__audit,s=a.state,p=s.player,e=s.enemies[0];const trials=[];
  for(const attack of ['light','heavy','special'])for(const distance of [20,68,100,160]){p.x=330;p.y=560;p.action='';p.hurtTimer=0;p.state='idle';p.combo=0;p.comboTimer=0;p.meter=100;e.x=330+distance;e.y=560;e.health=1000;e.invuln=0;s.hitStop=0;a.startAttack(attack);for(let i=0;i<20;i++)a.updatePlayer(1/60);trials.push({attack,distance,damage:1000-e.health});}
  return trials;
 });
 await context.close();
}
await fs.writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));await browser.close();
