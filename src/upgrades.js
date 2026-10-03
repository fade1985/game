// ─────────────────────────────────────────────
//  Atributos del jugador y objetos de las salas de objeto
// ─────────────────────────────────────────────

// Objetos que aparecen en los pedestales. Para añadir uno nuevo, copia una
// línea: `apply` recibe el juego y modifica sus atributos (g.stats).
export const ITEMS = [
  { id: 'zapatillas', icon: '👟', name: 'Zapatillas', desc: '+15% de velocidad de movimiento',     apply: (g) => { g.stats.speed *= 1.15; } },
  { id: 'proteinas',  icon: '🥤', name: 'Proteínas',  desc: '+20% de daño',                        apply: (g) => { g.stats.damage *= 1.2; } },
  { id: 'botiquin',   icon: '🩹', name: 'Botiquín',   desc: '+25 de vida máxima (y te cura 25)',   apply: (g) => { g.stats.maxHp += 25; g.healPlayer(25); } },
  { id: 'cafe',       icon: '☕', name: 'Café',       desc: '+20% de velocidad de ataque',         apply: (g) => { g.stats.fireRate *= 1.2; } },
  { id: 'guantes',    icon: '🧤', name: 'Guantes',    desc: '+25% de alcance cuerpo a cuerpo',     apply: (g) => { g.stats.meleeRange *= 1.25; } },
  { id: 'casco',      icon: '⛑️', name: 'Casco',      desc: 'Recibes un 15% menos de daño',        apply: (g) => { g.stats.damageTaken *= 0.85; } },
];

// Elige un objeto que todavía no haya salido en esta partida (si ya salieron
// todos, puede repetirse alguno)
export function rollItem(seen) {
  const fresh = ITEMS.filter((it) => !seen.has(it.id));
  const pool = fresh.length ? fresh : ITEMS;
  const item = pool[Math.floor(Math.random() * pool.length)];
  seen.add(item.id);
  return item;
}

// Estadísticas iniciales al empezar un edificio
export function baseStats() {
  return {
    // Los atributos de ataque son multiplicadores sobre el arma que lleves
    maxHp: 100,
    damage: 1,           // x daño del arma
    fireRate: 1,         // x velocidad de ataque del arma
    range: 1,            // x alcance del arma
    meleeRange: 1,       // x alcance extra de las armas cuerpo a cuerpo
    bulletSpeed: 1,      // x velocidad de las balas
    shots: 0,            // proyectiles extra (armas a distancia)
    pierce: 0,
    crit: 0.05,
    damageTaken: 1,      // x daño que recibes (menos es mejor)
    speed: 210,
    magnet: 120,         // radio en el que los corazones vienen hacia ti
    teamDamage: 1,
    lifesteal: 0,
  };
}
