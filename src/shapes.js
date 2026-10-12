// ─────────────────────────────────────────────
//  Forma y tamaño de las salas (solo en la versión pixel art)
//
//  Cada sala es una cuadrícula de casillas de 32 unidades (una baldosa del pixel art):
//  cada casilla es suelo o muro. Las salas de monstruos pueden ser más grandes que la
//  de siempre (30×20 casillas). La forma se consigue "mordiendo" el rectángulo con
//  bloques de muro: esquinas recortadas (salas en L, en T, en cruz...), entrantes en
//  los lados sin puerta (salas en U), columnas y, en las salas grandes, islas de muro.
//
//  Siempre queda libre el centro de la sala y un pasillo desde cada puerta hasta él,
//  así que todas las puertas se comunican y hay sitio para pedestales y escaleras.
//
//  De la cuadrícula salen tres cosas:
//    grid    la cuadrícula (1 = muro), para saber si un punto es muro y calcular caminos
//    blocks  los muros interiores como rectángulos, para los choques
//    y el camino que siguen los zombis para rodear las esquinas (wayTo)
// ─────────────────────────────────────────────
import { W, H, WALL, PIXEL_MODE } from './config.js';

export const CELL = 32;
const EDGE = WALL / CELL; // grosor en casillas de los muros de fuera

// Tamaño de la sala de siempre (960×640) en casillas
export const BASE_COLS = W / CELL;   // 30
export const BASE_ROWS = H / CELL;   // 20

const MIN_FLOOR = 0.6; // como mínimo queda este trozo del suelo original
const SHAPED_TYPES = ['monsters', 'item', 'survivor']; // la entrada y los jefes siguen siendo rectangulares

// Tamaños posibles de las salas grandes (siempre pares, para que las puertas queden centradas)
const BIG_COLS = [30, 36, 40, 44];
const BIG_ROWS = [20, 24, 28];
const BIG_CHANCE = 0.55; // cuántas salas de monstruos son más grandes que la de siempre

// Tamaño de una sala en casillas. Solo crecen las salas de monstruos de la versión pixel.
export function pickSize(type, rng) {
  if (!PIXEL_MODE || type !== 'monsters' || rng() > BIG_CHANCE) return [BASE_COLS, BASE_ROWS];
  for (;;) {
    const cols = BIG_COLS[Math.floor(rng() * BIG_COLS.length)], rows = BIG_ROWS[Math.floor(rng() * BIG_ROWS.length)];
    if (cols > BASE_COLS || rows > BASE_ROWS) return [cols, rows];
  }
}

// Dónde está cada puerta de una sala (en el centro de cada lado) y hacia dónde mira:
// `a` es el giro para dibujarla, como si todas estuvieran en el muro de arriba
export function doorSpots(layout) {
  const w = layout.w ?? W, h = layout.h ?? H;
  return {
    up: { x: w / 2, y: WALL / 2, a: 0 },
    down: { x: w / 2, y: h - WALL / 2, a: Math.PI },
    left: { x: WALL / 2, y: h / 2, a: -Math.PI / 2 },
    right: { x: w - WALL / 2, y: h / 2, a: Math.PI / 2 },
  };
}

// Sala rectangular: muro alrededor y suelo dentro
function plainGrid(cols, rows) {
  const g = new Uint8Array(cols * rows).fill(1);
  for (let r = EDGE; r < rows - EDGE; r++) for (let c = EDGE; c < cols - EDGE; c++) g[r * cols + c] = 0;
  return g;
}

// Casillas que no se pueden tapar: el centro y el pasillo de cada puerta (6 casillas de ancho)
function reservedMask(doors, cols, rows) {
  const m = new Uint8Array(cols * rows);
  const fill = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) m[r * cols + c] = 1; };
  const c0 = cols / 2 - 3, c1 = cols / 2 + 2, r0 = rows / 2 - 3, r1 = rows / 2 + 2;
  fill(c0, r0, c1, r1);
  if (doors.up) fill(c0, EDGE, c1, r0);
  if (doors.down) fill(c0, r1, c1, rows - EDGE - 1);
  if (doors.left) fill(EDGE, r0, c0, r1);
  if (doors.right) fill(c1, r0, cols - EDGE - 1, r1);
  return m;
}

// Bloques de muro al azar: [columna, fila, ancho, alto] en casillas.
// En las salas grandes los recortes crecen en proporción y aparecen islas de muro en medio.
function randomCuts(rng, doors, amount, cols, rows) {
  const sx = cols / BASE_COLS, sy = rows / BASE_ROWS;
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const wide = (a, b) => Math.round(ri(a, b) * sx), tall = (a, b) => Math.round(ri(a, b) * sy);
  const C1 = cols - EDGE, R1 = rows - EDGE;
  const cuts = [];
  const mirror = rng() < 0.5; // la mitad de las salas son simétricas: se ven más "de arquitecto"
  const corner = (right, bottom, w, h) => cuts.push([right ? C1 - w : EDGE, bottom ? R1 - h : EDGE, w, h]);

  // esquinas recortadas, a veces con un escalón
  for (const [right, bottom] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (mirror && right) continue;
    if (rng() > 0.6 * amount) continue;
    const w = wide(3, 8), h = tall(2, 5);
    corner(right, bottom, w, h);
    if (rng() < 0.4) corner(right, bottom, ri(2, Math.max(2, w - 2)), h + tall(1, 3));
  }
  // entrantes en los lados que no tienen puerta
  for (const side of ['up', 'down', 'left', 'right']) {
    if (doors[side] || (mirror && side === 'right') || rng() > 0.45 * amount) continue;
    if (side === 'up' || side === 'down') {
      const len = wide(4, 10), dep = tall(2, 4);
      cuts.push([ri(EDGE + 3, C1 - 3 - len), side === 'up' ? EDGE : R1 - dep, len, dep]);
    } else {
      const len = tall(3, 6), dep = wide(2, 5);
      cuts.push([side === 'left' ? EDGE : C1 - dep, ri(EDGE + 2, R1 - 2 - len), dep, len]);
    }
  }
  // islas de muro en las salas grandes: dan cobertura y rompen las líneas de tiro
  if (sx * sy > 1.15) {
    for (let n = ri(0, 2); n > 0; n--) {
      if (rng() > amount) continue;
      const w = ri(3, 6), h = ri(2, 4);
      cuts.push([ri(EDGE + 3, cols / 2 - 2 - w), ri(EDGE + 3, R1 - 3 - h), w, h]);
    }
  }
  if (mirror) for (const [c, r, w, h] of [...cuts]) cuts.push([cols - c - w, r, w, h]);
  // cuatro columnas alrededor del centro
  if (rng() < 0.3 * amount) {
    const c = wide(5, 9), r = tall(4, 5);
    for (const [pc, pr] of [[c, r], [cols - c - 2, r], [c, rows - r - 2], [cols - c - 2, rows - r - 2]]) cuts.push([pc, pr, 2, 2]);
  }
  return cuts;
}

// Arregla la cuadrícula: tapa los pasos de una sola casilla (los personajes no cabrían)
// y los rincones a los que no se puede llegar. Devuelve cuánto suelo queda (0..1).
function tidy(g, cols, rows) {
  const at = (c, r) => r * cols + c;
  const C1 = cols - EDGE, R1 = rows - EDGE;
  const floor = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !g[at(c, r)];
  // cuadrado de suelo de 2×2 con la esquina de arriba a la izquierda en (c, r): por ahí cabe un personaje
  const square = (c, r) => floor(c, r) && floor(c + 1, r) && floor(c, r + 1) && floor(c + 1, r + 1);
  const walls = (c, r) => !floor(c - 1, r) + !floor(c + 1, r) + !floor(c, r - 1) + !floor(c, r + 1);
  for (let changed = true; changed;) {
    changed = false;
    for (let r = EDGE; r < R1; r++) {
      for (let c = EDGE; c < C1; c++) {
        if (g[at(c, r)]) continue;
        // casilla suelta: no forma parte de ningún cuadrado de 2×2
        if (!square(c, r) && !square(c - 1, r) && !square(c, r - 1) && !square(c - 1, r - 1)) { g[at(c, r)] = 1; changed = true; continue; }
        // estrechamiento: dos casillas vecinas que no comparten ningún cuadrado de 2×2 (se taparía el paso
        // con el cuerpo). Se cierra tapando la que está más encajonada.
        if (floor(c + 1, r) && !square(c, r) && !square(c, r - 1)) {
          g[walls(c, r) > walls(c + 1, r) ? at(c, r) : at(c + 1, r)] = 1; changed = true; continue;
        }
        if (floor(c, r + 1) && !square(c, r) && !square(c - 1, r)) {
          g[walls(c, r) > walls(c, r + 1) ? at(c, r) : at(c, r + 1)] = 1; changed = true;
        }
      }
    }
  }
  // a qué casillas se llega andando desde el centro
  const seen = new Uint8Array(cols * rows);
  const start = at(cols / 2, rows / 2);
  const queue = [start];
  seen[start] = 1;
  let n = 0;
  while (queue.length) {
    const i = queue.pop();
    n++;
    for (const j of [i - 1, i + 1, i - cols, i + cols]) if (!g[j] && !seen[j]) { seen[j] = 1; queue.push(j); }
  }
  for (let i = 0; i < g.length; i++) if (!g[i] && !seen[i]) g[i] = 1;
  return n / ((C1 - EDGE) * (R1 - EDGE));
}

// Junta las casillas de muro del interior en rectángulos grandes (para los choques)
function toBlocks(g, cols, rows) {
  const C1 = cols - EDGE, R1 = rows - EDGE;
  const blocks = [];
  let open = []; // rectángulos que siguen creciendo hacia abajo: { c0, c1, r0 }
  const close = (b, r) => blocks.push({
    shape: 'rect', x: ((b.c0 + b.c1) / 2) * CELL, y: ((b.r0 + r) / 2) * CELL, w: (b.c1 - b.c0) * CELL, h: (r - b.r0) * CELL,
  });
  for (let r = EDGE; r <= R1; r++) {
    const runs = [];
    if (r < R1) {
      for (let c = EDGE; c < C1; c++) {
        if (!g[r * cols + c]) continue;
        const c0 = c;
        while (c < C1 && g[r * cols + c]) c++;
        runs.push({ c0, c1: c, r0: r });
      }
    }
    for (const b of open) {
      const same = runs.find((n) => n.c0 === b.c0 && n.c1 === b.c1);
      if (same) same.r0 = b.r0; else close(b, r);
    }
    open = runs;
  }
  return blocks;
}

// Forma de una sala de `cols` × `rows` casillas según su tipo y sus puertas. `rng` es el generador de la sala.
export function makeShape(type, doors, rng, cols = BASE_COLS, rows = BASE_ROWS) {
  if (PIXEL_MODE && SHAPED_TYPES.includes(type)) {
    const reserved = reservedMask(doors, cols, rows);
    // si una forma sale demasiado pequeña se prueba otra con menos recortes
    for (let tries = 0; tries < 8; tries++) {
      const g = plainGrid(cols, rows);
      for (const [c0, r0, w, h] of randomCuts(rng, doors, 1 - tries * 0.1, cols, rows)) {
        for (let r = Math.max(EDGE, r0); r < Math.min(rows - EDGE, r0 + h); r++) {
          for (let c = Math.max(EDGE, c0); c < Math.min(cols - EDGE, c0 + w); c++) if (!reserved[r * cols + c]) g[r * cols + c] = 1;
        }
      }
      if (tidy(g, cols, rows) >= MIN_FLOOR) return { grid: g, blocks: toBlocks(g, cols, rows) };
    }
  }
  return { grid: plainGrid(cols, rows), blocks: [] };
}

// ═════════════ Consultas ═════════════
// `layout` es la sala: { grid, cols, rows, w, h, blocks }

export function isWall(layout, x, y) {
  const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
  return c < 0 || r < 0 || c >= layout.cols || r >= layout.rows || layout.grid[r * layout.cols + c] === 1;
}

// ¿Cabe un círculo de radio `pad` en (x, y) sin tocar ningún muro?
// (mira todas las casillas que toca el cuadrado que envuelve al círculo)
export function isOpen(layout, x, y, pad) {
  return rectIsFloor(layout, x, y, pad * 2 + 2, pad * 2 + 2);
}

// ¿Es todo suelo este rectángulo (centro y tamaño)?
export function rectIsFloor(layout, x, y, w, h) {
  const { cols, rows, grid } = layout;
  const c0 = Math.floor((x - w / 2 + 1) / CELL), c1 = Math.floor((x + w / 2 - 1) / CELL);
  const r0 = Math.floor((y - h / 2 + 1) / CELL), r1 = Math.floor((y + h / 2 - 1) / CELL);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (c < 0 || r < 0 || c >= cols || r >= rows || grid[r * cols + c]) return false;
  return true;
}

// ¿Se puede ir en línea recta de un punto a otro sin chocar con un muro?
// `pad` es la anchura de quien camina (0 para una bala o una mirada).
export function lineClear(layout, x0, y0, x1, y1, pad = 0) {
  if (!layout.blocks.length) return true;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1) return true;
  const nx = (-dy / len) * pad, ny = (dx / len) * pad;
  const steps = Math.ceil(len / 12);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (dx * i) / steps, y = y0 + (dy * i) / steps;
    if (isWall(layout, x, y) || (pad && (isWall(layout, x + nx, y + ny) || isWall(layout, x - nx, y - ny)))) return false;
  }
  return true;
}

// Punto de suelo al azar con `pad` de margen hasta los muros
export function randomFloorPoint(layout, pad, rnd = Math.random) {
  for (let i = 0; i < 200; i++) {
    const x = WALL + pad + rnd() * (layout.w - 2 * WALL - 2 * pad), y = WALL + pad + rnd() * (layout.h - 2 * WALL - 2 * pad);
    if (isOpen(layout, x, y, pad)) return { x, y };
  }
  return { x: layout.w / 2, y: layout.h / 2 };
}

// ═════════════ Caminos ═════════════

// Pasos que hay desde cada casilla hasta la del objetivo (-1 = muro o inalcanzable).
// Se guarda en la propia sala y solo se recalcula cuando el objetivo cambia de casilla.
function stepsTo(layout, x, y) {
  const { cols, grid } = layout;
  const goal = Math.floor(y / CELL) * cols + Math.floor(x / CELL);
  if (layout.flowGoal === goal) return layout.flow;
  const f = layout.flow || (layout.flow = new Int16Array(grid.length));
  f.fill(-1);
  layout.flowGoal = goal;
  if (grid[goal] !== 0) return f;
  f[goal] = 0;
  const queue = [goal];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of [i - 1, i + 1, i - cols, i + cols]) if (!grid[j] && f[j] < 0) { f[j] = f[i] + 1; queue.push(j); }
  }
  return f;
}

// Hacia dónde tiene que andar `e` para llegar a `target` rodeando los muros.
// Devuelve null si puede ir en línea recta (lo normal): entonces cada uno se mueve como siempre.
export function wayTo(layout, e, target) {
  if (!layout.blocks.length) return null;
  const pad = e.r * 0.8;
  if (lineClear(layout, e.x, e.y, target.x, target.y, pad)) return null;
  const cols = layout.cols;
  const f = stepsTo(layout, target.x, target.y);
  let cur = Math.floor(e.y / CELL) * cols + Math.floor(e.x / CELL);
  if (!(f[cur] >= 0)) return null;
  // avanza unas casillas por el camino y apunta a la más lejana a la que llega en línea recta:
  // así corta las esquinas con naturalidad en vez de ir de casilla en casilla
  let aim = null;
  for (let n = 0; n < 5 && f[cur] > 0; n++) {
    let best = cur;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const j = cur + dc + dr * cols;
      if (!(f[j] >= 0) || f[j] >= f[best]) continue;
      if (dc && dr && (f[cur + dc] < 0 || f[cur + dr * cols] < 0)) continue; // en diagonal no se atraviesan esquinas
      best = j;
    }
    if (best === cur) break;
    const px = ((best % cols) + 0.5) * CELL, py = (Math.floor(best / cols) + 0.5) * CELL;
    if (aim && !lineClear(layout, e.x, e.y, px, py, pad)) break;
    aim = { x: px, y: py };
    cur = best;
  }
  if (!aim) return null;
  const dx = aim.x - e.x, dy = aim.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}
