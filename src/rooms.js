// ─────────────────────────────────────────────
//  Contenido de cada sala: estilo, obstáculos, decoración y oleadas
// ─────────────────────────────────────────────
import { W, H, WALL, APARTMENT_STYLES } from './config.js';
import { mulberry32, pick, obstacleGap } from './utils.js';
import { placeFurniture, placeWallDecor } from './furniture.js';
import { CELL, pickSize, makeShape, isWall, isOpen, rectIsFloor } from './shapes.js';

// Tipos de sala. `frame` es el color del marco de las puertas que llevan a ella.
export const ROOM_TYPES = {
  start:    { icon: '🚪', name: 'Entrada' },
  monsters: { icon: '🧟', name: 'Monstruos' },
  item:     { icon: '🎁', name: 'Sala de objeto', frame: '#ffd23f' },
  survivor: { icon: '🙋', name: 'Superviviente', frame: '#80ed99' },
  miniboss: { icon: '👹', name: 'Mini jefe', frame: '#ff5d73' },
  boss:     { icon: '👑', name: 'Jefe final', frame: '#b5179e' },
};

// Cuántos muebles hay según el tipo de sala
const FURNITURE_COUNT = { start: [2, 3], monsters: [2, 4], item: [3, 4], survivor: [2, 3], miniboss: [1, 2], boss: [2, 2] };

// Coste de cada zombi para "comprar" oleadas con un presupuesto.
// Los lentos son baratos: aparecen en grupo.
const COST = { lento: 0.5, normal: 1, rapido: 1, venenoso: 2, explosivo: 2, tentaculos: 3 };

// `doors` dice qué lados tienen puerta ({ up, down, left, right }); hace falta para dar forma a la sala
export function makeRoomLayout(type, doors = {}) {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  const style = type === 'start' ? APARTMENT_STYLES[3] : APARTMENT_STYLES[Math.floor(rng() * APARTMENT_STYLES.length)];

  // Tamaño de la sala: la de siempre mide 960×640; en la versión pixel algunas son más grandes (ver shapes.js)
  const [cols, rows] = pickSize(type, rng);
  const RW = cols * CELL, RH = rows * CELL;
  const big = (RW * RH) / (W * H); // cuántas veces más grande que la sala de siempre

  // Tablas del parquet: cada fila tiene sus juntas en posiciones distintas
  const seams = [];
  for (let y = WALL, row = 0; y < RH - WALL; y += 32, row++) {
    let x = WALL + rng() * 120;
    const cuts = [];
    while (x < RW - WALL) { cuts.push(x); x += 110 + rng() * 120; }
    seams.push({ y, cuts, shade: rng() < 0.5 });
  }

  // Muebles pegados a las paredes (menos en las salas de jefe, que necesitan sitio)
  const [fmin, fmax] = (FURNITURE_COUNT[type] || [2, 3]).map((n) => Math.round(n * Math.sqrt(big)));
  // Forma de la sala: en la versión pixel muchas dejan de ser un rectángulo (ver shapes.js)
  const { grid, blocks } = makeShape(type, doors, rng, cols, rows);
  const geo = { grid, blocks, doors, cols, rows, w: RW, h: RH };
  const shaped = blocks.length || big > 1 ? geo : null; // sala distinta del rectángulo de siempre
  const obstacles = placeFurniture(style.name, rng, fmin, fmax, type === 'start' ? 'top' : null, shaped);
  // los cuadros y ventanas solo donde la pared de arriba da de verdad a la sala
  const wallDecor = placeWallDecor(rng, RW).filter((d) => !isWall(geo, d.x, WALL + 8));

  // Obstáculos sueltos (macetas y cajas) solo en salas con monstruos
  if (type === 'monsters' || type === 'survivor') {
    const n = Math.round(Math.floor(rng() * (type === 'survivor' ? 3 : 4)) * big);
    const loose = obstacles.length;
    // puntos de entrada de las puertas (para no tapar el paso con obstáculos)
    const doorSpots = [{ x: RW / 2, y: WALL }, { x: RW / 2, y: RH - WALL }, { x: WALL, y: RH / 2 }, { x: RW - WALL, y: RH / 2 }];
    for (let tries = 0; obstacles.length - loose < n && tries < 60 * big; tries++) {
      const o = {
        x: WALL + 120 + rng() * (RW - 2 * WALL - 240),
        y: WALL + 100 + rng() * (RH - 2 * WALL - 200),
        r: 24 + rng() * 10,
        kind: rng() < 0.55 ? 'plant' : 'box',
        rot: (rng() - 0.5) * 0.4,
      };
      const freeDoors = doorSpots.every((d) => Math.hypot(d.x - o.x, d.y - o.y) > 170);
      const freeCenter = Math.hypot(o.x - RW / 2, o.y - RH / 2) > (type === 'survivor' ? 150 : 90);
      const farFromOthers = obstacles.every((p) => obstacleGap(p, o) > o.r + 80);
      const farFromWalls = !shaped || isOpen(geo, o.x, o.y, o.r + 44); // que se pueda pasar entre el muro y él
      if (freeDoors && freeCenter && farFromOthers && farFromWalls) obstacles.push(o);
    }
  }

  // Alfombra en algunas habitaciones
  let rug = null;
  if (style.rug && rng() < 0.7) {
    const w = 260 + rng() * 160, h = 160 + rng() * 100;
    rug = { x: RW / 2 - w / 2 + (rng() - 0.5) * 80, y: RH / 2 - h / 2 + (rng() - 0.5) * 50, w, h, color: style.rug };
    // en una sala con forma se encoge hasta que quepa entera en el suelo
    while (shaped && rug.w > 120 && !rectIsFloor(geo, rug.x + rug.w / 2, rug.y + rug.h / 2, rug.w, rug.h)) {
      rug.x += 16; rug.y += 10; rug.w -= 32; rug.h -= 20;
    }
  }

  // Pequeños detalles del suelo
  const decor = [];
  for (let i = 0; i < Math.round(10 * big); i++) {
    decor.push({ x: WALL + 30 + rng() * (RW - 2 * WALL - 60), y: WALL + 30 + rng() * (RH - 2 * WALL - 60), s: 0.6 + rng() * 0.8 });
  }

  return { style, seams, obstacles, rug, decor, wallDecor, grid, blocks, cols, rows, w: RW, h: RH };
}

// Enemigos de cada sala según su tipo
export function makeRoomWaves(room, floorNum) {
  switch (room.type) {
    case 'monsters': return makeWaves(room.dist, floorNum, (room.layout.w * room.layout.h) / (W * H));
    case 'survivor': return makeWaves(Math.max(1, room.dist - 1), floorNum).slice(0, 1); // una oleada rodeando al superviviente
    case 'miniboss': return [['miniboss']];
    case 'boss': return [['boss']];
    default: return [];
  }
}

// Oleadas: el presupuesto crece cuanto más lejos está la sala de la entrada.
// `big` es cuántas veces más grande que la de siempre es la sala: en las grandes hay algún zombi más.
export function makeWaves(depth, floorNum = 1, big = 1) {
  const level = depth + Math.round((floorNum - 1) * 2.5);
  // Los tipos más peligrosos van apareciendo según se avanza
  const pool = ['lento', 'normal'];
  if (level >= 2) pool.push('rapido', 'venenoso');
  if (level >= 3) pool.push('explosivo');
  if (level >= 4) pool.push('tentaculos');
  const total = Math.round((3 + level * 1.2) * (1 + (big - 1) * 0.6));
  const nWaves = level <= 1 ? 1 : 2;
  const waves = [];
  for (let w = 0; w < nWaves; w++) {
    let budget = Math.ceil(total / nWaves);
    const wave = [];
    while (budget > 0) {
      const t = pick(pool.filter((e) => COST[e] <= budget));
      wave.push(t);
      budget -= COST[t];
    }
    waves.push(wave);
  }
  return waves;
}
