// ─────────────────────────────────────────────
//  Generador de apartamentos
//
//  Cada apartamento es un mapa continuo: un rectángulo grande con el salón en medio y, alrededor, la
//  cocina y de 1 a 3 dormitorios, cada dormitorio con su baño. Sale distinto cada vez:
//
//    1. El salón empieza ocupando todo el rectángulo.
//    2. La cocina y los dormitorios se reparten en franjas, de izquierda a derecha: pegados a la pared
//       del fondo, en las esquinas de delante o dos seguidos en un lateral. Lo que queda libre es el
//       salón, que sale con forma de L, de T, de U... y toca todas las habitaciones.
//    3. A cada dormitorio se le recorta un baño en una esquina (el dormitorio se queda con forma de L).
//    4. Se abre una puerta del salón a la cocina y a cada dormitorio, y otra de cada dormitorio a su
//       baño. A veces, una más entre dos habitaciones vecinas.
//
//  El apartamento del jefe es el mismo rectángulo sin tabiques: lo ha reventado todo.
//
//  Usa la misma cuadrícula que shapes.js (casillas de 32 unidades; 0 = suelo, 1 = muro), así que los
//  zombis, las balas y los muebles lo entienden igual que una sala de las de antes.
// ─────────────────────────────────────────────
import { mulberry32 } from './utils.js';

export const CELL = 32;   // lado de una casilla (igual que en shapes.js)
const EDGE = 2;           // grosor del muro exterior, en casillas (64 unidades)
const MIN = 7;            // lado mínimo de un trozo de salón, en casillas
const DOOR = 3;           // ancho de las puertas, en casillas (96 unidades)
const MAX_LONG = 2.2;     // cuántas veces más larga que ancha puede ser una habitación
const HALL = 8;           // fondo mínimo del salón delante de una habitación, en casillas
const GAP = 6;            // hueco mínimo de salón entre dos habitaciones del mismo lateral
const WIDE = 5;           // el salón no tiene pasos ni rincones de menos de 5 casillas
const SALON = 0.3;        // parte del apartamento que, como poco, es salón

// Lado mínimo y máximo de cada habitación, en casillas (al dormitorio le tiene que caber el baño)
const SIZE = { cocina: { min: 7, max: 12 }, dormitorio: { min: 10, max: 15 } };

// Para qué sirve cada habitación. `style` es el estilo de suelo y muebles (APARTMENT_STYLES de config.js).
export const USES = {
  salon:      { name: 'Salón',      style: 'Salón' },
  cocina:     { name: 'Cocina',     style: 'Cocina' },
  bano:       { name: 'Baño',       style: 'Baño' },
  dormitorio: { name: 'Dormitorio', style: 'Dormitorio' },
  jefe:       { name: 'Apartamento destrozado', style: 'Salón' },
};

const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Genera un apartamento.
//   seed        número del que sale todo: con el mismo, sale el mismo apartamento
//   bedrooms    1, 2 o 3 dormitorios (si no se dice, al azar)
//   boss        true = apartamento del jefe, sin tabiques
//   side        en qué lado está la puerta de entrada, la que da al pasillo: 'down' (abajo) o 'up' (arriba)
// Devuelve { cols, rows, w, h, grid, owner, rooms, doors, entrance, spawn, seed }:
//   grid        0 suelo, 1 muro (una casilla por elemento, por filas)
//   owner       a qué habitación pertenece cada casilla (-1 muro, -2 hueco de puerta)
//   rooms       [{ id, use, name, style, c0, r0, w, h, cells, x, y, doors }]  (c0, r0, w, h: el rectángulo que la
//               contiene, en casillas; cells: casillas de suelo; x, y: un punto bien dentro, en unidades).
//               La primera es siempre el salón. Los baños llevan `host` (su dormitorio) y los dormitorios, `bath`.
//   doors       [{ a, b, c, r, w, h }] huecos de puerta entre las habitaciones a y b, en casillas
//   entrance    { c, r, w, h, side } hueco de la puerta de entrada
//   spawn       { x, y } dónde aparece el conserje al entrar
export function makeApartment({ seed = Math.floor(Math.random() * 1e9), bedrooms, boss = false, side = 'down' } = {}) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const apt = tryApartment(rng, boss ? 0 : bedrooms || randInt(rng, 1, 3), boss);
    if (!apt || checkApartment(apt).length) continue;
    if (side === 'up') flip(apt);
    apt.seed = seed;
    apt.attempts = attempt + 1;
    apt.side = side;
    return apt;
  }
  throw new Error(`No se pudo generar el apartamento (semilla ${seed})`);
}

// Reparte la cocina y los dormitorios alrededor del salón, en franjas de izquierda a derecha.
// Cada franja puede llevar una habitación al fondo ('top'), una delante ('low', solo en los laterales),
// dos, una al fondo y otra delante ('both', solo en los laterales), o ninguna ('none': todo salón).
// Devuelve los rectángulos (en casillas, contando desde la esquina del interior) o null si esta vez no cuadra.
function layout(rng, bedrooms, iw, ih) {
  const uses = shuffle(rng, ['cocina', ...Array(bedrooms).fill('dormitorio')]);
  const HOLDS = { none: 0, top: 1, low: 1, both: 2 };
  const ends = ['none', 'top', 'top', 'low', 'both', 'both'];
  const left = pick(rng, ends), right = pick(rng, ends);
  const mid = uses.length - HOLDS[left] - HOLDS[right];
  if (mid < 0) return null;
  const kinds = [left, ...Array(mid).fill('top'), right];
  // a veces el salón llega hasta el fondo entre dos habitaciones (y siempre, si no le queda sitio delante)
  if (rng() < 0.3 || !kinds.some((k) => k === 'top' || k === 'none')) kinds.splice(randInt(rng, 1, kinds.length - 1), 0, 'none');
  const strips = kinds
    .filter((k, i) => !(k === 'none' && kinds[i - 1] === 'none'))
    .map((kind) => ({ kind, uses: uses.splice(0, HOLDS[kind]) }));

  // Anchos: el mínimo de cada franja y lo que sobra se reparte al azar
  let spare = iw - (strips.length - 1);
  for (const s of strips) {
    s.w = s.uses.length ? Math.max(...s.uses.map((u) => SIZE[u].min)) : MIN;
    s.max = s.uses.length ? Math.min(...s.uses.map((u) => SIZE[u].max)) : Infinity;
    spare -= s.w;
  }
  if (spare < 0) return null;
  for (; spare > 0; spare--) {
    const can = strips.filter((s) => s.w < s.max);
    if (!can.length) return null;
    pick(rng, can).w++;
  }

  // Fondos: entre lo que pide cada habitación y lo que deja el salón
  const span = (use, w) => [Math.max(SIZE[use].min, Math.ceil(w / MAX_LONG)), Math.min(SIZE[use].max, Math.floor(w * MAX_LONG))];
  const out = [];
  let c = 0;
  for (const s of strips) {
    const [a, b] = s.uses;
    if (s.kind === 'top' || s.kind === 'low') {
      const [lo, hi] = span(a, s.w);
      const max = Math.min(hi, ih - 1 - (s.kind === 'top' ? HALL : MIN));
      if (max < lo) return null;
      const h = randInt(rng, lo, max);
      out.push({ use: a, c0: c, r0: s.kind === 'top' ? 0 : ih - h, w: s.w, h });
    } else if (s.kind === 'both') {
      const [lo1, hi1] = span(a, s.w), [lo2, hi2] = span(b, s.w);
      let h1, h2;
      if (rng() < 0.35 && ih - lo1 - lo2 - 2 >= GAP) {
        // separadas, con un trozo de salón entre las dos
        h1 = lo1 + randInt(rng, 0, Math.min(hi1 - lo1, ih - lo1 - lo2 - 2 - GAP));
        h2 = lo2 + randInt(rng, 0, Math.min(hi2 - lo2, ih - h1 - lo2 - 2 - GAP));
      } else {
        // juntas, con un tabique entre las dos
        const lo = Math.max(lo1, ih - 1 - hi2), hi = Math.min(hi1, ih - 1 - lo2);
        if (hi < lo) return null;
        h1 = randInt(rng, lo, hi);
        h2 = ih - 1 - h1;
      }
      out.push({ use: a, c0: c, r0: 0, w: s.w, h: h1 }, { use: b, c0: c, r0: ih - h2, w: s.w, h: h2 });
    }
    c += s.w + 1;
  }
  return out;
}

// ¿Es el salón una sola pieza, sin pasos ni rincones estrechos, y lo bastante grande?
function salonOk(owner, cols, rows, id) {
  const is = (c, r) => owner[r * cols + c] === id;
  // cada casilla tiene que caber dentro de algún cuadrado de WIDE × WIDE que sea todo salón
  const covered = new Uint8Array(cols * rows);
  let first = -1, total = 0;
  for (let r = 0; r <= rows - WIDE; r++) {
    next: for (let c = 0; c <= cols - WIDE; c++) {
      for (let dr = 0; dr < WIDE; dr++) for (let dc = 0; dc < WIDE; dc++) if (!is(c + dc, r + dr)) continue next;
      for (let dr = 0; dr < WIDE; dr++) for (let dc = 0; dc < WIDE; dc++) covered[(r + dr) * cols + c + dc] = 1;
    }
  }
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] !== id) continue;
    if (!covered[i]) return false;
    if (first < 0) first = i;
    total++;
  }
  if (total < SALON * (cols - EDGE * 2) * (rows - EDGE * 2)) return false;
  // y se llega andando de cualquier punto a cualquier otro
  const seen = new Uint8Array(cols * rows);
  const stack = [first];
  seen[first] = 1;
  let count = 1;
  while (stack.length) {
    const i = stack.pop(), c = i % cols;
    for (const j of [i - cols, i + cols, c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1]) {
      if (j >= 0 && j < owner.length && owner[j] === id && !seen[j]) { seen[j] = 1; count++; stack.push(j); }
    }
  }
  return count === total;
}

function tryApartment(rng, bedrooms, boss) {
  // Tamaño: más habitaciones, más grande. Siempre en casillas pares para que quede centrado.
  const parts = boss ? 1 : 2 + bedrooms; // salón + cocina + dormitorios
  const cols = boss ? 44 : 20 + parts * 6 + randInt(rng, -1, 1) * 2;
  const rows = boss ? 30 : 20 + parts * 2 + randInt(rng, -1, 1) * 2;
  const iw = cols - EDGE * 2, ih = rows - EDGE * 2;
  const owner = new Int16Array(cols * rows).fill(-1);
  const at = (c, r) => r * cols + c;

  // 1. El salón lo ocupa todo, de momento
  const salon = { id: 0, use: boss ? 'jefe' : 'salon', c0: EDGE, r0: EDGE, w: iw, h: ih, doors: [] };
  const rooms = [salon];
  for (let r = EDGE; r < rows - EDGE; r++) for (let c = EDGE; c < cols - EDGE; c++) owner[at(c, r)] = salon.id;

  if (!boss) {
    // 2. La cocina y los dormitorios, alrededor: primero sus tabiques y luego su suelo
    const plan = layout(rng, bedrooms, iw, ih);
    if (!plan) return null;
    for (const p of plan) rooms.push({ id: rooms.length, use: p.use, c0: p.c0 + EDGE, r0: p.r0 + EDGE, w: p.w, h: p.h, doors: [] });
    for (const rm of rooms.slice(1)) {
      for (let r = rm.r0 - 1; r <= rm.r0 + rm.h; r++) for (let c = rm.c0 - 1; c <= rm.c0 + rm.w; c++) owner[at(c, r)] = -1;
    }
    for (const rm of rooms.slice(1)) {
      for (let r = rm.r0; r < rm.r0 + rm.h; r++) for (let c = rm.c0; c < rm.c0 + rm.w; c++) owner[at(c, r)] = rm.id;
    }
    if (!salonOk(owner, cols, rows, salon.id)) return null;

    // 3. Un baño en cada dormitorio, recortado en la esquina que menos da al salón
    for (const host of rooms.filter((rm) => rm.use === 'dormitorio')) {
      const bw = randInt(rng, 5, Math.min(7, host.w - 5)), bh = randInt(rng, 5, Math.min(6, host.h - 5));
      const corners = shuffle(rng, [[0, 0], [1, 0], [0, 1], [1, 1]]).map(([right, low]) => {
        const c0 = right ? host.c0 + host.w - bw : host.c0, r0 = low ? host.r0 + host.h - bh : host.r0;
        let near = 0; // casillas de salón al otro lado del tabique
        for (let r = r0 - 2; r < r0 + bh + 2; r++) for (let c = c0 - 2; c < c0 + bw + 2; c++) if (owner[at(c, r)] === salon.id) near++;
        return { c0, r0, near };
      });
      const { c0, r0 } = corners.reduce((a, b) => (b.near < a.near ? b : a));
      const bath = { id: rooms.length, use: 'bano', doors: [], host: host.id, c0, r0, w: bw, h: bh };
      host.bath = bath.id;
      // el tabique en L que lo separa del dormitorio
      for (let r = r0 - 1; r <= r0 + bh; r++) {
        for (let c = c0 - 1; c <= c0 + bw; c++) {
          if (c < host.c0 || r < host.r0 || c >= host.c0 + host.w || r >= host.r0 + host.h) continue;
          const inside = c >= c0 && c < c0 + bw && r >= r0 && r < r0 + bh;
          owner[at(c, r)] = inside ? bath.id : -1;
        }
      }
      rooms.push(bath);
    }
  }

  // 4. Qué habitaciones se tocan: tramos de tabique con una habitación a cada lado
  const runs = []; // { a, b, cells: [[c, r], ...], vertical }
  const scan = (vertical) => {
    const outer = vertical ? cols : rows, inner = vertical ? rows : cols;
    for (let o = 1; o < outer - 1; o++) {
      let run = null;
      for (let i = 0; i <= inner; i++) {
        const c = vertical ? o : i, r = vertical ? i : o;
        let a = -1, b = -1;
        if (i < inner && owner[at(c, r)] === -1) {
          a = vertical ? owner[at(c - 1, r)] : owner[at(c, r - 1)];
          b = vertical ? owner[at(c + 1, r)] : owner[at(c, r + 1)];
        }
        if (run && (a !== run.a || b !== run.b)) { runs.push(run); run = null; }
        if (a >= 0 && b >= 0 && a !== b) {
          if (!run) run = { a, b, cells: [], vertical };
          run.cells.push([c, r]);
        }
      }
    }
  };
  scan(true);
  scan(false);
  const usable = runs.filter((rn) => rn.cells.length >= DOOR + 2); // la puerta y una casilla de muro a cada lado
  const between = (a, b) => usable.filter((rn) => (rn.a === a && rn.b === b) || (rn.a === b && rn.b === a));

  const doors = [];
  const open = (a, b) => {
    const rn = pick(rng, between(a, b));
    const s = randInt(rng, 1, rn.cells.length - DOOR - 1);
    const cells = rn.cells.slice(s, s + DOOR);
    for (const [c, r] of cells) owner[at(c, r)] = -2;
    const door = { a, b, c: cells[0][0], r: cells[0][1], w: rn.vertical ? 1 : DOOR, h: rn.vertical ? DOOR : 1 };
    doors.push(door);
    rooms[a].doors.push(door);
    rooms[b].doors.push(door);
  };

  if (!boss) {
    // Del salón se entra a la cocina y a cada dormitorio; al baño, solo desde su dormitorio
    const main = rooms.filter((rm) => rm !== salon && rm.use !== 'bano');
    const baths = rooms.filter((rm) => rm.use === 'bano');
    if (main.some((rm) => !between(salon.id, rm.id).length)) return null;
    if (baths.some((rm) => !between(rm.id, rm.host).length)) return null;
    // A veces, además, una puerta entre dos habitaciones vecinas
    const extra = [];
    for (const a of main) for (const b of main) if (a.id < b.id && between(a.id, b.id).length) extra.push([a.id, b.id]);
    for (const rm of main) open(salon.id, rm.id);
    for (const rm of baths) open(rm.id, rm.host);
    if (extra.length && rng() < 0.5) open(...pick(rng, extra));
  }

  // 5. La puerta de entrada, en un tramo de la pared de delante que dé al salón (casi nunca en el centro)
  const front = rows - EDGE - 1;
  const spots = [];
  for (let c = EDGE; c <= cols - EDGE - DOOR; c++) {
    let ok = true;
    for (let k = -2; k < DOOR + 2; k++) if (owner[at(c + k, front)] !== salon.id) ok = false;
    if (ok) spots.push(c);
  }
  if (!spots.length) return null;
  const ec = pick(rng, spots);
  for (let r = rows - EDGE; r < rows; r++) for (let c = ec; c < ec + DOOR; c++) owner[at(c, r)] = -2;
  const entrance = { c: ec, r: rows - EDGE, w: DOOR, h: EDGE, side: 'down' };

  const grid = new Uint8Array(cols * rows);
  for (let i = 0; i < grid.length; i++) grid[i] = owner[i] === -1 ? 1 : 0;
  const apt = { cols, rows, w: cols * CELL, h: rows * CELL, grid, owner, rooms, doors, entrance, boss };
  describe(apt);
  apt.spawn = { x: (ec + DOOR / 2) * CELL, y: (rows - EDGE - 1.5) * CELL };
  return apt;
}

// Rellena lo que se deduce de la cuadrícula: nombre, estilo, casillas y un punto bien dentro de cada habitación
function describe(apt) {
  const { cols, rows, owner } = apt;
  const get = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? -1 : owner[r * cols + c]);
  // cuántas casillas de la misma habitación tiene alrededor, en todas direcciones (para encontrar el punto más despejado)
  const depth = (c, r, id) => {
    for (let k = 1; ; k++) {
      for (let d = -k; d <= k; d++) {
        if (get(c + d, r - k) !== id || get(c + d, r + k) !== id || get(c - k, r + d) !== id || get(c + k, r + d) !== id) return k - 1;
      }
    }
  };
  for (const rm of apt.rooms) {
    rm.name = USES[rm.use].name;
    rm.style = USES[rm.use].style;
    rm.cells = 0;
    let best = -1;
    for (let r = rm.r0; r < rm.r0 + rm.h; r++) {
      for (let c = rm.c0; c < rm.c0 + rm.w; c++) {
        const i = r * cols + c;
        if (owner[i] !== rm.id) continue;
        rm.cells++;
        const d = depth(c, r, rm.id);
        if (d > best) { best = d; rm.x = (c + 0.5) * CELL; rm.y = (r + 0.5) * CELL; }
      }
    }
  }
  // los dormitorios se numeran si hay más de uno, y cada baño lleva el número del suyo
  const beds = apt.rooms.filter((rm) => rm.use === 'dormitorio');
  if (beds.length > 1) {
    beds.forEach((rm, i) => {
      rm.name = `Dormitorio ${i + 1}`;
      apt.rooms[rm.bath].name = `Baño ${i + 1}`;
    });
  }
}

// Da la vuelta al apartamento de arriba abajo (para los que tienen el pasillo por arriba)
function flip(apt) {
  const { cols, rows } = apt;
  for (const key of ['grid', 'owner']) {
    const src = apt[key], out = new src.constructor(src.length);
    for (let r = 0; r < rows; r++) out.set(src.subarray(r * cols, (r + 1) * cols), (rows - 1 - r) * cols);
    apt[key] = out;
  }
  for (const rm of apt.rooms) { rm.r0 = rows - rm.r0 - rm.h; rm.y = apt.h - rm.y; }
  for (const box of [...apt.doors, apt.entrance]) box.r = rows - box.r - box.h;
  apt.entrance.side = 'up';
  apt.spawn.y = apt.h - apt.spawn.y;
}

// En qué habitación cae un punto (o null si es muro o hueco de puerta)
export function roomAt(apt, x, y) {
  const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
  if (c < 0 || r < 0 || c >= apt.cols || r >= apt.rows) return null;
  return apt.rooms[apt.owner[r * apt.cols + c]] || null;
}

// Repasa que el apartamento está bien hecho. Devuelve la lista de fallos (vacía si todo va bien).
export function checkApartment(apt) {
  const { cols, rows, grid, owner } = apt;
  const bad = [];
  // desde la puerta de entrada se llega andando a todo el suelo
  const seen = new Uint8Array(cols * rows);
  const free = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !grid[r * cols + c];
  const start = apt.entrance.r * cols + apt.entrance.c;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop(), c = i % cols, r = (i - c) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (r + dr) * cols + c + dc;
      if (free(c + dc, r + dr) && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  if (grid.some((g, i) => !g && !seen[i])) bad.push('hay suelo al que no se puede llegar');
  for (const rm of apt.rooms) {
    if (!apt.boss && !rm.doors.length) bad.push(`${rm.use} sin puerta`);
    if (rm.cells < 20) bad.push(`${rm.use} demasiado pequeño`);
  }
  if (!apt.boss) {
    const salon = apt.rooms[0];
    const joined = (a, b) => a.doors.some((d) => (d.a === a.id && d.b === b.id) || (d.a === b.id && d.b === a.id));
    for (const use of ['salon', 'cocina', 'bano', 'dormitorio']) if (!apt.rooms.some((rm) => rm.use === use)) bad.push(`falta ${use}`);
    for (const rm of apt.rooms) {
      // al salón se sale directamente desde la cocina y desde cada dormitorio
      if ((rm.use === 'cocina' || rm.use === 'dormitorio') && !joined(rm, salon)) bad.push(`${rm.use} sin puerta al salón`);
      // cada dormitorio tiene su baño, y al baño solo se entra desde su dormitorio
      if (rm.use === 'dormitorio' && apt.rooms[rm.bath]?.host !== rm.id) bad.push('dormitorio sin baño');
      if (rm.use === 'bano' && (rm.doors.length !== 1 || !joined(rm, apt.rooms[rm.host]))) bad.push('el baño no tiene una sola puerta, la de su dormitorio');
    }
  }
  // el borde del mapa es todo muro menos la puerta de entrada
  for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) if (!grid[r * cols + c] && owner[r * cols + c] !== -2) bad.push('hueco en el muro exterior');
  for (let r = 0; r < rows; r++) for (const c of [0, cols - 1]) if (!grid[r * cols + c]) bad.push('hueco en el muro exterior');
  return bad;
}
