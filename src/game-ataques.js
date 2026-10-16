// ─────────────────────────────────────────────
//  Ataques especiales de los zombis y los jefes: explosiones, tentáculos, ondas, proyectiles en
//  parábola, charcos y el rastro de sangre (su lógica y su dibujo).
//
//  Son métodos de Game: game.js los añade a la clase, así que dentro "this" es la partida.
// ─────────────────────────────────────────────
import { WALL, OUTLINE, PIXEL } from './config.js';
import { rand, clamp, dist } from './utils.js';
import { BLEACH, drawBottle } from './jefe-portera.js';
import { POISON, TENTACLE } from './zombies.js';
import { drawSprite, hasSprite } from './sprites.js';
import { sfx } from './sfx.js';
import { MOLOTOV, drawMolotov } from './molotov.js';

// Rastro de sangre del zombi lento: cada cuánto deja una mancha, cuánto dura y cuánto tarda en borrarse al final
const TRAIL = { step: 9, life: 8, fade: 2.5, max: 400, color: '#680c06', dark: '#4a0804' };

// Charcos que dejan los proyectiles en parábola: moco venenoso, lejía y el fuego del molotov de Johnny
const HAZARDS = {
  fire: { ...MOLOTOV, fill: 'rgba(255, 159, 28, 0.3)' },
  poison: { ...POISON, fill: '#8fd13f', stroke: '#4f772d', bubble: '#c7f27a', drop: '#9be33b' },
  bleach: { ...BLEACH, fill: '#e9f8ff', stroke: '#2f86c4', bubble: '#ffffff', drop: '#4cb4f0' },
};

export class ZombieAttacks {
  // Explosión: daña al jugador y TAMBIÉN a los demás zombis (¡reacciones en cadena!)
  explode(x, y, radius, dmg, source) {
    sfx.boom();
    this.shake(14);
    const sprite = this.fx('objeto-fx-explosion', x, y);
    for (let i = 0; i < (sprite ? 10 : 26); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 320);
      const c = ['#ffd23f', '#ff9f1c', '#ff5d3c', '#5d5873'][i % 4];
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: sprite ? rand(3, 6) : rand(6, 14), color: c, life: rand(0.35, 0.7), max: 0.7, outline: true });
    }
    if (!sprite) this.particles.push({ x, y, vx: 0, vy: 0, r: radius * 0.6, ring: true, color: '#ffd23f', life: 0.35, max: 0.35 });
    const p = this.player;
    if (!p.dead && dist(p, { x, y }) <= radius + p.r) p.hurt(dmg, this);
    for (const e of this.enemies) {
      if (e === source || !e.active) continue;
      const d = dist(e, { x, y });
      if (d <= radius + e.r) e.hurt(dmg, false, (e.x - x) / (d || 1), (e.y - y) / (d || 1), this, 2.2);
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
        this.hazards.push({ x: lb.tx, y: lb.ty, r: hd.radius, life: hd.life, seed: rand(0, 6), kind: lb.kind });
        for (let i = 0; i < 8; i++) {
          const a = rand(0, Math.PI * 2), sp = rand(60, 160);
          this.particles.push({ x: lb.tx, y: lb.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 6), color: hd.drop, life: 0.4, max: 0.4, outline: true });
        }
        if (lb.kind === 'bleach') sfx.glass(); else sfx.splat();
        if (!p.dead && dist(p, { x: lb.tx, y: lb.ty }) < hd.radius + p.r * 0.5) p.hurt(hd.hit, this);
      }
    }
    this.lobs = this.lobs.filter((lb) => !lb.done);
    for (const hz of this.hazards) {
      hz.life -= dt;
      // pisar el charco quema poco a poco (la esquiva te deja cruzarlo)
      const hd = HAZARDS[hz.kind];
      if (hz.kind === 'fire') { this.burnFire(hz, dt); continue; }
      if (!p.dead && p.dashT <= 0 && dist(p, hz) < hz.r + p.r * 0.3) p.poison(hd.dps * dt, this, hd.drop);
    }
    this.hazards = this.hazards.filter((hz) => hz.life > 0);
    for (const t of this.trail) t.life -= dt;
    if (this.trail.length && this.trail[0].life <= 0) this.trail = this.trail.filter((t) => t.life > 0);
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
      const hd = HAZARDS[hz.kind];
      const fade = Math.min(1, hz.life / 0.6) * Math.min(1, (hd.life - hz.life) / 0.15 + 0.3);
      ctx.save();
      ctx.globalAlpha = 0.8 * fade;
      const sprite = hz.kind === 'bleach' ? 'objeto-charco-lejia' : 'objeto-charco-veneno';
      // el sprite se dibuja entero; cada charco sale a veces espejado para que no se repitan todos igual
      if (hasSprite(sprite)) {
        if (hz.seed > 3) { ctx.translate(hz.x * 2, 0); ctx.scale(-1, 1); }
        ctx.globalAlpha = Math.min(1, fade * 1.1);
        drawSprite(ctx, sprite, 'idle', 'south', 0, hz.x, hz.y, { scale: 1 });
        ctx.restore();
        continue;
      }
      ctx.fillStyle = hd.fill;
      ctx.strokeStyle = hd.stroke;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = hz.r * (0.85 + Math.sin(a * 3 + hz.seed) * 0.12);
        ctx.lineTo(hz.x + Math.cos(a) * r, hz.y + Math.sin(a) * r * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // burbujas
      ctx.fillStyle = hd.bubble;
      for (let i = 0; i < 3; i++) {
        const b = (this.time * 1.5 + i / 3 + hz.seed) % 1;
        ctx.beginPath();
        ctx.arc(hz.x + Math.cos(i * 2.1 + hz.seed) * hz.r * 0.45, hz.y + Math.sin(i * 2.1 + hz.seed) * hz.r * 0.25, 2 + b * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
