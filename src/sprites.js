// ─────────────────────────────────────────────
//  Sprites de pixel art
//
//  Cada sprite es una hoja PNG en cuadrícula + un JSON que dice dónde está
//  cada animación y dirección (lo genera tools/pixellab.mjs a partir de lo
//  que exporta PixelLab). Formato del JSON:
//
//    {
//      "cell": [32, 32],          tamaño de cada fotograma (píxeles de dibujo)
//      "pivot": [16, 29],         punto del fotograma que va en (x, y) de la entidad (los pies)
//      "anims": {
//        "idle": { "fps": 4,  "loop": true, "dirs": { "south": { "row": 0, "frames": 1 }, ... } },
//        "walk": { "fps": 10, "loop": true, "dirs": { ... } }
//      }
//    }
//
//  Si un sprite no existe (todavía no se ha dibujado), drawSprite devuelve
//  false y cada entidad usa su dibujo de siempre. Así se puede migrar poco a poco.
// ─────────────────────────────────────────────
import { PIXEL } from './config.js';

const sheets = new Map();     // id → { img, white, meta }

// En el lienzo pequeño (fondo) los sprites se ajustan a la cuadrícula de píxeles del dibujo.
// Los personajes se dibujan a resolución de pantalla en su posición exacta: así se mueven
// con suavidad y sus píxeles siguen nítidos.
let gridSnap = true;
export function setGridSnap(on) { gridSnap = on; }
const snap = (v) => (gridSnap ? Math.round(v / PIXEL) * PIXEL : v);
const BASE = 'assets/sprites/';

// Direcciones en el orden de los ángulos (0 = este, sentido horario porque y crece hacia abajo)
const DIR8 = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

// Convierte un vector (x, y) en una de las 8 direcciones de PixelLab
export function dirFromVector(x, y) {
  if (!x && !y) return 'south';
  const a = Math.atan2(y, x);
  const i = Math.round(a / (Math.PI / 4));
  return DIR8[(i + 8) % 8];
}

// Si una animación no tiene esa dirección, busca la más parecida que sí tenga
const FALLBACK = {
  'south-east': ['east', 'south'], 'south-west': ['west', 'south'],
  'north-east': ['east', 'north'], 'north-west': ['west', 'north'],
  east: ['south-east', 'north-east'], west: ['south-west', 'north-west'],
  north: ['north-east', 'north-west'], south: ['south-east', 'south-west'],
};

// Carga la lista de sprites (assets/sprites/manifest.json: ["conserje", "zombi-normal", ...])
export async function loadSprites() {
  let ids = [];
  try {
    const r = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
    if (r.ok) ids = await r.json();
  } catch { /* sin sprites todavía */ }
  await Promise.all(ids.map((id) => loadSheet(id).catch((e) => console.warn(`sprite ${id}:`, e.message))));
  return [...sheets.keys()];
}

async function loadSheet(id) {
  const [meta, img] = await Promise.all([
    fetch(`${BASE}${id}.json`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('sin JSON'); return r.json(); }),
    new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => fail(new Error('sin PNG'));
      im.src = `${BASE}${id}.png`;
    }),
  ]);
  registerSheet(id, img, meta);
}

// Registra una hoja ya cargada (también lo usan las pruebas)
export function registerSheet(id, img, meta) {
  // versión blanca de la hoja para el destello al recibir un golpe
  const white = document.createElement('canvas');
  white.width = img.width; white.height = img.height;
  const w = white.getContext('2d');
  w.drawImage(img, 0, 0);
  w.globalCompositeOperation = 'source-in';
  w.fillStyle = '#ffffff';
  w.fillRect(0, 0, white.width, white.height);
  if (!Array.isArray(meta.pivot)) meta.pivot = findFeet(img, meta);
  sheets.set(id, { img, white, meta });
}

// Punto de apoyo automático: centro horizontal y la fila más baja con píxeles
// del primer fotograma "idle" mirando al sur (los pies del personaje)
function findFeet(img, meta) {
  const [cw, ch] = meta.cell;
  const d = meta.anims.idle?.dirs.south || { row: 0, col: 0 };
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.drawImage(img, (d.col || 0) * cw, d.row * ch, cw, ch, 0, 0, cw, ch);
  const data = x.getImageData(0, 0, cw, ch).data;
  for (let y = ch - 1; y >= 0; y--) {
    for (let i = 0; i < cw; i++) if (data[(y * cw + i) * 4 + 3] > 0) return [cw / 2, y + 1];
  }
  return [cw / 2, ch];
}

export const hasSprite = (id) => sheets.has(id);

// Dibuja el fotograma que toca. `t` es el tiempo de la animación en segundos.
// Opciones: flash (blanco), alpha, scale (1 = tamaño natural), frame (forzar fotograma).
// Devuelve false si el sprite o la animación no existen.
export function drawSprite(ctx, id, anim, dir, t, x, y, o = {}) {
  const sh = sheets.get(id);
  if (!sh) return false;
  const a = sh.meta.anims[anim] || sh.meta.anims.idle;
  if (!a) return false;
  let d = a.dirs[dir];
  if (!d) for (const alt of FALLBACK[dir] || []) if ((d = a.dirs[alt])) break;
  if (!d) d = Object.values(a.dirs)[0];
  if (!d) return false;
  const [cw, ch] = sh.meta.cell;
  const [px, py] = sh.meta.pivot || [cw / 2, ch];
  let f = o.frame ?? Math.floor(t * (a.fps || 8));
  f = a.loop === false ? Math.min(f, d.frames - 1) : ((f % d.frames) + d.frames) % d.frames;
  const col = (d.col || 0) + f;
  const s = (o.scale || 1) * PIXEL; // 1 píxel de dibujo = PIXEL unidades lógicas
  // ajustamos a la cuadrícula de píxeles para que no se vea borroso
  const dx = snap(x - px * s), dy = snap(y - py * s);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(o.flash ? sh.white : sh.img, col * cw, d.row * ch, cw, ch, dx, dy, cw * s, ch * s);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
  return true;
}

// Sombra ovalada en el suelo, ajustada a píxeles (los sprites no la traen)
export function pixelShadow(ctx, x, y, w) {
  const sx = snap(x), sy = snap(y);
  ctx.fillStyle = 'rgba(20, 16, 40, 0.28)';
  ctx.fillRect(sx - w / 2 + PIXEL * 2, sy - PIXEL * 2, w - PIXEL * 4, PIXEL * 4);
  ctx.fillRect(sx - w / 2, sy - PIXEL, w, PIXEL * 2);
}

// Duración de una animación (para saber cuándo termina una que no se repite)
export function animDuration(id, anim) {
  const a = sheets.get(id)?.meta.anims[anim];
  if (!a) return 0;
  const d = Object.values(a.dirs)[0];
  return d ? d.frames / (a.fps || 8) : 0;
}
