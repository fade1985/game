# Escenarios: salas generadas con texturas (desde el 16 de octubre de 2026)

Los fondos enteros con ChatGPT/Gemini costaban demasiado (no se controla dónde pone cada mueble). Decidido por
el dueño: **vuelta a las salas generadas**, con suelo y pared texturizados y muebles colocados por el juego con
**plantillas con huecos** (como *Isaac*): cada estancia tiene varias plantillas ("aquí algo alto de pared",
"aquí encimera"...) y el juego llena los huecos de un pool de muebles con límites (una lavadora por cocina),
obligatorios (fogón en la cocina) y grupos (cama + mesillas). **Los muebles, suelos y paredes los trae el dueño.**

## Una sola densidad (19 oct, rama `pixel-escala`, con visto bueno)

Hasta el 19 oct los suelos y tapas iban al doble de detalle que los personajes (`"scale": 0.5`) y las paredes y
techos al cuádruple (`0.25`, suavizadas). Se veían "de otra resolución" que Johnny. El dueño lo comparó con la
prueba de la tecla O y eligió **todo a la densidad de los personajes**: cada píxel = 2 unidades del juego,
`"scale": 1`. `py tools/densidad.py` pasó así todo lo que había (media de color de cada bloque de 2×2 o 4×4), y los
scripts de abajo ya sacan lo nuevo así. Lo que de este documento hable de 0,5, 0,25 o "doble detalle" es de antes.

**Cómo traer suelos, paredes y tapas:**
- **No hace falta pixelarlas antes** (ni con tezumie): basta la imagen de la IA tal cual, grande y limpia. El
  script la reduce con la media de color de cada bloque, que es lo mismo que hace un pixelador. Si se pixela antes,
  al reducirla otra vez a un tamaño que no casa con su cuadrícula, los píxeles quedan desiguales.
- Si se quiere retocar a mano la versión pixelada (colores, paleta), pixelarla **justo al tamaño final**: suelo,
  16 píxeles por baldosa (una textura de 10×10 baldosas = 160×160); pared, 48 píxeles de alto (3 casillas) del borde
  de arriba al rodapié; techo, 6; tapa, 128×128. Así el script no la cambia.
- Lo que tiene que cumplir la imagen sigue igual: vista cenital y sin costura (suelo y tapa), de frente y sin
  muebles (pared), baldosas rectas y contadas (para decir N).
- Dejarla en `assets/sources/suelos/` con su nombre (`<estancia>-suelo-<a|b|c>`, `<estancia>-pared-<a|b|c>`) y
  pedírmela: yo paso el script con los números (N baldosas, juntas de la pared) y la pruebo en el juego.

- **Suelo:** textura entera, vista cenital, sin costura, con N × N baldosas rectas. `py tools/textura_suelo.py
  <imagen> <estancia> <N>` la reduce a 16 píxeles por baldosa y crea `assets/sprites/suelo-<estancia>`; el
  juego la repite. **Recortar baldosa a baldosa
  quedaba peor** (se veían las juntas pintadas): `tools/extraer_baldosas.py` se queda solo para probar.
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
- Mantenimiento (18 oct, **pendiente de visto bueno**): el damero se cambió por hormigón agrietado **sin sangre** (Gemini), 8 × 8
  baldosas: con sangre se notaba mucho la repetición, así que la sangre irá como manchas sueltas que reparte el juego.
  Original en `assets/sources/suelos/mantenimiento-suelo.png` (y `-recorte.png`, sin el margen transparente);
  `py tools/textura_suelo.py <recorte> mantenimiento 8`. La versión con sangre (`mantenimiento-suelo-sangre*.png`) es
  el mismo suelo con manchas: restando una de otra salen las manchas sueltas. Lo usan también las salas de exposición de `?pruebas`.
  **Manchas de sangre sueltas (18 oct, pendiente de visto bueno):** restando las dos imágenes se sacaron 10 manchas
  (salpicones, arrastres, gotas) y se montaron en `assets/sprites/manchas-suelo.png` (10 fotogramas de 120×72, a media
  escala). `makePlainLayout('maintenance')` (`src/rooms.js`) pone 6–10 al azar con el dado de la propia sala, al final,
  así que no cambia la huella del test; llevan giro de 90° y volteo al azar y `drawRoom` las pinta una vez en `roomImage`.
  No salen en la franja de la pared de arriba (muebles de armas). Sirve igual para otras salas: añadir `manchas` a su layout.
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
- **Plantillas de la pared del fondo** (`plantillas` de cada sala en `src/catalogo.js`: baño; desde el 18 oct, cocina y salón (con visto bueno) y dormitorio (pendiente de visto bueno). Ya viven en `catalogo.js`, no en `furniture.js`): lista de muebles
  de izquierda a derecha, con `?` los opcionales (se quitan en el orden de `quitar` de la sala si no cabe). Se reparten por los
  trozos libres de la pared (sin puertas ni lo que hay que dejar despejado delante de ellas). Si no cabe nada
  (puerta en medio de la pared del fondo, ~13 % de los baños), muebles sueltos como antes. Los laterales y la
  pared de abajo de los baños quedan vacíos, por decisión del dueño ("de momento solo la pared").
  Muchos baños pequeños con puerta lateral solo tienen sitio para el váter (~35 %).
  Cocina: el fogón es obligatorio y se reparte con nevera, encimera (158 de largo, la primera que se cae en cocinas pequeñas) y
  planta; `quitar` dice el orden en que se quitan los opcionales (en la cocina, planta, encimera y nevera).
  Salón: el sofá es obligatorio y se reparte con televisión, sillón, estantería, lámpara y planta (en los estrechos caen primero planta
  y lámpara). El apartamento destrozado del jefe (`use: 'jefe'`, también estilo salón) no usa plantillas: sigue con 2–3 muebles sueltos.
  Dormitorio: la cama es obligatoria, casi siempre con una mesilla a cada lado, y se reparte con armario, escritorio y lámpara.
- **Ningún mueble repetido** en una habitación (`iguales` de cada sala en `src/catalogo.js`: solo encimera y mesilla pueden salir dos veces).
- **Catálogo de muebles (18 oct, fase 1 de la reorganización, con visto bueno):** todo lo que decide qué muebles salen está en
  `src/catalogo.js`: `MUEBLES` (medidas, en qué paredes va cada uno y su archivo original) y `SALAS` (qué muebles,
  cuántos, cuántos iguales y plantillas). Los originales, por sala y en español, en `assets/sources/salas/<sala>/`
  (`cocina`, `bano`, `salon`, `dormitorio`, `pasillo` y `comun` para lámpara y planta): `nevera.png`,
  `sofa-lado.png`… Dentro del juego cada mueble sigue con su nombre en inglés (`fridge` → sprite `mueble-fridge`).
  Lo que ya no se usa (los muebles del 12 oct, las guías y descartes de PixelLab) está en `salas/descartes/`.
- **Variantes de muebles (18 oct, fase 2, con visto bueno):** `nevera-b.png`, `nevera-c.png`… dan los sprites `mueble-fridge-b`, `-c`…
  (`mueble-fridge` es la de siempre; de lado, `nevera-b-lado.png` → `mueble-fridge-b-lado`, y si falta, el `-lado`
  de la de siempre). Cada apartamento, pasillo o sala elige una por tipo con su número `surtido` (rooms.js), sin
  gastar el dado de la partida: todas las neveras de una casa son iguales. Todas las variantes miden de ancho el
  `len` del catálogo (los choques usan esa medida).
- **Meter muebles nuevos (18 oct, fase 3, con visto bueno): `py tools/importar.py`.** Flujo del dueño: dejar la imagen (PNG o WEBP
  con fondo transparente) en `assets/sources/salas/<sala>/` con su nombre (`nevera-b.png`, `sofa-c-lado.png`) →
  ejecutar el comando → sale en el juego. Convierte solo lo nuevo o cambiado (apunta la huella de cada original en
  `salas/importados.json`; `py tools/importar.py nevera-b` lo rehace aunque no haya cambiado): quita el fondo y el
  halo blanco, recorta, reduce al ancho del catálogo (de frente, `len`; de lado, `dep`), pone el contorno, deja el
  `.json` con `scale` 0.5 y lo apunta en `manifest.json`. Avisa (y no convierte) si la imagen no tiene nada
  transparente (un damero pintado) o si el mueble es de tipo nuevo: ese hay que añadirlo antes a `src/catalogo.js`
  (medidas, paredes y salas; decidido por el dueño: a mano, no adivinado). Sustituye a `tools/mueble_dueno.py`.
  Los muebles de PixelLab (fondo azul, otra receta) siguen con `tools/muebles3c.py`. Más adelante, lo mismo para
  `objetos/` y `armas/`.
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
