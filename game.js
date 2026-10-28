(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const touchControls = document.getElementById('touch-controls');
  const statusNode = document.getElementById('game-status');
  const audioControls = document.getElementById('audio-controls');
  const audioMute = document.getElementById('audio-mute');
  const audioToggle = document.getElementById('audio-toggle');
  const audioPanel = document.getElementById('audio-panel');
  const audioVolume = document.getElementById('audio-volume');
  const audioSupport = document.getElementById('audio-support');
  let W = canvas.width;
  let portrait = false;
  let screenScale = 1;
  const stage = document.getElementById('game-stage');
  const portraitHud = document.getElementById('portrait-hud');
  const portraitSelect = document.getElementById('portrait-select');
  const portraitOverlay = document.getElementById('portrait-overlay');
  const H = canvas.height;
  const WORLD_WIDTH = 5600;
  const FLOOR_TOP = 430;
  const FLOOR_BOTTOM = 635;
  const MAGENTA = [245, 8, 130];

  const HEROES = [
    { name: 'KYLE', role: 'ALL-ROUNDER', specialName: 'SONIC BREAK', color: '#62e8ff', base: 'player_kyle.png', special: 'player_kyle-special.png', speed: 260, maxHealth: 100, meterStart: 35, damage: 1, dodge: 175 },
    { name: 'ERIC', role: 'HEAVY HITTER', specialName: 'IRON RUSH', color: '#ffc857', base: 'player_eric.png', special: 'player_eric-special.png', speed: 220, maxHealth: 125, meterStart: 25, damage: 1.18, dodge: 145 },
    { name: 'KRISTEN', role: 'COMBO RUNNER', specialName: 'NEON STORM', color: '#ff7ccf', base: 'player_kristen.png', special: 'player_kristen-special.png', speed: 305, maxHealth: 85, meterStart: 45, damage: .92, dodge: 220 },
    { name: 'ROCHELLE', role: 'STREET GUARDIAN', specialName: 'GREEN LIGHT', color: '#9dff75', base: 'player_rochelle.png', special: 'player_rochelle-special.png', speed: 245, maxHealth: 110, meterStart: 30, damage: 1.06, dodge: 185 },
    { name: 'VICKIE', role: 'SPECIALIST', specialName: 'PURPLE HAZE', color: '#bf9aff', base: 'player_vickie.png', special: 'player_vickie-special.png', speed: 240, maxHealth: 95, meterStart: 60, damage: 1.02, dodge: 195 },
  ];
  const ENEMY_FILES = Array.from({ length: 10 }, (_, i) => `baddy${i + 1}.png`);
  const PATH = 'sprites/';
  const THROWER_SHEET = 'expansion/runtime/enemy-thrower.png';
  // Measured source cells and derived bounds: runtime/enemy-thrower-frames.json.
  const {throwerFrames} = window.RoughSprites;
  const ENEMY_ATTACKS = {
    grunt: { windup: .36, active: .14, recovery: .28, range: 88, damage: 8, color: '#ff5f83', label: 'STRIKE' },
    rusher: { windup: .24, active: .12, recovery: .22, range: 102, damage: 8, color: '#5de7ff', label: 'RUSH' },
    bruiser: { windup: .58, active: .18, recovery: .42, range: 118, damage: 14, color: '#ffc247', label: 'HEAVY' },
    boss: { windup: .78, active: .22, recovery: .55, range: 148, damage: 20, color: '#ff315f', label: 'BOSS BREAK' },
    thrower: { windup: .95, active: .16, recovery: .75, range: 540, damage: 12, color: '#a7ff67', label: 'BOTTLE • MOVE!' },
  };

  const assets = { images: {}, ready: false, failed: 0 };
  const keys = new Set();
  const heldActions = new Set();
  const pressedActions = new Set();
  let previousGamepadButtons = new Set();
  let gamepadSelectDirection = 0;
  let inputSuspended = false;
  function isTouchCapable() {
    return Boolean(window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
  }
  let deterministic = false;
  let lastTime = performance.now();
  const audio = {
    context: null,
    master: null,
    noiseBuffer: null,
    supported: Boolean(window.AudioContext || window.webkitAudioContext),
    muted: false,
    volume: 0.32,
    expanded: false,
    collapseTimer: null,

    init() {
      try {
        const saved = JSON.parse(window.localStorage.getItem('roads-of-rough-audio') || '{}');
        if (typeof saved.muted === 'boolean') this.muted = saved.muted;
        if (Number.isFinite(saved.volume)) this.volume = clamp(saved.volume, 0, 1);
      } catch { /* Settings are optional. */ }
      audioVolume.value = String(this.volume);
      this.syncUi();
    },

    save() {
      try { window.localStorage.setItem('roads-of-rough-audio', JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { /* Storage is optional. */ }
    },

    syncUi() {
      audioMute.textContent = this.muted ? '🔇 MUTED' : '🔊 AUDIO';
      audioMute.setAttribute('aria-pressed', String(this.muted));
      audioMute.setAttribute('aria-label', this.muted ? 'Unmute audio' : 'Mute audio');
      audioToggle.setAttribute('aria-expanded', String(this.expanded));
      audioVolume.value = String(this.volume);
      audioVolume.disabled = !this.supported;
      audioPanel.hidden = !this.expanded;
      audioControls.classList.toggle('is-expanded', this.expanded);
      audioControls.classList.toggle('is-unavailable', !this.supported);
      audioSupport.textContent = this.supported ? (this.muted ? 'OFF' : 'READY') : 'NO AUDIO';
    },

    collapse() {
      this.expanded = false;
      if (this.collapseTimer) window.clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
      this.syncUi();
    },

    expand() {
      this.expanded = true;
      if (this.collapseTimer) window.clearTimeout(this.collapseTimer);
      this.collapseTimer = window.setTimeout(() => this.collapse(), 3600);
      this.syncUi();
    },

    ensureContext() {
      if (!this.supported) return null;
      try {
        if (!this.context) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          this.context = new AudioContextClass();
          this.master = this.context.createGain();
          this.master.gain.value = this.volume;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
        return this.context;
      } catch {
        this.supported = false;
        this.syncUi();
        return null;
      }
    },

    tone(frequency, duration, type = 'sine', gain = 0.12, endFrequency = frequency, when = 0) {
      const context = this.ensureContext();
      if (!context || !this.master) return;
      const start = context.currentTime + when;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
      if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + Math.min(0.015, duration * 0.2));
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope); envelope.connect(this.master);
      oscillator.start(start); oscillator.stop(start + duration + 0.02);
    },

    noise(duration, gain = 0.08, when = 0, highpass = 500) {
      const context = this.ensureContext();
      if (!context || !this.master) return;
      if (!this.noiseBuffer) {
        const length = Math.floor(context.sampleRate * 0.4);
        this.noiseBuffer = context.createBuffer(1, length, context.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      const start = context.currentTime + when;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      source.buffer = this.noiseBuffer;
      filter.type = 'highpass'; filter.frequency.value = highpass;
      envelope.gain.setValueAtTime(Math.max(0.0001, gain), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter); filter.connect(envelope); envelope.connect(this.master);
      source.start(start); source.stop(start + duration + 0.02);
    },

    play(name) {
      if (this.muted || this.volume <= 0) return;
      switch (name) {
        case 'hit':
          this.tone(185, 0.065, 'square', 0.16, 92);
          this.noise(0.045, 0.06, 0, 1300);
          break;
        case 'heavy':
          this.tone(112, 0.16, 'sawtooth', 0.25, 54);
          this.tone(320, 0.045, 'square', 0.09, 120);
          break;
        case 'dodge':
          this.tone(520, 0.2, 'triangle', 0.13, 165);
          this.noise(0.16, 0.045, 0, 700);
          break;
        case 'special':
          this.tone(235, 0.48, 'sawtooth', 0.18, 860);
          this.tone(470, 0.42, 'triangle', 0.1, 1100, 0.08);
          this.noise(0.34, 0.055, 0.08, 900);
          break;
        case 'enemy-defeat':
          this.tone(300, 0.22, 'square', 0.16, 76);
          this.tone(150, 0.12, 'triangle', 0.08, 70, 0.05);
          break;
        case 'boss-defeat':
          this.tone(145, 0.38, 'sawtooth', 0.25, 38);
          this.tone(290, 0.28, 'square', 0.14, 58, 0.08);
          this.tone(580, 0.32, 'triangle', 0.12, 110, 0.2);
          this.noise(0.46, 0.1, 0, 260);
          break;
        case 'victory':
          [392, 523, 659, 784].forEach((note, index) => this.tone(note, 0.18, 'triangle', 0.12, note, index * 0.13));
          this.tone(1047, 0.46, 'sine', 0.17, 1047, 0.56);
          break;
        case 'select':
          this.tone(240, 0.05, 'square', 0.08, 360);
          break;
        default:
          break;
      }
    },
  };

  const state = {
    mode: 'loading',
    selectedHero: 0,
    player: null,
    enemies: [],
    projectiles: [],
    effects: [],
    particles: [],
    cameraX: 0,
    score: 0,
    wave: 0,
    waveLabel: 'GET READY',
    goTimer: 0,
    nextWaveAt: 0,
    spawnTimer: 0,
    spawnQueue: [],
    spawnBatchSize: 2,
    spawnIndex: 0,
    waveSpawnX: 0,
    shake: 0,
    hitStop: 0,
    lastImpact: null,
    lastProjectileImpact: null,
    message: '',
    messageTimer: 0,
    time: 0,
    bossDefeated: false,
  };

  // Source rectangles and per-hero body anchors: sprites/runtime/hero-frames.json.
  const {heroFrames, specialFrames, enemyFrames} = window.RoughSprites;

  function loadImage(name, keyed = false) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (!keyed || HEROES.some(hero => hero.base === name || hero.special === name)) return resolve(image);
        const surface = document.createElement('canvas');
        surface.width = image.naturalWidth;
        surface.height = image.naturalHeight;
        const surfaceCtx = surface.getContext('2d');
        surfaceCtx.drawImage(image, 0, 0);
        const pixels = surfaceCtx.getImageData(0, 0, surface.width, surface.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i];
          const g = pixels.data[i + 1];
          const b = pixels.data[i + 2];
          // The supplied sheets use both hot pink fills and darker magenta guide lines.
          // Key the whole magenta family while leaving warm skin/yellow highlight pixels intact.
          const isPink = window.RoughSprites.isPink(r,g,b);
          const isBlackPanel = name === 'interface.png' && r < 14 && g < 14 && b < 22;
          if (isPink || isBlackPanel) pixels.data[i + 3] = 0;
        }
        surfaceCtx.putImageData(pixels, 0, 0);
        resolve(surface);
      };
      image.onerror = () => { assets.failed += 1; resolve(null); };
      image.src = PATH + (HEROES.some(hero => hero.base === name || hero.special === name) ? 'runtime/' : '') + name;
    });
  }

  async function loadAssets() {
    const names = [
      ['backdrop_city.png', false], ['backdrop_city2.png', false], ['backdrop_city3.png', false], ['backdrop_skyline.png', false],
      ['ground_city.png', false], ['ground_city2.png', false], ['interface.png', true],
      ...HEROES.flatMap((hero) => [[hero.base, true], [hero.special, true]]),
      ...ENEMY_FILES.map((file) => [file, true]),
      [THROWER_SHEET, false],
    ];
    await Promise.all(names.map(async ([name, keyed]) => { assets.images[name] = await loadImage(name, keyed); }));
    assets.ready = true;
    state.mode = 'select';
    updateStatus('Character select. Choose a hero and press Enter or tap the screen.');
  }

  function image(name) { return assets.images[name]; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(array) { return array[Math.floor(Math.random() * array.length)]; }
  function dist2(a, b) { return ((a.x - b.x) ** 2) + ((a.y - b.y) ** 2); }
  function randomLane() { return 490 + Math.random() * 125; }

  function frameFor(frames, index) { return frames[index % frames.length]; }
  function drawSprite(...args) { window.RoughSprites.drawSprite(ctx, ...args); }

  function drawAnimatedSprite(sheet, frames, progress, x, baseline, height, facing = 1, alpha = 1, loop = true) {
    if (!sheet || !frames?.length) return;
    const last = frames.length - 1;
    const safeProgress = loop ? Math.max(0, progress) % frames.length : clamp(progress, 0, last);
    const index = Math.min(last, Math.floor(safeProgress));
    // Authored pixel poses use one opaque frame; crossfading doubles silhouettes.
    drawSprite(sheet, frames[index], x, baseline, height, facing, alpha);
  }

  function drawPanel(x, y, w, h, stroke = '#9ca5bb', fill = 'rgba(12,12,26,.82)') {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
    ctx.restore();
  }

  function drawText(text, x, y, size = 20, color = '#fff', align = 'left', font = '900 20px Trebuchet MS') {
    ctx.save();
    if (portrait) size = Math.max(size, 12 / Math.max(.1, screenScale));
    ctx.font = font.replace(/\d+px/, `${size}px`);
    if (portrait && align === 'center') {
      const half = Math.min(W / 2 - 8, ctx.measureText(text).width / 2);
      x = clamp(x, half + 8, W - half - 8);
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.strokeStyle = 'rgba(3,2,12,.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawBackground() {
    const tileWidth = 1280;
    const city = image('backdrop_city.png');
    const city2 = image('backdrop_city2.png');
    const skyline = image('backdrop_skyline.png');
    const ground = image('ground_city.png');
    const ground2 = image('ground_city2.png');
    ctx.fillStyle = '#09091b';
    ctx.fillRect(0, 0, W, H);
    if (skyline) ctx.drawImage(skyline, -((state.cameraX * 0.08) % tileWidth), 0, tileWidth, H * 0.82);
    if (city2) {
      const offset = -((state.cameraX * 0.16) % tileWidth);
      ctx.drawImage(city2, offset, 0, tileWidth, H * 0.82);
      ctx.drawImage(city2, offset + tileWidth, 0, tileWidth, H * 0.82);
    }
    if (city) {
      const offset = -((state.cameraX * 0.28) % tileWidth);
      ctx.drawImage(city, offset, 0, tileWidth, H * 0.86);
      ctx.drawImage(city, offset + tileWidth, 0, tileWidth, H * 0.86);
    }
    ctx.fillStyle = 'rgba(9, 5, 23, .18)';
    ctx.fillRect(0, 0, W, FLOOR_TOP);
    if (ground) {
      const offset = -((state.cameraX * 0.7) % tileWidth);
      ctx.drawImage(ground, offset, 345, tileWidth, 390);
      ctx.drawImage(ground, offset + tileWidth, 345, tileWidth, 390);
    }
    if (ground2) {
      const offset = -((state.cameraX * 0.9) % tileWidth);
      ctx.globalAlpha = .28;
      ctx.drawImage(ground2, offset, 405, tileWidth, 315);
      ctx.drawImage(ground2, offset + tileWidth, 405, tileWidth, 315);
      ctx.globalAlpha = 1;
    }
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, 'rgba(8,4,23,.08)');
    grade.addColorStop(.7, 'rgba(6,4,19,.22)');
    grade.addColorStop(1, 'rgba(5,3,14,.58)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);
  }

  function createPlayer() {
    const hero = HEROES[state.selectedHero];
    return {
      x: 330, y: 560, vx: 0, vy: 0, facing: 1, speed: hero.speed, health: hero.maxHealth, maxHealth: hero.maxHealth,
      meter: hero.meterStart, maxMeter: 100, state: 'idle', action: '', actionTime: 0, actionTotal: 0,
      actionHit: false, combo: 0, comboTimer: 0, hurtTimer: 0, flashTimer: 0, invuln: 0, anim: 0,
      dodgeTime: 0, dodgeCooldown: 0, dodgeVx: 0, hero,
    };
  }

  function createEnemy(index, x, y, type = 'grunt') {
    const boss = type === 'boss';
    const bruiser = type === 'bruiser';
    const rusher = type === 'rusher';
    return {
      id: `${state.wave}-${index}-${Math.random().toString(16).slice(2)}`,
      x, y, vx: 0, facing: -1, type, boss, sheet: type === 'thrower' ? THROWER_SHEET : ENEMY_FILES[(index + state.wave * 2) % ENEMY_FILES.length],
      health: boss ? 180 : bruiser ? 45 : rusher ? 24 : 32, maxHealth: boss ? 180 : bruiser ? 45 : rusher ? 24 : 32,
      speed: boss ? 44 : bruiser ? 52 : rusher ? 112 : 74, state: 'idle', actionTime: 0, actionHit: false,
      hurtTimer: 0, flashTimer: 0, invuln: 0, anim: Math.random() * 3, attackCooldown: boss ? .7 : .35 + Math.random(),
      dead: false, deathTimer: 0,
      target: null,
    };
  }

  function beginRun() {
    clearInput();
    state.mode = 'play';
    state.player = createPlayer();
    state.enemies = [];
    state.projectiles = [];
    state.effects = [];
    state.particles = [];
    state.cameraX = 0;
    state.score = 0;
    state.hitStop = 0;
    state.lastImpact = null;
    state.lastProjectileImpact = null;
    state.wave = 0;
    state.bossDefeated = false;
    state.nextWaveAt = 260;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.spawnIndex = 0;
    state.waveSpawnX = 0;
    state.goTimer = 1.7;
    state.waveLabel = 'WAVE 1';
    state.message = 'THE STREET IS YOURS';
    state.messageTimer = 1.6;
    spawnWave(0);
    touchControls.hidden = !isTouchCapable();
    updateStatus('Fight through the street. Move with arrows or WASD, attack with J and K, dodge with Shift, special with L.');
    audio.play('select');
    syncPortraitUi();
  }

  function spawnWave(index) {
    state.wave = index + 1;
    const recipes = [
      ['grunt', 'rusher', 'grunt'],
      ['thrower', 'rusher', 'bruiser', 'grunt'],
      ['grunt', 'thrower', 'rusher', 'bruiser'],
      ['thrower', 'bruiser', 'grunt', 'bruiser', 'rusher', 'boss'],
    ];
    const recipe = recipes[index] || recipes[recipes.length - 1];
    state.spawnQueue = [...recipe];
    state.spawnIndex = 0;
    state.waveSpawnX = Math.max(state.player.x + 430, state.nextWaveAt + 200);
    state.spawnTimer = 0;
    spawnQueuedEnemies();
    state.goTimer = 1.5;
    state.waveLabel = `WAVE ${index + 1}`;
    state.nextWaveAt += 1250;
    state.message = index === 3 ? 'FINAL WAVE' : `WAVE ${index + 1}`;
    state.messageTimer = 1.5;
  }

  function spawnQueuedEnemies() {
    if (!state.player || state.spawnTimer > 0 || state.spawnQueue.length === 0) return;
    const room = Math.max(0, state.spawnBatchSize - activeEnemies().length);
    const count = Math.min(room, state.spawnQueue.length);
    for (let i = 0; i < count; i += 1) {
      const type = state.spawnQueue.shift();
      state.enemies.push(createEnemy(state.spawnIndex, state.waveSpawnX + state.spawnIndex * 100, randomLane(), type));
      state.spawnIndex += 1;
    }
    if (state.spawnQueue.length > 0) state.spawnTimer = 0.58;
  }

  function activeEnemies() { return state.enemies.filter((enemy) => !enemy.dead); }

  function inputAxis() {
    if (inputSuspended || document.hidden || isInteractiveTarget(document.activeElement)) return { x: 0, y: 0 };
    let dx = 0; let dy = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || heldActions.has('left')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || heldActions.has('right')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w') || heldActions.has('up')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s') || heldActions.has('down')) dy += 1;
    const pad = getGamepad();
    if (pad) {
      const px = Math.abs(pad.axes[0] || 0) > .2 ? pad.axes[0] : 0;
      const py = Math.abs(pad.axes[1] || 0) > .2 ? pad.axes[1] : 0;
      dx += px; dy += py;
      if (pad.buttons[14]?.pressed) dx -= 1;
      if (pad.buttons[15]?.pressed) dx += 1;
      if (pad.buttons[12]?.pressed) dy -= 1;
      if (pad.buttons[13]?.pressed) dy += 1;
    }
    const magnitude = Math.hypot(dx, dy);
    return magnitude > 1 ? { x: dx / magnitude, y: dy / magnitude } : { x: dx, y: dy };
  }

  function pollGamepad() {
    const pad = getGamepad();
    if (!pad) {
      previousGamepadButtons.clear();
      gamepadSelectDirection = 0;
      return;
    }
    const buttons = new Set(pad.buttons.flatMap((button, index) => button.pressed ? [index] : []));
    const newlyPressed = new Set([...buttons].filter((index) => !previousGamepadButtons.has(index)));
    const pressed = (...indices) => indices.some((index) => newlyPressed.has(index));
    const direction = pad.buttons[14]?.pressed || pad.axes[0] < -.5 ? -1 : pad.buttons[15]?.pressed || pad.axes[0] > .5 ? 1 : 0;
    const selectMoved = direction !== 0 && direction !== gamepadSelectDirection;
    previousGamepadButtons = buttons;
    gamepadSelectDirection = direction;
    if (inputSuspended || document.hidden || isInteractiveTarget(document.activeElement)) return;
    if (state.mode === 'select') {
      if (selectMoved) {
        state.selectedHero = (state.selectedHero + direction + HEROES.length) % HEROES.length;
        audio.play('select');
      }
      if (pressed(0, 2, 9)) beginFromInput();
      return;
    }
    if (state.mode === 'loading') return;
    if (pressed(8)) { restartFromInput(); return; }
    if (state.mode === 'victory' || state.player?.health <= 0) {
      if (pressed(0, 2, 9)) beginFromInput();
      return;
    }
    if (pressed(9)) { setPaused(state.mode !== 'paused'); return; }
    if (state.mode === 'paused') {
      if (pressed(0, 2)) beginFromInput();
      return;
    }
    if (pressed(0, 2)) pressedActions.add('light');
    if (pressed(1, 3)) pressedActions.add('heavy');
    if (pressed(4, 5)) pressedActions.add('special');
    if (pressed(6)) pressedActions.add('dodge');
  }

  function getGamepad() {
    return navigator.getGamepads ? Array.from(navigator.getGamepads()).find((pad) => pad) : null;
  }

  function actionPressed(name) {
    const pressed = pressedActions.has(name) || (heldActions.has(name) && !state[`last${name}`]);
    state[`last${name}`] = heldActions.has(name);
    return pressed;
  }

  function startAttack(type) {
    const player = state.player;
    if (!player || player.hurtTimer > 0 || player.state === 'defeat') return;
    if (type === 'special') {
      if (player.meter < 100 || player.action) return;
      player.action = 'special'; player.actionTime = 0; player.actionTotal = .95; player.actionHit = false; player.state = 'special';
      player.combo = 0; player.comboTimer = 0;
      player.meter = 0;
      state.effects.push({ type: 'special', x: player.x + player.facing * 160, y: player.y - 105, time: .55, max: .55, color: player.hero.color });
      audio.play('special');
      return;
    }
    if (player.action) {
      if (type === 'light' && player.action === 'light' && player.actionTime > .2 && player.actionTime < .42) {
        player.combo = clamp(player.combo + 1, 1, 3);
        player.comboTimer = .65;
        player.actionTime = 0; player.actionTotal = .42; player.actionHit = false;
        return;
      }
      return;
    }
    player.action = type;
    player.actionTime = 0;
    player.actionTotal = type === 'heavy' ? .62 : .42;
    player.actionHit = false;
    player.combo = type === 'light' ? clamp(player.combo + 1, 1, 3) : 0;
    player.comboTimer = type === 'light' ? .65 : 0;
    player.state = type;
    if (type === 'heavy') audio.play('heavy');
  }

  function startDodge() {
    const player = state.player;
    if (!player || player.action || player.dodgeTime > 0 || player.dodgeCooldown > 0 || player.hurtTimer > 0 || player.state === 'defeat') return;
    player.dodgeTime = .32;
    player.dodgeCooldown = .62;
    player.dodgeVx = player.facing * (player.hero.dodge / .32);
    player.invuln = Math.max(player.invuln, .38);
    player.state = 'dodge';
    player.action = '';
    state.message = 'RUSH STEP';
    state.messageTimer = .22;
    audio.play('dodge');
  }

  function attackWindow(player) {
    if (player.action === 'light') return player.actionTime > .1 && player.actionTime < .28;
    if (player.action === 'heavy') return player.actionTime > .17 && player.actionTime < .4;
    if (player.action === 'special') return player.actionTime > .2 && player.actionTime < .78;
    return false;
  }

  function attackRange(player) {
    const special = player.action === 'special';
    return { x: player.x + player.facing * (special ? 160 : player.action === 'heavy' ? 88 : 68), y: player.y - 88, radius: special ? 190 : player.action === 'heavy' ? 85 : 67 };
  }

  function addImpact(x, y, kind, color) {
    const profiles = {
      light: { count: 10, stop: .035, size: 32 },
      heavy: { count: 17, stop: .065, size: 48 },
      special: { count: 26, stop: .09, size: 68 },
    };
    const profile = profiles[kind] || profiles.light;
    state.hitStop = Math.max(state.hitStop, profile.stop);
    state.lastImpact = { kind, x: Math.round(x), y: Math.round(y), time: state.time };
    state.effects.push({ type: 'impact', kind, x, y, time: .22, max: .22, color, size: profile.size });
    burst(x, y, color, profile.count, kind);
  }

  function hitEnemy(enemy, damage, knockback, attackKind = 'light') {
    const special = attackKind === 'special';
    enemy.health -= damage;
    enemy.hurtTimer = special ? .42 : .25;
    enemy.flashTimer = attackKind === 'heavy' ? .14 : special ? .2 : .09;
    enemy.invuln = .18;
    enemy.vx = knockback;
    enemy.state = enemy.health <= 0 ? 'defeat' : 'hurt';
    enemy.target = null;
    if (enemy.type === 'thrower') enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.2);
    if (enemy.health <= 0) {
      enemy.dead = true;
      enemy.deathTimer = 1.1;
      state.score += enemy.boss ? 1500 : special ? 450 : 100 + state.wave * 25;
      state.player.meter = clamp(state.player.meter + (special ? 4 : 10), 0, 100);
      state.message = enemy.boss ? 'BOSS DOWN!' : special ? `${state.player.hero.specialName}!` : 'ROUGH HIT!';
      state.messageTimer = .36;
      if (enemy.boss) state.bossDefeated = true;
      audio.play(enemy.boss ? 'boss-defeat' : 'enemy-defeat');
    } else {
      state.player.meter = clamp(state.player.meter + 5, 0, 100);
    }
    state.shake = special ? .22 : attackKind === 'heavy' ? .16 : .1;
    addImpact(enemy.x, enemy.y - 100, attackKind, special ? '#ffd764' : attackKind === 'heavy' ? '#ff9f43' : '#ff68d3');
    if (!special) audio.play('hit');
  }

  function damagePlayer(amount, source) {
    const player = state.player;
    if (player.invuln > 0 || player.hurtTimer > 0 || state.mode !== 'play') return;
    player.health = clamp(player.health - amount, 0, player.maxHealth);
    player.hurtTimer = .42;
    player.flashTimer = .16;
    player.invuln = .8;
    player.action = '';
    player.combo = 0; player.comboTimer = 0;
    player.state = player.health <= 0 ? 'defeat' : 'hurt';
    player.vx = source.x < player.x ? 180 : -180;
    state.shake = .16;
    addImpact(player.x, player.y - 100, amount >= 14 ? 'heavy' : 'light', '#ff4f58');
    audio.play('hit');
    if (player.health <= 0) {
      state.message = 'DOWN FOR THE COUNT';
      state.messageTimer = 999;
      updateStatus('You were knocked out. Press R or tap the screen to try again.');
    }
  }

  function updatePlayer(dt) {
    const player = state.player;
    if (!player) return;
    player.anim += dt * (player.state === 'walk' ? 10 : player.state === 'idle' ? 2.8 : 6);
    player.invuln = Math.max(0, player.invuln - dt);
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.flashTimer = Math.max(0, player.flashTimer - dt);
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
    if (player.action !== 'light') {
      player.comboTimer = Math.max(0, player.comboTimer - dt);
      if (player.comboTimer === 0) player.combo = 0;
    }
    if (player.hurtTimer > 0) {
      player.x = clamp(player.x + player.vx * dt, 40, WORLD_WIDTH - 100);
      player.vx *= .86;
      return;
    }
    if (player.state === 'defeat') {
      player.vx *= .9;
      return;
    }
    if (actionPressed('dodge')) startDodge();
    if (player.dodgeTime > 0) {
      player.dodgeTime -= dt;
      player.x = clamp(player.x + player.dodgeVx * dt, 45, WORLD_WIDTH - 90);
      player.dodgeVx *= .88;
      player.state = 'dodge';
      if (player.dodgeTime <= 0) { player.state = 'idle'; player.dodgeVx = 0; }
      return;
    }
    const axis = inputAxis();
    if (!player.action) {
      player.vx = axis.x * player.speed;
      player.vy = axis.y * player.speed * .78;
      if (Math.abs(axis.x) > .1) player.facing = axis.x > 0 ? 1 : -1;
      player.x = clamp(player.x + player.vx * dt, 45, WORLD_WIDTH - 90);
      if (axis.x > 0 && (activeEnemies().length || state.spawnQueue.length)) {
        const livingEnemies = activeEnemies();
        const furthestEnemy = livingEnemies.length
          ? Math.max(...livingEnemies.map((enemy) => enemy.x))
          : state.waveSpawnX + state.spawnIndex * 100;
        player.x = Math.min(player.x, furthestEnemy + 250);
      }
      player.y = clamp(player.y + player.vy * dt, FLOOR_TOP + 40, FLOOR_BOTTOM);
      player.state = Math.hypot(player.vx, player.vy) > 8 ? 'walk' : 'idle';
    } else {
      player.vx *= .8;
      player.actionTime += dt;
      if (!player.actionHit && attackWindow(player)) {
        player.actionHit = true;
        const range = attackRange(player);
        activeEnemies().forEach((enemy) => {
          const horizontal = (enemy.x - player.x) * player.facing;
          const reach = (range.x - player.x) * player.facing + range.radius;
          if (horizontal >= 0 && horizontal < reach && Math.abs(enemy.y - player.y) < 42 && enemy.invuln <= 0) {
            const baseDamage = player.action === 'special' ? 36 : player.action === 'heavy' ? 20 : 12 + player.combo * 2;
            const damage = baseDamage * player.hero.damage;
            const knockback = enemy.boss ? 75 : (player.action === 'special' ? 290 : player.action === 'heavy' ? 180 : 120);
            hitEnemy(enemy, damage, player.facing * knockback, player.action);
          }
        });
      }
      if (player.actionTime >= player.actionTotal) {
        player.action = '';
        player.state = 'idle';
        player.comboTimer = .65;
      }
    }
    if (actionPressed('light')) startAttack('light');
    if (actionPressed('heavy')) startAttack('heavy');
    if (actionPressed('special')) startAttack('special');
  }

  function updateEnemy(enemy, dt) {
    enemy.anim += dt * (enemy.state === 'walk' ? 10 : 6);
    enemy.invuln = Math.max(0, enemy.invuln - dt);
    enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);
    enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
    if (enemy.dead) {
      enemy.deathTimer -= dt;
      enemy.vx *= .9;
      enemy.x += enemy.vx * dt;
      return;
    }
    if (enemy.hurtTimer > 0) {
      enemy.x += enemy.vx * dt;
      enemy.vx *= .84;
      return;
    }
    enemy.attackCooldown -= dt;
    const player = state.player;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const attack = ENEMY_ATTACKS[enemy.type];
    const ranged = enemy.type === 'thrower';
    const closeEnough = ranged
      ? Math.abs(dx) < attack.range && enemy.x > state.cameraX + 45 && enemy.x < state.cameraX + W - 45
      : Math.abs(dx) < attack.range && Math.abs(dy) < 38;
    if (enemy.state === 'windup') {
      enemy.actionTime += dt;
      if (!ranged) enemy.facing = dx < 0 ? -1 : 1;
      if (enemy.actionTime >= attack.windup) {
        enemy.state = 'attack'; enemy.actionTime = 0; enemy.actionHit = false;
        if (ranged) { launchBottle(enemy); enemy.actionHit = true; }
        if (enemy.type === 'rusher') enemy.x += enemy.facing * 18;
      }
      return;
    }
    if (enemy.state === 'attack') {
      enemy.actionTime += dt;
      if (!enemy.actionHit && enemy.actionTime <= attack.active) {
        enemy.actionHit = true;
        if (Math.abs(player.x - enemy.x) < attack.range && Math.abs(player.y - enemy.y) < 38) damagePlayer(attack.damage, enemy);
      }
      if (enemy.actionTime > attack.active + attack.recovery) {
        enemy.state = 'idle'; enemy.attackCooldown = ranged ? 2.1 : enemy.boss ? 1.35 : enemy.type === 'rusher' ? .7 : 1.1; enemy.actionTime = 0;
      }
      return;
    }
    if (closeEnough && enemy.attackCooldown <= 0) {
      enemy.state = 'windup'; enemy.actionTime = 0; enemy.actionHit = false; enemy.vx = 0;
      enemy.facing = dx < 0 ? -1 : 1;
      if (ranged) enemy.target = { x: player.x, y: player.y };
      return;
    }
    // Slow retreat gives a ranged identity without endlessly kiting melee heroes.
    const xStep = ranged ? Math.abs(dx) > 390 ? Math.sign(dx) : Math.abs(dx) < 140 ? -Math.sign(dx) * .45 : 0 : Math.abs(dx) > 68 ? Math.sign(dx) : 0;
    const yStep = Math.abs(dy) > (ranged ? 70 : 26) ? Math.sign(dy) : 0;
    enemy.vx = xStep * enemy.speed;
    enemy.x = clamp(enemy.x + enemy.vx * dt, 30, WORLD_WIDTH - 40);
    enemy.y = clamp(enemy.y + yStep * enemy.speed * .6 * dt, FLOOR_TOP + 35, FLOOR_BOTTOM);
    enemy.facing = dx < 0 ? -1 : 1;
    enemy.state = Math.abs(enemy.vx) > 2 || Math.abs(yStep) > 0 ? 'walk' : 'idle';
  }

  function launchBottle(enemy) {
    if (!enemy.target || state.player.health <= 0) return;
    const startX = enemy.x + enemy.facing * 48;
    const duration = clamp(Math.hypot(enemy.target.x - startX, enemy.target.y - enemy.y) / 450, .65, 1.05);
    state.projectiles.push({ startX, startY: enemy.y, x: startX, y: enemy.y,
      target: { ...enemy.target }, elapsed: 0, duration, facing: enemy.facing });
    enemy.target = null;
  }

  function updateProjectiles(dt) {
    if (state.player.health <= 0) { state.projectiles = []; return; }
    state.projectiles = state.projectiles.filter((bottle) => {
      bottle.elapsed += dt;
      const t = clamp(bottle.elapsed / bottle.duration, 0, 1);
      bottle.x = lerp(bottle.startX, bottle.target.x, t);
      bottle.y = lerp(bottle.startY, bottle.target.y, t);
      if (t < 1) return true;
      const player = state.player;
      const inRange = Math.abs(player.x - bottle.target.x) < 46 && Math.abs(player.y - bottle.target.y) < 26;
      const before = player.health;
      if (inRange) damagePlayer(ENEMY_ATTACKS.thrower.damage, { x: bottle.startX });
      const outcome = player.health < before ? 'hit' : inRange ? 'dodged' : 'miss';
      state.lastProjectileImpact = { ...bottle.target, outcome, time: state.time };
      addImpact(bottle.target.x, bottle.target.y - 12, 'bottle', '#b8ff83');
      state.effects.push({ type: 'bottle-feedback', x: bottle.target.x, y: bottle.target.y - 55, outcome, time: .65, max: .65 });
      return false;
    });
  }

  function burst(x, y, color, count, kind = 'light') {
    for (let i = 0; i < count; i += 1) {
      const force = kind === 'special' ? 390 : kind === 'heavy' ? 300 : 220;
      const life = .24 + Math.random() * (kind === 'special' ? .5 : .32);
      state.particles.push({ x, y, vx: (Math.random() - .5) * force, vy: (Math.random() - .72) * force * .72, life, max: life, color, size: 2 + Math.random() * (kind === 'special' ? 8 : kind === 'heavy' ? 6 : 4), kind });
    }
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((p) => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 280 * dt; return p.life > 0;
    });
    state.effects = state.effects.filter((effect) => { effect.time -= dt; return effect.time > 0; });
  }

  function updateGame(dt) {
    pollGamepad();
    if (state.mode === 'paused') return;
    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt);
      return;
    }
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt);
    if (state.messageTimer > 0 && state.messageTimer < 900) state.messageTimer -= dt;
    if (state.goTimer > 0) state.goTimer -= dt;
    state.spawnTimer = Math.max(0, state.spawnTimer - dt);
    if (state.mode !== 'play') { updateParticles(dt); return; }
    updatePlayer(dt);
    state.enemies.forEach((enemy) => updateEnemy(enemy, dt));
    updateProjectiles(dt);
    state.enemies = state.enemies.filter((enemy) => !enemy.dead || enemy.deathTimer > 0);
    updateParticles(dt);
    if (state.player.health <= 0) return;
    spawnQueuedEnemies();
    const living = activeEnemies().length;
    if (living === 0 && state.spawnQueue.length === 0 && state.projectiles.length === 0 && state.wave < 4 && state.player.x > state.nextWaveAt - 780 && state.goTimer <= 0) spawnWave(state.wave);
    if (living === 0 && state.spawnQueue.length === 0 && state.projectiles.length === 0 && state.wave === 4 && state.player.x > WORLD_WIDTH - 500 && state.goTimer <= 0) {
      state.mode = 'victory'; state.message = 'STREET CLEARED'; state.messageTimer = 999; touchControls.hidden = true;
      updateStatus('Street cleared. Press R or tap the screen to play again.'); audio.play('victory');
    }
    state.cameraX = clamp(lerp(state.cameraX, state.player.x - (portrait ? W * .32 : 370), .12), 0, WORLD_WIDTH - W);
  }

  function drawPlayer() {
    const player = state.player;
    if (!player) return;
    const hero = HEROES[state.selectedHero];
    const animationState = player.state === 'light' ? 'punch' : player.state === 'heavy' ? 'kick' : player.state === 'dodge' ? 'walk' : player.state;
    let frames = heroFrames[animationState] || heroFrames.idle;
    let sheet = image(hero.base);
    if (player.state === 'special') { frames = specialFrames; sheet = image(hero.special); }
    const alpha = player.invuln > 0 && player.hurtTimer <= 0 && Math.floor(player.invuln * 18) % 2 === 0 ? .42 : 1;
    const action = ['light', 'heavy', 'special'].includes(player.state);
    const progress = action ? (player.actionTime / Math.max(.001, player.actionTotal)) * (frames.length - .001) : player.anim;
    ctx.save();
    if (player.flashTimer > 0) { ctx.filter = 'brightness(3.6) saturate(0)'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 18; }
    drawAnimatedSprite(sheet, frames, progress, player.x - state.cameraX, player.y + 12 * 245 / 256, 245, player.facing, alpha, !action);
    ctx.restore();
  }

  function drawEnemy(enemy) {
    const ranged = enemy.type === 'thrower';
    const clips = ranged ? throwerFrames : enemyFrames;
    const frameSet = enemy.dead ? clips.defeat : clips[enemy.state] || clips.idle;
    const alpha = enemy.dead ? clamp(enemy.deathTimer * 2, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    const height = enemy.boss ? 290 : enemy.type === 'bruiser' || ranged ? 235 : 205;
    if (enemy.state === 'windup') {
      const attack = ENEMY_ATTACKS[enemy.type];
      const charge = clamp(enemy.actionTime / attack.windup, 0, 1);
      const screenX = enemy.x - state.cameraX;
      ctx.save();
      ctx.globalAlpha = .24 + charge * .5;
      ctx.strokeStyle = attack.color;
      ctx.fillStyle = `${attack.color}33`;
      ctx.lineWidth = enemy.boss ? 7 : 4;
      if (ranged && enemy.target) {
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(screenX, enemy.y); ctx.lineTo(enemy.target.x - state.cameraX, enemy.target.y); ctx.stroke();
        ctx.setLineDash([]);
        drawBottleTarget(enemy.target, charge);
      } else {
        ctx.beginPath(); ctx.ellipse(screenX + enemy.facing * attack.range * .45, enemy.y - 3, attack.range * .62, 18 + charge * 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = .72 + Math.sin(state.time * 24) * .22;
      drawText(attack.label, screenX, enemy.y - height - (enemy.boss ? 54 : 24), ranged ? 20 : enemy.boss ? 18 : 13, attack.color, 'center');
      ctx.restore();
    }
    if (enemy.boss) {
      ctx.save();
      ctx.globalAlpha = .22 + Math.sin(state.time * 5) * .08;
      ctx.fillStyle = '#ff315f';
      ctx.beginPath(); ctx.arc(enemy.x - state.cameraX, enemy.y - 125, 78, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const attackTotal = ENEMY_ATTACKS[enemy.type].active + ENEMY_ATTACKS[enemy.type].recovery;
    const progress = enemy.dead ? (1 - enemy.deathTimer) * (frameSet.length - .001) : enemy.state === 'attack' ? (enemy.actionTime / attackTotal) * (frameSet.length - .001) : ranged && enemy.state === 'windup' ? enemy.actionTime / ENEMY_ATTACKS.thrower.windup * (frameSet.length - .001) : enemy.anim;
    if (enemy.flashTimer > 0) { ctx.filter = 'brightness(4) saturate(0)'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20; }
    if (ranged) {
      const looping = !enemy.dead && !['attack', 'windup'].includes(enemy.state);
      const index = looping ? Math.floor(Math.max(0, progress)) % frameSet.length : Math.floor(clamp(progress, 0, frameSet.length - 1));
      drawSprite(image(enemy.sheet), frameSet[index], enemy.x - state.cameraX, enemy.y + 20 * height / 320, height, enemy.facing);
    } else {
      drawAnimatedSprite(image(enemy.sheet), frameSet, progress, enemy.x - state.cameraX, enemy.y, height, enemy.facing, 1, !enemy.dead && enemy.state !== 'attack');
    }
    if (!enemy.dead && enemy.boss) drawText('STREET BOSS', enemy.x - state.cameraX, enemy.y - 320, 17, '#ff6a87', 'center');
    ctx.restore();
    if (!enemy.dead && enemy.health < enemy.maxHealth) {
      const barW = enemy.boss ? 150 : enemy.type === 'bruiser' ? 74 : 58;
      const barY = enemy.boss ? enemy.y - 302 : enemy.y - 218;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(enemy.x - state.cameraX - barW / 2, barY, barW, enemy.boss ? 10 : 7);
      ctx.fillStyle = enemy.boss ? '#ff3e68' : enemy.type === 'bruiser' ? '#ffbf3c' : '#ff5d7d'; ctx.fillRect(enemy.x - state.cameraX - barW / 2, barY, barW * clamp(enemy.health / enemy.maxHealth, 0, 1), enemy.boss ? 10 : 7);
    }
  }

  function drawBottleTarget(target, charge) {
    const x = target.x - state.cameraX;
    ctx.save(); ctx.globalAlpha = .85;
    ctx.fillStyle = 'rgba(167,255,103,.16)'; ctx.strokeStyle = '#a7ff67'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, target.y, 46, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, target.y, 52, 31, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.02, charge)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, target.y); ctx.lineTo(x + 8, target.y); ctx.moveTo(x, target.y - 8); ctx.lineTo(x, target.y + 8); ctx.stroke();
    // An elevated beacon stays visible above the existing touch pad.
    ctx.fillStyle = '#182817'; ctx.strokeStyle = '#a7ff67'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, target.y - 107); ctx.lineTo(x + 19, target.y - 78); ctx.lineTo(x - 19, target.y - 78); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawText('!', x, target.y - 90, 23, '#ffffff', 'center');
    ctx.restore();
  }

  function drawProjectiles() {
    state.projectiles.forEach((bottle) => {
      const t = clamp(bottle.elapsed / bottle.duration, 0, 1);
      drawBottleTarget(bottle.target, t);
      const z = (1 - t) * 150 + Math.sin(t * Math.PI) * 95;
      ctx.save(); ctx.shadowColor = '#a7ff67'; ctx.shadowBlur = 12;
      // Discrete authored rotation poses remain crisp; no ghosted frame blend.
      drawSprite(image(THROWER_SHEET), frameFor(throwerFrames.bottle, Math.floor(t * 12)), bottle.x - state.cameraX, bottle.y - z + 64, 128, bottle.facing);
      ctx.restore();
    });
  }

  function drawParticles() {
    state.particles.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - state.cameraX, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    if (!state.player) return;
    const player = state.player;
    const hero = HEROES[state.selectedHero];
    drawPanel(22, 18, 355, 84, '#a8afc5', 'rgba(7,7,21,.82)');
    ctx.fillStyle = hero.color; ctx.fillRect(40, 35, 52, 52);
    drawSprite(image(hero.base), heroFrames.idle[0], 66, 85, 62, 1, 1);
    drawText(hero.name, 106, 36, 20, hero.color);
    drawText('HP', 106, 58, 13, '#b6b4ca');
    drawPanel(132, 48, 218, 18, '#798196', 'rgba(0,0,0,.75)');
    ctx.fillStyle = player.health > 35 ? '#42e56a' : '#ff3d49'; ctx.fillRect(138, 54, 206 * clamp(player.health / player.maxHealth, 0, 1), 6);
    drawText('SP', 106, 78, 13, '#b6b4ca');
    drawPanel(132, 68, 218, 18, '#798196', 'rgba(0,0,0,.75)');
    ctx.fillStyle = '#ffc82f'; ctx.fillRect(138, 74, 206 * clamp(player.meter / player.maxMeter, 0, 1), 6);
    drawPanel(1038, 18, 220, 84, '#a8afc5', 'rgba(7,7,21,.82)');
    drawText(state.waveLabel, 1054, 39, 15, '#ff71da');
    drawText(String(state.score).padStart(6, '0'), 1242, 71, 25, '#fff', 'right');
    drawText('SCORE', 1054, 74, 12, '#b6b4ca');
    if (player.combo > 1 && player.comboTimer > 0) drawText(`${player.combo} HIT COMBO`, 640, 136, 21, '#ffd455', 'center');
  }

  function drawGoSignal() {
    if (state.goTimer <= 0) return;
    const pulse = .78 + Math.sin(state.time * 14) * .14;
    ctx.save();
    ctx.globalAlpha = clamp(state.goTimer / .5, 0, 1) * pulse;
    ctx.translate(W / 2, 196);
    ctx.shadowColor = '#ff352c'; ctx.shadowBlur = 25;
    ctx.fillStyle = '#f73d2c';
    ctx.beginPath(); ctx.moveTo(-170, -38); ctx.lineTo(58, -38); ctx.lineTo(58, -92); ctx.lineTo(176, 0); ctx.lineTo(58, 92); ctx.lineTo(58, 38); ctx.lineTo(-170, 38); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff3ad'; ctx.lineWidth = 5; ctx.stroke();
    drawText('GO!', 0, 2, 51, '#ffe24d', 'center', '900 51px Impact');
    ctx.restore();
  }

  function drawStage() {
    drawBackground();
    const things = [...activeEnemies(), ...state.enemies.filter((enemy) => enemy.dead), { ...state.player, isPlayer: true }].filter(Boolean).sort((a, b) => a.y - b.y);
    things.forEach((thing) => {
      ctx.fillStyle = 'rgba(0,0,0,.32)';
      ctx.beginPath(); ctx.ellipse(thing.x - state.cameraX, thing.y + 3, thing.isPlayer ? 35 : 31, 9, 0, 0, Math.PI * 2); ctx.fill();
      if (thing.isPlayer) drawPlayer(); else drawEnemy(thing);
    });
    drawProjectiles();
    state.effects.forEach((effect) => {
      if (effect.type === 'bottle-feedback') {
        ctx.save(); ctx.globalAlpha = effect.time / effect.max;
        drawText(effect.outcome === 'hit' ? 'BOTTLE HIT!' : effect.outcome === 'dodged' ? 'DODGED!' : 'GLASS BREAK', effect.x - state.cameraX, effect.y - (1 - effect.time / effect.max) * 20, 22, effect.outcome === 'hit' ? '#ff727a' : '#b8ff83', 'center');
        ctx.restore(); return;
      }
      if (effect.type === 'impact') {
        const progress = 1 - effect.time / effect.max;
        ctx.save();
        ctx.globalAlpha = effect.time / effect.max;
        ctx.strokeStyle = effect.color; ctx.lineWidth = effect.kind === 'special' ? 8 : effect.kind === 'heavy' ? 6 : 4;
        ctx.shadowColor = effect.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(effect.x - state.cameraX, effect.y, effect.size * (.35 + progress), 0, Math.PI * 2); ctx.stroke();
        const rays = effect.kind === 'special' ? 10 : effect.kind === 'heavy' ? 8 : 6;
        for (let i = 0; i < rays; i += 1) {
          const angle = i / rays * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(effect.x - state.cameraX + Math.cos(angle) * effect.size * .35, effect.y + Math.sin(angle) * effect.size * .35);
          ctx.lineTo(effect.x - state.cameraX + Math.cos(angle) * effect.size * (1 + progress * .5), effect.y + Math.sin(angle) * effect.size * (1 + progress * .5));
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      if (effect.type !== 'special') return;
      const progress = 1 - effect.time / effect.max;
      ctx.save(); ctx.globalAlpha = effect.time / effect.max;
      ctx.strokeStyle = effect.color || '#ffc7ef'; ctx.lineWidth = 7; ctx.shadowColor = effect.color || '#ff51c7'; ctx.shadowBlur = 18;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath(); ctx.arc(effect.x - state.cameraX + progress * 120, effect.y, 25 + i * 14, -0.9, 0.9); ctx.stroke();
      }
      ctx.restore();
    });
    drawParticles();
    if (!portrait) drawHud();
    drawGoSignal();
    if (state.messageTimer > 0 && state.goTimer <= 0) {
      const alpha = clamp(Math.min(state.messageTimer * 2, 1), 0, 1);
      ctx.globalAlpha = alpha;
      drawText(state.message, W / 2, 175, 22, '#ffe462', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawSelect() {
    drawBackground();
    ctx.fillStyle = 'rgba(8,4,24,.83)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ef3dce'; ctx.lineWidth = 3; ctx.strokeRect(18, 18, W - 36, H - 36);
    drawText('ROADS OF ROUGH', W / 2, 74, 54, '#ff62dc', 'center', '900 54px Impact');
    drawText('A CITY STREET BRAWL', W / 2, 116, 17, '#ffe45d', 'center');
    drawText('CHOOSE YOUR ROUGH ONE', W / 2, 168, 20, '#e9e6f8', 'center');
    const cardW = 206; const startX = 110;
    HEROES.forEach((hero, index) => {
      const x = startX + index * 224;
      const selected = index === state.selectedHero;
      drawPanel(x, 215, cardW, 306, selected ? hero.color : '#53536f', selected ? 'rgba(36,12,50,.95)' : 'rgba(12,10,28,.88)');
      if (selected) { ctx.strokeStyle = hero.color; ctx.lineWidth = 2; ctx.strokeRect(x - 6, 209, cardW + 12, 318); }
      drawSprite(image(hero.base), heroFrames.idle[0], x + cardW / 2, 452, 225, 1, 1);
      drawText(hero.name, x + cardW / 2, 465, 18, selected ? hero.color : '#f7edf9', 'center');
      drawText(hero.role, x + cardW / 2, 486, 11, selected ? '#ffe45d' : '#aaa4c0', 'center');
      drawText(hero.specialName, x + cardW / 2, 506, 10, selected ? '#f7edf9' : '#8d87a6', 'center');
    });
    drawText('CHOOSE YOUR ROUGH ONE', W / 2, 545, 14, '#a8a2bf', 'center');
    drawText('← → / A D TO CHOOSE    ENTER / SPACE TO START', W / 2, 594, 17, '#fff', 'center');
    drawText('J / X HIT     K / C KICK     L / V SPECIAL     SHIFT DODGE     F FULLSCREEN', W / 2, 625, 12, '#bcb5d7', 'center');
    drawText('GAMEPAD: A/X HIT · B/Y KICK · LB/RB SPECIAL · LT DODGE · START PAUSE · BACK RESTART', W / 2, 667, 12, '#ff65d8', 'center');
  }

  function drawOverlay(title, subtitle, color) {
    ctx.fillStyle = 'rgba(4,3,16,.7)'; ctx.fillRect(0, 0, W, H);
    drawPanel(330, 210, 620, 250, color, 'rgba(11,8,30,.94)');
    drawText(title, W / 2, 278, 48, color, 'center', '900 48px Impact');
    drawText(subtitle, W / 2, 330, 19, '#f9edf8', 'center');
    drawText(`SCORE  ${String(state.score).padStart(6, '0')}`, W / 2, 374, 22, '#ffd65b', 'center');
    drawText(state.mode === 'paused' ? 'P / START OR TAP TO RESUME · R TO RESTART' : 'PRESS R OR TAP TO RESTART', W / 2, 422, 15, '#fff', 'center');
  }

  function render() {
    syncPortraitUi();
    ctx.save();
    if (state.shake > 0) ctx.translate((Math.random() - .5) * 12 * state.shake / .2, (Math.random() - .5) * 8 * state.shake / .2);
    if (!assets.ready) {
      ctx.fillStyle = '#09091b'; ctx.fillRect(0, 0, W, H);
      drawText('LOADING THE STREET…', W / 2, H / 2, 26, '#ff65d8', 'center');
    } else if (state.mode === 'select') { if (portrait) drawBackground(); else drawSelect(); }
    else if (state.mode === 'play' || state.mode === 'paused') {
      drawStage();
      if (state.mode === 'paused' && !portrait) drawOverlay('PAUSED', 'The street waits.', '#62e8ff');
    } else if (state.mode === 'victory') {
      drawStage(); if (!portrait) drawOverlay('STREET CLEARED', 'You made it through the rough side of town.', '#ffd65b');
    }
    ctx.restore();
  }

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"]'));
  }

  function clearInput() {
    keys.clear();
    heldActions.clear();
    pressedActions.clear();
    for (const action of ['light', 'heavy', 'special', 'dodge']) state[`last${action}`] = false;
    touchControls.querySelectorAll('.is-held').forEach((button) => button.classList.remove('is-held'));
  }

  function setPaused(paused) {
    if (state.mode !== 'play' && state.mode !== 'paused') return;
    clearInput();
    state.mode = paused ? 'paused' : 'play';
    syncPortraitUi();
    updateStatus(paused ? 'Paused. Press P, gamepad Start, or tap the game to resume.' : 'Back in the fight.');
  }

  function suspendInput() {
    inputSuspended = true;
    clearInput();
    setPaused(true);
    audio.collapse();
  }

  function restartFromInput() {
    if (state.mode === 'select' || state.player) beginRun();
  }

  function beginFromInput() {
    if (state.mode === 'select') beginRun();
    else if (state.mode === 'victory' || (state.mode === 'play' && state.player.health <= 0)) beginRun();
    else if (state.mode === 'paused') setPaused(false);
  }

  function handleKeyDown(event) {
    if (inputSuspended || document.hidden || isInteractiveTarget(event.target)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key) || ['w', 'a', 's', 'd', 'j', 'x', 'k', 'c', 'l', 'v', 'b', 'p', 'r', 'f'].includes(key)) event.preventDefault();
    if (event.repeat && ['f', 'r', 'p', 'Enter', ' '].includes(key)) return;
    if (key === 'f') { toggleFullscreen(); return; }
    if (key === 'Escape' && document.fullscreenElement) { document.exitFullscreen(); return; }
    if (key === 'r') { restartFromInput(); return; }
    if (key === 'p' && (state.mode === 'play' || state.mode === 'paused')) {
      setPaused(state.mode !== 'paused');
      return;
    }
    if (state.mode === 'select' && (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd')) {
      state.selectedHero = (state.selectedHero + (key === 'ArrowLeft' || key === 'a' ? HEROES.length - 1 : 1)) % HEROES.length;
      audio.play('select'); return;
    }
    if (state.mode === 'select' && (key === 'Enter' || key === ' ')) { beginRun(); return; }
    if ((state.mode === 'victory' || (state.mode === 'play' && state.player?.health <= 0)) && (key === 'Enter' || key === ' ')) { beginRun(); return; }
    if (key === 'j' || key === 'x') pressedActions.add('light');
    if (key === 'k' || key === 'c') pressedActions.add('heavy');
    if (key === 'l' || key === 'v') pressedActions.add('special');
    if (key === 'b') pressedActions.add('dodge');
    if (key === 'Shift') pressedActions.add('dodge');
    keys.add(key);
  }

  function handleKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
    if (key === 'j' || key === 'x') pressedActions.delete('light');
    if (key === 'k' || key === 'c') pressedActions.delete('heavy');
    if (key === 'l' || key === 'v') pressedActions.delete('special');
    if (key === 'b') pressedActions.delete('dodge');
    if (key === 'Shift') pressedActions.delete('dodge');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function touchBind(button) {
    const action = button.dataset.action;
    const down = (event) => {
      event.preventDefault();
      if (state.mode === 'paused') return;
      canvas.focus({ preventScroll: true });
      button.classList.add('is-held'); heldActions.add(action);
      if (['light', 'heavy', 'special'].includes(action)) pressedActions.add(action);
      if (state.mode === 'select' || state.mode === 'victory' || state.player?.health <= 0) beginFromInput();
    };
    const up = (event) => {
      event.preventDefault(); button.classList.remove('is-held'); heldActions.delete(action); pressedActions.delete(action);
    };
    button.addEventListener('pointerdown', down, { passive: false });
    button.addEventListener('pointerup', up, { passive: false });
    button.addEventListener('pointercancel', up, { passive: false });
    button.addEventListener('pointerleave', up, { passive: false });
  }

  function handleCanvasPointer(event) {
    if (event.type === 'pointerdown') {
      canvas.focus({ preventScroll: true });
      if (state.mode === 'select') {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * W / rect.width;
        if (x > 100 && x < 1230 && event.clientY - rect.top > rect.height * .28) {
          const index = clamp(Math.floor((x - 110) / 224), 0, HEROES.length - 1);
          state.selectedHero = index; beginRun();
        }
      } else beginFromInput();
    }
  }

  function updateStatus(text) { statusNode.textContent = text; }

  function updateLayout() {
    portrait = window.matchMedia('(max-width: 720px) and (orientation: portrait)').matches;
    document.body.classList.toggle('portrait', portrait);
    const box = stage.getBoundingClientRect();
    const width = portrait ? Math.max(520, Math.ceil(H * box.width / Math.max(1, box.height))) : 1280;
    if (W !== width) { W = width; canvas.width = W; }
    canvas.style.aspectRatio = `${W} / ${H}`;
    screenScale = box.width / W;
    ctx.imageSmoothingEnabled = false;
    if (state.player) state.cameraX = clamp(state.player.x - (portrait ? W * .32 : 370), 0, WORLD_WIDTH - W);
  }

  const portraitRoster = document.getElementById('portrait-roster');
  HEROES.forEach((hero, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.hero = index;
    const picture = document.createElement('img');
    picture.src = `${PATH}runtime/player_${hero.name.toLowerCase()}-portrait.png`; picture.alt = '';
    const details = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = hero.name;
    const role = document.createElement('span'); role.textContent = hero.role;
    const special = document.createElement('small'); special.textContent = hero.specialName;
    details.append(name, role, special); button.append(picture, details);
    button.addEventListener('click', () => { state.selectedHero = index; beginRun(); canvas.focus({ preventScroll: true }); });
    portraitRoster.append(button);
  });
  document.getElementById('portrait-pause').addEventListener('click', () => { setPaused(true); canvas.focus({ preventScroll: true }); });
  document.getElementById('portrait-resume').addEventListener('click', () => { setPaused(false); canvas.focus({ preventScroll: true }); });
  document.getElementById('portrait-restart').addEventListener('click', () => { beginRun(); canvas.focus({ preventScroll: true }); });
  portraitOverlay.addEventListener('pointerdown', (event) => {
    if (!isInteractiveTarget(event.target)) { beginFromInput(); canvas.focus({ preventScroll: true }); }
  });

  function syncPortraitUi() {
    const player = state.player;
    const dead = player && player.health <= 0;
    portraitSelect.hidden = !portrait || state.mode !== 'select';
    audioControls.hidden = portrait && state.mode === 'select';
    portraitHud.hidden = !portrait || !player || state.mode === 'select';
    portraitOverlay.hidden = !portrait || !(state.mode === 'paused' || state.mode === 'victory' || dead);
    touchControls.hidden = !isTouchCapable() || state.mode !== 'play' || dead;
    touchControls.querySelectorAll('button').forEach(button => { button.disabled = state.mode === 'paused'; });
    portraitRoster.querySelectorAll('button').forEach((button, i) => { button.setAttribute('aria-pressed', String(i === state.selectedHero)); });
    if (!portrait || !player) return;
    const setText = (id, value) => { const node = document.getElementById(id); if (node.textContent !== value) node.textContent = value; };
    setText('portrait-hero', player.hero.name);
    setText('portrait-wave', `${state.waveLabel} · ${String(state.score).padStart(6, '0')}`);
    setText('portrait-health-text', `HP ${Math.ceil(player.health)}/${player.maxHealth}`);
    setText('portrait-meter-text', `SP ${Math.floor(player.meter)}/100`);
    const health = document.getElementById('portrait-health'); health.max = player.maxHealth; health.value = player.health;
    document.getElementById('portrait-meter').value = player.meter;
    const paused = state.mode === 'paused';
    document.getElementById('portrait-pause').disabled = state.mode !== 'play' || dead;
    document.getElementById('portrait-resume').hidden = !paused;
    setText('portrait-overlay-title', paused ? 'PAUSED' : dead ? 'DOWN FOR THE COUNT' : 'STREET CLEARED');
    setText('portrait-overlay-copy', paused ? 'Tap RESUME or the street to continue.' : dead ? 'Choose RESTART for another run.' : 'You made it through the rough side of town.');
    setText('portrait-overlay-score', `SCORE ${String(state.score).padStart(6, '0')}`);
    portraitOverlay.style.setProperty('--overlay-accent', paused ? '#62e8ff' : dead ? '#ff727a' : '#ffd447');
  }

  function renderGameToText() {
    const player = state.player;
    return JSON.stringify({
      coordinateSystem: 'origin is the upper-left; x increases right, y increases down; player y is the ground contact point',
      mode: state.mode,
      view: { portrait, width: W, height: H },
      selectedHero: HEROES[state.selectedHero]?.name || null,
      player: player ? { x: Math.round(player.x), y: Math.round(player.y), health: Math.round(player.health), meter: Math.round(player.meter), state: player.state, action: player.action || null, dodgeCooldown: Number(player.dodgeCooldown.toFixed(2)) } : null,
      enemies: activeEnemies().map((enemy) => ({ id: enemy.id, x: Math.round(enemy.x), y: Math.round(enemy.y), health: Math.round(enemy.health), type: enemy.type, boss: enemy.boss, state: enemy.state, tell: enemy.state === 'windup' ? { label: ENEMY_ATTACKS[enemy.type].label, target: enemy.target, remaining: Number(Math.max(0, ENEMY_ATTACKS[enemy.type].windup - enemy.actionTime).toFixed(2)) } : null })),
      projectiles: state.projectiles.map(bottle => ({ type: 'bottle', x: Math.round(bottle.x), y: Math.round(bottle.y), target: bottle.target, remaining: Number(Math.max(0, bottle.duration - bottle.elapsed).toFixed(2)), hitRadius: { x: 46, y: 26 } })),
      lastProjectileImpact: state.lastProjectileImpact,
      wave: state.wave,
      queuedEnemies: state.spawnQueue.length,
      spawnCap: state.spawnBatchSize,
      score: state.score,
      cameraX: Math.round(state.cameraX),
      goSignal: state.goTimer > 0,
      bossDefeated: state.bossDefeated,
      hitStop: Number(state.hitStop.toFixed(3)),
      lastImpact: state.lastImpact,
      audio: { supported: audio.supported, muted: audio.muted, volume: Number(audio.volume.toFixed(2)) },
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = (ms) => {
    deterministic = true;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      updateGame(1 / 60);
      pressedActions.clear();
    }
    render();
    return renderGameToText();
  };

  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp, { passive: false });
  canvas.addEventListener('pointerdown', handleCanvasPointer, { passive: false });
  document.querySelectorAll('#touch-controls button').forEach(touchBind);
  audioMute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (!audio.muted) audio.ensureContext();
    audio.save();
    audio.syncUi();
  });
  audioToggle.addEventListener('click', () => {
    if (audio.expanded) audio.collapse(); else audio.expand();
  });
  audioVolume.addEventListener('input', (event) => {
    audio.volume = clamp(Number(event.target.value), 0, 1);
    if (audio.master) audio.master.gain.setTargetAtTime(audio.volume, audio.context.currentTime, 0.015);
    audio.save();
    audio.syncUi();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!audioControls.contains(event.target)) audio.collapse();
  }, { passive: true });
  window.addEventListener('blur', suspendInput);
  window.addEventListener('focus', () => { inputSuspended = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendInput(); else inputSuspended = false;
  });
  document.addEventListener('focusin', (event) => {
    if (isInteractiveTarget(event.target)) clearInput();
  });
  audio.init();
  updateLayout();
  new ResizeObserver(updateLayout).observe(stage);
  window.addEventListener('resize', updateLayout);

  function loop(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (!deterministic) updateGame(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  loadAssets();
})();
