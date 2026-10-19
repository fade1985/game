// ─────────────────────────────────────────────
//  El ordenador de la sala de mantenimiento ("ConserjeOS")
//
//  Al arrimarse a la mesa (props.js, Ordenador) el juego se pausa y sale la pantalla del ordenador: un
//  escritorio viejo con sus iconos. Hay dos programas:
//    · "Compra de puntos e intercambio": cambia los dólares ahorrados por puntos de talento y los gasta en el
//      árbol de talentos (talentos.js).
//    · "Tienda de armas": compra con los dólares ahorrados un arma para esta partida (su precio, `price`, en
//      weapons.js; la pistola es gratis). La que llevaras en ese hueco se queda en el suelo.
//  Irán saliendo más programas. Es HTML, como los demás menús: así el ratón, el teclado
//  (Tab, Enter, Esc) y el mando (mando.js va de botón en botón; B = Esc) funcionan solos.
// ─────────────────────────────────────────────
import { loadSave, updateSave } from './save.js';
import { clearInput } from './input.js';
import { sfx } from './sfx.js';
import { PRECIO_PUNTO, puntosAlcanzables, comprarPuntos, RAMAS, TALENTOS, talento, nivelDe, puedeSubir, subirTalento, aplicarTalentos } from './talentos.js';
import { baseStats } from './upgrades.js';
import { aplicarMutaciones } from './mutaciones.js';
import { WEAPONS, weaponSummary } from './weapons.js';
import { WeaponProp } from './props.js';

// Las armas de la tienda, de la más barata a la más cara (la fregona no tiene precio: se lleva siempre)
const EN_VENTA = Object.values(WEAPONS).filter((w) => w.price != null).sort((a, b) => a.price - b.price);

// Los iconos del escritorio: [ventana que abre, icono (assets/ui/iconos), nombre]
const ICONOS = [
  ['tienda', 'billete', 'Compra de puntos e intercambio'],
  ['armas', 'pistola', 'Tienda de armas'],
  ['apagar', 'puerta', 'Apagar'],
];

const reloj = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Una rama del árbol: sus talentos por niveles (1 arriba, 3 abajo). `foco()` da la clase del botón en el que
// empieza el mando (el primero que se puede subir, si no hay ninguno para comprar puntos).
function rama(save, r, foco) {
  const nodo = (t) => {
    const n = nivelDe(save, t.id);
    const motivo = puedeSubir(save, t.id); // null: se puede subir
    const estado = motivo === 'max' ? 'lleno' : motivo === 'bloqueado' ? 'bloqueada' : motivo ? 'apagada' : '';
    const pips = Array.from({ length: t.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    const nota = motivo === 'bloqueado' ? `Necesitas ${talento(t.pide).nombre} al máximo`
      : motivo === 'max' ? '¡Al máximo!' : t.desc;
    const tag = motivo === 'max' ? 'MÁX' : motivo === 'bloqueado' ? '' : '+1 ★';
    return `
      <button class="pc-arma pc-talento ${estado} ${motivo ? '' : foco()}" data-act="subir" data-arg="${t.id}" ${motivo ? 'disabled' : ''} title="${t.desc}">
        <i class="ico ico-${motivo === 'bloqueado' ? 'candado' : t.icono}"></i>
        <span class="pc-arma-txt"><b>${t.nombre} <span class="pc-pips">${pips}</span></b><small>${nota}</small></span>
        ${tag ? `<span class="pc-arma-tag">${tag}</span>` : ''}
      </button>`;
  };
  const niveles = [1, 2, 3].map((nv) => `
    <div class="pc-nivel"><span class="pc-nivel-n">${nv}</span>${TALENTOS.filter((t) => t.rama === r.id && t.nivel === nv).map(nodo).join('')}</div>`).join('');
  return `
    <div class="pc-rama">
      <div class="pc-rama-titulo"><i class="ico ico-${r.icono}"></i> ${r.nombre}</div>
      ${niveles}
    </div>`;
}

// Contenido de cada ventana: [título de la barra, HTML de dentro]
const VENTANAS = {
  tienda(g) {
    const save = loadSave();
    const max = puntosAlcanzables(save.keys);
    let foco = 'yellow'; // el mando empieza en el primer botón que se puede usar (mando.js busca button.yellow)
    const boton = (n, texto) => {
      const puede = n >= 1 && max >= n;
      const cls = puede ? foco : '';
      if (puede) foco = '';
      return `
        <button class="pc-arma ${cls} ${puede ? '' : 'bloqueada'}" data-act="comprar" data-arg="${n}" ${puede ? '' : 'disabled'}>
          <i class="ico ico-billete"></i>
          <span class="pc-arma-txt"><b>${texto}</b><small>${n >= 1 ? `Cuesta $${n * PRECIO_PUNTO}` : `Necesitas $${PRECIO_PUNTO}`}</small></span>
          <span class="pc-arma-tag">Cambiar</span>
        </button>`;
    };
    return ['C:\\MANTENIMIENTO\\PUNTOS.EXE', `
      <div class="pc-saldo">
        <div><span>Dólares ahorrados</span><b><i class="ico ico-billete"></i> $${save.keys}</b></div>
        <div><span>Puntos de talento</span><b>★ ${save.puntos}</b></div>
      </div>
      ${g.runKeys ? `<p class="pc-nota">Los $${g.runKeys} de esta partida no se pueden cambiar hasta que completes el edificio.</p>` : ''}
      <div class="pc-grupo">
        <div class="pc-grupo-titulo">Intercambio · $${PRECIO_PUNTO} = 1 punto</div>
        <div class="pc-armas">
          ${boton(1, 'Comprar 1 punto')}
          ${boton(max, max > 1 ? `Comprar ${max} puntos (todo)` : 'Comprar todo lo posible')}
        </div>
      </div>
      <div class="pc-grupo">
        <div class="pc-grupo-titulo">Árbol de talentos · cada punto sube un nivel</div>
        <div class="pc-arbol">${RAMAS.map((r) => rama(save, r, () => { const c = foco; foco = ''; return c; })).join('')}</div>
      </div>`];
  },
};

// La tienda de armas: cada arma con su precio. Las que ya llevas o no te llega el dinero salen apagadas
VENTANAS.armas = (g) => {
  const dinero = loadSave().keys;
  let foco = 'yellow';
  const fila = (w) => {
    const llevas = g.player.has(w);
    const puede = !llevas && dinero >= w.price;
    const cls = puede ? foco : '';
    if (puede) foco = '';
    const tag = llevas ? 'LA LLEVAS' : w.price ? `$${w.price}` : 'GRATIS';
    return `
      <button class="pc-arma ${cls} ${llevas ? 'puesta' : puede ? '' : 'bloqueada'}" data-act="armar" data-arg="${w.id}" ${puede ? '' : 'disabled'}>
        <i class="ico ico-${w.id}"></i>
        <span class="pc-arma-txt"><b>${w.name}</b><small>${weaponSummary(w)}</small></span>
        <span class="pc-arma-tag">${tag}</span>
      </button>`;
  };
  return ['C:\\MANTENIMIENTO\\ARMAS.EXE', `
    <div class="pc-saldo">
      <div><span>Dólares ahorrados</span><b><i class="ico ico-billete"></i> $${dinero}</b></div>
    </div>
    <p class="pc-nota">Lo que compres es para esta partida: si caes, lo pierdes. La que llevaras en ese hueco se queda en el suelo.</p>
    ${g.runKeys ? `<p class="pc-nota">Los $${g.runKeys} de esta partida no se pueden gastar hasta que completes el edificio.</p>` : ''}
    <div class="pc-grupo">
      <div class="pc-grupo-titulo">Cuerpo a cuerpo</div>
      <div class="pc-armas">${EN_VENTA.filter((w) => w.type === 'melee').map(fila).join('')}</div>
    </div>
    <div class="pc-grupo">
      <div class="pc-grupo-titulo">De fuego · con el cargador lleno y munición de reserva</div>
      <div class="pc-armas">${EN_VENTA.filter((w) => w.type === 'ranged').map(fila).join('')}</div>
    </div>`];
};

// `encender`: solo al abrirlo hace el efecto de encendido del monitor (al cambiar de ventana o elegir arma, no)
function pantalla(g, ventana, encender) {
  const iconos = ICONOS.map(([id, ico, nombre]) => `
    <button class="pc-icono ${!ventana && id === 'tienda' ? 'yellow' : ''}" data-act="${id === 'apagar' ? 'apagar' : 'abrir'}" data-arg="${id}">
      <i class="ico ico-${ico}"></i><span>${nombre}</span>
    </button>`).join('');
  let win = '';
  if (ventana) {
    const [titulo, html] = VENTANAS[ventana](g);
    win = `
      <div class="pc-win">
        <div class="pc-win-bar"><span>${titulo}</span><button class="pc-x ${html.includes('yellow') ? '' : 'yellow'}" data-act="cerrar" aria-label="Cerrar">✕</button></div>
        <div class="pc-win-body">${html}</div>
      </div>`;
  }
  return `
    <div class="pc">
      <div class="pc-monitor">
        <div class="pc-screen ${encender ? 'encender' : ''}">
          <div class="pc-desktop">
            <div class="pc-iconos">${iconos}</div>
            ${win}
          </div>
          <div class="pc-taskbar">
            <span class="pc-start">ConserjeOS</span>
            <span class="pc-task">${ventana ? ICONOS.find(([id]) => id === ventana)[2] : ''}</span>
            <span class="pc-clock">${reloj()}</span>
          </div>
          <div class="pc-scan"></div>
        </div>
        <div class="pc-marca">CONSERJE · OS 95 <i class="pc-led"></i></div>
      </div>
    </div>`;
}

export class OrdenadorMethods {
  // Enciende el ordenador: el juego se queda en pausa mientras está abierto
  openOrdenador() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.pcOpen = true;
    clearInput();
    sfx.click();
    this.drawOrdenador(null, true);
    if (!this.alCambiarTam) this.alCambiarTam = () => { if (this.pcOpen) this.igualarTalentos(); };
    window.addEventListener('resize', this.alCambiarTam);
    document.fonts?.ready.then(this.alCambiarTam);
  }

  // Vuelve a pintar la pantalla con esa ventana abierta (null = solo el escritorio)
  drawOrdenador(ventana, encender = false) {
    this.pcVentana = ventana;
    this.ui.showScreen(pantalla(this, ventana, encender), {
      abrir: (id) => { sfx.click(); this.drawOrdenador(id); },
      cerrar: () => { sfx.click(); this.drawOrdenador(null); },
      apagar: () => this.closeOrdenador(),
      comprar: (n) => {
        const save = comprarPuntos(Number(n));
        if (!save) { sfx.nope(); return; }
        // el HUD enseña lo ahorrado más lo de esta partida
        this.savedKeys = save.keys;
        this.wallet = this.savedKeys + this.runKeys;
        sfx.buy();
        this.drawOrdenador(ventana);
      },
      armar: (id) => this.comprarArma(WEAPONS[id]),
      subir: (id) => {
        const save = subirTalento(id);
        if (!save) { sfx.nope(); return; }
        this.aplicarTalentosYa(save.talentos);
        sfx.buy();
        this.drawOrdenador(ventana);
      },
    },
    // Esc (o B en el mando): cierra la ventana y, si no hay ninguna, apaga el ordenador
    (e) => {
      if (e.code !== 'Escape') return;
      if (this.pcVentana) { sfx.click(); this.drawOrdenador(null); } else this.closeOrdenador();
    },
    'pc-overlay');
    this.igualarTalentos();
  }

  // Compra un arma de la tienda con los dólares ahorrados y se la pone a Johnny
  comprarArma(w) {
    const p = this.player;
    let ok = false;
    const save = updateSave((s) => {
      if (!w || p.has(w) || s.keys < w.price) return;
      s.keys -= w.price;
      ok = true;
    });
    if (!ok) { sfx.nope(); return; }
    this.savedKeys = save.keys;
    this.wallet = this.savedKeys + this.runKeys;
    // la que llevaba en ese hueco se queda en el suelo, a sus pies (con sus balas)
    const old = p.equip(w);
    if (old) {
      const pr = new WeaponProp(old.weapon, p.x, p.y + 40);
      pr.ammo = old.ammo;
      this.room.props.push(pr);
    }
    this.unlockWeapon(w.id);
    sfx.buy();
    this.drawOrdenador('armas');
  }

  // Todos los recuadros de los talentos, del alto del más alto, para que las filas queden alineadas.
  // Se mide después de pintar (y otra vez si cambia la ventana o termina de cargar la letra).
  igualarTalentos() {
    const cajas = [...document.querySelectorAll('.pc-talento')];
    if (!cajas.length) return;
    for (const c of cajas) c.style.height = '';
    const alto = Math.max(...cajas.map((c) => c.offsetHeight));
    for (const c of cajas) c.style.height = `${alto}px`;
  }

  // Un talento recién comprado se nota ya, sin esperar al siguiente edificio
  aplicarTalentosYa(talentos) {
    const s = this.stats, p = this.player;
    const antes = { maxHp: s.maxHp, extraThrow: s.extraThrow, shield: s.shield };
    // el mismo objeto: Johnny lo lleva enlazado (y sin perder las mutaciones de esta partida)
    Object.assign(s, aplicarMutaciones(aplicarTalentos(baseStats(), talentos), this.mutaciones));
    if (s.maxHp > antes.maxHp) p.hp += s.maxHp - antes.maxHp;   // la vida nueva viene llena
    const extra = s.extraThrow - antes.extraThrow;               // Artificiero: las botellas de más, ya
    this.molotovs += extra; this.granadas += extra;
    if (s.shield && !antes.shield) p.shield = s.shield;          // Acero: el escudo de esta planta
  }

  closeOrdenador() {
    if (!this.pcOpen) return;
    this.pcOpen = false;
    window.removeEventListener('resize', this.alCambiarTam);
    this.paused = false;
    this.ui.hide();
    clearInput();
    sfx.click();
  }
}
