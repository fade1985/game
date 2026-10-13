# Zombie Scape (antes Blob Quest) · notas para continuar

Claude Code lee este archivo en cada sesión: aquí va **solo lo que hace falta siempre**. El detalle de cada
tema está en `docs/` y se lee cuando toca.

## Qué es

Roguelike de zombis para navegador, entre *The Binding of Isaac* y *Hotline Miami*: un conserje (Johnny) limpia
un edificio infestado, apartamento a apartamento. **HTML5 Canvas + JavaScript puro** (módulos ES), sin librerías
ni compilación. Se publica en **Vercel** como web estática: lo que se sube a `main` se publica.

## Cómo trabajamos

- El dueño está **aprendiendo a hacer juegos**. Explicaciones en **español**, claras y sin tecnicismos
  innecesarios. Comentarios del código y mensajes de commit, también en español.
- Se avanza **por fases**: al terminar cada una, resumen + capturas, commit, push y **esperar su visto bueno**.
- Antes de cambios grandes, **contar el plan y preguntar**. Si dice "no hagas nada, solo dime", solo se responde.
- Se trabaja directamente en `main`. No crear pull requests si no los pide.
- **Varias sesiones trabajan a la vez en esta carpeta** (armas, zombis, mapa, escenarios): al hacer commit,
  añadir solo los archivos propios (nada de `git add -A`).
- **Borrar en PixelLab no se puede deshacer:** solo con confirmación expresa del dueño.
- **Ahorrar cuota:** una sesión nueva por tarea (un arma, un zombi), Sonnet para seguir una receta ya rodada y
  Opus para lo nuevo; mirar pocas imágenes; lanzar las generaciones de golpe y comprobar una sola vez.
- El juego es solo pixel art (la versión cartoon se retiró). Lo que aún no tiene sprite se dibuja a mano con el
  dibujo de antes: esos dibujos no se pueden borrar todavía.

## Arrancar y probar

`npm run dev` sirve la carpeta en `http://localhost:3000` (el servidor quita el `.html` de las direcciones).

- **Abrir siempre con `?mudo`** (sin sonido; lo pidió el dueño) y cerrar la pestaña al terminar.
- `?pruebas` → teclas **1–6** sacan cada zombi, **7** el mini jefe, **8** la portera; abre también las armas.
- `?armas` → todas las armas en la sala de mantenimiento. `?sala=<zombi>` → sala de exposición de un zombi.
- Se combinan: `?pruebas&mudo`.
- En la consola el juego es `window.game` (`game.update(1/60)` lo adelanta). `tools/bot.js` juega solo para medir
  el equilibrado (uso en su cabecera).
- Python se llama con `py` (tiene Pillow); poner `PYTHONIOENCODING=utf-8` delante si escribe tildes.
- Guardado en `localStorage`, clave `blobquest-save-v2`.

## Mapa del código (`src/`)

| Archivo | Qué hace |
|---|---|
| `config.js` | Medidas (sala base 960×640, `WALL = 64`, puertas de 96), edificios, estilos de habitación |
| `main.js` | Arranque, bucle, teclas de prueba, carga de sprites |
| `game.js` | El corazón: estados, mapas y puertas, combate y dibujo |
| `building.js` / `apartment.js` / `rooms.js` | Generan la planta, cada apartamento y montan cada mapa (puertas, muebles, oleadas) |
| `shapes.js` | Cuadrícula de cada mapa (casillas de 32), choques y camino de los zombis |
| `render.js` / `furniture.js` / `camera.js` | Suelo, paredes con cara, muebles, minimapa; cámara |
| `sprites.js` | Carga y dibuja las hojas de sprites; si falta una, usa el dibujo de siempre |
| `entities.js` / `zombies.js` / `bosses.js` | Johnny, supervivientes, los 6 zombis y los 2 jefes |
| `weapons.js` / `aim.js` / `props.js` | Armas, apuntado automático, objetos del suelo y muebles con arma |
| `upgrades.js` / `ui.js` / `input.js` / `sfx.js` / `save.js` | Mejoras, menús y HUD, controles, sonido, guardado |

Arte a 480×320 (2 unidades del juego por píxel), casillas de 16 píxeles, personajes de 48. Cada sprite es
`assets/sprites/<id>.png` + `.json` y su id va en `assets/sprites/manifest.json`.

## Dónde está cada tema

| Tema | Documento | Estado (13 de octubre de 2026) |
|---|---|---|
| Armas de Johnny | skill `/arma-nueva` · historia en [`docs/HISTORIA.md`](docs/HISTORIA.md) | Las cinco tienen hoja propia y el visto bueno del dueño |
| Zombis | skill `/zombi-nuevo` · [`docs/ZOMBIS.md`](docs/ZOMBIS.md) | Normal y lento hechos, con visto bueno; venenoso (el gordo, a 72 píxeles) hecho, con visto bueno. Faltan rápido, explosivo y tentáculos |
| Mapa (pasillo y apartamentos) | [`docs/MAPA.md`](docs/MAPA.md) | Fases 1–3 hechas (la 3, pendiente de visto bueno). Siguiente: fase 4, sala de mantenimiento |
| Escenarios (tono oscuro, fondos enteros con ChatGPT) | [`docs/FONDOS.md`](docs/FONDOS.md) | Piloto del baño: bocetos listos, el dueño está generando el primero. Nada en el juego aún |
| PixelLab (receta, costes, trucos) | [`docs/PIXELLAB.md`](docs/PIXELLAB.md) | Todo lo generado se apunta en `assets/pixellab.json`. Antes de tandas grandes, decir el coste |
| Plan del juego y del pixel art | [`docs/PLAN.md`](docs/PLAN.md) · [`docs/PIXEL_ART.md`](docs/PIXEL_ART.md) | Juego: fases 1–8 hechas. Pixel art: quedan jefes, objetos e interfaz |
| Cómo se juega | [`README.md`](README.md) | |

## Pendiente de decidir (preguntar al dueño cuando toque)

- **Escenarios:** lootear y destruir muebles (opciones en `docs/FONDOS.md`); extender los fondos a cocina,
  dormitorio, salón y pasillo cuando el baño tenga el visto bueno; coordinar con la sesión del mapa los tamaños
  fijos de habitación.
- **Limpieza en PixelLab** de lo descartado (listas en `docs/HISTORIA.md`, `docs/ZOMBIS.md` y `assets/pixellab.json`).
- De antes: reposo de Johnny con PixMiniMax, equilibrado de salas grandes, y si el proyecto pasa a Godot
  (`docs/HISTORIA.md`).
