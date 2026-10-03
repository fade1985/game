# 🧹 Blob Quest

Roguelike de zombis para navegador al estilo *The Binding of Isaac*: vista desde arriba, estilo *cartoon*
(formas redondas, contorno grueso, colores planos) y un conserje con su fregona contra un edificio infestado.
Hecho con **HTML5 Canvas + JavaScript puro**, sin librerías ni paso de compilación.

> 🚧 En pleno rediseño por fases. El plan completo y su estado están en [`docs/PLAN.md`](docs/PLAN.md).

## 🎮 Cómo se juega

- **Moverse:** `WASD` o flechas (en móvil: arrastra en la mitad izquierda de la pantalla)
- **Esquivar:** `Espacio` (en móvil: botón 💨). Te hace invulnerable un instante.
- **Atacar:** de momento es automático: apuntas al enemigo más cercano (más adelante será manual).
- **Pausa:** `Esc` o `P`

El edificio **Apartamentos** tiene **3 plantas**. Cada planta es un mapa de salas generado al azar; al entrar
en una sala con enemigos **las puertas se cierran** hasta que la limpias. El **minimapa** (arriba a la derecha)
muestra lo explorado y los iconos de las salas especiales:

| Sala | Qué hay |
|---|---|
| 🧟 Monstruos | Oleadas de enemigos |
| 🎁 Objeto | Un pedestal con una mejora: pásale por encima para cogerla |
| 🙋 Superviviente | Limpia la sala y acércate para que se una a tu equipo (policía, médica o militar) |
| 👹 Mini jefe | Uno por planta. Al derrotarlo aparecen las **escaleras** a la siguiente planta |
| 👑 Jefe final | En la última planta, detrás del mini jefe. Derrótalo para completar el edificio |

Las puertas que llevan a salas especiales tienen el marco de color y un icono al lado.
Los atributos y el equipo se conservan entre plantas; si caes, vuelves a empezar el edificio.

### 🧹 Armas

Empiezas cada edificio con la **fregona**. Al pasar por encima de un arma del suelo la cambias por la tuya
(la vieja se queda en el suelo). El mini jefe siempre suelta un arma y a veces la sala de objeto guarda una.

| Arma | Tipo | Daño | Ataques/s | Detalle |
|---|---|---|---|---|
| 🧹 Fregona | Cuerpo a cuerpo | 8 | 1,8 | Barrido amplio que empuja mucho |
| 🏏 Bate | Cuerpo a cuerpo | 16 | 1,6 | Golpe fuerte |
| 🔪 Cuchillo | Cuerpo a cuerpo | 9 | 4 | Rapidísimo pero de corto alcance |
| 🔫 Pistola | A distancia | 10 | 2,5 | Largo alcance |
| 💥 Escopeta | A distancia | 7 × 5 | 1 | Abanico de perdigones |

Los golpes cuerpo a cuerpo también **destruyen los proyectiles enemigos**. Las mejoras (daño, velocidad de
ataque, alcance) multiplican las estadísticas del arma que lleves.

**Modo de pruebas:** añade `?pruebas` a la dirección (por ejemplo `http://localhost:3000/?pruebas`) y todas
las armas aparecerán en la sala de entrada.

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
  rooms.js        → tipos de sala y su contenido: estilo, obstáculos, alfombras y oleadas
  props.js        → objetos fijos de las salas: pedestal, superviviente, escaleras y armas
  weapons.js      → catálogo de armas (datos) y su dibujo
  aim.js          → controlador de apuntado (automático; el manual irá aquí)
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
