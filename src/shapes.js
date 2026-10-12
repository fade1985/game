// ─────────────────────────────────────────────
//  La cuadrícula de cada mapa (sala, pasillo o apartamento)
//
//  Todo mapa es una cuadrícula de casillas de 32 unidades (una baldosa del pixel art): cada casilla
//  es suelo (0) o muro (1). Alrededor hay siempre un muro de 2 casillas; dentro puede haber tabiques
//  (los de los apartamentos, ver apartment.js).
//
//  De la cuadrícula salen tres cosas:
//    grid    la cuadrícula, para saber si un punto es muro y calcular caminos
//    blocks  los muros interiores como rectángulos, para los choques
//    y el camino que siguen los zombis para rodear las esquinas (wayTo)
// ─────────────────────────────────────────────
import { W, H, WALL } from './config.js';

export const CELL = 32;
const EDGE = WALL / CELL; // grosor en casillas de los muros de fuera

// Tamaño de la sala de siempre (960×640) en casillas
export const BASE_COLS = W / CELL;   // 30
export const BASE_ROWS = H / CELL;   // 20

// Sala rectangular: muro alrededor y suelo dentro
export function plainGrid(cols, rows) {
  const g = new Uint8Array(cols * rows).fill(1);
  for (let r = EDGE; r < rows - EDGE; r++) for (let c = EDGE; c < cols - EDGE; c++) g[r * cols + c] = 0;
  return g;
}

// Junta las casillas de muro del interior en rectángulos grandes (para los choques)
export function toBlocks(g, cols, rows) {
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

// ═════════════ Consultas ═════════════
// `layout` es el mapa: { grid, cols, rows, w, h, blocks }

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

// La cuadrícula con la que se buscan los caminos: los muros y, además, las casillas que tapa un mueble.
// (Las balas y las miradas siguen usando la de los muros: por encima de un sofá se ve y se dispara.)
function navOf(layout) {
  if (layout.nav) return layout.nav;
  const { cols, rows } = layout;
  const grid = layout.grid.slice();
  let any = layout.blocks.length > 0;
  for (const o of layout.obstacles || []) {
    if (o.shape !== 'rect') continue;
    for (let r = Math.max(0, Math.floor((o.y - o.h / 2) / CELL)); r <= Math.min(rows - 1, Math.floor((o.y + o.h / 2) / CELL)); r++) {
      for (let c = Math.max(0, Math.floor((o.x - o.w / 2) / CELL)); c <= Math.min(cols - 1, Math.floor((o.x + o.w / 2) / CELL)); c++) {
        // tapada: el mueble le pisa el centro
        if (Math.abs((c + 0.5) * CELL - o.x) < o.w / 2 && Math.abs((r + 0.5) * CELL - o.y) < o.h / 2) { grid[r * cols + c] = 1; any = true; }
      }
    }
  }
  // `blocks` solo dice si hay algo que rodear (lineClear lo mira para no trabajar en balde)
  return (layout.nav = { grid, cols, rows, w: layout.w, h: layout.h, blocks: any ? [true] : [] });
}

// Hacia dónde tiene que andar `e` para llegar a `target` rodeando muros y muebles.
// Devuelve null si puede ir en línea recta (lo normal): entonces cada uno se mueve como siempre.
export function wayTo(map, e, target) {
  const layout = navOf(map);
  if (!layout.blocks.length) return null;
  const pad = e.r * 0.8;
  if (lineClear(layout, e.x, e.y, target.x, target.y, pad)) return null;
  const cols = layout.cols;
  const f = stepsTo(layout, target.x, target.y);
  let cur = Math.floor(e.y / CELL) * cols + Math.floor(e.x / CELL);
  if (!(f[cur] >= 0)) {
    // pisa una casilla tapada (va pegado a un mueble): sale hacia la casilla libre vecina que más le acerca
    let out = -1;
    for (const d of [1, -1, cols, -cols, cols + 1, cols - 1, -cols + 1, -cols - 1]) if (f[cur + d] >= 0 && (out < 0 || f[cur + d] < f[out])) out = cur + d;
    if (out < 0) return null;
    const ox = ((out % cols) + 0.5) * CELL - e.x, oy = (Math.floor(out / cols) + 0.5) * CELL - e.y;
    const od = Math.hypot(ox, oy) || 1;
    return { x: ox / od, y: oy / od };
  }
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
