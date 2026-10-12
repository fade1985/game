// ─────────────────────────────────────────────
//  Forma de las salas (solo en la versión pixel art)
//
//  Cada sala es una cuadrícula de casillas de 32 unidades (una baldosa del pixel art):
//  cada casilla es suelo o muro. La forma se consigue "mordiendo" el rectángulo de
//  siempre con bloques de muro: esquinas recortadas (salas en L, en T, en cruz...),
//  entrantes en los lados sin puerta (salas en U) y columnas.
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
export const COLS = W / CELL;   // 30
export const ROWS = H / CELL;   // 20
// casillas del interior (sin contar los muros de fuera): columnas C0..C1-1 y filas R0..R1-1
const C0 = WALL / CELL, C1 = COLS - C0;
const R0 = WALL / CELL, R1 = ROWS - R0;
// zona central que siempre queda libre y por donde pasan los pasillos de las puertas
const MID_C0 = 12, MID_C1 = 17, MID_R0 = 7, MID_R1 = 12;

const MIN_FLOOR = 0.6; // como mínimo queda este trozo del suelo original
const SHAPED_TYPES = ['monsters', 'item', 'survivor']; // la entrada y los jefes siguen siendo rectangulares

const at = (c, r) => r * COLS + c;

// Sala rectangular de siempre: muro alrededor y suelo dentro
function plainGrid() {
  const g = new Uint8Array(COLS * ROWS).fill(1);
  for (let r = R0; r < R1; r++) for (let c = C0; c < C1; c++) g[at(c, r)] = 0;
  return g;
}

// Casillas que no se pueden tapar: el centro y el pasillo de cada puerta
function reservedMask(doors) {
  const m = new Uint8Array(COLS * ROWS);
  const fill = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) m[at(c, r)] = 1; };
  fill(MID_C0, MID_R0, MID_C1, MID_R1);
  if (doors.up) fill(MID_C0, R0, MID_C1, MID_R0);
  if (doors.down) fill(MID_C0, MID_R1, MID_C1, R1 - 1);
  if (doors.left) fill(C0, MID_R0, MID_C0, MID_R1);
  if (doors.right) fill(MID_C1, MID_R0, C1 - 1, MID_R1);
  return m;
}

// Bloques de muro al azar: [columna, fila, ancho, alto] en casillas
function randomCuts(rng, doors, amount) {
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const cuts = [];
  const mirror = rng() < 0.5; // la mitad de las salas son simétricas: se ven más "de arquitecto"
  const corner = (right, bottom, w, h) => cuts.push([right ? C1 - w : C0, bottom ? R1 - h : R0, w, h]);

  // esquinas recortadas, a veces con un escalón
  for (const [right, bottom] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (mirror && right) continue;
    if (rng() > 0.6 * amount) continue;
    const w = ri(3, 8), h = ri(2, 5);
    corner(right, bottom, w, h);
    if (rng() < 0.4) corner(right, bottom, ri(2, Math.max(2, w - 2)), h + ri(1, 3));
  }
  // entrantes en los lados que no tienen puerta
  for (const side of ['up', 'down', 'left', 'right']) {
    if (doors[side] || (mirror && side === 'right') || rng() > 0.45 * amount) continue;
    if (side === 'up' || side === 'down') {
      const len = ri(4, 10), dep = ri(2, 4);
      cuts.push([ri(C0 + 3, C1 - 3 - len), side === 'up' ? R0 : R1 - dep, len, dep]);
    } else {
      const len = ri(3, 6), dep = ri(2, 5);
      cuts.push([side === 'left' ? C0 : C1 - dep, ri(R0 + 2, R1 - 2 - len), dep, len]);
    }
  }
  if (mirror) for (const [c, r, w, h] of [...cuts]) cuts.push([COLS - c - w, r, w, h]);
  // cuatro columnas alrededor del centro
  if (rng() < 0.3 * amount) {
    const c = ri(5, 9), r = ri(4, 5);
    for (const [pc, pr] of [[c, r], [COLS - c - 2, r], [c, ROWS - r - 2], [COLS - c - 2, ROWS - r - 2]]) cuts.push([pc, pr, 2, 2]);
  }
  return cuts;
}

// Arregla la cuadrícula: tapa los pasos de una sola casilla (los personajes no cabrían)
// y los rincones a los que no se puede llegar. Devuelve cuánto suelo queda (0..1).
function tidy(g) {
  const floor = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !g[at(c, r)];
  // cuadrado de suelo de 2×2 con la esquina de arriba a la izquierda en (c, r): por ahí cabe un personaje
  const square = (c, r) => floor(c, r) && floor(c + 1, r) && floor(c, r + 1) && floor(c + 1, r + 1);
  const walls = (c, r) => !floor(c - 1, r) + !floor(c + 1, r) + !floor(c, r - 1) + !floor(c, r + 1);
  for (let changed = true; changed;) {
    changed = false;
    for (let r = R0; r < R1; r++) {
      for (let c = C0; c < C1; c++) {
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
  const seen = new Uint8Array(COLS * ROWS);
  const start = at(COLS / 2, ROWS / 2);
  const queue = [start];
  seen[start] = 1;
  let n = 0;
  while (queue.length) {
    const i = queue.pop();
    n++;
    for (const j of [i - 1, i + 1, i - COLS, i + COLS]) if (!g[j] && !seen[j]) { seen[j] = 1; queue.push(j); }
  }
  for (let i = 0; i < g.length; i++) if (!g[i] && !seen[i]) g[i] = 1;
  return n / ((C1 - C0) * (R1 - R0));
}

// Junta las casillas de muro del interior en rectángulos grandes (para los choques)
function toBlocks(g) {
  const blocks = [];
  let open = []; // rectángulos que siguen creciendo hacia abajo: { c0, c1, r0 }
  const close = (b, r) => blocks.push({
    shape: 'rect', x: ((b.c0 + b.c1) / 2) * CELL, y: ((b.r0 + r) / 2) * CELL, w: (b.c1 - b.c0) * CELL, h: (r - b.r0) * CELL,
  });
  for (let r = R0; r <= R1; r++) {
    const runs = [];
    if (r < R1) {
      for (let c = C0; c < C1; c++) {
        if (!g[at(c, r)]) continue;
        const c0 = c;
        while (c < C1 && g[at(c, r)]) c++;
        runs.push({ c0, c1: c, r0: r });
      }
    }
    const next = [];
    for (const b of open) {
      const same = runs.find((n) => n.c0 === b.c0 && n.c1 === b.c1);
      if (same) same.r0 = b.r0; else close(b, r);
    }
    for (const n of runs) next.push(n);
    open = next;
  }
  return blocks;
}

// Forma de una sala según su tipo y sus puertas. `rng` es el generador de la sala.
export function makeShape(type, doors, rng) {
  if (PIXEL_MODE && SHAPED_TYPES.includes(type)) {
    const reserved = reservedMask(doors);
    // si una forma sale demasiado pequeña se prueba otra con menos recortes
    for (let tries = 0; tries < 8; tries++) {
      const g = plainGrid();
      for (const [c0, r0, w, h] of randomCuts(rng, doors, 1 - tries * 0.1)) {
        for (let r = Math.max(R0, r0); r < Math.min(R1, r0 + h); r++) {
          for (let c = Math.max(C0, c0); c < Math.min(C1, c0 + w); c++) if (!reserved[at(c, r)]) g[at(c, r)] = 1;
        }
      }
      if (tidy(g) >= MIN_FLOOR) return { grid: g, blocks: toBlocks(g) };
    }
  }
  return { grid: plainGrid(), blocks: [] };
}

// ═════════════ Consultas ═════════════

export function isWall(layout, x, y) {
  const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS || layout.grid[at(c, r)] === 1;
}

// ¿Cabe un círculo de radio `pad` en (x, y) sin tocar ningún muro?
export function isOpen(layout, x, y, pad) {
  // mira todas las casillas que toca el cuadrado que envuelve al círculo
  const c0 = Math.floor((x - pad) / CELL), c1 = Math.floor((x + pad) / CELL);
  const r0 = Math.floor((y - pad) / CELL), r1 = Math.floor((y + pad) / CELL);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (c < 0 || r < 0 || c >= COLS || r >= ROWS || layout.grid[at(c, r)]) return false;
  return true;
}

// ¿Es todo suelo este rectángulo (centro y tamaño)?
export function rectIsFloor(layout, x, y, w, h) {
  const c0 = Math.floor((x - w / 2 + 1) / CELL), c1 = Math.floor((x + w / 2 - 1) / CELL);
  const r0 = Math.floor((y - h / 2 + 1) / CELL), r1 = Math.floor((y + h / 2 - 1) / CELL);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (c < 0 || r < 0 || c >= COLS || r >= ROWS || layout.grid[at(c, r)]) return false;
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
    const x = WALL + pad + rnd() * (W - 2 * WALL - 2 * pad), y = WALL + pad + rnd() * (H - 2 * WALL - 2 * pad);
    if (isOpen(layout, x, y, pad)) return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}

// ═════════════ Caminos ═════════════

// Pasos que hay desde cada casilla hasta la del objetivo (-1 = muro o inalcanzable).
// Se guarda en la propia sala y solo se recalcula cuando el objetivo cambia de casilla.
function stepsTo(layout, x, y) {
  const goal = at(Math.floor(x / CELL), Math.floor(y / CELL));
  if (layout.flowGoal === goal) return layout.flow;
  const f = layout.flow || (layout.flow = new Int16Array(COLS * ROWS));
  f.fill(-1);
  layout.flowGoal = goal;
  if (layout.grid[goal]) return f;
  f[goal] = 0;
  const queue = [goal];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of [i - 1, i + 1, i - COLS, i + COLS]) if (!layout.grid[j] && f[j] < 0) { f[j] = f[i] + 1; queue.push(j); }
  }
  return f;
}

// Hacia dónde tiene que andar `e` para llegar a `target` rodeando los muros.
// Devuelve null si puede ir en línea recta (lo normal): entonces cada uno se mueve como siempre.
export function wayTo(layout, e, target) {
  if (!layout.blocks.length) return null;
  const pad = e.r * 0.8;
  if (lineClear(layout, e.x, e.y, target.x, target.y, pad)) return null;
  const f = stepsTo(layout, target.x, target.y);
  let cur = at(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
  if (f[cur] < 0) return null;
  // avanza unas casillas por el camino y apunta a la más lejana a la que llega en línea recta:
  // así corta las esquinas con naturalidad en vez de ir de casilla en casilla
  let aim = null;
  for (let n = 0; n < 5 && f[cur] > 0; n++) {
    let best = cur;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const j = cur + dc + dr * COLS;
      if (f[j] < 0 || f[j] >= f[best]) continue;
      if (dc && dr && (f[cur + dc] < 0 || f[cur + dr * COLS] < 0)) continue; // en diagonal no se atraviesan esquinas
      best = j;
    }
    if (best === cur) break;
    const px = ((best % COLS) + 0.5) * CELL, py = (Math.floor(best / COLS) + 0.5) * CELL;
    if (aim && !lineClear(layout, e.x, e.y, px, py, pad)) break;
    aim = { x: px, y: py };
    cur = best;
  }
  if (!aim) return null;
  const dx = aim.x - e.x, dy = aim.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}
