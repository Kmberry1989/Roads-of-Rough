// Development-only: preserve the originals and pack measured poses into anchored cells.
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const cuts = {
  kyle: [[18,246,[20,202,393,674,952,1240,1512]],[263,484,[20,253,517,777,1013,1268,1512]],[502,722,[20,208,374,560,777,990,1163,1342,1512]],[740,972,[20,259,552,868,1066,1344]]],
  eric: [[15,241,[18,216,414,699,981,1264,1518]],[255,476,[18,249,518,774,1014,1270,1518]],[490,710,[18,194,365,535,774,979,1161,1342,1518]],[725,955,[18,258,544,855,1090,1344]]],
  kristen: [[18,244,[18,196,386,662,946,1222,1514]],[256,481,[18,242,507,757,1003,1266,1514]],[494,722,[18,201,375,546,778,979,1153,1340,1514]],[735,972,[18,261,547,853,1088,1350]]],
  rochelle: [[18,246,[20,208,394,675,952,1240,1512]],[262,484,[20,253,517,777,1013,1268,1512]],[502,722,[20,208,374,560,777,989,1165,1343,1512]],[739,973,[20,259,552,868,1065,1344]]],
  vickie: [[18,247,[20,216,398,678,953,1234,1514]],[262,491,[20,258,520,778,1013,1268,1514]],[507,732,[20,204,375,556,771,977,1150,1340,1514]],[747,975,[20,259,546,853,1077,1344]]],
};
const browser = await chromium.launch({ headless:true });
try {
  const page = await browser.newPage(); await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173');
  await fs.mkdir('sprites/runtime', {recursive:true});
  const manifest = {};
  const pack = async ({hero,rows,special=false}) => {
      const source = new Image();source.src=`sprites/player_${hero}${special ? "-special" : ""}.png`;await source.decode();
      const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
      const ctx=c.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;
      for(let i=0;i<d.length;i+=4){const [r,g,b]=d.slice(i,i+3);if(r>70&&b>45&&r>g*1.45&&b>g*1.18&&Math.abs(r-b)<175)d[i+3]=0;}
      ctx.putImageData(pixels,0,0);
      const atlas=document.createElement('canvas');atlas.width=special?1920:3200;atlas.height=special?256:1280;const out=atlas.getContext('2d');const frames=[];let index=0;
      for(const [rowTop,bottom,xs] of rows) for(let cell=0;cell<xs.length-1;cell++){
        const top=!special&&index===17?rowTop-16:rowTop;
        const left=xs[cell]+2,right=xs[cell+1]-2,w=right-left,h=bottom-top;
        const seen=new Uint8Array(w*h);let largest=[];const components=[];
        // Locate the body rather than anchoring on detached dust/spark effects.
        for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
          const local=(y-top)*w+x-left;if(seen[local]||d[(y*c.width+x)*4+3]<96)continue;
          const queue=[local];seen[local]=1;
          for(let head=0;head<queue.length;head++){const p=queue[head],px=p%w,py=Math.floor(p/w);for(const [nx,ny]of[[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){if(nx<0||nx>=w||ny<0||ny>=h)continue;const n=ny*w+nx;if(!seen[n]&&d[((ny+top)*c.width+nx+left)*4+3]>=96){seen[n]=1;queue.push(n);}}}
          components.push(queue);if(queue.length>largest.length)largest=queue;
        }
        const body=largest.map(p=>[left+p%w,top+Math.floor(p/w)]);const baseline=Math.max(...body.map(p=>p[1]));
        // Shoes may be disconnected after keying. Include substantial components at the body floor.
        const feet=components.filter(part=>(!special&&[0,1,6,8,19,23,24].includes(index)) || part.length>=Math.max(80,largest.length*.03)).flatMap(part=>part.map(p=>[left+p%w,top+Math.floor(p/w)])).filter(p=>p[1]>=baseline-12 && p[1]<=baseline);const anchor=index===22?(left+right)/2:(Math.min(...feet.map(p=>p[0]))+Math.max(...feet.map(p=>p[0])))/2;
        const rx=(index%5)*640,ry=Math.floor(index/5)*256;
        out.drawImage(c,left,top,w,h,rx+320+left-anchor,ry+244+top-baseline,w,h);
        frames.push({index,name:(special?['special-ready','special-windup','special-release']:['idle0','idle1','punch0','punch1','punch2','punch3','ready0','kick0','ready1','kick1','kick2','kick3','walk0','walk1','walk2','run0','run1','jump','crouch','guard','hurt','launched','defeat','victory0','victory1'])[index],source:{x:left,y:top,w,h},anchorX:anchor,baseline,runtime:{x:rx,y:ry,w:640,h:256}});index++;
      }
      const portrait=document.createElement('canvas');portrait.width=192;portrait.height=192;
      portrait.getContext('2d').drawImage(atlas,192,0,256,256,0,0,192,192);
      return {png:atlas.toDataURL().split(',')[1],portrait:portrait.toDataURL().split(',')[1],frames};
  };
  const specialCuts = {
    kyle: [68,312,[22,200,401,650]], eric: [67,308,[21,197,390,645]],
    kristen: [64,305,[23,203,396,636]], rochelle: [66,301,[22,208,401,654]],
    vickie: [68,310,[22,197,390,647]],
  };
  for (const [hero, rows] of Object.entries(cuts)) {
    const result = await page.evaluate(pack,{hero,rows});
    const special = await page.evaluate(pack,{hero,rows:[specialCuts[hero]],special:true});
    await fs.writeFile(`sprites/runtime/player_${hero}.png`,Buffer.from(result.png,'base64'));
    await fs.writeFile(`sprites/runtime/player_${hero}-portrait.png`,Buffer.from(result.portrait,'base64'));
    await fs.writeFile(`sprites/runtime/player_${hero}-special.png`,Buffer.from(special.png,'base64'));
    manifest[hero]={source:`sprites/player_${hero}.png`,frames:result.frames,specialSource:`sprites/player_${hero}-special.png`,specialFrames:special.frames};
  }
  await fs.writeFile('sprites/runtime/hero-frames.json',JSON.stringify({cell:{w:640,h:256,anchorX:320,baseline:244},heroes:manifest},null,2)+'\n');
  console.log('Built 25 base poses, 3 special poses, and a portrait for each of five heroes.');
}finally{await browser.close();}
