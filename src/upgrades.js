// ─────────────────────────────────────────────
//  Mejoras: cartas, tienda, hoguera y Taller
// ─────────────────────────────────────────────
import { MAX_ALLIES } from './config.js';

const canRecruit = (g) => g.allies.length < MAX_ALLIES;

// Cartas que aparecen al superar salas o abrir cofres
export const CARDS = [
  { id: 'fuerza',   icon: '💪', name: 'Fuerza',          desc: '+25% de daño',                         rarity: 'common', apply: (g) => { g.stats.damage *= 1.25; } },
  { id: 'cadencia', icon: '⚡', name: 'Gatillo rápido',  desc: '+20% velocidad de disparo',            rarity: 'common', apply: (g) => { g.stats.fireRate *= 1.2; } },
  { id: 'botas',    icon: '👟', name: 'Zapatillas',      desc: '+12% velocidad de movimiento',         rarity: 'common', apply: (g) => { g.stats.speed *= 1.12; } },
  { id: 'corazon',  icon: '❤️', name: 'Corazón grande',  desc: '+20 vida máxima y te cura 20',         rarity: 'common', apply: (g) => { g.stats.maxHp += 20; g.healPlayer(20); } },
  { id: 'iman',     icon: '🧲', name: 'Imán',            desc: '+60% radio para recoger monedas',      rarity: 'common', apply: (g) => { g.stats.magnet *= 1.6; } },
  { id: 'alcance',  icon: '🔭', name: 'Catalejo',        desc: '+20% de alcance de disparo',           rarity: 'common', apply: (g) => { g.stats.range *= 1.2; g.stats.bulletSpeed *= 1.15; } },
  { id: 'critico',  icon: '🎯', name: 'Ojo de halcón',   desc: '+10% de probabilidad de crítico (x2)', rarity: 'rare',   apply: (g) => { g.stats.crit += 0.1; } },
  { id: 'perfora',  icon: '🗡️', name: 'Perforante',      desc: 'Tus balas atraviesan +1 enemigo',      rarity: 'rare',   apply: (g) => { g.stats.pierce += 1; } },
  { id: 'vampiro',  icon: '🧛', name: 'Colmillos',       desc: 'Te curas 2 por cada enemigo eliminado', rarity: 'rare',  apply: (g) => { g.stats.lifesteal += 2; } },
  { id: 'fichaje',  icon: '🐣', name: 'Nuevo fichaje',   desc: 'Un compañero se une a tu equipo',      rarity: 'rare',   canAppear: canRecruit, apply: (g) => { g.addAlly(); } },
  { id: 'entreno',  icon: '📣', name: 'Capitán',         desc: '+40% de daño de tu equipo',            rarity: 'rare',   canAppear: (g) => g.allies.length > 0, apply: (g) => { g.stats.teamDamage *= 1.4; } },
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

const PRICE = { common: 15, rare: 25, epic: 40 };

export function makeShopOffers(g) {
  const cards = rollCards(g, 2, 0.6).map((c) => ({ ...c, price: PRICE[c.rarity] }));
  return [
    { id: 'comida', icon: '🍗', name: 'Muslito', desc: 'Cura 40 de vida', rarity: 'common', price: 10, apply: (g) => g.healPlayer(40) },
    { id: 'recluta', icon: '🤝', name: 'Fichar compañero', desc: 'Un aliado se une a tu equipo', rarity: 'rare', price: 25 + g.allies.length * 10, canBuy: canRecruit, apply: (g) => g.addAlly() },
    ...cards,
  ].map((o) => ({ ...o, sold: false }));
}

export function restOptions(g) {
  const opts = [
    { id: 'siesta', icon: '😴', name: 'Siesta', desc: 'Recupera el 50% de tu vida', rarity: 'common', apply: (g) => g.healPlayer(Math.round(g.stats.maxHp * 0.5)) },
    { id: 'entrenar', icon: '🏋️', name: 'Entrenar', desc: '+15% de daño para ti y tu equipo', rarity: 'common', apply: (g) => { g.stats.damage *= 1.15; g.stats.teamDamage *= 1.15; } },
  ];
  if (canRecruit(g)) opts.push({ id: 'amigos', icon: '🐣', name: 'Hacer amigos', desc: 'Un nuevo compañero se une', rarity: 'rare', apply: (g) => g.addAlly() });
  return opts;
}

// ═════════════ Progreso permanente (Taller) ═════════════
export const META = [
  { id: 'vida',   icon: '❤️', name: 'Más vida',            desc: '+15 de vida máxima inicial', max: 5, cost: (l) => 3 + l * 3 },
  { id: 'fuerza', icon: '💪', name: 'Más fuerza',          desc: '+10% de daño inicial',       max: 5, cost: (l) => 4 + l * 4 },
  { id: 'bolsa',  icon: '👛', name: 'Bolsa de monedas',    desc: '+15 monedas al empezar',     max: 3, cost: (l) => 5 + l * 5 },
  { id: 'amigo',  icon: '🐣', name: 'Amigo de la infancia', desc: 'Empiezas con un compañero', max: 1, cost: () => 15 },
];

export function buyMeta(save, id) {
  const m = META.find((x) => x.id === id);
  const lvl = save.upgrades[id] || 0;
  if (!m || lvl >= m.max) return false;
  const c = m.cost(lvl);
  if (save.gems < c) return false;
  save.gems -= c;
  save.upgrades[id] = lvl + 1;
  return true;
}

// Estadísticas iniciales de cada partida
export function baseStats(save) {
  const u = save.upgrades;
  return {
    maxHp: 100 + 15 * u.vida,
    damage: 10 * (1 + 0.1 * u.fuerza),
    fireRate: 2.2,       // disparos por segundo
    speed: 215,
    shots: 1,
    pierce: 0,
    crit: 0.05,
    magnet: 90,
    range: 430,
    bulletSpeed: 560,
    teamDamage: 1,
    lifesteal: 0,
  };
}

export const startCoins = (save) => 15 * save.upgrades.bolsa;
