// ─────────────────────────────────────────────
//  Armas: datos y dibujo
//
//  Cada arma es solo un objeto de datos. Para añadir una nueva basta con
//  copiar una entrada, cambiar los números y darle un dibujo en drawWeapon().
//    type     'melee' (cuerpo a cuerpo) o 'ranged' (a distancia)
//    damage   daño por golpe (o por proyectil)
//    rate     ataques por segundo
//    reach    alcance del golpe (melee) · range: alcance de la bala (ranged)
//    arc      apertura del barrido en grados (melee)
//    knock    fuerza del empuje (1 = normal)
// ─────────────────────────────────────────────
import { OUTLINE } from './config.js';

export const WEAPONS = {
  fregona: {
    id: 'fregona', name: 'Fregona', icon: '🧹', type: 'melee',
    damage: 8, rate: 1.8, reach: 62, arc: 140, knock: 2.0, trail: '#3fb5ec',
  },
  bate: {
    id: 'bate', name: 'Bate', icon: '🏏', type: 'melee',
    damage: 16, rate: 1.6, reach: 66, arc: 110, knock: 1.5, trail: '#ffb347',
  },
  cuchillo: {
    id: 'cuchillo', name: 'Cuchillo', icon: '🔪', type: 'melee',
    damage: 9, rate: 4, reach: 46, arc: 60, knock: 0.5, trail: '#c9b6ff',
  },
  pistola: {
    id: 'pistola', name: 'Pistola', icon: '🔫', type: 'ranged',
    damage: 10, rate: 2.5, range: 420, speed: 620, pellets: 1, spread: 0, knock: 0.8, muzzle: 24,
  },
  escopeta: {
    id: 'escopeta', name: 'Escopeta', icon: '💥', type: 'ranged',
    damage: 7, rate: 1, range: 260, speed: 540, pellets: 5, spread: 0.55, knock: 1.2, muzzle: 38,
  },
};

// Arma al azar (para los botines), evitando la fregona y la que ya llevas
export function randomWeapon(exclude) {
  const pool = Object.values(WEAPONS).filter((w) => w.id !== 'fregona' && w.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Texto corto con las características de un arma
export function weaponSummary(w) {
  const kind = w.type === 'melee' ? 'Cuerpo a cuerpo' : 'A distancia';
  const dmg = w.pellets > 1 ? `${w.damage} × ${w.pellets}` : w.damage;
  return `${kind} · Daño ${dmg} · ${w.rate} ataques/s`;
}

// Dibuja el arma con la empuñadura en (0, 0) apuntando hacia +x.
// Quien llama hace translate/rotate antes.
export function drawWeapon(ctx, w) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  switch (w.id) {
    case 'fregona': {
      // palo
      ctx.beginPath(); ctx.roundRect(-6, -2.5, 52, 5, 2.5);
      ctx.fillStyle = '#4f86f7'; ctx.fill(); ctx.stroke();
      // cabezal de tiras
      ctx.beginPath(); ctx.ellipse(50, 0, 9, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#eef1f8'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(29,27,44,0.35)'; ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(45, i * 4.5); ctx.lineTo(57, i * 5); ctx.stroke();
      }
      ctx.beginPath(); ctx.roundRect(42, -6, 6, 12, 2);
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      break;
    }
    case 'bate': {
      ctx.beginPath();
      ctx.moveTo(-6, -2.5); ctx.lineTo(44, -6); ctx.quadraticCurveTo(52, 0, 44, 6); ctx.lineTo(-6, 2.5); ctx.closePath();
      ctx.fillStyle = '#e0a868'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b3550';
      ctx.fillRect(-4, -2.5, 12, 5);
      break;
    }
    case 'cuchillo': {
      ctx.beginPath(); ctx.roundRect(-5, -3, 14, 6, 2);
      ctx.fillStyle = '#5b3a29'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, -4); ctx.lineTo(30, -1); ctx.lineTo(9, 4); ctx.closePath();
      ctx.fillStyle = '#dfe4ef'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'pistola': {
      ctx.beginPath(); ctx.roundRect(-4, -4, 26, 8, 2);
      ctx.fillStyle = '#4a4e5c'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-2, 2, 7, 9, 2);
      ctx.fillStyle = '#2f3240'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'escopeta': {
      ctx.beginPath(); ctx.roundRect(-8, -4, 18, 9, 3);
      ctx.fillStyle = '#8b5a3c'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(8, -3.5, 32, 7, 2);
      ctx.fillStyle = '#4a4e5c'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(14, 2, 12, 5, 2);
      ctx.fillStyle = '#a06a45'; ctx.fill(); ctx.stroke();
      break;
    }
  }
}
