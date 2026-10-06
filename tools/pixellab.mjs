#!/usr/bin/env node
// ─────────────────────────────────────────────
//  Herramienta para generar sprites con la API de PixelLab (https://api.pixellab.ai/v2)
//
//  Necesita la clave en la variable de entorno PIXELLAB_API_KEY (nunca se muestra).
//  Todo lo generado se guarda en assets/sprites/ (PNG + JSON) y se apunta en
//  assets/pixellab.json (qué texto se usó, semilla, ids de PixelLab) para poder repetirlo.
//
//  Uso:
//    node tools/pixellab.mjs balance
//    node tools/pixellab.mjs character <id> "<descripción>" [--size 32] [--view "low top-down"] [--seed 7]
//    node tools/pixellab.mjs animate <id> <plantilla> [--dirs south,east,north,west] [--fps 10] [--name walk]
//    node tools/pixellab.mjs animate-text <id> "<acción>" [--frames 8] [--dirs south] [--name attack]
//    node tools/pixellab.mjs export <id>
//    node tools/pixellab.mjs image <id> "<descripción>" --size 64x32 [--pivot center|top-left|feet] [--view "high top-down"]
//
//  Antes de cada generación se indica cuántas "generaciones" (créditos) gastará, si se conoce.
// ─────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'sprites');
const REGISTRY = join(ROOT, 'assets', 'pixellab.json');
const API = 'https://api.pixellab.ai/v2';
const KEY = process.env.PIXELLAB_API_KEY;

// Estilo común de todo el juego (ver docs/PIXEL_ART.md)
const STYLE = { outline: 'single color black outline', detail: 'medium detail', view: 'low top-down' };

// ═════════════ utilidades ═════════════
function args(list) {
  const pos = [], opt = {};
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) opt[list[i].slice(2)] = list[i + 1] ?? true, i++;
    else pos.push(list[i]);
  }
  return { pos, opt };
}

const loadJSON = (f, def) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : def);
const saveJSON = (f, d) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };
const registry = () => loadJSON(REGISTRY, {});
function remember(id, data) {
  const r = registry();
  r[id] = { ...(r[id] || {}), ...data, updated: new Date().toISOString() };
  saveJSON(REGISTRY, r);
}
// Añade el sprite a la lista que carga el juego
function addToManifest(id) {
  const f = join(OUT, 'manifest.json');
  const m = loadJSON(f, []);
  if (!m.includes(id)) { m.push(id); m.sort(); saveJSON(f, m); }
}
// Ancho y alto de un PNG (leyendo su cabecera)
function pngSize(buf) {
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

async function api(method, path, body, tries = 8) {
  if (!KEY) throw new Error('Falta la variable de entorno PIXELLAB_API_KEY');
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = r.headers.get('content-type') || '';
  // el plan gratuito solo permite un trabajo a la vez: esperamos y reintentamos
  if (r.status === 429 && tries > 0) {
    process.stdout.write('  (esperando a que PixelLab termine otro trabajo...)\n');
    await sleep(10000);
    return api(method, path, body, tries - 1);
  }
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 500)}`);
  }
  return type.includes('application/json') ? r.json() : Buffer.from(await r.arrayBuffer());
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Espera a que termine un trabajo en segundo plano
async function waitJob(jobId, label) {
  const t0 = Date.now();
  for (;;) {
    const j = await api('GET', `/background-jobs/${jobId}`);
    if (j.status === 'completed') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error(`${label}: el trabajo terminó como "${j.status}" ${JSON.stringify(j.last_response || {}).slice(0, 300)}`);
    process.stdout.write(`\r  ${label}: ${j.status} (${Math.round((Date.now() - t0) / 1000)} s)   `);
    await sleep(4000);
  }
}

const usage = (u) => (u ? (u.type === 'generations' ? `${u.generations} generaciones` : `${u.usd} USD`) : '?');

// ═════════════ comandos ═════════════
const commands = {
  async balance() {
    const b = await api('GET', '/balance');
    console.log(JSON.stringify(b, null, 2));
  },

  // Personaje de 8 direcciones creado desde un texto
  async character([id, description], o) {
    if (!id || !description) throw new Error('uso: character <id> "<descripción>"');
    const size = Number(o.size || 32);
    console.log(`Creando "${id}" (${size}×${size}). Coste estimado: ${1 + Math.ceil((size * size * 8) / 65536)} generaciones`);
    const body = {
      description,
      image_size: { width: size, height: size },
      view: o.view || STYLE.view,
      outline: STYLE.outline,
      detail: o.detail || STYLE.detail,
      no_background: true,
      ...(o.seed ? { seed: Number(o.seed) } : {}),
    };
    const r = await api('POST', '/create-character-v3', body);
    remember(id, { kind: 'character', character_id: r.character_id, request: body });
    await waitJob(r.background_job_id, id);
    console.log(`\n  ✔ personaje creado (id PixelLab ${r.character_id}, coste ${usage(r.usage)})`);
  },

  // Animación con una plantilla de esqueleto (1 generación por dirección)
  async animate([id, template], o) {
    const reg = registry()[id];
    if (!reg?.character_id) throw new Error(`"${id}" no es un personaje creado con este script`);
    const dirs = o.dirs ? String(o.dirs).split(',') : undefined;
    console.log(`Animación "${template}" de "${id}" en ${dirs ? dirs.length : 'todas las'} direcciones (1 generación por dirección)`);
    // Una dirección por llamada (los planes básicos no permiten más a la vez); todas en la misma animación
    const name = o.name || template;
    let group = reg.anims?.[name]?.group;
    const done = [];
    for (const dir of dirs || ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']) {
      const body = { character_id: reg.character_id, template_animation_id: template, animation_name: name, directions: [dir], ...(group ? { animation_group_id: group } : {}) };
      const r = await api('POST', '/characters/animations', body);
      group = group || r.animation_group_id;
      for (const job of r.background_job_ids || []) await waitJob(job, `${id}/${name}/${dir}`);
      done.push(dir);
      remember(id, { anims: { ...(registry()[id].anims || {}), [name]: { template, fps: Number(o.fps || 10), group } } });
    }
    console.log(`\n  ✔ animación lista (${done.join(', ')})`);
  },

  // Animación descrita con texto (modo v3)
  async 'animate-text'([id, action], o) {
    const reg = registry()[id];
    if (!reg?.character_id) throw new Error(`"${id}" no es un personaje creado con este script`);
    const dirs = o.dirs ? String(o.dirs).split(',') : ['south'];
    const name = o.name || action;
    const body = { character_id: reg.character_id, action_description: action, mode: 'v3', frame_count: Number(o.frames || 8), animation_name: name, directions: dirs };
    console.log(`Animación "${name}" de "${id}" en ${dirs.join(', ')}`);
    const r = await api('POST', '/characters/animations', body);
    for (const job of r.background_job_ids || []) await waitJob(job, `${id}/${name}`);
    remember(id, { anims: { ...(reg.anims || {}), [name]: { action, fps: Number(o.fps || 10), group: r.animation_group_id } } });
    console.log('\n  ✔ animación lista');
  },

  // Descarga la hoja de sprites del personaje y la convierte al formato del juego
  async export([id]) {
    const reg = registry()[id];
    if (!reg?.character_id) throw new Error(`"${id}" no es un personaje creado con este script`);
    const zip = await api('GET', `/characters/${reg.character_id}/spritesheet`);
    const dir = mkdtempSync(join(tmpdir(), 'pixellab-'));
    writeFileSync(join(dir, 'sheet.zip'), zip);
    execFileSync('python3', ['-I', '-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', join(dir, 'sheet.zip'), join(dir, 'x')]);
    const files = readdirSync(join(dir, 'x'));
    const png = files.find((f) => f.endsWith('.png'));
    const layout = JSON.parse(readFileSync(join(dir, 'x', files.find((f) => f.endsWith('.json'))), 'utf8'));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${id}.png`), readFileSync(join(dir, 'x', png)));
    saveJSON(join(OUT, `${id}.json`), convertLayout(layout, reg));
    addToManifest(id);
    console.log(`  ✔ ${id}.png y ${id}.json guardados en assets/sprites/`);
  },

  // Imagen suelta (muebles, baldosas, objetos) con el modelo Pixen
  async image([id, description], o) {
    if (!id || !description || !o.size) throw new Error('uso: image <id> "<descripción>" --size 64x32');
    const [width, height] = String(o.size).split('x').map(Number);
    const body = {
      description,
      image_size: { width, height },
      outline: STYLE.outline,
      detail: o.detail || STYLE.detail,
      view: o.view || 'high top-down',
      no_background: o.background !== 'yes',
      ...(o.seed ? { seed: Number(o.seed) } : {}),
    };
    console.log(`Imagen "${id}" (${width}×${height})`);
    const r = await api('POST', '/create-image-pixen', body);
    const buf = Buffer.from(r.image.base64, 'base64');
    const [w, h] = pngSize(buf);
    const pivot = o.pivot === 'top-left' ? [0, 0] : o.pivot === 'feet' ? [w / 2, h - 2] : [w / 2, h / 2];
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${id}.png`), buf);
    saveJSON(join(OUT, `${id}.json`), { cell: [w, h], pivot, anims: { idle: { fps: 1, dirs: { south: { row: 0, frames: 1 } } } } });
    addToManifest(id);
    remember(id, { kind: 'image', request: body, cost: usage(r.usage) });
    console.log(`  ✔ guardada (${w}×${h}, coste ${usage(r.usage)})`);
  },
};

// Convierte el JSON de PixelLab al formato de src/sprites.js.
// PixelLab exporta { spritesheet: { cell_size, rows: [...] } }: la fila de tipo "rotations"
// tiene una dirección por columna (sirve de "idle"); el resto, una fila por animación y dirección.
// El punto de apoyo (los pies) lo calcula el juego al cargar la hoja ("pivot": "auto").
function convertLayout(layout, reg) {
  const L = layout.spritesheet || layout;
  const cw = L.cell_size?.width, ch = L.cell_size?.height;
  const anims = {};
  for (const row of L.rows || []) {
    if (row.type === 'rotations') {
      anims.idle = { fps: 1, loop: true, dirs: {} };
      (row.directions || []).forEach((d, col) => { anims.idle.dirs[d] = { row: row.row, col, frames: 1 }; });
      continue;
    }
    // fila de animación: buscamos su nombre en el registro (por grupo o por plantilla)
    const known = Object.entries(reg.anims || {}).find(([, a]) => (row.animation_group_id && a.group === row.animation_group_id) || a.template === row.animation || a.template === row.template_animation_id);
    const name = known?.[0] || row.animation_name || row.animation || `anim${row.row}`;
    anims[name] = anims[name] || { fps: known?.[1].fps || 10, loop: true, dirs: {} };
    anims[name].dirs[row.direction] = { row: row.row, frames: row.frame_count ?? L.columns };
  }
  return { cell: [cw, ch], pivot: 'auto', anims, source: layout };
}

// ═════════════ arranque ═════════════
const [cmd, ...rest] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log('Comandos: ' + Object.keys(commands).join(', ') + '  (ver la cabecera del archivo)');
  process.exit(cmd ? 1 : 0);
}
const { pos, opt } = args(rest);
commands[cmd](pos, opt).catch((e) => { console.error('\n✖ ' + e.message); process.exit(1); });
