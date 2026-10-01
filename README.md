# 🟡 Blob Quest

Mini **roguelike de salas** para navegador, con vista desde arriba y estilo *cartoon*
(formas redondas, contorno grueso, colores planos). Hecho con **HTML5 Canvas + JavaScript puro**,
sin librerías ni paso de compilación: ideal para aprender.

## 🎮 Cómo se juega

- **Moverse:** `WASD` o flechas (en móvil: arrastra en la mitad izquierda de la pantalla)
- **Esquivar:** `Espacio` (en móvil: botón 💨). Te hace invulnerable un instante.
- **Disparar:** ¡automático! Tú y tu equipo disparáis al enemigo más cercano.
- **Pausa:** `Esc` o `P`

Cada partida tiene **10 salas**. Al limpiar una sala eliges **1 de 3 mejoras** y después
**qué puerta cruzar**:

| Sala | Qué hay |
|------|---------|
| ⚔️ Combate | Oleadas de enemigos → monedas + carta de mejora |
| 💀 Élite | Enemigos más duros (aura dorada) → más botín y cartas mejores |
| 🎁 Tesoro | Un cofre con monedas, una gema y una carta |
| 🛒 Tienda | Gasta monedas en comida, mejoras o **fichar compañeros** |
| 🔥 Hoguera | Descansar, entrenar o hacer un nuevo amigo |
| 👑 Jefe | El Rey Gelatina (sala 10) |

### Recursos
- 🪙 **Monedas**: solo valen durante la partida (tienda).
- 💎 **Gemas**: se guardan **para siempre** (en el navegador). Úsalas en el **Taller** del menú
  para mejoras permanentes: más vida, más daño, monedas iniciales o empezar con un compañero.
- 👥 **Equipo**: hasta 4 compañeros que orbitan a tu alrededor y disparan contigo.

## 🚀 Ejecutar en local

Los módulos de JavaScript (`import`) necesitan un servidor; abrir `index.html` con doble clic no funciona.

```bash
npm run dev          # usa "npx serve" → http://localhost:3000
# o bien
python3 -m http.server 3000
```

## ☁️ Publicar en Vercel

Es un sitio 100 % estático, así que no hace falta configurar nada:

1. Sube este repositorio a GitHub (ya lo está).
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repo `game`.
3. Configuración:
   - **Framework Preset:** `Other`
   - **Build Command:** *(vacío)*
   - **Output Directory:** *(vacío / raíz)*
4. **Deploy**. Cada `git push` volverá a publicar automáticamente.

Alternativa por terminal: `npx vercel` (y `npx vercel --prod` para producción).

## 🗂️ Estructura del código

```
index.html        → página, HUD y capas de menús
style.css         → estilo cartoon de botones, cartas y paneles
src/
  main.js         → arranque y bucle principal (update + render)
  game.js         → flujo de la partida: salas, oleadas, recompensas, colisiones
  entities.js     → jugador, compañeros y enemigos (comportamiento + dibujo)
  rooms.js        → generación de salas, oleadas y puertas
  upgrades.js     → cartas, tienda, hoguera y mejoras permanentes (Taller)
  render.js       → dibujo del escenario: suelo, muros, puertas, cofres...
  draw.js         → ayudas de dibujo: "blobs", ojos, sombras, texto con contorno
  ui.js           → menús en HTML (cartas, tienda, pausa, HUD)
  input.js        → teclado + joystick táctil
  sfx.js          → sonidos generados con Web Audio (sin archivos)
  save.js         → guardado en localStorage
  config.js       → constantes y colores
```

### Ideas fáciles para empezar a modificar
- **Nuevo enemigo:** añádelo en `ENEMY_TYPES` (`entities.js`), dale un `case` en `update()` y en `draw()`,
  y mételo en el `pool` de `makeWaves()` (`rooms.js`).
- **Nueva carta de mejora:** una línea más en `CARDS` (`upgrades.js`).
- **Más salas o más difícil:** `TOTAL_ROOMS` en `config.js` y el presupuesto de `makeWaves()`.
- **Nuevo bioma:** añade colores en `BIOMES` (`config.js`).

En la consola del navegador tienes `window.game` para trastear (p. ej. `game.coins = 999`).
