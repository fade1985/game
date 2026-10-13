# Guía de estilo · Pixel art

Plan para pasar Blob Quest de su estilo cartoon (dibujado con código) a **pixel art**, poco a poco.
El modo pixel es ya el de por defecto (`http://localhost:3000/`). La versión cartoon de siempre se sigue
pudiendo ver añadiendo **`?cartoon`** a la dirección (por ejemplo `http://localhost:3000/?cartoon`).

## Fases

| Fase | Qué se hace | Estado |
|---|---|---|
| 0 · Base | Dibujo a 480×320 ampliado sin suavizado, sistema de sprites con "plan B", herramienta de PixelLab, esta guía | ✅ Hecha |
| 1 · Prueba | Conserje, zombi normal, sofá y suelo del salón en una habitación | ✅ Hecha (13 generaciones) · pendiente de tu visto bueno |
| 2 · Escenarios | 5 suelos, paredes, puertas, escaleras y unos 20 muebles | 🟡 Suelos (7), paredes con cara (pintadas con código) y los 20 muebles en tres cuartos; faltan muebles de lado, puertas, alfombras, decoración de pared y los muebles de las armas |
| 3 · Personajes | Conserje, 3 supervivientes y 6 zombis con sus animaciones | ⏳ |
| 4 · Jefes | El vecino del 4ºB y la portera | ⏳ |
| 5 · Objetos e interfaz | Armas, objetos, corazón, llave, proyectiles, charcos, efectos, iconos y fuente | ⏳ |

## Medidas

- **Resolución del dibujo:** 480×320 píxeles. Cada píxel del dibujo son 2 unidades del juego (`PIXEL = 2`).
- **Baldosas:** 16×16 píxeles. El interior de una sala mide **26×16 baldosas**, las paredes 2 baldosas de
  grosor (64 unidades) y las puertas 3 baldosas de ancho.
- **Suelos:** baldosa de 32×32 píxeles que se repite (2×2 baldosas de 16).
- **Personajes:** lienzo de **32×32** (es el mínimo de PixelLab); el personaje ocupa unos 22–26 píxeles de alto,
  con los pies abajo del todo. Los jefes, 48×48 o 64×64.
- **Muebles:** su tamaño en píxeles es la mitad de su hueco en el juego (un sofá de 152×64 unidades → 76×32 píxeles),
  siempre en múltiplos de 4.

## Estilo

- **Vista:** cenital baja (`low top-down`) para personajes, como ahora: se ve la cara y un poco la cabeza por arriba.
  Muebles y suelos, cenital alta (`high top-down`).
- **Contorno:** negro de un solo color (`single color black outline`), como el contorno grueso actual.
- **Detalle:** medio (`medium detail`). Cabezas grandes y proporciones "chibi", para mantener el tono simpático.
- **Direcciones:** los personajes se generan en 8 direcciones (PixelLab las da todas con el personaje).
  Las animaciones se pueden hacer en 4 u 8; si falta una diagonal, el juego usa la dirección más cercana.
- **Armas:** van aparte y se dibujan girando en la mano del personaje (como ahora). Los personajes se generan
  **con las manos vacías**.
- **El escenario va "en tres cuartos"**, como los personajes: el suelo se ve desde arriba, las paredes que tienen
  suelo debajo enseñan su cara y los muebles su frente, con altura. Cada mueble tiene un dibujo de frente (para
  la pared de arriba) y algunos otro de lado (para las laterales; en la derecha, en espejo). Ya no se giran.
- **Paleta de referencia** (la actual del juego): contorno `#1d1b2c` · piel `#ffd2a8` · mono `#4f86f7` ·
  pañuelo `#ff5d73` · camisa `#fff3d6` · piel zombi `#8fc46a` · camisa zombi `#5b7db1` · parquet `#dba36a`/`#cf955c` ·
  amarillo `#ffd23f` · verde `#80ed99`.

## Cámara (solo en la versión pixel)

- Acercamiento **×1,5**: se ve unas dos terceras partes de la sala (320×213 píxeles de dibujo, sin deformar).
- Sigue al conserje con suavidad y se adelanta un poco hacia donde camina; nunca enseña lo de fuera de la sala.
- En las salas de jefe (mientras no estén limpias) se aleja a **×1,15** para que se vean sus ataques.
- **Avisos en el borde:** cada enemigo fuera de la vista sale como un "!" de su color con una flechita (crece
  al acercarse y es semitransparente mientras aparece). Si está **preparando un ataque** (mecha, latigazo,
  escupitajo, embestida...) parpadea en rojo. Los jefes salen con su icono. Con la sala limpia, las puertas
  que quedan fuera de la vista también se marcan (con el icono de la sala especial si lo es).
- **Ataque automático y compañeros:** solo apuntan a lo que se ve en pantalla (o casi).
- **Sin marco:** el juego ocupa toda la ventana. Se ve siempre la misma altura de sala y el ancho depende de la
  forma de la pantalla (en una panorámica se ve más sala a los lados; si la pantalla es más ancha que la sala,
  la sala se centra).
- **Movimiento suave:** la sala (suelo, paredes, muebles, manchas) se dibuja una vez en un lienzo de pixel art y se
  guarda; cada fotograma se recorta lo que se ve y se amplía con un desplazamiento exacto, así el fondo se mueve
  con suavidad aunque cada píxel del dibujo ocupe varios de pantalla. Los personajes, balas y partículas se
  dibujan a resolución de pantalla en su posición exacta (sus píxeles siguen nítidos), para que no "tiemblen".
- Código: `src/camera.js`; el dibujo, en `Game.renderPixel`; los avisos, en `Game.drawOffscreen`.

## Lo que sigue dibujándose con código

Partículas, números de daño, avisos rojos en el suelo, luces, la viñeta roja y los carteles. En el modo pixel
se dibujan en el mismo lienzo pequeño, así que también salen pixelados y encajan. Los textos, el minimapa y
la interfaz se dibujan a resolución completa para que se lean bien.

## Cómo funciona en el código

- `src/sprites.js` carga `assets/sprites/manifest.json` y, por cada sprite, su `PNG` + `JSON`.
- Cada cosa intenta dibujar su sprite y, si no existe todavía, usa su dibujo de siempre ("plan B"):
  `conserje`, `zombi-<tipo>`, `mueble-<tipo>` y `suelo-<estilo>` (`salon`, `cocina`, `dormitorio`, `pasillo`, `bano`).
- `tools/pixellab.mjs` habla con la API de PixelLab (necesita la variable de entorno `PIXELLAB_API_KEY`),
  guarda los sprites en `assets/sprites/` y apunta en `assets/pixellab.json` qué texto y semilla se usó.

## Fase 1 · Prueba (lo que se pedirá a PixelLab)

| Sprite | Herramienta | Texto (en inglés, que es como mejor responde) | Coste estimado |
|---|---|---|---|
| `conserje` | Personaje 32×32, 8 direcciones | *cheerful young janitor, chibi proportions with a big head, messy brown hair with a red bandana, cream shirt under blue work overalls, dark shoes, empty hands* | 2 |
| `conserje` · andar | Plantilla de animación, 4 direcciones | — | 4 |
| `zombi-normal` | Personaje 32×32, 8 direcciones | *cartoon zombie, chibi proportions with a big head, green skin, messy dark hair, torn blue shirt, dark blue trousers, arms stretched forward, angry eyes* | 2 |
| `zombi-normal` · andar | Plantilla de animación, 4 direcciones | — | 4 |
| `mueble-sofa` | Imagen 76×32 | *red three-seat fabric sofa seen from above, backrest along the top edge, cushions, game furniture sprite* | ~1 |
| `suelo-salon` | Imagen 32×32 | *seamless tileable wooden parquet floor, warm light brown planks, top-down texture* | ~1 |

**Total estimado: unas 14 generaciones.** Si algo sale mal se repite con otra semilla (cada repetición cuesta lo
mismo). Si el suelo no encaja bien al repetirse, se retoca a mano o se dibuja con código en estilo pixel.

## Resultado de la prueba (fase 1)

- **Conserje y zombi:** muy buenos y coherentes entre direcciones. La animación `walking` da 6 fotogramas
  por dirección y cuesta 1 generación por dirección. Las animaciones "a medida" cuestan 20–40 por dirección:
  evitarlas salvo para lo imprescindible.
- **Sofá:** sale en perspectiva (se ve el frente), no en planta. Queda muy bien en la pared de arriba, pero no
  sirve girado para las paredes laterales: o se colocan solo arriba (y abajo) o se genera una versión lateral.
- **Suelo:** encaja al repetirse pero es muy contrastado; el juego lo suaviza mezclándolo con el color de la
  habitación. Para los demás suelos conviene pedir algo más liso ("simple, subtle, low contrast").
- **Sombras:** los sprites no traen sombra; el juego la dibuja en píxeles bajo cada personaje.
- **Plan de prueba de PixelLab:** 40 generaciones y solo un trabajo a la vez (por eso el script pide las
  direcciones de una en una y espera si PixelLab está ocupado).

## Interfaz oscura y sucia (fase 5, empezada)

- **Fuente:** `assets/fuentes/zombie-scape-ui.ttf`, generada con `create_font` de PixelLab (15 generaciones,
  16 px, job `0b7002a4-25ae-4de8-8d07-60c457a2064a`). No trae tildes, ñ, ü, ¿ ni ¡: las añade
  `py tools/fuente-tildes.py` (hay que volver a pasarlo si se regenera la fuente). Se usa en `style.css`
  como `'ZS UI'`; Pixelify Sans queda de reserva.
- **Marcos:** `assets/ui/panel-oscuro.png` y `boton-oscuro.png` (recortados de `panel-oscuro-hoja.png`,
  `create_ui_asset`, 25 generaciones, id `67eca240-9139-46e6-9367-142b1606fff6`). Se usan como `border-image`
  de 9 trozos en `.panel` y `.btn`. Al botón se le borró el texto "BUTTON" que traía dibujado.
- **Todo el CSS nuevo** está al final de `style.css`, bajo `body.pixel` (colores: hueso sucio, metal, óxido, sangre seca).
- **Iconos del HUD** (`assets/ui/iconos/*.png`, 32×32, `create_object_pro_flash`, 5 generaciones cada uno): llave, sonido, mudo, pausa, dash y las 5 armas; se usan con `<i class="ico ico-NOMBRE">` (CSS al final de `style.css`).
- **Iconos del Taller y de los objetos** (10 más, mismo método): vida, fuerza, cordones, reflejos, mochila, proteínas, botiquín, café, guantes y casco (zapatillas reutiliza `dash.png`). Salen en el Taller, la pausa y la barra de objetos del juego (`itemIcon` en `game.js`).
- **Barra de vida** (`assets/ui/barra-vida.png`, `create_ui_asset` con `health_bar`, 15 generaciones): el hueco del marco es transparente y la sangre (CSS) se ve por detrás.
- **Minimapa** (`drawMinimap` en `render.js`): marco de 9 trozos con `boton-oscuro.png`, casillas cuadradas en colores sucios. Los textos del lienzo usan ya la fuente `ZS UI` (`game.js`).
- **Más iconos** (17, mismo método): corazón, diana, trofeo, 4 edificios, 3 supervivientes y las salas del minimapa (puerta, escalera, candado, herramientas, zombi, jefe, corona). Las estadísticas de la pausa reutilizan iconos de objetos. En el lienzo, `drawEmoji` (`render.js`) cambia el emoji por el icono si existe.
- **Emojis de botones y carteles:** quitados (▶ ← ↻ ⛶ 🎵 ✅ ⏱️ fuera, sin sustituto). Los carteles del lienzo (`drawBanner`) llevan `icon: '<id>'` y dibujan el icono PNG junto al título; la barra del jefe y la llave del minimapa usan `drawEmoji`. El "+1 llave" flotante es solo texto.
- **Objetos del suelo:** `objeto-corazon`, `objeto-llave` (la dorada del Taller) y `objeto-llave-puerta` (la plateada del mini jefe), 5 generaciones cada uno (`create_object_pro_flash`, 24 y 32 px). Fuentes en `assets/sources/suelo`. `drawPickup` y `DoorKey.draw` usan el sprite y, si falta, el dibujo de siempre.
- **Pendiente:** nada de emojis en la interfaz. Quedan sprites de jefes, proyectiles (la trazadora sigue dibujada con código), charcos de veneno y lejía, y efectos.
