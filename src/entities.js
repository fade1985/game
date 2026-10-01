// ─────────────────────────────────────────────
//  Personajes: jugador, compañeros y enemigos
// ─────────────────────────────────────────────
import { W, H, WALL, OUTLINE, PLAYER_COLOR } from './config.js';
import { rand } from './utils.js';
import { blob, eyes, shadow, outlinedText } from './draw.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;

// ═════════════ JUGADOR ═════════════
export class Player {
  constructor(stats) {
    this.stats = stats;
    this.x = W / 2;
    this.y = H - WALL - 60;
    this.r = 20;
    this.vx = 0; this.vy = 0;
    this.hp = stats.maxHp;
    this.invuln = 0;      // tiempo de invulnerabilidad tras recibir daño
    this.hurtT = 0;       // destello blanco al recibir daño
    this.fireT = 0;
    this.dashT = 0;       // duración restante de la esquiva
    this.dashCd = 0;      // enfriamiento de la esquiva
    this.lookX = 0; this.lookY = -1;
    this.walkT = 0;
    this.kick = 0;        // retroceso visual al disparar
    this.blinkT = rand(2, 4);
    this.dead = false;
  }

  update(dt, game, move, dash) {
    const s = this.stats;
    this.dashCd -= dt;
    this.invuln -= dt;
    this.hurtT -= dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = rand(2, 4.5);

    // Esquiva (dash): impulso rápido con invulnerabilidad
    if (dash && this.dashCd <= 0) {
      let dx = move.x, dy = move.y;
      if (!dx && !dy) { dx = this.lookX; dy = this.lookY; }
      const l = Math.hypot(dx, dy) || 1;
      this.vx = (dx / l) * s.speed * 3.3;
      this.vy = (dy / l) * s.speed * 3.3;
      this.dashT = 0.16;
      this.dashCd = 0.9;
      this.invuln = Math.max(this.invuln, 0.3);
      sfx.dash();
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      game.puff(this.x, this.y + this.r * 0.5, 'rgba(255,255,255,0.8)');
    } else {
      // Aceleración suave hacia la velocidad deseada
      const k = 1 - Math.exp(-dt * 14);
      this.vx += (move.x * s.speed - this.vx) * k;
      this.vy += (move.y * s.speed - this.vy) * k;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    game.collideWorld(this, true);

    const sp = Math.hypot(this.vx, this.vy);
    this.walkT += dt * (6 + sp / 25);
    if (move.x || move.y) { this.lookX = move.x; this.lookY = move.y; }

    // Disparo automático al enemigo más cercano
    this.fireT -= dt;
    this.kick = Math.max(0, this.kick - dt * 8);
    if (game.state !== 'playing') return;
    const target = game.nearestEnemy(this.x, this.y, s.range);
    if (target) {
      const a = Math.atan2(target.y - this.y, target.x - this.x);
      this.lookX = Math.cos(a); this.lookY = Math.sin(a);
      if (this.fireT <= 0) {
        this.fireT = 1 / s.fireRate;
        game.fireVolley(this, a, s.damage, s.shots, s.pierce, '#fff6d5');
        this.kick = 1;
        sfx.shoot();
      }
    }
  }

  hurt(dmg, game) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= dmg;
    this.invuln = 0.9;
    this.hurtT = 0.12;
    game.shake(9);
    game.floatText(this.x, this.y - this.r - 10, `-${dmg}`, '#ff5d73', 22);
    sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      game.onPlayerDeath();
    }
  }

  draw(ctx, game) {
    const { x, y, r } = this;
    shadow(ctx, x, y, r);

    // Indicador de recarga de la esquiva
    if (this.dashCd > 0) {
      ctx.beginPath();
      ctx.arc(x, y + r * 0.85, r * 1.15, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - this.dashCd / 0.9));
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.save();
    if (this.invuln > 0 && this.dashT <= 0 && Math.floor(this.invuln * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    const sp = Math.min(1, Math.hypot(this.vx, this.vy) / 150);
    const bob = Math.sin(this.walkT) * sp * 0.07;
    const hop = Math.abs(Math.sin(this.walkT)) * sp * 4;
    const by = y - hop;
    blob(ctx, x, by, r, PLAYER_COLOR, {
      sx: 1 + bob - this.kick * 0.05,
      sy: 1 - bob + this.kick * 0.05,
      flash: this.hurtT > 0,
    });

    // Cinta en la cabeza (para distinguir al héroe)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, by, r - 2, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(x - r, by - r * 0.72, r * 2, r * 0.26);
    ctx.restore();
    const tx = x - this.lookX * r * 0.9;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(tx, by - r * 0.6 + s * 4, 7, 3.5, s * 0.5 - this.lookX * 0.4, 0, TAU);
      ctx.fillStyle = '#ff5d73';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }

    eyes(ctx, x, by, r, this.lookX, this.lookY, { blink: this.blinkT < 0 });
    ctx.restore();
  }
}

// ═════════════ COMPAÑEROS (el "equipo") ═════════════
export class Ally {
  constructor(color, x, y) {
    this.color = color;
    this.x = x; this.y = y;
    this.r = 14;
    this.vx = 0; this.vy = 0;
    this.idx = 0;
    this.fireT = rand(0, 0.6);
    this.lookX = 0; this.lookY = -1;
    this.walkT = rand(0, 6);
    this.kick = 0;
  }

  update(dt, game) {
    const p = game.player;
    const n = game.allies.length;
    // Los compañeros orbitan alrededor del jugador
    const ang = (this.idx / n) * TAU + game.time * 0.8;
    const tx = p.x + Math.cos(ang) * 50;
    const ty = p.y + Math.sin(ang) * 40;
    const k = 1 - Math.exp(-dt * 7);
    const nx = this.x + (tx - this.x) * k;
    const ny = this.y + (ty - this.y) * k;
    this.vx = (nx - this.x) / dt; this.vy = (ny - this.y) / dt;
    this.x = nx; this.y = ny;
    game.collideWorld(this, false);
    this.walkT += dt * 10;
    this.kick = Math.max(0, this.kick - dt * 8);

    if (game.state !== 'playing') return;
    this.fireT -= dt;
    const s = game.stats;
    const target = game.nearestEnemy(this.x, this.y, s.range * 0.9);
    if (target) {
      const a = Math.atan2(target.y - this.y, target.x - this.x);
      this.lookX = Math.cos(a); this.lookY = Math.sin(a);
      if (this.fireT <= 0) {
        this.fireT = 1 / (s.fireRate * 0.55);
        game.fireVolley(this, a, s.damage * 0.45 * s.teamDamage, 1, 0, this.color, 6);
        this.kick = 1;
      }
    }
  }

  draw(ctx) {
    const { x, y, r } = this;
    shadow(ctx, x, y, r);
    const hop = Math.abs(Math.sin(this.walkT)) * 3;
    blob(ctx, x, y - hop, r, this.color, { sx: 1 - this.kick * 0.06, sy: 1 + this.kick * 0.06, lw: 3.5 });
    // antenita
    ctx.beginPath();
    ctx.moveTo(x, y - hop - r);
    ctx.quadraticCurveTo(x + 6, y - hop - r - 8, x + 3, y - hop - r - 12);
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 3, y - hop - r - 13, 4, 0, TAU);
    ctx.fillStyle = this.color; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    eyes(ctx, x, y - hop, r, this.lookX, this.lookY);
  }
}

// ═════════════ ENEMIGOS ═════════════
export const ENEMY_TYPES = {
  slime:   { name: 'Gelatina',  r: 20, hp: 24,  speed: 80,  dmg: 12, color: '#ff5d73', coins: [1, 2] },
  bat:     { name: 'Murci',     r: 15, hp: 14,  speed: 135, dmg: 10, color: '#7b61ff', coins: [1, 2] },
  shooter: { name: 'Escupidor', r: 21, hp: 30,  speed: 70,  dmg: 12, color: '#2ec4b6', coins: [2, 3] },
  charger: { name: 'Toro',      r: 25, hp: 50,  speed: 55,  dmg: 18, color: '#c97b4a', coins: [3, 4] },
  boss:    { name: 'Rey Gelatina', r: 62, hp: 900, speed: 55, dmg: 20, color: '#ff5d73', coins: [25, 30] },
};

const SPAWN_TIME = 0.8;

export class Enemy {
  constructor(type, x, y, hpMul = 1, elite = false) {
    const d = ENEMY_TYPES[type];
    this.type = type;
    this.name = d.name;
    this.x = x; this.y = y;
    this.r = elite ? d.r * 1.15 : d.r;
    this.maxHp = Math.round(d.hp * hpMul);
    this.hp = this.maxHp;
    this.speed = d.speed;
    this.dmg = d.dmg;
    this.color = d.color;
    this.coins = d.coins;
    this.elite = elite;
    this.vx = 0; this.vy = 0;
    this.kx = 0; this.ky = 0; // empuje al recibir disparos
    this.spawnT = type === 'boss' ? 1.4 : SPAWN_TIME;
    this.t = rand(0, 10);
    this.hitFlash = 0;
    this.dead = false;
    // estado específico de algunos enemigos
    this.cd = rand(1.2, 2.2);
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.st = 'walk';
    this.stT = rand(1.2, 2.2);
    this.ax = 0; this.ay = 0;
    this.ringT = 2.5;
    this.sumT = 6;
    this.enraged = false;
  }

  get active() { return this.spawnT <= 0 && !this.dead; }

  update(dt, game) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.t += dt;
    this.hitFlash -= dt;

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    let mx = 0, my = 0, spd = this.speed, direct = false;

    switch (this.type) {
      case 'slime':
        // avanza a saltitos
        mx = ux; my = uy;
        spd *= 0.4 + 0.9 * Math.max(0, Math.sin(this.t * 5));
        break;

      case 'bat': {
        // vuela en zigzag
        const w = Math.sin(this.t * 6) * 0.9;
        mx = ux - uy * w; my = uy + ux * w;
        break;
      }

      case 'shooter':
        // mantiene la distancia y escupe proyectiles
        if (d < 230) { mx = -ux; my = -uy; }
        else if (d > 340) { mx = ux; my = uy; }
        else { mx = -uy * this.strafe; my = ux * this.strafe; }
        this.cd -= dt;
        if (this.cd <= 0) {
          this.cd = rand(1.6, 2.4);
          game.enemyShoot(this.x, this.y, Math.atan2(dy, dx), 240, this.dmg);
          if (this.elite) {
            game.enemyShoot(this.x, this.y, Math.atan2(dy, dx) - 0.3, 240, this.dmg);
            game.enemyShoot(this.x, this.y, Math.atan2(dy, dx) + 0.3, 240, this.dmg);
          }
        }
        break;

      case 'charger':
        // camina, apunta... ¡y embiste!
        this.stT -= dt;
        if (this.st === 'walk') {
          mx = ux; my = uy;
          if (this.stT <= 0) { this.st = 'aim'; this.stT = 0.65; }
        } else if (this.st === 'aim') {
          spd = 0;
          this.ax = ux; this.ay = uy;
          if (this.stT <= 0) { this.st = 'dash'; this.stT = 0.55; }
        } else if (this.st === 'dash') {
          direct = true;
          this.vx = this.ax * 440; this.vy = this.ay * 440;
          if (Math.random() < 0.5) game.puff(this.x, this.y + this.r * 0.6, 'rgba(255,255,255,0.7)');
          if (this.stT <= 0) { this.st = 'rest'; this.stT = 0.7; }
        } else {
          spd = 0;
          if (this.stT <= 0) { this.st = 'walk'; this.stT = rand(1.4, 2.4); }
        }
        break;

      case 'boss': {
        const phase2 = this.hp < this.maxHp * 0.5;
        if (phase2 && !this.enraged) {
          this.enraged = true;
          this.color = '#ff3355';
          game.floatText(this.x, this.y - this.r - 20, '¡FURIOSO!', '#ffd23f', 30);
          game.shake(14);
        }
        mx = ux; my = uy;
        spd = (phase2 ? 85 : 55) * (0.4 + 0.9 * Math.max(0, Math.sin(this.t * 3)));
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = phase2 ? 1.9 : 2.7;
          const n = phase2 ? 16 : 12;
          const off = rand(0, TAU);
          for (let i = 0; i < n; i++) game.enemyShoot(this.x, this.y, off + (i / n) * TAU, 190, 14);
          game.shake(6);
        }
        this.sumT -= dt;
        if (this.sumT <= 0) {
          this.sumT = phase2 ? 5.5 : 7;
          game.spawnEnemy('slime', this.x - 80, this.y + 30);
          game.spawnEnemy('slime', this.x + 80, this.y + 30);
        }
        break;
      }
    }

    if (!direct) {
      const l = Math.hypot(mx, my) || 1;
      const k = 1 - Math.exp(-dt * 8);
      this.vx += ((mx / l) * spd - this.vx) * k;
      this.vy += ((my / l) * spd - this.vy) * k;
    }
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
    const kd = Math.exp(-dt * 10);
    this.kx *= kd; this.ky *= kd;
    game.collideWorld(this, false);
  }

  hurt(dmg, crit, dirX, dirY, game) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    const push = this.type === 'boss' ? 20 : this.type === 'charger' ? 90 : 180;
    this.kx += dirX * push; this.ky += dirY * push;
    game.floatText(this.x + rand(-8, 8), this.y - this.r - 6, Math.round(dmg).toString(), crit ? '#ffd23f' : '#ffffff', crit ? 26 : 18);
    sfx.hit();
    if (this.hp <= 0) game.killEnemy(this);
  }

  draw(ctx, game) {
    const { x, y, r } = this;

    // Aviso en el suelo antes de aparecer
    if (this.spawnT > 0) {
      const total = this.type === 'boss' ? 1.4 : SPAWN_TIME;
      const k = 1 - this.spawnT / total;
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -game.time * 30;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.5, r * 1.1, r * 0.5, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.5, r * 1.1 * k, r * 0.5 * k, 0, 0, TAU);
      ctx.fillStyle = 'rgba(255, 60, 90, 0.3)';
      ctx.fill();
      ctx.restore();
      return;
    }

    const p = game.player;
    let lx = p.x - x, ly = p.y - y;
    const l = Math.hypot(lx, ly) || 1;
    lx /= l; ly /= l;
    const flash = this.hitFlash > 0;

    if (this.elite) {
      // aura dorada para los enemigos de élite
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.85, r * 1.25, r * 0.5, 0, 0, TAU);
      ctx.fillStyle = `rgba(255, 210, 63, ${0.35 + Math.sin(game.time * 6) * 0.15})`;
      ctx.fill();
    }

    switch (this.type) {
      case 'slime':
      case 'boss': {
        shadow(ctx, x, y, r);
        const j = Math.max(0, Math.sin(this.t * (this.type === 'boss' ? 3 : 5)));
        const hop = j * (this.type === 'boss' ? 14 : 8);
        const sq = (1 - j) * 0.12;
        blob(ctx, x, y - hop, r, this.color, { sx: 1 + sq, sy: 1 - sq + j * 0.05, flash, lw: this.type === 'boss' ? 6 : 4 });
        eyes(ctx, x, y - hop, r, lx, ly, { angry: true });
        if (this.type === 'boss') drawCrown(ctx, x, y - hop - r * 0.85, r * 0.55);
        break;
      }

      case 'bat': {
        const hover = 12 + Math.sin(this.t * 4) * 4;
        shadow(ctx, x, y, r * 0.8, 0.15);
        const by = y - hover;
        const f = Math.sin(this.t * 22);
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.translate(x + s * r * 0.8, by - 2);
          ctx.rotate(s * (0.2 + f * 0.45));
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(s * r * 0.9, -r * 0.9, s * r * 1.3, -r * 0.1);
          ctx.quadraticCurveTo(s * r * 0.8, -r * 0.05, s * r * 0.7, r * 0.35);
          ctx.quadraticCurveTo(s * r * 0.4, r * 0.1, 0, r * 0.3);
          ctx.closePath();
          ctx.fillStyle = flash ? '#fff' : '#4b3bb8';
          ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
          ctx.restore();
        }
        blob(ctx, x, by, r, this.color, { flash, lw: 3.5 });
        eyes(ctx, x, by, r, lx, ly, { angry: true });
        // colmillos
        ctx.fillStyle = '#fff';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + s * 5 - 2.5, by + r * 0.35);
          ctx.lineTo(x + s * 5 + 2.5, by + r * 0.35);
          ctx.lineTo(x + s * 5, by + r * 0.62);
          ctx.closePath();
          ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
        }
        break;
      }

      case 'shooter': {
        shadow(ctx, x, y, r);
        const swell = this.cd < 0.35 ? 1 + (0.35 - this.cd) * 0.5 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(ly, lx));
        ctx.beginPath();
        ctx.roundRect(r * 0.3, -r * 0.33, r * 1.05 * swell, r * 0.66, 6);
        ctx.fillStyle = flash ? '#fff' : '#1f9e93';
        ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.restore();
        blob(ctx, x, y, r, this.color, { sx: swell, sy: 2 - swell, flash });
        eyes(ctx, x, y, r, lx, ly, { angry: true });
        break;
      }

      case 'charger': {
        const shake = this.st === 'aim' ? rand(-2.5, 2.5) : 0;
        const cx = x + shake;
        shadow(ctx, x, y, r);
        // cuernos
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s * r * 0.35, y - r * 0.75);
          ctx.quadraticCurveTo(cx + s * r * 1.05, y - r * 0.95, cx + s * r * 0.95, y - r * 1.45);
          ctx.quadraticCurveTo(cx + s * r * 0.75, y - r * 0.85, cx + s * r * 0.75, y - r * 0.45);
          ctx.closePath();
          ctx.fillStyle = '#fff4d6';
          ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
        const stretch = this.st === 'dash' ? 0.12 : 0;
        blob(ctx, cx, y, r, this.color, { sx: 1 + stretch, sy: 1 - stretch, flash });
        eyes(ctx, cx, y, r, lx, ly, { angry: true });
        // hocico
        ctx.beginPath();
        ctx.ellipse(cx, y + r * 0.42, r * 0.38, r * 0.22, 0, 0, TAU);
        ctx.fillStyle = '#e8a37a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
        if (this.st === 'aim') outlinedText(ctx, '!', cx, y - r - 22, 30, '#ff5d73', { lw: 6 });
        break;
      }
    }

    // barra de vida pequeña
    if (this.type !== 'boss' && this.hp < this.maxHp) {
      const w = r * 1.8, bx = x - w / 2, by = y - r - (this.type === 'bat' ? 34 : 14);
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, w + 4, 9, 4); ctx.fill();
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.roundRect(bx, by, w * Math.max(0, this.hp / this.maxHp), 5, 3); ctx.fill();
    }
  }
}

function drawCrown(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.35);
  ctx.lineTo(x - s, y - s * 0.35);
  ctx.lineTo(x - s * 0.5, y + s * 0.05);
  ctx.lineTo(x, y - s * 0.6);
  ctx.lineTo(x + s * 0.5, y + s * 0.05);
  ctx.lineTo(x + s, y - s * 0.35);
  ctx.lineTo(x + s, y + s * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE; ctx.stroke();
  for (const [gx, c] of [[-0.5, '#4cc9f0'], [0, '#ff5d73'], [0.5, '#80ed99']]) {
    ctx.beginPath();
    ctx.arc(x + gx * s, y + s * 0.12, s * 0.12, 0, TAU);
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  }
}

