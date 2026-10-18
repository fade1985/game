// ─────────────────────────────────────────────
//  Muebles y decoración de las habitaciones
//
//  Los muebles van pegados a las paredes (nunca delante de una puerta) y son
//  obstáculos rectangulares: paran a los personajes y a las balas.
//  Se ven "en tres cuartos": enseñan el frente y tienen altura, como los personajes.
//  Por eso cada uno solo puede ir en las paredes para las que tiene dibujo (ver goesOn).
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, FACE_H } from './config.js';
import { drawSprite, hasSprite, spriteMeta, furnitureShadow } from './sprites.js';
import { CELL, rectIsFloor } from './shapes.js';
import { drawCached } from './draw.js';
import { MUEBLES, SALAS } from './catalogo.js';
import { mulberry32 } from './utils.js';

const TAU = Math.PI * 2;

// Medidas de cada mueble, qué muebles lleva cada sala y en qué paredes va cada uno: en catalogo.js
const PIECES = MUEBLES;
const styleOf = (styleName) => SALAS[styleName] || SALAS['Pasillo'];

// En la pared de arriba van todos: se les ve de frente. En las laterales, los que tienen un dibujo de lado
// (`mueble-<tipo>-lado`) o se ven igual desde cualquier sitio. En la de abajo solo estos últimos.
const goesOn = (kind, side) => side === 'top' || PIECES[kind].paredes === 'todas' || (side !== 'bottom' && PIECES[kind].paredes === 'lados');

// Tramos de pared libres (sin puerta) donde se pueden poner muebles en la sala de siempre (960×640)
const GAP = DOOR_W / 2 + 44;
const SEGMENTS = [
  { side: 'top', a: WALL + 4, b: W / 2 - GAP },
  { side: 'top', a: W / 2 + GAP, b: W - WALL - 4 },
  { side: 'bottom', a: WALL + 4, b: W / 2 - GAP },
  { side: 'bottom', a: W / 2 + GAP, b: W - WALL - 4 },
  { side: 'left', a: WALL + 4, b: H / 2 - GAP },
  { side: 'left', a: H / 2 + GAP, b: H - WALL - 4 },
  { side: 'right', a: WALL + 4, b: H / 2 - GAP },
  { side: 'right', a: H / 2 + GAP, b: H - WALL - 4 },
];

const ROT = { top: 0, right: Math.PI / 2, bottom: Math.PI, left: -Math.PI / 2 };

// Tramos de pared de un mapa cualquiera: cada borde donde el suelo toca un muro, también los de los tabiques.
// `base` es la coordenada de la pared (y en las de arriba/abajo, x en las laterales).
// Con `zone` solo se miran las casillas de esa habitación (layout.owner dice de quién es cada casilla).
function wallSegments(layout, zone) {
  const segs = [];
  const { cols, rows } = layout;
  const wall = (c, r) => layout.grid[r * cols + c] === 1;
  const mine = (c, r) => !wall(c, r) && (zone === undefined || layout.owner[r * cols + c] === zone);
  // recorre una fila (o columna) y junta las casillas seguidas que tienen muro en ese lado
  const scan = (side, len, hasEdge, base) => {
    for (let i = 0; i < len; i++) {
      if (!hasEdge(i)) continue;
      const i0 = i;
      while (i < len && hasEdge(i)) i++;
      segs.push({ side, a: i0 * CELL + 4, b: i * CELL - 4, base });
    }
  };
  for (let r = 1; r < rows - 1; r++) {
    scan('top', cols, (c) => mine(c, r) && wall(c, r - 1), r * CELL);
    scan('bottom', cols, (c) => mine(c, r) && wall(c, r + 1), (r + 1) * CELL);
  }
  for (let c = 1; c < cols - 1; c++) {
    scan('left', rows, (r) => mine(c, r) && wall(c - 1, r), c * CELL);
    scan('right', rows, (r) => mine(c, r) && wall(c + 1, r), (c + 1) * CELL);
  }
  return segs.filter((s) => s.b - s.a >= 30);
}

// Coloca entre `min` y `max` muebles al azar (con el generador `rng` del mapa). Opciones:
//   skipSide  deja una pared sin muebles (la de arriba en mantenimiento, donde van las armas)
//   layout    el mapa, cuando no es la sala de siempre ({ grid, cols, rows, w, h, owner }): los muebles se
//             arriman también a sus tabiques
//   zone      solo dentro de esa habitación del apartamento
//   clear     rectángulos que tienen que quedar libres ([{ x0, y0, x1, y1 }]): delante de las puertas
//   fits      función que dice si, con ese mueble puesto, se sigue pudiendo pasar (rooms.js)
//   maxDep    fondo máximo de los muebles (para sitios estrechos, como el pasillo)
export function placeFurniture(styleName, rng, min, max, { skipSide = null, layout = null, zone, clear = [], fits = null, maxDep = Infinity } = {}) {
  const { muebles, iguales = {} } = styleOf(styleName);
  const pool = muebles.filter((k) => PIECES[k].dep <= maxDep);
  const want = min + Math.floor(rng() * (max - min + 1));
  const segments = layout ? wallSegments(layout, zone) : SEGMENTS;
  const tops = segments.filter((s) => s.side === 'top' && s.side !== skipSide);
  const placed = [];
  for (let tries = 0; pool.length && segments.length && placed.length < want && tries < (layout ? 240 : 80); tries++) {
    // primero la pared (con preferencia por las de arriba, donde cabe cualquier mueble) y luego un mueble que valga para ella
    const from = tops.length && rng() < 0.55 ? tops : segments;
    const seg = from[Math.floor(rng() * from.length)];
    if (seg.side === skipSide) continue;
    const fit = pool.filter((k) => goesOn(k, seg.side) && PIECES[k].len <= seg.b - seg.a
      // nada repetido de más (ni dos lavadoras en la cocina ni dos váteres en el baño)
      && placed.filter((p) => p.kind === k).length < (iguales[k] || 1));
    if (!fit.length) continue;
    const kind = fit[Math.floor(rng() * fit.length)];
    const pc = PIECES[kind];
    const along = Math.round((seg.a + pc.len / 2 + rng() * (seg.b - seg.a - pc.len)) / 2) * 2; // en píxeles enteros del dibujo
    const horiz = seg.side === 'top' || seg.side === 'bottom';
    const o = { shape: 'rect', kind, side: seg.side, len: pc.len, dep: pc.dep, seed: rng(), zone };
    if (horiz) {
      o.x = along; o.w = pc.len; o.h = pc.dep;
      o.y = seg.side === 'top' ? (seg.base ?? WALL) + pc.dep / 2 : (seg.base ?? H - WALL) - pc.dep / 2;
    } else {
      o.y = along; o.w = pc.dep; o.h = pc.len;
      o.x = seg.side === 'left' ? (seg.base ?? WALL) + pc.dep / 2 : (seg.base ?? W - WALL) - pc.dep / 2;
    }
    // el mueble tiene que caber entero en el suelo, sin tapar una puerta ni cortar el paso
    if (layout && !rectIsFloor(layout, o.x, o.y, o.w, o.h)) continue;
    if (clear.some((k) => o.x + o.w / 2 > k.x0 && o.x - o.w / 2 < k.x1 && o.y + o.h / 2 > k.y0 && o.y - o.h / 2 < k.y1)) continue;
    if (placed.some((p) => Math.abs(p.x - o.x) < (p.w + o.w) / 2 + 10 && Math.abs(p.y - o.y) < (p.h + o.h) / 2 + 10)) continue;
    if (fits && !fits(o)) continue;
    placed.push(o);
  }
  return placed;
}

// ═════════════ Plantillas de la pared del fondo ═════════════
// (las plantillas de cada sala y cómo funcionan, en catalogo.js)
export const hasTemplates = (styleName) => !!SALAS[styleName]?.plantillas;

// Amuebla la pared del fondo de una habitación (sus tramos de pared de arriba) con una de sus plantillas.
// Si la pared tiene una puerta, o delante de una puerta lateral hay que dejar sitio, los muebles se reparten
// por los trozos libres que quedan, en el mismo orden. Mismas opciones que placeFurniture.
export function placeBackWall(styleName, rng, { layout, zone, clear = [], fits = null }) {
  const tops = wallSegments(layout, zone).filter((s) => s.side === 'top');
  if (!tops.length) return [];
  const base = Math.min(...tops.map((s) => s.base));
  const SEP = 8;   // separación mínima entre muebles
  const DEP = 60;  // fondo del mueble más hondo: la franja de suelo que se mira para no tapar puertas
  // trozos libres de la pared: sus tramos, quitando lo que tiene que quedar despejado
  let free = tops.filter((s) => s.base === base).map((s) => [s.a, s.b]);
  for (const k of clear) {
    if (k.y1 <= base || k.y0 >= base + DEP) continue;
    free = free.flatMap(([a, b]) => [[a, Math.min(b, k.x0)], [Math.max(a, k.x1), b]]).filter(([a, b]) => b - a >= 30);
  }
  free.sort((p, q) => p[0] - q[0]);

  // reparte los muebles por orden en los trozos: cada uno en el primero donde aún quepa
  const flow = (kinds) => {
    const groups = free.map(() => []);
    let i = 0, used = 0;
    for (const k of kinds) {
      const len = PIECES[k].len;
      while (i < free.length && used + (groups[i].length ? SEP : 0) + len > free[i][1] - free[i][0]) { i++; used = 0; }
      if (i >= free.length) return null;
      used += (groups[i].length ? SEP : 0) + len;
      groups[i].push(k);
    }
    return groups;
  };

  const { plantillas, quitar } = SALAS[styleName];
  for (const tpl of [...plantillas].sort(() => rng() - 0.5)) {
    // primero entera; si no cabe, quitando opcionales uno a uno
    let kinds = tpl.map((k) => k.replace('?', ''));
    const optional = tpl.filter((k) => k.endsWith('?')).map((k) => k.slice(0, -1))
      .sort((p, q) => quitar.indexOf(q) - quitar.indexOf(p)); // pop() saca el primero de `quitar`
    let groups = flow(kinds);
    while (!groups && optional.length) { kinds = kinds.filter((k) => k !== optional.pop()); groups = flow(kinds); }
    if (!groups) continue;
    // en cada trozo, el sitio que sobra se reparte en huecos al azar (a los lados y entre muebles)
    const placed = [];
    groups.forEach((ks, g) => {
      if (!ks.length) return;
      const [a, b] = free[g];
      const spare = b - a - ks.reduce((s, k) => s + PIECES[k].len, 0) - SEP * (ks.length - 1);
      const cuts = ks.map(() => rng()).concat(rng() * 0.5, rng() * 0.5);
      const sum = cuts.reduce((s, v) => s + v, 0);
      let x = a + spare * cuts[ks.length] / sum;
      ks.forEach((k, i) => {
        const pc = PIECES[k];
        const cx = Math.round((x + pc.len / 2) / 2) * 2; // en píxeles enteros del dibujo
        placed.push({ shape: 'rect', kind: k, side: 'top', len: pc.len, dep: pc.dep, seed: rng(), zone,
          x: cx, y: base + pc.dep / 2, w: pc.len, h: pc.dep });
        x += pc.len + SEP + (i < ks.length - 1 ? spare * cuts[i] / sum : 0);
      });
    });
    if (!placed.every((o) => rectIsFloor(layout, o.x, o.y, o.w, o.h))) continue;
    // fits() deja apuntado cada mueble que acepta, así que nos quedamos con los que quepan (casi siempre, todos)
    const kept = placed.filter((o) => !fits || fits(o));
    if (kept.length) return kept;
  }
  return [];
}

// Decoración de la pared de arriba: cuadros, ventanas y relojes.
// Evita la puerta, la barra de objetos (izquierda) y el minimapa (derecha).
export function placeWallDecor(rng, RW = W) {
  const out = [];
  // a la derecha de la puerta queda sitio para la insignia de las salas especiales
  const left = [236, RW / 2 - 80], right = [RW / 2 + 128, RW - 244];
  // en las salas anchas cada mitad de la pared se parte en dos tramos, para que quepan más cosas
  const spans = RW > W ? [left, right].flatMap(([a, b]) => [[a, (a + b) / 2 - 20], [(a + b) / 2 + 20, b]]) : [left, right];
  for (const [a, b] of spans) {
    if (rng() < 0.25) continue;
    const r = rng();
    const kind = r < 0.4 ? 'window' : r < 0.75 ? 'picture' : 'clock';
    const w = kind === 'window' ? 84 : kind === 'picture' ? 56 + rng() * 14 : 34;
    const foot = kind === 'window' ? w + 20 : w; // la ventana lleva cortinas a los lados
    out.push({ kind, x: a + foot / 2 + rng() * Math.max(0, b - a - foot), w, seed: rng(), hue: Math.floor(rng() * 4) });
  }
  return out;
}

// ═════════════ Dibujo ═════════════

function box(ctx, x, y, w, h, r, fill, lw = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
}

function circle(ctx, x, y, r, fill, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
}

// Sombra del mueble en el suelo (va en la imagen fija de la sala)
export function drawFurnitureShadow(ctx, f) {
  furnitureShadow(ctx, f.x, f.y + f.h / 2, f.w);
}

// Variantes de un mueble: mueble-<tipo> es la de siempre y mueble-<tipo>-b, -c… las demás (si las hay).
// Cada apartamento (y cada pasillo o sala) elige una por tipo con su número `surtido`: así todas las neveras
// de una casa son iguales, pero la casa de al lado puede tener otra. No gasta el dado de la partida.
const LETRAS = 'bcdefghijklmnopqrstuvwxyz';
function variante(kind, surtido = 0) {
  let n = 1;
  while (n <= LETRAS.length && hasSprite(`mueble-${kind}-${LETRAS[n - 1]}`)) n++;
  if (n === 1) return '';
  let h = surtido | 0;
  for (const c of kind) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const i = Math.floor(mulberry32(h)() * n);
  return i ? `-${LETRAS[i - 1]}` : '';
}

// El sprite se apoya en el borde de abajo del hueco del mueble y sube lo que mida de alto.
// `alpha` lo apaga en las habitaciones a oscuras.
export function drawFurniture(ctx, f, alpha = 1) {
  const v = variante(f.kind, f.surtido);
  // en las paredes laterales, el dibujo de lado de su variante o, si no lo tiene, el de la de siempre
  const ladoId = [`mueble-${f.kind}${v}-lado`, `mueble-${f.kind}-lado`].find(hasSprite);
  const lado = (f.side === 'left' || f.side === 'right') && !!ladoId;
  const id = lado ? ladoId : `mueble-${f.kind}${v}`;
  if (hasSprite(id)) {
    const o = alpha < 1 ? { alpha } : {};
    // los que trae el dueño tienen más detalle: su .json dice a qué escala van ("scale": 0.5 → 1 unidad por píxel)
    const scale = spriteMeta(id).scale;
    if (scale) o.scale = scale;
    if (lado && f.side === 'right') {
      // el dibujo de lado está hecho para la pared izquierda: en la derecha, en espejo
      ctx.save();
      ctx.translate(f.x, 0);
      ctx.scale(-1, 1);
      drawSprite(ctx, id, 'idle', 'south', 0, 0, f.y + f.h / 2, o);
      ctx.restore();
    } else drawSprite(ctx, id, 'idle', 'south', 0, f.x, f.y + f.h / 2, o);
    return;
  }
  // los muebles sin sprite se dibujan a mano, vistos desde arriba (el dibujo de antes)

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(ROT[f.side]);
  ctx.lineJoin = 'round';
  const L = f.len, D = f.dep;
  const x0 = -L / 2, y0 = -D / 2;
  const sofaColors = ['#e76f51', '#4f86c6', '#6a994e', '#b5838d'];
  const c = sofaColors[Math.floor(f.seed * sofaColors.length)];

  switch (f.kind) {
    case 'sofa':
    case 'armchair': {
      box(ctx, x0, y0, L, D, 12, c);
      box(ctx, x0 + 4, y0 + 2, L - 8, 18, 8, shade(c, -0.12), 2.5);   // respaldo
      box(ctx, x0 + 2, y0 + 6, 16, D - 10, 7, shade(c, -0.06), 2.5);  // reposabrazos
      box(ctx, -x0 - 18, y0 + 6, 16, D - 10, 7, shade(c, -0.06), 2.5);
      const n = f.kind === 'sofa' ? 3 : 1;
      const cw = (L - 40) / n;
      for (let i = 0; i < n; i++) box(ctx, x0 + 20 + i * cw + 1, y0 + 20, cw - 2, D - 26, 6, shade(c, 0.08), 2.5);
      break;
    }
    case 'tv': {
      box(ctx, x0, y0 + 6, L, D - 6, 6, '#8d6346');
      box(ctx, x0 + 12, y0 + 2, L - 24, 12, 3, '#2b2d42');
      ctx.fillStyle = '#5c7cfa';
      ctx.fillRect(x0 + 16, y0 + 5, L - 32, 5);
      circle(ctx, x0 + 14, y0 + D - 10, 4, '#3a3355', 2);
      circle(ctx, -x0 - 14, y0 + D - 10, 4, '#3a3355', 2);
      break;
    }
    case 'bookshelf': {
      box(ctx, x0, y0, L, D, 4, '#9c6644');
      const cols = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#ffd23f', '#9b5de5'];
      let bx = x0 + 6;
      let i = Math.floor(f.seed * 10);
      while (bx < -x0 - 10) {
        const bw = 7 + ((i * 7) % 5);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(bx, y0 + 5, bw - 1, D - 12);
        bx += bw; i++;
      }
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
      ctx.strokeRect(x0 + 4, y0 + 4, L - 8, D - 10);
      break;
    }
    case 'lamp': {
      circle(ctx, 0, 0, 17, '#ffe8a3');
      circle(ctx, 0, 0, 9, '#fff6d5', 2);
      break;
    }
    case 'plant': {
      circle(ctx, 0, 2, 18, '#d9774b');
      circle(ctx, 0, 2, 13, '#7a4a2e', 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + f.seed * 6;
        ctx.save();
        ctx.translate(Math.cos(a) * 7, Math.sin(a) * 7 - 3);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(8, 0, 14, 6, 0, 0, TAU);
        ctx.fillStyle = i % 2 ? '#5bbf5a' : '#4aa64a';
        ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'counter': {
      box(ctx, x0, y0, L, D, 5, '#e9ecef');
      ctx.fillStyle = '#ced4da';
      ctx.fillRect(x0 + 3, y0 + D - 12, L - 6, 9);
      // fregadero
      box(ctx, x0 + 14, y0 + 8, 46, D - 22, 8, '#adb5bd', 2.5);
      box(ctx, x0 + 19, y0 + 12, 36, D - 30, 6, '#8fa3b5', 2);
      circle(ctx, x0 + 37, y0 + 6, 4, '#868e96', 2);
      // tabla de cortar con un tomate
      box(ctx, x0 + 80, y0 + 10, 40, 24, 4, '#d4a373', 2.5);
      circle(ctx, x0 + 100, y0 + 22, 6, '#e63946', 2);
      break;
    }
    case 'fridge': {
      box(ctx, x0, y0, L, D, 8, '#f8f9fa');
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(x0 + 4, y0 + D * 0.4); ctx.lineTo(-x0 - 4, y0 + D * 0.4); ctx.stroke();
      box(ctx, -x0 - 14, y0 + D * 0.5, 5, D * 0.35, 2, '#adb5bd', 2);
      circle(ctx, x0 + 14, y0 + 12, 4, '#ff5d73', 2);
      circle(ctx, x0 + 26, y0 + 16, 4, '#ffd23f', 2);
      break;
    }
    case 'stove': {
      box(ctx, x0, y0, L, D, 6, '#343a40');
      for (const [bx, by] of [[-16, -10], [16, -10], [-16, 12], [16, 12]]) {
        circle(ctx, bx, by, 9, '#495057', 2);
        circle(ctx, bx, by, 4, '#212529', 0);
      }
      break;
    }
    case 'bed': {
      box(ctx, x0, y0, L, D, 8, '#8d6346');
      box(ctx, x0 + 6, y0 + 6, L - 12, D - 12, 6, '#ffffff', 2.5);
      box(ctx, x0 + 14, y0 + 10, L - 28, 24, 10, '#f1f3f5', 2.5);  // almohada
      const quilt = ['#ff8fab', '#80b3ff', '#ffd166', '#95d5b2'][Math.floor(f.seed * 4)];
      box(ctx, x0 + 4, y0 + 44, L - 8, D - 50, 8, quilt, 3);         // edredón
      ctx.fillStyle = shade(quilt, 0.2);
      ctx.fillRect(x0 + 6, y0 + 46, L - 12, 10);
      break;
    }
    case 'wardrobe': {
      box(ctx, x0, y0, L, D, 4, '#b07d4f');
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(0, y0 + 4); ctx.lineTo(0, -y0 - 2); ctx.stroke();
      circle(ctx, -6, y0 + D - 10, 3, '#ffd23f', 2);
      circle(ctx, 6, y0 + D - 10, 3, '#ffd23f', 2);
      break;
    }
    case 'nightstand': {
      box(ctx, x0, y0, L, D, 5, '#b07d4f');
      circle(ctx, 0, 0, 11, '#ffe8a3', 2.5);
      circle(ctx, 0, 0, 5, '#fff6d5', 2);
      break;
    }
    case 'desk': {
      box(ctx, x0, y0, L, D, 5, '#c08552');
      box(ctx, x0 + 18, y0 + 6, 46, 30, 3, '#adb5bd', 2.5); // portátil
      ctx.fillStyle = '#4dabf7';
      ctx.fillRect(x0 + 22, y0 + 9, 38, 10);
      box(ctx, x0 + 76, y0 + 14, 18, 18, 9, '#ffffff', 2.5);  // taza
      break;
    }
    case 'shoerack': {
      box(ctx, x0, y0, L, D, 4, '#a47148');
      const cols = ['#e63946', '#1d3557', '#ffffff', '#2a9d8f'];
      for (let i = 0; i < 4; i++) {
        const sx = x0 + 14 + i * ((L - 28) / 3);
        for (const k of [-4, 4]) {
          ctx.beginPath();
          ctx.ellipse(sx + k, 0, 3.5, 9, 0, 0, TAU);
          ctx.fillStyle = cols[(i + Math.floor(f.seed * 4)) % 4];
          ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke();
        }
      }
      break;
    }
    case 'coatstand': {
      circle(ctx, 0, 0, 16, '#6c584c');
      const cols = ['#e76f51', '#457b9d', '#ffd23f'];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + f.seed * 3;
        circle(ctx, Math.cos(a) * 10, Math.sin(a) * 10, 9, cols[i], 2.5);
      }
      circle(ctx, 0, 0, 5, '#3a2e26', 2);
      break;
    }
    case 'console': {
      box(ctx, x0, y0, L, D, 5, '#c08552');
      box(ctx, x0 + 14, y0 + 7, 20, 20, 10, '#9fdcf2', 2.5);  // jarrón
      circle(ctx, x0 + 24, y0 + 13, 4, '#ff8fab', 2);
      ctx.beginPath(); ctx.ellipse(10, 0, 16, 9, 0, 0, TAU);   // cuenco de llaves
      ctx.fillStyle = '#e9c46a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      break;
    }
    case 'bathtub': {
      box(ctx, x0, y0, L, D, 22, '#ffffff');
      box(ctx, x0 + 8, y0 + 8, L - 16, D - 16, 16, '#8ecae6', 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(x0 + 26 + i * 26, y0 + 22 + (i % 2) * 14, 6 + (i % 3) * 2, 0, TAU); ctx.fill();
      }
      circle(ctx, x0 + 22, y0 + 4, 5, '#adb5bd', 2);
      // patito de goma
      circle(ctx, -x0 - 34, 4, 7, '#ffd23f', 2);
      circle(ctx, -x0 - 30, -2, 4.5, '#ffd23f', 2);
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(-x0 - 27, -2, 4, 2.5);
      break;
    }
    case 'toilet': {
      box(ctx, x0 + 4, y0, L - 8, 18, 5, '#ffffff');
      ctx.beginPath(); ctx.ellipse(0, y0 + 36, 18, 20, 0, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, y0 + 37, 11, 13, 0, 0, TAU);
      ctx.fillStyle = '#bde0fe'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      break;
    }
    case 'sink': {
      box(ctx, x0, y0, L, D, 6, '#e9ecef');
      ctx.beginPath(); ctx.ellipse(0, 2, 22, 13, 0, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      circle(ctx, 0, y0 + 6, 4, '#adb5bd', 2);
      box(ctx, -x0 - 14, y0 + 8, 8, 14, 3, '#ff8fab', 2);   // cepillo de dientes
      break;
    }
    case 'washer': {
      box(ctx, x0, y0, L, D, 6, '#f8f9fa');
      circle(ctx, 0, 4, 18, '#ced4da', 2.5);
      circle(ctx, 0, 4, 12, '#74c0fc', 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-4, 0, 4, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// Cuadros, ventanas y relojes de la pared de arriba
// Lo fijo (marcos, cortinas, la esfera del reloj) se guarda como imagen; las nubes y las agujas se pintan encima
// en cada fotograma
export function drawWallDecor(ctx, d, time) {
  const cy = WALL - FACE_H / 2 + 6; // a media altura de la cara del muro de arriba
  // aplique de pared: solo su sprite (la luz que da la pinta el sistema de iluminación)
  if (d.kind === 'aplique') { drawSprite(ctx, 'aplique-pared', 'idle', 'south', 0, d.x, cy - 24, { scale: 0.5 }); return; }
  const fijo = (owner, pad, h, paint) => drawCached(ctx, owner, 0, d.x - d.w / 2 - pad, cy - h / 2 - pad, d.w + pad * 2, h + pad * 2, (g) => {
    g.lineJoin = 'round';
    paint(g);
  });
  if (d.kind === 'window') {
    const w = d.w, h = 36;
    fijo(d, 3, h, (g) => box(g, d.x - w / 2, cy - h / 2, w, h, 4, '#9fdcf2'));
    // nubes
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const cx = d.x - w / 2 + ((time * 6 + d.seed * 80) % (w + 30)) - 15;
    ctx.beginPath(); ctx.rect(d.x - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4); ctx.clip();
    ctx.beginPath(); ctx.ellipse(cx, cy - 4, 12, 5, 0, 0, TAU); ctx.ellipse(cx + 8, cy - 7, 8, 5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // cruz de la ventana y cortinas
    d.frente = d.frente || {};
    fijo(d.frente, 14, h + 6, (g) => {
      g.lineWidth = 3; g.strokeStyle = OUTLINE;
      g.beginPath(); g.moveTo(d.x, cy - h / 2); g.lineTo(d.x, cy + h / 2); g.moveTo(d.x - w / 2, cy); g.lineTo(d.x + w / 2, cy); g.stroke();
      for (const k of [-1, 1]) box(g, d.x + k * (w / 2 + 2) - 7, cy - h / 2 - 3, 14, h + 6, 5, ['#ff8fab', '#ffd166', '#95d5b2', '#b8c0ff'][d.hue], 2.5);
    });
  } else if (d.kind === 'picture') {
    const w = d.w, h = 34;
    fijo(d, 3, h, (g) => {
      box(g, d.x - w / 2, cy - h / 2, w, h, 3, '#c08552');
      g.fillStyle = ['#bde0fe', '#ffd6a5', '#caffbf', '#ffc6ff'][d.hue];
      g.fillRect(d.x - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10);
      // paisaje: monte y sol
      g.save();
      g.beginPath(); g.rect(d.x - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10); g.clip();
      g.fillStyle = '#6a994e';
      g.beginPath(); g.ellipse(d.x - 6, cy + 14, w * 0.45, 14, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(d.x + w * 0.22, cy - 5, 5, 0, TAU); g.fill();
      g.restore();
      g.lineWidth = 2; g.strokeStyle = OUTLINE;
      g.strokeRect(d.x - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10);
    });
  } else {
    drawCached(ctx, d, 0, d.x - 19, cy - 19, 38, 38, (g) => circle(g, d.x, cy, 16, '#ffffff'));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    const a1 = time * 0.5 + d.seed * 6, a2 = time * 0.05 + d.seed * 3;
    ctx.beginPath();
    ctx.moveTo(d.x, cy); ctx.lineTo(d.x + Math.sin(a1) * 11, cy - Math.cos(a1) * 11);
    ctx.moveTo(d.x, cy); ctx.lineTo(d.x + Math.sin(a2) * 7, cy - Math.cos(a2) * 7);
    ctx.stroke();
    circle(ctx, d.x, cy, 2.5, '#ff5d73', 0);
    ctx.restore();
  }
}

// Rayo de luz que entra por las ventanas y cae en el suelo
export function drawWindowLight(ctx, d) {
  if (d.kind !== 'window') return;
  ctx.fillStyle = 'rgba(255, 250, 220, 0.16)';
  ctx.beginPath();
  ctx.moveTo(d.x - d.w / 2, WALL);
  ctx.lineTo(d.x + d.w / 2, WALL);
  ctx.lineTo(d.x + d.w / 2 + 60, WALL + 150);
  ctx.lineTo(d.x - d.w / 2 + 60, WALL + 150);
  ctx.closePath();
  ctx.fill();
}

// Aclara (k > 0) u oscurece (k < 0) un color "#rrggbb"
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
