// ─────────────────────────────────────────────
//  Mutaciones: mejoras que solo duran una partida
//
//  Al matar a un mini jefe, un segundo después de que su cuerpo caiga al suelo, el juego se pausa y sale
//  un recuadro: "La exposición prolongada al virus hace que te sientas... ¡DIFERENTE!" con dos mutaciones
//  al azar para elegir una. Hay 4 mini jefes por edificio, así que como mucho se juntan 4, y nunca se
//  repite una que ya tengas. Se pierden al acabar la partida (ganes o caigas): no van al guardado.
//
//  Cada mutación tiene la misma ficha que un talento:
//    aplica(s):        lo que cambia en los atributos de Johnny (upgrades.js, baseStats), si es un número
//    cada:             segundos entre una vez y la siguiente, si hace algo ella sola cada poco
//    accion(game, p):  lo que hace cada `cada` segundos (los números, en MUT)
//  Lo demás lo leen otros archivos de los atributos: Caníbal en game-combate.js (killEnemy), Ansiedad en
//  entities.js (attack) y el escudo de Endurecimiento en game.js (startFloor).
//
//  Los zombis aturdidos (stunT) se quedan quietos y los desorientados (lioT) dan vueltas sin rumbo: en los
//  dos casos no hacen daño (zombies.js y game.js). A los jefes no les afecta nada de esto.
//  Los iconos son provisionales: reutilizan los del HUD.
// ─────────────────────────────────────────────
import { dist } from './utils.js';
import { sfx } from './sfx.js';
import { clearInput } from './input.js';
import { loadSave } from './save.js';
import { baseStats } from './upgrades.js';
import { aplicarTalentos } from './talentos.js';

// Los números de cada una (provisionales)
export const MUT = {
  tentacular: { cada: 4, radio: 90, empuje: 1500, aturde: 1 }, // empuje 1500 ≈ los manda a unos 150 de distancia
  gastro: { cada: 3, radio: 55, dps: 8, dura: 4, alcance: 420 }, // alcance: hasta dónde busca a quién vomitarle
  insensible: { dano: 0.5 },
  canibal: { cura: 0.05 },
  ansiedad: { porZombi: 0.05, max: 10 },
  endurecimiento: { escudo: 80 },
  locura: { cada: 5, radio: 140, lio: 2 },
  flatulento: { cada: 3, radio: 70, dps: 10, paraliza: 2 },
};

// Zombis (no jefes) que están a menos de `r` de Johnny
const cerca = (game, p, r) => game.enemies.filter((e) => e.active && !e.isBoss && dist(e, p) < r + e.r);

// Anillo que se abre desde Johnny: así se ve el alcance de lo que acaba de hacer
function anillo(game, p, r, color) {
  game.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: r * 0.6, ring: true, color, life: 0.3, max: 0.3 });
}

export const MUTACIONES = [
  { id: 'tentacular', nombre: 'Tentacular', icono: 'dash',
    desc: 'Cada 4 s te sale un tentáculo del pecho que aparta a los zombis de alrededor y los aturde 1 s',
    cada: MUT.tentacular.cada,
    accion(game, p) {
      const m = MUT.tentacular;
      const zs = cerca(game, p, m.radio);
      if (!zs.length) return false; // sin nadie cerca no gasta el golpe: lo intenta en el siguiente fotograma
      for (const e of zs) {
        const d = dist(e, p) || 1;
        e.kx += ((e.x - p.x) / d) * m.empuje;
        e.ky += ((e.y - p.y) / d) * m.empuje;
        e.stunT = Math.max(e.stunT || 0, m.aturde);
      }
      anillo(game, p, m.radio, '#b5179e');
      sfx.whip();
      game.shake(4);
      return true;
    } },
  { id: 'gastro', nombre: 'Gastroenteritis', icono: 'molotov',
    desc: 'Cada 3 s le lanzas un vómito de ácido al zombi más cercano: deja un charco que quema a los zombis que lo pisan',
    cada: MUT.gastro.cada,
    accion(game, p) {
      // el zombi (o jefe) más cercano; sin nadie a tiro no gasta el vómito: lo intenta en el siguiente fotograma
      let obj = null, mejor = MUT.gastro.alcance;
      for (const e of game.enemies) {
        if (!e.active || e.dead) continue;
        const d = dist(e, p);
        if (d < mejor) { mejor = d; obj = e; }
      }
      if (!obj) return false;
      game.lanzarVomito(p.x, p.y - 10, obj.x, obj.y + obj.r * 0.5);
      return true;
    } },
  { id: 'insensible', nombre: 'Insensible', icono: 'casco',
    desc: 'Pierdes la sensibilidad del cuerpo: recibes la mitad de daño',
    aplica: (s) => { s.damageTaken *= MUT.insensible.dano; } },
  { id: 'canibal', nombre: 'Caníbal', icono: 'corazon',
    desc: 'Cada zombi que matas te cura un 5 % de la vida',
    aplica: (s) => { s.canibal = MUT.canibal.cura; } },
  { id: 'ansiedad', nombre: 'Ansiedad', icono: 'cafe',
    desc: 'Golpeas más rápido cuerpo a cuerpo cuantos más zombis tengas a la vista (+5 % cada uno, hasta +50 %)',
    aplica: (s) => { s.ansiedad = true; } },
  { id: 'endurecimiento', nombre: 'Endurecimiento', icono: 'policia',
    desc: 'La piel se endurece: escudo de 80 en cada planta que para la mitad de cada golpe hasta gastarse',
    aplica: (s) => { s.mutShield = MUT.endurecimiento.escudo; } },
  { id: 'locura', nombre: 'Locura', icono: 'jefe',
    desc: 'Cada 5 s gritas tan fuerte que los zombis de alrededor se desorientan 2 s',
    cada: MUT.locura.cada,
    accion(game, p) {
      const m = MUT.locura;
      const zs = cerca(game, p, m.radio);
      if (!zs.length) return false; // solo grita si hay zombis cerca
      for (const e of zs) e.lioT = Math.max(e.lioT || 0, m.lio);
      anillo(game, p, m.radio, '#ffd23f');
      game.floatText(p.x, p.y - 70, '¡AAAAAH!', '#ffd23f', 20);
      sfx.roar();
      return true;
    } },
  { id: 'flatulento', nombre: 'Flatulento', icono: 'herramientas',
    desc: 'Cada 3 s sueltas gases corrosivos que queman y paralizan 2 s a los zombis cercanos',
    cada: MUT.flatulento.cada,
    accion(game, p) {
      const m = MUT.flatulento;
      const zs = cerca(game, p, m.radio);
      if (!zs.length) return false; // solo con zombis cerca
      for (const e of zs) {
        e.stunT = Math.max(e.stunT || 0, m.paraliza);
        // el daño va como un estado (estados.js, "gases"): lo quita poco a poco mientras dura
        const est = e.estados || (e.estados = {});
        est.gases = { t: m.paraliza, max: m.paraliza, dps: m.dps, resbala: 0, color: '#b5c94a' };
      }
      game.gases(p.x, p.y + 8, m.radio);
      return true;
    } },
];

export const mutacion = (id) => MUTACIONES.find((m) => m.id === id);

// Cuántas se pueden juntar en una partida (una por mini jefe)
export const MAX_MUTACIONES = 4;

// Dos al azar entre las que aún no tienes
export function sortearMutaciones(tengo, n = 2) {
  const quedan = MUTACIONES.filter((m) => !tengo.includes(m.id));
  for (let i = quedan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [quedan[i], quedan[j]] = [quedan[j], quedan[i]];
  }
  return quedan.slice(0, n);
}

// Aplica las mutaciones de la partida a los atributos (después de los talentos)
export function aplicarMutaciones(stats, ids = []) {
  for (const id of ids) mutacion(id)?.aplica?.(stats);
  return stats;
}

// Una vez por fotograma: las que actúan solas cada pocos segundos (p.mutT lleva la cuenta de cada una)
export function actualizarMutaciones(game, p, dt) {
  if (p.dead || !game.mutaciones?.length) return;
  const t = p.mutT || (p.mutT = {});
  for (const id of game.mutaciones) {
    const m = mutacion(id);
    if (!m.cada) continue;
    t[id] = (t[id] ?? m.cada) - dt;
    if (t[id] > 0) continue;
    if (m.accion(game, p)) t[id] = m.cada;
    else t[id] = 0;
  }
}

// ═════════════ El recuadro de elegir (métodos de Game: game.js los añade a la clase) ═════════════
export class MutacionMethods {
  // Tras caer un mini jefe: pausa y enseña dos mutaciones para elegir una (si quedan y no llevas ya 4)
  openMutacion() {
    if (this.state !== 'playing' || this.player.dead || this.mutaciones.length >= MAX_MUTACIONES) return;
    const opciones = sortearMutaciones(this.mutaciones);
    if (!opciones.length) return;
    // si en ese momento hay otra pantalla abierta (la pausa), se espera a que se cierre
    if (this.paused) { this.later(0.3, () => this.openMutacion()); return; }
    this.paused = true;
    this.mutOpen = true;
    clearInput();
    sfx.roar();
    this.shake(8);
    this.ui.showMutacion(opciones, this.mutaciones.length, (id) => this.elegirMutacion(id));
  }

  elegirMutacion(id) {
    if (!this.mutOpen || this.mutaciones.includes(id)) return;
    const m = mutacion(id);
    this.mutOpen = false;
    this.mutaciones.push(id);
    // los atributos se rehacen enteros: talentos + mutaciones (el mismo objeto: Johnny lo lleva enlazado)
    const antes = this.stats.mutShield || 0;
    Object.assign(this.stats, aplicarMutaciones(aplicarTalentos(baseStats(), loadSave().talentos), this.mutaciones));
    // Endurecimiento: el escudo ya, sin esperar a la siguiente planta
    if (this.stats.mutShield > antes) this.player.shield = (this.player.shield || 0) + this.stats.mutShield - antes;
    this.paused = false;
    this.ui.hide();
    clearInput();
    sfx.buy();
    const p = this.player;
    this.burst(p.x, p.y, '#b5179e', 20, p.r);
    this.banner = { title: `¡${m.nombre}!`, sub: m.desc, t: 0 };
  }
}
