// ─────────────────────────────────────────────
//  El banco de trabajo de la sala de mantenimiento (fase C del plan de combinar: claude/plan-combinar.md)
//
//  Al arrimarse (props.js, BancoTrabajo) el juego se pausa y sale un recuadro: arriba, todo lo que se puede
//  usar (las armas que lleva Johnny y los objetos de la mochila y del baúl); al tocar dos cosas suben a las
//  casillas del banco y, si hacen una receta (recetas.js), se puede crear el arma. Sale con una rareza al azar,
//  los ingredientes se gastan (los objetos, primero de la mochila y luego del baúl) y el arma dura esta
//  partida: la de cuerpo a cuerpo, directa a la mano (armas-creadas.js); las demás, al inventario
//  (game.armasCreadas) hasta la fase D3 (las arrojadizas).
// ─────────────────────────────────────────────
import { loadSave, updateSave } from './save.js';
import { clearInput } from './input.js';
import { sfx } from './sfx.js';
import { WEAPONS } from './weapons.js';
import { OBJETOS, iconoObjeto } from './objetos.js';
import { buscarReceta, crearArma, RAREZAS, HUECOS } from './recetas.js';
import { armaDeCreada } from './armas-creadas.js';

// Las armas que entran en las recetas
const ARMAS_RECETA = ['fregona', 'bate', 'cuchillo'];

const nombreDe = (id) => WEAPONS[id]?.name || OBJETOS[id]?.nombre || id;
// El dibujo de un ingrediente: las armas tienen su icono en style.css; los objetos, su dibujito
export const icono = (id) => (WEAPONS[id] ? `<i class="ico ico-${id}"></i>`
  : `<i class="ico" style="background-image:url(${iconoObjeto(id)})"></i>`);
// La casilla de un arma creada, con el borde del color de su rareza
export const casillaCreada = (a, extra = '') => `
  <div class="inv-casilla ${a.rareza}">${icono(a.icono)}<b>${a.nombre}</b>
    <small>${RAREZAS.find((r) => r.id === a.rareza).nombre} · ${a.unidades ? `${a.unidades} unidades` : `daño ${a.damage}`}</small>${extra}</div>`;

export class BancoMethods {
  // Todo lo que se puede poner en el banco. `clave` dice de dónde sale cada cosa:
  //   'mano' = el arma cuerpo a cuerpo que lleva en la mano; 'g3' = la 4.ª arma guardada en el inventario;
  //   'o:clavos' = ese objeto, sumando los de la mochila y los del baúl
  ingredientesBanco() {
    const lista = [];
    const mano = this.player.slots.melee;
    if (mano && ARMAS_RECETA.includes(mano.id)) lista.push({ clave: 'mano', id: mano.id, nota: 'En la mano' });
    this.armasGuardadas.forEach((w, i) => {
      if (ARMAS_RECETA.includes(w.id)) lista.push({ clave: `g${i}`, id: w.id, nota: 'Inventario' });
    });
    const baul = loadSave().baul;
    for (const id of Object.keys(OBJETOS)) {
      const n = this.mochila.filter((m) => m === id).length + (baul[id] || 0);
      if (n > 0) lista.push({ clave: `o:${id}`, id, nota: `× ${n}` });
    }
    return lista;
  }

  openBanco() {
    if (this.state !== 'playing' || this.paused || this.player.dead) return;
    this.paused = true;
    this.bancoOpen = true;
    this.bancoSel = [];        // las claves de lo que hay puesto en el banco (dos como mucho)
    this.bancoHecha = null;    // el arma que se acaba de crear (para enseñarla)
    clearInput();
    sfx.click();
    this.drawBanco();
  }

  drawBanco() {
    const ings = this.ingredientesBanco();
    // si algo de lo puesto ya no está (se gastó), se quita del banco
    this.bancoSel = this.bancoSel.filter((c) => ings.some((g) => g.clave === c));
    const puesto = this.bancoSel.map((c) => ings.find((g) => g.clave === c));
    const receta = puesto.length === 2 ? buscarReceta(puesto[0].id, puesto[1].id) : null;

    const cosas = ings.map((g) => `
      <button class="btn inv-casilla gris banco-cosa${this.bancoSel.includes(g.clave) ? ' puesta' : ''}" data-act="poner" data-arg="${g.clave}">
        ${icono(g.id)}<b>${nombreDe(g.id)}</b><small>${g.nota}</small></button>`);
    const hueco = (i) => (puesto[i]
      ? `<button class="btn inv-casilla gris banco-hueco" data-act="poner" data-arg="${puesto[i].clave}">${icono(puesto[i].id)}<b>${nombreDe(puesto[i].id)}</b></button>`
      : '<div class="inv-casilla vacia banco-hueco"><small>Elige algo</small></div>');
    let resultado;
    if (this.bancoHecha && !puesto.length) resultado = casillaCreada(this.bancoHecha, '<small>¡Creada!</small>');
    else if (receta) resultado = `<div class="inv-casilla gris banco-hueco">${icono(receta.icono)}<b>${receta.nombre}</b><small>${HUECOS[receta.hueco]}</small></div>`;
    else resultado = `<div class="inv-casilla vacia banco-hueco"><small>${puesto.length === 2 ? 'Esto no combina' : '?'}</small></div>`;
    const texto = receta ? `${receta.desc}. Al crearla, los dos ingredientes se gastan.`
      : this.bancoHecha && !puesto.length ? this.bancoHecha.desc
      : 'Toca dos cosas para ponerlas en el banco. Si hacen receta, puedes crear un arma.';

    const creadas = [this.player.slots.melee?.creada, ...this.armasCreadas].filter(Boolean); // la de la mano, la primera
    this.ui.showScreen(`
      <div class="panel inventario banco">
        <h2 class="title">Banco de trabajo</h2>
        <div class="plist-title">Tus cosas</div>
        <div class="inv-mochila banco-cosas">${cosas.join('') || '<p class="sub small">No tienes nada que combinar. Los objetos los sueltan los zombis.</p>'}</div>
        <div class="banco-mesa">${hueco(0)}<span>+</span>${hueco(1)}<span>=</span>${resultado}</div>
        <p class="sub small">${texto}</p>
        <div class="banco-botones">
          <button class="btn yellow small" data-act="crear"${receta ? '' : ' disabled'}>Crear</button>
          <button class="btn blue small" data-act="cerrar">Cerrar</button>
        </div>
        ${creadas.length ? `<div class="plist-title">Armas creadas en esta partida</div>
        <div class="inv-mochila">${creadas.map((a) => casillaCreada(a)).join('')}</div>` : ''}
      </div>`,
    {
      poner: (clave) => this.ponerEnBanco(clave),
      crear: () => this.crearEnBanco(),
      cerrar: () => this.closeBanco(),
    },
    (e) => { if (e.code === 'Escape') { e.preventDefault(); this.closeBanco(); } });
  }

  // Toca una cosa: si ya estaba en el banco se quita; si no, se pone (la tercera sustituye a la segunda)
  ponerEnBanco(clave) {
    sfx.click();
    this.bancoHecha = null;
    if (this.bancoSel.includes(clave)) this.bancoSel = this.bancoSel.filter((c) => c !== clave);
    else if (this.bancoSel.length < 2) this.bancoSel.push(clave);
    else this.bancoSel[1] = clave;
    this.drawBanco();
  }

  crearEnBanco() {
    const ings = this.ingredientesBanco();
    const puesto = this.bancoSel.map((c) => ings.find((g) => g.clave === c));
    const receta = puesto.length === 2 && puesto.every(Boolean) ? buscarReceta(puesto[0].id, puesto[1].id) : null;
    if (!receta) { sfx.nope(); return; }
    // se gastan los ingredientes (las armas guardadas, de la última a la primera para no liar los números)
    const guardadas = puesto.filter((g) => g.clave[0] === 'g').map((g) => Number(g.clave.slice(1))).sort((a, b) => b - a);
    for (const i of guardadas) this.armasGuardadas.splice(i, 1);
    for (const g of puesto) {
      if (g.clave === 'mano') this.player.slots.melee = null;
      else if (g.clave.startsWith('o:')) this.gastarObjeto(g.id);
    }
    // la de cuerpo a cuerpo va directa a la mano de Johnny; lo que llevara (si no se ha gastado) pasa al
    // inventario. Las demás esperan en el inventario (a distancia y arrojadizas: fases D2 y D3)
    const p = this.player;
    const arma = crearArma(receta);
    if (arma.hueco === 'melee') {
      this.guardarArma(p.slots.melee);
      p.slots.melee = armaDeCreada(arma);
      p.hold('melee');
    } else if (arma.hueco === 'ranged') {
      const old = p.equip(armaDeCreada(arma)); // a la mano de fuego; la que llevaba pasa al inventario con su munición
      this.guardarArma(old?.weapon, old?.ammo);
    } else if (arma.receta === 'molotov') this.molotovs += arma.unidades; // las botellas se suman a las que ya lleva (armas-creadas.js)
    else this.armasCreadas.push(arma);
    this.bancoHecha = arma;
    this.bancoSel = [];
    if (arma.rareza === 'verde') sfx.buy(); else sfx.clear(); // las raras y épicas suenan a premio
    this.drawBanco();
  }

  // Gasta un objeto: primero de la mochila y, si no hay ahí, del baúl
  gastarObjeto(id) {
    const i = this.mochila.indexOf(id);
    if (i >= 0) { this.mochila.splice(i, 1); return; }
    updateSave((s) => {
      s.baul[id] = (s.baul[id] || 0) - 1;
      if (s.baul[id] <= 0) delete s.baul[id];
    });
  }

  closeBanco() {
    if (!this.bancoOpen) return;
    this.bancoOpen = false;
    this.paused = false;
    this.ui.hide();
    clearInput();
    sfx.click();
  }
}
