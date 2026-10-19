# Plan: combinar armas y objetos (19 oct)

## Ciclo

1. **En la partida:** los zombis a veces sueltan objetos (chatarra), además de dinero y munición. Johnny los
   lleva en una **mochila** (se ve en el HUD, con límite).
2. **Al terminar el edificio:** lo de la mochila pasa al **baúl** (se guarda entre partidas, en `save.js`).
   **Si Johnny muere, lo de la mochila se pierde.**
3. **Antes de la partida:** el baúl está junto al ordenador, en la sala de mantenimiento. Al arrimarse sale un
   recuadro con lo guardado y un banco de trabajo. **Solo se combina ahí.**
4. **Un arma combinada** se queda en el baúl hasta que se saca; al sacarla vale **para esa partida** y se gasta
   (como las armas de la tienda).

## Decidido con el dueño

- Al morir: se pierde la mochila.
- Combinar: solo en el baúl.
- Duración: una partida.
- Objetos y recetas: **los da el dueño** (pendiente).

## Rarezas (19 oct)

- **Gris, común:** las armas de siempre y todos los objetos.
- Al crear, el arma sale como mínimo **verde (poco común)**; con suerte, **azul (rara)** o **morada (épica)**,
  la épica siempre menos probable que la azul. Propuesta: verde 75 %, azul 20 %, épica 5 %.
- **Daño:** cada receta sube el daño del arma base a su manera (propuesta: entre +25 % y +40 %, más su efecto) y
  la rareza lo multiplica: verde ×1, azul ×1,2, épica ×1,45.

## Muebles

- **Baúl** (guardar) y **banco de trabajo** (crear) por separado, junto al ordenador.

## Botín (propuesta)

- Zombi normal: 8 % de soltar un objeto. Mini jefe: 2 seguros.
- **El componente explosivo** solo lo sueltan los zombis explosivos (25 %).

## Recetas del dueño (19 oct) y cómo las veo

Daños con rareza verde (azul ×1,2, épica ×1,45). Números provisionales.

| # | Receta | Sale | Hueco | Qué hace |
|---|---|---|---|---|
| 1 | Fregona + cuchillo | Lanza | cuerpo a cuerpo | daño 11 (fregona 8), alcance 96, estocada estrecha que atraviesa |
| 2 | Bate + clavos | Aplastacabezas | cuerpo a cuerpo | daño 21 (bate 16), empuja mucho y aturde un instante |
| 3 | Bate + gasolina | Bate de fuego | cuerpo a cuerpo | daño 20 y prende fuego |
| 4 | Pistola de agua + gasolina | Lanzallamas | a distancia | chorro de fuego corto con depósito; prende fuego |
| 5 | Bate + cuchillas | Partecuerpos | cuerpo a cuerpo | daño 22, arco ancho, hace sangrar |
| 6 | Spray de pintura + mechero | Súpersoplete | a distancia | llamarada en cono muy corta y muy fuerte |
| 7 | Pistola de agua + lejía | Desintegrador | a distancia | chorro de ácido: daño continuo y charco ácido |
| 8 | Botella de alcohol + trapo | Cóctel molotov | arrojadiza | 3 molotovs |
| 9 | Explosivos + despertador | Atraedora | arrojadiza | suena, atrae a los zombis 3 s y explota |
| 10 | Explosivos + extintor | Congeladora | arrojadiza | explota y deja a los zombis congelados 3 s |
| 11 | Explosivos + lejía | Lluvia ácida | arrojadiza | explota y deja un charco ácido grande |
| 12 | Táser + bate | Inmovilizadora | cuerpo a cuerpo | daño 20; la descarga aturde y salta a un zombi cercano |
| 13 | Llave inglesa + hacha | Bumerán segador | a distancia | se lanza, atraviesa zombis y vuelve a la mano; sin munición |
| 14 | Cuerda + cuchillo | Látigo escorpión | cuerpo a cuerpo | daño 12 (cuchillo 9), alcance 110, envenena |
| 15 | Fregona + mancuernas | Súper maza | cuerpo a cuerpo | daño 24, lenta, golpe en círculo con temblor |

- **Objetos (gris):** clavos, gasolina, cuchillas, pistola de agua, spray de pintura, mechero, lejía, botella de
  alcohol, trapo, explosivos, despertador, extintor, táser, llave inglesa, hacha, cuerda, mancuernas (17).
- **Armas que entran en recetas:** fregona, bate y cuchillo. Se compran en la tienda del ordenador y quedan en el
  **inventario** de Johnny; luego se combinan en el banco con objetos del baúl o de la mochila.
- **Inventario de Johnny:** las dos armas en mano (cuerpo a cuerpo y fuego) + la **mochila** con casillas para
  objetos. Se abre con una tecla (Tab / I, en mando Select). Lo de la mochila pasa al baúl al terminar el
  edificio; al morir se pierde.
- **Arrojadizas:** salen 3 unidades por receta; la rareza da más unidades y más radio.
- Con 17 objetos, el botín sube al **10 %** por zombi (los explosivos, solo de los explosivos, 25 %).

## Fases

- **A:** objetos que sueltan los zombis + mochila en el HUD. Hecha el 19 oct, con visto bueno.
- **B:** el baúl (guardar y ver lo guardado). Hecha el 19 oct, con visto bueno: `Baul` en `src/props.js`
  (dibujado a mano), al lado del ordenador (`BAUL_X` en `game.js`); al arrimarse, `showBaul` de `ui.js`.
- **C:** banco de trabajo, recetas y rarezas. Hecha el 19 oct, con visto bueno: recetas y rarezas en
  `src/recetas.js` (daños de las armas a distancia y arrojadizas puestos por Claude, provisionales); el banco
  (`BancoTrabajo` en `props.js`, a la izquierda del ordenador) y su recuadro en `src/banco.js`. Decidido con el
  dueño: la fregona va al inventario al coger otra arma cuerpo a cuerpo y solo se queda en el suelo si se tira
  desde el inventario, como los objetos. Provisional: si al crear Johnny se queda sin arma cuerpo a cuerpo, coge
  otra fregona; en la fase D el arma creada irá a su mano.
- **D:** armas combinadas en el juego, por tandas: D1 cuerpo a cuerpo (1, 2, 3, 5, 12, 14, 15); D2 a distancia
  (4, 6, 7, 13); D3 arrojadizas (8–11). Dibujo provisional: el sprite del arma base con un detalle encima; los
  sprites propios, más adelante con `/arma-nueva`.
- **D1 (19 oct, con visto bueno):** las 7 de cuerpo a cuerpo ya pegan, en `src/armas-creadas.js`. Al
  crearlas van a la mano (se quitó la fregona provisional) y en el inventario se cambian con "Ponérmela". Efectos y
  números provisionales en `CREADAS` y `EFECTOS`; sangrar y veneno afectan también a los jefes, aturdir y fuego no.
- **D2 (19 oct, con visto bueno):** las 4 a distancia ya disparan, en `src/armas-creadas.js` (`CREADAS`). Van al hueco de fuego (lo que llevaba pasa al inventario con su munición, `guardarArma(w, ammo)`). Lanzallamas (40 de depósito, chorro de 170), súpersoplete (12, cono de 100) y desintegrador (50, chorro de 220 + charco de ácido) usan `mag`/`reload` como depósito y sueltan gotas que atraviesan; el bumerán (`sinMunicion`) sale a 300, vuelve a la mano y hiere en la ida y la vuelta. Números provisionales. Prueba: sección 9 de `tools/prueba.mjs`.
