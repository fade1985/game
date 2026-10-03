// ─────────────────────────────────────────────
//  Muebles y decoración de las habitaciones
//
//  Los muebles van pegados a las paredes (nunca delante de una puerta) y son
//  obstáculos rectangulares: paran a los personajes y a las balas.
//  Cada mueble se dibuja "mirando" a la habitación: en coordenadas locales,
//  -dep/2 es el lado de la pared y +dep/2 el lado de la sala.
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE } from './config.js';

const TAU = Math.PI * 2;

// Catálogo: largo a lo largo de la pared (len) y fondo hacia la sala (dep)
const PIECES = {
  sofa:      { len: 150, dep: 62 },
  tv:        { len: 120, dep: 40 },
  armchair:  { len: 64,  dep: 60 },
  bookshelf: { len: 120, dep: 34 },
  lamp:      { len: 38,  dep: 38 },
  counter:   { len: 160, dep: 50 },
  fridge:    { len: 62,  dep: 58 },
  stove:     { len: 70,  dep: 52 },
  bed:       { len: 100, dep: 140 },
  wardrobe:  { len: 130, dep: 44 },
  nightstand:{ len: 42,  dep: 40 },
  desk:      { len: 110, dep: 50 },
  shoerack:  { len: 100, dep: 34 },
  coatstand: { len: 38,  dep: 38 },
  console:   { len: 110, dep: 34 },
  bathtub:   { len: 150, dep: 72 },
  toilet:    { len: 46,  dep: 58 },
  sink:      { len: 70,  dep: 46 },
  washer:    { len: 60,  dep: 58 },
  plant:     { len: 44,  dep: 44 },
};

// Qué muebles puede tener cada estilo de habitación
const BY_STYLE = {
  'Salón':      ['sofa', 'tv', 'armchair', 'bookshelf', 'lamp', 'plant'],
  'Cocina':     ['counter', 'fridge', 'stove', 'counter', 'plant'],
  'Dormitorio': ['bed', 'wardrobe', 'nightstand', 'desk', 'lamp'],
  'Pasillo':    ['shoerack', 'coatstand', 'console', 'plant', 'bookshelf'],
  'Baño':       ['bathtub', 'toilet', 'sink', 'washer'],
};

// Tramos de pared libres (sin puerta) donde se pueden poner muebles
const GAP = DOOR_W / 2 + 44;
const SEGMENTS = [
  { side: 'top', a: WALL + 4, b: W / 2 - GAP },
  { side: 'top', a: W / 2 + GAP, b: W - WALL - 4 },
  { side: 'bottom', a: WALL + 4, b: W / 2 - GAP },
  { side: 'bottom', a: W / 2 + GAP, b: W - WALL - 4 },
  { side: 'left', a: WALL + 4, b: H / 2 - GAP },
  { side: 'left', a: H / 2 + GAP, b: H - WALL - 4 },
  { side: 'right', a: WALL + 4, b: H / 2 - GAP },
  { side: 'right', a: H / 2 + GAP, b: H - WALL - 4 },
];

const ROT = { top: 0, right: Math.PI / 2, bottom: Math.PI, left: -Math.PI / 2 };

// Coloca entre `min` y `max` muebles al azar (con el generador `rng` de la sala)
export function placeFurniture(styleName, rng, min, max) {
  const pool = BY_STYLE[styleName] || BY_STYLE['Pasillo'];
  const want = min + Math.floor(rng() * (max - min + 1));
  const placed = [];
  for (let tries = 0; placed.length < want && tries < 80; tries++) {
    const kind = pool[Math.floor(rng() * pool.length)];
    const pc = PIECES[kind];
    const seg = SEGMENTS[Math.floor(rng() * SEGMENTS.length)];
    if (seg.b - seg.a < pc.len) continue;
    const along = seg.a + pc.len / 2 + rng() * (seg.b - seg.a - pc.len);
    const horiz = seg.side === 'top' || seg.side === 'bottom';
    const o = { shape: 'rect', kind, side: seg.side, len: pc.len, dep: pc.dep, seed: rng() };
    if (horiz) {
      o.x = along; o.w = pc.len; o.h = pc.dep;
      o.y = seg.side === 'top' ? WALL + pc.dep / 2 : H - WALL - pc.dep / 2;
    } else {
      o.y = along; o.w = pc.dep; o.h = pc.len;
      o.x = seg.side === 'left' ? WALL + pc.dep / 2 : W - WALL - pc.dep / 2;
    }
    const clash = placed.some((p) => Math.abs(p.x - o.x) < (p.w + o.w) / 2 + 10 && Math.abs(p.y - o.y) < (p.h + o.h) / 2 + 10);
    if (!clash) placed.push(o);
  }
  return placed;
}

// Decoración de la pared de arriba: cuadros, ventanas y relojes.
// Evita la puerta, la barra de objetos (izquierda) y el minimapa (derecha).
export function placeWallDecor(rng) {
  const out = [];
  // a la derecha de la puerta queda sitio para la insignia de las salas especiales
  for (const [a, b] of [[236, W / 2 - 80], [W / 2 + 128, 716]]) {
    if (rng() < 0.25) continue;
    const r = rng();
    const kind = r < 0.4 ? 'window' : r < 0.75 ? 'picture' : 'clock';
    const w = kind === 'window' ? 84 : kind === 'picture' ? 56 + rng() * 14 : 34;
    const foot = kind === 'window' ? w + 20 : w; // la ventana lleva cortinas a los lados
    out.push({ kind, x: a + foot / 2 + rng() * Math.max(0, b - a - foot), w, seed: rng(), hue: Math.floor(rng() * 4) });
  }
  return out;
}

// ═════════════ Dibujo ═════════════

function box(ctx, x, y, w, h, r, fill, lw = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
}

function circle(ctx, x, y, r, fill, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
}

// Luz cálida en el suelo (lámparas)
export function drawFurnitureLight(ctx, f) {
  if (f.kind !== 'lamp' && f.kind !== 'nightstand') return;
  const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, 120);
  g.addColorStop(0, 'rgba(255, 230, 150, 0.35)');
  g.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(f.x - 120, f.y - 120, 240, 240);
}

export function drawFurniture(ctx, f) {
  // sombra hacia abajo
  ctx.fillStyle = 'rgba(20, 16, 40, 0.2)';
  ctx.beginPath();
  ctx.roundRect(f.x - f.w / 2 + 3, f.y - f.h / 2 + 7, f.w, f.h, 8);
  ctx.fill();

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(ROT[f.side]);
  ctx.lineJoin = 'round';
  const L = f.len, D = f.dep;
  const x0 = -L / 2, y0 = -D / 2;
  const sofaColors = ['#e76f51', '#4f86c6', '#6a994e', '#b5838d'];
  const c = sofaColors[Math.floor(f.seed * sofaColors.length)];

  switch (f.kind) {
    case 'sofa':
    case 'armchair': {
      box(ctx, x0, y0, L, D, 12, c);
      box(ctx, x0 + 4, y0 + 2, L - 8, 18, 8, shade(c, -0.12), 2.5);   // respaldo
      box(ctx, x0 + 2, y0 + 6, 16, D - 10, 7, shade(c, -0.06), 2.5);  // reposabrazos
      box(ctx, -x0 - 18, y0 + 6, 16, D - 10, 7, shade(c, -0.06), 2.5);
      const n = f.kind === 'sofa' ? 3 : 1;
      const cw = (L - 40) / n;
      for (let i = 0; i < n; i++) box(ctx, x0 + 20 + i * cw + 1, y0 + 20, cw - 2, D - 26, 6, shade(c, 0.08), 2.5);
      break;
    }
    case 'tv': {
      box(ctx, x0, y0 + 6, L, D - 6, 6, '#8d6346');
      box(ctx, x0 + 12, y0 + 2, L - 24, 12, 3, '#2b2d42');
      ctx.fillStyle = '#5c7cfa';
      ctx.fillRect(x0 + 16, y0 + 5, L - 32, 5);
      circle(ctx, x0 + 14, y0 + D - 10, 4, '#3a3355', 2);
      circle(ctx, -x0 - 14, y0 + D - 10, 4, '#3a3355', 2);
      break;
    }
    case 'bookshelf': {
      box(ctx, x0, y0, L, D, 4, '#9c6644');
      const cols = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#ffd23f', '#9b5de5'];
      let bx = x0 + 6;
      let i = Math.floor(f.seed * 10);
      while (bx < -x0 - 10) {
        const bw = 7 + ((i * 7) % 5);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(bx, y0 + 5, bw - 1, D - 12);
        bx += bw; i++;
      }
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
      ctx.strokeRect(x0 + 4, y0 + 4, L - 8, D - 10);
      break;
    }
    case 'lamp': {
      circle(ctx, 0, 0, 17, '#ffe8a3');
      circle(ctx, 0, 0, 9, '#fff6d5', 2);
      break;
    }
    case 'plant': {
      circle(ctx, 0, 2, 18, '#d9774b');
      circle(ctx, 0, 2, 13, '#7a4a2e', 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + f.seed * 6;
        ctx.save();
        ctx.translate(Math.cos(a) * 7, Math.sin(a) * 7 - 3);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(8, 0, 14, 6, 0, 0, TAU);
        ctx.fillStyle = i % 2 ? '#5bbf5a' : '#4aa64a';
        ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'counter': {
      box(ctx, x0, y0, L, D, 5, '#e9ecef');
      ctx.fillStyle = '#ced4da';
      ctx.fillRect(x0 + 3, y0 + D - 12, L - 6, 9);
      // fregadero
      box(ctx, x0 + 14, y0 + 8, 46, D - 22, 8, '#adb5bd', 2.5);
      box(ctx, x0 + 19, y0 + 12, 36, D - 30, 6, '#8fa3b5', 2);
      circle(ctx, x0 + 37, y0 + 6, 4, '#868e96', 2);
      // tabla de cortar con un tomate
      box(ctx, x0 + 80, y0 + 10, 40, 24, 4, '#d4a373', 2.5);
      circle(ctx, x0 + 100, y0 + 22, 6, '#e63946', 2);
      break;
    }
    case 'fridge': {
      box(ctx, x0, y0, L, D, 8, '#f8f9fa');
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(x0 + 4, y0 + D * 0.4); ctx.lineTo(-x0 - 4, y0 + D * 0.4); ctx.stroke();
      box(ctx, -x0 - 14, y0 + D * 0.5, 5, D * 0.35, 2, '#adb5bd', 2);
      circle(ctx, x0 + 14, y0 + 12, 4, '#ff5d73', 2);
      circle(ctx, x0 + 26, y0 + 16, 4, '#ffd23f', 2);
      break;
    }
    case 'stove': {
      box(ctx, x0, y0, L, D, 6, '#343a40');
      for (const [bx, by] of [[-16, -10], [16, -10], [-16, 12], [16, 12]]) {
        circle(ctx, bx, by, 9, '#495057', 2);
        circle(ctx, bx, by, 4, '#212529', 0);
      }
      break;
    }
    case 'bed': {
      box(ctx, x0, y0, L, D, 8, '#8d6346');
      box(ctx, x0 + 6, y0 + 6, L - 12, D - 12, 6, '#ffffff', 2.5);
      box(ctx, x0 + 14, y0 + 10, L - 28, 24, 10, '#f1f3f5', 2.5);  // almohada
      const quilt = ['#ff8fab', '#80b3ff', '#ffd166', '#95d5b2'][Math.floor(f.seed * 4)];
      box(ctx, x0 + 4, y0 + 44, L - 8, D - 50, 8, quilt, 3);         // edredón
      ctx.fillStyle = shade(quilt, 0.2);
      ctx.fillRect(x0 + 6, y0 + 46, L - 12, 10);
      break;
    }
    case 'wardrobe': {
      box(ctx, x0, y0, L, D, 4, '#b07d4f');
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(0, y0 + 4); ctx.lineTo(0, -y0 - 2); ctx.stroke();
      circle(ctx, -6, y0 + D - 10, 3, '#ffd23f', 2);
      circle(ctx, 6, y0 + D - 10, 3, '#ffd23f', 2);
      break;
    }
    case 'nightstand': {
      box(ctx, x0, y0, L, D, 5, '#b07d4f');
      circle(ctx, 0, 0, 11, '#ffe8a3', 2.5);
      circle(ctx, 0, 0, 5, '#fff6d5', 2);
      break;
    }
    case 'desk': {
      box(ctx, x0, y0, L, D, 5, '#c08552');
      box(ctx, x0 + 18, y0 + 6, 46, 30, 3, '#adb5bd', 2.5); // portátil
      ctx.fillStyle = '#4dabf7';
      ctx.fillRect(x0 + 22, y0 + 9, 38, 10);
      box(ctx, x0 + 76, y0 + 14, 18, 18, 9, '#ffffff', 2.5);  // taza
      break;
    }
    case 'shoerack': {
      box(ctx, x0, y0, L, D, 4, '#a47148');
      const cols = ['#e63946', '#1d3557', '#ffffff', '#2a9d8f'];
      for (let i = 0; i < 4; i++) {
        const sx = x0 + 14 + i * ((L - 28) / 3);
        for (const k of [-4, 4]) {
          ctx.beginPath();
          ctx.ellipse(sx + k, 0, 3.5, 9, 0, 0, TAU);
          ctx.fillStyle = cols[(i + Math.floor(f.seed * 4)) % 4];
          ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
      }
      break;
    }
    case 'coatstand': {
      circle(ctx, 0, 0, 16, '#6c584c');
      const cols = ['#e76f51', '#457b9d', '#ffd23f'];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + f.seed * 3;
        circle(ctx, Math.cos(a) * 10, Math.sin(a) * 10, 9, cols[i], 2.5);
      }
      circle(ctx, 0, 0, 5, '#3a2e26', 2);
      break;
    }
    case 'console': {
      box(ctx, x0, y0, L, D, 5, '#c08552');
      box(ctx, x0 + 14, y0 + 7, 20, 20, 10, '#9fdcf2', 2.5);  // jarrón
      circle(ctx, x0 + 24, y0 + 13, 4, '#ff8fab', 2);
      ctx.beginPath(); ctx.ellipse(10, 0, 16, 9, 0, 0, TAU);   // cuenco de llaves
      ctx.fillStyle = '#e9c46a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      break;
    }
    case 'bathtub': {
      box(ctx, x0, y0, L, D, 22, '#ffffff');
      box(ctx, x0 + 8, y0 + 8, L - 16, D - 16, 16, '#8ecae6', 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(x0 + 26 + i * 26, y0 + 22 + (i % 2) * 14, 6 + (i % 3) * 2, 0, TAU); ctx.fill();
      }
      circle(ctx, x0 + 22, y0 + 4, 5, '#adb5bd', 2);
      // patito de goma
      circle(ctx, -x0 - 34, 4, 7, '#ffd23f', 2);
      circle(ctx, -x0 - 30, -2, 4.5, '#ffd23f', 2);
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(-x0 - 27, -2, 4, 2.5);
      break;
    }
    case 'toilet': {
      box(ctx, x0 + 4, y0, L - 8, 18, 5, '#ffffff');
      ctx.beginPath(); ctx.ellipse(0, y0 + 36, 18, 20, 0, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, y0 + 37, 11, 13, 0, 0, TAU);
      ctx.fillStyle = '#bde0fe'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      break;
    }
    case 'sink': {
      box(ctx, x0, y0, L, D, 6, '#e9ecef');
      ctx.beginPath(); ctx.ellipse(0, 2, 22, 13, 0, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      circle(ctx, 0, y0 + 6, 4, '#adb5bd', 2);
      box(ctx, -x0 - 14, y0 + 8, 8, 14, 3, '#ff8fab', 2);   // cepillo de dientes
      break;
    }
    case 'washer': {
      box(ctx, x0, y0, L, D, 6, '#f8f9fa');
      circle(ctx, 0, 4, 18, '#ced4da', 2.5);
      circle(ctx, 0, 4, 12, '#74c0fc', 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-4, 0, 4, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// Cuadros, ventanas y relojes de la pared de arriba
export function drawWallDecor(ctx, d, time) {
  const cy = WALL / 2 + 2;
  ctx.save();
  ctx.lineJoin = 'round';
  if (d.kind === 'window') {
    const w = d.w, h = 36;
    box(ctx, d.x - w / 2, cy - h / 2, w, h, 4, '#9fdcf2');
    // nubes
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const cx = d.x - w / 2 + ((time * 6 + d.seed * 80) % (w + 30)) - 15;
    ctx.save();
    ctx.beginPath(); ctx.rect(d.x - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4); ctx.clip();
    ctx.beginPath(); ctx.ellipse(cx, cy - 4, 12, 5, 0, 0, TAU); ctx.ellipse(cx + 8, cy - 7, 8, 5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(d.x, cy - h / 2); ctx.lineTo(d.x, cy + h / 2); ctx.moveTo(d.x - w / 2, cy); ctx.lineTo(d.x + w / 2, cy); ctx.stroke();
    // cortinas
    for (const k of [-1, 1]) box(ctx, d.x + k * (w / 2 + 2) - 7, cy - h / 2 - 3, 14, h + 6, 5, ['#ff8fab', '#ffd166', '#95d5b2', '#b8c0ff'][d.hue], 2.5);
  } else if (d.kind === 'picture') {
    const w = d.w, h = 34;
    box(ctx, d.x - w / 2, cy - h / 2, w, h, 3, '#c08552');
    ctx.fillStyle = ['#bde0fe', '#ffd6a5', '#caffbf', '#ffc6ff'][d.hue];
    ctx.fillRect(d.x - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10);
    // paisaje: monte y sol
    ctx.save();
    ctx.beginPath(); ctx.rect(d.x - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10); ctx.clip();
    ctx.fillStyle = '#6a994e';
    ctx.beginPath(); ctx.ellipse(d.x - 6, cy + 14, w * 0.45, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(d.x + w * 0.22, cy - 5, 5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE;
    ctx.strokeRect(d.x - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10);
  } else {
    circle(ctx, d.x, cy, 16, '#ffffff');
    ctx.lineCap = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    const a1 = time * 0.5 + d.seed * 6, a2 = time * 0.05 + d.seed * 3;
    ctx.beginPath();
    ctx.moveTo(d.x, cy); ctx.lineTo(d.x + Math.sin(a1) * 11, cy - Math.cos(a1) * 11);
    ctx.moveTo(d.x, cy); ctx.lineTo(d.x + Math.sin(a2) * 7, cy - Math.cos(a2) * 7);
    ctx.stroke();
    circle(ctx, d.x, cy, 2.5, '#ff5d73', 0);
  }
  ctx.restore();
}

// Rayo de luz que entra por las ventanas y cae en el suelo
export function drawWindowLight(ctx, d) {
  if (d.kind !== 'window') return;
  ctx.fillStyle = 'rgba(255, 250, 220, 0.16)';
  ctx.beginPath();
  ctx.moveTo(d.x - d.w / 2, WALL);
  ctx.lineTo(d.x + d.w / 2, WALL);
  ctx.lineTo(d.x + d.w / 2 + 60, WALL + 150);
  ctx.lineTo(d.x - d.w / 2 + 60, WALL + 150);
  ctx.closePath();
  ctx.fill();
}

// Aclara (k > 0) u oscurece (k < 0) un color "#rrggbb"
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
