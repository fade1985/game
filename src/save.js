// ─────────────────────────────────────────────
//  Guardado del progreso en el navegador (localStorage)
//
//  Se guarda: dólares, puntos y talentos, objetos del baúl, armas desbloqueadas, récords y el progreso de cada edificio.
//  Las partidas a medias NO se guardan: si cierras, empiezas el edificio de nuevo.
// ─────────────────────────────────────────────
const KEY = 'blobquest-save-v2';

const BUILDING_DEFAULT = { completed: false, runs: 0, wins: 0, bestFloor: 0, bestTime: 0 };

const DEFAULT = {
  bestFloor: 0,     // mejor planta alcanzada en cualquier edificio
  keys: 0,          // dólares ahorrados (antes eran llaves: el nombre se queda para no perder lo ahorrado)
  puntos: 0,        // puntos de talento sin gastar (se compran con dólares en el ordenador)
  talentos: {},     // puntos puestos en cada talento del árbol: { ataque: 3, ... } (fase C)
  totalKeys: 0,     // dólares conseguidos en total
  runs: 0,
  wins: 0,
  kills: 0,
  baul: {},         // objetos para crear armas guardados en el baúl: { clavos: 2, ... } (objetos.js)
  rescatados: [],   // supervivientes rescatados (ids de SURVIVORS): viven en la sala de mantenimiento (superviviente.js)
  acompanante: null, // el que te acompaña en cada partida (uno de los rescatados), o null para ir solo
  baulArmas: [],    // armas creadas en el banco de trabajo, guardadas en el baúl hasta sacarlas (banco.js)
  weapons: [],      // armas desbloqueadas (encontradas alguna vez): ['bate', ...]. La fregona siempre está
  buildings: {},    // progreso por edificio: { apartamentos: { ... } }
  settings: { music: true },
};

export function loadSave() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* guardado roto o sin acceso */ }
  const save = { ...structuredClone(DEFAULT), ...d };
  delete save.workshop; // el Taller ya no existe: se olvidan sus mejoras
  save.talentos = { ...(d.talentos || {}) };
  save.weapons = [...(d.weapons || [])];
  save.baul = { ...(d.baul || {}) };
  save.baulArmas = [...(d.baulArmas || [])];
  save.rescatados = [...(d.rescatados || [])];
  save.settings = { ...DEFAULT.settings, ...(d.settings || {}) };
  save.buildings = {};
  for (const [id, b] of Object.entries(d.buildings || {})) save.buildings[id] = { ...BUILDING_DEFAULT, ...b };
  return save;
}

// Progreso de un edificio (con valores por defecto si aún no se ha jugado)
export function buildingSave(save, id) {
  if (!save.buildings[id]) save.buildings[id] = { ...BUILDING_DEFAULT };
  return save.buildings[id];
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* modo privado, etc. */ }
}

// Carga, modifica y guarda en un paso: updateSave((s) => { s.keys++; })
export function updateSave(fn) {
  const save = loadSave();
  fn(save);
  writeSave(save);
  return save;
}
