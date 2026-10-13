# Zombie Scape (antes Blob Quest) · notas para continuar

Resumen del proyecto y de lo hablado hasta ahora, para seguir trabajando desde otro equipo.
Claude Code lee este archivo automáticamente al abrir la carpeta.

## Qué es

Roguelike de zombis para navegador, a medio camino entre *The Binding of Isaac* y *Hotline Miami*: un conserje
con su fregona limpia un edificio infestado, apartamento a apartamento. **HTML5 Canvas + JavaScript puro** (módulos ES), sin librerías ni compilación.
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
- **La versión cartoon ya no existe** (retirada el 12 de octubre de 2026 por decisión del dueño): el juego es solo
  pixel art y ya no hay `PIXEL_MODE` ni `?cartoon`. Lo que aún no tiene sprite se sigue dibujando a mano, con el
  dibujo de antes, hasta que tenga el suyo: esos dibujos no se pueden borrar todavía.
- **Mapa nuevo en marcha:** pasillo y apartamentos en vez de salas sueltas. Diseño, decisiones y fases en
  [`docs/MAPA.md`](docs/MAPA.md). **Fases 1, 2 y 3 hechas** (la 3, pendiente de visto bueno): el juego se juega
  entero con el mapa nuevo, con los zombis dormidos en sus habitaciones y las habitaciones sin pisar a oscuras.
  Siguiente: fase 4, la sala de mantenimiento (tablet, arcón y taquillas). Lo lleva una sesión distinta de la de las armas: las dos trabajan en la misma
  carpeta, así que al hacer commit hay que añadir solo los archivos propios (nada de `git add -A`).

## Arrancar y probar

```bash
npm run dev            # sirve la carpeta en http://localhost:3000 (también vale: python -m http.server 3000)
```

- `http://localhost:3000/` → el juego (cámara que sigue al personaje, pantalla completa).
- `http://localhost:3000/assets/pruebas/apartamentos` → planos de apartamentos con colores planos (sin `.html`).
- `?pruebas` → modo pruebas: las teclas **1–6** sacan cada tipo de zombi, **7** el mini jefe y **8** la portera.
  Se puede combinar: `?pruebas&armas`.
- `?armas` → todas las armas abiertas en la sala de mantenimiento (sin tocar el guardado).
- `?mudo` → sin sonido ni música. **Al probar el juego, abrirlo siempre con `?mudo`** (lo pidió el dueño el 12 de
  octubre de 2026: la música del navegador integrado le molesta mientras trabaja). Se combina: `?pruebas&mudo`. `?pruebas` también las abre.
- `?sala=venenoso` → sala de exposición (solo versión pixel): se salta el menú y pone el sprite `zombi-venenoso`
  quieto y girando junto al conserje, sin atacar. Vale para cualquier zombi con sprite: `?sala=normal`...
- Para probar sin mirar: en la consola del navegador el juego está en `window.game`; se puede adelantar
  llamando a `game.update(1/60)` muchas veces. **`tools/bot.js` es un bot que juega solo** para medir el
  equilibrado: `const { runBot } = await import('/tools/bot.js'); await runBot(game, { runs: 10, skipBoss: true })`.
  Tarda unos 2 segundos por partida y bloquea la página mientras tanto (tandas de 15 como mucho por llamada). Después de cada cambio visual, sacar capturas a 1920×1080 y en móvil horizontal.
- Guardado en `localStorage`, clave `blobquest-save-v2` (se mantiene el nombre viejo para no perder partidas guardadas; llaves, Taller, récords por edificio, música).

## Mapa del código (`src/`)

| Archivo | Qué hace |
|---|---|
| `config.js` | Medidas (sala base 960×640, `WALL = 64`, puertas de 96), edificios, estilos de habitación, supervivientes |
| `main.js` | Arranque, bucle, teclas de prueba, carga de sprites |
| `game.js` | El corazón: estados, mapas y puertas (`enterRoom`, `updateDoors`), combate y dibujo (`render`, `drawOffscreen`) |
| `building.js` | Genera cada planta: pasillo, lo que hay tras sus cuatro puertas, llave, superviviente, escaleras; y la azotea |
| `apartment.js` | Generador de apartamentos: habitaciones, tabiques y puertas (ver `docs/MAPA.md`) |
| `rooms.js` | Monta cada mapa (pasillo, apartamento, mantenimiento, azotea): puertas (`makeExit`), muebles y oleadas |
| `camera.js` | Cámara (zoom ×1,5, ×1,15 con un jefe delante; sigue al conserje) |
| `sprites.js` | Carga y dibuja las hojas de sprites de pixel art; si falta un sprite, se usa el dibujo de siempre |
| `shapes.js` | La cuadrícula de cada mapa (suelo/muro), los choques con tabiques y el camino de los zombis (rodean muebles) |
| `render.js` | Suelo (uno por habitación), paredes con cara (`wallFaces`), lo que tiene altura (`sceneryOf`), puertas, minimapa |
| `furniture.js` | Muebles por estilo de habitación y en qué pared puede ir cada uno, decoración de pared, luces |
| `props.js` | Superviviente, la llave del mini jefe, armas en el suelo y muebles con arma |
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

Los sprites se generan con PixelLab por su **servidor MCP** (`mcp__pixellab__*`; sin clave ni script). Plan Tier 1:
2000 generaciones al mes (se renuevan el día 12); `get_balance` dice cuántas quedan. Antes de tandas grandes,
calcular el coste y **decírselo al dueño**. Todo lo generado se apunta en `assets/pixellab.json`.
**Receta completa, costes, trucos y fallos conocidos: [`docs/PIXELLAB.md`](docs/PIXELLAB.md)** (leer al generar arte).
Armas de Johnny: skill `/arma-nueva` (`.claude/skills/arma-nueva/SKILL.md`). Zombis: ver más abajo.

## Dónde lo dejamos (13 de octubre de 2026)

Historia detallada de cada arma y decisiones cerradas: [`docs/HISTORIA.md`](docs/HISTORIA.md). Resumen vivo:

- **En el juego, con visto bueno:** Johnny con fregona, bate y pistola (hojas `conserje-48-guardia`, `-bate`,
  `-pistola`), la bala y su impacto. El cuchillo es la única arma sin hoja propia (usa `conserje-48`) y la
  siguiente por hacer con `/arma-nueva cuchillo`.
- **Escopeta** (`conserje-48-escopeta`): en el juego, con el visto bueno final del dueño (13 de octubre de 2026: "la prueba está perfecta").
- **Pendientes de limpieza en PixelLab (solo con su confirmación expresa):** ver `docs/HISTORIA.md` y las notas de
  cada sprite en `assets/pixellab.json`.
- **Sin decidir:** rehacer el zombi venenoso (piel beige), reposo de Johnny con PixMiniMax, equilibrado de salas
  grandes, arte del salón, y si el dueño pasa a Godot (ver `docs/HISTORIA.md`).

## Zombis en pixel art (en curso, lo lleva otra sesión distinta de las de armas y mapa)

Empezado el 12 de octubre de 2026. Se hace como las armas: un zombi de piloto (el normal) hasta verlo en el
juego y luego una skill `/zombi-nuevo` para los otros cinco. Ids, textos y costes en `assets/pixellab.json`
(`zombi-normal-48`).

- **Decidido por el dueño:** diseños inventados (no tiene dibujos), realistas y con el estilo de Johnny, a 48
  píxeles. Cada zombi lleva cuatro animaciones: andar, atacar, recibir golpe y morir.
- **Modelo del zombi normal: con visto bueno.** PixelLab saca la piel beige aunque se pida verde (pasó también
  con el venenoso): se corrige gratis con `py tools/piel.py <sprite>` y las 8 vistas corregidas se importan como
  personaje nuevo (`create_character` en modo `v3` con `direction_images`, 0,25 generaciones).
- **El zombi normal ya está en el juego** (sprite `zombi-normal`, a 48 píxeles): reposo, andar, zarpazo, golpe
  recibido y muerte en las 8 direcciones. Costó unas 43 generaciones. **Pendiente del visto bueno final del dueño**
  (captura en `assets/pruebas/zombi-normal-en-juego.jpg`, GIF de cada animación en `assets/pruebas/zombi-normal-*.gif`).
  - **Cómo se monta:** `py tools/zombi.py zombi-normal-48 zombi-normal` rehace la hoja (casillas de 96×96) a partir
    de `assets/sources/zombi-normal-48/` (`rotations/`, `walk/`, `ataque/`, `golpe/`, `muerte/`). Oscurece la sangre
    de rojo vivo que mete PixelLab (decisión del dueño: sangre sí, pero apagada), quita los destellos y elige solo
    el tramo del andar que hace ciclo.
  - **En el juego** (todo en `zombies.js`): el zarpazo se ve al llegar al conserje pero el daño sigue siendo por
    contacto, como antes; al recibir un golpe se ve `hurt`; al morir deja un cuerpo (`Corpse`) que cae y se queda
    tendido en la sala (12 como mucho por sala). Vale para cualquier zombi cuya hoja tenga `attack`, `hurt` y `death`.
  - **Pegas conocidas:** de frente y de espaldas anda con los brazos bajos y en las otras direcciones con los
    brazos estirados (con el texto común se giraba de perfil); el ciclo de andar no cierra del todo limpio.
  - **Limpieza pendiente en PixelLab (solo con su confirmación):** el personaje de piel beige, el andar de
    plantilla y los cuatro andares descartados.
  - **Siguiente:** con su visto bueno, crear la skill `/zombi-nuevo` y seguir con los otros cinco (lento, rápido,
    explosivo, tentáculos y venenoso).

