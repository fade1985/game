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
  sheets.set(id, { img, white, meta });
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
  const dx = Math.round((x - px * s) / PIXEL) * PIXEL, dy = Math.round((y - py * s) / PIXEL) * PIXEL;
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(o.flash ? sh.white : sh.img, col * cw, d.row * ch, cw, ch, dx, dy, cw * s, ch * s);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
  return true;
}

// Duración de una animación (para saber cuándo termina una que no se repite)
export function animDuration(id, anim) {
  const a = sheets.get(id)?.meta.anims[anim];
  if (!a) return 0;
  const d = Object.values(a.dirs)[0];
  return d ? d.frames / (a.fps || 8) : 0;
}
