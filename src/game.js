// ─────────────────────────────────────────────
//  Game: controla el flujo de la partida
//  menú → salas → recompensas → jefe → fin
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, TOTAL_ROOMS, MAX_ALLIES, ALLY_COLORS } from './config.js';
import { rand, randInt, clamp, dist, pushOut } from './utils.js';
import { Player, Ally, Enemy } from './entities.js';
import { makeRoom, doorOptions, ROOM_TYPES } from './rooms.js';
import { rollCards, makeShopOffers, restOptions, baseStats, startCoins, buyMeta } from './upgrades.js';
import { loadSave, writeSave, addGems } from './save.js';
import { drawRoom, drawDoors, drawInteract, drawPickup, drawBullet } from './render.js';
import { outlinedText } from './draw.js';
import { getMoveVector, consumeDash, clearInput } from './input.js';
import { sfx } from './sfx.js';

const TRANS = 0.45; // duración de cada mitad de la transición entre salas

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

  resetWorld() {
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.doors = [];
    this.timers = [];
    this.interact = null;
    this.banner = null;
    this.transition = null;
  }

  setupMenuScene() {
    this.resetWorld();
    this.room = makeRoom(0, 'menu');
    this.stats = baseStats(loadSave());
    this.player = new Player(this.stats);
    this.player.x = W / 2; this.player.y = H / 2 + 60;
    this.allies = [];
    this.addAlly(); this.addAlly();
    this.menuTarget = { x: W / 2, y: H / 2, t: 0 };
  }

  goMenu() {
    this.state = 'menu';
    this.paused = false;
    this.setupMenuScene();
    this.ui.showHud(false);
    this.ui.showMenu(loadSave(), {
      play: () => this.newRun(),
      workshop: () => this.openWorkshop(),
    });
  }

  openWorkshop() {
    const save = loadSave();
    this.ui.showWorkshop(save, {
      buy: (id) => {
        if (buyMeta(save, id)) { writeSave(save); sfx.buy(); } else sfx.nope();
        this.openWorkshop();
      },
      back: () => this.goMenu(),
    });
  }

  newRun() {
    const save = loadSave();
    this.resetWorld();
    this.stats = baseStats(save);
    this.player = new Player(this.stats);
    this.allies = [];
    for (let i = 0; i < save.upgrades.amigo; i++) this.addAlly();
    this.coins = startCoins(save);
    this.runGems = 0;
    this.kills = 0;
    this.roomIndex = 0;
    this.state = 'playing';
    this.paused = false;
    clearInput();
    this.ui.hide();
    this.ui.showHud(true);
    this.enterRoom('combat');
    this.transition = { phase: 'in', t: 0 };
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
    save.best = Math.max(save.best || 0, this.roomIndex + 1);
    if (win) save.wins = (save.wins || 0) + 1;
    writeSave(save);
    this.ui.showHud(false);
    if (quit) { this.goMenu(); return; }
    this.ui.showEnd(
      { win, room: this.roomIndex + 1, total: TOTAL_ROOMS, kills: this.kills, gems: this.runGems, team: this.allies.length },
      { retry: () => this.newRun(), menu: () => this.goMenu() },
    );
  }

  // ═════════════ Salas ═════════════

  enterRoom(type) {
    const keepAllies = this.allies;
    this.resetWorld();
    this.allies = keepAllies;
    this.room = makeRoom(this.roomIndex, type);
    this.cleared = false;
    this.waveIdx = 0;
    this.waveDelay = 0;

    const p = this.player;
    p.x = W / 2; p.y = H - WALL - 50; p.vx = 0; p.vy = 0;
    p.lookX = 0; p.lookY = -1;
    this.allies.forEach((a) => { a.x = p.x + rand(-30, 30); a.y = p.y + rand(-10, 20); });

    switch (type) {
      case 'combat':
      case 'elite':
      case 'boss':
        this.waveDelay = type === 'boss' ? 1.2 : 0.9;
        break;
      case 'treasure':
        this.interact = { kind: 'chest', x: W / 2, y: H / 2 + 20, r: 36, used: false };
        this.cleared = true;
        this.openDoors();
        break;
      case 'shop':
        this.interact = { kind: 'shop', x: W / 2, y: H / 2 + 40, r: 62, used: false };
        this.shopOffers = makeShopOffers(this);
        this.cleared = true;
        this.openDoors();
        break;
      case 'rest':
        this.interact = { kind: 'campfire', x: W / 2, y: H / 2 + 20, r: 32, used: false };
        this.cleared = true;
        this.openDoors();
        break;
    }
    if (this.interact) this.interact.inside = false;

    const info = ROOM_TYPES[type];
    this.banner = { title: `${info.icon} ${info.name}`, sub: `Sala ${this.roomIndex + 1} de ${TOTAL_ROOMS} · ${this.room.biome.name}`, t: 0 };
  }

  openDoors() {
    if (this.roomIndex >= TOTAL_ROOMS - 1) return;
    const opts = doorOptions(this.roomIndex + 1, this.room.type);
    const xs = opts.length === 1 ? [W / 2] : [W * 0.3, W * 0.7];
    this.doors = opts.map((type, i) => ({ type, x: xs[i], open: 0 }));
    sfx.door();
  }

  spawnWave(types) {
    const mul = (1 + this.roomIndex * 0.18) * (this.room.type === 'elite' ? 1.4 : 1);
    const elite = this.room.type === 'elite';
    for (const t of types) {
      if (t === 'boss') {
        this.enemies.push(new Enemy('boss', W / 2, H / 2 - 70, 1));
        sfx.boss();
        this.shake(10);
      } else {
        const pos = this.findSpawnPoint();
        this.enemies.push(new Enemy(t, pos.x, pos.y, mul, elite && Math.random() < 0.5));
      }
    }
  }

  spawnEnemy(type, x, y) {
    const mul = 1 + this.roomIndex * 0.18;
    const e = new Enemy(type, clamp(x, WALL + 30, W - WALL - 30), clamp(y, WALL + 30, H - WALL - 30), mul);
    this.enemies.push(e);
  }

  findSpawnPoint() {
    for (let i = 0; i < 40; i++) {
      const pt = { x: rand(WALL + 50, W - WALL - 50), y: rand(WALL + 50, H - WALL - 60) };
      if (dist(pt, this.player) < 240) continue;
      if (this.room.obstacles.some((o) => dist(o, pt) < o.r + 40)) continue;
      return pt;
    }
    return { x: W / 2, y: WALL + 80 };
  }

  roomCleared() {
    this.cleared = true;
    sfx.clear();
    this.banner = { title: '¡Sala superada!', sub: '', t: 0 };
    const luck = this.room.type === 'elite' ? 1 : 0;
    this.later(0.9, () => this.offerCards(rollCards(this, 3, luck), 'Elige una mejora', () => this.openDoors()));
  }

  offerCards(cards, title, then) {
    if (this.player.dead) return;
    this.paused = true;
    clearInput();
    sfx.card();
    this.ui.showCards(cards, title, (card) => {
      card.apply(this);
      this.ui.hide();
      this.paused = false;
      this.floatText(this.player.x, this.player.y - 40, `${card.icon} ${card.name}`, '#ffd23f', 22);
      sfx.buy();
      if (then) then();
    });
  }

  useInteract(it) {
    if (it.kind === 'chest' && !it.used) {
      it.used = true;
      this.dropCoins(it.x, it.y - 10, randInt(10, 16));
      this.dropPickup('gem', it.x, it.y - 10);
      this.burst(it.x, it.y - 20, '#ffd23f', 18, 30);
      this.shake(6);
      sfx.clear();
      this.later(0.7, () => this.offerCards(rollCards(this, 3, 1), '¡Tesoro! Elige una', null));
    } else if (it.kind === 'shop') {
      this.openShop();
    } else if (it.kind === 'campfire' && !it.used) {
      this.offerCards(restOptions(this), 'Hoguera: elige una', () => { it.used = true; });
    }
  }

  openShop() {
    this.paused = true;
    clearInput();
    for (const o of this.shopOffers) o.blocked = !!(o.canBuy && !o.canBuy(this));
    this.ui.showShop(this.shopOffers, this.coins, {
      buy: (offer) => {
        const blocked = offer.canBuy && !offer.canBuy(this);
        if (offer.sold || this.coins < offer.price || blocked) { sfx.nope(); return; }
        this.coins -= offer.price;
        offer.sold = true;
        offer.apply(this);
        sfx.buy();
        this.openShop();
      },
      close: () => { this.ui.hide(); this.paused = false; },
    });
  }

  addAlly() {
    if (this.allies.length >= MAX_ALLIES) return false;
    const p = this.player;
    const a = new Ally(ALLY_COLORS[this.allies.length % ALLY_COLORS.length], p.x, p.y + 30);
    this.allies.push(a);
    this.allies.forEach((al, i) => { al.idx = i; });
    if (this.state === 'playing') {
      this.burst(a.x, a.y, a.color, 10, 14);
      this.floatText(a.x, a.y - 30, '¡Nuevo compañero!', '#80ed99', 20);
    }
    return true;
  }

  healPlayer(n) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.stats.maxHp, p.hp + n);
    const healed = Math.round(p.hp - before);
    if (healed > 0) this.floatText(p.x, p.y - 34, `+${healed}`, '#80ed99', 20);
  }

  // ═════════════ Bucle principal ═════════════

  later(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') { this.updateMenu(dt); return; }
    if (this.state !== 'playing' || this.paused) return;

    if (this.transition) {
      const tr = this.transition;
      tr.t += dt;
      if (tr.phase === 'out') {
        if (tr.t >= TRANS) {
          this.roomIndex++;
          this.enterRoom(tr.next);
          this.transition = { phase: 'in', t: 0 };
        }
        return;
      }
      if (tr.t >= TRANS) this.transition = null;
    }
    this.updatePlay(dt);
  }

  updateMenu(dt) {
    // En el menú el héroe pasea solo con sus compañeros
    const m = this.menuTarget;
    m.t -= dt;
    if (m.t <= 0) {
      m.x = rand(W * 0.3, W * 0.7); m.y = rand(H * 0.45, H * 0.75); m.t = rand(1.5, 3);
    }
    const dx = m.x - this.player.x, dy = m.y - this.player.y;
    const d = Math.hypot(dx, dy);
    const mv = d > 20 ? { x: (dx / d) * 0.6, y: (dy / d) * 0.6 } : { x: 0, y: 0 };
    this.player.update(dt, this, mv, false);
    this.allies.forEach((a) => a.update(dt, this));
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
    this.checkDoors(dt);
    this.checkInteract();

    this.shakeAmt *= Math.exp(-dt * 10);
    if (this.banner) this.banner.t += dt;
    this.ui.updateHud(this);
  }

  updateWaves(dt) {
    const waves = this.room.waves;
    if (this.cleared || !waves.length) return;
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnWave(waves[this.waveIdx]);
      return;
    }
    if (this.enemies.length === 0) {
      if (this.waveIdx < waves.length - 1) {
        this.waveIdx++;
        this.waveDelay = 0.7;
      } else if (this.room.type !== 'boss') {
        this.roomCleared();
      }
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
      if (outside || this.room.obstacles.some((o) => dist(o, b) < o.r + b.r * 0.5)) {
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
    for (const pk of this.pickups) {
      pk.t += dt;
      const fr = Math.exp(-dt * 5);
      pk.vx *= fr; pk.vy *= fr;
      const dx = p.x - pk.x, dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      // Al terminar la sala, todo vuela hacia el jugador
      const range = this.cleared ? Infinity : this.stats.magnet;
      if (!p.dead && pk.t > 0.4 && d < range) {
        pk.vx += (dx / d) * 2200 * dt;
        pk.vy += (dy / d) * 2200 * dt;
        const sp = Math.hypot(pk.vx, pk.vy);
        if (sp > 650) { pk.vx *= 650 / sp; pk.vy *= 650 / sp; }
      }
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.x = clamp(pk.x, WALL + 10, W - WALL - 10);
      pk.y = clamp(pk.y, WALL + 10, H - WALL - 10);
      if (!p.dead && pk.t > 0.25 && d < p.r + 12) this.collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);
  }

  collect(pk) {
    pk.dead = true;
    if (pk.kind === 'coin') {
      this.coins += pk.value;
      sfx.coin();
    } else if (pk.kind === 'gem') {
      this.runGems++;
      addGems(1); // las gemas se guardan al momento, ¡nunca se pierden!
      this.floatText(pk.x, pk.y - 20, '+1 💎', '#4cc9f0', 20);
      sfx.gem();
    } else if (pk.kind === 'heart') {
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

  checkDoors(dt) {
    const p = this.player;
    for (const d of this.doors) {
      d.open = Math.min(1, d.open + dt * 2.5);
      const atDoor = Math.abs(p.x - d.x) < DOOR_W / 2 - 6 && p.y - p.r <= WALL + 2;
      if (d.open >= 1 && atDoor && !this.transition && !p.dead && this.pickups.length === 0) {
        this.transition = { phase: 'out', t: 0, next: d.type, x: p.x, y: p.y };
        sfx.door();
      }
    }
  }

  checkInteract() {
    const it = this.interact;
    if (!it) return;
    const p = this.player;
    const near = dist(it, p) <= it.r + p.r + 6;
    if (near && !it.inside) this.useInteract(it);
    it.inside = near;
  }

  // ═════════════ Combate ═════════════

  collideWorld(ent, solid) {
    ent.x = clamp(ent.x, WALL + ent.r, W - WALL - ent.r);
    ent.y = clamp(ent.y, WALL + ent.r, H - WALL - ent.r);
    for (const o of this.room.obstacles) pushOut(ent, o);
    if (solid && this.interact) pushOut(ent, this.interact);
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
    const boss = e.type === 'boss';
    this.burst(e.x, e.y, e.color, boss ? 40 : 12, e.r);
    this.shake(boss ? 20 : 3);
    sfx.kill();
    let n = randInt(e.coins[0], e.coins[1]);
    if (e.elite) n = Math.ceil(n * 1.5);
    this.dropCoins(e.x, e.y, n);
    if (Math.random() < (e.elite ? 0.2 : 0.07)) this.dropPickup('gem', e.x, e.y);
    if (Math.random() < 0.06) this.dropPickup('heart', e.x, e.y);
    if (this.stats.lifesteal && !this.player.dead) this.healPlayer(this.stats.lifesteal);
    if (boss) this.bossDefeated(e);
  }

  bossDefeated(boss) {
    for (const e of this.enemies) {
      if (!e.dead) { e.dead = true; this.burst(e.x, e.y, e.color, 10, e.r); }
    }
    this.bullets = this.bullets.filter((b) => b.friendly);
    for (let i = 0; i < 5; i++) this.dropPickup('gem', boss.x, boss.y);
    this.cleared = true;
    this.banner = { title: '¡VICTORIA!', sub: 'Has derrotado al Rey Gelatina', t: 0 };
    sfx.clear();
    this.later(2.6, () => this.endRun(true));
  }

  onPlayerDeath() {
    const p = this.player;
    p.dead = true;
    this.burst(p.x, p.y, '#ffd23f', 30, p.r);
    this.shake(18);
    this.later(1.4, () => this.endRun(false));
  }

  dropCoins(x, y, n) {
    for (let i = 0; i < n; i++) this.dropPickup('coin', x, y);
  }

  dropPickup(kind, x, y) {
    const a = rand(0, Math.PI * 2), s = rand(80, 220);
    this.pickups.push({ kind, value: 1, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, seed: rand(0, 6) });
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
    this.particles.push({ x, y, vx: 0, vy: 0, r: r, ring: true, color: '#ffffff', life: 0.3, max: 0.3 });
  }

  floatText(x, y, text, color, size = 18) {
    this.texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -70 });
  }

  // ═════════════ Dibujo ═════════════

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (this.shakeAmt > 0.3) ctx.translate(rand(-1, 1) * this.shakeAmt, rand(-1, 1) * this.shakeAmt);

    drawRoom(ctx, this.room, this.time);
    drawDoors(ctx, this.doors, this.time);
    if (this.interact) drawInteract(ctx, this.interact, this.time);
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
    ctx.restore();

    this.drawBossBar(ctx);
    this.drawBanner(ctx);
    this.drawTransition(ctx);
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

  drawBossBar(ctx) {
    const boss = this.enemies.find((e) => e.type === 'boss' && e.active);
    if (!boss) return;
    const w = 420, x = W / 2 - w / 2, y = WALL + 36;
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
    const y = H * 0.3;
    const s = 0.6 + 0.4 * (1 - Math.pow(1 - appear, 3));
    ctx.translate(W / 2, y);
    ctx.scale(s, s);
    outlinedText(ctx, b.title, 0, 0, 56, '#ffd23f', { lw: 12 });
    if (b.sub) outlinedText(ctx, b.sub, 0, 46, 22, '#ffffff', { lw: 7 });
    ctx.restore();
  }

  drawTransition(ctx) {
    const tr = this.transition;
    if (!tr) return;
    const k = clamp(tr.t / TRANS, 0, 1);
    const maxR = Math.hypot(W, H);
    const r = tr.phase === 'out' ? (1 - k) * maxR : k * maxR;
    const cx = tr.phase === 'out' ? tr.x : this.player.x;
    const cy = tr.phase === 'out' ? tr.y : this.player.y;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fill('evenodd');
  }
}
