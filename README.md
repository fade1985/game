# 🧹 Blob Quest

Roguelike de zombis para navegador al estilo *The Binding of Isaac*: vista desde arriba, estilo *cartoon*
(formas redondas, contorno grueso, colores planos) y un conserje con su fregona contra un edificio infestado.
Hecho con **HTML5 Canvas + JavaScript puro**, sin librerías ni paso de compilación.

> 🚧 En pleno rediseño por fases. El plan completo y su estado están en [`docs/PLAN.md`](docs/PLAN.md).

## 🎮 Cómo se juega (fase 1)

- **Moverse:** `WASD` o flechas (en móvil: arrastra en la mitad izquierda de la pantalla)
- **Esquivar:** `Espacio` (en móvil: botón 💨). Te hace invulnerable un instante.
- **Atacar:** de momento es automático (más adelante será manual).
- **Pausa:** `Esc` o `P`

Cada planta es un mapa de salas generado al azar. Al entrar en una sala con enemigos **las puertas se cierran**
y no se abren hasta que la limpias. El **minimapa** (arriba a la derecha) muestra las salas visitadas, las que
has visto sin entrar (gris) y dónde estás (amarillo). Limpia todas las salas para completar la planta.

## 🚀 Ejecutar en local

Los módulos de JavaScript (`import`) necesitan un servidor; abrir `index.html` con doble clic no funciona.

```bash
npm run dev          # usa "npx serve" → http://localhost:3000
# o bien
python3 -m http.server 3000
```

## ☁️ Publicar en Vercel

Sitio 100 % estático: en Vercel → **Add New… → Project** → importa el repo, **Framework Preset: Other**,
sin comando de build y sin carpeta de salida. Cada `git push` vuelve a publicar.

## 🗂️ Estructura del código

```
index.html        → página, HUD y capas de menús
style.css         → estilo cartoon de botones, cartas y paneles
docs/PLAN.md      → plan de desarrollo por fases y decisiones
src/
  main.js         → arranque y bucle principal (update + render)
  game.js         → flujo de la partida: plantas, salas, puertas, oleadas, colisiones
  floor.js        → generador de plantas (mapa de salas al estilo Isaac)
  rooms.js        → contenido de cada sala: estilo, obstáculos, alfombras y oleadas
  entities.js     → jugador, compañeros y enemigos (comportamiento + dibujo)
  render.js       → dibujo de habitaciones, puertas en los 4 lados y minimapa
  draw.js         → ayudas de dibujo: personaje humano, "blobs", ojos, sombras, texto
  upgrades.js     → atributos del jugador y cartas de mejora
  ui.js           → menús en HTML (cartas, pausa, fin) y HUD
  input.js        → teclado + joystick táctil
  sfx.js          → sonidos generados con Web Audio (sin archivos)
  save.js         → guardado en localStorage
  config.js       → constantes, colores, edificios y estilos de habitación
```

En la consola del navegador tienes `window.game` para trastear (p. ej. `game.player.hp = 999`).
