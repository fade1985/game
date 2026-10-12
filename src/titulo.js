// ─────────────────────────────────────────────
//  Logo "ZOMBIE SCAPE" en pixel art, dibujado con código
//  Cada letra es una cuadrícula de 5×7 que se amplía ×2; después se le
//  añaden borde, relieve, sombra y goteos de baba / sangre.
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

const S = 2;          // cada píxel de la letra ocupa S×S píxeles del dibujo
const GAP = 2;        // hueco entre letras
const LW = 5 * S;     // ancho de una letra
const LH = 7 * S;     // alto de una letra
const INK = '#1d1b2c';

// Colores por franja de la letra: luz, base, sombra y borde interior
const GREEN = { hi: '#d8ff6b', base: '#7ed321', mid: '#4fa81a', low: '#2f6f1c', drip: '#7ed321' };
const RED = { hi: '#ff9a8a', base: '#ee3b3b', mid: '#b81f2b', low: '#7a1424', drip: '#d62a33' };

// Dibuja una palabra en `ctx` con su esquina superior izquierda de letras en (x0, y0)
function drawWord(ctx, word, x0, y0, pal, dripSeed) {
  const w = word.length * (LW + GAP) - GAP;
  const pad = 3, ox = pad, oy = pad;                 // margen para el borde
  const W = w + pad * 2, H = LH + pad * 2;
  const mask = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);

  [...word].forEach((ch, i) => {
    FONT[ch].forEach((row, ry) => {
      [...row].forEach((v, rx) => {
        if (v !== '1') return;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
          mask[(oy + ry * S + dy) * W + ox + i * (LW + GAP) + rx * S + dx] = 1;
        }
      });
    });
  });

  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x0 + x, y0 + y, 1, 1); };
  const near = (x, y, r) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (at(x + i, y + j)) return true;
    return false;
  };

  // 1) sombra y borde oscuro
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W; x++) {
    if (at(x, y)) continue;
    if (near(x, y, 1)) px(x, y, INK);
    else if (at(x - 1, y - 2) || at(x, y - 2) || at(x - 1, y - 1)) px(x, y, 'rgba(29,27,44,0.45)');
  }

  // 2) cuerpo de las letras: franjas de color + relieve en los bordes
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    const ly = y - oy;
    let c = ly < 2 ? pal.hi : ly < 7 ? pal.base : ly < 11 ? pal.mid : pal.low;
    if (!at(x, y - 1) || !at(x - 1, y)) c = pal.hi;           // borde iluminado (arriba / izquierda)
    else if (!at(x, y + 1) || !at(x + 1, y)) c = pal.low;      // borde en sombra (abajo / derecha)
    px(x, y, c);
  }

  // 3) brillitos sueltos (pequeños destellos blancos)
  [[3, 1], [w - 4, 2], [Math.floor(w / 2), 1]].forEach(([sx, sy]) => {
    if (at(ox + sx, oy + sy)) px(ox + sx, oy + sy, '#ffffff');
  });

  // 4) goteos que cuelgan de la parte baja de las letras
  let seed = dripSeed;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let x = 1; x < W - 1; x += 3) {
    if (!at(x, oy + LH - 1) || !at(x + 1, oy + LH - 1) || rnd() < 0.45) continue;
    const len = 2 + Math.floor(rnd() * 6);
    for (let k = 0; k <= len; k++) {
      px(x - 1, oy + LH + k, INK); px(x + 2, oy + LH + k, INK);
      px(x, oy + LH + k, pal.drip); px(x + 1, oy + LH + k, k % 2 ? pal.mid : pal.drip);
    }
    // gota redonda al final
    px(x - 1, oy + LH + len + 1, INK); px(x + 2, oy + LH + len + 1, INK);
    px(x, oy + LH + len + 1, pal.mid); px(x + 1, oy + LH + len + 1, pal.mid);
    px(x, oy + LH + len + 2, INK); px(x + 1, oy + LH + len + 2, INK);
  }
  return { w: W, h: H };
}

// Devuelve un <canvas> con el logo (se amplía con CSS sin suavizado)
export function makeTitleCanvas() {
  const first = 'ZOMBIE', second = 'SCAPE';
  const wFirst = first.length * (LW + GAP) - GAP + 6;
  const wSecond = second.length * (LW + GAP) - GAP + 6;
  const W = Math.max(wFirst, wSecond) + 4;
  const H = 2 * (LH + 6) + 22;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.className = 'logo-px';
  const ctx = cv.getContext('2d');

  drawWord(ctx, first, Math.floor((W - wFirst) / 2), 0, GREEN, 7);
  drawWord(ctx, second, Math.floor((W - wSecond) / 2), LH + 13, RED, 21);
  return cv;
}
