// ─────────────────────────────────────────────
//  El mapa visto desde la partida: choques con muros y muebles, la niebla de las habitaciones de
//  un apartamento y lo que ven y oyen los zombis (cuándo despiertan, cómo llegan hasta Johnny).
//
//  Son métodos de Game: game.js los añade a la clase, así que dentro "this" es la partida.
// ─────────────────────────────────────────────
import { WALL } from './config.js';
import { rand, clamp, dist, pushOut } from './utils.js';
import { CELL, lineClear, wayTo } from './shapes.js';

const NOTICE = 330;        // a qué distancia nota un zombi dormido al conserje, si lo ve
const ALERT = 170;         // un zombi que despierta despierta a los que tiene así de cerca
const NOISE = 430;         // hasta dónde se oye un disparo (despierta aunque haya tabiques)

export class GameMap {
  collideWorld(ent) {
    ent.x = clamp(ent.x, WALL + ent.r, this.rw - WALL - ent.r);
    ent.y = clamp(ent.y, WALL + ent.r, this.rh - WALL - ent.r);
    for (const b of this.room.layout.blocks) pushOut(ent, b); // tabiques de los apartamentos
    for (const o of this.room.layout.obstacles) pushOut(ent, o);
    for (const pr of this.room.props) if (pr.solid) pushOut(ent, pr.choque || pr); // `choque`: si lo que choca no es lo que se dibuja
  }

  // Hacia dónde tiene que andar un enemigo para llegar al jugador rodeando muros y muebles
  // (null si puede ir en línea recta, que es lo normal)
  wayTo(ent) {
    return wayTo(this.room.layout, ent, this.player);
  }

  // ¿Ve este enemigo al conserje, o hay un tabique en medio?
  sees(ent) {
    return lineClear(this.room.layout, ent.x, ent.y, this.player.x, this.player.y);
  }

  // ═════════════ Habitaciones de un apartamento ═════════════

  // En qué habitación del apartamento cae un punto (null en un tabique, en el hueco de una puerta
  // o en un mapa sin habitaciones)
  zoneAt(x, y) {
    const l = this.room.layout;
    if (!l.zones) return null;
    return l.zones[l.owner[Math.floor(y / CELL) * l.cols + Math.floor(x / CELL)]] || null;
  }

  // ¿Está esto en una habitación que aún no se ha pisado? (entonces ni se dibuja ni se le apunta)
  hidden(ent) {
    if (ent.siempreVisible) return false; // la puerta del baño del superviviente: se ve aunque el baño esté a oscuras
    const z = this.zoneAt(ent.x, ent.y);
    return !!z && z.fog > 0.5;
  }

  // Descubre la habitación en la que está el conserje y, si está en una puerta o pegado a ella,
  // las dos que comunica; y va aclarando las descubiertas
  updateFog(dt) {
    const l = this.room && this.room.layout;
    if (!l || !l.zones) return;
    const p = this.player;
    const c = Math.floor(p.x / CELL), r = Math.floor(p.y / CELL);
    const here = l.zones[l.owner[r * l.cols + c]];
    if (here) here.seen = true;
    for (const d of l.inner) {
      if (d.locked) continue; // la puerta del baño del superviviente, cerrada: no se ve lo de dentro
      if (c >= d.c - 1 && c <= d.c + d.w && r >= d.r - 1 && r <= d.r + d.h) l.zones[d.a].seen = l.zones[d.b].seen = true;
    }
    for (const z of l.zones) if (z.seen && z.fog > 0) z.fog = Math.max(0, z.fog - dt * 3.5);
  }

  // ¿Nota este zombi dormido al conserje? Si entra en su habitación, o si lo ve de cerca
  notices(z) {
    const p = this.player;
    if (p.dead) return false;
    const zone = this.zoneAt(p.x, p.y);
    if (zone && zone.id === z.zone) return true;
    return dist(z, p) < NOTICE && this.sees(z);
  }

  // Un zombi que despierta arrastra a los dormidos que tiene cerca y a la vista (con un pequeño retraso)
  wakeNear(z) {
    for (const e of this.enemies) {
      if (e !== z && e.asleep && dist(e, z) < ALERT && lineClear(this.room.layout, e.x, e.y, z.x, z.y)) this.later(rand(0.15, 0.4), () => e.wake(this));
    }
  }

  // Un ruido fuerte (un disparo) despierta a los dormidos que haya cerca, aunque no vean nada
  noise(x, y, radius = NOISE) {
    for (const e of this.enemies) if (e.asleep && Math.hypot(e.x - x, e.y - y) < radius) this.later(rand(0.1, 0.5), () => e.wake(this));
  }
}
