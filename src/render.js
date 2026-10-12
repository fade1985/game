// ─────────────────────────────────────────────
//  Dibujo del escenario: habitaciones, puertas, objetos y minimapa
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, PIXEL, TILE } from './config.js';
import { drawSprite, hasSprite } from './sprites.js';
import { roundBox, outlinedText, heartPath } from './draw.js';
import { ROOM_TYPES } from './rooms.js';
import { drawFurniture, drawFurnitureLight, drawWallDecor, drawWindowLight } from './furniture.js';
import { CELL } from './shapes.js';

const TAU = Math.PI * 2;

// ═════════════ Habitación ═════════════
export function drawRoom(ctx, room, time) {
  const { style, seams, obstacles, rug, decor, wallDecor = [], blocks = [], zones = null, w: RW = W, h: RH = H } = room.layout;
  const iw = RW - WALL * 2, ih = RH - WALL * 2; // RW × RH es el tamaño de este mapa
  // con tabiques (un apartamento): contorno del suelo sacado de su cuadrícula (si es rectangular, se dibuja como siempre)
  const shape = blocks.length ? floorOutline(room.layout) : null;

  // Muro con papel pintado a rayas
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, RW, RH);
  // rayas verticales en los muros de arriba/abajo y horizontales en los laterales
  ctx.fillStyle = style.stripe;
  for (let x = 0; x < RW; x += 28) {
    ctx.fillRect(x, 0, 12, WALL);
    ctx.fillRect(x, RH - WALL, 12, WALL);
  }
  for (let y = WALL; y < RH - WALL; y += 28) {
    ctx.fillRect(0, y, WALL, 12);
    ctx.fillRect(RW - WALL, y, WALL, 12);
  }
  // borde exterior del muro (la parte de arriba vista desde el techo)
  ctx.lineWidth = 14;
  ctx.strokeStyle = style.trim;
  ctx.strokeRect(7, 7, RW - 14, RH - 14);
  if (shape) {
    // los muros interiores llevan el mismo papel pintado, con las rayas en vertical
    ctx.save();
    ctx.beginPath();
    for (const b of blocks) ctx.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    ctx.clip();
    for (let x = 0; x < RW; x += 28) ctx.fillRect(x, WALL, 12, ih);
    ctx.restore();
  }
  for (const d of wallDecor) drawWallDecor(ctx, d, time);

  // Suelo
  ctx.save();
  if (shape) ctx.clip(shape.floor);
  else {
    ctx.beginPath();
    ctx.rect(WALL, WALL, iw, ih);
    ctx.clip();
  }
  if (zones) {
    // apartamento: cada habitación con su suelo; en los huecos de las puertas queda un umbral de madera
    ctx.fillStyle = style.trim;
    ctx.fillRect(WALL, WALL, iw, ih);
    for (const z of zones) {
      ctx.save();
      ctx.clip(zonePath(room.layout, z));
      drawFloor(ctx, z.style, seams, z.x, z.y, z.w, z.h);
      ctx.restore();
    }
  } else drawFloor(ctx, style, seams, WALL, WALL, iw, ih);

  if (rug) {
    roundBox(ctx, rug.x, rug.y, rug.w, rug.h, 18, rug.color, 4);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.roundRect(rug.x + 12, rug.y + 12, rug.w - 24, rug.h - 24, 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // manchas de los zombis derrotados en esta sala
  for (const d of room.decals || []) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * TAU;
      const r = d.r * (0.75 + 0.3 * Math.sin(a * 3 + d.seed));
      ctx.lineTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.65);
    }
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = d.seed + i * 2.1;
      ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * d.r * 1.3, d.y + Math.sin(a) * d.r * 0.8, d.r * 0.18, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // motas de polvo / desgaste
  ctx.fillStyle = 'rgba(29, 27, 44, 0.08)';
  for (const d of decor) {
    ctx.beginPath(); ctx.arc(d.x, d.y, 5 * d.s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x + 10 * d.s, d.y + 4 * d.s, 3 * d.s, 0, TAU); ctx.fill();
  }

  // luz de las ventanas y de las lámparas
  for (const d of wallDecor) drawWindowLight(ctx, d);
  for (const o of obstacles) if (o.shape === 'rect') drawFurnitureLight(ctx, o);

  // sombra del muro sobre el suelo (da profundidad)
  const g = ctx.createLinearGradient(0, WALL, 0, WALL + 30);
  g.addColorStop(0, 'rgba(20,16,40,0.25)');
  g.addColorStop(1, 'rgba(20,16,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(WALL, WALL, iw, 30);
  // ...y la de cada muro interior que tiene suelo debajo
  if (shape) {
    for (const [x, y, w] of shape.shadows) {
      const sg = ctx.createLinearGradient(0, y, 0, y + 30);
      sg.addColorStop(0, 'rgba(20,16,40,0.25)');
      sg.addColorStop(1, 'rgba(20,16,40,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x, y, w, 30);
    }
  }
  ctx.restore();

  // Rodapié alrededor del suelo
  if (shape) {
    // sigue el contorno del suelo: dos líneas oscuras con la madera en medio, por el lado del muro
    ctx.save();
    ctx.lineCap = 'square';
    ctx.save();
    ctx.clip(shape.walls, 'evenodd');
    ctx.lineWidth = 20; ctx.strokeStyle = OUTLINE; ctx.stroke(shape.edges);
    ctx.lineWidth = 12; ctx.strokeStyle = style.trim; ctx.stroke(shape.edges);
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke(shape.edges);
    ctx.restore();
  } else {
    ctx.lineWidth = 8;
    ctx.strokeStyle = style.trim;
    ctx.strokeRect(WALL - 4, WALL - 4, iw + 8, ih + 8);
    ctx.lineWidth = 4;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeRect(WALL - 8, WALL - 8, iw + 16, ih + 16);
    ctx.strokeRect(WALL, WALL, iw, ih);
  }

  for (const o of obstacles) {
    if (o.shape === 'rect') drawFurniture(ctx, o);
    else drawObstacle(ctx, o);
  }
}

// Las casillas de una habitación de un apartamento, para pintar solo ahí su suelo
function zonePath(layout, z) {
  if (z.path) return z.path;
  const { cols, owner } = layout;
  const path = new Path2D();
  const c1 = (z.x + z.w) / CELL;
  for (let r = z.y / CELL; r < (z.y + z.h) / CELL; r++) {
    for (let c = z.x / CELL; c < c1; c++) {
      if (owner[r * cols + c] !== z.id) continue;
      const c0 = c;
      while (c < c1 && owner[r * cols + c] === z.id) c++;
      path.rect(c0 * CELL, r * CELL, (c - c0) * CELL, CELL);
    }
  }
  return (z.path = path);
}

// Oscurece las habitaciones de un apartamento en las que aún no se ha entrado
export function drawFog(ctx, layout) {
  if (!layout.zones) return;
  ctx.fillStyle = '#12101c';
  for (const z of layout.zones) {
    if (z.fog <= 0) continue;
    ctx.globalAlpha = 0.9 * z.fog;
    ctx.fill(zonePath(layout, z));
  }
  ctx.globalAlpha = 1;
}

// Contorno del suelo de un mapa con tabiques, a partir de su cuadrícula:
//   floor    el suelo (para recortar lo que se dibuja encima)
//   walls    todo lo que no es suelo (para pintar el rodapié solo por el lado del muro)
//   edges    los bordes donde el suelo toca un muro
//   shadows  [x, y, ancho] de los muros interiores que tienen suelo justo debajo
function floorOutline(layout) {
  if (layout.outline) return layout.outline;
  const { cols, rows } = layout;
  const wall = (c, r) => layout.grid[r * cols + c] === 1;
  const floor = new Path2D(), walls = new Path2D(), edges = new Path2D();
  const shadows = [];
  walls.rect(0, 0, layout.w, layout.h);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (wall(c, r)) continue;
      // tramo de suelo seguido en esta fila
      const c0 = c;
      while (c < cols - 1 && !wall(c, r)) c++;
      const x = c0 * CELL, y = r * CELL, w = (c - c0) * CELL;
      floor.rect(x, y, w, CELL);
      walls.rect(x, y, w, CELL);
    }
    for (let c = 1; c < cols - 1; c++) {
      if (wall(c, r)) continue;
      const x = c * CELL, y = r * CELL;
      if (wall(c, r - 1)) { edges.moveTo(x, y); edges.lineTo(x + CELL, y); if (r > WALL / CELL) shadows.push([x, y, CELL]); }
      if (wall(c, r + 1)) { edges.moveTo(x, y + CELL); edges.lineTo(x + CELL, y + CELL); }
      if (wall(c - 1, r)) { edges.moveTo(x, y); edges.lineTo(x, y + CELL); }
      if (wall(c + 1, r)) { edges.moveTo(x + CELL, y); edges.lineTo(x + CELL, y + CELL); }
    }
  }
  return (layout.outline = { floor, walls, edges, shadows });
}

// Nombre de sprite a partir del nombre del estilo: "Baño" → "bano"
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Pinta el suelo de un estilo en el rectángulo (x0, y0, w, h). Quien llama recorta antes la forma exacta.
function drawFloor(ctx, style, seams, x0, y0, w, h) {
  // baldosa del estilo repetida por todo el suelo
  const tile = `suelo-${slug(style.name)}`;
  if (hasSprite(tile)) {
    const step = TILE * 2 * PIXEL; // las baldosas de suelo miden 32×32 píxeles de dibujo
    for (let y = Math.floor(y0 / step) * step; y < y0 + h; y += step) {
      for (let x = Math.floor(x0 / step) * step; x < x0 + w; x += step) drawSprite(ctx, tile, 'idle', 'south', 0, x, y);
    }
    // suavizamos el dibujo del suelo con el color de la habitación para que los personajes destaquen
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = style.floorA;
    ctx.fillRect(x0, y0, w, h);
    ctx.globalAlpha = 1;
    return;
  }
  // los suelos que aún no tienen baldosa dibujada se pintan a mano
  if (style.floor === 'parquet') {
    for (const row of seams) {
      if (row.y + 32 <= y0 || row.y >= y0 + h) continue;
      ctx.fillStyle = row.shade ? style.floorA : style.floorB;
      ctx.fillRect(x0, row.y, w, 32);
      ctx.fillStyle = style.seam;
      ctx.fillRect(x0, row.y + 30, w, 2);
      for (const x of row.cuts) if (x >= x0 && x < x0 + w) ctx.fillRect(x, row.y, 2, 32);
    }
  } else if (style.floor === 'tiles') {
    const T = 48;
    for (let y = y0, j = 0; y < y0 + h; y += T, j++) {
      for (let x = x0, i = 0; x < x0 + w; x += T, i++) {
        ctx.fillStyle = (i + j) % 2 ? style.floorA : style.floorB;
        ctx.fillRect(x, y, T, T);
      }
    }
    ctx.fillStyle = style.seam;
    for (let y = y0; y < y0 + h; y += T) ctx.fillRect(x0, y, w, 2);
    for (let x = x0; x < x0 + w; x += T) ctx.fillRect(x, y0, 2, h);
  } else if (style.floor === 'concrete') {
    // hormigón de la azotea: liso, con las juntas de las losas
    ctx.fillStyle = style.floorA;
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = style.seam;
    for (let y = y0; y < y0 + h; y += 128) ctx.fillRect(x0, y, w, 2);
    for (let x = x0; x < x0 + w; x += 192) ctx.fillRect(x, y0, 2, h);
  } else {
    // moqueta: color liso con un punteado suave
    ctx.fillStyle = style.floorA;
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = style.floorB;
    for (let y = y0 + 10, j = 0; y < y0 + h; y += 20, j++) {
      for (let x = x0 + 10 + (j % 2) * 10; x < x0 + w; x += 20) {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      }
    }
  }
}

function drawObstacle(ctx, o) {
  ctx.fillStyle = 'rgba(20, 16, 40, 0.22)';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y + o.r * 0.7, o.r * 1.05, o.r * 0.45, 0, 0, TAU);
  ctx.fill();

  if (o.kind === 'plant') {
    // maceta vista desde arriba con hojas
    ctx.beginPath(); ctx.arc(o.x, o.y + 4, o.r * 0.8, 0, TAU);
    ctx.fillStyle = '#d9774b'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.arc(o.x, o.y + 4, o.r * 0.58, 0, TAU);
    ctx.fillStyle = '#7a4a2e'; ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + o.rot;
      ctx.save();
      ctx.translate(o.x + Math.cos(a) * o.r * 0.35, o.y - 4 + Math.sin(a) * o.r * 0.35);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(o.r * 0.25, 0, o.r * 0.55, o.r * 0.24, 0, 0, TAU);
      ctx.fillStyle = i % 2 ? '#5bbf5a' : '#4aa64a';
      ctx.fill();
      ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
  } else {
    // caja de cartón de la mudanza
    const s = o.r * 1.6;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    roundBox(ctx, -s / 2, -s / 2, s, s, 6, '#d6a46b', 4);
    ctx.fillStyle = '#c28f55';
    ctx.fillRect(-s / 2 + 3, -4, s - 6, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-s / 2 + 3, -2, s - 6, 2);
    ctx.restore();
  }
}

// ═════════════ Puertas ═════════════
// Las puertas de un mapa están en `room.exits` (ver makeExit en rooms.js). Se dibujan todas como si
// estuvieran en el muro de arriba y se giran: el lado +y local siempre mira hacia el suelo.

// open: 0 = cerradas, 1 = abiertas (las que tienen cerrojo no se abren aunque el mapa esté limpio)
export function drawDoors(ctx, room, open) {
  const trim = room.layout.style.trim;
  for (const ex of room.exits) {
    const w = DOOR_W, h = WALL + 10;
    const gap = ex.locked ? 0 : open;
    ctx.save();
    ctx.translate(ex.x, ex.y);
    ctx.rotate(ex.a);
    if (ex.kind === 'elevator') {
      // ascensor: puertas metálicas cerradas y una cinta de "averiado" cruzada
      roundBox(ctx, -w / 2 - 10, -h / 2 - 2, w + 20, h + 2, 6, '#8d99ae', 4);
      ctx.fillStyle = '#5c677d';
      ctx.fillRect(-w / 2, -h / 2 - 2, w, h + 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(-2, -h / 2 - 2, 4, h + 2);
      ctx.rotate(-0.16);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-w / 2 - 6, -8, w + 12, 16);
      ctx.fillStyle = OUTLINE;
      for (let x = -w / 2 - 6; x < w / 2; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x + 8, -8); ctx.lineTo(x + 16, -8); ctx.lineTo(x + 8, 8); ctx.lineTo(x, 8);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }
    // marco: de madera, o de color si lleva a un sitio especial
    roundBox(ctx, -w / 2 - 10, -h / 2 - 2, w + 20, h + 2, 6, ex.frame || trim, 4);
    if (ex.frame) {
      // remaches decorativos
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (const sx of [-w / 2 - 5, w / 2 + 5]) {
        for (const sy of [-h / 2 + 8, 0, h / 2 - 8]) {
          ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, TAU); ctx.fill();
        }
      }
    }
    // hueco oscuro
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#120f1f');
    g.addColorStop(1, '#2f2a48');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2 - 2, w, h + 2);
    // hoja de la puerta: se recoge hacia fuera al abrirse
    if (gap < 1) {
      const ph = (h + 2) * (1 - gap);
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 2, -h / 2 - 2, w - 4, ph, 3);
      ctx.fillStyle = ex.kind === 'door' ? '#b9814f' : '#7d8a99'; // las de emergencia y el portal son metálicas
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = ex.kind === 'door' ? '#9c6a3e' : '#5c677d';
      for (let i = 1; i < 4; i++) ctx.fillRect(-w / 2 + 2 + i * (w - 4) / 4 - 1, -h / 2, 2, Math.max(0, ph - 4));
      if (gap < 0.3) {
        ctx.beginPath();
        ctx.arc(w / 2 - 14, h / 2 - 12, 4, 0, TAU);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();

    // insignia con el icono de lo que hay detrás, al lado de la puerta (siempre derecha);
    // un candado si hace falta la llave
    const icon = ex.locked === 'key' ? '🔒' : ex.icon;
    if (icon) {
      const bx = ex.x + Math.cos(ex.a) * (w / 2 + 34);
      const by = ex.y + Math.sin(ex.a) * (w / 2 + 34);
      ctx.beginPath();
      ctx.arc(bx, by, 17, 0, TAU);
      ctx.fillStyle = ex.frame || '#fff8ea';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      drawEmoji(ctx, icon, bx, by + 1, 18);
    }
  }
}

// Letrero de cada puerta ("1ºA", "Escaleras"...), al otro lado de la insignia.
// Va aparte porque se dibuja a resolución de pantalla, para que se pueda leer.
export function drawDoorLabels(ctx, room) {
  for (const ex of room.exits) {
    if (!ex.label) continue;
    if (ex.dir === 'left' || ex.dir === 'right') {
      // en los muros laterales no cabe a lo ancho: va dentro, encima de la puerta
      outlinedText(ctx, ex.label, ex.x + (ex.dir === 'left' ? 62 : -62), ex.y - DOOR_W / 2 - 22, 15, '#fff8ea', { lw: 4 });
      continue;
    }
    const side = ex.kind === 'elevator' ? 0 : -(DOOR_W / 2 + 40);
    outlinedText(ctx, ex.label, ex.x + Math.cos(ex.a) * side, ex.y + Math.sin(ex.a) * side, 15, '#fff8ea', { lw: 4 });
  }
}

// ═════════════ Objetos recogibles ═════════════
export function drawPickup(ctx, pk, time) {
  const bob = Math.sin(time * 5 + pk.seed) * 3;
  const y = pk.y - 6 + bob;
  ctx.fillStyle = 'rgba(20,16,40,0.2)';
  ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 6, 8, 3, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  if (pk.kind === 'heart') {
    heartPath(ctx, pk.x, y + 2, 11);
    ctx.fillStyle = '#ff5d73'; ctx.fill(); ctx.lineJoin = 'round'; ctx.stroke();
  } else if (pk.kind === 'key') {
    // llave dorada que se balancea, con un destello
    ctx.save();
    ctx.translate(pk.x, y);
    ctx.rotate(-0.6 + Math.sin(time * 3 + pk.seed) * 0.25);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -2.5); ctx.lineTo(13, -2.5); ctx.lineTo(13, 6); ctx.lineTo(9.5, 6); ctx.lineTo(9.5, 2.5);
    ctx.lineTo(6.5, 2.5); ctx.lineTo(6.5, 5); ctx.lineTo(3.5, 5); ctx.lineTo(3.5, 2.5); ctx.lineTo(-2, 2.5);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-7, 0, 6.5, 0, TAU);
    ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-7, 0, 2.3, 0, TAU);
    ctx.fillStyle = '#b8860b'; ctx.fill();
    ctx.restore();
    const tw = (time * 1.3 + pk.seed) % 1.6;
    if (tw < 0.4) {
      const k = Math.sin((tw / 0.4) * Math.PI) * 5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(pk.x + 8, y - 10 - k); ctx.lineTo(pk.x + 9.5, y - 10); ctx.lineTo(pk.x + 8, y - 10 + k); ctx.lineTo(pk.x + 6.5, y - 10);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pk.x + 8 - k, y - 10); ctx.lineTo(pk.x + 8, y - 8.5); ctx.lineTo(pk.x + 8 + k, y - 10); ctx.lineTo(pk.x + 8, y - 11.5);
      ctx.closePath(); ctx.fill();
    }
  }
}

// Bala del conserje y de los compañeros, en pixel art: una trazadora. Son cuadraditos encajados en la
// cuadrícula de píxeles del dibujo, puestos en fila hacia atrás: la punta casi blanca y una estela corta que
// pasa de amarillo a naranja. Así vale para cualquier ángulo sin verse borrosa. Las críticas son más gordas
// y rojizas; los perdigones, más pequeños.
const TRACER = ['#fffbe0', '#ffe066', '#ffb020', '#f0701a', '#b8400e'];
const TRACER_CRIT = ['#ffffff', '#ffe9a8', '#ff9a3c', '#ff4d2e', '#b3122a'];
function drawTracer(ctx, b, y) {
  const speed = Math.hypot(b.vx, b.vy) || 1;
  const ux = b.vx / speed, uy = b.vy / speed;
  const big = b.r >= 9 ? 3 : b.r >= 6 ? 2 : 1; // lado de la punta, en píxeles de dibujo
  const colors = b.crit ? TRACER_CRIT : TRACER;
  const step = big * PIXEL; // los trozos van pegados uno detrás de otro
  const box = (k, size, color) => {
    const side = size * PIXEL;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round((b.x - ux * k * step - side / 2) / PIXEL) * PIXEL,
      Math.round((y - uy * k * step - side / 2) / PIXEL) * PIXEL, side, side);
  };
  // primero el contorno oscuro de la parte gorda (punta y dos trozos más), luego los colores de atrás hacia
  // delante para que la punta quede encima; los dos últimos trozos son más finos y se apagan
  for (let k = 2; k >= 0; k--) box(k, big + 2, OUTLINE);
  for (let k = colors.length - 1; k >= 0; k--) {
    ctx.globalAlpha = k === 4 ? 0.5 : k === 3 ? 0.8 : 1;
    box(k, k < 3 ? big : Math.max(1, big - 1), colors[k]);
  }
  ctx.globalAlpha = 1;
}

export function drawBullet(ctx, b) {
  const y = b.y - (b.lift || 0); // pixel art: las balas de un arma dibujada se ven a la altura del arma
  if (b.friendly) { drawTracer(ctx, b, y); return; }
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(b.x - b.vx * 0.018, y - b.vy * 0.018, b.r * 0.8, 0, TAU);
  ctx.fillStyle = b.color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(b.x, y, b.r, 0, TAU);
  ctx.fillStyle = b.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (!b.friendly) {
    ctx.beginPath(); ctx.arc(b.x - 2, y - 2, b.r * 0.35, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
  }
}

// ═════════════ Minimapa ═════════════
// Un plano de la planta: el pasillo en medio, una casilla por cada puerta y las escaleras al fondo.
// Gris = sin visitar, rojo = con zombis dentro, blanco = limpio, amarillo = donde estás.
// Hueco que ocupa el minimapa (para que los avisos del borde no lo tapen)
export let minimapRect = null;

export function drawMinimap(ctx, floor, current, title, time, screenW = W) {
  const hall = floor.corridor;
  const pad = 10, head = 22;
  const pw = 156, ph = head + pad * 2 + (hall ? 56 : 22);
  const px = screenW - pw - 12, py = 10;
  minimapRect = { x: px, y: py, w: pw, h: ph };

  ctx.save();
  ctx.globalAlpha = 0.92;
  roundBox(ctx, px, py, pw, ph, 12, 'rgba(29, 27, 44, 0.78)', 3);
  ctx.globalAlpha = 1;
  outlinedText(ctx, title, px + pw / 2, py + 15, 14, '#ffd23f', { lw: 4 });

  const box = (x, y, w, h, fill, here, icon) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fillStyle = here ? '#ffd23f' : fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = here ? '#ffffff' : OUTLINE;
    ctx.stroke();
    if (icon) drawEmoji(ctx, icon, x + w / 2, y + h / 2 + 1, 11);
    if (here) {
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.3;
      ctx.beginPath();
      ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6);
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
  const tint = (r) => (!r.visited ? '#5d5873' : r.cleared ? '#fff8ea' : '#ff8a9b');
  const top = py + head + pad;

  if (!hall) {
    // la azotea: un solo sitio
    box(px + pw / 2 - 30, top, 60, 22, tint(current), true, ROOM_TYPES[current.type].icon);
    ctx.restore();
    return;
  }
  const END = 18; // ancho de las casillas de los extremos
  const x0 = px + pad + END + 4, len = pw - (pad + END + 4) * 2;
  box(x0, top + 22, len, 12, '#fff8ea', current === hall);
  for (const ex of hall.exits) {
    if (ex.kind === 'elevator') continue;
    if (ex.dir === 'left') box(x0 - END - 4, top + 19, END, 18, '#5d5873', false, ex.icon || '🚪');
    else if (ex.dir === 'right') box(x0 + len + 4, top + 19, END, 18, ex.locked ? '#5d5873' : '#80ed99', false, ex.locked ? '🔒' : ex.icon);
    else {
      const r = ex.to;
      // la llave que aún no se ha recogido se marca en cuanto se ha entrado en su apartamento
      const icon = ex.locked === 'key' ? '🔒' : floor.key.room === r && r.visited && !floor.hasKey && !floor.keyUsed ? '🗝️' : ROOM_TYPES[r.type].frame ? ROOM_TYPES[r.type].icon : null;
      box(x0 + (ex.at / hall.layout.w) * len - 15, ex.dir === 'up' ? top : top + 38, 30, 18, tint(r), current === r, icon);
    }
  }
  ctx.restore();
}

export function drawEmoji(ctx, emoji, x, y, size) {
  ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}
