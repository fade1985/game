# Plan: "Panteón" · gacha de pago en pixel art con 100 personajes (23 oct 2026)

Juego nuevo, aparte de Zombie Escape. Nombre provisional: **Panteón** (hay que comprobar la marca antes de la
página de Steam). Este plan es la propuesta de Claude; lo que el dueño decida se apunta en "Decidido con el dueño".

## La idea en una frase

Un **roguelike de equipo con colección de héroes**: coleccionas 100 dioses, héroes y monstruos de las mitologías
del mundo redibujados como personajes de anime en pixel art, montas equipos de cinco y los llevas por mazmorras
generadas al azar. **Juego de pago, sin dinero real dentro**: las invocaciones se pagan con monedas que se ganan
jugando. En la tienda no se vende como "gacha" (en Steam esa palabra espanta), sino como "colección de héroes +
roguelike".

El gancho del GIF de diez segundos: Anubis, Thor y Sun Wukong en pixel art reventando a la Hidra, y después la
animación de invocar un cinco estrellas.

## Por qué esta idea

- **Sin dueño legal:** mitología y folclore son de dominio público. Lo que se protege es nuestro dibujo.
- **Gusta en China** (Viaje al Oeste, Tres Reinos, coleccionar, muchas horas por euro), en Japón y Corea (yokai,
  anime, ranking) y en Occidente (griegos, nórdicos, egipcios).
- **Encaja con lo que ya sabemos hacer:** sistemas, roguelike, pixel art con PixelLab, Godot.
- **Vista lateral** y sin desplazamiento por mapa: cada personaje necesita 5 animaciones de un solo lado, no 8
  direcciones. Es lo que hace posible llegar a 100.

## El juego

### Ciclo de una partida (20–30 min)

1. **Elegir equipo:** 5 personajes de la colección. Bonus por panteón (3 del mismo) y por elementos.
2. **Mapa de nodos** al estilo Slay the Spire, 15 nodos por acto, 3 actos: combates, élites, sucesos
   mitológicos (elecciones con texto: "Prometeo te ofrece el fuego…"), altares (comprar invocaciones con el botín
   de la partida), descanso y **jefe** (Hidra, Fenrir, Nian, Quetzalcóatl, Ammit…).
3. **Combate 5 contra 5 en vista lateral, automático con decisiones:** los personajes atacan solos por barra de
   tiempo; el jugador lanza las **habilidades definitivas** cuando se cargan y elige el objetivo. Se puede acelerar
   ×2. Fácil de programar, luce en pixel art y no exige reflejos.
4. **Durante la partida** se ganan reliquias temporales (como en un roguelike) que cambian la táctica.
5. **Al terminar** (ganar o morir) se vuelve al templo con las **ofrendas** ganadas: la moneda de invocar.

### Entre partidas: el templo

- **Altar de invocación:** 10 ofrendas = 1 invocación. Rarezas 3★ / 4★ / 5★ con probabilidades 80 / 17 / 3 %,
  **piedad** a las 50 invocaciones sin 5★ (garantizado) y **estandartes**: cada semana de juego hay un panteón
  destacado con el doble de probabilidad; el jugador puede elegir uno. Los repetidos dan **esencia** para
  despertar (subir estrellas) al personaje.
- **Libro de la colección:** los 100 con su ficha, un párrafo de leyenda (lo escribe Claude), su panteón,
  elemento, rol y el porcentaje completado. Completarlo es el objetivo a largo plazo.
- **Progresión:** nivel del personaje con esencia, despertar hasta 6★, una reliquia permanente por personaje al
  llegar al tope.
- **Modos:** Campaña (10 mazmorras, una por panteón, cada una con su jefe), **Torre de los Dioses** (infinita,
  con tabla de récords de Steam: para Corea) y **Desafío diario** (misma semilla para todos, con su tabla).

### Sistemas

- **Elementos (5):** fuego > hielo > rayo > tierra > agua > fuego (ventaja ×1,5). Luz y sombra aparte, se pegan
  entre sí.
- **Roles (5):** tanque, dañador físico, dañador mágico, sanador, apoyo. Cada personaje: 1 ataque normal, 1
  habilidad pasiva, 1 definitiva.
- **Sinergias:** 3 del mismo panteón → bonus del panteón (los nórdicos resisten al morir una vez, los egipcios
  reviven al primero caído…). 2 del mismo elemento → +10 % daño de ese elemento.
- **Dificultad:** 5 niveles de "ascensión" por mazmorra para el que la termina.
- **Guardado:** una colección por perfil, en `user://`, con copia de seguridad.

## Los 100 personajes: 10 panteones × 10

Cada panteón tiene 5 de 3★, 3 de 4★ y 2 de 5★ (50 / 30 / 20 en total). Giro anime en los diseños: proporciones
y expresividad de anime, no las estatuas. Ejemplos por panteón (nombres de dominio público):

| Panteón | Ejemplos | Jefe de su mazmorra |
|---|---|---|
| Griego | Zeus, Atenea, Hades, Perseo, Medusa, Hermes | Hidra |
| Nórdico | Thor, Loki, Freya, Odín, Hel, Fenrir (como personaje 5★ y como jefe) | Jörmungandr |
| Egipcio | Anubis, Ra, Bastet, Set, Isis, Sobek | Apofis |
| Japonés | Amaterasu, Susanoo, Kitsune, Tengu, Oni, Yuki-onna | Yamata no Orochi |
| Chino | Sun Wukong, Nezha, Guan Yu, Zhuge Liang, Chang'e, Nüwa | Nian |
| Hindú | Hanuman, Kali, Ganesha, Arjuna, Garuda, Durga | Ravana |
| Mesoamericano | Quetzalcóatl, Tezcatlipoca, Ixchel, Camazotz, Huitzilopochtli | Cipactli |
| Celta y artúrico | Morrigan, Cú Chulainn, Arturo, Merlín, Morgana, Lugh | El Caballero Verde |
| Eslavo | Baba Yagá, Perún, Koschéi, Veles, Morana, Rusalka | Zmey Gorynych |
| Mesopotámico y arábigo | Gilgamesh, Ishtar, Enkidu, Sinbad, Sherezade, Tiamat | Humbaba |

Regla legal al diseñar: **que nadie diga "ese es el de Fate / Smite / Genshin"**. Diseños propios, sin copiar
las versiones de otros juegos; los nombres y leyendas son libres, los diseños ajenos no.

### Qué lleva cada personaje (el "molde")

Todo sale de **una ficha de datos** (`.tres` o JSON) para poder hacer 100 en serie:

- Datos: nombre en 8 idiomas, panteón, rareza, elemento, rol, estadísticas base, 3 habilidades (de una lista de
  ~40 efectos reutilizables, combinados), párrafo de leyenda.
- Arte: **retrato** 96×96 en pixel art (para la colección y la invocación), **sprite de combate** de 64 px de alto
  en vista lateral con 5 animaciones (reposo, ataque, definitiva, daño, caída; 4–6 fotogramas cada una), icono de
  definitiva 24×24. Los 5★ llevan además una **lámina** grande para la animación de invocación.
- Coste estimado con PixelLab + arreglos a mano: **2–4 horas por personaje** (los 5★, el doble). Antes de la
  primera tanda, calcular el gasto con `docs/PIXELLAB.md` y decirlo.
- Sonidos: 3 por personaje de una biblioteca propia de 30 (golpes, magias) + 1 grito corto de definitiva.

## Fases (unos 12 meses a 20 h/semana; ~1.000 h)

Al terminar cada fase: resumen, capturas, commit y visto bueno del dueño antes de seguir.

| Fase | Qué | Cuánto |
|---|---|---|
| **0. Diseño y prototipo** | Documento de diseño cerrado; prototipo de combate 5v5 en Godot con cuadrados de colores. Si el combate no engancha con cuadrados, no enganchará con arte: aquí se decide si seguir | 2–3 semanas |
| **1. Corte vertical** | 10 personajes (el panteón griego), mapa de un acto, combate completo, invocación con monedas, colección, guardado. Probarlo con 5 personas de fuera | 2 meses |
| **2. Fábrica** | Molde de personaje industrializado (ficha → sprites → juego sin tocar código), 30 personajes (3 panteones), rarezas, despertar, elementos, sinergias, 3 jefes. **Página de Steam abierta** con cápsula encargada | 3 meses |
| **3. Contenido** | De 30 a 100 personajes, 10 mazmorras y jefes, Torre, desafío diario, sucesos. Demo pulida para el **Steam Next Fest** | 4 meses |
| **4. Lanzamiento** | Pulido, equilibrado con bot (como en Zombie Escape), 8 idiomas, logros y tablas de Steam, tráiler, 100 claves a streamers | 2 meses |
| **Después** | DLC de panteones nuevos (polinesio, yoruba, inca, finés…) a 3–4 € con 10 personajes cada uno. Es la forma honrada de alargar el juego sin gacha de pago | cada 3–4 meses |

Los personajes se hacen **en tandas de 10 por panteón**, y cada tanda se aprueba antes de la siguiente.

## Tecnología

- **Godot 4**, GDScript, todo dirigido por datos (fichas de personaje, habilidades y sucesos como recursos).
- Pixel art con **PixelLab** desde la sesión de la carpeta de Godot (es donde está conectado), con las
  herramientas que ya hay allí (`tools/hoja.py`, `tools/hacer_frames.py`).
- **GodotSteam** para logros, tablas de récords y nube de guardado.
- Pruebas automáticas como en Zombie Escape: un bot que juega partidas y un test que falla si algo rompe; con el
  azar fijo para comparar huellas. Se monta en la fase 1, no al final.
- Resolución base 640×360 escalada por entero; personajes de 64 px, retratos de 96.

## Dinero y mercado

- **Precio:** 12,99 € (precios regionales de Steam). Juego con 30–60 h de contenido: a 5 € parecería barato de
  verdad y perdería valor percibido.
- **Objetivo realista:** 3.000–5.000 listas de deseos el día de salida → 1.000–2.500 copias el primer año.
- **Gastos antes de salir:** 100 $ de Steam Direct, 150–500 € de cápsula, 0–50 € música de tráiler, los créditos de
  PixelLab de las tandas (se calculan antes). Nada en anuncios.
- **Idiomas (8):** español, inglés, chino simplificado, japonés, coreano, portugués de Brasil, alemán, francés.
  Chino simplificado desde la demo.
- **Dónde enseñarlo:** Reddit (r/IndieDev, r/roguelikes, r/gachagaming con cuidado), TikTok y Bluesky con un GIF
  semanal; Bilibili y Xiaoheihe para China; Naver y Chzzk para Corea.
- **Edad:** PEGI 12. Sin dinero real dentro no entra en las leyes de cajas de botín (Bélgica, Países Bajos, la
  española en preparación). Aun así, las probabilidades de invocación se enseñan en pantalla: es lo honrado y lo
  que el jugador chino espera.

## Riesgos y cómo los atajamos

| Riesgo | Qué hacemos |
|---|---|
| 100 personajes se comen el proyecto | Molde industrial en la fase 2 antes de producir; tandas de 10 con visto bueno; si en la fase 3 el ritmo no da, salir con 80 y los otros 20 en una actualización gratis el primer mes |
| El combate automático aburre | La fase 0 lo decide con cuadrados. Si aburre, pasamos a combate por turnos manual sin tirar nada |
| "Gacha sin dinero" se siente vacío | Invocaciones frecuentes (una cada partida corta), piedad, estandartes elegidos por el jugador, animación de invocación que dé gusto, y el libro de colección como meta |
| Parecerse demasiado a Fate, Smite o Genshin en algún diseño | Revisión legal de cada tanda: buscar el personaje en esos juegos y alejarse de su versión |
| El nombre "Panteón" ya es marca de algún juego | Comprobar en la OEPM, EUIPO y Steam antes de la página; tener dos nombres de reserva |
| Perder un año sin enseñar nada | Página de Steam en el mes 4 y demo en el mes 7–8: hay algo público pronto |

## Decidido con el dueño

- 23 oct: hacer un gacha en pixel art con 100 personajes propios o de mitologías, **como juego de pago** (sin
  dinero real dentro). Lo pidió el dueño tras ver que juntar los universos del anime no se puede.

## Pendiente de decidir (preguntar al dueño)

- Nombre del juego.
- Si los personajes son **todos de mitologías** (como está en el plan) o se mezclan con **originales tipo anime**
  (por ejemplo, un panteón "Los Olvidados" inventado por nosotros).
- Precio (propuesta: 12,99 €).
- Horas a la semana que va a dedicarle: ajusta el calendario.
- Si el juego vive en un repo nuevo propio o en la carpeta de Godot junto a Zombie Escape (mejor repo nuevo).
- Si quiere que Zombie Escape se termine antes o se aparque.
