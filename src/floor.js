// ─────────────────────────────────────────────
//  Generador de plantas al estilo Binding of Isaac
//
//  Partimos de una sala central y vamos "creciendo" hacia salas vecinas
//  en una cuadrícula. Una casilla solo se añade si como mucho toca a una
//  sala ya existente: así salen pasillos y ramas (forma irregular), sin
//  bloques macizos de 2x2.
// ─────────────────────────────────────────────
import { GRID, DIRS, OPPOSITE } from './config.js';
import { makeRoomLayout, makeRoomWaves } from './rooms.js';

export const keyOf = (gx, gy) => `${gx},${gy}`;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Devuelve las posiciones de las salas, o null si el intento no sirve
function growLayout(count) {
  const cells = new Set();
  const start = { gx: Math.floor(GRID / 2), gy: Math.floor(GRID / 2) };
  const queue = [start];
  cells.add(keyOf(start.gx, start.gy));

  const neighbours = (gx, gy) =>
    Object.values(DIRS).filter(([dx, dy]) => cells.has(keyOf(gx + dx, gy + dy))).length;

  while (queue.length && cells.size < count) {
    const c = queue.shift();
    for (const [dx, dy] of shuffle(Object.values(DIRS))) {
      if (cells.size >= count) break;
      const gx = c.gx + dx, gy = c.gy + dy;
      if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) continue;
      if (cells.has(keyOf(gx, gy))) continue;
      if (neighbours(gx, gy) > 1) continue; // evitamos bucles y bloques
      if (Math.random() < 0.5) continue;    // aleatoriedad en la forma
      cells.add(keyOf(gx, gy));
      queue.push({ gx, gy });
    }
  }
  if (cells.size < count) return null;
  return { cells, start };
}

// Genera una planta completa con `count` salas.
// En la última planta del edificio (`isFinal`) se añade la sala del jefe final.
export function generateFloor(count, floorNum = 1, isFinal = false) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const res = growLayout(count);
    if (!res) continue;
    const { cells, start } = res;

    // Creamos las salas y sus puertas (una puerta por cada vecina)
    const rooms = new Map();
    for (const k of cells) {
      const [gx, gy] = k.split(',').map(Number);
      const doors = {};
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) doors[dir] = cells.has(keyOf(gx + dx, gy + dy));
      rooms.set(k, { key: k, gx, gy, doors, dist: 0, type: 'monsters', visited: false, seen: false, cleared: false, pickups: [] });
    }

    // Distancia (en salas) desde la entrada: sirve para la dificultad y,
    // en la fase 2, para colocar al mini jefe en la sala más lejana.
    const startRoom = rooms.get(keyOf(start.gx, start.gy));
    const seen = new Set([startRoom.key]);
    const bfs = [startRoom];
    while (bfs.length) {
      const r = bfs.shift();
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
        if (!r.doors[dir]) continue;
        const n = rooms.get(keyOf(r.gx + dx, r.gy + dy));
        if (seen.has(n.key)) continue;
        seen.add(n.key);
        n.dist = r.dist + 1;
        bfs.push(n);
      }
    }

    // Callejones sin salida (una sola puerta): ahí irán las salas especiales.
    const deadEnds = [...rooms.values()].filter((r) => r !== startRoom && Object.values(r.doors).filter(Boolean).length === 1);
    if (deadEnds.length < 3) continue;

    startRoom.type = 'start';
    startRoom.cleared = true;

    // Salas especiales en los callejones: el mini jefe en el más lejano
    deadEnds.sort((a, b) => b.dist - a.dist);
    const mini = deadEnds[0];
    mini.type = 'miniboss';
    const others = shuffle(deadEnds.slice(1));
    others[0].type = 'item';
    others[1].type = 'survivor';

    // Última planta: la sala del jefe va pegada a la del mini jefe y solo
    // se llega a ella a través de él.
    if (isFinal) {
      let placed = false;
      for (const [dir, [dx, dy]] of shuffle(Object.entries(DIRS))) {
        const gx = mini.gx + dx, gy = mini.gy + dy;
        if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID || rooms.has(keyOf(gx, gy))) continue;
        const touching = Object.values(DIRS).filter(([ex, ey]) => rooms.has(keyOf(gx + ex, gy + ey))).length;
        if (touching !== 1) continue;
        const doors = { up: false, down: false, left: false, right: false };
        doors[OPPOSITE[dir]] = true;
        mini.doors[dir] = true;
        rooms.set(keyOf(gx, gy), { key: keyOf(gx, gy), gx, gy, doors, dist: mini.dist + 1, type: 'boss', visited: false, seen: false, cleared: false, pickups: [] });
        placed = true;
        break;
      }
      if (!placed) continue;
    }

    for (const r of rooms.values()) {
      r.layout = makeRoomLayout(r.type);
      r.waves = makeRoomWaves(r, floorNum);
      r.props = [];
      if (!r.waves.length) r.cleared = true; // salas sin enemigos: entrada y objeto
      // tipo de sala que hay detrás de cada puerta (para decorar la puerta)
      r.doorTypes = {};
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
        if (r.doors[dir]) r.doorTypes[dir] = rooms.get(keyOf(r.gx + dx, r.gy + dy)).type;
      }
    }
    return { rooms, start: startRoom, deadEnds, floorNum, isFinal };
  }
  throw new Error('No se pudo generar la planta');
}

// Sala vecina en una dirección (o undefined)
export function neighbour(floor, room, dir) {
  const [dx, dy] = DIRS[dir];
  return floor.rooms.get(keyOf(room.gx + dx, room.gy + dy));
}
