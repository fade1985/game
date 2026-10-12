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
//    y el camino que siguen los zombis para rodear tabiques y muebles (wayTo)
// ─────────────────────────────────────────────
import { W, H, WALL } from './config.js';
import { obstacleGap } from './utils.js';

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

// (vale también para la cuadrícula de caminos, que lleva su propio tamaño de casilla en `cell`)
export function isWall(layout, x, y) {
  const s = layout.cell || CELL;
  const c = Math.floor(x / s), r = Math.floor(y / s);
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
// Los caminos se buscan en una cuadrícula más fina que la del mapa (media casilla) en la que solo cuenta
// como suelo el sitio donde cabe un personaje: lejos de muros y de muebles. Así nadie intenta colarse
// por un hueco en el que no cabe. (Las balas y las miradas siguen usando la cuadrícula de los muros:
// por encima de un sofá se ve y se dispara.)
const NAV = CELL / 2; // lado de las casillas de la cuadrícula de caminos
const BODY = 16;      // hueco que necesita un personaje a cada lado para pasar

function navOf(layout) {
  if (layout.nav) return layout.nav;
  const cols = layout.cols * 2, rows = layout.rows * 2;
  const grid = new Uint8Array(cols * rows);
  const things = layout.obstacles || [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pt = { x: (c + 0.5) * NAV, y: (r + 0.5) * NAV };
      if (!isOpen(layout, pt.x, pt.y, BODY) || things.some((o) => obstacleGap(o, pt) < BODY)) grid[r * cols + c] = 1;
    }
  }
  // `blocks` solo dice si hay algo que rodear (lineClear lo mira para no trabajar en balde)
  const any = layout.blocks.length > 0 || things.length > 0;
  return (layout.nav = { grid, cols, rows, cell: NAV, w: layout.w, h: layout.h, blocks: any ? [true] : [] });
}

// Pasos que hay desde cada casilla hasta la del objetivo (-1 = no se puede pisar o no se llega).
// Se guarda en el propio mapa y solo se recalcula cuando el objetivo cambia de casilla.
function stepsTo(nav, x, y) {
  const { cols, grid } = nav;
  const gc = Math.floor(x / NAV), gr = Math.floor(y / NAV);
  const goal = gr * cols + gc;
  if (nav.flowGoal === goal) return nav.flow;
  const f = nav.flow || (nav.flow = new Int16Array(grid.length));
  f.fill(-1);
  nav.flowGoal = goal;
  // el objetivo puede estar arrimado a un muro, en una casilla que no cuenta como suelo:
  // entonces se parte de las libres que tenga alrededor
  const queue = [];
  for (let ring = 0; ring <= 2 && !queue.length; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        const c = gc + dc, r = gr + dr;
        if (c < 0 || r < 0 || c >= cols || r >= nav.rows || grid[r * cols + c]) continue;
        f[r * cols + c] = 0;
        queue.push(r * cols + c);
      }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], c = i % cols;
    for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
      if (j >= 0 && j < grid.length && !grid[j] && f[j] < 0) { f[j] = f[i] + 1; queue.push(j); }
    }
  }
  return f;
}

// Hacia dónde tiene que andar `e` para llegar a `target` rodeando muros y muebles.
// Devuelve null si puede ir en línea recta (lo normal): entonces cada uno se mueve como siempre.
export function wayTo(layout, e, target) {
  const nav = navOf(layout);
  if (!nav.blocks.length) return null;
  // de cerca y sin tabique en medio, derecho a por él
  if (Math.hypot(target.x - e.x, target.y - e.y) < 70 && lineClear(layout, e.x, e.y, target.x, target.y)) return null;
  if (lineClear(nav, e.x, e.y, target.x, target.y)) return null;
  const cols = nav.cols;
  const f = stepsTo(nav, target.x, target.y);
  const center = (i) => ({ x: ((i % cols) + 0.5) * NAV, y: (Math.floor(i / cols) + 0.5) * NAV });
  const head = (pt) => { const dx = pt.x - e.x, dy = pt.y - e.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; };
  let cur = Math.floor(e.y / NAV) * cols + Math.floor(e.x / NAV);
  if (!(f[cur] >= 0)) {
    // va arrimado a un muro o a un mueble: sale hacia la casilla libre de alrededor que más le acerca
    let out = -1;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const j = cur + dc + dr * cols;
        if (f[j] >= 0 && (out < 0 || f[j] < f[out])) out = j;
      }
    }
    return out < 0 ? null : head(center(out));
  }
  // avanza unas casillas por el camino y apunta a la más lejana a la que llega en línea recta:
  // así corta las esquinas con naturalidad en vez de ir de casilla en casilla
  let aim = null;
  for (let n = 0; n < 10 && f[cur] > 0; n++) {
    let best = cur;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const j = cur + dc + dr * cols;
      if (!(f[j] >= 0) || f[j] >= f[best]) continue;
      if (dc && dr && (f[cur + dc] < 0 || f[cur + dr * cols] < 0)) continue; // en diagonal no se atraviesan esquinas
      best = j;
    }
    if (best === cur) break;
    const pt = center(best);
    if (aim && !lineClear(nav, e.x, e.y, pt.x, pt.y)) break;
    aim = pt;
    cur = best;
  }
  return aim ? head(aim) : null;
}
