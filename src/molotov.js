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
import { makeSplash, pickSpots, dentro, drawSplash, leaveStain } from './charcos.js';
import { getToss } from './input.js';
import { sfx } from './sfx.js';
import { FABRICANTE } from './talentos.js';
import { ARROJADIZAS } from './armas-creadas.js';

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
  afterburn: 2,   // segundos que un zombi sigue ardiendo (y quemándose) después de salir del fuego
};

// Colores del fuego: del centro (blanco amarillento) al borde (rojo) y el suelo chamuscado
export const FIRE = ['#fff3b0', '#ffd23f', '#ff9f1c', '#f0541e', '#b8261c'];

// ── El charco: una salpicadura de gasolina ardiendo, hecha de píxeles (la forma y el dibujo están en charcos.js) ──
// El fuego se extiende desde el centro, se apaga por trozos al final y deja una mancha de quemado.
// Un píxel recién prendido brilla en blanco (el frente del fuego) y uno recién apagado queda de brasa roja.
export const ESTILO_FUEGO = {
  life: MOLOTOV.life, spread: 0.35, die: 1.4, front: 0.07, ember: 0.3,
  colors: {
    front: FIRE[0], core: FIRE[1], core2: FIRE[2], mid: FIRE[3], edge: FIRE[4],
    ember: '#6e1d12', ash: ['#1c120e', 0.7], ash2: ['#2a1a14', 0.6],
  },
};

// Calcula la forma del charco de fuego, con sus llamas y sus ascuas (sitios elegidos sin azar, de atrás adelante)
function makeFire(hz, ang) {
  const f = makeSplash(hz, ang, ESTILO_FUEGO);
  f.flames = pickSpots(f, hz, 14, 5, (big, i) => ({ w: Math.round(4 + big * 5 + (i % 2)), h: Math.round(6 + big * 13 + (i % 3) * 2) }));
  f.embers = pickSpots(f, hz, 24, 9, () => ({}));
  return f;
}


// Una llama de pixel art. (x, y) es la base; `w` y `h`, el ancho y el alto en píxeles del arte.
// Por fuera es roja, por dentro naranja y en el corazón amarilla; se estrecha hacia arriba, se mece de lado
// (más cuanto más arriba) y su altura tiembla con dos ondas a distinto ritmo para que no se note la repetición.
// De vez en cuando la punta suelta una chispa. `seed` cambia el ritmo de cada llama; `k` (0–1) la encoge.
export function drawFlame(ctx, x, y, w, h, t, seed, k = 1) {
  const u = PIXEL;
  const hh = Math.round(h * k * (0.72 + 0.18 * Math.sin(t * 11 + seed * 3.1) + 0.1 * Math.sin(t * 17.3 + seed)));
  if (hh < 2) return;
  const bx = Math.round(x / u), by = Math.round(y / u);
  const half = (w * Math.max(0.5, k)) / 2;
  let sway = 0;
  for (let j = 0; j < hh; j++) {
    const f = j / hh;                                   // 0 en la base, 1 en la punta
    sway = Math.round(Math.sin(t * 7 + seed * 2 - j * 0.5) * f * f * 2.5);
    const hw = Math.round(half * Math.pow(1 - f, 0.8));
    const row = (by - j - 1) * u, left = bx + sway;
    // capa de fuera (roja en la punta), la de en medio y el corazón
    ctx.fillStyle = f > 0.7 ? FIRE[4] : FIRE[3];
    ctx.fillRect((left - hw) * u, row, (2 * hw + 1) * u, u);
    if (hw >= 1 && f < 0.75) {
      ctx.fillStyle = FIRE[2];
      ctx.fillRect((left - hw + 1) * u, row, (2 * hw - 1) * u, u);
    }
    if (hw >= 2 && f < 0.5) {
      ctx.fillStyle = f < 0.25 ? FIRE[0] : FIRE[1];
      ctx.fillRect((left - hw + 2) * u, row, (2 * hw - 3) * u, u);
    }
  }
  // chispa que se suelta de la punta y sube
  const spark = (t * 1.7 + seed * 0.37) % 1;
  if (spark < 0.45) {
    ctx.fillStyle = spark < 0.2 ? FIRE[1] : FIRE[3];
    ctx.fillRect((bx + sway) * u, (by - hh - 2 - Math.floor(spark * 8)) * u, u, u);
  }
}

export class MolotovMethods {
  // Lee el botón de lanzar: mientras se mantiene, se apunta (this.aim); al soltar, se lanza
  updateToss() {
    const t = getToss();
    const p = this.player;
    this.aim = null;
    if (this.tossKind in ARROJADIZAS && this.unidadesCreada(this.tossKind) <= 0) this.tossKind = 'molotov'; // se la quitaron del inventario
    if (p.dead || (!t.aiming && !t.released)) return;
    const target = this.tossTarget(t);
    if (t.aiming) { this.aim = target; return; }
    if (!target) return;
    if (this.tossKind === 'granada') this.throwGrenade(target.x, target.y);
    else if (this.tossKind in ARROJADIZAS) this.throwCreada(target.x, target.y);
    else this.throwMolotov(target.x, target.y);
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
    // el centro, en píxel entero del arte, para que el charco cuadre con el resto del suelo
    const x = Math.round(lb.tx / PIXEL) * PIXEL, y = Math.round(lb.ty / PIXEL) * PIXEL;
    const fab = this.stats.fabricante ? FABRICANTE : { radio: 1, duracion: 1 }; // Fabricante: fuego más grande y largo
    const hz = { x, y, r: MOLOTOV.radius * fab.radio, life: MOLOTOV.life * fab.duracion, seed: rand(0, 6), kind: 'fire', tick: 0 };
    hz.splash = makeFire(hz, Math.atan2((lb.ty - lb.y0) / 0.6, lb.tx - lb.x0) || 0);
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
      // la llamarada del golpe aún no tiene forma: pilla a los que están cerca, dentro de la elipse
      if (!e.active || Math.hypot(e.x - hz.x, (e.y - hz.y) / 0.6) > hz.r * 0.8 + e.r) continue;
      e.burnT = MOLOTOV.afterburn;   // la llamarada ya lo prende (si muere del golpe, queda quemado)
      e.hurt(MOLOTOV.hit * this.stats.throwDamage, false, 0, 0, this, 0); // Puntería
    }
  }

  // Cada fotograma con el fuego encendido: prende a los zombis que estén dentro y suelta chispas
  // (a Johnny lo quema su estado "fuego": game-ataques.js y estados.js)
  burnFire(hz, dt) {
    hz.tick += dt;
    if (hz.tick >= MOLOTOV.tick) {
      hz.tick -= MOLOTOV.tick;
      for (const e of this.enemies) {
        if (!e.active || !dentro(hz, e.x, e.y, e.r * 0.5)) continue;
        // el zombi se prende y la quemadura la lleva él (zombies.js: burn): dentro del fuego se le renueva
        // sin parar, y al salir sigue ardiendo (y quemándose al mismo ritmo) unos segundos más.
        // Los jefes no saben arder todavía: a ellos se les quema directamente, solo dentro del fuego.
        if (e.burn) e.burnT = MOLOTOV.afterburn;
        else e.hurt(MOLOTOV.burn * MOLOTOV.tick * this.stats.throwDamage, false, 0, 0, this, 0);
      }
    }
    // chispas y lenguas de fuego que suben, solo de donde aún arde
    if (Math.random() < 30 * dt) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * hz.r * 0.85;
      const x = hz.x + Math.cos(a) * r, y = hz.y + Math.sin(a) * r * 0.6;
      if (dentro(hz, x, y)) this.particles.push({ x, y, vx: rand(-10, 10), vy: rand(-140, -70), px: true, size: rand(1, 3), color: FIRE[Math.floor(rand(0, 4))], life: rand(0.25, 0.55), max: 0.55 });
    }
    // al apagarse del todo, el charco de ceniza se queda en el suelo como una mancha más
    if (hz.life <= 0) leaveStain(this, hz);
  }

  // El charco de fuego, en el suelo (en el lienzo pequeño, en píxeles enteros como el resto del suelo)
  drawFire(ctx, hz) {
    const u = PIXEL, t = this.time, f = hz.splash, e = MOLOTOV.life - hz.life;
    ctx.save();
    drawSplash(ctx, hz);
    // ascuas: píxeles sueltos que se encienden y se apagan (solo donde arde)
    for (let i = 0; i < f.embers.length; i++) {
      const m = f.embers[i];
      if (e < m.on || e >= m.off) continue;
      const glow = Math.sin(t * (6 + (i % 5)) + i * 2.3 + hz.seed);
      if (glow < 0.2) continue;
      ctx.fillStyle = glow > 0.7 ? FIRE[0] : FIRE[1];
      ctx.fillRect(hz.x + Math.floor(m.x / u) * u, hz.y + Math.floor(m.y / u) * u, u, u);
    }
    // las llamas: cada una crece cuando le llega el fuego y se encoge antes de que se apague su trozo
    for (const m of f.flames) {
      const k = Math.min(1, (e - m.on) / 0.25, (m.off - e) / 0.5);
      if (k > 0) drawFlame(ctx, hz.x + m.x, hz.y + m.y, m.w, m.h, t, m.seed, k);
    }
    ctx.restore();
  }

  // Mientras se apunta: el alcance alrededor de Johnny y, en el suelo, dónde quemará
  drawTossAim(ctx) {
    const a = this.aim, p = this.player;
    if (!a || p.dead) return;
    const ok = this.hasMolotov;
    const granada = this.tossKind !== 'molotov';   // la granada y las creadas se apuntan igual
    const col = ok ? '255, 159, 28' : '170, 170, 170';
    ctx.save();
    ctx.lineWidth = PIXEL;
    // alcance máximo
    // (con un borde oscuro debajo, para que se vea igual en suelos claros y oscuros)
    ctx.setLineDash([2 * PIXEL, 4 * PIXEL]);
    ctx.strokeStyle = 'rgba(29, 27, 44, 0.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, MOLOTOV.range, MOLOTOV.range * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    if (granada) { ctx.setLineDash([]); ctx.restore(); this.drawGrenadeAim(ctx, a); return; }
    // zona de fuego
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 8);
    ctx.fillStyle = `rgba(${col}, ${0.35 * pulse})`;
    const rf = MOLOTOV.radius * (this.stats.fabricante ? FABRICANTE.radio : 1);
    ctx.beginPath(); ctx.ellipse(a.x, a.y, rf, rf * 0.6, 0, 0, Math.PI * 2); ctx.fill();
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
      ctx.fillStyle = this.hasToss ? (this.tossKind === 'granada' ? '#9bbd5a' : ARROJADIZAS[this.tossKind]?.color || '#ffd23f') : '#c8c8c8';
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
