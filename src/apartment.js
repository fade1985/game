// ─────────────────────────────────────────────
//  Generador de apartamentos
//
//  Cada apartamento es un mapa continuo: un rectángulo grande partido en habitaciones (salón, cocina,
//  baño y de 1 a 3 dormitorios) con tabiques y puertas entre ellas. Sale distinto cada vez:
//
//    1. Se parte el rectángulo en trozos con tabiques rectos, en sitios al azar.
//    2. El trozo más grande de los que dan al pasillo es el salón, y ahí va la puerta de entrada.
//       Uno de sus vecinos es la cocina y el resto son dormitorios.
//    3. El baño se recorta en una esquina de otra habitación (que se queda con forma de L).
//    4. Se abren puertas entre habitaciones vecinas hasta que se puede llegar a todas desde el salón.
//
//  El apartamento del jefe es el mismo rectángulo sin tabiques: lo ha reventado todo.
//
//  Usa la misma cuadrícula que shapes.js (casillas de 32 unidades; 0 = suelo, 1 = muro), así que los
//  zombis, las balas y los muebles lo entienden igual que una sala de las de antes.
// ─────────────────────────────────────────────
import { mulberry32 } from './utils.js';

export const CELL = 32;   // lado de una casilla (igual que en shapes.js)
const EDGE = 2;           // grosor del muro exterior, en casillas (64 unidades)
const MIN = 7;            // lado mínimo de una habitación, en casillas
const DOOR = 3;           // ancho de las puertas, en casillas (96 unidades)
const MAX_LONG = 2.2;     // cuántas veces más larga que ancha puede ser una habitación

// Cuánto de alargado es un rectángulo (1 = cuadrado)
const long = (l) => Math.max(l.w, l.h) / Math.min(l.w, l.h);

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

// Genera un apartamento.
//   seed        número del que sale todo: con el mismo, sale el mismo apartamento
//   bedrooms    1, 2 o 3 dormitorios (si no se dice, al azar)
//   boss        true = apartamento del jefe, sin tabiques
//   side        en qué lado está la puerta de entrada, la que da al pasillo: 'down' (abajo) o 'up' (arriba)
// Devuelve { cols, rows, w, h, grid, owner, rooms, doors, entrance, spawn, seed }:
//   grid        0 suelo, 1 muro (una casilla por elemento, por filas)
//   owner       a qué habitación pertenece cada casilla (-1 muro, -2 hueco de puerta)
//   rooms       [{ id, use, name, style, c0, r0, w, h, cells, x, y, doors }]  (c0, r0, w, h: lo que ocupa, en casillas;
//               x, y: un punto bien dentro de la habitación, en unidades)
//   doors       [{ a, b, c, r, w, h }] huecos de puerta entre las habitaciones a y b, en casillas
//   entrance    { c, r, w, h, side } hueco de la puerta de entrada
//   spawn       { x, y } dónde aparece el conserje al entrar
export function makeApartment({ seed = Math.floor(Math.random() * 1e9), bedrooms, boss = false, side = 'down' } = {}) {
  for (let attempt = 0; attempt < 80; attempt++) {
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

function tryApartment(rng, bedrooms, boss) {
  // Tamaño: más habitaciones, más grande. Siempre en casillas pares para que quede centrado.
  const parts = boss ? 1 : 2 + bedrooms; // salón + cocina + dormitorios (el baño se recorta después)
  const cols = boss ? 44 : 20 + parts * 6 + randInt(rng, -1, 1) * 2;
  const rows = boss ? 30 : 20 + parts * 2 + randInt(rng, -1, 1) * 2;
  const owner = new Int16Array(cols * rows).fill(-1);
  const at = (c, r) => r * cols + c;

  // 1. Partir el interior en trozos
  const leaves = [{ c0: EDGE, r0: EDGE, w: cols - EDGE * 2, h: rows - EDGE * 2 }];
  while (leaves.length < parts) {
    const can = leaves.filter((l) => l.w >= MIN * 2 + 1 || l.h >= MIN * 2 + 1);
    if (!can.length) return null;
    // se parte el más grande, y antes los alargados (con algo de azar, para que no salgan siempre igual de repartidos)
    const weight = (l) => l.w * l.h * Math.max(1, long(l) - 0.5) * (0.7 + rng() * 0.6);
    const l = can.map((x) => [weight(x), x]).sort((a, b) => b[0] - a[0])[0][1];
    const canV = l.w >= MIN * 2 + 1, canH = l.h >= MIN * 2 + 1;
    // los alargados se cortan siempre por la mitad de su lado largo; los cuadrados, por donde toque
    const vertical = canV && canH ? (long(l) >= 1.4 || rng() < 0.6) === (l.w >= l.h) : canV;
    leaves.splice(leaves.indexOf(l), 1);
    if (vertical) {
      const k = randInt(rng, MIN, l.w - MIN - 1); // el tabique ocupa la columna k
      leaves.push({ c0: l.c0, r0: l.r0, w: k, h: l.h }, { c0: l.c0 + k + 1, r0: l.r0, w: l.w - k - 1, h: l.h });
    } else {
      const k = randInt(rng, MIN, l.h - MIN - 1);
      leaves.push({ c0: l.c0, r0: l.r0, w: l.w, h: k }, { c0: l.c0, r0: l.r0 + k + 1, w: l.w, h: l.h - k - 1 });
    }
  }
  // nada de habitaciones con forma de pasillo
  if (!boss && leaves.some((l) => long(l) > MAX_LONG)) return null;
  const rooms = leaves.map((l, id) => ({ id, use: 'dormitorio', ...l, doors: [] }));
  for (const rm of rooms) {
    for (let r = rm.r0; r < rm.r0 + rm.h; r++) for (let c = rm.c0; c < rm.c0 + rm.w; c++) owner[at(c, r)] = rm.id;
  }

  // 2. El salón: el más grande de los que tocan la pared del pasillo (la de abajo)
  const front = rooms.filter((rm) => rm.r0 + rm.h === rows - EDGE && rm.w >= DOOR + 4);
  if (!front.length) return null;
  const salon = front.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  salon.use = boss ? 'jefe' : 'salon';

  if (!boss) {
    // 3. El baño, recortado en una esquina de otra habitación (mejor en un dormitorio o en el salón)
    // tiene que caber un baño de 5×5 y que a la habitación le quede sitio de sobra
    const hosts = rooms.filter((rm) => rm.w >= 13 && rm.h >= 11);
    if (!hosts.length) return null;
    const host = pick(rng, hosts);
    const bw = randInt(rng, 5, Math.min(7, host.w - MIN - 1)), bh = randInt(rng, 5, Math.min(6, host.h - 6));
    // en el salón, nunca en las esquinas de abajo: ahí va la puerta de entrada
    const top = host === salon ? true : rng() < 0.5, left = rng() < 0.5;
    const bath = {
      id: rooms.length, use: 'bano', doors: [], host: host.id,
      c0: left ? host.c0 : host.c0 + host.w - bw, r0: top ? host.r0 : host.r0 + host.h - bh, w: bw, h: bh,
    };
    // el tabique en L que lo separa de la habitación de la que sale
    for (let r = bath.r0 - 1; r <= bath.r0 + bh; r++) {
      for (let c = bath.c0 - 1; c <= bath.c0 + bw; c++) {
        if (c < host.c0 || r < host.r0 || c >= host.c0 + host.w || r >= host.r0 + host.h) continue;
        const inside = c >= bath.c0 && c < bath.c0 + bw && r >= bath.r0 && r < bath.r0 + bh;
        owner[at(c, r)] = inside ? bath.id : -1;
      }
    }
    rooms.push(bath);
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
    // Desde el salón se va abriendo paso a todas las demás (el baño aparte: solo se entra por su habitación)
    const main = rooms.filter((rm) => rm.use !== 'bano');
    const reached = new Set([salon.id]);
    const queue = [salon];
    const linked = new Set();
    while (queue.length) {
      const rm = queue.shift();
      const next = main.filter((o) => !reached.has(o.id) && between(rm.id, o.id).length);
      for (const o of next.sort(() => rng() - 0.5)) {
        reached.add(o.id);
        linked.add(`${Math.min(rm.id, o.id)}-${Math.max(rm.id, o.id)}`);
        open(rm.id, o.id);
        queue.push(o);
      }
    }
    if (reached.size < main.length) return null;
    // A veces una puerta de más, para poder dar la vuelta y que no todo sean callejones
    const extra = [];
    for (const a of main) for (const b of main) {
      if (a.id < b.id && !linked.has(`${a.id}-${b.id}`) && between(a.id, b.id).length) extra.push([a.id, b.id]);
    }
    if (extra.length && rng() < 0.5) open(...pick(rng, extra));

    const bath = rooms[rooms.length - 1];
    if (!between(bath.id, bath.host).length) return null;
    open(bath.id, bath.host);

    // La cocina: una habitación pegada al salón (si puede ser, la más pequeña); el resto son dormitorios
    const nearSalon = main.filter((rm) => rm !== salon && linked.has(`${Math.min(rm.id, salon.id)}-${Math.max(rm.id, salon.id)}`));
    if (!nearSalon.length) return null;
    nearSalon.sort((a, b) => a.w * a.h - b.w * b.h);
    nearSalon[rng() < 0.7 ? 0 : Math.floor(rng() * nearSalon.length)].use = 'cocina';
  }

  // 5. La puerta de entrada, en la pared de abajo del salón (casi nunca en el centro)
  const ec = randInt(rng, salon.c0 + 2, salon.c0 + salon.w - DOOR - 2);
  for (let r = rows - EDGE; r < rows; r++) for (let c = ec; c < ec + DOOR; c++) owner[at(c, r)] = -2;
  const entrance = { c: ec, r: rows - EDGE, w: DOOR, h: EDGE, side: 'down' };
  if (owner[at(ec, rows - EDGE - 1)] !== salon.id || owner[at(ec + DOOR - 1, rows - EDGE - 1)] !== salon.id) return null;

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
  // los dormitorios se numeran si hay más de uno
  const beds = apt.rooms.filter((rm) => rm.use === 'dormitorio');
  if (beds.length > 1) beds.forEach((rm, i) => { rm.name = `Dormitorio ${i + 1}`; });
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
    for (const use of ['salon', 'cocina', 'bano', 'dormitorio']) if (!apt.rooms.some((rm) => rm.use === use)) bad.push(`falta ${use}`);
    if (apt.rooms.filter((rm) => rm.use === 'bano').some((rm) => rm.doors.length !== 1)) bad.push('el baño tiene más de una puerta');
  }
  // el borde del mapa es todo muro menos la puerta de entrada
  for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) if (!grid[r * cols + c] && owner[r * cols + c] !== -2) bad.push('hueco en el muro exterior');
  for (let r = 0; r < rows; r++) for (const c of [0, cols - 1]) if (!grid[r * cols + c]) bad.push('hueco en el muro exterior');
  return bad;
}
