# Fondos de las estancias con ChatGPT (piloto: el baño)

Decidido por el dueño el 13 de octubre de 2026: el juego va a un tono **oscuro, sucio y con sangre**, y las
estancias dejan de montarse con muebles sueltos (parecía un collage). Cada estancia será una **imagen entera**
elegida de un fondo común de salas ("pool"), dibujada con ChatGPT a partir de la imagen de referencia del baño.
PixelLab se queda para personajes y armas. **Aún no hay nada en el juego:** esto es el piloto.

## Medidas

- Escala **realista**: el váter le llega a Johnny a la cintura y la bañera mide lo que él de largo.
- Una casilla = 16 píxeles de arte = 32 unidades del juego (unos 60 cm). Johnny mide 46 píxeles de alto.
- La imagen es **la pared del fondo (3 casillas de alto) y el suelo**, de borde a borde. Los muros de los lados
  y de abajo, las puertas, los personajes y la luz los pone el juego.

| Tamaño | Casillas (ancho × alto, con la pared) | Arte | Imagen de ChatGPT |
|---|---|---|---|
| Pequeño | 9 × 9 | 144 × 144 | 1024 × 1024 (cuadrada) |
| Mediano | 12 × 12 | 192 × 192 | 1024 × 1024 (cuadrada) |
| Grande o doble | 18 × 12 | 288 × 192 | 1536 × 1024 (apaisada) |

## Cómo pedir cada fondo

1. Abrir un chat nuevo de ChatGPT (el mismo chat para todos los fondos de un tipo de estancia: mantiene el estilo).
2. Adjuntar **dos imágenes**: la de referencia de estilo (el baño original) y la plantilla del tamaño y la
   puerta que toque, de `assets/plantillas/` (`<tamaño>-puerta-<abajo|izquierda|derecha|arriba>.png`; se rehacen con
   `py tools/plantilla_fondo.py`). El juego puede además usar cada fondo en espejo (izquierda ↔ derecha).
   Con la puerta **arriba**, el verde sube por la pared del fondo: ese tramo de pared tiene que quedar liso,
   sin muebles ni adornos, porque ahí pondrá el juego la puerta.
3. Pegar el texto de abajo, cambiando solo las cuatro líneas del final.
4. Guardar el resultado tal cual, sin recortar, en `assets/sources/fondos/` como `bano-<tamaño>-<puerta>-<n>.png`.

```text
Create a pixel art background for a top-down zombie game, using the two attached images.

IMAGE 1 is the STYLE reference: copy its pixel art style, palette, level of detail, grime, blood and decay.
IMAGE 2 is the LAYOUT template. Follow it exactly:
- Same image size and same framing. The light band at the top is the back wall, seen from the front. The grey
  grid below is the floor, seen from above. Keep the wall/floor line exactly where it is.
- The character is ONLY a scale reference: every object must be realistically sized next to him (a toilet
  reaches his waist, a bathtub is as long as he is tall, a door is slightly taller than him).
  Do NOT draw the character in the result.
- The green area must stay as empty floor (it is the walking path to the door). Dirt and stains are fine there.
  If the green area also covers part of the back wall, keep that part of the wall plain (tiles only): no
  furniture, mirrors or decorations there.
- Do NOT draw the grid, the green colour, any door, any side walls or any bottom wall: the wall fills the full
  width at the top and the floor reaches the left, right and bottom edges of the image.

View: classic 3/4 top-down RPG interior (like a JRPG tileset), perfectly straight, no perspective distortion,
no diagonal walls. Furniture stands against the back wall facing the viewer, or along the left and right
edges drawn from the same viewpoint. Leave plenty of free floor.
Lighting: dim, even ambient light, no vignette, no dark corners, no light beams (the game adds lighting).
Crisp pixel art with visible square pixels, no anti-aliasing, no text, no UI, no people, no border.

ROOM: abandoned apartment bathroom, small.
DOOR SIDE: bottom (the green path in the template shows it; keep that side free of furniture).
MUST CONTAIN: bathtub with torn shower curtain, toilet, sink with a broken mirror above it.
EXTRA DETAILS: towel rail, bin, bath mat, blood handprints, cracked tiles, rubble in one corner.
```

## Las cuatro líneas que cambian

- `ROOM`: tipo y tamaño (`small` / `medium` / `large` / `large double bathroom`).
- `DOOR SIDE`: el lado de la plantilla que se adjunta: `bottom`, `left`, `right` o `top (in the back wall)`.
  Tiene que coincidir con la plantilla. En ese lado no se piden muebles: si la idea de la tabla pone la bañera
  a la izquierda y la puerta va a la izquierda, mover la bañera a otro lado.
- `MUST CONTAIN`: los muebles grandes. Variar su sitio de un fondo a otro ("bathtub along the left edge",
  "shower cabin in the right corner"...) para que no se parezcan.
- `EXTRA DETAILS`: lo pequeño y el desastre. Aquí es donde cada sala cuenta su historia.

Ideas para el fondo de baños:

| Fondo | ROOM | MUST CONTAIN | EXTRA DETAILS |
|---|---|---|---|
| Pequeño 1 | small | bañera a la izquierda, lavabo con espejo roto, váter | toallero, papelera, alfombrilla, huellas de sangre |
| Pequeño 2 | small | plato de ducha con mampara rota en la esquina derecha, váter, lavabo | botiquín abierto, pastillas por el suelo, charco de agua sucia |
| Mediano 1 | medium | bañera contra la pared del fondo, lavabo, váter, lavadora | cesto de ropa volcado, tendedero, moho |
| Mediano 2 | medium | bañera llena de agua turbia, lavabo doble, váter, bidé | cortina arrancada, espejo entero con algo escrito con sangre |
| Grande | large | bañera, ducha aparte, lavabo doble, váter, armario de toallas | banco, planta muerta, azulejos caídos, rastro de sangre hacia la puerta |
| Doble | large double bathroom | dos lavabos, dos cabinas de váter con puerta, ducha | taquilla, cubo y fregona, cristales rotos |

## Qué revisar antes de dar una imagen por buena

- Que no haya paredes laterales ni en diagonal, ni puerta dibujada, ni el personaje.
- Que el suelo llegue a los tres bordes y la zona verde haya quedado libre.
- Que los muebles sean del tamaño de Johnny (si salen grandes, repetir diciendo "objects are too big, make
  them smaller relative to the character in the template").

## Lo que viene después (lo hace Claude)

Reducir cada imagen a su tamaño de arte, limpiar la paleta, hacer la ficha de cada sala (dónde se choca, lados
con puerta, luces) y una maqueta de apartamento para el visto bueno. Meterlo en el juego toca el generador de
apartamentos (`apartment.js`), que lleva la sesión del mapa: hay que coordinarlo con ella.
