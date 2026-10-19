// ─────────────────────────────────────────────
//  Objetos para crear armas (fase A del plan de combinar: claude/plan-combinar.md)
//
//  Los sueltan los zombis al morir y Johnny los lleva en la MOCHILA (casillas en MOCHILA). Al completar el
//  edificio pasan al baúl (save.js, `baul`); si muere, se pierden. Todos son de rareza gris (común).
//  De momento se dibujan a mano: cada uno es un dibujito de 10×10 píxeles (una letra = un color).
// ─────────────────────────────────────────────
import { PIXEL } from './config.js';

export const MOCHILA = 8;          // casillas de la mochila
export const OBJETO_DROP = 0.10;   // probabilidad de que un zombi suelte un objeto (provisional)
export const EXPLOSIVO_DROP = 0.25; // ...los explosivos, solo los zombis explosivos (provisional)

// Colores de los dibujos (el punto es hueco)
const PALETA = {
  o: '#2a1f2e', k: '#1a1a1a', g: '#9aa0a8', G: '#d0d4da', d: '#5d6470', r: '#d0453a', R: '#8a2a2a',
  y: '#f2c94c', Y: '#b88a1e', b: '#4a7bd0', w: '#f1f1e6', m: '#8a5a34', M: '#5c3a20', v: '#5aa05a',
  n: '#ff9f1c', p: '#e07be0',
};

export const OBJETOS = {
  clavos: { nombre: 'Clavos', dibujo: [
    '..........', '.oo..oo...', '.Go..Go...', '..g...g...', '..g...g.oo',
    '..g...g.Go', '..g...g..g', '..d...d..g', '.........g', '.........d'] },
  gasolina: { nombre: 'Gasolina', dibujo: [
    '...oooo...', '...odoo...', '.oooooooo.', '.orrrrrro.', '.orRRRRro.',
    '.orRwwRro.', '.orRwwRro.', '.orRRRRro.', '.orrrrrro.', '.oooooooo.'] },
  cuchillas: { nombre: 'Cuchillas', dibujo: [
    '...o.o....', '..oGGGo...', '.oGgggGo..', 'oGgg.ggGo.', '.Ggo.ogG..',
    'oGgg.ggGo.', '.oGgggGo..', '..oGGGo...', '...o.o....', '..........'] },
  pistolaAgua: { nombre: 'Pistola de agua', dibujo: [
    '..........', '.ooooooo..', 'onnnnnnnoo', 'onvvvvvnbo', 'onnnnnnnoo',
    '.oonno....', '...onno...', '...onno...', '...oooo...', '..........'] },
  spray: { nombre: 'Spray de pintura', dibujo: [
    '...oo.....', '..oko.....', '.oooooo...', '.oGGGGo...', '.oppppo...',
    '.oppppo...', '.owwwwo...', '.oppppo...', '.oppppo...', '.oooooo...'] },
  mechero: { nombre: 'Mechero', dibujo: [
    '....n.....', '...nyn....', '....o.....', '..oooo....', '..oGGo....',
    '..obbo....', '..obbo....', '..obbo....', '..obbo....', '..oooo....'] },
  lejia: { nombre: 'Lejía', dibujo: [
    '...oooo...', '...obbo...', '..oowwoo..', '.owwwwwwo.', '.owbbbbwo.',
    '.owbwwbwo.', '.owbbbbwo.', '.owwwwwwo.', '.owwwwwwo.', '.oooooooo.'] },
  alcohol: { nombre: 'Botella de alcohol', dibujo: [
    '....oo....', '....oo....', '...ovvo...', '...ovvo...', '..ovvvvo..',
    '..ovGvvo..', '..owwwwo..', '..owRRwo..', '..ovvvvo..', '..oooooo..'] },
  trapo: { nombre: 'Trapo', dibujo: [
    '..........', '..........', '.oooooo...', '.owwwwwoo.', '.owGwwwwo.',
    '.owwwGwwo.', 'oowwwwwwo.', 'owwwGwwoo.', 'oooooooo..', '..........'] },
  explosivos: { nombre: 'Explosivos', dibujo: [
    '.......n..', '......y...', '.....o....', '.oooooooo.', '.orrkrrko.',
    '.orrkrrko.', '.oRRkRRko.', '.oooooooo.', '..........', '..........'] },
  despertador: { nombre: 'Despertador', dibujo: [
    '.o......o.', 'oyo.oo.oyo', '.oowwwwoo.', '.owwkwwwo.', 'owwwkwwwwo',
    'owwwkkkwwo', 'owwwwwwwwo', '.owwwwwwo.', '..oooooo..', '.o......o.'] },
  extintor: { nombre: 'Extintor', dibujo: [
    '...ooo....', '..okkoo...', '..oo.ko...', '.orrro.o..', '.orRro....',
    '.orwro....', '.orrro....', '.orRro....', '.orrro....', '.ooooo....'] },
  taser: { nombre: 'Táser', dibujo: [
    '..y..y....', '..o..o....', '.oooooo...', '.okkkkko..', '.okyykko..',
    '.okkkkko..', '..okko....', '..okko....', '..okko....', '..oooo....'] },
  llaveInglesa: { nombre: 'Llave inglesa', dibujo: [
    '.oo..oo...', '.oGooGo...', '.oGGGGo...', '..oGGo....', '...oGo....',
    '...ogo....', '...ogo....', '...ogo....', '...odo....', '...ooo....'] },
  hacha: { nombre: 'Hacha', dibujo: [
    '..ooooo...', '.oGGGGGo..', 'oGGgggmo..', 'oGggggmo..', '.oGggomo..',
    '..ooo.mo..', '.....omo..', '.....omo..', '.....oMo..', '.....ooo..'] },
  cuerda: { nombre: 'Cuerda', dibujo: [
    '..........', '..oooooo..', '.oyYyYyYo.', 'oyYoooYyYo', 'oYyo..oYyo',
    'oyYo..oyYo', 'oYyYoooYyo', '.oyYyYyYo.', '..oooooo..', '..........'] },
  mancuernas: { nombre: 'Mancuernas', dibujo: [
    '..........', '.oo....oo.', 'okko..okko', 'okkooookko', 'okkGGGGkko',
    'okkooookko', 'okko..okko', '.oo....oo.', '..........', '..........'] },
};

// Qué objeto suelta un zombi al morir (o null): los explosivos solo los dejan los zombis explosivos
export function objetoQueSuelta(tipo) {
  if (tipo === 'explosivo') return Math.random() < EXPLOSIVO_DROP ? 'explosivos' : null;
  return Math.random() < OBJETO_DROP ? objetoAlAzar() : null;
}

// Un objeto cualquiera, menos los explosivos
export function objetoAlAzar() {
  const ids = Object.keys(OBJETOS).filter((id) => id !== 'explosivos');
  return ids[Math.floor(Math.random() * ids.length)];
}

// Dibuja el objeto centrado en (x, y); `u` = lo que mide cada píxel del dibujo
export function drawObjeto(ctx, id, x, y, u = PIXEL) {
  const filas = OBJETOS[id]?.dibujo;
  if (!filas) return;
  const x0 = Math.round(x - 5 * u), y0 = Math.round(y - 5 * u);
  filas.forEach((fila, j) => {
    for (let i = 0; i < fila.length; i++) {
      const c = PALETA[fila[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x0 + i * u, y0 + j * u, u, u);
    }
  });
}

// El mismo dibujo como imagen para los menús en HTML (se hace una vez por objeto y se guarda)
const iconos = {};
export function iconoObjeto(id) {
  if (!iconos[id]) {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    drawObjeto(c.getContext('2d'), id, 5, 5, 1);
    iconos[id] = c.toDataURL();
  }
  return iconos[id];
}
