/* Dependency-free inspection route; never starts a game or changes saved game state. */
(async () => {
  'use strict';
  const C = window.RoughSprites, $ = id => document.getElementById(id);
  const heroes = ['kyle','eric','kristen','rochelle','vickie'];
  const actors = [...heroes.map(id=>({id,label:id.toUpperCase(),type:'hero'})),...Array.from({length:10},(_,i)=>({id:`baddy${i+1}`,label:`Enemy ${i+1}`,type:'enemy'})),{id:'thrower',label:'Bottle thrower',type:'thrower'}];
  const state={actor:'kyle',clip:'idle',frame:0,playing:false,speed:1,facing:1,zoom:1,background:'checker',loop:true,sequence:false,guides:true,onion:false,source:false};
  const sheets=new Map();let heroManifest,throwManifest,elapsed=0,deterministic=false;
  function actor(){return actors.find(a=>a.id===state.actor);}
  function clips(a=actor()) {
    if(a.type==='hero')return {...C.heroFrames,special:C.specialFrames,'pose: ready': [C.heroFrame(8)],'pose: jump':[C.heroFrame(17)],'pose: crouch':[C.heroFrame(18)],'pose: guard':[C.heroFrame(19)]};
    if(a.type==='enemy')return C.enemyFrames;
    return {...C.throwerFrames,...Object.fromEntries(Object.entries(throwManifest.frames).filter(([,m])=>![...Object.values(C.throwerFrames)].flat().some(f=>f.x===m.runtime.x&&f.y===m.runtime.y)).map(([name,m])=>[`pose: ${name}`,[m.runtime]]))};
  }
  function frames(a=actor()){return clips(a)[state.clip]||clips(a).idle;}
  function path(a=actor()){return a.type==='hero'?`sprites/runtime/player_${a.id}${state.clip==='special'?'-special':''}.png`:a.type==='enemy'?`sprites/${a.id}.png`:'sprites/expansion/runtime/enemy-thrower.png';}
  function measurement(a=actor(),f=frames(a)[state.frame]) {
    if(a.type==='hero'){const m=heroManifest.heroes[a.id];return (state.clip==='special'?m.specialFrames:m.frames).find(m=>m.runtime.x===f.x&&m.runtime.y===f.y);}
    if(a.type==='thrower')return Object.entries(throwManifest.frames).map(([name,m])=>({name,...m})).find(m=>m.runtime.x===f.x&&m.runtime.y===f.y);
    return {name:`${state.clip} ${state.frame+1}`,source:f,runtime:f};
  }
  function background(ctx,w,h){ctx.fillStyle=state.background==='light'?'#e3e8ef':'#111725';ctx.fillRect(0,0,w,h);if(state.background==='checker')for(let y=0;y<h;y+=20)for(let x=0;x<w;x+=20)if((x/20+y/20)%2===0){ctx.fillStyle='#263247';ctx.fillRect(x,y,20,20);}}
  function draw(ctx,a,index,x,y,height,overlay=false){const list=frames(a),f=list[Math.min(index,list.length-1)],scale=height/f.h;const baseline=y+(a.type==='hero'?12*height/256:a.type==='thrower'?20*height/320:0);ctx.imageSmoothingEnabled=false;
    if(overlay&&index>0)C.drawSprite(ctx,sheets.get(path(a)),list[index-1],x,baseline,height,state.facing,.22);
    C.drawSprite(ctx,sheets.get(path(a)),f,x,baseline,height,state.facing);
    if(state.guides){ctx.save();ctx.strokeStyle='#f7d27c';ctx.setLineDash([4,4]);ctx.strokeRect(x-f.w*scale/2,baseline-height,f.w*scale,height);ctx.setLineDash([]);ctx.strokeStyle='#7af2e2';ctx.beginPath();ctx.moveTo(x-28,y);ctx.lineTo(x+28,y);ctx.moveTo(x,y-28);ctx.lineTo(x,y+28);ctx.stroke();ctx.restore();}
  }
  function render(){const a=actor(),list=frames(),canvas=$('preview'),ctx=canvas.getContext('2d');const width=Math.max(520,Math.min(1000,Math.round(canvas.clientWidth)));if(canvas.width!==width)canvas.width=width;background(ctx,canvas.width,canvas.height);
    const height=(a.type==='hero'?245:a.type==='thrower'?state.clip==='bottle'?128:235:205)*state.zoom*(state.source&&width<700?.7:1),x=width*(state.source?.28:.5),y=415;
    draw(ctx,a,state.frame,x,y,height,state.onion);
    if(state.source){const m=measurement(),sourcePath=a.type==='hero'?heroManifest.heroes[a.id][state.clip==='special'?'specialSource':'source']:a.type==='thrower'?throwManifest.source:`sprites/${a.id}.png`;const img=sheets.get(`${sourcePath}:original`)||sheets.get(sourcePath);if(img){const f=m.source,scale=Math.min(width*.35/f.w,350/f.h);ctx.drawImage(img,f.x,f.y,f.w,f.h,width*.76-f.w*scale/2,415-f.h*scale,f.w*scale,f.h*scale);ctx.fillStyle='#fff';ctx.font='16px system-ui';ctx.fillText('Original source crop',width*.61,465);}}
    ctx.fillStyle=state.background==='light'?'#10121b':'#d7e2fa';ctx.font='16px system-ui';ctx.fillText('Runtime · shared game renderer',20,30);
    $('frame').value=state.frame;$('frame-label').value=`${state.frame+1} / ${list.length}`;$('play').textContent=state.playing?'Pause':'Play';
    $('status').textContent=`${a.label} / ${state.clip} · frame ${state.frame+1}/${list.length} · ${state.facing===1?'right':'left'} · ${state.playing?'playing':'paused'}`;
    const m=measurement();$('details').textContent=`Sheet: ${path()}\nPose: ${m.name}\nRuntime: ${JSON.stringify(m.runtime)}\nSource: ${JSON.stringify(m.source)}${m.anchorX!==undefined?`\nSource anchor X: ${m.anchorX}\n${a.type==='hero'?'Source floor Y':'Runtime floor Y'}: ${m.baseline??throwManifest.baseline}`:''}`;
    document.querySelectorAll('#strip button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===state.frame)));
    $('comparison-note').textContent=`All five heroes at the same scale and anchor · ${C.heroFrames[state.clip]||state.clip==='special'||state.clip.startsWith('pose:')&&clips(actors[0])[state.clip]?state.clip:'idle (selected enemy clip has no hero equivalent)'}.`;
    document.querySelectorAll('#roster canvas').forEach((c,i)=>{const rc=c.getContext('2d');background(rc,c.width,c.height);draw(rc,actors[i],state.frame,240,245,210);});
  }
  function rebuild(){const list=frames();state.frame=Math.min(state.frame,list.length-1);$('frame').max=list.length-1;$('strip').replaceChildren();list.forEach((f,i)=>{const b=document.createElement('button'),c=document.createElement('canvas'),label=document.createElement('span');c.width=480;c.height=280;label.textContent=`${i+1} · ${measurement(actor(),f).name}`;b.append(c,label);b.onclick=()=>{state.playing=false;state.frame=i;elapsed=0;render();save();};$('strip').append(b);const ctx=c.getContext('2d');background(ctx,480,280);draw(ctx,actor(),i,240,245,210);});render();save();}
  function clipOptions(){const selected=state.clip;$('clip').replaceChildren(...Object.keys(clips()).map(name=>new Option(name,name)));state.clip=clips()[selected]?selected:'idle';$('clip').value=state.clip;}
  function save(){const p=new URLSearchParams();for(const [k,v]of Object.entries(state))p.set(k,String(v));history.replaceState(null,'',`#${p}`);}
  function stepFrame(direction){state.playing=false;state.frame=(state.frame+direction+frames().length)%frames().length;elapsed=0;render();save();}
  function update(ms){if(!state.playing)return;elapsed+=ms*state.speed;const interval=1000/(state.clip==='windup'?frames().length/.95:8);let changed=false;while(elapsed>=interval){elapsed-=interval;changed=true;if(state.frame<frames().length-1)state.frame++;else if(state.sequence){const names=Object.keys(clips());state.clip=names[(names.indexOf(state.clip)+1)%names.length];state.frame=0;$('clip').value=state.clip;rebuild();}else if(state.loop)state.frame=0;else {state.playing=false;elapsed=0;break;}}if(changed){render();save();}}
  try {
    [heroManifest,throwManifest]=await Promise.all(['../sprites/runtime/hero-frames.json','../sprites/expansion/runtime/enemy-thrower-frames.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error(`Missing manifest: ${url}`);return r.json();}));
    const paths=new Set(actors.flatMap(a=>a.type==='hero'?[`sprites/runtime/player_${a.id}.png`,`sprites/runtime/player_${a.id}-special.png`,heroManifest.heroes[a.id].source,heroManifest.heroes[a.id].specialSource]:a.type==='enemy'?[`sprites/${a.id}.png`]:['sprites/expansion/runtime/enemy-thrower.png',throwManifest.source]));
    await Promise.all([...paths].map(async p=>{const img=new Image();img.src=`../${p}`;await img.decode();sheets.set(p,img);if(/^sprites\/baddy/.test(p)){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pixels.data.length;i+=4)if(C.isPink(...pixels.data.slice(i,i+3)))pixels.data[i+3]=0;ctx.putImageData(pixels,0,0);sheets.set(p,c);sheets.set(`${p}:original`,img);}}));
    // Reproduction URLs restore an exact paused frame; playback can be resumed explicitly.
    const params=new URLSearchParams(location.hash.slice(1));for(const k of Object.keys(state)){if(!params.has(k))continue;const v=params.get(k);state[k]=typeof state[k]==='boolean'?v==='true':typeof state[k]==='number'?Number(v):v;}
    if(!actors.some(a=>a.id===state.actor))state.actor='kyle';state.frame=Number.isFinite(state.frame)?Math.max(0,Math.floor(state.frame)):0;state.speed=[.25,.5,1,2].includes(state.speed)?state.speed:1;state.zoom=[.75,1,1.5,2].includes(state.zoom)?state.zoom:1;state.facing=state.facing===-1?-1:1;if(!['checker','dark','light'].includes(state.background))state.background='checker';state.playing=false;
    $('actor').replaceChildren(...actors.map(a=>new Option(a.label,a.id)));$('actor').value=state.actor;clipOptions();
    for(const key of ['facing','speed','zoom','background','loop','sequence','guides','onion','source']){const input=$(key);if(input.type==='checkbox')input.checked=state[key];else input.value=state[key];input.onchange=()=>{state[key]=input.type==='checkbox'?input.checked:typeof state[key]==='number'?Number(input.value):input.value;rebuild();};}
    $('actor').onchange=()=>{state.actor=$('actor').value;state.frame=0;elapsed=0;clipOptions();rebuild();};$('clip').onchange=()=>{state.clip=$('clip').value;state.frame=0;elapsed=0;rebuild();};$('frame').oninput=()=>{state.playing=false;state.frame=Number($('frame').value);elapsed=0;render();save();};
    $('play').onclick=()=>{state.playing=!state.playing;render();save();};$('restart').onclick=()=>{state.frame=0;elapsed=0;state.playing=true;render();save();};$('previous').onclick=()=>stepFrame(-1);$('next').onclick=()=>stepFrame(1);
    $('share').onclick=async()=>{save();try{await navigator.clipboard.writeText(location.href);$('share-status').textContent='Copied. Opens at this exact paused frame.';}catch{$('share-status').textContent=`Copy the address bar URL: ${location.href}`;}};
    window.addEventListener('resize',render);
    window.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;if(['Space','ArrowLeft','ArrowRight','KeyR'].includes(e.code)){e.preventDefault();if(e.code==='Space')$('play').click();else if(e.code==='KeyR')$('restart').click();else stepFrame(e.code==='ArrowLeft'?-1:1);}});
    heroes.forEach(id=>{const box=document.createElement('div'),c=document.createElement('canvas'),label=document.createElement('strong');c.width=480;c.height=280;label.textContent=id.toUpperCase();box.append(c,label);$('roster').append(box);});
    ['play','restart','previous','next'].forEach(id=>$(id).disabled=false);rebuild();
    window.render_game_to_text=()=>JSON.stringify({mode:'animation-lab',...state,frameCount:frames().length,pose:measurement().name,crop:frames()[state.frame],actors:actors.length,clips:Object.keys(clips()),coordinates:'canvas pixels; x right, y down; cross is actor floor anchor',timing:'8 poses/sec for inspection; thrower windup .95sec. Combat state timing is separate.'});
    window.advanceTime=ms=>{deterministic=true;update(Math.max(0,ms));render();};let last=performance.now();function tick(now){if(!deterministic)update(Math.min(100,now-last));last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  }catch(e){$('status').textContent=`Unable to load animation lab: ${e.message}`;console.error(e);}
})();
