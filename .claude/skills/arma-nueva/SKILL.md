---
name: arma-nueva
description: Crea el pixel art de Johnny (el conserje) con un arma nueva en la mano y lo mete en el juego - estado en PixelLab, animaciones de ataque y de andar, reposo, hoja de sprites y conexión con el arma. Usar cuando el dueño escriba /arma-nueva <arma> o pida "hacer el bate", "añadir el cuchillo a Johnny", etc.
---

# Arma nueva para Johnny

Receta para que Johnny lleve en la mano un arma de `src/weapons.js` (versión pixel). Sale de lo que funcionó
con la fregona el 12 de octubre de 2026. El argumento es el id del arma (`bate`, `cuchillo`, `pistola`...).

Todo se explica al dueño **en español y sin tecnicismos**. Antes de cada tanda de PixelLab se le dice lo que
cuesta. **Nunca se borra nada de PixelLab sin su confirmación expresa.**

## Datos fijos

- Johnny sin arma en PixelLab: personaje `4e6c78c6-d6c6-46d3-99c1-40a2d86f0e6c` (48×48). Los estados salen de él.
- Nombres: sprite `conserje-48-<arma>`, estado "<Arma> en guardia", fuentes en `assets/sources/conserje-48-<arma>/`.
  (La fregona es la excepción: se llama `conserje-48-guardia`.)
- Python se llama con `py` y hay que poner `PYTHONIOENCODING=utf-8` delante para que no falle al escribir tildes.
- Coste orientativo por arma: unas 26–35 generaciones (estado 10–25, ataque 8 más repeticiones, andar 8).

## Pasos

El dueño solo mira en los pasos 1, 2 y 6. En los demás se sigue sin parar.

### 1. Estado: Johnny con el arma en guardia · PARAR

`create_character_state` sobre el Johnny sin arma, con `override_width` y `override_height` a 64,
`use_color_palette_from_reference: true` (para que no pierda colores, como le pasó a la fregona) y
`state_name` "<Arma> en guardia". El texto dice cómo la sujeta, que la postura se mantiene **en todas las
vistas (frente, lado y espalda)** y acaba con "same face, same hair and red bandana, same clothes, same body
size and proportions".

Bajar las 8 rotaciones a `assets/sources/conserje-48-<arma>/rotations/<dirección>.png`, montar una hoja ampliada,
mirarla y **enseñársela al dueño. Esperar su visto bueno:** todo lo demás sale de esas ocho posturas.
Pegas típicas que hay que contarle: el arma cambia de lado entre vistas, o la postura no es la misma de espaldas.

### 2. Prueba de ataque de perfil y de espaldas · PARAR

1. `py tools/arma.py conserje-48-<arma> --lienzos <carpeta temporal>` prepara los fotogramas de partida (el dibujo
   quieto dentro de un lienzo de 96×96, para que quepa el arco del arma).
2. `get_upload_url`, subir con `curl -sS -F "file=@partida-<dirección>.png" "<url>"` y apuntar cada `upload:<id>`.
3. `animate_character` con `mode: "pixminimax"`, `frame_count: 12`, **una dirección por llamada**, y el lienzo
   subido como `custom_start_frame_url` **y** como `end_frame_url` (así acaba donde empieza).
   Lanzar `east` y `north` (2 generaciones). Usar el mismo `animation_group_id` para las direcciones que
   compartan texto.
4. Bajar los 13 fotogramas de cada una a `assets/sources/conserje-48-<arma>/ataque/<dirección>-<n>.png`,
   montar una hoja de revisión, mirarla y **enseñársela al dueño. Esperar su visto bueno.**

El texto del ataque (ver las plantillas más abajo) va en inglés, largo y por partes.

### 3. Tanda completa · sin parar

- **Ataque:** las otras 6 direcciones (6 generaciones). Cada una con su `initial_pose`.
- **Andar:** las 8 direcciones en una sola llamada con PixMiniMax (8 generaciones), sin fotograma de partida ni de
  llegada. **Nunca con plantilla** (`walking-8-frames` y compañía): le quitan el arma y cambian el tamaño.
- Revisar **todas** las direcciones en una hoja ampliada y repetir las que desentonen (1 generación cada una).
  PixelLab admite 8 trabajos a la vez: lanzar primero el andar (8 de golpe) y el ataque según queden huecos.
  Lo que suele fallar: de espaldas Johnny se da la vuelta, el arma desaparece, o la ropa cambia.
- Los fotogramas del andar van a `assets/sources/conserje-48-<arma>/walk/<dirección>-<n>.png`.

### 4. Montaje · sin parar

`py tools/arma.py conserje-48-<arma> --gif <carpeta temporal>` hace la hoja entera en `assets/sprites/`:
quieto, reposo (calculado, gratis), andar y ataque. El script:

- elige solo el tramo del andar que hace ciclo, y avisa si alguno cierra mal (más de 150 píxeles de diferencia);
- coloca cada fotograma respecto al dibujo quieto, aunque PixelLab dé un lienzo distinto en cada dirección;
- avisa si algún fotograma se sale de la casilla de 96×96.

Lo único que hay que escribir a mano es `assets/sources/conserje-48-<arma>/arma.json` (copiar el de
`conserje-48-bate`, que es el más corto), con la parte `ataque`:

- `fotogramas`: de los 12 de cada dirección, los 8–10 que se usan. Quitar los repetidos y los flojos de la
  recogida. **El golpe tiene que caer en el mismo índice en las 8 direcciones.**
- `impacto`: ese índice. El juego hace el daño justo ahí.
- `duracion`: 0.5 como mucho, y nunca más que el hueco entre ataques (1 / `rate` del arma).

Mirar la hoja montada antes de seguir.

### 5. Juego · sin parar

- Añadir el sprite a `assets/sprites/manifest.json` y poner `sprite: 'conserje-48-<arma>'` en el arma (`weapons.js`).
- Con eso basta para las armas cuerpo a cuerpo: `Player` en `entities.js` ya elige la hoja según el arma, deja de
  dibujar el arma cartoon y la estela, y retrasa el daño hasta el fotograma del golpe.
- **Armas a distancia (pistola, escopeta):** el juego ya sabe (se programó con la pistola). Al disparar pone la
  animación `attack` sin retrasar la bala, no dibuja el arma de siempre y saca la bala de la boca del arma del
  dibujo. Para eso, en `arma.json` → `ataque`: `"boca": "fogonazo"` (el script busca sola la boca del arma en
  cada dirección), `"impacto": 0` y los fotogramas **empezando por el del fogonazo**, sin preparación. Unos 6
  fotogramas y `duracion` 0.4 como mucho (nunca más que 1 / `rate`).
  Añadir también `"efectos": true`: la hoja lleva entonces la animación `fx` (solo fogonazo, humo y casquillo,
  sin Johnny) y, si dispara andando, el juego pinta el andar entero y los efectos encima. Así no se le paran
  las piernas. **Nunca partir el cuerpo en dos mitades** (piernas de una animación y torso de otra): se probó y
  el dueño lo rechazó, la cadera se ve desacompasada. Probarlo en el juego andando y disparando a la vez.
- Probar en el navegador con `?pruebas` (tecla 1 saca un zombi) y `?armas` para coger el arma: reposo, andar en
  varias direcciones y ataque (la versión cartoon ya no existe). **Cerrar la pestaña al terminar**: si no,
  la música del juego sigue sonando.

### 6. Cierre · PARAR

Capturas, resumen (qué se ha hecho, cuánto ha costado, qué mirar al jugar), apuntarlo todo en
`assets/pixellab.json` y en `CLAUDE.md`, commit y push. **Esperar el visto bueno final.**

## Plantillas de texto

### Ataque (`action_description`)

Cinco partes, en este orden:

1. **El cuerpo:** cómo se prepara y cómo golpea ("Stepping forward with the lead foot, he...").
2. **El arma y lo que arrastra:** qué hace el arma durante el golpe.
3. **La estela, dentro del dibujo** (decidido por el dueño: nada de estelas pintadas por el juego). Tiene que ser
   creíble para el arma:
   - fregona → agua: "leaves a bright, thick crescent-shaped trail of light blue water behind it along the whole arc"
   - bate, palos → aire: "leaves a bright white crescent-shaped swoosh of air behind it along the whole arc"
   - cuchillo → una rayita corta: "a short thin white streak appears right at the tip of the blade, no longer
     than the knife itself". No escribir "slash": dibuja una media luna más alta que Johnny. Y pedir 8
     fotogramas, no 12: las armas rápidas (más de 2 golpes por segundo) solo usan unos 6 y con 12 PixelLab
     rellena el hueco con posturas inventadas. Textos enteros en `conserje-48-cuchillo` → `ataque`.
   - armas con fuego → "leaves a crescent-shaped trail of orange and yellow flames"
   - pistola, escopeta → fogonazo y humo en la boca del arma, sin estela. Pedir 8 fotogramas, no 12 (el gesto
     es corto), y "Only one shot, no second flash". El texto de la pistola está en `assets/pixellab.json`.
4. **La vuelta:** "The trail fades away quickly, he ... and settles cleanly into the starting guard stance."
5. **El cierre, siempre igual:** "Static camera, completely locked-off shot. Maintain the crisp 2D pixel art
   aesthetic, thick dark outlines, flat colors, the same character size and the strict original low top-down
   perspective throughout the entire fluid animation."

El tipo de golpe según el arma: la fregona golpea de arriba abajo; el bate barre de lado, a la altura del pecho;
el cuchillo pincha hacia delante; la pistola y la escopeta disparan con retroceso.

No pedir parpadeos. Máximo 1.000 caracteres.

### De espaldas (`north`)

El texto común no vale: Johnny se da la vuelta. Empezar con "Seen from behind the whole time: he keeps his back
to the camera and never turns around, his face is never visible", decir que el golpe va "away from the camera,
toward the top of the image" y cerrar con "the strict original low top-down back view". El texto entero de la
fregona está en `assets/pixellab.json` (`conserje-48-guardia` → `ataque` → `north`).

En los golpes de lado (bate) eso no basta, porque al barrer gira el cuerpo. Hay que ser más estricto: "Strict
back view the whole time: we only ever see the back of his head... his body never turns sideways. His feet stay
planted. Using mostly his arms and shoulders, he swings..." (entero en `conserje-48-bate` → `ataque` → `north`).
Y en las diagonales de espaldas (`north-east`, `north-west`) conviene empezar con "He keeps the same
three-quarter back view the whole time... and never turns to face the camera" y quitar lo de girar caderas.

### `subject_description` e `initial_pose`

- `subject_description`: "a young male janitor with brown hair and a red bandana, cream shirt and blue work
  overalls, holding <el arma>". De espaldas, añadir "seen from behind".
- `initial_pose`, uno por dirección, diciendo hacia dónde mira y dónde queda el arma **en la imagen**:
  - `south`: "facing the camera", `north`: "seen from behind, his back to the camera"
  - `east` / `west`: "facing right" / "facing left"
  - `south-east` / `south-west`: "in three-quarter front view, facing toward the camera and to the right / left"
  - `north-east` / `north-west`: "in three-quarter back view, facing away from the camera and to the right / left"

### Andar

"He walks forward in place at a steady pace in a smooth, seamless looping walk cycle: his legs stride
alternately... He keeps facing exactly the same direction the whole time and never turns. He keeps holding
<el arma> in the same guard grip the whole time... His arms do not swing and never let go of <el arma>." más el
cierre de siempre. El de la fregona está entero en `assets/pixellab.json` (`conserje-48-guardia` → `andar`).

**Con armas de fuego, no nombrar en el texto lo que no se quiere ver.** Decir "never fires, no muzzle flash" hizo
que PixelLab colase fogonazos al andar, y pedir "never tinted yellow" tiñó a Johnny aún más. Usar el texto del
andar de la pistola (`conserje-48-pistola` → `andar`): "quietly carries the pistol... The pistol is silent and
idle. Nothing else appears in the image". Si aun así se cuela algo, `tools/arma.py` descarta esos fotogramas al
elegir el ciclo y quita el tinte amarillo del fogonazo.

## Avisos

- **No renombrar ni mover con `git mv` una carpeta con archivos recién descargados**: se pierden los que aún no
  están en un commit. Usar `mv` normal. Si pasa, se vuelven a bajar de PixelLab (gratis).
- Para bajar fotogramas: copiar las líneas de `get_character` de esa animación y pasárselas a
  `py tools/bajar.py <carpeta>`. Para mirarlos: `py tools/hoja.py <carpeta> <salida.png> [direcciones]`.
- PixelLab admite 8 trabajos a la vez: si se lanzan más, el noveno da error y hay que esperar a que acabe uno.
- El servidor de pruebas quita el `.html` de las direcciones (`/assets/pruebas/ataque-fregona`, sin `.html`).
- Los fotogramas de partida subidos caducan a los 3 días y la dirección de subida a los 15 minutos.
- Lo descartado se apunta en `assets/pixellab.json` como descartado y se le propone al dueño borrarlo al final.
- **Si `backblaze.pixellab.ai` no responde** y `tools/bajar.py` no baja nada: bajar el zip de
  `https://api.pixellab.ai/mcp/characters/<id>/spritesheet` (hoja con todas las rotaciones y animaciones más un
  JSON que dice qué hay en cada fila) y recortar las casillas.
- **Armas largas de fuego (escopeta, MP5...): mirar `south` y `north` del estado antes de seguir.** PixelLab
  dibuja el arma cruzada de frente y asomando de lado de espaldas, casi como las diagonales, y al disparar el
  fogonazo sale de lado mientras las balas van rectas. El dueño lo rechazó. Se arregla rehaciendo solo esas dos
  posturas con una animación de 1 generación cada una (no con `edit_image`, que cuesta 10–25): receta y textos
  en `docs/HISTORIA.md` ("Apuntar abajo y arriba") y en `conserje-48-mp5` → `posturas` de `assets/pixellab.json`.
  Hacerlo **antes** de animar, y contárselo al dueño en el paso 1 como una pega seria, no menor.
- **Armas con retroceso fuerte (escopeta):** en `arma.json` poner `"margen_efectos": 10` (que no se cuelen las
  manos en `fx`) y `"sin_tinte": {}` (si la detección del tinte amarillo borra el humo).

## Ahorrar cuota

- Una sesión nueva por arma (`/clear`). Modelo Sonnet para seguir esta receta; Opus solo si hay que tocar scripts.
- Lanzar todas las animaciones de golpe y comprobar una sola vez (cada trabajo tarda 1–3 minutos).
- No sacar capturas de las 8 direcciones dentro del juego: montar y avisar; capturas solo para el visto bueno final.
- Las hojas de revisión (imágenes) cuestan mucho: mirar solo las necesarias.
