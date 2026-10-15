// ─────────────────────────────────────────────
//  Cóctel molotov: el primer objeto arrojadizo de Johnny
//
//  Es un objeto aparte con munición (como las bombas de Isaac): Johnny sigue con su arma y además
//  lleva unas cuantas botellas. Se apunta libremente (ratón o arrastrando el botón en el móvil),
//  mientras se apunta se ve en el suelo dónde caerá y lo que quemará, y al soltar se lanza.
//  Al romperse deja un charco de fuego que quema a los zombis... y a Johnny si lo pisa.
//
//  Son métodos de Game (como game-ataques.js): game.js los añade a la clase.
//  Los dibujos son provisionales, a mano, hasta que tengan pixel art.
// ─────────────────────────────────────────────
import { WALL, PIXEL } from './config.js';
import { rand, clamp } from './utils.js';
import { getToss } from './input.js';
import { sfx } from './sfx.js';

// Números del molotov (provisionales, para probar si es divertido)
export const MOLOTOV = {
  start: 2,       // botellas al empezar la partida
  max: 5,         // las que caben en la mochila
  drop: 0.06,     // probabilidad de que un zombi suelte una al morir
  range: 300,     // lo más lejos que se puede lanzar
  flight: 0.55,   // segundos en el aire
  height: 110,    // altura de la parábola
  radius: 64,     // radio del fuego (en el suelo es una elipse: de alto mide el 60 %)
  life: 4,        // segundos que dura el fuego
  hit: 10,        // daño a los zombis que pilla de lleno al romperse
  burn: 22,       // daño por segundo a los zombis dentro del fuego
  dps: 12,        // daño por segundo a Johnny dentro del fuego (la esquiva lo cruza sin quemarse)
  tick: 0.25,     // cada cuánto se reparte la quemadura a los zombis
  afterburn: 1.5, // segundos que un zombi sigue ardiendo (solo a la vista) después de salir del fuego
};

// Colores del fuego: del centro (blanco amarillento) al borde (rojo) y el suelo chamuscado
export const FIRE = ['#fff3b0', '#ffd23f', '#ff9f1c', '#f0541e', '#b8261c'];
const SCORCH = '#2a1a14';

// ¿Está este punto dentro del charco? (elipse, igual que se dibuja)
function inside(hz, x, y, extra = 0) {
  const dx = x - hz.x, dy = (y - hz.y) / 0.6;
  return Math.hypot(dx, dy) < hz.r + extra;
}

export class MolotovMethods {
  // Lee el botón de lanzar: mientras se mantiene, se apunta (this.aim); al soltar, se lanza
  updateToss() {
    const t = getToss();
    const p = this.player;
    this.aim = null;
    if (p.dead || (!t.aiming && !t.released)) return;
    const target = this.tossTarget(t);
    if (t.aiming) { this.aim = target; return; }
    if (target) this.throwMolotov(target.x, target.y);
  }

  // Dónde caería: con el ratón, donde está el puntero (sin pasarse del alcance); en el móvil, hacia donde
  // se arrastra y tan lejos como se arrastre (con el mando, igual con el stick derecho). Si apenas se
  // arrastra (un toque, o el stick suelto), al zombi más cercano.
  tossTarget(t) {
    const p = this.player;
    let dx, dy;
    if (t.by === 'mouse' && t.mouse.seen) {
      const cam = this.camera, k = this.canvas.height / cam.vh;
      dx = cam.left + t.mouse.x / k - p.x;
      dy = cam.top + t.mouse.y / k - p.y;
    } else if ((t.by === 'touch' || t.by === 'pad') && Math.hypot(t.dx, t.dy) > 0.25) {
      dx = t.dx * MOLOTOV.range;
      dy = t.dy * MOLOTOV.range * 0.6;
    } else {
      const e = this.nearestTarget();
      if (!e) return null;
      dx = e.x - p.x; dy = e.y - p.y;
    }
    // el alcance, como todo en el suelo, es una elipse: hacia arriba y abajo llega al 60 %
    const d = Math.hypot(dx, dy / 0.6);
    if (d > MOLOTOV.range) { dx *= MOLOTOV.range / d; dy *= MOLOTOV.range / d; }
    return {
      x: clamp(p.x + dx, WALL + 30, this.rw - WALL - 30),
      y: clamp(p.y + dy, WALL + 30, this.rh - WALL - 30),
    };
  }

  // El zombi más cercano a tiro (para lanzar con un toque)
  nearestTarget() {
    const p = this.player;
    let best = null, bd = MOLOTOV.range;
    for (const e of this.enemies) {
      if (!e.active || this.hidden(e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ¿Le quedan botellas? (en el modo de pruebas no se gastan)
  get hasMolotov() { return this.testMode || this.molotovs > 0; }

  throwMolotov(x, y) {
    const p = this.player;
    if (!this.hasMolotov) {
      this.floatText(p.x, p.y - 54, '¡Sin molotovs!', '#ff9f1c', 18);
      sfx.nope();
      return;
    }
    if (!this.testMode) this.molotovs--;
    this.lob(p.x, p.y - 20, x, y, 'fire');
    sfx.toss();
  }

  // La botella se rompe: llamarada, daño a los que pilla de lleno y queda el fuego en el suelo
  molotovLand(lb) {
    const hz = { x: lb.tx, y: lb.ty, r: MOLOTOV.radius, life: MOLOTOV.life, seed: rand(0, 6), kind: 'fire', tick: 0 };
    this.hazards.push(hz);
    sfx.glass();
    sfx.fire();
    this.shake(5);
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 240);
      this.particles.push({ x: hz.x, y: hz.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, px: true, size: rand(2, 4), color: FIRE[i % 4], life: rand(0.3, 0.6), max: 0.6 });
    }
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.push({ x: hz.x, y: hz.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 70, px: true, size: 1, color: '#b9e3d0', life: 0.3, max: 0.3 }); // cristales
    }
    for (const e of this.enemies) {
      if (!e.active || !inside(hz, e.x, e.y, e.r)) continue;
      e.burnT = MOLOTOV.afterburn;   // la llamarada ya lo prende (si muere del golpe, queda quemado)
      e.hurt(MOLOTOV.hit, false, 0, 0, this, 0);
    }
  }

  // Cada fotograma con el fuego encendido: quema a quien esté dentro y suelta chispas
  burnFire(hz, dt) {
    const p = this.player;
    if (!p.dead && p.dashT <= 0 && inside(hz, p.x, p.y, p.r * 0.3)) p.poison(MOLOTOV.dps * dt, this, '#ff9f1c');
    hz.tick += dt;
    if (hz.tick >= MOLOTOV.tick) {
      hz.tick -= MOLOTOV.tick;
      for (const e of this.enemies) {
        if (!e.active || !inside(hz, e.x, e.y, e.r * 0.5)) continue;
        e.hurt(MOLOTOV.burn * MOLOTOV.tick, false, 0, 0, this, 0);
        // el zombi arde: sigue en llamas un rato después de salir del fuego (solo se ve; no hace más daño)
        e.burnT = MOLOTOV.afterburn;
      }
    }
    // chispas y lenguas de fuego que suben (menos cuando se va apagando)
    const strength = Math.min(1, hz.life / 1);
    if (Math.random() < 30 * dt * strength) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * hz.r * 0.85;
      this.particles.push({ x: hz.x + Math.cos(a) * r, y: hz.y + Math.sin(a) * r * 0.6, vx: rand(-10, 10), vy: rand(-140, -70), px: true, size: rand(1, 3), color: FIRE[Math.floor(rand(0, 4))], life: rand(0.25, 0.55), max: 0.55 });
    }
  }

  // El charco de fuego, en el suelo (en el lienzo pequeño, en píxeles enteros como el resto del suelo)
  drawFire(ctx, hz) {
    const u = PIXEL;
    const fade = Math.min(1, hz.life / 0.8);
    const grow = Math.min(1, (MOLOTOV.life - hz.life) / 0.15 + 0.3);
    const r = hz.r * grow;
    ctx.save();
    // suelo chamuscado
    ctx.globalAlpha = 0.55 * Math.min(1, hz.life / 0.4);
    ctx.fillStyle = SCORCH;
    ctx.beginPath(); ctx.ellipse(hz.x, hz.y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    // brasas: manchas que parpadean
    ctx.globalAlpha = 0.85 * fade;
    for (let ring = 0; ring < 3; ring++) {
      ctx.fillStyle = FIRE[4 - ring];
      ctx.beginPath(); ctx.ellipse(hz.x, hz.y, r * (0.85 - ring * 0.25), r * 0.6 * (0.85 - ring * 0.25), 0, 0, Math.PI * 2); ctx.fill();
    }
    // lenguas de fuego: columnitas de píxeles que suben y bajan
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + hz.seed, rr = r * (0.2 + ((i * 37) % 10) / 13);
      const fx = Math.round((hz.x + Math.cos(a) * rr) / u) * u;
      const fy = Math.round((hz.y + Math.sin(a) * rr * 0.6) / u) * u;
      const h = Math.max(1, Math.round((3 + 4 * Math.abs(Math.sin(this.time * 9 + i * 1.7))) * fade));
      for (let j = 0; j < h; j++) {
        ctx.fillStyle = FIRE[Math.min(4, Math.floor(((h - j) / h) * 3.5))];
        ctx.fillRect(fx - (j < h - 1 ? u : 0), fy - j * u, j < h - 1 ? 2 * u : u, u);
      }
    }
    ctx.restore();
  }

  // Mientras se apunta: el alcance alrededor de Johnny y, en el suelo, dónde quemará
  drawTossAim(ctx) {
    const a = this.aim, p = this.player;
    if (!a || p.dead) return;
    const ok = this.hasMolotov;
    const col = ok ? '255, 159, 28' : '170, 170, 170';
    ctx.save();
    ctx.lineWidth = PIXEL;
    // alcance máximo
    // (con un borde oscuro debajo, para que se vea igual en suelos claros y oscuros)
    ctx.setLineDash([2 * PIXEL, 4 * PIXEL]);
    ctx.strokeStyle = 'rgba(29, 27, 44, 0.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, MOLOTOV.range, MOLOTOV.range * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    // zona de fuego
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 8);
    ctx.fillStyle = `rgba(${col}, ${0.35 * pulse})`;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, MOLOTOV.radius, MOLOTOV.radius * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([]);
    ctx.lineWidth = 3 * PIXEL;
    ctx.strokeStyle = 'rgba(29, 27, 44, 0.6)';
    ctx.stroke();
    ctx.lineWidth = PIXEL;
    ctx.setLineDash([3 * PIXEL, 2 * PIXEL]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.strokeStyle = `rgb(${col})`;
    ctx.stroke();
    // cruz en el centro: donde se rompe la botella
    ctx.fillStyle = `rgb(${col})`;
    ctx.fillRect(a.x - 3 * PIXEL, a.y - PIXEL / 2, 6 * PIXEL, PIXEL);
    ctx.fillRect(a.x - PIXEL / 2, a.y - 3 * PIXEL, PIXEL, 6 * PIXEL);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // La trayectoria: puntitos en parábola desde Johnny hasta donde caerá (por encima de todo)
  drawTossArc(ctx) {
    const a = this.aim, p = this.player;
    if (!a || p.dead) return;
    const x0 = p.x, y0 = p.y - 20;
    const s = PIXEL * 1.5;
    for (let i = 1; i < 12; i++) {
      const k = i / 12;
      const x = x0 + (a.x - x0) * k, y = y0 + (a.y - y0) * k - Math.sin(k * Math.PI) * MOLOTOV.height;
      ctx.fillStyle = 'rgba(29, 27, 44, 0.7)';
      ctx.fillRect(x - s / 2 - PIXEL / 2, y - s / 2 - PIXEL / 2, s + PIXEL, s + PIXEL);
      ctx.fillStyle = this.hasMolotov ? '#ffd23f' : '#c8c8c8';
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
}

// Botella de molotov dibujada a mano (para el suelo, el vuelo...). `spin` la hace girar en el aire.
export function drawMolotov(ctx, x, y, spin = 0, time = 0) {
  const u = PIXEL;
  ctx.save();
  ctx.translate(x, y);
  if (spin) ctx.rotate(spin);
  const px = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx * u, cy * u, w * u, h * u); };
  // contorno, cristal verde y trapo
  px(-3, -2, 6, 7, '#472937');
  px(-2, -5, 4, 3, '#472937');
  px(-2, -1, 4, 5, '#4a7a4a');
  px(-2, -1, 1, 4, '#78aa60');
  px(1, 0, 1, 4, '#2e523a');
  px(-1, -4, 2, 3, '#4a7a4a');
  px(-1, -6, 2, 2, '#d6c4a0');
  // la llama del trapo, que baila
  const f = Math.floor(time * 12) % 2;
  px(-1, -8 - f, 2, 2 + f, '#ff9f1c');
  px(0, -9 - f, 1, 1, '#ffd23f');
  ctx.restore();
}
