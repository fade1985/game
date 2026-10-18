// ─────────────────────────────────────────────
//  Catálogo de muebles, sala por sala
//
//  Todo lo que decide qué muebles salen y dónde está aquí, en un solo sitio:
//    MUEBLES → cada mueble: sus medidas, en qué paredes puede ir y cómo se llama su archivo original
//    SALAS   → cada sala: qué muebles lleva, cuántos, cuántos iguales y (baño y cocina) las plantillas
//              de la pared del fondo
//
//  Los originales (los dibujos grandes) están en assets/sources/salas/<carpeta>/<archivo>.png
//  (y <archivo>-lado.png, el dibujo para las paredes laterales). El juego usa el sprite mueble-<tipo>
//  de assets/sprites/; si no lo hay, el dibujo de antes (furniture.js).
//  Variantes: nevera-b.png, nevera-c.png… (sprites mueble-fridge-b, -c…; de lado, nevera-b-lado.png). Cada
//  apartamento elige una por tipo (furniture.js → variante). Todas miden lo mismo de ancho: el `len` de aquí.
//  `py tools/importar.py` convierte las imágenes nuevas o cambiadas en sprites (y los deja a ese ancho).
// ─────────────────────────────────────────────

// Cada mueble, por su tipo (el nombre que usa el juego):
//   len     largo a lo largo de la pared (el ancho del dibujo: así se choca justo con lo que se ve)
//   dep     fondo hacia la sala
//   paredes en qué paredes puede ir. En la de arriba (el fondo), todos: se les ve de frente.
//           'lados' → también en las laterales: tiene dibujo de lado (en la derecha se pone en espejo)
//           'todas' → en cualquiera, también en la de abajo: se ve igual desde cualquier sitio
//           (sin nada, solo en la del fondo: en las demás se vería de lado o de espaldas)
//   archivo nombre del original en assets/sources/salas/<carpeta>/
export const MUEBLES = {
  sofa:       { len: 146, dep: 60,  paredes: 'lados', archivo: 'salon/sofa' },
  tv:         { len: 84,  dep: 40,                    archivo: 'salon/tele' },
  armchair:   { len: 76,  dep: 60,  paredes: 'lados', archivo: 'salon/sillon' },
  bookshelf:  { len: 86,  dep: 34,                    archivo: 'salon/estanteria' },
  lamp:       { len: 30,  dep: 30,  paredes: 'todas', archivo: 'comun/lampara' },
  counter:    { len: 158, dep: 50,                    archivo: 'cocina/encimera' },
  fridge:     { len: 62,  dep: 58,                    archivo: 'cocina/nevera' },
  stove:      { len: 56,  dep: 50,                    archivo: 'cocina/fogon' },
  bed:        { len: 84,  dep: 140,                   archivo: 'dormitorio/cama' },
  wardrobe:   { len: 96,  dep: 44,                    archivo: 'dormitorio/armario' },
  nightstand: { len: 40,  dep: 36,  paredes: 'lados', archivo: 'dormitorio/mesilla' },
  desk:       { len: 92,  dep: 50,                    archivo: 'dormitorio/escritorio' },
  shoerack:   { len: 74,  dep: 34,                    archivo: 'pasillo/zapatero' },
  coatstand:  { len: 36,  dep: 30,  paredes: 'todas', archivo: 'pasillo/perchero' },
  console:    { len: 68,  dep: 34,                    archivo: 'pasillo/consola' },
  bathtub:    { len: 116, dep: 60,  paredes: 'lados', archivo: 'bano/banera' },
  toilet:     { len: 52,  dep: 58,  paredes: 'lados', archivo: 'bano/vater' },
  sink:       { len: 64,  dep: 46,                    archivo: 'bano/lavabo' },
  washer:     { len: 46,  dep: 50,                    archivo: 'bano/lavadora' },
  plant:      { len: 40,  dep: 36,  paredes: 'todas', archivo: 'comun/planta' },
};

// Cada sala, por el nombre de su estilo (config.js):
//   muebles     los que puede tener (uno repetido en la lista sale más a menudo)
//   cuantos     [mínimo, máximo] de muebles sueltos (en las habitaciones grandes, alguno más)
//   iguales     cuántos de un mismo mueble caben (los que no salen aquí, uno)
//   plantillas  la pared del fondo es la que más se ve (es alta y de frente), así que en baño y cocina no se
//               llena al azar: cada plantilla dice qué va en ella de izquierda a derecha y el juego elige una
//               que quepa. Los marcados con '?' son opcionales: si no cabe todo, se quitan en el orden de
//               `quitar`. Cada mueble sale una vez por plantilla (nunca dos lavadoras en el mismo baño).
//               Con plantillas, solo se amuebla la pared del fondo; si en ella no cabe nada (una puerta en
//               medio), muebles sueltos en las demás paredes, como en las otras salas.
export const SALAS = {
  'Salón': {
    muebles: ['sofa', 'tv', 'armchair', 'bookshelf', 'lamp', 'plant'],
    cuantos: [4, 7],
    cuantosJefe: [2, 3], // el apartamento destrozado del jefe usa el estilo del salón, con menos muebles
  },
  'Cocina': {
    muebles: ['counter', 'fridge', 'stove', 'counter', 'plant'],
    cuantos: [2, 4],
    iguales: { counter: 2 },
    // el fogón es obligatorio; la encimera es larga (158), así que en las cocinas pequeñas se queda fuera
    plantillas: [
      ['fridge', 'counter?', 'stove', 'plant?'],
      ['counter?', 'stove', 'fridge?', 'plant?'],
      ['fridge?', 'stove', 'counter?'],
      ['plant?', 'fridge?', 'counter?', 'stove'],
      ['counter?', 'stove', 'counter?', 'fridge?'],
      ['fridge?', 'counter?', 'stove', 'counter?'],
    ],
    quitar: ['plant', 'counter', 'fridge'],
  },
  'Dormitorio': {
    muebles: ['bed', 'wardrobe', 'nightstand', 'desk', 'lamp'],
    cuantos: [2, 4],
    iguales: { nightstand: 2 },
  },
  'Baño': {
    muebles: ['bathtub', 'toilet', 'sink', 'washer'],
    cuantos: [1, 3],
    plantillas: [
      ['bathtub?', 'toilet', 'sink?'],
      ['sink?', 'toilet', 'bathtub?'],
      ['toilet', 'sink?', 'washer?'],
      ['washer?', 'sink?', 'toilet'],
      ['sink?', 'toilet', 'washer?'],
      ['bathtub?', 'sink?', 'toilet'],
    ],
    quitar: ['bathtub', 'washer', 'sink'],
  },
  'Pasillo': {
    muebles: ['shoerack', 'coatstand', 'console', 'plant', 'bookshelf'],
    cuantos: [5, 8],
    fondoMax: 46,         // el pasillo de cada planta es estrecho: solo muebles poco hondos
    cuantosMenu: [2, 3],  // el fondo del menú también usa el estilo del pasillo
  },
  // en mantenimiento la pared de arriba es para los muebles de las armas
  'Mantenimiento': {
    muebles: ['washer', 'bookshelf', 'desk', 'wardrobe', 'shoerack'],
    cuantos: [2, 3],
  },
};
