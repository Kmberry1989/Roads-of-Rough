import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const out=path.dirname(fileURLToPath(import.meta.url));const results={errors:[]};
async function make(options={}){const context=await browser.newContext({viewport:{width:1280,height:720},...options});const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))results.errors.push(m.text())});await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).mode==='select');await page.evaluate(()=>window.advanceTime(0));return {context,page}}
{
 const {context,page}=await make();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 results.route=await page.evaluate(()=>{
  const read=()=>JSON.parse(window.render_game_to_text()),key=(k,type)=>window.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true}));
  const frames=[];let previousWave=0, facing=1, hitKinds=new Set();
  for(let tick=0;tick<1800;tick++){
   const s=read(),p=s.player;if(s.mode==='victory'||p.health<=0)return {ticks:tick,state:s,waves:frames,hitKinds:[...hitKinds]};
   if(s.wave!==previousWave){frames.push({wave:s.wave,health:p.health,score:s.score});previousWave=s.wave}
   if(s.lastImpact)hitKinds.add(s.lastImpact.kind);
   const keys=[];let attack='';
   if(s.enemies.length){
    const enemy=[...s.enemies].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];const dx=enemy.x-p.x,dy=enemy.y-p.y;
    if(!p.action&&p.state!=='hurt'){
     const desiredFacing=dx<0?-1:1;
     const gap=p.meter>=100?210:105;
     if(Math.abs(dy)>16)keys.push(dy<0?'ArrowUp':'ArrowDown');
     if(Math.abs(dx)>gap+15)keys.push(dx<0?'ArrowLeft':'ArrowRight');
     else if(Math.abs(dx)<gap-20)keys.push(dx<0?'ArrowRight':'ArrowLeft');
     else if(Math.abs(dy)<30){if(facing!==desiredFacing){const turn=desiredFacing<0?'ArrowLeft':'ArrowRight';key(turn,'keydown');window.advanceTime(1000/60);key(turn,'keyup');facing=desiredFacing;}attack=p.meter>=100?'l':'k';}
     // Moving away turns the player; correct facing before an attack on the next tick.
     if(keys.includes('ArrowRight'))facing=1;if(keys.includes('ArrowLeft'))facing=-1;
    }
   }else{keys.push('ArrowRight');facing=1}
   for(const k of keys)key(k,'keydown');if(attack)key(attack,'keydown');window.advanceTime(100);for(const k of keys)key(k,'keyup');if(attack)key(attack,'keyup');
  }
  return {state:read(),waves:frames,hitKinds:[...hitKinds],timeout:true};
 });
 await page.screenshot({path:out+'/route-final.png'});await context.close();
}
{
 const {context,page}=await make({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const box=await page.locator('#game').boundingBox();await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.5);
 async function hold(action,ms){const button=page.locator(`[data-action="${action}"]`);const r=await button.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.evaluate(ms=>window.advanceTime(ms),ms);await page.mouse.up()}
 await hold('right',650);const moved=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 await hold('dodge',150);const dodged=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 await page.evaluate(()=>window.advanceTime(500));await hold('light',16);const attacked=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 results.touchControls={moved:moved.player,dodged:dodged.player,attacked:attacked.player};await page.screenshot({path:out+'/touch-controls.png'});await context.close();
}
{
 const {context,page}=await make();await page.keyboard.press('Enter');await page.evaluate(()=>window.advanceTime(60000));results.defeat=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 await page.screenshot({path:out+'/defeat.png'});await page.keyboard.press('r');results.restart=JSON.parse(await page.evaluate(()=>window.advanceTime(1000/60)));await context.close();
}
await fs.writeFile(out+'/route-evidence.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
