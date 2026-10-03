// ─────────────────────────────────────────────
//  Objetos fijos de las salas: pedestal con objeto,
//  superviviente atrapado y escaleras a la siguiente planta
// ─────────────────────────────────────────────
import { W, H, OUTLINE } from './config.js';
import { drawHuman, outlinedText, roundBox } from './draw.js';
import { drawWeapon } from './weapons.js';

const TAU = Math.PI * 2;

// Pedestal con un objeto encima (de momento, una de las cartas de mejora)
export class Pedestal {
  constructor(item) {
    this.kind = 'pedestal';
    this.item = item;
    this.x = W / 2; this.y = H / 2;
    this.r = 26;
    this.solid = true;
    this.taken = false;
  }

  draw(ctx, game) {
    const { x, y } = this;
    ctx.fillStyle = 'rgba(20,16,40,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 18, 34, 12, 0, 0, TAU); ctx.fill();
    // columna de piedra vista desde arriba
    roundBox(ctx, x - 30, y - 6, 60, 30, 10, '#b8b3c9', 4);
    roundBox(ctx, x - 34, y - 18, 68, 26, 12, '#d9d5e6', 4);
    if (this.taken) return;
    // brillo y objeto flotando
    const bob = Math.sin(game.time * 3) * 5;
    const glow = ctx.createRadialGradient(x, y - 40 + bob, 4, x, y - 40 + bob, 46);
    glow.addColorStop(0, 'rgba(255, 230, 120, 0.7)');
    glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y - 40 + bob, 46, 0, TAU); ctx.fill();
    ctx.font = '38px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.item.icon, x, y - 40 + bob);
  }
}

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

// Escaleras a la siguiente planta (aparecen al derrotar al mini jefe)
export class Stairs {
  constructor(nextFloor) {
    this.kind = 'stairs';
    this.nextFloor = nextFloor;
    this.x = W / 2; this.y = H / 2;
    this.r = 30;
    this.solid = false;
    this.flat = true; // se dibuja en el suelo, por debajo de los personajes
    this.taken = false;
    this.appear = 0;
  }

  draw(ctx, game) {
    this.appear = Math.min(1, this.appear + 0.04);
    const { x, y } = this;
    const k = this.appear;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    roundBox(ctx, -52, -44, 104, 88, 14, '#8b5a3c', 5);
    // peldaños que suben
    for (let i = 0; i < 5; i++) {
      const sy = -34 + i * 15;
      roundBox(ctx, -42, sy, 84, 13, 4, i % 2 ? '#d6a46b' : '#e2b47c', 3);
    }
    ctx.restore();
    if (k >= 1) {
      outlinedText(ctx, `▲ Planta ${this.nextFloor}`, x, y - 66 - Math.abs(Math.sin(game.time * 4)) * 5, 22, '#ffd23f');
    }
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
