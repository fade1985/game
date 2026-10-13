# Zombie Scape · historia y decisiones cerradas

Sacado de CLAUDE.md el 13 de octubre de 2026. Consulta, no hace falta leerlo al empezar.

## Dónde lo dejamos (12 de octubre de 2026) · preguntar al dueño al retomar

**Al retomar, empezar preguntándole por el punto 1.**
Los ids, textos y costes de todo lo de abajo están en `assets/pixellab.json`. El 13 de octubre de 2026 quedaban 1.704 generaciones.

Johnny con la fregona **ya está en el juego** (solo versión pixel): sprite `conserje-48-guardia`, estado
"Fregona en guardia" del personaje "Johnny" en PixelLab. Tiene reposo, andar y ataque en las 8 direcciones.

- **Cómo se monta:** `py tools/arma.py conserje-48-guardia` rehace la hoja entera (casillas de 96×96) a partir de
  `assets/sources/conserje-48-guardia/`: `rotations/`, `walk/`, `ataque/` y `arma.json` (qué fotogramas se usan
  de cada animación). El reposo lo calcula el script, como `tools/idle.py`. En este ordenador Python se llama
  con `py` (no `python`) y tiene Pillow instalado.
- **En el juego:** el arma dice qué hoja usa (`sprite` en `weapons.js`). Con hoja propia no se dibuja el arma
  cartoon ni la estela azul del barrido, y el daño se hace cuando la mopa llega al suelo, no al empezar (el
  momento lo dice la hoja: `impacto` en `arma.json` → `hit` en el JSON del sprite). El andar avanza por ciclo (`cycle` en `drawSprite`)
  porque cada dirección tiene un número distinto de fotogramas (entre 6 y 10).
- **Ataque:** 9 fotogramas elegidos de los 13 de PixelLab, medio segundo, con estela de agua. La dirección de
  espaldas lleva un texto propio (con el común se daba la vuelta). Vista previa de los fotogramas sin recortar:
  `http://localhost:3000/assets/pruebas/ataque-fregona` (sin `.html`: el servidor lo quita).
- **Johnny con el bate** (`conserje-48-bate`, estado "Bate en guardia") va igual: mismas carpetas, mismo script.
  Su `arma.json` solo dice qué fotogramas del ataque se usan; lo demás lo pone el script.
- Johnny sin arma (`conserje-48`) sigue igual; ya no se ve en el juego con ningún arma (el cuchillo tiene su hoja).

Preguntas pendientes, por orden:

1. **La pistola tiene el visto bueno del dueño** ("está de lujo"). Johnny con la pistola de 9 mm está en el
   juego (sprite `conserje-48-pistola`, 32 generaciones): reposo, andar y disparo en las 8 direcciones.
   Lo siguiente que pidió: **la bala**. Hecha en pixel art desde el código (`drawTracer` en `render.js`, sin
   PixelLab): una trazadora de cuadraditos encajados en la cuadrícula, punta casi blanca y estela de amarillo
   a naranja; las críticas más gordas y rojizas, los perdigones más pequeños. Vale para todas las balas del
   conserje y de los compañeros; los proyectiles de los zombis siguen como estaban. También su **impacto**
   (`bulletImpact` en `game.js`): un destello cuadrado y chispas del color de la bala que rebotan hacia atrás,
   más algo de polvo si da en un muro; son partículas `px` (cuadraditos encajados en la cuadrícula que encogen
   en vez de desvanecerse). **La bala y el impacto tienen el visto bueno del dueño** (13 de octubre de 2026: "la bala está perfecta").
   - **Armas a distancia, cómo quedó programado:** al disparar con un arma con hoja propia se pone la animación
     `attack` sin retrasar la bala, y no se dibuja el arma de siempre ni su fogonazo ni su casquillo. La bala
     nace en la boca del arma del dibujo: `"boca": "fogonazo"` en `arma.json` hace que `tools/arma.py` la busque
     sola (el centro del fogonazo) y la apunte en el JSON del sprite (`muzzle`). Como el dibujo es alto, la bala
     se mueve por el suelo como siempre pero se **dibuja** levantada (`lift`: `MUZZLE_LIFT` en `entities.js`,
     `BULLET_LIFT` en `game.js`, `drawBullet` en `render.js`).
   - **Disparar andando (a petición del dueño):** antes las piernas se quedaban quietas mientras duraba la
     animación de disparo. Primero se probó a partir a Johnny por la cintura (piernas del andar + torso del
     disparo) y **el dueño lo rechazó: "el cuerpo tiene que estar unido siempre y no partirse"** (la cadera se
     veía desacompasada). Solución actual: `"efectos": true` en `arma.json` hace que la hoja lleve la animación
     `fx`, que es cada fotograma de disparo con SOLO el fogonazo, el humo y el casquillo. Si anda y dispara,
     `Player.draw` pinta el andar entero, de una pieza, y encima esos efectos; el retroceso de los brazos solo
     se ve disparando parado. **No volver a partir el cuerpo.** Solo para armas de fuego; la fregona y el bate
     siguen igual. Con el visto bueno del dueño (13 de octubre de 2026).
   - **Lo descartado de la pistola ya está borrado de PixelLab** (12 de octubre de 2026, con su confirmación).
   - **El bate está en el juego** (sprite `conserje-48-bate`, 27 generaciones) y tiene el visto bueno del dueño.
   - **La fregona tiene la estela de agua dentro del dibujo.** Decidido por el dueño: las estelas van siempre en
     el sprite y creíbles para cada arma (agua, aire, fuego...), nunca pintadas por el juego.
   - **La escopeta está en el juego** (sprite `conserje-48-escopeta`, 13 de octubre de 2026; 18 generaciones de
     animaciones más las 10–25 del estado): reposo, andar y disparo en las 8 direcciones, con lo programado para
     la pistola (no hubo que tocar el juego). El dueño dio el visto bueno al estado y a la prueba de disparo;
     **pendiente de su visto bueno final jugando** (capturas en `assets/pruebas/escopeta-*.png` y `.gif`).
     Pegas que vio y aceptó: de frente la lleva cruzada y de espaldas el cañón asoma por el hombro izquierdo.
     - Como el retroceso es fuerte, su `arma.json` lleva dos ajustes nuevos de `tools/arma.py`:
       `"margen_efectos": 10` (para que en la animación `fx` no se cuelen las manos) y `"sin_tinte": {}` (apaga
       la detección automática del tinte amarillo, que aquí se confundía y borraba el humo).
     - **Limpieza pendiente en PixelLab (solo con su confirmación):** el disparo `north-west` teñido de amarillo
       y el andar `north` que no cerraba el ciclo (ids en `assets/pixellab.json`).
   - **Si `backblaze.pixellab.ai` no responde** (pasó el 13 de octubre de 2026 y `tools/bajar.py` no puede
     bajar nada): bajar el zip de `https://api.pixellab.ai/mcp/characters/<id>/spritesheet`, que trae una hoja
     con todas las rotaciones y animaciones más un JSON que dice qué hay en cada fila, y recortar las casillas.
   - **El cuchillo está en el juego** (sprite `conserje-48-cuchillo`, 13 de octubre de 2026; 29 generaciones):
     reposo, andar y ataque en las 8 direcciones, sin tocar el juego. El dueño dio el visto bueno al estado y a
     la segunda prueba de ataque; **pendiente de su visto bueno final jugando** (hoja del ataque en
     `assets/pruebas/cuchillo-ataque-hoja.png`).
     - Como ataca 4 veces por segundo, el ataque dura 0,25 s y lleva solo 6 fotogramas, con el daño en el tercero.
       Por eso se pidieron 8 fotogramas a PixelLab y no 12: con 12 rellenaba el hueco con posturas inventadas.
     - De lado es un pinchazo con una rayita blanca corta; de frente y de espaldas, un tajo con una línea larga.
       No se parecen, pero **al dueño le gustó ese efecto de corte** y se dejó así. La palabra "slash" en el texto
       hacía que PixelLab dibujase una media luna más alta que Johnny: no usarla.
     - De frente (`south`) hubo que repetirlo con un texto estricto ("Strict front view the whole time..."): con
       el común se ponía de perfil.
     - **Lo descartado del cuchillo ya está borrado de PixelLab** (13 de octubre de 2026, con su confirmación):
       las dos primeras pruebas de ataque y el ataque de frente en el que se giraba.
   - **Ya no queda ningún arma por hacer:** las cinco tienen hoja propia.
2. **La skill `/arma-nueva` ya existe** (`.claude/skills/arma-nueva/SKILL.md`). Si en una sesión nueva no
   aparece en la lista, leer ese archivo y seguirlo igual.
3. **Limpieza de los estados de la fregona, del bate y de la pistola: hecha** el 12 de octubre de 2026 con su confirmación. En
   PixelLab quedan solo las animaciones que usa el juego. El resto de la limpieza sigue pendiente (punto 6).
4. **Dos pegas del estado "Fregona en guardia"** que vio y no ha dicho si le molestan: usa 18 colores frente a
   los 50 del Johnny sin arma (ropa más plana), y la mopa cambia de lado entre la vista de frente y las diagonales.
5. **Reposo:** sigue el hecho a mano ("de momento sirve"). Hay una prueba de frente con PixMiniMax que respeta
   mucho mejor a Johnny que la plantilla, pero parpadea demasiado. Propuesta sin contestar: repetirla sin
   parpadeo (1 generación) y, si gusta, las otras 7 direcciones.
6. **Limpieza en PixelLab (borrar no se puede deshacer: solo con su confirmación expresa):** el estado
   descartado "Con fregona" (mopa abajo) y, según lo que decida en el punto 5, la
   prueba de reposo con PixMiniMax y el reposo de plantilla. También el conserje antiguo de 32 píxeles.
7. **De antes, sin decidir:** rehacer el zombi venenoso (salió con la piel beige en vez de verde) y si su sprite
   de prueba debe verse en las partidas normales; si la elección de arma se queda también en la versión cartoon;
   probar con partidas simuladas el equilibrado de las salas grandes; y empezar el arte del salón.


## Flujo de trabajo para las armas de Johnny (acordado el 12 de octubre de 2026)

Habrá más armas y cada una necesita su estado y sus animaciones. Se acordó hacerlo siempre igual, con una
**skill** (una receta guardada en el proyecto: el dueño escribe algo como `/arma-nueva bate` y se siguen los pasos)
y un par de scripts. **Sin subagentes:** lo que hace esperar es PixelLab y el visto bueno del dueño, y eso un
subagente no lo acelera.

**Orden acordado:** primero terminar la fregona entera a mano, hasta verla funcionando en el juego. Con lo que
haya funcionado, crear la skill y los scripts. La segunda arma ya va por el flujo. **Hecho: la fregona funciona,
el script de montaje es `tools/arma.py` y la skill está en `.claude/skills/arma-nueva/SKILL.md`** (es la versión
al día de los pasos de abajo: el andar va con PixMiniMax, la prueba de ataque incluye la vista de espaldas y la
estela del golpe va dentro del dibujo). El dueño dijo que no hace falta parar tras la tanda completa.

Pasos para un "Arma X" (unas 30–45 generaciones; el dueño solo tiene que mirar en los pasos 1, 2 y 6):

1. **Estado:** Johnny con el arma en guardia (`create_character_state`, unas 10). Enseñarlo y **esperar visto bueno**:
   todo lo demás sale de esas ocho posturas.
2. **Prueba de ataque de perfil** con PixMiniMax (1). Enseñarla y **esperar visto bueno**.
3. **Tanda completa, sin parar:** las otras 7 direcciones del ataque y las 8 de andar (unas 15). Revisar cada
   dirección y repetir las que desentonen.
4. **Reposo:** con el script, gratis.
5. **Montaje:** un script lo mete todo en la hoja de sprites; conectarlo al juego.
6. **Capturas y resumen** para el visto bueno final.

Lo que hay que preparar una vez, cuando la fregona esté terminada:

- **La skill**, con estos pasos y una plantilla del texto de cada animación en la que solo cambian el arma y el
  tipo de golpe (un bate barre de lado, un cuchillo pincha, una pistola dispara).
- **Scripts de montaje generales:** `tools/walk.py` y `tools/idle.py` están hechos para el Johnny sin arma; hay
  que generalizarlos para cualquier estado y añadir el del ataque.
- **Que el juego elija el sprite según el arma** que lleve Johnny. Ahora solo conoce uno (`conserje-48`).

## Lo que queda

### 1. Decisiones pendientes (antes de seguir con el pixel art)

1. **Visto bueno al aspecto** de la prueba (conserje, zombi normal, sofá y suelo del salón) y a la cámara.
2. **Tamaño de los personajes:** 32 o 48 píxeles. Con el zoom ×1,5 de la cámara, 32 probablemente basta.
3. **Suelo:** dejar el parquet actual (suavizado con el color de la sala) o generar uno más liso (1 generación).
   Para los demás suelos pedir algo "simple, subtle, low contrast".
4. **Muebles:** PixelLab los da en perspectiva (se ve el frente). Opciones: ponerlos solo en las paredes de
   arriba y abajo, o generar también una versión lateral de cada uno.
5. ~~**Créditos:** decidir el plan de PixelLab para la migración completa.~~ **Hecho:** Tier 1 contratado y
   conectado por MCP (ver el apartado PixelLab).

### 2. Fases del pixel art

| Fase | Qué se hace |
|---|---|
| 2 · Escenarios | 5 suelos (salón, cocina, dormitorio, pasillo, baño), paredes, puertas, escaleras y unos 20 muebles |
| 3 · Personajes | Conserje y 3 supervivientes (policía, médica, militar) y los 6 zombis, con sus animaciones |
| 4 · Jefes | El vecino del 4ºB y la portera (48×48 o 64×64) |
| 5 · Objetos e interfaz | Armas, objetos, corazón, llave, proyectiles, charcos, efectos, iconos y fuente |

La versión pixel ya es la de por defecto; lo que aún no tiene sprite se ve con el dibujo cartoon.

### 3. Mecánicas nuevas (decididas el 12 de octubre de 2026)

- **Elegir arma en la entrada: hecho.** Cada arma espera en su mueble (`stash` en `weapons.js`, dibujo en
  `WeaponStash` de `props.js`). Se desbloquean al encontrarlas en una partida (`weapons` en el guardado).
  Más adelante puede que se compren o que se creen armas nuevas: por eso el mueble es un dato de cada arma.
- **Salas con forma libre y procedurales:** se hicieron para las salas sueltas y **se han retirado con el mapa
  nuevo** (pasillo y apartamentos, `docs/MAPA.md`). Lo de abajo se queda como historia; de aquello sigue en uso
  la cuadrícula de casillas y el camino de los zombis (`shapes.js`).
  - Cada sala es una cuadrícula de casillas de 32 unidades (30×20), suelo o muro. La forma sale de "morder" el
    rectángulo de 960×640 con bloques de muro: esquinas recortadas (L, T, cruz), entrantes en los lados sin
    puerta (U) y columnas. La mitad de las salas son simétricas.
  - Siempre quedan libres el centro y un pasillo de 6 casillas desde cada puerta. No hay pasos de menos de 2
    casillas y queda al menos el 60 % del suelo. La entrada y las salas de jefe siguen siendo rectangulares.
  - Los zombis rodean las esquinas (`wayTo`); balas, objetos, apariciones y apuntado respetan los muros; los
    muebles se arriman también a los muros interiores.
  - **Salas más grandes que la de siempre: hecho.** Algo más de la mitad de las salas de monstruos miden entre
    960×640 y 1408×896 (`pickSize`: 30–44 casillas de ancho, 20–28 de alto). Cada sala guarda sus medidas en
    `layout.w`, `layout.h`, `layout.cols` y `layout.rows`; en `game.js` se leen con `this.rw` y `this.rh`.
    `W` y `H` quedan solo para el tamaño de la pantalla y de la sala de siempre (entrada, jefes, menú, cartoon).
    En las grandes hay más muebles, más obstáculos, islas de muro y algún zombi más (`makeWaves`, parámetro
    `big`: +60 % de presupuesto por cada vez que se dobla la superficie). **Este equilibrado está sin probar
    con partidas simuladas.**
  - **Pendiente:** puertas que no estén en el centro de cada lado, y que el minimapa refleje el tamaño de cada sala.
- **Consecuencia para el arte:** los escenarios se generan como **piezas sueltas que encajan** (baldosa de suelo,
  tramos de pared, esquinas hacia dentro y hacia fuera, hueco de puerta) y muebles aparte; nunca salas enteras.

### 4. Pequeños pendientes

- El **reloj** y las **nubes de las ventanas** se quedan quietos en la versión pixel (la sala se guarda como una
  imagen fija). Se ofreció volver a animarlos dibujándolos aparte cada fotograma.
- Más adelante: los otros edificios (hospital, centro comercial, comisaría) aparecen como "Próximamente".

## Sobre pasar a Godot

Se habló de si convenía pasar el juego a Godot. Conclusión: **para una demo web con la que aprender, seguir con
JavaScript** (el ciclo de cambiar, capturar y simular partidas es muy rápido). Si el objetivo pasa a ser un juego
más grande para PC o móvil, Godot merece la pena y el mejor momento sería **antes de migrar el resto al pixel art**.
En ese caso, trabajar con Claude Code en el propio PC junto al editor de Godot. Los sprites de PixelLab, el diseño
y los valores de equilibrado se aprovecharían tal cual. Queda pendiente que el dueño decida su objetivo.
