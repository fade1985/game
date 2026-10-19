// ─────────────────────────────────────────────
//  Prueba automática: abre el juego en un navegador sin pantalla, lo juega solo y avisa si algo falla
//
//  No es parte del juego. Se lanza desde la carpeta del proyecto:
//
//    npm test                      → juega, saca capturas y dice si ha ido bien
//    npm test -- --guardar         → además guarda la "huella" de esta versión como referencia
//    npm test -- --comparar        → juega y compara con la huella guardada
//
//  Qué hace:
//   1. Sirve la carpeta y abre `?pruebas` en Chromium (con Playwright).
//   2. Fija el azar (siempre la misma semilla) y para el bucle normal del juego: lo adelanta el
//      script fotograma a fotograma. Así cada vez pasa exactamente lo mismo.
//   3. Pasa por el menú, la pausa, cada zombi, cada jefe, cada arma, el molotov y unas partidas
//      del bot (tools/bot.js). Cualquier error en la consola del juego cuenta como fallo.
//   4. Deja capturas en tools/prueba-salida/ y un resumen de cómo acabó cada cosa (la "huella").
//
//  La huella sirve para los arreglos de código que no deberían cambiar nada (mover funciones de
//  archivo, ordenar): si con la misma semilla todo acaba igual que antes, no se ha roto nada.
//  Si se cambia a propósito cómo juega algo (vida, daño, velocidad...), la huella cambia y hay que
//  volver a guardarla.
//
//  Necesita Playwright: en la nube ya está; en casa, `npm install --no-save playwright` y
//  `npx playwright install chromium` una vez.
// ─────────────────────────────────────────────
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'prueba-salida');
const HUELLA = path.join(ROOT, 'tools', 'prueba-huella.json');
const args = process.argv.slice(2);

// Playwright se busca donde esté instalado (en la nube, fuera del proyecto)
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Falta Playwright: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

// ── Servidor de la carpeta (como `npm run dev`, que también quita el .html) ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  else if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));
const URL_JUEGO = `http://localhost:${server.address().port}/?pruebas`;

// ── Antes de que arranque el juego: azar fijo, sin bucle propio, guardado limpio ──
function preparar() {
  let s = 20261016;
  Math.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.requestAnimationFrame = () => 0; // el script adelanta el juego a mano
  try { localStorage.clear(); } catch { /* sin guardado, da igual */ }
}

// ── Las pruebas, dentro de la página. Cada una devuelve un resumen corto para la huella ──
async function pruebas() {
  const game = window.game;
  const { WEAPONS } = await import('/src/weapons.js');
  const { runBot } = await import('/tools/bot.js');
  const huella = {};
  const r = (n) => Math.round(n);
  // adelanta el juego y lo dibuja de vez en cuando (un error que solo salte al dibujar también cuenta)
  const dibujar = game.render.bind(game);
  const actualizar = game.update.bind(game);
  let fotograma = 0;
  game.update = (dt) => { actualizar(dt); if (++fotograma % 6 === 0) dibujar(); }; // también mientras juega el bot
  const paso = (seg) => { for (let i = 0; i < seg * 60; i++) game.update(1 / 60); };
  const estado = () => ({
    planta: game.floorNum, sala: game.room?.name, vida: r(game.player.hp),
    x: r(game.player.x), y: r(game.player.y), muertes: game.kills,
    zombis: game.enemies.length, balas: game.bullets.length,
  });
  const foto = async (nombre) => { game.render(); await window.__foto(nombre); };
  const tecla = (code, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code }));
  // una partida nueva en la sala de mantenimiento, con el conserje que no muere (para ver pelear)
  const sala = (arma) => {
    game.newRun();
    if (arma) game.player.weapon = WEAPONS[arma];
    game.banner = null;
    paso(0.5);
  };
  const inmortal = () => { game.player.hp = game.stats.maxHp; };

  // 1. Menú
  game.goMenu();
  paso(1);
  await foto('01-menu');
  huella.menu = game.state;

  // 2. Pausa
  sala();
  game.openPause();
  await foto('02-pausa');
  game.closePause();
  paso(0.2);

  // 3. Cada zombi, solo, contra la fregona
  for (const tipo of ['lento', 'normal', 'rapido', 'explosivo', 'tentaculos', 'venenoso']) {
    sala();
    const pt = game.findSpawnPoint();
    game.spawnEnemy(tipo, pt.x, pt.y);
    for (let t = 0; t < 12; t++) { inmortal(); paso(1); if (t === 3) await foto(`03-zombi-${tipo}`); }
    huella[`zombi-${tipo}`] = estado();
  }

  // 4. Los jefes (mini jefa y jefa final), con la escopeta
  for (const tipo of ['miniboss', 'boss']) {
    sala('escopeta');
    const pt = game.findSpawnPoint();
    game.spawnEnemy(tipo, pt.x, pt.y);
    for (let t = 0; t < 20; t++) { inmortal(); paso(1); if (t === 5) await foto(`04-jefe-${tipo}`); }
    huella[`jefe-${tipo}`] = { ...estado(), vidaJefe: r(game.enemies.find((e) => e.isBoss)?.hp ?? 0) };
  }

  // 5. Cada arma contra un grupo variado
  for (const arma of Object.keys(WEAPONS)) {
    sala(arma);
    for (const tipo of ['normal', 'lento', 'rapido']) { const pt = game.findSpawnPoint(); game.spawnEnemy(tipo, pt.x, pt.y); }
    for (let t = 0; t < 10; t++) { inmortal(); paso(1); if (t === 2) { game.ui.updateHud(game); await foto(`05-arma-${arma}`); } }
    huella[`arma-${arma}`] = estado();
  }

  // 6. El molotov: apuntar con el ratón al zombi (E pulsada) y soltar
  sala();
  for (const tipo of ['normal', 'normal']) { const pt = game.findSpawnPoint(); game.spawnEnemy(tipo, pt.x, pt.y); }
  paso(1);
  const z = game.enemies[0], c = game.canvas, lienzo = c.getBoundingClientRect();
  const sz = game.camera.toScreen(z.x, z.y); // en píxeles del lienzo; el ratón va en píxeles de la página
  window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse',
    clientX: lienzo.left + (sz.x * lienzo.width) / c.width, clientY: lienzo.top + (sz.y * lienzo.height) / c.height }));
  tecla('KeyE', true); paso(0.4);
  await foto('06-molotov-apuntar');
  tecla('KeyE', false); paso(1);
  await foto('06-molotov');
  paso(4);
  huella.molotov = { ...estado(), molotovs: game.molotovs };

  // 6a. La granada: F cambia el botón de lanzar a granada, se apunta, se lanza, parpadea y explota
  sala();
  for (const tipo of ['normal', 'normal']) { const pt = game.findSpawnPoint(); game.spawnEnemy(tipo, pt.x, pt.y); }
  paso(1);
  tecla('KeyF', true); tecla('KeyF', false); paso(0.1);
  if (game.tossKind !== 'granada') throw new Error('granada: F no cambia a granada');
  const zg = game.enemies[0], sg = game.camera.toScreen(zg.x, zg.y);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse',
    clientX: lienzo.left + (sg.x * lienzo.width) / c.width, clientY: lienzo.top + (sg.y * lienzo.height) / c.height }));
  tecla('KeyE', true); paso(0.3);
  await foto('06-granada-apuntar');
  tecla('KeyE', false); paso(0.1);
  if (game.grenades.length !== 1) throw new Error('granada: no se ha lanzado');
  paso(1.6);
  await foto('06-granada-parpadeo');
  const vivos = game.enemies.length;
  paso(0.7);
  if (game.grenades.length !== 0) throw new Error('granada: no ha explotado');
  await foto('06-granada-explosion');
  huella.granada = { ...estado(), granadas: game.granadas, zombisAntes: vivos };
  tecla('KeyF', true); tecla('KeyF', false); paso(0.1);

  // 6b. Munición de verdad (fuera del modo de pruebas, que la da infinita): la pistola se vacía, Johnny pasa
  //     solo a la fregona, coge una caja y vuelve a la pistola; y la escopeta recarga de uno en uno
  const fallo = (msg) => { throw new Error(`munición: ${msg}`); };
  sala('pistola');
  game.testMode = false; // (cada partida nueva lo vuelve a leer de la dirección)
  const pj = game.player;
  pj.mag = 3; pj.reserve = 0;
  for (const tipo of ['normal', 'normal']) { const pt = game.findSpawnPoint(); game.spawnEnemy(tipo, pt.x, pt.y); }
  for (let t = 0; t < 6 && pj.hand === 'ranged'; t++) { inmortal(); paso(1); }
  if (pj.hand !== 'melee' || !pj.autoMelee) fallo('sin balas no ha cambiado a la fregona');
  game.dropPickup('ammo', pj.x, pj.y);
  paso(1);
  if (pj.hand !== 'ranged' || pj.reserve + pj.mag !== 12) fallo('la caja no ha devuelto la pistola con un cargador');
  await foto('06b-municion');
  huella.municion = { ...estado(), mano: pj.hand, cargador: pj.mag, reserva: pj.reserve };
  sala('escopeta');
  game.testMode = false;
  game.player.mag = 1;
  game.dropPickup('ammo', game.player.x + 200, game.player.y - 60); // para ver la caja en el suelo
  game.pickups.at(-1).vx = game.pickups.at(-1).vy = 0;
  game.player.startReload(game);
  paso(0.3);
  await foto('06c-caja-y-recarga');
  paso(0.7);
  if (game.player.mag !== 3) fallo(`la escopeta debería llevar 3 cartuchos tras un segundo y lleva ${game.player.mag}`);
  game.testMode = true;

  // 7. El bot juega partidas de verdad (sin rellenar la vida) y otras saltándose a los jefes
  const bot1 = await runBot(game, { runs: 2, refill: false, maxTime: 300 });
  huella.botPartidas = bot1.ends;
  const bot2 = await runBot(game, { runs: 1, skipBoss: true, maxTime: 600, keep: true });
  huella.botPlantas = bot2.ends;
  huella.botMapas = bot2.rows.length;
  await foto('07-bot');

  // 8. Fin de partida
  sala();
  game.player.hurt(1000, game);
  paso(3);
  await foto('08-fin');
  huella.fin = game.state;

  // 9. Armas creadas a distancia (fase D2): van a la mano de fuego y hacen daño con su efecto
  //    (va al final y fuera de la huella, para no cambiar el azar de lo anterior)
  const { RECETAS, crearArma } = await import('/src/recetas.js');
  const { armaDeCreada } = await import('/src/armas-creadas.js');
  for (const id of ['lanzallamas', 'supersoplete', 'desintegrador', 'bumeran']) {
    sala('pistola');
    const arma = crearArma(RECETAS.find((x) => x.id === id));
    const vieja = game.player.equip(armaDeCreada(arma));
    game.guardarArma(vieja?.weapon, vieja?.ammo);
    if (game.player.slots.ranged.id !== id || game.armasGuardadas.length < 1) throw new Error(`${id}: no ha ido a la mano de fuego`);
    for (let k = 0; k < 3; k++) { game.spawnEnemy('normal', game.player.x + 55 + k * 22, game.player.y + (k - 1) * 20); }
    let disparos = 0; const dc = game.disparoCreada.bind(game); game.disparoCreada = (...a) => { disparos++; return dc(...a); };
    const antes = game.enemies.reduce((s, e) => s + e.hp, 0), muertes = game.kills;
    paso(1.2); inmortal();
    await foto(`09-${id}`);
    paso(1.8); inmortal();
    game.disparoCreada = dc;
    if (!disparos) throw new Error(`${id}: no ha disparado`);
    if (!(game.kills > muertes || game.enemies.reduce((s, e) => s + e.hp, 0) < antes)) throw new Error(`${id}: no ha hecho daño`);
    if (id === 'bumeran') { paso(3); if (game.bumeranes.length) throw new Error('bumeran: no ha vuelto a la mano'); }
    // al ponerse otra vez la pistola (desde el inventario) vuelve el arma guardada
    game.invSel = 'g0'; game.ponerDelInventario();
    if (game.player.slots.ranged.id !== 'pistola' || !game.armasCreadas.some((a) => a.receta === id)) throw new Error(`${id}: el inventario no ha cambiado de arma`);
  }
  return huella;
}

// ── Lanzar todo ──
const errores = [];
const browser = await chromium.launch();
let huella;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errores.push(`error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`consola: ${m.text()}`); });
  page.on('requestfailed', (q) => errores.push(`no carga: ${q.url()}`));
  page.on('response', (q) => { if (q.status() >= 400) errores.push(`no encuentra (${q.status()}): ${q.url()}`); });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await page.exposeFunction('__foto', (nombre) => page.screenshot({ path: path.join(OUT, `${nombre}.png`) }));
  await page.addInitScript(preparar);
  await page.goto(URL_JUEGO);
  // esperar a que estén todos los sprites (los de los zombis llegan en la segunda tanda)
  await page.waitForFunction(() => window.game?.spriteIds?.some?.((id) => id.startsWith('zombi-')), null, { timeout: 30000, polling: 200 });
  huella = await page.evaluate(pruebas);

  // En un móvil en horizontal (táctil): los botones de esquivar, molotov y las dos armas, con la pistola
  // en la mano y recargando. Solo una captura para mirar cómo quedan (no cuenta para la huella)
  const movil = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  movil.on('pageerror', (e) => errores.push(`error (móvil): ${e.message}`));
  await movil.addInitScript(preparar);
  await movil.goto(URL_JUEGO);
  await movil.waitForFunction(() => window.game?.spriteIds?.some?.((id) => id.startsWith('zombi-')), null, { timeout: 30000, polling: 200 });
  await movil.evaluate(async () => {
    const game = window.game;
    const { WEAPONS } = await import('/src/weapons.js');
    game.newRun();
    game.banner = null;
    game.player.weapon = WEAPONS.pistola;
    game.player.mag = 0;
    game.player.startReload(game);
    for (let i = 0; i < 40; i++) game.update(1 / 60);
    game.render();
    document.getElementById('touch-ui').hidden = false; // (lo enseña el bucle normal, que aquí está parado)
  });
  await movil.screenshot({ path: path.join(OUT, '09-movil.png') });
} catch (e) {
  errores.push(`la prueba no pudo terminar: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.close();
}

// ── Resultado ──
let ok = errores.length === 0;
if (huella) fs.writeFileSync(path.join(OUT, 'huella.json'), `${JSON.stringify(huella, null, 2)}\n`);
if (huella && args.includes('--guardar')) {
  fs.writeFileSync(HUELLA, `${JSON.stringify(huella, null, 2)}\n`);
  console.log('Huella guardada como referencia.');
}
if (huella && args.includes('--comparar')) {
  if (!fs.existsSync(HUELLA)) { console.log('No hay huella guardada: lánzalo antes con --guardar.'); ok = false; } else {
    const antes = JSON.parse(fs.readFileSync(HUELLA, 'utf8'));
    const distintas = [...new Set([...Object.keys(antes), ...Object.keys(huella)])]
      .filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(huella[k]));
    if (distintas.length) {
      ok = false;
      console.log('La huella ha cambiado en:');
      for (const k of distintas) console.log(`  ${k}\n    antes: ${JSON.stringify(antes[k])}\n    ahora: ${JSON.stringify(huella[k])}`);
    } else console.log('Huella igual que la guardada: el juego se comporta exactamente igual.');
  }
}
for (const e of [...new Set(errores)]) console.log(`✗ ${e}`);
console.log(ok ? `✓ Todo bien. Capturas en tools/prueba-salida/` : '✗ Algo ha fallado.');
process.exit(ok ? 0 : 1);
