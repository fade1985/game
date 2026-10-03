// ─────────────────────────────────────────────
//  Guardado del progreso en el navegador (localStorage)
//
//  Se guarda: llaves, mejoras del Taller, récords y el progreso de cada edificio.
//  Las partidas a medias NO se guardan: si cierras, empiezas el edificio de nuevo.
// ─────────────────────────────────────────────
const KEY = 'blobquest-save-v2';

const BUILDING_DEFAULT = { completed: false, runs: 0, wins: 0, bestFloor: 0, bestTime: 0 };

const DEFAULT = {
  bestFloor: 0,     // mejor planta alcanzada en cualquier edificio
  keys: 0,          // llaves para gastar en el Taller
  totalKeys: 0,     // llaves conseguidas en total
  runs: 0,
  wins: 0,
  kills: 0,
  workshop: {},     // nivel de cada mejora del Taller: { vida: 2, ... }
  buildings: {},    // progreso por edificio: { apartamentos: { ... } }
};

export function loadSave() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* guardado roto o sin acceso */ }
  const save = { ...structuredClone(DEFAULT), ...d };
  save.workshop = { ...(d.workshop || {}) };
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
