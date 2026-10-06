# Guía de estilo · Pixel art

Plan para pasar Blob Quest de su estilo cartoon (dibujado con código) a **pixel art**, poco a poco.
Mientras dure la migración, el modo pixel se activa añadiendo **`?pixel`** a la dirección
(por ejemplo `http://localhost:3000/?pixel`). Sin `?pixel` el juego sigue siendo el cartoon de siempre.

## Fases

| Fase | Qué se hace | Estado |
|---|---|---|
| 0 · Base | Dibujo a 480×320 ampliado sin suavizado, sistema de sprites con "plan B", herramienta de PixelLab, esta guía | ✅ Hecha |
| 1 · Prueba | Conserje, zombi normal, sofá y suelo del salón en una habitación | ✅ Hecha (13 generaciones) · pendiente de tu visto bueno |
| 2 · Escenarios | 5 suelos, paredes, puertas, escaleras y unos 20 muebles | ⏳ |
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
- **Los muebles se dibujan una sola vez**, "de espaldas a la pared de arriba", y el juego los gira de 90 en 90
  grados para las otras paredes (girar 90° no deforma los píxeles).
- **Paleta de referencia** (la actual del juego): contorno `#1d1b2c` · piel `#ffd2a8` · mono `#4f86f7` ·
  pañuelo `#ff5d73` · camisa `#fff3d6` · piel zombi `#8fc46a` · camisa zombi `#5b7db1` · parquet `#dba36a`/`#cf955c` ·
  amarillo `#ffd23f` · verde `#80ed99`.

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
