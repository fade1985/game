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
  afterburn: 2,   // segundos que un zombi sigue ardiendo (y quemándose) después de salir del fuego
};

// Colores del fuego: del centro (blanco amarillento) al borde (rojo) y el suelo chamuscado
export const FIRE = ['#fff3b0', '#ffd23f', '#ff9f1c', '#f0541e', '#b8261c'];

// ── El charco: una salpicadura de gasolina ardiendo, hecha de píxeles ──
// Al romperse la botella se calcula una vez la forma del charco, píxel a píxel (casillas de un píxel del arte):
// una mancha de borde irregular, algo estirada hacia donde iba la botella, con gotas salpicadas por delante.
// Cada píxel apunta cuándo se enciende (el fuego se extiende desde el centro) y cuándo se apaga (se apaga por
// trozos al final). Al apagarse del todo queda en el suelo una mancha de quemado.
const SPREAD = 0.35;  // segundos que tarda el fuego en cubrir todo el charco
const DIE = 1.4;      // segundos que dura el apagado por trozos, al final
const FRONT = 0.07;   // segundos que un píxel recién prendido brilla en blanco (el frente del fuego)
const EMBER = 0.3;    // segundos que un píxel recién apagado queda de brasa roja antes de ser ceniza

// Ruido suave sin azar (no gasta números del dado de la partida): mismo `s`, misma forma
function hash(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Calcula la forma del charco. `ang` es hacia dónde volaba la botella.
function makeSplash(hz, ang) {
  const u = PIXEL, R = hz.r, s = hz.seed;
  const W = 2 * Math.ceil((R * 1.3) / u), H = 2 * Math.ceil((R * 0.85) / u), n = W * H;   // pares: el centro cae entre píxeles
  const on = new Float32Array(n).fill(-1), off = new Float32Array(n), tone = new Uint8Array(n);
  // gotas salpicadas: casi todas por delante, alguna hacia los lados
  const drops = [];
  for (let i = 0; i < 8; i++) {
    const a = ang + (hash(i, 1, s) - 0.5) * (i < 5 ? 1.3 : 4);
    const d = R * (0.78 + hash(i, 2, s) * 0.45);
    drops.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.6, r: 3 + hash(i, 3, s) * 5 });
  }
  const cells = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const dx = (i + 0.5 - W / 2) * u, dy = (j + 0.5 - H / 2) * u;
    const d = Math.hypot(dx / R, dy / (R * 0.6));
    const a = Math.atan2(dy / 0.6, dx);
    // el borde: irregular (ruido) y estirado hacia delante
    const lim = 0.74 + 0.5 * (noise(dx / 18, dy / 11, s) - 0.5) + 0.14 * Math.max(0, Math.cos(a - ang));
    let edge = lim - d;                                     // > 0: dentro del charco
    if (edge <= 0) for (const p of drops) edge = Math.max(edge, (p.r - Math.hypot(dx - p.x, dy - p.y)) / R);
    if (edge <= 0) continue;
    const k = j * W + i;
    on[k] = (Math.min(d, 1.2) / 1.2) * SPREAD + noise(dx / 10, dy / 6, s + 3) * 0.08;
    off[k] = MOLOTOV.life - DIE + clamp((noise(dx / 26, dy / 16, s + 7) - 0.2) / 0.6, 0, 1) * (DIE - 0.1);
    const depth = (edge * R) / u;                           // píxeles hasta el borde
    tone[k] = depth < 1.5 ? 1 : depth < 4 ? 2 : 3;
    if (tone[k] >= 2) cells.push(k);
  }
  // sitios de las llamas y de las ascuas (elegidos sin azar entre los píxeles de dentro), de atrás adelante
  const pick = (count, salt) => {
    const list = [];
    for (let i = 0; i < count && cells.length; i++) {
      const k = cells[Math.floor(hash(i, salt, s) * cells.length)];
      const dx = ((k % W) + 0.5 - W / 2) * u, dy = (Math.floor(k / W) + 0.5 - H / 2) * u;
      const big = 1 - Math.min(1, Math.hypot(dx / R, dy / (R * 0.6)));
      list.push({ x: dx, y: dy, on: on[k], off: off[k], seed: s + i * 1.73,
        w: Math.round(4 + big * 5 + (i % 2)), h: Math.round(6 + big * 13 + (i % 3) * 2) });
    }
    return list.sort((p, q) => p.y - q.y);
  };
  return { W, H, on, off, tone, flames: pick(14, 5), embers: pick(24, 9), key: null, canvas: null };
}

// ¿Está ardiendo este punto del charco en este momento? (dx, dy: respecto al centro)
function burning(f, dx, dy, e) {
  const i = Math.floor(dx / PIXEL + f.W / 2), j = Math.floor(dy / PIXEL + f.H / 2);
  if (i < 0 || j < 0 || i >= f.W || j >= f.H) return false;
  const k = j * f.W + i;
  return f.on[k] >= 0 && e >= f.on[k] && e < f.off[k];
}

// ¿Está este punto dentro del fuego? Solo quema donde se ve fuego (no antes de que llegue ni donde ya se apagó).
// `extra` es el radio de quien lo pisa: basta con que le llegue el fuego a un lado.
function inside(hz, x, y, extra = 0) {
  const f = hz.splash, e = MOLOTOV.life - hz.life, dx = x - hz.x, dy = y - hz.y;
  if (burning(f, dx, dy, e)) return true;
  if (extra <= 0) return false;
  const q = extra * 0.7;
  return burning(f, dx - q, dy, e) || burning(f, dx + q, dy, e) || burning(f, dx, dy - q * 0.6, e) || burning(f, dx, dy + q * 0.6, e);
}

// Colores ya preparados para escribirlos píxel a píxel (formato de ImageData: rojo en el byte bajo)
function pixelColor(hex, alpha = 1) {
  const v = parseInt(hex.slice(1), 16);
  return ((Math.round(alpha * 255) << 24) | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0;
}
const BED = {
  front: pixelColor(FIRE[0]), core: pixelColor(FIRE[1]), core2: pixelColor(FIRE[2]), mid: pixelColor(FIRE[3]),
  edge: pixelColor(FIRE[4]), ember: pixelColor('#6e1d12'), ash: pixelColor('#1c120e', 0.7), ash2: pixelColor('#2a1a14', 0.6),
};

// Pinta el charco tal como está en el segundo `e` en su imagen (una imagen pequeña, un píxel por casilla)
function bakeSplash(f, e, seed) {
  if (!f.canvas) {
    f.canvas = document.createElement('canvas');
    f.canvas.width = f.W; f.canvas.height = f.H;
    f.img = f.canvas.getContext('2d').createImageData(f.W, f.H);
  }
  const px = new Uint32Array(f.img.data.buffer);
  for (let k = 0; k < px.length; k++) {
    const on = f.on[k];
    if (on < 0 || e < on) { px[k] = 0; continue; }
    const off = f.off[k];
    if (e < on + FRONT) px[k] = BED.front;
    else if (e < off) {
      const t = f.tone[k];
      px[k] = t === 1 ? BED.edge : t === 2 ? BED.mid : hash(k, 0, seed) < 0.3 ? BED.core : BED.core2;
    } else if (e < off + EMBER) px[k] = BED.ember;
    else px[k] = hash(k, 1, seed) < 0.5 ? BED.ash : BED.ash2;
  }
  f.canvas.getContext('2d').putImageData(f.img, 0, 0);
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
    // el centro, en píxel entero del arte, para que el charco cuadre con el resto del suelo
    const x = Math.round(lb.tx / PIXEL) * PIXEL, y = Math.round(lb.ty / PIXEL) * PIXEL;
    const hz = { x, y, r: MOLOTOV.radius, life: MOLOTOV.life, seed: rand(0, 6), kind: 'fire', tick: 0 };
    hz.splash = makeSplash(hz, Math.atan2((lb.ty - lb.y0) / 0.6, lb.tx - lb.x0) || 0);
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
        // el zombi se prende y la quemadura la lleva él (zombies.js: burn): dentro del fuego se le renueva
        // sin parar, y al salir sigue ardiendo (y quemándose al mismo ritmo) unos segundos más.
        // Los jefes no saben arder todavía: a ellos se les quema directamente, solo dentro del fuego.
        if (e.burn) e.burnT = MOLOTOV.afterburn;
        else e.hurt(MOLOTOV.burn * MOLOTOV.tick, false, 0, 0, this, 0);
      }
    }
    // chispas y lenguas de fuego que suben, solo de donde aún arde
    if (Math.random() < 30 * dt) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * hz.r * 0.85;
      const x = hz.x + Math.cos(a) * r, y = hz.y + Math.sin(a) * r * 0.6;
      if (inside(hz, x, y)) this.particles.push({ x, y, vx: rand(-10, 10), vy: rand(-140, -70), px: true, size: rand(1, 3), color: FIRE[Math.floor(rand(0, 4))], life: rand(0.25, 0.55), max: 0.55 });
    }
    // al apagarse del todo, el charco de ceniza se queda en el suelo como una mancha más
    if (hz.life <= 0) this.leaveScorch(hz);
  }

  leaveScorch(hz) {
    const decals = this.room && this.room.decals;
    if (!decals) return;
    const f = hz.splash;
    bakeSplash(f, 1e9, hz.seed);   // todo ceniza
    decals.push({ x: hz.x, y: hz.y, img: f.canvas, w: f.W * PIXEL, h: f.H * PIXEL });
    this.room.decalCount = (this.room.decalCount || 0) + 1;
    if (decals.length > 60) decals.shift();
  }

  // El charco de fuego, en el suelo (en el lienzo pequeño, en píxeles enteros como el resto del suelo)
  drawFire(ctx, hz) {
    const u = PIXEL, t = this.time, f = hz.splash, e = MOLOTOV.life - hz.life;
    // la imagen del charco solo se repinta cuando cambia: mientras se extiende (30 veces por segundo) y
    // mientras se apaga (12 veces por segundo); en medio, ni una vez
    const key = e < SPREAD + FRONT + 0.05 ? 's' + Math.floor(e * 30)
      : e > MOLOTOV.life - DIE - 0.05 ? 'd' + Math.floor(e * 12) : 'm';
    if (f.key !== key) { bakeSplash(f, e, hz.seed); f.key = key; }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(f.canvas, hz.x - (f.W * u) / 2, hz.y - (f.H * u) / 2, f.W * u, f.H * u);
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
