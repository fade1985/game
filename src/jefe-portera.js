// ─────────────────────────────────────────────
//  "La portera" (mini jefa de cada planta desde el 15 de octubre de 2026, y
//  de momento también la jefa final): una abuela zombi con una fregona
//  llena de sangre. Lanza agua sucia en abanico, da fregonazos, tira
//  botellas de lejía y, a mitad de vida, se enfada de verdad. En pixel art
//  (hoja "jefe-portera"); sin la hoja, se dibuja como antes.
// ─────────────────────────────────────────────
import { OUTLINE } from './config.js';
import { rand } from './utils.js';
import { drawHuman } from './draw.js';
import { drawSpawnWarning } from './entities.js';
import { drawSprite, pixelShadow, dirFromVector, animFrames } from './sprites.js';
import { sfx } from './sfx.js';
import { TAU, wrap, SPAWN, BossBase, drawCircleWarn, BossCorpse } from './jefe-base.js';

// Valores ajustables de cada ataque
export const PORTERA = {
  fanWarn: 0.55, fanCount: 7, fanSpread: 1.0, fanSpeed: 240, fanDmg: 10,
  sweepWarn: 0.6, sweepReach: 135, sweepHalf: 1.05, sweepDmg: 20, sweepRange: 150,
  bottles: 3, spinTime: 2.6, spinDmg: 10,
};
// Charco de lejía (lo usa game.js igual que los de veneno)
export const BLEACH = { hit: 10, dps: 8, life: 5, radius: 54, flight: 0.9 };

// ═════════════ LA PORTERA ═════════════
export class Portera extends BossBase {
  constructor(type, x, y, hpMul = 1) {
    super(type, x, y, hpMul);
    this.last = '';
    this.sweepCd = 1.5;
    this.summonCd = 8;
    this.broom = Math.PI / 2;   // ángulo de la escoba
    this.broomTarget = Math.PI / 2;
    this.spin = 0;
  }

  // Al morir, su cuerpo cae y se queda en el suelo (como el de los zombis)
  onDeath(game) {
    if (this.sprite && animFrames(this.sprite, 'death') && game.room) {
      game.room.props.push(new BossCorpse(this.sprite, this.x, this.y + this.def.feet, dirFromVector(this.lookX, this.lookY), game.time));
    }
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

    const to = { p, d, aim, angry };
    switch (st.name) {
      case 'walk':
        this.steer(dt, p.x, p.y, angry ? 105 : 75);
        this.look(dt, p.x, p.y);
        if (st.t >= st.dur) this.choose(game, d);
        break;
      case 'fanWarn':
        // levanta la escoba hacia atrás
        this.brake(dt);
        this.look(dt, p.x, p.y);
        this.broomTarget = aim - 2.2;
        if (st.t >= PORTERA.fanWarn) this.setState('fan', { shots: angry ? 3 : 2, next: 0, i: 0 });
        break;
      case 'fan': this.fan(dt, game, to); break;
      case 'sweepWarn': this.sweepWarn(dt, game, to); break;
      case 'sweep':
        this.brake(dt);
        this.broomTarget = st.angle + 1.6;
        if (st.t >= 0.35) this.setState('walk', { dur: angry ? 0.4 : 0.8 });
        break;
      case 'bleach': this.bleach(dt, game, to); break;
      case 'spinWarn':
        this.brake(dt);
        this.spin += dt * 6 * (st.t / 0.6);
        if (st.t >= 0.6) this.setState('spin', { next: 0 });
        break;
      case 'spin': this.whirl(dt, game, to); break;
      case 'summon': this.summon(dt, game); break;
      case 'rage': this.rage(dt, game); break;
      case 'recover':
        this.brake(dt, 4);
        if (st.t >= st.dur) this.setState('walk', { dur: 0.4 });
        break;
    }
    this.move(dt, game);
    // la escoba gira con suavidad hacia su posición
    if (st.name === 'spin' || st.name === 'spinWarn') this.broom = this.spin;
    else this.broom += wrap(this.broomTarget - this.broom) * (1 - Math.exp(-dt * (st.name === 'sweep' ? 30 : 12)));
  }

  // ── Cada ataque, paso a paso (los llama think según el estado en que está) ──

  // Abanico de agua sucia: dos tandas (tres enfadada), cada una desplazada medio hueco
  fan(dt, game, { p, aim, angry }) {
    const st = this.state;
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
  }

  // Aviso del escobazo: fija la dirección al empezar el aviso y, al acabar, golpea
  sweepWarn(dt, game, { aim }) {
    const st = this.state;
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
  }

  // Lanza botellas de lejía alrededor de donde estás (la primera, justo donde vas a estar)
  bleach(dt, game, { p, aim, angry }) {
    const st = this.state;
    this.brake(dt);
    this.look(dt, p.x, p.y);
    this.broomTarget = aim + 1.6;
    const n = angry ? PORTERA.bottles + 2 : PORTERA.bottles;
    while (st.thrown < n && st.t >= 0.3 + st.thrown * 0.18) {
      const spreadR = st.thrown === 0 ? 0 : rand(60, 130);
      const a = rand(0, TAU);
      game.lob(this.x, this.y - (this.sprite ? this.top * 0.6 : 40 * this.s), p.x + p.vx * 0.3 + Math.cos(a) * spreadR, p.y + p.vy * 0.3 + Math.sin(a) * spreadR, 'bleach');
      sfx.spit();
      st.thrown++;
    }
    if (st.t >= 0.3 + n * 0.18 + 0.4) this.setState('walk', { dur: angry ? 0.5 : 1 });
  }

  // Torbellino (solo enfadada): gira con la escoba, te persigue y escupe polvo en espiral
  whirl(dt, game, { p }) {
    const st = this.state;
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
  }

  // Llama a los vecinos del 3º: un zombi normal y uno rápido a sus lados
  summon(dt, game) {
    const st = this.state;
    this.brake(dt);
    if (st.t >= 0.8 && !st.done) {
      st.done = true;
      for (const [i, type] of ['normal', 'rapido'].entries()) {
        const a = (i / 2) * TAU + rand(-0.5, 0.5);
        game.spawnEnemy(type, this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 90);
      }
    }
    if (st.t >= 1.1) this.setState('walk', { dur: 0.6 });
  }

  // Paso a la fase 2: invulnerable un momento y echa al jugador hacia atrás (game.bossRage), echando humo
  rage(dt, game) {
    const st = this.state;
    this.invulnerable = true;
    this.brake(dt);
    this.dmg = 0;
    this.broomTarget = -Math.PI / 2;
    if (Math.random() < dt * 20) game.puff(this.x + rand(-20, 20), this.y - this.top - 10, '#ffffff');
    if (st.t >= 1.6) this.setState('walk', { dur: 0.3 });
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
      game.floatText(this.x, this.y - this.top - 20 * this.s, '¡LOS DEL 3º!', '#ffd23f', 26);
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
      game.floatText(this.x, this.y - this.top - 20 * this.s, '¡LEJÍA!', '#bfe9ff', 24);
    } else {
      this.setState('spinWarn');
      game.floatText(this.x, this.y - this.top - 20 * this.s, '¡A BARRER!', '#ffd23f', 26);
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

    const flash = this.hitFlash > 0 || (this.invulnerable && Math.floor(game.time * 16) % 2 === 0);
    const shake = st.name === 'rage' ? rand(-2, 2) : 0;
    if (this.sprite) { this.drawPixel(ctx, game, flash, shake); return; }

    this.drawShadow(ctx);
    const sp = Math.hypot(this.vx, this.vy);
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

  // Pixel art: cada estado tiene su animación de la hoja
  //   andar / reposo · fregonazo (el aviso es levantar la fregona; el golpe, bajarla) para el abanico y el
  //   escobazo · lanzar la lejía · grito para enfadarse y llamar a los vecinos · el giro, su postura quieta
  //   dando vueltas
  drawPixel(ctx, game, flash, shake) {
    const { x, y, state: st } = this;
    const def = this.def;
    const sp = Math.hypot(this.vx, this.vy);
    let dir = dirFromVector(this.lookX, this.lookY);
    const frames = (anim) => animFrames(this.sprite, anim);
    const fr = (anim, k) => Math.min(frames(anim) - 1, Math.max(0, Math.floor(k * frames(anim))));
    const hitF = 2;   // fotograma del fregonazo en el que la fregona toca el suelo
    const raise = (k) => Math.min(hitF - 1, Math.floor(k * hitF));
    const strike = (k) => hitF + Math.min(frames('attack') - 1 - hitF, Math.max(0, Math.floor(k * (frames('attack') - hitF))));
    let anim = sp > 10 ? 'walk' : 'idle';
    const opts = { flash };
    if (anim === 'walk') opts.cycle = this.walkT / 7;
    const set = (a, f) => { anim = a; opts.frame = f; delete opts.cycle; };
    switch (st.name) {
      case 'fanWarn': set('attack', raise(st.t / PORTERA.fanWarn)); break;
      case 'fan': set('attack', st.i === 0 ? hitF : strike(1 - Math.max(0, st.next) / 0.4)); break;
      case 'sweepWarn':
        set('attack', raise(st.t / PORTERA.sweepWarn));
        if (st.angle !== undefined) dir = dirFromVector(Math.cos(st.angle), Math.sin(st.angle));
        break;
      case 'sweep': set('attack', strike(st.t / 0.35)); dir = dirFromVector(Math.cos(st.angle), Math.sin(st.angle)); break;
      case 'bleach': {
        const n = this.phase === 2 ? PORTERA.bottles + 2 : PORTERA.bottles;
        set('throw', fr('throw', st.t / (0.3 + n * 0.18 + 0.4)));
        break;
      }
      case 'spinWarn': case 'spin':
        set('still', 0);
        dir = dirFromVector(Math.cos(this.spin), Math.sin(this.spin));
        break;
      case 'summon': set('roar', fr('roar', st.t / 1.1)); break;
      case 'rage': set('roar', fr('roar', st.t / 1.6)); break;
    }
    // en la segunda fase, un poco más roja de rabia
    if (this.phase === 2 && !flash) opts.tint = { color: '#ff3b2f', alpha: 0.18 };
    pixelShadow(ctx, x, y + def.feet - 2, def.shadow);
    drawSprite(ctx, this.sprite, anim, dir, game.time, x + shake, y + def.feet, opts);
    if (this.phase === 2) {
      // vapor saliendo de la cabeza
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 3; i++) {
        const k = (game.time * 1.2 + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(x + (i - 1) * 24, y - this.top + 10 - k * 40, 4 + k * 8, 0, TAU);
        ctx.globalAlpha = 1 - k;
        ctx.fill();
      }
      ctx.restore();
    }
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
