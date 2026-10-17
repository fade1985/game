// ─────────────────────────────────────────────
//  Medir el rendimiento con fuego: 30 zombis apiñados, tres molotovs encima, y cada medio segundo una fila
//  con cuántos arden, partículas, textos, cadáveres, órdenes de dibujo, mezclas de color (lo más caro para la
//  tarjeta gráfica) y lo que tarda el dibujo. Ojo: este navegador dibuja sin tarjeta gráfica, así que los
//  milisegundos no son los de un móvil; las cuentas de órdenes y mezclas sí sirven para comparar.
//
//    node tools/rendimiento.mjs
// ─────────────────────────────────────────────
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('ERROR', e.message));
await page.addInitScript(() => { let s = 7; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); window.requestAnimationFrame = () => 0; });
await page.goto(`http://localhost:${server.address().port}/?pruebas&mudo`);
await page.waitForFunction(() => window.game?.spriteIds?.some?.((id) => id.startsWith('zombi-')), null, { polling: 200, timeout: 60000 });
const out = await page.evaluate(() => {
  const g = window.game; g.newRun(); g.banner = null; g.player.aimer = { aim: () => null };
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  // los zombis, apiñados alrededor de un punto, que es donde caen los molotovs
  const cx = g.rw / 2 + 160, cy = g.rh / 2 - 60;
  for (let i = 0; i < 30; i++) { const e = g.spawnEnemy(['normal', 'lento', 'rapido'][i % 3], cx + (i % 6) * 22 - 55, cy + Math.floor(i / 6) * 20 - 40); }
  for (let i = 0; i < 50; i++) { g.player.hp = 999; g.update(1 / 60); }
  for (const e of g.enemies) e.dmg = 0;
  const P = CanvasRenderingContext2D.prototype; let calls = 0, comp = 0;
  for (const m of ['fillRect', 'drawImage', 'fill', 'stroke', 'arc', 'ellipse', 'fillText', 'strokeText', 'clip', 'roundRect', 'lineTo']) {
    const f = P[m]; P[m] = function (...a) { calls++; return f.apply(this, a); };
  }
  const d = Object.getOwnPropertyDescriptor(P, 'globalCompositeOperation');
  Object.defineProperty(P, 'globalCompositeOperation', { set(v) { if (v !== 'source-over') comp++; d.set.call(this, v); }, get() { return d.get.call(this); } });
  // coste de redibujar el mapa una vez
  g.room.cacheKey = 'x'; calls = 0; let t = performance.now(); g.roomImage(g.room); const mapa = { llamadas: calls, ms: +(performance.now() - t).toFixed(1) };
  for (let i = 0; i < 3; i++) g.throwMolotov(cx + (i - 1) * 50, cy);
  const filas = [];
  for (let f = 0; f < 600; f++) {
    g.player.hp = 999;
    const k0 = g.room.cacheKey; calls = 0; comp = 0;
    g.update(1 / 60);
    const t0 = performance.now(); g.render(); const ms = performance.now() - t0;
    if (f % 30 === 0 || g.room.cacheKey !== k0) filas.push({ f, s: +(f / 60).toFixed(1), vivos: g.enemies.length, ardiendo: g.enemies.filter((e) => e.burnT > 0).length,
      particulas: g.particles.length, textos: g.texts.length, cadaveres: g.room.props.filter((p) => p.kind === 'corpse').length,
      llamadas: calls, mezclas: comp, ms: +ms.toFixed(1), mapa: g.room.cacheKey !== k0 ? 'REDIBUJADO' : '' });
  }
  return { mapa, filas };
});
console.log('Redibujar el mapa una vez:', out.mapa);
console.table(out.filas.slice(0, 60));
await browser.close(); server.close();
