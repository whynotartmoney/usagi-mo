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
    hill1: "#9fd18a",
    hill2: "#7fbf6a",
    name: "meadow",
  };

  const THEMES = {
    meadow: {
      skyTop: "#b9e4f8",
      skyBot: "#8ec8ea",
      grass: "#7fbf4a",
      grassDark: "#5d9a32",
      dirt: "#c9955a",
      dirtDark: "#a8743e",
      brick: "#e8b86a",
      wood: "#d9a066",
      pipe: "#5aae5a",
      pipeDark: "#3e8a3e",
      hill1: "#9fd18a",
      hill2: "#7fbf6a",
      skyTop: "#b9e4f8",
      skyBot: "#8ec8ea",
      name: "meadow",
    },
    volcano: {
      skyTop: "#ffc48a",
      skyBot: "#e07048",
      grass: "#5a4638",
      grassDark: "#3a2c22",
      dirt: "#3d2a22",
      dirtDark: "#2a1c16",
      brick: "#c45c38",
      wood: "#8a5340",
      pipe: "#6a4030",
      pipeDark: "#4a2c20",
      hill1: "#8a4030",
      hill2: "#5c281c",
      skyTop: "#ffc48a",
      skyBot: "#e07048",
      name: "volcano",
    },
    carnival: {
      skyTop: "#ffe9a8",
      skyBot: "#ffb7d5",
      grass: "#7ed957",
      grassDark: "#4caf50",
      dirt: "#f0c878",
      dirtDark: "#d4a24c",
      brick: "#ff8fab",
      wood: "#7ec8e3",
      pipe: "#ff6b9a",
      pipeDark: "#e0487a",
      hill1: "#c9b6ff",
      hill2: "#80d0c7",
      skyTop: "#ffe9a8",
      skyBot: "#ffb7d5",
      name: "carnival",
    },
    kandinsky: {
      skyTop: "#f4e4c4",
      skyBot: "#d4c4e8",
      grass: "#1c1c1c",
      grassDark: "#111",
      dirt: "#2a2a2a",
      dirtDark: "#151515",
      brick: "#e23d28",
      wood: "#2b6cff",
      pipe: "#f0c000",
      pipeDark: "#c49200",
      hill1: "#3d5cff",
      hill2: "#e23d28",
      skyTop: "#f4e4c4",
      skyBot: "#c8b8e0",
      name: "kandinsky",
    },
    sky: {
      skyTop: "#c8f0ff",
      skyBot: "#8ec8f8",
      grass: "#d8f0c8",
      grassDark: "#b4dc9a",
      dirt: "#f2e6c4",
      dirtDark: "#e0d0a0",
      brick: "#fff3a0",
      wood: "#ffffff",
      pipe: "#7ec8e3",
      pipeDark: "#5aa8c8",
      hill1: "#e8f8ff",
      hill2: "#b8e0ff",
      skyTop: "#c8f0ff",
      skyBot: "#9ad4f8",
      name: "sky",
    },
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
  const T_LAVA = 9;

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
  let level = 0;
  const LEVEL_COUNT = 5;
  const LEVEL_LABELS = ["1-1", "1-2", "1-3", "1-4", "1-5"];
  let jumpPool = [];

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
  function playJumpSfx() {
    try {
      let a = jumpPool.find((s) => s.paused || s.ended);
      if (!a) {
        a = new Audio("assets/sfx/yaha.m4a");
        a.preload = "auto";
        jumpPool.push(a);
      }
      a.currentTime = 0;
      a.volume = 0.9;
      a.play().catch(() => {
        if (audio) {
          beep(420, 0.12, "square", 0.05);
          beep(620, 0.08, "square", 0.03);
        }
      });
    } catch {
      if (audio) beep(420, 0.12, "square", 0.05);
    }
  }
  function sfx(name) {
    if (name === "jump") {
      playJumpSfx();
      return;
    }
    if (!audio) return;
    if (name === "coin") {
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
  function lavaPit(g, x0, x1) {
    fill(g, x0, 12, x1 - x0, MAP_H - 12, T_LAVA);
  }
  function pipe(g, x, h) {
    const top = 12 - h;
    fill(g, x, top, 2, h, T_PIPE);
  }
  function walker(x, dir, extra) {
    const gy = 12 * TILE;
    const eh = extra && extra.h ? extra.h : 28;
    return Object.assign(
      { type: "walk", x: x * TILE, y: gy - eh, w: 30, h: eh, vx: dir, alive: true, squash: 1, t: 0 },
      extra || {}
    );
  }
  function fishAt(tx, extra) {
    const homeY = 12 * TILE - 6;
    return Object.assign(
      {
        type: "fish",
        x: tx * TILE + 6,
        y: homeY,
        homeY,
        w: 34,
        h: 26,
        vx: 0,
        vy: 0,
        jumpT: 0.4 + Math.random() * 1.4,
        alive: true,
        squash: 1,
        t: 0,
      },
      extra || {}
    );
  }
  function dinoAt(x, dir) {
    const gy = 12 * TILE;
    const eh = 36;
    return { type: "dino", x: x * TILE, y: gy - eh, w: 38, h: eh, vx: dir, alive: true, squash: 1, t: 0 };
  }
  function addCoins(list, arr) {
    arr.forEach(([tx, ty]) => list.push({ x: tx * TILE + 10, y: ty * TILE + 10, w: 20, h: 20, taken: false, t: Math.random() * 6 }));
  }
  function flagAt(tx) {
    return { x: tx * TILE + 8, y: 1 * TILE, w: 24, h: 11 * TILE, taken: false, slideDone: false };
  }

  function buildLevel(i) {
    if (i === 1) return buildVolcano();
    if (i === 2) return buildCarnival();
    if (i === 3) return buildKandinsky();
    if (i === 4) return buildSky();
    return buildMeadow();
  }

  function buildMeadow() {
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

    const coins = [];
    addCoins(coins, [
      [6, 11], [7, 11], [8, 11], [13, 11], [14, 11],
      [9, 6], [11, 6], [18, 6], [19, 6],
      [29, 7], [30, 7],
      [51, 6], [52, 6], [53, 6], [54, 3], [55, 3], [56, 3],
      [70, 7], [71, 7], [72, 7], [73, 7],
      [86, 10], [87, 9], [88, 8], [89, 7],
      [120, 6], [122, 6],
      [132, 10], [133, 10], [134, 10],
    ]);
    return {
      theme: "meadow",
      title: "世界 1-1",
      grid,
      coins,
      enemies: [walker(42, 50), walker(62, -50), walker(74, 55), walker(90, -45), walker(110, 50)],
      flag: flagAt(138),
      spawn: { x: 2.5 * TILE, y: 12 * TILE - 34 },
      checks: [3 * TILE, 54 * TILE, 84 * TILE, 118 * TILE],
    };
  }

  function buildVolcano() {
    const grid = makeGrid();
    ground(grid, 0, 16);
    lavaPit(grid, 16, 24);
    ground(grid, 24, 42);
    lavaPit(grid, 42, 52);
    ground(grid, 52, 70);
    lavaPit(grid, 70, 80);
    ground(grid, 80, 102);
    lavaPit(grid, 102, 110);
    ground(grid, 110, MAP_W);

    fill(grid, 18, 9, 3, 1, T_WOOD);
    fill(grid, 21, 6, 3, 1, T_WOOD);
    fill(grid, 44, 9, 4, 1, T_WOOD);
    fill(grid, 48, 6, 3, 1, T_WOOD);
    fill(grid, 72, 9, 4, 1, T_WOOD);
    fill(grid, 76, 5, 3, 1, T_WOOD);
    fill(grid, 104, 9, 3, 1, T_WOOD);

    fill(grid, 8, 8, 1, 1, T_BRICK);
    fill(grid, 9, 8, 1, 1, T_Q);
    fill(grid, 10, 8, 1, 1, T_BRICK);
    fill(grid, 32, 8, 1, 1, T_Q);
    fill(grid, 33, 8, 1, 1, T_BRICK);
    fill(grid, 58, 8, 1, 1, T_Q);
    fill(grid, 90, 8, 2, 1, T_BRICK);
    fill(grid, 92, 8, 1, 1, T_Q);
    pipe(grid, 36, 2);
    pipe(grid, 96, 3);
    for (let i = 0; i < 4; i++) fill(grid, 124 + i, 12 - i, 1, i + 1, T_BRICK);
    fill(grid, 138, 1, 1, 11, T_FLAG);

    const coins = [];
    addCoins(coins, [
      [5, 11], [6, 11], [7, 11],
      [18, 7], [19, 7], [21, 4], [22, 4],
      [32, 6], [44, 7], [45, 7], [46, 7], [48, 4],
      [58, 6], [72, 7], [73, 7], [76, 3],
      [90, 6], [92, 6], [104, 7], [105, 7],
      [130, 10], [131, 9], [132, 8],
    ]);
    return {
      theme: "volcano",
      title: "世界 1-2 火山",
      grid,
      coins,
      enemies: [
        walker(28, 50),
        walker(60, -50),
        walker(88, 55),
        fishAt(19),
        fishAt(22, { jumpT: 1.1 }),
        fishAt(45),
        fishAt(49, { jumpT: 0.8 }),
        fishAt(74, { jumpT: 0.3 }),
        fishAt(77, { jumpT: 1.4 }),
        fishAt(106, { jumpT: 0.6 }),
      ],
      flag: flagAt(138),
      spawn: { x: 2.5 * TILE, y: 12 * TILE - 34 },
      checks: [3 * TILE, 52 * TILE, 80 * TILE, 118 * TILE],
    };
  }

  function buildCarnival() {
    const grid = makeGrid();
    ground(grid, 0, 52);
    ground(grid, 68, MAP_W);

    fill(grid, 10, 8, 1, 1, T_BRICK);
    fill(grid, 11, 8, 1, 1, T_Q);
    fill(grid, 12, 8, 1, 1, T_BRICK);
    fill(grid, 44, 9, 4, 1, T_WOOD);
    fill(grid, 46, 6, 2, 1, T_WOOD);
    fill(grid, 50, 8, 3, 1, T_WOOD);
    fill(grid, 67, 8, 3, 1, T_WOOD);
    pipe(grid, 36, 2);
    fill(grid, 78, 9, 3, 1, T_WOOD);
    fill(grid, 90, 8, 1, 1, T_Q);
    fill(grid, 91, 8, 2, 1, T_BRICK);
    pipe(grid, 100, 2);
    for (let i = 0; i < 5; i++) fill(grid, 122 + i, 12 - i, 1, i + 1, T_BRICK);
    fill(grid, 138, 1, 1, 11, T_FLAG);

    const coins = [];
    addCoins(coins, [
      [6, 11], [7, 11], [8, 11], [11, 6],
      [42, 11], [43, 11], [44, 7], [46, 4],
      [78, 7], [79, 7], [90, 6],
      [124, 10], [125, 9], [132, 10],
    ]);
    return {
      theme: "carnival",
      title: "世界 1-3 遊樂場",
      grid,
      coins,
      enemies: [dinoAt(28, 48), dinoAt(88, -42), walker(110, 50)],
      flag: flagAt(138),
      spawn: { x: 2.5 * TILE, y: 12 * TILE - 34 },
      checks: [3 * TILE, 44 * TILE, 80 * TILE, 118 * TILE],
      wheel: {
        cx: 60 * TILE,
        cy: 6.35 * TILE,
        r: 188,
        rot: 0,
        speed: 0.42,
        cars: [
          { kind: "empty" },
          { kind: "coin" },
          { kind: "monster" },
          { kind: "empty" },
          { kind: "coin" },
          { kind: "monster" },
          { kind: "empty" },
          { kind: "monster" },
        ],
      },
    };
  }

  function buildKandinsky() {
    const grid = makeGrid();
    ground(grid, 0, 20);
    ground(grid, 24, 46);
    ground(grid, 50, 72);
    ground(grid, 76, 104);
    ground(grid, 108, MAP_W);

    fill(grid, 8, 8, 1, 1, T_Q);
    fill(grid, 9, 8, 1, 1, T_BRICK);
    fill(grid, 21, 9, 3, 1, T_WOOD);
    fill(grid, 28, 6, 3, 1, T_WOOD);
    fill(grid, 40, 8, 1, 1, T_Q);
    fill(grid, 47, 8, 3, 1, T_WOOD);
    fill(grid, 58, 5, 3, 1, T_WOOD);
    pipe(grid, 64, 2);
    fill(grid, 80, 8, 2, 1, T_BRICK);
    fill(grid, 82, 8, 1, 1, T_Q);
    fill(grid, 92, 9, 4, 1, T_WOOD);
    for (let i = 0; i < 4; i++) fill(grid, 126 + i, 12 - i, 1, i + 1, T_BRICK);
    fill(grid, 138, 1, 1, 11, T_FLAG);

    const coins = [];
    addCoins(coins, [
      [6, 11], [7, 11], [8, 6], [21, 7], [22, 7], [28, 4], [29, 4],
      [40, 6], [47, 6], [58, 3], [82, 6], [92, 7], [93, 7],
      [128, 10], [129, 9],
    ]);
    const hazards = [
      { type: "spike", x: 18 * TILE, base: 8 * TILE, y: 8 * TILE, w: 28, h: 36, t: 0, spd: 2.2, amp: 50, axis: "y" },
      { type: "spike", x: 34 * TILE, base: 7 * TILE, y: 7 * TILE, w: 28, h: 36, t: 1.1, spd: 2.6, amp: 62, axis: "y" },
      { type: "spike", x: 54 * TILE, base: 9 * TILE, y: 9 * TILE, w: 28, h: 36, t: 0.4, spd: 1.8, amp: 44, axis: "y" },
      { type: "spike", x: 70 * TILE, base: 6 * TILE, y: 6 * TILE, w: 32, h: 40, t: 0.8, spd: 2.4, amp: 70, axis: "y" },
      { type: "spike", x: 98 * TILE, base: 8 * TILE, y: 8 * TILE, w: 28, h: 36, t: 1.6, spd: 2.0, amp: 55, axis: "y" },
      { type: "fireball", x: 26 * TILE, y: 4 * TILE, w: 22, h: 22, vx: 90, vy: 0, t: 0 },
      { type: "fireball", x: 62 * TILE, y: 3 * TILE, w: 22, h: 22, vx: -80, vy: -40, t: 0.5 },
      { type: "fireball", x: 88 * TILE, y: 5 * TILE, w: 22, h: 22, vx: 110, vy: 20, t: 1 },
    ];
    return {
      theme: "kandinsky",
      title: "世界 1-4 康丁斯基",
      grid,
      coins,
      enemies: [walker(30, 55), walker(60, -50), walker(86, 45)],
      hazards,
      flag: flagAt(138),
      spawn: { x: 2.5 * TILE, y: 12 * TILE - 34 },
      checks: [3 * TILE, 50 * TILE, 76 * TILE, 118 * TILE],
    };
  }

  function buildSky() {
    const grid = makeGrid();
    ground(grid, 0, 18);
    ground(grid, 36, 52);
    ground(grid, 70, 88);
    ground(grid, 116, MAP_W);

    fill(grid, 8, 8, 1, 1, T_Q);
    fill(grid, 20, 9, 4, 1, T_WOOD);
    fill(grid, 28, 6, 4, 1, T_WOOD);
    fill(grid, 42, 8, 1, 1, T_Q);
    fill(grid, 54, 7, 4, 1, T_WOOD);
    fill(grid, 62, 4, 3, 1, T_WOOD);
    fill(grid, 78, 8, 2, 1, T_BRICK);
    fill(grid, 92, 6, 4, 1, T_WOOD);
    fill(grid, 102, 3, 3, 1, T_WOOD);
    for (let i = 0; i < 4; i++) fill(grid, 124 + i, 12 - i, 1, i + 1, T_BRICK);
    fill(grid, 138, 1, 1, 11, T_FLAG);

    const coins = [];
    addCoins(coins, [
      [6, 11], [7, 11], [8, 6], [20, 7], [21, 7], [28, 4], [29, 4],
      [42, 6], [54, 5], [55, 5], [62, 2], [78, 6], [92, 4], [102, 1],
      [126, 10], [127, 9],
    ]);
    const balloons = [
      { x: 20 * TILE, y: 8.2 * TILE, w: 48, h: 16, base: 8.2 * TILE, t: 0 },
      { x: 26 * TILE, y: 5.6 * TILE, w: 48, h: 16, base: 5.6 * TILE, t: 1.2 },
      { x: 32 * TILE, y: 7.4 * TILE, w: 48, h: 16, base: 7.4 * TILE, t: 0.5 },
      { x: 54 * TILE, y: 8 * TILE, w: 52, h: 16, base: 8 * TILE, t: 0.4 },
      { x: 60 * TILE, y: 5.2 * TILE, w: 48, h: 16, base: 5.2 * TILE, t: 1.6 },
      { x: 66 * TILE, y: 7.6 * TILE, w: 52, h: 16, base: 7.6 * TILE, t: 2 },
      { x: 90 * TILE, y: 8 * TILE, w: 48, h: 16, base: 8 * TILE, t: 0.8 },
      { x: 98 * TILE, y: 5.4 * TILE, w: 52, h: 16, base: 5.4 * TILE, t: 1.4 },
      { x: 106 * TILE, y: 7.2 * TILE, w: 52, h: 16, base: 7.2 * TILE, t: 0.2 },
    ];
    return {
      theme: "sky",
      title: "世界 1-5 天空之城",
      grid,
      coins,
      enemies: [
        { type: "bird", x: 24 * TILE, y: 5 * TILE, w: 34, h: 24, vx: 70, homeX: 24 * TILE, baseY: 5 * TILE, amp: 36, alive: true, squash: 1, t: 0 },
        { type: "bird", x: 48 * TILE, y: 3 * TILE, w: 34, h: 24, vx: -60, homeX: 48 * TILE, baseY: 3.2 * TILE, amp: 44, alive: true, squash: 1, t: 0.6 },
        { type: "bird", x: 76 * TILE, y: 4 * TILE, w: 34, h: 24, vx: 80, homeX: 76 * TILE, baseY: 4.4 * TILE, amp: 50, alive: true, squash: 1, t: 1.1 },
        { type: "bird", x: 100 * TILE, y: 2.5 * TILE, w: 34, h: 24, vx: -70, homeX: 100 * TILE, baseY: 3 * TILE, amp: 40, alive: true, squash: 1, t: 0.2 },
        walker(40, 50),
        walker(80, -45),
      ],
      balloons,
      flag: flagAt(138),
      spawn: { x: 2.5 * TILE, y: 12 * TILE - 34 },
      checks: [3 * TILE, 52 * TILE, 88 * TILE, 118 * TILE],
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
      flagging: false,
      flagDone: false,
      ride: null,
    };
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T_EMPTY;
    return world.grid[ty][tx];
  }
  function solid(v) {
    return v > 0 && v !== T_FLAG && v !== T_LAVA;
  }
  function touchesLava(p) {
    const samples = [
      [p.x + 4, p.y + p.h - 2],
      [p.x + p.w / 2, p.y + p.h - 2],
      [p.x + p.w - 4, p.y + p.h - 2],
    ];
    return samples.some(([x, y]) => tileAt(x, y) === T_LAVA);
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
    if (p.ride != null) return;
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

  function wheelCars() {
    const w = world && world.wheel;
    if (!w) return [];
    const n = w.cars.length;
    return w.cars.map((car, i) => {
      const a = w.rot + (i * Math.PI * 2) / n;
      const hx = w.cx + Math.cos(a) * w.r;
      const hy = w.cy + Math.sin(a) * w.r;
      const cw = 38;
      const ch = 24;
      return {
        kind: car.kind,
        taken: !!car.taken,
        i,
        a,
        hx,
        hy,
        x: hx - cw / 2,
        y: hy + 10,
        w: cw,
        h: ch,
      };
    });
  }

  function updateWheel(dt) {
    const w = world.wheel;
    if (!w) return;
    w.rot += w.speed * dt;
  }

  function tryBoardWheel(p) {
    if (!world.wheel || p.ride != null || p.dead || p.win || p.flagging) return;
    const cars = wheelCars();
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const overlapX = p.x + p.w > car.x + 4 && p.x < car.x + car.w - 4;
      const feet = p.y + p.h;
      const onSeat = overlapX && feet > car.y - 4 && feet < car.y + 16 && p.y < car.y + 4;
      if (car.kind === "monster") {
        if (aabb(p, car) && invuln <= 0) {
          const dir = p.x + p.w / 2 < car.x + car.w / 2 ? -1 : 1;
          hitPlayer(dir * 340);
        }
        continue;
      }
      if (onSeat && (p.vy > 12 || p.grounded)) {
        p.ride = car.i;
        p.vx = 0;
        p.vy = 0;
        p.grounded = true;
        if (car.kind === "coin" && !world.wheel.cars[car.i].taken) {
          world.wheel.cars[car.i].taken = true;
          coins += 1;
          score += 100;
          sfx("coin");
          addFloater(car.x + car.w / 2, car.y, "+100");
          refreshHud();
        }
        return;
      }
    }
  }

  function rideWheel(p, dt) {
    const cars = wheelCars();
    const car = cars[p.ride];
    if (!car || car.kind === "monster") {
      p.ride = null;
      return false;
    }
    p.x = car.x + (car.w - p.w) / 2;
    p.y = car.y - p.h + 4;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.wasAir = false;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.facing = dir;
    if (input.jumpPressed) {
      p.ride = null;
      p.vy = JUMP_VEL;
      p.vx = p.facing * 200;
      p.grounded = false;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpHeld = true;
      p.sx = 1.28;
      p.sy = 0.68;
      input.jumpPressed = false;
      sfx("jump");
    }
    updateAnim(p, dt);
    return true;
  }

  function updateBalloons(dt) {
    (world.balloons || []).forEach((b) => {
      b.t += dt;
      const prev = b.y;
      b.y = b.base + Math.sin(b.t * 1.45) * 16;
      b.dy = b.y - prev;
    });
  }

  function collideBalloons(p) {
    if (p.vy < -20 || p.ride != null) return;
    (world.balloons || []).forEach((b) => {
      const overlapX = p.x + p.w > b.x + 8 && p.x < b.x + b.w - 8;
      const feet = p.y + p.h;
      if (overlapX && feet >= b.y && feet <= b.y + 18 && p.y < b.y) {
        p.y = b.y - p.h + (b.dy || 0);
        p.vy = 0;
        p.grounded = true;
      }
    });
  }

  function updateHazards(dt) {
    (world.hazards || []).forEach((h) => {
      h.t += dt;
      if (h.type === "spike") {
        h.y = h.base + Math.sin(h.t * h.spd) * h.amp;
      } else if (h.type === "fireball") {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.vy += 420 * dt;
        const floor = 12 * TILE - 8;
        if (h.y + h.h > floor) {
          h.y = floor - h.h;
          h.vy *= -0.92;
        }
        if (h.y < 24) {
          h.y = 24;
          h.vy = Math.abs(h.vy);
        }
        if (h.x < 8) {
          h.x = 8;
          h.vx = Math.abs(h.vx);
        } else if (h.x + h.w > MAP_W * TILE - 8) {
          h.x = MAP_W * TILE - 8 - h.w;
          h.vx = -Math.abs(h.vx);
        }
        if (solid(tileAt(h.x + h.w / 2, h.y + h.h + 2)) && h.vy > 0) h.vy *= -1;
        if (solid(tileAt(h.x + h.w / 2, h.y - 2)) && h.vy < 0) h.vy *= -1;
      }
      if (invuln > 0 || player.dead || player.win || player.flagging) return;
      if (aabb(player, h)) {
        const dir = player.x + player.w / 2 < h.x + h.w / 2 ? -1 : 1;
        hitPlayer(dir * 320);
      }
    });
  }

  function updatePlayer(p, dt) {
    p.t += dt;
    if (p.flagging) {
      p.vx = 0;
      p.x = world.flag.x + 2;
      p.facing = 1;
      p.pose = "jump";
      const groundY = 12 * TILE - p.h;
      if (p.y < groundY) {
        p.vy = 220;
        p.y = Math.min(groundY, p.y + p.vy * dt);
      } else {
        p.y = groundY;
        p.vy = 0;
        p.pose = "win";
        p.sx = 1;
        p.sy = 1;
        p.bob = Math.abs(Math.sin(p.t * 8)) * 6;
        if (!p.flagDone) {
          p.flagDone = true;
          setTimeout(() => finishFlag(), 700);
        }
      }
      return;
    }
    if (p.dead || p.win) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      updateAnim(p, dt);
      return;
    }
    if (p.ride != null && rideWheel(p, dt)) return;

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
    collideBalloons(p);
    tryBoardWheel(p);
    p.x = clamp(p.x, 0, MAP_W * TILE - p.w - TILE);

    if (p.grounded) p.coyote = COYOTE;
    else p.coyote -= dt;
    p.buffer -= dt;
    tryJump(p);

    if (touchesLava(p) || p.y > MAP_H * TILE + 20) die("pit");

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

      if (e.type === "fish") {
        e.jumpT -= dt;
        if (e.y >= e.homeY - 1 && e.vy >= 0) {
          e.y = e.homeY;
          e.vy = 0;
          if (e.jumpT <= 0) {
            e.vy = -760 - Math.random() * 80;
            e.jumpT = 1.6 + Math.random() * 1.2;
          }
        } else {
          e.vy += 1650 * dt;
          e.y += e.vy * dt;
          if (e.y > e.homeY) {
            e.y = e.homeY;
            e.vy = 0;
          }
        }
      } else if (e.type === "bird") {
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 2.35) * e.amp;
        const home = e.homeX != null ? e.homeX : e.x;
        if (e.x > home + 220 || e.x < home - 220) e.vx *= -1;
      } else {
        e.x += e.vx * dt;
        const front = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const foot = e.x + (e.vx > 0 ? e.w - 4 : 4);
        if (solid(tileAt(front, e.y + e.h * 0.5)) || !solid(tileAt(foot, e.y + e.h + 4))) e.vx *= -1;
        const ty = Math.floor((e.y + e.h + 2) / TILE);
        if (solid(tileAt(e.x + e.w / 2, e.y + e.h + 2))) e.y = ty * TILE - e.h;
      }

      if (invuln > 0 || player.dead || player.win || player.flagging || player.ride != null) return;
      if (!aabb(player, e)) return;

      const feet = player.y + player.h;
      const fromAbove =
        e.type === "fish"
          ? player.vy > 18 && feet < e.y + e.h * 0.7
          : player.vy > 60 && feet - e.y < 22;
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

  function flagScoreFor(p) {
    const top = world.flag.y;
    const bot = world.flag.y + world.flag.h;
    const mid = p.y + p.h * 0.5;
    const t = clamp(1 - (mid - top) / (bot - top), 0, 1);
    if (t >= 0.82) return 5000;
    if (t >= 0.64) return 2000;
    if (t >= 0.46) return 800;
    if (t >= 0.28) return 400;
    if (t >= 0.12) return 200;
    return 100;
  }

  function updateFlag() {
    if (world.flag.taken || player.dead || player.flagging) return;
    if (aabb(player, world.flag)) {
      const pts = flagScoreFor(player);
      world.flag.taken = true;
      player.flagging = true;
      player.vx = 0;
      player.vy = 0;
      score += pts;
      addFloater(world.flag.x + 20, player.y, "+" + pts);
      sfx("win");
      refreshHud();
    }
  }

  function finishFlag() {
    if (state !== "play") return;
    if (level + 1 < LEVEL_COUNT) {
      loadLevel(level + 1);
    } else {
      player.win = true;
      player.flagging = false;
      setTimeout(() => showEnd(true), 400);
    }
  }

  function hitPlayer(kx) {
    if (invuln > 0 || player.dead) return;
    player.ride = null;
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
    player.ride = null;
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
    if (e.type === "fish") {
      drawFish(e);
      return;
    }
    if (e.type === "dino") {
      drawDino(e);
      return;
    }
    if (e.type === "bird") {
      drawBird(e);
      return;
    }
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

  function drawFish(e) {
    const x = e.x + e.w / 2;
    const y = e.y + e.h;
    const rising = e.vy < -40;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(e.alive ? 1 : 1, e.alive ? 1 : e.squash);
    ctx.rotate(rising ? -0.35 : e.vy > 40 ? 0.4 : 0);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = COL.line;
    ctx.fillStyle = "#ff8a6a";
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-32, -18);
    ctx.lineTo(-32, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb4a0";
    ctx.beginPath();
    ctx.ellipse(2, -14, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd0c0";
    ctx.beginPath();
    ctx.ellipse(8, -16, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.eye;
    ctx.beginPath();
    ctx.ellipse(10, -16, 2.4, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(10.8, -17, 0.9, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(14, -12, 3, 0.2, 1.2);
    ctx.stroke();
    ctx.fillStyle = "#ff6b8a";
    ctx.beginPath();
    ctx.ellipse(6, -8, 4, 2.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDino(e) {
    const x = e.x + e.w / 2;
    const y = e.y + e.h;
    const walk = Math.sin(e.t * 8) * (e.alive ? 3 : 0);
    const face = e.vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, e.alive ? 1 : e.squash);
    ctx.lineWidth = 2.7;
    ctx.strokeStyle = COL.line;
    ctx.fillStyle = "#7ecf6a";
    ctx.beginPath();
    ctx.ellipse(-8 + walk, -6, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(8 - walk, -6, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8ee07a";
    ctx.beginPath();
    ctx.ellipse(0, -20, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6bb85c";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-8 + i * 8, -34);
      ctx.lineTo(-4 + i * 8, -42);
      ctx.lineTo(0 + i * 8, -34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#b8f09a";
    ctx.beginPath();
    ctx.ellipse(12, -22, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COL.eye;
    ctx.beginPath();
    ctx.ellipse(14, -24, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(14.8, -25, 0.9, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.blush;
    ctx.beginPath();
    ctx.ellipse(10, -18, 3.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(18, -18, 3.2, 0.2, 1.1);
    ctx.stroke();
    ctx.restore();
  }

  function drawBird(e) {
    const x = e.x + e.w / 2;
    const y = e.y + e.h / 2;
    const flap = Math.sin(e.t * 12) * (e.alive ? 10 : 0);
    const face = e.vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, e.alive ? 1 : e.squash);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COL.line;
    ctx.fillStyle = "#5aa8c8";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.quadraticCurveTo(-28, -8 - flap, -8, 8);
    ctx.quadraticCurveTo(-16, 4, -2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7ec8e3";
    ctx.beginPath();
    ctx.ellipse(2, 2 + flap * 0.1, 11, 6, 0.35 + flap * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9ad8f0";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb347";
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(20, 1);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COL.eye;
    ctx.beginPath();
    ctx.ellipse(4, -3, 2.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(4.6, -3.6, 0.8, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBalloon(b) {
    const cx = b.x + b.w / 2;
    const top = b.y - 28;
    ctx.save();
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 2.2;
    ctx.fillStyle = b.w > 50 ? "#ff8fab" : "#7ec8e3";
    ctx.beginPath();
    ctx.ellipse(cx, top, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx - 5, top - 6, 5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, top + 20);
    ctx.lineTo(cx - 4, b.y + 2);
    ctx.lineTo(cx + 4, b.y + 2);
    ctx.closePath();
    ctx.fillStyle = "#fff8e0";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff3c4";
    roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHazards() {
    (world.hazards || []).forEach((h) => {
      if (h.type === "spike") {
        ctx.save();
        ctx.translate(h.x + h.w / 2, h.y + h.h);
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = COL.line;
        ctx.fillStyle = "#1c1c1c";
        ctx.beginPath();
        ctx.moveTo(-h.w / 2, 0);
        ctx.lineTo(0, -h.h);
        ctx.lineTo(h.w / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e23d28";
        ctx.beginPath();
        ctx.moveTo(-h.w / 5, -4);
        ctx.lineTo(0, -h.h + 8);
        ctx.lineTo(h.w / 5, -4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#2b6cff";
        ctx.beginPath();
        ctx.arc(-6, -10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (h.type === "fireball") {
        const pulse = 1 + Math.sin(h.t * 10) * 0.08;
        ctx.save();
        ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = "#ff6b2d";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd36a";
        ctx.beginPath();
        ctx.arc(-2, -2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff6c8";
        ctx.beginPath();
        ctx.arc(-4, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COL.line;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawWheel() {
    const w = world.wheel;
    if (!w) return;
    ctx.save();
    ctx.translate(w.cx, w.cy);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#3a2418";
    ctx.beginPath();
    ctx.arc(0, 0, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ff8fab";
    ctx.beginPath();
    ctx.arc(0, 0, w.r - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#7ec8e3";
    ctx.beginPath();
    ctx.arc(0, 0, w.r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    const cars = wheelCars();
    cars.forEach((car) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(car.hx - w.cx, car.hy - w.cy);
      ctx.strokeStyle = "#3a2418";
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2418";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "#3a2418";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(w.cx - 42, MAP_H * TILE);
    ctx.lineTo(w.cx, w.cy + 14);
    ctx.lineTo(w.cx + 42, MAP_H * TILE);
    ctx.stroke();

    cars.forEach((car) => {
      const cx = car.x + car.w / 2;
      const cy = car.y + car.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COL.line;
      if (car.kind === "monster") {
        ctx.fillStyle = "#c9b6ff";
        roundRect(-19, -12, 38, 24, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COL.eye;
        ctx.beginPath();
        ctx.ellipse(-6, -2, 3, 3.6, 0, 0, Math.PI * 2);
        ctx.ellipse(6, -2, 3, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(-5, -3.2, 1, 1.1, 0, 0, Math.PI * 2);
        ctx.ellipse(7, -3.2, 1, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff8fab";
        ctx.beginPath();
        ctx.ellipse(0, 6, 6, 3, 0, 0, Math.PI);
        ctx.fill();
      } else {
        ctx.fillStyle = car.kind === "coin" ? "#ffe27a" : "#fff8e8";
        roundRect(-19, -12, 38, 24, 8);
        ctx.fill();
        ctx.stroke();
        if (car.kind === "coin" && !car.taken) {
          ctx.fillStyle = COL.coin;
          ctx.beginPath();
          ctx.ellipse(0, 1, 7, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#c7922a";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    });
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
    const theme = (world && world.theme) || "meadow";

    if (theme === "volcano") {
      ctx.fillStyle = "rgba(255, 90, 40, 0.18)";
      for (let i = 0; i < 10; i++) {
        const cx = ((i * 180 - cam.x * 0.2 + t * 12) % (VIEW_W + 120)) - 40;
        ctx.beginPath();
        ctx.arc(cx, 30 + (i % 4) * 16, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = COL.hill1;
      volcanoHill(0.4, 1.1);
      ctx.fillStyle = COL.hill2;
      volcanoHill(0.58, 0.7);
    } else if (theme === "carnival") {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      for (let i = 0; i < 8; i++) {
        const cx = ((i * 220 - cam.x * 0.25 + t * 8) % (VIEW_W + 180)) - 60;
        cloud(cx, 36 + (i % 3) * 22, 0.55 + (i % 3) * 0.12);
      }
      ctx.fillStyle = COL.hill1;
      hill(0.45, 0.16, 200);
      ctx.fillStyle = COL.hill2;
      hill(0.62, 0.24, 150);
      drawTents();
    } else if (theme === "kandinsky") {
      drawKandinskyBg();
    } else if (theme === "sky") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 10; i++) {
        const cx = ((i * 200 - cam.x * 0.18 + t * 6) % (VIEW_W + 200)) - 80;
        cloud(cx, 28 + (i % 4) * 18, 0.5 + (i % 3) * 0.16);
      }
      ctx.fillStyle = "rgba(232,248,255,0.85)";
      hill(0.25, 0.12, 260);
      ctx.fillStyle = "rgba(184,224,255,0.7)";
      hill(0.45, 0.2, 180);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      for (let i = 0; i < 8; i++) {
        const cx = ((i * 220 - cam.x * 0.25 + t * 8) % (VIEW_W + 180)) - 60;
        const cy = 40 + (i % 3) * 28;
        cloud(cx, cy, 0.7 + (i % 3) * 0.15);
      }
      ctx.fillStyle = COL.hill1;
      hill(0.45, 0.18, 220);
      ctx.fillStyle = COL.hill2;
      hill(0.62, 0.28, 160);
    }
  }
  function drawKandinskyBg() {
    const t = player ? player.t : 0;
    const shapes = [
      { x: 120, y: 90, r: 70, c: "rgba(226,61,40,0.28)" },
      { x: 420, y: 70, r: 48, c: "rgba(43,108,255,0.3)" },
      { x: 760, y: 110, r: 86, c: "rgba(240,192,0,0.26)" },
      { x: 280, y: 200, r: 36, c: "rgba(28,28,28,0.18)" },
      { x: 640, y: 180, r: 54, c: "rgba(226,61,40,0.2)" },
      { x: 980, y: 80, r: 62, c: "rgba(43,108,255,0.22)" },
      { x: 1280, y: 140, r: 78, c: "rgba(226,61,40,0.2)" },
      { x: 1580, y: 70, r: 50, c: "rgba(240,192,0,0.24)" },
    ];
    shapes.forEach((s, i) => {
      const x = s.x - cam.x * 0.12;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(x, s.y + Math.sin(t * 0.6 + i) * 8, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(28,28,28,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    ctx.fillStyle = "rgba(43,108,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(80 - cam.x * 0.08, 320);
    ctx.lineTo(180 - cam.x * 0.08, 140);
    ctx.lineTo(260 - cam.x * 0.08, 320);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(226,61,40,0.32)";
    ctx.beginPath();
    ctx.moveTo(540 - cam.x * 0.1, 360);
    ctx.lineTo(700 - cam.x * 0.1, 160);
    ctx.lineTo(820 - cam.x * 0.1, 360);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.hill1;
    hill(0.4, 0.1, 300);
    ctx.fillStyle = COL.hill2;
    hill(0.6, 0.16, 220);
  }
  function volcanoHill(par, s) {
    const base = VIEW_H - 40;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = -40; x <= VIEW_W + 40; x += 10) {
      const wx = x + cam.x * par;
      const peak = Math.max(0, 1 - Math.abs(((wx / 280) % 2) - 1) * 2);
      ctx.lineTo(x, base - peak * 140 * s);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.fill();
  }
  function drawTents() {
    const tent = (sx, color) => {
      const x = ((sx - cam.x * 0.35) % (VIEW_W + 200)) - 40;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, VIEW_H - 90);
      ctx.lineTo(x + 36, VIEW_H - 150);
      ctx.lineTo(x + 72, VIEW_H - 90);
      ctx.closePath();
      ctx.fill();
    };
    tent(80, "rgba(255,107,154,0.55)");
    tent(320, "rgba(126,200,227,0.5)");
    tent(560, "rgba(255,213,79,0.5)");
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
        } else if (id === T_LAVA) {
          const t = player ? player.t : 0;
          const wave = Math.sin(t * 4 + tx) * 3;
          ctx.fillStyle = "#c43c18";
          ctx.fillRect(x, y + 8 + wave, TILE, TILE - 8);
          ctx.fillStyle = "#ff6b2d";
          roundRect(x - 1, y + 4 + wave, TILE + 2, 16, 7);
          ctx.fill();
          ctx.fillStyle = "#ffd36a";
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.ellipse(x + 12 + Math.sin(t * 5 + tx) * 6, y + 10 + wave, 5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
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
          const bands = ["#f2c94c", "#e8899c", "#7ec8e3", "#7fbf4a", "#d9a066", "#c45c38"];
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = bands[i];
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x + 17, y + 8 + i * 28, 5, 22);
          }
          ctx.globalAlpha = 1;
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
    roundRect(VIEW_W / 2 - 130, 70, 260, 44, 16);
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
    drawWheel();
    (world.balloons || []).forEach(drawBalloon);
    drawHazards();
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
    const worldEl = document.getElementById("hud-world");
    if (worldEl) worldEl.textContent = LEVEL_LABELS[level] || "1-1";
  }

  function applyTheme(name) {
    const t = THEMES[name] || THEMES.meadow;
    Object.assign(COL, t);
    canvas.style.background = t.skyBot;
  }

  function loadLevel(i) {
    level = i;
    world = buildLevel(i);
    applyTheme(world.theme);
    player = makePlayer(world.spawn.x, world.spawn.y);
    cam.x = 0;
    cam.y = 0;
    particles = [];
    floaters = [];
    invuln = 0.9;
    banner = { text: world.title, t: 2 };
    refreshHud();
  }

  function startGame(startLevel) {
    ensureAudio();
    if (audio && audio.state === "suspended") audio.resume();
    if (!jumpPool.length) {
      const a = new Audio("assets/sfx/yaha.m4a");
      a.preload = "auto";
      a.volume = 0;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 0.9;
        })
        .catch(() => {
          a.volume = 0.9;
        });
      jumpPool.push(a);
    }
    score = 0;
    coins = 0;
    lives = 3;
    const i = Number.isInteger(startLevel) ? startLevel : 0;
    loadLevel(i);
    state = "play";
    overlay.hidden = true;
    overlay.inert = true;
    hud.hidden = false;
    controls.hidden = false;
    refreshHud();
  }

  function showTitle() {
    state = "title";
    overlay.hidden = false;
    overlay.inert = false;
    cardTitle.hidden = false;
    cardEnd.hidden = true;
    hud.hidden = true;
    controls.hidden = true;
  }

  function showEnd(win) {
    state = "end";
    overlay.hidden = false;
    overlay.inert = false;
    cardTitle.hidden = true;
    cardEnd.hidden = false;
    const usagi = document.getElementById("end-usagi");
    const poop = document.getElementById("end-poop");
    if (usagi) usagi.hidden = !win;
    if (poop) poop.hidden = win;
    document.getElementById("end-title").textContent = win ? "全部過關！" : "遊戲結束";
    document.getElementById("end-msg").textContent = win ? "Usagi X Carya 五關完成" : "掉下去或碰到敵人就會失敗";
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
      updateWheel(dt);
      updateBalloons(dt);
      updatePlayer(player, dt);
      updateEnemies(dt);
      updateHazards(dt);
      updateCoins(dt);
      updateFlag();
      updateFx(dt);
      updateCamera(dt);
      render();
    } else if (state === "title" || !world) {
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
      e.stopPropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      el.classList.add("is-down");
      el.blur();
      on();
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove("is-down");
      el.blur();
      off();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("dblclick", (e) => e.preventDefault());
    el.addEventListener("contextmenu", (e) => e.preventDefault());
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
      if (state === "title") startGame(0);
      if (state === "end") showTitle();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") input.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") input.right = false;
    if (e.key === " " || e.code === "Space" || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "z" || e.key === "k") {
      input.jumpHeld = false;
    }
  });

  window.addEventListener("selectstart", (e) => e.preventDefault());
  window.addEventListener("dragstart", (e) => e.preventDefault());
  document.getElementById("btn-start").addEventListener("click", () => startGame(0));
  document.getElementById("btn-again").addEventListener("click", showTitle);
  document.querySelectorAll("#level-select .lvl").forEach((btn) => {
    btn.addEventListener("click", () => startGame(Number(btn.dataset.level)));
  });
  window.addEventListener("resize", resize);
  window.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  resize();
  const qs = new URLSearchParams(location.search);
  if (qs.get("autostart") === "1") {
    startGame(Number(qs.get("level") || 0));
    const warp = Number(qs.get("x"));
    if (warp) {
      player.x = warp;
      player.checkpoint = warp;
      cam.x = Math.max(0, warp - 280);
    }
    input.right = true;
    setTimeout(() => {
      input.jumpPressed = true;
      input.jumpHeld = true;
      setTimeout(() => {
        input.jumpHeld = false;
      }, 220);
    }, 2600);
  }
  if (qs.get("end") === "lose") showEnd(false);
  requestAnimationFrame(loop);
})();
