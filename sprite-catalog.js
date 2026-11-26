// Shared runtime crops and renderer. The dev showcase uses these exact definitions.
window.RoughSprites = (() => {
  const throwerFrame = (i) => ({ x: (i % 5) * 640, y: Math.floor(i / 5) * 320, w: 640, h: 320 });
  const throwerFrames = {
    idle: [18, 19, 20, 21, 22, 21, 20, 19].map(throwerFrame), walk: [23, 24, 25, 26, 27].map(throwerFrame),
    windup: [2, 3, 7, 5, 6].map(throwerFrame), attack: [28, 29, 30, 31, 32].map(throwerFrame),
    hurt: [33, 34, 35, 36, 37].map(throwerFrame), defeat: [38, 39, 40, 41, 42].map(throwerFrame),
    bottle: [43, 44, 45, 46, 47].map(throwerFrame),
  };
  const heroFrame = (i) => ({ x: (i % 5) * 640, y: Math.floor(i / 5) * 256, w: 640, h: 256 });
  const heroFrames = {
    idle: [25, 26, 27, 28, 29, 28, 27, 26].map(heroFrame), walk: [12, 51, 13, 50, 14].map(heroFrame),
    punch: [30, 31, 32, 33, 34].map(heroFrame), kick: [6, 7, 9, 10, 11].map(heroFrame),
    hurt: [35, 36, 37, 38, 39].map(heroFrame), defeat: [40, 41, 42, 43, 44].map(heroFrame),
    victory: [45, 46, 47, 48, 49].map(heroFrame),
  };
  const specialFrames = [3, 4, 5, 6, 7].map(heroFrame);
  // Enemy poses share fixed 640×320 runtime cells. The atlas builder packs
  // measured source panels around a common floor anchor so action frames do
  // not change scale or jump vertically as their source panels vary in size.
  const enemyFrame = (i) => ({ x: (i % 5) * 640, y: Math.floor(i / 5) * 320, w: 640, h: 320 });
  const enemyFrames = {
    idle: [13, 14, 15, 16, 17, 16, 15, 14].map(enemyFrame), attack: [18, 19, 20, 21, 22].map(enemyFrame),
    walk: [23, 24, 25, 26, 27].map(enemyFrame), hurt: [28, 29, 30, 31, 32].map(enemyFrame),
    defeat: [33, 34, 35, 36, 37].map(enemyFrame),
  };
  function drawSprite(ctx, sheet, frame, x, baseline, height, facing = 1, alpha = 1) {
    if (!sheet || !frame) return;
    const scale = height / frame.h;
    const width = frame.w * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (facing < 0) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, -width / 2, baseline - height, width, height);
    } else {
      ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, x - width / 2, baseline - height, width, height);
    }
    ctx.restore();
  }

  function isPink(r,g,b) { return r>70 && b>45 && r>g*1.45 && b>g*1.18 && Math.abs(r-b)<175; }
  return {heroFrame, heroFrames, specialFrames, enemyFrame, enemyFrames, throwerFrame, throwerFrames, drawSprite, isPink};
})();
