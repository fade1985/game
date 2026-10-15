// ─────────────────────────────────────────────
//  Bot de pruebas: juega solo para medir el equilibrado
//
//  No es parte del juego. Se carga desde la consola del navegador, con el juego abierto:
//
//    const { runBot } = await import('/tools/bot.js');
//    await runBot(game, { runs: 5 });       // devuelve un resumen por planta
//
//  Maneja al conserje pulsando las teclas de verdad (WASD), así que pasa por los mismos controles
//  que un jugador. Juega de forma sencilla: va a por el zombi despierto más cercano, se queda a la
//  distancia de su arma, se aparta de lo que avisa (mecha, tentáculo, charcos) y, cuando no hay
//  nadie, explora la habitación a oscuras más cercana. Juega peor que una persona con práctica:
//  sus números sirven para comparar, no como verdad absoluta.
//
//  Para medir cada apartamento por separado, le rellena la vida al cruzar cada puerta y apunta
//  cuánta ha perdido dentro (opción `refill: false` para jugar una partida de verdad).
// ─────────────────────────────────────────────
import { wayTo, lineClear, CELL } from '../src/shapes.js';

const WALL = 64;
const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const held = new Set();

function press(code, on) {
  if (on === held.has(code)) return;
  if (on) held.add(code); else held.delete(code);
  window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code }));
}

// Mueve al conserje en la dirección (x, y), con las ocho direcciones del teclado
function steer(x, y) {
  const l = Math.hypot(x, y);
  const nx = l > 0.01 ? x / l : 0, ny = l > 0.01 ? y / l : 0;
  press(KEYS.left, nx < -0.38);
  press(KEYS.right, nx > 0.38);
  press(KEYS.up, ny < -0.38);
  press(KEYS.down, ny > 0.38);
}

const releaseAll = () => { for (const c of [...held]) press(c, false); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Dirección para ir andando hasta un punto, rodeando tabiques y muebles
function toward(game, target) {
  const p = game.player;
  const way = wayTo(game.room.layout, p, target);
  if (way) return way;
  const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

// El punto de una puerta del muro de fuera hacia el que hay que empujar para cruzarla
function exitPoint(game, ex) {
  if (ex.dir === 'up') return { x: ex.at, y: WALL };
  if (ex.dir === 'down') return { x: ex.at, y: game.rh - WALL };
  if (ex.dir === 'left') return { x: WALL, y: ex.at };
  return { x: game.rw - WALL, y: ex.at };
}

// ¿De qué hay que apartarse ahora mismo? Devuelve una dirección de huida o null
function danger(game) {
  const p = game.player;
  let fx = 0, fy = 0;
  const away = (x, y, w = 1) => { const d = Math.hypot(p.x - x, p.y - y) || 1; fx += ((p.x - x) / d) * w; fy += ((p.y - y) / d) * w; };
  for (const e of game.enemies) {
    if (e.fuse > 0 && dist(e, p) < 150) away(e.x, e.y, 3);                       // mecha encendida
    if (e.tent && e.tent.phase === 'warn') {                                    // tentáculo: salir de la línea
      const ex = Math.cos(e.tent.angle), ey = Math.sin(e.tent.angle);
      const rx = p.x - e.x, ry = p.y - e.y, along = rx * ex + ry * ey, off = rx * -ey + ry * ex;
      if (along > -20 && along < 260 && Math.abs(off) < 50) { const s = off >= 0 ? 1 : -1; fx += -ey * s * 3; fy += ex * s * 3; }
    }
    if (e.isBoss && e.state && /Warn$|^charge$|^spin$/.test(e.state.name) && dist(e, p) < 230) away(e.x, e.y, 2);
  }
  for (const lb of game.lobs) if (Math.hypot(p.x - lb.tx, p.y - lb.ty) < 80) away(lb.tx, lb.ty, 2);
  for (const hz of game.hazards) if (dist(hz, p) < hz.r + 30) away(hz.x, hz.y, 2);
  for (const b of game.bullets) if (!b.friendly && dist(b, p) < 90) { fx += -b.vy; fy += b.vx; }
  return fx || fy ? { x: fx, y: fy } : null;
}

// Decide hacia dónde andar en este instante
function think(game, memo) {
  const p = game.player, room = game.room, floor = game.floor;
  const run = danger(game);
  const foes = game.enemies.filter((e) => e.active && !e.asleep && !game.hidden(e));

  if (foes.length) {
    // pelea: al más cercano, a la distancia justa de su arma
    const e = foes.reduce((a, b) => (dist(b, p) < dist(a, p) ? b : a));
    const w = p.weapon;
    const melee = w.type === 'melee';
    const want = melee ? w.reach * 0.8 : Math.min(260, (w.range || 300) * 0.6);
    const gap = dist(e, p) - e.r;
    const sees = lineClear(room.layout, p.x, p.y, e.x, e.y);
    let dir;
    if (!sees || gap > want) dir = toward(game, e);
    else if (gap < want - 22) { const d = dist(e, p) || 1; dir = { x: (p.x - e.x) / d, y: (p.y - e.y) / d }; }
    else { const d = dist(e, p) || 1; dir = { x: (-(e.y - p.y) / d) * memo.side, y: ((e.x - p.x) / d) * memo.side }; }
    // si se le echan encima varios, retrocede
    const close = foes.filter((f) => dist(f, p) < f.r + p.r + 34);
    if (close.length >= 2 || (close.length && !melee)) {
      const cx = close.reduce((s, f) => s + f.x, 0) / close.length, cy = close.reduce((s, f) => s + f.y, 0) / close.length;
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      dir = { x: (p.x - cx) / d, y: (p.y - cy) / d };
    }
    if (run) return { x: dir.x * 0.4 + run.x, y: dir.y * 0.4 + run.y };
    return dir;
  }
  if (run) return run;

  // sin nadie a la vista
  if (!room.cleared) {
    // a por el dormido o la habitación a oscuras más cercanos
    // (elegido uno, va a por ese hasta que despierte: si no, dudaría entre dos que quedan en direcciones opuestas)
    const left = game.enemies.filter((e) => e.active);
    if (!left.length) return { x: 0, y: 0 };
    if (!left.includes(memo.goal)) memo.goal = left.reduce((a, b) => (dist(b, p) < dist(a, p) ? b : a));
    return toward(game, memo.goal);
  }
  // limpio: recoger lo que haya (la llave, el superviviente, corazones si hacen falta) y salir
  const prop = room.props.find((pr) => !pr.taken && (pr.kind === 'doorkey' || (pr.kind === 'survivor' && game.allies.length < 4)));
  if (prop) return toward(game, prop);
  // corazones (si hacen falta) y billetes, solo los que tiene cerca y a la vista: los que caen detrás de un mueble se quedan
  const near = (pk) => dist(pk, p) < 280 && lineClear(room.layout, p.x, p.y, pk.x, pk.y);
  const loot = game.pickups.find((pk) => (pk.kind === 'cash' || p.hp < game.stats.maxHp) && near(pk));
  if (loot && !memo.skipLoot) return toward(game, loot);

  let ex;
  if (room === floor.corridor) {
    const door = (r) => room.exits.find((x) => x.to === r);
    if (!floor.stairs.locked) ex = floor.stairs;
    else if (floor.hasKey || floor.keyUsed) ex = door(floor.boss);
    else ex = door(floor.apartments.find((r) => r.type === 'apartment' && !r.cleared));
  } else ex = room.exits.find((x) => x.to);
  if (!ex) return { x: 0, y: 0 };
  const pt = exitPoint(game, ex);
  // delante de la puerta primero y luego contra ella, para no quedarse rozando el marco
  const front = { x: pt.x + (ex.dir === 'left' ? 60 : ex.dir === 'right' ? -60 : 0), y: pt.y + (ex.dir === 'up' ? 60 : ex.dir === 'down' ? -60 : 0) };
  if (dist(front, p) > 26 && !memo.atDoor) return toward(game, front);
  memo.atDoor = 40;
  return { x: pt.x - p.x, y: pt.y - p.y };
}

// Juega `runs` partidas y devuelve un resumen por planta y por tipo de mapa.
//   refill    rellenar la vida al cruzar cada puerta (true: mide cada apartamento por separado)
//   skipBoss  acabar con los jefes nada más entrar (el bot pelea mal contra ellos y así llega a todas las plantas)
//   maxTime   segundos de juego por partida. Si pasa un minuto sin avanzar nada, la partida se da por
//             atascada (`jammed`); con `keep`, se deja abierta para poder mirarla
export async function runBot(game, { runs = 3, refill = true, skipBoss = false, maxTime = 1500, weapon = null, keep = false } = {}) {
  const render = game.render;
  game.render = () => {};
  const rows = [];   // un apunte por mapa visitado
  const ends = [];
  try {
    for (let n = 0; n < runs; n++) {
      game.newRun();
      if (weapon) game.player.weapon = weapon;
      const memo = { side: 1, atDoor: 0 };
      let cur = null, last = game.player.hp, stuck = 0, sx = 0, sy = 0, jig = 0, jdir = null;
      let mark = '', idle = 0, jammed = false; // para notar si lleva un minuto sin avanzar nada
      const open = () => { cur = { floor: game.floorNum, type: game.room.type, name: game.room.name, n: game.room.horde.length, t: 0, dmg: 0, room: game.room }; rows.push(cur); };
      open();
      for (let tick = 0; tick < maxTime * 60 && game.state === 'playing'; tick++) {
        if (game.room !== cur.room) {
          if (refill) game.player.hp = game.stats.maxHp;
          last = game.player.hp;
          memo.atDoor = 0;
          open();
        }
        const p = game.player;
        const now = `${game.kills} ${game.floorNum} ${game.room.name} ${game.room.cleared} ${game.floor.hasKey} ${game.allies.length}`;
        idle = now === mark ? idle + 1 : 0;
        memo.skipLoot = idle > 8 * 60; // si no consigue coger algo del suelo, lo deja
        mark = now;
        if (idle > 60 * 60) { jammed = true; break; }
        if (p.hp < last) cur.dmg += last - p.hp;
        last = p.hp;
        if (!game.room.cleared) cur.t += 1 / 60;
        if (skipBoss && cur.t > 1.5) for (const e of [...game.enemies]) if (e.isBoss) game.killEnemy(e);
        if (memo.atDoor > 0) memo.atDoor--;
        if (tick % 90 === 0) memo.side = Math.random() < 0.5 ? -1 : 1;
        // si lleva un rato sin moverse del sitio, un meneo al azar
        if (tick % 45 === 0) {
          stuck = Math.hypot(p.x - sx, p.y - sy) < 6 ? stuck + 1 : 0;
          sx = p.x; sy = p.y;
          if (stuck >= 3) { jig = 25; const a = Math.random() * 6.28; jdir = { x: Math.cos(a), y: Math.sin(a) }; stuck = 0; }
        }
        const dir = jig-- > 0 ? jdir : think(game, memo);
        steer(dir.x, dir.y);
        game.update(1 / 60);
      }
      releaseAll();
      ends.push({ state: game.state, floor: game.floorNum, dead: game.player.dead, jammed, time: Math.round(game.runTime) });
      if (game.state !== 'over') {
        if (keep) break; // se ha atascado: se deja la partida como está para poder mirarla
        game.endRun(false, true);
      }
    }
  } finally {
    releaseAll();
    game.render = render;
  }
  // resumen: media por planta de lo que cuesta cada cosa
  const sum = {};
  for (const r of rows) {
    if (r.type === 'corridor' || r.type === 'maintenance' || !r.t) continue;
    const k = `${r.floor} ${r.type}`;
    const s = sum[k] || (sum[k] = { veces: 0, zombis: 0, segundos: 0, vida: 0 });
    s.veces++; s.zombis += r.n; s.segundos += r.t; s.vida += r.dmg;
  }
  const table = Object.entries(sum).sort().map(([k, s]) => `${k}: ×${s.veces} · ${(s.zombis / s.veces).toFixed(1)} zombis · ${(s.segundos / s.veces).toFixed(0)} s · ${(s.vida / s.veces).toFixed(0)} de vida`);
  return { table, ends, rows };
}
