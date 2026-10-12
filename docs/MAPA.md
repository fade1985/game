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

- Cada uno es **un mapa continuo**: salón, cocina, baño y 1, 2 o 3 dormitorios, con tabiques y puertas entre
  ellos. **Procedural:** sale distinto cada vez (`src/apartment.js`).
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
| 1 · Generador de apartamentos | `src/apartment.js` y una página de pruebas con colores planos | **Hecha**, pendiente de visto bueno |
| 2 · La planta | Pasillo, 4 puertas, llave, escaleras, ascensor averiado, 5 plantas y azotea. Fuera la sala de objeto y el código de la versión cartoon | |
| 3 · Combate | Zombis por habitación, puerta que se cierra al entrar, equilibrado con partidas simuladas | |
| 4 · Sala de mantenimiento | Tablet, arcón y taquillas | |
| 5 · Minimapa y arte | Minimapa nuevo y, después, el arte de los escenarios por piezas | |

## Fase 1: el generador

- **Probarlo:** `http://localhost:3000/assets/pruebas/apartamentos` (sin `.html`). Enseña 6 apartamentos a la
  vez; se puede elegir el número de dormitorios, ver el del jefe y poner el pasillo arriba o abajo.
  Con `?semilla=100` salen siempre los mismos.
- **Cómo lo hace:** parte el rectángulo en trozos con tabiques; el trozo más grande que da al pasillo es el
  salón (ahí va la puerta de entrada); un vecino suyo es la cocina y el resto, dormitorios; el baño se
  recorta en una esquina de otra habitación; y abre puertas hasta que desde el salón se llega a todas.
  A veces añade una puerta de más para poder dar la vuelta.
- **Reglas:** ninguna habitación mide menos de 7 casillas de lado (el baño, 5) ni es más de 2,2 veces más
  larga que ancha; las puertas miden 3 casillas (96 unidades), como las de siempre; el baño tiene una sola puerta.
- **Tamaños:** entre 36×24 y 52×32 casillas (de 1.152×768 a 1.664×1.024 unidades) según las habitaciones. El
  del jefe mide 44×30. En pantalla se ven unas 24×13 casillas, así que una habitación viene a ser media pantalla.
- **Usa la misma cuadrícula que `shapes.js`** (casillas de 32; 0 suelo, 1 muro), así que lo que ya saben hacer
  los zombis, las balas y los muebles con las salas de antes vale también aquí.
- **Comprobado:** 6.000 apartamentos generados seguidos, todos con sus habitaciones y con todo el suelo
  alcanzable desde la entrada. Aún no está conectado al juego.
