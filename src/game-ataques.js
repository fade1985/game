// ─────────────────────────────────────────────
//  Ataques especiales de los zombis y los jefes: explosiones, tentáculos, ondas, proyectiles en
//  parábola, charcos y el rastro de sangre (su lógica y su dibujo).
//
//  Son métodos de Game: game.js los añade a la clase, así que dentro "this" es la partida.
// ─────────────────────────────────────────────
import { WALL, OUTLINE, PIXEL } from './config.js';
import { rand, clamp, dist } from './utils.js';
import { BLEACH, ACIDO, drawBottle } from './jefe-portera.js';
import { POISON, TENTACLE } from './zombies.js';
import { drawSprite } from './sprites.js';
import { sfx } from './sfx.js';
import { destello } from './luz.js';
import { MOLOTOV, drawMolotov } from './molotov.js';
import { ESTILO_VENENO, ESTILO_LEJIA, crearCharco, drawCharco, dentro, leaveStain } from './charcos.js';
import { pisar, actualizarEstados, herirZombi, efectosEstados } from './estados.js';
import { MUT } from './mutaciones.js';

// Rastro de sangre del zombi lento: cada cuánto deja una mancha, cuánto dura y cuánto tarda en borrarse al final
const TRAIL = { step: 9, life: 8, fade: 2.5, max: 400, color: '#680c06', dark: '#4a0804' };

// Charcos que dejan los proyectiles en parábola: moco venenoso, lejía y el fuego del molotov de Johnny.
// `estados`: lo que te hace pisarlo (estados.js), con los números propios de este charco si los cambia
const HAZARDS = {
  fire: { ...MOLOTOV, estados: { fuego: { dps: MOLOTOV.dps } }, fill: 'rgba(255, 159, 28, 0.3)' },
  poison: { ...POISON, estados: { veneno: {} }, estilo: ESTILO_VENENO, fill: '#8fd13f', stroke: '#4f772d', bubble: '#c7f27a', drop: '#9be33b' },
  bleach: { ...BLEACH, estados: { resbaladizo: {}, toxico: { dps: 3 } }, estilo: ESTILO_LEJIA, fill: '#e9f8ff', stroke: '#2f86c4', bubble: '#ffffff', drop: '#4cb4f0' },
  // el ácido que salpica la portera con la fregona: quema al pisarlo y deja veneno al salir
  acido: { ...ACIDO, estados: { acido: {}, veneno: {} }, estilo: { ...ESTILO_VENENO, life: ACIDO.life }, drop: '#c7e04a' },
  // el vómito de Johnny (mutación Gastroenteritis): solo les hace daño a los zombis
  vomito: { radius: MUT.gastro.radio, life: MUT.gastro.dura, flight: 0.45, estados: { acido: { dps: MUT.gastro.dps } }, estilo: ESTILO_VENENO, soloZombis: true, drop: '#c7e04a' },
  // la lluvia ácida de la arrojadiza creada: lo mismo, pero más grande (el radio lo pone armas-creadas.js) y más larga
  lluvia: { radius: 150, life: 7, estados: { acido: { dps: 10 } }, estilo: { ...ESTILO_VENENO, life: 7 }, soloZombis: true, drop: '#c7e04a' },
};

// Dado propio para lo que es solo de adorno (chispas, mancha): no gasta tiradas de rand(), así que no
// cambia cómo juega la partida ni la huella del test
let semilla = 12345;
function azar(a, b) {
  semilla = (semilla * 16807) % 2147483647;
  return a + (b - a) * (semilla / 2147483647);
}

// Marca negra de quemado que deja la explosión en el suelo, en pixel art (cuadraditos de PIXEL).
// Se dibujan unas pocas una sola vez y se guardan; cada explosión coge una al azar.
const QUEMADOS = {};
function dibujarQuemado(n, seed) {
  semilla = seed;
  const ondas = [3, 5, 8].map((k) => [k, azar(0, 6.28), azar(0.06, 0.14)]);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  const mid = n / 2;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const dx = px + 0.5 - mid, dy = (py + 0.5 - mid) / 0.75; // un poco aplastada: el suelo se ve de lado
      const ang = Math.atan2(dy, dx);
      let r = 1;
      for (const [k, f, m] of ondas) r += m * Math.sin(k * ang + f);
      const d = Math.hypot(dx, dy) / (mid * 0.92 * r);
      if (d > 1) continue;
      // centro casi negro, borde salpicado (cada vez menos cuadraditos hacia fuera)
      if (d > 0.8 && azar(0, 1) < (d - 0.8) * 4) continue;
      x.fillStyle = d < 0.45 ? 'rgba(14,10,16,0.8)' : d < 0.8 ? 'rgba(24,19,26,0.6)' : 'rgba(34,28,34,0.35)';
      if (d < 0.6 && azar(0, 1) < 0.05) x.fillStyle = 'rgba(90,82,88,0.55)'; // motas de ceniza
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}
function marcaQuemado(game, x, y, radius) {
  const decals = game.room && game.room.decals;
  if (!decals || typeof document === 'undefined') return;
  const n = Math.round((radius * 1.1) / PIXEL);
  const v = Math.floor(azar(0, 3));
  const key = n + ':' + v;
  if (!QUEMADOS[key]) {
    const guardada = semilla;
    QUEMADOS[key] = dibujarQuemado(n, 777 + v * 1000);
    semilla = guardada;
  }
  decals.push({ x, y, img: QUEMADOS[key], w: n * PIXEL, h: n * PIXEL });
  game.room.decalCount = (game.room.decalCount || 0) + 1;
  if (decals.length > 60) decals.shift();
}

export class ZombieAttacks {
  // Explosión: daña al jugador y TAMBIÉN a los demás zombis (¡reacciones en cadena!)
  // `dmgZombis`: el daño a los zombis, si es distinto del que recibe Johnny (la granada con Puntería)
  explode(x, y, radius, dmg, source, dmgZombis = dmg) {
    sfx.boom();
    this.shake(14);
    destello(this, x, y, Math.max(200, radius * 2.5), 0.4); // la explosión ilumina toda la zona
    destello(this, x, y, Math.max(160, radius * 1.8), 1.2, 0.5); // y el resplandor del fuego tarda en apagarse
    // la bola de fuego, un poco más grande que el sprite (1,25x; la granada, que llega más lejos, 1,5x)
    const sprite = this.fx('objeto-fx-explosion', x, y, { scale: radius > 96 ? 1.5 : 1.25 });
    // Ojo: aquí se tira rand() siempre las mismas veces (4 por vuelta), para que la huella del test no
    // cambie; lo que es solo de adorno usa su propio dado (azar), que no toca la partida.
    for (let i = 0; i < (sprite ? 10 : 26); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 320);
      const r = sprite ? rand(3, 6) : rand(6, 14), life = rand(0.35, 0.7);
      if (sprite) {
        // chispas: cuadraditos de pixel art que salen disparados
        const c = ['#fffbe0', '#ffe066', '#ffb020', '#f0701a'][i % 4];
        this.particles.push({ x, y, vx: Math.cos(a) * sp * 1.7, vy: Math.sin(a) * sp * 1.7, px: true, size: r > 4.5 ? 3 : 2, color: c, life: life * 0.7, max: 0.5 });
      } else {
        const c = ['#ffd23f', '#ff9f1c', '#ff5d3c', '#5d5873'][i % 4];
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, color: c, life, max: 0.7, outline: true });
      }
    }
    if (sprite) {
      // trozos oscuros que vuelan más despacio y ascuas que suben
      for (let i = 0; i < 6; i++) {
        const a = azar(0, Math.PI * 2), sp = azar(90, 220), d = azar(14, 24);
        this.particles.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, px: true, size: 2, color: i % 2 ? '#2b2633' : '#5d5873', life: azar(0.45, 0.8), max: 0.8 });
      }
      for (let i = 0; i < 10; i++) {
        this.particles.push({ x: x + azar(-36, 36), y: y + azar(-24, 24), vx: azar(-25, 25), vy: azar(-80, -35), px: true, size: i < 4 ? 2 : 1, color: i % 2 ? '#ffb020' : '#ff5d3c', life: azar(0.7, 1.5), max: 1.5 });
      }
      // más chispas, largas y rápidas, que llegan lejos
      for (let i = 0; i < 16; i++) {
        const a = azar(0, Math.PI * 2), sp = azar(380, 720);
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, px: true, size: i % 3 ? 2 : 3, color: ['#ffffff', '#fffbe0', '#ffe066', '#ffb020'][i % 4], life: azar(0.3, 0.6), max: 0.6 });
      }
      // dos estallidos más pequeños alrededor, un pelín después (la explosión "retumba")
      const a0 = azar(0, Math.PI * 2);
      for (let i = 0; i < 2; i++) {
        const a = a0 + i * Math.PI + azar(-0.6, 0.6), d = radius * azar(0.35, 0.5);
        this.fx('objeto-fx-explosion', x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75, { wait: 0.1 + i * 0.09, scale: 0.75 });
      }
      // y humo: cuadraditos grises que suben despacio y encogen
      for (let i = 0; i < 14; i++) {
        const a = azar(0, Math.PI * 2), d = radius * azar(0.1, 0.7);
        this.particles.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.75, vx: azar(-15, 15), vy: azar(-55, -25), px: true, size: Math.round(azar(3, 6)), color: ['#3a3542', '#4d4857', '#5d5873'][i % 3], life: azar(0.9, 1.6), max: 1.6 });
      }
    } else this.particles.push({ x, y, vx: 0, vy: 0, r: radius * 0.6, ring: true, color: '#ffd23f', life: 0.35, max: 0.35 });
    marcaQuemado(this, x, y, radius);
    const p = this.player;
    if (!p.dead && dist(p, { x, y }) <= radius + p.r) p.hurt(dmg, this);
    for (const e of this.enemies) {
      if (e === source || !e.active) continue;
      const d = dist(e, { x, y });
      if (d <= radius + e.r) e.hurt(dmgZombis, false, (e.x - x) / (d || 1), (e.y - y) / (d || 1), this, 2.2);
    }
  }

  // Latigazo de tentáculo: golpea todo lo que haya en la línea marcada
  tentacleHit(src, angle) {
    const p = this.player;
    if (p.dead) return;
    const ex = Math.cos(angle), ey = Math.sin(angle);
    const rx = p.x - src.x, ry = p.y - src.y;
    const along = clamp(rx * ex + ry * ey, 0, TENTACLE.range);
    const off = Math.hypot(rx - ex * along, ry - ey * along);
    if (off <= TENTACLE.width + p.r) p.hurt(TENTACLE.dmg, this);
    this.shake(5);
  }

  // La portera pasa a la fase 2: borra las balas y te aparta de un grito
  bossRage(boss) {
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.banner = { title: '¡QUE ACABO DE FREGAR!', sub: 'La portera se ha enfadado de verdad', t: 0 };
    sfx.roar();
    const p = this.player;
    const d = dist(p, boss);
    if (!p.dead && d < 260) { p.vx += ((p.x - boss.x) / (d || 1)) * 900; p.vy += ((p.y - boss.y) / (d || 1)) * 900; }
    this.shake(18);
    this.particles.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, r: 120, ring: true, color: '#ffd23f', life: 0.45, max: 0.45 });
  }

  // Proyectil en parábola hacia donde estaba el jugador (moco o botella de lejía)
  lob(x, y, tx, ty, kind = 'poison') {
    tx = clamp(tx, WALL + 30, this.rw - WALL - 30);
    ty = clamp(ty, WALL + 30, this.rh - WALL - 30);
    this.lobs.push({ x0: x, y0: y, tx, ty, t: 0, kind });
  }

  updateHazards(dt) {
    const p = this.player;
    for (const lb of this.lobs) {
      lb.t += dt;
      const hd = HAZARDS[lb.kind];
      if (lb.t >= hd.flight) {
        // ¡splash! deja un charco
        lb.done = true;
        if (lb.kind === 'fire') { this.molotovLand(lb); continue; }
        this.hazards.push(crearCharco(lb, lb.kind, hd.estilo, hd, rand(0, 6)));
        for (let i = 0; i < 8; i++) {
          const a = rand(0, Math.PI * 2), sp = rand(60, 160);
          this.particles.push({ x: lb.tx, y: lb.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 6), color: hd.drop, life: 0.4, max: 0.4, outline: true });
        }
        if (lb.kind === 'bleach') sfx.glass(); else sfx.splat();
        if (!hd.soloZombis && !p.dead && dist(p, { x: lb.tx, y: lb.ty }) < hd.radius + p.r * 0.5) p.hurt(hd.hit, this);
      }
    }
    this.lobs = this.lobs.filter((lb) => !lb.done);
    // Lo que pisa cada uno este fotograma (Johnny y los zombis): solo cuenta donde se ve el charco
    // (no antes de que llegue ni donde ya se secó), y la esquiva lo cruza sin que te pase nada
    const pisaJohnny = {}, pisaZombis = new Map();
    for (const hz of this.hazards) {
      hz.life -= dt;
      const hd = HAZARDS[hz.kind];
      if (!hd.soloZombis && !p.dead && p.dashT <= 0 && dentro(hz, p.x, p.y, p.r * 0.3)) pisar(pisaJohnny, hd.estados);
      for (const e of this.enemies) {
        if (!e.active || e.isBoss || !dentro(hz, e.x, e.y, e.r * 0.3)) continue;
        if (!pisaZombis.has(e)) pisaZombis.set(e, {});
        pisar(pisaZombis.get(e), hd.estados, true);
      }
      // el fuego, además, prende a los zombis y suelta chispas (y deja su ceniza él mismo)
      if (hz.kind === 'fire') this.burnFire(hz, dt);
      else if (hz.life <= 0) leaveStain(this, hz);
    }
    this.hazards = this.hazards.filter((hz) => hz.life > 0);
    // los estados: se renuevan pisando y duran un rato al salir (estados.js)
    if (!p.dead) {
      const d = actualizarEstados(p, pisaJohnny, dt);
      if (d > 0) p.poison(d, this, p.colorEstado);
      efectosEstados(this, p, dt);
    }
    for (const e of this.enemies) {
      if (!e.active || e.isBoss || (!e.estados && !pisaZombis.has(e))) continue;
      herirZombi(e, actualizarEstados(e, pisaZombis.get(e) || {}, dt), dt, this);
      efectosEstados(this, e, dt);
    }
    for (const t of this.trail) t.life -= dt;
    if (this.trail.length && this.trail[0].life <= 0) this.trail = this.trail.filter((t) => t.life > 0);
  }

  // Gastroenteritis (mutaciones.js): Johnny lanza el vómito en parábola hacia un zombi; al caer deja el charco
  lanzarVomito(x, y, tx, ty) {
    this.lob(x, y, tx, ty, 'vomito');
    sfx.splat();
  }

  // Charco de ácido en (x, y) (el que deja el desintegrador, armas-creadas.js)
  vomitar(x, y) {
    const hd = HAZARDS.vomito;
    const lb = { x0: x, y0: y - 1, tx: x, ty: y };
    this.hazards.push(crearCharco(lb, 'vomito', hd.estilo, hd, rand(0, 6)));
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(40, 120);
      this.particles.push({ x, y: y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, px: true, size: 3, color: hd.drop, life: 0.35, max: 0.35 });
    }
    sfx.splat();
  }

  // Lluvia ácida (armas-creadas.js): un charco de ácido grande y duradero que solo daña a los zombis
  charcoLluvia(x, y, radio) {
    const hd = { ...HAZARDS.lluvia, radius: radio };
    const lb = { x0: x, y0: y - 1, tx: x, ty: y };
    this.hazards.push(crearCharco(lb, 'lluvia', hd.estilo, hd, rand(0, 6)));
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 200);
      this.particles.push({ x, y: y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 50, px: true, size: 3, color: hd.drop, life: 0.45, max: 0.45 });
    }
    sfx.splat();
  }

  // Flatulento (mutaciones.js): una nube verdosa que sale de Johnny y se deshace
  gases(x, y, radius) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.6, 1.1) * radius * 1.6;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 20, px: true, size: Math.round(rand(3, 6)), color: ['#b5c94a', '#8a9a3a', '#d8e07a'][i % 3], life: 0.6, max: 0.6 });
    }
    sfx.sizzle();
  }

  // El zombi lento deja un rastro de sangre al arrastrarse: una mancha cada pocos pasos, que se va secando
  dropTrail(e) {
    if (e.trailX === undefined) { e.trailX = e.x; e.trailY = e.y; return; }
    if (Math.hypot(e.x - e.trailX, e.y - e.trailY) < TRAIL.step) return;
    e.trailX = e.x; e.trailY = e.y;
    this.trail.push({ x: e.x + rand(-3, 3), y: e.y + 6 + rand(-2, 2), life: TRAIL.life, seed: Math.floor(rand(0, 4)) });
    if (this.trail.length > TRAIL.max) this.trail.shift();
  }

  drawTrail(ctx) {
    for (const t of this.trail) {
      if (this.hidden(t)) continue;
      // en píxeles enteros del dibujo, como el resto del suelo
      const x = Math.round(t.x / PIXEL) * PIXEL, y = Math.round(t.y / PIXEL) * PIXEL, u = PIXEL;
      ctx.globalAlpha = 0.75 * Math.min(1, t.life / TRAIL.fade);
      ctx.fillStyle = TRAIL.dark;
      ctx.fillRect(x - 3 * u, y - u, 6 * u, 3 * u);
      ctx.fillStyle = TRAIL.color;
      ctx.fillRect(x - 2 * u, y, 4 * u, u);
      // una gota suelta, a un lado u otro
      ctx.fillStyle = TRAIL.dark;
      ctx.fillRect(x + (t.seed % 2 ? 4 : -5) * u, y + (t.seed > 1 ? 2 * u : -2 * u), u, u);
    }
    ctx.globalAlpha = 1;
  }

  drawHazards(ctx) {
    for (const hz of this.hazards) {
      if (hz.kind === 'fire') { this.drawFire(ctx, hz); continue; }
      drawCharco(ctx, hz, this.time);
    }
  }

  drawLobs(ctx) {
    for (const lb of this.lobs) {
      const hd = HAZARDS[lb.kind];
      const k = lb.t / hd.flight;
      const gx = lb.x0 + (lb.tx - lb.x0) * k, gy = lb.y0 + (lb.ty - lb.y0) * k;
      const h = Math.sin(k * Math.PI) * (lb.kind === 'bleach' ? 130 : lb.kind === 'fire' ? MOLOTOV.height : 90);
      // aviso de dónde caerá
      ctx.beginPath();
      ctx.ellipse(lb.tx, lb.ty, hd.radius * k, hd.radius * 0.6 * k, 0, 0, Math.PI * 2);
      ctx.fillStyle = lb.kind === 'bleach' ? 'rgba(90, 169, 214, 0.3)' : lb.kind === 'fire' ? hd.fill : 'rgba(155, 227, 59, 0.25)';
      ctx.fill();
      if (lb.kind === 'bleach') {
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 60, 90, 0.9)';
        ctx.beginPath(); ctx.ellipse(lb.tx, lb.ty, hd.radius, hd.radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = 'rgba(20,16,40,0.25)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      if (lb.kind === 'bleach') { drawBottle(ctx, gx, gy - h, lb.t * 10); continue; }
      if (lb.kind === 'fire') { drawMolotov(ctx, gx, gy - h, lb.t * 12, this.time); continue; }
      if (drawSprite(ctx, 'objeto-moco', 'idle', 'south', 0, gx, gy - h)) continue;
      ctx.beginPath();
      ctx.arc(gx, gy - h, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#9be33b';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  }
}
