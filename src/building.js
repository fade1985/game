// ─────────────────────────────────────────────
//  Las plantas del edificio (diseño completo en docs/MAPA.md)
//
//  Cada planta es un pasillo largo con cuatro puertas, dos a cada lado. Detrás de cada una hay un mapa
//  aparte: un apartamento, el apartamento del mini jefe (cerrado con llave) o, en la planta baja, la
//  sala de mantenimiento. En el pasillo hay además un ascensor averiado, la puerta por la que se ha
//  llegado y, al fondo, las escaleras de emergencia, que no se abren hasta acabar con el mini jefe.
//
//  La última planta es la azotea: un solo mapa diáfano con el jefe final.
// ─────────────────────────────────────────────
import { makeApartment } from './apartment.js';
import { pick } from './utils.js';
import { CELL } from './shapes.js';
import { ROOM_TYPES, CORRIDOR_COLS, CORRIDOR_ROWS, makeApartmentLayout, makeCorridorLayout, makePlainLayout, makeExit, makeRoomWaves, makeHorde, zoneSpot } from './rooms.js';

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DOOR_AT = 14 * CELL; // a qué distancia de cada extremo del pasillo están las puertas

// Cómo se llama cada planta (la número 1 es la baja y la última, la azotea) y cada puerta
export const floorName = (num, floors) => (num === floors ? 'Azotea' : num === 1 ? 'Planta baja' : `${num - 1}ª planta`);
const doorName = (num, letter) => (num === 1 ? `Bajo ${letter}` : `${num - 1}º${letter}`);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Un mapa del juego: su tipo (ROOM_TYPES), su nombre, lo que hay dentro y sus puertas.
// `horde` son los zombis que ya esperan dentro; `waves`, los que aparecen al entrar (los jefes).
function newRoom(type, name, layout, cleared = true) {
  return { type, name, layout, exits: [], props: [], pickups: [], decals: [], waves: [], horde: [], dist: 0, visited: false, cleared };
}

// Une dos mapas con una puerta en cada uno
function join(roomA, exitA, roomB, exitB) {
  Object.assign(exitA, { to: roomB, back: exitB });
  Object.assign(exitB, { to: roomA, back: exitA });
  roomA.exits.push(exitA);
  roomB.exits.push(exitB);
}

// Genera la planta número `num` de un edificio de `floors` plantas. Devuelve:
//   rooms       todos sus mapas          corridor   el pasillo (null en la azotea)
//   apartments  lo que hay tras las cuatro puertas
//   start, startExit   dónde aparece el conserje (sin puerta: en el centro del mapa)
//   boss        el apartamento del mini jefe        stairs   la puerta de las escaleras de emergencia
//   key         { room, x, y, name } dónde está la llave del mini jefe
//   survivor    { room, x, y } dónde espera el superviviente de la planta
//   hasKey, keyUsed   si el conserje lleva la llave y si ya la ha gastado
export function generateFloor(num, floors) {
  const name = floorName(num, floors);
  const floor = { num, name, rooms: [], apartments: [], corridor: null, boss: null, stairs: null, key: null, survivor: null, hasKey: false, keyUsed: false };

  // La azotea: se llega por la escalera y ya no se puede volver
  if (num === floors) {
    const layout = makePlainLayout('roof');
    const roof = newRoom('boss', name, layout, false);
    const door = makeExit(layout, 'down', layout.w / 2, { kind: 'back', locked: 'never', icon: '🪜', msg: 'Ya no hay vuelta atrás' });
    roof.exits.push(door);
    roof.waves = makeRoomWaves(roof);
    return Object.assign(floor, { rooms: [roof], start: roof, startExit: door });
  }

  // El pasillo, con sus cuatro puertas (A y B arriba, C y D abajo) y el ascensor en medio
  const RW = CORRIDOR_COLS * CELL;
  const slots = [
    { letter: 'A', dir: 'up', at: DOOR_AT }, { letter: 'B', dir: 'up', at: RW - DOOR_AT },
    { letter: 'C', dir: 'down', at: DOOR_AT }, { letter: 'D', dir: 'down', at: RW - DOOR_AT },
  ];
  const lift = { dir: 'up', at: RW / 2 };
  const ends = [{ dir: 'left', at: (CORRIDOR_ROWS * CELL) / 2 }, { dir: 'right', at: (CORRIDOR_ROWS * CELL) / 2 }];
  const hall = makeCorridorLayout([...slots, lift, ...ends]);
  const corridor = newRoom('corridor', name, hall);

  // Qué hay detrás de cada puerta. En la planta baja, la A es la sala de mantenimiento.
  const ground = num === 1;
  const free = slots.filter((s) => !(ground && s.letter === 'A'));
  // la mini jefa vive en el 4ºB (en la 4ª planta); en las demás, detrás de una puerta al azar
  const bossSlot = free.find((s) => doorName(num, s.letter) === '4ºB') || pick(free);
  for (const s of slots) {
    let room, back, look = {};
    if (!free.includes(s)) {
      const layout = makePlainLayout('maintenance');
      room = newRoom('maintenance', ROOM_TYPES.maintenance.name, layout);
      back = makeExit(layout, OPPOSITE[s.dir], layout.w / 2);
      look = { frame: ROOM_TYPES.maintenance.frame, icon: ROOM_TYPES.maintenance.icon, label: 'Mantenimiento' };
    } else {
      const boss = s === bossSlot;
      // la puerta del apartamento está en el lado que da al pasillo
      const layout = makeApartmentLayout(makeApartment({ boss, side: OPPOSITE[s.dir] }));
      room = newRoom(boss ? 'miniboss' : 'apartment', doorName(num, s.letter), layout, false);
      back = makeExit(layout, layout.entry.dir, layout.entry.at);
      look = { label: room.name };
      if (boss) Object.assign(look, { frame: ROOM_TYPES.miniboss.frame, icon: ROOM_TYPES.miniboss.icon, locked: 'key', msg: 'Cerrada con llave 🔒' });
    }
    join(corridor, makeExit(hall, s.dir, s.at, look), room, back);
    floor.apartments.push(room);
  }
  corridor.exits.push(makeExit(hall, lift.dir, lift.at, { kind: 'elevator', locked: 'never', label: 'Averiado', msg: 'El ascensor está averiado' }));
  // por donde se ha llegado (en la planta baja, el portal del edificio) y por donde se sigue subiendo
  const arrival = makeExit(hall, 'left', hall.h / 2, ground
    ? { kind: 'back', locked: 'never', label: 'Portal', msg: 'El edificio sigue infestado: aún no puedes irte' }
    : { kind: 'back', locked: 'never', icon: '🪜', msg: 'Por ahí has subido' });
  const stairs = makeExit(hall, 'right', hall.h / 2, { kind: 'stairs', locked: 'boss', frame: '#80ed99', icon: '🪜', label: 'Escaleras', msg: 'Bloqueadas: acaba con el mini jefe' });
  corridor.exits.push(arrival, stairs);

  // Dificultad: los apartamentos normales, en un orden al azar, y el mini jefe al final
  const normal = floor.apartments.filter((r) => r.type === 'apartment');
  shuffle([...normal]).forEach((r, i) => { r.dist = i + 1; });
  const boss = floor.apartments.find((r) => r.type === 'miniboss');
  boss.dist = normal.length + 1;
  for (const r of floor.apartments) {
    r.waves = makeRoomWaves(r);
    if (r.type === 'apartment') r.horde = makeHorde(r.layout, r.dist, num);
  }

  // La llave del mini jefe, en una habitación (que no sea el salón) de otro apartamento
  const keyRoom = pick(normal);
  const keyZone = pick(keyRoom.layout.zones.filter((z) => z.use !== 'salon'));
  floor.key = { room: keyRoom, name: `Llave del ${boss.name}`, ...zoneSpot(keyRoom.layout, keyZone) };
  // El superviviente, en cualquier habitación de cualquier apartamento (menos donde está la llave)
  const survRoom = pick(normal);
  const survZone = pick(survRoom.layout.zones.filter((z) => z !== keyZone));
  floor.survivor = { room: survRoom, ...zoneSpot(survRoom.layout, survZone) };

  return Object.assign(floor, {
    rooms: [corridor, ...floor.apartments], corridor, boss, stairs,
    start: ground ? floor.apartments[0] : corridor,
    startExit: ground ? null : arrival,
  });
}
