// ─────────────────────────────────────────────
//  Controles: teclado + joystick táctil
// ─────────────────────────────────────────────
const keys = new Set();
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
let dashPressed = false;

export function initInput(canvas, touchUI) {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft') { dashPressed = true; e.preventDefault(); }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

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
}

// Devuelve la dirección de movimiento normalizada {x, y}
export function getMoveVector() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (joy.active) { x += joy.x; y += joy.y; }
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

export function clearInput() {
  keys.clear();
  dashPressed = false;
}
