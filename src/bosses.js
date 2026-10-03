// ─────────────────────────────────────────────
//  Jefes de Apartamentos
//
//  · "El vecino del 4ºB" (mini jefe de cada planta): un zombi enorme en
//    camiseta de tirantes. Embiste, pega pisotones y llama a los vecinos.
//  · "La portera" (jefa final): barre polvo en abanico, da escobazos,
//    lanza botellas de lejía y, a mitad de vida, se enfada de verdad.
//
//  Cada jefe es una pequeña máquina de estados: anda un rato, elige un
//  ataque, lo AVISA (siempre se puede esquivar) y lo ejecuta.
// ─────────────────────────────────────────────
import { W, H, WALL, OUTLINE } from './config.js';
import { rand } from './utils.js';
import { drawHuman } from './draw.js';
import { drawSpawnWarning } from './entities.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const BOSS_TYPES = {
  miniboss: {
    name: 'El vecino del 4ºB', icon: '👹', hp: 400, r: 28, s: 1.9, speed: 70, dmg: 10, bar: '#ff5d73',
    look: { skin: '#9cbf7a', hair: '#7a7468', shirt: '#f1efe6', pants: '#4f6d9a', shoes: '#c94c4c' },
  },
  boss: {
    name: 'La portera', icon: '👑', hp: 1200, r: 26, s: 1.75, speed: 80, dmg: 10, bar: '#b5179e',
    look: { skin: '#b9d38f', hair: '#cfc8dc', shirt: '#9b6bb5', pants: '#6d597a', shoes: '#5c4b6e' },
  },
};

// Valores ajustables de cada ataque
export const VECINO = {
  chargeWarn: 0.85, chargeSpeed: 560, chargeMax: 1.1, chargeDmg: 24, stun: 1.4,
  stompWarn: 0.75, stompRadius: 150, stompDmg: 20, stompRange: 200,
  summonCd: 9, maxMinions: 4,
};
export const PORTERA = {
  fanWarn: 0.55, fanCount: 7, fanSpread: 1.0, fanSpeed: 240, fanDmg: 10,
  sweepWarn: 0.6, sweepReach: 135, sweepHalf: 1.05, sweepDmg: 20, sweepRange: 150,
  bottles: 3, spinTime: 2.6, spinDmg: 10,
};
// Charco de lejía (lo usa game.js igual que los de veneno)
export const BLEACH = { hit: 10, dps: 8, life: 5, radius: 54, flight: 0.9 };

const SPAWN = 1.4;

// ═════════════ Base común ═════════════
class BossBase {
  constructor(type, x, y, hpMul) {
    const d = BOSS_TYPES[type];
    this.type = type;
    this.def = d;
    this.name = d.name;
    this.icon = d.icon;
    this.color = d.bar;
    this.x = x; this.y = y;
    this.r = d.r;
    this.s = d.s;
    this.maxHp = Math.round(d.hp * hpMul);
    this.hp = this.maxHp;
    this.dmg = d.dmg;
    this.vx = 0; this.vy = 0;
    this.kx = 0; this.ky = 0;
    this.spawnT = SPAWN;
    this.t = 0;
    this.walkT = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.lookX = 0; this.lookY = 1;
    this.phase = 1;
    this.state = { name: 'walk', t: 0, dur: 1.2 };
  }

  get active() { return this.spawnT <= 0 && !this.dead; }
  get isBoss() { return true; }

  setState(name, data = {}) { this.state = { name, t: 0, ...data }; }

  minions(game) { return game.enemies.filter((e) => !e.isBoss && !e.dead).length; }

  // Camina hacia (tx, ty) con aceleración suave
  steer(dt, tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = 1 - Math.exp(-dt * 6);
    this.vx += ((dx / d) * speed - this.vx) * k;
    this.vy += ((dy / d) * speed - this.vy) * k;
  }

  brake(dt, rate = 10) {
    const k = Math.exp(-dt * rate);
    this.vx *= k; this.vy *= k;
  }

  look(dt, tx, ty, rate = 8) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.lookX += (dx / d - this.lookX) * Math.min(1, dt * rate);
    this.lookY += (dy / d - this.lookY) * Math.min(1, dt * rate);
  }

  move(dt, game) {
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
    const kd = Math.exp(-dt * 10);
    this.kx *= kd; this.ky *= kd;
    game.collideWorld(this);
    const sp = Math.hypot(this.vx, this.vy);
    this.walkT += dt * (sp > 10 ? 3 + sp / 30 : 0);
  }

  update(dt, game) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.t += dt;
    this.hitFlash -= dt;
    this.state.t += dt;
    this.think(dt, game);
  }

  hurt(dmg, crit, dirX, dirY, game, knock = 1) {
    if (this.dead || this.invulnerable) return;
    this.hp -= dmg;
    this.hitFlash = 0.08;
    // los jefes apenas se mueven con los golpes
    const push = this.heavy ? 0 : 8 * knock;
    this.kx += dirX * push; this.ky += dirY * push;
    game.floatText(this.x + rand(-10, 10), this.y - 60 * this.s, Math.round(dmg).toString(), crit ? '#ffd23f' : '#ffffff', crit ? 26 : 18);
    sfx.hit();
    if (this.hp <= 0) { this.hp = 0; game.killEnemy(this); }
  }

  drawShadow(ctx, k = 1) {
    ctx.fillStyle = 'rgba(20, 16, 40, 0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 15 * this.s, 17 * this.s * k, 6 * this.s * k, 0, 0, TAU);
    ctx.fill();
  }

  // Estrellitas girando sobre la cabeza (aturdido)
  drawStars(ctx, x, y, time) {
    for (let i = 0; i < 4; i++) {
      const a = time * 4 + (i / 4) * TAU;
      const sx = x + Math.cos(a) * 26, sy = y + Math.sin(a) * 8;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const r = j % 2 ? 3 : 7, b = (j / 10) * TAU - Math.PI / 2;
        ctx.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }
}

// Pasillo rojo de aviso (embestida)
function drawLane(ctx, x, y, angle, len, width, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(0, -width, len, width * 2, width);
  ctx.fillStyle = `rgba(255, 60, 90, ${0.08 + k * 0.25})`;
  ctx.fill();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -k * 60;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
  ctx.stroke();
  ctx.setLineDash([]);
  // flechas
  ctx.fillStyle = `rgba(255, 60, 90, ${0.4 + k * 0.5})`;
  for (let i = 1; i <= 3; i++) {
    const ax = (len / 4) * i;
    ctx.beginPath();
    ctx.moveTo(ax + 14, 0);
    ctx.lineTo(ax - 6, -12);
    ctx.lineTo(ax - 6, 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Círculo de aviso en el suelo (pisotón, giro...)
function drawCircleWarn(ctx, x, y, r, k, color = '255, 60, 90') {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.fillStyle = `rgba(${color}, ${0.08 + k * 0.22})`;
  ctx.fill();
  ctx.setLineDash([10, 7]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(${color}, 0.9)`;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(x, y, r * k, r * 0.75 * k, 0, 0, TAU);
  ctx.fillStyle = `rgba(${color}, 0.25)`;
  ctx.fill();
  ctx.restore();
}

// Distancia hasta la pared siguiendo un ángulo (para dibujar el aviso)
function distToWall(x, y, a, r) {
  const cx = Math.cos(a), cy = Math.sin(a);
  let t = 2000;
  if (cx > 0.001) t = Math.min(t, (W - WALL - r - x) / cx);
  if (cx < -0.001) t = Math.min(t, (WALL + r - x) / cx);
  if (cy > 0.001) t = Math.min(t, (H - WALL - r - y) / cy);
  if (cy < -0.001) t = Math.min(t, (WALL + r - y) / cy);
  return Math.max(0, t);
}

// ═════════════ EL VECINO DEL 4ºB ═════════════
export class Vecino extends BossBase {
  constructor(x, y, hpMul = 1) {
    super('miniboss', x, y, hpMul);
    this.chargeCd = 1.5;
    this.stompCd = 2;
    this.summonCd = 5;
    this.hop = 0;
  }

  think(dt, game) {
    const p = game.player;
    const st = this.state;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    this.chargeCd -= dt; this.stompCd -= dt; this.summonCd -= dt;
    this.dmg = this.def.dmg;
    this.heavy = false;
    this.hop = 0;

    // Por debajo del 40 % de vida se enfada: anda más rápido y embiste dos veces
    if (this.phase === 1 && this.hp < this.maxHp * 0.4) {
      this.phase = 2;
      game.floatText(this.x, this.y - 80 * this.s, '¡SE ACABÓ!', '#ffd23f', 30);
      game.shake(12);
      sfx.roar();
    }
    const angry = this.phase === 2;

    switch (st.name) {
      case 'walk': {
        this.steer(dt, p.x, p.y, (angry ? 95 : 70) * (0.6 + 0.4 * Math.abs(Math.sin(this.t * 2.5))));
        this.look(dt, p.x, p.y);
        if (st.t >= st.dur) this.choose(game, d);
        break;
      }
      case 'chargeWarn': {
        // se agacha y escarba: sigue apuntándote durante el 60 % del aviso y luego fija la dirección
        this.brake(dt);
        if (st.t < st.warn * 0.6) st.angle = Math.atan2(p.y - this.y, p.x - this.x);
        this.lookX = Math.cos(st.angle); this.lookY = Math.sin(st.angle);
        if (Math.random() < dt * 14) game.puff(this.x - this.lookX * 20 + rand(-10, 10), this.y + 26, '#d8cbb0');
        if (st.t >= st.warn) {
          this.setState('charge', { angle: st.angle, chain: st.chain });
          sfx.charge();
        }
        break;
      }
      case 'charge': {
        this.heavy = true;
        this.dmg = VECINO.chargeDmg;
        const sp = VECINO.chargeSpeed;
        this.vx = Math.cos(st.angle) * sp;
        this.vy = Math.sin(st.angle) * sp;
        const bx = this.x, by = this.y;
        this.move(dt, game);
        if (Math.random() < dt * 30) game.puff(this.x + rand(-14, 14), this.y + 26, '#d8cbb0');
        const moved = Math.hypot(this.x - bx, this.y - by);
        // ¡choca contra la pared!
        if (st.t > 0.08 && moved < sp * dt * 0.5) {
          game.shake(16);
          sfx.slam();
          game.burst(this.x + Math.cos(st.angle) * this.r, this.y + Math.sin(st.angle) * this.r, '#c9b79c', 10, 20);
          this.vx = this.vy = 0;
          if (st.chain > 0) this.setState('chargeWarn', { warn: 0.5, chain: st.chain - 1, angle: st.angle + Math.PI });
          else {
            this.setState('stunned', { dur: VECINO.stun });
            game.floatText(this.x, this.y - 80 * this.s, '¡Mareado!', '#ffd23f', 22);
          }
          return;
        }
        if (st.t >= VECINO.chargeMax) {
          if (st.chain > 0) this.setState('chargeWarn', { warn: 0.5, chain: st.chain - 1, angle: st.angle });
          else this.setState('walk', { dur: 0.8 });
        }
        return;
      }
      case 'stunned': {
        this.brake(dt, 6);
        this.dmg = 0; // mareado no hace daño al tocarlo: ¡es tu momento!
        if (st.t >= st.dur) this.setState('walk', { dur: 0.6 });
        break;
      }
      case 'stompWarn': {
        // salta y cae sobre ti
        this.brake(dt);
        this.look(dt, p.x, p.y);
        const k = st.t / VECINO.stompWarn;
        this.hop = Math.sin(Math.min(1, k) * Math.PI * 0.5) * 70;
        if (st.t >= VECINO.stompWarn) {
          this.hop = 0;
          game.shockwave(this.x, this.y + 10, VECINO.stompRadius, VECINO.stompDmg, 700);
          sfx.stomp();
          if (angry) {
            // en fase 2 salen cascotes en todas direcciones
            const off = rand(0, TAU);
            for (let i = 0; i < 10; i++) game.enemyShoot(this.x, this.y, off + (i / 10) * TAU, 200, 12, { color: '#c9b79c', r: 9 });
          }
          this.setState('recover', { dur: 0.6 });
        }
        break;
      }
      case 'summon': {
        this.brake(dt);
        if (st.t >= 0.9 && !st.done) {
          st.done = true;
          const pool = angry ? ['normal', 'rapido', 'lento'] : ['normal', 'lento'];
          const n = angry ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + rand(-0.4, 0.4);
            game.spawnEnemy(pool[i % pool.length], this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 90);
          }
        }
        if (st.t >= 1.2) this.setState('walk', { dur: 1 });
        break;
      }
      case 'recover': {
        this.brake(dt);
        if (st.t >= st.dur) this.setState('walk', { dur: rand(0.6, 1.2) });
        break;
      }
    }
    this.move(dt, game);
  }

  choose(game, d) {
    const angry = this.phase === 2;
    if (d < VECINO.stompRange && this.stompCd <= 0) {
      this.stompCd = angry ? 3 : 4.5;
      this.setState('stompWarn');
      sfx.whip();
    } else if (this.summonCd <= 0 && this.minions(game) < VECINO.maxMinions) {
      this.summonCd = VECINO.summonCd;
      this.setState('summon');
      game.floatText(this.x, this.y - 80 * this.s, '¡VECINOS!', '#ffd23f', 26);
      sfx.roar();
    } else if (this.chargeCd <= 0) {
      this.chargeCd = angry ? 3 : 4;
      this.setState('chargeWarn', { warn: VECINO.chargeWarn, chain: angry ? 1 : 0, angle: 0 });
    } else {
      this.setState('walk', { dur: 0.6 });
    }
  }

  draw(ctx, game) {
    const { x, y, s } = this;
    if (this.spawnT > 0) { drawSpawnWarning(ctx, x, y, this.r * 1.4, 1 - this.spawnT / SPAWN, game.time); return; }
    const st = this.state;

    // ── avisos en el suelo ──
    if (st.name === 'chargeWarn') {
      const k = Math.min(1, st.t / st.warn);
      drawLane(ctx, x, y + 10, st.angle, distToWall(x, y, st.angle, this.r) + this.r, this.r + 6, k);
    }
    if (st.name === 'stompWarn') drawCircleWarn(ctx, x, y + 10, VECINO.stompRadius, Math.min(1, st.t / VECINO.stompWarn));

    this.drawShadow(ctx, 1 - this.hop / 200);
    let shake = 0;
    if (st.name === 'chargeWarn') shake = rand(-1.5, 1.5);
    const sp = Math.hypot(this.vx, this.vy);
    const by = y - this.hop;
    const flash = this.hitFlash > 0;
    drawHuman(ctx, x + shake, by, {
      ...this.def.look,
      s,
      zombie: true,
      angry: true,
      noShadow: true,
      lookX: this.lookX,
      lookY: this.lookY,
      moveX: sp > 1 ? this.vx / sp : 0,
      moveY: sp > 1 ? this.vy / sp : 0,
      moving: Math.min(1, sp / 90),
      walk: this.walkT,
      flash,
      armsUp: st.name === 'summon' || st.name === 'stompWarn',
    });
    if (!flash) this.drawDetails(ctx, x + shake, by, s);
    if (st.name === 'stunned') this.drawStars(ctx, x, by - 34 * s, game.time);
    if (st.name === 'charge') {
      // líneas de velocidad
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const ox = -Math.sin(st.angle) * i * 18, oy = Math.cos(st.angle) * i * 18;
        const bx = x - Math.cos(st.angle) * (40 + Math.abs(i) * 10) + ox, byy = y - Math.sin(st.angle) * (40 + Math.abs(i) * 10) + oy;
        ctx.beginPath();
        ctx.moveTo(bx, byy);
        ctx.lineTo(bx - Math.cos(st.angle) * 30, byy - Math.sin(st.angle) * 30);
        ctx.stroke();
      }
    }
  }

  // Camiseta de tirantes, barriga y una mancha de tomate
  drawDetails(ctx, x, y, s) {
    if (this.lookY < -0.45) return; // de espaldas no se ve
    const by = y + 2 * s;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    // barriga
    ctx.beginPath();
    ctx.ellipse(x + this.lookX * 3 * s, by + 3 * s, 9 * s, 7 * s, 0, 0, TAU);
    ctx.fillStyle = '#e4e0d2';
    ctx.fill();
    ctx.stroke();
    // ombligo y mancha
    ctx.fillStyle = '#d1495b';
    ctx.beginPath();
    ctx.ellipse(x + this.lookX * 3 * s - 4 * s, by + 1 * s, 2.6 * s, 2 * s, 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + this.lookX * 3 * s - 1 * s, by + 3.5 * s, 1.2 * s, 0, TAU);
    ctx.fill();
    // tirantes de la camiseta (dejan ver los hombros)
    ctx.fillStyle = this.def.look.skin;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + k * 8.5 * s, by - 7 * s, 3 * s, 2.6 * s, 0, 0, TAU);
      ctx.fill();
    }
    // barba de tres días
    const hy = by - 15 * s;
    ctx.fillStyle = 'rgba(60, 70, 50, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + this.lookX * 4 * s, hy + 11 * s, 9 * s, 4 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ═════════════ LA PORTERA ═════════════
export class Portera extends BossBase {
  constructor(x, y, hpMul = 1) {
    super('boss', x, y, hpMul);
    this.last = '';
    this.sweepCd = 1.5;
    this.summonCd = 8;
    this.broom = Math.PI / 2;   // ángulo de la escoba
    this.broomTarget = Math.PI / 2;
    this.spin = 0;
  }

  think(dt, game) {
    const p = game.player;
    const st = this.state;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    const aim = Math.atan2(p.y - this.y, p.x - this.x);
    const angry = this.phase === 2;
    this.sweepCd -= dt; this.summonCd -= dt;
    this.invulnerable = false;
    this.heavy = false;
    this.dmg = this.def.dmg;
    // escoba en reposo: apuntando al suelo, delante de ella
    this.broomTarget = aim + 0.9;

    // ¡A mitad de vida se enfada de verdad!
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.setState('rage');
      game.bossRage(this);
      return;
    }

    switch (st.name) {
      case 'walk': {
        this.steer(dt, p.x, p.y, angry ? 105 : 75);
        this.look(dt, p.x, p.y);
        if (st.t >= st.dur) this.choose(game, d);
        break;
      }
      case 'fanWarn': {
        // levanta la escoba hacia atrás
        this.brake(dt);
        this.look(dt, p.x, p.y);
        this.broomTarget = aim - 2.2;
        if (st.t >= PORTERA.fanWarn) this.setState('fan', { shots: angry ? 3 : 2, next: 0, i: 0 });
        break;
      }
      case 'fan': {
        this.brake(dt);
        this.look(dt, p.x, p.y);
        this.broomTarget = st.i % 2 ? aim - 1.4 : aim + 1.4;
        st.next -= dt;
        if (st.next <= 0 && st.i < st.shots) {
          const n = angry ? PORTERA.fanCount + 3 : PORTERA.fanCount;
          const spread = PORTERA.fanSpread * (angry ? 1.3 : 1);
          const off = st.i % 2 ? spread / (n - 1) / 2 : 0; // un abanico sí y otro no, desplazado medio hueco
          for (let i = 0; i < n; i++) {
            const a = aim - spread / 2 + (i / (n - 1)) * spread + off;
            game.enemyShoot(this.x + Math.cos(aim) * 30, this.y + Math.sin(aim) * 30, a, PORTERA.fanSpeed, PORTERA.fanDmg, { color: '#cbb994', r: 9, sound: false });
          }
          sfx.broom();
          game.burst(this.x + Math.cos(aim) * 50, this.y + Math.sin(aim) * 50, '#cbb994', 6, 10);
          st.i++;
          st.next = 0.4;
        }
        if (st.i >= st.shots && st.next <= 0) this.setState('walk', { dur: angry ? 0.5 : 0.9 });
        break;
      }
      case 'sweepWarn': {
        // escobazo: fija la dirección al empezar el aviso
        this.brake(dt);
        if (st.angle === undefined) st.angle = aim;
        this.lookX = Math.cos(st.angle); this.lookY = Math.sin(st.angle);
        this.broomTarget = st.angle - 2.0;
        if (st.t >= PORTERA.sweepWarn) {
          this.setState('sweep', { angle: st.angle });
          this.broom = st.angle - 1.6;
          sfx.broom();
          this.sweepHit(game, st.angle);
        }
        break;
      }
      case 'sweep': {
        this.brake(dt);
        this.broomTarget = st.angle + 1.6;
        if (st.t >= 0.35) this.setState('walk', { dur: angry ? 0.4 : 0.8 });
        break;
      }
      case 'bleach': {
        // lanza botellas de lejía alrededor de donde estás
        this.brake(dt);
        this.look(dt, p.x, p.y);
        this.broomTarget = aim + 1.6;
        const n = angry ? PORTERA.bottles + 2 : PORTERA.bottles;
        while (st.thrown < n && st.t >= 0.3 + st.thrown * 0.18) {
          const spreadR = st.thrown === 0 ? 0 : rand(60, 130);
          const a = rand(0, TAU);
          game.lob(this.x, this.y - 40 * this.s, p.x + p.vx * 0.3 + Math.cos(a) * spreadR, p.y + p.vy * 0.3 + Math.sin(a) * spreadR, 'bleach');
          sfx.spit();
          st.thrown++;
        }
        if (st.t >= 0.3 + n * 0.18 + 0.4) this.setState('walk', { dur: angry ? 0.5 : 1 });
        break;
      }
      case 'spinWarn': {
        this.brake(dt);
        this.spin += dt * 6 * (st.t / 0.6);
        if (st.t >= 0.6) this.setState('spin', { next: 0 });
        break;
      }
      case 'spin': {
        // torbellino: gira con la escoba y escupe polvo en espiral
        this.steer(dt, p.x, p.y, 120);
        this.spin += dt * 16;
        this.dmg = PORTERA.spinDmg;
        st.next -= dt;
        if (st.next <= 0) {
          st.next = 0.11;
          for (const k of [0, Math.PI]) game.enemyShoot(this.x, this.y, this.spin * 0.45 + k, 170, 10, { color: '#cbb994', r: 8, sound: false });
          sfx.broom();
        }
        if (st.t >= PORTERA.spinTime) this.setState('recover', { dur: 0.9 });
        break;
      }
      case 'summon': {
        this.brake(dt);
        if (st.t >= 0.8 && !st.done) {
          st.done = true;
          for (const [i, type] of ['normal', 'rapido'].entries()) {
            const a = (i / 2) * TAU + rand(-0.5, 0.5);
            game.spawnEnemy(type, this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 90);
          }
        }
        if (st.t >= 1.1) this.setState('walk', { dur: 0.6 });
        break;
      }
      case 'rage': {
        // transición a la fase 2: invulnerable un momento y echa al jugador hacia atrás
        this.invulnerable = true;
        this.brake(dt);
        this.dmg = 0;
        this.broomTarget = -Math.PI / 2;
        if (Math.random() < dt * 20) game.puff(this.x + rand(-20, 20), this.y - 70 * this.s, '#ffffff');
        if (st.t >= 1.6) this.setState('walk', { dur: 0.3 });
        break;
      }
      case 'recover': {
        this.brake(dt, 4);
        if (st.t >= st.dur) this.setState('walk', { dur: 0.4 });
        break;
      }
    }
    this.move(dt, game);
    // la escoba gira con suavidad hacia su posición
    if (st.name === 'spin' || st.name === 'spinWarn') this.broom = this.spin;
    else this.broom += wrap(this.broomTarget - this.broom) * (1 - Math.exp(-dt * (st.name === 'sweep' ? 30 : 12)));
  }

  choose(game, d) {
    const angry = this.phase === 2;
    if (d < PORTERA.sweepRange && this.sweepCd <= 0) {
      this.sweepCd = angry ? 2 : 3;
      this.setState('sweepWarn');
      return;
    }
    if (angry && this.summonCd <= 0 && this.minions(game) < 3) {
      this.summonCd = 12;
      this.setState('summon');
      game.floatText(this.x, this.y - 80 * this.s, '¡LOS DEL 3º!', '#ffd23f', 26);
      sfx.roar();
      return;
    }
    const opts = angry ? ['fan', 'bleach', 'spin'] : ['fan', 'bleach'];
    const pick = opts.filter((o) => o !== this.last);
    const choice = pick[Math.floor(Math.random() * pick.length)];
    this.last = choice;
    if (choice === 'fan') this.setState('fanWarn');
    else if (choice === 'bleach') {
      this.setState('bleach', { thrown: 0 });
      game.floatText(this.x, this.y - 80 * this.s, '¡LEJÍA!', '#bfe9ff', 24);
    } else {
      this.setState('spinWarn');
      game.floatText(this.x, this.y - 80 * this.s, '¡A BARRER!', '#ffd23f', 26);
    }
  }

  // Golpe de escoba en abanico delante de ella
  sweepHit(game, angle) {
    const p = game.player;
    game.shake(8);
    for (let i = 0; i < 10; i++) {
      const a = angle + rand(-PORTERA.sweepHalf, PORTERA.sweepHalf), r = rand(40, PORTERA.sweepReach);
      game.puff(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, '#cbb994');
    }
    if (p.dead) return;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const diff = Math.abs(wrap(Math.atan2(dy, dx) - angle));
    if (d - p.r <= PORTERA.sweepReach && diff <= PORTERA.sweepHalf + 0.15) {
      p.hurt(PORTERA.sweepDmg, game);
      p.vx += (dx / (d || 1)) * 650; p.vy += (dy / (d || 1)) * 650;
    }
  }

  draw(ctx, game) {
    const { x, y, s } = this;
    if (this.spawnT > 0) { drawSpawnWarning(ctx, x, y, this.r * 1.5, 1 - this.spawnT / SPAWN, game.time); return; }
    const st = this.state;
    const angry = this.phase === 2;

    // ── avisos ──
    if (st.name === 'sweepWarn' && st.angle !== undefined) {
      const k = Math.min(1, st.t / PORTERA.sweepWarn);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.arc(x, y + 6, PORTERA.sweepReach, st.angle - PORTERA.sweepHalf, st.angle + PORTERA.sweepHalf);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 60, 90, ${0.1 + k * 0.25})`;
      ctx.fill();
      ctx.setLineDash([9, 7]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
      ctx.stroke();
      ctx.restore();
    }
    if (st.name === 'fanWarn') {
      // líneas finas por donde saldrá el polvo
      const p = game.player;
      const aim = Math.atan2(p.y - y, p.x - x);
      const n = angry ? PORTERA.fanCount + 3 : PORTERA.fanCount;
      const spread = PORTERA.fanSpread * (angry ? 1.3 : 1);
      ctx.save();
      ctx.globalAlpha = Math.min(1, st.t / PORTERA.fanWarn) * 0.7;
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ff5d73';
      for (let i = 0; i < n; i++) {
        const a = aim - spread / 2 + (i / (n - 1)) * spread;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
        ctx.lineTo(x + Math.cos(a) * 170, y + Math.sin(a) * 170);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (st.name === 'spinWarn') drawCircleWarn(ctx, x, y + 10, 70, Math.min(1, st.t / 0.6));

    this.drawShadow(ctx);
    const sp = Math.hypot(this.vx, this.vy);
    const flash = this.hitFlash > 0 || (this.invulnerable && Math.floor(game.time * 16) % 2 === 0);
    const shake = st.name === 'rage' ? rand(-2, 2) : 0;
    const look = { ...this.def.look };
    if (angry) look.skin = '#d3a07c'; // roja de rabia

    // la escoba va detrás si mira hacia arriba
    const behind = this.lookY < -0.2 && st.name !== 'spin';
    if (behind) this.drawBroom(ctx, x + shake, y, s);
    this.drawBun(ctx, x + shake, y, s, flash, true);
    drawHuman(ctx, x + shake, y, {
      ...look,
      s,
      angry: true,
      noShadow: true,
      lookX: this.lookX,
      lookY: this.lookY,
      moveX: sp > 1 ? this.vx / sp : 0,
      moveY: sp > 1 ? this.vy / sp : 0,
      moving: Math.min(1, sp / 90),
      walk: this.walkT,
      flash,
      hideHand: 1,
    });
    if (!flash) this.drawDetails(ctx, x + shake, y, s, angry, game.time);
    this.drawBun(ctx, x + shake, y, s, flash, false);
    if (!behind) this.drawBroom(ctx, x + shake, y, s);
  }

  // Moño (detrás o delante de la cabeza según hacia dónde mire)
  drawBun(ctx, x, y, s, flash, back) {
    const facingBack = this.lookY < -0.45;
    if (back === facingBack) return;
    const hy = y + 2 * s - 15 * s;
    ctx.beginPath();
    ctx.arc(x - this.lookX * 4 * s, hy - 15 * s, 7 * s, 0, TAU);
    ctx.fillStyle = flash ? '#ffffff' : this.def.look.hair;
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  // Delantal, gafas y vapor de enfado
  drawDetails(ctx, x, y, s, angry, time) {
    const by = y + 2 * s;
    const hy = by - 15 * s;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    if (this.lookY > -0.45) {
      // delantal de cuadros
      ctx.beginPath();
      ctx.roundRect(x - 7 * s + this.lookX * 2 * s, by - 3 * s, 14 * s, 13 * s, 3 * s);
      ctx.fillStyle = '#e8f1ff';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(90, 169, 214, 0.45)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 7 * s + this.lookX * 2 * s, by - 1 * s + i * 4 * s, 14 * s, 1.6 * s);
      // gafas (justo sobre los ojos que dibuja drawHuman)
      const ecx = x + this.lookX * 4 * s + this.lookX * 15 * s * 0.16;
      const ecy = hy + 8 * s - 15 * s * 0.15 + this.lookY * 1.5 * s;
      ctx.lineWidth = 2;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ecx + k * 5.1 * s, ecy, 5 * s, 0, TAU);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(ecx - 0.6 * s, ecy);
      ctx.lineTo(ecx + 0.6 * s, ecy);
      ctx.stroke();
    }
    if (angry) {
      // vapor saliendo de la cabeza
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 3; i++) {
        const k = (time * 1.2 + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(x + (i - 1) * 14 * s, hy - 16 * s - k * 30, 3 + k * 7, 0, TAU);
        ctx.globalAlpha = 1 - k;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawBroom(ctx, x, y, s) {
    const spinning = this.state.name === 'spin' || this.state.name === 'spinWarn';
    const a = this.broom;
    // en el giro la sujeta desde el centro; si no, desde la mano derecha
    const hx = spinning ? x : x + 13 * s, hy = spinning ? y + 2 * s : y + 5 * s;
    const len = 46 * s;
    const ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len;
    const sx = spinning ? hx - Math.cos(a) * 10 * s : hx - Math.cos(a) * 14 * s;
    const sy = spinning ? hy - Math.sin(a) * 10 * s : hy - Math.sin(a) * 14 * s;
    ctx.save();
    ctx.lineCap = 'round';
    // palo
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineWidth = 8;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#d08c4a';
    ctx.stroke();
    // cepillo
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-2, -7 * s);
    ctx.lineTo(16 * s, -11 * s);
    ctx.quadraticCurveTo(20 * s, 0, 16 * s, 11 * s);
    ctx.lineTo(-2, 7 * s);
    ctx.closePath();
    ctx.fillStyle = '#f2c14e';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(29,27,44,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(3 * s, i * 2.5 * s);
      ctx.lineTo(15 * s, i * 4 * s);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(-4, -8 * s, 6, 16 * s, 2);
    ctx.fillStyle = '#e63946';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
    // mano sobre el palo
    if (!spinning) {
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5 * s, 0, TAU);
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (this.phase === 2 ? '#d3a07c' : this.def.look.skin);
      ctx.fill();
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }
}

export function makeBoss(type, x, y, hpMul = 1) {
  return type === 'boss' ? new Portera(x, y, hpMul) : new Vecino(x, y, hpMul);
}

// Dibujo de la botella de lejía en el aire
export function drawBottle(ctx, x, y, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.roundRect(-7, -9, 14, 18, 4);
  ctx.fillStyle = '#f4f8ff';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-3.5, -15, 7, 7, 2);
  ctx.fillStyle = '#4c9fd6';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4c9fd6';
  ctx.fillRect(-7, -2, 14, 4);
  ctx.restore();
}

