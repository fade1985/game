// Captura 8 fotogramas de la explosión del zombi explosivo en una tira (para revisar cómo se ve)
//   node tools/captura-explosion.mjs   → tools/prueba-salida/explosion-tira.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  else if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += '.html';
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
await page.goto(`http://localhost:${server.address().port}/?pruebas`);
await page.waitForFunction(() => window.game && (window.game.spriteIds || []).includes('objeto-fx-humo'), null, { timeout: 60000 });
const url = await page.evaluate(async () => {
  const g = window.game;
  g.newRun();
  await new Promise((r) => setTimeout(r, 800));
  g.enemies.length = 0;
  const up = g.update.bind(g), ren = g.render.bind(g);
  g.update = () => {}; g.render = () => {};
  const cv = document.querySelector('canvas'), p = g.player, ex = { x: p.x, y: p.y - 150 };
  const { Zombie } = await import('/src/zombies.js');
  const z = new Zombie('explosivo', ex.x, ex.y);
  g.enemies.push(z); g.killEnemy(z);
  let t = 0; const shots = [];
  for (const T of [0.03, 0.1, 0.18, 0.28, 0.42, 0.6, 0.85, 1.3]) {
    while (t < T) { up(1 / 60); t += 1 / 60; }
    g.shakeAmt = 0; ren();
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    c.getContext('2d').drawImage(cv, 0, 0); shots.push(c);
  }
  // de coordenadas del juego a píxeles de pantalla, con la cámara
  const cam = g.camera, k = cv.height / cam.vh;
  const W = Math.round(320 * k), H = Math.round(300 * k);
  const X = (ex.x - (cam.x - cam.vw / 2)) * k - W / 2, Y = (ex.y - (cam.y - cam.vh / 2)) * k - H / 2;
  const out = document.createElement('canvas'); out.width = W * 4; out.height = H * 2;
  shots.forEach((c, i) => out.getContext('2d').drawImage(c, X, Y, W, H, (i % 4) * W, Math.floor(i / 4) * H, W, H));
  return out.toDataURL();
});
fs.mkdirSync(path.join(ROOT, 'tools', 'prueba-salida'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'prueba-salida', 'explosion-tira.png'), Buffer.from(url.split(',')[1], 'base64'));
await browser.close(); server.close();
console.log('Guardado tools/prueba-salida/explosion-tira.png');
