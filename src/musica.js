// ─────────────────────────────────────────────
//  Música de fondo: siniestra, tensa y que nunca suena igual
//
//  No es una melodía fija que se repite: son unas reglas y un dado. Cada pocos
//  compases el dado decide el acorde siguiente, qué capas suenan y cómo:
//    · zumbido grave que no para (y se desafina cuando sube la tensión)
//    · latido (bombo de corazón), arpegio que se desfasa del compás y tics
//    · cajita de música desafinada, con un motivo que vuelve cambiado
//    · sucesos sueltos: golpe lejano, chirrido, lamento, cuerdas, campanada
//  La canción va por tramos con un "nivel" de tensión (0 calma … 4 frenesí) que
//  sube y baja solo; de vez en cuando cae de golpe a casi silencio.
//
//  El dado es propio (no Math.random) para no cambiar el azar de las partidas.
// ─────────────────────────────────────────────

const RAIZ = 73.42;                       // re grave
const hz = (semi) => RAIZ * 2 ** (semi / 12);
const ESCALA = [0, 1, 3, 5, 7, 8, 10];    // re frigio: el mi bemol pegado al re da el aire siniestro

// Acordes (semitonos sobre re): sus notas y a cuáles suele ir después (con su peso)
const ACORDES = {
  0: { notas: [0, 3, 7], siguen: [[1, 3], [5, 2], [8, 2], [6, 1], [7, 1]] },
  1: { notas: [1, 5, 8], siguen: [[0, 4], [6, 1]] },        // mi bemol: el más inquietante
  5: { notas: [5, 8, 12], siguen: [[0, 2], [1, 2], [8, 1]] },
  6: { notas: [6, 9, 12], siguen: [[0, 2], [5, 1]] },       // disminuido sobre el tritono
  7: { notas: [7, 11, 14], siguen: [[0, 3], [8, 1]] },
  8: { notas: [8, 12, 15], siguen: [[7, 2], [1, 1], [0, 2]] },
};

// Cada momento del juego: tempo, niveles de tensión permitidos y largo de los tramos (en compases)
const MODOS = {
  menu: { bpm: 70, niveles: [0, 1], compases: [6, 10] },
  explore: { bpm: 88, niveles: [0, 3], compases: [4, 8] },
  boss: { bpm: 124, niveles: [2, 4], compases: [2, 4] },
};

// El motivo que vuelve de vez en cuando (posición en la escala, en corcheas)
const MOTIVO = [[0, 0], [1, 1], [0, 2], [-1, 3], [0, 5]];

// Dado con semilla (mulberry32)
function semilla(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eco de una sala grande: ruido que se apaga poco a poco
function impulso(ac, segundos, azar) {
  const largo = Math.floor(ac.sampleRate * segundos);
  const buf = ac.createBuffer(2, largo, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < largo; i++) d[i] = (azar() * 2 - 1) * (1 - i / largo) ** 3;
  }
  return buf;
}

// `callado()` dice si no hace falta sonar (mudo o música apagada): así no gasta en notas
export function crearMusica(ac, salida, callado = () => false) {
  const azar = semilla((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
  const dado = (n) => Math.floor(azar() * n);
  const elige = (lista) => lista[dado(lista.length)];
  const prob = (p) => azar() < p;
  const entre = (a, b) => a + azar() * (b - a);
  const pesos = (lista) => {
    let r = azar() * lista.reduce((s, [, p]) => s + p, 0);
    for (const [v, p] of lista) if ((r -= p) <= 0) return v;
    return lista[0][0];
  };

  // ── Mezcla: todo pasa por `bus`; parte va al eco grande y la cajita, además, a un eco corto
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.connect(salida);
  const seco = ac.createGain();
  seco.connect(bus);
  const reverb = ac.createConvolver();
  reverb.buffer = impulso(ac, 3.5, azar);
  const revVol = ac.createGain();
  revVol.gain.value = 0.7;
  reverb.connect(revVol).connect(bus);
  const eco = ac.createDelay(2);
  const ecoVuelta = ac.createGain();
  ecoVuelta.gain.value = 0.38;
  const ecoFiltro = ac.createBiquadFilter();
  ecoFiltro.type = 'lowpass';
  ecoFiltro.frequency.value = 1800;
  eco.connect(ecoFiltro).connect(ecoVuelta).connect(eco);
  ecoFiltro.connect(seco);
  ecoFiltro.connect(reverb);

  const ruidoBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  { const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = azar() * 2 - 1; }

  // Volumen de una nota: sube en `ataque`, y baja hasta apagarse al final (o se sostiene y suelta)
  function envolvente(t, ataque, dur, vol, suelta = 0) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    if (suelta) g.gain.setValueAtTime(vol, t + dur - suelta);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  // Manda un sonido a la mezcla: a un lado u otro, y con más o menos eco
  function aMezcla(nodo, pan, rev, conEco) {
    let n = nodo;
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      n.connect(p);
      n = p;
    }
    n.connect(seco);
    if (rev) { const r = ac.createGain(); r.gain.value = rev; n.connect(r).connect(reverb); }
    if (conEco) { const e = ac.createGain(); e.gain.value = conEco; n.connect(e).connect(eco); }
  }

  function filtro(tipo, f, q = 1) {
    const bq = ac.createBiquadFilter();
    bq.type = tipo;
    bq.frequency.value = f;
    bq.Q.value = q;
    return bq;
  }

  // Una nota de un oscilador, con filtro, deslizamiento y vibrato opcionales
  function voz(t, { f, tipo = 'sine', dur, vol, ataque = 0.005, suelta = 0, corte, corteFin, q = 1, desafina = 0,
    hasta, vibrato, pan = 0, rev = 0.3, conEco = 0 }) {
    const o = ac.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = desafina;
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    let n = o;
    if (corte) {
      const bq = filtro('lowpass', corte, q);
      bq.frequency.setValueAtTime(corte, t);
      if (corteFin) bq.frequency.exponentialRampToValueAtTime(corteFin, t + dur);
      n.connect(bq);
      n = bq;
    }
    if (vibrato) {
      const l = ac.createOscillator();
      const lg = ac.createGain();
      l.frequency.value = vibrato[0];
      lg.gain.value = vibrato[1];
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.05);
    }
    const g = envolvente(t, ataque, dur, vol, suelta);
    n.connect(g);
    aMezcla(g, pan, rev, conEco);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Un soplo de ruido filtrado (tics, chirridos, el golpe del latido)
  function ruido(t, { dur, vol, tipo = 'highpass', f, fFin, q = 1, ataque = 0.002, pan = 0, rev = 0.2 }) {
    const src = ac.createBufferSource();
    src.buffer = ruidoBuf;
    src.loop = true;
    const bq = filtro(tipo, f, q);
    bq.frequency.setValueAtTime(f, t);
    if (fFin) bq.frequency.exponentialRampToValueAtTime(fFin, t + dur);
    const g = envolvente(t, ataque, dur, vol);
    src.connect(bq).connect(g);
    aMezcla(g, pan, rev, 0);
    src.start(t, azar() * 1.5);
    src.stop(t + dur + 0.05);
  }

  // ═════ Los instrumentos ═════

  // Zumbido: suena todo el rato; cambia de nota despacio, deslizándose
  let zumbido = null;
  function encenderZumbido(t) {
    const fil = filtro('lowpass', 160, 3);
    const lfo = ac.createOscillator();
    const lfoVol = ac.createGain();
    lfo.frequency.value = entre(0.04, 0.09);
    lfoVol.gain.value = 110;
    lfo.connect(lfoVol).connect(fil.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.016, t + 4);
    fil.connect(g);
    aMezcla(g, 0, 0.4, 0);
    const osc = (tipo, f, desafina, vol) => {
      const o = ac.createOscillator();
      const v = ac.createGain();
      o.type = tipo;
      o.frequency.value = f;
      o.detune.value = desafina;
      v.gain.value = vol;
      o.connect(v).connect(fil);
      o.start(t);
      return o;
    };
    zumbido = {
      fil, g, lfo,
      a: osc('sawtooth', RAIZ, -9, 1),
      b: osc('sawtooth', RAIZ, 9, 1),
      sub: osc('sine', RAIZ / 2, 0, 1.6),
      otra: osc('sawtooth', hz(7), 4, 0.55),   // segunda voz: quinta en calma, choque en tensión
    };
    lfo.start(t);
  }
  function moverZumbido(t, raiz, nivel) {
    if (!zumbido) return;
    const semi = raiz > 6 ? raiz - 12 : raiz;  // que se quede siempre en la zona grave
    const intervalo = nivel <= 1 ? elige([7, 12]) : nivel === 2 ? elige([7, 6, 13]) : elige([6, 13, 1]);
    const lento = nivel >= 3 ? 0.25 : 0.9;
    zumbido.a.frequency.setTargetAtTime(hz(semi), t, lento);
    zumbido.b.frequency.setTargetAtTime(hz(semi), t, lento);
    zumbido.sub.frequency.setTargetAtTime(hz(semi) / 2, t, lento);
    zumbido.otra.frequency.setTargetAtTime(hz(semi + intervalo), t, lento * 2);
    zumbido.fil.frequency.setTargetAtTime([150, 220, 320, 460, 600][nivel], t, 2);
    zumbido.g.gain.setTargetAtTime([0.018, 0.016, 0.014, 0.013, 0.013][nivel], t, 1.5);
  }
  function apagarZumbido(t) {
    if (!zumbido) return;
    zumbido.g.gain.setTargetAtTime(0.0001, t, 0.6);
    for (const o of [zumbido.a, zumbido.b, zumbido.sub, zumbido.otra, zumbido.lfo]) o.stop(t + 3);
    zumbido = null;
  }

  // Latido: bombo grave como un corazón (1 = fuerte, 2 = el "dub" suave)
  function latido(t, golpe) {
    const fuerte = golpe === 1;
    voz(t, { f: fuerte ? 72 : 62, hasta: 34, dur: fuerte ? 0.32 : 0.24, vol: fuerte ? 0.3 : 0.18, rev: 0.15 });
    ruido(t, { dur: 0.05, vol: fuerte ? 0.05 : 0.03, tipo: 'lowpass', f: 900, rev: 0.1 });
  }

  // Arpegio: nota corta con el filtro cerrándose (como una cuerda punteada en un sótano)
  function punteo(t, f, pan) {
    voz(t, { f, tipo: 'sawtooth', dur: 0.32, vol: 0.05, corte: 1600, corteFin: 220, q: 6, pan, rev: 0.35 });
  }

  // Bajo que empuja (solo con mucha tensión)
  function bajo(t, f, dur) {
    voz(t, { f, tipo: 'sawtooth', dur, vol: 0.07, corte: 700, corteFin: 160, q: 3, rev: 0.1 });
  }

  // Tic: como un reloj o una gota, de un lado a otro
  function tic(t, fuerte) {
    ruido(t, { dur: fuerte ? 0.05 : 0.025, vol: fuerte ? 0.045 : 0.025, tipo: 'highpass', f: 6500, pan: entre(-0.7, 0.7), rev: 0.3 });
  }

  // Cajita de música desafinada: seno con un armónico de campana y eco corto
  function cajita(t, f, vol = 0.04) {
    const desafina = entre(-14, 14);
    const pan = entre(-0.5, 0.5);
    voz(t, { f, dur: 1.8, vol, desafina, pan, rev: 0.55, conEco: 0.5 });
    voz(t, { f: f * 2.76, dur: 0.5, vol: vol * 0.25, desafina, pan, rev: 0.5 });
  }

  // ── Sucesos sueltos
  // Golpe lejano: una puerta que se cierra en otro piso
  function golpe(t) {
    voz(t, { f: 58, hasta: 28, dur: 1.1, vol: 0.32, rev: 0.9, pan: entre(-0.6, 0.6) });
    ruido(t, { dur: 0.7, vol: 0.12, tipo: 'lowpass', f: 380, fFin: 90, rev: 0.9 });
  }
  // Chirrido: metal arrastrado o una puerta que se abre sola
  function chirrido(t) {
    const sube = prob(0.5);
    const dur = entre(1.4, 3);
    ruido(t, { dur, vol: 0.05, tipo: 'bandpass', f: sube ? 700 : 2600, fFin: sube ? 2400 : 650, q: 18, ataque: dur * 0.4, pan: entre(-0.9, 0.9), rev: 0.7 });
    voz(t, { f: sube ? 900 : 1500, hasta: sube ? 1250 : 1000, tipo: 'square', dur, vol: 0.006, ataque: dur * 0.5, corte: 2500, pan: entre(-0.9, 0.9), rev: 0.6 });
  }
  // Lamento: un "uuuh" agudo que cae un poco, con vibrato, como una voz lejana
  function lamento(t, raiz) {
    const f = hz(raiz + 36 + elige([0, 3, 7]));
    const dur = entre(3, 5);
    voz(t, { f, hasta: f * 2 ** (-elige([1, 2]) / 12), dur, vol: 0.03, ataque: dur * 0.35, vibrato: [entre(4, 6), f * 0.012], pan: entre(-0.6, 0.6), rev: 0.85 });
  }
  // Cuerdas: un racimo de notas que chocan, entrando muy despacio
  function cuerdas(t, raiz, dur) {
    for (const s of [12, 13, 18, 24]) {
      if (s === 24 && prob(0.5)) continue;
      voz(t, { f: hz(raiz + s), tipo: 'sawtooth', dur, vol: 0.016, ataque: dur * 0.45, suelta: dur * 0.4, corte: 1300, desafina: entre(-12, 12),
        vibrato: [entre(4.5, 6), 1.5], pan: entre(-0.7, 0.7), rev: 0.6 });
    }
  }
  // Campanada grave: la campana de una iglesia vacía
  function campanada(t, raiz) {
    const f = hz((raiz > 6 ? raiz - 12 : raiz) + 24);
    for (const [m, v, d] of [[0.5, 0.05, 5], [1, 0.05, 4], [1.19, 0.025, 3], [1.56, 0.02, 2.5], [2, 0.018, 2], [2.66, 0.012, 1.5]]) {
      voz(t, { f: f * m, dur: d, vol: v, rev: 0.8 });
    }
  }

  // ═════ El director: decide tramos, acordes y patrones ═════
  let modo = null, activa = false, siguiente = 0, paso = 0, temporizador = null;
  let tramo = null, acorde = 0, compasesAcorde = 0, pasoArpegio = 0, notaMelodia = 0;

  function nuevoTramo() {
    const m = MODOS[modo];
    const [min, max] = m.niveles;
    let nivel = tramo ? tramo.nivel + elige([-1, 0, 1, 1]) : min + (modo === 'explore' ? 1 : 0);
    if (tramo && prob(0.1)) nivel = min;               // caída de golpe a casi silencio
    nivel = Math.max(min, Math.min(max, nivel));
    tramo = {
      nivel,
      compases: m.compases[0] + dado(m.compases[1] - m.compases[0] + 1),
      bpm: m.bpm + entre(-3, 3) + nivel * 2,
      latido: patronLatido(nivel),
      arpegio: nivel >= 1 && prob(0.35 + nivel * 0.2) ? patronArpegio(nivel) : null,
      tics: nivel >= 2 ? 0.3 + (nivel - 2) * 0.3 : nivel === 1 && prob(0.3) ? 0.15 : 0,
      bajo: nivel >= 3 && prob(0.75) ? elige(['corcheas', 'galope', 'negras']) : null,
      melodia: [0.6, 0.5, 0.35, 0.25, 0.15][nivel],
      cadaAcorde: nivel >= 4 ? 1 : nivel >= 2 ? elige([2, 2, 4]) : elige([2, 4, 4]),
    };
    pasoArpegio = 0;
  }

  // Patrón de 16 pasos del latido según la tensión (0 = nada, 1 = fuerte, 2 = suave)
  function patronLatido(nivel) {
    const p = new Array(16).fill(0);
    if (nivel === 0) return prob(0.3) ? (p[0] = 1, p[3] = 2, p) : null;
    if (nivel === 1) { p[0] = 1; p[3] = 2; if (prob(0.5)) { p[8] = 1; p[11] = 2; } return p; }
    if (nivel === 2) { for (const i of elige([[0, 8], [0, 6, 8], [0, 10], [0, 3, 8, 11]])) p[i] = 1; return p; }
    for (const i of elige([[0, 4, 8, 12], [0, 3, 6, 8, 12], [0, 3, 8, 10, 11]])) p[i] = 1;
    if (nivel >= 4) for (const i of [2, 6, 10, 14]) if (prob(0.5)) p[i] = 2;
    return p;
  }

  // Arpegio con su propio largo (7, 9, 10…): como no cuadra con el compás, se va desplazando
  function patronArpegio(nivel) {
    const largo = elige(nivel >= 3 ? [6, 7, 10, 12] : [7, 9, 10, 12, 14]);
    const cada = nivel >= 3 ? 1 : elige([1, 2]);
    const densidad = 0.45 + nivel * 0.1;
    const p = [];
    let g = dado(3);
    for (let i = 0; i < largo; i++) {
      if (i % cada === 0 && (i === 0 || prob(densidad))) {
        g = Math.max(0, Math.min(5, g + elige([-1, 1, 1, 2, -2])));
        p.push(g);       // 0–2 = notas del acorde, 3–5 = las mismas una octava arriba
      } else p.push(null);
    }
    return p;
  }

  // Cada compás: tramo y acorde nuevos si toca, frase de la cajita y sucesos
  function compas(t, negra) {
    if (!tramo || --tramo.compases < 0) nuevoTramo();
    const nivel = tramo.nivel;
    if (--compasesAcorde <= 0) {
      acorde = pesos(ACORDES[acorde].siguen);
      compasesAcorde = tramo.cadaAcorde;
      moverZumbido(t, acorde, nivel);
    }
    if (prob(tramo.melodia)) frase(t, negra);
    if (prob([0.15, 0.12, 0.1, 0.12, 0.15][nivel])) golpe(t + negra * dado(4));
    if (prob([0.12, 0.12, 0.15, 0.15, 0.1][nivel])) chirrido(t + negra * entre(0, 3));
    if (prob([0.12, 0.1, 0.08, 0.05, 0.03][nivel])) lamento(t + negra * entre(0, 2), acorde);
    if (nivel >= 2 && prob(nivel >= 3 ? 0.3 : 0.15)) cuerdas(t, acorde, negra * 4 * tramo.cadaAcorde);
    if (prob(nivel === 0 ? 0.1 : nivel >= 4 ? 0.25 : 0.03)) campanada(t, acorde);
  }

  // Una frase corta de la cajita: a veces el motivo (cambiado), a veces un paseo por la escala
  function frase(t, negra) {
    const corchea = negra / 2;
    const base = Math.max(0, ESCALA.indexOf(ACORDES[acorde].notas[0] % 12));
    if (prob(0.3)) {
      const lento = prob(0.3) ? 2 : 1;       // a veces a la mitad de velocidad
      const vuelta = prob(0.3) ? -1 : 1;     // a veces del revés (bajando en vez de subir)
      for (const [g, pos] of MOTIVO) cajita(t + pos * corchea * lento, notaEscala(base + g * vuelta, 24));
      return;
    }
    let pos = dado(3);
    const notas = 2 + dado(4);
    notaMelodia = base + dado(5);
    for (let i = 0; i < notas && pos < 16; i++) {
      cajita(t + pos * corchea, notaEscala(notaMelodia, 24), 0.035);
      notaMelodia += elige([-2, -1, -1, 1, 1, 2, 0, -3]);
      notaMelodia = Math.max(base - 4, Math.min(base + 9, notaMelodia));
      pos += elige([1, 1, 2, 2, 3]);
    }
  }
  // Grado de la escala (puede pasar de 7 o ser negativo) → frecuencia, desde `octava` semitonos
  function notaEscala(grado, octava) {
    const o = Math.floor(grado / 7);
    const g = ((grado % 7) + 7) % 7;
    return hz(octava + o * 12 + ESCALA[g]);
  }

  // Programa los pasos (semicorcheas) que caen antes de `hasta`
  function programar(hasta = ac.currentTime + 0.3) {
    if (!activa) return;
    // Si la pestaña estuvo dormida, no recuperar de golpe lo atrasado
    if (siguiente < ac.currentTime) siguiente = ac.currentTime + 0.05;
    while (siguiente < hasta) {
      const i = paso % 16;
      if (i === 0 && !tramo) nuevoTramo();
      const negra = 60 / tramo.bpm;
      const semi = negra / 4;
      const t = siguiente;
      if (!callado()) tocarPaso(t, i, negra, semi);
      siguiente += semi;
      paso++;
    }
  }

  function tocarPaso(t, i, negra, semi) {
    if (i === 0) compas(t, negra);
    const nivel = tramo.nivel;
    const notas = ACORDES[acorde].notas;
    if (tramo.latido?.[i]) latido(t, tramo.latido[i]);
    if (tramo.arpegio) {
      const g = tramo.arpegio[pasoArpegio++ % tramo.arpegio.length];
      if (g !== null) punteo(t, hz(notas[g % 3] + 12 + (g >= 3 ? 12 : 0)), g % 2 ? 0.35 : -0.35);
    }
    if (tramo.tics && i % 2 === 0 && prob(tramo.tics)) tic(t, i % 4 === 0);
    if (tramo.bajo) {
      const f = hz((notas[0] > 6 ? notas[0] - 12 : notas[0]));
      const toca = tramo.bajo === 'corcheas' ? i % 2 === 0 : tramo.bajo === 'negras' ? i % 4 === 0 : [0, 3, 6, 8, 11, 14].includes(i);
      if (toca) bajo(t, i % 8 === 6 && prob(0.4) ? f * 2 : f, semi * 1.8);
    }
    if (nivel >= 4 && i === 15 && prob(0.5)) ruido(t, { dur: 0.25, vol: 0.06, tipo: 'bandpass', f: 1200, fFin: 4000, q: 2, ataque: 0.2 });
  }

  return {
    // 'menu', 'explore', 'boss' o null (para que se apague despacio)
    play(nombre) {
      if (nombre === modo) return;
      const t = ac.currentTime;
      if (!nombre) {
        modo = null;
        activa = false;
        clearInterval(temporizador);
        bus.gain.setTargetAtTime(0.0001, t, 0.4);
        apagarZumbido(t);
        return;
      }
      const antes = modo;
      modo = nombre;
      if (!activa) {
        activa = true;
        tramo = null;
        paso = 0;
        compasesAcorde = 0;
        acorde = 0;
        siguiente = t + 0.1;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(1.8, t, 0.8);
        encenderZumbido(t);
        moverZumbido(t, 0, 0);
        clearInterval(temporizador);
        temporizador = setInterval(() => programar(), 50);
      } else if (antes) {
        // Cambio de momento (p. ej. aparece el jefe): tramo nuevo ya, sin cortar el zumbido
        tramo = null;
        nuevoTramo();
      }
    },
    programar,   // para grabarla sin tiempo real (OfflineAudioContext)
    // Para mirar desde la consola cómo va: nivel de tensión, acorde y compases que le quedan al tramo
    estado: () => tramo && { nivel: tramo.nivel, acorde, compases: tramo.compases, bpm: Math.round(tramo.bpm) },
  };
}
