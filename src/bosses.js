// ─────────────────────────────────────────────
//  Jefes de Apartamentos
//
//  · "La portera" (jefe-portera.js): mini jefa de cada planta y, de momento, también la jefa final.
//
//  Lo que comparten (su ficha, la base común, los avisos de ataque) está en jefe-base.js.
//  Un jefe nuevo: su archivo, su ficha en BOSS_TYPES y su caso en makeBoss.
// ─────────────────────────────────────────────
import { Portera } from './jefe-portera.js';

export { BOSS_TYPES } from './jefe-base.js';

// Las dos plantas de jefe tienen a la portera
export function makeBoss(type, x, y, hpMul = 1) {
  return new Portera(type, x, y, hpMul);
}
