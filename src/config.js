// ─────────────────────────────────────────────
//  Configuración general del juego
// ─────────────────────────────────────────────

// Tamaño "lógico" del mundo. El canvas se escala para encajar en la pantalla,
// pero toda la lógica trabaja siempre con estas medidas.
export const W = 960;
export const H = 640;
export const WALL = 56;         // grosor de los muros de cada sala
export const DOOR_W = 96;       // ancho de las puertas
export const TOTAL_ROOMS = 10;  // salas por partida (la última es el jefe)
export const MAX_ALLIES = 4;    // tamaño máximo del equipo

export const OUTLINE = '#1d1b2c'; // color del contorno "de dibujo animado"
export const PLAYER_COLOR = '#ffd23f';
export const ALLY_COLORS = ['#4cc9f0', '#80ed99', '#ff8fab', '#c77dff', '#ff9f1c'];

// Cada zona (bioma) cambia los colores del suelo y de los muros
export const BIOMES = [
  { name: 'Pradera',  floorA: '#8ed36b', floorB: '#84c862', wall: '#5a9e45', wallDark: '#4a873a', deco: '#6fb552', obstacle: 'bush',   obColor: '#4fa83d' },
  { name: 'Desierto', floorA: '#f6d98f', floorB: '#efcf7f', wall: '#d29a55', wallDark: '#b98243', deco: '#ddb565', obstacle: 'rock',   obColor: '#c9a27a' },
  { name: 'Cripta',   floorA: '#b3a5e0', floorB: '#a99ad6', wall: '#5e4c96', wallDark: '#4e3e82', deco: '#9787c9', obstacle: 'pillar', obColor: '#8676bf' },
];

export function biomeFor(index) {
  if (index < 3) return BIOMES[0];
  if (index < 6) return BIOMES[1];
  return BIOMES[2];
}
