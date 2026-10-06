// ─────────────────────────────────────────────
//  Dibujo del escenario: habitaciones, puertas, objetos y minimapa
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE, PIXEL, PIXEL_MODE, TILE } from './config.js';
import { drawSprite, hasSprite } from './sprites.js';
import { roundBox, outlinedText, heartPath } from './draw.js';
import { ROOM_TYPES } from './rooms.js';
import { drawFurniture, drawFurnitureLight, drawWallDecor, drawWindowLight } from './furniture.js';

const TAU = Math.PI * 2;

// ═════════════ Habitación ═════════════
export function drawRoom(ctx, room, time) {
  const { style, seams, obstacles, rug, decor, wallDecor = [] } = room.layout;
  const iw = W - WALL * 2, ih = H - WALL * 2;

  // Muro con papel pintado a rayas
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, W, H);
  // rayas verticales en los muros de arriba/abajo y horizontales en los laterales
  ctx.fillStyle = style.stripe;
  for (let x = 0; x < W; x += 28) {
    ctx.fillRect(x, 0, 12, WALL);
    ctx.fillRect(x, H - WALL, 12, WALL);
  }
  for (let y = WALL; y < H - WALL; y += 28) {
    ctx.fillRect(0, y, WALL, 12);
    ctx.fillRect(W - WALL, y, WALL, 12);
  }
  // borde exterior del muro (la parte de arriba vista desde el techo)
  ctx.lineWidth = 14;
  ctx.strokeStyle = style.trim;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  for (const d of wallDecor) drawWallDecor(ctx, d, time);

  // Suelo
  ctx.save();
  ctx.beginPath();
  ctx.rect(WALL, WALL, iw, ih);
  ctx.clip();
  drawFloor(ctx, style, seams, iw, ih);

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
  ctx.restore();

  // Rodapié alrededor del suelo
  ctx.lineWidth = 8;
  ctx.strokeStyle = style.trim;
  ctx.strokeRect(WALL - 4, WALL - 4, iw + 8, ih + 8);
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(WALL - 8, WALL - 8, iw + 16, ih + 16);
  ctx.strokeRect(WALL, WALL, iw, ih);

  for (const o of obstacles) {
    if (o.shape === 'rect') drawFurniture(ctx, o);
    else drawObstacle(ctx, o);
  }
}

// Nombre de sprite a partir del nombre del estilo: "Baño" → "bano"
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function drawFloor(ctx, style, seams, iw, ih) {
  // pixel art: baldosa del estilo repetida por todo el suelo
  const tile = `suelo-${slug(style.name)}`;
  if (PIXEL_MODE && hasSprite(tile)) {
    const step = TILE * 2 * PIXEL; // las baldosas de suelo miden 32×32 píxeles de dibujo
    for (let y = WALL; y < WALL + ih; y += step) {
      for (let x = WALL; x < WALL + iw; x += step) drawSprite(ctx, tile, 'idle', 'south', 0, x, y);
    }
    return;
  }
  if (style.floor === 'parquet') {
    for (const row of seams) {
      ctx.fillStyle = row.shade ? style.floorA : style.floorB;
      ctx.fillRect(WALL, row.y, iw, 32);
      ctx.fillStyle = style.seam;
      ctx.fillRect(WALL, row.y + 30, iw, 2);
      for (const x of row.cuts) ctx.fillRect(x, row.y, 2, 32);
    }
  } else if (style.floor === 'tiles') {
    const T = 48;
    for (let y = WALL, j = 0; y < WALL + ih; y += T, j++) {
      for (let x = WALL, i = 0; x < WALL + iw; x += T, i++) {
        ctx.fillStyle = (i + j) % 2 ? style.floorA : style.floorB;
        ctx.fillRect(x, y, T, T);
      }
    }
    ctx.fillStyle = style.seam;
    for (let y = WALL; y < WALL + ih; y += T) ctx.fillRect(WALL, y, iw, 2);
    for (let x = WALL; x < WALL + iw; x += T) ctx.fillRect(x, WALL, 2, ih);
  } else {
    // moqueta: color liso con un punteado suave
    ctx.fillStyle = style.floorA;
    ctx.fillRect(WALL, WALL, iw, ih);
    ctx.fillStyle = style.floorB;
    for (let y = WALL + 10, j = 0; y < WALL + ih; y += 20, j++) {
      for (let x = WALL + 10 + (j % 2) * 10; x < WALL + iw; x += 20) {
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
// Posición y giro de cada puerta. Se dibujan todas como si estuvieran en
// el muro de arriba y se rotan: el lado +y local siempre mira hacia el suelo.
const DOOR_POS = {
  up: { x: W / 2, y: WALL / 2, a: 0 },
  down: { x: W / 2, y: H - WALL / 2, a: Math.PI },
  left: { x: WALL / 2, y: H / 2, a: -Math.PI / 2 },
  right: { x: W - WALL / 2, y: H / 2, a: Math.PI / 2 },
};

// open: 0 = cerrada, 1 = abierta
export function drawDoors(ctx, room, open) {
  const trim = room.layout.style.trim;
  for (const [dir, has] of Object.entries(room.doors)) {
    if (!has) continue;
    const p = DOOR_POS[dir];
    const special = ROOM_TYPES[room.doorTypes[dir]];
    const frame = special && special.frame;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    const w = DOOR_W, h = WALL + 10;
    // marco: de madera, o de color si lleva a una sala especial
    roundBox(ctx, -w / 2 - 10, -h / 2 - 2, w + 20, h + 2, 6, frame || trim, 4);
    if (frame) {
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
    if (open < 1) {
      const ph = (h + 2) * (1 - open);
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 2, -h / 2 - 2, w - 4, ph, 3);
      ctx.fillStyle = '#b9814f';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = '#9c6a3e';
      for (let i = 1; i < 4; i++) ctx.fillRect(-w / 2 + 2 + i * (w - 4) / 4 - 1, -h / 2, 2, Math.max(0, ph - 4));
      if (open < 0.3) {
        ctx.beginPath();
        ctx.arc(w / 2 - 14, h / 2 - 12, 4, 0, TAU);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();

    // insignia con el icono de la sala, al lado de la puerta (siempre derecha)
    if (special && special.frame) {
      const bx = p.x + Math.cos(p.a) * (w / 2 + 34);
      const by = p.y + Math.sin(p.a) * (w / 2 + 34);
      ctx.beginPath();
      ctx.arc(bx, by, 17, 0, TAU);
      ctx.fillStyle = special.frame;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      drawEmoji(ctx, special.icon, bx, by + 1, 18);
    }
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

export function drawBullet(ctx, b) {
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(b.x - b.vx * 0.018, b.y - b.vy * 0.018, b.r * 0.8, 0, TAU);
  ctx.fillStyle = b.color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, TAU);
  ctx.fillStyle = b.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (!b.friendly) {
    ctx.beginPath(); ctx.arc(b.x - 2, b.y - 2, b.r * 0.35, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
  }
}

// ═════════════ Minimapa ═════════════
// Muestra las salas visitadas, las vistas (vecinas de una visitada) y la actual.
export function drawMinimap(ctx, floor, current, title, time) {
  const shown = [...floor.rooms.values()].filter((r) => r.visited || r.seen);
  if (!shown.length) return;
  const CW = 24, CH = 16, GAP = 5;
  const minX = Math.min(...shown.map((r) => r.gx)), maxX = Math.max(...shown.map((r) => r.gx));
  const minY = Math.min(...shown.map((r) => r.gy)), maxY = Math.max(...shown.map((r) => r.gy));
  const cols = maxX - minX + 1, rows = maxY - minY + 1;
  const pad = 10, head = 22;
  const pw = Math.max(120, cols * (CW + GAP) - GAP + pad * 2);
  const ph = rows * (CH + GAP) - GAP + pad * 2 + head;
  const px = W - pw - 12, py = 10;

  ctx.save();
  ctx.globalAlpha = 0.92;
  roundBox(ctx, px, py, pw, ph, 12, 'rgba(29, 27, 44, 0.78)', 3);
  ctx.globalAlpha = 1;
  outlinedText(ctx, title, px + pw / 2, py + 15, 14, '#ffd23f', { lw: 4 });

  const ox = px + (pw - (cols * (CW + GAP) - GAP)) / 2;
  const oy = py + pad + head;
  const pos = (r) => ({ x: ox + (r.gx - minX) * (CW + GAP), y: oy + (r.gy - minY) * (CH + GAP) });

  // conexiones entre salas visitadas
  ctx.fillStyle = 'rgba(255, 248, 234, 0.55)';
  for (const r of shown) {
    if (!r.visited) continue;
    const p = pos(r);
    if (r.doors.right) ctx.fillRect(p.x + CW, p.y + CH / 2 - 2, GAP, 4);
    if (r.doors.down) ctx.fillRect(p.x + CW / 2 - 2, p.y + CH, 4, GAP);
    if (r.doors.left) ctx.fillRect(p.x - GAP, p.y + CH / 2 - 2, GAP, 4);
    if (r.doors.up) ctx.fillRect(p.x + CW / 2 - 2, p.y - GAP, 4, GAP);
  }

  for (const r of shown) {
    const p = pos(r);
    const isCur = r === current;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, CW, CH, 4);
    ctx.fillStyle = isCur ? '#ffd23f' : r.visited ? (r.cleared ? '#fff8ea' : '#ff8a9b') : '#5d5873';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isCur ? '#ffffff' : OUTLINE;
    ctx.stroke();
    const info = ROOM_TYPES[r.type];
    const stairs = r.props && r.props.some((pr) => pr.kind === 'stairs');
    if (stairs) drawEmoji(ctx, '🪜', p.x + CW / 2, p.y + CH / 2 + 1, 12);
    else if (info.frame) drawEmoji(ctx, info.icon, p.x + CW / 2, p.y + CH / 2 + 1, 12);
    if (isCur) {
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.3;
      ctx.beginPath();
      ctx.roundRect(p.x - 3, p.y - 3, CW + 6, CH + 6, 6);
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
      ctx.globalAlpha = 1;
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
