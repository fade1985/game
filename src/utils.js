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

// Distancia desde el punto `p` hasta el borde del obstáculo `o` (círculo o rectángulo).
// Es negativa si el punto está dentro.
export function obstacleGap(o, p) {
  if (o.shape === 'rect') {
    const dx = Math.abs(p.x - o.x) - o.w / 2, dy = Math.abs(p.y - o.y) - o.h / 2;
    if (dx <= 0 && dy <= 0) return Math.max(dx, dy);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }
  return Math.hypot(p.x - o.x, p.y - o.y) - o.r;
}

// Empuja la entidad circular `e` fuera del obstáculo `o` (círculo o rectángulo)
export function pushOut(e, o) {
  if (o.shape === 'rect') {
    const hw = o.w / 2, hh = o.h / 2;
    const cx = clamp(e.x, o.x - hw, o.x + hw), cy = clamp(e.y, o.y - hh, o.y + hh);
    const dx = e.x - cx, dy = e.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= e.r) return false;
    if (d > 0.001) {
      e.x = cx + (dx / d) * e.r;
      e.y = cy + (dy / d) * e.r;
    } else {
      // el centro está dentro: sale por el lado más cercano
      const px = hw - Math.abs(e.x - o.x), py = hh - Math.abs(e.y - o.y);
      if (px < py) e.x = o.x + Math.sign(e.x - o.x || 1) * (hw + e.r);
      else e.y = o.y + Math.sign(e.y - o.y || 1) * (hh + e.r);
    }
    return true;
  }
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
