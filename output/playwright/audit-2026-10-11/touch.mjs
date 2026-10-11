import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const out=path.dirname(fileURLToPath(import.meta.url));const results=JSON.parse(await fs.readFile(out+'/route-evidence.json','utf8'));
async function make(options={}){const context=await browser.newContext({viewport:{width:1280,height:720},...options});const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))results.errors.push(m.text())});await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).mode==='select');await page.evaluate(()=>window.advanceTime(0));return {context,page}}
{
 const {context,page}=await make({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const box=await page.locator('#game').boundingBox();await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.5);
 async function hold(action,ms){const button=page.locator(`[data-action="${action}"]`);const r=await button.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.evaluate(ms=>window.advanceTime(ms),ms);await page.mouse.up()}
 await hold('light',100);const attacked=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));await page.screenshot({path:out+'/touch-attack.png'});await page.evaluate(()=>window.advanceTime(500));await hold('right',200);const moved=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 await hold('dodge',150);const dodged=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));

 results.touchControls={moved:moved.player,dodged:dodged.player,attacked:attacked.player};await page.screenshot({path:out+'/touch-controls.png'});await context.close();
}
await fs.writeFile(out+'/route-evidence.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
