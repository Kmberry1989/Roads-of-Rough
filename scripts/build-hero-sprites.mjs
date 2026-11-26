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
      const sourcePath=`sprites/workbench/player_${hero}${special ? "-special" : ""}.png`;
      const source = new Image();source.src=sourcePath;await source.decode();
      const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
      const ctx=c.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;
      const isPink=(r,g,b)=>r>60&&b>15&&r>g*1.45&&b>g*1.05&&Math.abs(r-b)<240;
      for(let i=0;i<d.length;i+=4)if(isPink(d[i],d[i+1],d[i+2])||d[i+3]<96)d[i+3]=0;
      ctx.putImageData(pixels,0,0);
      const atlas=document.createElement('canvas');atlas.width=3200;atlas.height=special?512:2816;const out=atlas.getContext('2d');const frames=[];let index=0;
      for(const [rowTop,bottom,xs] of rows) for(let cell=0;cell<xs.length-1;cell++){
        const top=!special&&index===17?rowTop-16:rowTop;
        const left=xs[cell]+2,right=xs[cell+1]-2,w=right-left,h=bottom-top;
        const seen=new Uint8Array(w*h);let largest=[];const components=[];
        // Locate the body rather than anchoring on detached dust/spark effects.
        for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
          const local=(y-top)*w+x-left;if(seen[local]||d[(y*c.width+x)*4+3]<96)continue;
          const queue=[local];seen[local]=1;
          let compLeft=right,compRight=left,compTop=bottom,compBottom=top;
          for(let head=0;head<queue.length;head++){const p=queue[head],px=p%w,py=Math.floor(p/w),gx=left+px,gy=top+py;compLeft=Math.min(compLeft,gx);compRight=Math.max(compRight,gx);compTop=Math.min(compTop,gy);compBottom=Math.max(compBottom,gy);for(const [nx,ny]of[[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){if(nx<0||nx>=w||ny<0||ny>=h)continue;const n=ny*w+nx;if(!seen[n]&&d[((ny+top)*c.width+nx+left)*4+3]>=96){seen[n]=1;queue.push(n);}}}
          const component={pixels:queue,count:queue.length,left:compLeft,right:compRight,top:compTop,bottom:compBottom};
          components.push(component);if(queue.length>largest.length)largest=queue;
        }
        let baseline=top,bodyLeft=right,bodyRight=left;for(const p of largest){const x=left+p%w,y=top+Math.floor(p/w);baseline=Math.max(baseline,y);bodyLeft=Math.min(bodyLeft,x);bodyRight=Math.max(bodyRight,x);}
        // Retain the body and nearby floor-level shoe fragments; discard detached FX and edge specks.
        for(const part of components){
          const isBody=part.pixels===largest;
          const isFoot=part.count>=8&&part.bottom>=baseline-24&&part.top<=baseline+2&&part.right>=bodyLeft-24&&part.left<=bodyRight+24&&part.left<=bodyRight&&part.right>=bodyLeft;
          if(isBody||isFoot)continue;
          for(const p of part.pixels)d[((top+Math.floor(p/w))*c.width+left+p%w)*4+3]=0;
        }
        const feet=components.filter(part=>part.pixels===largest||(part.count>=8&&part.bottom>=baseline-24&&part.top<=baseline+2&&part.right>=bodyLeft-24&&part.left<=bodyRight+24&&part.left<=bodyRight&&part.right>=bodyLeft)).flatMap(part=>part.pixels.map(p=>[left+p%w,top+Math.floor(p/w)])).filter(p=>p[1]>=baseline-24&&p[1]<=baseline+2);
        const anchor=index===22?(left+right)/2:(Math.min(...feet.map(p=>p[0]))+Math.max(...feet.map(p=>p[0])))/2;
        const rx=(index%5)*640,ry=Math.floor(index/5)*256;
        out.save();out.beginPath();out.rect(rx,ry,640,256);out.clip();out.drawImage(c,left,top,w,h,rx+320+left-anchor,ry+244+top-baseline,w,h);out.restore();
        frames.push({index,name:(special?['special-ready','special-windup','special-release']:['idle0','idle1','punch0','punch1','punch2','punch3','ready0','kick0','ready1','kick1','kick2','kick3','walk0','walk1','walk2','run0','run1','jump','crouch','guard','hurt','launched','defeat','victory0','victory1'])[index],sheetSource:sourcePath,source:{x:left,y:top,w,h},anchorX:anchor,baseline,runtime:{x:rx,y:ry,w:640,h:256}});index++;
      }
      if(!special){
        const additionsPath=`sprites/workbench/player_${hero}-walk-additions.png`;
        const additions=new Image();additions.src=additionsPath;await additions.decode();
        for(let pose=0;pose<2;pose++){
          const sx=pose*additions.width/2,sw=additions.width/2,sh=additions.height;
          const scratch=document.createElement('canvas');scratch.width=sw;scratch.height=sh;const sctx=scratch.getContext('2d',{willReadFrequently:true});sctx.drawImage(additions,sx,0,sw,sh,0,0,sw,sh);
          const img=sctx.getImageData(0,0,sw,sh),px=img.data;let minX=sw,minY=sh,maxX=-1,maxY=-1;
          for(let i=0;i<px.length;i+=4)if(isPink(px[i],px[i+1],px[i+2])||px[i+3]<96)px[i+3]=0;sctx.putImageData(img,0,0);
          for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(px[(y*sw+x)*4+3]>=96){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
          if(maxX<minX||maxY<minY)throw Error(`Empty generated walk pose for ${hero} #${pose}`);
          const cw=maxX-minX+1,ch=maxY-minY+1,crop=document.createElement('canvas');crop.width=cw;crop.height=ch;const cctx=crop.getContext('2d');cctx.drawImage(scratch,minX,minY,cw,ch,0,0,cw,ch);
          if(pose===1){const legs=document.createElement('canvas');legs.width=cw;legs.height=ch;const lctx=legs.getContext('2d');lctx.drawImage(crop,0,0,cw,ch);lctx.save();lctx.beginPath();lctx.rect(0,Math.floor(ch*.59),cw,ch-Math.floor(ch*.59));lctx.clip();lctx.translate(cw,0);lctx.scale(-1,1);lctx.drawImage(crop,0,0,cw,ch);lctx.restore();crop.width=cw;crop.height=ch;crop.getContext('2d').drawImage(legs,0,0);}
          const targetIndex=50+pose,rx=(targetIndex%5)*640,ry=Math.floor(targetIndex/5)*256,scale=Math.min(360/cw,220/ch),dw=cw*scale,dh=ch*scale;
          out.imageSmoothingEnabled=false;out.save();out.beginPath();out.rect(rx,ry,640,256);out.clip();out.drawImage(crop,0,0,cw,ch,rx+(640-dw)/2,ry+244-dh,dw,dh);out.restore();
          frames.push({index:targetIndex,name:`walk${pose+3}`,sheetSource:additionsPath,source:{x:sx+minX,y:minY,w:cw,h:ch},anchorX:cw/2,baseline:ch,runtime:{x:rx,y:ry,w:640,h:256},phaseMirrored:pose===1});
        }
      }
      const expandedPath=`sprites/workbench/player_${hero}-expanded-poses-transparent.png`;
      const expanded=new Image();expanded.src=expandedPath;await expanded.decode();
      const expandedRows=special?[5]:[0,1,2,3,4];
      for(const row of expandedRows)for(let col=0;col<5;col++){
        const sw=expanded.width/5,sh=expanded.height/6,sx=col*sw,sy=row*sh;
        const targetIndex=special?3+col:25+row*5+col;
        const rx=(targetIndex%5)*640,ry=Math.floor(targetIndex/5)*256;
        const scale=Math.min(640/sw,256/sh),dw=sw*scale,dh=sh*scale;
        out.imageSmoothingEnabled=false;
        out.save();out.beginPath();out.rect(rx,ry,640,256);out.clip();out.drawImage(expanded,sx,sy,sw,sh,rx+(640-dw)/2,ry+244-dh,dw,dh);out.restore();
        const names=special?['special0','special1','special2','special3','special4']:
          ['idle0','idle1','idle2','idle3','idle4','punch0','punch1','punch2','punch3','punch4','hurt0','hurt1','hurt2','hurt3','hurt4','defeat0','defeat1','defeat2','defeat3','defeat4','victory0','victory1','victory2','victory3','victory4'];
        frames.push({index:targetIndex,name:special?names[col]:names[(row*5)+col],sheetSource:expandedPath,source:{x:sx,y:sy,w:sw,h:sh},anchorX:sw/2,baseline:sh,runtime:{x:rx,y:ry,w:640,h:256}});
      }
      // Runtime art is centered with ample padding; keep neighbouring panel-edge pixels out of every crop.
      for(const frame of frames){const {x,y,w,h}=frame.runtime;out.clearRect(x,y,w,4);out.clearRect(x,y+h-4,w,4);out.clearRect(x,y,4,h);out.clearRect(x+w-4,y,4,h);}
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
    manifest[hero]={source:`sprites/workbench/player_${hero}.png`,frames:result.frames,specialSource:`sprites/workbench/player_${hero}-special.png`,specialFrames:special.frames};
  }
  await fs.writeFile('sprites/runtime/hero-frames.json',JSON.stringify({cell:{w:640,h:256,anchorX:320,baseline:244},heroes:manifest},null,2)+'\n');
  console.log('Built 52 base poses and 8 special poses for each of five heroes from copied source sheets and supplemental animation art.');
}finally{await browser.close();}
