// ─────────────────────────────────────────────
//  Interfaz en HTML: menús, cartas, pausa y HUD
// ─────────────────────────────────────────────
import { RARITY_LABEL } from './upgrades.js';
import { toggleMute } from './sfx.js';

export function createUI(root) {
  const overlay = root.querySelector('#overlay');
  const hud = root.querySelector('#hud');
  const $ = (sel) => hud.querySelector(sel);
  let actions = {};
  let keyHandler = null;

  overlay.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled && actions[el.dataset.act]) actions[el.dataset.act](el.dataset.arg);
  });
  window.addEventListener('keydown', (e) => {
    if (!keyHandler) return;
    e.uiHandled = true; // así main.js sabe que esta tecla ya la gestionó un menú
    keyHandler(e);
  });

  function open(html, acts = {}, keys = null, cls = '') {
    overlay.className = `overlay ${cls}`;
    overlay.innerHTML = html;
    overlay.hidden = false;
    actions = acts;
    keyHandler = keys;
  }

  function hide() {
    overlay.hidden = true;
    overlay.innerHTML = '';
    actions = {};
    keyHandler = null;
  }

  const cardHTML = (c, i, extra = '') => `
    <button class="card ${c.rarity || 'common'}" data-act="pick" data-arg="${i}" style="--i:${i}">
      <div class="rar">${RARITY_LABEL[c.rarity || 'common']}</div>
      <div class="icon">${c.icon}</div>
      <div class="name">${c.name}</div>
      <div class="desc">${c.desc}</div>
      ${extra}
    </button>`;

  // ═════════════ HUD ═════════════
  const cache = {};
  function set(key, el, value, prop = 'textContent') {
    if (cache[key] === value) return;
    cache[key] = value;
    if (prop === 'width') el.style.width = value;
    else el[prop] = value;
  }

  $('#btn-mute').addEventListener('click', (e) => {
    e.currentTarget.textContent = toggleMute() ? '🔇' : '🔊';
    e.currentTarget.blur();
  });

  return {
    hide,

    showHud(show) {
      hud.hidden = !show;
      for (const k in cache) delete cache[k];
    },

    updateHud(g) {
      const p = g.player;
      set('hpw', $('.hpbar .fill'), `${Math.max(0, (p.hp / g.stats.maxHp) * 100)}%`, 'width');
      set('hpt', $('.hpbar span'), `${Math.ceil(p.hp)} / ${Math.round(g.stats.maxHp)}`);
      set('team', $('#hud-team'), String(g.allies.length));
      set('teamShow', $('#pill-team'), g.allies.length === 0, 'hidden');
    },

    // ═════════════ Pantallas ═════════════
    showMenu(save, { play }) {
      open(`
        <div class="menu">
          <h1 class="logo"><span class="l1">BLOB</span><span class="l2">QUEST</span></h1>
          <p class="tagline">Limpia el edificio de zombis, planta a planta</p>
          <div class="col">
            <button class="btn yellow big" data-act="play">▶ JUGAR</button>
          </div>
          <div class="hint panel small">
            <b>Moverse:</b> WASD / flechas · <b>Esquivar:</b> Espacio<br>
            Atacas solo al enemigo más cercano. ¡Limpia cada sala para abrir sus puertas!
          </div>
          ${save.bestFloor ? `<div class="record">🏆 Mejor planta alcanzada: ${save.bestFloor}</div>` : ''}
        </div>`,
      { play },
      (e) => { if (e.code === 'Enter') play(); },
      'clear');
    },

    showCards(cards, title, onPick) {
      const picked = (i) => { if (cards[i]) onPick(cards[i]); };
      open(`
        <h2 class="title">${title}</h2>
        <div class="cards">${cards.map((c, i) => cardHTML(c, i, `<kbd>${i + 1}</kbd>`)).join('')}</div>`,
      { pick: (i) => picked(Number(i)) },
      (e) => { const n = Number(e.key); if (n >= 1 && n <= cards.length) picked(n - 1); });
    },

    showPause(g, { resume, quit }) {
      const s = g.stats;
      const stat = (icon, name, val) => `<div class="stat"><span>${icon} ${name}</span><b>${val}</b></div>`;
      open(`
        <div class="panel pause">
          <h2 class="title">Pausa</h2>
          <p class="sub">${g.building.icon} ${g.building.name} · Planta ${g.floorNum}</p>
          <div class="stats">
            ${stat('❤️', 'Vida', `${Math.ceil(g.player.hp)} / ${Math.round(s.maxHp)}`)}
            ${stat('💪', 'Daño', s.damage.toFixed(1))}
            ${stat('⚡', 'Ataques/seg', s.fireRate.toFixed(2))}
            ${stat('👟', 'Velocidad', Math.round(s.speed))}
            ${stat('🎯', 'Crítico', `${Math.round(s.crit * 100)}%`)}
            ${stat('👥', 'Equipo', g.allies.length)}
          </div>
          <div class="col">
            <button class="btn yellow" data-act="resume">▶ Continuar</button>
            <button class="btn pink small" data-act="quit">Abandonar partida</button>
          </div>
        </div>`,
      { resume, quit },
      (e) => { if (e.code === 'Escape' || e.code === 'KeyP') resume(); });
    },

    showEnd(r, { retry, menu }) {
      open(`
        <div class="panel end ${r.win ? 'win' : 'lose'}">
          <h2 class="title">${r.title}</h2>
          <p class="sub">${r.sub}</p>
          <div class="stats">
            <div class="stat"><span>🧟 Enemigos derrotados</span><b>${r.kills}</b></div>
            <div class="stat"><span>🗺️ Salas exploradas</span><b>${r.explored}</b></div>
          </div>
          <div class="col">
            <button class="btn yellow big" data-act="retry">↻ ${r.win ? 'Otra planta' : 'Reintentar'}</button>
            <button class="btn blue small" data-act="menu">Menú principal</button>
          </div>
        </div>`,
      { retry, menu },
      (e) => { if (e.code === 'Enter') retry(); });
    },
  };
}
