// Development-only atlas builder. Runtime remains dependency-free.
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = 'sprites/expansion/enemy-thrower-actions.png';
const destination = 'sprites/expansion/runtime/enemy-thrower.png';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173');
  const result = await page.evaluate(async source => {
    const sheet = new Image(); sheet.src = source; await sheet.decode();
    const canvas = document.createElement('canvas'); canvas.width = sheet.width; canvas.height = sheet.height;
    const context = canvas.getContext('2d'); context.drawImage(sheet, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height), data = pixels.data;
    // Measured panel boundaries, excluding the one-pixel guide rules.
    const rows = [
      { y: 18, bottom: 320, xs: [26, 289, 548, 808, 1080, 1511], anchors: [157, 425, 681, 936, 1204], names: ['idle', 'walk', 'ready', 'windup', 'release'] },
      { y: 335, bottom: 613, xs: [26, 307, 570, 863, 1162, 1511], anchors: [153, 435, 696, 1057, 1350], names: ['recover', 'retreat', 'guard', 'hurt', 'knockdown'] },
      { y: 628, bottom: 847, xs: [26, 448, 817, 1128, 1511], anchors: [235, 618, 966, 1300], names: ['defeat', 'rise', 'crouch', 'panic'] },
      { y: 862, bottom: 1000, xs: [26, 415, 751, 1082, 1511], names: ['bottle0', 'bottle1', 'bottle2', 'bottle3'] },
    ];
    const atlas = document.createElement('canvas'); atlas.width = 3200; atlas.height = 1280;
    const out = atlas.getContext('2d'); const frames = {}; let index = 0;
    for (const row of rows) for (let cell = 0; cell < row.names.length; cell++) {
      const left = row.xs[cell] + 2, right = row.xs[cell + 1] - 2, top = row.y, bottom = row.bottom;
      // The dark gradient and guide rules are low-alpha in the supplied PNG.
      // Remove that matte by alpha coverage, preserving opaque black ink/clothing.
      let minX = right, minY = bottom, maxX = left, maxY = top;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const p = (y * sheet.width + x) * 4;
        // The release pose includes a detached bottle/trail; gameplay draws its own projectile.
        if (row.names[cell] === 'release' && ((x >= 1385 && y < 126) || x >= 1435 || (x >= 1335 && y > 175))) data[p + 3] = 0;
        if (data[p] > data[p + 1] * 1.5 && data[p + 2] > data[p + 1] * 1.3 && Math.abs(data[p] - data[p + 2]) < 100) data[p + 3] = 0;
        data[p + 3] = Math.round(Math.max(0, (data[p + 3] - 96) / 159) * 255);
        if (data[p + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      context.putImageData(pixels, 0, 0);
      const w = maxX - minX + 1, h = maxY - minY + 1, name = row.names[cell];
      const x = (index % 5) * 640, y = Math.floor(index / 5) * 320;
      out.drawImage(canvas, minX, minY, w, h, x + (name.startsWith('bottle') ? (640 - w) / 2 : 320 + minX - row.anchors[cell]), y + (name.startsWith('bottle') ? (320 - h) / 2 : 300 - h), w, h);
      frames[name] = { source: { x: left, y: top, w: right - left, h: bottom - top }, bounds: { x: minX, y: minY, w, h }, anchorX: row.anchors?.[cell] ?? (minX + w / 2), runtime: { x, y, w: 640, h: 320 } };
      index++;
    }
    return { png: atlas.toDataURL('image/png').split(',')[1], frames, sourceSize: [sheet.width, sheet.height] };
  }, source);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(result.png, 'base64'));
  await fs.writeFile(destination.replace('.png', '-frames.json'), JSON.stringify({ source, sourceSize: result.sourceSize, cellSize: [640, 320], baseline: 300, frames: result.frames }, null, 2) + '\n');
  console.log(`Built ${destination}: ${Object.keys(result.frames).length} measured frames`);
} finally { await browser.close(); }
