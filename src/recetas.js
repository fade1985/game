// ─────────────────────────────────────────────
//  Recetas para crear armas en el banco de trabajo (fase C del plan de combinar: claude/plan-combinar.md)
//
//  Cada receta junta dos ingredientes: objetos (objetos.js) o armas de la tienda (fregona, bate, cuchillo).
//  El arma que sale lleva una rareza al azar (RAREZAS) que multiplica su daño. El arma creada
//  dura esa partida: la de cuerpo a cuerpo va a la mano (armas-creadas.js, fase D1); las demás, de momento,
//  a distancia van a la mano de fuego (fase D2); las arrojadizas solo se ven en el inventario (fase D3).
//
//  Campos de cada receta:
//    id, nombre      lo que sale
//    con             los dos ingredientes (ids de OBJETOS o de WEAPONS)
//    hueco           'melee' (cuerpo a cuerpo), 'ranged' (a distancia) o 'arrojadiza'
//    icono           de qué ingrediente se toma el dibujo (hasta que tenga el suyo)
//    damage          daño con rareza verde (provisional; en las arrojadizas, el de la explosión o el fuego)
//    unidades        las arrojadizas: cuántas salen (la rareza da más)
//    desc            qué hace, en una frase
// ─────────────────────────────────────────────

export const RECETAS = [
  { id: 'lanza', nombre: 'Lanza', con: ['fregona', 'cuchillo'], hueco: 'melee', icono: 'fregona', damage: 11,
    desc: 'Alcance largo: una estocada estrecha que atraviesa' },
  { id: 'aplastacabezas', nombre: 'Aplastacabezas', con: ['bate', 'clavos'], hueco: 'melee', icono: 'bate', damage: 21,
    desc: 'Empuja mucho y aturde un instante' },
  { id: 'bateFuego', nombre: 'Bate de fuego', con: ['bate', 'gasolina'], hueco: 'melee', icono: 'bate', damage: 20,
    desc: 'Cada golpe prende fuego' },
  { id: 'lanzallamas', nombre: 'Lanzallamas', con: ['pistolaAgua', 'gasolina'], hueco: 'ranged', icono: 'pistolaAgua', damage: 4,
    desc: 'Chorro de fuego corto con depósito; prende fuego' },
  { id: 'partecuerpos', nombre: 'Partecuerpos', con: ['bate', 'cuchillas'], hueco: 'melee', icono: 'bate', damage: 22,
    desc: 'Golpe en arco ancho que hace sangrar' },
  { id: 'supersoplete', nombre: 'Súpersoplete', con: ['spray', 'mechero'], hueco: 'ranged', icono: 'spray', damage: 7,
    desc: 'Llamarada en cono, muy corta y muy fuerte' },
  { id: 'desintegrador', nombre: 'Desintegrador', con: ['pistolaAgua', 'lejia'], hueco: 'ranged', icono: 'lejia', damage: 3,
    desc: 'Chorro de ácido: daño continuo y charco ácido' },
  { id: 'molotov', nombre: 'Cóctel molotov', con: ['alcohol', 'trapo'], hueco: 'arrojadiza', icono: 'alcohol', damage: 0, unidades: 3,
    desc: 'Botellas que dejan un charco de fuego' },
  { id: 'atraedora', nombre: 'Atraedora', con: ['explosivos', 'despertador'], hueco: 'arrojadiza', icono: 'despertador', damage: 80, unidades: 3,
    desc: 'Suena, atrae a los zombis 3 s y explota' },
  { id: 'congeladora', nombre: 'Congeladora', con: ['explosivos', 'extintor'], hueco: 'arrojadiza', icono: 'extintor', damage: 50, unidades: 3,
    desc: 'Explota y deja a los zombis congelados 3 s' },
  { id: 'lluviaAcida', nombre: 'Lluvia ácida', con: ['explosivos', 'lejia'], hueco: 'arrojadiza', icono: 'explosivos', damage: 50, unidades: 3,
    desc: 'Explota y deja un charco ácido grande' },
  { id: 'inmovilizadora', nombre: 'Inmovilizadora', con: ['taser', 'bate'], hueco: 'melee', icono: 'taser', damage: 20,
    desc: 'La descarga aturde y salta a un zombi cercano' },
  { id: 'bumeran', nombre: 'Bumerán segador', con: ['llaveInglesa', 'hacha'], hueco: 'ranged', icono: 'hacha', damage: 14,
    desc: 'Se lanza, atraviesa zombis y vuelve a la mano; sin munición' },
  { id: 'latigo', nombre: 'Látigo escorpión', con: ['cuerda', 'cuchillo'], hueco: 'melee', icono: 'cuerda', damage: 12,
    desc: 'Alcance largo y envenena' },
  { id: 'supermaza', nombre: 'Súper maza', con: ['fregona', 'mancuernas'], hueco: 'melee', icono: 'mancuernas', damage: 24,
    desc: 'Lenta: golpe en círculo con temblor' },
];

// Rarezas del arma creada: probabilidad, cuánto multiplica el daño y unidades de más en las arrojadizas.
// `clase` es el color del borde en los menús (.inv-casilla en style.css)
export const RAREZAS = [
  { id: 'verde', nombre: 'Poco común', prob: 0.75, mul: 1, extra: 0 },
  { id: 'azul', nombre: 'Rara', prob: 0.20, mul: 1.2, extra: 1 },
  { id: 'morada', nombre: 'Épica', prob: 0.05, mul: 1.45, extra: 2 },
];

export const HUECOS = { melee: 'Cuerpo a cuerpo', ranged: 'A distancia', arrojadiza: 'Arrojadiza' };

// La receta que sale con estos dos ingredientes (en cualquier orden), o null
export function buscarReceta(a, b) {
  return RECETAS.find((r) => (r.con[0] === a && r.con[1] === b) || (r.con[0] === b && r.con[1] === a)) || null;
}

// Tira el dado de la rareza
export function rarezaAlAzar(azar = Math.random()) {
  let acum = 0;
  for (const r of RAREZAS) { acum += r.prob; if (azar < acum) return r; }
  return RAREZAS[0];
}

// El arma creada que se guarda en el inventario: la receta con su rareza ya aplicada
export function crearArma(receta, rareza = rarezaAlAzar()) {
  return {
    receta: receta.id, nombre: receta.nombre, hueco: receta.hueco, icono: receta.icono, desc: receta.desc,
    rareza: rareza.id,
    damage: Math.round(receta.damage * rareza.mul),
    unidades: receta.unidades ? receta.unidades + rareza.extra : 0,
  };
}
