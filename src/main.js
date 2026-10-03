// ─────────────────────────────────────────────
//  Punto de entrada: crea el juego y arranca el bucle
// ─────────────────────────────────────────────
import { Game } from './game.js';
import { createUI } from './ui.js';
import { initInput } from './input.js';
import { unlockAudio } from './sfx.js';

const root = document.getElementById('game-wrap');
const canvas = document.getElementById('game');
const touchUI = document.getElementById('touch-ui');

if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

const ui = createUI(root);
const game = new Game(canvas, ui);
initInput(canvas, touchUI);

// El audio del navegador solo se puede activar tras una interacción del usuario
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// Pausa con Esc / P, y automáticamente al cambiar de pestaña
window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.uiHandled) game.openPause();
});
// Modo pruebas (?pruebas): las teclas 1-6 invocan cada tipo de zombi, 7 el mini jefe y 8 la jefa final
const TEST_ZOMBIES = ['lento', 'normal', 'rapido', 'explosivo', 'tentaculos', 'venenoso', 'miniboss', 'boss'];
window.addEventListener('keydown', (e) => {
  if (!game.testMode || game.state !== 'playing' || game.paused || e.uiHandled) return;
  const n = Number(e.key);
  if (n >= 1 && n <= TEST_ZOMBIES.length) {
    const pos = game.findSpawnPoint();
    game.spawnEnemy(TEST_ZOMBIES[n - 1], pos.x, pos.y);
  }
});
document.getElementById('btn-pause').addEventListener('click', (e) => { e.currentTarget.blur(); game.openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.openPause(); });

// Bucle principal: actualizar lógica y dibujar ~60 veces por segundo
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  touchUI.hidden = !(game.state === 'playing' && !game.paused);
  requestAnimationFrame(frame);
}

game.goMenu();
requestAnimationFrame(frame);

// Para depurar desde la consola del navegador: window.game
window.game = game;
