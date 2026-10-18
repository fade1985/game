// ─────────────────────────────────────────────
//  El ordenador de la sala de mantenimiento ("ConserjeOS")
//
//  Al arrimarse a la mesa (props.js, Ordenador) el juego se pausa y sale la pantalla del ordenador: un
//  escritorio viejo con sus iconos. "Armas" abre una ventana con todas las armas: las que ya has
//  encontrado en alguna partida se eligen ahí y van a su hueco (cuerpo a cuerpo o de fuego); las demás
//  salen con candado. "Habilidades" está en obras (fase 2). Es HTML, como los demás menús: así el ratón,
//  el teclado (Tab, Enter, Esc) y el mando (mando.js va de botón en botón; B = Esc) funcionan solos.
// ─────────────────────────────────────────────
import { WEAPONS, weaponSummary } from './weapons.js';
import { loadSave } from './save.js';
import { clearInput } from './input.js';
import { sfx } from './sfx.js';

// Los iconos del escritorio: [ventana que abre, icono (assets/ui/iconos), nombre]
const ICONOS = [
  ['armas', 'escopeta', 'Armas'],
  ['habilidades', 'fuerza', 'Habilidades'],
  ['apagar', 'puerta', 'Apagar'],
];

const reloj = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ¿Se puede elegir esta arma? La fregona siempre; las demás, si ya la has encontrado (en pruebas, todas)
const abierta = (g, w) => g.testMode || w.id === 'fregona' || loadSave().weapons.includes(w.id);

// Contenido de cada ventana: [título de la barra, HTML de dentro]
const VENTANAS = {
  armas(g) {
    const p = g.player;
    let foco = 'yellow'; // el mando empieza en la primera que se puede elegir (mando.js busca button.yellow)
    const filas = Object.values(WEAPONS).map((w) => {
      if (!abierta(g, w)) {
        return `
          <button class="pc-arma bloqueada" disabled>
            <i class="ico ico-candado"></i>
            <span class="pc-arma-txt"><b>???</b><small>Encuéntrala en el edificio para poder elegirla</small></span>
          </button>`;
      }
      const lleva = p.has(w);
      const cls = foco; foco = '';
      return `
        <button class="pc-arma ${lleva ? 'puesta' : ''} ${cls}" data-act="elegir" data-arg="${w.id}">
          <i class="ico ico-${w.id}"></i>
          <span class="pc-arma-txt"><b>${w.name}</b><small>${weaponSummary(w)}</small></span>
          <span class="pc-arma-tag">${lleva ? 'EQUIPADA' : 'Elegir'}</span>
        </button>`;
    }).join('');
    return ['C:\\MANTENIMIENTO\\ARMAS', `
      <p class="pc-nota">Llevas una de cuerpo a cuerpo y una de fuego. Elige cuál quieres en cada hueco.</p>
      <div class="pc-armas">${filas}</div>`];
  },
  habilidades() {
    return ['C:\\MANTENIMIENTO\\HABILIDADES', `
      <div class="pc-obras">
        <i class="ico ico-herramientas"></i>
        <p><b>Programa en construcción</b></p>
        <p>Pronto podrás mejorar a Johnny desde aquí.<br>De momento, las mejoras están en el Taller del menú principal.</p>
      </div>`];
  },
};

function pantalla(g, ventana) {
  const iconos = ICONOS.map(([id, ico, nombre]) => `
    <button class="pc-icono ${!ventana && id === 'armas' ? 'yellow' : ''}" data-act="${id === 'apagar' ? 'apagar' : 'abrir'}" data-arg="${id}">
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
        <div class="pc-screen">
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
    this.drawOrdenador(null);
  }

  // Vuelve a pintar la pantalla con esa ventana abierta (null = solo el escritorio)
  drawOrdenador(ventana) {
    this.pcVentana = ventana;
    this.ui.showScreen(pantalla(this, ventana), {
      abrir: (id) => { sfx.click(); this.drawOrdenador(id); },
      cerrar: () => { sfx.click(); this.drawOrdenador(null); },
      apagar: () => this.closeOrdenador(),
      elegir: (id) => {
        const w = WEAPONS[id];
        if (!w || !abierta(this, w) || this.player.has(w)) return;
        this.player.equip(w);
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
  }

  closeOrdenador() {
    if (!this.pcOpen) return;
    this.pcOpen = false;
    this.paused = false;
    this.ui.hide();
    clearInput();
    sfx.click();
    const p = this.player;
    this.banner = { icon: p.weapon.id, title: p.weapon.name, sub: weaponSummary(p.weapon), t: 0 };
  }
}
