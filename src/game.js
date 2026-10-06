// ─────────────────────────────────────────────
//  Game: controla el flujo de la partida
//  menú → edificio → plantas → salas conectadas
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, MAX_ALLIES, DIRS, BUILDINGS, SURVIVORS, PIXEL, ART_W, ART_H, PIXEL_MODE } from './config.js';
import { rand, clamp, dist, pushOut, obstacleGap } from './utils.js';
import { Player, Ally } from './entities.js';
import { makeBoss, BOSS_TYPES, BLEACH, drawBottle } from './bosses.js';
import { Zombie, POISON, TENTACLE } from './zombies.js';
import { generateFloor, neighbour } from './floor.js';
import { makeRoomLayout, ROOM_TYPES } from './rooms.js';
import { baseStats, rollItem, applyWorkshop, WORKSHOP } from './upgrades.js';
import { Pedestal, SurvivorNPC, Stairs, WeaponProp } from './props.js';
import { WEAPONS, randomWeapon, weaponSummary } from './weapons.js';
import { loadSave, updateSave, buildingSave } from './save.js';
import { drawRoom, drawDoors, drawPickup, drawBullet, drawMinimap } from './render.js';
import { outlinedText, roundBox, setTextFont } from './draw.js';
import { getMoveVector, consumeDash, clearInput } from './input.js';
import { sfx, music, setMusicOn } from './sfx.js';

// Charcos que dejan los proyectiles en parábola: moco venenoso y lejía
const HAZARDS = {
  poison: { ...POISON, fill: '#8fd13f', stroke: '#4f772d', bubble: '#c7f27a', drop: '#9be33b' },
  bleach: { ...BLEACH, fill: '#e9f8ff', stroke: '#2f86c4', bubble: '#ffffff', drop: '#4cb4f0' },
};

// Vida de los jefes según la planta (la portera solo sale en la última)
const bossHpMul = (type, floorNum) => (type === 'boss' ? 1 : 1 + (floorNum - 1) * 0.25);

const KEY_CHANCE = 0.07;   // probabilidad de que un zombi suelte una llave 🔑
const HEART_CHANCE = 0.05; // ...o un corazón
const HEART_HEAL = 15;

const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const SLIDE = 0.4; // duración del deslizamiento de cámara entre salas
const FADE = 0.6;  // duración de cada mitad del fundido al cambiar de planta

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.state = 'menu'; // 'menu' | 'playing' | 'over'
    this.paused = false;
    this.time = 0;
    this.shakeAmt = 0;
    // Pixel art: el mundo se dibuja en un lienzo pequeño (480×320) que luego se amplía sin suavizado
    if (PIXEL_MODE) {
      this.low = document.createElement('canvas');
      this.low.width = ART_W;
      this.low.height = ART_H;
      this.lowCtx = this.low.getContext('2d');
      setTextFont('"Pixelify Sans"');
    }
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.setupMenuScene();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.scale = this.canvas.width / W;
  }

  // ═════════════ Pantallas ═════════════

  resetRoomState() {
    this.hazards = [];   // charcos de veneno en el suelo
    this.lobs = [];      // mocos volando
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.texts = [];
    this.timers = [];
  }

  setupMenuScene() {
    this.resetRoomState();
    this.pickups = [];
    this.banner = null;
    this.transition = null;
    this.floor = null;
    this.fade = null;
    this.room = { doors: {}, doorTypes: {}, props: [], layout: makeRoomLayout('start') };
    this.doorOpen = 1;
    this.stats = baseStats();
    this.player = new Player(this.stats);
    this.player.x = W / 2; this.player.y = H / 2 + 60;
    this.allies = [];
    this.menuTarget = { x: W / 2, y: H / 2, t: 0 };
  }

  goMenu() {
    this.state = 'menu';
    this.paused = false;
    this.setupMenuScene();
    this.ui.showHud(false);
    music.play('menu');
    this.ui.showMenu(loadSave(), { play: () => this.showBuildings(), workshop: () => this.showWorkshop() });
  }

  // Selector de edificios
  showBuildings() {
    this.ui.showBuildings(loadSave(), BUILDINGS, { pick: (id) => this.newRun(id), back: () => this.goMenu() });
  }

  // Taller: mejoras permanentes que se compran con llaves
  showWorkshop() {
    this.ui.showWorkshop(loadSave(), WORKSHOP, {
      buy: (id) => {
        const up = WORKSHOP.find((u) => u.id === id);
        let bought = false;
        updateSave((s) => {
          const lvl = s.workshop[id] || 0;
          const price = up.cost[lvl];
          if (lvl >= up.max || s.keys < price) return;
          s.keys -= price;
          s.workshop[id] = lvl + 1;
          bought = true;
        });
        if (bought) sfx.buy(); else sfx.nope();
        this.showWorkshop();
        return bought;
      },
      back: () => this.goMenu(),
    });
  }

  newRun(buildingId = this.building?.id || 'apartamentos') {
    this.building = BUILDINGS[buildingId];
    const save = updateSave((s) => { s.runs++; buildingSave(s, buildingId).runs++; });
    this.stats = applyWorkshop(baseStats(), save.workshop);
    this.player = new Player(this.stats);
    this.allies = [];
    this.kills = 0;
    this.runKeys = 0;          // llaves recogidas en esta partida
    this.wallet = save.keys;   // llaves totales (para el HUD)
    this.runTime = 0;
    this.floorNum = 1;
    this.fade = null;
    // orden en que aparecerán los supervivientes en este edificio
    this.survivorOrder = shuffle(Object.values(SURVIVORS));
    this.items = [];            // objetos conseguidos
    this.itemsSeen = new Set(); // objetos que ya han salido (para no repetir)
    // Mejora "Mochila" del Taller: empiezas con un objeto al azar
    if (save.workshop.mochila) {
      const it = rollItem(this.itemsSeen);
      it.apply(this);
      this.items.push(it);
    }
    this.state = 'playing';
    this.paused = false;
    clearInput();
    this.ui.hide();
    this.ui.showHud(true);
    this.startFloor();
  }

  // Genera una planta nueva y coloca al jugador en la entrada
  startFloor() {
    const count = this.building.roomsPerFloor[this.floorNum - 1] || 12;
    const isFinal = this.floorNum === this.building.floors;
    this.floor = generateFloor(count, this.floorNum, isFinal);
    this.transition = null;
    this.room = null;

    // Colocamos el objeto y el superviviente de esta planta
    for (const r of this.floor.rooms.values()) {
      if (r.type === 'item') {
        // 25 % de las veces la sala de objeto guarda un arma
        if (Math.random() < 0.25) r.props.push(new WeaponProp(randomWeapon(this.player.weapon.id), W / 2, H / 2));
        else r.props.push(new Pedestal(rollItem(this.itemsSeen)));
      }
      if (r.type === 'survivor') {
        const def = this.survivorOrder[(this.floorNum - 1) % this.survivorOrder.length];
        r.props.push(new SurvivorNPC(def));
      }
    }

    // Modo de pruebas (añade ?pruebas a la dirección): todas las armas en la entrada
    // y las teclas 1-6 invocan zombis (ver main.js)
    this.testMode = new URLSearchParams(location.search).has('pruebas');
    if (this.floorNum === 1 && this.testMode) {
      Object.values(WEAPONS).filter((w) => w.id !== 'fregona').forEach((w, i) => {
        this.floor.start.props.push(new WeaponProp(w, W / 2 - 240 + i * 160, H / 2 - 110));
      });
    }
    this.enterRoom(this.floor.start, null);
    // primera partida: recordatorio de los controles
    const firstTime = loadSave().runs <= 1 && this.floorNum === 1;
    this.banner = {
      title: `${this.building.icon} ${this.building.name}`,
      sub: this.testMode ? 'Modo pruebas · teclas 1-6: zombis · 7-8: jefes'
        : firstTime ? 'Muévete con WASD o flechas · Espacio para esquivar' : `Planta ${this.floorNum}`,
      t: 0,
    };
  }

  openPause() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.pauseOpen = true;
    clearInput();
    this.ui.showPause(this, {
      resume: () => this.closePause(),
      music: () => {
        const on = !loadSave().settings.music;
        updateSave((s) => { s.settings.music = on; });
        setMusicOn(on);
        this.paused = false; this.pauseOpen = false;
        this.openPause(); // vuelve a dibujar la pausa con el botón actualizado
      },
      quit: () => { this.pauseOpen = false; this.endRun(false, true); },
    });
  }

  closePause() {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
    this.paused = false;
    this.ui.hide();
  }

  endRun(win, quit = false) {
    this.state = 'over';
    this.paused = false;
    const id = this.building.id;
    const save = updateSave((s) => {
      s.bestFloor = Math.max(s.bestFloor || 0, this.floorNum);
      s.kills += this.kills;
      const b = buildingSave(s, id);
      b.bestFloor = Math.max(b.bestFloor, win ? this.building.floors : this.floorNum);
      if (win) {
        s.wins++;
        b.wins++;
        b.completed = true;
        b.bestTime = b.bestTime ? Math.min(b.bestTime, this.runTime) : this.runTime;
      }
    });
    const record = win && save.buildings[id].bestTime === this.runTime;
    this.ui.showHud(false);
    if (!quit) music.jingle(win ? 'win' : 'lose');
    if (quit) { this.goMenu(); return; }
    const rooms = [...this.floor.rooms.values()];
    this.ui.showEnd(
      {
        win,
        title: win ? '🏆 ¡Edificio completado!' : '💥 ¡Derrota!',
        sub: win
          ? `Has limpiado los ${this.building.name} de arriba abajo`
          : `Caíste en la planta ${this.floorNum} de ${this.building.floors} de ${this.building.name}`,
        kills: this.kills,
        explored: `${rooms.filter((r) => r.visited).length} / ${rooms.length}`,
        floors: `${win ? this.building.floors : this.floorNum - 1} / ${this.building.floors}`,
        team: this.allies.map((a) => a.def.icon).join(' ') || '—',
        keys: this.runKeys,
        wallet: save.keys,
        time: win ? `${formatTime(this.runTime)}${record ? ' · ¡récord!' : ''}` : null,
      },
      { retry: () => this.newRun(), workshop: () => this.showWorkshop(), menu: () => this.goMenu() },
    );
  }

  // ═════════════ Salas ═════════════

  // Entra en una sala. `fromDir` es la dirección en la que se movía el jugador
  // (null al empezar la planta).
  enterRoom(room, fromDir) {
    if (this.room && this.room.pickups) this.room.pickups = this.pickups; // la sala recuerda sus objetos
    this.resetRoomState();
    this.room = room;
    this.pickups = room.pickups;
    const firstVisit = !room.visited;
    room.visited = true;
    if (firstVisit && (room.type === 'miniboss' || room.type === 'boss')) {
      const info = ROOM_TYPES[room.type], boss = BOSS_TYPES[room.type];
      this.banner = { title: `${boss.icon} ${boss.name}`, sub: `${info.name} · ${room.type === 'boss' ? '¡El último combate del edificio!' : '¡Derrótalo para seguir subiendo!'}`, t: 0 };
    }
    for (const dir of Object.keys(DIRS)) {
      if (room.doors[dir]) neighbour(this.floor, room, dir).seen = true;
    }

    // Colocamos al jugador junto a la puerta por la que entra
    const p = this.player;
    const IN = p.r + 34;
    if (!fromDir) { p.x = W / 2; p.y = H / 2 + 40; }
    else if (fromDir === 'up') { p.x = W / 2; p.y = H - WALL - IN; }
    else if (fromDir === 'down') { p.x = W / 2; p.y = WALL + IN; }
    else if (fromDir === 'left') { p.x = W - WALL - IN; p.y = H / 2; }
    else if (fromDir === 'right') { p.x = WALL + IN; p.y = H / 2; }
    if (fromDir) { p.vx *= 0.3; p.vy *= 0.3; }
    this.allies.forEach((a) => { a.x = p.x + rand(-20, 20); a.y = p.y + rand(-20, 20); });

    this.waveIdx = 0;
    this.waveDelay = room.cleared ? 0 : 0.6;
    if (!room.decals) room.decals = [];
    music.play(!room.cleared && (room.type === 'miniboss' || room.type === 'boss') ? 'boss' : 'explore');
    // Las puertas entran abiertas y se cierran de golpe si hay enemigos
    this.doorOpen = 1;
  }

  goThroughDoor(dir) {
    const next = neighbour(this.floor, this.room, dir);
    if (!next) return;
    this.transition = { dir, t: 0, from: this.room };
    this.enterRoom(next, dir);
    sfx.door();
  }

  spawnWave(types) {
    const mul = 1 + (this.room.dist - 1) * 0.12 + (this.floorNum - 1) * 0.25;
    for (const t of types) {
      if (t === 'miniboss' || t === 'boss') {
        // el jefe aparece en el lado contrario al jugador
        const p = this.player;
        const x = clamp(W / 2 + (W / 2 - p.x) * 0.6, WALL + 120, W - WALL - 120);
        const y = clamp(H / 2 + (H / 2 - p.y) * 0.6, WALL + 110, H - WALL - 110);
        this.enemies.push(makeBoss(t, x, y, bossHpMul(t, this.floorNum)));
        sfx.boss();
        this.shake(10);
        continue;
      }
      const pos = this.findSpawnPoint();
      this.enemies.push(new Zombie(t, pos.x, pos.y, mul));
    }
  }

  spawnEnemy(type, x, y) {
    const mul = 1 + (this.floorNum - 1) * 0.25;
    x = clamp(x, WALL + 30, W - WALL - 30);
    y = clamp(y, WALL + 30, H - WALL - 30);
    const e = BOSS_TYPES[type] ? makeBoss(type, x, y, bossHpMul(type, this.floorNum)) : new Zombie(type, x, y, mul);
    this.enemies.push(e);
    return e;
  }

  findSpawnPoint() {
    for (let i = 0; i < 40; i++) {
      const pt = { x: rand(WALL + 50, W - WALL - 50), y: rand(WALL + 50, H - WALL - 50) };
      if (dist(pt, this.player) < 260) continue;
      if (this.room.layout.obstacles.some((o) => obstacleGap(o, pt) < 40)) continue;
      return pt;
    }
    return { x: W - this.player.x, y: H - this.player.y };
  }

  roomCleared() {
    this.room.cleared = true;
    for (const a of this.allies) if (a.onRoomCleared) a.onRoomCleared(this);
    sfx.clear();
    this.floatText(this.player.x, this.player.y - 50, '¡Despejada!', '#80ed99', 24);
    this.later(0.25, () => sfx.door());

    const type = this.room.type;
    if (type === 'miniboss') music.play('explore');
    if (type === 'miniboss') {
      if (this.floor.isFinal) {
        this.banner = { title: '¡Mini jefe derrotado!', sub: 'Se ha abierto la puerta del jefe final...', t: 0 };
      } else {
        this.room.props.push(new Stairs(this.floorNum + 1));
        this.banner = { title: '¡Mini jefe derrotado!', sub: `Sube por las escaleras a la planta ${this.floorNum + 1}`, t: 0 };
      }
    } else if (type === 'boss') {
      this.banner = { title: '¡EDIFICIO COMPLETADO!', sub: `Los ${this.building.name} están a salvo`, t: 0 };
      this.later(2.8, () => this.endRun(true));
    } else if (type === 'survivor') {
      this.floatText(W / 2, H / 2 - 90, '¡Ve a por el superviviente!', '#ffd23f', 20);
    }
  }

  // Objetos de la sala: pedestal, superviviente y escaleras
  updateProps() {
    const p = this.player;
    if (p.dead) return;
    for (const pr of this.room.props) {
      if (pr.taken) continue;
      if (dist(pr, p) > pr.r + p.r + 4) { pr.armed = true; continue; } // hay que salir y volver a pisarlo
      if (pr.kind === 'pedestal') {
        pr.taken = true;
        pr.item.apply(this);
        this.items.push(pr.item);
        this.banner = { title: `${pr.item.icon} ${pr.item.name}`, sub: pr.item.desc, t: 0 };
        this.burst(pr.x, pr.y - 40, '#ffd23f', 14, 20);
        sfx.buy();
      } else if (pr.kind === 'survivor' && this.room.cleared) {
        pr.taken = true;
        this.addAlly(pr.def, pr.x, pr.y);
        this.banner = { title: `${pr.def.icon} ¡${pr.def.name} se une!`, sub: pr.def.desc, t: 0 };
        this.burst(pr.x, pr.y, pr.def.color, 14, 16);
        sfx.clear();
      } else if (pr.kind === 'weapon' && pr.armed) {
        // Cambiamos de arma: la que llevabas se queda en el suelo
        const old = this.player.weapon;
        this.player.weapon = pr.weapon;
        this.player.swing = null;
        pr.weapon = old;
        pr.armed = false; // hay que alejarse antes de poder volver a cogerla
        this.banner = { title: `${this.player.weapon.icon} ${this.player.weapon.name}`, sub: weaponSummary(this.player.weapon), t: 0 };
        this.burst(pr.x, pr.y, '#ffd23f', 10, 16);
        sfx.buy();
      } else if (pr.kind === 'stairs' && pr.appear >= 1 && pr.armed) {
        pr.taken = true;
        this.goNextFloor();
      }
    }
  }

  goNextFloor() {
    sfx.door();
    clearInput();
    this.fade = {
      t: 0,
      phase: 'out',
      action: () => {
        this.floorNum++;
        this.startFloor();
      },
    };
  }

  addAlly(def, x = this.player.x, y = this.player.y + 30) {
    if (this.allies.length >= MAX_ALLIES) return false;
    const a = new Ally(def, x, y);
    this.allies.push(a);
    this.allies.forEach((al, i) => { al.idx = i; });
    return true;
  }

  healPlayer(n) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.stats.maxHp, p.hp + n);
    const healed = Math.round(p.hp - before);
    if (healed > 0) this.floatText(p.x, p.y - 44, `+${healed}`, '#80ed99', 20);
  }

  // ═════════════ Bucle principal ═════════════

  later(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') { this.updateMenu(dt); return; }
    if (this.state !== 'playing' || this.paused) return;

    // Pausa de impacto al golpear (unas centésimas de segundo)
    if (this.hitStop > 0) { this.hitStop -= dt; return; }

    // Fundido a negro al cambiar de planta
    if (this.fade) {
      const f = this.fade;
      f.t += dt;
      if (f.phase === 'out' && f.t >= FADE) { f.action(); f.phase = 'in'; f.t = 0; }
      else if (f.phase === 'in' && f.t >= FADE) this.fade = null;
      if (this.fade && this.fade.phase === 'out') return;
    }

    // Durante el deslizamiento entre salas el juego se congela
    if (this.transition) {
      this.transition.t += dt;
      if (this.transition.t >= SLIDE) this.transition = null;
      return;
    }
    this.updatePlay(dt);
  }

  updateMenu(dt) {
    // En el menú el conserje pasea solo por la habitación
    const m = this.menuTarget;
    m.t -= dt;
    if (m.t <= 0) {
      m.x = rand(W * 0.25, W * 0.75); m.y = rand(H * 0.45, H * 0.75); m.t = rand(1.5, 3);
    }
    const dx = m.x - this.player.x, dy = m.y - this.player.y;
    const d = Math.hypot(dx, dy);
    const mv = d > 20 ? { x: (dx / d) * 0.6, y: (dy / d) * 0.6 } : { x: 0, y: 0 };
    this.player.update(dt, this, mv, false);
    this.updateParticles(dt);
  }

  updatePlay(dt) {
    const p = this.player;

    // temporizadores programados con later()
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    due.forEach((t) => t.fn());
    if (this.state !== 'playing' || this.paused) return;

    this.runTime += dt;
    if (!p.dead) p.update(dt, this, getMoveVector(), consumeDash());
    for (const a of this.allies) a.update(dt, this);

    this.updateWaves(dt);

    for (const e of this.enemies) {
      e.update(dt, this);
      if (e.active && e.dmg > 0 && !p.dead && dist(e, p) < e.r + p.r - 4) p.hurt(e.dmg, this);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.updateBullets(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateDoors(dt);
    this.updateProps();

    this.shakeAmt *= Math.exp(-dt * 10);
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - dt);
    // latido con poca vida
    if (!p.dead && p.hp < this.stats.maxHp * 0.3) {
      this.beatT = (this.beatT || 0) - dt;
      if (this.beatT <= 0) { this.beatT = 0.9; sfx.heartbeat(); }
    }
    if (this.banner) this.banner.t += dt;
    this.ui.updateHud(this);
  }

  updateWaves(dt) {
    const waves = this.room.waves;
    if (this.room.cleared || !waves.length) return;
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnWave(waves[this.waveIdx]);
      return;
    }
    if (this.enemies.length === 0) {
      if (this.waveIdx < waves.length - 1) {
        this.waveIdx++;
        this.waveDelay = 0.7;
      } else {
        this.roomCleared();
      }
    }
  }

  // Abre/cierra las puertas y detecta si el jugador cruza una
  updateDoors(dt) {
    const target = this.room.cleared ? 1 : 0;
    const before = this.doorOpen;
    this.doorOpen = clamp(this.doorOpen + Math.sign(target - this.doorOpen) * dt * (target ? 2.5 : 6), 0, 1);
    if (before === 1 && this.doorOpen < 1) { sfx.slam(); this.shake(4); } // ¡portazo!

    const p = this.player;
    if (this.doorOpen < 1 || p.dead) return;
    const half = DOOR_W / 2 - 8;
    const at = {
      up: p.y - p.r <= WALL + 2 && Math.abs(p.x - W / 2) < half,
      down: p.y + p.r >= H - WALL - 2 && Math.abs(p.x - W / 2) < half,
      left: p.x - p.r <= WALL + 2 && Math.abs(p.y - H / 2) < half,
      right: p.x + p.r >= W - WALL - 2 && Math.abs(p.y - H / 2) < half,
    };
    for (const dir of Object.keys(DIRS)) {
      if (this.room.doors[dir] && at[dir]) { this.goThroughDoor(dir); return; }
    }
  }

  separateEnemies() {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = a.r + b.r - d;
        if (overlap > 0) {
          const wa = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
          a.x -= (dx / d) * overlap * wa; a.y -= (dy / d) * overlap * wa;
          b.x += (dx / d) * overlap * (1 - wa); b.y += (dy / d) * overlap * (1 - wa);
        }
      }
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const outside = b.x < WALL || b.x > W - WALL || b.y < WALL || b.y > H - WALL;
      if (outside || this.room.layout.obstacles.some((o) => obstacleGap(o, b) < b.r * 0.5)) {
        b.dead = true;
        this.puff(b.x, b.y, b.color);
        continue;
      }
      if (b.friendly) {
        for (const e of this.enemies) {
          if (!e.active || b.hit.has(e)) continue;
          if (dist(e, b) < e.r + b.r) {
            b.hit.add(e);
            const l = Math.hypot(b.vx, b.vy) || 1;
            e.hurt(b.dmg, b.crit, b.vx / l, b.vy / l, this, b.knock ?? 1);
            this.hitSpark(b.x, b.y, b.crit);
            if (b.pierce-- <= 0) { b.dead = true; break; }
          }
        }
      } else if (!p.dead && p.invuln <= 0 && dist(p, b) < p.r + b.r - 2) {
        p.hurt(b.dmg, this);
        b.dead = true;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead && b.life > 0);
  }

  updatePickups(dt) {
    const p = this.player;
    const needsHp = p.hp < this.stats.maxHp;
    for (const pk of this.pickups) {
      pk.t += dt;
      const fr = Math.exp(-dt * 5);
      pk.vx *= fr; pk.vy *= fr;
      const dx = p.x - pk.x, dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      // Las llaves siempre vienen a ti; los corazones, solo si te falta vida
      const wanted = pk.kind === 'key' || needsHp;
      if (!p.dead && wanted && pk.t > 0.4 && d < this.stats.magnet) {
        pk.vx += (dx / d) * 2200 * dt;
        pk.vy += (dy / d) * 2200 * dt;
        const sp = Math.hypot(pk.vx, pk.vy);
        if (sp > 650) { pk.vx *= 650 / sp; pk.vy *= 650 / sp; }
      }
      pk.x = clamp(pk.x + pk.vx * dt, WALL + 14, W - WALL - 14);
      pk.y = clamp(pk.y + pk.vy * dt, WALL + 14, H - WALL - 14);
      if (!p.dead && wanted && pk.t > 0.25 && d < p.r + 12) this.collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.room.pickups = this.pickups;
  }

  collect(pk) {
    pk.dead = true;
    if (pk.kind === 'heart') {
      this.healPlayer(HEART_HEAL);
      sfx.gem();
    } else if (pk.kind === 'key') {
      // las llaves se guardan al momento: no se pierden aunque mueras
      this.runKeys++;
      this.wallet = updateSave((s) => { s.keys++; s.totalKeys++; }).keys;
      this.floatText(pk.x, pk.y - 20, '+1 🔑', '#ffd23f', 20);
      sfx.coin();
    }
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const fr = Math.exp(-dt * 4);
      pt.vx *= fr; pt.vy *= fr;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) {
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-dt * 3);
    }
    this.texts = this.texts.filter((t) => t.t < t.life);
  }

  // ═════════════ Combate ═════════════

  collideWorld(ent) {
    ent.x = clamp(ent.x, WALL + ent.r, W - WALL - ent.r);
    ent.y = clamp(ent.y, WALL + ent.r, H - WALL - ent.r);
    for (const o of this.room.layout.obstacles) pushOut(ent, o);
    for (const pr of this.room.props) if (pr.solid) pushOut(ent, pr);
  }

  nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Dispara una o varias balas aliadas. `o` admite: dmg, count, spread, jitter,
  // speed, life, pierce, knock, color, r, x, y (punto de salida)
  fireVolley(src, angle, o) {
    const n = o.count || 1;
    const spread = o.spread ?? 0.16;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - 0.5) * spread * (n > 2 ? 1 : 0.6) : 0;
      const a = angle + off + (Math.random() - 0.5) * (o.jitter || 0);
      const crit = Math.random() < this.stats.crit;
      const speed = (o.speed || 560) * (o.jitter ? 0.9 + Math.random() * 0.2 : 1);
      const r = o.r || 7;
      this.bullets.push({
        x: o.x ?? src.x + Math.cos(a) * src.r,
        y: o.y ?? src.y + Math.sin(a) * src.r,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: crit ? r + 3 : r,
        dmg: crit ? o.dmg * 2 : o.dmg,
        crit,
        pierce: o.pierce || 0,
        knock: o.knock ?? 1,
        friendly: true,
        color: crit ? '#ffd23f' : (o.color || '#fff6d5'),
        life: o.life || 1.2,
        hit: new Set(),
      });
    }
  }

  // Golpe cuerpo a cuerpo: daña a todo lo que esté dentro del abanico
  // y además rompe los proyectiles enemigos (¡se pueden "barrer"!)
  meleeHit(src, angle, half, reach, dmg, w) {
    const inArc = (x, y, r) => {
      const dx = x - src.x, dy = y - src.y;
      const d = Math.hypot(dx, dy);
      if (d - r > reach) return false;
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
      return diff <= half + 0.2 || d < r + 12;
    };
    let hits = 0;
    for (const e of this.enemies) {
      if (!e.active || !inArc(e.x, e.y, e.r)) continue;
      const crit = Math.random() < this.stats.crit;
      const l = Math.hypot(e.x - src.x, e.y - src.y) || 1;
      e.hurt(crit ? dmg * 2 : dmg, crit, (e.x - src.x) / l, (e.y - src.y) / l, this, w.knock);
      this.hitSpark(e.x - ((e.x - src.x) / l) * e.r * 0.6, e.y - ((e.y - src.y) / l) * e.r * 0.6 - 10, crit);
      hits++;
      // salpicaduras (de agua, si es la fregona)
      for (let i = 0; i < 5; i++) {
        const a = angle + (Math.random() - 0.5) * 1.6, sp = rand(120, 260);
        this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 5), color: w.trail, life: 0.35, max: 0.35, outline: true });
      }
    }
    for (const b of this.bullets) {
      if (!b.friendly && inArc(b.x, b.y, b.r)) { b.dead = true; this.puff(b.x, b.y, '#ffffff'); }
    }
    if (hits) {
      this.hitStop = Math.max(this.hitStop || 0, 0.05); // pequeña pausa de impacto: da sensación de golpe
      this.shake(3 + hits);
      sfx.thud();
    }
  }

  // Casquillo que sale despedido al disparar
  casing(x, y, angle) {
    const side = Math.cos(angle) >= 0 ? -1 : 1;
    const a = angle + side * Math.PI / 2 + rand(-0.4, 0.4);
    this.particles.push({ x, y, vx: Math.cos(a) * rand(90, 150), vy: Math.sin(a) * rand(90, 150) - 60, r: 2.6, color: '#ffd23f', life: 0.5, max: 0.5, outline: true });
  }

  // Proyectil enemigo. `o` admite: color, r, sound (false para no sonar)
  enemyShoot(x, y, angle, speed, dmg, o = {}) {
    this.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: o.r || 8, dmg, friendly: false, color: o.color || '#ff4d6d', life: 6,
    });
    if (o.sound !== false) sfx.enemyShot();
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    if (e.onDeath) e.onDeath(this);
    if (!e.isBoss) sfx.splat();
    this.addDecal(e);
    this.burst(e.x, e.y, e.color, 12, e.r);
    this.shake(3);
    sfx.kill();
    if (!e.isBoss) {
      if (Math.random() < KEY_CHANCE) this.dropPickup('key', e.x, e.y);
      else if (Math.random() < HEART_CHANCE) this.dropPickup('heart', e.x, e.y);
    }
    if (this.stats.lifesteal && !this.player.dead) this.healPlayer(this.stats.lifesteal);
    if (e.isBoss) this.bossDefeated(e);
  }

  // Al caer un jefe desaparecen sus esbirros y sus proyectiles
  bossDefeated(boss) {
    for (const e of this.enemies) {
      if (!e.dead) { e.dead = true; this.burst(e.x, e.y, e.color, 8, e.r); }
    }
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.hazards = [];
    this.lobs = [];
    this.burst(boss.x, boss.y, '#ffd23f', 30, boss.r);
    this.burst(boss.x, boss.y - 40, boss.color, 20, boss.r);
    this.shake(20);
    this.hitStop = 0.35; // cámara lenta un instante: ¡golpe final!
    sfx.boom();
    this.dropPickup('heart', boss.x, boss.y);
    this.dropPickup('heart', boss.x, boss.y);
    for (let i = 0; i < (boss.type === 'boss' ? 8 : 3); i++) this.dropPickup('key', boss.x, boss.y);
    // el mini jefe siempre suelta un arma (lejos de donde saldrán las escaleras)
    if (boss.type === 'miniboss') {
      this.room.props.push(new WeaponProp(randomWeapon(this.player.weapon.id), W / 2, H / 2 + 130));
    }
  }

  onPlayerDeath() {
    const p = this.player;
    p.dead = true;
    this.burst(p.x, p.y, '#ffd23f', 30, p.r);
    this.shake(18);
    this.later(1.4, () => this.endRun(false));
  }

  dropPickup(kind, x, y) {
    const a = rand(0, Math.PI * 2), s = rand(80, 220);
    this.pickups.push({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, seed: rand(0, 6) });
  }

  // ═════════════ Ataques especiales de los zombis ═════════════

  // Explosión: daña al jugador y TAMBIÉN a los demás zombis (¡reacciones en cadena!)
  explode(x, y, radius, dmg, source) {
    sfx.boom();
    this.shake(14);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 320);
      const c = ['#ffd23f', '#ff9f1c', '#ff5d3c', '#5d5873'][i % 4];
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(6, 14), color: c, life: rand(0.35, 0.7), max: 0.7, outline: true });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, r: radius * 0.6, ring: true, color: '#ffd23f', life: 0.35, max: 0.35 });
    const p = this.player;
    if (!p.dead && dist(p, { x, y }) <= radius + p.r) p.hurt(dmg, this);
    for (const e of this.enemies) {
      if (e === source || !e.active) continue;
      const d = dist(e, { x, y });
      if (d <= radius + e.r) e.hurt(dmg, false, (e.x - x) / (d || 1), (e.y - y) / (d || 1), this, 2.2);
    }
  }

  // Latigazo de tentáculo: golpea todo lo que haya en la línea marcada
  tentacleHit(src, angle) {
    const p = this.player;
    if (p.dead) return;
    const ex = Math.cos(angle), ey = Math.sin(angle);
    const rx = p.x - src.x, ry = p.y - src.y;
    const along = clamp(rx * ex + ry * ey, 0, TENTACLE.range);
    const off = Math.hypot(rx - ex * along, ry - ey * along);
    if (off <= TENTACLE.width + p.r) p.hurt(TENTACLE.dmg, this);
    this.shake(5);
  }

  // Onda expansiva (pisotón): daña y empuja al jugador si está dentro del radio
  shockwave(x, y, radius, dmg, push) {
    this.shake(16);
    this.particles.push({ x, y, vx: 0, vy: 0, r: radius * 0.5, ring: true, color: '#ffffff', life: 0.35, max: 0.35 });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(150, 320);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, r: rand(4, 9), color: '#d8cbb0', life: rand(0.3, 0.6), max: 0.6, outline: true });
    }
    const p = this.player;
    const d = dist(p, { x, y });
    if (p.dead || d > radius + p.r) return;
    p.hurt(dmg, this);
    if (push) { p.vx += ((p.x - x) / (d || 1)) * push; p.vy += ((p.y - y) / (d || 1)) * push; }
  }

  // La portera pasa a la fase 2: borra las balas y te aparta de un grito
  bossRage(boss) {
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.banner = { title: '¡QUE ACABO DE FREGAR!', sub: 'La portera se ha enfadado de verdad', t: 0 };
    sfx.roar();
    const p = this.player;
    const d = dist(p, boss);
    if (!p.dead && d < 260) { p.vx += ((p.x - boss.x) / (d || 1)) * 900; p.vy += ((p.y - boss.y) / (d || 1)) * 900; }
    this.shake(18);
    this.particles.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 120, ring: true, color: '#ffd23f', life: 0.45, max: 0.45 });
  }

  // Proyectil en parábola hacia donde estaba el jugador (moco o botella de lejía)
  lob(x, y, tx, ty, kind = 'poison') {
    tx = clamp(tx, WALL + 30, W - WALL - 30);
    ty = clamp(ty, WALL + 30, H - WALL - 30);
    this.lobs.push({ x0: x, y0: y, tx, ty, t: 0, kind });
  }

  updateHazards(dt) {
    const p = this.player;
    for (const lb of this.lobs) {
      lb.t += dt;
      const hd = HAZARDS[lb.kind];
      if (lb.t >= hd.flight) {
        // ¡splash! deja un charco
        lb.done = true;
        this.hazards.push({ x: lb.tx, y: lb.ty, r: hd.radius, life: hd.life, seed: rand(0, 6), kind: lb.kind });
        for (let i = 0; i < 8; i++) {
          const a = rand(0, Math.PI * 2), sp = rand(60, 160);
          this.particles.push({ x: lb.tx, y: lb.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 6), color: hd.drop, life: 0.4, max: 0.4, outline: true });
        }
        if (lb.kind === 'bleach') sfx.glass(); else sfx.splat();
        if (!p.dead && dist(p, { x: lb.tx, y: lb.ty }) < hd.radius + p.r * 0.5) p.hurt(hd.hit, this);
      }
    }
    this.lobs = this.lobs.filter((lb) => !lb.done);
    for (const hz of this.hazards) {
      hz.life -= dt;
      // pisar el charco quema poco a poco (la esquiva te deja cruzarlo)
      const hd = HAZARDS[hz.kind];
      if (!p.dead && p.dashT <= 0 && dist(p, hz) < hz.r + p.r * 0.3) p.poison(hd.dps * dt, this, hd.drop);
    }
    this.hazards = this.hazards.filter((hz) => hz.life > 0);
  }

  drawHazards(ctx) {
    for (const hz of this.hazards) {
      const hd = HAZARDS[hz.kind];
      const fade = Math.min(1, hz.life / 0.6) * Math.min(1, (hd.life - hz.life) / 0.15 + 0.3);
      ctx.save();
      ctx.globalAlpha = 0.8 * fade;
      ctx.fillStyle = hd.fill;
      ctx.strokeStyle = hd.stroke;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = hz.r * (0.85 + Math.sin(a * 3 + hz.seed) * 0.12);
        ctx.lineTo(hz.x + Math.cos(a) * r, hz.y + Math.sin(a) * r * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // burbujas
      ctx.fillStyle = hd.bubble;
      for (let i = 0; i < 3; i++) {
        const b = (this.time * 1.5 + i / 3 + hz.seed) % 1;
        ctx.beginPath();
        ctx.arc(hz.x + Math.cos(i * 2.1 + hz.seed) * hz.r * 0.45, hz.y + Math.sin(i * 2.1 + hz.seed) * hz.r * 0.25, 2 + b * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawLobs(ctx) {
    for (const lb of this.lobs) {
      const hd = HAZARDS[lb.kind];
      const k = lb.t / hd.flight;
      const gx = lb.x0 + (lb.tx - lb.x0) * k, gy = lb.y0 + (lb.ty - lb.y0) * k;
      const h = Math.sin(k * Math.PI) * (lb.kind === 'bleach' ? 130 : 90);
      // aviso de dónde caerá
      ctx.beginPath();
      ctx.ellipse(lb.tx, lb.ty, hd.radius * k, hd.radius * 0.6 * k, 0, 0, Math.PI * 2);
      ctx.fillStyle = lb.kind === 'bleach' ? 'rgba(90, 169, 214, 0.3)' : 'rgba(155, 227, 59, 0.25)';
      ctx.fill();
      if (lb.kind === 'bleach') {
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
        ctx.beginPath(); ctx.ellipse(lb.tx, lb.ty, hd.radius, hd.radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = 'rgba(20,16,40,0.25)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      if (lb.kind === 'bleach') { drawBottle(ctx, gx, gy - h, lb.t * 10); continue; }
      ctx.beginPath();
      ctx.arc(gx, gy - h, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#9be33b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }

  // ═════════════ Efectos ═════════════

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  puff(x, y, color) {
    this.particles.push({ x, y, vx: rand(-30, 30), vy: rand(-30, 10), r: rand(3, 6), color, life: 0.3, max: 0.3 });
  }

  burst(x, y, color, n, r) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 260);
      this.particles.push({
        x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: rand(4, 9), color, life: rand(0.35, 0.7), max: 0.7, outline: true,
      });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, r, ring: true, color: '#ffffff', life: 0.3, max: 0.3 });
  }

  // Chispas en forma de estrella donde se golpea
  hitSpark(x, y, crit) {
    const n = crit ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(160, 300);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: crit ? 7 : 5, color: crit ? '#ffd23f' : '#ffffff', life: 0.16, max: 0.16, star: true });
    }
  }

  // Mancha que se queda en el suelo de la sala al morir un enemigo
  addDecal(e) {
    const decals = this.room && this.room.decals;
    if (!decals) return;
    const colors = { explosivo: '#2b2633', venenoso: '#8fd13f', tentaculos: '#7b4fa0' };
    const base = e.isBoss ? 1.8 : 1;
    decals.push({ x: e.x, y: e.y + 10, r: rand(14, 20) * base, color: colors[e.type] || '#5b7d3a', seed: rand(0, 6) });
    if (decals.length > 60) decals.shift();
  }

  floatText(x, y, text, color, size = 18) {
    this.texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -70 });
  }

  // ═════════════ Dibujo ═════════════

  render() {
    const out = this.ctx;
    out.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    out.clearRect(0, 0, W, H);
    // En pixel art el mundo va al lienzo pequeño; el resto (textos, minimapa...) a resolución completa
    const ctx = PIXEL_MODE ? this.lowCtx : out;
    if (PIXEL_MODE) {
      ctx.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
    }
    // en pixel art la cámara solo se mueve de píxel en píxel
    const snap = (v) => (PIXEL_MODE ? Math.round(v / PIXEL) * PIXEL : v);

    let camX = 0, camY = 0;
    const tr = this.transition;
    if (tr) {
      // Deslizamiento de cámara: la sala vieja sale y la nueva entra
      const k = clamp(tr.t / SLIDE, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const [dx, dy] = DIRS[tr.dir];
      ctx.save();
      ctx.translate(snap(-dx * W * e), snap(-dy * H * e));
      drawRoom(ctx, tr.from, this.time);
      drawDoors(ctx, tr.from, 1);
      ctx.restore();
      camX = snap(dx * W * (1 - e)); camY = snap(dy * H * (1 - e));
    } else if (this.shakeAmt > 0.3) {
      camX = snap(rand(-1, 1) * this.shakeAmt); camY = snap(rand(-1, 1) * this.shakeAmt);
    }
    ctx.save();
    ctx.translate(camX, camY);
    this.drawWorld(ctx);
    ctx.restore();

    if (PIXEL_MODE) {
      out.save();
      out.setTransform(1, 0, 0, 1, 0, 0);
      out.imageSmoothingEnabled = false;
      out.drawImage(this.low, 0, 0, out.canvas.width, out.canvas.height);
      out.restore();
    }
    out.save();
    out.translate(camX, camY);
    this.drawTexts(out);
    out.restore();
    this.drawOverlay(out);
  }

  // Interfaz dibujada en el lienzo: barra de objetos, minimapa, jefe, carteles y fundidos
  drawOverlay(ctx) {
    if (this.state !== 'menu' && this.floor) {
      this.drawItemBar(ctx);
      drawMinimap(ctx, this.floor, this.room, `PLANTA ${this.floorNum}/${this.building.floors}`, this.time);
    }
    this.drawVignette(ctx);
    this.drawBossBar(ctx);
    this.drawBanner(ctx);
    if (this.fade) {
      const k = clamp(this.fade.t / FADE, 0, 1);
      ctx.globalAlpha = this.fade.phase === 'out' ? k : 1 - k;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  drawWorld(ctx) {
    drawRoom(ctx, this.room, this.time);
    drawDoors(ctx, this.room, this.doorOpen);
    const props = this.room.props.filter((pr) => !(pr.kind === 'survivor' && pr.taken));
    for (const pr of props) if (pr.flat) pr.draw(ctx, this);
    this.drawHazards(ctx);
    for (const pk of this.pickups) drawPickup(ctx, pk, this.time);

    // Ordenamos por "y" para que lo de abajo se dibuje delante (falsa profundidad)
    const list = [...this.enemies, ...this.allies, ...props.filter((pr) => !pr.flat)];
    if (!this.player.dead) list.push(this.player);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.draw(ctx, this);

    for (const b of this.bullets) drawBullet(ctx, b);
    this.drawLobs(ctx);
    this.drawParticles(ctx);
  }

  // Números de daño y textos flotantes
  drawTexts(ctx) {
    for (const t of this.texts) {
      const pop = Math.min(1, t.t / 0.08);
      ctx.globalAlpha = t.t > t.life - 0.25 ? (t.life - t.t) / 0.25 : 1;
      outlinedText(ctx, t.text, t.x, t.y, t.size * (0.6 + 0.4 * pop), t.color, { lw: 5 });
      ctx.globalAlpha = 1;
    }
  }

  drawParticles(ctx) {
    for (const pt of this.particles) {
      const k = pt.life / pt.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.beginPath();
      if (pt.star) {
        // destello de 4 puntas
        const s = pt.r * (0.6 + k * 0.6);
        ctx.moveTo(pt.x, pt.y - s); ctx.lineTo(pt.x + s * 0.25, pt.y - s * 0.25); ctx.lineTo(pt.x + s, pt.y);
        ctx.lineTo(pt.x + s * 0.25, pt.y + s * 0.25); ctx.lineTo(pt.x, pt.y + s); ctx.lineTo(pt.x - s * 0.25, pt.y + s * 0.25);
        ctx.lineTo(pt.x - s, pt.y); ctx.lineTo(pt.x - s * 0.25, pt.y - s * 0.25); ctx.closePath();
        ctx.fillStyle = pt.color;
        ctx.fill();
      } else if (pt.ring) {
        ctx.arc(pt.x, pt.y, pt.r * (1 + (1 - k) * 1.2), 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = pt.color;
        ctx.stroke();
      } else {
        ctx.arc(pt.x, pt.y, Math.max(0.5, pt.r * k), 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
        if (pt.outline) { ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Objetos conseguidos, arriba a la izquierda (sobre el muro)
  drawItemBar(ctx) {
    if (!this.items || !this.items.length) return;
    const x0 = 16, y0 = 12, size = 30;
    roundBox(ctx, x0 - 6, y0 - 4, this.items.length * (size + 4) + 8, size + 8, 10, 'rgba(29, 27, 44, 0.7)', 3);
    this.items.forEach((it, i) => {
      ctx.font = `${size - 8}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.icon, x0 + i * (size + 4) + size / 2, y0 + size / 2 + 1);
    });
  }

  // Borde rojo al recibir daño y latido cuando queda poca vida
  drawVignette(ctx) {
    if (this.state !== 'playing' || !this.player) return;
    const p = this.player;
    const low = !p.dead && p.hp < this.stats.maxHp * 0.3;
    const pulse = low ? 0.25 + 0.2 * Math.max(0, Math.sin(this.time * 7)) : 0;
    const a = Math.max(pulse, (this.hurtFlash || 0) * 1.4);
    if (a <= 0.01) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(255, 30, 60, 0)');
    g.addColorStop(1, `rgba(255, 30, 60, ${Math.min(0.7, a)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Barra de vida de jefes y mini jefes
  drawBossBar(ctx) {
    const boss = this.enemies.find((e) => e.isBoss && e.active);
    if (!boss) return;
    const w = 420, x = W / 2 - w / 2, y = H - WALL - 40;
    // se vuelve transparente si hay alguien debajo, para no tapar el combate
    const under = [this.player, ...this.enemies].some((e) => e.x > x - 30 && e.x < x + w + 30 && e.y > y - 60);
    ctx.save();
    ctx.globalAlpha = under ? 0.35 : 1;
    ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, 26, 13);
    ctx.fillStyle = OUTLINE; ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 18, 9);
    ctx.fillStyle = boss.color; ctx.fill();
    if (boss.type === 'boss' && boss.phase === 1) {
      // marca de la mitad: ahí empieza la fase 2
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + w / 2 - 2, y - 2, 4, 22);
    }
    outlinedText(ctx, `${boss.icon} ${boss.name}${boss.phase === 2 ? ' 💢' : ''}`, W / 2, y - 16, 22, '#ffd23f', { lw: 6 });
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b || b.t > 2.2 || this.state === 'menu') return;
    const appear = Math.min(1, b.t / 0.25);
    const fade = b.t > 1.8 ? 1 - (b.t - 1.8) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const s = 0.6 + 0.4 * (1 - Math.pow(1 - appear, 3));
    ctx.translate(W / 2, H * 0.3);
    ctx.scale(s, s);
    outlinedText(ctx, b.title, 0, 0, 56, '#ffd23f', { lw: 12 });
    if (b.sub) outlinedText(ctx, b.sub, 0, 46, 24, '#ffffff', { lw: 7 });
    ctx.restore();
  }
}
