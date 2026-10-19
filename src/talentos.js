// ─────────────────────────────────────────────
//  Puntos de talento: se compran con dólares en el ordenador de la sala de mantenimiento
//  ("Compra de puntos e intercambio", ordenador.js) y se gastan en el árbol de talentos.
//
//  Solo se pueden cambiar los dólares ahorrados: los de la partida en curso no cuentan hasta que
//  completas el edificio (si te matan, se pierden).
//  El árbol (ramas Militar y Superviviente) llega en la fase C.
// ─────────────────────────────────────────────
import { updateSave } from './save.js';

export const PRECIO_PUNTO = 10; // dólares que cuesta cada punto de talento (provisional)

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
