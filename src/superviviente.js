// ─────────────────────────────────────────────
//  El superviviente de la partida: en cada partida sale uno de los tres (config.js, SURVIVORS),
//  en una planta al azar (nunca la última), escondido en el baño de un apartamento con la puerta
//  cerrada. Grita "¡Socorro!" de vez en cuando para que se sepa dónde está; al limpiar el piso se
//  abre la puerta del baño y se le puede rescatar.
//  Fase B, la horda: al ir a salir del piso, la puerta de entrada se cierra de golpe. Él se pone a forzar
//  la cerradura (3 minutos de trabajo) mientras entran zombis por todas las habitaciones, cada vez más y
//  peores. Si el conserje se aleja de él, van a por él; si lo tumban, la cerradura no avanza hasta que el
//  conserje lo levanta (quedarse a su lado). Va avisando de cómo lo lleva y, a mitad, suelta munición.
//  Son métodos de Game (se añaden en game.js con addMethods).
// ─────────────────────────────────────────────
import { SURVIVORS, WALL, OUTLINE } from './config.js';
import { rand, randInt, pick, dist, clamp, obstacleGap } from './utils.js';
import { SurvivorNPC, PuertaBano } from './props.js';
import { sfx, music } from './sfx.js';
import { CELL, isOpen, wayTo } from './shapes.js';
import { outlinedText, roundBox } from './draw.js';

// Lo que grita desde dentro del baño
const GRITOS = ['¡Socorro!', '¡Aquí dentro!', '¡Ayuda, por favor!', '¡Que alguien me saque!', '¡Estoy en el baño!'];
// Cada cuánto grita (segundos, al azar entre los dos)
const CADA = [2.2, 3.4];

// La horda (números provisionales)
export const HORDA = {
  dura: 180,        // segundos de trabajo para abrir la puerta (no cuentan mientras está caído)
  tope: 40,         // zombis a la vez, como mucho (para que no se trabe el juego)
  vida: 100,        // vida del superviviente
  levantar: 2,      // segundos al lado del superviviente caído para levantarlo
  lejos: 300,       // si el conserje está más lejos que esto de él, los zombis van a por él
  cada: [6, 3],     // segundos entre grupo y grupo, al principio y al final
  grupo: [2, 6],    // zombis por grupo, al principio y al final
};
// Qué zombis entran según el minuto
const TIPOS = [
  ['lento', 'normal', 'normal'],
  ['normal', 'normal', 'rapido', 'rapido', 'explosivo', 'lento'],
  ['normal', 'rapido', 'rapido', 'explosivo', 'venenoso', 'lento'],
];
// Lo que va diciendo según lo que lleva de cerradura (de 0 a 1)
const FRASES = [
  [0.02, '¡Está atascada! ¡Cúbreme!'],
  [0.15, 'Esta cerradura está oxidada… dame tiempo'],
  [0.32, 'Vale… creo que ya noto el muelle'],
  [0.5, '¡Toma, he encontrado esto!'],
  [0.62, '¡Se me ha caído la horquilla!… vale, ya la tengo'],
  [0.8, 'Ya casi lo tengo…'],
  [0.92, '¡Un poco más!'],
];
// Por dónde entra cada grupo
const POR = { salon: 'el salón', cocina: 'la cocina', dormitorio: 'el dormitorio', bano: 'el baño' };

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

  // Se une al equipo: ya no hace falta avisar de dónde está. Se apunta quién es y en qué piso, para la horda
  superviventeRescatado() {
    const sos = this.floor.sos;
    if (!sos) return;
    this.floor.sos = null;
    this.rescate.amigo = this.allies.find((a) => a.def === sos.def);
    this.rescate.sala = sos.room;
  }

  // ═════════════ La horda ═════════════

  // Cada fotograma: si aún no ha empezado, mira si el conserje va hacia la salida con el superviviente
  actualizarHorda(dt) {
    const r = this.rescate;
    if (!r || !r.sala || this.room !== r.sala || !r.amigo) return;
    if (!this.horda) {
      if (r.hordaHecha || this.player.dead) return;
      const ex = this.room.exits[0];
      if (ex && dist(this.player, ex) < 190) this.empezarHorda(ex);
      return;
    }
    const h = this.horda, a = r.amigo, p = this.player;
    h.t += dt;
    if (h.frase) h.frase.t += dt;
    a.invT = Math.max(0, (a.invT || 0) - dt);
    a.golpeT = Math.max(0, (a.golpeT || 0) - dt);

    if (!a.caido) {
      // golpes de los zombis que le alcanzan
      for (const e of this.enemies) {
        if (a.invT > 0) break;
        if (!e.active || e.dmg <= 0 || e.mareado || e.stunT > 0 || dist(e, a) > e.r + a.r + 4) continue;
        a.vida -= e.dmg;
        a.invT = 0.5; a.golpeT = 0.15;
        this.floatText(a.x, a.y - 40, `-${e.dmg}`, '#ff5d73', 16);
        sfx.hurt();
        if (a.vida <= 0) {
          a.vida = 0; a.caido = true; h.levantando = 0;
          this.decir('¡Ayúdame, no puedo levantarme!');
          this.shake(6);
        } else if (dist(p, a) > HORDA.lejos && h.t - (h.quejaT ?? -9) > 6) {
          h.quejaT = h.t;
          this.decir(pick(['¡Johnny, vuelve!', '¡No me dejes aquí!', '¡Que me comen!']));
        }
      }
    } else {
      // caído: el conserje lo levanta quedándose a su lado
      if (!p.dead && dist(p, a) < 60) h.levantando += dt; else h.levantando = Math.max(0, h.levantando - dt * 2);
      if (h.levantando >= HORDA.levantar) {
        a.caido = false; a.vida = HORDA.vida / 2; a.invT = 1.5;
        this.decir('¡Gracias! Sigo con la cerradura');
        sfx.heal();
      }
    }

    // la cerradura avanza mientras él esté de pie
    if (!a.caido) h.hecho = Math.min(HORDA.dura, h.hecho + dt);
    const k = h.hecho / HORDA.dura;
    while (h.frase_i < FRASES.length && k >= FRASES[h.frase_i][0]) {
      const [at, texto] = FRASES[h.frase_i++];
      this.decir(texto);
      if (at === 0.5) this.soltarProvisiones(a);
    }
    if (!a.caido && HORDA.dura - h.hecho <= 10 && !h.cuenta) { h.cuenta = true; sfx.boss(); }

    // los grupos de zombis
    h.grupoT -= dt;
    if (h.grupoT <= 0 && HORDA.dura - h.hecho > 3) {
      const e = clamp(k, 0, 1);
      h.grupoT = HORDA.cada[0] + (HORDA.cada[1] - HORDA.cada[0]) * e;
      this.grupoHorda(Math.round(HORDA.grupo[0] + (HORDA.grupo[1] - HORDA.grupo[0]) * e), TIPOS[Math.min(2, Math.floor(h.hecho / 60))]);
    }

    if (h.hecho >= HORDA.dura) this.acabarHorda();
  }

  // La puerta de entrada se cierra en la cara: empieza la horda
  empezarHorda(ex) {
    const a = this.rescate.amigo;
    // donde se pone a trabajar: delante de la puerta, por dentro
    const IN = 46;
    const sitio = ex.dir === 'up' ? { x: ex.at, y: WALL + IN } : ex.dir === 'down' ? { x: ex.at, y: this.rh - WALL - IN }
      : ex.dir === 'left' ? { x: WALL + IN, y: ex.at } : { x: this.rw - WALL - IN, y: ex.at };
    this.horda = { t: 0, hecho: 0, grupoT: 3, frase_i: 0, frase: null, sitio, levantando: 0, cuenta: false };
    a.forzando = true; a.vida = HORDA.vida; a.caido = false; a.invT = 0;
    this.room.cleared = false; // la puerta se cierra de golpe (updateDoors hace el portazo)
    this.shake(12);
    music.play('boss'); // la música más tensa
    this.banner = { icon: a.def.id, title: '¡La puerta se ha cerrado!', sub: `Aguanta mientras ${a.def.name} fuerza la cerradura`, t: 0 };
  }

  // Tres minutos después: la puerta se abre. Los zombis que queden siguen ahí, pero ya se puede salir
  acabarHorda() {
    const a = this.rescate.amigo;
    this.horda = null;
    this.rescate.hordaHecha = true;
    a.forzando = false;
    this.room.cleared = true;
    this.decir('¡YA ESTÁ! ¡CORRE!', a);
    this.banner = { title: '¡Puerta abierta!', sub: 'Salid de aquí', t: 0 };
    sfx.clear();
    this.later(0.25, () => sfx.door());
    music.play('explore');
  }

  // El superviviente dice algo: en la horda, un bocadillo encima de él; si no, un texto que sube
  decir(texto, a = this.rescate && this.rescate.amigo) {
    if (this.horda) this.horda.frase = { texto, t: 0 };
    else if (a) this.texts.push({ x: a.x, y: a.y - 56, text: texto, color: '#ffd23f', size: 20, t: 0, life: 2.5, vy: -18 });
  }

  // A mitad: tira munición y un molotov a sus pies
  soltarProvisiones(a) {
    this.dropPickup('ammo', a.x, a.y);
    this.dropPickup('ammo', a.x, a.y);
    this.dropPickup('molotov', a.x, a.y);
  }

  // Un grupo de zombis entra por una habitación (casi siempre una donde no está el conserje) y él avisa de por dónde
  grupoHorda(n, tipos) {
    n = Math.min(n, HORDA.tope - this.enemies.length);
    if (n <= 0) return;
    const l = this.room.layout, p = this.player;
    const aqui = this.zoneAt(p.x, p.y);
    const otras = l.zones.filter((z) => z !== aqui);
    const zona = otras.length && Math.random() < 0.8 ? pick(otras) : pick(l.zones);
    let puestos = 0;
    for (let i = 0; i < 120 && puestos < n; i++) {
      const x = zona.x + Math.random() * zona.w, y = zona.y + Math.random() * zona.h;
      if (l.owner[Math.floor(y / CELL) * l.cols + Math.floor(x / CELL)] !== zona.id || !isOpen(l, x, y, 24)) continue;
      if (Math.hypot(x - p.x, y - p.y) < 180 || l.obstacles.some((o) => obstacleGap(o, { x, y }) < 30)) continue;
      this.spawnEnemy(pick(tipos), x, y);
      puestos++;
    }
    if (puestos && POR[zona.use] && Math.random() < 0.5 && (!this.horda.frase || this.horda.frase.t > 2.5)) this.decir(`¡Vienen por ${POR[zona.use]}!`);
  }

  // Mientras fuerza la cerradura: va a su sitio y se queda trasteando de espaldas (o tumbado, si está caído)
  amigoForzando(a, dt) {
    if (a.caido) { a.vx = a.vy = 0; return; }
    const s = this.horda ? this.horda.sitio : a;
    const dx = s.x - a.x, dy = s.y - a.y, d = Math.hypot(dx, dy);
    const sp = Math.min(220, d * 6);
    a.vx = d > 2 ? (dx / d) * sp : 0; a.vy = d > 2 ? (dy / d) * sp : 0;
    a.x += a.vx * dt; a.y += a.vy * dt;
    this.collideWorld(a);
    const ex = this.room.exits[0];
    const lx = ex.dir === 'left' ? -1 : ex.dir === 'right' ? 1 : 0, ly = ex.dir === 'up' ? -1 : ex.dir === 'down' ? 1 : 0;
    a.lookX = lx; a.lookY = ly;
    a.aimAngle = Math.atan2(ly, lx);
    a.walkT += dt * (d > 4 ? 10 : 3);
  }

  // ¿Va este zombi a por el superviviente en vez de a por el conserje?
  presaDe(z) {
    const a = this.horda && this.rescate.amigo;
    if (!a || a.caido || z.isBoss) return null;
    const dp = dist(z, this.player), da = dist(z, a);
    return da < dp * 0.8 || dist(this.player, a) > HORDA.lejos ? a : null;
  }

  caminoHacia(ent, target) {
    return wayTo(this.room.layout, ent, target);
  }

  // Encima del superviviente: su vida, lo que dice y el círculo para levantarlo (en el mundo)
  dibujarHorda(ctx) {
    const h = this.horda;
    if (!h) return;
    const a = this.rescate.amigo;
    const bw = 44, bx = a.x - bw / 2, by = a.y - 50;
    ctx.fillStyle = OUTLINE; ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
    ctx.fillStyle = '#3a1d24'; ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = a.golpeT > 0 ? '#ffffff' : a.vida > HORDA.vida * 0.35 ? '#80ed99' : '#ff5d73';
    ctx.fillRect(bx, by, bw * (a.vida / HORDA.vida), 5);
    if (a.caido) {
      const k = h.levantando / HORDA.levantar;
      ctx.beginPath(); ctx.arc(a.x, a.y, 60, 0, Math.PI * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,210,63,${0.35 + Math.sin(this.time * 8) * 0.2})`; ctx.stroke();
      if (k > 0) {
        ctx.beginPath(); ctx.arc(a.x, a.y, 60, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
      }
      outlinedText(ctx, 'Quédate a su lado para levantarlo', a.x, a.y + 78, 13, '#ffd23f', { lw: 4 });
    }
    const f = h.frase;
    if (f && f.t < 3.2) {
      ctx.save();
      ctx.globalAlpha = f.t > 2.8 ? (3.2 - f.t) / 0.4 : 1;
      ctx.font = '15px "ZS UI", "Pixelify Sans", system-ui, sans-serif';
      const w = ctx.measureText(f.texto).width + 20, y = a.y - 76;
      roundBox(ctx, a.x - w / 2, y - 13, w, 26, 10, '#fff8ea', 3);
      ctx.fillStyle = '#2b2233'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.texto, a.x, y + 1);
      ctx.restore();
    }
  }

  // Arriba, en el centro de la pantalla: lo que le falta a la cerradura y, al final, la cuenta atrás
  dibujarBarraHorda(ctx) {
    const h = this.horda;
    if (!h) return;
    const a = this.rescate.amigo;
    const w = Math.min(360, this.ow - 260), x = (this.ow - w) / 2, y = 18;
    const falta = Math.ceil(HORDA.dura - h.hecho);
    roundBox(ctx, x - 8, y - 6, w + 16, 40, 8, 'rgba(29, 27, 44, 0.85)', 3);
    ctx.fillStyle = '#3a2f22'; ctx.fillRect(x, y + 14, w, 10);
    ctx.fillStyle = a.caido ? (Math.floor(this.time * 6) % 2 ? '#ff2d4b' : '#7a2030') : '#e0b030';
    ctx.fillRect(x, y + 14, w * (h.hecho / HORDA.dura), 10);
    ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.strokeRect(x, y + 14, w, 10);
    const texto = a.caido ? `¡${a.def.name} ha caído!` : `${a.def.name} fuerza la cerradura · ${Math.floor(falta / 60)}:${String(falta % 60).padStart(2, '0')}`;
    outlinedText(ctx, texto, this.ow / 2, y + 4, 13, a.caido ? '#ff8a8a' : '#f2e6c0', { lw: 4 });
    // los últimos diez segundos, en grande y latiendo
    if (falta <= 10 && !a.caido) {
      const pulso = 1 + (h.hecho % 1) * 0.25;
      outlinedText(ctx, String(falta), this.ow / 2, 120, 64 * pulso, '#ffd23f', { lw: 8 });
    }
  }
}
