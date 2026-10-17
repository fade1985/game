# Zombie Escape · historia y decisiones cerradas

Sacado de CLAUDE.md el 13 de octubre de 2026. Consulta, no hace falta leerlo al empezar.

## Armas: dónde lo dejamos (14 de octubre de 2026) · empezar por aquí

Quedaban 1.228 generaciones de PixelLab (se renuevan el 12 de noviembre). Todo está subido a `main`.

**16 oct, con visto bueno:** el andar hacia la derecha de la fregona y la pistola daba un salto (PixelLab lo
dio con pocas posturas). Ahora es el de la izquierda dado la vuelta: `"espejo": {"east": "west"}` en el
`arma.json` de cada una (lo entiende `tools/arma.py`). Si otra arma salta al andar en una dirección, mismo truco.
También con visto bueno: al disparar andando (pistola, escopeta, MP5) Johnny se echa entero un poco hacia atrás,
porque andando no se ve el retroceso de los brazos (`KICK` y `KICK_T` en `src/entities.js`).

**1. Lo que el dueño tiene que probar jugando** (`http://localhost:3000/?pruebas&armas&mudo`; la tecla 1 saca un
zombi). No ha dado todavía el visto bueno final a nada de esto:

- **El MP5**, arma nueva (la caja de la derecha del todo en la sala de mantenimiento). Qué mirar: si el traqueteo
  se siente bien, si es fuerte o flojo frente a la pistola y la escopeta, y el sonido (usa el disparo de la
  pistola 8 veces por segundo; puede cansar).
- **Apuntar abajo y arriba con el MP5 y la escopeta**, rehecho el 14 de octubre. Qué mirar: en la escopeta
  hacia abajo, el retroceso le sube el codo hasta la cabeza y quieto queda algo encorvado; hacia arriba el
  fogonazo es grande; y al girar de una diagonal a recto el arma salta del hombro a la cadera.
- **Sin probar por Claude:** andar y disparar a la vez con el MP5, y con las dos armas en abajo/arriba.

**2. Decisiones que le faltan al dueño**

- **Números del MP5** (provisionales, los puso Claude y él no los ha confirmado ni cambiado): daño 4, 8 disparos
  por segundo, alcance 340, empuje 0,3, `jitter` 0,14. Están en `src/weapons.js`.
- **Dónde se encuentra el MP5:** ahora, en la caja del sexto hueco, cerrada hasta encontrarlo en un botín.
  Las alternativas que se le ofrecieron: un mueble propio en la entrada, o desbloquearlo en el Taller.
- **Borrar o no** el disparo `north-west` de la escopeta teñido de amarillo (lo único descartado que queda en
  PixelLab de las armas; se le preguntó y no ha contestado).

**3. Armas arrojadizas: empezado con el cóctel molotov (15 de octubre de 2026), pendiente de que lo pruebe.**
Decidió: objeto aparte con munición (empieza con 2, caben 5, los zombis las sueltan a veces); se apunta libre
manteniendo clic derecho o E (el círculo sigue al ratón) y en el móvil arrastrando desde un botón nuevo encima
del de esquivar (un toque sin arrastrar lo tira al zombi más cercano); al soltar, se lanza. Mientras se apunta se
ven el alcance, la parábola y la zona que arderá. El fuego quema también a Johnny (la esquiva lo cruza).
Todo está en `src/molotov.js` (los números, provisionales, en `MOLOTOV`); dibujos a mano, sin pixel art aún.
Con `?pruebas` las botellas no se gastan. Lo de abajo es la propuesta original:

- En el juego no existe nada de arrojadizas. Solo hay armas cuerpo a cuerpo y a distancia, y Johnny ataca solo:
  no hay botón de atacar, solo moverse y esquivar.
- Tres decisiones suyas: (a) si son un **objeto aparte con munición** (lo recomendado: Johnny sigue con su arma
  y además lleva, por ejemplo, 2 botellas, como las bombas de *Isaac*) o un arma más; (b) **cómo se lanzan**:
  hace falta un botón nuevo, de teclado y táctil, y decidir si van hacia donde apunta Johnny o hacia donde elija
  el jugador; (c) **cuáles**: se le propusieron botella de lejía (charco que daña; la portera ya lanza lejía,
  parte del código existe en `bosses.js`), cóctel molotov (fuego en área) y algo que aturda o atraiga, como un
  despertador (encaja con que los zombis duermen).
- Orden propuesto: cerrar esas decisiones y los números; programar una sola con dibujos provisionales y ver si
  es divertida; y solo entonces el pixel art (objeto, vuelo, efecto y Johnny lanzando), que es lo que gasta
  generaciones.

**4. Para la próxima arma larga:** la skill `/arma-nueva` ya avisa de revisar `south` y `north` en el paso 1.

## Pendientes de antes (12 de octubre de 2026)

El detalle de cómo se hizo cada arma y de lo que se probó está en
[`archivo/HISTORIA-12-OCT.md`](archivo/HISTORIA-12-OCT.md). Sigue sin decidir:

- **Limpieza en PixelLab** (borrar no se puede deshacer: solo con su confirmación expresa): el estado descartado
  "Con fregona" (mopa abajo), la prueba de reposo con PixMiniMax y el reposo de plantilla (según lo que decida
  del reposo) y el conserje antiguo de 32 píxeles. Ids en `assets/pixellab.json`.
- **Reposo de Johnny:** sigue el hecho a mano ("de momento sirve"). La prueba de frente con PixMiniMax respeta
  mejor a Johnny pero parpadea demasiado; propuesta sin contestar: repetirla sin parpadeo (1 generación) y, si
  gusta, las otras 7 direcciones.
- **Dos pegas del estado "Fregona en guardia"** que no ha dicho si le molestan: usa 18 colores (ropa más plana
  que el Johnny sin arma) y la mopa cambia de lado entre la vista de frente y las diagonales.
- Más adelante: los otros edificios (hospital, centro comercial, comisaría) salen como "Próximamente".

## Sobre pasar a Godot

Se habló de si convenía pasar el juego a Godot. Conclusión: **para una demo web con la que aprender, seguir con
JavaScript** (el ciclo de cambiar, capturar y simular partidas es muy rápido). Si el objetivo pasa a ser un juego
más grande para PC o móvil, Godot merece la pena y el mejor momento sería **antes de migrar el resto al pixel art**.
En ese caso, trabajar con Claude Code en el propio PC junto al editor de Godot. Los sprites de PixelLab, el diseño
y los valores de equilibrado se aprovecharían tal cual. Queda pendiente que el dueño decida su objetivo.
