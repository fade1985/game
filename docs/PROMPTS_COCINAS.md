# Textos para pedir cocinas, por tamaño y entrada

Cada texto está completo: se copia y se pega tal cual. Método y motivos en [`FONDOS.md`](FONDOS.md).
Probado el 14 de octubre de 2026: **ChatGPT es el que mejor sale** (nítido y con contraste al reducirlo).
Grok vale de reserva; Gemini dibuja paredes en los lados. **No mezclar** imágenes de dos IA en el mismo
apartamento: cada una dibuja las baldosas de un tamaño y con otra paleta.

1. **Chat nuevo** para cada cocina (en el mismo chat arrastra los errores de la anterior).
2. Adjuntar **`assets/sources/fondos/referencia-encuadre.png`**, siempre la misma.
3. Pedir la imagen con la forma que dice cada apartado: **cuadrada (1:1)** la pequeña y la mediana,
   **apaisada (3:2)** la grande.
4. Pegar el texto. Para sacar otra cocina del mismo tamaño y entrada, cambiar solo `ROOM` y `DETAILS`,
   respetando el lado que tiene que quedar libre.
5. Si sale mal, **repetir el mismo texto en un chat nuevo** antes de cambiar nada.
6. Guardar sin recortar ni retocar en `assets/sources/fondos/` con el nombre que dice cada apartado
   (si se repite, `-2`, `-3`...).

La puerta **no la dibuja la IA**: el hueco se deja vacío y el juego pone encima su dibujo de puerta (abierta,
cerrada o con candado). La entrada de la derecha es la de la izquierda en espejo; si hay poca cuota, basta con
abajo, arriba e izquierda.

| | Abajo | Arriba | Izquierda | Derecha |
|---|---|---|---|---|
| **Pequeña** (9×9 casillas) | [`cocina-pequena-abajo`](#cocina-pequena-abajo) | [`cocina-pequena-arriba`](#cocina-pequena-arriba) | [`cocina-pequena-izquierda`](#cocina-pequena-izquierda) | [`cocina-pequena-derecha`](#cocina-pequena-derecha) |
| **Mediana** (12×12) | [`cocina-mediana-abajo`](#cocina-mediana-abajo) | [`cocina-mediana-arriba`](#cocina-mediana-arriba) | [`cocina-mediana-izquierda`](#cocina-mediana-izquierda) | [`cocina-mediana-derecha`](#cocina-mediana-derecha) |
| **Grande** (18×12) | [`cocina-grande-abajo`](#cocina-grande-abajo) | [`cocina-grande-arriba`](#cocina-grande-arriba) | [`cocina-grande-izquierda`](#cocina-grande-izquierda) | [`cocina-grande-derecha`](#cocina-grande-derecha) |

---

## Cocina pequeña

### cocina-pequena-abajo

Imagen **cuadrada (1:1)**. Guardar como `cocina-pequena-abajo.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: small kitchen, about 4 metres wide. Square image. Only three pieces of furniture, small compared to the room.
ENTRANCE: the room is entered from the BOTTOM edge of the image. All furniture stands against the back wall, facing the viewer. The lower two thirds of the floor are completely empty (only stains, cracks, blood and small debris).
ROOM: kitchen. From left to right against the back wall: old fridge, counter with a sink and wall cupboards above it, gas stove with an oven.
DETAILS: fridge door hanging open, broken plates on the floor, blood handprints on the tiles.
```

### cocina-pequena-arriba

Imagen **cuadrada (1:1)**. Guardar como `cocina-pequena-arriba.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: small kitchen, about 4 metres wide. Square image. Only three pieces of furniture, small compared to the room.
ENTRANCE: the room is entered through the BACK WALL, in its centre. Leave the middle third of the back wall completely bare: no furniture, no cupboard, no shelf, nothing hanging, just plain wall. Keep a clear strip of empty floor from that bare stretch straight down to the bottom edge. Furniture is split into two groups, one in the left corner of the back wall and one in the right corner.
ROOM: kitchen. On the left: old fridge. On the right: gas stove with an oven next to a short counter with a sink.
DETAILS: a dirty pan on the stove, rubbish bag torn open on the floor, blood smears on the wall.
```

### cocina-pequena-izquierda

Imagen **cuadrada (1:1)**. Guardar como `cocina-pequena-izquierda.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: small kitchen, about 4 metres wide. Square image. Only three pieces of furniture, small compared to the room.
ENTRANCE: the room is entered from the LEFT edge of the image. Keep the left third of the room empty: no furniture there, bare wall and bare floor only. All furniture is grouped on the centre and right of the back wall, and nothing stands along the left edge. The lower half of the floor is empty.
ROOM: kitchen. From the centre to the right against the back wall: counter with a sink and wall cupboards above it, gas stove with an oven, old fridge in the right corner.
DETAILS: cupboard doors open, broken glass and plates on the floor, a knocked-over wooden chair.
```

### cocina-pequena-derecha

Imagen **cuadrada (1:1)**. Guardar como `cocina-pequena-derecha.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: small kitchen, about 4 metres wide. Square image. Only three pieces of furniture, small compared to the room.
ENTRANCE: the room is entered from the RIGHT edge of the image. Keep the right third of the room empty: no furniture there, bare wall and bare floor only. All furniture is grouped on the left and centre of the back wall, and nothing stands along the right edge. The lower half of the floor is empty.
ROOM: kitchen. From the left to the centre against the back wall: old fridge in the left corner, gas stove with an oven, counter with a sink.
DETAILS: rotten food spilled from the fridge, a dirty kettle, blood dripping down the cupboard doors.
```

---

## Cocina mediana

### cocina-mediana-abajo

Imagen **cuadrada (1:1)**. Guardar como `cocina-mediana-abajo.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: medium kitchen, about 6 metres wide. Square image. Four or five pieces of furniture, small compared to the room, with a lot of empty floor.
ENTRANCE: the room is entered from the BOTTOM edge of the image. All furniture stands against the back wall, facing the viewer. The lower two thirds of the floor are completely empty (only stains, cracks, blood and small debris).
ROOM: kitchen. From left to right against the back wall: tall pantry cupboard, old fridge, counter with a sink, gas stove with an extractor hood, short counter with a microwave. Wall cupboards above the counters.
DETAILS: pantry door open with cans spilled on the floor, a dragged blood trail, a broken window blind.
```

### cocina-mediana-arriba

Imagen **cuadrada (1:1)**. Guardar como `cocina-mediana-arriba.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: medium kitchen, about 6 metres wide. Square image. Four or five pieces of furniture, small compared to the room, with a lot of empty floor.
ENTRANCE: the room is entered through the BACK WALL, in its centre. Leave the middle quarter of the back wall completely bare: no furniture, no cupboard, no shelf, nothing hanging, just plain wall. Keep a clear strip of empty floor from that bare stretch straight down to the bottom edge. Furniture is split into two groups, one on the left part of the back wall and one on the right part.
ROOM: kitchen. On the left: old fridge, counter with a sink and a wall cupboard above. On the right: gas stove with an oven, counter with wall cupboards above.
DETAILS: fridge door open, broken plates and a knocked-over chair on the floor, blood handprints on the wall tiles.
```

### cocina-mediana-izquierda

Imagen **cuadrada (1:1)**. Guardar como `cocina-mediana-izquierda.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: medium kitchen, about 6 metres wide. Square image. Four or five pieces of furniture, small compared to the room, with a lot of empty floor.
ENTRANCE: the room is entered from the LEFT edge of the image. Keep the left third of the room empty: no furniture there, bare wall and bare floor only. All furniture is grouped on the centre and right of the back wall, and nothing stands along the left edge. The lower half of the floor is empty.
ROOM: kitchen. From the centre to the right against the back wall: counter with a sink, dishwasher with its door open, gas stove with an extractor hood, old fridge, tall pantry cupboard in the right corner.
DETAILS: dirty dishes piled in the sink, a puddle of dark water from the dishwasher, scratches on the fridge.
```

### cocina-mediana-derecha

Imagen **cuadrada (1:1)**. Guardar como `cocina-mediana-derecha.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: medium kitchen, about 6 metres wide. Square image. Four or five pieces of furniture, small compared to the room, with a lot of empty floor.
ENTRANCE: the room is entered from the RIGHT edge of the image. Keep the right third of the room empty: no furniture there, bare wall and bare floor only. All furniture is grouped on the left and centre of the back wall, and nothing stands along the right edge. The lower half of the floor is empty.
ROOM: kitchen. From the left to the centre against the back wall: tall pantry cupboard in the left corner, old fridge, gas stove with an oven, counter with a sink and wall cupboards above.
DETAILS: a burnt pot on the stove, soot on the wall, smashed jars on the floor.
```

---

## Cocina grande

### cocina-grande-abajo

Imagen **apaisada (3:2)**. Guardar como `cocina-grande-abajo.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: large kitchen, about 9 metres wide and 6 deep. Wide landscape image. Six pieces of furniture, small compared to the room, spread along the back wall, with a lot of empty floor.
ENTRANCE: the room is entered from the BOTTOM edge of the image. All furniture stands against the back wall, facing the viewer. The lower two thirds of the floor are completely empty (only stains, cracks, blood and small debris).
ROOM: kitchen. From left to right against the back wall: old fridge, tall pantry cupboard, counter with a sink, dishwasher, gas stove with an extractor hood, long counter with a microwave. Wall cupboards above the counters.
DETAILS: broken plates and a knocked-over chair on the floor, blood handprints on the wall tiles, a torn rubbish bag in one corner.
```

### cocina-grande-arriba

Imagen **apaisada (3:2)**. Guardar como `cocina-grande-arriba.png`. Es la que ya salió bien
(`cocina-gpt-grande-arriba-1.png`).

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: large kitchen, about 9 metres wide and 6 deep. Wide landscape image. Six pieces of furniture, small compared to the room, with a lot of empty floor.
ENTRANCE: the room is entered through the BACK WALL, in its centre. Leave the middle fifth of the back wall completely bare: no furniture, no cupboard, no shelf, nothing hanging, just plain wall. Keep a clear strip of empty floor from that bare stretch straight down to the bottom edge. Furniture is split into two groups, one on the left part of the back wall and one on the right part.
ROOM: kitchen. On the left: old fridge, counter with a sink and wall cupboards above. On the right: gas stove with an oven, long counter with wall cupboards above.
DETAILS: fridge door hanging open, broken plates and a knocked-over chair on the floor, blood handprints on the wall tiles.
```

### cocina-grande-izquierda

Imagen **apaisada (3:2)**. Guardar como `cocina-grande-izquierda.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: large kitchen, about 9 metres wide and 6 deep. Wide landscape image. Six pieces of furniture, small compared to the room, spread along the back wall, with a lot of empty floor.
ENTRANCE: the room is entered from the LEFT edge of the image. Keep the left third of the room empty: no furniture there, bare wall and bare floor only. All furniture is grouped on the centre and right of the back wall, and nothing stands along the left edge. The lower half of the floor is empty.
ROOM: kitchen. From the centre to the right against the back wall: counter with a sink, dishwasher, gas stove with an extractor hood, counter with a microwave, old fridge, tall pantry cupboard in the right corner. Wall cupboards above the counters.
DETAILS: a long smear of blood along the counters, cans and broken jars on the floor, a flickering ceiling lamp light on the wall.
```

### cocina-grande-derecha

Imagen **apaisada (3:2)**. Guardar como `cocina-grande-derecha.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is a kitchen of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO frame, NO perspective, NO diagonal lines: the back
  wall touches the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

SIZE: large kitchen, about 9 metres wide and 6 deep. Wide landscape image. Six pieces of furniture, small compared to the room, spread along the back wall, with a lot of empty floor.
ENTRANCE: the room is entered from the RIGHT edge of the image. Keep the right third of the room empty: no furniture there, bare wall and bare floor only. All furniture is grouped on the left and centre of the back wall, and nothing stands along the right edge. The lower half of the floor is empty.
ROOM: kitchen. From the left to the centre against the back wall: tall pantry cupboard in the left corner, old fridge, counter with a sink, dishwasher, gas stove with an oven, short counter. Wall cupboards above the counters.
DETAILS: smoke stains above the stove, a dirty frying pan on the floor, bloody footprints walking toward the right edge.
```

## Qué revisar antes de dar una imagen por buena

- Que no haya paredes laterales ni en diagonal, ni puerta, ni personas, ni letras.
- Que el suelo llegue a los tres bordes y quede mucho suelo libre.
- Que el lado de la entrada esté vacío (en las de arriba, el centro de la pared).
- Los muebles pueden salir de cualquier tamaño: la escala la ajusta Claude al reducir.
