// ─────────────────────────────────────────────
//  Luz: una capa de penumbra encima de la partida con "agujeros" donde hay luz
//
//  Cómo funciona: en un lienzo pequeño (cada píxel = LUZ_PASO unidades del juego) se pinta la oscuridad y,
//  donde hay una luz, se borra un círculo con el borde suave. Ese lienzo se amplía con suavizado encima de
//  suelo y personajes. Luego se añade un tinte cálido muy flojo en cada luz, para que sea de bombilla.
//  Los círculos salen de `glow` (draw.js): el degradado se pinta una vez y luego solo se copia.
//  De momento solo en el pasillo; el fogonazo de los disparos y el molotov se añadirán como luces más.
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
  return l._apliques.map((d) => ({ d, x: d.x, b: brilloAplique(d, t) }));
}

// ¿Esta sala está en penumbra? (de momento, solo el pasillo)
export function salaOscura(room) {
  return !!room && room.type === 'corridor';
}

// Dibuja la penumbra y las luces. `ctx` ya tiene la transformación del mundo; (camX, camY, vw, vh) es lo que se
// ve; `fuerza` (0–1) deja entrar la penumbra poco a poco al pasar de una sala a otra.
export function drawLuz(ctx, game, camX, camY, vw, vh, fuerza) {
  if (fuerza <= 0.01) return;
  const t = game.time;
  const luces = lucesDe(game.room, t).filter((l) => l.x > camX - 200 && l.x < camX + vw + 200);

  // 1) la penumbra, con agujeros donde hay luz
  const cw = Math.ceil(vw / LUZ_PASO) + 2, ch = Math.ceil(vh / LUZ_PASO) + 2;
  if (capa.width !== cw || capa.height !== ch) { capa.width = cw; capa.height = ch; }
  const g = capaCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, cw, ch);
  g.fillStyle = `rgba(${COLOR_SOMBRA}, ${OSCURIDAD * fuerza})`;
  g.fillRect(0, 0, cw, ch);
  g.setTransform(1 / LUZ_PASO, 0, 0, 1 / LUZ_PASO, -camX / LUZ_PASO, -camY / LUZ_PASO);
  g.globalCompositeOperation = 'destination-out';
  for (const l of luces) {
    glow(g, l.x, WALL + 60, 40, 210, '255, 255, 255', l.b); // el charco de luz en el suelo
    glow(g, l.x, WALL - 30, 6, 70, '255, 255, 255', 0.9 * l.b);    // la pared alrededor del aplique
  }
  // Johnny siempre se distingue un poco, aunque esté lejos de las luces
  const p = game.player;
  if (p && !p.dead) glow(g, p.x, p.y, 10, 110, '255, 255, 255', 0.3);
  g.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(capa, camX, camY, cw * LUZ_PASO, ch * LUZ_PASO);

  // 2) el tinte cálido de cada bombilla, sumado encima
  ctx.globalCompositeOperation = 'lighter';
  for (const l of luces) {
    glow(ctx, l.x, WALL + 50, 0, 190, COLOR_CALIDO, 0.18 * l.b * fuerza);
    glow(ctx, l.x, WALL - 34, 0, 34, COLOR_CALIDO, 0.35 * l.b * fuerza); // el resplandor de la propia bombilla
  }
  ctx.restore();
}
