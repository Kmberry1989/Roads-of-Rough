// Shared runtime crops and renderer. The dev showcase uses these exact definitions.
window.RoughSprites = (() => {
  const throwerFrame = (i) => ({ x: (i % 5) * 640, y: Math.floor(i / 5) * 320, w: 640, h: 320 });
  const throwerFrames = {
    idle: [throwerFrame(0), throwerFrame(2)], walk: [throwerFrame(1), throwerFrame(6)],
    windup: [throwerFrame(2), throwerFrame(3)], attack: [throwerFrame(4), throwerFrame(5)],
    hurt: [throwerFrame(8)], defeat: [throwerFrame(9), throwerFrame(10)],
    bottle: [14, 15, 16, 17].map(throwerFrame),
  };
  const heroFrame = (i) => ({ x: (i % 5) * 640, y: Math.floor(i / 5) * 256, w: 640, h: 256 });
  const heroFrames = {
    idle: [0, 1].map(heroFrame), walk: [12, 13, 14, 15, 16].map(heroFrame),
    punch: [2, 3, 4, 5].map(heroFrame), kick: [6, 7, 9, 10, 11].map(heroFrame),
    hurt: [20, 21].map(heroFrame), defeat: [22].map(heroFrame), victory: [23, 24].map(heroFrame),
  };
  const specialFrames = [0, 1, 2, 0].map(heroFrame);
  const enemyFrames = {
    idle: [{ x: 25, y: 20, w: 260, h: 340 }, { x: 285, y: 20, w: 260, h: 340 }, { x: 545, y: 20, w: 260, h: 340 }],
    attack: [{ x: 805, y: 20, w: 300, h: 340 }, { x: 1100, y: 20, w: 380, h: 340 }],
    walk: [{ x: 20, y: 370, w: 275, h: 335 }, { x: 295, y: 370, w: 275, h: 335 }, { x: 570, y: 370, w: 275, h: 335 }],
    hurt: [{ x: 845, y: 370, w: 270, h: 335 }, { x: 1115, y: 370, w: 310, h: 335 }],
    defeat: [{ x: 20, y: 720, w: 420, h: 295 }, { x: 440, y: 720, w: 430, h: 295 }, { x: 870, y: 720, w: 430, h: 295 }],
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
  return {heroFrame, heroFrames, specialFrames, enemyFrames, throwerFrame, throwerFrames, drawSprite, isPink};
})();
