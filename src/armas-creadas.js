// ─────────────────────────────────────────────
//  Armas creadas cuerpo a cuerpo (fase D1 del plan de combinar: claude/plan-combinar.md)
//
//  Cada arma creada es su arma base (fregona, bate o cuchillo, de weapons.js) con algunos números cambiados y
//  un efecto al golpear. Hasta que tengan sprite propio, Johnny usa la hoja del arma base y encima le salen
//  unas partículas (`detalle`) que dicen qué arma lleva.
//
//  Campos de CREADAS (números provisionales):
//    base       arma de la que toma el dibujo y los números que no se cambian
//    reach, arc, rate, knock   como en weapons.js (alcance, abanico en grados, golpes/s, empuje)
//    efecto     lo que hace al golpear (ver EFECTOS)
//    detalle    color de las partículas junto al arma · sube: true si suben (fuego), si no caen (gotas)
// ─────────────────────────────────────────────
import { WEAPONS } from './weapons.js';
import { rand, dist } from './utils.js';
import { sfx } from './sfx.js';

export const CREADAS = {
  lanza: { base: 'fregona', reach: 96, arc: 35, detalle: '#dfe4ef' },                     // estocada que atraviesa
  aplastacabezas: { base: 'bate', knock: 3, efecto: 'aturde', detalle: '#9a9aa8' },
  bateFuego: { base: 'bate', efecto: 'fuego', detalle: '#ff9f1c', sube: true },
  partecuerpos: { base: 'bate', arc: 170, efecto: 'sangra', detalle: '#c0392b' },
  inmovilizadora: { base: 'bate', efecto: 'descarga', detalle: '#9fe8ff', sube: true },
  latigo: { base: 'cuchillo', reach: 110, arc: 50, efecto: 'veneno', detalle: '#9be564' },
  supermaza: { base: 'fregona', rate: 0.8, arc: 360, knock: 2.5, efecto: 'circulo', detalle: '#8a8a9a' },
};

// Números de los efectos (provisionales)
export const EFECTOS = {
  aturde: 0.6,                                  // segundos aturdido (el aplastacabezas)
  fuego: 3,                                     // segundos ardiendo (el bate de fuego; quema como el molotov)
  sangra: { t: 3, total: 0.6, color: '#ff4d6d' }, // dura 3 s y quita en total el 60 % del golpe
  veneno: { t: 4, total: 1, color: '#9be564' },   // dura 4 s y quita en total otro golpe entero
  descarga: { aturde: 1, salto: 130, dano: 0.5 }, // aturde 1 s y salta al zombi más cercano con medio daño
  tick: 0.5,                                    // cada cuánto se quitan los pellizcos de sangrar y veneno
};

// El arma que se pone en la mano a partir de la que guarda el inventario (crearArma de recetas.js).
// `creada` la distingue de las de la tienda; `ico` es el icono del HUD (el del arma base)
export function armaDeCreada(a) {
  const c = CREADAS[a.receta];
  const base = WEAPONS[c.base];
  return {
    ...base, ...c,
    id: a.receta, name: a.nombre, ico: base.id, creada: a, damage: a.damage,
    price: undefined, stash: undefined,
  };
}

export class ArmasCreadasMethods {
  // Lo que hace un arma creada al golpear a un enemigo (lo llama meleeHit de game-combate.js)
  efectoGolpe(e, w, dmg) {
    if (e.dead) return;
    switch (w.efecto) {
      case 'aturde': this.aturdir(e, EFECTOS.aturde); break;
      case 'fuego': if (e.burn) e.burnT = Math.max(e.burnT, EFECTOS.fuego); break; // los jefes no arden
      case 'sangra': this.herir(e, 'sangra', dmg); break;
      case 'veneno': this.herir(e, 'veneno', dmg); break;
      case 'descarga': {
        this.aturdir(e, EFECTOS.descarga.aturde);
        // salta al zombi más cercano
        let otro = null, mejor = EFECTOS.descarga.salto;
        for (const o of this.enemies) {
          if (o === e || !o.active || o.dead) continue;
          const d = dist(o, e);
          if (d < mejor) { mejor = d; otro = o; }
        }
        if (otro) {
          this.rayo(e.x, e.y - 20, otro.x, otro.y - 20);
          otro.hurt(dmg * EFECTOS.descarga.dano, false, 0, 0, this, 0);
          this.aturdir(otro, EFECTOS.descarga.aturde);
        }
        break;
      }
    }
  }

  // Aturde a un zombi (se queda quieto echando chispitas amarillas, como con la mutación Tentacular). Los jefes no
  aturdir(e, t) {
    if (e.isBoss || e.dead) return;
    e.stunT = Math.max(e.stunT || 0, t);
  }

  // Sangrar o veneno: quita `total` del golpe poco a poco durante `t` segundos (se renueva con cada golpe)
  herir(e, tipo, dmg) {
    const ef = EFECTOS[tipo];
    e.heridas = e.heridas || {};
    e.heridas[tipo] = { t: ef.t, dps: (dmg * ef.total) / ef.t, tick: 0 };
  }

  // Rayo de la descarga: una línea en zigzag de puntitos azules
  rayo(x1, y1, x2, y2) {
    const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 8));
    for (let i = 0; i <= n; i++) {
      const k = i / n, lado = i % 2 ? 1 : -1;
      this.particles.push({ x: x1 + (x2 - x1) * k + lado * rand(2, 6), y: y1 + (y2 - y1) * k + lado * rand(2, 6),
        vx: 0, vy: 0, px: true, size: 3, color: i % 3 ? '#9fe8ff' : '#ffffff', life: 0.2, max: 0.2 });
    }
    sfx.click();
  }

  // Cada fotograma: los pellizcos de sangrar y veneno, y las partículas del arma creada en la mano de Johnny
  actualizarArmasCreadas(dt) {
    for (const e of this.enemies) {
      if (!e.heridas || e.dead) continue;
      for (const tipo of Object.keys(e.heridas)) {
        const h = e.heridas[tipo], ef = EFECTOS[tipo];
        h.t -= dt; h.tick += dt;
        if (Math.random() < 6 * dt) {   // gotitas que caen
          this.particles.push({ x: e.x + rand(-10, 10), y: e.y - 20 * (e.s || 1), vx: rand(-15, 15), vy: rand(20, 50), px: true, size: 2, color: ef.color, life: 0.4, max: 0.4 });
        }
        if (h.tick >= EFECTOS.tick) {
          h.tick -= EFECTOS.tick;
          const d = h.dps * EFECTOS.tick;
          if (!e.invulnerable) {
            e.hp -= d;
            e.hitFlash = 0.05;
            this.floatText(e.x + rand(-8, 8), e.y - 38 * (e.s || 1), String(Math.round(d)), ef.color, 16);
            if (e.hp <= 0) { e.hp = 0; this.killEnemy(e); break; }
          }
        }
        if (h.t <= 0) delete e.heridas[tipo];
      }
    }
    // el detalle del arma: partículas en la punta, más o menos donde la lleva el dibujo
    const p = this.player, w = p.slots.melee;
    if (!w?.creada || p.hand !== 'melee' || p.dead || Math.random() > 14 * dt) return;
    const lx = p.lookX || 0, ly = p.lookY || 1;
    this.particles.push({
      x: p.x + lx * 26 + rand(-5, 5), y: p.y - 4 + ly * 16 + rand(-5, 5),
      vx: rand(-12, 12), vy: w.sube ? rand(-55, -30) : rand(20, 45), px: true, size: 2, color: w.detalle, life: 0.35, max: 0.35,
    });
  }
}
