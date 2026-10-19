// ─────────────────────────────────────────────
//  Combate: las balas, los golpes cuerpo a cuerpo, los disparos de los zombis, qué pasa cuando
//  muere uno (y cuando cae un jefe) y lo que sueltan (billetes, molotovs, granadas, munición).
//
//  Son métodos de Game: game.js los añade a la clase, así que dentro "this" es la partida.
// ─────────────────────────────────────────────
import { WALL } from './config.js';
import { rand, clamp, dist, pushOut, obstacleGap } from './utils.js';
import { destello } from './luz.js';
import { isWall, lineClear } from './shapes.js';
import { MOLOTOV } from './molotov.js';
import { GRANADA } from './granada.js';
import { sfx } from './sfx.js';
import { animDuration } from './sprites.js';

const CASH_CHANCE = 0.07;  // probabilidad de que un zombi suelte un billete de dólar 💵
const AMMO_CHANCE = 0.1;   // ...o una caja de munición (solo si llevas arma de fuego; provisional)
const BULLET_LIFT = 22;    // pixel art: altura a la que se dibujan las balas de un arma dibujada (la del cuerpo de un zombi)

export class GameCombat {
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
      // pixel art: la bala sale a la altura del cañón y baja enseguida a la del cuerpo (solo el dibujo)
      if (b.lift > BULLET_LIFT) b.lift += (BULLET_LIFT - b.lift) * (1 - Math.exp(-dt * 14));
      const outside = isWall(this.room.layout, b.x, b.y);
      if (outside || this.room.layout.obstacles.some((o) => obstacleGap(o, b) < b.r * 0.5)) {
        b.dead = true;
        if (b.friendly) this.bulletImpact(b, true); else this.puff(b.x, b.y, b.color);
        continue;
      }
      if (b.friendly) {
        for (const e of this.enemies) {
          if (!e.active || b.hit.has(e)) continue;
          if (dist(e, b) < e.r + b.r) {
            b.hit.add(e);
            const l = Math.hypot(b.vx, b.vy) || 1;
            e.hurt(b.dmg, b.crit, b.vx / l, b.vy / l, this, b.knock ?? 1);
            this.bulletImpact(b, false);
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
      // Los billetes siempre vienen a ti; los molotovs y las granadas, si caben en la mochila
      const wanted = pk.kind === 'cash' || (pk.kind === 'molotov' ? this.molotovs < MOLOTOV.max + this.stats.extraThrow
        : pk.kind === 'granada' ? this.granadas < GRANADA.max + this.stats.extraThrow
        : pk.kind === 'ammo' ? p.wantsAmmo() : false);
      if (!p.dead && wanted && pk.t > 0.4 && d < this.stats.magnet) {
        pk.vx += (dx / d) * 2200 * dt;
        pk.vy += (dy / d) * 2200 * dt;
        const sp = Math.hypot(pk.vx, pk.vy);
        if (sp > 650) { pk.vx *= 650 / sp; pk.vy *= 650 / sp; }
      }
      pk.x = clamp(pk.x + pk.vx * dt, WALL + 14, this.rw - WALL - 14);
      pk.y = clamp(pk.y + pk.vy * dt, WALL + 14, this.rh - WALL - 14);
      for (const b of this.room.layout.blocks) pushOut(pk, b);
      for (const o of this.room.layout.obstacles) pushOut(pk, o); // que nada se quede debajo de un mueble
      if (!p.dead && wanted && pk.t > 0.25 && d < p.r + 12) this.collect(pk);
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.room.pickups = this.pickups;
  }

  collect(pk) {
    pk.dead = true;
    if (pk.kind === 'cash') {
      // los dólares de la partida no se guardan hasta completar el edificio (game.js, endRun)
      this.runKeys++;
      this.wallet = this.savedKeys + this.runKeys;
      this.floatText(pk.x, pk.y - 20, '+$1', '#80ed99', 20);
      sfx.coin();
    } else if (pk.kind === 'ammo') {
      this.player.addAmmo(this);
      this.floatText(pk.x, pk.y - 20, '+munición', '#ffd23f', 20);
      sfx.reloaded();
    } else if (pk.kind === 'granada') {
      this.granadas = Math.min(GRANADA.max + this.stats.extraThrow, this.granadas + 1);
      this.floatText(pk.x, pk.y - 20, '+1 granada', '#9bbd5a', 20);
      sfx.buy();
    } else if (pk.kind === 'molotov') {
      this.molotovs = Math.min(MOLOTOV.max + this.stats.extraThrow, this.molotovs + 1);
      this.floatText(pk.x, pk.y - 20, '+1 molotov', '#ff9f1c', 20);
      sfx.buy();
    }
  }

  nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (!e.active) continue;
      // con la cámara cerca solo se apunta a lo que se ve en pantalla
      if (!this.camera.inView(e, 30)) continue;
      // ni a lo que queda detrás de un muro o en una habitación a oscuras
      if (!lineClear(this.room.layout, x, y, e.x, e.y) || this.hidden(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Dispara una o varias balas aliadas. `o` admite: dmg, count, spread, jitter,
  // speed, life, pierce, knock, color, r, x, y (punto de salida) y lift (altura a la que se dibuja al salir)
  fireVolley(src, angle, o) {
    if (src === this.player) this.noise(src.x, src.y);
    const n = o.count || 1;
    // el fogonazo alumbra un instante alrededor de la boca del arma (el de la escopeta, más)
    destello(this, o.x ?? src.x, o.y ?? src.y, n > 1 ? 170 : 120, n > 1 ? 0.12 : 0.08);
    const spread = o.spread ?? 0.16;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - 0.5) * spread * (n > 2 ? 1 : 0.6) : 0;
      const a = angle + off + (Math.random() - 0.5) * (o.jitter || 0);
      const crit = o.crit || Math.random() < this.stats.crit;
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
        lift: o.lift || 0,
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
    // el explosivo ya tiene su explosión: sus trozos salen color fuego y sin anillo
    this.burst(e.x, e.y, e.type === 'explosivo' ? '#ff9f1c' : e.color, 12, e.r, e.type !== 'explosivo');
    this.shake(3);
    sfx.kill();
    if (!e.isBoss) {
      if (Math.random() < CASH_CHANCE) this.dropPickup('cash', e.x, e.y);
      else if (Math.random() < MOLOTOV.drop) this.dropPickup('molotov', e.x, e.y);
      else if (Math.random() < GRANADA.drop) this.dropPickup('granada', e.x, e.y);
      else if (this.player.slots.ranged && Math.random() < AMMO_CHANCE) this.dropPickup('ammo', e.x, e.y);
    }
    if (this.stats.lifesteal && !this.player.dead) this.healPlayer(this.stats.lifesteal);
    // Caníbal (mutación): cada zombi muerto cura un poco
    if (this.stats.canibal && !this.player.dead) this.healPlayer(this.stats.maxHp * this.stats.canibal);
    if (e.isBoss) this.bossDefeated(e);
  }

  // Al caer un jefe desaparecen sus esbirros y sus proyectiles
  bossDefeated(boss) {
    for (const e of this.enemies) {
      if (!e.dead) { e.dead = true; this.burst(e.x, e.y, e.color, 8, e.r); }
    }
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.hazards = [];
    this.trail = [];
    this.lobs = [];
    this.grenades = [];
    this.burst(boss.x, boss.y, '#ffd23f', 30, boss.r);
    this.burst(boss.x, boss.y - 40, boss.color, 20, boss.r);
    this.fx('objeto-fx-chispa', boss.x, boss.y - 20);
    this.shake(20);
    this.hitStop = 0.35; // cámara lenta un instante: ¡golpe final!
    sfx.boom();
    for (let i = 0; i < (boss.type === 'boss' ? 8 : 3); i++) this.dropPickup('cash', boss.x, boss.y);
    for (let i = 0; i < 2; i++) this.dropPickup('ammo', boss.x, boss.y); // y munición
    // Las armas ya solo se compran en la tienda del ordenador (ordenador.js): el mini jefe no suelta ninguna
    if (boss.type === 'miniboss') {
      // un segundo después de que su cuerpo acabe de caer, el recuadro de las mutaciones (mutaciones.js)
      const caer = boss.sprite ? animDuration(boss.sprite, 'death') || 0 : 0;
      this.later(caer + 1, () => this.openMutacion());
    }
  }

  // Ninja: al acabar la esquiva, un barrido en círculo con el arma cuerpo a cuerpo. Los zombis que pilla
  // mueren al momento; a los jefes les quita un 10 % de su vida.
  ninjaStrike(p) {
    const w = p.slots.melee || p.weapon;
    const s = this.stats;
    const reach = (w.reach || 60) * s.range * s.meleeRange + p.r;
    let hits = 0;
    for (const e of this.enemies) {
      if (!e.active || dist(e, p) > reach + e.r) continue;
      const l = dist(e, p) || 1;
      e.hurt(e.isBoss ? e.maxHp * 0.1 : e.hp + 1, true, (e.x - p.x) / l, (e.y - p.y) / l, this, 1.5);
      hits++;
    }
    // el barrido se ve aunque no pille a nadie
    this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: reach * 0.6, ring: true, color: '#9fe8ff', life: 0.25, max: 0.25 });
    if (hits) { this.shake(6); this.hitStop = Math.max(this.hitStop || 0, 0.06); }
    sfx.swing();
  }

  dropPickup(kind, x, y) {
    const a = rand(0, Math.PI * 2), s = rand(80, 220);
    this.pickups.push({ kind, x, y, r: 14, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, seed: rand(0, 6) });
  }
}
