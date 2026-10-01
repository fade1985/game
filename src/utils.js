// Pequeñas funciones de ayuda que usamos en todas partes

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Elige un elemento de una lista [[valor, peso], ...] según su peso
export function weighted(list) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of list) {
    r -= w;
    if (r <= 0) return v;
  }
  return list[list.length - 1][0];
}

// Generador aleatorio con semilla (para que la decoración de una sala sea estable)
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Empuja la entidad `e` fuera del círculo `o` (colisión círculo-círculo)
export function pushOut(e, o) {
  const dx = e.x - o.x, dy = e.y - o.y;
  const d = Math.hypot(dx, dy) || 0.01;
  const min = e.r + o.r;
  if (d < min) {
    e.x = o.x + (dx / d) * min;
    e.y = o.y + (dy / d) * min;
    return true;
  }
  return false;
}
