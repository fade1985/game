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
  slam: () => { tone(110, 0.16, 'square', 0.07, -50); tone(70, 0.22, 'triangle', 0.08, -20, 0.03); },
  boss: () => { tone(110, 0.6, 'sawtooth', 0.06, -40); tone(82, 0.8, 'sawtooth', 0.05, -20, 0.2); },
  enemyShot: throttled('eshot', 80, () => tone(330, 0.08, 'sine', 0.025, -150)),
};
