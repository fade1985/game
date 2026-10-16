// ─────────────────────────────────────────────
//  Mando (Xbox, PlayStation y la mayoría de mandos genéricos)
//
//  El navegador ya sabe leer los mandos: en cada fotograma se pregunta qué botones están pulsados y
//  dónde están los sticks. Con la distribución "estándar" (la de Xbox) los números son siempre los mismos:
//    botones: 0 A (✕) · 1 B (○) · 5 RB (R1) · 7 RT (R2) · 9 Start (Options) · 12-15 cruceta
//    sticks:  0-1 el izquierdo · 2-3 el derecho
//
//  En la partida: stick izquierdo o cruceta para moverse, A para esquivar, RT o RB mantenido para apuntar
//  el molotov con el stick derecho (se lanza al soltar), X para recargar, Y para cambiar de arma y Start para la pausa.
//  En los menús: cruceta o stick para ir de botón en botón, A para pulsarlo y B para volver.
// ─────────────────────────────────────────────
import { pad, pressDash, pressReload, pressSwitch, startToss, endToss, aimToss } from './input.js';

const DEAD = 0.25;       // zona muerta de los sticks: por debajo de esto, como si no se tocaran
const REPEAT = [0.4, 0.16]; // en los menús, al mantener una dirección: espera antes de repetir y cada cuánto

const BTN = { A: 0, B: 1, X: 2, Y: 3, RB: 5, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

let before = [];          // botones pulsados en el fotograma anterior (para saber cuándo se acaba de pulsar)
let menuDir = null, menuT = 0;
let focused = null, focusedIdx = 0, shownFor = null;
let used = false;         // ya se ha tocado el mando (desde entonces se marca el botón elegido en los menús)

// Lee el primer mando conectado; null si no hay ninguno
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) if (g && g.connected) return g;
  return null;
}

// Stick con zona muerta: devuelve {x, y} de -1 a 1 (0 si apenas se toca)
function stick(g, ax, ay) {
  const x = g.axes[ax] || 0, y = g.axes[ay] || 0;
  const l = Math.hypot(x, y);
  if (l < DEAD) return { x: 0, y: 0 };
  // se reescala para que justo pasada la zona muerta empiece en 0 (si no, da un saltito)
  const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l;
  return { x: x * k, y: y * k };
}

// Se llama en cada fotograma desde main.js
export function updatePad(game, overlay, dt) {
  const g = readPad();
  pad.x = 0; pad.y = 0;
  if (!g) { before = []; return; }
  const down = g.buttons.map((b) => b.pressed || b.value > 0.4);
  const prev = before;
  const hit = (i) => down[i] && !prev[i];      // se acaba de pulsar
  const wasUp = (i) => !down[i] && prev[i];    // se acaba de soltar
  before = down;
  if (down.some(Boolean) || g.axes.some((a) => Math.abs(a) > 0.5)) used = true;

  const menuOpen = !overlay.hidden;
  if (menuOpen) {
    endToss('pad');
    navigateMenu(g, down, hit, overlay, dt);
    return;
  }
  shownFor = null;
  if (game.state !== 'playing') return;

  // moverse: stick izquierdo o cruceta
  const m = stick(g, 0, 1);
  pad.x = m.x + (down[BTN.RIGHT] ? 1 : 0) - (down[BTN.LEFT] ? 1 : 0);
  pad.y = m.y + (down[BTN.DOWN] ? 1 : 0) - (down[BTN.UP] ? 1 : 0);

  if (hit(BTN.A)) pressDash();
  if (hit(BTN.X)) pressReload();
  if (hit(BTN.Y)) pressSwitch();
  if (hit(BTN.START)) game.openPause();

  // molotov: mientras se mantiene el gatillo se apunta con el stick derecho; al soltarlo, se lanza
  // (si se suelta el stick antes que el gatillo, se queda la última dirección)
  if (hit(BTN.RT) || hit(BTN.RB)) startToss('pad');
  const a = stick(g, 2, 3);
  if (Math.hypot(a.x, a.y) > 0) aimToss(a.x, a.y);
  if ((wasUp(BTN.RT) || wasUp(BTN.RB)) && !down[BTN.RT] && !down[BTN.RB]) endToss('pad');
}

// ═════════════ Menús ═════════════

// Los botones que se pueden elegir en la pantalla que está abierta
function choices(overlay) {
  return [...overlay.querySelectorAll('button:not([disabled])')].filter((el) => el.offsetParent !== null);
}

function setFocus(el, list) {
  if (focused) focused.classList.remove('pad-focus');
  focused = el;
  if (!el) return;
  focusedIdx = list.indexOf(el);
  if (used) el.classList.add('pad-focus');
  el.scrollIntoView({ block: 'nearest' });
}

function navigateMenu(g, down, hit, overlay, dt) {
  const list = choices(overlay);
  if (!list.length) { setFocus(null); return; }
  // pantalla nueva (o el botón elegido ha desaparecido): se elige el principal, el amarillo
  if (shownFor !== overlay.firstElementChild || !focused || !focused.isConnected || !list.includes(focused)) {
    const same = shownFor === overlay.firstElementChild;
    shownFor = overlay.firstElementChild;
    // si es la misma pantalla redibujada (por ejemplo, al comprar en el Taller), se queda en el mismo sitio
    const keep = same ? list[Math.min(focusedIdx, list.length - 1)] : null;
    setFocus(keep || overlay.querySelector('button.yellow:not([disabled])') || list[0], list);
  }
  if (used && focused && !focused.classList.contains('pad-focus')) focused.classList.add('pad-focus');

  // dirección: cruceta o stick izquierdo, con repetición si se mantiene
  const s = stick(g, 0, 1);
  const dir = down[BTN.UP] || s.y < -0.5 ? 'up' : down[BTN.DOWN] || s.y > 0.5 ? 'down'
    : down[BTN.LEFT] || s.x < -0.5 ? 'left' : down[BTN.RIGHT] || s.x > 0.5 ? 'right' : null;
  if (dir !== menuDir) { menuDir = dir; menuT = REPEAT[0]; if (dir) move(dir, list); }
  else if (dir) {
    menuT -= dt;
    if (menuT <= 0) { menuT = REPEAT[1]; move(dir, list); }
  }

  if (hit(BTN.A) && focused) focused.click();
  // B vuelve atrás y Start cierra la pausa: hacen lo mismo que la tecla Esc en cada pantalla
  if (hit(BTN.B) || hit(BTN.START)) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
}

// Pasa al botón más cercano en esa dirección (mirando dónde está cada uno en la pantalla)
function move(dir, list) {
  if (!focused) return;
  const c = center(focused);
  const [ux, uy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === focused) continue;
    const o = center(el);
    const dx = o.x - c.x, dy = o.y - c.y;
    const along = dx * ux + dy * uy;           // cuánto avanza en esa dirección
    if (along <= 4) continue;
    const across = Math.abs(dx * uy - dy * ux); // cuánto se desvía hacia un lado
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) setFocus(best, list);
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
