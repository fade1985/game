# Zombis en pixel art

Sacado de CLAUDE.md el 13 de octubre de 2026. Receta para hacer uno nuevo: skill `/zombi-nuevo`
(`.claude/skills/zombi-nuevo/SKILL.md`). Aquí, el estado y las notas de cada zombi.

Empezado el 12 de octubre de 2026. Se hace como las armas: un zombi de piloto (el normal) hasta verlo en el
juego y luego una skill `/zombi-nuevo` para los otros cinco. Ids, textos y costes en `assets/pixellab.json`
(`zombi-normal-48`).

- **Decidido por el dueño:** diseños inventados (no tiene dibujos), realistas y con el estilo de Johnny, a 48
  píxeles. Cada zombi lleva cuatro animaciones: andar, atacar, recibir golpe y morir.
- **Modelo del zombi normal: con visto bueno.** PixelLab saca la piel beige aunque se pida verde (pasó también
  con el venenoso): se corrige gratis con `py tools/piel.py <sprite>` y las 8 vistas corregidas se importan como
  personaje nuevo (`create_character` en modo `v3` con `direction_images`, 0,25 generaciones).
- **El zombi normal ya está en el juego** (sprite `zombi-normal`, a 48 píxeles): reposo, andar, zarpazo, golpe
  recibido y muerte en las 8 direcciones. Costó unas 43 generaciones. **Con el visto bueno final del dueño (13 de octubre de 2026)**
  (captura en `assets/pruebas/zombi-normal-en-juego.jpg`, GIF de cada animación en `assets/pruebas/zombi-normal-*.gif`).
  - **Cómo se monta:** `py tools/zombi.py zombi-normal-48 zombi-normal` rehace la hoja (casillas de 96×96) a partir
    de `assets/sources/zombi-normal-48/` (`rotations/`, `walk/`, `ataque/`, `golpe/`, `muerte/`). Oscurece la sangre
    de rojo vivo que mete PixelLab (decisión del dueño: sangre sí, pero apagada), quita los destellos y elige solo
    el tramo del andar que hace ciclo.
  - **En el juego** (todo en `zombies.js`): el zarpazo se ve al llegar al conserje pero el daño sigue siendo por
    contacto, como antes; al recibir un golpe se ve `hurt`; al morir deja un cuerpo (`Corpse`) que cae y se queda
    tendido en la sala (12 como mucho por sala). Vale para cualquier zombi cuya hoja tenga `attack`, `hurt` y `death`.
  - **Pegas conocidas:** de frente y de espaldas anda con los brazos bajos y en las otras direcciones con los
    brazos estirados (con el texto común se giraba de perfil); el ciclo de andar no cierra del todo limpio.
  - **Limpieza pendiente en PixelLab (solo con su confirmación):** el personaje de piel beige, el andar de
    plantilla y los cuatro andares descartados.
  - **Siguiente:** skill `/zombi-nuevo` creada (`.claude/skills/zombi-nuevo/SKILL.md`). Faltan rápido,
    explosivo, tentáculos y venenoso (este último, rehacerlo: salió con la piel beige).
- **El zombi lento ya está en el juego** (sprite `zombi-lento`), **con el visto bueno final del dueño (13 de
  octubre de 2026).** Diseño suyo: partido por la mitad, solo torso y brazos, se arrastra con las manos. Costó unas
  52 generaciones (6 de un primer modelo descartado, que salió con piernas de espaldas). Ids, textos y pegas en
  `assets/pixellab.json` (`zombi-lento-48`); captura en `assets/pruebas/zombi-lento-en-juego.jpg` y GIF en
  `assets/pruebas/zombi-lento-*.gif`.
  - **Cómo se monta:** `py tools/zombi.py zombi-lento-48 zombi-lento`, con `assets/sources/zombi-lento-48/zombi.json`
    (opciones nuevas de `tools/zombi.py`: `cintura`, `pies` y `ataque.sangre`; el andar usa los 12 fotogramas).
  - **Rastro de sangre** (lo pidió el dueño): al arrastrarse deja manchas en el suelo que se secan a los 8
    segundos. Lo hace el juego, no el sprite: `dropTrail` y `drawTrail` en `game.js` (constante `TRAIL`).
    Captura en `assets/pruebas/zombi-lento-rastro.jpg`.
  - **Piel:** piel y camisa salieron del mismo beige y `tools/piel.py` teñía las dos; este zombi tiene su propio
    script, `assets/sources/zombi-lento-48/piel.py`.
  - **Pegas conocidas:** el dibujo se ve bajo de frente y largo de espaldas. El choque sigue siendo el de siempre (`r: 17` en `ZOMBIE_TYPES`).
  - Los dos personajes de modelo que no se usaban ya están borrados de PixelLab (con su confirmación) y la muerte
    hacia la izquierda se repitió para quitarle un charco de sangre (la antigua, en `descartes/muerte/`).
- **Zombi venenoso (el gordo), más grande** (13 de octubre de 2026, lo pidió el dueño: medía lo mismo que Johnny y
  no imponía). Su dibujo se amplía ×1,5 en el juego (`spriteScale` en `ZOMBIE_TYPES`, `src/zombies.js`): unos 68
  píxeles de alto (primero se probó ×1,25 y al dueño le seguía pareciendo como Johnny). Es un apaño gratis: los píxeles quedan algo más gordos que los del resto. El choque (`r: 16`)
  no se ha tocado. Comparación en `assets/pruebas/venenoso-tamanos.png`, captura en
  `assets/pruebas/zombis-tamanos-en-juego.jpg`. Sigue pendiente rehacerlo entero (solo tiene el dibujo quieto,
  piel beige y sin contorno negro): al hacerlo, pedirlo ya grande, en lienzo de 64.
- **Zombi lento, un poco más pequeño** (13 de octubre de 2026, lo pidió el dueño): su dibujo se encoge a ×0,85
  (`spriteScale`), también el cuerpo que deja al morir. El choque (`r: 17`) no se ha tocado.
