// ─────────────────────────────────────────────
//  Cosas que hay en los mapas: superviviente atrapado, la llave del
//  mini jefe, armas en el suelo y los muebles que guardan un arma
// ─────────────────────────────────────────────
import { W, H, WALL, OUTLINE } from './config.js';
import { drawHuman, outlinedText, roundBox, glow, drawCached } from './draw.js';
import { drawWeaponItem } from './weapons.js';
import { drawSprite, hasSprite, pixelShadow, spriteMeta, poseSheet } from './sprites.js';

const TAU = Math.PI * 2;

// Superviviente atrapado: se une al equipo cuando limpias la sala y te acercas
export class SurvivorNPC {
  constructor(def) {
    this.kind = 'survivor';
    this.def = def;
    this.x = W / 2; this.y = H / 2;
    this.r = 16;
    this.solid = false;
    this.taken = false;
  }

  draw(ctx, game) {
    const { x, y } = this;
    const scared = !game.room.cleared;
    // tiembla de miedo mientras quedan monstruos
    const shake = scared ? Math.sin(game.time * 40) * 1.2 : 0;
    const p = game.player;
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
    drawHuman(ctx, x + shake, y, {
      ...this.def.look,
      s: 0.82,
      lookX: scared ? 0 : dx / d,
      lookY: scared ? 1 : dy / d,
      moving: scared ? 0 : 0.6,
      walk: scared ? 0 : game.time * 8, // da saltitos de alegría al verte
    });
    // bocadillo
    const text = scared ? '¡Socorro!' : '¡Llévame contigo!';
    const by = y - 52 - Math.abs(Math.sin(game.time * 3)) * 4;
    ctx.font = '16px "ZS UI", "Pixelify Sans", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 22;
    roundBox(ctx, x - w / 2, by - 14, w, 28, 12, '#fff8ea', 3);
    ctx.beginPath();
    ctx.moveTo(x - 6, by + 13); ctx.lineTo(x, by + 22); ctx.lineTo(x + 6, by + 13);
    ctx.fillStyle = '#fff8ea'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.fillStyle = '#fff8ea'; ctx.fillRect(x - 5, by + 11, 10, 4);
    ctx.fillStyle = scared ? '#ff5d73' : '#2f9e44';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + 1);
    outlinedText(ctx, this.def.name, x, y + 30, 14, '#ffffff', { lw: 4 });
  }
}

// La llave del apartamento del mini jefe: espera en el suelo de alguna habitación de otro apartamento.
// No tiene nada que ver con los dólares: abre esa puerta y nada más.
export class DoorKey {
  constructor(name, x, y) {
    this.kind = 'doorkey';
    this.name = name;
    this.x = x; this.y = y;
    this.r = 20;
    this.solid = false;
    this.taken = false;
  }

  draw(ctx, game) {
    const { x } = this;
    const y = this.y - 8 + Math.sin(game.time * 3) * 4;
    glow(ctx, x, y, 4, 50, '190, 225, 255', 0.6 + Math.sin(game.time * 4) * 0.15);
    ctx.fillStyle = 'rgba(20,16,40,0.22)';
    ctx.beginPath(); ctx.ellipse(x, this.y + 14, 16, 5, 0, 0, TAU); ctx.fill();
    // llave plateada, grande, con una etiqueta roja colgando (sprite; si falta, el dibujo de siempre)
    if (!drawSprite(ctx, 'objeto-llave-puerta', 'idle', 'south', 0, x, y)) {
      // llave plateada, grande, con una etiqueta roja colgando
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.6 + Math.sin(game.time * 2.5) * 0.15);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.beginPath();
      ctx.moveTo(-3, -4); ctx.lineTo(22, -4); ctx.lineTo(22, 10); ctx.lineTo(16, 10); ctx.lineTo(16, 4);
      ctx.lineTo(11, 4); ctx.lineTo(11, 8); ctx.lineTo(6, 8); ctx.lineTo(6, 4); ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fillStyle = '#dfe7f2'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-12, 0, 11, 0, TAU);
      ctx.fillStyle = '#dfe7f2'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-12, 0, 4, 0, TAU);
      ctx.fillStyle = '#8d99ae'; ctx.fill(); ctx.stroke();
      roundBox(ctx, -20, 10, 16, 12, 3, '#ff5d73', 2.5);
      ctx.restore();
    }
    outlinedText(ctx, this.name, x, this.y + 34, 15, '#dfe7f2', { lw: 4 });
  }
}

// Armarito del baño, colgado en la pared del fondo como una estantería (clavado con dos tornillos): dentro hay
// un botiquín que cura BOTIQUIN_CURA al cogerlo. Se coge plantándose delante (o delante del mueble que tenga
// debajo, hasta `reach`); con la vida llena no se gasta. Ya cogido, se queda abierto y vacío. `y` es el pie de la
// pared: el armarito se dibuja más arriba, en la cara del muro. Dibujo provisional a mano: si algún día hay
// sprite 'mueble-armarito', se usa ese (fotograma 0 cerrado, 1 abierto; con los pies en el pie de la pared).
export const BOTIQUIN_CURA = 50;
const ARM = { w: 36, h: 40, alto: 34 }; // ancho y alto del armarito, y a qué altura del pie de la pared va su base
export class Armarito {
  constructor(x, y, reach = 70) {
    this.kind = 'armarito';
    this.x = x; this.y = y;
    this.r = 22;
    this.reach = reach;
    this.solid = false;
    this.taken = false;
    this.armed = true;
  }

  draw(ctx, game) {
    const { x } = this;
    const base = this.y - ARM.alto, top = base - ARM.h, l = x - ARM.w / 2;
    if (drawSprite(ctx, 'mueble-armarito', 'idle', 'south', this.taken ? 1 : 0, x, base)) return;
    if (!this.taken) glow(ctx, x, top + ARM.h / 2, 4, 30, '128, 237, 153', 0.22 + Math.sin(game.time * 3) * 0.08);
    // sombra en la pared, un poco hacia abajo y a la derecha
    ctx.fillStyle = 'rgba(6, 4, 14, 0.35)';
    ctx.fillRect(l + 4, top + 5, ARM.w, ARM.h);
    // la caja, blanca, con la balda de abajo un poco más ancha
    roundBox(ctx, l, top, ARM.w, ARM.h, 2, '#e9edf1', 3);
    roundBox(ctx, l - 3, base - 5, ARM.w + 6, 6, 1, '#c9d1da', 2.5);
    if (!this.taken) {
      // puertas cerradas con la cruz roja y dos tiradores
      ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, top + 2, 2, ARM.h - 8);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(x - 8, top + 12, 16, 6); ctx.fillRect(x - 3, top + 7, 6, 16);
      ctx.fillStyle = '#8d99ae'; ctx.fillRect(x - 5, top + 27, 3, 4); ctx.fillRect(x + 2, top + 27, 3, 4);
    } else {
      // abierto y vacío: el hueco oscuro con una balda, y las dos puertas abiertas a los lados
      ctx.fillStyle = '#4a5568'; ctx.fillRect(l + 3, top + 3, ARM.w - 6, ARM.h - 10);
      ctx.fillStyle = '#c9d1da'; ctx.fillRect(l + 3, top + 17, ARM.w - 6, 3);
      roundBox(ctx, l - 9, top, 8, ARM.h - 4, 2, '#e9edf1', 2.5);
      roundBox(ctx, l + ARM.w + 1, top, 8, ARM.h - 4, 2, '#e9edf1', 2.5);
    }
    // los dos tornillos que lo sujetan a la pared
    ctx.fillStyle = '#5c6470';
    ctx.fillRect(l + 4, top + 3, 3, 3); ctx.fillRect(l + ARM.w - 7, top + 3, 3, 3);
  }
}

// Arma tirada en el suelo: al pasar por encima la cambias por la tuya
export class WeaponProp {
  constructor(weapon, x, y) {
    this.kind = 'weapon';
    this.weapon = weapon;
    this.x = x; this.y = y;
    this.r = 22;
    this.solid = false;
    this.taken = false;
    this.armed = false; // hay que acercarse "de nuevas" para cogerla
    this.ammo = null;   // arma de fuego que soltó el conserje: las balas que le quedaban
    this.seed = Math.random() * 6;
  }

  draw(ctx, game) {
    const { x, y } = this;
    const bob = Math.sin(game.time * 3 + this.seed) * 3;
    glow(ctx, x, y, 4, 44, '255, 230, 120', 0.55);
    ctx.fillStyle = 'rgba(20,16,40,0.2)';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 24, 7, 0, 0, TAU); ctx.fill();
    ctx.save();
    // la dibujamos centrada (las armas largas se desplazan un poco)
    const len = this.weapon.type === 'melee' ? (this.weapon.reach > 55 ? 50 : 28) : (this.weapon.muzzle || 24);
    ctx.translate(x - Math.cos(-0.5) * len / 2, y - 4 + bob - Math.sin(-0.5) * len / 2);
    ctx.rotate(-0.5);
    drawWeaponItem(ctx, this.weapon);
    ctx.restore();
    outlinedText(ctx, this.weapon.name, x, y + 30, 15, '#ffd23f', { lw: 4 });
  }
}

// Muebles de la sala de mantenimiento que guardan un arma para empezar la partida, vistos desde arriba
// y pegados a la pared de arriba. Los redondos llevan `round` (radio); el resto, largo y fondo.
const STASHES = {
  cubo:      { round: 20, color: '#6c9bd1' },
  paraguero: { round: 17, color: '#8d6346' },
  encimera:  { len: 84, dep: 44, color: '#e9ecef' },
  comoda:    { len: 84, dep: 40, color: '#b07d4f', front: 24 }, // `front`: lo que sobresale el cajón abierto
  taquilla:  { len: 64, dep: 44, color: '#7d8a99' },
  caja:      { len: 60, dep: 40, color: '#c08552' },             // armas nuevas sin mueble propio
};

// Un arma esperando en su mueble. Si aún no la has encontrado en ninguna partida, el mueble
// sale cerrado con un candado. Al arrimarte a uno abierto, coges su arma y la tuya vuelve a su sitio.
export class WeaponStash {
  constructor(weapon, x, locked) {
    this.kind = 'stash';
    this.weapon = weapon;
    this.locked = locked;
    this.look = STASHES[weapon.stash] ? weapon.stash : 'caja';
    const d = STASHES[this.look];
    this.def = d;
    this.x = x;
    if (d.round) { this.r = d.round; this.y = WALL + d.round + 4; }
    else {
      // el cajón abierto también ocupa sitio
      this.shape = 'rect'; this.w = d.len; this.h = d.dep + (locked ? 0 : d.front || 0);
      this.r = this.h / 2; this.y = WALL + this.h / 2;
    }
    this.solid = true;
    this.taken = false;
  }

  draw(ctx, game) {
    const { x, def: d, look } = this;
    const y = d.round ? this.y : WALL + d.dep / 2; // centro del cuerpo del mueble (sin contar el cajón)
    const open = !this.locked;
    const here = open && !game.player.has(this.weapon); // el arma está en el mueble (no la llevas)
    const L = d.len, D = d.dep, x0 = x - L / 2, y0 = y - D / 2;
    ctx.lineJoin = 'round';

    // ── el mueble ──
    ctx.fillStyle = 'rgba(20,16,40,0.2)';
    if (d.round) {
      ctx.beginPath(); ctx.ellipse(x + 3, y + 7, d.round, d.round, 0, 0, TAU); ctx.fill();
      disc(ctx, x, y, d.round, d.color);
      if (open) disc(ctx, x, y, d.round - 6, look === 'cubo' ? '#9fdcf2' : '#3a2e26', 2.5);
      else disc(ctx, x, y, d.round - 6, shade(d.color), 2.5); // tapa puesta
    } else {
      ctx.beginPath(); ctx.roundRect(x0 + 3, y0 + 7, L, D + (open ? d.front || 0 : 0), 8); ctx.fill();
      roundBox(ctx, x0, y0, L, D, 6, d.color, 3);
      if (look === 'encimera') {
        roundBox(ctx, x0 + 6, y0 + 6, 22, D - 12, 4, '#ced4da', 2.5);            // fregadero
        roundBox(ctx, x + 14, y - 10, 22, 20, 4, open ? '#8d6346' : '#6c584c', 2.5); // taco de cuchillos
        if (!open) roundBox(ctx, x + 12, y - 12, 26, 24, 4, '#adb5bd', 2.5);      // tapado con una caja metálica
      } else if (look === 'comoda') {
        if (open) {
          roundBox(ctx, x0 + 6, y0 + D - 4, L - 12, d.front + 4, 4, shade(d.color), 3); // cajón abierto
          roundBox(ctx, x0 + 11, y0 + D + 1, L - 22, d.front - 6, 3, '#f1e3cf', 2);
        } else {
          for (const kx of [-18, 18]) disc(ctx, x + kx, y0 + D - 7, 3.5, '#ffd23f', 2);  // tiradores
        }
        roundBox(ctx, x - 12, y0 + 6, 24, 12, 3, '#9fdcf2', 2.5);                  // un jarrón encima
      } else if (look === 'taquilla') {
        if (open) {
          roundBox(ctx, x0 + 5, y0 + 5, L - 10, D - 10, 3, '#2b2d42', 2.5);         // interior
          roundBox(ctx, x0 - 3, y0 + D - 4, 7, 30, 3, d.color, 3);                  // puerta abierta hacia la sala
        } else {
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(x, y0 + 2); ctx.lineTo(x, y0 + D - 2); ctx.stroke();
          for (const vx of [-16, 16]) for (let i = 0; i < 3; i++) roundBox(ctx, x + vx - 8, y0 + 8 + i * 6, 16, 2.5, 1, '#4d5866', 0);
        }
      } else if (open) {
        roundBox(ctx, x0 + 5, y0 + 5, L - 10, D - 10, 3, shade(d.color), 2.5);     // caja abierta
      } else {
        roundBox(ctx, x - 5, y0, 10, D, 0, '#e9c46a', 2.5);                         // caja precintada
      }
    }

    // ── el arma, colocada a su manera en cada mueble ──
    const front = y + (d.round || D / 2) + (open ? d.front || 0 : 0); // borde del mueble que da a la sala
    if (here) {
      glow(ctx, x, y + 6, 4, 48, '255, 230, 120', 0.4 + Math.sin(game.time * 3) * 0.12);
      // [x, y, giro] de la empuñadura
      const at = {
        cubo: [x + 29, y + 40, -2.2],            // el cabezal dentro del cubo y el palo hacia la sala
        paraguero: [x - 2, y - 2, 0.95],
        encimera: [x + 18, y + 8, -1.57],        // clavado en el taco
        comoda: [x - 10, y + D / 2 + d.front / 2, 0],
        taquilla: [x - 22, y + 2, 0],
        caja: [x - 16, y, 0],
      }[look];
      ctx.save();
      ctx.translate(at[0], at[1]);
      ctx.rotate(at[2]);
      drawWeaponItem(ctx, this.weapon);
      ctx.restore();
      outlinedText(ctx, this.weapon.name, x, front + 16, 15, '#ffd23f', { lw: 4 });
    } else if (this.locked) {
      // candado
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(x, y - 3, 6, Math.PI, 0); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#ced4da';
      ctx.beginPath(); ctx.arc(x, y - 3, 6, Math.PI, 0); ctx.stroke();
      roundBox(ctx, x - 9, y - 3, 18, 14, 3, '#ffd23f', 2.5);
      outlinedText(ctx, '???', x, front + 16, 15, '#ced4da', { lw: 4 });
    }
  }
}

// Mesa con el ordenador de la sala de mantenimiento, pegada a la pared de arriba: al arrimarse se enciende y
// sale su pantalla (ordenador.js), donde se compran puntos de talento. Dibujo del dueño (mesa-ordenador, 18 oct, original en
// assets/sources/ordenador/); si falta su sprite, una mesa dibujada a mano.
export class Ordenador {
  constructor(x) {
    this.kind = 'ordenador';
    this.x = x;
    this.shape = 'rect'; this.w = 92; this.h = 44; // lo que ocupa en el suelo: de la pared a las patas de delante
    this.r = this.h / 2; this.y = WALL + this.h / 2;
    this.solid = true;
    this.taken = false;
    this.armed = true; // al cerrar la pantalla hay que apartarse un poco antes de que se vuelva a abrir
  }

  draw(ctx, game) {
    const { x, y, w, h } = this;
    const meta = spriteMeta('mesa-ordenador');
    if (meta) {
      // la pantalla del monitor brilla un poco, para que se vea que se puede usar
      glow(ctx, x - 2, y + h / 2 - 70, 4, 40, '120, 220, 255', 0.35 + Math.sin(game.time * 2.5) * 0.1);
      drawSprite(ctx, 'mesa-ordenador', 'idle', 'south', 0, x, y + h / 2, { scale: meta.scale });
    } else {
      roundBox(ctx, x - w / 2, y - h / 2, w, h, 6, '#8d6346', 3);
      roundBox(ctx, x - 20, y - h / 2 + 4, 40, 26, 4, '#2b2d42', 3);
      roundBox(ctx, x - 16, y - h / 2 + 8, 32, 18, 2, '#4cc9f0', 0);
    }
    outlinedText(ctx, 'Ordenador', x, y + h / 2 + 16, 15, '#9fe8ff', { lw: 4 });
  }
}

// Baúl de la sala de mantenimiento, pegado a la pared de arriba al lado del ordenador: al arrimarse sale lo que
// hay guardado (ui.js, showBaul). Dibujado a mano en pixel art (cada píxel, 2 unidades del juego) hasta que tenga sprite.
export class Baul {
  constructor(x) {
    this.kind = 'baul';
    this.x = x;
    this.shape = 'rect'; this.w = 60; this.h = 36; // lo que ocupa en el suelo
    this.r = this.h / 2; this.y = WALL + this.h / 2;
    this.solid = true;
    this.taken = false;
    this.armed = true; // al cerrar el recuadro hay que apartarse un poco antes de que se vuelva a abrir
  }

  draw(ctx) {
    const { x, y, h } = this;
    const left = x - 30, top = y + h / 2 - 48; // 30×24 píxeles de arte; el dibujo sube un poco por la pared
    drawCached(ctx, this, 'baul', left, top, 60, 48, (g) => {
      const px = (cx, cy, w, hh, c) => { g.fillStyle = c; g.fillRect(left + cx * 2, top + cy * 2, w * 2, hh * 2); };
      const borde = '#24150d', oscura = '#5a3820', madera = '#8a5a32', clara = '#b07a44';
      const hierro = '#5e6670', brillo = '#a3acb6', oro = '#e3b341', oroOscuro = '#9c7322';
      px(1, 0, 28, 1, borde); px(0, 1, 30, 23, borde);            // silueta, con las esquinas de arriba redondeadas
      px(1, 1, 28, 9, madera); px(2, 1, 26, 2, clara);             // tapa (con luz arriba)
      px(1, 8, 28, 1, oscura); px(1, 9, 28, 1, hierro);            // sombra de la tapa y su canto de hierro
      px(1, 10, 28, 1, borde);                                     // raja entre tapa y caja
      px(1, 11, 28, 12, madera);                                   // caja
      px(1, 15, 28, 1, oscura); px(1, 19, 28, 1, oscura);          // tablas
      px(1, 21, 28, 2, oscura);                                    // sombra de abajo
      for (const bx of [4, 23]) { px(bx, 1, 3, 22, hierro); px(bx, 1, 1, 22, brillo); } // flejes de hierro
      px(12, 7, 6, 8, borde); px(13, 8, 4, 6, oro); px(13, 13, 4, 1, oroOscuro); // cerradura
      px(14, 10, 2, 2, borde);                                     // ojo de la cerradura
    });
    outlinedText(ctx, 'Baúl', x, y + h / 2 + 16, 15, '#ffd98a', { lw: 4 });
  }
}

function disc(ctx, x, y, r, fill, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.stroke();
}

// Un tono más oscuro del mismo color (#rrggbb)
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * 0.72).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

// Maniquí de la sala de exposición de zombis (modo pruebas, exposicion.js): un sprite que posa quieto y
// va girando por sus 8 direcciones, con su nombre debajo. Ni ataca ni se le puede pegar. Se dibuja desde una
// hoja mini con solo su pose (poseSheet, en sprites.js): con las hojas enteras, la sala iba a tirones.
const POSES = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
export class Maniqui {
  constructor(sprite, x, y, label = '') {
    this.kind = 'maniqui';
    this.sprite = sprite;
    this.label = label;
    this.x = x; this.y = y;
    this.r = 16;
    this.solid = false;
    this.taken = false;
  }

  draw(ctx, game) {
    const { x, y } = this;
    if (!hasSprite(this.sprite)) {
      outlinedText(ctx, `Falta el sprite ${this.sprite}`, x, y, 15, '#ff5d73', { lw: 4 });
      return;
    }
    const dir = POSES[Math.floor(game.time / 1.2) % POSES.length]; // cambia de dirección cada 1,2 s
    pixelShadow(ctx, x, y + 14, 36);
    drawSprite(ctx, poseSheet(this.sprite), 'idle', dir, 0, x, y + 15, { scale: spriteMeta(this.sprite).scale });
    // el nombre se dibuja una vez y se guarda como imagen (el texto con borde es caro de repetir)
    const ly = y + 34 + (this.labelDy || 0);
    if (this.label) drawCached(ctx, this, this.label, x - 70, ly - 10, 140, 20, (g) => outlinedText(g, this.label, x, ly, 12, '#ffffff', { lw: 3 }));
  }
}
