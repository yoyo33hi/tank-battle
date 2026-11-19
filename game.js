/* ============================================================================
   TANK BATTLE — a Battle City homage
   Vanilla JS + Canvas 2D. No assets, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     Constants
     -------------------------------------------------------------------------- */
  const TILE = 24;
  const COLS = 26;
  const ROWS = 26;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const TS = 48;                  // tank size (2 x 2 tiles)
  const HALF = TILE / 2;
  const STEP = 1 / 60;

  const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, GRASS: 4 };

  const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const OPP = [DOWN, LEFT, UP, RIGHT];
  const ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

  const PLAYER_SPAWN = { x: 8 * TILE, y: 24 * TILE };
  const BASE = { x: 12 * TILE, y: 24 * TILE, w: TS, h: TS };
  const ENEMY_SPAWNS = [
    { x: 0, y: 0 },
    { x: 12 * TILE, y: 0 },
    { x: 24 * TILE, y: 0 },
  ];
  const FORT_CELLS = [
    [11, 23], [12, 23], [13, 23], [14, 23],
    [11, 24], [11, 25], [14, 24], [14, 25],
  ];

  const ENEMY_STATS = {
    basic: { speed: 58, bulletSpeed: 235, hp: 1, score: 100, fire: 1.8 },
    fast: { speed: 108, bulletSpeed: 250, hp: 1, score: 200, fire: 2.0 },
    power: { speed: 68, bulletSpeed: 365, hp: 1, score: 300, fire: 1.25 },
    armor: { speed: 64, bulletSpeed: 265, hp: 4, score: 400, fire: 1.6 },
  };

  const STYLE = {
    player: { hull: '#8ce86d', light: '#d6ffbc', dark: '#3f7a2e', tread: '#1f3a1a' },
    basic: { hull: '#aeb9ca', light: '#eef4ff', dark: '#5a6678', tread: '#2a313b' },
    fast: { hull: '#f2a94f', light: '#ffd99b', dark: '#8a5520', tread: '#38280f' },
    power: { hull: '#b98cf0', light: '#e6d2ff', dark: '#6c469e', tread: '#2b1f3c' },
    armor: { hull: '#7fb2e5', light: '#d5eaff', dark: '#3f6488', tread: '#1e2b39' },
    bonus: { hull: '#ff6a5f', light: '#ffd0ca', dark: '#8f2d26', tread: '#331210' },
  };

  const ARMOR_STYLES = [
    { hull: '#7fb2e5', light: '#d5eaff', dark: '#3f6488', tread: '#1e2b39' },
    { hull: '#dfcb7d', light: '#fff0bd', dark: '#80702f', tread: '#2f2a14' },
    { hull: '#f0a05e', light: '#ffd7b5', dark: '#8a4f24', tread: '#33200f' },
    { hull: '#ec7f7f', light: '#ffc4c4', dark: '#8a3f3f', tread: '#331919' },
  ];

  const POWER_NAMES = {
    star: 'POWER UP',
    helmet: 'SHIELD',
    grenade: 'AIR STRIKE',
    shovel: 'FORTIFIED',
    tank: 'EXTRA TANK',
    clock: 'FREEZE',
  };

  /* --------------------------------------------------------------------------
     DOM
     -------------------------------------------------------------------------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlayEl = document.getElementById('overlay');
  const bannerEl = document.getElementById('banner');
  const hudScore = document.getElementById('hudScore');
  const hudStage = document.getElementById('hudStage');
  const hudLives = document.getElementById('hudLives');
  const hudEnemies = document.getElementById('hudEnemies');
  const hudPower = document.getElementById('hudPower');
  const btnMute = document.getElementById('btnMute');
  const btnPause = document.getElementById('btnPause');

  /* --------------------------------------------------------------------------
     State
     -------------------------------------------------------------------------- */
  const G = {
    state: 'menu',
    time: 0,
    stage: 1,
    score: 0,
    best: 0,
    lives: 2,
    power: 1,
    player: null,
    baseAlive: true,
    killed: 0,
    total: 20,
    toSpawn: 20,
    spawned: 0,
    spawnTimer: 1,
    spawnIdx: 0,
    maxField: 4,
    respawn: 0,
    fortTimer: 0,
    freezeTimer: 0,
    shake: 0,
    stageTimer: 0,
    stageDone: false,
    endReason: '',
  };

  const tiles = new Uint8Array(COLS * ROWS);
  const brickQ = new Uint8Array(COLS * ROWS);

  let tanks = [];
  let bullets = [];
  let powerups = [];
  let effects = [];
  let particles = [];

  let seed = 1;
  let lastHudKey = '';
  let bannerTimer = 0;

  /* --------------------------------------------------------------------------
     Small helpers
     -------------------------------------------------------------------------- */
  const tileIndex = (gx, gy) => gy * COLS + gx;

  function pad(n) {
    return String(Math.max(0, n | 0)).padStart(6, '0');
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function starPath(g, cx, cy, outer, inner, points) {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  /* --------------------------------------------------------------------------
     Sprites (pre-rendered once)
     -------------------------------------------------------------------------- */
  const sprites = { brick: [], water: [], grass: null, steel: null, base: null, baseDead: null };

  function makeBrickSprite(mask) {
    const c = makeCanvas(TILE, TILE);
    const g = c.getContext('2d');
    for (let q = 0; q < 4; q++) {
      if (!(mask & (1 << q))) continue;
      const qx = (q & 1) * HALF;
      const qy = (q >> 1) * HALF;
      g.save();
      g.beginPath();
      g.rect(qx, qy, HALF, HALF);
      g.clip();
      g.translate(qx, qy);
      g.fillStyle = '#c39a72';
      g.fillRect(0, 0, HALF, HALF);
      for (let row = 0; row < 2; row++) {
        const yy = row * 6;
        const off = row ? 3 : 0;
        for (let bx = -1; bx < 3; bx++) {
          const xx = bx * 6 + off;
          g.fillStyle = '#a84a1d';
          g.fillRect(xx, yy, 5, 5);
          g.fillStyle = '#d1692e';
          g.fillRect(xx, yy, 5, 1);
          g.fillStyle = '#7d3510';
          g.fillRect(xx, yy + 4, 5, 1);
        }
      }
      g.fillStyle = 'rgba(40, 16, 4, 0.22)';
      g.fillRect(0, HALF - 1, HALF, 1);
      g.fillRect(HALF - 1, 0, 1, HALF);
      g.restore();
    }
    return c;
  }

  function makeSteelSprite() {
    const c = makeCanvas(TILE, TILE);
    const g = c.getContext('2d');
    g.fillStyle = '#38414e';
    g.fillRect(0, 0, TILE, TILE);
    for (let q = 0; q < 4; q++) {
      const x = (q & 1) * 12;
      const y = (q >> 1) * 12;
      g.fillStyle = '#6d7c92';
      g.fillRect(x + 1, y + 1, 10, 10);
      g.fillStyle = '#a3b4cb';
      g.fillRect(x + 1, y + 1, 10, 2);
      g.fillRect(x + 1, y + 1, 2, 10);
      g.fillStyle = '#4b5768';
      g.fillRect(x + 1, y + 9, 10, 2);
      g.fillRect(x + 9, y + 1, 2, 10);
      g.fillStyle = '#d9e5f4';
      g.fillRect(x + 2, y + 2, 2, 2);
    }
    return c;
  }

  function makeWaterSprite(frame) {
    const c = makeCanvas(TILE, TILE);
    const g = c.getContext('2d');
    g.fillStyle = '#0d2c4a';
    g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      const y = 3 + i * 6 + Math.sin((frame + i) * 1.3) * 1.5;
      g.fillStyle = i % 2 ? '#1d5d8f' : '#164a75';
      g.fillRect(0, y, TILE, 2);
    }
    g.fillStyle = 'rgba(160, 220, 255, 0.35)';
    const sx = ((frame * 7 + 5) % 20) + 2;
    g.fillRect(sx, 4 + ((frame * 3) % 9), 3, 1);
    g.fillRect((sx + 11) % 21, 15, 2, 1);
    return c;
  }

  function makeGrassSprite(variant) {
    const c = makeCanvas(TILE, TILE);
    const g = c.getContext('2d');
    let s = 987654321 + variant * 7919;
    const r = () => {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return s / 4294967296;
    };
    const cols = ['#1e4a26', '#2a6a33', '#3a8a41', '#4fa653'];
    for (let i = 0; i < 30; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      const rad = 2 + r() * 4.2;
      g.fillStyle = cols[(i + variant) % cols.length];
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  function makeBaseSprite(dead) {
    const c = makeCanvas(TS, TS);
    const g = c.getContext('2d');

    // stone platform
    g.fillStyle = '#20242c';
    g.fillRect(3, 33, 42, 12);
    g.fillStyle = '#343b47';
    g.fillRect(3, 33, 42, 3);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#2a303a' : '#242a33';
      g.fillRect(4 + i * 10, 37, 9, 8);
    }

    if (dead) {
      g.fillStyle = '#3a3f48';
      g.fillRect(8, 23, 13, 11);
      g.fillRect(27, 26, 11, 8);
      g.fillStyle = '#4a505b';
      g.fillRect(18, 16, 9, 8);
      g.fillStyle = '#22262d';
      g.fillRect(12, 30, 26, 4);
      g.fillStyle = '#6c7480';
      g.beginPath();
      g.moveTo(24, 20);
      g.lineTo(12, 30);
      g.lineTo(22, 30);
      g.closePath();
      g.fill();
      return c;
    }

    // eagle
    g.fillStyle = '#e9ddb8';
    g.beginPath();
    g.moveTo(24, 15);
    g.lineTo(4, 7);
    g.lineTo(10, 27);
    g.lineTo(21, 27);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(24, 15);
    g.lineTo(44, 7);
    g.lineTo(38, 27);
    g.lineTo(27, 27);
    g.closePath();
    g.fill();

    g.beginPath();
    g.moveTo(24, 9);
    g.lineTo(30, 22);
    g.lineTo(28, 33);
    g.lineTo(20, 33);
    g.lineTo(18, 22);
    g.closePath();
    g.fill();

    // wing shading
    g.fillStyle = '#bfae7f';
    g.beginPath();
    g.moveTo(24, 16);
    g.lineTo(8, 10);
    g.lineTo(12, 25);
    g.lineTo(21, 26);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(24, 16);
    g.lineTo(40, 10);
    g.lineTo(36, 25);
    g.lineTo(27, 26);
    g.closePath();
    g.fill();

    // head / beak / eye
    g.fillStyle = '#f3ebd2';
    g.beginPath();
    g.arc(24, 10, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffb020';
    g.beginPath();
    g.moveTo(24, 10);
    g.lineTo(24, 15.5);
    g.lineTo(20, 12.5);
    g.closePath();
    g.fill();
    g.fillStyle = '#141821';
    g.fillRect(22, 8, 2, 2);
    return c;
  }

  function buildSprites() {
    sprites.brick = [];
    for (let m = 0; m < 16; m++) sprites.brick.push(makeBrickSprite(m));
    sprites.steel = makeSteelSprite();
    sprites.water = [0, 1, 2].map(makeWaterSprite);
    sprites.grass = [0, 1, 2].map(makeGrassSprite);
    sprites.base = makeBaseSprite(false);
    sprites.baseDead = makeBaseSprite(true);
  }

  /* --------------------------------------------------------------------------
     Level construction
     -------------------------------------------------------------------------- */
  function pickBlockKind(stage) {
    const r = rand();
    const brick = 0.46;
    const steel = 0.08 + Math.min(0.12, stage * 0.01);
    const water = 0.09;
    const grass = 0.10;
    if (r < brick) return 'brick';
    if (r < brick + steel) return 'steel';
    if (r < brick + steel + water) return 'water';
    if (r < brick + steel + water + grass) return 'grass';
    return 'empty';
  }

  function paintBlock(x, y, kind) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const i = tileIndex(x + dx, y + dy);
        switch (kind) {
          case 'brick':
            tiles[i] = T.BRICK;
            brickQ[i] = 15;
            break;
          case 'steel':
            tiles[i] = T.STEEL;
            brickQ[i] = 0;
            break;
          case 'water':
            tiles[i] = T.WATER;
            brickQ[i] = 0;
            break;
          case 'grass':
            tiles[i] = T.GRASS;
            brickQ[i] = 0;
            break;
          default:
            tiles[i] = T.EMPTY;
            brickQ[i] = 0;
        }
      }
    }
  }

  function clearArea(gx, gy, w, h) {
    for (let y = gy; y < gy + h; y++) {
      for (let x = gx; x < gx + w; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const i = tileIndex(x, y);
        tiles[i] = T.EMPTY;
        brickQ[i] = 0;
      }
    }
  }

  function setFort(type) {
    for (const cell of FORT_CELLS) {
      const i = tileIndex(cell[0], cell[1]);
      tiles[i] = type;
      brickQ[i] = type === T.BRICK ? 15 : 0;
    }
  }

  function buildStage(stage) {
    G.stage = stage;
    seed = (Math.imul(stage, 2654435761) ^ 0x9e3779b9) >>> 0;

    tiles.fill(T.EMPTY);
    brickQ.fill(0);

    const blockXs = [2, 6, 10, 14, 18, 22];
    for (let row = 0; row < 6; row++) {
      const by = 2 + row * 4;
      for (let i = 0; i < 3; i++) {
        const kind = pickBlockKind(stage);
        paintBlock(blockXs[i], by, kind);
        paintBlock(blockXs[5 - i], by, kind);
      }
    }

    // Grass in the corridors for concealment.
    for (let gy = 2; gy < 23; gy++) {
      for (let gx = 2; gx < COLS - 2; gx++) {
        if (tiles[tileIndex(gx, gy)] !== T.EMPTY) continue;
        if (rand() < 0.045) tiles[tileIndex(gx, gy)] = T.GRASS;
      }
    }

    // Spawn pads and player lane stay clean.
    clearArea(0, 0, 4, 2);
    clearArea(11, 0, 4, 2);
    clearArea(22, 0, 4, 2);
    clearArea(6, 24, 4, 2);
    clearArea(12, 24, 2, 2);

    // Base fortification.
    setFort(T.BRICK);

    tanks = [];
    bullets = [];
    powerups = [];
    effects = [];
    particles = [];

    G.player = null;
    G.baseAlive = true;
    G.killed = 0;
    G.total = 20;
    G.toSpawn = 20;
    G.spawned = 0;
    G.spawnTimer = 1.0;
    G.spawnIdx = 0;
    G.maxField = Math.min(6, 3 + Math.ceil(stage / 2));
    G.fortTimer = 0;
    G.freezeTimer = 0;
    G.respawn = 0;
    G.stageDone = false;
    G.shake = 0;
  }

  /* --------------------------------------------------------------------------
     Collision helpers
     -------------------------------------------------------------------------- */
  function rectHitsSolid(x, y, w, h) {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return true;
    const gx0 = Math.floor(x / TILE);
    const gx1 = Math.floor((x + w - 0.01) / TILE);
    const gy0 = Math.floor(y / TILE);
    const gy1 = Math.floor((y + h - 0.01) / TILE);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const tt = tiles[tileIndex(gx, gy)];
        if (tt === T.BRICK || tt === T.STEEL || tt === T.WATER) return true;
      }
    }
    return false;
  }

  function canTankBe(t, x, y) {
    if (rectHitsSolid(x, y, TS, TS)) return false;
    if (G.baseAlive && rectOverlap(x, y, TS, TS, BASE.x, BASE.y, BASE.w, BASE.h)) return false;
    for (const o of tanks) {
      if (o === t || o.dead) continue;
      if (rectOverlap(x, y, TS, TS, o.x, o.y, o.w, o.h)) return false;
    }
    return true;
  }

  function isAreaFree(x, y, w, h) {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    const gx0 = Math.floor(x / TILE);
    const gx1 = Math.floor((x + w - 0.01) / TILE);
    const gy0 = Math.floor(y / TILE);
    const gy1 = Math.floor((y + h - 0.01) / TILE);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const tt = tiles[tileIndex(gx, gy)];
        if (tt === T.BRICK || tt === T.STEEL || tt === T.WATER) return false;
      }
    }
    if (G.baseAlive && rectOverlap(x, y, w, h, BASE.x, BASE.y, BASE.w, BASE.h)) return false;
    for (const t of tanks) {
      if (!t.dead && rectOverlap(x, y, w, h, t.x, t.y, t.w, t.h)) return false;
    }
    return true;
  }

  /* --------------------------------------------------------------------------
     Tanks
     -------------------------------------------------------------------------- */
  class Tank {
    constructor(opts) {
      this.x = opts.x;
      this.y = opts.y;
      this.w = TS;
      this.h = TS;
      this.dir = opts.dir === undefined ? UP : opts.dir;
      this.speed = opts.speed === undefined ? 60 : opts.speed;
      this.bulletSpeed = opts.bulletSpeed === undefined ? 240 : opts.bulletSpeed;
      this.maxBullets = opts.maxBullets === undefined ? 1 : opts.maxBullets;
      this.hp = opts.hp === undefined ? 1 : opts.hp;
      this.maxHp = this.hp;
      this.isPlayer = !!opts.isPlayer;
      this.type = opts.type || 'basic';
      this.isBonus = !!opts.isBonus;
      this.cooldown = 0;
      this.fireInterval = opts.fireInterval === undefined ? 1.6 : opts.fireInterval;
      this.shield = opts.shield === undefined ? 0 : opts.shield;
      this.spawnAnim = opts.spawnAnim === undefined ? 0 : opts.spawnAnim;
      this.think = 0.2;
      this.power = opts.power === undefined ? 1 : opts.power;
      this.dead = false;
      this.tread = 0;
      this.flash = 0;
      this.moving = false;
    }

    get cx() { return this.x + TS / 2; }
    get cy() { return this.y + TS / 2; }
  }

  /* --------------------------------------------------------------------------
     Player
     -------------------------------------------------------------------------- */
  function spawnPlayer() {
    if (!isAreaFree(PLAYER_SPAWN.x, PLAYER_SPAWN.y, TS, TS)) return false;
    const p = new Tank({
      x: PLAYER_SPAWN.x,
      y: PLAYER_SPAWN.y,
      dir: UP,
      isPlayer: true,
      speed: 108,
      bulletSpeed: 300,
      maxBullets: 1,
      shield: 3,
    });
    applyPower(p);
    tanks.push(p);
    G.player = p;
    return true;
  }

  function applyPower(p) {
    p.power = G.power;
    p.bulletSpeed = G.power >= 2 ? 420 : 300;
    p.maxBullets = G.power >= 3 ? 2 : 1;
  }

  function moveTank(t, dt) {
    let remain = t.speed * dt;
    let moved = false;
    while (remain > 0.0001) {
      const step = Math.min(remain, 5);
      const nx = t.x + DX[t.dir] * step;
      const ny = t.y + DY[t.dir] * step;
      if (!canTankBe(t, nx, ny)) break;
      t.x = nx;
      t.y = ny;
      moved = true;
      remain -= step;
    }
    if (moved) t.tread += dt * 11;
    return moved;
  }

  function shoot(t) {
    let active = 0;
    for (const b of bullets) {
      if (b.owner === t && !b.dead) active++;
    }
    if (active >= t.maxBullets) return;
    bullets.push({
      x: t.cx + DX[t.dir] * 24 - 4,
      y: t.cy + DY[t.dir] * 24 - 4,
      w: 8,
      h: 8,
      dir: t.dir,
      speed: t.bulletSpeed,
      power: t.power,
      owner: t,
      fromPlayer: t.isPlayer,
      dead: false,
    });
    t.cooldown = t.isPlayer ? 0.3 : t.fireInterval * (0.8 + Math.random() * 0.6);
    Sfx.shoot(t.isPlayer);
  }

  function updateTank(t, dt) {
    if (t.flash > 0) t.flash -= dt;
    if (t.spawnAnim > 0) {
      t.spawnAnim -= dt;
      return;
    }
    if (t.shield > 0) t.shield -= dt;
    t.cooldown -= dt;

    if (t.isPlayer) {
      const d = Input.dir();
      if (d >= 0) {
        t.dir = d;
        t.moving = moveTank(t, dt);
      } else {
        t.moving = false;
      }
      if (Input.fire()) shoot(t);
      return;
    }

    if (G.freezeTimer > 0) {
      t.moving = false;
      return;
    }

    const moved = moveTank(t, dt);
    t.moving = moved;
    t.think -= dt;
    if (!moved || t.think <= 0) chooseDir(t);

    if (t.cooldown <= 0) {
      const target = pickTarget();
      const aligned =
        Math.abs(target.x - t.cx) < 26 || Math.abs(target.y - t.cy) < 26;
      if (Math.random() < (aligned ? 0.85 : 0.32)) {
        shoot(t);
      } else {
        t.cooldown = 0.45 + Math.random() * 0.7;
      }
    }
  }

  function pickTarget() {
    if (G.player && Math.random() < 0.35) {
      return { x: G.player.cx, y: G.player.cy };
    }
    return { x: BASE.x + TS / 2, y: BASE.y + TS / 2 };
  }

  function chooseDir(t) {
    const valid = [];
    for (let d = 0; d < 4; d++) {
      if (canTankBe(t, t.x + DX[d] * 6, t.y + DY[d] * 6)) valid.push(d);
    }
    if (valid.length === 0) {
      t.dir = OPP[t.dir];
      t.think = 0.3;
      return;
    }
    const target = pickTarget();
    const dx = target.x - t.cx;
    const dy = target.y - t.cy;
    const pref = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP);
    let pool = valid.filter((d) => d !== OPP[t.dir]);
    if (pool.length === 0) pool = valid;
    if (valid.indexOf(pref) !== -1 && Math.random() < 0.62) {
      t.dir = pref;
    } else {
      t.dir = pool[(Math.random() * pool.length) | 0];
    }
    t.think = 0.35 + Math.random() * 1.1;
  }

  /* --------------------------------------------------------------------------
     Enemies
     -------------------------------------------------------------------------- */
  function randEnemyType(stage) {
    const r = Math.random() + Math.min(0.35, stage * 0.03);
    if (r > 1.34) return 'armor';
    if (r > 1.06) return 'power';
    if (r > 0.78) return 'fast';
    return 'basic';
  }

  function spawnEnemies() {
    if (G.toSpawn <= 0) return;
    let field = 0;
    for (const t of tanks) {
      if (!t.isPlayer && !t.dead) field++;
    }
    if (field >= G.maxField) return;
    if (G.spawnTimer > 0) return;

    for (let k = 0; k < ENEMY_SPAWNS.length; k++) {
      const idx = (G.spawnIdx + k) % ENEMY_SPAWNS.length;
      const sp = ENEMY_SPAWNS[idx];
      if (!isAreaFree(sp.x, sp.y, TS, TS)) continue;
      G.spawnIdx = (idx + 1) % ENEMY_SPAWNS.length;
      createEnemy(sp);
      return;
    }
    G.spawnTimer = 0.4;
  }

  function createEnemy(sp) {
    const type = randEnemyType(G.stage);
    const stats = ENEMY_STATS[type];
    const bonus = G.spawned % 4 === 3;
    G.spawned++;
    G.toSpawn--;
    G.spawnTimer = 1.0 + Math.random() * 0.9;

    tanks.push(new Tank({
      x: sp.x,
      y: sp.y,
      dir: DOWN,
      speed: stats.speed,
      bulletSpeed: stats.bulletSpeed,
      hp: stats.hp,
      maxBullets: 1,
      fireInterval: stats.fire,
      type,
      isBonus: bonus,
      spawnAnim: 0.9,
    }));
  }

  /* --------------------------------------------------------------------------
     Bullets
     -------------------------------------------------------------------------- */
  function updateBullets(dt) {
    for (const b of bullets) {
      if (b.dead) continue;
      const dist = b.speed * dt;
      const steps = Math.max(1, Math.ceil(dist / 5));
      for (let s = 0; s < steps && !b.dead; s++) {
        b.x += (DX[b.dir] * dist) / steps;
        b.y += (DY[b.dir] * dist) / steps;
        bulletCollide(b);
      }
    }

    // Player bullets shoot down enemy bullets.
    for (let i = 0; i < bullets.length; i++) {
      for (let j = i + 1; j < bullets.length; j++) {
        const a = bullets[i];
        const b = bullets[j];
        if (a.dead || b.dead || a.fromPlayer === b.fromPlayer) continue;
        if (overlap(a, b)) {
          a.dead = true;
          b.dead = true;
          spark((a.x + b.x) / 2 + 4, (a.y + b.y) / 2 + 4);
        }
      }
    }

    bullets = bullets.filter((b) => !b.dead);
  }

  function bulletCollide(b) {
    if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H) {
      b.dead = true;
      spark(b.x + 4, b.y + 4);
      return;
    }

    const gx0 = Math.floor(b.x / TILE);
    const gx1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const gy0 = Math.floor(b.y / TILE);
    const gy1 = Math.floor((b.y + b.h - 0.01) / TILE);

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const i = tileIndex(gx, gy);
        const tt = tiles[i];
        if (tt === T.BRICK) {
          damageBrick(b, gx, gy);
          return;
        }
        if (tt === T.STEEL) {
          b.dead = true;
          if (b.power >= 3) {
            tiles[i] = T.EMPTY;
            brickQ[i] = 0;
            explode(gx * TILE + 12, gy * TILE + 12, 'small');
          } else {
            spark(b.x + 4, b.y + 4);
            Sfx.hitSteel();
          }
          return;
        }
      }
    }

    if (G.baseAlive && overlap(b, BASE)) {
      b.dead = true;
      // Only enemy fire can bring down the eagle — no accidental self-destruction.
      if (!b.fromPlayer) destroyBase();
      else spark(b.x + 4, b.y + 4);
      return;
    }

    for (const t of tanks) {
      if (t.dead || t === b.owner || t.spawnAnim > 0) continue;
      if (t.isPlayer === b.fromPlayer) continue;
      if (overlap(b, t)) {
        b.dead = true;
        hitTank(t, b);
        return;
      }
    }
  }

  function damageBrick(b, gx, gy) {
    const i = tileIndex(gx, gy);
    let rx = b.x;
    let ry = b.y;
    let rw = b.w;
    let rh = b.h;
    const pad = 10;
    if (b.dir === UP) { ry -= pad; rh += pad; }
    else if (b.dir === DOWN) { rh += pad; }
    else if (b.dir === LEFT) { rx -= pad; rw += pad; }
    else { rw += pad; }

    let mask = 0;
    for (let q = 0; q < 4; q++) {
      const qx = gx * TILE + (q & 1) * HALF;
      const qy = gy * TILE + (q >> 1) * HALF;
      if (rx < qx + HALF && rx + rw > qx && ry < qy + HALF && ry + rh > qy) {
        mask |= 1 << q;
      }
    }
    if (!mask) mask = 15;

    brickQ[i] &= ~mask;
    if (brickQ[i] === 0) tiles[i] = T.EMPTY;

    b.dead = true;
    Sfx.hitBrick();
    for (let k = 0; k < 5; k++) {
      particles.push({
        x: b.x + 4,
        y: b.y + 4,
        vx: (Math.random() - 0.5) * 170,
        vy: (Math.random() - 0.5) * 170 - 30,
        life: 0.3 + Math.random() * 0.3,
        max: 0.6,
        size: 2 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#c96a2c' : '#e08a45',
      });
    }
  }

  function hitTank(t, b) {
    if (t.isPlayer) {
      if (t.shield > 0) {
        spark(b.x + 4, b.y + 4);
        return;
      }
      killPlayer();
      return;
    }
    t.hp -= 1;
    t.flash = 0.14;
    if (t.hp <= 0) {
      killEnemy(t);
    } else {
      Sfx.armorHit();
      spark(b.x + 4, b.y + 4);
    }
  }

  function killEnemy(t) {
    if (t.dead) return;
    t.dead = true;
    const stats = ENEMY_STATS[t.type] || ENEMY_STATS.basic;
    G.score += stats.score;
    G.killed++;
    explode(t.cx, t.cy, 'big');
    Sfx.enemyDeath();
    if (t.isBonus || Math.random() < 0.05) dropPowerup();
    updateHud();
  }

  function killPlayer() {
    const p = G.player;
    if (!p) return;
    explode(p.cx, p.cy, 'big');
    Sfx.playerDeath();
    p.dead = true;
    G.player = null;
    G.power = Math.max(1, G.power - 1);
    G.lives -= 1;
    G.shake = 14;
    if (G.lives < 0) {
      G.state = 'dying';
      G.stageTimer = 1.4;
      G.endReason = 'ALL TANKS LOST';
    } else {
      G.respawn = 1.4;
    }
    updateHud();
  }

  function destroyBase() {
    if (!G.baseAlive) return;
    G.baseAlive = false;
    explode(BASE.x + TS / 2, BASE.y + TS / 2, 'huge');
    explode(BASE.x + 8, BASE.y + 32, 'big');
    explode(BASE.x + TS - 8, BASE.y + 30, 'big');
    Sfx.baseDeath();
    G.state = 'dying';
    G.stageTimer = 1.8;
    G.endReason = 'THE EAGLE HAS FALLEN';
    updateHud();
  }

  /* --------------------------------------------------------------------------
     Power-ups
     -------------------------------------------------------------------------- */
  function dropPowerup() {
    if (powerups.length > 0) return;
    const types = ['star', 'star', 'helmet', 'grenade', 'shovel', 'tank', 'clock'];
    for (let tries = 0; tries < 100; tries++) {
      const gx = 1 + ((Math.random() * (COLS - 3)) | 0);
      const gy = 1 + ((Math.random() * (ROWS - 4)) | 0);
      const x = gx * TILE;
      const y = gy * TILE;
      if (x + TS > W || y + TS > H) continue;
      if (!isAreaFree(x, y, TS, TS)) continue;
      powerups.push({
        x,
        y,
        type: types[(Math.random() * types.length) | 0],
        life: 20,
        dead: false,
      });
      return;
    }
  }

  function updatePowerups(dt) {
    for (const p of powerups) {
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      if (G.player && overlap({ x: p.x, y: p.y, w: TS, h: TS }, G.player)) {
        p.dead = true;
        collectPowerup(p.type);
      }
    }
    powerups = powerups.filter((p) => !p.dead);
  }

  function collectPowerup(type) {
    G.score += 500;
    Sfx.powerup();
    banner(POWER_NAMES[type] || 'POWER UP', 900);
    switch (type) {
      case 'star':
        G.power = Math.min(3, G.power + 1);
        if (G.player) applyPower(G.player);
        break;
      case 'helmet':
        if (G.player) G.player.shield = 10;
        break;
      case 'grenade':
        for (const t of tanks) {
          if (t.isPlayer || t.dead) continue;
          t.dead = true;
          G.killed++;
          G.score += 200;
          explode(t.cx, t.cy, 'big');
        }
        Sfx.enemyDeath();
        break;
      case 'shovel':
        setFort(T.STEEL);
        G.fortTimer = 15;
        break;
      case 'tank':
        G.lives += 1;
        break;
      case 'clock':
        G.freezeTimer = 8;
        break;
    }
    updateHud();
  }

  /* --------------------------------------------------------------------------
     Effects
     -------------------------------------------------------------------------- */
  function explode(x, y, kind) {
    const huge = kind === 'huge';
    const big = kind === 'big' || huge;
    const size = huge ? 92 : big ? 52 : 24;
    effects.push({
      x,
      y,
      t: 0,
      dur: huge ? 0.9 : big ? 0.6 : 0.34,
      size,
    });
    const count = huge ? 26 : big ? 16 : 7;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * (huge ? 240 : big ? 165 : 95);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.5,
        max: 0.8,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.55 ? '#ffcf7a' : '#ff8a4c',
      });
    }
    G.shake = Math.max(G.shake, huge ? 20 : big ? 9 : 3);
    Sfx.explosion(huge);
  }

  function spark(x, y) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 190,
        vy: (Math.random() - 0.5) * 190,
        life: 0.12 + Math.random() * 0.16,
        max: 0.28,
        size: 2,
        color: '#fff3c4',
      });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  function updateEffects(dt) {
    for (const e of effects) e.t += dt;
    effects = effects.filter((e) => e.t < e.dur);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vy += 70 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  /* --------------------------------------------------------------------------
     World update
     -------------------------------------------------------------------------- */
  function updateWorld(dt) {
    G.spawnTimer -= dt;
    spawnEnemies();

    if (G.player) updateTank(G.player, dt);
    for (const t of tanks) {
      if (!t.isPlayer && !t.dead) updateTank(t, dt);
    }

    updateBullets(dt);
    updatePowerups(dt);

    if (G.fortTimer > 0) {
      G.fortTimer -= dt;
      if (G.fortTimer <= 0 && G.baseAlive) setFort(T.BRICK);
    }
    if (G.freezeTimer > 0) G.freezeTimer = Math.max(0, G.freezeTimer - dt);

    if (!G.player && G.respawn > 0) {
      G.respawn -= dt;
      if (G.respawn <= 0 && !spawnPlayer()) G.respawn = 0.4;
    }

    tanks = tanks.filter((t) => !t.dead);

    if (G.state === 'playing' && !G.stageDone && G.killed >= G.total) {
      G.stageDone = true;
      G.state = 'stageclear';
      G.stageTimer = 2.6;
      G.score += 1000 + G.stage * 100;
      banner('STAGE ' + G.stage + ' CLEAR', 2200);
      Sfx.stageClear();
      updateHud();
    }
  }

  /* --------------------------------------------------------------------------
     Input
     -------------------------------------------------------------------------- */
  const Input = (() => {
    const held = [];
    let fireHeld = false;
    const keymap = {
      ArrowUp: UP,
      KeyW: UP,
      ArrowRight: RIGHT,
      KeyD: RIGHT,
      ArrowDown: DOWN,
      KeyS: DOWN,
      ArrowLeft: LEFT,
      KeyA: LEFT,
    };

    return {
      keymap,
      dir() {
        return held.length ? held[held.length - 1] : -1;
      },
      fire() {
        return fireHeld;
      },
      setFire(v) {
        fireHeld = v;
      },
      press(d) {
        if (held.indexOf(d) === -1) held.push(d);
      },
      release(d) {
        const i = held.indexOf(d);
        if (i !== -1) held.splice(i, 1);
      },
      reset() {
        held.length = 0;
        fireHeld = false;
      },
    };
  })();

  /* --------------------------------------------------------------------------
     Audio
     -------------------------------------------------------------------------- */
  const Sfx = (() => {
    let ac = null;
    let gain = null;
    let noiseBuf = null;
    let muted = false;
    try {
      muted = localStorage.getItem('tb.muted') === '1';
    } catch (err) { /* ignore */ }

    function ensure() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        gain = ac.createGain();
        gain.gain.value = 0.22;
        gain.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }

    function tone(opts) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const freq = opts.freq === undefined ? 440 : opts.freq;
      const to = opts.to;
      const dur = opts.dur === undefined ? 0.12 : opts.dur;
      const type = opts.type || 'square';
      const vol = opts.vol === undefined ? 0.25 : opts.vol;
      const delay = opts.delay || 0;
      const t0 = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(gain);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }

    function noise(opts) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const dur = opts.dur === undefined ? 0.25 : opts.dur;
      const vol = opts.vol === undefined ? 0.4 : opts.vol;
      const freq = opts.freq === undefined ? 1200 : opts.freq;
      const type = opts.type || 'lowpass';
      const delay = opts.delay || 0;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = c.currentTime + delay;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(gain);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    }

    return {
      ensure,
      isMuted() { return muted; },
      toggle() {
        muted = !muted;
        try { localStorage.setItem('tb.muted', muted ? '1' : '0'); } catch (err) { /* ignore */ }
        if (!muted) ensure();
        updateMuteUi();
        return muted;
      },
      shoot(player) {
        tone({ freq: player ? 720 : 470, to: player ? 260 : 180, dur: 0.08, type: 'square', vol: 0.13 });
        noise({ dur: 0.05, vol: 0.06, freq: 3200, type: 'highpass' });
      },
      hitBrick() {
        noise({ dur: 0.09, vol: 0.2, freq: 1700, type: 'bandpass' });
      },
      hitSteel() {
        tone({ freq: 1900, to: 700, dur: 0.07, type: 'triangle', vol: 0.11 });
      },
      armorHit() {
        tone({ freq: 880, to: 500, dur: 0.06, type: 'square', vol: 0.09 });
      },
      explosion(huge) {
        noise({ dur: huge ? 0.65 : 0.3, vol: 0.42, freq: 700 });
        tone({ freq: huge ? 90 : 150, to: 38, dur: huge ? 0.5 : 0.26, type: 'sine', vol: 0.28 });
      },
      enemyDeath() {
        noise({ dur: 0.24, vol: 0.3, freq: 900 });
      },
      playerDeath() {
        tone({ freq: 300, to: 55, dur: 0.55, type: 'sawtooth', vol: 0.26 });
        noise({ dur: 0.45, vol: 0.35, freq: 600 });
      },
      baseDeath() {
        noise({ dur: 0.9, vol: 0.5, freq: 480 });
        tone({ freq: 110, to: 26, dur: 0.9, type: 'sawtooth', vol: 0.3 });
      },
      powerup() {
        [523, 659, 784, 1046].forEach((f, i) => {
          tone({ freq: f, dur: 0.1, type: 'square', vol: 0.12, delay: i * 0.07 });
        });
      },
      stageClear() {
        [523, 587, 659, 784, 880].forEach((f, i) => {
          tone({ freq: f, dur: 0.14, type: 'square', vol: 0.13, delay: i * 0.1 });
        });
      },
      start() {
        [392, 523, 659, 784].forEach((f, i) => {
          tone({ freq: f, dur: 0.12, type: 'square', vol: 0.14, delay: i * 0.09 });
        });
      },
      gameOver() {
        [392, 330, 262, 196].forEach((f, i) => {
          tone({ freq: f, dur: 0.26, type: 'sawtooth', vol: 0.15, delay: i * 0.17 });
        });
      },
    };
  })();

  function updateMuteUi() {
    const muted = Sfx.isMuted();
    btnMute.textContent = muted ? 'Muted' : 'Sound On';
    btnMute.classList.toggle('muted', muted);
    btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  function toggleMute() {
    Sfx.toggle();
  }

  /* --------------------------------------------------------------------------
     Rendering
     -------------------------------------------------------------------------- */
  function drawGround(g) {
    g.fillStyle = '#0a0e14';
    g.fillRect(0, 0, W, H);

    g.strokeStyle = 'rgba(90, 130, 180, 0.045)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += TILE * 2) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, H);
    }
    for (let y = 0; y <= H; y += TILE * 2) {
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
    }
    g.stroke();
  }

  function drawTiles(g, overlayPass) {
    const waterFrame = Math.floor(G.time * 4) % 3;
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        const i = tileIndex(gx, gy);
        const tt = tiles[i];
        const x = gx * TILE;
        const y = gy * TILE;
        if (overlayPass) {
          if (tt === T.GRASS) {
            g.drawImage(sprites.grass[(gx * 7 + gy * 13) % 3], x, y);
          }
          continue;
        }
        if (tt === T.BRICK) {
          const m = brickQ[i];
          if (m === 0) continue;
          g.drawImage(sprites.brick[m], x, y);
        } else if (tt === T.STEEL) {
          g.drawImage(sprites.steel, x, y);
        } else if (tt === T.WATER) {
          g.drawImage(sprites.water[waterFrame], x, y);
        }
      }
    }
  }

  function drawBase(g) {
    g.drawImage(G.baseAlive ? sprites.base : sprites.baseDead, BASE.x, BASE.y);
  }

  function styleFor(t) {
    if (t.isPlayer) return STYLE.player;
    if (t.isBonus && Math.sin(G.time * 14) > 0) return STYLE.bonus;
    if (t.type === 'armor') {
      const idx = Math.max(0, Math.min(3, t.maxHp - t.hp));
      return ARMOR_STYLES[idx];
    }
    return STYLE[t.type] || STYLE.basic;
  }

  function drawTank(g, t) {
    if (t.dead) return;
    if (t.spawnAnim > 0) {
      drawSpawn(g, t);
      return;
    }

    const st = styleFor(t);
    const cx = t.cx;
    const cy = t.cy;

    g.save();
    g.translate(cx, cy);
    g.rotate(ANGLE[t.dir]);

    // shadow
    g.fillStyle = 'rgba(0, 0, 0, 0.3)';
    g.beginPath();
    g.ellipse(0, 6, 21, 22, 0, 0, Math.PI * 2);
    g.fill();

    // treads
    g.fillStyle = st.tread;
    roundRect(g, -24, -22, 12, 44, 2);
    g.fill();
    roundRect(g, 12, -22, 12, 44, 2);
    g.fill();

    // tread links
    g.fillStyle = 'rgba(255, 255, 255, 0.14)';
    const off = (t.tread * 26) % 7;
    for (let y = -21 + off; y < 21; y += 7) {
      g.fillRect(-24, y, 12, 2);
      g.fillRect(12, y, 12, 2);
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.07)';
    g.fillRect(-24, -22, 1.5, 44);
    g.fillRect(22.5, -22, 1.5, 44);

    // hull
    g.fillStyle = st.hull;
    roundRect(g, -13, -20, 26, 40, 3);
    g.fill();
    g.fillStyle = st.light;
    g.fillRect(-11, -18, 22, 2.5);
    g.fillRect(-11, -18, 2.5, 34);
    g.fillStyle = st.dark;
    g.fillRect(-11, 15.5, 22, 2.5);
    g.fillRect(8.5, -18, 2.5, 34);

    // barrel
    g.fillStyle = st.dark;
    g.fillRect(-3.5, -31, 7, 27);
    g.fillStyle = st.light;
    g.fillRect(-2, -30, 1.5, 22);
    g.fillStyle = st.dark;
    g.fillRect(-5.5, -32, 11, 5);
    g.fillStyle = st.hull;
    g.fillRect(-4.5, -31, 9, 1.5);

    // turret
    g.fillStyle = st.dark;
    g.beginPath();
    g.arc(0, 2, 9.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = st.hull;
    g.beginPath();
    g.arc(0, 2, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = st.light;
    g.beginPath();
    g.arc(-2, 0, 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = st.dark;
    g.beginPath();
    g.arc(0, 2, 2.4, 0, Math.PI * 2);
    g.fill();

    // hull bolts
    g.fillStyle = st.dark;
    g.fillRect(-10, -15, 2, 2);
    g.fillRect(8, -15, 2, 2);
    g.fillRect(-10, 12, 2, 2);
    g.fillRect(8, 12, 2, 2);

    if (t.flash > 0) {
      g.fillStyle = 'rgba(255, 255, 255, 0.65)';
      roundRect(g, -13, -20, 26, 40, 3);
      g.fill();
    }

    g.restore();

    if (t.isPlayer && t.shield > 0) drawShield(g, cx, cy);
    if (!t.isPlayer && G.freezeTimer > 0) drawFrozen(g, cx, cy);
  }

  function drawSpawn(g, t) {
    const cx = t.cx;
    const cy = t.cy;
    const p = 1 - t.spawnAnim / 0.9;
    const r = 12 + Math.sin(Math.min(1, p) * Math.PI) * 14;

    g.save();
    g.translate(cx, cy);
    g.rotate(p * Math.PI * 3);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos((i * Math.PI) / 2) * r, Math.sin((i * Math.PI) / 2) * r);
      g.stroke();
    }
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.arc(0, 0, 5 + Math.sin(p * Math.PI) * 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawShield(g, cx, cy) {
    const t = G.time;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(120, 220, 255, 0.75)';
    g.lineWidth = 2;
    const r = 27 + Math.sin(t * 10) * 1.5;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + (i * Math.PI) / 3;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
    g.strokeStyle = 'rgba(120, 220, 255, 0.25)';
    g.beginPath();
    g.arc(cx, cy, r + 3, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function drawFrozen(g, cx, cy) {
    const pulse = 0.35 + 0.25 * Math.sin(G.time * 8 + cx * 0.1);
    g.save();
    g.strokeStyle = 'rgba(150, 220, 255, ' + pulse + ')';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 26, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(200, 240, 255, ' + Math.min(1, pulse + 0.25) + ')';
    g.beginPath();
    g.moveTo(cx - 6, cy - 6);
    g.lineTo(cx + 6, cy + 6);
    g.moveTo(cx + 6, cy - 6);
    g.lineTo(cx - 6, cy + 6);
    g.stroke();
    g.restore();
  }

  function drawTanks(g) {
    for (const t of tanks) drawTank(g, t);
  }

  function drawBullets(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      const cx = b.x + 4;
      const cy = b.y + 4;
      const ax = DX[b.dir];
      const ay = DY[b.dir];
      g.fillStyle = b.fromPlayer ? 'rgba(255, 240, 160, 0.28)' : 'rgba(255, 140, 110, 0.26)';
      g.fillRect(cx - ax * 10 - 3, cy - ay * 10 - 3, 6 + Math.abs(ax) * 10, 6 + Math.abs(ay) * 10);
      g.fillStyle = b.fromPlayer ? '#ffeaa0' : '#ffb090';
      g.fillRect(cx - 3, cy - 3, 6, 6);
      g.fillStyle = '#ffffff';
      g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    g.restore();
  }

  function drawEffects(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const e of effects) {
      const p = Math.min(1, e.t / e.dur);
      const r = e.size * (0.3 + p * 0.95);
      g.fillStyle = 'rgba(255, 160, 60, ' + 0.55 * (1 - p) + ')';
      g.beginPath();
      g.arc(e.x, e.y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255, 240, 180, ' + 0.85 * (1 - p) + ')';
      g.beginPath();
      g.arc(e.x, e.y, r * 0.45, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255, 120, 40, ' + 0.5 * (1 - p) + ')';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(e.x, e.y, r * 1.15, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawParticles(g) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = Math.min(1, a);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  function drawPowerIcon(g, type, cx, cy) {
    g.save();
    g.translate(cx, cy);
    switch (type) {
      case 'star':
        g.fillStyle = '#ffd75e';
        starPath(g, 0, 0, 14, 6, 5);
        g.fill();
        g.fillStyle = '#fff3bf';
        starPath(g, 0, -1, 9, 3.6, 5);
        g.fill();
        break;
      case 'helmet':
        g.fillStyle = '#7fd6ff';
        g.beginPath();
        g.arc(0, 2, 13, Math.PI, 0);
        g.lineTo(13, 9);
        g.lineTo(-13, 9);
        g.closePath();
        g.fill();
        g.fillStyle = '#d7f4ff';
        g.fillRect(-13, -2, 26, 3);
        g.fillStyle = '#2a6b8c';
        g.fillRect(-4, 4, 8, 5);
        break;
      case 'grenade':
        g.fillStyle = '#5d6b7d';
        g.beginPath();
        g.arc(0, 5, 11, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#8c9aab';
        g.beginPath();
        g.arc(-3, 2, 5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#3c4652';
        g.fillRect(-4, -12, 8, 6);
        g.strokeStyle = '#d9a65c';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(3, -12);
        g.quadraticCurveTo(12, -16, 10, -21);
        g.stroke();
        break;
      case 'shovel':
        g.strokeStyle = '#d8b27a';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(-8, -14);
        g.lineTo(6, 4);
        g.stroke();
        g.fillStyle = '#aab6c8';
        g.beginPath();
        g.moveTo(4, 2);
        g.lineTo(14, 8);
        g.lineTo(6, 14);
        g.lineTo(0, 8);
        g.closePath();
        g.fill();
        g.fillStyle = '#e3ecf7';
        g.beginPath();
        g.arc(-9, -15, 5, 0, Math.PI * 2);
        g.fill();
        break;
      case 'tank':
        g.fillStyle = '#8ce86d';
        roundRect(g, -13, -1, 26, 15, 3);
        g.fill();
        g.fillStyle = '#d3ffb6';
        g.fillRect(-2, -13, 4, 13);
        g.beginPath();
        g.arc(0, 5, 5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#3f7a2e';
        g.fillRect(-13, 12, 26, 3);
        break;
      case 'clock':
        g.fillStyle = '#f4f8ff';
        g.beginPath();
        g.arc(0, 2, 12, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#26303f';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 2, 12, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 2);
        g.lineTo(0, -6);
        g.moveTo(0, 2);
        g.lineTo(6, 5);
        g.stroke();
        g.fillStyle = '#26303f';
        g.fillRect(-2, -16, 4, 4);
        break;
    }
    g.restore();
  }

  function drawPowerups(g) {
    for (const p of powerups) {
      if (p.life < 3 && Math.floor(p.life * 8) % 2 === 0) continue;
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 5 + p.x * 0.05);
      g.save();
      const cx = p.x + TS / 2;
      const cy = p.y + TS / 2;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255, 200, 90, ' + (0.09 + pulse * 0.08) + ')';
      g.beginPath();
      g.arc(cx, cy, 32 + pulse * 4, 0, Math.PI * 2);
      g.fill();
      g.restore();

      g.fillStyle = 'rgba(8, 10, 14, 0.86)';
      roundRect(g, p.x, p.y, TS, TS, 6);
      g.fill();
      g.strokeStyle = 'rgba(255, 215, 94, ' + (0.55 + pulse * 0.4) + ')';
      g.lineWidth = 2;
      roundRect(g, p.x + 1, p.y + 1, TS - 2, TS - 2, 5);
      g.stroke();
      drawPowerIcon(g, p.type, cx, cy);
    }
  }

  function render() {
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);

    g.save();
    if (G.shake > 0.2) {
      g.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    }

    drawGround(g);
    drawTiles(g, false);
    drawBase(g);
    drawPowerups(g);
    drawTanks(g);
    drawBullets(g);
    drawTiles(g, true);
    drawEffects(g);
    drawParticles(g);

    g.restore();
  }

  /* --------------------------------------------------------------------------
     HUD, overlays, state flow
     -------------------------------------------------------------------------- */
  function updateHud() {
    const key = G.score + '|' + G.stage + '|' + G.lives + '|' + (G.total - G.killed) + '|' + G.power;
    if (key === lastHudKey) return;
    lastHudKey = key;
    hudScore.textContent = pad(G.score);
    hudStage.textContent = String(G.stage);
    hudLives.textContent = String(Math.max(0, G.lives));
    hudEnemies.textContent = String(Math.max(0, G.total - G.killed));
    hudPower.textContent = '★'.repeat(G.power) + '☆'.repeat(Math.max(0, 3 - G.power));
  }

  function banner(text, ms) {
    bannerEl.textContent = text;
    bannerEl.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.remove('show'), ms || 1600);
  }

  function hideOverlay() {
    overlayEl.classList.remove('show');
    overlayEl.innerHTML = '';
  }

  function showOverlay(html) {
    overlayEl.innerHTML = html;
    overlayEl.classList.add('show');
  }

  function showMenu() {
    showOverlay(
      '<div class="panel">' +
        '<div class="logo">TANK<span>BATTLE</span></div>' +
        '<p class="sub">Defend the eagle &middot; clear every stage</p>' +
        '<div class="keyrows">' +
          '<div><kbd>W A S D</kbd><kbd>&uarr; &larr; &darr; &rarr;</kbd><span>Move</span></div>' +
          '<div><kbd>SPACE</kbd><span>Fire</span><kbd>P</kbd><span>Pause</span></div>' +
        '</div>' +
        '<button class="btn primary" type="button" data-action="start">Start Mission</button>' +
        '<p class="best">High Score <b>' + pad(G.best) + '</b></p>' +
      '</div>'
    );
  }

  function showPause() {
    showOverlay(
      '<div class="panel">' +
        '<div class="logo small">PAUSED</div>' +
        '<p class="sub">Battle on hold</p>' +
        '<button class="btn primary" type="button" data-action="resume">Resume</button>' +
        '<button class="btn" type="button" data-action="restart">Restart</button>' +
      '</div>'
    );
  }

  function showGameOver(reason) {
    G.state = 'gameover';
    Sfx.gameOver();
    if (G.score > G.best) {
      G.best = G.score;
      saveBest();
    }
    showOverlay(
      '<div class="panel">' +
        '<div class="logo small danger">GAME OVER</div>' +
        '<p class="sub">' + (reason || 'MISSION FAILED') + '</p>' +
        '<div class="stats">Score ' + pad(G.score) + '<br>Best ' + pad(G.best) + ' &middot; Stage ' + G.stage + '</div>' +
        '<button class="btn primary" type="button" data-action="start">Fight Again</button>' +
      '</div>'
    );
    updateHud();
  }

  function startGame() {
    Sfx.ensure();
    Sfx.start();
    Input.reset();
    G.score = 0;
    G.lives = 2;
    G.power = 1;
    G.endReason = '';
    buildStage(1);
    G.state = 'playing';
    hideOverlay();
    spawnPlayer();
    banner('STAGE 1', 1500);
    lastHudKey = '';
    updateHud();
  }

  function togglePause() {
    if (G.state === 'playing') {
      G.state = 'paused';
      Input.reset();
      showPause();
    } else if (G.state === 'paused') {
      G.state = 'playing';
      hideOverlay();
    }
  }

  function resumeGame() {
    if (G.state === 'paused') {
      G.state = 'playing';
      hideOverlay();
    }
  }

  function loadBest() {
    try {
      return parseInt(localStorage.getItem('tb.best') || '0', 10) || 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem('tb.best', String(G.best));
    } catch (err) { /* ignore */ }
  }

  /* --------------------------------------------------------------------------
     Main loop
     -------------------------------------------------------------------------- */
  function update(dt) {
    G.time += dt;

    if (G.state === 'playing') {
      updateWorld(dt);
    } else if (G.state === 'stageclear') {
      G.stageTimer -= dt;
      if (G.stageTimer <= 0) {
        buildStage(G.stage + 1);
        spawnPlayer();
        G.state = 'playing';
        banner('STAGE ' + G.stage, 1500);
        lastHudKey = '';
        updateHud();
      }
    } else if (G.state === 'dying') {
      G.stageTimer -= dt;
      if (G.stageTimer <= 0) showGameOver(G.endReason);
    }

    updateEffects(dt);
    G.shake = Math.max(0, G.shake - dt * 42);
    updateHud();
  }

  let lastTime = performance.now();
  let acc = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      update(STEP);
      acc -= STEP;
      guard++;
    }
    if (guard >= 5) acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------------------
     Wire-up
     -------------------------------------------------------------------------- */
  window.addEventListener('keydown', (e) => {
    const dir = Input.keymap[e.code];
    if (dir !== undefined) {
      e.preventDefault();
      Input.press(dir);
      Sfx.ensure();
      return;
    }
    if (e.code === 'Space' || e.code === 'KeyJ') {
      e.preventDefault();
      Input.setFire(true);
      Sfx.ensure();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }
    if (e.code === 'KeyM') {
      toggleMute();
      return;
    }
    if (e.code === 'Enter') {
      if (G.state === 'menu' || G.state === 'gameover') {
        e.preventDefault();
        startGame();
      } else if (G.state === 'paused') {
        e.preventDefault();
        resumeGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const dir = Input.keymap[e.code];
    if (dir !== undefined) {
      e.preventDefault();
      Input.release(dir);
      return;
    }
    if (e.code === 'Space' || e.code === 'KeyJ') {
      e.preventDefault();
      Input.setFire(false);
    }
  });

  window.addEventListener('blur', () => {
    Input.reset();
    if (G.state === 'playing') togglePause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'playing') togglePause();
  });

  overlayEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    btn.blur();
    if (action === 'start' || action === 'restart') startGame();
    else if (action === 'resume') resumeGame();
  });

  btnPause.addEventListener('click', () => {
    btnPause.blur();
    if (G.state === 'menu' || G.state === 'gameover' || G.state === 'dying' || G.state === 'stageclear') return;
    togglePause();
  });

  btnMute.addEventListener('click', () => {
    btnMute.blur();
    toggleMute();
  });

  // Touch controls
  const dirMap = { up: UP, right: RIGHT, down: DOWN, left: LEFT };
  document.querySelectorAll('[data-dir]').forEach((btn) => {
    const dir = dirMap[btn.getAttribute('data-dir')];
    if (dir === undefined) return;
    const press = (e) => {
      e.preventDefault();
      Sfx.ensure();
      if (btn.setPointerCapture && e.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      Input.press(dir);
    };
    const release = (e) => {
      if (e) e.preventDefault();
      Input.release(dir);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  const fireBtn = document.querySelector('[data-fire]');
  if (fireBtn) {
    const press = (e) => {
      e.preventDefault();
      Sfx.ensure();
      if (fireBtn.setPointerCapture && e.pointerId !== undefined) {
        try { fireBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      Input.setFire(true);
    };
    const release = (e) => {
      if (e) e.preventDefault();
      Input.setFire(false);
    };
    fireBtn.addEventListener('pointerdown', press);
    fireBtn.addEventListener('pointerup', release);
    fireBtn.addEventListener('pointercancel', release);
    fireBtn.addEventListener('lostpointercapture', release);
    fireBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* --------------------------------------------------------------------------
     Boot
     -------------------------------------------------------------------------- */
  G.best = loadBest();
  buildSprites();
  buildStage(1);          // a live backdrop behind the menu
  G.state = 'menu';
  updateMuteUi();
  updateHud();
  showMenu();
  requestAnimationFrame(frame);

  if (location.search.indexOf('autostart') !== -1) {
    startGame();
  }

  // Small read-only/debug surface used by the automated smoke test.
  if (location.search.indexOf('debug') !== -1) {
    window.__tankDebug = {
      snapshot() {
        let brickTiles = 0;
        let brickQuads = 0;
        for (let i = 0; i < tiles.length; i++) {
          if (tiles[i] !== T.BRICK) continue;
          if (brickQ[i] !== 0) brickTiles++;
          let m = brickQ[i];
          while (m) {
            brickQuads += m & 1;
            m >>= 1;
          }
        }
        return {
          brickTiles,
          brickQuads,
          state: G.state,
          stage: G.stage,
          score: G.score,
          lives: G.lives,
          power: G.power,
          killed: G.killed,
          toSpawn: G.toSpawn,
          baseAlive: G.baseAlive,
          bullets: bullets.length,
          player: G.player ? { x: G.player.x, y: G.player.y, dir: G.player.dir, shield: G.player.shield } : null,
          enemies: tanks
            .filter((t) => !t.isPlayer && !t.dead)
            .map((t) => ({ x: t.x, y: t.y, type: t.type, hp: t.hp, spawn: t.spawnAnim })),
        };
      },
      start: startGame,
      grant: collectPowerup,
      destroyBase,
      killPlayer,
      setKilled(n) { G.killed = n; },
    };
  }
})();
