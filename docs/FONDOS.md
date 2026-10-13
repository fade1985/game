# Fondos de las estancias con ChatGPT (piloto: el baño)

Decidido por el dueño el 13 de octubre de 2026: el juego va a un tono **oscuro, sucio y con sangre**, y las
estancias dejan de montarse con muebles sueltos (parecía un collage). Cada estancia será una **imagen entera**
elegida de un fondo común de salas ("pool"), dibujada con ChatGPT a partir de la imagen de referencia del baño
(`assets/sources/fondos/referencia-estilo.jpg`). PixelLab se queda para personajes y armas.
**Aún no hay nada en el juego:** esto es el piloto.

## Medidas

- Escala **realista** (elegida por el dueño): el váter le llega a Johnny a la cintura y la bañera mide lo que
  él de largo. Una casilla = 16 píxeles de arte = 32 unidades del juego (unos 60 cm). Johnny mide 46 de alto.
- La imagen es **la pared del fondo (3 casillas de alto) y el suelo**, de borde a borde. Los muros de los lados
  y de abajo, las puertas, los personajes y la luz los pone el juego.
- **Los baños no tienen puerta en la pared del fondo**: siempre abajo o en un lateral. Así toda esa pared
  queda para muebles y no hay que pedirle a ChatGPT que deje un hueco.

| Tamaño | Casillas (ancho × alto, con la pared) | Arte | Imagen de ChatGPT |
|---|---|---|---|
| Pequeño | 9 × 9 | 144 × 144 | 1024 × 1024 (cuadrada) |
| Mediano | 12 × 12 | 192 × 192 | 1024 × 1024 (cuadrada) |
| Grande | 18 × 12 | 288 × 192 | 1536 × 1024 (apaisada) |

## Los bocetos

`py tools/plantilla_fondo.py` pinta en `assets/plantillas/` un boceto por distribución: la pared, el suelo y
**un bloque de color con su nombre por cada mueble**, colocado y a su tamaño. ChatGPT pinta cada mueble dentro
de su bloque. Al lado deja un `.json` con dónde está cada mueble (de ahí saldrán los choques, sin marcarlos a
mano) y por qué lados puede tener puerta esa distribución. Para añadir distribuciones: `BOCETOS` en el script.

| Boceto | Qué lleva | Puertas |
|---|---|---|
| `bano-pequeno-1` | bañera, lavabo con espejo, toallero, papelera, váter | abajo, izquierda, derecha |
| `bano-pequeno-2` | ducha, lavabo con espejo, váter, lavadora | abajo, izquierda, derecha |
| `bano-pequeno-3` | bañera a lo largo del muro izquierdo, lavabo, váter, armario | abajo, derecha |
| `bano-mediano-1` | bañera, lavabo doble, váter, papelera, lavadora | abajo, izquierda, derecha |
| `bano-mediano-2` | bañera en el muro izquierdo, ducha, lavabo, váter, armario | abajo, derecha |
| `bano-grande-1` | bañera, ducha, lavabo doble, váter, armario, lavadora | abajo, izquierda, derecha |

El juego podrá usar cada fondo también en espejo, así que cada uno vale por dos.

## Cómo pedir cada fondo

1. En ChatGPT, el mismo chat para todos los baños (mantiene mejor el estilo).
2. Adjuntar **dos imágenes**: la referencia de estilo y el boceto.
3. Pegar el texto de abajo. Solo cambia la última línea (`DETAILS`), para que cada sala cuente algo distinto.
4. Guardar el resultado tal cual, sin recortar, en `assets/sources/fondos/` con el nombre del boceto
   (`bano-pequeno-1.png`; si se hacen varias versiones del mismo boceto, `bano-pequeno-1b.png`...).

```text
Paint a finished pixel art game background from the two attached images.

IMAGE 1 is the STYLE reference: copy its pixel art style, palette, level of detail, grime, blood and decay.
IMAGE 2 is a LAYOUT SKETCH of an abandoned apartment bathroom. Follow it exactly:
- Same image size and framing. The light band at the top is the back wall, seen from the front. The grey area
  below is the floor, seen from above. Keep the wall/floor line exactly where it is.
- Each coloured block is one object, named by its label. Paint that object so it fills its block exactly:
  same position, same width, same height. Do not make any object bigger than its block, do not move it, and
  do not add any other furniture. Objects are small compared to the room: that is intended.
- Blocks that start on the wall and go down onto the floor are furniture standing against the back wall,
  facing the viewer. A block along the left edge is furniture standing along the left side.
  MIRROR and TOWEL hang on the wall. MAT lies flat on the floor.
- Everything outside the blocks stays empty: bare tiled wall and bare tiled floor, with only flat details
  (stains, cracks, blood, small debris, missing tiles).
- Do NOT draw the labels, the block colours, the grid, any door, any side walls or any bottom wall. The wall
  fills the full width at the top and the floor reaches the left, right and bottom edges of the image.

View: classic 3/4 top-down RPG interior (like a JRPG tileset), perfectly straight, no perspective distortion,
no diagonal walls.
Lighting: dim, even ambient light, no vignette, no dark corners, no light beams (the game adds lighting).
Crisp pixel art with visible square pixels, no anti-aliasing, no text, no UI, no people, no border.

DETAILS: torn shower curtain, broken mirror, blood handprints on the wall, cracked floor tiles, rubble in one corner.
```

Ideas para `DETAILS`: botiquín abierto y pastillas por el suelo · agua turbia en la bañera y moho · algo
escrito con sangre en el espejo · rastro de sangre que cruza el suelo · cesto de ropa volcado y ropa sucia ·
azulejos caídos y tubería rota goteando · cristales rotos y una ventana tapiada.

## Qué revisar antes de dar una imagen por buena

- Que cada mueble esté donde su bloque y no sea más grande que él (si salen grandes: "objects are bigger than
  their blocks, repaint them at exactly the block size").
- Que no haya paredes laterales ni en diagonal, ni puerta, ni personas, ni letras.
- Que el suelo llegue a los tres bordes.

## Lo aprendido

- **Primera prueba (13 de octubre de 2026), fallida:** plantilla con Johnny como referencia de tamaño y una zona
  verde "dejar libre" para la puerta de arriba. ChatGPT puso el lavabo y el espejo en la zona verde y dibujó
  el váter más alto que Johnny. El estilo y la coherencia, en cambio, perfectos
  (`assets/sources/fondos/bano-grande-arriba-1.png`, vista en `assets/pruebas/bano-chatgpt-prueba1.png`).
  Conclusión: no pedir huecos ni tamaños de palabra, darlos dibujados.
- PixelLab no vale para esto: su tope es 400×400 y las piezas sueltas se ven como un collage
  (`assets/pruebas/bano-maqueta.png`).

## Lo que viene después (lo hace Claude)

Reducir cada imagen a su tamaño de arte, limpiar la paleta, comprobar que los muebles caen en sus bloques y
una maqueta de apartamento para el visto bueno. Meterlo en el juego toca el generador de apartamentos
(`apartment.js`: tamaños fijos de baño y puerta nunca arriba), que lleva la sesión del mapa: coordinarlo con ella.

## Pendiente de decidir: lootear y destruir (hablado el 13 de octubre de 2026)

El dueño quiere escenarios con cosas que se puedan registrar y romper. Como cada mueble está en un bloque
conocido del boceto (`assets/plantillas/<nombre>.json`), se puede hacer aunque el fondo sea una sola imagen.
Nada de esto está probado ni decidido.

- **Lootear (no necesita arte):** cada bloque es una zona de "Registrar"; el juego pinta un brillo encima de lo
  registrable y oscurece o marca el rectángulo cuando ya está vacío.
- **Destruir (hace falta el dibujo roto).** Tres vías, de más vistosa a más barata:
  1. Una segunda versión de la sala, destrozada, pedida a ChatGPT en el mismo chat; al romperse un mueble se
     cambia solo su rectángulo. Depende de que las dos versiones coincidan al píxel: **probarlo con el primer
     baño que salga bien** (superponer y medir). Dobla el número de imágenes (unas 70 en vez de 36).
  2. Una versión vacía de la sala (solo pared y suelo), para que el mueble desaparezca. Mismo riesgo.
  3. Un dibujo suelto de cada mueble roto, por tipo: como los bloques tienen medidas fijas, vale para todas
     las salas (unas 10 imágenes en total). Es el plan B.
  Al romperse: se quita el choque, humo y cascotes, y puede soltar botín.
- **Preguntas sin contestar:** qué se rompe (todo o solo algunos muebles marcados) y quién lo rompe (Johnny,
  los zombis, las explosiones).
