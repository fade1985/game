// ─────────────────────────────────────────────
//  Graba la música de fondo (src/musica.js) a un .wav para escucharla sin jugar
//
//  node tools/grabar-musica.mjs            → tools/prueba-salida/musica.wav
//  Toca 40 s de menú, 150 s de exploración y 60 s de jefe seguidos, y dice el
//  volumen de cada parte. Cada grabación sale distinta (la música no se repite).
//  Necesita Playwright, como `npm test`.
// ─────────────────────────────────────────────
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'prueba-salida');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Falta Playwright: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>musica</title>');
  }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
const { wav, partes } = await page.evaluate(async () => {
  const { crearMusica } = await import('/src/musica.js');
  const TRAMOS = [['menu', 40], ['explore', 150], ['boss', 60]];
  const total = TRAMOS.reduce((s, [, d]) => s + d, 0);
  const sr = 44100;
  const ac = new OfflineAudioContext(2, sr * total, sr);
  // Igual que en el juego: volumen de la música y compresor general
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  comp.connect(ac.destination);
  const vol = ac.createGain();
  vol.gain.value = 0.55;
  vol.connect(comp);
  const m = crearMusica(ac, vol);
  let hasta = 0;
  for (const [modo, dur] of TRAMOS) {
    m.play(modo);
    hasta += dur;
    m.programar(hasta);
  }
  const buf = await ac.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  // Volumen de cada parte: pico y media (RMS) en decibelios
  const partes = [];
  let ini = 0;
  for (const [modo, dur] of TRAMOS) {
    let pico = 0, suma = 0;
    const a = ini * sr, b = (ini + dur) * sr;
    for (let i = a; i < b; i++) { pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i])); suma += L[i] * L[i]; }
    const db = (x) => (20 * Math.log10(x)).toFixed(1);
    partes.push(`${modo}: pico ${db(pico)} dB, media ${db(Math.sqrt(suma / (b - a)))} dB`);
    ini += dur;
  }
  // WAV de 16 bits
  const n = L.length;
  const datos = new DataView(new ArrayBuffer(44 + n * 4));
  const txt = (o, s) => [...s].forEach((c, i) => datos.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); datos.setUint32(4, 36 + n * 4, true); txt(8, 'WAVEfmt ');
  datos.setUint32(16, 16, true); datos.setUint16(20, 1, true); datos.setUint16(22, 2, true);
  datos.setUint32(24, sr, true); datos.setUint32(28, sr * 4, true); datos.setUint16(32, 4, true);
  datos.setUint16(34, 16, true); txt(36, 'data'); datos.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    datos.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    datos.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  const bytes = new Uint8Array(datos.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { wav: btoa(bin), partes };
});
await browser.close();
server.close();

fs.mkdirSync(OUT, { recursive: true });
const destino = path.join(OUT, 'musica.wav');
fs.writeFileSync(destino, Buffer.from(wav, 'base64'));
console.log(partes.join('\n'));
console.log(`Grabada en ${path.relative(ROOT, destino)}`);
