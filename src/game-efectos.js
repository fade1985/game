// ─────────────────────────────────────────────
//  Efectos: partículas (chispas, humo, salpicaduras), los efectos animados de pixel art, las
//  manchas del suelo, los números y textos que flotan y el temblor de la pantalla.
//
//  Son métodos de Game: game.js los añade a la clase, así que dentro "this" es la partida.
// ─────────────────────────────────────────────
import { rand } from './utils.js';
import { hasSprite } from './sprites.js';

// Rendimiento: como mucho tantas partículas a la vez (con muchos zombis ardiendo se pasaba de 700).
// Si hay más, se quitan las más antiguas, que son las que ya se están apagando
const MAX_PARTICLES = 350;

export class GameEffects {
  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const fr = Math.exp(-dt * 4);
      pt.vx *= fr; pt.vy *= fr;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    for (const t of this.texts) {
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-dt * 3);
    }
    this.texts = this.texts.filter((t) => t.t < t.life);
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  puff(x, y, color) {
    this.particles.push({ x, y, vx: rand(-30, 30), vy: rand(-30, 10), r: rand(3, 6), color, life: 0.3, max: 0.3 });
  }

  // Polvo de los pies (la esquiva): cuadraditos grises que salen hacia (dx, dy), abiertos en abanico
  dust(x, y, dx, dy, n) {
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = base + rand(-0.7, 0.7), sp = rand(60, 170);
      this.particles.push({
        x: x + rand(-6, 6), y: y + rand(-3, 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 15, px: true,
        size: i < 2 ? 3 : 2, color: i % 2 ? '#8d8a94' : '#b9b5bf', life: rand(0.22, 0.4), max: 0.4,
      });
    }
  }

  burst(x, y, color, n, r, ring = true) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 260);
      this.particles.push({
        x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: rand(4, 9), color, life: rand(0.35, 0.7), max: 0.7, outline: true,
      });
    }
    if (ring) this.particles.push({ x, y, vx: 0, vy: 0, r, ring: true, color: '#ffffff', life: 0.3, max: 0.3 });
  }

  // Impacto de una bala del conserje o de un compañero, en pixel art: un destello cuadrado y unas chispas
  // (cuadraditos del color de la bala) que rebotan hacia atrás. Contra un muro salta además algo de polvo.
  // Se pinta a la altura a la que se ve la bala, no a la del suelo.
  bulletImpact(b, wall) {
    const x = b.x, y = b.y - (b.lift || 0);
    const back = Math.atan2(-b.vy, -b.vx);
    const colors = b.crit ? ['#ffffff', '#ffe9a8', '#ff9a3c', '#ff4d2e'] : ['#fffbe0', '#ffe066', '#ffb020', '#f0701a'];
    this.particles.push({ x, y, vx: 0, vy: 0, px: true, size: b.crit ? 5 : 4, color: colors[0], life: 0.07, max: 0.07 });
    const n = (b.crit ? 7 : 5) - (b.r < 6 ? 2 : 0); // los perdigones sueltan menos chispas
    for (let i = 0; i < n; i++) {
      const a = back + rand(-1.1, 1.1), sp = rand(110, 300);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, px: true, size: i < 2 ? 2 : 1,
        color: colors[1 + (i % 3)], life: rand(0.14, 0.28), max: 0.28,
      });
    }
    if (wall) {
      for (let i = 0; i < 3; i++) {
        const a = back + rand(-0.8, 0.8), sp = rand(30, 90);
        this.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, px: true, size: 2,
          color: i ? '#b9bec9' : '#e3e6ec', life: rand(0.25, 0.4), max: 0.4,
        });
      }
    }
  }

  // Efecto animado de pixel art (explosión, chispa, humo): se reproduce una vez en su sitio
  fx(id, x, y) {
    const dur = { 'objeto-fx-explosion': 12 / 14, 'objeto-fx-chispa': 7 / 16, 'objeto-fx-humo': 10 / 12 }[id];
    if (!hasSprite(id)) return false;
    this.particles.push({ fx: id, x, y, vx: 0, vy: 0, life: dur, max: dur });
    return true;
  }

  // Chispas en forma de estrella donde se golpea
  hitSpark(x, y, crit) {
    const n = crit ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(160, 300);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: crit ? 7 : 5, color: crit ? '#ffd23f' : '#ffffff', life: 0.16, max: 0.16, star: true });
    }
  }

  // Mancha que se queda en el suelo al morir un enemigo
  addDecal(e) {
    const decals = this.room && this.room.decals;
    if (!decals) return;
    const colors = { explosivo: '#2b2633', venenoso: '#8fd13f', tentaculos: '#7b4fa0' };
    const base = e.isBoss ? 1.8 : 1;
    decals.push({ x: e.x, y: e.y + 10, r: rand(14, 20) * base, color: colors[e.type] || '#5b7d3a', seed: rand(0, 6) });
    this.room.decalCount = (this.room.decalCount || 0) + 1; // para saber que hay que repintar el suelo (game-dibujo.js)
    if (decals.length > 60) decals.shift();
  }

  floatText(x, y, text, color, size = 18) {
    this.texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -70 });
  }
}
