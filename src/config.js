// ─────────────────────────────────────────────
//  Configuración general del juego
// ─────────────────────────────────────────────

// Tamaño "lógico" de una sala. El canvas se escala para encajar en la pantalla,
// pero toda la lógica trabaja siempre con estas medidas.
export const W = 960;
export const H = 640;
export const WALL = 64;         // grosor de los muros de cada sala (2 baldosas en pixel art)
export const DOOR_W = 96;       // ancho de las puertas
export const MAX_ALLIES = 4;    // tamaño máximo del equipo
export const SLIDE = 0.4;       // duración del deslizamiento de cámara al cruzar una puerta
export const FADE = 0.6;        // duración de cada mitad del fundido al cambiar de planta

// ── Pixel art ──
// El mundo se dibuja a la mitad de resolución y se amplía sin suavizado:
// 1 píxel del dibujo = PIXEL unidades lógicas. Las baldosas miden TILE píxeles.
// Así los muros miden 2 baldosas de grueso y las puertas, 3 de ancho.
export const PIXEL = 2;
export const TILE = 16;

export const OUTLINE = '#1d1b2c'; // color del contorno "de dibujo animado"

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

// Hacia dónde se sale por una puerta según el muro en el que está: [dx, dy]
export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// Edificios. De momento solo se pueden jugar los Apartamentos; el resto
// aparecen en el selector como "Próximamente".
export const BUILDINGS = {
  apartamentos: {
    id: 'apartamentos',
    name: 'Apartamentos',
    icon: '🏢',
    desc: 'Vecinos zombi, un mini jefe por planta y una portera con muy mal genio',
    floors: 6, // planta baja, cuatro plantas más y la azotea (la última siempre es la azotea)
  },
  hospital:  { id: 'hospital',  name: 'Hospital',         icon: '🏥', desc: 'Camillas, quirófanos y enfermeras zombi', soon: true },
  centro:    { id: 'centro',    name: 'Centro comercial', icon: '🛍️', desc: 'Escaleras mecánicas y rebajas de muerte', soon: true },
  comisaria: { id: 'comisaria', name: 'Comisaría',        icon: '🚓', desc: 'Calabozos y un arsenal bien guardado', soon: true },
};

// Estilos de habitación de un piso: suelo + papel pintado
export const APARTMENT_STYLES = [
  { name: 'Salón',      floor: 'parquet', floorA: '#dba36a', floorB: '#cf955c', seam: '#b07a45', wall: '#f2bd92', stripe: '#e8ad7f', trim: '#8b5a3c', rug: '#f29bab' },
  { name: 'Cocina',     floor: 'tiles',   floorA: '#f2f5f7', floorB: '#cfdbe4', seam: '#aebfcc', wall: '#a8d5c4', stripe: '#97c9b6', trim: '#5c8f7c', rug: null },
  { name: 'Dormitorio', floor: 'carpet',  floorA: '#bcc6ec', floorB: '#aeb9e4', seam: '#9ba7d6', wall: '#dbc6f0', stripe: '#cfb6ea', trim: '#7a62a8', rug: '#ffe39a' },
  { name: 'Pasillo',    floor: 'parquet', floorA: '#c99260', floorB: '#bd8654', seam: '#9e6c3d', wall: '#f4dd9c', stripe: '#ebd189', trim: '#9a7340', rug: '#9fdcf2' },
  { name: 'Baño',       floor: 'tiles',   floorA: '#d7efe6', floorB: '#b9e0d3', seam: '#94c7b6', wall: '#bfe0f2', stripe: '#aed5ec', trim: '#4f86a8', rug: null },
];
// Otros sitios del edificio
const OTHER_STYLES = [
  { name: 'Mantenimiento', floor: 'tiles',    floorA: '#c9ccd3', floorB: '#b6bac4', seam: '#9a9eaa', wall: '#9fb0c2', stripe: '#93a5b8', trim: '#4a5568', rug: null },
  { name: 'Azotea',        floor: 'concrete', floorA: '#8f939c', floorB: '#858992', seam: '#6f737c', wall: '#5f6470', stripe: '#575c68', trim: '#3d414b', rug: null },
];
// Todos los estilos, por su nombre: STYLES['Cocina']
export const STYLES = Object.fromEntries([...APARTMENT_STYLES, ...OTHER_STYLES].map((s) => [s.name, s]));

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
    desc: 'Te cura 3 cada 8 s y 10 al limpiar cada sala',
    ability: { kind: 'heal', every: 8, amount: 3, onClear: 10 },
    look: { skin: '#ffd2a8', hair: '#c0392b', shirt: '#ffffff', pants: '#7fd1c7', shoes: '#3b3550', cross: true },
  },
  militar: {
    id: 'militar', name: 'Militar', icon: '🪖', color: '#c9e265',
    desc: 'Lanza ráfagas de 3 balas cada 2,5 s',
    ability: { kind: 'shoot', every: 2.5, dmg: 6, burst: 3, gap: 0.1, weapon: 'rifle' },
    look: { skin: '#c68642', hair: '#3b2a1a', shirt: '#6b8e23', pants: '#4b5320', shoes: '#2e2a1f', hat: { kind: 'helmet', color: '#556b2f' } },
  },
};
