// ─────────────────────────────────────────────
//  Estados: lo que te hace pisar un charco (o lo que te pegue un ataque)
//
//  Cada estado tiene la misma ficha. Lo que se lanza (el moco del gordo, la botella de lejía de la portera,
//  el molotov de Johnny...) elige uno o varios estados en su entrada de HAZARDS (game-ataques.js), y puede
//  cambiar algún número para él (por ejemplo, la lejía es tóxica pero flojita).
//
//    dps:      vida por segundo que quita mientras lo pisas (y al salir, si `despues` > 0)
//    despues:  segundos que te sigue durando al salir del charco (0 = se acaba al salir)
//    resbala:  de 0 (nada) a 1 (como hielo): cuánto cuesta frenar y girar
//    zombis:   si también les afecta a los zombis (a los jefes, de momento, no)
//    color:    el de los números que saltan y las gotitas
//
//  Pisándolo, el estado se renueva sin parar; al salir empieza la cuenta de `despues`.
//  La esquiva cruza cualquier charco sin que te pase nada (lo que ya llevabas encima sigue).
//  El fuego en los zombis lo lleva su propio sistema (zombies.js: burn), con los números de MOLOTOV.
// ─────────────────────────────────────────────
import { rand } from './utils.js';
import { FIRE } from './molotov.js';

export const ESTADOS = {
  toxico:      { dps: 6, despues: 0, zombis: true, color: '#c7e04a' },
  veneno:      { dps: 4, despues: 3, zombis: false, color: '#9be33b' },
  fuego:       { dps: 12, despues: 2, zombis: false, color: '#ff9f1c' },   // los zombis arden aparte (molotov.js)
  resbaladizo: { resbala: 0.8, despues: 0.4, zombis: true, color: '#7fd0ff' },
  acido:       { dps: 8, despues: 0, zombis: true, color: '#c7e04a' },       // el vómito de Gastroenteritis (mutaciones.js)
  gases:       { dps: 10, despues: 2, zombis: true, color: '#b5c94a' },      // los gases de Flatulento: se lo pone directamente
};

// Cada cuánto se reparte el daño de los estados a los zombis (a pellizcos, como el fuego)
const TICK_ZOMBI = 0.5;

// Lo que pisa este fotograma: { nombre: ficha }. Si pisa dos charcos con el mismo estado, cuenta el más fuerte
// (con `soloZombis`, solo los estados que les afectan a ellos)
export function pisar(pisando, estados, soloZombis = false) {
  for (const nombre in estados) {
    if (soloZombis && !ESTADOS[nombre].zombis) continue;
    const f = { ...ESTADOS[nombre], ...estados[nombre] };
    const ya = pisando[nombre];
    if (!ya || (f.dps || 0) > (ya.dps || 0) || (f.resbala || 0) > (ya.resbala || 0)) pisando[nombre] = f;
  }
}

// Una vez por fotograma para cada uno (Johnny o zombi): renueva lo que pisa, descuenta lo que le queda
// y devuelve el daño de este fotograma, para que cada uno lo reciba a su manera
export function actualizarEstados(ent, pisando, dt) {
  const est = ent.estados || (ent.estados = {});
  let dmg = 0, fuerte = 0;
  ent.colorEstado = null;   // el color del estado que más daño hace: el de los números que saltan
  for (const nombre in ESTADOS) {
    const f = pisando[nombre];
    if (f) {
      est[nombre] = { t: f.despues, max: f.despues, dps: f.dps || 0, resbala: f.resbala || 0, color: f.color };
      dmg += (f.dps || 0) * dt;
      if ((f.dps || 0) > fuerte) { fuerte = f.dps; ent.colorEstado = f.color; }
      continue;
    }
    const e = est[nombre];
    if (!e) continue;
    e.t -= dt;
    if (e.t <= 0) { delete est[nombre]; continue; }
    dmg += e.dps * dt;
    if (e.dps > fuerte) { fuerte = e.dps; ent.colorEstado = e.color; }
  }
  return dmg;
}

// Cuánto agarre le queda al andar (1 = normal, 0 = nada): se usa en la suavidad con que cambia de velocidad
export function agarre(ent) {
  const r = ent.estados?.resbaladizo;
  if (!r) return 1;
  // dentro, t = max (resbala del todo); al salir del charco se recupera poco a poco
  const k = r.max > 0 ? r.t / r.max : 1;
  return 1 - r.resbala * k;
}

// Daño de los estados a un zombi: se junta y se le da a pellizcos, sin el número blanco de cada golpe
export function herirZombi(e, dmg, dt, game) {
  if (dmg <= 0) { e.estadoTick = 0; return; }
  e.estadoAcc = (e.estadoAcc || 0) + dmg;
  e.estadoTick = (e.estadoTick || 0) + dt;
  if (e.estadoTick < TICK_ZOMBI) return;
  const d = e.estadoAcc;
  e.estadoAcc = 0; e.estadoTick = 0;
  game.floatText(e.x, e.y - 38 * (e.s || 1), String(Math.max(1, Math.round(d))), e.colorEstado || ESTADOS.toxico.color, 16);
  e.hurt(d, false, 0, 0, game, 0, true);
}

// Lo que se ve de cada estado encima de quien lo lleva (x, y = el centro; alto = lo que mide el cuerpo):
// gotitas verdes del veneno, llamas del fuego y salpicones en los pies al resbalar
export function efectosEstados(game, ent, dt, alto = 40) {
  const est = ent.estados;
  if (!est) return;
  if (est.veneno && Math.random() < 6 * dt) {
    game.particles.push({ x: ent.x + rand(-ent.r, ent.r) * 0.7, y: ent.y - rand(0, alto), vx: rand(-8, 8), vy: rand(30, 60), px: true, size: rand(2, 3), color: Math.random() < 0.5 ? ESTADOS.veneno.color : '#4f772d', life: rand(0.35, 0.6), max: 0.6 });
  }
  if (est.fuego && Math.random() < 30 * dt) {
    game.particles.push({ x: ent.x + rand(-ent.r, ent.r) * 0.6, y: ent.y + 10 - rand(0, alto), vx: rand(-18, 18), vy: rand(-130, -60), px: true, size: rand(2, 4), color: FIRE[Math.floor(rand(0, 4))], life: rand(0.25, 0.5), max: 0.5 });
  }
  const sp = Math.hypot(ent.vx || 0, ent.vy || 0);
  if (est.resbaladizo && sp > 60 && Math.random() < 10 * dt) {
    const a = Math.atan2(ent.vy, ent.vx) + Math.PI + rand(-0.8, 0.8);
    game.particles.push({ x: ent.x + rand(-6, 6), y: ent.y + ent.r * 0.8, vx: Math.cos(a) * rand(40, 90), vy: Math.sin(a) * rand(20, 50) - 30, px: true, size: rand(1, 3), color: Math.random() < 0.5 ? '#ffffff' : ESTADOS.resbaladizo.color, life: rand(0.25, 0.4), max: 0.4 });
  }
}

// Tinte del dibujo de quien lleva veneno o fuego: late suave (para drawSprite, opción `tint`)
export function tinteEstado(ent, t) {
  const est = ent.estados;
  if (!est) return null;
  const late = 0.5 + 0.5 * Math.sin(t * 6);
  if (est.fuego) return { color: '#ff7a1c', alpha: 0.25 + 0.2 * late, mode: 'source-atop' };
  if (est.veneno) return { color: '#7ddc3a', alpha: 0.25 + 0.2 * late, mode: 'source-atop' };
  return null;
}
