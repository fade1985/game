# 🧹 Zombie Scape

Roguelike de zombis para navegador al estilo *The Binding of Isaac*: vista desde arriba, estilo *cartoon*
(formas redondas, contorno grueso, colores planos) y un conserje con su fregona contra un edificio infestado.
Hecho con **HTML5 Canvas + JavaScript puro**, sin librerías ni paso de compilación.

> 🚧 En pleno rediseño por fases. El plan completo y su estado están en [`docs/PLAN.md`](docs/PLAN.md).

## 🎮 Cómo se juega

- **Moverse:** `WASD` o flechas (en móvil: arrastra en la mitad izquierda de la pantalla)
- **Esquivar:** `Espacio` (en móvil: botón 💨). Te hace invulnerable un instante.
- **Cóctel molotov:** mantén clic derecho o `E`, apunta con el ratón y suelta (en móvil: arrastra desde el botón
  de la botella y suelta).
- **Cambiar de arma:** `Q` o la rueda del ratón (en móvil: toca el botón redondo de la otra arma, a la derecha,
  junto al de esquivar).
- **Recargar:** `R` (en móvil: toca el botón redondo del arma de fuego cuando la llevas en la mano; un aro blanco
  se va llenando mientras recarga y las balas de encima de la vida parpadean). También recarga sola
  al vaciar el cargador o cuando no hay ningún zombi a tiro.
- **Con mando** (Xbox, PlayStation...): stick izquierdo o cruceta para moverte, `A` esquivar, `X` recargar, `Y`
  cambiar de arma, `RT` mantenido + stick derecho para apuntar el molotov (se lanza al soltar), `Start` pausa. En los menús: cruceta o stick para
  elegir, `A` para pulsar y `B` para volver.
- **Atacar:** de momento es automático: apuntas al enemigo más cercano (más adelante será manual).
- **Pausa:** `Esc` o `P` (desde la pausa puedes quitar la música; el botón 🔊 silencia todo)

**En el móvil:** juega en horizontal. En Android hay un botón de **pantalla completa** en el menú; en iPhone,
usa *Compartir → Añadir a pantalla de inicio* y se abrirá como una app, a pantalla completa.

Al pulsar **Jugar** eliges edificio. De momento se puede jugar **Apartamentos**; el Hospital, el Centro comercial
y la Comisaría aparecen como *Próximamente*. Cada tarjeta muestra tu progreso: intentos, mejor planta, veces
completado y mejor tiempo.

El edificio **Apartamentos** tiene la **planta baja, cuatro plantas más y la azotea**. Cada planta es un
**pasillo** largo con cuatro puertas; detrás de cada una hay un apartamento entero, distinto en cada partida,
con su salón, su cocina y de uno a tres dormitorios con baño. Al entrar en un apartamento con zombis **la
puerta se cierra** y no se abre hasta que lo limpias.

| Qué | Cómo funciona |
|---|---|
| 🧰 Sala de mantenimiento | Aquí empiezas, en la planta baja: cada arma espera en su mueble |
| 🧟 Apartamentos | Con oleadas de zombis. No hace falta limpiarlos todos |
| 🗝️ La llave | El apartamento del mini jefe está **cerrado con llave**. La llave está en el suelo de alguna habitación de otro apartamento |
| 🙋 Superviviente | Uno por planta, en alguna habitación: limpia el apartamento y acércate para que se una a tu equipo |
| 👹 Mini jefe | Uno por planta: **La portera**, cada vez más dura. Al derrotarlo se abren las **escaleras de emergencia**, al fondo del pasillo |
| 👑 Azotea | Arriba del todo espera la jefa final: de momento, **La portera** con el doble de vida. Derrótala para completar el edificio |

El **minimapa** (arriba a la derecha) es un plano de la planta: gris lo que no has visitado, rojo lo que
tiene zombis, blanco lo limpio y amarillo donde estás. En el pasillo hay además un ascensor averiado y,
en la planta baja, el portal del edificio, que no se abre.
Los atributos y el equipo se conservan entre plantas; si caes, vuelves a empezar el edificio.

Cada habitación está amueblada según su estilo (salón, cocina, dormitorio, pasillo o baño): sofás, camas,
bañeras, neveras... Los muebles van pegados a las paredes, nunca tapan una puerta y **paran a los personajes
y a las balas**. En las paredes hay cuadros, relojes y
ventanas por las que entra la luz.

### 💵 Dólares y Taller

Los zombis sueltan a veces un **billete de dólar** 💵 (el mini jefe suelta 3 y la portera 8). Los billetes vienen solos
hacia ti y **se guardan al momento, aunque pierdas**. En el **Taller del conserje** (botón en el menú o al
terminar una partida) los gastas en mejoras permanentes que se aplican al empezar cada edificio:

| Mejora | Efecto por nivel | Niveles | Precio ($) |
|---|---|---|---|
| 🥪 Bocadillo | +10 de vida máxima | 5 | 3 · 6 · 10 · 15 · 20 |
| 🏋️ Pesas | +6 % de daño | 5 | 4 · 8 · 12 · 16 · 20 |
| 👟 Cordones nuevos | +4 % de velocidad | 3 | 5 · 10 · 15 |
| 🌀 Reflejos | La esquiva se recarga un 12 % antes | 3 | 5 · 10 · 15 |
| 🎒 Mochila | Empiezas cada edificio con un objeto al azar | 1 | 25 |

Todo se guarda en el navegador (`localStorage`): dólares, mejoras, récords y progreso de cada edificio.
Las partidas a medias no se guardan.

### 🎒 Objetos

De momento los objetos solo se consiguen con la mejora Mochila del Taller: la sala de objeto se ha retirado y más adelante los soltarán los zombis. Los que llevas se
ven arriba a la izquierda y en la pausa.

| Objeto | Efecto |
|---|---|
| 👟 Zapatillas | +15 % de velocidad de movimiento |
| 🥤 Proteínas | +20 % de daño |
| 🩹 Botiquín | +25 de vida máxima (y te cura 25) |
| ☕ Café | +20 % de velocidad de ataque |
| 🧤 Guantes | +25 % de alcance cuerpo a cuerpo |
| ⛑️ Casco | Recibes un 15 % menos de daño |

### 👥 Supervivientes

| Superviviente | Habilidad |
|---|---|
| 👮 Policía | Dispara con su pistola cada 1,2 s (5 de daño) |
| 🧑‍⚕️ Médica | No ataca: te cura 3 cada 8 s y 10 al limpiar cada sala |
| 🪖 Militar | Ráfagas de 3 balas cada 2,5 s (6 de daño cada una) |

### 🧹 Armas

Johnny lleva **dos armas a la vez**: una cuerpo a cuerpo y una de fuego (el molotov va aparte). Abajo se ven
las dos; la que está en la mano, encendida. Empiezas cada edificio con la **fregona** y sin arma de fuego. Al pasar
por encima de un arma del suelo la coges: si ya llevabas una de ese tipo, la vieja se queda en el suelo. El mini
jefe siempre suelta un arma.

**Munición:** cada arma de fuego tiene su **cargador** y llevas balas de reserva en la mochila. Encima de la
barra de vida se ven las balas del cargador, una a una (los cartuchos rojos, en la escopeta): al disparar se van
apagando, y al final de la fila pone las de reserva (`+24`). Al cogerla viene con el cargador lleno y 2 cargadores de reserva; caben como mucho 4. Los
zombis sueltan a veces una **caja de munición** (un cargador más) y el mini jefe suelta 2. Si te quedas sin
ninguna bala, Johnny saca solo la de cuerpo a cuerpo, y vuelve a la de fuego al coger una caja. La escopeta
mete los cartuchos **de uno en uno** y puede disparar a mitad de recarga. En el modo de pruebas la reserva es infinita.

**Elegir arma al empezar:** en la sala de mantenimiento cada arma espera en su mueble, pegado a la pared de arriba:
la fregona en su cubo, el bate en el paragüero, el cuchillo en la encimera, la pistola en el cajón de la cómoda
y la escopeta en la taquilla. Arrímate a un mueble abierto para coger su arma (la que llevabas vuelve a su sitio).
Los muebles con candado guardan armas que aún no has encontrado: **la primera vez que coges un arma en una
partida queda desbloqueada para siempre**. Con `?armas` en la dirección se ven todas abiertas, sin tocar el guardado.

| Arma | Tipo | Daño | Ataques/s | Cargador · recarga | Detalle |
|---|---|---|---|---|---|
| 🧹 Fregona | Cuerpo a cuerpo | 8 | 1,8 | | Barrido amplio que empuja mucho |
| 🏏 Bate | Cuerpo a cuerpo | 16 | 1,6 | | Golpe fuerte |
| 🔪 Cuchillo | Cuerpo a cuerpo | 9 | 4 | | Rapidísimo pero de corto alcance |
| 🔫 Pistola | A distancia | 10 | 2,5 | 12 · 1,1 s | Largo alcance |
| 💥 Escopeta | A distancia | 7 × 5 | 1 | 6 · 0,45 s por cartucho | Abanico de perdigones |
| 🔫 MP5 | A distancia | 4 | 8 | 30 · 1,8 s | Ráfaga continua, algo imprecisa |

Los golpes cuerpo a cuerpo también **destruyen los proyectiles enemigos**. Las mejoras (daño, velocidad de
ataque, alcance) multiplican las estadísticas del arma que lleves.

### 🧟 Zombis

| Zombi | Cómo reconocerlo | Qué hace |
|---|---|---|
| Lento | Camisa marrón | Se arrastra despacio; aparecen en grupo |
| Normal | Camisa azul | Va a por ti a paso normal |
| Rápido | Pequeño, rubio, chándal rojo | Corre muchísimo pero gira mal: esquívalo y se pasará de largo |
| Explosivo | Grande, cartuchos rojos y mecha | Al acercarse enciende la mecha (círculo rojo en el suelo) y explota. También explota al morir y daña a otros zombis |
| Tentáculos | Tentáculos morados en la espalda | Marca una franja roja y, al rato, lanza un latigazo por ella |
| Venenoso | Verde chillón, con babas | Mantiene la distancia y escupe mocos que dejan un charco que quema al pisarlo |

Los tipos más peligrosos aparecen en las plantas superiores.
Todos los ataques especiales avisan antes: ¡muévete o usa la esquiva!

### 👹 Jefes

**La portera** (mini jefa de cada planta: 600 de vida y +25 % por planta; en la azotea, jefa final con 1.200).
Abuela zombi con bata, delantal y una fregona llena de sangre. Tiene **dos fases**:

| Ataque | Fase | Aviso | Qué hace |
|---|---|---|---|
| Abanico de polvo | 1 y 2 | Líneas rojas finas | Barre y lanza bolas de polvo en abanico (2 o 3 seguidos) |
| Escobazo | 1 y 2 | Cuña roja delante de ella | Golpe fuerte que empuja, si estás cerca |
| ¡Lejía! | 1 y 2 | Círculo donde caerá cada botella | Lanza botellas que dejan charcos de lejía que queman |
| ¡A barrer! | 2 | Círculo rojo y grito | Gira como una peonza persiguiéndote y suelta polvo en espiral |
| ¡Los del 3º! | 2 | Grito | Llama a 2 zombis |

Al bajar del 50 % grita "¡QUE ACABO DE FREGAR!", te aparta, borra los proyectiles y pasa a la fase 2: más
rápida, abanicos más anchos y más botellas. Los barridos de las armas cuerpo a cuerpo también deshacen las bolas de polvo.

**Pixel art (en migración):** el juego es pixel art. Lo que todavía no tiene sprite se dibuja a mano, como
en la versión cartoon original, que ya no existe. Ver [`docs/PIXEL_ART.md`](docs/PIXEL_ART.md).

**Modo de pruebas:** añade `?pruebas` a la dirección (por ejemplo `http://localhost:3000/?pruebas`): todas
las armas estarán abiertas en la sala de mantenimiento, las teclas **1 a 6** invocan cada tipo de zombi, la **7** a la portera (mini jefa)
y la **8** a la jefa final.

## 🚀 Ejecutar en local

Los módulos de JavaScript (`import`) necesitan un servidor; abrir `index.html` con doble clic no funciona.

```bash
npm run dev          # usa "npx serve" → http://localhost:3000
# o bien
python3 -m http.server 3000
```

## ☁️ Publicar en Vercel

Sitio 100 % estático: en Vercel → **Add New… → Project** → importa el repo, **Framework Preset: Other**,
sin comando de build y sin carpeta de salida. Cada `git push` vuelve a publicar: la rama `main` es la versión
oficial (producción) y las demás ramas generan una *preview* con su propia dirección.

## 🗂️ Estructura del código

```
index.html        → página, HUD y capas de menús
style.css         → estilo cartoon de botones, paneles y HUD
docs/PLAN.md      → plan de desarrollo por fases y decisiones
src/
  main.js         → arranque y bucle principal (update + render)
  game.js         → flujo de la partida: plantas, mapas, puertas y oleadas
  game-*.js       → más partes de la partida: combate, efectos, mapa (choques y niebla), dibujo y ataques
  building.js     → generador de plantas: pasillo, cuatro puertas, llave, escaleras y azotea
  apartment.js    → generador de apartamentos (habitaciones, tabiques y puertas)
  rooms.js        → lo que hay en cada mapa: estilo, muebles, decoración y oleadas
  shapes.js       → la cuadrícula de cada mapa (suelo o muro) y el camino de los zombis
  props.js        → cosas de los mapas: superviviente, la llave del mini jefe y armas
  weapons.js      → catálogo de armas (datos) y su dibujo
  aim.js          → controlador de apuntado (automático; el manual irá aquí)
  entities.js     → jugador y compañeros (comportamiento + dibujo)
  zombies.js      → los 6 tipos de zombi y sus ataques especiales
  bosses.js       → reúne a los jefes y los crea
  jefe-base.js    → lo común de los jefes: su ficha, la base, los avisos de ataque
  jefe-portera.js → la portera (ataques, fases y dibujo)
  render.js       → dibujo de habitaciones, puertas en los 4 lados y minimapa
  furniture.js    → muebles de cada estilo de habitación y decoración de las paredes
  draw.js         → ayudas de dibujo: personaje humano, "blobs", ojos, sombras, texto
  upgrades.js     → atributos del jugador, objetos y mejoras del Taller
  ui.js           → menús en HTML (inicio, selector de edificios, Taller, pausa, fin) y HUD
  input.js        → teclado + joystick táctil
  sfx.js          → sonidos y música generados con Web Audio (sin archivos)
  sprites.js      → carga y dibujo de los sprites de pixel art (modo por defecto)
assets/sprites/   → sprites de pixel art (PNG + JSON) y su lista (manifest.json)
tools/pixellab.mjs → herramienta para generar sprites con la API de PixelLab
  save.js         → guardado en localStorage (dólares, Taller, récords y edificios)
  config.js       → constantes, colores, edificios y estilos de habitación
```

En la consola del navegador tienes `window.game` para trastear (p. ej. `game.player.hp = 999`).
