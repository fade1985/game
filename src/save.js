// Guardado del progreso permanente (gemas y mejoras del Taller) en el navegador
const KEY = 'blobquest-save-v1';

const DEFAULT = { gems: 0, best: 0, wins: 0, upgrades: { vida: 0, fuerza: 0, bolsa: 0, amigo: 0 } };

export function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { ...DEFAULT, ...d, upgrades: { ...DEFAULT.upgrades, ...(d.upgrades || {}) } };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* modo privado, etc. */ }
}

export function addGems(n) {
  const s = loadSave();
  s.gems += n;
  writeSave(s);
}
