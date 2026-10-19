// ─────────────────────────────────────────────
//  El superviviente de la partida: en cada partida sale uno de los tres (config.js, SURVIVORS),
//  en una planta al azar (nunca la última), escondido en el baño de un apartamento con la puerta
//  cerrada. Grita "¡Socorro!" de vez en cuando para que se sepa dónde está; al limpiar el piso se
//  abre la puerta del baño y se le puede rescatar.
//  Son métodos de Game (se añaden en game.js con addMethods).
// ─────────────────────────────────────────────
import { SURVIVORS } from './config.js';
import { rand, randInt, pick } from './utils.js';
import { SurvivorNPC, PuertaBano } from './props.js';
import { sfx } from './sfx.js';

// Lo que grita desde dentro del baño
const GRITOS = ['¡Socorro!', '¡Aquí dentro!', '¡Ayuda, por favor!', '¡Que alguien me saque!', '¡Estoy en el baño!'];
// Cada cuánto grita (segundos, al azar entre los dos)
const CADA = [2.2, 3.4];

export class SupervivienteMethods {
  // Al empezar la partida: quién sale y en qué planta. En el modo pruebas, siempre en la planta baja
  elegirSuperviviente() {
    const floors = this.building.floors;
    const pruebas = new URLSearchParams(location.search).has('pruebas');
    this.rescate = {
      def: pick(Object.values(SURVIVORS)),
      planta: pruebas || floors <= 1 ? 1 : randInt(1, floors - 1),
    };
  }

  // Al generar cada planta: si le toca a esta, se mete en su baño y se cierra la puerta
  colocarSuperviviente() {
    const s = this.floor.survivor;
    if (!s || !this.rescate || this.rescate.planta !== this.floorNum) return;
    const npc = new SurvivorNPC(this.rescate.def);
    npc.x = s.x; npc.y = s.y;
    const puerta = new PuertaBano(s.door);
    s.room.props.push(npc, puerta);
    // floor.sos: lo que hace falta para avisar de dónde está; se borra al rescatarlo
    this.floor.sos = { room: s.room, zone: s.zone, def: this.rescate.def, npc, puerta };
    this.socorroT = 1;
  }

  // Cada fotograma: la puerta se abre poco a poco y, mientras sigue cerrada, él grita y da golpes.
  // Se le oye desde su apartamento (sale de la puerta del baño) y desde el pasillo (sale de la puerta del piso)
  actualizarSocorro(dt) {
    const sos = this.floor && this.floor.sos;
    if (!sos) return;
    const puerta = sos.puerta;
    puerta.knockT -= dt;
    if (!puerta.solid) { puerta.open = Math.min(1, puerta.open + dt * 2.5); return; }
    // al entrar en una sala desde donde se le oye, el primer grito llega enseguida
    if (this.room !== this.salaSocorro) { this.salaSocorro = this.room; this.socorroT = Math.min(this.socorroT, 0.8); }
    this.socorroT -= dt;
    if (this.socorroT > 0) return;
    this.socorroT = rand(CADA[0], CADA[1]);
    let at = null, size = 18;
    if (this.room === sos.room) {
      at = { x: puerta.x, y: puerta.y - 70 };
      puerta.knockT = 0.45;
      sfx.socorro();
    } else if (this.room === this.floor.corridor) {
      const ex = this.room.exits.find((e) => e.to === sos.room);
      if (ex) { at = { x: ex.x, y: ex.y + (ex.dir === 'up' ? 40 : -40) }; size = 15; sfx.socorroLejos(); }
    }
    if (!at) return;
    this.socorroGritoT = this.time;
    // como floatText, pero dura más y sube más despacio (que dé tiempo a leerlo)
    this.texts.push({ x: at.x + rand(-14, 14), y: at.y, text: pick(GRITOS), color: '#ff8a8a', size, t: 0, life: 1.8, vy: -28 });
  }

  // El piso del superviviente queda limpio: se abre la puerta del baño y se ve lo que hay dentro
  abrirBano() {
    const sos = this.floor.sos;
    if (!sos || this.room !== sos.room || !sos.puerta.solid) return;
    sos.puerta.abrir();
    sos.zone.seen = true;
    this.later(0.5, () => {
      sfx.door();
      this.floatText(sos.npc.x, sos.npc.y - 60, '¡Gracias! ¡Sácame de aquí!', '#ffd23f', 18);
    });
  }

  // Se une al equipo: ya no hace falta avisar de dónde está
  superviventeRescatado() {
    if (this.floor.sos) this.floor.sos = null;
  }
}
