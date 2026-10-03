// ─────────────────────────────────────────────
//  Personajes: jugador, compañeros y enemigos
// ─────────────────────────────────────────────
import { W, H, WALL, OUTLINE, PLAYER_LOOK } from './config.js';
import { rand } from './utils.js';
import { blob, eyes, shadow, outlinedText, drawHuman } from './draw.js';
import { sfx } from './sfx.js';
import { WEAPONS, drawWeapon } from './weapons.js';
import { autoAim } from './aim.js';

const TAU = Math.PI * 2;

// ═════════════ JUGADOR ═════════════
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Player {
  constructor(stats) {
    this.stats = stats;
    this.x = W / 2;
    this.y = H - WALL - 60;
    this.r = 18;
    this.vx = 0; this.vy = 0;
    this.hp = stats.maxHp;
    this.invuln = 0;      // tiempo de invulnerabilidad tras recibir daño
    this.hurtT = 0;       // destello blanco al recibir daño
    this.dashT = 0;       // duración restante de la esquiva
    this.dashCd = 0;      // enfriamiento de la esquiva
    this.lookX = 0; this.lookY = -1;
    this.walkT = 0;
    this.blinkT = rand(2, 4);
    this.dead = false;

    // Arma y apuntado
    this.weapon = WEAPONS.fregona; // se empieza cada edificio con la fregona
    this.aimer = autoAim;          // en el futuro: un controlador manual
    this.atkT = 0;                 // tiempo hasta el siguiente ataque
    this.aimAngle = -Math.PI / 2;  // hacia dónde apunta
    this.armAngle = -Math.PI / 2;  // ángulo actual del arma (animado)
    this.swing = null;             // barrido en curso (armas cuerpo a cuerpo)
    this.swingDir = 1;             // los barridos van y vuelven, como fregando
    this.recoil = 0;               // retroceso del arma a distancia
    this.muzzleT = 0;              // fogonazo
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
    game.collideWorld(this);

    const sp = Math.hypot(this.vx, this.vy);
    this.walkT += dt * (sp > 20 ? 4 + sp / 22 : 0);
    if (move.x || move.y) {
      this.lookX = move.x; this.lookY = move.y;
      this.aimAngle = Math.atan2(move.y, move.x);
    }

    // Ataque: el controlador de apuntado decide hacia dónde y cuándo
    this.atkT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.muzzleT -= dt;
    if (game.state === 'playing') {
      const w = this.weapon;
      const aim = this.aimer.aim(game, this, w, s);
      if (aim) {
        this.aimAngle = aim.angle;
        this.lookX = Math.cos(aim.angle); this.lookY = Math.sin(aim.angle);
        if (aim.attack && this.atkT <= 0) {
          this.atkT = 1 / (w.rate * s.fireRate);
          this.attack(game, aim.angle);
        }
      }
    }
    this.animateArm(dt);
  }

  attack(game, angle) {
    const w = this.weapon, s = this.stats;
    if (w.type === 'melee') {
      // Barrido en arco: de un lado al otro del objetivo
      const half = (w.arc * Math.PI) / 360;
      this.swing = {
        t: 0,
        dur: Math.min(0.2, 0.7 / (w.rate * s.fireRate)),
        from: angle - half * this.swingDir,
        to: angle + half * this.swingDir,
        reach: w.reach * s.range,
      };
      this.swingDir *= -1;
      game.meleeHit(this, angle, half, w.reach * s.range, w.damage * s.damage, w);
      sfx.swing();
    } else {
      // Disparo desde la boca del arma
      const h = this.handPos(angle);
      const n = w.pellets + s.shots;
      game.fireVolley(this, angle, {
        dmg: w.damage * s.damage,
        count: n,
        spread: w.pellets > 1 ? w.spread : 0.16,
        jitter: w.pellets > 1 ? 0.06 : 0,
        speed: w.speed * s.bulletSpeed,
        life: (w.range * s.range) / (w.speed * s.bulletSpeed),
        pierce: s.pierce,
        knock: w.knock,
        r: w.pellets > 1 ? 5 : 7,
        x: h.x + Math.cos(angle) * w.muzzle,
        y: h.y + Math.sin(angle) * w.muzzle,
      });
      this.recoil = 1;
      this.muzzleT = 0.06;
      game.casing(h.x, h.y, angle);
      if (w.pellets > 1) { sfx.shotgun(); game.shake(4); } else sfx.gun();
    }
  }

  // Posición de la mano que sujeta el arma (gira alrededor del cuerpo)
  handPos(a) {
    return { x: this.x + Math.cos(a) * 13, y: this.y + 3 + Math.sin(a) * 9 };
  }

  animateArm(dt) {
    const sw = this.swing;
    if (sw) {
      sw.t += dt;
      const k = Math.min(1, sw.t / sw.dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.armAngle = sw.from + (sw.to - sw.from) * e;
      if (sw.t >= sw.dur + 0.1) this.swing = null;
      return;
    }
    // En reposo: el arma cuerpo a cuerpo se queda preparada para el siguiente barrido
    const w = this.weapon;
    const rest = w.type === 'melee' ? this.aimAngle - (w.arc * Math.PI / 360) * 0.7 * this.swingDir : this.aimAngle;
    this.armAngle += wrapAngle(rest - this.armAngle) * (1 - Math.exp(-dt * 14));
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

  draw(ctx) {
    const { x, y } = this;

    // Indicador de recarga de la esquiva (arco bajo los pies)
    if (this.dashCd > 0) {
      ctx.beginPath();
      ctx.ellipse(x, y + 15, 19, 7, 0, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - this.dashCd / 0.9));
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.save();
    if (this.invuln > 0 && this.dashT <= 0 && Math.floor(this.invuln * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    this.drawSwingTrail(ctx);
    const a = this.armAngle;
    const behind = Math.sin(a) < -0.3; // si apunta hacia arriba, el arma va detrás del cuerpo
    if (behind) this.drawArm(ctx, a);
    const sp = Math.hypot(this.vx, this.vy);
    drawHuman(ctx, x, y, {
      ...PLAYER_LOOK,
      lookX: this.lookX,
      lookY: this.lookY,
      moveX: sp > 1 ? this.vx / sp : 0,
      moveY: sp > 1 ? this.vy / sp : 0,
      moving: Math.min(1, sp / 150),
      walk: this.walkT,
      blink: this.blinkT < 0,
      flash: this.hurtT > 0,
      hideHand: 1, // esa mano la dibujamos nosotros, sujetando el arma
    });
    if (!behind) this.drawArm(ctx, a);
    ctx.restore();
  }

  drawArm(ctx, a) {
    const h = this.handPos(a);
    const back = this.recoil * 6;
    ctx.save();
    ctx.translate(h.x - Math.cos(a) * back, h.y - Math.sin(a) * back);
    ctx.rotate(a);
    if (Math.cos(a) < 0) ctx.scale(1, -1); // que las pistolas no queden boca abajo
    drawWeapon(ctx, this.weapon);
    if (this.muzzleT > 0 && this.weapon.type === 'ranged') {
      const mx = this.weapon.muzzle + 6;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 4 : 11, t = (i / 10) * TAU;
        ctx.lineTo(mx + Math.cos(t) * r, Math.sin(t) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff9f1c';
      ctx.stroke();
    }
    ctx.restore();
    // la mano encima de la empuñadura
    ctx.beginPath();
    ctx.arc(h.x - Math.cos(a) * back, h.y - Math.sin(a) * back, 4.5, 0, TAU);
    ctx.fillStyle = this.hurtT > 0 ? '#ffffff' : PLAYER_LOOK.skin;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  // Estela del barrido: un abanico que se desvanece
  drawSwingTrail(ctx) {
    const sw = this.swing;
    if (!sw) return;
    const alpha = 0.8 * (1 - Math.max(0, (sw.t - sw.dur) / 0.1));
    if (alpha <= 0) return;
    const ccw = sw.to < sw.from;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y + 3, sw.reach + 8, sw.from, this.armAngle, ccw);
    ctx.arc(this.x, this.y + 3, 20, this.armAngle, sw.from, !ccw);
    ctx.closePath();
    ctx.fillStyle = this.weapon.trail;
    ctx.globalAlpha *= 0.7;
    ctx.fill();
    ctx.globalAlpha /= 0.7;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }
}

// ═════════════ COMPAÑEROS (el "equipo") ═════════════
// `def` es uno de los supervivientes de config.js (policía, médica, militar...)
export class Ally {
  constructor(def, x, y) {
    this.def = def;
    this.color = def.color;
    this.x = x; this.y = y;
    this.r = 14;
    this.vx = 0; this.vy = 0;
    this.idx = 0;
    this.fireT = rand(0, 0.6);
    this.lookX = 0; this.lookY = 1;
    this.walkT = rand(0, 6);
  }

  update(dt, game) {
    const p = game.player;
    const n = game.allies.length;
    // Los compañeros se reparten alrededor del jugador y lo siguen
    const ang = (this.idx / n) * TAU + game.time * 0.6;
    const tx = p.x + Math.cos(ang) * 55;
    const ty = p.y + Math.sin(ang) * 42;
    const k = 1 - Math.exp(-dt * 6);
    const nx = this.x + (tx - this.x) * k;
    const ny = this.y + (ty - this.y) * k;
    this.vx = (nx - this.x) / dt; this.vy = (ny - this.y) / dt;
    this.x = nx; this.y = ny;
    game.collideWorld(this);
    const sp = Math.hypot(this.vx, this.vy);
    this.walkT += dt * (sp > 20 ? 4 + sp / 22 : 0);
    if (sp > 20) { this.lookX = this.vx / sp; this.lookY = this.vy / sp; }

    if (game.state !== 'playing') return;
    // De momento todos disparan igual; en la fase 5 cada uno tendrá su papel
    this.fireT -= dt;
    const s = game.stats;
    const target = game.nearestEnemy(this.x, this.y, 380);
    if (target) {
      const a = Math.atan2(target.y - this.y, target.x - this.x);
      this.lookX = Math.cos(a); this.lookY = Math.sin(a);
      if (this.fireT <= 0) {
        this.fireT = 1 / 1.2;
        game.fireVolley(this, a, { dmg: 5 * s.teamDamage, color: this.color, r: 6 });
      }
    }
  }

  draw(ctx) {
    const sp = Math.hypot(this.vx, this.vy);
    drawHuman(ctx, this.x, this.y, {
      ...this.def.look,
      s: 0.82,
      lookX: this.lookX,
      lookY: this.lookY,
      moveX: sp > 1 ? this.vx / sp : 0,
      moveY: sp > 1 ? this.vy / sp : 0,
      moving: Math.min(1, sp / 150),
      walk: this.walkT,
    });
  }
}

// ═════════════ ENEMIGOS ═════════════
export const ENEMY_TYPES = {
  slime:   { name: 'Gelatina',  r: 20, hp: 24,  speed: 80,  dmg: 12, color: '#ff5d73', coins: [1, 2] },
  bat:     { name: 'Murci',     r: 15, hp: 14,  speed: 135, dmg: 10, color: '#7b61ff', coins: [1, 2] },
  shooter: { name: 'Escupidor', r: 21, hp: 30,  speed: 70,  dmg: 12, color: '#2ec4b6', coins: [2, 3] },
  charger: { name: 'Toro',      r: 25, hp: 50,  speed: 55,  dmg: 18, color: '#c97b4a', coins: [3, 4] },
  miniboss: { name: 'Gelatina Gorda', r: 46, hp: 380, speed: 60, dmg: 16, color: '#9b6bff', coins: [0, 0] },
  boss:    { name: 'Rey Gelatina', r: 62, hp: 1200, speed: 55, dmg: 20, color: '#ff5d73', coins: [0, 0] },
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
    this.spawnT = this.isBoss ? 1.4 : SPAWN_TIME;
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
  get isBoss() { return this.type === 'boss' || this.type === 'miniboss'; }

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

      case 'miniboss':
      case 'boss': {
        // El jefe final es más grande y agresivo que el mini jefe
        const big = this.type === 'boss';
        const phase2 = this.hp < this.maxHp * 0.5;
        if (phase2 && !this.enraged) {
          this.enraged = true;
          this.color = big ? '#ff3355' : '#7b3fe0';
          game.floatText(this.x, this.y - this.r - 20, '¡FURIOSO!', '#ffd23f', 30);
          game.shake(14);
        }
        mx = ux; my = uy;
        spd = (phase2 ? 85 : 55) * (0.4 + 0.9 * Math.max(0, Math.sin(this.t * 3)));
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = big ? (phase2 ? 1.9 : 2.7) : (phase2 ? 2.4 : 3.2);
          const n = big ? (phase2 ? 16 : 12) : (phase2 ? 10 : 8);
          const off = rand(0, TAU);
          for (let i = 0; i < n; i++) game.enemyShoot(this.x, this.y, off + (i / n) * TAU, 190, 14);
          game.shake(6);
        }
        this.sumT -= dt;
        if (this.sumT <= 0) {
          this.sumT = big ? (phase2 ? 5.5 : 7) : 8;
          game.spawnEnemy('slime', this.x - 80, this.y + 30);
          if (big || phase2) game.spawnEnemy('slime', this.x + 80, this.y + 30);
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
    game.collideWorld(this);
  }

  hurt(dmg, crit, dirX, dirY, game, knock = 1) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    const push = (this.isBoss ? 20 : this.type === 'charger' ? 90 : 180) * knock;
    this.kx += dirX * push; this.ky += dirY * push;
    game.floatText(this.x + rand(-8, 8), this.y - this.r - 6, Math.round(dmg).toString(), crit ? '#ffd23f' : '#ffffff', crit ? 26 : 18);
    sfx.hit();
    if (this.hp <= 0) game.killEnemy(this);
  }

  draw(ctx, game) {
    const { x, y, r } = this;

    // Aviso en el suelo antes de aparecer
    if (this.spawnT > 0) {
      const total = this.isBoss ? 1.4 : SPAWN_TIME;
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
      case 'miniboss':
      case 'boss': {
        shadow(ctx, x, y, r);
        const j = Math.max(0, Math.sin(this.t * (this.isBoss ? 3 : 5)));
        const hop = j * (this.isBoss ? 14 : 8);
        const sq = (1 - j) * 0.12;
        blob(ctx, x, y - hop, r, this.color, { sx: 1 + sq, sy: 1 - sq + j * 0.05, flash, lw: this.isBoss ? 6 : 4 });
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
    if (!this.isBoss && this.hp < this.maxHp) {
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

