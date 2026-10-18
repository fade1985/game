// ─────────────────────────────────────────────
//  Controles: teclado + joystick táctil (+ mando, que lee mando.js y deja aquí lo que pulsa)
// ─────────────────────────────────────────────
const keys = new Set();
// Lo que hace el mando en la partida (lo rellena mando.js en cada fotograma)
export const pad = { x: 0, y: 0 };
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
let dashPressed = false;
let reloadPressed = false;   // recargar: R, botón X del mando o tocar el cartel del arma
let tossSwitchPressed = false; // cambiar lo que se lanza (molotov ↔ granada): F, LB del mando o el botoncito del móvil
let switchPressed = false;   // cambiar de arma: Q, rueda del ratón, botón Y del mando o tocar el otro cartel
// Lanzar (molotov): se mantiene pulsado para apuntar y se suelta para lanzar
//  - PC: clic derecho o E; se apunta con el ratón
//  - móvil: se arrastra desde el botón de lanzar (como un segundo joystick) y se suelta
const mouse = { x: 0, y: 0, seen: false };       // posición del ratón, en píxeles del lienzo
const toss = { aiming: false, by: null, released: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
export const TOSS_DRAG = 70;                     // cuánto hay que arrastrar en el móvil para el alcance máximo

export function initInput(canvas, touchUI) {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft') { dashPressed = true; e.preventDefault(); }
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (e.code === 'KeyE' && !e.repeat) startToss('mouse');
    if (e.code === 'KeyR' && !e.repeat) reloadPressed = true;
    if (e.code === 'KeyQ' && !e.repeat) switchPressed = true;
    if (e.code === 'KeyF' && !e.repeat) tossSwitchPressed = true;
  });
  // la rueda del ratón también cambia de arma (una vez por "golpe" de rueda, no por cada paso)
  let wheelT = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - wheelT > 250) switchPressed = true;
    wheelT = now;
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'KeyE') endToss('mouse');
  });
  window.addEventListener('blur', () => { keys.clear(); toss.aiming = false; });

  // Ratón: dónde está (para apuntar) y el clic derecho para lanzar
  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    mouse.seen = true;
  };
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') toCanvas(e); });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 2) return;
    toCanvas(e);
    startToss('mouse');
  });
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 2) endToss('mouse'); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // sin el menú del clic derecho

  // Joystick virtual: toca en cualquier parte del lado izquierdo y arrastra
  const base = touchUI.querySelector('.joy-base');
  const knob = touchUI.querySelector('.joy-knob');
  const RADIUS = 50;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || joy.active) return;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX - rect.left > rect.width * 0.6) return;
    joy.active = true; joy.id = e.pointerId;
    joy.ox = e.clientX; joy.oy = e.clientY; joy.x = 0; joy.y = 0;
    base.style.left = `${e.clientX - rect.left}px`;
    base.style.top = `${e.clientY - rect.top}px`;
    base.hidden = false;
    knob.style.transform = 'translate(-50%, -50%)';
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    joy.x = dx / RADIUS; joy.y = dy / RADIUS;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const end = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
    base.hidden = true;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  touchUI.querySelector('.dash-btn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dashPressed = true;
  });

  // Botón de lanzar (móvil): al tocarlo empieza a apuntar; arrastrando se elige hacia dónde y a qué
  // distancia; al soltar, lanza
  const tossBtn = touchUI.querySelector('.toss-btn');
  tossBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = tossBtn.getBoundingClientRect();
    startToss('touch');
    toss.id = e.pointerId;
    toss.ox = r.left + r.width / 2; toss.oy = r.top + r.height / 2;
    tossBtn.setPointerCapture(e.pointerId);
  });
  tossBtn.addEventListener('pointermove', (e) => {
    if (toss.by !== 'touch' || e.pointerId !== toss.id) return;
    let dx = (e.clientX - toss.ox) / TOSS_DRAG, dy = (e.clientY - toss.oy) / TOSS_DRAG;
    const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
    toss.dx = dx; toss.dy = dy;
  });
  const endTouch = (e) => { if (e.pointerId === toss.id) endToss('touch'); };
  tossBtn.addEventListener('pointerup', endTouch);
  tossBtn.addEventListener('pointercancel', (e) => { if (e.pointerId === toss.id) toss.aiming = false; });
}

export function startToss(by) {
  if (toss.aiming) return;
  Object.assign(toss, { aiming: true, by, released: false, dx: 0, dy: 0 });
}

export function endToss(by) {
  if (!toss.aiming || toss.by !== by) return;
  toss.aiming = false;
  toss.released = true;
}

// Hacia dónde apunta el mando (stick derecho, de -1 a 1), mientras se mantiene el gatillo
export function aimToss(dx, dy) {
  if (toss.by !== 'pad') return;
  toss.dx = dx; toss.dy = dy;
}

// Esquivar, recargar y cambiar de arma desde fuera (el mando y los carteles del HUD)
export function pressDash() { dashPressed = true; }
export function pressReload() { reloadPressed = true; }
export function pressSwitch() { switchPressed = true; }
export function pressTossSwitch() { tossSwitchPressed = true; }

// Cómo va el lanzamiento: si se está apuntando, si se acaba de soltar (una sola vez por lanzamiento) y
// hacia dónde: con el ratón, su posición en el lienzo; en el móvil o con el mando, el arrastre o el stick (de -1 a 1)
export function getToss() {
  const released = toss.released;
  toss.released = false;
  return { aiming: toss.aiming, released, by: toss.by, mouse, dx: toss.dx, dy: toss.dy };
}

// Devuelve la dirección de movimiento normalizada {x, y}
export function getMoveVector() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (joy.active) { x += joy.x; y += joy.y; }
  x += pad.x; y += pad.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  if (len < 0.15) return { x: 0, y: 0 };
  return { x, y };
}

// Devuelve true una sola vez por cada pulsación de "esquivar"
export function consumeDash() {
  const d = dashPressed;
  dashPressed = false;
  return d;
}

// Devuelven true una sola vez por cada pulsación de "recargar" y de "cambiar de arma"
export function consumeReload() { const r = reloadPressed; reloadPressed = false; return r; }
export function consumeTossSwitch() { const r = tossSwitchPressed; tossSwitchPressed = false; return r; }
export function consumeSwitch() { const r = switchPressed; switchPressed = false; return r; }

export function clearInput() {
  keys.clear();
  dashPressed = false;
  reloadPressed = false;
  switchPressed = false;
  tossSwitchPressed = false;
  toss.aiming = false;
  toss.released = false;
}
