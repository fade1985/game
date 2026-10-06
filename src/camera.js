// ─────────────────────────────────────────────
//  Cámara (solo en la versión pixel art)
//
//  Acerca la vista ×1,5 y sigue al conserje con suavidad, adelantándose un poco
//  hacia donde camina. Nunca enseña lo que hay fuera de la sala. En las salas de
//  jefe se aleja un poco para que se vean bien sus ataques.
//  En la versión cartoon la cámara se queda quieta enseñando la sala entera.
// ─────────────────────────────────────────────
import { W, H, PIXEL, PIXEL_MODE } from './config.js';
import { clamp } from './utils.js';

export const ZOOM = 1.5;       // acercamiento normal
export const BOSS_ZOOM = 1.15; // en las salas de jefe se ve más sala

export class Camera {
  constructor() {
    this.zoom = PIXEL_MODE ? ZOOM : 1;
    this.targetZoom = this.zoom;
    this.x = W / 2;
    this.y = H / 2;
  }

  // Tamaño de la vista en unidades del juego
  get vw() { return W / this.zoom; }
  get vh() { return H / this.zoom; }

  // Esquina de arriba a la izquierda, ajustada a la cuadrícula de píxeles
  get left() { return Math.round((this.x - this.vw / 2) / PIXEL) * PIXEL; }
  get top() { return Math.round((this.y - this.vh / 2) / PIXEL) * PIXEL; }

  // Que la vista no se salga de la sala
  clampToRoom() {
    this.x = clamp(this.x, this.vw / 2, W - this.vw / 2);
    this.y = clamp(this.y, this.vh / 2, H - this.vh / 2);
  }

  // Coloca la cámara de golpe sobre alguien (al entrar en una sala)
  snap(target) {
    if (!PIXEL_MODE) return;
    this.zoom = this.targetZoom;
    this.x = target.x;
    this.y = target.y;
    this.clampToRoom();
  }

  update(dt, target) {
    if (!PIXEL_MODE) return;
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-dt * 3));
    if (Math.abs(this.targetZoom - this.zoom) < 0.002) this.zoom = this.targetZoom;
    // un poco por delante del personaje, en la dirección en la que se mueve
    const tx = target.x + (target.vx || 0) * 0.18;
    const ty = target.y + (target.vy || 0) * 0.18;
    const k = 1 - Math.exp(-dt * 6);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.clampToRoom();
  }

  // ¿Se ve esta entidad? (con un margen extra en unidades del juego)
  inView(e, margin = 0) {
    const r = (e.r || 0) + margin;
    return e.x + r >= this.x - this.vw / 2 && e.x - r <= this.x + this.vw / 2
      && e.y + r >= this.y - this.vh / 2 && e.y - r <= this.y + this.vh / 2;
  }

  // De coordenadas del mundo a la pantalla (que mide W×H)
  toScreen(x, y) {
    return { x: (x - this.left) * this.zoom, y: (y - this.top) * this.zoom };
  }
}
