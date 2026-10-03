// ─────────────────────────────────────────────
//  Contenido de cada sala: estilo, obstáculos, decoración y oleadas
// ─────────────────────────────────────────────
import { W, H, WALL, APARTMENT_STYLES } from './config.js';
import { mulberry32, pick } from './utils.js';

// Tipos de sala. `frame` es el color del marco de las puertas que llevan a ella.
export const ROOM_TYPES = {
  start:    { icon: '🚪', name: 'Entrada' },
  monsters: { icon: '🧟', name: 'Monstruos' },
  item:     { icon: '🎁', name: 'Sala de objeto', frame: '#ffd23f' },
  survivor: { icon: '🙋', name: 'Superviviente', frame: '#80ed99' },
  miniboss: { icon: '👹', name: 'Mini jefe', frame: '#ff5d73' },
  boss:     { icon: '👑', name: 'Jefe final', frame: '#b5179e' },
};

// Coste de cada zombi para "comprar" oleadas con un presupuesto.
// Los lentos son baratos: aparecen en grupo.
const COST = { lento: 0.5, normal: 1, rapido: 1, venenoso: 2, explosivo: 2, tentaculos: 3 };

// Puntos de entrada de las puertas (para no tapar el paso con obstáculos)
const DOOR_SPOTS = [
  { x: W / 2, y: WALL }, { x: W / 2, y: H - WALL },
  { x: WALL, y: H / 2 }, { x: W - WALL, y: H / 2 },
];

export function makeRoomLayout(type) {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  const style = type === 'start' ? APARTMENT_STYLES[3] : APARTMENT_STYLES[Math.floor(rng() * APARTMENT_STYLES.length)];

  // Tablas del parquet: cada fila tiene sus juntas en posiciones distintas
  const seams = [];
  for (let y = WALL, row = 0; y < H - WALL; y += 32, row++) {
    let x = WALL + rng() * 120;
    const cuts = [];
    while (x < W - WALL) { cuts.push(x); x += 110 + rng() * 120; }
    seams.push({ y, cuts, shade: rng() < 0.5 });
  }

  // Obstáculos (macetas y cajas) solo en salas con monstruos
  const obstacles = [];
  if (type === 'monsters' || type === 'survivor') {
    const n = Math.floor(rng() * (type === 'survivor' ? 3 : 4));
    for (let tries = 0; obstacles.length < n && tries < 60; tries++) {
      const o = {
        x: WALL + 120 + rng() * (W - 2 * WALL - 240),
        y: WALL + 100 + rng() * (H - 2 * WALL - 200),
        r: 24 + rng() * 10,
        kind: rng() < 0.55 ? 'plant' : 'box',
        rot: (rng() - 0.5) * 0.4,
      };
      const freeDoors = DOOR_SPOTS.every((d) => Math.hypot(d.x - o.x, d.y - o.y) > 170);
      const freeCenter = Math.hypot(o.x - W / 2, o.y - H / 2) > (type === 'survivor' ? 150 : 90);
      const farFromOthers = obstacles.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > p.r + o.r + 80);
      if (freeDoors && freeCenter && farFromOthers) obstacles.push(o);
    }
  }

  // Alfombra en algunas habitaciones
  let rug = null;
  if (style.rug && rng() < 0.7) {
    const w = 260 + rng() * 160, h = 160 + rng() * 100;
    rug = { x: W / 2 - w / 2 + (rng() - 0.5) * 80, y: H / 2 - h / 2 + (rng() - 0.5) * 50, w, h, color: style.rug };
  }

  // Pequeños detalles del suelo
  const decor = [];
  for (let i = 0; i < 10; i++) {
    decor.push({ x: WALL + 30 + rng() * (W - 2 * WALL - 60), y: WALL + 30 + rng() * (H - 2 * WALL - 60), s: 0.6 + rng() * 0.8 });
  }

  return { style, seams, obstacles, rug, decor };
}

// Enemigos de cada sala según su tipo
export function makeRoomWaves(room, floorNum) {
  switch (room.type) {
    case 'monsters': return makeWaves(room.dist, floorNum);
    case 'survivor': return makeWaves(Math.max(1, room.dist - 1), floorNum).slice(0, 1); // una oleada rodeando al superviviente
    case 'miniboss': return [['miniboss']];
    case 'boss': return [['boss']];
    default: return [];
  }
}

// Oleadas: el presupuesto crece cuanto más lejos está la sala de la entrada
export function makeWaves(depth, floorNum = 1) {
  const level = depth + (floorNum - 1) * 2;
  // Los tipos más peligrosos van apareciendo según se avanza
  const pool = ['lento', 'normal'];
  if (level >= 2) pool.push('rapido', 'venenoso');
  if (level >= 3) pool.push('explosivo');
  if (level >= 4) pool.push('tentaculos');
  const total = Math.round(3 + level * 1.2);
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
