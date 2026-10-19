// ─────────────────────────────────────────────
//  Personajes: jugador, compañeros y enemigos
// ─────────────────────────────────────────────
import { W, H, WALL, OUTLINE, PLAYER_LOOK } from './config.js';
import { drawSprite, dirFromVector, hasSprite, pixelShadow, animFrames, animHit, animDuration, spriteMuzzle } from './sprites.js';
import { rand } from './utils.js';
import { drawHuman } from './draw.js';
import { sfx } from './sfx.js';
import { WEAPONS, RIFLE, AMMO, drawHeld } from './weapons.js';
import { autoAim } from './aim.js';
import { agarre, tinteEstado } from './estados.js';

const TAU = Math.PI * 2;
// Unidades que avanza el conserje en un ciclo de andar (dos pasos): a su velocidad normal (210) son
// tres pasos por segundo, un trote ligero. Con 8 fotogramas por ciclo salen 12 por segundo
const STEP = 140;

// pixel art: los personajes son altos y la pistola del dibujo queda a la altura del pecho, unas 50 unidades por
// encima de donde el juego calcula los choques (los pies y la cintura). La bala se mueve por el suelo, como
// siempre, pero se dibuja levantada: sale del cañón y baja enseguida hasta la altura del cuerpo de los zombis
const MUZZLE_LIFT = 50;

// Retroceso al disparar andando: cuántas unidades se echa Johnny hacia atrás (2 unidades = 1 píxel del dibujo)
// y en cuántos segundos vuelve a su sitio
const KICK = 6, KICK_T = 0.12;

// Esquiva: cada cuánto deja Johnny una copia suya detrás (la estela), cuánto tarda en desvanecerse y de qué
// color se tiñe; cuánto se estira en la dirección de la esquiva y cuánto dura el "aplastón" al frenar
const GHOST_EVERY = 0.03, GHOST_LIFE = 0.22;
const GHOST_TINT = { color: '#3fa9ff', alpha: 0.8, mode: 'source-atop' };
const DASH_STRETCH = 0.18, LAND_T = 0.09, LAND_SQUASH = 0.12;

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
    this.dashX = 0; this.dashY = 0; // hacia dónde va la esquiva (para estirar el dibujo)
    this.landT = 0;       // "aplastón" al terminar la esquiva
    this.ghosts = [];     // estela de la esquiva: copias de Johnny que se desvanecen
    this.ghostAt = -1;    // cuándo dejó la última copia
    this.lookX = 0; this.lookY = -1;
    this.walkT = 0;
    this.blinkT = rand(2, 4);
    this.dead = false;

    // Armas: un hueco para la de cuerpo a cuerpo y otro para la de fuego (el molotov va aparte).
    // `hand` dice cuál lleva en la mano; `weapon` es esa misma arma
    this.slots = { melee: WEAPONS.fregona, ranged: null }; // se empieza cada edificio con la fregona
    this.hand = 'melee';
    this.mag = 0;                  // balas que quedan en el cargador del arma de fuego
    this.reserve = 0;              // balas de reserva en la mochila
    this.reloadT = 0;              // recargando: segundos que faltan (0 = no recarga)
    this.reloadDur = 0;            //   y cuánto dura esta recarga (o este cartucho, en la escopeta)
    this.autoMelee = false;        // se ha cambiado sola a la de cuerpo a cuerpo al quedarse sin balas
    this.aimer = autoAim;          // en el futuro: un controlador manual
    this.atkT = 0;                 // tiempo hasta el siguiente ataque
    this.aimAngle = -Math.PI / 2;  // hacia dónde apunta
    this.armAngle = -Math.PI / 2;  // ángulo actual del arma (animado)
    this.swing = null;             // barrido en curso (armas cuerpo a cuerpo)
    this.swingDir = 1;             // los barridos van y vuelven, como fregando
    this.atkAnim = null;           // pixel art: animación de ataque en curso { t, dur, hit, at }
    this.recoil = 0;               // retroceso del arma a distancia
    this.muzzleT = 0;              // fogonazo
  }

  // El arma que lleva en la mano. Si se le da una (weapon = ...), va a su hueco y se la pone en la mano
  get weapon() { return this.slots[this.hand] || this.slots.melee; }
  set weapon(w) { this.equip(w); }

  // ¿Lleva ya esta arma (en cualquiera de los dos huecos)?
  has(w) { return this.slots[w.type]?.id === w.id; }

  // Coge un arma: va a su hueco (cuerpo a cuerpo o de fuego) y se la pone en la mano. Una de fuego viene con
  // la munición que traiga (`ammo`, si era la que soltó él) o, si no, con el cargador lleno y la reserva de
  // partida. Devuelve la que había en ese hueco, con su munición, para dejarla en el suelo (o null)
  equip(w, ammo = null) {
    const old = this.slots[w.type];
    const dropped = old ? { weapon: old, ammo: old.type === 'ranged' ? { mag: this.mag, reserve: this.reserve } : null } : null;
    this.slots[w.type] = w;
    if (w.type === 'ranged') {
      this.mag = ammo ? ammo.mag : w.mag;
      this.reserve = ammo ? ammo.reserve : w.mag * AMMO.start;
    }
    this.hold(w.type);
    this.autoMelee = false;
    return dropped;
  }

  // Se pone en la mano el arma de ese hueco: lo que estaba haciendo con la otra se corta
  hold(slot) {
    this.hand = slot;
    this.reloadT = 0;
    this.swing = null;
    this.atkAnim = null;
  }

  // Cambia a la otra arma (Q, rueda del ratón, botón Y o el cartel). A la de fuego sin balas no se cambia
  switchHand(game) {
    const other = this.hand === 'melee' ? 'ranged' : 'melee';
    if (!this.slots[other]) return;
    if (other === 'ranged' && this.mag <= 0 && !this.hasReserve(game)) {
      game.floatText(this.x, this.y - 70, '¡Sin balas!', '#ff9f1c', 18);
      sfx.click();
      return;
    }
    this.hold(other);
    this.autoMelee = false;
    this.atkT = Math.max(this.atkT, 0.15); // un instante para cambiar de arma
    sfx.swap();
  }

  // ¿Le quedan balas en la mochila? (en el modo de pruebas, siempre)
  hasReserve(game) { return game.testMode || this.reserve > 0; }

  get reloading() { return this.reloadT > 0; }

  // Empieza a recargar el arma de fuego, si hace falta y puede
  startReload(game) {
    const w = this.weapon;
    if (w.type !== 'ranged' || this.reloading || this.mag >= w.mag || !this.hasReserve(game)) return;
    this.reloadDur = w.reload;
    this.reloadT = w.reload;
    sfx.reload();
  }

  // Termina una recarga: mete el cargador entero o, en la escopeta, un cartucho (y sigue con el siguiente)
  finishReload(game) {
    const w = this.weapon;
    const want = w.shell ? 1 : w.mag - this.mag;
    const take = game.testMode ? want : Math.min(want, this.reserve);
    this.mag += take;
    if (!game.testMode) this.reserve -= take;
    this.reloadT = 0;
    if (w.shell) {
      sfx.shell();
      if (this.mag < w.mag && this.hasReserve(game)) { this.reloadT = this.reloadDur = w.reload; }
    } else sfx.reloaded();
  }

  // Recoge una caja de munición: un cargador más para el arma de fuego que lleve. Si se había cambiado sola
  // a la de cuerpo a cuerpo por quedarse sin balas, vuelve a sacar la de fuego
  addAmmo(game) {
    const w = this.slots.ranged;
    if (!w) return false;
    this.reserve = Math.min(w.mag * AMMO.max, this.reserve + w.mag * AMMO.box);
    if (this.autoMelee) { this.hold('ranged'); this.autoMelee = false; }
    if (this.hand === 'ranged' && this.mag <= 0) this.startReload(game);
    return true;
  }

  // ¿Le cabe más munición? (para que la caja venga hacia él)
  wantsAmmo() {
    const w = this.slots.ranged;
    return !!w && this.reserve < w.mag * AMMO.max;
  }

  // Antes de disparar: ¿hay bala en el cargador? Si no, recarga o, sin reserva, cambia a la de cuerpo a cuerpo.
  // La escopeta puede disparar a mitad de recarga (con lo que lleve metido); las demás, no
  readyToFire(game) {
    const w = this.weapon;
    if (this.reloading) {
      if (!w.shell || this.mag <= 0) return false;
      this.reloadT = 0; // dispara y deja de meter cartuchos
    }
    if (this.mag > 0) return true;
    if (this.hasReserve(game)) { this.startReload(game); return false; }
    // sin balas: a la fregona (o la que lleve)
    game.floatText(this.x, this.y - 70, '¡Sin balas!', '#ff9f1c', 18);
    sfx.click();
    this.hold('melee');
    this.autoMelee = true;
    return false;
  }

  update(dt, game, move, dash) {
    const s = this.stats;
    this.dashCd -= dt;
    this.invuln -= dt;
    this.dodgeT = (this.dodgeT || 0) - dt; // Reflejos: cuenta atrás hasta la siguiente esquiva automática
    // Lobezno: recupera vida poco a poco
    if (s.regen && !this.dead && this.hp < s.maxHp && (this.regenT = (this.regenT || 0) + dt) >= 3) {
      this.regenT -= 3;
      game.healPlayer(s.regen);
    }
    this.hurtT -= dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = rand(2, 4.5);

    // Esquiva (dash): impulso rápido con invulnerabilidad
    if (dash && this.dashCd <= 0) {
      let dx = move.x, dy = move.y;
      if (!dx && !dy) { dx = this.lookX; dy = this.lookY; }
      const l = Math.hypot(dx, dy) || 1;
      this.dashX = dx / l; this.dashY = dy / l;
      this.vx = this.dashX * s.speed * 3.3;
      this.vy = this.dashY * s.speed * 3.3;
      this.dashT = 0.16;
      this.dashCd = s.dashCd;
      this.invuln = Math.max(this.invuln, 0.3);
      this.ghostAt = -1;
      // polvo al despegar: sale hacia atrás, como si empujara el suelo con los pies
      game.dust(this.x, this.y + this.r * 0.8, -this.dashX, -this.dashY, 6);
      sfx.dash();
    }

    // la estela se va apagando
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      if ((this.ghosts[i].life -= dt) <= 0) this.ghosts.splice(i, 1);
    }
    this.landT -= dt;

    if (this.dashT > 0) {
      this.dashT -= dt;
      if (this.dashT <= 0) {
        // frena: un poco de polvo hacia delante y un aplastón rápido
        this.landT = LAND_T;
        if (s.ninja) game.ninjaStrike(this); // Ninja: golpe en área al acabar la esquiva
        game.dust(this.x, this.y + this.r * 0.8, this.dashX, this.dashY, 3);
      }
    } else {
      // Aceleración suave hacia la velocidad deseada (en suelo resbaladizo, mucho más suave: patina)
      const k = 1 - Math.exp(-dt * 14 * agarre(this));
      this.vx += (move.x * s.speed - this.vx) * k;
      this.vy += (move.y * s.speed - this.vy) * k;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    game.collideWorld(this);

    const sp = Math.hypot(this.vx, this.vy);
    this.walkT += dt * (sp > 20 ? 4 + sp / 22 : 0);
    // pixel art: el paso avanza según lo que se desplaza de verdad (más despacio al arrancar y al frenar);
    // al pararse vuelve al principio para empezar el siguiente paso con los pies juntos
    this.stepT = sp > 20 ? (this.stepT || 0) + sp * dt : 0;
    if (move.x || move.y) {
      this.lookX = move.x; this.lookY = move.y;
      this.aimAngle = Math.atan2(move.y, move.x);
    }

    // Ataque: el controlador de apuntado decide hacia dónde y cuándo
    this.atkT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.muzzleT -= dt;
    const an = this.atkAnim;
    if (an) {
      an.t += dt;
      if (an.hit && an.t >= an.dur * an.at) { an.hit(); an.hit = null; }
      if (an.t >= an.dur) this.atkAnim = null;
    }
    if (this.reloading && (this.reloadT -= dt) <= 0) this.finishReload(game);
    if (game.state === 'playing') {
      const w = this.weapon;
      const aim = this.aimer.aim(game, this, w, s);
      if (aim) {
        this.aimAngle = aim.angle;
        this.lookX = Math.cos(aim.angle); this.lookY = Math.sin(aim.angle);
        if (aim.attack && this.atkT <= 0 && (w.type === 'melee' || this.readyToFire(game))) {
          this.atkT = 1 / (w.rate * s.fireRate);
          this.attack(game, aim.angle);
        }
      } else if (w.type === 'ranged') this.startReload(game); // sin nadie a tiro, aprovecha para recargar
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
        reach: w.reach * s.range * s.meleeRange,
      };
      this.swingDir *= -1;
      const hit = () => game.meleeHit(this, angle, half, w.reach * s.range * s.meleeRange, w.damage * s.damage * s.meleeDamage, w);
      if (w.sprite && hasSprite(w.sprite)) {
        // pixel art: la animación del golpe dura medio segundo como mucho y nunca más que el hueco entre
        // ataques; el daño se hace cuando el arma llega a su sitio (lo dice la hoja), no al empezar a moverla
        this.atkAnim = { t: 0, dur: Math.min(0.5, 0.95 / (w.rate * s.fireRate)), hit, at: animHit(w.sprite, 'attack') };
      } else hit();
      sfx.swing();
    } else {
      // Disparo desde la boca del arma (gasta una bala del cargador; al vaciarlo, recarga sola)
      this.mag--;
      if (this.mag <= 0) this.startReload(game);
      const h = this.handPos(angle);
      const n = w.pellets + s.shots;
      // pixel art: si el arma tiene hoja propia, la bala nace en la boca del arma del dibujo (los pies del
      // sprite van 16 unidades por debajo del centro) y se ve la animación de disparo, con su fogonazo
      const armed = w.sprite && hasSprite(w.sprite);
      const m = armed ? spriteMuzzle(w.sprite, dirFromVector(Math.cos(angle), Math.sin(angle))) : null;
      const bx = m ? this.x + m[0] : h.x + Math.cos(angle) * w.muzzle;
      const by = m ? this.y + 16 + m[1] + MUZZLE_LIFT : h.y + Math.sin(angle) * w.muzzle;
      // Mirilla: después de cada 3 disparos, el siguiente es crítico seguro
      this.shots = (this.shots || 0) + 1;
      const sure = s.mirilla && this.shots % 4 === 0;
      game.fireVolley(this, angle, {
        crit: sure,
        dmg: w.damage * s.damage * s.rangedDamage,
        count: n,
        spread: w.pellets > 1 ? w.spread : 0.16,
        jitter: w.pellets > 1 ? 0.06 : w.jitter || 0,
        speed: w.speed * s.bulletSpeed,
        life: (w.range * s.range) / (w.speed * s.bulletSpeed),
        pierce: s.pierce,
        knock: w.knock,
        r: w.pellets > 1 ? 5 : 7,
        x: bx,
        y: by,
        lift: m ? MUZZLE_LIFT : 0,
      });
      if (armed) {
        // la bala ya ha salido: la animación solo acompaña, y nunca dura más que el hueco entre disparos
        const dur = Math.min(animDuration(w.sprite, 'attack') || 0.4, 0.95 / (w.rate * s.fireRate));
        this.atkAnim = { t: 0, dur, hit: null, at: 0 };
      } else {
        this.recoil = 1;
        this.muzzleT = 0.06;
        game.casing(h.x, h.y, angle);
      }
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

  // Daño continuo del veneno: no da invulnerabilidad ni retroceso
  poison(amount, game, color = '#9be33b') {
    if (this.dead) return;
    amount = this.absorb(amount * this.stats.damageTaken);
    this.hp -= amount;
    this.poisonAcc = (this.poisonAcc || 0) + amount;
    if (this.poisonAcc >= 2) {
      game.floatText(this.x + rand(-6, 6), this.y - 40, `-${Math.round(this.poisonAcc)}`, color, 18);
      game.puff(this.x + rand(-10, 10), this.y + 8, color);
      this.poisonAcc = 0;
      sfx.sizzle();
    }
    if (this.hp <= 0) {
      this.hp = 0;
      game.onPlayerDeath();
    }
  }

  // Acero: mientras quede escudo, para la mitad de cada golpe. Devuelve el daño que sí llega a la vida.
  absorb(dmg) {
    if (!(this.shield > 0)) return dmg;
    const parado = Math.min(this.shield, dmg / 2);
    this.shield -= parado;
    return dmg - parado;
  }

  hurt(dmg, game) {
    if (this.invuln > 0 || this.dead) return;
    const s = this.stats;
    // Reflejos: cada pocos segundos, un golpe se esquiva solo
    if (s.autoDodge && this.dodgeT <= 0) {
      this.dodgeT = s.autoDodge;
      this.invuln = 0.5;
      game.floatText(this.x, this.y - this.r - 10, '¡Esquivado!', '#9fe8ff', 20);
      sfx.dash();
      return;
    }
    dmg = Math.max(1, Math.round(dmg * s.damageTaken) - s.armor); // el casco y Durito reducen el daño
    dmg = Math.max(1, Math.round(this.absorb(dmg)));
    this.hp -= dmg;
    this.invuln = 0.9;
    this.hurtT = 0.12;
    game.shake(9);
    game.hurtFlash = 0.35;
    game.floatText(this.x, this.y - this.r - 10, `-${dmg}`, '#ff5d73', 22);
    sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      game.onPlayerDeath();
    }
  }

  draw(ctx, game) {
    const { x, y } = this;

    // Indicador de recarga de la esquiva (arco bajo los pies)
    if (this.dashCd > 0) {
      ctx.beginPath();
      ctx.ellipse(x, y + 15, 19, 7, 0, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - this.dashCd / this.stats.dashCd));
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Estela de la esquiva: copias de Johnny tal y como estaba, teñidas de azul y cada vez más transparentes
    for (const g of this.ghosts) {
      drawSprite(ctx, g.sprite, g.anim, g.dir, g.t, g.x, g.y,
        { frame: g.frame, cycle: g.cycle, alpha: 0.7 * (g.life / GHOST_LIFE), tint: GHOST_TINT });
    }

    ctx.save();
    if (this.invuln > 0 && this.dashT <= 0 && Math.floor(this.invuln * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    // pixel art: si el arma tiene su propia hoja (Johnny con ella en la mano), el arma y el golpe ya van
    // en el dibujo y no hace falta pintar el brazo ni la estela por encima
    const armed = this.weapon.sprite && hasSprite(this.weapon.sprite) ? this.weapon.sprite : null;
    if (!armed) this.drawSwingTrail(ctx);
    const a = this.armAngle;
    const behind = Math.sin(a) < -0.3; // si apunta hacia arriba, el arma va detrás del cuerpo
    if (behind && !armed) this.drawArm(ctx, a);
    const sp = Math.hypot(this.vx, this.vy);
    // pixel art: sprite del conserje (los pies van 16 unidades por debajo del centro)
    const sprite = armed || 'conserje-48';
    if (hasSprite(sprite)) pixelShadow(ctx, x, y + 16, 38);
    const walking = sp > 20 && (!armed || animFrames(armed, 'walk') > 0);
    const hitting = armed && this.atkAnim ? animFrames(armed, 'attack') : 0;
    const dir = dirFromVector(this.lookX, this.lookY), now = game ? game.time : 0;
    let anim = walking ? 'walk' : 'idle', frame, cycle = walking ? (this.stepT || 0) / STEP : undefined;
    // disparar andando: si la hoja trae los efectos del disparo aparte ("fx": fogonazo, humo y casquillo),
    // Johnny sigue andando entero, de una pieza, y los efectos se pintan encima
    let fx, kx = 0, ky = 0;
    if (hitting) {
      frame = Math.floor((this.atkAnim.t / this.atkAnim.dur) * hitting);
      if (walking && animFrames(armed, 'fx') > 0) {
        fx = frame; frame = undefined;
        // como andando no se ve el retroceso de los brazos, el disparo empuja a Johnny entero un poquito
        // hacia atrás (en contra de donde apunta) y vuelve enseguida. La escopeta empuja más
        const k = Math.max(0, 1 - this.atkAnim.t / KICK_T) * (this.weapon.pellets > 1 ? KICK * 1.6 : KICK);
        kx = -this.lookX * k; ky = -this.lookY * k;
      }
      else { anim = 'attack'; cycle = undefined; }
    }
    // apunta cómo va Johnny para dejar una copia en la estela
    if (this.dashT > 0 && (this.ghostAt < 0 || now - this.ghostAt >= GHOST_EVERY)) {
      this.ghostAt = now;
      this.ghosts.push({ sprite, anim, dir, t: now, frame, cycle, x: x + kx, y: y + 16 + ky, life: GHOST_LIFE });
    }
    // Estirón: mientras esquiva se alarga en la dirección en la que va; al frenar se aplasta un instante
    const st = this.dashT > 0 ? DASH_STRETCH : this.landT > 0 ? -LAND_SQUASH * (this.landT / LAND_T) : 0;
    if (st) {
      const ang = Math.atan2(this.dashY, this.dashX);
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.scale(1 + st, 1 - st * 0.7);
      ctx.rotate(-ang);
      ctx.translate(-x, -y);
    }
    const sprited = drawSprite(ctx, sprite, anim, dir, now, x + kx, y + 16 + ky,
      { flash: this.hurtT > 0, tint: tinteEstado(this, now), frame, cycle });
    if (sprited && fx !== undefined) drawSprite(ctx, sprite, 'fx', dir, now, x + kx, y + 16 + ky, { frame: fx });
    if (!sprited) drawHuman(ctx, x, y, {
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
    if (!behind && !armed) this.drawArm(ctx, a);
    ctx.restore();
  }

  drawArm(ctx, a) {
    const h = this.handPos(a);
    drawHeld(ctx, this.weapon, h.x, h.y, a, {
      skin: PLAYER_LOOK.skin,
      recoil: this.recoil,
      muzzle: this.muzzleT > 0,
      flash: this.hurtT > 0,
    });
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
// `def` es uno de los supervivientes de config.js. Su habilidad (`def.ability`)
// decide qué hace: disparar (policía, militar) o curar (médica).
const ALLY_S = 0.82; // escala del dibujo de los compañeros

export class Ally {
  constructor(def, x, y) {
    this.def = def;
    this.ab = def.ability;
    this.color = def.color;
    this.x = x; this.y = y;
    this.r = 14;
    this.vx = 0; this.vy = 0;
    this.idx = 0;
    this.lookX = 0; this.lookY = 1;
    this.walkT = rand(0, 6);
    this.abT = rand(0.4, this.ab.every); // tiempo hasta usar la habilidad
    this.burstLeft = 0;                  // balas que quedan de la ráfaga
    this.burstT = 0;
    this.aimAngle = Math.PI / 2;
    this.recoil = 0;
    this.muzzleT = 0;
    this.healFx = 0;                     // destello de curación
    this.weapon = this.ab.weapon === 'rifle' ? RIFLE : this.ab.weapon ? WEAPONS[this.ab.weapon] : null;
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
    if (sp > 20) {
      this.lookX = this.vx / sp; this.lookY = this.vy / sp;
      this.aimAngle = Math.atan2(this.lookY, this.lookX);
    }
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.muzzleT -= dt;
    this.healFx -= dt;

    if (game.state !== 'playing') return;
    const ab = this.ab;
    this.abT -= dt;
    if (ab.kind === 'shoot') {
      const target = game.nearestEnemy(this.x, this.y, 400);
      if (target) {
        this.aimAngle = Math.atan2(target.y - this.y, target.x - this.x);
        this.lookX = Math.cos(this.aimAngle); this.lookY = Math.sin(this.aimAngle);
        if (this.abT <= 0 && this.burstLeft === 0) {
          this.burstLeft = ab.burst;
          this.burstT = 0;
          this.abT = ab.every;
        }
      }
      if (this.burstLeft > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          if (target) this.fire(game);
          this.burstLeft--;
          this.burstT = ab.gap || 0;
        }
      }
    } else if (ab.kind === 'heal') {
      if (this.abT <= 0) {
        this.abT = ab.every;
        if (!p.dead && p.hp < game.stats.maxHp) this.heal(game, ab.amount);
      }
    }
  }

  fire(game) {
    const a = this.aimAngle;
    const h = this.handPos(a);
    game.fireVolley(this, a, {
      dmg: this.ab.dmg * game.stats.teamDamage,
      color: this.color,
      r: 6,
      speed: 620,
      jitter: this.ab.burst > 1 ? 0.08 : 0,
      x: h.x + Math.cos(a) * this.weapon.muzzle * ALLY_S,
      y: h.y + Math.sin(a) * this.weapon.muzzle * ALLY_S,
    });
    this.recoil = 1;
    this.muzzleT = 0.05;
    game.casing(h.x, h.y, a);
    sfx.allyGun();
  }

  heal(game, amount) {
    game.healPlayer(amount);
    this.healFx = 0.45;
    sfx.heal();
    const p = game.player;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      game.particles.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 12, vx: Math.cos(a) * 40, vy: -rand(40, 90), r: rand(3, 5), color: '#80ed99', life: 0.6, max: 0.6, outline: true });
    }
  }

  // El juego avisa a cada compañero cuando se limpia una sala
  onRoomCleared(game) {
    const p = game.player;
    if (this.ab.onClear && !p.dead && p.hp < game.stats.maxHp) this.heal(game, this.ab.onClear);
  }

  handPos(a) {
    return { x: this.x + Math.cos(a) * 11, y: this.y + 2 + Math.sin(a) * 7.5 };
  }

  draw(ctx, game) {
    // rayo de curación de la médica
    if (this.healFx > 0 && game) {
      const p = game.player;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.healFx / 0.2);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - 10);
      ctx.lineTo(p.x, p.y - 10);
      ctx.lineCap = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(128, 237, 153, 0.5)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y + 4, 26 + (0.45 - this.healFx) * 30, 0, TAU);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#80ed99';
      ctx.stroke();
      ctx.restore();
    }

    const sp = Math.hypot(this.vx, this.vy);
    const a = this.aimAngle;
    const behind = this.weapon && Math.sin(a) < -0.3;
    if (behind) this.drawArm(ctx, a);
    drawHuman(ctx, this.x, this.y, {
      ...this.def.look,
      s: ALLY_S,
      lookX: this.lookX,
      lookY: this.lookY,
      moveX: sp > 1 ? this.vx / sp : 0,
      moveY: sp > 1 ? this.vy / sp : 0,
      moving: Math.min(1, sp / 150),
      walk: this.walkT,
      hideHand: this.weapon ? 1 : 0,
    });
    if (this.weapon && !behind) this.drawArm(ctx, a);
  }

  drawArm(ctx, a) {
    const h = this.handPos(a);
    drawHeld(ctx, this.weapon, h.x, h.y, a, { skin: this.def.look.skin, recoil: this.recoil, muzzle: this.muzzleT > 0, scale: ALLY_S });
  }
}

// Aviso en el suelo antes de que aparezca un enemigo (k = 0..1 de progreso)
export function drawSpawnWarning(ctx, x, y, r, k, time) {
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -time * 30;
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
}
