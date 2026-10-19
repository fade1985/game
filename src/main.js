// ─────────────────────────────────────────────
//  Punto de entrada: crea el juego y arranca el bucle
// ─────────────────────────────────────────────
import { Game } from './game.js';
import { createUI } from './ui.js';
import { initInput, pressReload, pressSwitch, pressTossSwitch } from './input.js';
import { updatePad } from './mando.js';
import { unlockAudio, setMusicOn, toggleMute } from './sfx.js';
import { loadSave } from './save.js';
import { loadSprites, cambiarDensidad, densidadUnica } from './sprites.js';
import { objetoAlAzar } from './objetos.js';

const root = document.getElementById('game-wrap');
const canvas = document.getElementById('game');
const touchUI = document.getElementById('touch-ui');
const overlay = document.getElementById('overlay');

if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

setMusicOn(loadSave().settings.music);
// En el modo pruebas (?pruebas) el juego arranca sin sonido ni música, para probar sin molestar
// (se puede volver a activar con el botón del altavoz)
if (new URLSearchParams(location.search).has('pruebas')) {
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
  // el inventario: Tab o I (el Tab, sin que el navegador salte de botón en botón)
  if ((e.code === 'Tab' || e.code === 'KeyI') && !e.uiHandled) { e.preventDefault(); game.openInventario(); }
});
// tocar la mochila del HUD también abre el inventario (móvil)
document.getElementById('pill-mochila').addEventListener('pointerdown', (e) => { e.preventDefault(); game.openInventario(); });
// Modo pruebas (?pruebas): las teclas 1-6 invocan cada tipo de zombi, 7 el mini jefe y 8 la jefa final;
// el 9 deja caer un objeto para crear armas a los pies de Johnny
const TEST_ZOMBIES = ['lento', 'normal', 'rapido', 'explosivo', 'tentaculos', 'venenoso', 'miniboss', 'boss'];
window.addEventListener('keydown', (e) => {
  if (!game.testMode || game.state !== 'playing' || game.paused || e.uiHandled) return;
  if (game.room?.expo) return; // en las salas de exposición los números son de la exposición
  const n = Number(e.key);
  if (n >= 1 && n <= TEST_ZOMBIES.length) {
    const pos = game.findSpawnPoint();
    game.spawnEnemy(TEST_ZOMBIES[n - 1], pos.x, pos.y);
  }
  if (n === 9) game.dropPickup('objeto', game.player.x, game.player.y + 40).obj = objetoAlAzar();
});
// Prueba de densidad única (rama pixel-escala): la O cambia suelos, paredes y armas del suelo a los píxeles de Johnny
window.addEventListener('keydown', (e) => {
  if (!game.testMode || game.state !== 'playing' || game.paused || e.uiHandled || e.code !== 'KeyO') return;
  cambiarDensidad();
  game.floatText(game.player.x, game.player.y - 70, densidadUnica ? 'Densidad única' : 'Como antes', '#ffe08a', 16);
});
// Carteles de las armas (abajo) y botones redondos de las armas (móvil): tocar la otra arma la saca;
// tocar la de fuego que ya está en la mano, recarga
const slotButtons = [
  [document.getElementById('pill-melee'), 'melee'], [document.getElementById('pill-ranged'), 'ranged'],
  ...[...document.querySelectorAll('.slot-btn')].map((el) => [el, el.dataset.slot]),
];
for (const [el, slot] of slotButtons) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.state !== 'playing' || game.paused) return;
    if (game.player.hand === slot) { if (slot === 'ranged') pressReload(); } else pressSwitch();
  });
}
document.querySelector('.toss-swap').addEventListener('pointerdown', (e) => { e.preventDefault(); pressTossSwitch(); });
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
// Primero se cargan los del menú (Johnny con la fregona, el suelo del pasillo y los muebles) para que
// aparezca enseguida, y el resto (zombis, armas, objetos...) mientras tanto.
const MENU_SPRITES = ['conserje-48-guardia', 'suelo-pasillo', 'mueble-'];
const sprites = loadSprites(MENU_SPRITES);
sprites.primero.then((ids) => { game.spriteIds = ids; menuReady = true; });
sprites.todos.then((ids) => {
  game.spriteIds = ids;
  allReady = true;
});

// Para depurar desde la consola del navegador: window.game
window.game = game;
