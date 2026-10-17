// Saca una captura de la sala de mantenimiento (o la que se pida) para mirar suelo y paredes.
// Uso: node tools/foto-sala.mjs <salida.png> [x] [y] [pasillo]   (x, y: dónde se pone a Johnny, en unidades; "pasillo": entra al pasillo de la planta)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [salida = "sala.png", px, py, donde] = process.argv.slice(2);
const { chromium } = createRequire(import.meta.url)('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('error:', e.message));
await page.goto(`http://localhost:${server.address().port}/?pruebas&mudo`);
await page.waitForFunction(() => window.game?.spriteIds?.some?.((id) => id.startsWith('zombi-')), null, { timeout: 30000, polling: 200 });
await page.evaluate(([x, y, donde]) => {
  const g = window.game;
  g.newRun(); g.banner = null;
  if (donde === "pasillo") g.enterRoom(g.floor.corridor);
  if (x !== undefined) { g.player.x = +x; g.player.y = +y; }
  for (let i = 0; i < 40; i++) g.update(1 / 60);
  g.render();
}, [px, py, donde]);
console.log(JSON.stringify(await page.evaluate(() => window.game.room.layout.wallDecor.map((d) => [d.kind, Math.round(d.x)]))));
await page.screenshot({ path: salida });
await browser.close();
server.close();
