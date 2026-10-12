// ─────────────────────────────────────────────
//  Logo "ZOMBIE SCAPE" en pixel art, dibujado con código
//  Cada letra es una cuadrícula de 5×7 que se amplía ×3 y se engorda un píxel;
//  después se le añaden relieve, goteos de baba / sangre, un borde oscuro con
//  volumen (como si la letra tuviera grosor) y un filo claro alrededor.
// ─────────────────────────────────────────────

const FONT = {
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
};

const S = 3;            // cada píxel de la letra ocupa S×S píxeles del dibujo
const GAP = 3;          // hueco entre letras
const LW = 5 * S + 1;   // ancho de una letra (el +1 es el engorde)
const LH = 7 * S + 1;   // alto de una letra
const PAD = 4;          // margen para el borde oscuro y el filo claro
const DEPTH = 3;        // "grosor" de la letra: cuánto baja el borde oscuro
const DRIP = 10;        // largo máximo de un goteo
const INK = '#1d1b2c';
const RIM = '#fff4d6';

// Colores por franja de la letra: luz, base, sombra y borde interior
const GREEN = { hi: '#d8ff6b', base: '#7ed321', mid: '#4fa81a', low: '#2f6f1c', drip: '#7ed321' };
const RED = { hi: '#ff9a8a', base: '#ee3b3b', mid: '#b81f2b', low: '#7a1424', drip: '#d62a33' };

const wordSize = (word) => ({
  w: word.length * (LW + GAP) - GAP + PAD * 2,
  h: LH + DRIP + DEPTH + PAD * 2,
});

// Dibuja una palabra en `ctx` con su esquina superior izquierda en (x0, y0)
function drawWord(ctx, word, x0, y0, pal, dripSeed) {
  const { w: W, h: H } = wordSize(word);
  const mask = new Uint8Array(W * H);       // 1 = píxel de letra
  const col = new Array(W * H).fill(null);  // color final de cada píxel (null = vacío)
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
  const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && col[y * W + x] !== null;
  const near = (x, y, r) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (filled(x + i, y + j)) return true;
    return false;
  };

  // 1) forma de las letras, engordada un píxel hacia la derecha y hacia abajo
  [...word].forEach((ch, i) => {
    FONT[ch].forEach((row, ry) => {
      [...row].forEach((v, rx) => {
        if (v !== '1') return;
        for (let dy = 0; dy <= S; dy++) for (let dx = 0; dx <= S; dx++) {
          mask[(PAD + ry * S + dy) * W + PAD + i * (LW + GAP) + rx * S + dx] = 1;
        }
      });
    });
  });

  // 2) cuerpo de las letras: franjas de color + relieve en los bordes
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    const f = (y - PAD) / LH;
    let c = f < 0.14 ? pal.hi : f < 0.5 ? pal.base : f < 0.78 ? pal.mid : pal.low;
    if (!at(x, y - 1) || !at(x - 1, y)) c = pal.hi;           // borde iluminado (arriba / izquierda)
    else if (!at(x, y + 1) || !at(x + 1, y)) c = pal.low;      // borde en sombra (abajo / derecha)
    col[y * W + x] = c;
  }

  // 3) brillitos sueltos (pequeños destellos blancos)
  const inner = W - PAD * 2;
  [[2, 2], [inner - 4, 2], [Math.floor(inner / 2), 2]].forEach(([sx, sy]) => {
    if (at(PAD + sx, PAD + sy)) col[(PAD + sy) * W + PAD + sx] = '#ffffff';
  });

  // 4) goteos que cuelgan de la parte baja de las letras, con su gota al final
  let seed = dripSeed;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const bottom = PAD + LH - 1;
  for (let x = PAD; x < W - PAD - 1; x += 4) {
    if (!at(x, bottom) || !at(x + 1, bottom) || rnd() < 0.4) continue;
    const len = 2 + Math.floor(rnd() * (DRIP - 3));
    for (let k = 1; k <= len; k++) {
      col[(bottom + k) * W + x] = pal.drip;
      col[(bottom + k) * W + x + 1] = k === len ? pal.low : pal.mid;
    }
    col[(bottom + len + 1) * W + x] = pal.mid;
  }

  // 5) borde oscuro con volumen: rodea la letra y además baja DEPTH píxeles
  const ink = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled(x, y)) continue;
    for (let d = 0; d <= DEPTH; d++) if (near(x, y - d, 1)) { ink[y * W + x] = 1; break; }
  }
  ink.forEach((v, i) => { if (v) col[i] = INK; });

  // 6) filo claro alrededor de todo, para que el logo se lea sobre cualquier fondo
  const rim = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!filled(x, y) && near(x, y, 1)) rim[y * W + x] = 1;
  }
  rim.forEach((v, i) => { if (v) col[i] = RIM; });

  col.forEach((c, i) => {
    if (c === null) return;
    ctx.fillStyle = c;
    ctx.fillRect(x0 + (i % W), y0 + Math.floor(i / W), 1, 1);
  });
}

// Devuelve un <canvas> con el logo (se amplía con CSS sin suavizado)
export function makeTitleCanvas() {
  const first = 'ZOMBIE', second = 'SCAPE';
  const a = wordSize(first), b = wordSize(second);
  const W = Math.max(a.w, b.w);
  const y2 = LH + PAD + 6;            // la segunda palabra tapa un poco los goteos de la primera
  const H = y2 + b.h;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.className = 'logo-px';
  const ctx = cv.getContext('2d');

  drawWord(ctx, first, Math.floor((W - a.w) / 2), 0, GREEN, 7);
  drawWord(ctx, second, Math.floor((W - b.w) / 2), y2, RED, 21);
  return cv;
}
