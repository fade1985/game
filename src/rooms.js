// ─────────────────────────────────────────────
//  Los mapas del edificio: el pasillo de cada planta, los apartamentos, la sala de mantenimiento
//  y la azotea. Aquí se monta lo que hay dentro de cada uno: estilo, muebles, decoración y zombis.
//  Cómo se reparten por la planta está en building.js.
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, STYLES } from './config.js';
import { mulberry32, pick, clamp, obstacleGap } from './utils.js';
import { placeFurniture, placeWallDecor, placeBackWall, hasTemplates } from './furniture.js';
import { CELL, BASE_COLS, BASE_ROWS, plainGrid, toBlocks, isWall, isOpen } from './shapes.js';

// Tipos de mapa. `frame` es el color del marco de las puertas que llevan a él.
export const ROOM_TYPES = {
  menu:        { icon: '🚪', name: 'Portal' },
  corridor:    { icon: '🚪', name: 'Pasillo' },
  maintenance: { icon: '🧰', name: 'Sala de mantenimiento', frame: '#4cc9f0' },
  apartment:   { icon: '🧟', name: 'Apartamento' },
  miniboss:    { icon: '👹', name: 'Mini jefe', frame: '#ff5d73' },
  boss:        { icon: '👑', name: 'Azotea', frame: '#b5179e' },
};

// Medidas del pasillo, en casillas: largo, con 8 casillas de ancho para andar
export const CORRIDOR_COLS = 56;
export const CORRIDOR_ROWS = 12;
const ROOF_COLS = 44, ROOF_ROWS = 30;

// Cuántos muebles lleva cada habitación de un apartamento: [mínimo, máximo]
const FURNITURE = { salon: [4, 7], cocina: [2, 4], dormitorio: [2, 4], bano: [1, 3], jefe: [2, 3] };

// Coste de cada zombi para "comprar" los de un apartamento con un presupuesto.
// Los lentos son baratos: aparecen en grupo.
const COST = { lento: 0.5, normal: 1, rapido: 1, venenoso: 2, explosivo: 2, tentaculos: 3 };
// Presupuesto de zombis de un apartamento: `base` más `perLevel` por nivel (el nivel sube con la planta y con
// el orden del apartamento dentro de ella). Equilibrado con partidas simuladas (docs/MAPA.md, fase 3).
export const HORDE = { base: 5, perLevel: 1.1, floorStep: 1 };
const FAR = 340; // nadie espera a menos de esta distancia de la puerta de entrada

// ═════════════ Puertas ═════════════

// Una puerta en el muro de fuera de un mapa. `dir` es el muro ('up', 'down', 'left' o 'right') y `at`, la
// posición a lo largo de ese muro. Se dibujan todas como si estuvieran arriba y se giran (`a`).
//   to, back   el mapa al que lleva y la puerta por la que se aparece allí
//   kind       'door' (puerta normal), 'stairs' (escaleras de emergencia), 'back' (por donde se ha
//              llegado: no se abre) o 'elevator' (el ascensor averiado)
//   locked     por qué no se puede pasar: 'key' (hace falta la llave), 'boss' (hay que acabar con el
//              mini jefe), 'never' (no se abre nunca) o null (abierta)
//   msg        lo que se le dice al jugador si empuja una puerta cerrada
//   frame, icon, label   color del marco, insignia y letrero (si los lleva)
export function makeExit(layout, dir, at, o = {}) {
  const [x, y, a] = {
    up: [at, WALL / 2, 0],
    down: [at, layout.h - WALL / 2, Math.PI],
    left: [WALL / 2, at, -Math.PI / 2],
    right: [layout.w - WALL / 2, at, Math.PI / 2],
  }[dir];
  return { dir, at, x, y, a, to: null, back: null, kind: 'door', locked: null, msg: null, ...o };
}

// Rectángulo que tiene que quedar sin muebles delante de una puerta del muro de fuera
function exitClear(layout, dir, at) {
  const half = DOOR_W / 2 + 44, deep = 130;
  if (dir === 'up') return { x0: at - half, x1: at + half, y0: WALL, y1: WALL + deep };
  if (dir === 'down') return { x0: at - half, x1: at + half, y0: layout.h - WALL - deep, y1: layout.h - WALL };
  if (dir === 'left') return { x0: WALL, x1: WALL + deep, y0: at - half, y1: at + half };
  return { x0: layout.w - WALL - deep, x1: layout.w - WALL, y0: at - half, y1: at + half };
}

// ═════════════ Piezas comunes ═════════════

// Tablas del parquet: cada fila tiene sus juntas en posiciones distintas
function makeSeams(rng, RW, RH) {
  const seams = [];
  for (let y = WALL; y < RH - WALL; y += 32) {
    let x = WALL + rng() * 120;
    const cuts = [];
    while (x < RW - WALL) { cuts.push(x); x += 110 + rng() * 120; }
    seams.push({ y, cuts, shade: rng() < 0.5 });
  }
  return seams;
}

// Pequeños detalles del suelo (motas de polvo)
function makeDecor(rng, RW, RH) {
  const decor = [];
  const n = Math.round((10 * RW * RH) / (W * H));
  for (let i = 0; i < n; i++) {
    decor.push({ x: WALL + 30 + rng() * (RW - 2 * WALL - 60), y: WALL + 30 + rng() * (RH - 2 * WALL - 60), s: 0.6 + rng() * 0.8 });
  }
  return decor;
}

// Cuadros, ventanas y relojes de la pared de arriba, sin tapar ninguna puerta
function makeWallDecor(rng, geo, spots, windows = true) {
  return placeWallDecor(rng, geo.w).filter((d) => (windows || d.kind !== 'window')
    && !isWall(geo, d.x, WALL + 8)
    && spots.every((s) => s.dir !== 'up' || Math.abs(s.at - d.x) > DOOR_W / 2 + 90));
}

// Comprueba que los muebles no cortan el paso. Devuelve una función que, para cada mueble nuevo, dice si
// después de ponerlo se sigue pudiendo andar entre todos los `points` y no queda ningún rincón de suelo
// aislado (un zombi o la llave podrían caer ahí); si es así, lo da por puesto.
// Trabaja en una cuadrícula fina, de media casilla, con el hueco que necesita un personaje para pasar.
function walkChecker(geo, points, pad = 20) {
  const S = CELL / 2, cols = geo.w / S, rows = geo.h / S;
  const free = new Uint8Array(cols * rows); // 1 = ahí cabe un personaje
  let room = 0;                             // cuántas casillas libres quedan
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (isOpen(geo, (c + 0.5) * S, (r + 0.5) * S, pad)) { free[r * cols + c] = 1; room++; }
  }
  const goals = points.map((p) => Math.floor(p.y / S) * cols + Math.floor(p.x / S));
  const seen = new Uint8Array(cols * rows);
  // a cuántas casillas se llega andando desde la primera
  const reach = () => {
    seen.fill(0);
    const stack = [goals[0]];
    seen[goals[0]] = 1;
    let n = 1;
    while (stack.length) {
      const i = stack.pop(), c = i % cols;
      for (const j of [i - cols, i + cols, c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < free.length && free[j] && !seen[j]) { seen[j] = 1; n++; stack.push(j); }
      }
    }
    return n;
  };
  if (goals.some((g) => !free[g]) || reach() !== room) return () => true; // no debería pasar: mejor muebles de más que ninguno
  return (o) => {
    const hw = o.w / 2 + pad, hh = o.h / 2 + pad;
    const taken = [];
    for (let r = Math.max(0, Math.floor((o.y - hh) / S)); r <= Math.min(rows - 1, Math.floor((o.y + hh) / S)); r++) {
      for (let c = Math.max(0, Math.floor((o.x - hw) / S)); c <= Math.min(cols - 1, Math.floor((o.x + hw) / S)); c++) {
        const i = r * cols + c;
        if (free[i] && Math.abs((c + 0.5) * S - o.x) < hw && Math.abs((r + 0.5) * S - o.y) < hh) { free[i] = 0; taken.push(i); }
      }
    }
    if (goals.every((g) => free[g]) && reach() === room - taken.length) { room -= taken.length; return true; }
    for (const i of taken) free[i] = 1;
    return false;
  };
}

// ═════════════ Mapas rectangulares ═════════════

// Sala rectangular sin tabiques: 'menu' (el fondo del menú), 'maintenance' (la sala de mantenimiento,
// donde empieza el conserje) o 'roof' (la azotea, más grande y sin muebles).
export function makePlainLayout(kind) {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  const style = STYLES[kind === 'roof' ? 'Azotea' : kind === 'maintenance' ? 'Mantenimiento' : 'Pasillo'];
  const [cols, rows] = kind === 'roof' ? [ROOF_COLS, ROOF_ROWS] : [BASE_COLS, BASE_ROWS];
  const RW = cols * CELL, RH = rows * CELL;
  const geo = { grid: plainGrid(cols, rows), blocks: [], cols, rows, w: RW, h: RH };
  // en mantenimiento la pared de arriba es para los muebles de las armas
  const obstacles = kind === 'roof' ? [] : placeFurniture(style.name, rng, 2, 3, { skipSide: kind === 'maintenance' ? 'top' : null });
  let wallDecor = kind === 'roof' ? [] : makeWallDecor(rng, geo, [{ dir: 'up', at: RW / 2 }], kind !== 'maintenance');
  // la pared de mantenimiento ya trae su propia pintada y salpicones (tools/pared_mantenimiento.py): sin cuadros encima
  if (kind === 'maintenance') wallDecor = [];
  let rug = null;
  if (style.rug && rng() < 0.7) {
    const w = 260 + rng() * 160, h = 160 + rng() * 100;
    rug = { x: RW / 2 - w / 2 + (rng() - 0.5) * 80, y: RH / 2 - h / 2 + (rng() - 0.5) * 50, w, h, color: style.rug };
  }
  return { ...geo, style, seams: makeSeams(rng, RW, RH), obstacles, rug, decor: makeDecor(rng, RW, RH), wallDecor };
}

// El pasillo de una planta. `spots` son sus puertas ([{ dir, at }]): delante de ellas no se ponen muebles.
export function makeCorridorLayout(spots) {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  const style = STYLES['Pasillo'];
  const cols = CORRIDOR_COLS, rows = CORRIDOR_ROWS, RW = cols * CELL, RH = rows * CELL;
  const geo = { grid: plainGrid(cols, rows), blocks: [], cols, rows, w: RW, h: RH };
  const clear = spots.map((s) => exitClear(geo, s.dir, s.at));
  const fits = walkChecker(geo, [{ x: WALL + 40, y: RH / 2 }, { x: RW - WALL - 40, y: RH / 2 }]);
  const obstacles = placeFurniture(style.name, rng, 5, 8, { layout: geo, clear, fits, maxDep: 46 });
  // una alfombra larga por el centro, de punta a punta
  const rug = { x: WALL + 56, y: RH / 2 - 34, w: RW - 2 * WALL - 112, h: 68, color: style.rug };
  // apliques en la pared de arriba, cada ~230 unidades y sin tapar puertas; son las fuentes de luz del pasillo
  // (`parpadea`: algunos fallan de vez en cuando). Los cuadros que caerían encima se quitan.
  const apliques = [];
  for (let x = WALL + 130; x < RW - WALL - 60; x += 230) {
    if (isWall(geo, x, WALL + 8) || spots.some((s) => s.dir === 'up' && Math.abs(s.at - x) < DOOR_W / 2 + 50)) continue;
    apliques.push({ kind: 'aplique', x, w: 16, seed: rng(), parpadea: rng() < 0.3 });
  }
  const wallDecor = [...makeWallDecor(rng, geo, spots, false).filter((d) => apliques.every((a) => Math.abs(a.x - d.x) > d.w / 2 + 40)), ...apliques];
  return { ...geo, style, seams: makeSeams(rng, RW, RH), obstacles, rug, decor: makeDecor(rng, RW, RH), wallDecor };
}

// ═════════════ Apartamentos ═════════════

// Convierte un apartamento de apartment.js en un mapa del juego: tabiques, suelo de cada habitación y muebles.
// Las habitaciones quedan en `zones` ([{ id, use, name, style, cells, x, y, w, h, cx, cy, seen, fog }], en unidades).
export function makeApartmentLayout(apt) {
  const rng = mulberry32(apt.seed + 17);
  const { cols, rows } = apt;
  const RW = cols * CELL, RH = rows * CELL;
  // la puerta de entrada se dibuja sobre el muro, como todas: en la cuadrícula ese hueco vuelve a ser muro
  const grid = apt.grid.slice();
  const e = apt.entrance;
  for (let r = e.r; r < e.r + e.h; r++) for (let c = e.c; c < e.c + e.w; c++) grid[r * cols + c] = 1;
  const geo = { grid, blocks: toBlocks(grid, cols, rows), cols, rows, w: RW, h: RH, owner: apt.owner };
  const style = STYLES['Salón']; // el papel pintado de todo el piso
  const entry = { dir: e.side, at: (e.c + e.w / 2) * CELL };

  // Lo que tiene que quedar libre: la entrada y los dos lados de cada puerta de dentro
  const clear = [exitClear(geo, entry.dir, entry.at)];
  const points = [{ ...apt.spawn }];
  for (const d of apt.doors) {
    const x = (d.c + d.w / 2) * CELL, y = (d.r + d.h / 2) * CELL;
    if (d.h === 1) { // hueco en un tabique horizontal: se cruza de arriba abajo
      clear.push({ x0: x - 64, x1: x + 64, y0: y - 104, y1: y + 104 });
      points.push({ x, y: y - 56 }, { x, y: y + 56 });
    } else {
      clear.push({ x0: x - 104, x1: x + 104, y0: y - 64, y1: y + 64 });
      points.push({ x: x - 56, y }, { x: x + 56, y });
    }
  }
  const fits = walkChecker(geo, points);

  const obstacles = [];
  const zones = apt.rooms.map((rm) => {
    const st = STYLES[rm.style];
    const [min, max] = FURNITURE[rm.use];
    // en las habitaciones grandes cabe algún mueble más
    const extra = Math.min(2, Math.floor(rm.cells / 220));
    // las estancias con plantillas (de momento el baño) solo amueblan la pared del fondo; si en ella no cabe nada
    // (una puerta en medio), como antes: muebles sueltos en las demás paredes
    const back = hasTemplates(st.name) ? placeBackWall(st.name, rng, { layout: geo, zone: rm.id, clear, fits }) : [];
    if (back.length) obstacles.push(...back);
    else obstacles.push(...placeFurniture(st.name, rng, min + extra, max + extra, { layout: geo, zone: rm.id, clear, fits }));
    // seen y fog: las habitaciones que aún no se han pisado se ven a oscuras (fog va de 1, negro, a 0)
    return { id: rm.id, use: rm.use, name: rm.name, style: st, cells: rm.cells, x: rm.c0 * CELL, y: rm.r0 * CELL, w: rm.w * CELL, h: rm.h * CELL, cx: rm.x, cy: rm.y, seen: false, fog: 1 };
  });

  return {
    ...geo, style, zones, entry, inner: apt.doors,
    seams: makeSeams(rng, RW, RH), obstacles, rug: null, decor: makeDecor(rng, RW, RH),
    // con el pasillo arriba, la pared de arriba no da a la calle: sin ventanas
    wallDecor: makeWallDecor(rng, geo, [entry], e.side === 'down'),
  };
}

// Un punto despejado dentro de una habitación de un apartamento, para dejar algo en el suelo
// (la llave, un superviviente): lejos de muros y de muebles. Primero prueba el centro.
export function zoneSpot(layout, zone, rnd = Math.random) {
  const ok = (x, y) => isOpen(layout, x, y, 34) && layout.owner[Math.floor(y / CELL) * layout.cols + Math.floor(x / CELL)] === zone.id
    && layout.obstacles.every((o) => obstacleGap(o, { x, y }) > 44);
  if (ok(zone.cx, zone.cy)) return { x: zone.cx, y: zone.cy };
  for (let i = 0; i < 300; i++) {
    const x = zone.x + rnd() * zone.w, y = zone.y + rnd() * zone.h;
    if (ok(x, y)) return { x, y };
  }
  return { x: zone.cx, y: zone.cy };
}

// ═════════════ Zombis ═════════════

// Enemigos que aparecen al entrar, por oleadas: solo los jefes. Los zombis de los apartamentos
// ya están dentro (makeHorde).
export function makeRoomWaves(room) {
  if (room.type === 'miniboss') return [['miniboss']];
  if (room.type === 'boss') return [['boss']];
  return [];
}

// Los zombis de un apartamento: ya están dentro, repartidos por las habitaciones según su tamaño, y no se
// mueven hasta que notan al conserje. Devuelve [{ type, zone, x, y }].
// `depth` es el orden del apartamento dentro de la planta (1, 2, 3): cuanto más alto, más y peores.
export function makeHorde(layout, depth, floorNum = 1) {
  const level = depth + Math.round((floorNum - 1) * HORDE.floorStep);
  // Los tipos más peligrosos van apareciendo según se avanza
  const pool = ['lento', 'normal'];
  if (level >= 2) pool.push('rapido', 'venenoso');
  if (level >= 3) pool.push('explosivo');
  if (level >= 4) pool.push('tentaculos');
  const { zones, entry } = layout;
  const area = zones.reduce((s, z) => s + z.cells, 0);
  // en los pisos grandes hay más, pero no en proporción: si no, los de 3 dormitorios serían eternos
  const budget = (HORDE.base + level * HORDE.perLevel) * clamp(area / 700, 0.8, 1.4);
  const weight = (z) => z.cells * (z.use === 'bano' ? 0.5 : 1); // en los baños, pocos
  const total = zones.reduce((s, z) => s + weight(z), 0);
  const door = { x: entry.at, y: entry.dir === 'down' ? layout.h - WALL - 52 : WALL + 52 };

  const spawns = [];
  const spot = (z) => {
    for (let i = 0; i < 200; i++) {
      const x = z.x + Math.random() * z.w, y = z.y + Math.random() * z.h;
      if (layout.owner[Math.floor(y / CELL) * layout.cols + Math.floor(x / CELL)] !== z.id || !isOpen(layout, x, y, 26)) continue;
      if (Math.hypot(x - door.x, y - door.y) < FAR) continue;
      if (layout.obstacles.some((o) => obstacleGap(o, { x, y }) < 34)) continue;
      if (spawns.some((s) => Math.hypot(s.x - x, s.y - y) < 60)) continue;
      return { x, y };
    }
    return null;
  };
  for (const z of zones) {
    // lo que le toca a esta habitación; el pico que sobra se echa a suertes
    const share = (budget * weight(z)) / total;
    let left = Math.floor(share * 2) / 2 + (Math.random() < (share * 2) % 1 ? 0.5 : 0);
    while (left > 0) {
      const options = pool.filter((t) => COST[t] <= left);
      const at = options.length && spot(z);
      if (!at) break;
      const type = pick(options);
      spawns.push({ type, zone: z.id, ...at });
      left -= COST[type];
    }
  }
  return spawns;
}
