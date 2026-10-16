// ─────────────────────────────────────────────
//  Jefes: lo que comparten todos. La ficha de cada uno (BOSS_TYPES), la base común (BossBase: aparecer,
//  recibir daño, la máquina de estados), los avisos de ataque que se dibujan en el suelo y su cuerpo
//  al morir. Cada jefe va en su archivo (jefe-portera.js, jefe-vecino.js) y bosses.js los reúne.
//
//  Cada jefe es una pequeña máquina de estados: anda un rato, elige un
//  ataque, lo AVISA (siempre se puede esquivar) y lo ejecuta.
// ─────────────────────────────────────────────
import { WALL, OUTLINE } from './config.js';
import { rand } from './utils.js';
import { drawSprite, hasSprite } from './sprites.js';
import { sfx } from './sfx.js';

export const TAU = Math.PI * 2;
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const BOSS_TYPES = {
  // sprite: su hoja de pixel art; feet: a cuánto por debajo de su centro dibuja los pies; top: a cuánto por encima
  // tiene la cabeza (para los números de daño y los gritos); shadow: ancho de la sombra
  miniboss: {
    name: 'La portera', icon: '🧹', hp: 600, r: 38, s: 1.75, speed: 80, dmg: 10, bar: '#b5179e',
    sprite: 'jefe-portera', feet: 26, top: 190, shadow: 104,
    look: { skin: '#b9d38f', hair: '#cfc8dc', shirt: '#9b6bb5', pants: '#6d597a', shoes: '#5c4b6e' },
  },
  // la jefa final de la azotea: de momento, la misma portera con el doble de vida (la de verdad se hará más adelante)
  boss: {
    name: 'La portera', icon: '👑', hp: 1200, r: 38, s: 1.75, speed: 80, dmg: 10, bar: '#b5179e',
    sprite: 'jefe-portera', feet: 26, top: 190, shadow: 104,
    look: { skin: '#b9d38f', hair: '#cfc8dc', shirt: '#9b6bb5', pants: '#6d597a', shoes: '#5c4b6e' },
  },
  // el mini jefe de antes (no sale: makeBoss ya no lo crea)
  vecino: {
    name: 'El vecino del 4ºB', icon: '👹', hp: 400, r: 28, s: 1.9, speed: 70, dmg: 10, bar: '#ff5d73',
    look: { skin: '#9cbf7a', hair: '#7a7468', shirt: '#f1efe6', pants: '#4f6d9a', shoes: '#c94c4c' },
  },
};

export const SPAWN = 1.4;

// ═════════════ Base común ═════════════
export class BossBase {
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
    this.sprite = d.sprite && hasSprite(d.sprite) ? d.sprite : null;
    this.top = this.sprite ? d.top : 60 * d.s;   // altura de la cabeza sobre su centro
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
    game.floatText(this.x + rand(-10, 10), this.y - this.top, Math.round(dmg).toString(), crit ? '#ffd23f' : '#ffffff', crit ? 26 : 18);
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
export function drawLane(ctx, x, y, angle, len, width, k) {
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
export function drawCircleWarn(ctx, x, y, r, k, color = '255, 60, 90') {
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

// Distancia hasta la pared siguiendo un ángulo (para dibujar el aviso). `w` y `h`: medidas del mapa.
export function distToWall(x, y, a, r, w, h) {
  const cx = Math.cos(a), cy = Math.sin(a);
  let t = 2000;
  if (cx > 0.001) t = Math.min(t, (w - WALL - r - x) / cx);
  if (cx < -0.001) t = Math.min(t, (WALL + r - x) / cx);
  if (cy > 0.001) t = Math.min(t, (h - WALL - r - y) / cy);
  if (cy < -0.001) t = Math.min(t, (WALL + r - y) / cy);
  return Math.max(0, t);
}

// El cuerpo de un jefe en el suelo: hace su animación de morir y se queda en el último fotograma
export class BossCorpse {
  constructor(sprite, x, feetY, dir, time) {
    this.kind = 'corpse';
    this.sprite = sprite;
    this.x = x;
    this.y = feetY - 30;   // se ordena un poco más arriba: los que siguen en pie se dibujan por encima
    this.feetY = feetY;
    this.dir = dir;
    this.t0 = time;
    this.solid = false;
    this.taken = true;     // así el juego no intenta recogerlo ni señalarlo
  }

  draw(ctx, game) {
    drawSprite(ctx, this.sprite, 'death', this.dir, game.time - this.t0, this.x, this.feetY);
  }
}
