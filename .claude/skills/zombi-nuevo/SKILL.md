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
cuesta (el zombi normal salió por unas 43 generaciones y el lento por unas 52: ver «Costes» más abajo). **Nunca se borra nada de PixelLab sin su confirmación expresa.**

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
- **Si al cuerpo le falta algo (sin piernas, sin un brazo):** PixelLab parte de un maniquí entero y de espaldas se
  lo vuelve a inventar. Con el lento, el primer modelo salió con piernas y botas en las vistas de espaldas. Lo que
  funcionó a la segunda (texto completo en `zombi-lento-48` → `request`): negarlo todo con mayúsculas y "from any
  angle" ("He has NO legs, NO hips, NO knees, NO feet, NO boots and NO trousers from any angle"), decir cómo NO
  está ("not kneeling and not on all fours"), y **describir lo que se ve de espaldas** ("Seen from behind you see
  the back of the head, the shoulders... and then the stump, nothing else"). En las animaciones, repetir "He has
  no legs and never grows any".
- **Montaje de un cuerpo bajo:** en `zombi.json`, `"pies"` (el lento usa 72; sin eso el cuerpo flota sobre su
  sombra) y `"cintura"` (40: la fila por la que se parte el dibujo en el reposo).
- **Andar:** es un arrastrarse a brazadas, no un paso: texto propio ("pulls himself forward with his arms, one
  after the other, his lower body dragging behind"), y probar primero en `east`.
- **Muerte:** si ya va por el suelo no tiene mucho que caer; pedir que se quede quieto y se aplane (8 fotogramas
  bastan).
- **Zombi más grande que Johnny (el venenoso):** no estirarlo en el juego (se le ven los píxeles gordos): pedir
  el modelo en un lienzo mayor (72×72 para unos 67 de alto). Los lienzos de partida son entonces de 128×128 con
  el dibujo en (28, 44), y en `zombi.json` van `casilla` [144, 144], `origen` [36, 48] y `pies`. En
  `ZOMBIE_TYPES` necesita `shadow` y `top` (sombra y barra de vida a su medida). A 72 cada animación costó 1.
- **Si un trabajo falla a los pocos segundos** (pasó con un golpe del venenoso), repetirlo con un texto más neutro:
  "a very large heavy bald man" en vez de "zombie... rotting skin", "flinches" en vez de "hard shove".
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
   **Pedir la ropa de un color bien distinto de la piel** (azul, rojo, gris oscuro, marrón muy oscuro: nunca
   beige, tostado ni marrón claro). Como la piel sale beige, una camisa "brown" salió del mismo tono y
   `tools/piel.py` teñía las dos de verde: hubo que hacer un script aparte con retoques a mano
   (`assets/sources/zombi-lento-48/piel.py`, sirve de ejemplo si vuelve a pasar).
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

Subir de una vez los lienzos de partida de las 8 direcciones (se usan en el paso 3) y apuntar los `upload:<id>`.

Bajar con `py tools/bajar.py assets/sources/zombi-<tipo>-48/<animación> < lineas.txt` y mirar con
`py tools/hoja.py <carpeta> <salida.png> east`. Repetir lo que desentone antes de lanzar las otras 7.

### 3. Tanda completa · sin parar

Lanzar las otras 7 direcciones de cada animación (28 trabajos; unas 35 generaciones con el andar de 12
fotogramas). **PixelLab solo admite 8 trabajos a la vez** (comprobado con el venenoso: «need 1 job slots but only
0 available (8/8 used)»), y el límite se comparte con las otras sesiones que estén generando. Así que se va en
tandas: lanzar hasta llenar, `wait_for_jobs`, y rellenar los huecos que queden libres sin esperar a que acabe la
tanda entera. Para gastar menos llamadas, el andar (que no lleva fotograma de partida) se puede lanzar en una sola
llamada con las 7 direcciones y sin `initial_pose` ("He keeps exactly the same view and facing as the first
frame the whole time: he never turns...").
Añadir cada dirección al grupo de su animación (`animation_group_id` + el mismo `animation_name`): así luego
se baja todo junto. Cambiar solo `initial_pose`:
`south`: "facing the camera"; `north`: "seen from behind, his back to the camera"; `east`/`west`: "facing
right/left"; `south-east/west`: "in three-quarter front view, facing toward the camera and to the right/left";
`north-east/west`: "in three-quarter back view, facing away from the camera and to the right/left".

- **De espaldas** (`north`, `north-east`, `north-west`) el texto empieza con "He keeps the same three-quarter back
  view the whole time... never turns to face the camera" (o "Strict back view the whole time..."), y una
  dirección por llamada. En la muerte de espaldas el texto dice hacia dónde quedan la cabeza y los pies.
- **Andar:** el texto común (brazos estirados) hizo girarse de perfil a `south`, `south-east`, `north-east` y
  `north`: se repitieron con "Strict front view the whole time..." y brazos bajos (4 generaciones más). Para
  ahorrarlas, usar ese texto de brazos bajos de entrada en esas cuatro y el común en las otras cuatro.
- **Bajar todo de una vez:** `py tools/bajar_zip.py <id del personaje> zombi-<tipo>-48` baja el zip del personaje
  y deja cada animación en `assets/sources/zombi-<tipo>-48/{walk,ataque,golpe,muerte}/<dirección>-<n>.png`
  (la carpeta se llama como el `animation_name`; "andar" va a `walk/`).
- Revisar todas las direcciones en una hoja ampliada (pocas imágenes) y repetir las que desentonen.

### 4. Montaje y juego · sin parar

`py tools/zombi.py zombi-<tipo>-48 zombi-<tipo> --gif <carpeta temporal>` hace la hoja (casillas de 96×96) con
`still`, `idle` (a mano), `walk` (solo el tramo que cierra ciclo), `attack`, `hurt` y `death`. Oscurece la sangre
de rojo vivo (decisión del dueño: se queda, pero apagada) y quita los destellos. Opcional: `zombi.json` en la
carpeta fuente para elegir fotogramas y duraciones (`sangre`: `oscura`, `quitar`, `viva`; `cintura` y `pies`
para cuerpos bajos; `"ataque": {"sangre": true}` si PixelLab mete sangre también en el ataque).
Si el script avisa de que el ciclo de andar cierra mal en todas las direcciones ("← OJO, es mucho"), comparar
el último fotograma con el 0: en el lento el 12 volvía a la postura del 0 y el ciclo bueno eran los 12
fotogramas enteros (`"andar": {"<dirección>": [0, 12], ...}`).

Añadir `zombi-<tipo>` a `assets/sprites/manifest.json`. Probar con `http://localhost:3000/?sala=<tipo>&mudo`
(sala de exposición) y `?pruebas&mudo` (teclas 1–6). **Cerrar la pestaña al terminar.**
Si el tipo tiene ataque especial (explosión, látigo, escupitajo), comprobar que el dibujo no tapa el aviso en el suelo.

### 5. Cierre · PARAR

Una captura en el juego y un GIF de cada animación como mucho, resumen (qué se hizo, coste, pegas conocidas),
apuntar todo en `assets/pixellab.json` (clave `zombi-<tipo>-48`) y en `CLAUDE.md`, commit **solo de sus archivos**
(otras sesiones trabajan en la misma carpeta: nada de `git add -A`) y push. Esperar el visto bueno final.

## Costes

- Modelo: 6 generaciones (y otras 6 cada vez que se repite). Importar las vistas corregidas: 0,25.
- Animaciones con PixMiniMax a 48 píxeles: **8 fotogramas = 1 generación por dirección; 12 fotogramas = 2.**
  El andar de 12 fotogramas son 16 generaciones entre las 8 direcciones, no 8.
- Para quitar un charco o una mancha de una muerte funcionó "He dies quietly... The floor around him stays
  completely clean and empty: nothing spills, nothing spreads, no puddle, no liquid" (decir "killed" o "blow" la trae).
- Zombi completo sin repetir nada: 6 + 0,25 + 5 de pruebas de perfil + 35 de la tanda = unas 46.
  Decirle al dueño la cifra de la respuesta de PixelLab (línea `cost:`), no la estimada.

## Avisos

- No renombrar ni mover con `git mv` carpetas con fotogramas recién bajados (se pierden los no commiteados).
- Si `backblaze.pixellab.ai` no responde: bajar el zip de `https://api.pixellab.ai/mcp/characters/<id>/spritesheet`.
- Decir "no blood" no evita la sangre en golpe y muerte: se oscurece al montar.
- Los fotogramas de partida subidos caducan a los 3 días y la dirección de subida a los 15 minutos.
- Ahorrar cuota: una sesión por zombi (`/clear`), Sonnet para seguir la receta, lanzar todo de golpe y mirar pocas
  imágenes. Lo descartado se apunta como descartado y se propone borrar al final.
