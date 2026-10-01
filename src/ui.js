// ─────────────────────────────────────────────
//  Interfaz en HTML: menús, cartas, tienda y HUD
// ─────────────────────────────────────────────
import { TOTAL_ROOMS, MAX_ALLIES } from './config.js';
import { RARITY_LABEL, META } from './upgrades.js';
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
    <button class="card ${c.rarity || 'common'} ${c.sold ? 'sold' : ''}" data-act="pick" data-arg="${i}" style="--i:${i}" ${c.sold ? 'disabled' : ''}>
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
      set('coins', $('#hud-coins'), String(g.coins));
      set('gems', $('#hud-gems'), String(g.runGems));
      set('team', $('#hud-team'), `${g.allies.length}/${MAX_ALLIES}`);
      if (cache.room !== g.roomIndex) {
        cache.room = g.roomIndex;
        let dots = '';
        for (let i = 0; i < TOTAL_ROOMS; i++) {
          const cls = i < g.roomIndex ? 'done' : i === g.roomIndex ? 'cur' : '';
          dots += `<i class="dot ${cls} ${i === TOTAL_ROOMS - 1 ? 'boss' : ''}"></i>`;
        }
        $('.dots').innerHTML = dots;
      }
    },

    // ═════════════ Pantallas ═════════════
    showMenu(save, { play, workshop }) {
      open(`
        <div class="menu">
          <h1 class="logo"><span class="l1">BLOB</span><span class="l2">QUEST</span></h1>
          <p class="tagline">Un mini roguelike de salas</p>
          <div class="col">
            <button class="btn yellow big" data-act="play">▶ JUGAR</button>
            <button class="btn blue" data-act="workshop">🔧 TALLER <span class="chip">💎 ${save.gems}</span></button>
          </div>
          <div class="hint panel small">
            <b>Moverse:</b> WASD / flechas · <b>Esquivar:</b> Espacio<br>
            Disparas solo al enemigo más cercano. ¡Elige bien tus puertas!
          </div>
          ${save.best ? `<div class="record">🏆 Récord: sala ${save.best}/${TOTAL_ROOMS}${save.wins ? ` · Victorias: ${save.wins}` : ''}</div>` : ''}
        </div>`,
      { play, workshop },
      (e) => { if (e.code === 'Enter') play(); },
      'clear');
    },

    showWorkshop(save, { buy, back }) {
      const rows = META.map((m) => {
        const lvl = save.upgrades[m.id] || 0;
        const maxed = lvl >= m.max;
        const cost = maxed ? 0 : m.cost(lvl);
        const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        return `
          <div class="row">
            <div class="ricon">${m.icon}</div>
            <div class="rtext"><div class="rname">${m.name}</div><div class="rdesc">${m.desc}</div><div class="pips">${pips}</div></div>
            <button class="btn ${maxed ? '' : 'green'} small" data-act="buy" data-arg="${m.id}" ${maxed || save.gems < cost ? 'disabled' : ''}>
              ${maxed ? 'MÁX' : `💎 ${cost}`}
            </button>
          </div>`;
      }).join('');
      open(`
        <div class="panel workshop">
          <h2 class="title">🔧 Taller</h2>
          <p class="sub">Las gemas 💎 se guardan entre partidas. ¡Úsalas para mejoras permanentes!</p>
          <div class="chip big">💎 ${save.gems}</div>
          <div class="rows">${rows}</div>
          <button class="btn pink" data-act="back">← Volver</button>
        </div>`,
      { buy, back },
      (e) => { if (e.code === 'Escape') back(); });
    },

    showCards(cards, title, onPick) {
      const picked = (i) => { if (cards[i]) onPick(cards[i]); };
      open(`
        <h2 class="title">${title}</h2>
        <div class="cards">${cards.map((c, i) => cardHTML(c, i, `<kbd>${i + 1}</kbd>`)).join('')}</div>`,
      { pick: (i) => picked(Number(i)) },
      (e) => { const n = Number(e.key); if (n >= 1 && n <= cards.length) picked(n - 1); });
    },

    showShop(offers, coins, { buy, close }) {
      open(`
        <h2 class="title">🛒 Tienda</h2>
        <div class="chip big">🪙 ${coins}</div>
        <div class="cards shop">${offers.map((o, i) => {
          const cant = !o.sold && (coins < o.price || o.blocked);
          const label = o.sold ? 'VENDIDO' : o.blocked ? 'EQUIPO LLENO' : `🪙 ${o.price}`;
          return cardHTML(o, i, `<div class="price ${cant ? 'cant' : ''}">${label}</div>`);
        }).join('')}</div>
        <button class="btn pink" data-act="close">Seguir explorando →</button>`,
      { pick: (i) => buy(offers[Number(i)]), close },
      (e) => { if (e.code === 'Escape') close(); });
    },

    showPause(g, { resume, quit }) {
      const s = g.stats;
      const stat = (icon, name, val) => `<div class="stat"><span>${icon} ${name}</span><b>${val}</b></div>`;
      open(`
        <div class="panel pause">
          <h2 class="title">Pausa</h2>
          <div class="stats">
            ${stat('❤️', 'Vida', `${Math.ceil(g.player.hp)} / ${Math.round(s.maxHp)}`)}
            ${stat('💪', 'Daño', s.damage.toFixed(1))}
            ${stat('⚡', 'Disparos/seg', s.fireRate.toFixed(2))}
            ${stat('👟', 'Velocidad', Math.round(s.speed))}
            ${stat('🔱', 'Proyectiles', s.shots)}
            ${stat('🗡️', 'Perforación', s.pierce)}
            ${stat('🎯', 'Crítico', `${Math.round(s.crit * 100)}%`)}
            ${stat('👥', 'Equipo', `${g.allies.length} (daño x${s.teamDamage.toFixed(2)})`)}
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
          <h2 class="title">${r.win ? '🏆 ¡Victoria!' : '💥 ¡Derrota!'}</h2>
          <p class="sub">${r.win ? '¡Has limpiado la mazmorra entera!' : `Llegaste a la sala ${r.room} de ${r.total}`}</p>
          <div class="stats">
            <div class="stat"><span>👾 Enemigos derrotados</span><b>${r.kills}</b></div>
            <div class="stat"><span>👥 Tamaño del equipo</span><b>${r.team}</b></div>
            <div class="stat"><span>💎 Gemas conseguidas</span><b>${r.gems}</b></div>
          </div>
          <div class="col">
            <button class="btn yellow big" data-act="retry">↻ Otra partida</button>
            <button class="btn blue small" data-act="menu">Menú principal</button>
          </div>
        </div>`,
      { retry, menu },
      (e) => { if (e.code === 'Enter') retry(); });
    },
  };
}
