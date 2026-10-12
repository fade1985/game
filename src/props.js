// ─────────────────────────────────────────────
//  Cosas que hay en los mapas: superviviente atrapado, la llave del
//  mini jefe, armas en el suelo y los muebles que guardan un arma
// ─────────────────────────────────────────────
import { W, H, WALL, OUTLINE } from './config.js';
import { drawHuman, outlinedText, roundBox } from './draw.js';
import { drawWeapon } from './weapons.js';
import { drawSprite, hasSprite, pixelShadow } from './sprites.js';

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
    ctx.font = '16px "Lilita One", system-ui, sans-serif';
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
// No es una de las llaves doradas que se gastan en el Taller: abre esa puerta y nada más.
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
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 50);
    glow.addColorStop(0, `rgba(190, 225, 255, ${0.6 + Math.sin(game.time * 4) * 0.15})`);
    glow.addColorStop(1, 'rgba(190, 225, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(20,16,40,0.22)';
    ctx.beginPath(); ctx.ellipse(x, this.y + 14, 16, 5, 0, 0, TAU); ctx.fill();
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
    outlinedText(ctx, this.name, x, this.y + 34, 15, '#dfe7f2', { lw: 4 });
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
    this.seed = Math.random() * 6;
  }

  draw(ctx, game) {
    const { x, y } = this;
    const bob = Math.sin(game.time * 3 + this.seed) * 3;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 44);
    glow.addColorStop(0, 'rgba(255, 230, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 44, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(20,16,40,0.2)';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 24, 7, 0, 0, TAU); ctx.fill();
    ctx.save();
    // la dibujamos centrada (las armas largas se desplazan un poco)
    const len = this.weapon.type === 'melee' ? (this.weapon.reach > 55 ? 50 : 28) : (this.weapon.muzzle || 24);
    ctx.translate(x - Math.cos(-0.5) * len / 2, y - 4 + bob - Math.sin(-0.5) * len / 2);
    ctx.rotate(-0.5);
    drawWeapon(ctx, this.weapon);
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
    const here = open && game.player.weapon.id !== this.weapon.id; // el arma está en el mueble (no en tu mano)
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
      const glow = ctx.createRadialGradient(x, y + 6, 4, x, y + 6, 48);
      glow.addColorStop(0, `rgba(255, 230, 120, ${0.4 + Math.sin(game.time * 3) * 0.12})`);
      glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y + 6, 48, 0, TAU); ctx.fill();
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
      drawWeapon(ctx, this.weapon);
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

// Maniquí de la sala de exposición (?sala=venenoso): un sprite que posa quieto y va
// girando por sus 8 direcciones, para compararlo con el conserje. Ni ataca ni se le puede pegar.
const POSES = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
export class Maniqui {
  constructor(sprite, x, y) {
    this.kind = 'maniqui';
    this.sprite = sprite;
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
    drawSprite(ctx, this.sprite, 'idle', dir, game.time, x, y + 15);
  }
}
