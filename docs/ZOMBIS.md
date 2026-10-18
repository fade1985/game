# Zombis en pixel art

Sacado de CLAUDE.md el 13 de octubre de 2026. Receta para hacer uno nuevo: skill `/zombi-nuevo`
(`.claude/skills/zombi-nuevo/SKILL.md`). Aquí, el estado y las notas de cada zombi.

Empezado el 12 de octubre de 2026. Se hace como las armas: un zombi de piloto (el normal) hasta verlo en el
juego y luego una skill `/zombi-nuevo` para los otros cinco. Ids, textos y costes en `assets/pixellab.json`
(`zombi-normal-48`).

- **Decidido por el dueño:** diseños inventados (no tiene dibujos), realistas y con el estilo de Johnny, a 48
  píxeles. Cada zombi lleva cuatro animaciones: andar, atacar, recibir golpe y morir.
- **Modelo del zombi normal: con visto bueno.** PixelLab saca la piel beige aunque se pida verde (pasó también
  con el venenoso): se corrige gratis con `py tools/piel.py <sprite>` y las 8 vistas corregidas se importan como
  personaje nuevo (`create_character` en modo `v3` con `direction_images`, 0,25 generaciones).
- **El zombi normal ya está en el juego** (sprite `zombi-normal`, a 48 píxeles): reposo, andar, zarpazo, golpe
  recibido y muerte en las 8 direcciones. Costó unas 43 generaciones. **Con el visto bueno final del dueño (13 de octubre de 2026)**
  (captura en `assets/pruebas/zombi-normal-en-juego.jpg`, GIF de cada animación en `assets/pruebas/zombi-normal-*.gif`).
  - **Cómo se monta:** `py tools/zombi.py zombi-normal-48 zombi-normal` rehace la hoja (casillas de 96×96) a partir
    de `assets/sources/zombi-normal-48/` (`rotations/`, `walk/`, `ataque/`, `golpe/`, `muerte/`). Oscurece la sangre
    de rojo vivo que mete PixelLab (decisión del dueño: sangre sí, pero apagada), quita los destellos y elige solo
    el tramo del andar que hace ciclo.
  - **En el juego** (todo en `zombies.js`): el zarpazo se ve al llegar al conserje pero el daño sigue siendo por
    contacto, como antes; al recibir un golpe se ve `hurt`; al morir deja un cuerpo (`Corpse`) que cae y se queda
    tendido en la sala (12 como mucho por sala). Vale para cualquier zombi cuya hoja tenga `attack`, `hurt` y `death`.
  - **Pegas conocidas:** de frente y de espaldas anda con los brazos bajos y en las otras direcciones con los
    brazos estirados (con el texto común se giraba de perfil); el ciclo de andar no cierra del todo limpio.
  - **Limpieza pendiente en PixelLab (solo con su confirmación):** el personaje de piel beige, el andar de
    plantilla y los cuatro andares descartados.
  - **Siguiente:** skill `/zombi-nuevo` creada (`.claude/skills/zombi-nuevo/SKILL.md`). Faltan rápido,
    explosivo, tentáculos y venenoso (este último, rehacerlo: salió con la piel beige).
- **El zombi lento ya está en el juego** (sprite `zombi-lento`), **con el visto bueno final del dueño (13 de
  octubre de 2026).** Diseño suyo: partido por la mitad, solo torso y brazos, se arrastra con las manos. Costó unas
  52 generaciones (6 de un primer modelo descartado, que salió con piernas de espaldas). Ids, textos y pegas en
  `assets/pixellab.json` (`zombi-lento-48`); captura en `assets/pruebas/zombi-lento-en-juego.jpg` y GIF en
  `assets/pruebas/zombi-lento-*.gif`.
  - **Cómo se monta:** `py tools/zombi.py zombi-lento-48 zombi-lento`, con `assets/sources/zombi-lento-48/zombi.json`
    (opciones nuevas de `tools/zombi.py`: `cintura`, `pies` y `ataque.sangre`; el andar usa los 12 fotogramas).
  - **Rastro de sangre** (lo pidió el dueño): al arrastrarse deja manchas en el suelo que se secan a los 8
    segundos. Lo hace el juego, no el sprite: `dropTrail` y `drawTrail` en `game.js` (constante `TRAIL`).
    Captura en `assets/pruebas/zombi-lento-rastro.jpg`.
  - **Piel:** piel y camisa salieron del mismo beige y `tools/piel.py` teñía las dos; este zombi tiene su propio
    script, `assets/sources/zombi-lento-48/piel.py`.
  - **Pegas conocidas:** el dibujo se ve bajo de frente y largo de espaldas. El choque sigue siendo el de siempre (`r: 17` en `ZOMBIE_TYPES`).
  - Los dos personajes de modelo que no se usaban ya están borrados de PixelLab (con su confirmación) y la muerte
    hacia la izquierda se repitió para quitarle un charco de sangre (la antigua, en `descartes/muerte/`).
- **El zombi venenoso (el gordo) ya está en el juego, en grande** (sprite `zombi-venenoso`), **con el visto bueno
  final del dueño (13 de octubre de 2026).** Al dueño le parecía pequeño junto a Johnny; estirado en el juego se le veían
  los píxeles gordos, así que se volvió a generar a 72×72 con el mismo diseño (67 píxeles de alto, contorno oscuro,
  piel beige: el dueño dio por bueno el diseño). Reposo, andar, escupir, golpe y muerte en las 8 direcciones.
  Costó 49 generaciones (11 de repetir el escupitajo). Ids, textos y pegas en `assets/pixellab.json` (`zombi-venenoso-72`); captura en
  `assets/pruebas/venenoso-grande-en-juego.jpg`, GIF en `assets/pruebas/zombi-venenoso-*.gif`.
  - **Cómo se monta:** `py tools/zombi.py zombi-venenoso-72 zombi-venenoso`, con su `zombi.json` (`casilla` 144,
    `origen` 36/48, `pies` 118, `sangre` viva para no oscurecerle las tripas).
  - **En el juego** (`zombies.js`): la animación de ataque es el escupitajo, se lanza al empezar a prepararlo y el
    moco sale de la boca a los 0,4 s. No da zarpazos. En `ZOMBIE_TYPES` lleva `shadow` (sombra ancha) y `top`
    (barra de vida por encima de la cabeza). El choque se agrandó de 16 a 30 (`r`) para que coincida con el dibujo.
  - **Escupitajo verde:** PixelLab pintaba un chorro rojo saliendo de la boca. Se repitió dos veces: cinco
    direcciones se tiñen de verde al montar (`"moco": true` en `zombi.json`) y tres se pidieron ya con baba verde.
    Captura: `assets/pruebas/venenoso-escupiendo.jpg`.
  - **Charcos y estados (18 oct, con visto bueno):** el moco pone el estado **veneno** (8 al caer; 4/s
    pisándolo y 3 s más al salir, Johnny verde y la barra de vida verde); la lejía de la portera, **resbaladizo**
    (0,8; patina 0,4 s al salir; también a los zombis) + **tóxico** flojo (3/s); el fuego del molotov, **fuego**
    (12/s y Johnny sigue ardiendo 2 s). Fichas y números en `src/estados.js`; cada charco elige los suyos en
    `HAZARDS` (`src/game-ataques.js`). Radio del moco: 64 (antes 46).
  - **Pegas conocidas:** de frente y de espaldas apenas mueve las piernas al andar.
  - Los escupitajos descartados ya están borrados de PixelLab (con su confirmación).
- **Zombi lento, un poco más pequeño** (13 de octubre de 2026, lo pidió el dueño): su dibujo se encoge a ×0,85
  (`spriteScale`), también el cuerpo que deja al morir. El choque (`r: 17`) no se ha tocado.
- **El zombi explosivo ya está en el juego** (sprite `zombi-explosivo`, 15 de octubre de 2026), **con el visto
  bueno final del dueño (15 de octubre de 2026).** Diseño suyo: un hombretón con gabardina gris oscuro cerrada que, al acercarse, la abre, enseña
  un chaleco de dinamita y revienta. Andar, abrir la gabardina, golpe y muerte en las 8 direcciones. Costó unas 43
  generaciones. Ids, textos y pegas en `assets/pixellab.json` (`zombi-explosivo-48`); captura en
  `assets/pruebas/zombi-explosivo-juego.jpg` y GIF en `assets/pruebas/zombi-explosivo-abrir.gif`.
  - **En el juego** (`zombies.js`): su animación de ataque es abrir la gabardina; se lanza al encenderse la mecha y
    se queda abierta (`anim.hold`) hasta reventar. Mientras, no se encoge con los golpes ni da zarpazos, y parpadea
    en rojo (en blanco tapaba la dinamita).
  - **Cómo se monta:** `py tools/zombi.py zombi-explosivo-48 zombi-explosivo`, con su `zombi.json` (fotogramas 1-8
    del ataque en 0,5 s y el tramo de andar de cada dirección). Piel con su propio `piel.py` (la gabardina también
    es gris cálido).
  - **Pegas conocidas:** tres andares (`west`, `south-west`, `north-west`) y el abrir de `west` son los de la
    dirección contraria reflejados (PixelLab los giraba de lado o cerraban mal el ciclo). Al reventar deja su cuerpo
    entero tendido, como los demás.
- **Zombi explosivo, en grande** (15 de octubre de 2026, lo pidió el dueño: se veía más pequeño y menos corpulento
  que el rápido). Mismo diseño rehecho a 56×56 (unos 52 píxeles de alto, cabeza más grande), con todas las
  animaciones de nuevo; sustituye al de 48 en el juego. Costó unas 35 generaciones. Ids en `assets/pixellab.json`
  (`zombi-explosivo-56`); comparativa en `assets/pruebas/explosivo-grande-comparativa.png` y
  `comparativa-tamanos.png`, GIF en `assets/pruebas/zombi-explosivo-abrir.gif`. **Con el visto bueno final del dueño (15 de octubre de 2026).**
  - **Limpieza hecha en PixelLab** (15 de octubre de 2026, con su confirmación): la versión de 48 entera y sus dos modelos de piel beige, la muerte de espaldas con charco y los dos andares descartados. Los fotogramas siguen en `assets/sources/`.
  - **Cómo se monta:** `py tools/zombi.py zombi-explosivo-56 zombi-explosivo`. Las direcciones que PixelLab giraba
    mal se rellenan con la contraria reflejada: `py assets/sources/zombi-explosivo-56/espejo.py <animación> <origen>
    <destino>` (pone de fotograma 0 el dibujo quieto de verdad). Reflejados: andar `west`, `south-west` y
    `north-west`; abrir `west`; muerte `west`, `south-west` y `north-west`.
  - **En el juego:** `top: 96` en `ZOMBIE_TYPES` para que la barra de vida quede sobre la cabeza.

## Variantes de color (13 de octubre de 2026)

- **Hecho: zombi normal y zombi lento con 6 variantes cada uno** (`rojo`, `bata`, `mostaza`, `negro`, `militar`,
  `turquesa`) además de la de siempre. Solo cambia el color de la ropa y la piel: misma vida, velocidad y daño.
  **Con el visto bueno del dueño (13 de octubre de 2026).** Capturas: `assets/pruebas/variantes-zombis.png` (las 7 versiones de cada
  uno en tres vistas) y `variantes-zombis-en-juego.jpg`.
- **Cómo se generan:** `py tools/variantes.py <zombi>` escribe `assets/sprites/<zombi>-<variante>.png/.json` a partir
  de la hoja original, sin tocarla ni gastar generaciones. Va en dos pasos (explicados en la cabecera del script):
  1. **Qué es cada píxel** (camisa, pantalón, piel o no tocar). No vale mirar solo el tono: cada píxel dudoso mira a
     sus vecinos. `py tools/variantes.py <zombi> --mapa` guarda en `assets/pruebas/<zombi>-mapa-variantes.png` lo que
     ha entendido (camisa azul, pantalón naranja, piel verde, gris = no se toca): mirarlo siempre antes de dar por
     buena una hoja nueva.
  2. **De qué color se pinta:** cada prenda de cada variante es una escala de 5 colores elegidos a mano, de sombra a
     luz (`CAMISA`, `PANTALON`, `PIEL` al principio del script). Así se conserva el sombreado.
- **En el juego:** `variantes` en `ZOMBIE_TYPES` (zombies.js). Cada zombi elige al nacer una al azar (o la de siempre,
  todas con la misma probabilidad) y su cuerpo muerto conserva el color. Si la hoja no está cargada, usa la de siempre.
- **Lo que se aprendió por el camino** (tres tandas descartadas):
  - Girar el tono y subir la saturación deja los colores planos y chillones, y varias variantes se parecen entre sí.
    El rosa/morado desentonaba con el juego. Por eso ahora son escalas hechas a mano.
  - La piel nunca en color carne: parece una persona viva. Siempre verde, gris o amarillento.
  - Zombi normal: los brillos del vaquero son del mismo azul que la camisa (salían manchas en las piernas).
  - Zombi lento: camisa, pelo, sombras de la cara y tripas son el mismo marrón. Se resuelve así: la cabeza se
    localiza siguiendo la cara fotograma a fotograma (`CABEZA_LENTO`: dónde está la cara en el dibujo quieto de cada
    dirección) y lo marrón de ahí se deja; lo marrón pegado a la piel o muy fino (manos, dedos) también se deja,
    porque sus brazos son piel podrida y no mangas. Resultado: se pinta el torso y los hombros, como una camiseta.
    Junto a las tripas queda una franja marrón sin pintar (se lee como ropa empapada de sangre).
- **Siguiente:** repetirlo con los zombis que vayan teniendo pixel art: añadir su pareja `clases_*`/`decide_*` y su
  entrada en `ZOMBIS`, y comprobar con `--mapa`.

### Ideas guardadas (no se hacen todavía; el dueño quiere centrarse en el color)

- **Élite:** mismo zombi con tono rojizo, más vida y más velocidad en los pisos altos.
- **Variantes con un pequeño cambio de comportamiento** (por ejemplo el policía con algo más de vida).
- **Mutaciones por edificio** (cascos o armaduras; zombis que se parten en dos al morir).
- **Zombis nuevos con otra mecánica:** escudo (hay que rodearlo), gritón que llama a más zombis, saltador que
  sale de los muebles.

## Jefes

### La portera (15 de octubre de 2026)

Abuela zombi con bata, delantal y una fregona llena de sangre, a partir de un dibujo del dueño
(`assets/sources/portera-96/referencia.png`). Es la **mini jefa de cada planta** y, hasta que se haga la jefa
final, también la de la azotea (con el doble de vida). El vecino del 4ºB, que ya no salía, se borró el 16 de octubre de 2026 (queda en el historial de git).

- **Tamaño:** 96 px en PixelLab (el cuerpo mide unos 115 de alto): unas 2,5 veces Johnny. Lo eligió el dueño
  para que destaque.
- **Cómo se hizo** (todo apuntado en `assets/pixellab.json`, entrada `portera-96`; 51 generaciones):
  1. `create_character_pro_flash` con la referencia como imagen de estilo (recortada a 128×128).
  2. Retoque gratis con `assets/sources/portera-96/retoque.py`: piel gris de muerta, delantal crema, sangre en las
     manos, la boca, los zapatos y los pelos de la fregona (el dueño pidió mucha). Las cajas de cada parte están
     a mano en el script, por vista.
  3. Las 8 vistas retocadas se subieron como personaje nuevo (`create_character` v3 con `direction_images`) y
     se animó ese personaje con PixMiniMax: andar, fregonazo, lejía, grito (solo de frente) y muerte. Cada
     animación parte del dibujo quieto pegado en un lienzo mayor (`partida/`) para que la fregona no se salga.
  4. Las que salieron mal (muerte de frente y de espaldas que no caía, el fregonazo de espaldas, el andar de
     espaldas) se repitieron; lo descartado está en `descartes/`.
- **Hoja:** `py tools/jefe.py portera-96 jefe-portera` monta `assets/sprites/jefe-portera.png` a partir de
  `assets/sources/portera-96/jefe.json` (casilla 192, qué fotogramas usa cada animación, cuánto dura y en cuál
  llega el golpe). Iguala los colores a los de las vistas quietas y quita motas.
- **En el juego** (`Portera.drawPixel` en `bosses.js`), cada ataque usa su animación: levantar la fregona es el
  aviso del abanico de agua sucia y del fregonazo, y bajarla, el golpe; la lejía, su lanzamiento; el grito, al
  enfadarse (a mitad de vida) y al llamar a los vecinos; el giro, su postura quieta dando vueltas. En la segunda
  fase se tiñe un poco de rojo y echa vapor. Al morir cae y su cuerpo se queda en el suelo (`BossCorpse`).
- **Andar (16 oct, con visto bueno):** parecía que levitaba. Su paso va atado a la distancia andada (`STRIDE`)
  y, como en el dibujo lo que toca el suelo es la fregona, se baja de 3 a 9 píxeles según la dirección para que
  las zapatillas pisen la sombra (`FEET_DY` en `src/jefe-portera.js`). Si se rehace la hoja, volver a medirlo.
- **Números provisionales** (los puso Claude): 600 de vida en la planta baja (+25 % por planta), radio 38.
- **Pendiente:** que el dueño la pruebe; la botella de lejía y el agua sucia siguen dibujadas con código.
