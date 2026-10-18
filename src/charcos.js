// ─────────────────────────────────────────────
//  Charcos de píxeles: la salpicadura que comparten el fuego del molotov, el veneno y la lejía
//
//  Al caer el proyectil se calcula una vez la forma del charco, píxel a píxel (casillas de un píxel del arte):
//  una mancha de borde irregular, algo estirada hacia donde volaba, con gotas salpicadas por delante.
//  Cada píxel apunta cuándo "se enciende" (el charco se extiende desde el centro) y cuándo "se apaga" (se seca
//  por trozos al final). Al secarse del todo queda en el suelo una mancha (un decal con imagen).
//
//  Para un charco nuevo (agua, electricidad...) basta con un ESTILO: sus tiempos y sus colores, y si quiere
//  adornos (burbujas, chispas) una función `deco`. Lo demás (forma, daño solo donde se ve, imagen que solo se
//  repinta cuando cambia, mancha final) lo hace este módulo.
// ─────────────────────────────────────────────
import { PIXEL } from './config.js';
import { clamp } from './utils.js';

// Ruido suave sin azar (no gasta números del dado de la partida): mismo `s`, misma forma
export function hash(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
export function noise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Colores ya preparados para escribirlos píxel a píxel (formato de ImageData: rojo en el byte bajo)
export function pixelColor(hex, alpha = 1) {
  const v = parseInt(hex.slice(1), 16);
  return ((Math.round(alpha * 255) << 24) | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0;
}

// Un estilo: { life, spread, die, front, ember, colors: {...}, deco? }
//   life: segundos que dura el charco   spread: lo que tarda en extenderse   die: lo que dura el secado por trozos
//   front: segundos que un píxel recién llegado brilla en `colors.front`
//   ember: segundos que un píxel recién secado queda en `colors.ember` antes de ser mancha
//   colors: front, core, core2 (centro), mid, edge (borde), ember, ash y ash2 (mancha final, con transparencia)
// Los colores se pasan como [hex, alpha] o solo hex; `preparar` los convierte la primera vez.
export function preparar(style) {
  if (style.bed) return style;
  const c = style.colors, bed = {};
  for (const k in c) bed[k] = Array.isArray(c[k]) ? pixelColor(c[k][0], c[k][1]) : pixelColor(c[k]);
  style.bed = bed;
  return style;
}

// Calcula la forma del charco. `ang` es hacia dónde volaba el proyectil; hz: { r, seed }.
export function makeSplash(hz, ang, style) {
  preparar(style);
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
    on[k] = (Math.min(d, 1.2) / 1.2) * style.spread + noise(dx / 10, dy / 6, s + 3) * 0.08;
    off[k] = style.life - style.die + clamp((noise(dx / 26, dy / 16, s + 7) - 0.2) / 0.6, 0, 1) * (style.die - 0.1);
    const depth = (edge * R) / u;                           // píxeles hasta el borde
    tone[k] = depth < 1.5 ? 1 : depth < 4 ? 2 : 3;
    if (tone[k] >= 2) cells.push(k);
  }
  return { W, H, on, off, tone, cells, style, key: null, canvas: null };
}

// Elige `count` sitios sin azar entre los píxeles de dentro (para llamas, ascuas, burbujas...), de atrás adelante.
// `make(big, i)` da los campos propios de cada sitio; `big` va de 0 (borde) a 1 (centro).
export function pickSpots(f, hz, count, salt, make) {
  const { W, H, cells, on, off } = f, u = PIXEL, R = hz.r, s = hz.seed;
  const list = [];
  for (let i = 0; i < count && cells.length; i++) {
    const k = cells[Math.floor(hash(i, salt, s) * cells.length)];
    const dx = ((k % W) + 0.5 - W / 2) * u, dy = (Math.floor(k / W) + 0.5 - H / 2) * u;
    const big = 1 - Math.min(1, Math.hypot(dx / R, dy / (R * 0.6)));
    list.push({ x: dx, y: dy, on: on[k], off: off[k], seed: s + i * 1.73, ...make(big, i) });
  }
  return list.sort((p, q) => p.y - q.y);
}

// ¿Está cubierto este punto del charco en este momento? (dx, dy: respecto al centro)
function cubre(f, dx, dy, e) {
  const i = Math.floor(dx / PIXEL + f.W / 2), j = Math.floor(dy / PIXEL + f.H / 2);
  if (i < 0 || j < 0 || i >= f.W || j >= f.H) return false;
  const k = j * f.W + i;
  return f.on[k] >= 0 && e >= f.on[k] && e < f.off[k];
}

// ¿Está este punto dentro del charco? Solo hace daño donde se ve charco (no antes de que llegue ni donde ya se secó).
// `extra` es el radio de quien lo pisa: basta con que le llegue el charco por un lado.
export function dentro(hz, x, y, extra = 0) {
  const f = hz.splash, e = f.style.life - hz.life, dx = x - hz.x, dy = y - hz.y;
  if (cubre(f, dx, dy, e)) return true;
  if (extra <= 0) return false;
  const q = extra * 0.7;
  return cubre(f, dx - q, dy, e) || cubre(f, dx + q, dy, e) || cubre(f, dx, dy - q * 0.6, e) || cubre(f, dx, dy + q * 0.6, e);
}

// Pinta el charco tal como está en el segundo `e` en su imagen (una imagen pequeña, un píxel por casilla)
export function bakeSplash(f, e, seed) {
  const st = f.style, B = st.bed;
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
    if (e < on + st.front) px[k] = B.front;
    else if (e < off) {
      const t = f.tone[k];
      px[k] = t === 1 ? B.edge : t === 2 ? B.mid : hash(k, 0, seed) < 0.3 ? B.core : B.core2;
    } else if (e < off + st.ember) px[k] = B.ember;
    else px[k] = hash(k, 1, seed) < 0.5 ? B.ash : B.ash2;
  }
  f.canvas.getContext('2d').putImageData(f.img, 0, 0);
}

// Dibuja la imagen del charco en el suelo. Solo se repinta cuando cambia: mientras se extiende (30 veces por
// segundo) y mientras se seca (12 veces por segundo); en medio, ni una vez.
export function drawSplash(ctx, hz) {
  const f = hz.splash, st = f.style, u = PIXEL, e = st.life - hz.life;
  const key = e < st.spread + st.front + 0.05 ? 's' + Math.floor(e * 30)
    : e > st.life - st.die - 0.05 ? 'd' + Math.floor(e * 12) : 'm';
  if (f.key !== key) { bakeSplash(f, e, hz.seed); f.key = key; }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.canvas, hz.x - (f.W * u) / 2, hz.y - (f.H * u) / 2, f.W * u, f.H * u);
}

// Al secarse del todo, la mancha se queda en el suelo como una más (con decal de imagen)
export function leaveStain(game, hz) {
  const decals = game.room && game.room.decals;
  if (!decals) return;
  const f = hz.splash;
  bakeSplash(f, 1e9, hz.seed);   // todo mancha
  decals.push({ x: hz.x, y: hz.y, img: f.canvas, w: f.W * PIXEL, h: f.H * PIXEL });
  game.room.decalCount = (game.room.decalCount || 0) + 1;
  if (decals.length > 60) decals.shift();
}

// ── Adornos que se mueven encima del charco ──

// Una burbuja de píxeles: crece, se hincha y revienta soltando cuatro gotitas. `ph` va de 0 a 1.
// `c`: { rim, hi, dark, drop } colores. (x, y) es el centro, en píxeles del juego.
function burbuja(ctx, x, y, ph, c, maxSize) {
  const u = PIXEL;
  if (ph < 0.8) {
    const s = 1 + Math.floor((ph / 0.8) * (maxSize - 0.01));      // 1..maxSize píxeles de ancho
    const bx = Math.round(x / u) * u, by = Math.round(y / u) * u;
    if (s === 1) { ctx.fillStyle = c.hi; ctx.fillRect(bx, by, u, u); return; }
    ctx.fillStyle = c.rim; ctx.fillRect(bx, by, s * u, s * u);
    if (s >= 3) { ctx.fillStyle = c.dark; ctx.fillRect(bx + u, by + u, (s - 2) * u, (s - 2) * u); }
    ctx.fillStyle = c.hi; ctx.fillRect(bx, by, u, u);
  } else if (ph < 0.9) {
    // revienta: cuatro gotitas que salen disparadas
    const d = (ph - 0.8) * 50 * u / 5;
    const bx = Math.round(x / u) * u, by = Math.round(y / u) * u;
    ctx.fillStyle = c.drop;
    ctx.fillRect(bx - Math.round(d) * u, by, u, u);
    ctx.fillRect(bx + (Math.round(d) + 1) * u, by, u, u);
    ctx.fillRect(bx, by - Math.round(d * 0.7) * u, u, u);
    ctx.fillRect(bx, by + Math.round(d * 0.7) * u, u, u);
  }
}

// Brillo que parpadea: una cruz pequeña de píxeles
function brillo(ctx, x, y, k, color) {
  const u = PIXEL, bx = Math.round(x / u) * u, by = Math.round(y / u) * u;
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, u, u);
  if (k > 0.6) {
    ctx.fillRect(bx - u, by, u, u); ctx.fillRect(bx + u, by, u, u);
    ctx.fillRect(bx, by - u, u, u); ctx.fillRect(bx, by + u, u, u);
  }
}

// Cuántos sitios de adorno tiene cada charco, y cómo se dibujan (los elige `crearCharco` una vez)
function adornosBurbujas(f, hz, n) {
  f.bubbles = pickSpots(f, hz, n, 5, (big, i) => ({ per: 1.1 + hash(i, 8, hz.seed) * 1.3, size: big > 0.4 ? 3 : 2 }));
}

function decoVeneno(ctx, hz, f, e, t) {
  const c = ESTILO_VENENO.burbuja;
  for (let i = 0; i < f.bubbles.length; i++) {
    const m = f.bubbles[i];
    if (e < m.on + 0.1 || e >= m.off) continue;
    const ph = ((t + m.seed) / m.per) % 1;
    burbuja(ctx, hz.x + m.x, hz.y + m.y, ph, c, m.size);
  }
}

function decoLejia(ctx, hz, f, e, t) {
  const c = ESTILO_LEJIA.burbuja;
  // espuma: burbujitas blancas que revientan rápido
  for (let i = 0; i < f.bubbles.length; i++) {
    const m = f.bubbles[i];
    if (e < m.on + 0.1 || e >= m.off) continue;
    burbuja(ctx, hz.x + m.x, hz.y + m.y, ((t * 1.6 + m.seed) / m.per) % 1, c, 2);
  }
  // brillos que parpadean
  for (let i = 0; i < f.sparks.length; i++) {
    const m = f.sparks[i];
    if (e < m.on + 0.1 || e >= m.off) continue;
    const k = Math.sin(t * (4 + (i % 4)) + m.seed * 2.1);
    if (k > 0.35) brillo(ctx, hz.x + m.x, hz.y + m.y, k, '#ffffff');
  }
}

// ── Los estilos de cada charco (el fuego del molotov está en molotov.js) ──
export const ESTILO_VENENO = {
  life: 4, spread: 0.5, die: 1.2, front: 0.08, ember: 0.3,
  colors: {
    front: '#d9ff8a', core: '#a6e84a', core2: '#8fd13f', mid: '#5f9a2c', edge: '#2e5a1e',
    ember: ['#34571f', 0.9], ash: ['#35502a', 0.5], ash2: ['#2b4222', 0.42],
  },
  burbuja: { rim: '#c7f27a', hi: '#f4ffd0', dark: '#4a7a24', drop: '#c7f27a' },
  deco: decoVeneno,
  adornos(f, hz) { adornosBurbujas(f, hz, 9); },
};

export const ESTILO_LEJIA = {
  life: 5, spread: 0.3, die: 1.0, front: 0.07, ember: 0.25,
  colors: {
    front: '#ffffff', core: '#f4fbff', core2: '#e3f4fc', mid: '#b6dcf0', edge: '#6aa8d2',
    ember: ['#d6ecf7', 0.85], ash: ['#f2faff', 0.3], ash2: ['#dcedf8', 0.24],
  },
  burbuja: { rim: '#ffffff', hi: '#ffffff', dark: '#cfe8f6', drop: '#ffffff' },
  deco: decoLejia,
  adornos(f, hz) {
    adornosBurbujas(f, hz, 12);
    f.sparks = pickSpots(f, hz, 10, 11, () => ({}));
  },
};

// Crea el charco en el suelo. `lb` es el proyectil que cae: (x0, y0) → (tx, ty) da la dirección en que se estira.
export function crearCharco(lb, kind, style, hd, seed) {
  const x = Math.round(lb.tx / PIXEL) * PIXEL, y = Math.round(lb.ty / PIXEL) * PIXEL;
  const hz = { x, y, r: hd.radius, life: hd.life, seed, kind };
  hz.splash = makeSplash(hz, Math.atan2((lb.ty - lb.y0) / 0.6, lb.tx - lb.x0) || 0, style);
  style.adornos(hz.splash, hz);
  return hz;
}

// Dibuja un charco de veneno o de lejía: la imagen y sus adornos
export function drawCharco(ctx, hz, t) {
  const f = hz.splash, st = f.style, e = st.life - hz.life;
  ctx.save();
  drawSplash(ctx, hz);
  st.deco(ctx, hz, f, e, t);
  ctx.restore();
}
