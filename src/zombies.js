// ─────────────────────────────────────────────
//  Zombis: los 6 tipos de enemigo del edificio
//
//  Todos usan el mismo dibujo de persona (drawHuman) con brazos estirados,
//  y cada tipo tiene su color, tamaño y comportamiento. Los ataques
//  peligrosos SIEMPRE avisan antes, para que se puedan esquivar.
// ─────────────────────────────────────────────
import { OUTLINE, PIXEL } from './config.js';
import { drawSprite, dirFromVector, hasSprite, pixelShadow, animFrames, animDuration, spritePoints } from './sprites.js';
import { rand } from './utils.js';
import { drawHuman } from './draw.js';
import { drawSpawnWarning } from './entities.js';
import { sfx } from './sfx.js';
import { FIRE, MOLOTOV } from './molotov.js';

const TAU = Math.PI * 2;
const CORPSES = 12;   // cuántos zombis tendidos se quedan como mucho en una sala
const REACH = 18;     // a qué distancia del conserje (además de los dos radios) lanza el zarpazo

// Efectos de estado (de momento solo el fuego del molotov). Se pintan por código, sin hojas aparte:
// al dibujar al zombi se le echa una capa de color por encima, así sirve para cualquier hoja y variante.
const FLAMES = 70;        // llamas por segundo que le suben a un zombi que arde
const CHAR = '#2c211c';   // el carbón de los que mueren ardiendo (se multiplica: oscurece sin borrar las sombras)
const STAIN = '#16110f';  // la mancha de hollín que queda en el suelo cuando el cuerpo se deshace
// Lo que le pasa al cuerpo de un zombi que muere ardiendo, en segundos desde que toca el suelo:
const BURNT = {
  char: 1.5,      // se va apagando y ennegreciendo (mientras cae, sigue en llamas)
  embers: 5,      // le quedan brasas y humo hasta aquí
  ash: 6.5,       // y entre embers y ash se deshace en ceniza: solo queda la mancha
};

// Llamas de píxeles que suben desde una zona (ancho w, alto h, con los pies en x, y), `rate` por segundo
function flames(game, x, y, w, h, rate, dt) {
  let n = rate * dt;
  for (; n > 0; n--) {
    if (n < 1 && Math.random() > n) break;
    game.particles.push({
      x: x + rand(-w, w) * 0.5, y: y - rand(0, h),
      vx: rand(-18, 18), vy: rand(-130, -60), px: true, size: rand(2, 4),
      color: FIRE[Math.floor(rand(0, 4))], life: rand(0.25, 0.55), max: 0.55,
    });
  }
}

// Un zombi muerto: cae y se queda tendido en el suelo. Solo es dibujo (no estorba ni se puede coger).
// Lo deja el propio zombi al morir si su hoja de sprites tiene la animación "death".
// Si murió ardiendo: cae en llamas, se apaga y se queda como carbón con brasas y humo, y al final se deshace
// en ceniza y deja una mancha de hollín en el suelo (que ya no se va).
class Corpse {
  constructor(sprite, x, y, dir, time, scale = 1, burnt = false) {
    this.kind = 'corpse';
    this.sprite = sprite;
    this.x = x;
    this.y = y - 12;       // se ordena un poco más arriba: los que siguen en pie se dibujan por encima
    this.dir = dir;
    this.t0 = time;
    this.scale = scale;    // el mismo tamaño de dibujo que tenía en vida
    this.solid = false;
    this.taken = true;     // así el juego no intenta recogerlo ni señalarlo
    this.burnt = burnt;    // murió ardiendo
    this.embers = null;    // dónde salen las brasas y el humo (se calcula cuando termina de caer)
    this.lastT = time;     // para soltar llamas y ceniza al ritmo del tiempo
  }

  draw(ctx, game) {
    const t = game.time - this.t0;
    const fx = this.x, fy = this.y + 12 + 15;   // los pies
    if (!this.burnt) {
      drawSprite(ctx, this.sprite, 'death', this.dir, t, fx, fy, { scale: this.scale });
      return;
    }
    const dt = Math.max(0, game.time - this.lastT);
    this.lastT = game.time;
    const s = this.scale || 1;
    const tg = t - animDuration(this.sprite, 'death');   // tiempo desde que tocó el suelo (negativo: cayendo)
    const sprite = (o) => drawSprite(ctx, this.sprite, 'death', this.dir, t, fx, fy, { scale: this.scale, ...o });
    const fire = (k) => ({ color: Math.floor(game.time * 12) % 2 ? FIRE[2] : FIRE[3], alpha: 0.65 * k });

    if (tg < 0) {
      // cae ardiendo, como en vida
      sprite({ tint: fire(1) });
      flames(game, fx, fy, 40 * s, 50 * s, FLAMES, dt);
      return;
    }
    if (tg < BURNT.char) {
      // en el suelo: el fuego se apaga mientras el carbón aparece por encima (de naranja a negro, sin
      // pasar por sus colores de antes)
      const k = tg / BURNT.char;
      sprite({ tint: fire(1) });
      sprite({ tint: { color: CHAR, alpha: 1, mode: 'multiply' }, alpha: k });
      flames(game, fx, fy - 4, 44 * s, 24 * s, FLAMES * (1 - k), dt);
    } else if (tg < BURNT.ash) {
      // carbón; al final se va deshaciendo (cada vez más transparente) sobre su mancha
      const k = Math.max(0, (tg - BURNT.embers) / (BURNT.ash - BURNT.embers));
      if (k > 0) sprite({ tint: { color: STAIN, alpha: 1, mode: 'source-in' }, alpha: 0.5 * k });
      sprite({ tint: { color: CHAR, alpha: 1, mode: 'multiply' }, alpha: 1 - k });
      if (k > 0) this.ashes(game, fx, fy, s, dt);
    } else {
      // solo queda la mancha de hollín
      sprite({ tint: { color: STAIN, alpha: 1, mode: 'source-in' }, alpha: 0.5 });
      return;
    }
    if (tg < BURNT.embers) this.drawEmbers(ctx, game, tg, fx, fy, s);
  }

  // Brasas que parpadean sobre el cuerpo y columnas de humo espeso, que se van apagando
  drawEmbers(ctx, game, tg, fx, fy, s) {
    if (!this.embers) {
      this.embers = spritePoints(this.sprite, 'death', this.dir, animFrames(this.sprite, 'death') - 1, 12)
        .map(([x, y]) => [x * s, y * s, rand(0, 10)]);
    }
    const left = 1 - tg / BURNT.embers;   // de 1 (recién caído) a 0 (apagado)
    const px = PIXEL * s;
    const snap = (v) => Math.round(v / PIXEL) * PIXEL;
    for (const [x, y, ph] of this.embers) {
      const glow = Math.sin(game.time * 7 + ph) * 0.5 + 0.5;
      if (glow * left < 0.2) continue;             // apagada en este momento
      ctx.globalAlpha = Math.min(1, left * 1.5);
      ctx.fillStyle = glow > 0.7 ? FIRE[1] : FIRE[3];
      ctx.fillRect(snap(fx + x), snap(fy + y), px, px);
    }
    // humo: cuatro columnas de bocanadas pegadas unas a otras, que crecen al subir y se deshacen
    for (const [x, y, ph] of this.embers.slice(0, 4)) {
      for (let k = 0; k < 8; k++) {
        const c = (game.time * 0.6 + ph + k / 8) % 1;   // 0 = sale, 1 = se deshace
        const size = px * (3 + c * 5);
        ctx.globalAlpha = (1 - c) * 0.55 * Math.min(1, left * 1.3);
        ctx.fillStyle = c < 0.3 ? '#4a4542' : '#6b6560';
        ctx.fillRect(snap(fx + x + Math.sin(c * 5 + ph) * 8 - size / 2), snap(fy + y - c * 70 - size / 2), size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Se deshace: copos de ceniza que se levantan del cuerpo
  ashes(game, fx, fy, s, dt) {
    let n = 30 * dt;
    for (; n > 0; n--) {
      if (n < 1 && Math.random() > n) break;
      const [x, y] = this.embers?.length ? this.embers[Math.floor(rand(0, this.embers.length))] : [0, -10];
      game.particles.push({
        x: fx + x + rand(-6, 6) * s, y: fy + y, vx: rand(-20, 20), vy: rand(-60, -25), px: true,
        size: rand(1.5, 3), color: Math.random() < 0.5 ? '#3a3330' : '#76706a', life: rand(0.4, 0.8), max: 0.8,
      });
    }
  }
}

export const ZOMBIE_TYPES = {
  lento: {
    variantes: ['rojo', 'bata', 'mostaza', 'negro', 'militar', 'turquesa'],
    // medio cuerpo: su dibujo se encoge un poco (spriteScale) para que no abulte tanto como uno entero
    name: 'Zombi lento', r: 17, s: 1.05, spriteScale: 0.85, hp: 30, speed: 45, dmg: 10, push: 130,
    look: { skin: '#a8c686', hair: '#5b4a3a', shirt: '#8d7b68', pants: '#5c5470', shoes: '#3b3550' },
  },
  normal: {
    // variantes: hojas con otra ropa (tools/variantes.py); cada zombi sale con una al azar, o con la de siempre
    variantes: ['rojo', 'bata', 'mostaza', 'negro', 'militar', 'turquesa'],
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
    // el gordo: su sprite es más grande que los demás (lienzo de 72) para que imponga junto al conserje
    name: 'Zombi venenoso', r: 30, s: 1.5, shadow: 84, top: 124, hp: 35, speed: 60, dmg: 8, push: 160,
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
    this.burnT = 0;              // segundos que le quedan ardiendo (lo enciende el fuego del molotov)
    this.burnTick = 0;           // cuenta para repartir la quemadura a pellizcos
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.asleep = false;         // los de los apartamentos esperan quietos hasta que notan al conserje
    this.wakeT = 0;              // el respingo al despertar: un instante antes de echar a andar
    this.zone = -1;              // en qué habitación esperaba
    this.anim = null;            // pixel art: animación en curso que no es andar (zarpazo o golpe recibido)
    // variante de color: la de siempre (null) o una de las del tipo, si su hoja está cargada
    const opciones = [null, ...(d.variantes || [])];
    const v = opciones[Math.floor(Math.random() * opciones.length)];
    this.variant = v && hasSprite(`zombi-${type}-${v}`) ? v : null;
  }

  get sprite() { return this.variant ? `zombi-${this.type}-${this.variant}` : `zombi-${this.type}`; }

  // Ardiendo: se quema (el mismo daño que dentro del fuego, a tiempos de MOLOTOV.tick) y le suben llamas
  burn(dt, game) {
    this.burnT -= dt;
    this.burnTick += dt;
    const tall = this.def.top ? this.def.top - 30 : 40 * this.s;   // alto del cuerpo, más o menos
    flames(game, this.x, this.y, this.r * 1.2, tall, FLAMES, dt);
    if (this.burnTick >= MOLOTOV.tick) {
      this.burnTick -= MOLOTOV.tick;
      this.hurt(MOLOTOV.burn * MOLOTOV.tick, false, 0, 0, game, 0);
    }
  }

  // Pone una animación de la hoja de sprites (si la tiene). Solo es dibujo: no cambia lo que hace el zombi
  play(name) {
    const dur = animDuration(this.sprite, name);
    if (dur && animFrames(this.sprite, name)) this.anim = { name, t: 0, dur };
  }

  // Despierta (al ver al conserje, al recibir un golpe o porque se ha despertado el de al lado)
  wake(game) {
    if (!this.asleep) return;
    this.asleep = false;
    this.wakeT = rand(0.35, 0.6);
    game.floatText(this.x, this.y - 44 * this.s, '!', '#ff5d73', 24);
    game.wakeNear(this);
  }

  get active() { return this.spawnT <= 0 && !this.dead; }
  get isBoss() { return false; }

  update(dt, game) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.t += dt;
    this.hitFlash -= dt;
    if (this.burnT > 0) this.burn(dt, game);
    if (this.anim && (this.anim.t += dt) >= this.anim.dur) this.anim = null;
    if (this.asleep || this.wakeT > 0) {
      // dormido: se balancea en su sitio, mirando a ninguna parte
      if (this.asleep) {
        this.lookX = Math.cos(this.t * 0.5);
        this.lookY = Math.sin(this.t * 0.5);
        if (game.notices(this)) this.wake(game);
      } else this.wakeT -= dt;
      this.x += this.kx * dt; this.y += this.ky * dt;
      const kd = Math.exp(-dt * 10);
      this.kx *= kd; this.ky *= kd;
      game.collideWorld(this);
      return;
    }
    this.cd -= dt;

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    let ux = dx / d, uy = dy / d;
    // si hay un tabique o un mueble en medio, lo rodea en vez de ir en línea recta
    const way = game.wayTo(this);
    if (way) { ux = way.x; uy = way.y; }
    // y desde detrás de un tabique nadie ataca: primero hay que llegar a ver al conserje
    const sees = !way || game.sees(this);
    let mx = ux, my = uy, spd = this.speed, steer = 8;

    switch (this.type) {
      case 'lento':
        // se arrastra: avanza a tirones y deja un rastro de sangre
        game.dropTrail(this);
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
        } else if (sees && d < EXPLOSION.trigger + p.r) {
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
        } else if (sees && this.cd <= 0 && d < TENTACLE.range + p.r) {
          // apunta a donde estás AHORA: si te mueves, fallará
          this.tent = { angle: Math.atan2(dy, dx), phase: 'warn', t: 0 };
        } else if (sees && d < 140) {
          spd = 0;
        }
        break;

      case 'venenoso':
        // mantiene la distancia y escupe mocos
        if (!sees) { mx = ux; my = uy; }
        else if (d < 220) { mx = -ux; my = -uy; }
        else if (d > 310) { mx = ux; my = uy; }
        else { mx = -uy * this.strafe; my = ux * this.strafe; }
        if (this.spitT > 0) {
          spd = 0;
          this.spitT -= dt;
          if (this.spitT <= 0) {
            // con sprite, el moco sale de la boca (bastante más arriba que en el dibujo de antes)
            game.lob(this.x + this.lookX * 26, this.y - (hasSprite(this.sprite) ? 88 : 18 * this.s), p.x, p.y);
            this.cd = POISON.cd;
            sfx.spit();
          }
        } else if (sees && this.cd <= 0 && d < 430) {
          this.spitT = 0.4; // hincha los mofletes antes de escupir
          this.play('attack'); // pixel art: se echa atrás y escupe (el moco sale a los 0,4 s, como marca su hoja)
        }
        // mientras dura el escupitajo (hasta el último dibujo) se queda plantado y frena en seco:
        // si se moviera sin mover las piernas, parecería que va flotando
        if (this.spitT > 0 || this.anim?.name === 'attack') { spd = 0; steer = 30; }
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
    // al llegar al conserje, lanza el zarpazo (el daño sigue siendo por contacto, como siempre)
    // (el venenoso no da zarpazos: su animación de ataque es el escupitajo)
    if (!this.anim && sees && this.dmg > 0 && this.type !== 'venenoso' && !p.dead && d < this.r + p.r + REACH) this.play('attack');
  }

  detonate(game) {
    if (this.exploded) return;
    this.exploded = true;
    game.explode(this.x, this.y, EXPLOSION.radius, EXPLOSION.dmg, this);
  }

  // Lo llama el juego al morir: el explosivo revienta también si lo matas
  onDeath(game) {
    if (this.type === 'explosivo') this.detonate(game);
    // pixel art: el cuerpo cae y se queda en el suelo (los más antiguos se van retirando)
    if (animFrames(this.sprite, 'death') && game.room) {
      const props = game.room.props;
      const old = props.filter((pr) => pr.kind === 'corpse');
      if (old.length >= CORPSES) props.splice(props.indexOf(old[0]), 1);
      // si muere ardiendo, el cuerpo queda carbonizado
      props.push(new Corpse(this.sprite, this.x, this.y, dirFromVector(this.lookX, this.lookY), game.time, this.def.spriteScale, this.burnT > 0));
    }
  }

  hurt(dmg, crit, dirX, dirY, game, knock = 1) {
    if (this.dead) return;
    this.wake(game);
    this.hp -= dmg;
    this.hitFlash = 0.08;
    const push = this.def.push * knock;
    this.kx += dirX * push; this.ky += dirY * push;
    game.floatText(this.x + rand(-8, 8), this.y - 38 * this.s, Math.round(dmg).toString(), crit ? '#ffd23f' : '#ffffff', crit ? 26 : 18);
    sfx.hit();
    if (this.hp <= 0) game.killEnemy(this);
    else this.play('hurt');
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
    if (hasSprite(`zombi-${this.type}`)) pixelShadow(ctx, x, y + 14 * scale, this.def.shadow || 28 * scale);
    // zarpazo o golpe recibido si hay uno en marcha; si no, andar (al ritmo de sus pasos) o reposo
    const an = this.anim;
    const opts = an ? { flash, frame: Math.floor((an.t / an.dur) * animFrames(this.sprite, an.name)) }
      : sp > 10 ? { flash, cycle: this.walkT / 7 } : { flash };
    if (this.def.spriteScale) opts.scale = this.def.spriteScale;   // dibujo ampliado (ver ZOMBIE_TYPES)
    // en llamas: capa naranja que parpadea (y se apaga poco a poco al final)
    if (this.burnT > 0) {
      const fade = Math.min(1, this.burnT / 0.5);
      const flick = Math.floor(game.time * 12) % 2;
      opts.tint = { color: flick ? FIRE[2] : FIRE[3], alpha: (0.6 + Math.sin(game.time * 23) * 0.1) * fade };
    }
    const sprited = drawSprite(ctx, this.sprite, an ? an.name : sp > 10 ? 'walk' : 'idle',
      dirFromVector(this.lookX, this.lookY), game.time, x + shake, y + 15 * scale, opts);
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
      const w = 34 * s, bx = x - w / 2, by = y - (this.def.top || 46 * s);   // "top": por encima de la cabeza en los sprites altos
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
