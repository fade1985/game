// ─────────────────────────────────────────────
//  Cámara
//
//  Acerca la vista ×1,5 y sigue al conserje con suavidad, adelantándose un poco
//  hacia donde camina. Nunca enseña lo que hay fuera del mapa en el que está; si el
//  mapa es más pequeño que la pantalla (el pasillo es estrecho), lo centra. Con un
//  jefe delante se aleja un poco para que se vean bien sus ataques.
// ─────────────────────────────────────────────
import { W, H, TOP_EXTRA, PIXEL } from './config.js';
import { clamp } from './utils.js';

export const ZOOM = 1.5;       // acercamiento normal
export const BOSS_ZOOM = 1.15; // con un jefe delante se ve más trozo de mapa

export class Camera {
  constructor() {
    this.zoom = ZOOM;
    this.targetZoom = this.zoom;
    this.x = W / 2;
    this.y = H / 2;
    this.aspect = W / H; // ancho / alto de la pantalla (se actualiza al cambiar el tamaño de la ventana)
    this.pantallaH = H;  // alto del lienzo en píxeles de pantalla (también se actualiza)
    this.rw = W;         // tamaño del mapa que se está viendo
    this.rh = H;
  }

  // Píxeles de pantalla que ocupa cada píxel del dibujo: siempre un número entero, para que todos los
  // píxeles midan lo mismo y no "bailen" (con 5,07 unos saldrían de 5 y otros de 6). Se elige el entero
  // más cercano al zoom que se quiere; por eso el zoom real cambia a saltos y no poco a poco.
  get pixelPantalla() { return Math.max(1, Math.round((this.pantallaH * this.zoom * PIXEL) / H)); }

  // Tamaño de la vista en unidades del juego
  // la altura visible es fija (según el zoom) y el ancho depende de la forma de la pantalla
  get vh() { return (this.pantallaH * PIXEL) / this.pixelPantalla; }
  get vw() { return this.vh * this.aspect; }

  // Esquina de arriba a la izquierda de la vista (exacta: el fondo se desplaza con suavidad)
  get left() { return this.x - this.vw / 2; }
  get top() { return this.y - this.vh / 2; }

  // Que la vista no se salga del mapa (si la pantalla es más grande que el mapa, se centra).
  // Por arriba deja ver TOP_EXTRA más: lo que la pared del fondo sobresale del mapa.
  clampToRoom() {
    const top = -TOP_EXTRA, h = this.rh + TOP_EXTRA;
    this.x = this.vw >= this.rw ? this.rw / 2 : clamp(this.x, this.vw / 2, this.rw - this.vw / 2);
    this.y = this.vh >= h ? top + h / 2 : clamp(this.y, top + this.vh / 2, this.rh - this.vh / 2);
  }

  // Al entrar en un mapa: sus medidas, para no enseñar lo que hay fuera
  setRoom(w, h) {
    this.rw = w;
    this.rh = h;
  }

  // Coloca la cámara de golpe sobre alguien (al entrar en un mapa)
  snap(target) {
    this.zoom = this.targetZoom;
    this.x = target.x;
    this.y = target.y;
    this.clampToRoom();
  }

  update(dt, target) {
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
    const z = H / this.vh; // el zoom de verdad, ya ajustado a píxeles enteros
    return { x: (x - this.left) * z, y: (y - this.top) * z };
  }
}
