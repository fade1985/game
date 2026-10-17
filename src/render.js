// ─────────────────────────────────────────────
//  Dibujo del escenario: habitaciones, puertas, objetos y minimapa
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, PIXEL, FACE_H, TOP_EXTRA } from './config.js';
import { drawSprite, hasSprite, spriteMeta, spriteCount } from './sprites.js';
import { roundBox, outlinedText, heartPath, drawCached } from './draw.js';
import { ROOM_TYPES } from './rooms.js';
import { drawFurniture, drawFurnitureShadow, drawFurnitureLight, drawWallDecor, drawWindowLight } from './furniture.js';
import { CELL } from './shapes.js';
import { drawMolotov } from './molotov.js';

const TAU = Math.PI * 2;

// ═════════════ Habitación ═════════════
export function drawRoom(ctx, room, time) {
  const { style, seams, obstacles, rug, decor, wallDecor = [], blocks = [], zones = null, w: RW = W, h: RH = H } = room.layout;
  const iw = RW - WALL * 2, ih = RH - WALL * 2; // RW × RH es el tamaño de este mapa
  // con tabiques (un apartamento): contorno del suelo sacado de su cuadrícula (si es rectangular, se dibuja como siempre)
  const shape = blocks.length ? floorOutline(room.layout) : null;

  // Los muros, vistos desde arriba: una "tapa" oscura con un filo de luz por fuera.
  // (Los que tienen suelo justo debajo enseñan además su cara, con el papel pintado: más abajo.)
  ctx.fillStyle = capColor(style);
  ctx.fillRect(0, 0, RW, RH);
  ctx.fillStyle = shade(capColor(style), 0.18);
  ctx.fillRect(4, 4, RW - 8, 4);
  ctx.fillRect(4, 4, 4, RH - 8);

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

  const rugTex = rug && `alfombra-${slug(style.name)}`;
  if (rug && hasSprite(rugTex)) {
    // alfombra con textura (una tira que empalma por los lados): se ajusta a su alto y se repite a lo largo
    const meta = spriteMeta(rugTex);
    const scale = rug.h / (meta.cell[1] * PIXEL);
    const step = meta.cell[0] * PIXEL * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rug.x, rug.y, rug.w, rug.h);
    ctx.clip();
    for (let x = rug.x; x < rug.x + rug.w; x += step) drawSprite(ctx, rugTex, 'idle', 'south', 0, x, rug.y, { scale });
    ctx.restore();
  } else if (rug) {
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

  // contorno del suelo
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  if (shape) ctx.stroke(shape.edges);
  else ctx.strokeRect(WALL, WALL, iw, ih);

  // las caras de los muros (también la de arriba, con sus cuadros y ventanas) no van en esta imagen: se dibujan
  // con los personajes y a la resolución de la pantalla, para que se vea todo el detalle de su textura (sceneryOf)
  for (const o of obstacles) {
    if (o.shape === 'rect') drawFurnitureShadow(ctx, o);
    else drawObstacle(ctx, o);
  }
}

// ═════════════ Paredes y muebles con altura ("tres cuartos") ═════════════
// El suelo se ve desde arriba, pero todo lo que está de pie enseña su frente, como los personajes.
// Cada muro que tiene suelo justo debajo enseña una cara con el papel pintado de esa habitación.
// La cara mide FACE_H (3 casillas) y sube desde el pie del muro: la de un tabique tapa las dos últimas filas de
// la habitación de detrás (se vuelve transparente si hay alguien ahí) y la del muro de arriba se sale del mapa.
const CAP = TOP_EXTRA - (FACE_H - WALL); // grosor de la tapa (el techo) que se ve por encima de la cara

// Aclara (k > 0) u oscurece (k < 0) un color "#rrggbb"
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `#${((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
}

// Color de la tapa de los muros: el del papel pintado, más oscuro
const capColor = (style) => style.cap || shade(style.wall, -0.38); // `cap`: color propio de la tapa (mantenimiento, a juego con su moldura)

// Las caras de un mapa: { x, w, y (borde de abajo), top (borde de arriba), outer, zone, style }
export function wallFaces(layout) {
  if (layout.faces) return layout.faces;
  const { cols, rows, grid, owner, zones } = layout;
  const faces = [];
  if (!grid) return (layout.faces = faces);
  const wall = (c, r) => grid[r * cols + c] === 1;
  const zoneAt = (c, r) => (zones && owner ? owner[r * cols + c] : -1);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      if (!wall(c, r) || wall(c, r + 1)) continue;
      // tramo seguido de muro con suelo debajo, de una misma habitación
      const c0 = c, z = zoneAt(c, r + 1);
      while (c < cols && wall(c, r) && !wall(c, r + 1) && zoneAt(c, r + 1) === z) c++;
      const outer = r < WALL / CELL;
      const zone = (zones && zones[z]) || null;
      faces.push({
        x: c0 * CELL, w: (c - c0) * CELL, y: (r + 1) * CELL, top: (r + 1) * CELL - FACE_H,
        outer, zone, style: (zone && zone.style) || layout.style, cap: capColor(layout.style),
      });
      c--;
    }
  }
  return (layout.faces = faces);
}

export function drawFace(ctx, f) {
  const { x, w, y, top, style } = f;
  const tex = `pared-${slug(style.name)}`, roof = `techo-${slug(style.name)}`;
  if (hasSprite(roof)) strip(ctx, roof, x, top - CAP, w, CAP);
  else {
    ctx.fillStyle = f.cap;
    ctx.fillRect(x, top - CAP, w, CAP);
  }
  if (hasSprite(tex)) {
    // textura de la estancia (con su rodapié), sin contornos: la moldura del techo ya la remata
    strip(ctx, tex, x, top, w, y - top);
    if (!f.outer) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x, top - CAP, 2, y - top + CAP);
      ctx.fillRect(x + w - 2, top - CAP, 2, y - top + CAP);
    }
    return;
  } else {
    // papel pintado a rayas, para las estancias que aún no tienen textura
    ctx.fillStyle = style.wall;
    ctx.fillRect(x, top, w, y - top);
    ctx.fillStyle = style.stripe;
    for (let sx = Math.floor(x / 28) * 28; sx < x + w; sx += 28) {
      const a = Math.max(sx, x), b = Math.min(sx + 12, x + w);
      if (b > a) ctx.fillRect(a, top, b - a, y - top);
    }
    ctx.fillStyle = style.trim;
    ctx.fillRect(x, y - 8, w, 8);
  }
  // contorno
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x, top, w, 2);
  ctx.fillRect(x, y - 2, w, 2);
  if (!f.outer) {
    ctx.fillRect(x, top - CAP, w, 2);
    ctx.fillRect(x, top - CAP, 2, y - top + CAP);
    ctx.fillRect(x + w - 2, top - CAP, 2, y - top + CAP);
  }
}

// Una textura repetida a lo ancho en el rectángulo (x, y, w, h), pegada a su borde de abajo y alineada con el
// mapa (para que casen los tramos de una misma pared)
function strip(ctx, id, x, y, w, h) {
  const meta = spriteMeta(id);
  const scale = meta.scale || 1;
  const step = meta.cell[0] * PIXEL * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let sx = Math.floor(x / step) * step; sx < x + w; sx += step) drawSprite(ctx, id, 'idle', 'south', 0, sx, y + h - meta.cell[1] * PIXEL * scale, { scale });
  ctx.restore();
}

// Lo que la pared de arriba sobresale del mapa (y < 0): la imagen guardada del mapa no llega ahí, así que se
// pinta del color de la tapa en cada fotograma (las caras del muro y sus cuadros van encima, con la escena)
export function drawWallTops(ctx, room) {
  const { layout } = room;
  ctx.fillStyle = capColor(layout.style);
  ctx.fillRect(0, -TOP_EXTRA, layout.w || W, TOP_EXTRA);
}

// ¿Hay alguien en la franja de la habitación de detrás que tapa esta cara?
function someoneBehind(f, game) {
  if (!game) return false;
  const behind = (e) => e && e.x > f.x - 12 && e.x < f.x + f.w + 12 && e.y > f.top && e.y < f.y - CELL + 8;
  return behind(game.player) || (game.enemies || []).some(behind) || (game.allies || []).some(behind);
}

// Lo que tiene altura en un mapa (caras de los tabiques y muebles), como una lista de cosas con `y` y `draw`,
// para ordenarlas con los personajes: lo que está más abajo se dibuja delante.
export function sceneryOf(room) {
  if (room.scenery) return room.scenery;
  const list = [];
  const zones = room.layout.zones;
  for (const f of wallFaces(room.layout)) {
    list.push({
      y: f.y,
      draw(ctx, game) {
        // si tapa a alguien, se vuelve medio transparente
        if (someoneBehind(f, game)) ctx.globalAlpha = 0.45;
        // la cara se pinta una vez y se guarda como imagen (se rehace si llega su textura). Debajo, un fondo
        // oscuro: si no, en la fila de píxeles donde se juntan el techo y la pared se colaría lo de detrás
        drawCached(ctx, f, spriteCount(), f.x, f.top - CAP, f.w, f.y - f.top + CAP, (g) => {
          g.fillStyle = OUTLINE;
          g.fillRect(f.x, f.top - CAP, f.w, f.y - f.top + CAP);
          drawFace(g, f);
        });
        ctx.globalAlpha = 1;
        if (f.zone && f.zone.fog > 0) {
          // la habitación aún está a oscuras
          ctx.globalAlpha = 0.9 * f.zone.fog;
          ctx.fillStyle = '#12101c';
          ctx.fillRect(f.x, f.top, f.w, f.y - f.top);
          ctx.globalAlpha = 1;
        }
      },
    });
  }
  // cuadros, ventanas y relojes de la pared de arriba, justo encima de su cara
  const decor = room.layout.wallDecor || [];
  // las puertas del muro de arriba (con su letrero), también encima de su cara
  list.push({
    y: WALL + 0.4,
    draw(ctx, game) {
      drawDoors(ctx, room, game && game.room === room ? game.doorOpen : 1, true);
      drawDoorLabels(ctx, room, true);
    },
  });
  if (decor.length) list.push({ y: WALL + 0.5, draw(ctx, game) { for (const d of decor) drawWallDecor(ctx, d, game ? game.time : 0); } });
  for (const o of room.layout.obstacles) {
    if (o.shape !== 'rect') continue;
    const zone = zones && o.zone !== undefined ? zones[o.zone] : null;
    list.push({ y: o.y + o.h / 2 - 1, draw(ctx) { drawFurniture(ctx, o, zone && zone.fog > 0 ? 1 - 0.85 * zone.fog : 1); } });
  }
  return (room.scenery = list);
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
  // ...y la cara del muro de arriba de esas habitaciones
  for (const f of wallFaces(layout)) {
    if (!f.outer || !f.zone || f.zone.fog <= 0) continue;
    ctx.globalAlpha = 0.9 * f.zone.fog;
    ctx.fillRect(f.x, f.top, f.w, f.y - f.top);
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
    // las baldosas de PixelLab miden 32×32 píxeles de dibujo; las texturas enteras son más grandes y se dibujan a
    // media escala ("scale" en su .json), con el doble de detalle
    const meta = spriteMeta(tile);
    const scale = meta.scale || 1;
    const step = meta.cell[0] * PIXEL * scale;
    for (let y = Math.floor(y0 / step) * step; y < y0 + h; y += step) {
      for (let x = Math.floor(x0 / step) * step; x < x0 + w; x += step) drawSprite(ctx, tile, 'idle', 'south', 0, x, y, { scale });
    }
    // suavizamos el dibujo del suelo con el color de la habitación para que los personajes destaquen
    const suavizar = meta.suavizar ?? 0.45;
    if (suavizar > 0) {
      ctx.globalAlpha = suavizar;
      ctx.fillStyle = style.floorA;
      ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = 1;
    }
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
// Las puertas de un mapa están en `room.exits` (ver makeExit en rooms.js). Se dibujan en pixel art: todo con
// rectángulos en múltiplos de PIXEL, sin contornos redondeados ni degradados.
// - Las del muro de arriba se ven de frente, de pie sobre la cara del muro (marco, hoja con cuarterones y pomo).
// - Las de los demás muros se ven desde arriba: el umbral, las jambas del marco y la hoja como un tablón.
// Las de abajo y los lados se giran: el lado +y local siempre mira hacia el suelo de la habitación.

// Colores de la madera y del metal (apagados, a juego con el tono oscuro del juego)
const MADERA = { luz: '#7a5538', medio: '#5e3f2a', sombra: '#432c1e', filo: '#24170f' };
const METAL = { luz: '#76807c', medio: '#566060', sombra: '#3d4545', filo: '#1e2324' };
const LATON = '#a88a46';
const OSCURO = '#0c0a0e'; // lo de dentro de una puerta abierta

// Mezcla dos colores "#rrggbb" (k = 0, el primero; k = 1, el segundo)
function mix(a, b, k) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const f = (s) => Math.round(((na >> s) & 255) * (1 - k) + ((nb >> s) & 255) * k);
  return `#${((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1)}`;
}
const snap = (v) => Math.round(v / PIXEL) * PIXEL;
function box(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Marco de la puerta: el color de la madera de la casa, o el de un sitio especial apagado (sin colores chillones)
function frameColors(ex, trim) {
  const base = ex.frame ? mix(ex.frame, '#3b3631', 0.6) : mix(trim, MADERA.medio, 0.5);
  return { luz: shade(base, 0.18), medio: base, sombra: shade(base, -0.3), filo: shade(base, -0.62) };
}

// Una mancha de sangre seca en algunas puertas (siempre la misma en cada una)
const manchada = (ex) => (Math.floor(ex.at / 32) * 7 + (ex.dir === 'up' ? 3 : 0)) % 5 === 0;

// open: 0 = cerradas, 1 = abiertas (las que tienen cerrojo no se abren aunque el mapa esté limpio)
// up: true = solo las del muro de arriba, false = las demás. Las de arriba van con la escena (sceneryOf),
// después de la cara de su muro, que mide 3 casillas y si no las taparía.
export function drawDoors(ctx, room, open, up = false) {
  const trim = room.layout.style.trim;
  for (const ex of room.exits) {
    if ((ex.dir === 'up') !== up) continue;
    const gap = ex.locked ? 0 : open;
    const w = ex.kind === 'elevator' ? DOOR_W + 16 : DOOR_W;
    ctx.save();
    ctx.translate(ex.x, ex.y);
    ctx.rotate(ex.a);
    if (up) frontDoor(ctx, ex, w, gap, frameColors(ex, trim));
    else topDoor(ctx, ex, w, gap, frameColors(ex, trim));
    ctx.restore();

    // placa con el icono de lo que hay detrás, al lado de la puerta (siempre derecha); un candado si hace falta la llave
    const icon = ex.locked === 'key' ? '🔒' : ex.icon;
    if (icon) {
      const d = w / 2 + 30;
      plaque(ctx, snap(ex.x + Math.cos(ex.a) * d), snap(ex.y + Math.sin(ex.a) * d), icon, ex.frame);
    }
  }
}

// Puerta vista de frente, en la cara del muro de arriba. Al abrirse, la hoja gira hacia dentro hasta desaparecer.
function frontDoor(ctx, ex, w, gap, fr) {
  const yb = WALL - ex.y;   // pie de la puerta: el suelo
  const dh = 80;            // alto del hueco (2 casillas y media)
  const yt = yb - dh, x0 = -w / 2;
  // marco
  box(ctx, fr.filo, x0 - 8, yt - 8, w + 16, dh + 8);
  box(ctx, fr.medio, x0 - 6, yt - 6, w + 12, dh + 6);
  box(ctx, fr.luz, x0 - 6, yt - 6, w + 12, 2);
  box(ctx, fr.luz, x0 - 6, yt - 4, 2, dh + 4);
  box(ctx, fr.sombra, x0 + w + 4, yt - 4, 2, dh + 4);
  // hueco oscuro, con un poco de suelo al fondo
  box(ctx, OSCURO, x0, yt, w, dh);
  box(ctx, '#1a1614', x0, yb - 4, w, 4);

  if (ex.kind === 'elevator') { elevatorFront(ctx, x0, yt, w, dh); return; }
  const mat = ex.kind === 'door' ? MADERA : METAL;
  // la hoja, con la bisagra a la izquierda: al abrirse se ve de canto y más oscura
  // (abierta del todo ya no se ve: así no queda una tira suelta en el hueco)
  const lw = snap(w * (1 - gap));
  if (lw >= 2) {
    const k = gap * 0.55;
    const c = gap ? { luz: mix(mat.luz, OSCURO, k), medio: mix(mat.medio, OSCURO, k), sombra: mix(mat.sombra, OSCURO, k) } : mat;
    box(ctx, mat.filo, x0, yt, lw, dh);
    box(ctx, c.medio, x0 + 2, yt + 2, lw - 4, dh - 4);
    box(ctx, c.luz, x0 + 2, yt + 2, lw - 4, 2);
    if (lw >= 28) {
      if (ex.kind === 'door') {
        // dos cuarterones hundidos: sombra arriba e izquierda, luz abajo y derecha
        for (const [py, ph] of [[yt + 8, 26], [yt + 40, dh - 48]]) {
          box(ctx, c.sombra, x0 + 8, py, lw - 16, ph);
          box(ctx, c.medio, x0 + 10, py + 2, lw - 18, ph - 2);
          box(ctx, c.luz, x0 + 10, py + ph - 2, lw - 18, 2);
        }
        if (!gap) box(ctx, mat.filo, snap(x0 + lw / 2) - 1, yt + 18, 2, 2); // mirilla
      } else {
        // puerta metálica: ventanuco con rejilla y barra antipánico
        box(ctx, mat.filo, x0 + 12, yt + 10, lw - 24, 18);
        box(ctx, '#27302f', x0 + 14, yt + 12, lw - 28, 14);
        for (let gx = x0 + 18; gx < x0 + lw - 14; gx += 6) box(ctx, '#3a4544', gx, yt + 12, 2, 14);
        box(ctx, c.sombra, x0 + 6, yt + 44, lw - 12, 6);
        box(ctx, c.luz, x0 + 6, yt + 44, lw - 12, 2);
      }
      // pomo (o manilla) al otro lado de la bisagra
      box(ctx, mat.filo, x0 + lw - 12, yt + 42, 6, 6);
      box(ctx, LATON, x0 + lw - 12, yt + 42, 4, 4);
      if (manchada(ex) && !gap) {
        // sangre seca: un manchurrón cerca del pomo y unas gotas que bajan
        box(ctx, '#4a1414', x0 + lw - 22, yt + 34, 10, 8);
        box(ctx, '#4a1414', x0 + lw - 26, yt + 38, 6, 4);
        box(ctx, '#3a1010', x0 + lw - 20, yt + 42, 2, 10);
        box(ctx, '#3a1010', x0 + lw - 16, yt + 42, 2, 6);
      }
    }
    // sombra en el canto que se aleja
    if (gap) box(ctx, mat.filo, x0 + lw - 2, yt, 2, dh);
  }
  // una puerta de emergencia lleva encima su letrero verde de salida
  if (ex.kind === 'stairs') {
    box(ctx, '#0f1f16', -12, yt - 20, 24, 10);
    box(ctx, '#2f7a4a', -10, yt - 18, 20, 6);
    box(ctx, '#7fd19b', -6, yt - 16, 2, 2);
    box(ctx, '#7fd19b', -2, yt - 16, 8, 2);
  }
}

// Ascensor de frente: dos puertas de acero cerradas, su lucecita y una cinta de "averiado"
function elevatorFront(ctx, x0, yt, w, dh) {
  const m = METAL;
  box(ctx, m.medio, x0, yt, w, dh);
  box(ctx, m.luz, x0, yt, w, 2);
  box(ctx, m.filo, -1, yt, 2, dh);
  box(ctx, m.sombra, x0, yt + dh - 4, w, 4);
  box(ctx, m.filo, -6, yt - 6, 12, 4); // la lucecita de encima, apagada en rojo
  box(ctx, '#6a1c1c', -4, yt - 6, 8, 2);
  hazardTape(ctx, x0 - 4, yt + dh / 2 - 6, w + 8);
}

// Cinta de peligro: franja amarilla con rayas negras en diagonal, hecha a escalones de píxel
function hazardTape(ctx, x, y, len) {
  box(ctx, '#c9a227', x, y, len, 10);
  ctx.fillStyle = '#1a1712';
  for (let sx = 0; sx < len; sx += 12) {
    for (let j = 0; j < 5; j++) {
      const px = sx + j * 2;
      if (px + 4 <= len) ctx.fillRect(x + px, y + 8 - j * 2, 4, 2);
    }
  }
}

// Puerta vista desde arriba (muros de abajo y de los lados). Coordenadas locales: el hueco va de -w/2 a w/2 a lo
// largo del muro y el muro, de -WALL/2 (fuera) a WALL/2 (la habitación). Abierta, solo se ve el hueco.
function topDoor(ctx, ex, w, gap, fr) {
  const h = WALL, x0 = -w / 2, y0 = -h / 2;
  // umbral: losas de piedra gastada, y la parte de fuera en penumbra
  box(ctx, '#57524b', x0, y0, w, h);
  for (let ty = y0 + 12; ty < y0 + h; ty += 12) box(ctx, '#45403a', x0, ty, w, 2);
  for (let tx = x0 + 20; tx < x0 + w; tx += 22) box(ctx, '#45403a', tx, y0, 2, h);
  box(ctx, '#1a1614', x0, y0, w, 12);
  box(ctx, '#2e2a26', x0, y0 + 12, w, 4);
  // jambas del marco a los dos lados
  for (const jx of [x0 - 6, x0 + w]) {
    box(ctx, fr.filo, jx, y0, 6, h);
    box(ctx, fr.medio, jx + 2, y0, 2, h);
  }
  if (ex.kind === 'elevator') {
    // ascensor visto desde arriba: las dos hojas de acero cerradas y la cinta cruzada
    box(ctx, METAL.filo, x0, -8, w, 16);
    box(ctx, METAL.medio, x0 + 2, -6, w - 4, 12);
    box(ctx, METAL.filo, -1, -6, 2, 12);
    hazardTape(ctx, x0 - 4, -5, w + 8);
    return;
  }
  const mat = ex.kind === 'door' ? MADERA : METAL;
  // la hoja: un tablón con la bisagra a la izquierda, pegado al lado de la habitación
  const t = 10, len = w;
  const hx = x0, hy = h / 2 - t;
  // abierta no se dibuja: queda solo el hueco (la hoja girada se veía como una línea y no convencía)
  if (gap) return;
  box(ctx, mat.filo, hx, hy, len, t);
  box(ctx, mat.medio, hx + 2, hy + 2, len - 4, t - 4);
  box(ctx, mat.luz, hx + 2, hy + 2, len - 4, 2);
  box(ctx, LATON, hx + len - 10, hy + t - 2, 4, 2); // el pomo asoma por el lado de la habitación
}

// Placa de metal atornillada a la pared con un icono (lo que hay detrás de la puerta)
function plaque(ctx, x, y, icon, tint) {
  const s = 28, x0 = x - s / 2, y0 = y - s / 2;
  box(ctx, '#151316', x0, y0, s, s);
  box(ctx, tint ? mix(tint, '#2b2725', 0.55) : '#4a4540', x0 + 2, y0 + 2, s - 4, s - 4);
  box(ctx, '#29262a', x0 + 4, y0 + 4, s - 8, s - 8);
  ctx.fillStyle = '#8a8378'; // tornillos
  for (const [sx, sy] of [[2, 2], [s - 4, 2], [2, s - 4], [s - 4, s - 4]]) ctx.fillRect(x0 + sx, y0 + sy, 2, 2);
  drawEmoji(ctx, icon, x, y, 12);
}

// Letrero de cada puerta ("1ºA", "Escaleras"...), al otro lado de la insignia.
// Va aparte porque se dibuja a resolución de pantalla, para que se pueda leer.
export function drawDoorLabels(ctx, room, up = false) {
  for (const ex of room.exits) {
    if (!ex.label || (ex.dir === 'up') !== up) continue;
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
// Destello blanco que pasa de vez en cuando por un objeto
function brillo(ctx, pk, y, time) {
  const tw = (time * 1.3 + pk.seed) % 1.6;
  if (tw >= 0.4) return;
  const k = Math.sin((tw / 0.4) * Math.PI) * 5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(pk.x + 8, y - 10 - k); ctx.lineTo(pk.x + 9.5, y - 10); ctx.lineTo(pk.x + 8, y - 10 + k); ctx.lineTo(pk.x + 6.5, y - 10);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pk.x + 8 - k, y - 10); ctx.lineTo(pk.x + 8, y - 8.5); ctx.lineTo(pk.x + 8 + k, y - 10); ctx.lineTo(pk.x + 8, y - 11.5);
  ctx.closePath(); ctx.fill();
}

export function drawPickup(ctx, pk, time) {
  const bob = Math.sin(time * 5 + pk.seed) * 3;
  const y = pk.y - 6 + bob;
  ctx.fillStyle = 'rgba(20,16,40,0.2)';
  ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 6, 8, 3, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  if (pk.kind === 'heart' && drawSprite(ctx, 'objeto-corazon', 'idle', 'south', 0, pk.x, y)) {
    // sprite pixel art
  } else if (pk.kind === 'cash') {
    drawBill(ctx, pk.x, y, time + pk.seed);
    brillo(ctx, pk, y, time);
  } else if (pk.kind === 'molotov') {
    drawMolotov(ctx, pk.x, y + 4, 0, time);
  } else if (pk.kind === 'ammo') {
    drawAmmoBox(ctx, pk.x, y);
    brillo(ctx, pk, y, time);
  } else if (pk.kind === 'heart') {
    heartPath(ctx, pk.x, y + 2, 11);
    ctx.fillStyle = '#ff5d73'; ctx.fill(); ctx.lineJoin = 'round'; ctx.stroke();
  }
}

// Billete de dólar en el suelo (dibujado a mano, en píxeles del dibujo): un rectángulo verde con el
// círculo del retrato en medio, que ondea un poco como si lo moviera el aire
function drawBill(ctx, x, y, t) {
  const u = PIXEL;
  const wave = Math.round(Math.sin(t * 4)) * u; // las puntas suben y bajan un píxel
  const px = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + cx * u, y + cy * u, w * u, h * u); };
  px(-7, -4, 14, 8, '#472937');                  // contorno
  px(-6, -3, 12, 6, '#6aaa5c');                  // papel verde
  px(-6, -3, 12, 1, '#96ce78');                  // borde claro de arriba
  px(-6, 2, 12, 1, '#3a7040');                   // sombra de abajo
  px(-2, -2, 4, 4, '#d6ecb4');                   // el círculo del retrato
  px(-1, -2, 2, 4, '#3a7040');                   // la "S" del dólar, muy simplificada
  px(-1, -1, 1, 1, '#d6ecb4'); px(0, 0, 1, 1, '#d6ecb4');
  px(-5, -2, 1, 1, '#3a7040'); px(4, 1, 1, 1, '#3a7040'); // los números de las esquinas
  // puntas que ondean
  ctx.fillStyle = '#472937';
  ctx.fillRect(x - 8 * u, y - 3 * u + wave, u, 6 * u);
  ctx.fillRect(x + 7 * u, y - 3 * u - wave, u, 6 * u);
}

// Caja de munición en el suelo (dibujada a mano, en píxeles del dibujo): una caja verde oliva con la tapa
// abierta y la punta de cuatro balas asomando
function drawAmmoBox(ctx, x, y) {
  const u = PIXEL;
  const px = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + cx * u, y + cy * u, w * u, h * u); };
  px(-7, -4, 14, 9, '#472937');                  // contorno
  px(-6, -1, 12, 5, '#6b7a3a');                  // caja
  px(-6, -1, 12, 1, '#8e9e52');                  // borde claro de arriba
  px(-6, 3, 12, 1, '#4a5428');                   // sombra de abajo
  px(-2, 0, 4, 2, '#c9b458');                    // la etiqueta
  for (let i = 0; i < 4; i++) {                  // las balas: punta dorada y casquillo
    px(-5 + i * 3, -3, 2, 1, '#ffe066');
    px(-5 + i * 3, -2, 2, 1, '#c98a2a');
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

// Marco de metal oxidado de 9 trozos (el mismo botón de la interfaz): las esquinas no se estiran
const FRAME = new Image();
FRAME.src = 'assets/ui/boton-oscuro.png';
function drawFrame(ctx, x, y, w, h, s = 14) {
  if (!FRAME.complete || !FRAME.naturalWidth) return roundBox(ctx, x, y, w, h, 4, 'rgba(29, 27, 44, 0.85)', 3);
  const iw = FRAME.naturalWidth, ih = FRAME.naturalHeight;
  const xs = [0, s, iw - s, iw], ys = [0, s, ih - s, ih];
  const dx = [x, x + s, x + w - s, x + w], dy = [y, y + s, y + h - s, y + h];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      ctx.drawImage(FRAME, xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j], dx[i], dy[j], dx[i + 1] - dx[i], dy[j + 1] - dy[j]);
    }
  }
  ctx.restore();
}

// Rendimiento: el minimapa se pinta una vez y se guarda como imagen; solo se rehace cuando cambia algo de lo que
// enseña (las casillas, sus colores e iconos, o porque ha terminado de cargar una imagen o la letra). El marco que
// parpadea alrededor de donde estás se pinta encima en cada fotograma.
const MINIMAPA = {};
export function drawMinimap(ctx, floor, current, title, time, screenW = W) {
  const hall = floor.corridor;
  const pad = 14, head = 22;
  const pw = 170, ph = head + pad * 2 + (hall ? 56 : 22);
  const px = screenW - pw - 12, py = 10;
  minimapRect = { x: px, y: py, w: pw, h: ph };

  // casillas: [x, y, ancho, alto, color, ¿estás aquí?, icono]
  const boxes = [];
  const tint = (r) => (!r.visited ? '#4a4552' : r.cleared ? '#bdb59c' : '#b34030');
  const top = py + head + pad;
  if (!hall) {
    // la azotea: un solo sitio
    boxes.push([px + pw / 2 - 30, top, 60, 22, tint(current), true, ROOM_TYPES[current.type].icon]);
  } else {
    const END = 18; // ancho de las casillas de los extremos
    const x0 = px + pad + END + 4, len = pw - (pad + END + 4) * 2;
    boxes.push([x0, top + 22, len, 12, '#bdb59c', current === hall]);
    for (const ex of hall.exits) {
      if (ex.kind === 'elevator') continue;
      if (ex.dir === 'left') boxes.push([x0 - END - 4, top + 19, END, 18, '#4a4552', false, ex.icon || '🚪']);
      else if (ex.dir === 'right') boxes.push([x0 + len + 4, top + 19, END, 18, ex.locked ? '#4a4552' : '#6f9a58', false, ex.locked ? '🔒' : ex.icon]);
      else {
        const r = ex.to;
        // la llave que aún no se ha recogido se marca en cuanto se ha entrado en su apartamento
        const icon = ex.locked === 'key' ? '🔒' : floor.key.room === r && r.visited && !floor.hasKey && !floor.keyUsed ? '🗝️' : ROOM_TYPES[r.type].frame ? ROOM_TYPES[r.type].icon : null;
        boxes.push([x0 + (ex.at / hall.layout.w) * len - 15, ex.dir === 'up' ? top : top + 38, 30, 18, tint(r), current === r, icon]);
      }
    }
  }

  const cargado = `${FRAME.complete}|${Object.values(ICONOS).filter((im) => im.complete).length}|${document.fonts ? document.fonts.status : ''}`;
  const key = `${title}|${px}|${ph}|${cargado}|${boxes.join(';')}`;
  drawCached(ctx, MINIMAPA, key, px - 2, py - 2, pw + 4, ph + 4, (g) => {
    drawFrame(g, px, py, pw, ph);
    outlinedText(g, title, px + pw / 2, py + 19, 12, '#e6c34a', { lw: 4 });
    for (const [x, y, w, h, fill, here, icon] of boxes) {
      g.beginPath();
      g.rect(x, y, w, h);
      g.fillStyle = here ? '#e0b030' : fill;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = here ? '#f2e6c0' : OUTLINE;
      g.stroke();
      if (icon) drawEmoji(g, icon, x + w / 2, y + h / 2 + 1, 11);
    }
  });

  // marco que parpadea alrededor de donde estás
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.3;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e0b030';
  for (const [x, y, w, h, , here] of boxes) {
    if (!here) continue;
    ctx.beginPath();
    ctx.rect(x - 3, y - 3, w + 6, h + 6);
    ctx.stroke();
  }
  ctx.restore();
}

// Emojis que ya tienen icono pixel art (assets/ui/iconos); el resto se sigue dibujando como texto
const EMOJI_ICONO = { '🚪': 'puerta', '🧰': 'herramientas', '🧟': 'zombi', '👹': 'jefe', '👑': 'corona', '🪜': 'escalera', '🔒': 'candado', '🗝️': 'llave' };
const ICONOS = {};
export function drawEmoji(ctx, emoji, x, y, size) {
  const id = EMOJI_ICONO[emoji];
  if (id) {
    if (!ICONOS[id]) { ICONOS[id] = new Image(); ICONOS[id].src = `assets/ui/iconos/${id}.png`; }
    const img = ICONOS[id];
    if (img.complete && img.naturalWidth) {
      const s = size * 1.5;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
      ctx.restore();
      return;
    }
  }
  ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}
