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

const sheets = new Map();     // id → { img, meta }

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

// Carga la lista de sprites (assets/sprites/manifest.json: ["conserje-48", "zombi-normal", ...]) en dos tandas:
// primero las hojas cuyo nombre empieza por algo de `primero` (lo que necesita el menú) y luego el resto.
// Devuelve dos promesas, { primero, todos }, que dan la lista de sprites cargados al terminar cada tanda.
export function loadSprites(primero = []) {
  const lista = fetch(`${BASE}manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []); // sin sprites todavía
  const cargar = (ids) => Promise.all(ids.map((id) => loadSheet(id).catch((e) => console.warn(`sprite ${id}:`, e.message))));
  const esDelMenu = (id) => primero.some((p) => id.startsWith(p));
  const tanda1 = lista.then((ids) => cargar(ids.filter(esDelMenu))).then(() => [...sheets.keys()]);
  const tanda2 = tanda1.then(() => lista).then((ids) => cargar(ids.filter((id) => !esDelMenu(id)))).then(() => [...sheets.keys()]);
  return { primero: tanda1, todos: tanda2 };
}

async function loadSheet(id) {
  const [meta, img] = await Promise.all([
    fetch(`${BASE}${id}.json`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('sin JSON'); return r.json(); }),
    new Promise((ok, fail) => {
      const im = new Image();
      // decode() descomprime el PNG fuera del hilo del juego: así, al llegar cada hoja, no se nota un tirón
      im.onload = () => im.decode().then(() => ok(im), () => ok(im));
      im.onerror = () => fail(new Error('sin PNG'));
      im.src = `${BASE}${id}.png`;
    }),
  ]);
  registerSheet(id, img, meta);
}

// Registra una hoja ya cargada (también lo usan las pruebas)
export function registerSheet(id, img, meta) {
  if (!Array.isArray(meta.pivot)) meta.pivot = findFeet(img, meta);
  sheets.set(id, { img, meta });
}

// Destello blanco al recibir un golpe: se pinta de blanco solo el fotograma que toca, en un lienzo pequeño.
// (Antes se hacía una copia blanca de cada hoja entera al cargarla: las de los zombis son enormes y eso
// frenaba el juego uno o dos segundos al empezar, además de gastar mucha memoria.)
// Con `tint` ({ color, alpha, mode }) en vez de blanco entero se le echa una capa de color por encima
// (el naranja de un zombi en llamas): `alpha` dice cuánto se nota, de 0 a 1, y `mode` cómo se mezcla
// ("overlay" por defecto; "multiply" oscurece todo conservando las sombras: el cadáver carbonizado).
// Ojo: el lienzo pequeño se reutiliza, así que el resultado hay que dibujarlo enseguida.
//
// Rendimiento: cada fotograma ya pintado (blanco o teñido) se guarda en TINTED para reutilizarlo. Así un zombi
// en llamas o un cadáver carbonizado no repite la mezcla de colores en cada fotograma (con muchos a la vez,
// rehacerla siempre frenaba el juego). La transparencia del tinte se redondea a décimas para que basten
// pocas copias; si se juntan demasiadas, se vacía y se empieza de nuevo.
const TINTED = new Map();
const TINTED_MAX = 600;
function tintedFrame(id, img, sx, sy, cw, ch, tint) {
  const a = tint ? Math.round(tint.alpha * 10) / 10 : 0;
  const key = tint ? `${id}|${sx}|${sy}|${tint.color}|${tint.mode || ''}|${a}` : `${id}|${sx}|${sy}|blanco`;
  let c = TINTED.get(key);
  if (!c) {
    if (TINTED.size >= TINTED_MAX) TINTED.clear();
    const src = paintFrame(img, sx, sy, cw, ch, tint && { ...tint, alpha: a });
    c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(src, 0, 0, cw, ch, 0, 0, cw, ch);
    TINTED.set(key, c);
  }
  return c;
}

let flashCanvas = null;
function paintFrame(img, sx, sy, cw, ch, tint) {
  if (!flashCanvas) flashCanvas = document.createElement('canvas');
  if (flashCanvas.width < cw || flashCanvas.height < ch) {
    flashCanvas.width = Math.max(flashCanvas.width, cw);
    flashCanvas.height = Math.max(flashCanvas.height, ch);
  }
  const f = flashCanvas.getContext('2d');
  f.globalCompositeOperation = 'copy';
  f.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
  if (tint) {
    // "overlay" (superponer): aclara los tonos medios hacia el color y deja el contorno y las sombras oscuros;
    // como pinta también fuera del dibujo, luego se recorta con la silueta del fotograma (destination-in)
    f.globalCompositeOperation = tint.mode || 'overlay';
    f.globalAlpha = tint.alpha;
    f.fillStyle = tint.color;
    f.fillRect(0, 0, cw, ch);
    f.globalAlpha = 1;
    f.globalCompositeOperation = 'destination-in';
    f.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
  } else {
    f.globalCompositeOperation = 'source-in';
    f.fillStyle = '#ffffff';
    f.fillRect(0, 0, cw, ch);
  }
  f.globalCompositeOperation = 'source-over';
  return flashCanvas;
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
// Cuántas hojas hay cargadas (sirve para saber si hay que rehacer un dibujo guardado: puede haber llegado su textura)
export const spriteCount = () => sheets.size;

// Dibuja el fotograma que toca. `t` es el tiempo de la animación en segundos.
// Opciones: flash (blanco), tint ({ color, alpha }: capa de color), alpha, scale (1 = tamaño natural), frame (forzar fotograma), cycle (ver abajo).
// Devuelve false si el sprite o la animación no existen.
// Datos del .json de una hoja (medidas, escala…), o undefined si no está cargada
export const spriteMeta = (id) => sheets.get(id)?.meta;

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
  // o.cycle: en qué punto del ciclo va (0 = principio, 1 = una vuelta), tenga los fotogramas que tenga
  let f = o.frame ?? (o.cycle !== undefined ? Math.floor(o.cycle * d.frames) : Math.floor(t * (a.fps || 8)));
  f = a.loop === false ? Math.min(f, d.frames - 1) : ((f % d.frames) + d.frames) % d.frames;
  const col = (d.col || 0) + f;
  const s = (o.scale || 1) * PIXEL; // 1 píxel de dibujo = PIXEL unidades lógicas
  // ajustamos a la cuadrícula de píxeles para que no se vea borroso
  const dx = snap(x - px * s), dy = snap(y - py * s);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  // las texturas de mucho detalle ("suave" en su .json) se dibujan suavizadas; el pixel art, nunca
  ctx.imageSmoothingEnabled = !!sh.meta.suave;
  if (o.flash || o.tint) ctx.drawImage(tintedFrame(id, sh.img, col * cw, d.row * ch, cw, ch, o.flash ? null : o.tint), 0, 0, cw, ch, dx, dy, cw * s, ch * s);
  else ctx.drawImage(sh.img, col * cw, d.row * ch, cw, ch, dx, dy, cw * s, ch * s);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  return true;
}

// Sombra ovalada en el suelo, ajustada a píxeles (los sprites no la traen)
export function pixelShadow(ctx, x, y, w) {
  const sx = snap(x), sy = snap(y);
  ctx.fillStyle = 'rgba(20, 16, 40, 0.28)';
  ctx.fillRect(sx - w / 2 + PIXEL * 2, sy - PIXEL * 2, w - PIXEL * 4, PIXEL * 4);
  ctx.fillRect(sx - w / 2, sy - PIXEL, w, PIXEL * 2);
}

// Cuántos fotogramas tiene una animación (0 si el sprite no la tiene)
export function animFrames(id, anim) {
  const a = sheets.get(id)?.meta.anims[anim];
  return a ? Object.values(a.dirs)[0]?.frames || 0 : 0;
}

// En qué punto de una animación de ataque (de 0 a 1) llega el golpe. Lo dice la hoja ("hit"); si no, a un tercio
export const animHit = (id, anim) => sheets.get(id)?.meta.anims[anim]?.hit ?? 1 / 3;

// Boca del arma de una hoja (armas a distancia): dónde nace la bala respecto a los pies del personaje, en
// unidades del juego, para la dirección dada. Lo dice la hoja ("muzzle"); null si no lo tiene.
export function spriteMuzzle(id, dir) {
  const m = sheets.get(id)?.meta.muzzle?.[dir];
  return m ? [m[0] * PIXEL, m[1] * PIXEL] : null;
}

// Unos cuantos puntos al azar que caen dentro del dibujo de un fotograma (para poner brasas encima de un
// cadáver, por ejemplo). Devuelve [x, y] en unidades del juego respecto a los pies; [] si no hay hoja.
// (Los píxeles del dibujo de cada fotograma se buscan una vez y se guardan en SOLIDOS: leer los píxeles de un
// lienzo es lento, y con un molotov caen muchos zombis a la vez.)
const SOLIDOS = new Map();
export function spritePoints(id, anim, dir, frame, n) {
  const sh = sheets.get(id);
  const d = sh?.meta.anims[anim]?.dirs[dir];
  if (!d) return [];
  const [cw, ch] = sh.meta.cell;
  const [px, py] = sh.meta.pivot || [cw / 2, ch];
  const col = (d.col || 0) + Math.min(frame, d.frames - 1);
  const key = `${id}|${col}|${d.row}`;
  let solid = SOLIDOS.get(key);
  if (!solid) {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const x = c.getContext('2d');
    x.drawImage(sh.img, col * cw, d.row * ch, cw, ch, 0, 0, cw, ch);
    const data = x.getImageData(0, 0, cw, ch).data;
    solid = [];
    for (let i = 0; i < cw * ch; i++) if (data[i * 4 + 3] > 200) solid.push(i);
    SOLIDOS.set(key, solid);
  }
  const out = [];
  for (let k = 0; k < n && solid.length; k++) {
    const i = solid[Math.floor(Math.random() * solid.length)];
    out.push([((i % cw) - px) * PIXEL, (Math.floor(i / cw) - py) * PIXEL]);
  }
  return out;
}

// Duración de una animación (para saber cuándo termina una que no se repite)
export function animDuration(id, anim) {
  const a = sheets.get(id)?.meta.anims[anim];
  if (!a) return 0;
  const d = Object.values(a.dirs)[0];
  return d ? d.frames / (a.fps || 8) : 0;
}
