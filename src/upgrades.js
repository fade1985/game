// ─────────────────────────────────────────────
//  Atributos del jugador y cartas de mejora
//  (las cartas se reutilizarán de forma provisional en la sala de objeto, fase 2)
// ─────────────────────────────────────────────
import { MAX_ALLIES } from './config.js';

export const CARDS = [
  { id: 'fuerza',   icon: '💪', name: 'Fuerza',          desc: '+25% de daño',                         rarity: 'common', apply: (g) => { g.stats.damage *= 1.25; } },
  { id: 'cadencia', icon: '⚡', name: 'Gatillo rápido',  desc: '+20% velocidad de ataque',             rarity: 'common', apply: (g) => { g.stats.fireRate *= 1.2; } },
  { id: 'botas',    icon: '👟', name: 'Zapatillas',      desc: '+12% velocidad de movimiento',         rarity: 'common', apply: (g) => { g.stats.speed *= 1.12; } },
  { id: 'corazon',  icon: '❤️', name: 'Corazón grande',  desc: '+20 vida máxima y te cura 20',         rarity: 'common', apply: (g) => { g.stats.maxHp += 20; g.healPlayer(20); } },
  { id: 'alcance',  icon: '🔭', name: 'Catalejo',        desc: '+20% de alcance',                      rarity: 'common', apply: (g) => { g.stats.range *= 1.2; g.stats.bulletSpeed *= 1.15; } },
  { id: 'critico',  icon: '🎯', name: 'Ojo de halcón',   desc: '+10% de probabilidad de crítico (x2)', rarity: 'rare',   apply: (g) => { g.stats.crit += 0.1; } },
  { id: 'perfora',  icon: '🗡️', name: 'Perforante',      desc: 'Tus balas atraviesan +1 enemigo',      rarity: 'rare',   apply: (g) => { g.stats.pierce += 1; } },
  { id: 'vampiro',  icon: '🧛', name: 'Colmillos',       desc: 'Te curas 2 por cada enemigo eliminado', rarity: 'rare',  apply: (g) => { g.stats.lifesteal += 2; } },
  { id: 'multi',    icon: '🔱', name: 'Multidisparo',    desc: '+1 proyectil por disparo',             rarity: 'epic',   apply: (g) => { g.stats.shots += 1; } },
];

export const RARITY_LABEL = { common: 'Común', rare: 'Rara', epic: 'Épica' };

// Saca n cartas al azar sin repetir. `luck` aumenta la probabilidad de rarezas.
export function rollCards(g, n = 3, luck = 0) {
  const weight = { common: 10, rare: 3.5 + luck * 3, epic: 1 + luck * 2 };
  const avail = CARDS.filter((c) => !c.canAppear || c.canAppear(g));
  const out = [];
  while (out.length < n && avail.length) {
    const total = avail.reduce((s, c) => s + weight[c.rarity], 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < avail.length - 1; i++) {
      r -= weight[avail[i].rarity];
      if (r <= 0) break;
    }
    out.push(avail.splice(i, 1)[0]);
  }
  return out;
}

// Estadísticas iniciales al empezar un edificio
export function baseStats() {
  return {
    maxHp: 100,
    damage: 10,
    fireRate: 2.2,       // ataques por segundo
    speed: 210,
    shots: 1,
    pierce: 0,
    crit: 0.05,
    magnet: 120,         // radio en el que los corazones vienen hacia ti
    range: 430,
    bulletSpeed: 560,
    teamDamage: 1,
    lifesteal: 0,
    maxAllies: MAX_ALLIES,
  };
}
