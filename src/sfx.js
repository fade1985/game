// ─────────────────────────────────────────────
//  Efectos de sonido sintetizados (sin archivos de audio)
// ─────────────────────────────────────────────
let ac = null;
let muted = false;
const last = {};

export function unlockAudio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  if (ac.state === 'suspended') ac.resume();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

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
  enemyShot: throttled('eshot', 80, () => tone(330, 0.08, 'sine', 0.025, -150)),
};
