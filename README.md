# 🧹 Blob Quest

Roguelike de zombis para navegador al estilo *The Binding of Isaac*: vista desde arriba, estilo *cartoon*
(formas redondas, contorno grueso, colores planos) y un conserje con su fregona contra un edificio infestado.
Hecho con **HTML5 Canvas + JavaScript puro**, sin librerías ni paso de compilación.

> 🚧 En pleno rediseño por fases. El plan completo y su estado están en [`docs/PLAN.md`](docs/PLAN.md).

## 🎮 Cómo se juega

- **Moverse:** `WASD` o flechas (en móvil: arrastra en la mitad izquierda de la pantalla)
- **Esquivar:** `Espacio` (en móvil: botón 💨). Te hace invulnerable un instante.
- **Atacar:** de momento es automático: apuntas al enemigo más cercano (más adelante será manual).
- **Pausa:** `Esc` o `P`

Al pulsar **Jugar** eliges edificio. De momento se puede jugar **Apartamentos**; el Hospital, el Centro comercial
y la Comisaría aparecen como *Próximamente*. Cada tarjeta muestra tu progreso: intentos, mejor planta, veces
completado y mejor tiempo.

El edificio **Apartamentos** tiene **3 plantas**. Cada planta es un mapa de salas generado al azar; al entrar
en una sala con enemigos **las puertas se cierran** hasta que la limpias. El **minimapa** (arriba a la derecha)
muestra lo explorado y los iconos de las salas especiales:

| Sala | Qué hay |
|---|---|
| 🧟 Monstruos | Oleadas de enemigos |
| 🎁 Objeto | Un pedestal con un objeto (o, a veces, un arma): pásale por encima para cogerlo |
| 🙋 Superviviente | Limpia la sala y acércate para que se una a tu equipo |
| 👹 Mini jefe | Uno por planta: **El vecino del 4ºB**. Al derrotarlo aparecen las **escaleras** a la siguiente planta |
| 👑 Jefe final | En la última planta, detrás del mini jefe: **La portera**. Derrótala para completar el edificio |

Las puertas que llevan a salas especiales tienen el marco de color y un icono al lado.
Los atributos y el equipo se conservan entre plantas; si caes, vuelves a empezar el edificio.

Cada habitación está amueblada según su estilo (salón, cocina, dormitorio, pasillo o baño): sofás, camas,
bañeras, neveras... Los muebles van pegados a las paredes, nunca tapan una puerta y **paran a los personajes
y a las balas** (¡el vecino del 4ºB se marea si embiste contra uno!). En las paredes hay cuadros, relojes y
ventanas por las que entra la luz.

### 🔑 Llaves y Taller

Los zombis sueltan a veces una **llave** 🔑 (el mini jefe suelta 3 y la portera 8). Las llaves vienen solas
hacia ti y **se guardan al momento, aunque pierdas**. En el **Taller del conserje** (botón en el menú o al
terminar una partida) las gastas en mejoras permanentes que se aplican al empezar cada edificio:

| Mejora | Efecto por nivel | Niveles | Precio |
|---|---|---|---|
| 🥪 Bocadillo | +10 de vida máxima | 5 | 3 · 6 · 10 · 15 · 20 |
| 🏋️ Pesas | +6 % de daño | 5 | 4 · 8 · 12 · 16 · 20 |
| 👟 Cordones nuevos | +4 % de velocidad | 3 | 5 · 10 · 15 |
| 🌀 Reflejos | La esquiva se recarga un 12 % antes | 3 | 5 · 10 · 15 |
| 🎒 Mochila | Empiezas cada edificio con un objeto al azar | 1 | 25 |

Todo se guarda en el navegador (`localStorage`): llaves, mejoras, récords y progreso de cada edificio.
Las partidas a medias no se guardan.

### 🎒 Objetos

Cada planta tiene una sala de objeto con un pedestal (no se repiten en la misma partida). Los que llevas se
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
| 🧑‍⚕️ Médica | No ataca: te cura 3 cada 8 s y 15 al limpiar cada sala |
| 🪖 Militar | Ráfagas de 3 balas cada 2,5 s (6 de daño cada una) |

### 🧹 Armas

Empiezas cada edificio con la **fregona**. Al pasar por encima de un arma del suelo la cambias por la tuya
(la vieja se queda en el suelo). El mini jefe siempre suelta un arma y a veces la sala de objeto guarda una.

| Arma | Tipo | Daño | Ataques/s | Detalle |
|---|---|---|---|---|
| 🧹 Fregona | Cuerpo a cuerpo | 8 | 1,8 | Barrido amplio que empuja mucho |
| 🏏 Bate | Cuerpo a cuerpo | 16 | 1,6 | Golpe fuerte |
| 🔪 Cuchillo | Cuerpo a cuerpo | 9 | 4 | Rapidísimo pero de corto alcance |
| 🔫 Pistola | A distancia | 10 | 2,5 | Largo alcance |
| 💥 Escopeta | A distancia | 7 × 5 | 1 | Abanico de perdigones |

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

Los tipos más peligrosos aparecen en las salas más lejanas y en las plantas superiores.
Todos los ataques especiales avisan antes: ¡muévete o usa la esquiva!

### 👹 Jefes

**El vecino del 4ºB** (mini jefe, 400 de vida y +25 % por planta). Un zombi enorme en camiseta de tirantes.

| Ataque | Aviso | Qué hace |
|---|---|---|
| Embestida | Pasillo rojo con flechas | Carga en línea recta. Si choca contra la pared se queda **mareado** (no hace daño al tocarlo): ¡aprovecha! |
| Pisotón | Círculo rojo mientras salta | Cae y lanza una onda que daña y empuja |
| ¡Vecinos! | Levanta los brazos | Llama a 2 zombis |

Por debajo del 40 % de vida se enfada: anda más rápido, embiste dos veces seguidas, llama a 3 zombis y su
pisotón suelta cascotes en todas direcciones.

**La portera** (jefa final, 1.200 de vida). Con moño, gafas, delantal y escoba. Tiene **dos fases**:

| Ataque | Fase | Aviso | Qué hace |
|---|---|---|---|
| Abanico de polvo | 1 y 2 | Líneas rojas finas | Barre y lanza bolas de polvo en abanico (2 o 3 seguidos) |
| Escobazo | 1 y 2 | Cuña roja delante de ella | Golpe fuerte que empuja, si estás cerca |
| ¡Lejía! | 1 y 2 | Círculo donde caerá cada botella | Lanza botellas que dejan charcos de lejía que queman |
| ¡A barrer! | 2 | Círculo rojo y grito | Gira como una peonza persiguiéndote y suelta polvo en espiral |
| ¡Los del 3º! | 2 | Grito | Llama a 2 zombis |

Al bajar del 50 % grita "¡QUE ACABO DE FREGAR!", te aparta, borra los proyectiles y pasa a la fase 2: más
rápida, abanicos más anchos y más botellas. Los barridos de las armas cuerpo a cuerpo también deshacen las bolas de polvo.

**Modo de pruebas:** añade `?pruebas` a la dirección (por ejemplo `http://localhost:3000/?pruebas`): todas
las armas aparecerán en la sala de entrada, las teclas **1 a 6** invocan cada tipo de zombi, la **7** al vecino del 4ºB
y la **8** a la portera.

## 🚀 Ejecutar en local

Los módulos de JavaScript (`import`) necesitan un servidor; abrir `index.html` con doble clic no funciona.

```bash
npm run dev          # usa "npx serve" → http://localhost:3000
# o bien
python3 -m http.server 3000
```

## ☁️ Publicar en Vercel

Sitio 100 % estático: en Vercel → **Add New… → Project** → importa el repo, **Framework Preset: Other**,
sin comando de build y sin carpeta de salida. Cada `git push` vuelve a publicar.

## 🗂️ Estructura del código

```
index.html        → página, HUD y capas de menús
style.css         → estilo cartoon de botones, paneles y HUD
docs/PLAN.md      → plan de desarrollo por fases y decisiones
src/
  main.js         → arranque y bucle principal (update + render)
  game.js         → flujo de la partida: plantas, salas, puertas, oleadas, colisiones
  floor.js        → generador de plantas (mapa de salas al estilo Isaac)
  rooms.js        → tipos de sala y su contenido: estilo, obstáculos, alfombras y oleadas
  props.js        → objetos fijos de las salas: pedestal, superviviente, escaleras y armas
  weapons.js      → catálogo de armas (datos) y su dibujo
  aim.js          → controlador de apuntado (automático; el manual irá aquí)
  entities.js     → jugador y compañeros (comportamiento + dibujo)
  zombies.js      → los 6 tipos de zombi y sus ataques especiales
  bosses.js       → los jefes: el vecino del 4ºB y la portera (ataques, fases y dibujo)
  render.js       → dibujo de habitaciones, puertas en los 4 lados y minimapa
  furniture.js    → muebles de cada estilo de habitación y decoración de las paredes
  draw.js         → ayudas de dibujo: personaje humano, "blobs", ojos, sombras, texto
  upgrades.js     → atributos del jugador, objetos y mejoras del Taller
  ui.js           → menús en HTML (inicio, selector de edificios, Taller, pausa, fin) y HUD
  input.js        → teclado + joystick táctil
  sfx.js          → sonidos generados con Web Audio (sin archivos)
  save.js         → guardado en localStorage (llaves, Taller, récords y edificios)
  config.js       → constantes, colores, edificios y estilos de habitación
```

En la consola del navegador tienes `window.game` para trastear (p. ej. `game.player.hp = 999`).
