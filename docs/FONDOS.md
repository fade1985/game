# Escenarios: salas generadas con texturas (desde el 16 de octubre de 2026)

Los fondos enteros con ChatGPT/Gemini costaban demasiado (no se controla dónde pone cada mueble). Decidido por
el dueño: **vuelta a las salas generadas**, con suelo y pared texturizados y muebles colocados por el juego con
**plantillas con huecos** (como *Isaac*): cada estancia tiene varias plantillas ("aquí algo alto de pared",
"aquí encimera"...) y el juego llena los huecos de un pool de muebles con límites (una lavadora por cocina),
obligatorios (fogón en la cocina) y grupos (cama + mesillas). **Los muebles, suelos y paredes los trae el dueño.**

- **Suelo:** textura entera, vista cenital, sin costura, con N × N baldosas rectas. `py tools/textura_suelo.py
  <imagen> <estancia> <N>` la reduce a 32 píxeles por baldosa y crea `assets/sprites/suelo-<estancia>`; el
  juego la dibuja a media escala (doble detalle que los personajes) y la repite. **Recortar baldosa a baldosa
  quedaba peor** (se veían las juntas pintadas): `tools/extraer_baldosas.py` se queda solo para probar.
  Ojo: el fondo se pinta a la resolución del pixel art, así que más detalle que 16 píxeles por baldosa no se ve.
- Baño: `assets/sources/suelos/bano-suelo-gemini.webp` (Gemini, 12 × 12). Va mejor si los detalles son gruesos.
- **Pared:** `py tools/textura_pared.py <imagen> <estancia> x0 x1 y0 y1` recorta la pared de frente de junta a
  junta y crea `assets/sprites/pared-<estancia>` (48 píxeles de alto, con rodapié). La del baño sale de
  `assets/sources/suelos/bano-vacio.webp`. Las estancias sin textura siguen con el papel pintado a rayas.
- **Paredes de 3 casillas (opción A, elegida por el dueño el 16 de octubre):** la cara mide `FACE_H` (96) y sube
  desde el pie del muro, sin cambiar el generador: en los tabiques tapa las dos últimas filas de la habitación
  de detrás (se vuelve medio transparente si hay alguien ahí) y en el muro de arriba se sale del mapa (la cámara
  deja ver `TOP_EXTRA` más arriba y `drawWallTops` pinta ese trozo en cada fotograma). Pega: en los baños
  pequeños (6 de fondo) se ven pocas filas de suelo libres.
- **Plantillas de la pared del fondo** (`TEMPLATES` en `furniture.js`, de momento solo el baño): lista de muebles
  de izquierda a derecha, con `?` los opcionales (se quitan en el orden de `DROP` si no cabe). Se reparten por los
  trozos libres de la pared (sin puertas ni lo que hay que dejar despejado delante de ellas). Si no cabe nada
  (puerta en medio de la pared del fondo, ~13 % de los baños), muebles sueltos como antes. Los laterales y la
  pared de abajo de los baños quedan vacíos, por decisión del dueño ("de momento solo la pared").
  Muchos baños pequeños con puerta lateral solo tienen sitio para el váter (~35 %).
- **Ningún mueble repetido** en una habitación (`MAX_SAME`: solo encimera y mesilla pueden salir dos veces).
- Textos para Gemini: pedir "perfectly flat orthographic view from directly above, NO perspective, exactly
  N x N square tiles aligned with the image edges, flat even lighting", y los detalles dentro de cada baldosa.

---

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

## Cómo pedir cada fondo (método actual: sin boceto)

Tras cuatro pruebas con boceto (ver "Lo aprendido"), se deja de intentar controlar dónde va cada mueble: el
modelo compone mejor solo, y cuando se le da un boceto mezcla las dos imágenes y deja restos a la vista.
Lo que antes se pedía con el boceto lo hace Claude después: **la escala** (se reduce cada imagen hasta que el
váter mida unos 30 píxeles de alto; el tamaño de la sala sale de ahí) y **la ficha de choques** (mirando la imagen).

1. **Un chat nuevo por imagen** (en el mismo chat arrastra los errores del intento anterior). ChatGPT o Gemini.
2. Adjuntar **solo la referencia de estilo** (`assets/sources/fondos/referencia-estilo.jpg`).
3. Pegar el texto, cambiando las dos últimas líneas.
4. Guardar el resultado sin recortar en `assets/sources/fondos/` como `bano-<n>.png`.

```text
Paint a new pixel art game background in exactly the same style as the attached image: same pixel art
technique, palette, level of detail, grime, blood and decay. It is another room of the same abandoned
apartment building, with a DIFFERENT layout from the attached image.

Framing, very important:
- Straight-on classic 3/4 top-down RPG view (like a JRPG tileset): the back wall runs horizontally across the
  whole top of the image, seen from the front, and takes about the top quarter. Everything below it is floor,
  seen from above.
- NO side walls, NO bottom wall, NO door, NO doorway, NO perspective, NO diagonal lines: the back wall touches
  the left and right edges, and the floor reaches the left, right and bottom edges of the image.
- The furniture is small and stands against the back wall, facing the viewer. At least two thirds of the floor
  is empty (only stains, cracks, blood and small debris).
- Dim, even lighting, no vignette, no dark corners. No people, no text, no UI, no border.

ROOM: bathroom with a bathtub against the back wall, a sink with a broken mirror, and a toilet.
DETAILS: torn shower curtain, blood handprints on the wall, cracked floor tiles, rubble in one corner. very dirty, heavy grime and decay like the style reference
```

**Qué imagen adjuntar:** mejor `assets/sources/fondos/referencia-encuadre.png` que la referencia original.
Es el baño 2 ya sin marco, sin puerta y enderezado: el modelo copia el encuadre de lo que se le adjunta, así
que con esta deja de dibujar el marco de muros y el hueco de la puerta.

**Textos completos, listos para copiar, por tamaño y entrada: [`PROMPTS_BANOS.md`](PROMPTS_BANOS.md) y
[`PROMPTS_COCINAS.md`](PROMPTS_COCINAS.md)** (este, con las cuatro entradas, también la de arriba).

### Diez baños distintos

El modelo tiende a repetir la distribución de la imagen adjunta. Para que cambie, en `ROOM` se dice **el orden
de los muebles de izquierda a derecha** y se añade "different layout from the attached image".

| Nº | ROOM | DETAILS |
|---|---|---|
| 1 | small bathroom. From left to right against the back wall: bathtub with shower, toilet, sink with a mirror | torn shower curtain, blood handprints, rubble in the right corner |
| 2 | small bathroom. From left to right: toilet, sink with a mirror, glass shower cabin in the right corner | shattered shower glass on the floor, open medicine cabinet, pills scattered |
| 3 | small bathroom. From left to right: washing machine, sink with a mirror, toilet, small window with broken blinds | laundry basket knocked over, dirty clothes, mould on the wall |
| 4 | medium bathroom. From left to right: tall towel cabinet, double sink with one long mirror, toilet, bidet | words written in blood on the mirror, towels on the floor |
| 5 | medium bathroom. From left to right: toilet, bathtub full of dark murky water, sink with a mirror | wet floor with puddles, broken pipe dripping, green mould |
| 6 | medium bathroom. From left to right: shower cabin, toilet, sink with a mirror, radiator with a towel | a trail of blood dragged across the floor toward the bottom edge |
| 7 | large bathroom. From left to right: bathtub, separate shower cabin, double sink with two mirrors, toilet, tall cabinet | fallen ceiling plaster, a dead plant, broken tiles |
| 8 | large shared bathroom. From left to right: two toilet stalls with wooden doors, two sinks with mirrors, a metal locker | a mop bucket knocked over, broken glass, graffiti scratched on a stall door |
| 9 | small bathroom, almost intact and clean, only dusty. From left to right: sink with a mirror, toilet, bathtub | closed shower curtain, a single bloody footprint, a flickering wall lamp |
| 10 | small bathroom completely wrecked. From left to right: smashed sink, toilet with broken lid, bathtub | collapsed ceiling in one corner, exposed pipes, mirror shards everywhere |

Guardar cada uno como `bano-<nº>.png` (si se repite, `bano-3b.png`...). No hace falta hacerlos todos: seis
buenos bastan para empezar.

Los bocetos de `tools/plantilla_fondo.py` y `assets/plantillas/` se quedan por si hacen falta, pero no se usan.

## Qué revisar antes de dar una imagen por buena

- Que no haya paredes laterales ni en diagonal, ni puerta, ni personas, ni letras.
- Que el suelo llegue a los tres bordes y quede mucho suelo libre.
- Los muebles pueden salir de cualquier tamaño: la escala la ajusta Claude al reducir.

## Lo aprendido

- **El boceto no funciona** (tercera prueba con Gemini, 13 de octubre de 2026): con bloques del color final y
  borde negro dejó a la vista trozos del boceto (un bloque con la palabra MIRROR, el suelo plano a la
  izquierda) y volvió a copiar la distribución de la referencia de estilo. Con dos imágenes que proponen dos
  composiciones distintas, el modelo se queda con la de la referencia. Se abandona el boceto.
- **Imágenes aprovechables hasta ahora:** `bano-pequeno-1.png` (ChatGPT, escala buena a 144 de ancho, algo
  borrosa al reducir) y `bano-pequeno-1-gemini.png` (Gemini, nítida, pero con la bañera azul y el váter amarillo).

- **Los bloques tienen que destacar** (segunda prueba con Gemini, 13 de octubre de 2026): con bloques grises
  sobre fondo gris dejó de seguirlos (bañera a lo largo, muebles más grandes, pared más alta) y dejó a la vista
  restos del boceto arriba y a la izquierda. Ahora cada bloque va del color final del mueble, con borde negro
  grueso, y la pared y el suelo de su color final y sin cuadrícula. Gemini varía mucho de un intento a otro:
  si uno sale mal, repetir tal cual antes de cambiar nada.

- **Gemini sigue el boceto mucho mejor que ChatGPT** (13 de octubre de 2026, mismo texto y mismas dos
  imágenes): coloca cada mueble casi exacto en su bloque, devuelve 1024×1024 y dibuja con píxeles más gordos,
  que aguantan mejor la reducción. Pegas: copió los colores de los bloques y
  dibujó un trozo de muro a la izquierda (`assets/sources/fondos/bano-pequeno-1-gemini.png`, vista en
  `assets/pruebas/bano-gemini-prueba.png`). ChatGPT acierta la escala pero recoloca los muebles a su gusto y
  su detalle fino se emborrona al reducir (`assets/pruebas/bano-chatgpt-nitidez.png`).

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
