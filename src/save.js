// Guardado del progreso en el navegador (en la fase 7 guardará los edificios desbloqueados)
const KEY = 'blobquest-save-v2';

const DEFAULT = { bestFloor: 0, buildings: { apartamentos: { unlocked: true, completed: false } } };

export function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { ...structuredClone(DEFAULT), ...d };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* modo privado, etc. */ }
}
