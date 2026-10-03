// ─────────────────────────────────────────────
//  Game: controla el flujo de la partida
//  menú → edificio → plantas → salas conectadas
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, MAX_ALLIES, ALLY_COLORS, DIRS, OPPOSITE, BUILDINGS } from './config.js';
import { rand, clamp, dist, pushOut } from './utils.js';
import { Player, Ally, Enemy } from './entities.js';
import { generateFloor, neighbour } from './floor.js';
import { makeRoomLayout } from './rooms.js';
import { baseStats } from './upgrades.js';
import { loadSave, writeSave } from './save.js';
import { drawRoom, drawDoors, drawPickup, drawBullet, drawMinimap } from './render.js';
import { outlinedText } from './draw.js';
import { getMoveVector, consumeDash, clearInput } from './input.js';
import { sfx } from './sfx.js';

const SLIDE = 0.4; // duración del deslizamiento de cámara entre salas

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.state = 'menu'; // 'menu' | 'playing' | 'over'
    this.paused = false;
    this.time = 0;
    this.shakeAmt = 0;
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
    this.room = { doors: {}, layout: makeRoomLayout('start') };
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
    this.ui.showMenu(loadSave(), { play: () => this.newRun() });
  }

  newRun() {
    this.building = BUILDINGS.apartamentos;
    this.stats = baseStats();
    this.player = new Player(this.stats);
    this.allies = [];
    this.kills = 0;
    this.floorNum = 1;
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
    this.floor = generateFloor(count, this.floorNum);
    this.transition = null;
    this.enterRoom(this.floor.start, null);
    this.banner = { title: `${this.building.icon} ${this.building.name}`, sub: `Planta ${this.floorNum}`, t: 0 };
  }

  openPause() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.pauseOpen = true;
    clearInput();
    this.ui.showPause(this, {
      resume: () => this.closePause(),
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
    const save = loadSave();
    save.bestFloor = Math.max(save.bestFloor || 0, this.floorNum);
    writeSave(save);
    this.ui.showHud(false);
    if (quit) { this.goMenu(); return; }
    const rooms = [...this.floor.rooms.values()];
    this.ui.showEnd(
      {
        win,
        title: win ? '🧹 ¡Planta despejada!' : '💥 ¡Derrota!',
        sub: win
          ? `Has limpiado la planta ${this.floorNum} de ${this.building.name}`
          : `Caíste en la planta ${this.floorNum} de ${this.building.name}`,
        kills: this.kills,
        explored: `${rooms.filter((r) => r.visited).length} / ${rooms.length}`,
      },
      { retry: () => this.newRun(), menu: () => this.goMenu() },
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
    room.visited = true;
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
    const mul = 1 + (this.room.dist - 1) * 0.12 + (this.floorNum - 1) * 0.2;
    for (const t of types) {
      const pos = this.findSpawnPoint();
      this.enemies.push(new Enemy(t, pos.x, pos.y, mul));
    }
  }

  spawnEnemy(type, x, y) {
    const e = new Enemy(type, clamp(x, WALL + 30, W - WALL - 30), clamp(y, WALL + 30, H - WALL - 30), 1);
    this.enemies.push(e);
  }

  findSpawnPoint() {
    for (let i = 0; i < 40; i++) {
      const pt = { x: rand(WALL + 50, W - WALL - 50), y: rand(WALL + 50, H - WALL - 50) };
      if (dist(pt, this.player) < 260) continue;
      if (this.room.layout.obstacles.some((o) => dist(o, pt) < o.r + 40)) continue;
      return pt;
    }
    return { x: W - this.player.x, y: H - this.player.y };
  }

  roomCleared() {
    this.room.cleared = true;
    sfx.clear();
    this.floatText(this.player.x, this.player.y - 50, '¡Despejada!', '#80ed99', 24);
    this.later(0.25, () => sfx.door());

    if ([...this.floor.rooms.values()].every((r) => r.cleared)) {
      // Fase 1: limpiar todas las salas completa la planta (en la fase 2 serán las escaleras)
      this.banner = { title: '¡Planta despejada!', sub: 'No queda ni un monstruo', t: 0 };
      this.later(2.4, () => this.endRun(true));
    }
  }

  addAlly() {
    if (this.allies.length >= MAX_ALLIES) return false;
    const p = this.player;
    const a = new Ally(ALLY_COLORS[this.allies.length % ALLY_COLORS.length], p.x, p.y + 30);
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

    if (!p.dead) p.update(dt, this, getMoveVector(), consumeDash());
    for (const a of this.allies) a.update(dt, this);

    this.updateWaves(dt);

    for (const e of this.enemies) {
      e.update(dt, this);
      if (e.active && !p.dead && dist(e, p) < e.r + p.r - 4) p.hurt(e.dmg, this);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateDoors(dt);

    this.shakeAmt *= Math.exp(-dt * 10);
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
          const wa = a.type === 'boss' ? 0 : b.type === 'boss' ? 1 : 0.5;
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
      if (outside || this.room.layout.obstacles.some((o) => dist(o, b) < o.r + b.r * 0.5)) {
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
            e.hurt(b.dmg, b.crit, b.vx / l, b.vy / l, this);
            this.puff(b.x, b.y, '#ffffff');
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
      // Los corazones solo vienen a ti si te falta vida
      if (!p.dead && needsHp && pk.t > 0.4 && d < this.stats.magnet) {
        pk.vx += (dx / d) * 2200 * dt;
        pk.vy += (dy / d) * 2200 * dt;
        const sp = Math.hypot(pk.vx, pk.vy);
        if (sp > 650) { pk.vx *= 650 / sp; pk.vy *= 650 / sp; }
      }
      pk.x = clamp(pk.x + pk.vx * dt, WALL + 14, W - WALL - 14);
      pk.y = clamp(pk.y + pk.vy * dt, WALL + 14, H - WALL - 14);
      if (!p.dead && needsHp && pk.t > 0.25 && d < p.r + 12) this.collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.room.pickups = this.pickups;
  }

  collect(pk) {
    pk.dead = true;
    if (pk.kind === 'heart') {
      this.healPlayer(20);
      sfx.gem();
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

  fireVolley(src, angle, dmg, shots, pierce, color, r = 7) {
    const spread = 0.16;
    const speed = this.stats.bulletSpeed;
    for (let i = 0; i < shots; i++) {
      const a = angle + (i - (shots - 1) / 2) * spread;
      const crit = Math.random() < this.stats.crit;
      this.bullets.push({
        x: src.x + Math.cos(a) * src.r,
        y: src.y + Math.sin(a) * src.r,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: crit ? r + 3 : r,
        dmg: crit ? dmg * 2 : dmg,
        crit,
        pierce,
        friendly: true,
        color: crit ? '#ffd23f' : color,
        life: 1.2,
        hit: new Set(),
      });
    }
  }

  enemyShoot(x, y, angle, speed, dmg) {
    this.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 8, dmg, friendly: false, color: '#ff4d6d', life: 6,
    });
    sfx.enemyShot();
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.burst(e.x, e.y, e.color, 12, e.r);
    this.shake(3);
    sfx.kill();
    if (Math.random() < 0.08) this.dropPickup('heart', e.x, e.y);
    if (this.stats.lifesteal && !this.player.dead) this.healPlayer(this.stats.lifesteal);
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

  floatText(x, y, text, color, size = 18) {
    this.texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -70 });
  }

  // ═════════════ Dibujo ═════════════

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const tr = this.transition;
    if (tr) {
      // Deslizamiento de cámara: la sala vieja sale y la nueva entra
      const k = clamp(tr.t / SLIDE, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const [dx, dy] = DIRS[tr.dir];
      ctx.save();
      ctx.translate(-dx * W * e, -dy * H * e);
      drawRoom(ctx, tr.from, this.time);
      drawDoors(ctx, tr.from, 1);
      ctx.restore();
      ctx.save();
      ctx.translate(dx * W * (1 - e), dy * H * (1 - e));
      this.drawWorld(ctx);
      ctx.restore();
    } else {
      ctx.save();
      if (this.shakeAmt > 0.3) ctx.translate(rand(-1, 1) * this.shakeAmt, rand(-1, 1) * this.shakeAmt);
      this.drawWorld(ctx);
      ctx.restore();
    }

    if (this.state !== 'menu' && this.floor) {
      drawMinimap(ctx, this.floor, this.room, `PLANTA ${this.floorNum}`, this.time);
    }
    this.drawBossBar(ctx);
    this.drawBanner(ctx);
  }

  drawWorld(ctx) {
    drawRoom(ctx, this.room, this.time);
    drawDoors(ctx, this.room, this.doorOpen);
    for (const pk of this.pickups) drawPickup(ctx, pk, this.time);

    // Ordenamos por "y" para que lo de abajo se dibuje delante (falsa profundidad)
    const list = [...this.enemies, ...this.allies];
    if (!this.player.dead) list.push(this.player);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.draw(ctx, this);

    for (const b of this.bullets) drawBullet(ctx, b);
    this.drawParticles(ctx);
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
      if (pt.ring) {
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

  // Barra de vida de jefes (se usará a partir de la fase 2)
  drawBossBar(ctx) {
    const boss = this.enemies.find((e) => e.type === 'boss' && e.active);
    if (!boss) return;
    const w = 420, x = W / 2 - w / 2, y = H - WALL - 40;
    ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, 26, 13);
    ctx.fillStyle = OUTLINE; ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 18, 9);
    ctx.fillStyle = boss.color; ctx.fill();
    outlinedText(ctx, `👑 ${boss.name}`, W / 2, y - 16, 22, '#ffd23f', { lw: 6 });
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
