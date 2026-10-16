// ─────────────────────────────────────────────
//  Punto de entrada: crea el juego y arranca el bucle
// ─────────────────────────────────────────────
import { Game } from './game.js';
import { createUI } from './ui.js';
import { initInput, pressReload, pressSwitch } from './input.js';
import { updatePad } from './mando.js';
import { unlockAudio, setMusicOn, toggleMute } from './sfx.js';
import { loadSave } from './save.js';
import { loadSprites } from './sprites.js';

const root = document.getElementById('game-wrap');
const canvas = document.getElementById('game');
const touchUI = document.getElementById('touch-ui');
const overlay = document.getElementById('overlay');

if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

setMusicOn(loadSave().settings.music);
// Con ?mudo en la dirección el juego arranca sin sonido ni música (para probar sin molestar)
if (new URLSearchParams(location.search).has('mudo')) {
  toggleMute();
  document.getElementById('btn-mute').innerHTML = '<i class="ico ico-mudo"></i>';
}

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
// Carteles de las armas (sobre todo para el móvil): tocar la otra arma la saca; tocar la de fuego que
// ya está en la mano, recarga
for (const [id, slot] of [['pill-melee', 'melee'], ['pill-ranged', 'ranged']]) {
  document.getElementById(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.state !== 'playing' || game.paused) return;
    if (game.player.hand === slot) { if (slot === 'ranged') pressReload(); } else pressSwitch();
  });
}
document.getElementById('btn-pause').addEventListener('click', (e) => { e.currentTarget.blur(); game.openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.openPause(); });

// Bucle principal: actualizar lógica y dibujar ~60 veces por segundo
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  updatePad(game, overlay, dt); // el mando (si hay uno conectado)
  game.update(dt);
  // en el menú basta con sus sprites; en el resto del juego hacen falta todos
  if (game.state === 'menu' ? menuReady : allReady) game.render();
  else drawLoading();
  touchUI.hidden = !(game.state === 'playing' && !game.paused);
  requestAnimationFrame(frame);
}

// Mientras se descargan los sprites no se dibuja el juego: si no, durante un momento se vería el
// dibujo de antes (cartoon) en lugar del pixel art. En su lugar, fondo oscuro (el menú va encima).
let menuReady = false, allReady = false;
function drawLoading() {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0f0d17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

game.goMenu();
requestAnimationFrame(frame);
// Sprites de pixel art (lo que aún no tiene sprite se dibuja a mano, como antes)
// Con ?sala=<zombi> se salta el menú y se entra directamente a la sala de exposición
const sala = new URLSearchParams(location.search).has('sala');
// Primero se cargan los del menú (Johnny con la fregona, el suelo del pasillo y los muebles) para que
// aparezca enseguida, y el resto (zombis, armas, objetos...) mientras tanto.
const MENU_SPRITES = ['conserje-48-guardia', 'suelo-pasillo', 'mueble-'];
const sprites = loadSprites(MENU_SPRITES);
sprites.primero.then((ids) => { game.spriteIds = ids; menuReady = true; });
sprites.todos.then((ids) => {
  game.spriteIds = ids;
  allReady = true;
  if (sala) game.newRun();
});

// Para depurar desde la consola del navegador: window.game
window.game = game;
