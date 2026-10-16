// ─────────────────────────────────────────────
//  "El vecino del 4ºB": el mini jefe de antes. Embiste, pega pisotones y
//  llama a los vecinos. Ahora no sale, pero se queda por si vuelve.
// ─────────────────────────────────────────────
import { OUTLINE } from './config.js';
import { rand } from './utils.js';
import { drawHuman } from './draw.js';
import { drawSpawnWarning } from './entities.js';
import { sfx } from './sfx.js';
import { TAU, SPAWN, BossBase, drawLane, drawCircleWarn, distToWall } from './jefe-base.js';

// Valores ajustables de cada ataque
export const VECINO = {
  chargeWarn: 0.85, chargeSpeed: 560, chargeMax: 1.1, chargeDmg: 24, stun: 1.4,
  stompWarn: 0.75, stompRadius: 150, stompDmg: 20, stompRange: 200,
  summonCd: 9, maxMinions: 4,
};

// ═════════════ EL VECINO DEL 4ºB ═════════════
export class Vecino extends BossBase {
  constructor(x, y, hpMul = 1) {
    super('vecino', x, y, hpMul);
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
      game.floatText(this.x, this.y - this.top - 20 * this.s, '¡SE ACABÓ!', '#ffd23f', 30);
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
            game.floatText(this.x, this.y - this.top - 20 * this.s, '¡Mareado!', '#ffd23f', 22);
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
      game.floatText(this.x, this.y - this.top - 20 * this.s, '¡VECINOS!', '#ffd23f', 26);
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
      drawLane(ctx, x, y + 10, st.angle, distToWall(x, y, st.angle, this.r, game.rw, game.rh) + this.r, this.r + 6, k);
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
