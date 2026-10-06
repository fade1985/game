# Blob Quest · notas para continuar

Resumen del proyecto y de lo hablado hasta ahora, para seguir trabajando desde otro equipo.
Claude Code lee este archivo automáticamente al abrir la carpeta.

## Qué es

Roguelike de zombis para navegador al estilo *The Binding of Isaac*: un conserje con su fregona limpia un
edificio infestado, sala a sala. **HTML5 Canvas + JavaScript puro** (módulos ES), sin librerías ni compilación.
Se publica en **Vercel** como web estática (preset "Other").

- Rama de trabajo: `claude/roguelike-game-demo-9hgf9b` (todavía no se ha fusionado con `main`).
- Plan por fases del juego: [`docs/PLAN.md`](docs/PLAN.md) — fases 1 a 8 **hechas**.
- Plan del pixel art: [`docs/PIXEL_ART.md`](docs/PIXEL_ART.md) — fases 0 y 1 hechas, quedan 2 a 5.
- Cómo se juega, objetos, zombis, Taller...: [`README.md`](README.md).

## Cómo trabajamos

- El dueño del proyecto está **aprendiendo a hacer juegos**. Las explicaciones van en **español**, claras y sin
  tecnicismos innecesarios. Los comentarios del código y los mensajes de los commits, también en español.
- Se avanza **por fases**. Al terminar cada una: resumen + capturas de pantalla, commit, push, y **esperar su
  visto bueno** antes de empezar la siguiente.
- Antes de cambios grandes, **contar el plan y preguntar**. Si dice "no hagas nada, solo dime", solo se responde.
- No crear pull requests si no los pide.
- La **versión cartoon** (sin `?pixel`) es la de siempre y no se toca salvo que lo pida. Todo lo del pixel art y la
  cámara va **solo en la versión pixel**.

## Arrancar y probar

```bash
npm run dev            # sirve la carpeta en http://localhost:3000 (también vale: python -m http.server 3000)
```

- `http://localhost:3000/` → versión cartoon.
- `http://localhost:3000/?pixel` → versión pixel art (cámara que sigue al personaje, pantalla completa).
- `?pruebas` → modo pruebas: las teclas **1–6** sacan cada tipo de zombi, **7** el mini jefe y **8** la portera.
  Se puede combinar: `?pixel&pruebas`.
- Para probar sin mirar: Playwright con Chromium. En la consola del navegador el juego está en `window.game`;
  se puede adelantar llamando a `game.update(1/60)` muchas veces (así se hicieron las simulaciones de partidas
  con un "bot" para equilibrar). Después de cada cambio visual, sacar capturas a 1920×1080 y en móvil horizontal.
- Guardado en `localStorage`, clave `blobquest-save-v2` (llaves, Taller, récords por edificio, música).

## Mapa del código (`src/`)

| Archivo | Qué hace |
|---|---|
| `config.js` | Medidas (sala 960×640, `WALL = 64`, puertas de 96), edificios, armas, supervivientes, `PIXEL_MODE` |
| `main.js` | Arranque, bucle, teclas de prueba, carga de sprites |
| `game.js` | El corazón: estados, salas, combate, render cartoon (`render`) y pixel (`renderPixel`, `drawOffscreen`) |
| `camera.js` | Cámara de la versión pixel (zoom ×1,5, ×1,15 en salas de jefe; sigue al conserje) |
| `sprites.js` | Carga y dibuja las hojas de sprites de pixel art; si falta un sprite, se usa el dibujo de siempre |
| `floor.js` / `rooms.js` | Generación de plantas y salas |
| `render.js` | Suelo, paredes, puertas, minimapa |
| `furniture.js` / `props.js` | Muebles por estilo de habitación, decoración de pared, luces |
| `entities.js` / `zombies.js` / `bosses.js` | Conserje, supervivientes, los 6 zombis, el vecino del 4ºB y la portera |
| `weapons.js` / `aim.js` | Armas y apuntado automático |
| `upgrades.js` | Objetos de pedestal y mejoras del Taller |
| `ui.js` / `input.js` | Menús, HUD, controles de teclado y táctiles |
| `sfx.js` | Sonidos y música hechos con Web Audio (sin archivos de audio) |
| `save.js` | Guardado en `localStorage` |

## Pixel art (en curso)

Detalles completos en [`docs/PIXEL_ART.md`](docs/PIXEL_ART.md). Lo esencial:

- Arte a 480×320 (`PIXEL = 2` unidades por píxel), baldosas de 16, personajes en lienzos de 32×32.
- Cada sprite es `assets/sprites/<id>.png` + `<id>.json` y su id va en `assets/sprites/manifest.json`.
  Nombres: `conserje`, `zombi-<tipo>`, `mueble-<tipo>`, `suelo-<estilo>`.
- La sala se dibuja una vez en un lienzo pequeño y se guarda; cada fotograma se amplía con desplazamiento exacto.
  Los personajes se dibujan a resolución de pantalla en su posición exacta (así no "tiemblan").
- Sin marco: ocupa toda la ventana; se ve siempre la misma altura de sala y el ancho depende de la pantalla.
- Los enemigos fuera de la vista se marcan con un **"!"** en el borde (rojo parpadeante si van a atacar).

### PixelLab

Los sprites se generan con la API de PixelLab mediante `tools/pixellab.mjs`
(`balance`, `character`, `animate`, `animate-text`, `export`, `image`; uso en la cabecera del archivo).

- La clave va en la variable de entorno **`PIXELLAB_API_KEY`**. **Nunca** pegarla en el chat, en el código ni en
  un commit. En Windows (PowerShell): `$env:PIXELLAB_API_KEY = "..."` para la sesión actual, o
  `setx PIXELLAB_API_KEY "..."` para siempre (hay que abrir una terminal nueva después).
- `export` descomprime con `python3`; en Windows puede que haya que cambiarlo a `python` o `py`.
- Todo lo generado se apunta en `assets/pixellab.json` (texto, semilla, ids) para poder repetirlo.
- Plan de prueba: quedaban **27 de 40 generaciones**, un solo trabajo a la vez y una dirección por llamada
  (el script ya lo tiene en cuenta). La animación de plantilla `walking` cuesta 1 por dirección; las animaciones
  "a medida" cuestan 20–40 por dirección, así que **evitarlas**. Para la migración completa hará falta un plan de pago.

## Lo que queda

### 1. Decisiones pendientes (antes de seguir con el pixel art)

1. **Visto bueno al aspecto** de la prueba (conserje, zombi normal, sofá y suelo del salón) y a la cámara.
2. **Tamaño de los personajes:** 32 o 48 píxeles. Con el zoom ×1,5 de la cámara, 32 probablemente basta.
3. **Suelo:** dejar el parquet actual (suavizado con el color de la sala) o generar uno más liso (1 generación).
   Para los demás suelos pedir algo "simple, subtle, low contrast".
4. **Muebles:** PixelLab los da en perspectiva (se ve el frente). Opciones: ponerlos solo en las paredes de
   arriba y abajo, o generar también una versión lateral de cada uno.
5. **Créditos:** decidir el plan de PixelLab para la migración completa.

### 2. Fases del pixel art

| Fase | Qué se hace |
|---|---|
| 2 · Escenarios | 5 suelos (salón, cocina, dormitorio, pasillo, baño), paredes, puertas, escaleras y unos 20 muebles |
| 3 · Personajes | Conserje y 3 supervivientes (policía, médica, militar) y los 6 zombis, con sus animaciones |
| 4 · Jefes | El vecino del 4ºB y la portera (48×48 o 64×64) |
| 5 · Objetos e interfaz | Armas, objetos, corazón, llave, proyectiles, charcos, efectos, iconos y fuente |

Al terminar, cuando todo tenga sprite, se puede hacer que la versión pixel sea la de por defecto.

### 3. Pequeños pendientes

- El **reloj** y las **nubes de las ventanas** se quedan quietos en la versión pixel (la sala se guarda como una
  imagen fija). Se ofreció volver a animarlos dibujándolos aparte cada fotograma.
- Fusionar la rama con `main` (pull request) cuando se quiera publicar en la dirección principal de Vercel.
- Más adelante: los otros edificios (hospital, centro comercial, comisaría) aparecen como "Próximamente".

## Sobre pasar a Godot

Se habló de si convenía pasar el juego a Godot. Conclusión: **para una demo web con la que aprender, seguir con
JavaScript** (el ciclo de cambiar, capturar y simular partidas es muy rápido). Si el objetivo pasa a ser un juego
más grande para PC o móvil, Godot merece la pena y el mejor momento sería **antes de migrar el resto al pixel art**.
En ese caso, trabajar con Claude Code en el propio PC junto al editor de Godot. Los sprites de PixelLab, el diseño
y los valores de equilibrado se aprovecharían tal cual. Queda pendiente que el dueño decida su objetivo.
