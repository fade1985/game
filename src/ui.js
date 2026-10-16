// ─────────────────────────────────────────────
//  Interfaz en HTML: menús, cartas, pausa y HUD
// ─────────────────────────────────────────────
import { weaponSummary } from './weapons.js';
import { toggleMute } from './sfx.js';
import { loadSave } from './save.js';
import { makeTitleCanvas } from './titulo.js';

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
  const $touch = (sel) => document.querySelector(`#touch-ui ${sel}`); // botones táctiles (fuera del HUD)
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
    if (prop === 'width') { el.style.width = value; el.style.setProperty('--hp', value); }
    else if (prop.startsWith('class:')) el.classList.toggle(prop.slice(6), value); // 'class:on' pone o quita la clase "on"
    else if (prop === 'reload') el.style.setProperty('--recarga', value);
    else el[prop] = value;
  }

  $('#btn-mute').addEventListener('click', (e) => {
    e.currentTarget.innerHTML = `<i class="ico ico-${toggleMute() ? 'mudo' : 'sonido'}"></i>`;
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
      // las dos armas: la de cuerpo a cuerpo y, si lleva, la de fuego con sus balas (cargador / reserva)
      const { melee, ranged } = p.slots;
      set('melee', $('#pill-melee'), `<i class="ico ico-${melee.id}"></i> <b>${melee.name}</b>`, 'innerHTML');
      set('meleeOn', $('#pill-melee'), p.hand === 'melee', 'class:on');
      set('rangedHide', $('#pill-ranged'), !ranged, 'hidden');
      if (ranged) {
        const ammo = `${p.mag}/${g.testMode ? '∞' : p.reserve}`; // mientras recarga, parpadea (style.css)
        set('ranged', $('#pill-ranged'), `<i class="ico ico-${ranged.id}"></i> <b>${ranged.name}</b> <span class="ammo">${ammo}</span>`, 'innerHTML');
        set('rangedOn', $('#pill-ranged'), p.hand === 'ranged', 'class:on');
        set('rangedEmpty', $('#pill-ranged'), p.mag === 0 && !p.reloading, 'class:empty');
        set('rangedReload', $('#pill-ranged'), p.reloading, 'class:reloading');
      }
      // y los botones redondos del móvil (lo mismo, en pequeño)
      set('bMelee', $touch('.slot-melee .ico'), `ico ico-${melee.id}`, 'className');
      set('bMeleeOn', $touch('.slot-melee'), p.hand === 'melee', 'class:on');
      set('bRangedHide', $touch('.slot-ranged'), !ranged, 'hidden');
      if (ranged) {
        set('bRanged', $touch('.slot-ranged .ico'), `ico ico-${ranged.id}`, 'className');
        set('bRangedOn', $touch('.slot-ranged'), p.hand === 'ranged', 'class:on');
        set('bAmmo', $touch('.slot-ranged b'), String(p.mag));
        set('bEmpty', $touch('.slot-ranged'), p.mag === 0 && !p.reloading, 'class:empty');
        // el aro de recarga: de 0 a 1 según lo que lleva (style.css lo pinta con --recarga)
        const k = p.reloading ? (1 - p.reloadT / p.reloadDur).toFixed(2) : '0';
        set('bReload', $touch('.slot-ranged'), k, 'reload');
      }
      set('team', $('#hud-team'), g.allies.map((al) => `<i class="ico ico-${al.def.id}"></i>`).join(''), 'innerHTML');
      set('teamShow', $('#pill-team'), g.allies.length === 0, 'hidden');
      set('keys', $('#hud-keys'), `$${g.wallet ?? 0}`);
      const molotovs = g.testMode ? '∞' : String(g.molotovs);
      set('molotov', $('#hud-molotov'), molotovs);
      set('molotovBtn', document.querySelector('.toss-btn b'), molotovs);
    },

    // ═════════════ Pantallas ═════════════
    showMenu(save, { play, workshop }) {
      const upgrades = Object.values(save.workshop).reduce((a, b) => a + b, 0);
      open(`
        <div class="menu">
          <h1 class="logo" aria-label="Zombie Scape"></h1>
          <p class="tagline">Limpia el edificio de zombis, planta a planta</p>
          <div class="col">
            <button class="btn yellow big" data-act="play">JUGAR</button>
            ${canFullscreen() ? '<button class="btn green small" data-act="fullscreen">Pantalla completa</button>' : ''}
            <button class="btn blue" data-act="workshop"><i class="ico ico-herramientas"></i> Taller <span class="keys-chip"><i class="ico ico-billete"></i> $${save.keys}</span>${upgrades ? ` <small>· ${upgrades} mejora${upgrades > 1 ? 's' : ''}</small>` : ''}</button>
          </div>
          <div class="hint panel small">
            <b>Teclado:</b> WASD moverse · Espacio esquivar · Q o rueda cambiar de arma · R recargar · clic derecho o E (mantén y suelta) molotov<br>
            <b>Mando:</b> stick moverse · A esquivar · Y cambiar de arma · X recargar · RT (mantén y apunta) molotov · Start pausa<br>
            Atacas solo al enemigo más cercano. ¡Limpia cada sala para abrir sus puertas!
          </div>
          ${save.bestFloor ? `<div class="record"><i class="ico ico-trofeo"></i> Mejor planta alcanzada: ${save.bestFloor}</div>` : ''}
        </div>`,
      { play, workshop, fullscreen: goFullscreen },
      (e) => {
        if (e.code === 'Enter') play();
        else if (e.code === 'KeyT') workshop();
      },
      'clear');
      overlay.querySelector('.logo')?.append(makeTitleCanvas());
    },

    // Selector de edificios: los que aún no existen salen como "Próximamente"
    showBuildings(save, buildings, { pick, back }) {
      const cards = Object.values(buildings).map((b) => {
        if (b.soon) {
          return `
            <div class="bcard soon">
              <div class="bicon"><i class="ico ico-${b.id}"></i></div>
              <div class="bname">${b.name}</div>
              <div class="bdesc">${b.desc}</div>
              <div class="bfoot"><i class="ico ico-candado"></i> Próximamente</div>
            </div>`;
        }
        const p = save.buildings[b.id] || { completed: false, runs: 0, wins: 0, bestFloor: 0, bestTime: 0 };
        const time = p.bestTime ? `${Math.floor(p.bestTime / 60)}:${String(Math.floor(p.bestTime % 60)).padStart(2, '0')}` : '';
        const progress = p.completed
          ? `Completado ×${p.wins}${time ? ` · mejor tiempo ${time}` : ''}`
          : p.runs ? `<i class="ico ico-trofeo"></i> Has llegado al nivel ${p.bestFloor} de ${b.floors}` : '¡Sin explorar!';
        return `
          <button class="bcard ${p.completed ? 'done' : ''}" data-act="pick" data-arg="${b.id}">
            <div class="bicon"><i class="ico ico-${b.id}"></i></div>
            <div class="bname">${b.name}</div>
            <div class="bdesc">${b.desc}</div>
            <div class="bmeta">${b.floors - 1} plantas y azotea · ${p.runs} intento${p.runs === 1 ? '' : 's'}</div>
            <div class="bfoot">${progress}</div>
          </button>`;
      }).join('');
      open(`
        <div class="panel picker">
          <h2 class="title">Elige edificio</h2>
          <div class="bcards">${cards}</div>
          <button class="btn blue small" data-act="back">Volver</button>
        </div>`,
      { pick, back },
      (e) => {
        if (e.code === 'Escape') back();
        else if (e.code === 'Enter') pick('apartamentos');
      });
    },

    // Taller del conserje: mejoras permanentes que se compran con dólares
    showWorkshop(save, upgrades, { buy, back }) {
      const rows = upgrades.map((up) => {
        const lvl = save.workshop[up.id] || 0;
        const maxed = lvl >= up.max;
        const price = up.cost[lvl];
        const pips = Array.from({ length: up.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        return `
          <div class="wrow ${maxed ? 'maxed' : ''}">
            <div class="wicon"><i class="ico ico-${up.id}"></i></div>
            <div class="winfo"><b>${up.name}</b><span>${up.desc}</span><div class="pips">${pips}</div></div>
            <button class="btn ${maxed ? 'green' : 'yellow'} small" data-act="buy" data-arg="${up.id}" ${maxed || save.keys < price ? 'disabled' : ''}>
              ${maxed ? 'MÁX' : `<i class="ico ico-billete"></i> $${price}`}
            </button>
          </div>`;
      }).join('');
      open(`
        <div class="panel workshop">
          <h2 class="title"><i class="ico ico-herramientas"></i> Taller del conserje</h2>
          <p class="sub">Los dólares <i class="ico ico-billete"></i> que sueltan los zombis se guardan aunque pierdas.<br>Las mejoras se aplican al empezar cada edificio.</p>
          <div class="wallet"><i class="ico ico-billete"></i> $${save.keys}</div>
          <div class="wrows">${rows}</div>
          <button class="btn blue small" data-act="back">Volver</button>
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
          <p class="sub"><i class="ico ico-${g.building.id}"></i> ${g.building.name} · ${g.floorLabel}</p>
          <div class="pause-grid">
            <div class="stats">
              ${stat('<i class="ico ico-corazon"></i>', 'Vida', `${Math.ceil(g.player.hp)} / ${Math.round(s.maxHp)}`)}
              ${stat('<i class="ico ico-fuerza"></i>', 'Daño', `x${s.damage.toFixed(2)}`)}
              ${stat('<i class="ico ico-cafe"></i>', 'Velocidad de ataque', `x${s.fireRate.toFixed(2)}`)}
              ${stat('<i class="ico ico-guantes"></i>', 'Alcance', `x${(s.range * (g.player.weapon.type === 'melee' ? s.meleeRange : 1)).toFixed(2)}`)}
              ${stat('<i class="ico ico-dash"></i>', 'Velocidad', Math.round(s.speed))}
              ${stat('<i class="ico ico-casco"></i>', 'Daño recibido', `x${s.damageTaken.toFixed(2)}`)}
              ${stat('<i class="ico ico-diana"></i>', 'Crítico', `${Math.round(s.crit * 100)}%`)}
            </div>
            <div>
              ${list('<i class="ico ico-cuchillo"></i> Armas', Object.values(g.player.slots).filter(Boolean).map((w) => `<i class="ico ico-${w.id}"></i> <b>${w.name}</b> · ${weaponSummary(w)}`), '')}
              ${list('<i class="ico ico-mochila"></i> Objetos', g.items.map((it) => `<i class="ico ico-${it.id}"></i> <b>${it.name}</b> · ${it.desc}`), 'Ninguno todavía')}
              ${list('<i class="ico ico-policia"></i> Equipo', g.allies.map((al) => `<i class="ico ico-${al.def.id}"></i> <b>${al.def.name}</b> · ${al.def.desc}`), 'Nadie todavía: ¡rescata supervivientes!')}
            </div>
          </div>
          <div class="row-btns">
            <button class="btn yellow" data-act="resume">Continuar</button>
            <button class="btn blue small" data-act="music">Música: ${musicOn ? 'Sí' : 'No'}</button>
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
            <div class="stat"><span><i class="ico ico-apartamentos"></i> Plantas superadas</span><b>${r.floors}</b></div>
            <div class="stat"><span><i class="ico ico-zombi"></i> Enemigos derrotados</span><b>${r.kills}</b></div>
            <div class="stat"><span><i class="ico ico-puerta"></i> Apartamentos visitados (última planta)</span><b>${r.explored}</b></div>
            <div class="stat"><span><i class="ico ico-policia"></i> Equipo</span><b>${r.team}</b></div>
            ${r.time ? `<div class="stat"><span>Tiempo</span><b>${r.time}</b></div>` : ''}
            <div class="stat key"><span><i class="ico ico-billete"></i> Dólares conseguidos</span><b>+$${r.keys} <small>(tienes $${r.wallet})</small></b></div>
          </div>
          <div class="col">
            <button class="btn yellow big" data-act="retry">${r.win ? 'Jugar otra vez' : 'Reintentar edificio'}</button>
            <div class="row-btns">
              <button class="btn green small" data-act="workshop"><i class="ico ico-herramientas"></i> Taller</button>
              <button class="btn blue small" data-act="menu">Menú principal</button>
            </div>
          </div>
        </div>`,
      { retry, workshop, menu },
      (e) => { if (e.code === 'Enter') retry(); });
    },
  };
}
