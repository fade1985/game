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
| `render.js` | Suelo (uno por habitación), paredes, puertas, minimapa |
| `furniture.js` | Muebles por estilo de habitación, decoración de pared, luces |
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

Los sprites se generan con PixelLab. Desde el 12 de octubre de 2026 está conectado a Claude Code por su
**servidor MCP** (herramientas `mcp__pixellab__*`), que es la vía principal: no hace falta clave ni script.

- **Plan:** Tier 1 (Pixel Apprentice), **2000 generaciones al mes** (se renuevan el día 12) más un bono diario de 20
  que solo se gasta si se agotan las del mes. Para ver cuántas quedan: herramienta `get_balance`.
- **Lo que cuesta cada cosa** (orientativo; la respuesta de cada herramienta dice lo que se ha cobrado):
  - Personaje en modo estándar: 1. En modo `v3`: 2–9. En modo `pro`: 10–25.
  - Animación de plantilla (`walking`, `breathing-idle`...): 1 por dirección.
  - Animación "a medida" en modo `v3` o `pixminimax`: 1–2 por dirección a 64 px o menos. Ya no hay que evitarlas.
  - Estado de un personaje (otra ropa, un arma en la mano): unas 10.
  - Objeto o mueble (`create_1_direction_object`, `create_8_direction_object`): 10–25.
  - Antes de lanzar tandas grandes, calcular el total y **decírselo al dueño**.
- Todo lo generado se apunta en `assets/pixellab.json` (texto, semilla, ids) para poder repetirlo.
- **Muebles y suelos: como imagen suelta (`create_image_pixflux`, 1 generación cada uno), no como "objeto"**
  (10–25). Los 20 muebles y los 7 suelos ya tienen sprite (12 de octubre de 2026). Receta de los muebles:
  - Se pide con una **guía** como imagen de partida (`init_image_base64`, fuerza 90–150): el dibujo a mano de
    siempre a mitad de tamaño (`assets/sources/muebles/guias/`). Así sale visto desde arriba, de espaldas a la
    pared de arriba y con el tamaño exacto, y el juego lo puede girar a cualquier pared. Sin guía PixelLab lo
    hace en perspectiva y de otro tamaño.
  - Si el mueble tiene un tablero liso (escritorio, armario, lavadora), pedirlo **con fondo** (la guía sobre un
    azul liso) y no con `no_background`: PixelLab se come el tablero al quitar el fondo. El fondo lo quita
    `py tools/mueble.py`, que monta todos los sprites desde `assets/sources/muebles/`.
  - PixelLab solo deja 8 generaciones a la vez.
  - El armario (`wardrobe`) quedó flojo: es un tablón de madera. Pendiente de repetir o retocar.
- **Animaciones muy sutiles (reposo): mejor hacerlas a mano que pedirlas.** Las de PixelLab redibujan el
  personaje en cada fotograma y a 48 píxeles la cara "baila". La de reposo de Johnny (`conserje-48`) la hace
  `tools/idle.py` a partir de sus 8 rotaciones: respiración de 1 píxel y parpadeo, sin tocar ningún otro píxel.
  PixelLab sigue siendo lo indicado para animaciones con movimiento de verdad (andar, atacar, morir).
- **Andar de Johnny:** plantilla `walking-8-frames` de PixelLab en las 8 direcciones. Los fotogramas tal cual
  salen se guardan en `assets/sources/conserje-48/walk/` y `tools/walk.py conserje-48` los monta en la hoja
  (iguala los colores a los del dibujo quieto y alinea los pies). En el juego el paso avanza según la distancia
  recorrida (`STEP` en `entities.js`), no según el reloj: así arranca y frena con el personaje.
- **Las plantillas no valen para un personaje con un arma en la mano.** Probado el 12 de octubre de 2026 con
  `walking-8-frames` sobre el estado "Fregona en guardia": en 7 de las 8 direcciones Johnny pierde la fregona y
  sale más grande. Para esos estados, todo con PixMiniMax (el andar también: 1 generación por dirección, las 8
  en una sola llamada, y luego se recorta el tramo que hace ciclo).
- **Receta para animar un personaje nuevo:** probar 3 o 4 plantillas en una sola dirección (de perfil, `east`),
  elegir la mejor y lanzar las otras 7 direcciones en el mismo grupo (`animation_group_id`).
- **Animaciones a medida (sin plantilla): usar el modo `pixminimax`, no `v3`.** Probados los dos con Johnny el
  12 de octubre de 2026: PixMiniMax mantiene la cara, la ropa y el tamaño; v3 le cambió la cara en el reposo y
  le quitó la camisa en el ataque. Cuesta 1 generación por dirección con 8 o 12 fotogramas a 64 píxeles.
  - El texto, largo y por partes, como en los ejemplos de la web de PixelLab: qué hace el cuerpo, qué se mueve
    detrás (pelo, tela, la mopa), el efecto, cómo vuelve a la postura inicial, y al final "Static camera,
    completely locked-off shot. Maintain the crisp 2D pixel art aesthetic...". El texto usado para el ataque de
    la fregona está entero en `assets/pixellab.json` (`conserje-48-guardia` → `ataque_pruebas`).
  - Para que la animación acabe donde empieza, pasar el dibujo quieto de esa dirección también como fotograma
    final (`end_frame_base64`). Obliga a lanzar las direcciones de una en una.
  - Si el movimiento se sale del lienzo (un arma larga), dar como fotograma de partida y de llegada el dibujo
    quieto centrado en un lienzo mayor. Para el ataque de la fregona: el de 64×64 pegado en uno de 96×96 en la
    posición (16, 20).
  - No pedir parpadeos: los hace largos y repetidos. Se añaden a mano después.
- **Un arma en la mano es un "estado" del personaje** (`create_character_state`, unas 10 generaciones): una copia
  con las 8 rotaciones cambiadas. Las animaciones se hacen sobre cada estado por separado, así que cada arma
  necesita su estado y sus propias animaciones de andar y de atacar (unas 30–45 generaciones por arma).
- **Vía antigua (sigue valiendo):** `tools/pixellab.mjs` llama a la API directamente
  (`balance`, `character`, `animate`, `animate-text`, `export`, `image`; uso en la cabecera del archivo).
  Necesita la clave en la variable de entorno **`PIXELLAB_API_KEY`**. **Nunca** pegarla en el chat, en el código ni
  en un commit. En Windows (PowerShell): `$env:PIXELLAB_API_KEY = "..."` para la sesión actual, o
  `setx PIXELLAB_API_KEY "..."` para siempre (hay que abrir una terminal nueva después).
  `export` descomprime con `python3`; en Windows puede que haya que cambiarlo a `python` o `py`.

## Dónde lo dejamos (12 de octubre de 2026) · preguntar al dueño al retomar

**Al retomar, empezar preguntándole por el punto 1.**
Los ids, textos y costes de todo lo de abajo están en `assets/pixellab.json`. Quedaban 1.854 generaciones.

Johnny con la fregona **ya está en el juego** (solo versión pixel): sprite `conserje-48-guardia`, estado
"Fregona en guardia" del personaje "Johnny" en PixelLab. Tiene reposo, andar y ataque en las 8 direcciones.

- **Cómo se monta:** `py tools/arma.py conserje-48-guardia` rehace la hoja entera (casillas de 96×96) a partir de
  `assets/sources/conserje-48-guardia/`: `rotations/`, `walk/`, `ataque/` y `arma.json` (qué fotogramas se usan
  de cada animación). El reposo lo calcula el script, como `tools/idle.py`. En este ordenador Python se llama
  con `py` (no `python`) y tiene Pillow instalado.
- **En el juego:** el arma dice qué hoja usa (`sprite` en `weapons.js`). Con hoja propia no se dibuja el arma
  cartoon ni la estela azul del barrido, y el daño se hace cuando la mopa llega al suelo, no al empezar (el
  momento lo dice la hoja: `impacto` en `arma.json` → `hit` en el JSON del sprite). El andar avanza por ciclo (`cycle` en `drawSprite`)
  porque cada dirección tiene un número distinto de fotogramas (entre 6 y 10).
- **Ataque:** 9 fotogramas elegidos de los 13 de PixelLab, medio segundo, con estela de agua. La dirección de
  espaldas lleva un texto propio (con el común se daba la vuelta). Vista previa de los fotogramas sin recortar:
  `http://localhost:3000/assets/pruebas/ataque-fregona` (sin `.html`: el servidor lo quita).
- **Johnny con el bate** (`conserje-48-bate`, estado "Bate en guardia") va igual: mismas carpetas, mismo script.
  Su `arma.json` solo dice qué fotogramas del ataque se usan; lo demás lo pone el script.
- Johnny sin arma (`conserje-48`) sigue igual y es el que se ve con las demás armas (cuchillo, pistola, escopeta).

Preguntas pendientes, por orden:

1. **La pistola tiene el visto bueno del dueño** ("está de lujo"). Johnny con la pistola de 9 mm está en el
   juego (sprite `conserje-48-pistola`, 32 generaciones): reposo, andar y disparo en las 8 direcciones.
   Lo siguiente que pidió: **la bala**. Hecha en pixel art desde el código (`drawTracer` en `render.js`, sin
   PixelLab): una trazadora de cuadraditos encajados en la cuadrícula, punta casi blanca y estela de amarillo
   a naranja; las críticas más gordas y rojizas, los perdigones más pequeños. Vale para todas las balas del
   conserje y de los compañeros; los proyectiles de los zombis siguen como estaban. También su **impacto**
   (`bulletImpact` en `game.js`): un destello cuadrado y chispas del color de la bala que rebotan hacia atrás,
   más algo de polvo si da en un muro; son partículas `px` (cuadraditos encajados en la cuadrícula que encogen
   en vez de desvanecerse). **Pendiente de que vea la bala y el impacto jugando y diga si le valen.**
   - **Armas a distancia, cómo quedó programado:** al disparar con un arma con hoja propia se pone la animación
     `attack` sin retrasar la bala, y no se dibuja el arma de siempre ni su fogonazo ni su casquillo. La bala
     nace en la boca del arma del dibujo: `"boca": "fogonazo"` en `arma.json` hace que `tools/arma.py` la busque
     sola (el centro del fogonazo) y la apunte en el JSON del sprite (`muzzle`). Como el dibujo es alto, la bala
     se mueve por el suelo como siempre pero se **dibuja** levantada (`lift`: `MUZZLE_LIFT` en `entities.js`,
     `BULLET_LIFT` en `game.js`, `drawBullet` en `render.js`).
   - **Disparar andando (a petición del dueño):** antes las piernas se quedaban quietas mientras duraba la
     animación de disparo. Primero se probó a partir a Johnny por la cintura (piernas del andar + torso del
     disparo) y **el dueño lo rechazó: "el cuerpo tiene que estar unido siempre y no partirse"** (la cadera se
     veía desacompasada). Solución actual: `"efectos": true` en `arma.json` hace que la hoja lleve la animación
     `fx`, que es cada fotograma de disparo con SOLO el fogonazo, el humo y el casquillo. Si anda y dispara,
     `Player.draw` pinta el andar entero, de una pieza, y encima esos efectos; el retroceso de los brazos solo
     se ve disparando parado. **No volver a partir el cuerpo.** Solo para armas de fuego; la fregona y el bate
     siguen igual. Pendiente de que el dueño lo vea jugando.
   - **Lo descartado de la pistola ya está borrado de PixelLab** (12 de octubre de 2026, con su confirmación).
   - **El bate está en el juego** (sprite `conserje-48-bate`, 27 generaciones) y tiene el visto bueno del dueño.
   - **La fregona tiene la estela de agua dentro del dibujo.** Decidido por el dueño: las estelas van siempre en
     el sprite y creíbles para cada arma (agua, aire, fuego...), nunca pintadas por el juego.
   - **Armas que quedan:** cuchillo (cuerpo a cuerpo, sale con la skill tal cual) y escopeta (a distancia: ya
     vale lo programado para la pistola; solo cambia que dispara 5 perdigones).
2. **La skill `/arma-nueva` ya existe** (`.claude/skills/arma-nueva/SKILL.md`). Si en una sesión nueva no
   aparece en la lista, leer ese archivo y seguirlo igual.
3. **Limpieza de los estados de la fregona, del bate y de la pistola: hecha** el 12 de octubre de 2026 con su confirmación. En
   PixelLab quedan solo las animaciones que usa el juego. El resto de la limpieza sigue pendiente (punto 6).
4. **Dos pegas del estado "Fregona en guardia"** que vio y no ha dicho si le molestan: usa 18 colores frente a
   los 50 del Johnny sin arma (ropa más plana), y la mopa cambia de lado entre la vista de frente y las diagonales.
5. **Reposo:** sigue el hecho a mano ("de momento sirve"). Hay una prueba de frente con PixMiniMax que respeta
   mucho mejor a Johnny que la plantilla, pero parpadea demasiado. Propuesta sin contestar: repetirla sin
   parpadeo (1 generación) y, si gusta, las otras 7 direcciones.
6. **Limpieza en PixelLab (borrar no se puede deshacer: solo con su confirmación expresa):** el estado
   descartado "Con fregona" (mopa abajo) y, según lo que decida en el punto 5, la
   prueba de reposo con PixMiniMax y el reposo de plantilla. También el conserje antiguo de 32 píxeles.
7. **De antes, sin decidir:** rehacer el zombi venenoso (salió con la piel beige en vez de verde) y si su sprite
   de prueba debe verse en las partidas normales; si la elección de arma se queda también en la versión cartoon;
   probar con partidas simuladas el equilibrado de las salas grandes; y empezar el arte del salón.

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
    de `assets/sources/zombi-normal-48/` (`rotations/`, `walk/`, `ataque/`, `golpe/`, `muerte/`). Quita la sangre
    de rojo vivo y los destellos que mete PixelLab y elige solo el tramo del andar que hace ciclo.
  - **En el juego** (todo en `zombies.js`): el zarpazo se ve al llegar al conserje pero el daño sigue siendo por
    contacto, como antes; al recibir un golpe se ve `hurt`; al morir deja un cuerpo (`Corpse`) que cae y se queda
    tendido en la sala (12 como mucho por sala). Vale para cualquier zombi cuya hoja tenga `attack`, `hurt` y `death`.
  - **Pegas conocidas:** de frente y de espaldas anda con los brazos bajos y en las otras direcciones con los
    brazos estirados (con el texto común se giraba de perfil); el ciclo de andar no cierra del todo limpio.
  - **Limpieza pendiente en PixelLab (solo con su confirmación):** el personaje de piel beige, el andar de
    plantilla y los cuatro andares descartados.
  - **Siguiente:** con su visto bueno, crear la skill `/zombi-nuevo` y seguir con los otros cinco (lento, rápido,
    explosivo, tentáculos y venenoso).

## Flujo de trabajo para las armas de Johnny (acordado el 12 de octubre de 2026)

Habrá más armas y cada una necesita su estado y sus animaciones. Se acordó hacerlo siempre igual, con una
**skill** (una receta guardada en el proyecto: el dueño escribe algo como `/arma-nueva bate` y se siguen los pasos)
y un par de scripts. **Sin subagentes:** lo que hace esperar es PixelLab y el visto bueno del dueño, y eso un
subagente no lo acelera.

**Orden acordado:** primero terminar la fregona entera a mano, hasta verla funcionando en el juego. Con lo que
haya funcionado, crear la skill y los scripts. La segunda arma ya va por el flujo. **Hecho: la fregona funciona,
el script de montaje es `tools/arma.py` y la skill está en `.claude/skills/arma-nueva/SKILL.md`** (es la versión
al día de los pasos de abajo: el andar va con PixMiniMax, la prueba de ataque incluye la vista de espaldas y la
estela del golpe va dentro del dibujo). El dueño dijo que no hace falta parar tras la tanda completa.

Pasos para un "Arma X" (unas 30–45 generaciones; el dueño solo tiene que mirar en los pasos 1, 2 y 6):

1. **Estado:** Johnny con el arma en guardia (`create_character_state`, unas 10). Enseñarlo y **esperar visto bueno**:
   todo lo demás sale de esas ocho posturas.
2. **Prueba de ataque de perfil** con PixMiniMax (1). Enseñarla y **esperar visto bueno**.
3. **Tanda completa, sin parar:** las otras 7 direcciones del ataque y las 8 de andar (unas 15). Revisar cada
   dirección y repetir las que desentonen.
4. **Reposo:** con el script, gratis.
5. **Montaje:** un script lo mete todo en la hoja de sprites; conectarlo al juego.
6. **Capturas y resumen** para el visto bueno final.

Lo que hay que preparar una vez, cuando la fregona esté terminada:

- **La skill**, con estos pasos y una plantilla del texto de cada animación en la que solo cambian el arma y el
  tipo de golpe (un bate barre de lado, un cuchillo pincha, una pistola dispara).
- **Scripts de montaje generales:** `tools/walk.py` y `tools/idle.py` están hechos para el Johnny sin arma; hay
  que generalizarlos para cualquier estado y añadir el del ataque.
- **Que el juego elija el sprite según el arma** que lleve Johnny. Ahora solo conoce uno (`conserje-48`).

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
- **Salas con forma libre y procedurales:** se hicieron para las salas sueltas y **se han retirado con el mapa
  nuevo** (pasillo y apartamentos, `docs/MAPA.md`). Lo de abajo se queda como historia; de aquello sigue en uso
  la cuadrícula de casillas y el camino de los zombis (`shapes.js`).
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
