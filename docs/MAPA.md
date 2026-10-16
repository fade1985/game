# Mapa nuevo: pasillo y apartamentos

Decidido con el dueño el 12 de octubre de 2026. Sustituye a las salas sueltas al estilo *Binding of Isaac* por
plantas con un pasillo y apartamentos enteros, a medio camino entre *Hotline Miami* e *Isaac*.
La versión cartoon se elimina: el juego es solo pixel art.

## Cómo es el edificio

- **5 plantas y una azotea.** Planta baja, cuatro más y arriba la azotea, que es un espacio diáfano con el jefe final.
- **Cada planta es un pasillo largo con puertas a 4 estancias.** El pasillo está aparte de las estancias: se
  cruza una puerta para entrar a cada una.
- **En el pasillo:** los ascensores, averiados, a mitad de camino; en un extremo por donde se llega y en el otro
  las escaleras de emergencia a la planta siguiente. En la planta baja, además, la entrada del edificio.
- **Un mini jefe por planta**, en su apartamento. Matarlo abre las escaleras a la planta siguiente.

## Los apartamentos

- Cada uno es **un mapa continuo**: salón, cocina y 1, 2 o 3 dormitorios, con tabiques y puertas entre
  ellos. **Procedural:** sale distinto cada vez (`src/apartment.js`).
- **Son pisos de pijos: cada dormitorio tiene su baño**, y al baño solo se entra desde su dormitorio.
- **El salón es el centro:** desde él se entra directamente a la cocina y a cada dormitorio. A veces hay,
  además, una puerta entre dos habitaciones vecinas.
- **El del mini jefe es diáfano** (lo ha reventado todo) y **está cerrado con llave desde el principio**. La
  llave está en alguno de los otros apartamentos de la planta.
- **No todos son obligatorios:** en cuanto se tiene la llave se puede ir a por el mini jefe.
- **Al entrar en un apartamento la puerta se cierra** y no se abre hasta limpiarlo entero. No se puede huir al pasillo.
- **El superviviente** de la planta está en una habitación al azar de alguno de los apartamentos.
- **Ya no hay sala de objeto.** Más adelante los zombis soltarán objetos que servirán para mejorar.

## La sala de mantenimiento

En la planta baja, una de las 4 estancias es siempre la sala de mantenimiento, donde empieza el conserje.
Las otras tres son dos apartamentos y el del mini jefe. Dentro hay:

- **Una mesa con herramientas y una tablet.** La tablet sustituye al Taller y tendrá secciones: mejoras
  permanentes, logros, bestiario, misiones, estadísticas...
- **Unas taquillas** para cambiar de aspecto (skins). Las skins aún no existen.
- **Un arcón** donde se elige el arma entre las que se hayan conseguido (sustituye a los muebles de armas de la entrada).

## Propuestas mías que el dueño dio por buenas

- Los zombis ya están dentro del apartamento, repartidos por las habitaciones, en vez de aparecer por oleadas.
- Las habitaciones en las que aún no se ha entrado se ven oscurecidas, para mantener la sorpresa.
- La llave del apartamento del mini jefe es un objeto distinto de las llaves que se usan como moneda: hay que
  darle otro nombre y otro dibujo.
- Mientras no haya más jefes, el mini jefe de cada planta es el vecino del 4ºB cada vez más fuerte.

## Fases

| Fase | Qué se hace | Estado |
|---|---|---|
| 1 · Generador de apartamentos | `src/apartment.js` y una página de pruebas con colores planos | **Hecha y aprobada** |
| 2 · La planta | Pasillo, 4 puertas, llave, escaleras, ascensor averiado, 5 plantas y azotea. Fuera la sala de objeto y el código de la versión cartoon | **Hecha y aprobada** |
| 3 · Combate | Zombis por habitación, puerta que se cierra al entrar, equilibrado con partidas simuladas | **Hecha**, pendiente de visto bueno |
| 4 · Sala de mantenimiento | Tablet, arcón y taquillas | |
| 5 · Minimapa y arte | Minimapa nuevo y, después, el arte de los escenarios por piezas | |

## Fase 1: el generador

- **Probarlo:** `http://localhost:3000/assets/pruebas/apartamentos` (sin `.html`). Enseña 6 apartamentos a la
  vez; se puede elegir el número de dormitorios, ver el del jefe y poner el pasillo arriba o abajo.
  Con `?semilla=100` salen siempre los mismos.
- **Cómo lo hace:** el salón empieza ocupando todo el rectángulo. La cocina y los dormitorios se reparten
  alrededor en franjas, de izquierda a derecha: pegados a la pared del fondo, en una esquina de delante o dos
  seguidos en un lateral. Lo que queda libre es el salón, que sale con forma de L, de T, de U... y toca todas las
  habitaciones. A cada dormitorio se le recorta el baño en la esquina que menos da al salón. Después se abren
  las puertas: del salón a cada habitación, de cada dormitorio a su baño y, la mitad de las veces, una más
  entre dos habitaciones vecinas.
- **Reglas:** la cocina mide entre 9 y 16 casillas de lado y los dormitorios entre 11 y 20, con su baño de 6 a
  9 dentro; ninguna es más de 2,2 veces más larga que ancha. **El salón se queda con un tercio del apartamento**
  (entre el 22 % y el 42 %; de media, el 35 %): en la primera versión se llevaba la mitad o más y el dueño lo
  vio "gigantesco", así que las habitaciones crecen todo lo que el salón deja. El salón no tiene pasos de menos
  de 5 casillas y delante de cada habitación deja 7 de fondo. Las puertas miden 3 casillas (96 unidades).
- **Tamaños:** entre 36×24 y 52×32 casillas (de 1.152×768 a 1.664×1.024 unidades) según las habitaciones. El
  del jefe mide 44×30. En pantalla se ven unas 24×13 casillas. El dueño dio el tamaño por bueno ("luego vemos
  si reducimos o no").
- **Usa la misma cuadrícula que `shapes.js`** (casillas de 32; 0 suelo, 1 muro), así que lo que ya saben hacer
  los zombis, las balas y los muebles con las salas de antes vale también aquí.
- **Comprobado:** 6.000 apartamentos generados seguidos, todos con un baño por dormitorio, puerta directa del
  salón a la cocina y a cada dormitorio, y todo el suelo alcanzable desde la entrada. Muestra de seis en
  `assets/pruebas/apartamentos.png`. Aún no está conectado al juego.
- **Primera versión, descartada:** partía el rectángulo con tabiques al azar y ponía un solo baño. Salían
  dormitorios a los que solo se llegaba cruzando la cocina, y el dueño pidió que todo colgara del salón.

## Fase 2: la planta

El juego ya usa el mapa nuevo de principio a fin. Capturas: `assets/pruebas/mapa-fase2.jpg`.

- **Cómo está montado.** Cada sitio es un mapa aparte (el pasillo, cada apartamento, la sala de mantenimiento,
  la azotea) y al cruzar una puerta la cámara se desliza de uno a otro. `src/building.js` genera la planta y
  dice qué hay tras cada puerta; `src/rooms.js` monta cada mapa (suelo, muebles, decoración, oleadas).
- **Las puertas** de un mapa están en `room.exits` (ver `makeExit` en `rooms.js`): en qué muro, a dónde llevan
  y si tienen cerrojo (`locked`: `'key'`, `'boss'`, `'never'`).
- **El pasillo** mide 56×12 casillas: puertas A y B arriba, C y D abajo, el ascensor averiado en medio, por
  donde se ha llegado a la izquierda (en la planta baja, el portal) y las escaleras de emergencia a la derecha.
- **Planta baja:** la puerta A es la sala de mantenimiento. De momento es una sala sencilla con los muebles de
  las armas de siempre; la tablet, el arcón y las taquillas son la fase 4.
- **El mini jefe** está en una puerta al azar, menos en la 4ª planta, que vive en el 4ºB (antes era "el vecino del 4ºB"; ahora es la portera).
- **La llave** ("Llave del 2ºC") está en el suelo de una habitación que no sea el salón, en uno de los otros
  apartamentos. Se gasta al abrir la puerta. Mientras se lleva, sale debajo del minimapa.
- **El superviviente** está en cualquier habitación de un apartamento normal.
- **Nombres:** las plantas son "Planta baja", "1ª planta"... "4ª planta" y "Azotea" (por dentro, del 1 al 6);
  las puertas, "Bajo B", "1ºA"...
- **Muebles:** cada habitación lleva los de su estilo, arrimados a paredes y tabiques. Nunca delante de una
  puerta, y se comprueba que se puede seguir andando de cualquier puerta a cualquier otra.
- **Zombis:** rodean tabiques y muebles para llegar al conserje, y no atacan (escupir, tentáculo, mecha) si
  hay un tabique en medio.
- **Minimapa:** un plano de la planta con el pasillo y una casilla por puerta. Es provisional (fase 5).
- **Limpieza:** fuera la sala de objeto y su pedestal, el generador de salas sueltas (`floor.js`), las salas
  con forma de `shapes.js` y el interruptor `PIXEL_MODE` de la versión cartoon. Lo que aún no tiene sprite se
  sigue dibujando a mano; esos dibujos no se pueden quitar hasta que haya sprite.

## Fase 3: el combate

Capturas: `assets/pruebas/mapa-fase3.jpg`.

- **Los zombis ya están dentro.** Al generar la planta, cada apartamento recibe sus zombis repartidos por las
  habitaciones según su tamaño (`makeHorde` en `rooms.js`; en los baños, pocos). Nadie espera a menos de 340
  unidades de la puerta de entrada.
- **Dormidos hasta que te notan.** Se quedan en su sitio hasta que entras en su habitación o te ven a menos de
  330 unidades sin tabique en medio. Al despertar sueltan un "!" y tardan medio segundo en echar a andar; el
  que despierta arrastra a los que tiene al lado. Un golpe también los despierta, y **un disparo se oye**: despierta
  a los que haya a 430 unidades aunque haya tabiques (las armas cuerpo a cuerpo son silenciosas).
- **Habitaciones a oscuras.** Lo que no has pisado se ve negro, con los muebles apenas insinuados, y lo que hay
  dentro (zombis, la llave, el superviviente) no se dibuja ni se le apunta. Se descubre al entrar o al
  arrimarse a su puerta. El salón se ve desde el principio.
- **El apartamento queda limpio** cuando no queda ningún zombi; entonces se abre la puerta. Los jefes siguen
  apareciendo al entrar, como antes.
- **Caminos.** Zombis (y el bot) buscan el camino en una cuadrícula fina, de media casilla, en la que solo
  cuenta el sitio donde cabe un personaje (`navOf` en `shapes.js`). Los muebles ya no pueden dejar un rincón
  de suelo aislado (`walkChecker` en `rooms.js`): antes podía caer ahí un zombi y el apartamento no se podía limpiar.
- **Lo que sueltan los zombis** ya no se queda debajo de un mueble.

### Equilibrado

Hecho con `tools/bot.js`, un bot que juega solo pulsando las teclas (cómo usarlo, en su cabecera). Juega peor
que una persona: sus números sirven para comparar unas plantas con otras, no como verdad absoluta. Con la
fregona, rellenándole la vida en cada puerta y saltándose a los jefes (contra ellos pelea fatal):

| Planta | Zombis por apartamento | Segundos | Vida que pierde el bot |
|---|---|---|---|
| Baja | 11 | 38 | 9 |
| 1ª | 11 | 41 | 16–25 |
| 2ª | 12 | 40 | 14–25 |
| 3ª | 12 | 41 | 23 |
| 4ª | 13–14 | 42 | 18–21 |

- El presupuesto de zombis está en `HORDE` (`rooms.js`): 5 de base y 1,1 por nivel; el nivel es el orden del
  apartamento en la planta (1 a 3) más uno por planta. Los pisos grandes llevan hasta un 40 % más.
- Con los valores de partida (1,3 por nivel y nivel y medio por planta) el bot perdía 39 de vida por
  apartamento en la 4ª planta y moría en uno de cada cuatro: se suavizó.
- En 42 partidas seguidas del bot con los valores definitivos no se atascó en ningún apartamento.

## Escenario en tres cuartos (12 de octubre de 2026)

Capturas: `assets/pruebas/mapa-tres-cuartos.jpg` (y la comparación previa, `perspectiva-comparacion.png`).

El dueño notó que los personajes se ven de lado y el escenario desde arriba. Se pasó el escenario al estilo de
Zelda o Isaac: suelo desde arriba, y lo que está de pie enseñando su frente.

- **Paredes con cara.** Todo muro con suelo justo debajo enseña una cara con el papel pintado de esa habitación
  (`wallFaces` y `drawFace` en `render.js`). La del muro de arriba va en la imagen fija de la sala. La de un
  tabique sube 12 unidades por encima de su casilla (`OVER`) y tapa esa franja de la habitación de detrás.
- **Quién tapa a quién.** Los muebles y las caras de los tabiques se ordenan por su "y" junto con los
  personajes (`sceneryOf`): lo que está más abajo se dibuja delante. Johnny pasa por detrás de un armario o
  asoma por encima de un tabique.
- **Muebles con altura**, cada uno apoyado en su pared; no todos valen para todas (ver `CLAUDE.md`, apartado
  PixelLab). Sus medidas de choque se ajustaron al ancho de los dibujos.
- **A oscuras:** las caras y los muebles de una habitación sin pisar se apagan con ella.
- El bot jugó 6 partidas después del cambio sin atascarse.

Pendiente de esta parte: más muebles de lado (las paredes laterales quedan vacías), los muebles de las armas de
la sala de mantenimiento (siguen en planta), las puertas de los lados y de abajo (siguen como estaban), y
alfombras y cuadros con sprite.

### Pendiente

- **Los jefes no se han tocado** ni medido: el bot no sabe esquivarlos. La vida del vecino sigue subiendo un 25 %
  por planta, y ahora hay cinco: habrá que verlo jugando.
- **Sin sala de objeto**, los objetos solo llegan por la mejora Mochila del Taller (los soltarán los zombis).
- **El apartamento del mini jefe** es un salón grande y vacío: faltan los escombros de "lo ha reventado todo".
- **Los supervivientes y el vecino** dentro de un apartamento con tabiques van en línea recta (solo los zombis
  rodean); el mini jefe no importa porque su piso es diáfano.
