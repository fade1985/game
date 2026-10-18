# Zombie Escape · receta y detalles de PixelLab

Sacado de CLAUDE.md el 13 de octubre de 2026 para que ese archivo pese menos. Se lee solo al generar arte con PixelLab.


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
  (10–25). Los 20 muebles y los 7 suelos tienen sprite.
- **El escenario se ve "en tres cuartos"** (decidido por el dueño el 12 de octubre de 2026, al notar que los
  personajes se veían de lado y el escenario desde arriba): el suelo desde arriba, pero las paredes enseñan su
  cara y los muebles su frente, con altura. Los muebles en planta que se hicieron antes se retiraron.
  - Cada mueble va apoyado en su pared: de frente en la de arriba; en las laterales solo los que tienen
    dibujo de lado (`mueble-<tipo>-lado`: sofá, sillón, bañera, váter) o se ven igual desde cualquier sitio
    (lámpara, planta, perchero, mesilla); en la de abajo solo estos últimos (`goesOn` en `furniture.js`).
  - Receta: sin guía y sin fondo, con un lienzo de largo × (fondo + alto) y el texto "..., front view facing
    the viewer, 3/4 top-down RPG perspective, game furniture sprite". Si sale girado en diagonal, con la guía
    de `py tools/muebles3c.py guias` (un bloque del tamaño del mueble) y con fondo. Montaje:
    `py tools/muebles3c.py monta`. El largo de cada mueble en `MUEBLES` (`src/catalogo.js`) es el ancho de su dibujo × 2.
  - Pendiente: dibujos de lado de cama, estantería, armario, encimera, nevera y demás (los tres primeros se
    pidieron y salieron mal), para que las paredes laterales no se queden tan vacías.
  - PixelLab solo deja 8 generaciones a la vez. **La clave `PIXELLAB_API_KEY` de este ordenador es de otra
    cuenta, sin saldo**: todo se pide por MCP.
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

