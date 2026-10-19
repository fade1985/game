// ─────────────────────────────────────────────
//  Árbol de talentos: dos ramas (Militar y Superviviente) con tres niveles cada una
//
//  Los puntos de talento se compran con dólares en el ordenador de la sala de mantenimiento
//  ("Compra de puntos e intercambio", ordenador.js) y se gastan aquí, de uno en uno: cada punto sube un
//  nivel del talento. Lo comprado es para siempre (se guarda en save.talentos).
//
//  Solo se pueden cambiar los dólares ahorrados: los de la partida en curso no cuentan hasta que
//  completas el edificio (si te matan, se pierden).
//
//  Para tocar un talento basta con cambiar su línea en TALENTOS: `max` es cuántos puntos admite,
//  `pide` el talento que hay que tener al máximo antes, y `aplica(s, n)` lo que hace con n puntos sobre
//  los atributos de Johnny (upgrades.js, baseStats). Lo que no es un número (esquivar solo, el escudo,
//  resucitar...) lo lee el juego de esos atributos: entities.js (hurt), game.js y game-combate.js.
// ─────────────────────────────────────────────
import { updateSave } from './save.js';

export const PRECIO_PUNTO = 10; // dólares que cuesta cada punto de talento (provisional)

// Fabricante: lo que mejoran los explosivos (provisional)
export const FABRICANTE = { radio: 1.3, duracion: 1.5 };

export const RAMAS = [
  { id: 'militar', nombre: 'Militar', icono: 'militar' },
  { id: 'superviviente', nombre: 'Superviviente', icono: 'medico' },
];

export const TALENTOS = [
  // ── Militar
  { id: 'ataque',      rama: 'militar', nivel: 1, nombre: 'Ataque',      max: 5, icono: 'fuerza',
    desc: '+10 % de daño por punto', aplica: (s, n) => { s.damage *= 1 + 0.1 * n; } },
  { id: 'punteria',    rama: 'militar', nivel: 1, nombre: 'Puntería',    max: 5, icono: 'diana',
    desc: '+10 % de daño del molotov y la granada por punto', aplica: (s, n) => { s.throwDamage *= 1 + 0.1 * n; } },
  { id: 'camorrista',  rama: 'militar', nivel: 2, nombre: 'Camorrista',  max: 5, icono: 'bate', pide: 'ataque',
    desc: '+10 % de daño cuerpo a cuerpo por punto', aplica: (s, n) => { s.meleeDamage *= 1 + 0.1 * n; } },
  { id: 'tirador',     rama: 'militar', nivel: 2, nombre: 'Tirador',     max: 5, icono: 'pistola', pide: 'ataque',
    desc: '+10 % de daño con armas de fuego por punto', aplica: (s, n) => { s.rangedDamage *= 1 + 0.1 * n; } },
  { id: 'artificiero', rama: 'militar', nivel: 2, nombre: 'Artificiero', max: 3, icono: 'molotov', pide: 'punteria',
    desc: '+1 molotov y +1 granada por punto (al empezar y en la mochila)', aplica: (s, n) => { s.extraThrow += n; } },
  { id: 'larguirucho', rama: 'militar', nivel: 3, nombre: 'Larguirucho', max: 1, icono: 'guantes', pide: 'camorrista',
    desc: 'Duplica el alcance cuerpo a cuerpo', aplica: (s) => { s.meleeRange *= 2; } },
  { id: 'mirilla',     rama: 'militar', nivel: 3, nombre: 'Mirilla',     max: 1, icono: 'escopeta', pide: 'tirador',
    desc: 'Cada 3 disparos, el siguiente es un crítico seguro', aplica: (s) => { s.mirilla = true; } },
  { id: 'fabricante',  rama: 'militar', nivel: 3, nombre: 'Fabricante',  max: 1, icono: 'granada', pide: 'artificiero',
    desc: 'Explosivos de mejor calidad: fuego y explosiones más grandes, y el fuego dura más', aplica: (s) => { s.fabricante = true; } },
  // ── Superviviente
  { id: 'corpulento',  rama: 'superviviente', nivel: 1, nombre: 'Corpulento',   max: 5, icono: 'vida',
    desc: '+10 % de vida máxima por punto', aplica: (s, n) => { s.maxHp *= 1 + 0.1 * n; } },
  { id: 'lobezno',     rama: 'superviviente', nivel: 1, nombre: 'Lobezno',      max: 5, icono: 'corazon',
    desc: 'Regeneras 1 de vida cada 3 segundos por punto', aplica: (s, n) => { s.regen += n; } },
  { id: 'durito',      rama: 'superviviente', nivel: 2, nombre: 'Durito',       max: 5, icono: 'casco', pide: 'corpulento',
    desc: 'Cada golpe que recibes quita 1 menos por punto', aplica: (s, n) => { s.armor += n; } },
  { id: 'reflejos',    rama: 'superviviente', nivel: 2, nombre: 'Reflejos',     max: 5, icono: 'reflejos', pide: 'corpulento',
    desc: 'Esquivas solo un golpe cada 10 s (1 s menos por cada punto más)', aplica: (s, n) => { s.autoDodge = 11 - n; } },
  { id: 'sanitario',   rama: 'superviviente', nivel: 2, nombre: 'Sanitario',    max: 5, icono: 'botiquin', pide: 'lobezno',
    desc: 'Los botiquines curan 10 más por punto', aplica: (s, n) => { s.medkitBonus += 10 * n; } },
  { id: 'acero',       rama: 'superviviente', nivel: 3, nombre: 'Acero',        max: 1, icono: 'cartucho', pide: 'durito',
    desc: 'Empiezas cada planta con un escudo de 50: mientras dure, para la mitad de cada golpe', aplica: (s) => { s.shield = 50; } },
  { id: 'ninja',       rama: 'superviviente', nivel: 3, nombre: 'Ninja',        max: 1, icono: 'dash', pide: 'reflejos',
    desc: 'Al acabar una esquiva, golpe en área que mata a los zombis (a los jefes les quita un 10 %)', aplica: (s) => { s.ninja = true; } },
  { id: 'desfibrilador', rama: 'superviviente', nivel: 3, nombre: 'Desfibrilador', max: 1, icono: 'medico', pide: 'sanitario',
    desc: 'Una vez por edificio, si caes, resucitas con toda la vida', aplica: (s) => { s.revive = true; } },
];

export const talento = (id) => TALENTOS.find((t) => t.id === id);

// Puntos puestos en un talento
export const nivelDe = (save, id) => Math.min(save.talentos[id] || 0, talento(id).max);

// ¿Se le puede poner un punto más? Devuelve el motivo si no: 'max', 'bloqueado' o 'sin-puntos'
export function puedeSubir(save, id) {
  const t = talento(id);
  if (nivelDe(save, id) >= t.max) return 'max';
  if (t.pide && nivelDe(save, t.pide) < talento(t.pide).max) return 'bloqueado';
  if (save.puntos < 1) return 'sin-puntos';
  return null;
}

// Aplica los talentos comprados a los atributos de Johnny (al empezar un edificio y al comprar uno)
export function aplicarTalentos(stats, talentos = {}) {
  for (const t of TALENTOS) {
    const n = Math.min(talentos[t.id] || 0, t.max);
    if (n) t.aplica(stats, n);
  }
  return stats;
}

// Cuántos puntos se pueden comprar con esos dólares
export const puntosAlcanzables = (dolares) => Math.floor(dolares / PRECIO_PUNTO);

// Compra `n` puntos con los dólares ahorrados. Devuelve el guardado nuevo, o null si no llega el dinero.
export function comprarPuntos(n) {
  let ok = false;
  const save = updateSave((s) => {
    const precio = n * PRECIO_PUNTO;
    if (n < 1 || s.keys < precio) return;
    s.keys -= precio;
    s.puntos += n;
    ok = true;
  });
  return ok ? save : null;
}

// Pone un punto en un talento. Devuelve el guardado nuevo, o null si no se puede.
export function subirTalento(id) {
  let ok = false;
  const save = updateSave((s) => {
    if (puedeSubir(s, id)) return;
    s.puntos -= 1;
    s.talentos[id] = nivelDe(s, id) + 1;
    ok = true;
  });
  return ok ? save : null;
}
