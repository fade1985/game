// ─────────────────────────────────────────────
//  Configuración general del juego
// ─────────────────────────────────────────────

// Tamaño "lógico" de una sala. El canvas se escala para encajar en la pantalla,
// pero toda la lógica trabaja siempre con estas medidas.
export const W = 960;
export const H = 640;
export const WALL = 56;         // grosor de los muros de cada sala
export const DOOR_W = 96;       // ancho de las puertas
export const GRID = 9;          // la planta se genera en una cuadrícula de GRID x GRID
export const MAX_ALLIES = 4;    // tamaño máximo del equipo

export const OUTLINE = '#1d1b2c'; // color del contorno "de dibujo animado"
export const ALLY_COLORS = ['#4cc9f0', '#80ed99', '#ff8fab', '#c77dff', '#ff9f1c'];

// Aspecto del protagonista: un conserje con su mono de trabajo
export const PLAYER_LOOK = {
  skin: '#ffd2a8',
  hair: '#6b3e26',
  shirt: '#fff3d6',
  pants: '#3f6fd8',
  overalls: '#4f86f7',
  shoes: '#3b3550',
  bandana: '#ff5d73',
};

// Direcciones de las puertas: [dx, dy] en la cuadrícula de la planta
export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Edificios. De momento solo hay uno.
export const BUILDINGS = {
  apartamentos: {
    name: 'Apartamentos',
    icon: '🏢',
    floors: 3,
    roomsPerFloor: [8, 10, 12],
  },
};

// Estilos de habitación de un piso: suelo + papel pintado
export const APARTMENT_STYLES = [
  { name: 'Salón',      floor: 'parquet', floorA: '#dba36a', floorB: '#cf955c', seam: '#b07a45', wall: '#f2bd92', stripe: '#e8ad7f', trim: '#8b5a3c', rug: '#f29bab' },
  { name: 'Cocina',     floor: 'tiles',   floorA: '#f2f5f7', floorB: '#cfdbe4', seam: '#aebfcc', wall: '#a8d5c4', stripe: '#97c9b6', trim: '#5c8f7c', rug: null },
  { name: 'Dormitorio', floor: 'carpet',  floorA: '#bcc6ec', floorB: '#aeb9e4', seam: '#9ba7d6', wall: '#dbc6f0', stripe: '#cfb6ea', trim: '#7a62a8', rug: '#ffe39a' },
  { name: 'Pasillo',    floor: 'parquet', floorA: '#c99260', floorB: '#bd8654', seam: '#9e6c3d', wall: '#f4dd9c', stripe: '#ebd189', trim: '#9a7340', rug: '#9fdcf2' },
  { name: 'Baño',       floor: 'tiles',   floorA: '#d7efe6', floorB: '#b9e0d3', seam: '#94c7b6', wall: '#bfe0f2', stripe: '#aed5ec', trim: '#4f86a8', rug: null },
];

// Supervivientes que se pueden rescatar. `ability` define lo que hace cada uno:
//   shoot: dispara `burst` balas de `dmg` cada `every` segundos
//   heal:  cura `amount` cada `every` segundos y `onClear` al limpiar una sala
export const SURVIVORS = {
  policia: {
    id: 'policia', name: 'Policía', icon: '👮', color: '#6fa8ff',
    desc: 'Dispara con su pistola cada 1,2 s',
    ability: { kind: 'shoot', every: 1.2, dmg: 5, burst: 1, weapon: 'pistola' },
    look: { skin: '#f1c27d', hair: '#2b2b2b', shirt: '#3d63c9', pants: '#22336b', shoes: '#1d1b2c', hat: { kind: 'cap', color: '#22336b' } },
  },
  medico: {
    id: 'medico', name: 'Médica', icon: '🧑‍⚕️', color: '#80ed99',
    desc: 'Te cura 3 cada 8 s y 15 al limpiar cada sala',
    ability: { kind: 'heal', every: 8, amount: 3, onClear: 15 },
    look: { skin: '#ffd2a8', hair: '#c0392b', shirt: '#ffffff', pants: '#7fd1c7', shoes: '#3b3550', cross: true },
  },
  militar: {
    id: 'militar', name: 'Militar', icon: '🪖', color: '#c9e265',
    desc: 'Lanza ráfagas de 3 balas cada 2,5 s',
    ability: { kind: 'shoot', every: 2.5, dmg: 6, burst: 3, gap: 0.1, weapon: 'rifle' },
    look: { skin: '#c68642', hair: '#3b2a1a', shirt: '#6b8e23', pants: '#4b5320', shoes: '#2e2a1f', hat: { kind: 'helmet', color: '#556b2f' } },
  },
};
