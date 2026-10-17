// ─────────────────────────────────────────────
//  Luz: una capa de penumbra encima de la partida con "agujeros" donde hay luz
//
//  Cómo funciona: en un lienzo pequeño (cada píxel = LUZ_PASO unidades del juego) se pinta la oscuridad y,
//  donde hay una luz, se borra un círculo con el borde suave. Ese lienzo se amplía con suavizado encima de
//  suelo y personajes. Luego se añade un tinte cálido muy flojo en cada luz, para que sea de bombilla.
//  Los círculos salen de `glow` (draw.js): el degradado se pinta una vez y luego solo se copia.
//  Luces: los apliques del pasillo, el fuego del molotov, los zombis ardiendo y los destellos (fogonazos de los
//  disparos y explosiones). Cada clase de sala tiene su penumbra (OSCURIDAD_SALA).
// ─────────────────────────────────────────────
import { glow } from './draw.js';
import { WALL } from './config.js';

const LUZ_PASO = 4;                 // unidades del juego por píxel de la capa de luz (la luz es difusa: basta)
const OSCURIDAD = 0.62;             // lo oscuro que queda el pasillo lejos de las luces (0 = nada, 1 = negro)
const COLOR_SOMBRA = '10, 8, 24';   // la penumbra tira a azul noche
const COLOR_CALIDO = '255, 170, 80';

const capa = document.createElement('canvas');
const capaCtx = capa.getContext('2d');

// Un número "al azar" fijo para cada (a, b): el parpadeo no gasta dados del juego, así cada partida sigue igual
function hash(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Lo fuerte que luce un aplique en el instante t (0 = apagado, 1 = a tope)
export function brilloAplique(d, t) {
  if (!d.parpadea) return 0.97 + 0.03 * Math.sin(t * 2 + d.seed * 40);
  // casi siempre, un temblor suave...
  const base = 0.88 + 0.07 * Math.sin(t * 6.3 + d.seed * 20) + 0.05 * Math.sin(t * 15.7 + d.seed * 50);
  // ...y de vez en cuando falla: el tiempo se parte en tramos de 3,5 s y en algunos hay un fallo
  const tramo = Math.floor(t / 3.5 + d.seed * 7), dentro = (t / 3.5 + d.seed * 7 - tramo) * 3.5;
  const suerte = hash(tramo, d.seed * 100);
  if (suerte < 0.45) return base;                       // este tramo, sin fallo
  const inicio = hash(tramo + 0.5, d.seed) * 2.4;       // cuándo empieza el fallo dentro del tramo
  const dt = dentro - inicio;
  if (suerte > 0.85) {
    // apagón: se va medio segundo y vuelve con un par de chispazos
    if (dt >= 0 && dt < 0.5) return 0.05;
    if (dt >= 0.5 && dt < 0.75) return Math.floor(dt * 20) % 2 ? base : 0.2;
    return base;
  }
  // cortes rápidos: dos o tres guiños
  if (dt >= 0 && dt < 0.3) return Math.floor(dt * 22) % 2 ? base : 0.25;
  return base;
}

// Las luces de una sala: [{ x, y, r, fuerza }] en unidades del juego
function lucesDe(room, t) {
  const l = room.layout;
  if (!l._apliques) l._apliques = (l.wallDecor || []).filter((d) => d.kind === 'aplique');
  return l._apliques;
}

// Lo oscura que está cada clase de sala (0 = nada): el pasillo, en penumbra; los apartamentos, un poco menos
const OSCURIDAD_SALA = { corridor: OSCURIDAD, apartment: 0.36, miniboss: 0.36 };
export function oscuridadDe(room) {
  return (room && OSCURIDAD_SALA[room.type]) || 0;
}

// Destellos cortos (fogonazos de los disparos, explosiones): se apuntan aquí y se apagan solos con el tiempo.
// No forman parte de la partida (nada del juego los lee), solo del dibujo.
const destellos = [];
export function destello(game, x, y, r, vida, fuerza = 1) {
  if (destellos.length < 40) destellos.push({ x, y, r, t0: game.time, vida, fuerza });
}
// Cuánto luce un destello ahora (0 si ya se apagó): sale de golpe y se apaga deprisa
function brilloDestello(d, t) {
  const k = (t - d.t0) / d.vida;
  return k < 0 || k >= 1 ? 0 : d.fuerza * (1 - k) * (1 - k);
}

// Cuánto luce el fuego del suelo: tiembla siempre y se apaga en su último segundo
function brilloFuego(hz, t) {
  return Math.min(1, hz.life) * (0.82 + 0.1 * Math.sin(t * 11 + hz.seed * 7) + 0.08 * Math.sin(t * 23.7 + hz.seed * 3));
}

const BLANCO = '255, 255, 255';
const COLOR_FOGONAZO = '255, 210, 130';
const COLOR_FUEGO = '255, 120, 40';

// Recorre todas las luces que se ven y llama a `pinta(x, y, r0, r, color, fuerza)` por cada una, dos veces por
// fotograma: para borrar la penumbra (`hueco`) y para el tinte cálido. Así no hace falta montar ninguna lista.
function cadaLuz(game, camX, camY, vw, vh, hueco, pinta) {
  const t = game.time, x0 = camX - 260, x1 = camX + vw + 260, y0 = camY - 260, y1 = camY + vh + 260;
  const dentro = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  // apliques del pasillo
  for (const d of lucesDe(game.room, t)) {
    if (!dentro(d.x, WALL)) continue;
    const b = brilloAplique(d, t);
    if (hueco) {
      pinta(d.x, WALL + 60, 40, 210, BLANCO, b);       // el charco de luz en el suelo
      pinta(d.x, WALL - 30, 6, 70, BLANCO, 0.9 * b);   // la pared alrededor del aplique
    } else {
      pinta(d.x, WALL + 50, 0, 190, COLOR_CALIDO, 0.18 * b);
      pinta(d.x, WALL - 34, 0, 34, COLOR_CALIDO, 0.35 * b); // el resplandor de la propia bombilla
    }
  }
  // fuego del molotov en el suelo
  for (const hz of game.hazards || []) {
    if (hz.kind !== 'fire' || !dentro(hz.x, hz.y)) continue;
    const b = brilloFuego(hz, t);
    if (hueco) pinta(hz.x, hz.y - 10, hz.r * 0.6, hz.r * 3, BLANCO, b);
    else pinta(hz.x, hz.y - 10, 0, hz.r * 2.4, COLOR_FUEGO, 0.32 * b);
  }
  // zombis ardiendo: una llamita que va con ellos
  for (const e of game.enemies || []) {
    if (!(e.burnT > 0) || !dentro(e.x, e.y)) continue;
    const b = Math.min(1, e.burnT) * (0.8 + 0.2 * Math.sin(t * 13 + e.x * 0.05));
    if (hueco) pinta(e.x, e.y, 10, 90, BLANCO, 0.75 * b);
    else pinta(e.x, e.y, 0, 70, COLOR_FUEGO, 0.25 * b);
  }
  // fogonazos y explosiones
  for (const d of destellos) {
    const b = brilloDestello(d, t);
    if (b <= 0 || !dentro(d.x, d.y)) continue;
    if (hueco) pinta(d.x, d.y, d.r * 0.2, d.r, BLANCO, b);
    else pinta(d.x, d.y, 0, d.r * 0.8, COLOR_FOGONAZO, 0.45 * b);
  }
}

// Quita de la lista los destellos ya apagados (sin crear listas nuevas)
function limpiaDestellos(t) {
  let n = 0;
  for (const d of destellos) if (t >= d.t0 && t < d.t0 + d.vida) destellos[n++] = d;
  destellos.length = n;
}

// Dibuja la penumbra y las luces. `ctx` ya tiene la transformación del mundo; (camX, camY, vw, vh) es lo que se
// ve; `nivel` es lo oscura que está la sala (entra o se va poco a poco al pasar de una sala a otra).
export function drawLuz(ctx, game, camX, camY, vw, vh, nivel) {
  limpiaDestellos(game.time);
  ctx.save();
  if (nivel > 0.01) {
    // 1) la penumbra, con agujeros donde hay luz
    const cw = Math.ceil(vw / LUZ_PASO) + 2, ch = Math.ceil(vh / LUZ_PASO) + 2;
    if (capa.width !== cw || capa.height !== ch) { capa.width = cw; capa.height = ch; }
    const g = capaCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = `rgba(${COLOR_SOMBRA}, ${nivel})`;
    g.fillRect(0, 0, cw, ch);
    g.setTransform(1 / LUZ_PASO, 0, 0, 1 / LUZ_PASO, -camX / LUZ_PASO, -camY / LUZ_PASO);
    g.globalCompositeOperation = 'destination-out';
    cadaLuz(game, camX, camY, vw, vh, true, (x, y, r0, r, rgb, a) => glow(g, x, y, r0, r, rgb, a));
    // Johnny siempre se distingue un poco, aunque esté lejos de las luces
    const p = game.player;
    if (p && !p.dead) glow(g, p.x, p.y, 10, 110, BLANCO, 0.3);
    g.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(capa, camX, camY, cw * LUZ_PASO, ch * LUZ_PASO);
  }
  // 2) el tinte cálido de cada luz, sumado encima (también en las salas sin penumbra, más flojo)
  const k = Math.max(0.5, nivel / OSCURIDAD);
  ctx.globalCompositeOperation = 'lighter';
  cadaLuz(game, camX, camY, vw, vh, false, (x, y, r0, r, rgb, a) => glow(ctx, x, y, r0, r, rgb, a * k));
  ctx.restore();
}
