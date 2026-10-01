// ─────────────────────────────────────────────
//  Generación de salas (el corazón del roguelike)
// ─────────────────────────────────────────────
import { W, H, WALL, TOTAL_ROOMS, biomeFor } from './config.js';
import { mulberry32, pick, weighted } from './utils.js';

export const ROOM_TYPES = {
  combat:   { icon: '⚔️', name: 'Combate' },
  elite:    { icon: '💀', name: 'Élite' },
  treasure: { icon: '🎁', name: 'Tesoro' },
  shop:     { icon: '🛒', name: 'Tienda' },
  rest:     { icon: '🔥', name: 'Hoguera' },
  boss:     { icon: '👑', name: 'Jefe final' },
  menu:     { icon: '', name: '' },
};

// Coste de cada enemigo para "comprar" oleadas con un presupuesto
const COST = { slime: 1, bat: 1, shooter: 2, charger: 3 };

// Qué puertas aparecen al terminar una sala → el jugador elige su camino
export function doorOptions(index, currentType) {
  if (index >= TOTAL_ROOMS - 1) return ['boss'];
  if (index === TOTAL_ROOMS - 2) return ['shop', 'rest'];
  let pool = [['combat', 4], ['treasure', 1]];
  if (index >= 2) pool.push(['elite', 1.6], ['shop', 1.2]);
  if (index >= 3) pool.push(['rest', 0.9]);
  // no repetimos tienda, hoguera o tesoro dos veces seguidas
  if (currentType !== 'combat') pool = pool.filter(([t]) => t !== currentType);
  const a = weighted(pool);
  const rest = pool.filter(([t]) => t !== a);
  return rest.length ? [a, weighted(rest)] : [a];
}

export function makeRoom(index, type) {
  const biome = biomeFor(index);
  const rng = mulberry32(Math.floor(Math.random() * 1e9));

  // Obstáculos (arbustos, rocas, pilares) solo en salas de combate
  const obstacles = [];
  if (type === 'combat' || type === 'elite') {
    const n = Math.floor(rng() * 4);
    for (let tries = 0; obstacles.length < n && tries < 50; tries++) {
      const o = {
        x: WALL + 130 + rng() * (W - 2 * WALL - 260),
        y: WALL + 110 + rng() * (H - 2 * WALL - 250),
        r: 24 + rng() * 14,
      };
      const farFromSpawn = Math.hypot(o.x - W / 2, o.y - (H - WALL - 50)) > 170;
      const farFromOthers = obstacles.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > p.r + o.r + 80);
      if (farFromSpawn && farFromOthers) obstacles.push(o);
    }
  }

  // Decoración del suelo (solo visual)
  const decor = [];
  for (let i = 0; i < 26; i++) {
    decor.push({
      x: WALL + 20 + rng() * (W - 2 * WALL - 40),
      y: WALL + 20 + rng() * (H - 2 * WALL - 40),
      kind: rng() < 0.6 ? 0 : 1,
      s: 0.7 + rng() * 0.6,
    });
  }

  let waves = [];
  if (type === 'combat' || type === 'elite') waves = makeWaves(index, type === 'elite');
  if (type === 'boss') waves = [['boss']];

  return { index, type, biome, obstacles, decor, waves };
}

// Cada sala tiene un "presupuesto" de enemigos que crece con la profundidad
function makeWaves(index, elite) {
  const pool = ['slime', 'bat'];
  if (index >= 1) pool.push('shooter');
  if (index >= 3) pool.push('charger');
  const total = Math.round((3 + index * 1.5) * (elite ? 1.4 : 1));
  const nWaves = index === 0 ? 1 : elite ? 3 : 2;
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
