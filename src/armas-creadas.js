// ─────────────────────────────────────────────
//  Armas creadas cuerpo a cuerpo (fase D1 del plan de combinar: claude/plan-combinar.md)
//
//  Cada arma creada es su arma base (fregona, bate o cuchillo, de weapons.js) con algunos números cambiados y
//  un efecto al golpear. Hasta que tengan sprite propio, Johnny usa la hoja del arma base y encima le salen
//  unas partículas (`detalle`) que dicen qué arma lleva.
//
//  Campos de CREADAS (números provisionales):
//    base       arma de la que toma el dibujo y los números que no se cambian
//    reach, arc, rate, knock   como en weapons.js (alcance, abanico en grados, golpes/s, empuje)
//    efecto     lo que hace al golpear (ver EFECTOS)
//    detalle    color de las partículas junto al arma · sube: true si suben (fuego), si no caen (gotas)
// ─────────────────────────────────────────────
import { WEAPONS } from './weapons.js';
import { rand, dist, obstacleGap } from './utils.js';
import { isWall } from './shapes.js';
import { destello } from './luz.js';
import { sfx } from './sfx.js';
import { FABRICANTE } from './talentos.js';

export const CREADAS = {
  lanza: { base: 'fregona', reach: 96, arc: 35, detalle: '#dfe4ef' },                     // estocada que atraviesa
  aplastacabezas: { base: 'bate', knock: 3, efecto: 'aturde', detalle: '#9a9aa8' },
  bateFuego: { base: 'bate', efecto: 'fuego', detalle: '#ff9f1c', sube: true },
  partecuerpos: { base: 'bate', arc: 170, efecto: 'sangra', detalle: '#c0392b' },
  inmovilizadora: { base: 'bate', efecto: 'descarga', detalle: '#9fe8ff', sube: true },
  latigo: { base: 'cuchillo', reach: 110, arc: 50, efecto: 'veneno', detalle: '#9be564' },
  supermaza: { base: 'fregona', rate: 0.8, arc: 360, knock: 2.5, efecto: 'circulo', detalle: '#8a8a9a' },
  // A distancia (fase D2). Usan el cargador de siempre como "depósito": `mag` es lo que dura y `reload` lo que tarda en
  // rellenarse. `range` y `speed` mandan en lo lejos que llega el chorro; `sinMunicion`: no gasta nada (el bumerán)
  lanzallamas: { base: 'pistola', rate: 10, range: 170, speed: 320, mag: 40, reload: 2, knock: 0.3, efecto: 'llama', detalle: '#ff9f1c', sube: true },
  supersoplete: { base: 'escopeta', pellets: 1, rate: 2, range: 100, speed: 300, mag: 12, reload: 2.2, knock: 1, efecto: 'cono', detalle: '#ffd23f', sube: true, shell: false },
  desintegrador: { base: 'pistola', rate: 12, range: 220, speed: 400, mag: 50, reload: 2, knock: 0.2, efecto: 'acido', detalle: '#c7e04a' },
  bumeran: { base: 'pistola', rate: 1, range: 300, speed: 460, mag: 1, reload: 0, knock: 1.5, efecto: 'bumeran', detalle: '#c0c4d0', sinMunicion: true },
};

// Números de los efectos (provisionales)
export const EFECTOS = {
  aturde: 0.6,                                  // segundos aturdido (el aplastacabezas)
  fuego: 3,                                     // segundos ardiendo (el bate de fuego; quema como el molotov)
  sangra: { t: 3, total: 0.6, color: '#ff4d6d' }, // dura 3 s y quita en total el 60 % del golpe
  veneno: { t: 4, total: 1, color: '#9be564' },   // dura 4 s y quita en total otro golpe entero
  descarga: { aturde: 1, salto: 130, dano: 0.5 }, // aturde 1 s y salta al zombi más cercano con medio daño
  acido: { t: 3, total: 3, color: '#c7e04a' },     // el ácido sigue royendo 3 s: el triple del daño de una gota
  tick: 0.5,                                    // cada cuánto se quitan los pellizcos de sangrar y veneno
};

// Arrojadizas creadas (fase D3). El cóctel molotov no está aquí: sus botellas se suman al contador de molotovs de
// siempre. Las otras tres se lanzan como la granada (granada.js) con su propio tiempo de mecha y su efecto.
//   fuse     segundos hasta que revienta · radio  de la explosión · color  del dibujo, el aviso y los anillos
//   atrae    la atraedora suena y los zombis (a menos de esa distancia) van hacia ella en vez de hacia Johnny
//   congela  segundos que quedan quietos los zombis que pilla · charco  radio del charco de ácido que deja
export const ARROJADIZAS = {
  atraedora: { fuse: 3, radio: 110, color: '#ffd23f', rgb: '255, 210, 63', atrae: 520 },
  congeladora: { fuse: 2, radio: 120, color: '#9fe8ff', rgb: '159, 232, 255', congela: 3 },
  lluviaAcida: { fuse: 2, radio: 90, color: '#c7e04a', rgb: '199, 224, 74', charco: 150 },
};
const DANO_JOHNNY = 25;   // lo máximo que le hace a Johnny su propia explosión

// El arma que se pone en la mano a partir de la que guarda el inventario (crearArma de recetas.js).
// `creada` la distingue de las de la tienda; `ico` es el icono del HUD (el del arma base)
export function armaDeCreada(a) {
  const c = CREADAS[a.receta];
  const base = WEAPONS[c.base];
  return {
    ...base, ...c,
    id: a.receta, name: a.nombre, ico: base.id, creada: a, damage: a.damage,
    price: undefined, stash: undefined,
  };
}

export class ArmasCreadasMethods {
  // Lo que hace un arma creada al golpear a un enemigo (lo llama meleeHit de game-combate.js)
  efectoGolpe(e, w, dmg) {
    if (e.dead) return;
    switch (w.efecto) {
      case 'aturde': this.aturdir(e, EFECTOS.aturde); break;
      case 'fuego': if (e.burn) e.burnT = Math.max(e.burnT, EFECTOS.fuego); break; // los jefes no arden
      case 'sangra': this.herir(e, 'sangra', dmg); break;
      case 'veneno': this.herir(e, 'veneno', dmg); break;
      case 'descarga': {
        this.aturdir(e, EFECTOS.descarga.aturde);
        // salta al zombi más cercano
        let otro = null, mejor = EFECTOS.descarga.salto;
        for (const o of this.enemies) {
          if (o === e || !o.active || o.dead) continue;
          const d = dist(o, e);
          if (d < mejor) { mejor = d; otro = o; }
        }
        if (otro) {
          this.rayo(e.x, e.y - 20, otro.x, otro.y - 20);
          otro.hurt(dmg * EFECTOS.descarga.dano, false, 0, 0, this, 0);
          this.aturdir(otro, EFECTOS.descarga.aturde);
        }
        break;
      }
    }
  }

  // ── Arrojadizas creadas (fase D3) ──
  // Cuántas unidades le quedan de esa arrojadiza (suma las de todas las que haya creado)
  unidadesCreada(k) {
    return this.armasCreadas.reduce((n, a) => n + (a.receta === k ? a.unidades : 0), 0);
  }

  // Lo que se puede lanzar ahora, en el orden del botón de cambiar: molotov, granada y las creadas que le queden
  tossKinds() {
    return ['molotov', 'granada', ...Object.keys(ARROJADIZAS).filter((k) => this.unidadesCreada(k) > 0)];
  }

  // Lanza una unidad de la arrojadiza creada que está elegida
  throwCreada(x, y) {
    const k = this.tossKind, c = ARROJADIZAS[k], p = this.player;
    const a = this.armasCreadas.find((o) => o.receta === k && o.unidades > 0);
    if (!a) { this.tossKind = 'molotov'; this.floatText(p.x, p.y - 54, '¡Se acabó!', c.color, 18); sfx.nope(); return; }
    if (--a.unidades <= 0) this.armasCreadas.splice(this.armasCreadas.indexOf(a), 1);
    if (this.unidadesCreada(k) <= 0) this.tossKind = 'molotov';   // era la última: vuelve al molotov
    this.soltarGranada(x, y, { tipo: k, dmg: a.damage, fuse: c.fuse });
  }

  // El radio de la explosión (el Fabricante lo agranda)
  radioCreada(k) { return ARROJADIZAS[k].radio * (this.stats.fabricante ? FABRICANTE.radio : 1); }

  // ¿Hay una atraedora sonando cerca de este zombi? Devuelve la que lo atrae (los jefes pasan de ella)
  ceboPara(e) {
    if (e.isBoss) return null;
    for (const g of this.grenades) if (g.tipo === 'atraedora' && dist(g, e) < ARROJADIZAS.atraedora.atrae) return g;
    return null;
  }

  // Una arrojadiza creada revienta: explosión de las de siempre más lo suyo
  boomCreada(g) {
    const c = ARROJADIZAS[g.tipo], R = this.radioCreada(g.tipo);
    this.explode(g.x, g.y, R, Math.min(g.dmg, DANO_JOHNNY), null, g.dmg * this.stats.throwDamage);
    if (c.congela) {
      for (const e of this.enemies) {
        if (!e.active || e.dead || e.isBoss || dist(e, g) > R + e.r) continue;
        e.congeladoT = c.congela;
        this.aturdir(e, c.congela);   // congelado = quieto, como aturdido (mutado de zombies.js lo pinta azul)
      }
    }
    if (c.charco) this.charcoLluvia(g.x, g.y, c.charco * (this.stats.fabricante ? FABRICANTE.radio : 1));
    // anillos del color de cada una, para que se note cuál ha sido
    for (let i = 0; i < 2; i++) this.particles.push({ x: g.x, y: g.y, vx: 0, vy: 0, r: R * (0.6 + i * 0.4), ring: true, color: c.color, life: 0.4 + i * 0.15, max: 0.55 });
  }

  // Aturde a un zombi (se queda quieto echando chispitas amarillas, como con la mutación Tentacular). Los jefes no
  aturdir(e, t) {
    if (e.isBoss || e.dead) return;
    e.stunT = Math.max(e.stunT || 0, t);
  }

  // Sangrar o veneno: quita `total` del golpe poco a poco durante `t` segundos (se renueva con cada golpe)
  herir(e, tipo, dmg) {
    const ef = EFECTOS[tipo];
    e.heridas = e.heridas || {};
    e.heridas[tipo] = { t: ef.t, dps: (dmg * ef.total) / ef.t, tick: 0 };
  }

  // Rayo de la descarga: una línea en zigzag de puntitos azules
  rayo(x1, y1, x2, y2) {
    const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 8));
    for (let i = 0; i <= n; i++) {
      const k = i / n, lado = i % 2 ? 1 : -1;
      this.particles.push({ x: x1 + (x2 - x1) * k + lado * rand(2, 6), y: y1 + (y2 - y1) * k + lado * rand(2, 6),
        vx: 0, vy: 0, px: true, size: 3, color: i % 3 ? '#9fe8ff' : '#ffffff', life: 0.2, max: 0.2 });
    }
    sfx.click();
  }

  // Cada fotograma: los pellizcos de sangrar y veneno, y las partículas del arma creada en la mano de Johnny
  actualizarArmasCreadas(dt) {
    for (const e of this.enemies) {
      if (!e.heridas || e.dead) continue;
      for (const tipo of Object.keys(e.heridas)) {
        const h = e.heridas[tipo], ef = EFECTOS[tipo];
        h.t -= dt; h.tick += dt;
        if (Math.random() < 6 * dt) {   // gotitas que caen
          this.particles.push({ x: e.x + rand(-10, 10), y: e.y - 20 * (e.s || 1), vx: rand(-15, 15), vy: rand(20, 50), px: true, size: 2, color: ef.color, life: 0.4, max: 0.4 });
        }
        if (h.tick >= EFECTOS.tick) {
          h.tick -= EFECTOS.tick;
          const d = h.dps * EFECTOS.tick;
          if (!e.invulnerable) {
            e.hp -= d;
            e.hitFlash = 0.05;
            this.floatText(e.x + rand(-8, 8), e.y - 38 * (e.s || 1), String(Math.round(d)), ef.color, 16);
            if (e.hp <= 0) { e.hp = 0; this.killEnemy(e); break; }
          }
        }
        if (h.t <= 0) delete e.heridas[tipo];
      }
    }
    this.actualizarChorros(dt);
    // el detalle del arma: partículas en la punta, más o menos donde la lleva el dibujo
    const p = this.player, w = p.slots[p.hand];
    if (!w?.creada || p.dead || Math.random() > 14 * dt) return;
    const lx = p.lookX || 0, ly = p.lookY || 1;
    this.particles.push({
      x: p.x + lx * 26 + rand(-5, 5), y: p.y - 4 + ly * 16 + rand(-5, 5),
      vx: rand(-12, 12), vy: w.sube ? rand(-55, -30) : rand(20, 45), px: true, size: 2, color: w.detalle, life: 0.35, max: 0.35,
    });
  }

  // ── Armas a distancia creadas (fase D2) ──
  // Disparo de un arma creada a distancia: sale de la boca del arma en (o.x, o.y). Las tres de chorro sueltan
  // gotas de fuego o ácido que atraviesan a los zombis; el bumerán sale una vez y vuelve a la mano
  disparoCreada(p, angle, w, o) {
    const s = p.stats;
    const dmg = w.damage * s.damage * s.rangedDamage;
    this.noise(p.x, p.y);
    if (w.efecto === 'bumeran') {
      this.bumeranes.push({ x: o.x, y: o.y, ang: angle, ida: true, ox: p.x, oy: p.y, hit: new Set(), giro: 0, dmg, knock: w.knock, range: w.range, speed: w.speed, t: 0, lift: o.lift || 0 });
      sfx.whip();
      return;
    }
    const cono = w.efecto === 'cono';
    const n = cono ? 9 : 1, arco = cono ? 0.9 : 0.14;
    for (let i = 0; i < n; i++) {
      const a = angle + (cono ? (i / (n - 1) - 0.5) * arco : 0) + (Math.random() - 0.5) * (cono ? 0.1 : arco);
      const sp = w.speed * (0.85 + Math.random() * 0.3);
      this.chorros.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tipo: w.efecto, dmg, knock: w.knock,
        r: cono ? 10 : 8, life: w.range / w.speed, max: w.range / w.speed, hit: new Set(), lift: o.lift || 0 });
    }
    if (w.efecto !== 'acido') destello(this, o.x, o.y, cono ? 170 : 120, 0.08);
    // el sonido, de vez en cuando (si no, suena fatal a 10 disparos por segundo)
    if (this.chorroSfxT <= 0) {
      this.chorroSfxT = cono ? 0.3 : 0.25;
      if (w.efecto === 'acido') sfx.spit(); else sfx.fire();
    }
    if (cono) this.shake(3);
  }

  // Mueve las gotas y los bumeranes de Johnny y mira a quién tocan (cada fotograma)
  actualizarChorros(dt) {
    const p = this.player;
    this.chorroSfxT -= dt;
    this.acidoT -= dt;
    for (const g of this.chorros) {
      g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt;
      if (g.lift > 22) g.lift += (22 - g.lift) * (1 - Math.exp(-dt * 14));
      if (isWall(this.room.layout, g.x, g.y) || this.room.layout.obstacles.some((o) => obstacleGap(o, g) < g.r * 0.5)) { g.life = 0; continue; }
      for (const e of this.enemies) {
        if (!e.active || e.dead || g.hit.has(e) || dist(e, g) >= e.r + g.r) continue;
        g.hit.add(e);
        this.golpeCreada(e, g.x, g.y, g.vx, g.vy, g.dmg, g.knock, g.tipo);
      }
    }
    this.chorros = this.chorros.filter((g) => g.life > 0);
    for (const b of this.bumeranes) {
      b.t += dt; b.giro += dt * 22;
      if (b.ida) {
        b.x += Math.cos(b.ang) * b.speed * dt; b.y += Math.sin(b.ang) * b.speed * dt;
        const choca = isWall(this.room.layout, b.x, b.y) || this.room.layout.obstacles.some((o) => obstacleGap(o, b) < 7);
        if (choca || Math.hypot(b.x - b.ox, b.y - b.oy) >= b.range) { b.ida = false; b.hit.clear(); }
      } else {
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        b.ang = Math.atan2(dy, dx);
        b.x += (dx / d) * b.speed * 1.2 * dt; b.y += (dy / d) * b.speed * 1.2 * dt;
        if (d < 22 || b.t > 4) { b.volvio = true; sfx.swap(); }
      }
      if (b.lift > 22) b.lift += (22 - b.lift) * (1 - Math.exp(-dt * 14));
      for (const e of this.enemies) {
        if (!e.active || e.dead || b.hit.has(e) || dist(e, b) >= e.r + 14) continue;
        b.hit.add(e);
        this.golpeCreada(e, b.x, b.y, Math.cos(b.ang), Math.sin(b.ang), b.dmg, b.knock, 'bumeran');
      }
    }
    this.bumeranes = this.bumeranes.filter((b) => !b.volvio);
  }

  // Lo que pasa cuando una gota o el bumerán toca a un zombi
  golpeCreada(e, x, y, vx, vy, dmg, knock, tipo) {
    const crit = Math.random() < this.stats.crit;
    const d = crit ? dmg * 2 : dmg, l = Math.hypot(vx, vy) || 1;
    e.hurt(d, crit, vx / l, vy / l, this, knock);
    if (e.dead) return;
    if (tipo === 'llama' || tipo === 'cono') {
      if (e.burn) e.burnT = Math.max(e.burnT, EFECTOS.fuego);
    } else if (tipo === 'acido') {
      this.herir(e, 'acido', d);
      if (this.acidoT <= 0) { this.acidoT = 0.6; this.vomitar(e.x, e.y + e.r * 0.5); } // charco de ácido (el de Gastroenteritis)
    } else {
      this.hitSpark(x, y - 10, crit);
      sfx.thud();
    }
  }

  // Dibuja las gotas de fuego o ácido y los bumeranes (se llama desde game-dibujo.js)
  dibujarChorros(ctx) {
    for (const g of this.chorros) {
      const k = 1 - g.life / g.max; // 0 al salir, 1 al apagarse
      const y = g.y - (g.lift || 0);
      let color, r;
      if (g.tipo === 'acido') { color = k < 0.6 ? '#c7f27a' : '#8fd13f'; r = g.r * (0.5 + 0.5 * k); }
      else { color = k < 0.3 ? '#fff3a0' : k < 0.65 ? '#ff9f1c' : '#d94a1a'; r = g.r * (0.5 + 1.1 * k); }
      ctx.globalAlpha = Math.min(1, 1.6 - k * 1.3);
      ctx.beginPath(); ctx.arc(g.x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of this.bumeranes) {
      ctx.save();
      ctx.translate(b.x, b.y - (b.lift || 0));
      ctx.rotate(b.giro);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const [w, c] of [[9, '#1d1b2c'], [5, '#cfd3dc']]) {
        ctx.lineWidth = w; ctx.strokeStyle = c;
        ctx.beginPath(); ctx.moveTo(-13, -11); ctx.lineTo(0, 0); ctx.lineTo(13, -11); ctx.stroke();
      }
      ctx.restore();
    }
  }
}
