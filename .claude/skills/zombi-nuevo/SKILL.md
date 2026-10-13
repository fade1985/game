---
name: zombi-nuevo
description: Crea el pixel art de un zombi (lento, rápido, explosivo, tentáculos, venenoso) y lo mete en el juego - modelo a 48 píxeles en PixelLab, piel corregida, andar, zarpazo, golpe recibido y muerte en las 8 direcciones, hoja de sprites y conexión. Usar cuando el dueño escriba /zombi-nuevo <tipo> o pida "hacer el zombi rápido", etc.
---

# Zombi nuevo

Receta para dar sprite de pixel art a un tipo de `ZOMBIE_TYPES` (`src/zombies.js`). Sale de lo que funcionó con el
zombi normal el 12–13 de octubre de 2026 (con visto bueno del dueño). El argumento es el tipo (`lento`, `rapido`,
`explosivo`, `tentaculos`, `venenoso`). Modelo de referencia: `zombi-normal-48` en `assets/pixellab.json`
(`request`, `pruebas_de_perfil`, `animaciones`: ahí están los textos completos y los ids de grupo).

Todo se explica al dueño **en español y sin tecnicismos**. Antes de cada tanda de PixelLab se le dice lo que
cuesta (un zombi completo salió por unas 43 generaciones). **Nunca se borra nada de PixelLab sin su confirmación expresa.**

## Datos fijos

- Nombres: sprite `zombi-<tipo>`, fuente `zombi-<tipo>-48` (`assets/sources/zombi-<tipo>-48/`).
- Python se llama con `py`; poner `PYTHONIOENCODING=utf-8` delante.
- El juego ya sabe usar cualquier hoja `zombi-<tipo>` con las animaciones `idle`, `walk`, `attack`, `hurt` y
  `death` (todo en `zombies.js`): **solo hay que añadir el sprite al `manifest.json`**, no programar nada.
  El zarpazo es solo dibujo (el daño sigue siendo por contacto); al morir deja un `Corpse` tendido.
- Diseño decidido por el dueño: inventado, realista, mismo estilo que Johnny, 48×48, ~46 de alto, "low top-down".
- Rasgos de cada tipo (README y `ZOMBIE_TYPES`): **lento** camisa marrón, se arrastra; **rápido** pequeño, rubio,
  chándal rojo y blanco (más bajo, ~40 px); **explosivo** grande, cartuchos rojos con mecha; **tentáculos**
  tentáculos morados en la espalda; **venenoso** verde chillón con babas. Colores base en `look`.
  Los grandes (explosivo, tentáculos) se piden más anchos pero dentro de 48×48.

## Si el dueño da un diseño

Lo que escriba después del tipo (`/zombi-nuevo lento: partido por la mitad, arrastrándose...`) **manda sobre los
rasgos por defecto**: se traduce al inglés y sustituye la parte del cuerpo y la ropa del texto del modelo. Si es
ambiguo, preguntar una vez antes de gastar generaciones. Lo que cambia con un diseño distinto del normal:

- **Cuerpo bajo o tendido (torso que se arrastra):** pedir en el modelo que ocupe la mitad inferior del lienzo
  y que la pose sea "dragging himself along the floor with his arms". `tools/piel.py` da por zapatos todo lo que
  está de la fila `SUELO` (36) hacia abajo: con un cuerpo bajo, ajustar `SUELO` o la piel de los brazos no se corrige.
- **Andar:** es un arrastrarse a brazadas, no un paso: texto propio ("pulls himself forward with his arms, one
  after the other, his lower body dragging behind"), y probar primero en `east`.
- **Muerte:** si ya va por el suelo no tiene mucho que caer; pedir que se quede quieto y se aplane (8 fotogramas
  bastan).
- **Tamaño y choque:** el dibujo es más bajo, pero el `r` del zombi en `ZOMBIE_TYPES` es lo que cuenta para
  los golpes; si el dueño quiere que sea más fácil o difícil de dar, es decisión suya, no del arte.
- Con detalles muy específicos (rastro de sangre, tripas) PixelLab los pinta a su manera: avisar de que se
  oscurece la sangre al montar y que los detalles pequeños pueden no salir a 48 píxeles.

## Pasos

El dueño solo mira en los pasos 1 y 5. En los demás se sigue sin parar.

### 1. Modelo · PARAR

1. `create_character_pro_flash` (unas 6 generaciones) con la vista de frente de Johnny
   (`rotations/south.png` de `conserje-48`, personaje `4e6c78c6-d6c6-46d3-99c1-40a2d86f0e6c`) como imagen de
   estilo, con el texto de `zombi-normal-48` → `request` cambiando el cuerpo, la ropa y los rasgos del tipo.
   `usage_description`: "Match the pixel art style... Do not copy his clothes, face or colors."
2. PixelLab saca la **piel beige** aunque se pida verde. Bajar las 8 vistas a
   `assets/sources/zombi-<tipo>-48/rotations/`, correr `py tools/piel.py zombi-<tipo>-48` (gratis; guarda las
   originales en `rotations-original/`; ajustar `VERDE`, `SAT` y `LUZ` del script si el tipo lleva otro tono de
   piel, p. ej. el venenoso verde chillón) y **importar las 8 vistas corregidas como personaje nuevo**
   (`create_character`, modo `v3`, `direction_images`; 0,25 generaciones). Ese es el personaje sobre el que se anima.
3. Hoja ampliada de las 8 vistas, **enseñarla al dueño y esperar su visto bueno.**
   Pegas típicas: la ropa cambia entre vistas, la piel sale beige o con tinte raro.

### 2. Prueba de perfil · sin parar

Probar en `east` (1 generación cada una) las cuatro animaciones con PixMiniMax (`animate_character`,
`mode: "pixminimax"`), con los textos de `zombi-normal-48` → `pruebas_de_perfil` (adaptando el gesto natural del
tipo: el explosivo se inclina sobre la mecha, el venenoso escupe, el rápido corre encorvado...):

- **Andar:** 12 fotogramas, sin fotograma final.
- **Ataque, golpe y muerte:** el dibujo quieto de `east` pegado en (24, 32) de un lienzo de 96×96 como
  `custom_start_frame_url`; en ataque y golpe también como `end_frame_url` (8 fotogramas); en la muerte 12
  fotogramas y sin final (se queda tendido).
  Para preparar los lienzos y subirlos: `get_upload_url` + `curl -sS -F "file=@..." "<url>"` y apuntar el `upload:<id>`.

Bajar con `py tools/bajar.py assets/sources/zombi-<tipo>-48/<animación> < lineas.txt` y mirar con
`py tools/hoja.py <carpeta> <salida.png> east`. Repetir lo que desentone antes de lanzar las otras 7.

### 3. Tanda completa · sin parar

Lanzar las otras 7 direcciones de cada animación (unas 28 generaciones), **8 trabajos a la vez como máximo**,
y comprobar una sola vez al rato. Cambiar solo `initial_pose`:
`south`: "facing the camera"; `north`: "seen from behind, his back to the camera"; `east`/`west`: "facing
right/left"; `south-east/west`: "in three-quarter front view, facing toward the camera and to the right/left";
`north-east/west`: "in three-quarter back view, facing away from the camera and to the right/left".

- **De espaldas** (`north`, `north-east`, `north-west`) el texto empieza con "He keeps the same three-quarter back
  view the whole time... never turns to face the camera" (o "Strict back view the whole time..."), y una
  dirección por llamada. En la muerte de espaldas el texto dice hacia dónde quedan la cabeza y los pies.
- **Andar:** el texto común (brazos estirados) hizo girarse de perfil a `south`, `south-east`, `north-east` y
  `north`: se repitieron con "Strict front view the whole time..." y brazos bajos (4 generaciones más). Para
  ahorrarlas, usar ese texto de brazos bajos de entrada en esas cuatro y el común en las otras cuatro.
- Fotogramas a `assets/sources/zombi-<tipo>-48/{walk,ataque,golpe,muerte}/<dirección>-<n>.png`.
- Revisar todas las direcciones en una hoja ampliada (pocas imágenes) y repetir las que desentonen.

### 4. Montaje y juego · sin parar

`py tools/zombi.py zombi-<tipo>-48 zombi-<tipo> --gif <carpeta temporal>` hace la hoja (casillas de 96×96) con
`still`, `idle` (a mano), `walk` (solo el tramo que cierra ciclo), `attack`, `hurt` y `death`. Oscurece la sangre
de rojo vivo (decisión del dueño: se queda, pero apagada) y quita los destellos. Opcional: `zombi.json` en la
carpeta fuente para elegir fotogramas y duraciones (`sangre`: `oscura`, `quitar`, `viva`).

Añadir `zombi-<tipo>` a `assets/sprites/manifest.json`. Probar con `http://localhost:3000/?sala=<tipo>&mudo`
(sala de exposición) y `?pruebas&mudo` (teclas 1–6). **Cerrar la pestaña al terminar.**
Si el tipo tiene ataque especial (explosión, látigo, escupitajo), comprobar que el dibujo no tapa el aviso en el suelo.

### 5. Cierre · PARAR

Una captura en el juego y un GIF de cada animación como mucho, resumen (qué se hizo, coste, pegas conocidas),
apuntar todo en `assets/pixellab.json` (clave `zombi-<tipo>-48`) y en `CLAUDE.md`, commit **solo de sus archivos**
(otras sesiones trabajan en la misma carpeta: nada de `git add -A`) y push. Esperar el visto bueno final.

## Avisos

- No renombrar ni mover con `git mv` carpetas con fotogramas recién bajados (se pierden los no commiteados).
- Si `backblaze.pixellab.ai` no responde: bajar el zip de `https://api.pixellab.ai/mcp/characters/<id>/spritesheet`.
- Decir "no blood" no evita la sangre en golpe y muerte: se oscurece al montar.
- Los fotogramas de partida subidos caducan a los 3 días y la dirección de subida a los 15 minutos.
- Ahorrar cuota: una sesión por zombi (`/clear`), Sonnet para seguir la receta, lanzar todo de golpe y mirar pocas
  imágenes. Lo descartado se apunta como descartado y se propone borrar al final.
