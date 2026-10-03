# Plan de desarrollo · Blob Quest Zombi

Rediseño de la demo hacia un roguelike de zombis estilo *The Binding of Isaac*, por **edificios → plantas → salas**,
manteniendo el estilo cartoon (formas redondas, contorno grueso, colores planos).

Forma de trabajo: **fase a fase**. Al terminar cada una → resumen + capturas + commit/push, y se espera el visto bueno.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Mapa de planta, navegación entre salas, minimapa, estética de apartamento, **protagonista humano** | ✅ Hecha |
| 2 | Salas especiales (objeto, superviviente, mini jefe), escaleras, edificio de 3 plantas, jefe final provisional | ✅ Hecha |
| 3 | Sistema de armas: fregona (cuerpo a cuerpo) y armas a distancia, animaciones, controlador de apuntado | ✅ Hecha |
| 4 | Los 6 zombis, charcos de veneno, oleadas por planta | ✅ Hecha |
| 5 | Objetos en pedestal y supervivientes (policía, médico, militar) | ✅ Hecha |
| 6 | Mini jefe "El vecino del 4ºB" y jefe final "La portera" | ✅ Hecha |
| 7 | Selector de edificios, guardado del progreso, muebles y ambientación, llaves y Taller | ✅ Hecha |
| 8 | Pulido: sonido, efectos de impacto, equilibrado, móvil | ✅ Hecha (pendiente de tu visto bueno) |

Después: ataque manual (cambiando solo el controlador de apuntado), más edificios, armas y zombis.

## Fases en detalle

### Fase 1 · Mapa de planta y navegación
- Generador de planta irregular sobre cuadrícula (`src/floor.js`); cada sala con 1–4 puertas según sus vecinas.
- Puertas en los 4 muros; se cierran con enemigos dentro y se abren al limpiar la sala.
- Transición deslizando la cámara; entras por la puerta opuesta. Las salas limpias siguen limpias al volver.
- Minimapa: salas visitadas, vistas sin visitar y sala actual.
- Estética de apartamento: suelos de parquet/baldosa/moqueta, papel pintado, puertas de madera.
- Protagonista con forma humana (cabeza grande, cuerpo, manos y pies animados).
- Se retiran: tienda, hoguera, tesoro, elección de puertas, monedas, cartas al limpiar, Taller (apartado).
- Provisional: siguen las gelatinas como enemigos y el disparo automático.
- **Prueba:** recorrer la planta; puertas = minimapa; puertas cerradas con enemigos; F5 cambia el mapa.

### Fase 2 · Salas especiales y edificio
- Reparto: inicio, monstruos, objeto, superviviente, mini jefe (callejones sin salida; mini jefe en la más lejana).
- Iconos en el minimapa. Escaleras tras el mini jefe. 3 plantas. Última planta: mini jefe → sala del jefe final.
- Morir reinicia el edificio desde la planta 1. Atributos y compañeros se conservan entre plantas.

### Fase 3 · Armas
- `src/weapons.js` (datos) y `src/aim.js` (controlador de apuntado: automático ahora, manual en el futuro).
- Cuerpo a cuerpo: barrido en arco con estela y empuje. A distancia: retroceso, fogonazo, casquillos.
- Una sola arma a la vez; al coger otra se intercambian. Se empieza cada edificio con la fregona.

### Fase 4 · Zombis
- Normal lento, normal, rápido, explosivo, tentáculos y venenoso, todos humanoides y con avisos antes de atacar.
- El explosivo también explota al morir y daña a otros zombis.

### Fase 5 · Objetos y supervivientes
- Pedestal con objeto; supervivientes que se unen al equipo; retratos en el HUD. Los compañeros no mueren (de momento).

### Fase 6 · Jefes de Apartamentos
- `src/bosses.js`: cada jefe es una máquina de estados (andar → elegir ataque → avisar → atacar).
- **El vecino del 4ºB:** embestida (se marea si choca con la pared), pisotón con onda expansiva, llama a vecinos.
  Por debajo del 40 % embiste dos veces y el pisotón suelta cascotes. Siempre suelta un arma.
- **La portera:** abanico de polvo, escobazo, botellas de lejía (charcos). Fase 2 al 50 %: "¡QUE ACABO DE FREGAR!",
  torbellino con la escoba y llamada a zombis.
- Vida: el vecino 400 (+25 % por planta); la portera 1.200 fijos (solo aparece en la última planta).
- Modo pruebas: teclas 7 (vecino) y 8 (portera).

### Fase 7 · Edificios, guardado, muebles y Taller
- Selector de edificios: Apartamentos jugable; Hospital, Centro comercial y Comisaría "Próximamente".
  Cada tarjeta muestra intentos, mejor planta, veces completado y mejor tiempo.
- Guardado (`src/save.js`): llaves, mejoras del Taller, récords y progreso por edificio. Sin partidas a medias.
- Muebles por estilo de habitación (`src/furniture.js`): obstáculos rectangulares pegados a las paredes,
  nunca delante de las puertas. Decoración de pared: cuadros, relojes y ventanas con luz.
- **Llaves 🔑 + Taller** (decidido): los zombis sueltan llaves (7 %), el mini jefe 3 y la portera 8. Se guardan
  aunque pierdas y se gastan en 5 mejoras permanentes (vida, daño, velocidad, esquiva y mochila).

### Fase 8 · Pulido y equilibrado
- **Sonido:** volumen general con compresor; música sintetizada (menú, exploración y jefes), melodías de
  victoria y derrota, latido con poca vida. Opción "Música: Sí/No" en la pausa (se guarda).
- **Efectos:** chispas al golpear (doradas si es crítico), manchas en el suelo al morir los zombis (se quedan en
  la sala), borde rojo al recibir daño y borde palpitante con menos del 30 % de vida.
- **Equilibrado** con un bot que juega partidas enteras (esquiva todos los avisos): corazones 8 % → 5 % y curan
  20 → 15; médica 15 → 10 al limpiar sala; zombis +25 % de vida por planta (antes +20 %); oleadas más grandes en
  las plantas 2 y 3. Resultado del bot: gana ~85 % de las veces y la planta 3 lo deja con 17–30 de vida.
- **Móvil:** el juego ocupa más pantalla en táctil, botón de pantalla completa (Android) y modo app al añadirlo
  a la pantalla de inicio (iPhone). Probado: joystick, esquiva, menús y pausa en un iPhone en horizontal.
- Primera partida: el cartel de entrada recuerda los controles.

## Decisiones tomadas
1. Se eliminan monedas, tienda y hoguera.
2. Progreso permanente: llaves 🔑 que se gastan en el Taller del conserje (decidido en la fase 7).
3. Sin cartas al limpiar salas: las mejoras salen de las salas de objeto.
4. Una sola arma a la vez (intercambio al recoger).
5. El mini jefe suelta siempre un arma; las salas de objeto tienen un 25 % de dar un arma.
6. Última planta: mini jefe y jefe final (el mini jefe abre la sala del jefe).
7. Los compañeros no mueren de momento.
8. Morir = volver a la planta 1 del edificio.
9. El explosivo explota al morir y daña a otros zombis.
10. Protagonista con **forma humana** (conserje con fregona), estilo cartoon.

## Valores iniciales

**Jugador:** 100 vida · velocidad 210 · 0,9 s de invulnerabilidad · esquiva.

**Apartamentos:** 3 plantas de 8 / 10 / 12 salas. +25 % de vida de los zombis por planta.

| Arma | Tipo | Daño | Ataques/s | Alcance | Notas |
|---|---|---|---|---|---|
| Fregona | Cuerpo a cuerpo | 8 | 1,8 | 60 | Barrido 140°, empuje alto |
| Bate | Cuerpo a cuerpo | 16 | 1,6 | 65 | Barrido 110° |
| Cuchillo | Cuerpo a cuerpo | 9 | 4 | 45 | Golpe estrecho 60° |
| Pistola | A distancia | 10 | 2,5 | 420 | 1 bala |
| Escopeta | A distancia | 7 × 5 | 1 | 260 | Abanico de 5 perdigones |

| Zombi | Vida | Velocidad | Daño | Detalle |
|---|---|---|---|---|
| Normal lento | 30 | 45 | 10 | En grupo |
| Normal | 30 | 80 | 10 | — |
| Rápido | 15 | 160 | 8 | Esprinta |
| Explosivo | 25 | 70 | 30 área (r 90) | Mecha 0,8 s |
| Tentáculos | 45 | 30 | 15 | Alcance 220, aviso 0,7 s, cada 2,5 s |
| Venenoso | 35 | 60 | 8 + charco | Charco 5/s durante 4 s |

**Objetos:** Zapatillas (+15 % velocidad), Proteínas (+20 % daño), Botiquín (+25 vida máx.), Café (+20 % vel. ataque),
Guantes (+25 % alcance cuerpo a cuerpo), Casco (−15 % daño recibido).

**Supervivientes:** Policía (pistola cada 1,2 s, 5 daño) · Médico (cura 15 al limpiar sala y 3 cada 8 s) ·
Militar (ráfaga de 3 balas cada 2,5 s, 6 daño). *(Fase 8: la médica cura 10 al limpiar sala.)*

**Jefes:** "El vecino del 4ºB" (400 vida, embestida, pisotón, invoca) · "La portera" (1.200 vida, 2 fases, escobazos y lejía).
