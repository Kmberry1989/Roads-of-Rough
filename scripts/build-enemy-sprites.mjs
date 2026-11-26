// Development-only: pack the ten legacy enemy sheets into stable runtime cells.
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Source panels are intentionally measured per pose. The fourth walk pose was
// previously mistaken for a hurt frame, which made both clips snap at runtime.
const panels = [
  { name: 'idle0', rect: [25, 24, 260, 334], baseline: 310 },
  { name: 'idle1', rect: [287, 24, 260, 334], baseline: 310 },
  { name: 'idle2', rect: [559, 24, 246, 334], baseline: 310 },
  { name: 'attack0', rect: [812, 24, 348, 334], baseline: 310 },
  { name: 'attack1', rect: [1167, 24, 330, 334], baseline: 310 },
  { name: 'walk0', rect: [24, 374, 254, 330], baseline: 310 },
  { name: 'walk1', rect: [282, 374, 276, 330], baseline: 310 },
  { name: 'walk2', rect: [562, 374, 250, 330], baseline: 310 },
  { name: 'walk3', rect: [817, 374, 300, 330], baseline: 310 },
  { name: 'hurt', rect: [1122, 374, 270, 330], baseline: 310 },
  { name: 'defeat0', rect: [24, 724, 426, 280], baseline: 310 },
  { name: 'defeat1', rect: [458, 724, 410, 280], baseline: 265 },
  { name: 'defeat2', rect: [874, 724, 426, 280], baseline: 265 },
];
// The last source sheet is a kick-focused variant with narrower panels in rows 2–3.
const kickPanels = panels.map((panel, i) => ({ ...panel, rect: [...panel.rect] }));
kickPanels[1].rect = [282, 24, 254, 334];
kickPanels[2].rect = [542, 24, 264, 334];
kickPanels[8].rect = [812, 374, 190, 330];
kickPanels[9].rect = [1082, 374, 245, 330];
kickPanels[12].rect = [874, 724, 252, 280];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173');
  await fs.mkdir('sprites/runtime', { recursive: true });
  const manifest = {};
  for (let id = 1; id <= 10; id++) {
    const currentPanels = id === 10 ? kickPanels : panels;
    const result = await page.evaluate(async ({ id, panels }) => {
      const sourcePath = `sprites/workbench/baddy${id}.png`;
      const sheet = new Image(); sheet.src = sourcePath; await sheet.decode();
      const atlas = document.createElement('canvas'); atlas.width = 3200; atlas.height = 2560;
      const out = atlas.getContext('2d');
      const frames = {};
      panels.forEach((panel, index) => {
        const [sx, sy, sw, sh] = panel.rect;
        const x = (index % 5) * 640, y = Math.floor(index / 5) * 320;
        const crop = document.createElement('canvas'); crop.width = sw; crop.height = sh;
        const cropContext = crop.getContext('2d', { willReadFrequently: true });
        cropContext.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
        const pixels = cropContext.getImageData(0, 0, sw, sh), data = pixels.data;
        const pink = (p) => data[p] > 110 && data[p + 2] > 65 && data[p] > data[p + 1] * 1.55 && data[p + 2] > data[p + 1] * 1.35 && Math.abs(data[p] - data[p + 2]) < 150;
        // Flood only the connected pink matte from each crop edge. Pink-purple
        // clothing stays intact because its dark outline separates it from the matte.
        const seen = new Uint8Array(sw * sh), queue = [];
        const add = (x, y) => { const i = y * sw + x, p = i * 4; if (!seen[i] && pink(p)) { seen[i] = 1; queue.push(i); } };
        for (let cx = 0; cx < sw; cx++) { add(cx, 0); add(cx, sh - 1); }
        for (let cy = 1; cy < sh - 1; cy++) { add(0, cy); add(sw - 1, cy); }
        for (let head = 0; head < queue.length; head++) {
          const i = queue[head], cx = i % sw, cy = Math.floor(i / sw);
          if (cx > 0) add(cx - 1, cy); if (cx + 1 < sw) add(cx + 1, cy);
          if (cy > 0) add(cx, cy - 1); if (cy + 1 < sh) add(cx, cy + 1);
        }
        for (let i = 0; i < seen.length; i++) if (seen[i]) data[i * 4 + 3] = 0;
        cropContext.putImageData(pixels, 0, 0);
        // Preserve source pixel scale; align the floor and panel center in every cell.
        const dx = x + (640 - sw) / 2;
        const dy = y + 315 - panel.baseline;
        out.drawImage(crop, 0, 0, sw, sh, dx, dy, sw, sh);
        frames[panel.name] = {
          sheetSource: sourcePath,
          source: { x: sx, y: sy, w: sw, h: sh },
          anchorX: sx + sw / 2,
          sourceBaseline: sy + panel.baseline,
          baseline: 315,
          runtime: { x, y, w: 640, h: 320 },
        };
      });
      const expandedPath = `sprites/workbench/baddy${id}-expanded-poses.png`;
      const expanded = new Image(); expanded.src = expandedPath; await expanded.decode();
      const clipNames = ['idle', 'attack', 'walk', 'hurt', 'defeat'];
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
        const sw = expanded.width / 5, sh = expanded.height / 5, sx = col * sw, sy = row * sh;
        const index = 13 + row * 5 + col, x = (index % 5) * 640, y = Math.floor(index / 5) * 320;
        const scale = Math.min(640 / sw, 320 / sh), dw = sw * scale, dh = sh * scale;
        const crop = document.createElement('canvas'); crop.width = Math.round(sw); crop.height = Math.round(sh);
        const cropContext = crop.getContext('2d', { willReadFrequently: true });
        cropContext.drawImage(expanded, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        const pixels = cropContext.getImageData(0, 0, crop.width, crop.height), data = pixels.data;
        const matte = (p) => {
          const r = data[p], g = data[p + 1], b = data[p + 2];
          return Math.min(r, g, b) > 128 && Math.max(r, g, b) - Math.min(r, g, b) < 42;
        };
        // Expanded pose sheets contain a baked gray checkerboard. Remove only
        // neutral bright pixels connected to the crop edge so white costume
        // details inside dark outlines remain opaque.
        const seen = new Uint8Array(crop.width * crop.height), queue = [];
        const add = (cx, cy) => { const i = cy * crop.width + cx; if (!seen[i] && matte(i * 4)) { seen[i] = 1; queue.push(i); } };
        for (let cx = 0; cx < crop.width; cx++) { add(cx, 0); add(cx, crop.height - 1); }
        for (let cy = 1; cy < crop.height - 1; cy++) { add(0, cy); add(crop.width - 1, cy); }
        for (let head = 0; head < queue.length; head++) {
          const i = queue[head], cx = i % crop.width, cy = Math.floor(i / crop.width);
          if (cx > 0) add(cx - 1, cy); if (cx + 1 < crop.width) add(cx + 1, cy);
          if (cy > 0) add(cx, cy - 1); if (cy + 1 < crop.height) add(cx, cy + 1);
        }
        for (let i = 0; i < seen.length; i++) if (seen[i]) data[i * 4 + 3] = 0;
        cropContext.putImageData(pixels, 0, 0);
        out.imageSmoothingEnabled = false;
        out.drawImage(crop, 0, 0, crop.width, crop.height, x + (640 - dw) / 2, y + 315 - dh, dw, dh);
        const name = `${clipNames[row]}${col}`;
        frames[`expanded-${name}`] = {
          sheetSource: expandedPath,
          source: { x: sx, y: sy, w: sw, h: sh },
          anchorX: sw / 2,
          sourceBaseline: sh,
          baseline: 315,
          runtime: { x, y, w: 640, h: 320 },
        };
      }
      return { png: atlas.toDataURL('image/png').split(',')[1], frames, sourceSize: [sheet.width, sheet.height] };
    }, { id, panels: currentPanels });
    await fs.writeFile(`sprites/runtime/enemy_baddy${id}.png`, Buffer.from(result.png, 'base64'));
    manifest[`baddy${id}`] = { source: `sprites/workbench/baddy${id}.png`, sourceSize: result.sourceSize, frames: result.frames };
  }
  await fs.writeFile('sprites/runtime/enemy-frames.json', JSON.stringify({ cell: { w: 640, h: 320, anchorX: 320, baseline: 315 }, enemies: manifest }, null, 2) + '\n');
  console.log('Packed original and 25 expanded unique poses per enemy into 10 normalized runtime atlases.');
} finally { await browser.close(); }
