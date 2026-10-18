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
  El fondo se pinta al **doble de detalle** que los sprites (`BG_PIXEL = 1` en `config.js`, elegido por el dueño):
  las texturas salen a 32 píxeles por casilla y se dibujan a media escala (`"scale": 0.5` en su `.json`).
- Baño (18 oct, **pendiente de visto bueno**): dos suelos y dos paredes del dueño (Gemini + tezumie), que se combinan
  al azar: `suelo-bano-a` (damero blanco y negro con cascotes) y `-b` (verde menta con sangre), `pared-bano-a`
  (azulejo blanco y verde, salpicones) y `-b` (bloque azul aguado). Originales en `assets/sources/suelos/bano-suelo-a|b`
  y `bano-pared-a|b` (el `-a` va recortado a `bano-suelo-a-recorte.png`). Cada baño elige su pareja con una cuenta
  sobre su posición (`rooms.js`, sin gastar el dado) y se pasa en `style.skin` (`render.js` añade `-a`/`-b` al nombre).
  Los de antes (`suelo-bano`, `pared-bano`, `techo-bano`) se retiraron. Hechos con
  `py tools/textura_suelo.py <img> bano-a 12` y `py tools/textura_pared.py <img> bano-a 24 1114 498 748 475 498`.
  `SKIN=-a,-b node tools/foto-sala.mjs sala.png 1 0 bano` fotografía un baño con esa pareja.
- Cocina, salón y dormitorio (18 oct, **pendiente de visto bueno**): tres suelos del dueño por habitación (`suelo-<estancia>-a|b|c`).
  Cocina: damero crema y naranja, gres rojo (8 baldosas, el resto 10) y baldosa blanca con sangre. Salón: tablones oscuros,
  tablones claros y parquet en damero. Dormitorio: moqueta gris azulada, granate y beige con flores. Originales en
  `assets/sources/suelos/<estancia>-suelo-<a|b|c>` (y `-recorte.png`, sin el margen). Todos a 10 baldosas por lado
  (`py tools/textura_suelo.py <recorte> cocina-a 10`) para que la baldosa mida lo mismo (16 unidades) en todas. Cada sala elige
  el suyo con `h % 3` sobre su posición (`rooms.js`, `style.skin.suelo`). Su pared también (`pared-<estancia>-a|b|c` y `techo-…`, 18 oct, pendiente de visto bueno): cada sala elige la suya con
  `floor(h / 3) % 3`, independiente del suelo. Cocina: azulejo de ladrillo verde, blanco con greca y beige con salpicadero; salón: burdeos con flores,
  oliva con friso y beige con friso de madera; dormitorio: lila a rayas, beige con rombos y azul con friso blanco. Originales en
  `assets/sources/suelos/<estancia>-pared-<a|b|c>.png`; se recortan con `py tools/textura_pared.py <img> cocina-a 24 1114 492 748 475 492`
  (los 17 píxeles de arriba son la moldura). `SKIN=-a,-b node tools/foto-sala.mjs sala.png 0 0 cocina` fotografía una sala con esa pareja.
- Pasillo (17 oct, con visto bueno): **moqueta** burdeos y mostaza con octógonos y una **alfombra** roja de borde
  mostaza en medio. El dueño las genera realistas y las pixela con tezumie.github.io (tamaño de píxel 4, con su
  paleta). Originales en `assets/sources/suelos/pasillo-moqueta.png` y `pasillo-alfombra.png`.
  - La moqueta de ahora es un recorte de prueba de 128 × 128 (4 × 4 casillas; su dibujo se repite cada 32 píxeles
    y el recorte se eligió donde mejor casaban los bordes): la imagen era alargada. **Pendiente:** una cuadrada,
    sin costura, de 1536 × 1536 pixelada a 4 (384 píxeles, 12 × 12 casillas), para que no se repita tan a menudo.
  - La alfombra es una tira de 256 × 64 que empalma por los lados: si existe `alfombra-<estancia>`, `render.js` la
    ajusta al alto de la alfombra y la repite a lo largo (si no, la alfombra de color de antes).
  - Prompts: vista cenital, luz plana y pareja, sin perspectiva, detalles gruesos (motivos de 20–30 cm) y solo
    manchas pequeñas repartidas (las grandes se repetirían; las pinta el juego aparte).
  - **Pared** (17 oct, con visto bueno): papel verde oliva y zócalo de madera oscura, de
    `assets/sources/suelos/pasillo-pared-1.png` (era una captura: se rehízo la tira de 256 × 64 cogiendo el centro
    de cada bloque). Se igualó la luz (iba a ondas) y se volvió a su paleta; el cuerpo se llevó a 96 filas
    (`pared-pasillo`, 402 × 96, `"scale": 0.5`, 1 unidad por píxel como el suelo, sin suavizar) y las 3 filas de
    moldura a `techo-pasillo` (402 × 12). **Pendiente:** el dueño hará variantes de la misma pared para alternarlas
    (cortarlas por las juntas entre rollos), y una versión generada a 1536 × 384 tendría más detalle.
    Los destrozos grandes (agujeros, salpicones) irían como adornos sueltos encima, no en la tira.
- **Tapa de los muros** (18 oct, **pendiente de visto bueno**): la parte de arriba de los muros (y de los tabiques) ya no es un
  color liso. Cuatro texturas del dueño (yeso o hormigón, vista cenital): `tapa-salon` (beige), `tapa-bano` (verde grisáceo),
  `tapa-pasillo` (hormigón gris) y `tapa-generica` (gris cálido), hechas con `py tools/textura_tapa.py <img> <nombre>` (256 píxeles,
  a media escala). `render.js` (`TAPA_DE`, `tapaOf`, `capFill`): el apartamento entero usa la del salón (su estilo base), el
  pasillo la suya, y cocina/dormitorio/mantenimiento/azotea reutilizan otra; lleva un velo oscuro (0,32) para que quede por detrás del
  suelo. La franja de encima del mapa se guarda como imagen (`drawCached`). `tapa-bano` aún no se usa: la tapa es una sola por mapa.
- **Pared:** `py tools/textura_pared.py <imagen> <estancia> x0 x1 y0 y1` recorta la pared de frente de junta a
  junta y crea `assets/sprites/pared-<estancia>` (48 píxeles de alto, con rodapié). La del baño sale de
  `assets/sources/suelos/bano-vacio.webp`. Las estancias sin textura siguen con el papel pintado a rayas.
  Con `t0 t1` saca también la moldura del techo (`techo-<estancia>`), que remata la pared en vez de la tapa lisa.
  La pared va a 192 píxeles de alto (cuatro veces el detalle de los personajes) y suavizada (`"suave"` en su
  `.json`): las caras de los muros se dibujan con la escena, a la resolución de la pantalla, no en el fondo.
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

El método anterior (fondos enteros dibujados con ChatGPT/Gemini, abandonado) está en
[`archivo/FONDOS-CHATGPT.md`](archivo/FONDOS-CHATGPT.md), con sus textos en `archivo/PROMPTS_*.md`.

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
