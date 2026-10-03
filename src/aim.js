// ─────────────────────────────────────────────
//  Controlador de apuntado
//
//  Decide hacia dónde mira el arma y cuándo atacar. Hoy es automático
//  (apunta al enemigo más cercano). Para el ataque manual crearemos otro
//  controlador con la misma función `aim()` (leyendo ratón o flechas) y
//  se lo daremos al jugador: el resto del juego no tendrá que cambiar.
// ─────────────────────────────────────────────

const LOOK_RANGE = 360; // a qué distancia empieza a mirar a un enemigo con arma cuerpo a cuerpo

export const autoAim = {
  // Devuelve { angle, attack } o null si no hay a quién apuntar
  aim(game, player, weapon, stats) {
    const range = weapon.type === 'melee' ? LOOK_RANGE : weapon.range * stats.range;
    const target = game.nearestEnemy(player.x, player.y, range);
    if (!target) return null;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    const gap = Math.hypot(target.x - player.x, target.y - player.y) - target.r;
    const attack = weapon.type === 'melee' ? gap <= weapon.reach * stats.range : true;
    return { angle, attack };
  },
};
