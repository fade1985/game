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
| 2 · La planta | Pasillo, 4 puertas, llave, escaleras, ascensor averiado, 5 plantas y azotea. Fuera la sala de objeto y el código de la versión cartoon | **Hecha**, pendiente de visto bueno |
| 3 · Combate | Zombis por habitación, puerta que se cierra al entrar, equilibrado con partidas simuladas | |
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
- **Reglas:** la cocina mide entre 7 y 12 casillas de lado y los dormitorios entre 10 y 15 (con su baño de 5 a
  7 dentro); ninguna es más de 2,2 veces más larga que ancha. El salón ocupa al menos el 30 % del apartamento
  (lo normal es la mitad), no tiene pasos de menos de 5 casillas y delante de cada habitación deja 8 de fondo.
  Las puertas miden 3 casillas (96 unidades), como las de siempre.
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
- **El mini jefe** está en una puerta al azar, menos en la 4ª planta, que vive en el 4ºB (es "el vecino del 4ºB").
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

### Provisional, para la fase 3

- **Los zombis siguen saliendo por oleadas** al entrar en el apartamento, por todo el piso. En la fase 3
  estarán ya dentro, repartidos por las habitaciones, y las que no se han pisado se verán oscurecidas.
- **El equilibrado está sin probar con partidas simuladas.** Ahora hay cinco plantas con mini jefe en vez de
  tres, así que se ha suavizado lo que crece cada planta (`FLOOR_HP` en `game.js`, `makeWaves` en `rooms.js`).
- **Sin sala de objeto**, los objetos solo llegan por la mejora Mochila del Taller.
- **El apartamento del mini jefe** es un salón grande y vacío: faltan los escombros de "lo ha reventado todo".
