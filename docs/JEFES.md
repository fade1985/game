# Dinámicas de los jefes (diseño del dueño, 20 de octubre de 2026)

Guardado para el futuro: **todavía no se hace nada de esto**. Según el dueño, de momento solo se puede hacer lo de la portera (los otros tres jefes aún no tienen sprite). Cuando toque, contar el plan al dueño y preguntar.
Lo ya hecho de la portera está en [`ZOMBIS.md`](ZOMBIS.md) (al final) y en `src/jefe-portera.js`.

## 1. La portera

**Fase 1**
- Lanza charcos de ácido con la fregona que hacen daño y envenenan (daño en el tiempo).
- Se acerca rápidamente y termina con un fregonazo en área.
- Grita para llamar a **2 zombis** que la ayudan.

**Fase 2**
- Lanza el doble de charcos.
- Hace hasta **2 embestidas seguidas** con fregonazo en área.
- Llama a **4 zombis**.

## 2. El Glotón

**Fase 1**
- Se mueve lentamente porque su cabeza es más grande que su cuerpo.
- De su enorme boca salen lenguas que usa como látigos y hacen daño si te alcanzan.
- Durante **5 segundos** intenta aspirarte para comerte. Si te toca, hace mucho daño.
- Cada vez que le das un disparo o un golpe cuerpo a cuerpo, suelta sangre ácida que te hace un **1 % de daño**.

**Fase 2**
- Usa el doble de lenguas.
- Duplica la fuerza de aspiración.
- Su sangre ácida te hace un **2 % de daño por cada golpe que le des**.

## 3. El Gymbro

**Fase 1**
- Embiste con los brazos abiertos, formando un torbellino a su paso.
- Salta e intenta caer encima del jugador.
- Lanza pesas como proyectiles.

**Fase 2**
- Toma suplementos que le dan una **barra de armadura**. Mientras dure, solo recibe el **50 % del daño**.
- Hace hasta **2 torbellinos seguidos** hacia el jugador.
- El salto dura la mitad.
- Lanza el doble de pesas.

## 4. El jefe de bomberos

**Fase 1**
- Su traje ignífugo lo protege del fuego que lo rodea.
- Lanza bolas de fuego que hacen daño al darte y daño en el tiempo.
- Se coloca en el centro de la sala y gira con un lanzallamas. Sus llamas hacen daño al darte y daño en el tiempo.
- Lanza cócteles molotov que dejan charcos de fuego. Pisarlos hace daño al entrar y daño en el tiempo.

**Fase 2**
- Lanza el doble de bolas de fuego.
- Saca el doble de lenguas de fuego durante su giro.
- Deja el doble de charcos de fuego.

## Notas de Claude para cuando se haga (preguntar al dueño)

- **Portera:** ahora tira lejía (charco sin veneno), un abanico de agua sucia, un torbellino con la escoba
  (fase 2) y solo llama zombis en la fase 2 (2). El diseño no tiene abanico ni torbellino: ¿se quitan o se
  quedan? El veneno ya existe en `src/estados.js`. La embestida puede usar su animación de andar, más rápida.
- **Dónde sale cada jefe:** hoy la portera es la mini jefa de todas las plantas y también la final. Decidir si va
  uno por planta, al azar, o alguno solo como jefe final.
- **Glotón:** con armas rápidas (MP5) el 1–2 % por golpe sube mucho; quizá limitar a un salpicón cada medio
  segundo. ¿El % es de la vida máxima de Johnny?
- **Gymbro:** la armadura, como una segunda barra encima de la de vida.
- **Bombero:** inmune al fuego, así que molotov, bate de fuego y lanzallamas no le sirven (obliga a cambiar de arma).
- Cada jefe nuevo necesita sprite de 96 px en PixelLab (decir el coste antes) y su archivo `src/jefe-*.js`
  (lo común está en `jefe-base.js`). Una sesión por jefe.
