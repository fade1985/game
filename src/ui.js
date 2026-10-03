// ─────────────────────────────────────────────
//  Interfaz en HTML: menús, cartas, pausa y HUD
// ─────────────────────────────────────────────
import { weaponSummary } from './weapons.js';
import { toggleMute } from './sfx.js';
import { loadSave } from './save.js';

// Pantalla completa (solo en móviles que la permiten; en iPhone no existe)
const canFullscreen = () => document.body.classList.contains('touch') && document.fullscreenEnabled && !document.fullscreenElement;
function goFullscreen() {
  document.documentElement.requestFullscreen?.()
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => { /* el navegador no lo permite */ });
}

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
      const w = g.player.weapon;
      set('weapon', $('#pill-weapon'), `${w.icon} <b>${w.name}</b>`, 'innerHTML');
      set('team', $('#hud-team'), g.allies.map((al) => al.def.icon).join(''));
      set('teamShow', $('#pill-team'), g.allies.length === 0, 'hidden');
      set('keys', $('#hud-keys'), String(g.wallet ?? 0));
    },

    // ═════════════ Pantallas ═════════════
    showMenu(save, { play, workshop }) {
      const upgrades = Object.values(save.workshop).reduce((a, b) => a + b, 0);
      open(`
        <div class="menu">
          <h1 class="logo"><span class="l1">BLOB</span><span class="l2">QUEST</span></h1>
          <p class="tagline">Limpia el edificio de zombis, planta a planta</p>
          <div class="col">
            <button class="btn yellow big" data-act="play">▶ JUGAR</button>
            ${canFullscreen() ? '<button class="btn green small" data-act="fullscreen">⛶ Pantalla completa</button>' : ''}
            <button class="btn blue" data-act="workshop">🔧 Taller <span class="keys-chip">🔑 ${save.keys}</span>${upgrades ? ` <small>· ${upgrades} mejora${upgrades > 1 ? 's' : ''}</small>` : ''}</button>
          </div>
          <div class="hint panel small">
            <b>Moverse:</b> WASD / flechas · <b>Esquivar:</b> Espacio<br>
            Atacas solo al enemigo más cercano. ¡Limpia cada sala para abrir sus puertas!
          </div>
          ${save.bestFloor ? `<div class="record">🏆 Mejor planta alcanzada: ${save.bestFloor}</div>` : ''}
        </div>`,
      { play, workshop, fullscreen: goFullscreen },
      (e) => {
        if (e.code === 'Enter') play();
        else if (e.code === 'KeyT') workshop();
      },
      'clear');
    },

    // Selector de edificios: los que aún no existen salen como "Próximamente"
    showBuildings(save, buildings, { pick, back }) {
      const cards = Object.values(buildings).map((b) => {
        if (b.soon) {
          return `
            <div class="bcard soon">
              <div class="bicon">${b.icon}</div>
              <div class="bname">${b.name}</div>
              <div class="bdesc">${b.desc}</div>
              <div class="bfoot">🔒 Próximamente</div>
            </div>`;
        }
        const p = save.buildings[b.id] || { completed: false, runs: 0, wins: 0, bestFloor: 0, bestTime: 0 };
        const time = p.bestTime ? `${Math.floor(p.bestTime / 60)}:${String(Math.floor(p.bestTime % 60)).padStart(2, '0')}` : '';
        const progress = p.completed
          ? `✅ Completado ×${p.wins}${time ? ` · ⏱️ ${time}` : ''}`
          : p.runs ? `🏆 Mejor planta: ${p.bestFloor} / ${b.floors}` : '¡Sin explorar!';
        return `
          <button class="bcard ${p.completed ? 'done' : ''}" data-act="pick" data-arg="${b.id}">
            <div class="bicon">${b.icon}</div>
            <div class="bname">${b.name}</div>
            <div class="bdesc">${b.desc}</div>
            <div class="bmeta">${b.floors} plantas · ${p.runs} intento${p.runs === 1 ? '' : 's'}</div>
            <div class="bfoot">${progress}</div>
          </button>`;
      }).join('');
      open(`
        <div class="panel picker">
          <h2 class="title">Elige edificio</h2>
          <div class="bcards">${cards}</div>
          <button class="btn blue small" data-act="back">← Volver</button>
        </div>`,
      { pick, back },
      (e) => {
        if (e.code === 'Escape') back();
        else if (e.code === 'Enter') pick('apartamentos');
      });
    },

    // Taller del conserje: mejoras permanentes que se compran con llaves
    showWorkshop(save, upgrades, { buy, back }) {
      const rows = upgrades.map((up) => {
        const lvl = save.workshop[up.id] || 0;
        const maxed = lvl >= up.max;
        const price = up.cost[lvl];
        const pips = Array.from({ length: up.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        return `
          <div class="wrow ${maxed ? 'maxed' : ''}">
            <div class="wicon">${up.icon}</div>
            <div class="winfo"><b>${up.name}</b><span>${up.desc}</span><div class="pips">${pips}</div></div>
            <button class="btn ${maxed ? 'green' : 'yellow'} small" data-act="buy" data-arg="${up.id}" ${maxed || save.keys < price ? 'disabled' : ''}>
              ${maxed ? 'MÁX' : `🔑 ${price}`}
            </button>
          </div>`;
      }).join('');
      open(`
        <div class="panel workshop">
          <h2 class="title">🔧 Taller del conserje</h2>
          <p class="sub">Las llaves 🔑 que sueltan los zombis se guardan aunque pierdas.<br>Las mejoras se aplican al empezar cada edificio.</p>
          <div class="wallet">🔑 ${save.keys} llave${save.keys === 1 ? '' : 's'}</div>
          <div class="wrows">${rows}</div>
          <button class="btn blue small" data-act="back">← Volver</button>
        </div>`,
      { buy, back },
      (e) => { if (e.code === 'Escape') back(); });
    },

    showPause(g, { resume, music, quit }) {
      const musicOn = loadSave().settings.music;
      const s = g.stats;
      const stat = (icon, name, val) => `<div class="stat"><span>${icon} ${name}</span><b>${val}</b></div>`;
      const list = (title, rows, empty) => `
        <div class="plist"><div class="plist-title">${title}</div>
          ${rows.length ? rows.map((r) => `<div class="plist-row">${r}</div>`).join('') : `<div class="plist-row empty">${empty}</div>`}
        </div>`;
      open(`
        <div class="panel pause">
          <h2 class="title">Pausa</h2>
          <p class="sub">${g.building.icon} ${g.building.name} · Planta ${g.floorNum}</p>
          <div class="pause-grid">
            <div class="stats">
              ${stat('❤️', 'Vida', `${Math.ceil(g.player.hp)} / ${Math.round(s.maxHp)}`)}
              ${stat('💪', 'Daño', `x${s.damage.toFixed(2)}`)}
              ${stat('⚡', 'Velocidad de ataque', `x${s.fireRate.toFixed(2)}`)}
              ${stat('🔭', 'Alcance', `x${(s.range * (g.player.weapon.type === 'melee' ? s.meleeRange : 1)).toFixed(2)}`)}
              ${stat('👟', 'Velocidad', Math.round(s.speed))}
              ${stat('⛑️', 'Daño recibido', `x${s.damageTaken.toFixed(2)}`)}
              ${stat('🎯', 'Crítico', `${Math.round(s.crit * 100)}%`)}
            </div>
            <div>
              ${list('🗡️ Arma', [`${g.player.weapon.icon} <b>${g.player.weapon.name}</b> · ${weaponSummary(g.player.weapon)}`], '')}
              ${list('🎒 Objetos', g.items.map((it) => `${it.icon} <b>${it.name}</b> · ${it.desc}`), 'Ninguno todavía')}
              ${list('👥 Equipo', g.allies.map((al) => `${al.def.icon} <b>${al.def.name}</b> · ${al.def.desc}`), 'Nadie todavía: ¡rescata supervivientes!')}
            </div>
          </div>
          <div class="row-btns">
            <button class="btn yellow" data-act="resume">▶ Continuar</button>
            <button class="btn blue small" data-act="music">🎵 Música: ${musicOn ? 'Sí' : 'No'}</button>
            <button class="btn pink small" data-act="quit">Abandonar partida</button>
          </div>
        </div>`,
      { resume, music, quit },
      (e) => { if (e.code === 'Escape' || e.code === 'KeyP') resume(); });
    },

    showEnd(r, { retry, workshop, menu }) {
      open(`
        <div class="panel end ${r.win ? 'win' : 'lose'}">
          <h2 class="title">${r.title}</h2>
          <p class="sub">${r.sub}</p>
          <div class="stats">
            <div class="stat"><span>🏢 Plantas superadas</span><b>${r.floors}</b></div>
            <div class="stat"><span>🧟 Enemigos derrotados</span><b>${r.kills}</b></div>
            <div class="stat"><span>🗺️ Salas exploradas (última planta)</span><b>${r.explored}</b></div>
            <div class="stat"><span>👥 Equipo</span><b>${r.team}</b></div>
            ${r.time ? `<div class="stat"><span>⏱️ Tiempo</span><b>${r.time}</b></div>` : ''}
            <div class="stat key"><span>🔑 Llaves conseguidas</span><b>+${r.keys} <small>(tienes ${r.wallet})</small></b></div>
          </div>
          <div class="col">
            <button class="btn yellow big" data-act="retry">↻ ${r.win ? 'Jugar otra vez' : 'Reintentar edificio'}</button>
            <div class="row-btns">
              <button class="btn green small" data-act="workshop">🔧 Taller</button>
              <button class="btn blue small" data-act="menu">Menú principal</button>
            </div>
          </div>
        </div>`,
      { retry, workshop, menu },
      (e) => { if (e.code === 'Enter') retry(); });
    },
  };
}
