// ─────────────────────────────────────────────
//  Dibujo de la partida: cámara, sala, personajes, efectos, minimapa, barras y carteles.
//
//  Son métodos de Game: game.js los añade a la clase, así que dentro "this" es la partida.
// ─────────────────────────────────────────────
import { H, WALL, OUTLINE, DIRS, PIXEL, SLIDE, FADE } from './config.js';
import { rand, clamp } from './utils.js';
import { drawRoom, sceneryOf, drawDoors, drawDoorLabels, drawFog, drawPickup, drawBullet, drawMinimap, drawEmoji as drawEmojiAt, minimapRect } from './render.js';
import { outlinedText, roundBox, pixelBossBar, pixelHpBar, MARCO_VIDA_ANCHO } from './draw.js';
import { setGridSnap, drawSprite } from './sprites.js';

const REPAINT = 0.5; // cada cuánto, como mucho, se repinta el suelo para añadir manchas nuevas

// Iconos pixel art de los objetos (los mismos del CSS); 'zapatillas' reutiliza el del dash
const ITEM_ICONS = {};
function itemIcon(id) {
  if (!ITEM_ICONS[id]) {
    ITEM_ICONS[id] = new Image();
    ITEM_ICONS[id].src = `assets/ui/iconos/${id === 'zapatillas' ? 'dash' : id}.png`;
  }
  return ITEM_ICONS[id];
}

export class GameDrawing {
  slideEase(tr) {
    const k = clamp(tr.t / SLIDE, 0, 1);
    return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  }

  // Cómo se dibuja cada fotograma:
  //  1) el fondo (el mapa guardado como imagen + puertas, charcos, objetos del suelo) se dibuja en un
  //     lienzo pequeño alineado a la cuadrícula de píxeles y se amplía con un desplazamiento exacto,
  //     así se mueve con suavidad aunque cada píxel del dibujo ocupe varios de pantalla;
  //  2) los personajes, balas y partículas se dibujan a resolución de pantalla en su posición exacta.
  render() {
    const out = this.ctx, cam = this.camera;
    const vw = cam.vw, vh = cam.vh;
    const k = out.canvas.height / vh; // píxeles de pantalla por unidad del juego

    // temblor y paso de un mapa a otro
    let offX = 0, offY = 0;
    const tr = this.transition;
    if (tr) {
      const e = this.slideEase(tr);
      const [dx, dy] = DIRS[tr.dir];
      offX = dx * vw * (1 - e); offY = dy * vh * (1 - e);
      tr.e = e;
    } else if (this.shakeAmt > 0.3) {
      offX = rand(-1, 1) * this.shakeAmt; offY = rand(-1, 1) * this.shakeAmt;
    }
    const camX = cam.left - offX, camY = cam.top - offY; // esquina exacta de lo que se ve

    // 1) fondo en el lienzo pequeño
    const sx = Math.floor(camX / PIXEL) * PIXEL, sy = Math.floor(camY / PIXEL) * PIXEL;
    const bw = Math.ceil(vw / PIXEL) + 2, bh = Math.ceil(vh / PIXEL) + 2;
    if (this.low.width !== bw || this.low.height !== bh) { this.low.width = bw; this.low.height = bh; }
    const ctx = this.lowCtx;
    ctx.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, -sx / PIXEL, -sy / PIXEL);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(sx, sy, bw * PIXEL, bh * PIXEL);
    if (tr) {
      // el mapa que se deja sale con su propia cámara
      const [dx, dy] = DIRS[tr.dir];
      const prev = tr.cam || { left: 0, top: 0 };
      const tx = Math.round((camX - prev.left - dx * vw * tr.e) / PIXEL) * PIXEL;
      const ty = Math.round((camY - prev.top - dy * vh * tr.e) / PIXEL) * PIXEL;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.drawImage(this.roomImage(tr.from), 0, 0, tr.from.layout.w, tr.from.layout.h);
      drawDoors(ctx, tr.from, 1);
      for (const s of [...sceneryOf(tr.from)].sort((a, b) => a.y - b.y)) s.draw(ctx, this);
      ctx.restore();
    }
    ctx.drawImage(this.roomImage(this.room), 0, 0, this.rw, this.rh);
    this.drawBackground(ctx);

    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, out.canvas.width, out.canvas.height);
    out.imageSmoothingEnabled = false;
    out.drawImage(this.low, (sx - camX) * k, (sy - camY) * k, bw * PIXEL * k, bh * PIXEL * k);

    // 2) personajes y efectos a resolución de pantalla
    out.setTransform(k, 0, 0, k, -camX * k, -camY * k);
    out.imageSmoothingEnabled = false;
    setGridSnap(false);
    this.drawActors(out);
    setGridSnap(true);
    this.drawReload(out);
    this.drawTexts(out);

    // 3) interfaz
    out.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.state === 'playing' && !tr) this.drawOffscreen(out);
    this.drawOverlay(out);
  }

  // Cada mapa (suelo, paredes, muebles, manchas) se dibuja una vez y se guarda como imagen
  // Rendimiento: las manchas nuevas no repintan el mapa al momento, sino como mucho cada REPAINT segundos
  // (con un molotov mueren varios zombis por segundo y cada uno lo repintaba entero)
  roomImage(room) {
    const key = `${room.decalCount || 0}:${(this.spriteIds || []).length}`;
    const soon = room.cache && room.cacheKey.split(':')[1] === key.split(':')[1] && this.time - (room.cacheT ?? -1e9) < REPAINT;
    if (!room.cache || (room.cacheKey !== key && !soon)) {
      room.cacheT = this.time;
      const c = room.cache || document.createElement('canvas');
      c.width = room.layout.w / PIXEL; c.height = room.layout.h / PIXEL;
      const x = c.getContext('2d');
      x.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
      x.imageSmoothingEnabled = false;
      drawRoom(x, room, this.time);
      room.cache = c;
      room.cacheKey = key;
    }
    return room.cache;
  }

  // ¿Está preparando un ataque? (para avisar aunque esté fuera de la pantalla)
  isWindingUp(e) {
    if (e.fuse > 0 || e.spitT > 0 || (e.tent && e.tent.phase === 'warn')) return true;
    return !!(e.state && /Warn$|^charge$|^spin$/.test(e.state.name));
  }

  // Avisos en el borde de la pantalla: enemigos que no se ven (con "!") y, con el mapa limpio,
  // lo que queda por hacer y no se ve: puertas, la llave y el superviviente
  drawOffscreen(ctx) {
    const cam = this.camera;
    const p = this.player;
    // zona donde se colocan los avisos (sin tapar el minimapa ni el HUD)
    const x0 = 26, x1 = this.ow - 26, y0 = 26, y1 = H - 64 - 22;
    const edge = (sx, sy) => {
      const cx = this.ow / 2, cy = H / 2;
      const dx = sx - cx, dy = sy - cy;
      const t = Math.min(dx ? Math.abs(((dx > 0 ? x1 : x0) - cx) / dx) : 1e9, dy ? Math.abs(((dy > 0 ? y1 : y0) - cy) / dy) : 1e9);
      const m = { x: cx + dx * t, y: cy + dy * t, a: Math.atan2(dy, dx) };
      // si cae encima del minimapa, se coloca justo debajo
      const mm = minimapRect;
      if (mm && m.x > mm.x - 20 && m.y < mm.y + mm.h + 20) m.y = mm.y + mm.h + 22;
      return m;
    };
    const marker = (m, r, fill, label, pulse) => {
      // flechita hacia el objetivo
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.a);
      ctx.beginPath();
      ctx.moveTo(r + 9, 0); ctx.lineTo(r - 2, -7); ctx.lineTo(r - 2, 7); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.restore();
      if (pulse) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, r + 5 + Math.sin(this.time * 18) * 3, 0, Math.PI * 2);
        ctx.lineWidth = 4; ctx.strokeStyle = '#ff2d4b'; ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fillStyle = pulse && Math.floor(this.time * 8) % 2 ? '#ff2d4b' : fill;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
      if (label === '!') outlinedText(ctx, '!', m.x, m.y + 1, r * 1.5, '#ffffff', { lw: 4 });
      else drawEmojiAt(ctx, label, m.x, m.y + 1, r * 1.1);
    };
    for (const e of this.enemies) {
      if (e.dead || e.asleep || this.hidden(e) || cam.inView(e, -4)) continue; // los dormidos no se delatan
      const s = cam.toScreen(e.x, e.y);
      const m = edge(s.x, s.y);
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const near = clamp(1 - (d - 250) / 500, 0, 1); // crece al acercarse
      if (e.isBoss) marker(m, 18, e.color, e.icon, this.isWindingUp(e));
      else {
        ctx.globalAlpha = e.spawnT > 0 ? 0.5 : 1;
        marker(m, 9 + near * 5, e.color, '!', this.isWindingUp(e));
        ctx.globalAlpha = 1;
      }
    }
    if (!this.room.cleared || this.doorOpen < 1) return;
    const point = (x, y, fill, label) => {
      if (cam.inView({ x, y, r: 0 })) return;
      const s = cam.toScreen(x, y);
      ctx.globalAlpha = 0.85;
      marker(edge(s.x, s.y), 11, fill, label, false);
      ctx.globalAlpha = 1;
    };
    for (const ex of this.room.exits) {
      // las escaleras, cuando se abren; y las puertas tras las que queda algo: la vuelta al pasillo,
      // un apartamento con zombis o el del mini jefe
      const show = ex.kind === 'stairs' ? !ex.locked : ex.to && (ex.to.type === 'corridor' || !ex.to.cleared);
      if (show) point(ex.x, ex.y, ex.frame || '#80ed99', ex.locked ? '🔒' : ex.icon || '🚪');
    }
    for (const pr of this.room.props) {
      if (pr.taken || this.hidden(pr)) continue;
      if (pr.kind === 'doorkey') point(pr.x, pr.y, '#dfe7f2', '🗝️');
      else if (pr.kind === 'survivor') point(pr.x, pr.y, pr.def.color, pr.def.icon);
    }
  }

  // Interfaz dibujada en el lienzo: barra de objetos, minimapa, jefe, carteles y fundidos
  drawOverlay(ctx) {
    if (this.state !== 'menu' && this.floor) {
      this.drawItemBar(ctx);
      drawMinimap(ctx, this.floor, this.room, this.floor.name.toUpperCase(), this.time, this.ow);
      // la llave del mini jefe, debajo del minimapa mientras se lleva encima
      if (this.floor.hasKey) {
        const m = minimapRect;
        roundBox(ctx, m.x, m.y + m.h + 8, m.w, 28, 10, 'rgba(29, 27, 44, 0.78)', 3);
        outlinedText(ctx, this.floor.key.name, m.x + m.w / 2 + 10, m.y + m.h + 23, 14, '#dfe7f2', { lw: 4 });
        ctx.font = '14px "ZS UI"';
        drawEmojiAt(ctx, '🗝️', m.x + m.w / 2 - ctx.measureText(this.floor.key.name).width / 2 - 2, m.y + m.h + 23, 14);
      }
    }
    this.drawVignette(ctx);
    this.drawBossBar(ctx);
    this.drawBanner(ctx);
    if (this.fade) {
      const k = clamp(this.fade.t / FADE, 0, 1);
      ctx.globalAlpha = this.fade.phase === 'out' ? k : 1 - k;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, this.ow, H);
      ctx.globalAlpha = 1;
    }
  }

  // Lo que va pegado al suelo: puertas, charcos y cosas para recoger
  drawBackground(ctx) {
    drawFog(ctx, this.room.layout);
    drawDoors(ctx, this.room, this.doorOpen);
    this.drawTrail(ctx);
    this.drawHazards(ctx);
    for (const pk of this.pickups) drawPickup(ctx, pk, this.time);
    this.drawTossAim(ctx);
  }

  // Personajes, objetos con altura, balas y partículas
  drawActors(ctx) {
    drawDoorLabels(ctx, this.room);
    // el superviviente rescatado y la llave recogida ya no están en el suelo
    // ...y lo que hay en una habitación a oscuras no se ve hasta entrar
    const props = this.room.props.filter((pr) => !(pr.taken && (pr.kind === 'survivor' || pr.kind === 'doorkey')) && !this.hidden(pr));
    // Ordenamos por "y" para que lo de abajo se dibuje delante (falsa profundidad)
    // (entran también los muebles y las caras de los tabiques, que tienen altura)
    const list = [...this.enemies.filter((e) => !this.hidden(e)), ...this.allies, ...props, ...sceneryOf(this.room)];
    if (!this.player.dead) list.push(this.player);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.draw(ctx, this);

    for (const b of this.bullets) drawBullet(ctx, b);
    this.drawLobs(ctx);
    this.drawParticles(ctx);
    this.drawTossArc(ctx);
  }

  // Números de daño y textos flotantes
  // Mientras Johnny recarga, una barrita amarilla sobre su cabeza que se va llenando
  drawReload(ctx) {
    const p = this.player;
    if (!p || p.dead || !p.reloading) return;
    pixelHpBar(ctx, p.x, p.y - 104, 14, 1 - p.reloadT / p.reloadDur, ['#e0a020', '#ffe066', '#8a5a10']);
  }

  drawTexts(ctx) {
    for (const t of this.texts) {
      const pop = Math.min(1, t.t / 0.08);
      ctx.globalAlpha = t.t > t.life - 0.25 ? (t.life - t.t) / 0.25 : 1;
      outlinedText(ctx, t.text, t.x, t.y, t.size * (0.6 + 0.4 * pop), t.color, { lw: 5 });
      ctx.globalAlpha = 1;
    }
  }

  drawParticles(ctx) {
    for (const pt of this.particles) {
      const k = pt.life / pt.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      if (pt.fx) {
        ctx.globalAlpha = 1;
        drawSprite(ctx, pt.fx, 'idle', 'south', 0, pt.x, pt.y, { frame: Math.floor((1 - k) * (pt.fx === 'objeto-fx-explosion' ? 12 : pt.fx === 'objeto-fx-chispa' ? 7 : 10)) });
        continue;
      }
      if (pt.px) {
        // pixel art: un cuadradito encajado en la cuadrícula, que encoge en vez de desvanecerse
        const side = Math.max(1, Math.ceil(pt.size * Math.min(1, k * 1.6))) * PIXEL;
        ctx.globalAlpha = 1;
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round((pt.x - side / 2) / PIXEL) * PIXEL, Math.round((pt.y - side / 2) / PIXEL) * PIXEL, side, side);
        continue;
      }
      // todo se dibuja con cuadraditos encajados en la cuadrícula de píxeles (nada de bordes suavizados)
      const sq = (x, y, n, color) => {
        const side = Math.max(1, n) * PIXEL;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round((x - side / 2) / PIXEL) * PIXEL, Math.round((y - side / 2) / PIXEL) * PIXEL, side, side);
      };
      if (pt.star) {
        // destello en cruz
        const arm = Math.max(1, Math.round(pt.r * (0.6 + k * 0.6) / PIXEL));
        for (let i = -arm; i <= arm; i++) { sq(pt.x + i * PIXEL, pt.y, 1, pt.color); if (i) sq(pt.x, pt.y + i * PIXEL, 1, pt.color); }
      } else if (pt.ring) {
        // anillo de puntitos que se abre
        const rr = pt.r * (1 + (1 - k) * 1.2);
        const n = Math.max(12, Math.round(rr * 1.4 / PIXEL) * 2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          sq(pt.x + Math.cos(a) * rr, pt.y + Math.sin(a) * rr * 0.75, 2, pt.color);
        }
      } else {
        const n = Math.max(1, Math.round(pt.r * k * 2 / PIXEL));
        if (pt.outline) sq(pt.x, pt.y, n + 2, OUTLINE);
        sq(pt.x, pt.y, n, pt.color);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Objetos conseguidos, arriba a la izquierda (sobre el muro)
  drawItemBar(ctx) {
    if (!this.items || !this.items.length) return;
    const x0 = 16, y0 = 12, size = 30;
    roundBox(ctx, x0 - 6, y0 - 4, this.items.length * (size + 4) + 8, size + 8, 10, 'rgba(29, 27, 44, 0.7)', 3);
    this.items.forEach((it, i) => {
      const img = itemIcon(it.id);
      if (img.complete && img.naturalWidth) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x0 + i * (size + 4), y0, size, size);
      }
    });
  }

  // Borde rojo al recibir daño y latido cuando queda poca vida
  drawVignette(ctx) {
    if (this.state !== 'playing' || !this.player) return;
    const p = this.player;
    const low = !p.dead && p.hp < this.stats.maxHp * 0.3;
    const pulse = low ? 0.25 + 0.2 * Math.max(0, Math.sin(this.time * 7)) : 0;
    const a = Math.max(pulse, (this.hurtFlash || 0) * 1.4);
    if (a <= 0.01) return;
    const ow = this.ow;
    const g = ctx.createRadialGradient(ow / 2, H / 2, H * 0.35, ow / 2, H / 2, ow * 0.62);
    g.addColorStop(0, 'rgba(255, 30, 60, 0)');
    g.addColorStop(1, `rgba(255, 30, 60, ${Math.min(0.7, a)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ow, H);
  }

  // Barra de vida de jefes y mini jefes
  drawBossBar(ctx) {
    const boss = this.enemies.find((e) => e.isBoss && e.active);
    if (!boss) return;
    const w = MARCO_VIDA_ANCHO, x = this.ow / 2 - w / 2, y = H - WALL - 52;
    // se vuelve transparente si hay alguien debajo, para no tapar el combate
    const toScreen = (e) => this.camera.toScreen(e.x, e.y);
    const under = [this.player, ...this.enemies].some((e) => { const s = toScreen(e); return s.x > x - 30 && s.x < x + w + 30 && s.y > y - 60; });
    ctx.save();
    ctx.globalAlpha = under ? 0.35 : 1;
    // el marco de la barra de Johnny, con la sangre del color de cada jefe; la raya de la mitad marca la fase 2
    pixelBossBar(ctx, x, y, boss.hp / boss.maxHp, boss.color, { mitad: boss.type === 'boss' && boss.phase === 1 });
    const bossName = `${boss.name}${boss.phase === 2 ? ' · ¡FURIOSO!' : ''}`;
    outlinedText(ctx, bossName, this.ow / 2, y - 16, 22, '#ffd23f', { lw: 6 });
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b || b.t > 2.2 || this.state === 'menu') return;
    const appear = Math.min(1, b.t / 0.25);
    const fade = b.t > 1.8 ? 1 - (b.t - 1.8) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const s = 0.6 + 0.4 * (1 - Math.pow(1 - appear, 3));
    ctx.translate(this.ow / 2, H * 0.3);
    ctx.scale(s, s);
    const tx = b.icon ? 34 : 0;
    outlinedText(ctx, b.title, tx, 0, 56, '#ffd23f', { lw: 12 });
    if (b.icon) {
      const img = itemIcon(b.icon);
      if (img.complete && img.naturalWidth) {
        ctx.font = '56px "ZS UI"';
        const wTitle = ctx.measureText(b.title).width;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, tx - wTitle / 2 - 74, -34, 68, 68);
      }
    }
    if (b.sub) outlinedText(ctx, b.sub, 0, 46, 24, '#ffffff', { lw: 7 });
    ctx.restore();
  }
}
