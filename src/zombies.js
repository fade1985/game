// ─────────────────────────────────────────────
//  Zombis: los 6 tipos de enemigo del edificio
//
//  Todos usan el mismo dibujo de persona (drawHuman) con brazos estirados,
//  y cada tipo tiene su color, tamaño y comportamiento. Los ataques
//  peligrosos SIEMPRE avisan antes, para que se puedan esquivar.
// ─────────────────────────────────────────────
import { OUTLINE, PIXEL_MODE } from './config.js';
import { drawSprite, dirFromVector } from './sprites.js';
import { rand } from './utils.js';
import { drawHuman } from './draw.js';
import { drawSpawnWarning } from './entities.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;

export const ZOMBIE_TYPES = {
  lento: {
    name: 'Zombi lento', r: 17, s: 1.05, hp: 30, speed: 45, dmg: 10, push: 130,
    look: { skin: '#a8c686', hair: '#5b4a3a', shirt: '#8d7b68', pants: '#5c5470', shoes: '#3b3550' },
  },
  normal: {
    name: 'Zombi', r: 16, s: 1, hp: 30, speed: 80, dmg: 10, push: 170,
    look: { skin: '#8fc46a', hair: '#3b2f2a', shirt: '#5b7db1', pants: '#3d4a7a', shoes: '#2e2a3a' },
  },
  rapido: {
    name: 'Zombi rápido', r: 14, s: 0.88, hp: 15, speed: 165, dmg: 8, push: 200,
    look: { skin: '#9ed36d', hair: '#e9c46a', shirt: '#e76f51', pants: '#264653', shoes: '#ffffff' },
  },
  explosivo: {
    name: 'Zombi explosivo', r: 19, s: 1.15, hp: 25, speed: 70, dmg: 6, push: 140,
    look: { skin: '#c3d96b', hair: '#6b4f3a', shirt: '#f4a261', pants: '#6d4c41', shoes: '#3b3550' },
  },
  tentaculos: {
    name: 'Zombi tentáculos', r: 18, s: 1.1, hp: 45, speed: 30, dmg: 10, push: 80,
    look: { skin: '#86b8aa', hair: '#2f2a3a', shirt: '#6d597a', pants: '#3a3355', shoes: '#2e2a3a' },
  },
  venenoso: {
    name: 'Zombi venenoso', r: 16, s: 1, hp: 35, speed: 60, dmg: 8, push: 160,
    look: { skin: '#b5e655', hair: '#4f772d', shirt: '#4f772d', pants: '#31572c', shoes: '#2e2a3a' },
  },
};

// Ataques especiales (ajustables)
export const EXPLOSION = { radius: 90, dmg: 30, fuse: 0.8, trigger: 70 };
export const TENTACLE = { range: 220, warn: 0.7, strike: 0.25, cd: 2.5, dmg: 15, width: 16 };
export const POISON = { hit: 8, dps: 5, life: 4, radius: 46, flight: 0.8, cd: 2.6 };

const SPAWN = 0.8;

export class Zombie {
  constructor(type, x, y, hpMul = 1) {
    const d = ZOMBIE_TYPES[type];
    this.type = type;
    this.def = d;
    this.name = d.name;
    this.x = x; this.y = y;
    this.r = d.r;
    this.s = d.s;
    this.maxHp = Math.round(d.hp * hpMul);
    this.hp = this.maxHp;
    this.speed = d.speed;
    this.dmg = d.dmg;
    this.color = d.look.skin;
    this.vx = 0; this.vy = 0;
    this.kx = 0; this.ky = 0;   // empuje al recibir golpes
    this.spawnT = SPAWN;
    this.t = rand(0, 10);
    this.walkT = rand(0, 6);
    this.hitFlash = 0;
    this.dead = false;
    this.lookX = 0; this.lookY = 1;
    this.cd = rand(1, 2.2);      // enfriamiento del ataque especial
    this.fuse = 0;               // explosivo: mecha encendida
    this.exploded = false;
    this.tent = null;            // tentáculos: ataque en curso
    this.spitT = 0;              // venenoso: preparando el escupitajo
    this.strafe = Math.random() < 0.5 ? -1 : 1;
  }

  get active() { return this.spawnT <= 0 && !this.dead; }
  get isBoss() { return false; }

  update(dt, game) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.t += dt;
    this.hitFlash -= dt;
    this.cd -= dt;

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    let mx = ux, my = uy, spd = this.speed, steer = 8;

    switch (this.type) {
      case 'lento':
        // arrastra los pies: avanza a tirones
        spd *= 0.55 + 0.45 * Math.abs(Math.sin(this.t * 2));
        mx += -uy * Math.sin(this.t * 1.5) * 0.3;
        my += ux * Math.sin(this.t * 1.5) * 0.3;
        break;

      case 'normal':
        mx += -uy * Math.sin(this.t * 2.3) * 0.2;
        my += ux * Math.sin(this.t * 2.3) * 0.2;
        break;

      case 'rapido':
        // gira muy poco: corre en línea recta y se pasa de largo si lo esquivas
        steer = 2.2;
        break;

      case 'explosivo':
        if (this.fuse > 0) {
          spd = 0;
          const before = this.fuse;
          this.fuse -= dt;
          if (Math.floor(before * 8) !== Math.floor(this.fuse * 8)) sfx.beep();
          if (this.fuse <= 0) {
            this.detonate(game);
            this.hp = 0;
            game.killEnemy(this);
            return;
          }
        } else if (d < EXPLOSION.trigger + p.r) {
          this.fuse = EXPLOSION.fuse; // ¡se enciende la mecha!
        }
        break;

      case 'tentaculos':
        if (this.tent) {
          spd = 0;
          const tn = this.tent;
          tn.t += dt;
          if (tn.phase === 'warn' && tn.t >= TENTACLE.warn) {
            tn.phase = 'strike'; tn.t = 0;
            sfx.whip();
            game.tentacleHit(this, tn.angle);
          } else if (tn.phase === 'strike' && tn.t >= TENTACLE.strike) {
            this.tent = null;
            this.cd = TENTACLE.cd;
          }
        } else if (this.cd <= 0 && d < TENTACLE.range + p.r) {
          // apunta a donde estás AHORA: si te mueves, fallará
          this.tent = { angle: Math.atan2(dy, dx), phase: 'warn', t: 0 };
        } else if (d < 140) {
          spd = 0;
        }
        break;

      case 'venenoso':
        // mantiene la distancia y escupe mocos
        if (d < 220) { mx = -ux; my = -uy; }
        else if (d > 310) { mx = ux; my = uy; }
        else { mx = -uy * this.strafe; my = ux * this.strafe; }
        if (this.spitT > 0) {
          spd = 0;
          this.spitT -= dt;
          if (this.spitT <= 0) {
            game.lob(this.x, this.y - 18 * this.s, p.x, p.y);
            this.cd = POISON.cd;
            sfx.spit();
          }
        } else if (this.cd <= 0 && d < 430) {
          this.spitT = 0.4; // hincha los mofletes antes de escupir
        }
        break;
    }

    const l = Math.hypot(mx, my) || 1;
    const k = 1 - Math.exp(-dt * steer);
    this.vx += ((mx / l) * spd - this.vx) * k;
    this.vy += ((my / l) * spd - this.vy) * k;
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
    const kd = Math.exp(-dt * 10);
    this.kx *= kd; this.ky *= kd;
    game.collideWorld(this);

    const sp = Math.hypot(this.vx, this.vy);
    this.walkT += dt * (sp > 10 ? 3 + sp / 25 : 0);
    // mira hacia el jugador (suavizado)
    this.lookX += (ux - this.lookX) * Math.min(1, dt * 8);
    this.lookY += (uy - this.lookY) * Math.min(1, dt * 8);
  }

  detonate(game) {
    if (this.exploded) return;
    this.exploded = true;
    game.explode(this.x, this.y, EXPLOSION.radius, EXPLOSION.dmg, this);
  }

  // Lo llama el juego al morir: el explosivo revienta también si lo matas
  onDeath(game) {
    if (this.type === 'explosivo') this.detonate(game);
  }

  hurt(dmg, crit, dirX, dirY, game, knock = 1) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitFlash = 0.08;
    const push = this.def.push * knock;
    this.kx += dirX * push; this.ky += dirY * push;
    game.floatText(this.x + rand(-8, 8), this.y - 38 * this.s, Math.round(dmg).toString(), crit ? '#ffd23f' : '#ffffff', crit ? 26 : 18);
    sfx.hit();
    if (this.hp <= 0) game.killEnemy(this);
  }

  draw(ctx, game) {
    const { x, y, s } = this;
    if (this.spawnT > 0) { drawSpawnWarning(ctx, x, y, this.r, 1 - this.spawnT / SPAWN, game.time); return; }

    // ── avisos en el suelo ──
    if (this.type === 'explosivo' && this.fuse > 0) {
      const k = 1 - this.fuse / EXPLOSION.fuse;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y + 4, EXPLOSION.radius, 0, TAU);
      ctx.fillStyle = `rgba(255, 80, 60, ${0.12 + k * 0.25})`;
      ctx.fill();
      ctx.setLineDash([10, 7]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ff5d3c';
      ctx.stroke();
      ctx.restore();
    }
    if (this.tent && this.tent.phase === 'warn') {
      const k = this.tent.t / TENTACLE.warn;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.tent.angle);
      ctx.beginPath();
      ctx.roundRect(0, -TENTACLE.width, TENTACLE.range, TENTACLE.width * 2, TENTACLE.width);
      ctx.fillStyle = `rgba(255, 60, 90, ${0.1 + k * 0.3})`;
      ctx.fill();
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
      ctx.stroke();
      ctx.restore();
    }

    // tentáculos de la espalda (detrás del cuerpo)
    if (this.type === 'tentaculos') this.drawBackTentacles(ctx);

    // ── el zombi ──
    let flash = this.hitFlash > 0;
    let scale = s;
    let shake = 0;
    if (this.fuse > 0) {
      const k = 1 - this.fuse / EXPLOSION.fuse;
      flash = flash || Math.floor(this.t * (8 + k * 16)) % 2 === 0; // parpadea cada vez más rápido
      scale = s * (1 + k * 0.15);
      shake = rand(-1.5, 1.5);
    }
    if (this.tent && this.tent.phase === 'warn') shake = rand(-1, 1);
    const sp = Math.hypot(this.vx, this.vy);
    // pixel art: un sprite por tipo de zombi ("zombi-normal", "zombi-rapido"...)
    const sprited = PIXEL_MODE && drawSprite(ctx, `zombi-${this.type}`, sp > 10 ? 'walk' : 'idle',
      dirFromVector(this.lookX, this.lookY), game.time, x + shake, y + 15 * scale, { flash });
    if (!sprited) drawHuman(ctx, x + shake, y, {
      ...this.def.look,
      s: scale,
      zombie: true,
      angry: true,
      lookX: this.lookX,
      lookY: this.lookY,
      moveX: sp > 1 ? this.vx / sp : 0,
      moveY: sp > 1 ? this.vy / sp : 0,
      moving: Math.min(1, sp / 100),
      walk: this.walkT,
      flash,
    });

    // ── detalles de cada tipo ──
    if (this.type === 'explosivo' && !flash && !sprited) this.drawBombVest(ctx, x + shake, y, scale, game.time);
    if (this.type === 'venenoso' && !sprited) this.drawSlime(ctx, x, y, scale);
    if (this.tent && this.tent.phase === 'strike') this.drawStrike(ctx);

    // barra de vida pequeña
    if (this.hp < this.maxHp) {
      const w = 34 * s, bx = x - w / 2, by = y - 46 * s;
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, w + 4, 9, 4); ctx.fill();
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.roundRect(bx, by, w * Math.max(0, this.hp / this.maxHp), 5, 3); ctx.fill();
    }
  }

  drawBombVest(ctx, x, y, s, time) {
    // cartuchos rojos atados a la barriga
    const by = y + 2 * s;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.roundRect(x + i * 6 * s - 2.5 * s, by + 1 * s, 5 * s, 10 * s, 2 * s);
      ctx.fillStyle = '#e63946';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    ctx.fillStyle = '#3b3550';
    ctx.fillRect(x - 10 * s, by + 5 * s, 20 * s, 2.5 * s);
    // mecha encendida en la cabeza
    const fx = x + 3 * s, fy = by - 30 * s;
    ctx.beginPath();
    ctx.moveTo(x, by - 28 * s);
    ctx.quadraticCurveTo(x + 6 * s, by - 32 * s, fx, fy - 4 * s);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    const f = 3 + Math.sin(time * 30) * 1.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? f * 0.5 : f * 1.4, a = (i / 8) * TAU + time * 6;
      ctx.lineTo(fx + Math.cos(a) * r, fy - 5 * s + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
  }

  drawSlime(ctx, x, y, s) {
    const hy = y + 2 * s - 15 * s;
    if (this.spitT > 0) {
      // mofletes hinchados de moco
      ctx.fillStyle = '#7ccf3a';
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + this.lookX * 4 * s + k * 10 * s, hy + 9 * s, 5 * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (this.lookY > -0.4) {
      // babas verdes
      const dx = x + this.lookX * 5 * s;
      const drip = 3 + Math.abs(Math.sin(this.t * 2)) * 4;
      ctx.beginPath();
      ctx.ellipse(dx + 2 * s, hy + 14 * s + drip / 2, 2.2 * s, drip / 2 + 1, 0, 0, TAU);
      ctx.fillStyle = '#9be33b';
      ctx.fill();
    }
  }

  drawBackTentacles(ctx) {
    const back = Math.atan2(-this.lookY, -this.lookX);
    const bx = this.x - this.lookX * 6, by = this.y - 6;
    for (let i = -1; i <= 1; i++) {
      const a = back + i * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let j = 1; j <= 6; j++) {
        const t = j / 6;
        const wig = Math.sin(this.t * 5 + j + i * 2) * 5 * t;
        ctx.lineTo(bx + Math.cos(a) * 26 * t - Math.sin(a) * wig, by + Math.sin(a) * 26 * t + Math.cos(a) * wig);
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#a06cc0';
      ctx.stroke();
    }
  }

  // El latigazo: un tentáculo largo que sale disparado hacia el objetivo
  drawStrike(ctx) {
    const tn = this.tent;
    const len = TENTACLE.range * Math.min(1, tn.t / 0.08);
    ctx.save();
    ctx.translate(this.x, this.y - 4);
    ctx.rotate(tn.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      ctx.lineTo(len * t, Math.sin(t * 9 + tn.t * 30) * 5 * (1 - t));
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#a06cc0';
    ctx.stroke();
    ctx.fillStyle = '#f2b5d4';
    for (let i = 2; i < 10; i += 2) {
      const t = i / 12;
      ctx.beginPath();
      ctx.arc(len * t, Math.sin(t * 9 + tn.t * 30) * 5 * (1 - t), 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
