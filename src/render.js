// ─────────────────────────────────────────────
//  Dibujo del escenario: salas, puertas, objetos
// ─────────────────────────────────────────────
import { W, H, WALL, DOOR_W, OUTLINE } from './config.js';
import { ROOM_TYPES } from './rooms.js';
import { blob, eyes, shadow, outlinedText, roundBox, heartPath } from './draw.js';

const TAU = Math.PI * 2;
const STRIPE = 64;

export function drawRoom(ctx, room, time) {
  const b = room.biome;
  const iw = W - WALL * 2, ih = H - WALL * 2;

  // Muros con "piedras" redondas
  ctx.fillStyle = b.wall;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = b.wallDark;
  for (let x = 14; x < W; x += 52) {
    ctx.beginPath(); ctx.arc(x, WALL * 0.45, 13, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 26, H - WALL * 0.45, 13, 0, TAU); ctx.fill();
  }
  for (let y = 40; y < H - 30; y += 52) {
    ctx.beginPath(); ctx.arc(WALL * 0.45, y, 13, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(W - WALL * 0.45, y + 26, 13, 0, TAU); ctx.fill();
  }

  // Suelo a franjas (como el césped de un campo, pero en cada bioma)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(WALL, WALL, iw, ih, 22);
  ctx.clip();
  for (let i = 0, x = WALL; x < W - WALL; x += STRIPE, i++) {
    ctx.fillStyle = i % 2 ? b.floorA : b.floorB;
    ctx.fillRect(x, WALL, STRIPE, ih);
  }

  // Decoración
  ctx.strokeStyle = b.deco;
  ctx.fillStyle = b.deco;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const d of room.decor) {
    if (d.kind === 0) {
      // matojo de hierba / grieta
      ctx.beginPath();
      ctx.moveTo(d.x - 6 * d.s, d.y); ctx.lineTo(d.x - 8 * d.s, d.y - 9 * d.s);
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y - 12 * d.s);
      ctx.moveTo(d.x + 6 * d.s, d.y); ctx.lineTo(d.x + 8 * d.s, d.y - 9 * d.s);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(d.x, d.y, 4 * d.s, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(d.x + 9 * d.s, d.y + 4 * d.s, 2.5 * d.s, 0, TAU); ctx.fill();
    }
  }

  // Sombra interior bajo el muro superior (da sensación de profundidad)
  const g = ctx.createLinearGradient(0, WALL, 0, WALL + 34);
  g.addColorStop(0, 'rgba(20,16,40,0.28)');
  g.addColorStop(1, 'rgba(20,16,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(WALL, WALL, iw, 34);
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(WALL, WALL, iw, ih, 22);
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // Obstáculos
  for (const o of room.obstacles) drawObstacle(ctx, o, b);
}

function drawObstacle(ctx, o, b) {
  shadow(ctx, o.x, o.y, o.r, 0.25);
  if (b.obstacle === 'bush') {
    for (const [dx, dy, s] of [[-0.45, 0.15, 0.62], [0.45, 0.15, 0.62], [0, -0.2, 0.75]]) {
      blob(ctx, o.x + dx * o.r, o.y + dy * o.r, o.r * s, b.obColor, { lw: 4 });
    }
    ctx.fillStyle = '#ff5d73';
    for (const [dx, dy] of [[-0.3, -0.25], [0.35, 0.05], [0.05, 0.25]]) {
      ctx.beginPath(); ctx.arc(o.x + dx * o.r, o.y + dy * o.r, 3.5, 0, TAU); ctx.fill();
    }
  } else if (b.obstacle === 'rock') {
    blob(ctx, o.x, o.y, o.r, b.obColor, { sx: 1.1, sy: 0.9 });
    ctx.strokeStyle = 'rgba(29,27,44,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x - o.r * 0.2, o.y - o.r * 0.5);
    ctx.lineTo(o.x, o.y - o.r * 0.1);
    ctx.lineTo(o.x + o.r * 0.25, o.y + o.r * 0.05);
    ctx.stroke();
  } else {
    // pilar de cripta visto desde arriba
    blob(ctx, o.x, o.y, o.r, b.obColor);
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * 0.6, 0, TAU);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(29,27,44,0.4)';
    ctx.stroke();
  }
}

export function drawDoors(ctx, doors, time) {
  for (const d of doors) {
    const x0 = d.x - DOOR_W / 2;
    // hueco oscuro
    ctx.beginPath();
    ctx.roundRect(x0, 2, DOOR_W, WALL + 4, [22, 22, 0, 0]);
    ctx.fillStyle = '#2a2540';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    // rejas que se levantan al abrir
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0 + 3, 4, DOOR_W - 6, WALL + 2, [20, 20, 0, 0]);
    ctx.clip();
    const lift = d.open * (WALL + 6);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.roundRect(x0 + 10 + i * 17, 2 - lift, 9, WALL + 6, 4);
      ctx.fillStyle = '#a7adc4';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();

    // icono flotante con el tipo de sala
    if (d.open > 0) {
      const t = ROOM_TYPES[d.type];
      ctx.save();
      ctx.globalAlpha = d.open;
      const by = WALL + 34 + Math.sin(time * 3 + d.x) * 4;
      ctx.beginPath();
      ctx.arc(d.x, by, 24, 0, TAU);
      ctx.fillStyle = '#fff8ea';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.font = '24px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, d.x, by + 2);
      outlinedText(ctx, t.name, d.x, by + 40, 18, '#ffffff', { lw: 5 });
      // flechita
      ctx.beginPath();
      const ay = by - 34 - Math.abs(Math.sin(time * 5)) * 4;
      ctx.moveTo(d.x - 8, ay + 4); ctx.lineTo(d.x, ay - 5); ctx.lineTo(d.x + 8, ay + 4);
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Objetos con los que se interactúa: cofre, tienda, hoguera
export function drawInteract(ctx, it, time) {
  const { x, y } = it;
  if (it.kind === 'chest') {
    shadow(ctx, x, y + 6, 34, 0.25);
    if (it.used) {
      // rayos de luz
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff3b0';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.3 + Math.sin(time * 2) * 0.05;
        ctx.beginPath();
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x + Math.cos(a - 0.08) * 90, y - 14 + Math.sin(a - 0.08) * 90);
        ctx.lineTo(x + Math.cos(a + 0.08) * 90, y - 14 + Math.sin(a + 0.08) * 90);
        ctx.fill();
      }
      ctx.restore();
      roundBox(ctx, x - 36, y - 40, 72, 20, 10, '#e08c4a');
    }
    roundBox(ctx, x - 34, y - 16, 68, 42, 8, '#c9773b');
    if (!it.used) roundBox(ctx, x - 37, y - 30, 74, 24, 11, '#e08c4a');
    roundBox(ctx, x - 7, y - 30, 14, 56, 3, '#ffd23f', 3);
    roundBox(ctx, x - 8, y - 12, 16, 14, 4, '#ffd23f', 3);
    if (!it.used) outlinedText(ctx, '!', x, y - 58 - Math.abs(Math.sin(time * 4)) * 6, 30, '#ffd23f');
  } else if (it.kind === 'shop') {
    // toldo
    roundBox(ctx, x - 70, y - 78, 8, 70, 3, '#8b5a3c', 3);
    roundBox(ctx, x + 62, y - 78, 8, 70, 3, '#8b5a3c', 3);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#fff8ea' : '#ff5d73';
      ctx.fillRect(x - 78 + i * 26, y - 96, 26, 22);
      ctx.beginPath(); ctx.arc(x - 65 + i * 26, y - 74, 13, 0, Math.PI); ctx.fill();
    }
    ctx.beginPath(); ctx.roundRect(x - 78, y - 96, 156, 22, 4);
    ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
    // tendero
    shadow(ctx, x, y - 8, 26, 0.15);
    blob(ctx, x, y - 22 + Math.sin(time * 3) * 2, 26, '#80ed99');
    eyes(ctx, x, y - 22 + Math.sin(time * 3) * 2, 26, 0, 0.6);
    // bigote
    ctx.beginPath();
    ctx.ellipse(x - 7, y - 12, 8, 4, 0.3, 0, TAU);
    ctx.ellipse(x + 7, y - 12, 8, 4, -0.3, 0, TAU);
    ctx.fillStyle = OUTLINE; ctx.fill();
    // mostrador
    roundBox(ctx, x - 66, y - 2, 132, 36, 8, '#c98a54');
    ctx.font = '20px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍗  💪  ⚡', x, y + 16);
    outlinedText(ctx, 'TIENDA', x, y - 120 - Math.abs(Math.sin(time * 3)) * 4, 24, '#ffd23f');
  } else if (it.kind === 'campfire') {
    const glow = ctx.createRadialGradient(x, y, 5, x, y, 110);
    glow.addColorStop(0, `rgba(255, 200, 80, ${it.used ? 0.15 : 0.45})`);
    glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 110, 0, TAU); ctx.fill();
    for (const a of [0.45, -0.45]) {
      ctx.save(); ctx.translate(x, y + 12); ctx.rotate(a);
      roundBox(ctx, -30, -7, 60, 14, 7, '#8b5a3c', 3.5);
      ctx.restore();
    }
    const s = it.used ? 0.45 : 1;
    const flames = [['#ff5d73', 1], ['#ff9f1c', 0.75], ['#ffd23f', 0.45]];
    for (const [c, k] of flames) {
      const h = (46 + Math.sin(time * 12 * k) * 5) * k * s;
      const w = 22 * k * s;
      ctx.beginPath();
      ctx.moveTo(x, y + 8 - h);
      ctx.quadraticCurveTo(x + w * 1.4, y - h * 0.2, x + w * 0.9, y + 4);
      ctx.quadraticCurveTo(x, y + 14, x - w * 0.9, y + 4);
      ctx.quadraticCurveTo(x - w * 1.4, y - h * 0.2, x, y + 8 - h);
      ctx.fillStyle = c; ctx.fill();
      if (k === 1) { ctx.lineWidth = 3.5; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
    }
    if (!it.used) outlinedText(ctx, 'Descansar', x, y - 74 - Math.abs(Math.sin(time * 3)) * 4, 22, '#ffd23f');
  }
}

export function drawPickup(ctx, pk, time) {
  const bob = Math.sin(time * 5 + pk.seed) * 3;
  const y = pk.y - 6 + bob;
  ctx.fillStyle = 'rgba(20,16,40,0.2)';
  ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 6, 8, 3, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  if (pk.kind === 'coin') {
    const sx = Math.max(0.25, Math.abs(Math.cos(time * 5 + pk.seed)));
    ctx.beginPath(); ctx.ellipse(pk.x, y, 9 * sx, 9, 0, 0, TAU);
    ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(pk.x, y, 4.5 * sx, 4.5, 0, 0, TAU);
    ctx.fillStyle = '#f0a500'; ctx.fill();
  } else if (pk.kind === 'gem') {
    ctx.beginPath();
    ctx.moveTo(pk.x, y - 12); ctx.lineTo(pk.x + 10, y - 2); ctx.lineTo(pk.x, y + 11); ctx.lineTo(pk.x - 10, y - 2);
    ctx.closePath();
    ctx.fillStyle = '#4cc9f0'; ctx.fill(); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pk.x - 4, y - 4); ctx.lineTo(pk.x, y - 8); ctx.lineTo(pk.x + 2, y - 4);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  } else if (pk.kind === 'heart') {
    heartPath(ctx, pk.x, y + 2, 11);
    ctx.fillStyle = '#ff5d73'; ctx.fill(); ctx.lineJoin = 'round'; ctx.stroke();
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
