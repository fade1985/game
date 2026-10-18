// ─────────────────────────────────────────────
//  Sala de exposición de muebles (añade ?muebles a la dirección): en la sala de mantenimiento se
//  ponen todos los muebles del catálogo con todas sus variantes y su dibujo de lado, a su tamaño
//  real, para ver rápido cómo quedan. Teclas 1-6: una carpeta de muebles cada vez.
//  Cada mueble lleva debajo su nombre; el rectángulo claro es el hueco que ocupa en el mapa.
// ─────────────────────────────────────────────
import { W } from './config.js';
import { outlinedText } from './draw.js';
import { MUEBLES } from './catalogo.js';
import { drawSprite, hasSprite, spriteMeta, furnitureShadow } from './sprites.js';

const CARPETAS = [
  ['salon', 'Salón'], ['cocina', 'Cocina'], ['dormitorio', 'Dormitorio'],
  ['bano', 'Baño'], ['pasillo', 'Pasillo'], ['comun', 'Común'],
];
const LETRAS = 'bcdefghijklmnopqrstuvwxyz';
// zona de la sala donde se coloca todo
const X0 = 70, X1 = W - 70, Y0 = 170, Y1 = 600;
const HUECO = 18; // aire entre muebles

// Los sprites de muebles de un tipo: la de siempre, sus variantes (-b, -c…) y el dibujo de lado de cada una
function dibujosDe(tipo, def) {
  const nombre = def.archivo.split('/').pop();
  const ids = [];
  const variantes = [''];
  for (const l of LETRAS) { if (!hasSprite(`mueble-${tipo}-${l}`)) break; variantes.push(`-${l}`); }
  for (const v of variantes) {
    if (hasSprite(`mueble-${tipo}${v}`)) ids.push({ id: `mueble-${tipo}${v}`, nombre: nombre + v, lado: false });
  }
  for (const v of variantes) {
    if (hasSprite(`mueble-${tipo}${v}-lado`)) ids.push({ id: `mueble-${tipo}${v}-lado`, nombre: `${nombre}${v}-lado`, lado: true });
  }
  return ids;
}

export class ExposicionMuebles {
  constructor() {
    this.kind = 'exposicion';
    this.x = W / 2; this.y = 0;
    this.r = 0;
    this.solid = false;
    this.taken = false;
    this.pagina = 0;
    this.cache = new Map(); // carpeta → piezas colocadas (se calcula cuando ya están cargados los sprites)
    window.addEventListener('keydown', (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= CARPETAS.length) this.pagina = n - 1;
    });
  }

  // Coloca las piezas de una carpeta en filas; si no caben, las encoge todas igual
  distribuye(carpeta) {
    const piezas = [];
    for (const [tipo, def] of Object.entries(MUEBLES)) {
      if (def.archivo.split('/')[0] !== carpeta) continue;
      for (const d of dibujosDe(tipo, def)) {
        const m = spriteMeta(d.id);
        const u = 2 * (m.scale ?? 1); // unidades del juego por píxel del sprite
        const w = m.cell[0] * u, h = m.cell[1] * u;
        const fw = d.lado ? def.dep : def.len, fh = d.lado ? def.len : def.dep;
        piezas.push({ ...d, w, h, fw, fh, slot: Math.max(w, fw) + HUECO });
      }
    }
    let filas = [], fila = [], ancho = 0;
    for (const p of piezas) {
      if (fila.length && ancho + p.slot > X1 - X0) { filas.push(fila); fila = []; ancho = 0; }
      fila.push(p); ancho += p.slot;
    }
    if (fila.length) filas.push(fila);
    const altoFila = (f) => Math.max(...f.map((p) => p.h)) + 30;
    const alto = filas.reduce((s, f) => s + altoFila(f), 0);
    const k = Math.min(1, (Y1 - Y0) / alto);
    return { filas, altoFila, k, piezas: piezas.length };
  }

  draw(ctx) {
    const [carpeta, titulo] = CARPETAS[this.pagina];
    if (!this.cache.has(carpeta)) this.cache.set(carpeta, this.distribuye(carpeta));
    const { filas, altoFila, k, piezas } = this.cache.get(carpeta);
    const menu = CARPETAS.map(([, t], i) => `${i + 1} ${t}`).join('   ');
    outlinedText(ctx, `EXPOSICIÓN DE MUEBLES · ${titulo} · ${piezas} dibujos`, W / 2, 112, 18, '#ffd166', { lw: 4 });
    outlinedText(ctx, `Teclas:  ${menu}`, W / 2, 138, 14, '#e8e8e8', { lw: 4 });
    if (!piezas) { outlinedText(ctx, 'No hay dibujos en esta carpeta', W / 2, 300, 16, '#ff5d73', { lw: 4 }); return; }
    ctx.save();
    ctx.translate(0, Y0);
    ctx.scale(k, k);
    let y = 0;
    for (const f of filas) {
      const base = y + Math.max(...f.map((p) => p.h)); // los muebles se apoyan todos en la misma línea
      let x = X0 / k + ((X1 - X0) / k - f.reduce((s, p) => s + p.slot, 0)) / 2;
      for (const p of f) {
        const cx = x + p.slot / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
        ctx.strokeRect(cx - p.fw / 2, base - p.fh, p.fw, p.fh);
        furnitureShadow(ctx, cx, base, p.w);
        drawSprite(ctx, p.id, 'idle', 'south', 0, cx, base, { scale: spriteMeta(p.id).scale });
        outlinedText(ctx, p.nombre, cx, base + 16, 12, '#ffffff', { lw: 3 });
        x += p.slot;
      }
      y += altoFila(f);
    }
    ctx.restore();
  }
}
