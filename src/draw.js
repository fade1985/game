// ─────────────────────────────────────────────
//  Utilidades de dibujo con estilo "cartoon":
//  formas redondas, contorno grueso y brillo
// ─────────────────────────────────────────────
import { OUTLINE } from './config.js';

const TAU = Math.PI * 2;

// Sombra ovalada bajo los personajes
export function shadow(ctx, x, y, r, alpha = 0.22) {
  ctx.fillStyle = `rgba(20, 16, 40, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.95, r * 0.36, 0, 0, TAU);
  ctx.fill();
}

// Cuerpo redondo ("blob") con sombreado, brillo y contorno
export function blob(ctx, x, y, r, fill, { sx = 1, sy = 1, lw = 4, flash = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = flash ? '#ffffff' : fill;
  ctx.fill();
  if (!flash) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
    ctx.beginPath();
    ctx.arc(r * 0.15, r * 0.75, r * 1.05, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.26, r * 0.15, -0.7, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}

// Ojos que miran en la dirección (lx, ly)
export function eyes(ctx, x, y, r, lx, ly, { angry = false, blink = false } = {}) {
  const ex = r * 0.34;
  const er = r * 0.27;
  const cy = y - r * 0.15 + ly * r * 0.1;
  const ox = lx * r * 0.16;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const cx = x + s * ex + ox;
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(cx - er * 0.8, cy);
      ctx.lineTo(cx + er * 0.8, cy);
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, cy, er * 0.85, er, 0, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.09);
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      const px = cx + lx * er * 0.35, py = cy + ly * er * 0.4;
      ctx.beginPath();
      ctx.arc(px, py, er * 0.5, 0, TAU);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - er * 0.18, py - er * 0.2, er * 0.16, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    if (angry) {
      ctx.beginPath();
      ctx.moveTo(cx + s * er * 1.0, cy - er * 1.45);
      ctx.lineTo(cx - s * er * 0.9, cy - er * 0.8);
      ctx.lineWidth = Math.max(2.5, r * 0.13);
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }
}

// Texto con contorno grueso, como en los juegos casual
export function outlinedText(ctx, text, x, y, size, fill, { lw = 6, align = 'center', stroke = OUTLINE } = {}) {
  ctx.font = `${size}px "Lilita One", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// Rectángulo redondeado relleno + contorno
export function roundBox(ctx, x, y, w, h, r, fill, lw = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.0, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.0, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}

// ─────────────────────────────────────────────
//  Personaje humano estilo "chibi" visto desde arriba:
//  cabeza grande, cuerpo pequeño, manos y pies animados.
//  Se usa para el protagonista y, más adelante, para zombis y supervivientes.
//
//  (x, y) es el centro del personaje en el suelo (su círculo de colisión).
//  Opciones:
//    s          escala (1 = tamaño del protagonista)
//    skin, shirt, pants, hair, shoes   colores
//    lookX/lookY  hacia dónde mira (normalizado)
//    moveX/moveY  hacia dónde camina (normalizado) y `moving` (0..1)
//    walk       fase de la animación de caminar
//    bandana    color de la cinta de la cabeza (opcional)
//    overalls   color del mono de trabajo (opcional)
//    flash      true = todo blanco (al recibir daño)
//    hideHand   1 o -1: no dibuja esa mano (la que sujeta el arma)
//    zombie     true = brazos estirados hacia delante y boca con dientes
// ─────────────────────────────────────────────
export function drawHuman(ctx, x, y, o) {
  const s = o.s || 1;
  const white = '#ffffff';
  const col = (c) => (o.flash ? white : c);
  const lw = 3 * s;
  const lookX = o.lookX || 0, lookY = o.lookY ?? 1;
  const moving = o.moving || 0;
  const step = Math.sin(o.walk || 0) * moving;
  const bob = Math.abs(Math.sin(o.walk || 0)) * moving * 2 * s;
  let mx = o.moveX || 0, my = o.moveY || 0;
  if (!mx && !my) { mx = lookX; my = lookY; }

  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';

  // sombra
  ctx.fillStyle = 'rgba(20, 16, 40, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 15 * s, 15 * s, 5.5 * s, 0, 0, TAU);
  ctx.fill();

  // pies (se adelantan y atrasan al andar)
  const fx = mx * step * 4 * s, fy = my * step * 3 * s;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 6 * s + side * fx, y + 13 * s + side * fy, 5.5 * s, 4 * s, 0, 0, TAU);
    ctx.fillStyle = col(o.shoes || '#3b3550');
    ctx.fill();
    ctx.stroke();
  }

  const by = y + 2 * s - bob; // centro del cuerpo
  const facingBack = lookY < -0.45;

  // manos (balanceo opuesto a los pies)
  const drawHands = () => {
    for (const side of [-1, 1]) {
      if (o.hideHand === side) continue; // esa mano la dibuja quien sujeta un arma
      let hx = x + side * 13 * s - side * fx * 0.7;
      let hy = by + 3 * s - side * fy * 0.7;
      if (o.zombie) {
        // brazos de zombi: estirados hacia donde mira, balanceándose
        const sway = Math.sin((o.walk || 0) * 1.3 + side) * 2 * s;
        hx = x + lookX * 16 * s - lookY * side * 9 * s + sway;
        hy = by - 1 * s + lookY * 5 * s + lookX * side * 5 * s;
        // el brazo (manga) desde el hombro hasta la mano
        const shx = x - lookY * side * 9 * s + lookX * 2 * s;
        const shy = by - 3 * s + lookX * side * 3 * s;
        ctx.beginPath();
        ctx.moveTo(shx, shy);
        ctx.lineTo(hx, hy);
        ctx.lineCap = 'round';
        ctx.lineWidth = 8 * s;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        ctx.lineWidth = 4.5 * s;
        ctx.strokeStyle = col(o.shirt);
        ctx.stroke();
        ctx.lineWidth = lw;
        ctx.strokeStyle = OUTLINE;
      }
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5 * s, 0, TAU);
      ctx.fillStyle = col(o.skin);
      ctx.fill();
      ctx.stroke();
    }
  };
  if (facingBack) drawHands();

  // cuerpo
  ctx.beginPath();
  ctx.roundRect(x - 11 * s, by - 9 * s, 22 * s, 20 * s, 9 * s);
  ctx.fillStyle = col(o.shirt);
  ctx.fill();
  if (!o.flash) {
    ctx.save();
    ctx.clip();
    // pantalón (parte de abajo del cuerpo)
    ctx.fillStyle = o.pants || '#3d4a7a';
    ctx.fillRect(x - 12 * s, by + 4 * s, 24 * s, 10 * s);
    // mono de trabajo: peto y tirantes
    if (o.overalls) {
      ctx.fillStyle = o.overalls;
      ctx.fillRect(x - 12 * s, by + 2 * s, 24 * s, 12 * s);
      if (!facingBack) {
        ctx.beginPath();
        ctx.roundRect(x - 6 * s, by - 4 * s, 12 * s, 9 * s, 2 * s);
        ctx.fill();
      }
      ctx.fillRect(x - 8 * s, by - 10 * s, 3 * s, 14 * s);
      ctx.fillRect(x + 5 * s, by - 10 * s, 3 * s, 14 * s);
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.roundRect(x - 11 * s, by - 9 * s, 22 * s, 20 * s, 9 * s);
  ctx.stroke();

  // cruz roja en el pecho (personal sanitario)
  if (o.cross && !o.flash && !facingBack) {
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(x - 1.6 * s, by + 1 * s, 3.2 * s, 8 * s);
    ctx.fillRect(x - 4 * s, by + 3.4 * s, 8 * s, 3.2 * s);
  }

  if (!facingBack) drawHands();

  // cabeza
  const hr = 15 * s;
  const hx = x, hy = by - 15 * s;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.fillStyle = col(o.skin);
  ctx.fill();

  if (!o.flash) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.clip();
    ctx.fillStyle = o.hair || '#6b3e26';
    // flequillo: casquete en la parte de arriba de la cabeza
    const capX = hx - lookX * 3 * s, capY = hy - 9 * s;
    ctx.beginPath();
    ctx.ellipse(capX, capY, 17 * s, 11 * s, 0, 0, TAU);
    ctx.fill();
    // nuca: se desplaza al lado contrario de la mirada (de espaldas tapa toda la cabeza)
    ctx.beginPath();
    ctx.arc(hx - lookX * 11 * s, hy - 6 * s - lookY * 8 * s, 15 * s, 0, TAU);
    ctx.fill();
    if (o.bandana) {
      // cinta justo en el borde del flequillo
      ctx.beginPath();
      ctx.ellipse(capX, capY, 17 * s, 11 * s, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.lineWidth = 4.5 * s;
      ctx.strokeStyle = o.bandana;
      ctx.stroke();
    }
    // sombreado inferior
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.arc(hx + 2 * s, hy + 12 * s, hr, 0, TAU);
    ctx.fill();
    ctx.restore();
    // brillo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(hx - 6 * s, hy - 8 * s, 4 * s, 2.4 * s, -0.7, 0, TAU);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // nudo de la cinta en la nuca (no se ve de frente)
  if (o.bandana && !o.flash && lookY < 0.5) {
    const kx = hx - lookX * 14 * s, ky = hy + 1 * s;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(kx - lookX * 4 * s, ky + k * 3.5 * s, 5 * s, 2.6 * s, k * 0.5 - lookX * 0.4, 0, TAU);
      ctx.fillStyle = o.bandana;
      ctx.fill();
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    }
  }

  // gorra de policía o casco militar
  if (o.hat && !o.flash) {
    ctx.fillStyle = o.hat.color;
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE;
    if (o.hat.kind === 'helmet') {
      ctx.beginPath();
      ctx.ellipse(hx, hy - 4 * s, 17.5 * s, 14 * s, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (const [dx, dy] of [[-6, -10], [4, -13], [8, -6]]) {
        ctx.beginPath(); ctx.arc(hx + dx * s, hy + dy * s, 2.2 * s, 0, TAU); ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(hx, hy - 6 * s, 15.5 * s, 11 * s, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!facingBack) {
        // visera hacia donde mira
        ctx.beginPath();
        ctx.ellipse(hx + lookX * 8 * s, hy - 5 * s, 11 * s, 4 * s, lookX * 0.3, 0, Math.PI);
        ctx.fillStyle = '#1d1b2c';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(hx, hy - 12 * s, 2.6 * s, 0, TAU);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
    }
  }

  // cara (solo si no está de espaldas)
  if (!facingBack) {
    eyes(ctx, hx + lookX * 4 * s, hy + 8 * s, 15 * s, lookX, lookY, { angry: o.angry, blink: o.blink });
    if (o.zombie && !o.flash) {
      // boca torcida con dientes
      const mx = hx + lookX * 5 * s, my = hy + 11.5 * s;
      ctx.beginPath();
      ctx.ellipse(mx, my, 5 * s, 2.6 * s, -0.15, 0, TAU);
      ctx.fillStyle = '#3a1f2b';
      ctx.fill();
      ctx.fillStyle = '#fff8ea';
      ctx.fillRect(mx - 3 * s, my - 2.4 * s, 2 * s, 2 * s);
      ctx.fillRect(mx + 1 * s, my - 2.4 * s, 2 * s, 2 * s);
    } else if (lookY > -0.1 && !o.flash) {
      ctx.fillStyle = 'rgba(255, 120, 140, 0.45)';
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(hx + lookX * 4 * s + k * 9.5 * s, hy + 11.5 * s, 2.8 * s, 1.8 * s, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
}
