// ─────────────────────────────────────────────
//  Sonido sintetizado (sin archivos de audio): efectos y música
//
//  Todo pasa por un volumen general con compresor para que, aunque suenen
//  muchos efectos a la vez, no se sature. La música es un pequeño secuenciador
//  que programa las notas con un poco de antelación.
// ─────────────────────────────────────────────
let ac = null;
let master = null, sfxOut = null, musicOut = null;
let muted = false;
let musicOn = true;
const last = {};

export function unlockAudio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(comp).connect(ac.destination);
    sfxOut = ac.createGain();
    sfxOut.gain.value = 1;
    sfxOut.connect(master);
    musicOut = ac.createGain();
    musicOut.gain.value = musicOn ? 0.55 : 0;
    musicOut.connect(master);
    if (wanted) music.play(wanted);
  }
  if (ac.state === 'suspended') ac.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.02);
  return muted;
}

export function setMusicOn(on) {
  musicOn = on;
  if (musicOut) musicOut.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.05);
}

function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0, out = sfxOut) {
  if (!ac || !out) return;
  const t = ac.currentTime + delay;
  playNote(t, freq, dur, type, vol, slide, out);
}

function playNote(t, freq, dur, type, vol, slide, out) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Ruido corto (platillos de la batería)
let noiseBuf = null;
function noise(t, dur, vol, out) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// ═════════════ Música ═════════════
// Cada canción: tempo, y patrones de 16 pasos (semicorcheas) por compás.
// Las notas son semitonos respecto a `root` (null = silencio).
const SONGS = {
  menu: {
    bpm: 92, root: 220,
    bass: [[0, null, null, null, 7, null, null, null, 3, null, null, null, 5, null, 7, null],
           [-4, null, null, null, 3, null, null, null, -2, null, null, null, 2, null, 3, null]],
    lead: [[12, null, 15, null, 19, null, 15, null, 14, null, 12, null, 10, null, null, null],
           [8, null, 12, null, 15, null, 12, null, 10, null, 14, null, 15, null, null, null]],
    drums: 'soft',
  },
  explore: {
    bpm: 112, root: 196,
    bass: [[0, null, 0, null, 7, null, 0, null, 3, null, 3, null, 10, null, 7, null],
           [-4, null, -4, null, 3, null, -4, null, -2, null, -2, null, 5, null, 2, null]],
    lead: [[null, 12, null, 15, null, 19, null, 15, null, 17, null, 15, null, 14, null, 10],
           [null, 8, null, 12, null, 15, null, 12, null, 14, null, 10, null, 7, null, null]],
    drums: 'beat',
  },
  boss: {
    bpm: 150, root: 165,
    bass: [[0, 0, 12, 0, 0, 12, 0, 0, 1, 1, 13, 1, 1, 13, 1, 3],
           [0, 0, 12, 0, 0, 12, 0, 0, -2, -2, 10, -2, 3, 3, 6, 7]],
    lead: [[12, null, null, 13, null, null, 15, null, 12, null, null, 18, null, 17, null, 13],
           [12, null, null, 13, null, null, 15, null, 19, null, 18, null, 15, null, 13, null]],
    drums: 'fast',
  },
};

const freqOf = (root, semi) => root * Math.pow(2, semi / 12);
let wanted = null;          // canción pedida (aunque el audio aún no esté activo)
let current = null, step = 0, nextTime = 0, timer = null;

function schedule() {
  const song = SONGS[current];
  if (!song || !ac) return;
  const stepDur = 60 / song.bpm / 4;
  while (nextTime < ac.currentTime + 0.12) {
    const bar = Math.floor(step / 16) % song.bass.length;
    const i = step % 16;
    const b = song.bass[bar][i];
    if (b !== null) playNote(nextTime, freqOf(song.root / 2, b), stepDur * 1.8, 'triangle', 0.09, 0, musicOut);
    const l = song.lead[bar][i];
    if (l !== null) playNote(nextTime, freqOf(song.root, l), stepDur * 1.6, 'square', 0.022, 0, musicOut);
    if (song.drums === 'beat') {
      if (i % 8 === 0) playNote(nextTime, 120, 0.12, 'sine', 0.12, -70, musicOut);
      if (i % 4 === 2) noise(nextTime, 0.04, 0.05, musicOut);
    } else if (song.drums === 'fast') {
      if (i % 4 === 0) playNote(nextTime, 120, 0.1, 'sine', 0.14, -70, musicOut);
      if (i % 2 === 1) noise(nextTime, 0.03, 0.05, musicOut);
      if (i === 4 || i === 12) noise(nextTime, 0.12, 0.08, musicOut);
    } else if (i % 8 === 4) {
      noise(nextTime, 0.03, 0.025, musicOut);
    }
    nextTime += stepDur;
    step++;
  }
}

export const music = {
  // Cambia de canción ('menu', 'explore', 'boss' o null para silencio)
  play(name) {
    wanted = name;
    if (!ac || name === current) return;
    current = name;
    step = 0;
    nextTime = ac.currentTime + 0.05;
    clearInterval(timer);
    timer = name ? setInterval(schedule, 30) : null;
  },
  // Melodía corta de victoria o derrota (para la música de fondo)
  jingle(kind) {
    this.play(null);
    if (!ac) return;
    const t = ac.currentTime + 0.05;
    const notes = kind === 'win' ? [0, 4, 7, 12, 7, 12, 16] : [7, 6, 5, 4, 3, 2, 0];
    const dur = kind === 'win' ? 0.12 : 0.2;
    notes.forEach((n, i) => playNote(t + i * dur, freqOf(kind === 'win' ? 392 : 196, n), dur * (i === notes.length - 1 ? 4 : 1.4), 'square', 0.05, 0, musicOut));
  },
};

// Evita que un mismo sonido se repita demasiado seguido
function throttled(name, gap, fn) {
  return () => {
    const now = performance.now();
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    fn();
  };
}

export const sfx = {
  shoot: throttled('shoot', 60, () => tone(620, 0.05, 'square', 0.012, -250)),
  hit: throttled('hit', 40, () => tone(240, 0.06, 'square', 0.025, -120)),
  kill: throttled('kill', 50, () => { tone(300, 0.12, 'triangle', 0.07, 400); }),
  coin: throttled('coin', 45, () => { tone(988, 0.05, 'square', 0.025); tone(1319, 0.08, 'square', 0.025, 0, 0.05); }),
  gem: () => { tone(1200, 0.08, 'sine', 0.06); tone(1800, 0.15, 'sine', 0.05, 0, 0.07); },
  hurt: () => tone(180, 0.25, 'sawtooth', 0.06, -90),
  dash: () => tone(260, 0.12, 'sine', 0.05, 420),
  door: () => { tone(400, 0.1, 'triangle', 0.06, 200); tone(600, 0.15, 'triangle', 0.05, 300, 0.08); },
  clear: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.035, 0, i * 0.09)); },
  card: () => tone(700, 0.1, 'triangle', 0.05, 300),
  buy: () => { tone(880, 0.07, 'square', 0.03); tone(1175, 0.1, 'square', 0.03, 0, 0.07); },
  nope: () => tone(150, 0.15, 'square', 0.04, -40),
  swing: throttled('swing', 40, () => tone(520, 0.1, 'triangle', 0.035, -380)),
  thud: throttled('thud', 40, () => { tone(150, 0.09, 'square', 0.05, -70); tone(90, 0.12, 'triangle', 0.06, -30); }),
  gun: throttled('gun', 50, () => { tone(950, 0.05, 'square', 0.03, -750); tone(170, 0.08, 'triangle', 0.05, -90); }),
  shotgun: () => { tone(120, 0.2, 'sawtooth', 0.07, -60); tone(700, 0.1, 'square', 0.035, -600); },
  beep: () => tone(1200, 0.06, 'square', 0.03),
  boom: () => { tone(90, 0.45, 'sawtooth', 0.09, -60); tone(50, 0.5, 'triangle', 0.1, -20, 0.02); tone(400, 0.15, 'square', 0.04, -350); },
  whip: () => { tone(300, 0.12, 'sawtooth', 0.05, 500); },
  spit: () => { tone(260, 0.12, 'sine', 0.06, -180); },
  splat: throttled('splat', 60, () => { tone(140, 0.12, 'triangle', 0.06, -80); tone(500, 0.06, 'sine', 0.03, -300); }),
  sizzle: throttled('sizzle', 450, () => tone(1800, 0.12, 'sawtooth', 0.012, -900)),
  heal: () => { tone(660, 0.1, 'sine', 0.05, 200); tone(990, 0.16, 'sine', 0.045, 300, 0.08); },
  allyGun: throttled('allyGun', 70, () => tone(760, 0.05, 'square', 0.018, -550)),
  slam: () => { tone(110, 0.16, 'square', 0.07, -50); tone(70, 0.22, 'triangle', 0.08, -20, 0.03); },
  boss: () => { tone(110, 0.6, 'sawtooth', 0.06, -40); tone(82, 0.8, 'sawtooth', 0.05, -20, 0.2); },
  roar: () => { tone(160, 0.5, 'sawtooth', 0.07, -90); tone(120, 0.6, 'square', 0.04, -60, 0.05); },
  charge: () => { tone(70, 0.6, 'sawtooth', 0.08, 40); tone(140, 0.3, 'square', 0.03, 80); },
  stomp: () => { tone(60, 0.5, 'sawtooth', 0.1, -30); tone(45, 0.6, 'triangle', 0.12, -15, 0.02); tone(300, 0.12, 'square', 0.04, -250); },
  broom: throttled('broom', 90, () => tone(900, 0.12, 'sawtooth', 0.018, -700)),
  glass: throttled('glass', 60, () => { tone(2200, 0.08, 'square', 0.025, -800); tone(1500, 0.12, 'triangle', 0.03, 600, 0.03); }),
  heartbeat: () => { tone(70, 0.12, 'sine', 0.18, -20); tone(60, 0.14, 'sine', 0.14, -15, 0.16); },
  enemyShot: throttled('eshot', 80, () => tone(330, 0.08, 'sine', 0.025, -150)),
};
