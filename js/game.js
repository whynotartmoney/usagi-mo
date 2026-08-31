(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const cardTitle = document.getElementById("card-title");
  const cardEnd = document.getElementById("card-end");
  const hud = document.getElementById("hud");
  const controls = document.getElementById("controls");

  const TILE = 40;
  const VIEW_W = 960;
  const VIEW_H = 540;
  const MAP_H = 16;
  const MAP_W = 148;

  const COL = {
    fill: "#f7e4a8",
    inner: "#f4b4c2",
    blush: "#ec8ca0",
    line: "#3a2418",
    eye: "#1b120e",
    white: "#fffdf8",
    grass: "#7fbf4a",
    grassDark: "#5d9a32",
    dirt: "#c9955a",
    dirtDark: "#a8743e",
    brick: "#e8b86a",
    wood: "#d9a066",
    pipe: "#5aae5a",
    pipeDark: "#3e8a3e",
    coin: "#f2c94c",
    skyTop: "#b9e4f8",
    skyBot: "#8ec8ea",
  };

  const ACCEL = 2600;
  const AIR_ACCEL = 1900;
  const FRICTION = 2200;
  const MAX_SPEED = 320;
  const JUMP_VEL = -820;
  const JUMP_CUT = 0.45;
  const GRAVITY = 1850;
  const FALL_GRAVITY = 2650;
  const MAX_FALL = 980;
  const COYOTE = 0.09;
  const JUMP_BUF = 0.12;

  const T_EMPTY = 0;
  const T_GRASS = 1;
  const T_DIRT = 2;
  const T_BRICK = 3;
  const T_Q = 4;
  const T_QUSED = 5;
  const T_PIPE = 6;
  const T_WOOD = 7;
  const T_FLAG = 8;

  let dpr = 1;
  let state = "title";
  let last = 0;
  let shake = 0;
  let world;
  let player;
  let cam = { x: 0, y: 0 };
  let particles = [];
  let floaters = [];
  let score = 0;
  let coins = 0;
  let lives = 3;
  let invuln = 0;
  let banner = { text: "", t: 0 };
  let audio;
  let muted = false;

  const SPRITES = { idle: null, run: null, jump: null, win: null, cheer: null, ready: false };

  function loadSprite(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  Promise.all([
    loadSprite("assets/sprites/idle.png"),
    loadSprite("assets/sprites/run.png"),
    loadSprite("assets/sprites/jump.png"),
    loadSprite("assets/sprites/win.png"),
    loadSprite("assets/sprites/cheer.png"),
  ]).then(([idle, run, jump, win, cheer]) => {
    SPRITES.idle = idle;
    SPRITES.run = run;
    SPRITES.jump = jump;
    SPRITES.win = win;
    SPRITES.cheer = cheer;
    SPRITES.ready = !!(idle || run);
  });

  const input = {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pad(n, len) {
    return String(n).padStart(len, "0");
  }

  function ensureAudio() {
    if (audio || muted) return;
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      muted = true;
    }
  }
  function beep(freq, dur, type, gain) {
    if (!audio) return;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.value = gain || 0.05;
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  }
  function sfx(name) {
    if (!audio) return;
    if (name === "jump") {
      beep(420, 0.12, "square", 0.05);
      beep(620, 0.08, "square", 0.03);
    } else if (name === "coin") {
      beep(880, 0.07, "square", 0.05);
      setTimeout(() => beep(1320, 0.1, "square", 0.05), 60);
    } else if (name === "stomp") {
      beep(180, 0.12, "triangle", 0.07);
    } else if (name === "bump") {
      beep(260, 0.08, "square", 0.04);
    } else if (name === "hurt") {
      beep(220, 0.18, "sawtooth", 0.05);
    } else if (name === "win") {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, "square", 0.05), i * 120));
    } else if (name === "die") {
      [400, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.14, "triangle", 0.05), i * 90));
    }
  }

  function makeGrid() {
    const g = [];
    for (let y = 0; y < MAP_H; y++) g.push(new Uint8Array(MAP_W));
    return g;
  }
  function fill(g, x, y, w, h, v) {
    for (let ty = y; ty < y + h; ty++) {
      if (ty < 0 || ty >= MAP_H) continue;
      for (let tx = x; tx < x + w; tx++) {
        if (tx < 0 || tx >= MAP_W) continue;
        g[ty][tx] = v;
      }
    }
  }
  function ground(g, x0, x1) {
    const top = 12;
    fill(g, x0, top, x1 - x0, 1, T_GRASS);
    fill(g, x0, top + 1, x1 - x0, MAP_H - top - 1, T_DIRT);
  }
  function pipe(g, x, h) {
    const top = 12 - h;
    fill(g, x, top, 2, h, T_PIPE);
  }

  function buildWorld() {
    const grid = makeGrid();
    ground(grid, 0, 30);
    ground(grid, 32, 50);
    ground(grid, 55, 78);
    ground(grid, 82, 112);
    ground(grid, 116, MAP_W);

    fill(grid, 8, 8, 1, 1, T_BRICK);
    fill(grid, 9, 8, 1, 1, T_Q);
    fill(grid, 10, 8, 1, 1, T_BRICK);
    fill(grid, 11, 8, 1, 1, T_Q);
    fill(grid, 12, 8, 1, 1, T_BRICK);

    fill(grid, 18, 8, 1, 1, T_Q);
    fill(grid, 19, 8, 1, 1, T_BRICK);

    pipe(grid, 38, 2);
    pipe(grid, 46, 3);

    fill(grid, 29, 9, 2, 1, T_WOOD);
    fill(grid, 51, 8, 3, 1, T_WOOD);
    fill(grid, 54, 5, 3, 1, T_WOOD);

    fill(grid, 60, 8, 2, 1, T_BRICK);
    fill(grid, 62, 8, 1, 1, T_Q);
    fill(grid, 63, 8, 2, 1, T_BRICK);

    fill(grid, 70, 9, 4, 1, T_WOOD);

    for (let i = 0; i < 5; i++) fill(grid, 96 + i, 12 - i, 1, i + 1, T_BRICK);
    fill(grid, 101, 8, 4, 5, T_BRICK);

    fill(grid, 120, 8, 1, 1, T_Q);
    fill(grid, 121, 8, 1, 1, T_BRICK);
    fill(grid, 122, 8, 1, 1, T_Q);

    pipe(grid, 128, 2);
    fill(grid, 138, 1, 1, 11, T_FLAG);

    const coinList = [];
    const addCoins = (arr) => arr.forEach(([tx, ty]) => coinList.push({ x: tx * TILE + 10, y: ty * TILE + 10, w: 20, h: 20, taken: false, t: Math.random() * 6 }));
    addCoins([
      [6, 11], [7, 11], [8, 11], [13, 11], [14, 11],
      [9, 6], [11, 6], [18, 6], [19, 6],
      [29, 7], [30, 7],
      [51, 6], [52, 6], [53, 6], [54, 3], [55, 3], [56, 3],
      [70, 7], [71, 7], [72, 7], [73, 7],
      [86, 10], [87, 9], [88, 8], [89, 7],
      [120, 6], [122, 6],
      [132, 10], [133, 10], [134, 10],
    ]);

    const gy = 12 * TILE;
    const eh = 28;
    const enemies = [
      { x: 42 * TILE, y: gy - eh, w: 30, h: eh, vx: 50, alive: true, squash: 1, t: 0 },
      { x: 62 * TILE, y: gy - eh, w: 30, h: eh, vx: -50, alive: true, squash: 1, t: 0 },
      { x: 74 * TILE, y: gy - eh, w: 30, h: eh, vx: 55, alive: true, squash: 1, t: 0 },
      { x: 90 * TILE, y: gy - eh, w: 30, h: eh, vx: -45, alive: true, squash: 1, t: 0 },
      { x: 110 * TILE, y: gy - eh, w: 30, h: eh, vx: 50, alive: true, squash: 1, t: 0 },
    ];

    return {
      grid,
      coins: coinList,
      enemies,
      flag: { x: 138 * TILE + 8, y: 1 * TILE, w: 24, h: 11 * TILE, taken: false },
      spawn: { x: 2.5 * TILE, y: 12 * TILE - 34 },
      checks: [3 * TILE, 54 * TILE, 84 * TILE, 118 * TILE],
    };
  }

  function makePlayer(x, y) {
    return {
      x,
      y,
      w: 28,
      h: 34,
      vx: 0,
      vy: 0,
      grounded: false,
      wasAir: false,
      facing: 1,
      coyote: 0,
      buffer: 0,
      jumpHeld: false,
      dead: false,
      win: false,
      t: 0,
      run: 0,
      bob: 0,
      sx: 1,
      sy: 1,
      earL: 0,
      earR: 0,
      blink: 1,
      tilt: 0,
      pose: "idle",
      trail: [],
      checkpoint: x,
    };
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T_EMPTY;
    return world.grid[ty][tx];
  }
  function solid(v) {
    return v > 0 && v !== T_FLAG;
  }

  function collideAxis(p, dt, axis) {
    if (axis === "x") p.x += p.vx * dt;
    else p.y += p.vy * dt;

    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 0.001) / TILE);
    const y0 = Math.floor(p.y / TILE);
    const y1 = Math.floor((p.y + p.h - 0.001) / TILE);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        const id = world.grid[ty][tx];
        if (!solid(id)) continue;
        const tile = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
        if (!aabb(p, tile)) continue;

        if (axis === "x") {
          if (p.vx > 0) p.x = tile.x - p.w;
          else if (p.vx < 0) p.x = tile.x + tile.w;
          p.vx = 0;
        } else {
          if (p.vy > 0) {
            p.y = tile.y - p.h;
            p.vy = 0;
            p.grounded = true;
          } else if (p.vy < 0) {
            p.y = tile.y + tile.h;
            p.vy = 0;
            if (id === T_Q) bumpBlock(tx, ty);
            else if (id === T_BRICK || id === T_QUSED) sfx("bump");
          }
        }
      }
    }
  }

  function bumpBlock(tx, ty) {
    world.grid[ty][tx] = T_QUSED;
    sfx("coin");
    coins += 1;
    score += 200;
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE;
    spawnCoinPop(x, y);
    addFloater(x, y - 8, "+200");
    for (let i = 0; i < 8; i++) spawnSpark(x, y);
    refreshHud();
  }

  function tryJump(p) {
    if (p.buffer > 0 && (p.grounded || p.coyote > 0)) {
      p.vy = JUMP_VEL;
      p.grounded = false;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpHeld = true;
      p.sx = 1.28;
      p.sy = 0.68;
      sfx("jump");
      spawnDust(p.x + p.w / 2, p.y + p.h, 5);
    }
  }

  function updatePlayer(p, dt) {
    p.t += dt;
    if (p.dead || p.win) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      updateAnim(p, dt);
      return;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = p.grounded ? ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      p.vx += dir * accel * dt;
      p.facing = dir;
    } else if (p.grounded) {
      const mag = Math.abs(p.vx);
      const fr = FRICTION * dt;
      if (mag <= fr) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * fr;
    } else {
      p.vx *= 1 - Math.min(1, dt * 1.2);
    }
    p.vx = clamp(p.vx, -MAX_SPEED, MAX_SPEED);

    if (input.jumpPressed) p.buffer = JUMP_BUF;
    input.jumpPressed = false;
    if (!input.jumpHeld && p.jumpHeld && p.vy < 0) {
      p.vy *= JUMP_CUT;
      p.jumpHeld = false;
    }
    if (!input.jumpHeld) p.jumpHeld = false;

    const g = p.vy < 0 ? GRAVITY : FALL_GRAVITY;
    p.vy = Math.min(MAX_FALL, p.vy + g * dt);

    p.grounded = false;
    collideAxis(p, dt, "x");
    collideAxis(p, dt, "y");
    p.x = clamp(p.x, 0, MAP_W * TILE - p.w - TILE);

    if (p.grounded) p.coyote = COYOTE;
    else p.coyote -= dt;
    p.buffer -= dt;
    tryJump(p);

    if (p.y > MAP_H * TILE + 20) die("pit");

    const cx = p.x + p.w / 2;
    world.checks.forEach((c) => {
      if (cx > c && c > p.checkpoint) p.checkpoint = c;
    });

    updateAnim(p, dt);
  }

  function updateAnim(p, dt) {
    const speed = Math.abs(p.vx);

    if (p.dead) {
      p.sx = lerp(p.sx, 1.25, 0.18);
      p.sy = lerp(p.sy, 0.52, 0.18);
      p.tilt = lerp(p.tilt, 0.55, 0.12);
      p.bob = 0;
      p.pose = "idle";
      p.trail = [];
      return;
    }
    if (p.win) {
      p.run += dt * 10;
      p.bob = Math.abs(Math.sin(p.run)) * 8;
      p.sx = 1 + Math.sin(p.run) * 0.1;
      p.sy = 1 - Math.sin(p.run) * 0.1;
      p.tilt = Math.sin(p.run * 2) * 0.12;
      p.pose = Math.sin(p.run) > 0 ? "win" : "cheer";
      return;
    }

    if (p.grounded) {
      if (p.wasAir) {
        p.sx = 1.38;
        p.sy = 0.58;
        p.tilt = 0;
        p.wasAir = false;
        shake = Math.max(shake, 4);
        spawnDust(p.x + p.w / 2, p.y + p.h, 7);
      }
      if (speed > 25) {
        p.run += dt * (12 + speed * 0.05);
        const wave = Math.sin(p.run * Math.PI);
        p.bob = Math.abs(wave) * 9;
        p.sx = 1.12 + wave * 0.18;
        p.sy = 0.88 - wave * 0.18;
        p.tilt = wave * 0.3;
        p.pose = "run";
        if (Math.random() < dt * 10) spawnDust(p.x + p.w / 2, p.y + p.h, 1);
        p.trail.push({
          x: p.x + p.w / 2,
          y: p.y + p.h,
          t: 0.14,
          sx: p.sx,
          sy: p.sy,
          tilt: p.tilt,
          facing: p.facing,
          bob: p.bob,
        });
        if (p.trail.length > 7) p.trail.shift();
      } else {
        p.run = 0;
        const breathe = Math.sin(p.t * 2.6);
        p.bob = breathe * 2.4;
        p.sx = lerp(p.sx, 1 + breathe * 0.05, 0.22);
        p.sy = lerp(p.sy, 1 - breathe * 0.05, 0.22);
        p.tilt = lerp(p.tilt, Math.sin(p.t * 1.5) * 0.05, 0.18);
        p.pose = "idle";
      }
    } else {
      p.wasAir = true;
      p.bob = 0;
      p.pose = "jump";
      if (p.vy < -40) {
        p.sx = lerp(p.sx, 0.74, 0.28);
        p.sy = lerp(p.sy, 1.32, 0.28);
        p.tilt = lerp(p.tilt, -0.16, 0.22);
      } else {
        p.sx = lerp(p.sx, 1.16, 0.16);
        p.sy = lerp(p.sy, 0.84, 0.16);
        p.tilt = lerp(p.tilt, 0.2, 0.14);
      }
    }
    p.blink = p.t % 3.4 > 3.22 ? 0.12 : 1;
    p.trail = (p.trail || []).filter((t) => (t.t -= dt) > 0);
  }

  function updateEnemies(dt) {
    world.enemies.forEach((e) => {
      e.t += dt;
      if (!e.alive) {
        e.squash = lerp(e.squash, 0.15, 0.2);
        e.h = lerp(e.h, 8, 0.2);
        return;
      }
      e.x += e.vx * dt;
      const front = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      const foot = e.x + (e.vx > 0 ? e.w - 4 : 4);
      if (solid(tileAt(front, e.y + e.h * 0.5)) || !solid(tileAt(foot, e.y + e.h + 4))) e.vx *= -1;
      const ty = Math.floor((e.y + e.h + 2) / TILE);
      if (solid(tileAt(e.x + e.w / 2, e.y + e.h + 2))) e.y = ty * TILE - e.h;

      if (invuln > 0 || player.dead || player.win) return;
      if (!aabb(player, e)) return;

      const fromAbove = player.vy > 80 && player.y + player.h - e.y < 18;
      if (fromAbove) {
        e.alive = false;
        player.vy = -420;
        player.sx = 1.2;
        player.sy = 0.78;
        score += 100;
        addFloater(e.x + e.w / 2, e.y, "+100");
        sfx("stomp");
        shake = 6;
        refreshHud();
      } else {
        const dir = player.x + player.w / 2 < e.x + e.w / 2 ? -1 : 1;
        hitPlayer(dir * 340);
      }
    });
  }

  function updateCoins(dt) {
    world.coins.forEach((c) => {
      c.t += dt;
      if (c.taken) return;
      if (aabb(player, c)) {
        c.taken = true;
        coins += 1;
        score += 100;
        sfx("coin");
        addFloater(c.x + 10, c.y, "+100");
        spawnSpark(c.x + 10, c.y + 10);
        refreshHud();
      }
    });
  }

  function updateFlag() {
    if (world.flag.taken || player.dead) return;
    if (aabb(player, world.flag)) {
      world.flag.taken = true;
      player.win = true;
      player.vx = 0;
      score += 1000;
      sfx("win");
      refreshHud();
      setTimeout(() => showEnd(true), 900);
    }
  }

  function hitPlayer(kx) {
    if (invuln > 0 || player.dead) return;
    lives -= 1;
    invuln = 1.5;
    player.vx = kx;
    player.vy = -280;
    player.grounded = false;
    sfx("hurt");
    shake = 10;
    refreshHud();
    if (lives <= 0) die("hurt");
  }

  function die(reason) {
    if (player.dead) return;
    player.dead = true;
    player.vy = -380;
    if (reason === "pit") {
      lives -= 1;
      refreshHud();
    }
    sfx("die");
    shake = 12;
    setTimeout(() => {
      if (lives <= 0) showEnd(false);
      else respawn();
    }, 900);
  }

  function respawn() {
    const x = player.checkpoint;
    player = makePlayer(x, world.spawn.y);
    player.checkpoint = x;
    invuln = 1.4;
    cam.x = Math.max(0, player.x - 200);
    banner = { text: "再出發！", t: 1.4 };
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -Math.random() * 40,
        life: 0.35 + Math.random() * 0.2,
        max: 0.5,
        r: 3 + Math.random() * 3,
        c: "#efe0b8",
      });
    }
  }
  function spawnSpark(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        life: 0.35,
        max: 0.35,
        r: 2.5,
        c: "#ffe27a",
      });
    }
  }
  function spawnCoinPop(x, y) {
    particles.push({ x, y, vx: 0, vy: -140, life: 0.45, max: 0.45, r: 8, c: "coin" });
  }
  function addFloater(x, y, text) {
    floaters.push({ x, y, text, life: 0.7 });
  }

  function updateFx(dt) {
    shake = Math.max(0, shake - dt * 28);
    invuln = Math.max(0, invuln - dt);
    banner.t = Math.max(0, banner.t - dt);
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      return p.life > 0;
    });
    floaters = floaters.filter((f) => {
      f.life -= dt;
      f.y -= 40 * dt;
      return f.life > 0;
    });
  }

  function updateCamera(dt) {
    const look = player.facing > 0 ? VIEW_W * 0.34 : VIEW_W * 0.52;
    const tx = player.x - look;
    const ty = clamp(player.y - VIEW_H * 0.62, 0, MAP_H * TILE - VIEW_H);
    cam.x = lerp(cam.x, tx, 1 - Math.pow(0.02, dt));
    cam.y = lerp(cam.y, ty, 1 - Math.pow(0.04, dt));
    cam.x = clamp(cam.x, 0, MAP_W * TILE - VIEW_W);
    cam.y = clamp(cam.y, 0, Math.max(0, MAP_H * TILE - VIEW_H));
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function pickSprite(pose) {
    if (pose === "run" && SPRITES.run) return { img: SPRITES.run, side: true };
    if (pose === "jump" && SPRITES.run) return { img: SPRITES.run, side: true };
    if (pose === "win" && SPRITES.win) return { img: SPRITES.win, side: false };
    if (pose === "cheer" && SPRITES.cheer) return { img: SPRITES.cheer, side: false };
    return { img: SPRITES.idle || SPRITES.run, side: false };
  }

  function drawSpriteUsagi(x, y, a) {
    const picked = pickSprite(a.pose);
    const img = picked && picked.img;
    if (!img) return false;
    const H = 88;
    const W = H * (img.width / img.height);
    ctx.save();
    ctx.translate(x, y - (a.bob || 0));
    const flip = picked.side ? -a.facing : a.facing;
    ctx.scale(flip, 1);
    ctx.rotate(a.tilt || 0);
    ctx.scale(a.sx, a.sy);
    ctx.drawImage(img, -W / 2, -H, W, H);
    ctx.restore();
    return true;
  }

  function drawUsagi(x, y, a) {
    if (SPRITES.ready && drawSpriteUsagi(x, y, a)) return;
    ctx.save();
    ctx.translate(x, y - a.bob);
    ctx.scale(1.12 * a.facing, 1.12);
    ctx.scale(a.sx, a.sy);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = COL.line;
    ctx.fillStyle = COL.fill;
    ctx.lineWidth = 3.1;

    const ear = (side, ang) => {
      ctx.save();
      ctx.translate(side * 12, -62);
      ctx.rotate(ang + side * 0.06);
      ctx.beginPath();
      ctx.ellipse(0, -17, 7.6, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COL.inner;
      ctx.beginPath();
      ctx.ellipse(0, -16, 3.6, 12.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COL.fill;
    };
    ear(-1, a.earL);
    ear(1, a.earR);

    const run = a.run || 0;
    const moving = Math.abs(player.vx) > 25 && player.grounded && !player.dead;
    const leg = (side) => {
      const phase = moving ? Math.sin(run * Math.PI * 2 + (side < 0 ? 0 : Math.PI)) : 0;
      const lift = moving ? Math.max(0, -phase) * 5 : 0;
      const swing = moving ? phase * 4 : 0;
      ctx.beginPath();
      ctx.ellipse(side * 8 + swing * 0.3, -5 - lift, 6.2, 6.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    const arm = (side) => {
      const phase = moving ? Math.sin(run * Math.PI * 2 + (side < 0 ? Math.PI : 0)) : Math.sin(player.t * 2) * 0.4;
      const air = !player.grounded;
      const ay = air ? (player.vy < 0 ? -6 : 2) : phase * 3;
      ctx.beginPath();
      ctx.ellipse(side * 16, -22 + ay, 5.4, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    arm(-1);
    arm(1);
    roundRect(-11, -26, 22, 18, 9);
    ctx.fill();
    ctx.stroke();
    leg(-1);
    leg(1);

    ctx.beginPath();
    ctx.ellipse(0, -42, 24, 21.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const blink = a.blink;
    const eye = (sx) => {
      ctx.fillStyle = COL.eye;
      ctx.beginPath();
      ctx.ellipse(sx, -45, 5.1, 5.6 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      if (blink > 0.4) {
        ctx.fillStyle = COL.white;
        ctx.beginPath();
        ctx.ellipse(sx + 1.6, -47.2, 1.7, 1.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sx - 1.4, -45.4, 0.9, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    eye(-8.5);
    eye(8.5);

    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-8.5, -55, 3.2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8.5, -55, 3.2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    const blush = (sx) => {
      ctx.fillStyle = COL.blush;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(sx, -38.5, 6.5, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.blush;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const bx = sx - 3 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(bx, -41);
        ctx.lineTo(bx + 2.2, -36.5);
        ctx.stroke();
      }
    };
    blush(-16.5);
    blush(16.5);

    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-4.6, -35.2);
    ctx.quadraticCurveTo(-2.3, -31.6, 0, -35);
    ctx.quadraticCurveTo(2.3, -31.6, 4.6, -35.2);
    ctx.stroke();

    ctx.restore();
  }

  function drawEnemy(e) {
    const x = e.x + e.w / 2;
    const y = e.y + e.h;
    const walk = Math.sin(e.t * 10) * (e.alive ? 3 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, e.alive ? 1 : e.squash);
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = COL.line;
    ctx.fillStyle = "#c9a07a";
    ctx.beginPath();
    ctx.ellipse(-7 + walk, -6, 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(7 - walk, -6, 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d9b08a";
    ctx.beginPath();
    ctx.ellipse(0, -18, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (e.alive) {
      ctx.fillStyle = COL.eye;
      ctx.beginPath();
      ctx.ellipse(-5, -20, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -20, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -26);
      ctx.lineTo(-3, -24);
      ctx.moveTo(8, -26);
      ctx.lineTo(3, -24);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCoin(c) {
    const spin = 0.35 + 0.65 * Math.abs(Math.cos(c.t * 4));
    const bob = Math.sin(c.t * 3) * 3;
    ctx.save();
    ctx.translate(c.x + 10, c.y + 10 + bob);
    ctx.scale(spin, 1);
    ctx.fillStyle = COL.coin;
    ctx.strokeStyle = "#c7922a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe9a0";
    ctx.beginPath();
    ctx.ellipse(-2, -3, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, COL.skyTop);
    g.addColorStop(1, COL.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const t = player ? player.t : 0;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    for (let i = 0; i < 8; i++) {
      const cx = ((i * 220 - cam.x * 0.25 + t * 8) % (VIEW_W + 180)) - 60;
      const cy = 40 + (i % 3) * 28;
      cloud(cx, cy, 0.7 + (i % 3) * 0.15);
    }

    ctx.fillStyle = "#9fd18a";
    hill(0.45, 0.18, 220);
    ctx.fillStyle = "#7fbf6a";
    hill(0.62, 0.28, 160);
  }
  function cloud(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 10, 16, 0, Math.PI * 2);
    ctx.arc(18, 6, 20, 0, Math.PI * 2);
    ctx.arc(38, 12, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function hill(par, h, gap) {
    const base = VIEW_H - 70;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = -40; x <= VIEW_W + 40; x += 8) {
      const wx = x + cam.x * par;
      const y = base - Math.abs(Math.sin(wx / gap)) * 90 * h - 30 * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.fill();
  }

  function drawTiles() {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const x1 = Math.min(MAP_W - 1, Math.floor((cam.x + VIEW_W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const y1 = Math.min(MAP_H - 1, Math.floor((cam.y + VIEW_H) / TILE) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const id = world.grid[ty][tx];
        if (!id) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        if (id === T_GRASS) {
          ctx.fillStyle = COL.dirt;
          ctx.fillRect(x, y + 12, TILE, TILE - 12);
          ctx.fillStyle = COL.grass;
          roundRect(x - 1, y, TILE + 2, 18, 6);
          ctx.fill();
          ctx.strokeStyle = COL.line;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.fillStyle = COL.grassDark;
          ctx.fillRect(x + 8, y + 6, 6, 4);
          ctx.fillRect(x + 22, y + 7, 8, 4);
        } else if (id === T_DIRT) {
          ctx.fillStyle = COL.dirt;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = COL.dirtDark;
          ctx.globalAlpha = 0.25;
          ctx.fillRect(x + 10, y + 14, 8, 6);
          ctx.fillRect(x + 24, y + 6, 6, 6);
          ctx.globalAlpha = 1;
        } else if (id === T_BRICK) {
          ctx.fillStyle = COL.brick;
          roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 6);
          ctx.fill();
          ctx.strokeStyle = COL.line;
          ctx.lineWidth = 2.4;
          ctx.stroke();
          ctx.strokeStyle = "rgba(58,36,24,0.25)";
          ctx.beginPath();
          ctx.moveTo(x + 8, y + TILE / 2);
          ctx.lineTo(x + TILE - 8, y + TILE / 2);
          ctx.stroke();
        } else if (id === T_Q || id === T_QUSED) {
          ctx.fillStyle = id === T_Q ? "#f0c45c" : "#d3b07a";
          roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
          ctx.fill();
          ctx.strokeStyle = COL.line;
          ctx.lineWidth = 2.6;
          ctx.stroke();
          ctx.fillStyle = COL.line;
          ctx.font = "700 22px Fredoka, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(id === T_Q ? "?" : "•", x + TILE / 2, y + TILE / 2 + 1);
        } else if (id === T_WOOD) {
          ctx.fillStyle = COL.wood;
          roundRect(x + 1, y + 2, TILE - 2, 14, 7);
          ctx.fill();
          ctx.strokeStyle = COL.line;
          ctx.lineWidth = 2.3;
          ctx.stroke();
        } else if (id === T_PIPE) {
          const top = ty === 0 || world.grid[ty - 1][tx] !== T_PIPE;
          ctx.fillStyle = COL.pipe;
          if (top && (tx === 0 || world.grid[ty][tx - 1] !== T_PIPE)) {
            roundRect(x - 4, y, TILE * 2 + 8, 18, 6);
            ctx.fill();
            ctx.strokeStyle = COL.line;
            ctx.lineWidth = 2.6;
            ctx.stroke();
            ctx.fillStyle = "#2d6b2d";
            roundRect(x + 8, y + 6, TILE * 2 - 16, 8, 4);
            ctx.fill();
          }
          if (!top && (tx === 0 || world.grid[ty][tx - 1] !== T_PIPE)) {
            ctx.fillStyle = COL.pipe;
            ctx.fillRect(x + 2, y, TILE * 2 - 4, TILE + 1);
            ctx.strokeStyle = COL.line;
            ctx.lineWidth = 2.4;
            ctx.strokeRect(x + 2, y - 1, TILE * 2 - 4, TILE + 2);
            ctx.fillStyle = COL.pipeDark;
            ctx.fillRect(x + 10, y, 8, TILE);
          }
        } else if (id === T_FLAG && (tx === 0 || world.grid[ty][tx - 1] !== T_FLAG) && (ty === 0 || world.grid[ty - 1][tx] !== T_FLAG)) {
          ctx.fillStyle = "#e8d9b0";
          ctx.fillRect(x + 16, y, 7, 11 * TILE);
          ctx.strokeStyle = COL.line;
          ctx.lineWidth = 2.2;
          ctx.strokeRect(x + 16, y, 7, 11 * TILE);
          ctx.fillStyle = COL.pink;
          ctx.beginPath();
          ctx.moveTo(x + 23, y + 8);
          ctx.lineTo(x + 58, y + 24);
          ctx.lineTo(x + 23, y + 40);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  function drawWorldFx() {
    particles.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.c === "coin") {
        ctx.fillStyle = COL.coin;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    floaters.forEach((f) => {
      ctx.globalAlpha = clamp(f.life / 0.7, 0, 1);
      ctx.fillStyle = COL.line;
      ctx.font = "700 16px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });
  }

  function drawBanner() {
    if (banner.t <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(banner.t * 2, 0, 1);
    ctx.fillStyle = "rgba(255,250,236,0.9)";
    roundRect(VIEW_W / 2 - 90, 70, 180, 44, 16);
    ctx.fill();
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = COL.line;
    ctx.font = "700 22px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(banner.text, VIEW_W / 2, 93);
    ctx.restore();
  }

  function worldToScreen() {
    const sx = Math.round(shake ? (Math.random() - 0.5) * shake : 0);
    const sy = Math.round(shake ? (Math.random() - 0.5) * shake : 0);
    ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    ctx.save();
    worldToScreen();
    drawTiles();
    world.coins.forEach((c) => {
      if (!c.taken) drawCoin(c);
    });
    world.enemies.forEach(drawEnemy);
    const flash = invuln > 0 && Math.floor(player.t * 8) % 2 === 0;
    ctx.save();
    if (flash) ctx.globalAlpha = 0.7;
    (player.trail || []).forEach((t) => {
      ctx.save();
      ctx.globalAlpha *= Math.max(0.12, t.t / 0.14) * 0.35;
      drawUsagi(t.x, t.y, {
        facing: t.facing,
        sx: t.sx,
        sy: t.sy,
        bob: t.bob,
        tilt: t.tilt,
        pose: "run",
      });
      ctx.restore();
    });
    drawUsagi(player.x + player.w / 2, player.y + player.h, {
      facing: player.facing,
      sx: player.sx,
      sy: player.sy,
      bob: player.bob,
      earL: player.earL,
      earR: player.earR,
      blink: player.blink,
      run: player.run,
      tilt: player.tilt,
      pose: player.pose,
    });
    ctx.restore();
    drawWorldFx();
    ctx.restore();
    drawBanner();
  }

  function refreshHud() {
    document.getElementById("hud-coins").textContent = coins;
    document.getElementById("hud-lives").textContent = "×" + lives;
    document.getElementById("hud-score").textContent = pad(score, 6);
  }

  function startGame() {
    ensureAudio();
    if (audio && audio.state === "suspended") audio.resume();
    world = buildWorld();
    player = makePlayer(world.spawn.x, world.spawn.y);
    cam.x = 0;
    cam.y = 0;
    particles = [];
    floaters = [];
    score = 0;
    coins = 0;
    lives = 3;
    invuln = 0.9;
    banner = { text: "世界 1-1", t: 2 };
    state = "play";
    overlay.hidden = true;
    overlay.inert = true;
    hud.hidden = false;
    controls.hidden = false;
    refreshHud();
  }

  function showEnd(win) {
    state = "end";
    overlay.hidden = false;
    overlay.inert = false;
    cardTitle.hidden = true;
    cardEnd.hidden = false;
    document.getElementById("end-title").textContent = win ? "過關！" : "遊戲結束";
    document.getElementById("end-msg").textContent = win ? "兔兔跑到終點旗了" : "掉下去或碰到敵人就會失敗";
    document.getElementById("end-score").textContent = "分數 " + pad(score, 6) + "　金幣 " + coins;
    controls.hidden = true;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(VIEW_W * dpr);
    canvas.height = Math.floor(VIEW_H * dpr);
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = Math.round(VIEW_W * scale) + "px";
    canvas.style.height = Math.round(VIEW_H * scale) + "px";
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (state === "play") {
      updatePlayer(player, dt);
      updateEnemies(dt);
      updateCoins(dt);
      updateFlag();
      updateFx(dt);
      updateCamera(dt);
      render();
    } else if (state === "title") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground();
    } else {
      render();
    }
    requestAnimationFrame(loop);
  }

  function bindButton(el, on, off) {
    const down = (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      el.classList.add("is-down");
      on();
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove("is-down");
      off();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
  }

  bindButton(
    document.getElementById("btn-left"),
    () => (input.left = true),
    () => (input.left = false)
  );
  bindButton(
    document.getElementById("btn-right"),
    () => (input.right = true),
    () => (input.right = false)
  );
  bindButton(
    document.getElementById("btn-jump"),
    () => {
      input.jumpHeld = true;
      input.jumpPressed = true;
    },
    () => (input.jumpHeld = false)
  );

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", " "].includes(e.key) || e.code === "Space") e.preventDefault();
    if (e.repeat) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") input.left = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") input.right = true;
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") input.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") input.right = true;
    if (e.key === " " || e.code === "Space" || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "z" || e.key === "k") {
      input.jumpHeld = true;
      input.jumpPressed = true;
    }
    if ((e.key === "Enter" || e.code === "Space") && state !== "play") {
      if (state === "title") startGame();
      if (state === "end") startGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") input.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") input.right = false;
    if (e.key === " " || e.code === "Space" || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "z" || e.key === "k") {
      input.jumpHeld = false;
    }
  });

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-again").addEventListener("click", startGame);
  window.addEventListener("resize", resize);
  window.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  resize();
  if (/autostart=1/.test(location.search)) {
    startGame();
    input.right = true;
    setTimeout(() => {
      input.jumpPressed = true;
      input.jumpHeld = true;
      setTimeout(() => {
        input.jumpHeld = false;
      }, 220);
    }, 2600);
  }
  requestAnimationFrame(loop);
})();
