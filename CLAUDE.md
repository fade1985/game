# Zombie Scape (antes Blob Quest) · notas para continuar

Resumen del proyecto y de lo hablado hasta ahora, para seguir trabajando desde otro equipo.
Claude Code lee este archivo automáticamente al abrir la carpeta.

## Qué es

Roguelike de zombis para navegador al estilo *The Binding of Isaac*: un conserje con su fregona limpia un
edificio infestado, sala a sala. **HTML5 Canvas + JavaScript puro** (módulos ES), sin librerías ni compilación.
Se publica en **Vercel** como web estática (preset "Other").

- Rama de trabajo: `main` (se trabaja directamente en ella; lo que se sube a `main` se publica en Vercel).
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
- La **versión cartoon** (con `?cartoon`) es la de siempre y no se toca salvo que lo pida. Todo lo del pixel art y la
  cámara va **solo en la versión pixel**.

## Arrancar y probar

```bash
npm run dev            # sirve la carpeta en http://localhost:3000 (también vale: python -m http.server 3000)
```

- `http://localhost:3000/` → versión pixel art, la de por defecto (cámara que sigue al personaje, pantalla completa).
- `http://localhost:3000/?cartoon` → versión cartoon, la original.
- `?pruebas` → modo pruebas: las teclas **1–6** sacan cada tipo de zombi, **7** el mini jefe y **8** la portera.
  Se puede combinar: `?cartoon&pruebas`.
- `?armas` → todas las armas abiertas en la entrada (sin tocar el guardado). `?pruebas` también las abre.
- `?sala=venenoso` → sala de exposición (solo versión pixel): se salta el menú y pone el sprite `zombi-venenoso`
  quieto y girando junto al conserje, sin atacar. Vale para cualquier zombi con sprite: `?sala=normal`...
- Para probar sin mirar: Playwright con Chromium. En la consola del navegador el juego está en `window.game`;
  se puede adelantar llamando a `game.update(1/60)` muchas veces (así se hicieron las simulaciones de partidas
  con un "bot" para equilibrar). Después de cada cambio visual, sacar capturas a 1920×1080 y en móvil horizontal.
- Guardado en `localStorage`, clave `blobquest-save-v2` (se mantiene el nombre viejo para no perder partidas guardadas; llaves, Taller, récords por edificio, música).

## Mapa del código (`src/`)

| Archivo | Qué hace |
|---|---|
| `config.js` | Medidas (sala 960×640, `WALL = 64`, puertas de 96), edificios, armas, supervivientes, `PIXEL_MODE` |
| `main.js` | Arranque, bucle, teclas de prueba, carga de sprites |
| `game.js` | El corazón: estados, salas, combate, render cartoon (`render`) y pixel (`renderPixel`, `drawOffscreen`) |
| `camera.js` | Cámara de la versión pixel (zoom ×1,5, ×1,15 en salas de jefe; sigue al conserje) |
| `sprites.js` | Carga y dibuja las hojas de sprites de pixel art; si falta un sprite, se usa el dibujo de siempre |
| `floor.js` / `rooms.js` | Generación de plantas y salas |
| `shapes.js` | Forma de las salas (solo pixel): cuadrícula de suelo/muro, muros interiores y camino de los zombis |
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

Los sprites se generan con PixelLab. Desde el 12 de octubre de 2026 está conectado a Claude Code por su
**servidor MCP** (herramientas `mcp__pixellab__*`), que es la vía principal: no hace falta clave ni script.

- **Plan:** Tier 1 (Pixel Apprentice), **2000 generaciones al mes** (se renuevan el día 12) más un bono diario de 20
  que solo se gasta si se agotan las del mes. Para ver cuántas quedan: herramienta `get_balance`.
- **Lo que cuesta cada cosa** (orientativo; la respuesta de cada herramienta dice lo que se ha cobrado):
  - Personaje en modo estándar: 1. En modo `v3`: 2–9. En modo `pro`: 10–25.
  - Animación de plantilla (`walking`, `breathing-idle`...): 1 por dirección.
  - Animación "a medida" en modo `v3`: 1 por dirección a 64 px o menos. Ya no hay que evitarlas.
  - Objeto o mueble (`create_1_direction_object`, `create_8_direction_object`): 10–25.
  - Antes de lanzar tandas grandes, calcular el total y **decírselo al dueño**.
- Todo lo generado se apunta en `assets/pixellab.json` (texto, semilla, ids) para poder repetirlo.
- **Vía antigua (sigue valiendo):** `tools/pixellab.mjs` llama a la API directamente
  (`balance`, `character`, `animate`, `animate-text`, `export`, `image`; uso en la cabecera del archivo).
  Necesita la clave en la variable de entorno **`PIXELLAB_API_KEY`**. **Nunca** pegarla en el chat, en el código ni
  en un commit. En Windows (PowerShell): `$env:PIXELLAB_API_KEY = "..."` para la sesión actual, o
  `setx PIXELLAB_API_KEY "..."` para siempre (hay que abrir una terminal nueva después).
  `export` descomprime con `python3`; en Windows puede que haya que cambiarlo a `python` o `py`.

## Lo que queda

### 1. Decisiones pendientes (antes de seguir con el pixel art)

1. **Visto bueno al aspecto** de la prueba (conserje, zombi normal, sofá y suelo del salón) y a la cámara.
2. **Tamaño de los personajes:** 32 o 48 píxeles. Con el zoom ×1,5 de la cámara, 32 probablemente basta.
3. **Suelo:** dejar el parquet actual (suavizado con el color de la sala) o generar uno más liso (1 generación).
   Para los demás suelos pedir algo "simple, subtle, low contrast".
4. **Muebles:** PixelLab los da en perspectiva (se ve el frente). Opciones: ponerlos solo en las paredes de
   arriba y abajo, o generar también una versión lateral de cada uno.
5. ~~**Créditos:** decidir el plan de PixelLab para la migración completa.~~ **Hecho:** Tier 1 contratado y
   conectado por MCP (ver el apartado PixelLab).

### 2. Fases del pixel art

| Fase | Qué se hace |
|---|---|
| 2 · Escenarios | 5 suelos (salón, cocina, dormitorio, pasillo, baño), paredes, puertas, escaleras y unos 20 muebles |
| 3 · Personajes | Conserje y 3 supervivientes (policía, médica, militar) y los 6 zombis, con sus animaciones |
| 4 · Jefes | El vecino del 4ºB y la portera (48×48 o 64×64) |
| 5 · Objetos e interfaz | Armas, objetos, corazón, llave, proyectiles, charcos, efectos, iconos y fuente |

La versión pixel ya es la de por defecto; lo que aún no tiene sprite se ve con el dibujo cartoon.

### 3. Mecánicas nuevas (decididas el 12 de octubre de 2026)

- **Elegir arma en la entrada: hecho.** Cada arma espera en su mueble (`stash` en `weapons.js`, dibujo en
  `WeaponStash` de `props.js`). Se desbloquean al encontrarlas en una partida (`weapons` en el guardado).
  Más adelante puede que se compren o que se creen armas nuevas: por eso el mueble es un dato de cada arma.
- **Salas con forma libre y procedurales: primera versión hecha** (`shapes.js`). **Solo en la versión pixel**;
  la cartoon sigue con sus salas rectangulares.
  - Cada sala es una cuadrícula de casillas de 32 unidades (30×20), suelo o muro. La forma sale de "morder" el
    rectángulo de 960×640 con bloques de muro: esquinas recortadas (L, T, cruz), entrantes en los lados sin
    puerta (U) y columnas. La mitad de las salas son simétricas.
  - Siempre quedan libres el centro y un pasillo de 6 casillas desde cada puerta. No hay pasos de menos de 2
    casillas y queda al menos el 60 % del suelo. La entrada y las salas de jefe siguen siendo rectangulares.
  - Los zombis rodean las esquinas (`wayTo`); balas, objetos, apariciones y apuntado respetan los muros; los
    muebles se arriman también a los muros interiores.
  - **Salas más grandes que la de siempre: hecho.** Algo más de la mitad de las salas de monstruos miden entre
    960×640 y 1408×896 (`pickSize`: 30–44 casillas de ancho, 20–28 de alto). Cada sala guarda sus medidas en
    `layout.w`, `layout.h`, `layout.cols` y `layout.rows`; en `game.js` se leen con `this.rw` y `this.rh`.
    `W` y `H` quedan solo para el tamaño de la pantalla y de la sala de siempre (entrada, jefes, menú, cartoon).
    En las grandes hay más muebles, más obstáculos, islas de muro y algún zombi más (`makeWaves`, parámetro
    `big`: +60 % de presupuesto por cada vez que se dobla la superficie). **Este equilibrado está sin probar
    con partidas simuladas.**
  - **Pendiente:** puertas que no estén en el centro de cada lado, y que el minimapa refleje el tamaño de cada sala.
- **Consecuencia para el arte:** los escenarios se generan como **piezas sueltas que encajan** (baldosa de suelo,
  tramos de pared, esquinas hacia dentro y hacia fuera, hueco de puerta) y muebles aparte; nunca salas enteras.

### 4. Pequeños pendientes

- El **reloj** y las **nubes de las ventanas** se quedan quietos en la versión pixel (la sala se guarda como una
  imagen fija). Se ofreció volver a animarlos dibujándolos aparte cada fotograma.
- Más adelante: los otros edificios (hospital, centro comercial, comisaría) aparecen como "Próximamente".

## Sobre pasar a Godot

Se habló de si convenía pasar el juego a Godot. Conclusión: **para una demo web con la que aprender, seguir con
JavaScript** (el ciclo de cambiar, capturar y simular partidas es muy rápido). Si el objetivo pasa a ser un juego
más grande para PC o móvil, Godot merece la pena y el mejor momento sería **antes de migrar el resto al pixel art**.
En ese caso, trabajar con Claude Code en el propio PC junto al editor de Godot. Los sprites de PixelLab, el diseño
y los valores de equilibrado se aprovecharían tal cual. Queda pendiente que el dueño decida su objetivo.
