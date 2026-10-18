// ─────────────────────────────────────────────
//  Granada: la segunda arrojadiza de Johnny
//
//  Comparte botón con el molotov (clic derecho / E / botón táctil / RT): se cambia de una a otra con F
//  (o LB en el mando, o el botón pequeño del móvil). Se apunta igual; al soltar, Johnny la lanza.
//  Vuela en parábola, bota una vez, rueda un poco, parpadea en rojo (cada vez más deprisa) y a los 2 s
//  explota con `explode` (game-ataques.js): hace daño en un radio, también a Johnny, con temblor,
//  destello de luz y una mancha chamuscada en el suelo.
//
//  Son métodos de Game (como molotov.js): game.js los añade a la clase.
// ─────────────────────────────────────────────
import { WALL, PIXEL } from './config.js';
import { rand, clamp } from './utils.js';
import { drawSprite } from './sprites.js';
import { sfx } from './sfx.js';

// Números de la granada (provisionales, para probar si es divertido)
export const GRANADA = {
  start: 2,       // granadas al empezar la partida
  max: 4,         // las que caben en la mochila
  drop: 0.05,     // probabilidad de que un zombi suelte una al morir
  flight: 0.45,   // segundos hasta tocar el suelo
  fuse: 2,        // segundos desde el lanzamiento hasta que explota
  radius: 110,    // radio de la explosión
  dmg: 80,        // daño en la explosión (a zombis y a Johnny)
  gravity: 1400,  // lo deprisa que cae
  bounce: 0.35,   // cuánta altura conserva al botar
  rebote: 0.35,   // cuánta velocidad en el suelo conserva al botar
  friction: 7,    // lo que frena al rodar
};

export class GranadaMethods {
  get hasGrenade() { return this.testMode || this.granadas > 0; }
  get hasToss() { return this.tossKind === 'granada' ? this.hasGrenade : this.hasMolotov; }

  // Cambia lo que se lanza con el botón de lanzar (molotov ↔ granada)
  switchToss() {
    this.tossKind = this.tossKind === 'granada' ? 'molotov' : 'granada';
    sfx.beep();
  }

  throwGrenade(x, y) {
    const p = this.player;
    if (!this.hasGrenade) {
      this.floatText(p.x, p.y - 54, '¡Sin granadas!', '#9bbd5a', 18);
      sfx.nope();
      return;
    }
    if (!this.testMode) this.granadas--;
    const T = GRANADA.flight, z0 = 20;
    this.grenades.push({
      x: p.x, y: p.y,
      z: z0,
      vx: (x - p.x) / T, vy: (y - p.y) / T,
      vz: (GRANADA.gravity * T * T / 2 - z0) / T,
      fuse: GRANADA.fuse, blink: 0, rojo: false, bounced: false, spin: 0,
    });
    sfx.toss();
  }

  updateGrenades(dt) {
    for (const g of this.grenades) {
      g.fuse -= dt;
      // en el aire: parábola; en el suelo: rueda y se frena
      if (g.z > 0 || g.vz > 0) {
        g.vz -= GRANADA.gravity * dt;
        g.z += g.vz * dt;
        g.spin += dt * 14;
        if (g.z <= 0) {
          g.z = 0;
          if (!g.bounced) {
            g.bounced = true;
            g.vz = -g.vz * GRANADA.bounce;
            g.vx *= GRANADA.rebote; g.vy *= GRANADA.rebote;
          } else g.vz = 0;
        }
      } else {
        const fr = Math.exp(-dt * GRANADA.friction);
        g.vx *= fr; g.vy *= fr;
      }
      g.x += g.vx * dt; g.y += g.vy * dt;
      // rebota en las paredes
      const lo = WALL + 8, hx = this.rw - WALL - 8, hy = this.rh - WALL - 8;
      if (g.x < lo || g.x > hx) { g.x = clamp(g.x, lo, hx); g.vx *= -0.5; }
      if (g.y < lo || g.y > hy) { g.y = clamp(g.y, lo, hy); g.vy *= -0.5; }
      // parpadeo rojo: de uno cada 0,4 s a casi continuo al final
      const k = clamp(1 - g.fuse / GRANADA.fuse, 0, 1);
      g.blink += dt / (0.4 - 0.33 * k * k);
      const rojo = Math.floor(g.blink) % 2 === 1;
      if (rojo && !g.rojo) sfx.beep();
      g.rojo = rojo;
      if (g.fuse <= 0) this.grenadeBoom(g);
    }
    this.grenades = this.grenades.filter((g) => g.fuse > 0);
  }

  // ¡Boom!: la explosión de siempre y, además, una mancha chamuscada en el suelo
  grenadeBoom(g) {
    this.explode(g.x, g.y, GRANADA.radius, GRANADA.dmg, null);
    const decals = this.room && this.room.decals;
    if (!decals) return;
    decals.push({ x: g.x, y: g.y, r: GRANADA.radius * 0.5, color: '#120d0b', seed: rand(0, 6) });
    decals.push({ x: g.x, y: g.y, r: GRANADA.radius * 0.28, color: '#000000', seed: rand(0, 6) });
    this.room.decalCount = (this.room.decalCount || 0) + 1;
    if (decals.length > 60) decals.shift();
  }

  drawGrenades(ctx) {
    for (const g of this.grenades) {
      // sombra en el suelo (más pequeña cuanto más alto)
      const s = 1 - Math.min(0.5, g.z / 200);
      ctx.fillStyle = 'rgba(20,16,40,0.3)';
      ctx.beginPath(); ctx.ellipse(g.x, g.y, 7 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      // en el aire gira; al caer al suelo se queda derecha
      if (g.z > 0) {
        ctx.save();
        ctx.translate(g.x, g.y - g.z);
        ctx.rotate(g.spin);
        drawGranada(ctx, 0, 0, g.rojo);
        ctx.restore();
      } else drawGranada(ctx, g.x, g.y, g.rojo);
    }
  }

  // Mientras se apunta: la zona de la explosión donde caerá
  drawGrenadeAim(ctx, a) {
    const ok = this.hasGrenade;
    const col = ok ? '155, 189, 90' : '170, 170, 170';
    ctx.save();
    ctx.fillStyle = `rgba(${col}, ${0.3 * (0.85 + 0.15 * Math.sin(this.time * 8))})`;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, GRANADA.radius, GRANADA.radius * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = PIXEL;
    ctx.setLineDash([3 * PIXEL, 2 * PIXEL]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.strokeStyle = `rgb(${col})`;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// La granada (para el suelo y el vuelo): el sprite; en rojo cuando le toca parpadear
export function drawGranada(ctx, x, y, rojo = false) {
  drawSprite(ctx, 'objeto-granada', 'idle', 'south', 0, x, y, rojo ? { tint: { color: '#ff1a10', alpha: 0.65 } } : {});
}
