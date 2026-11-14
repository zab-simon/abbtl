// Звуки синтезируются (без файлов). Выключаются в настройках.
let ctx = null;
let enabled = true;
export function setSound(on) { enabled = on; }
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t0 = c.currentTime + when;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
export const sfx = {
  dice() { if (!enabled) return; for (let i = 0; i < 6; i++) tone(180 + Math.random() * 400, 0.05, 'square', 0.05, i * 0.06); },
  step() { if (enabled) tone(880, 0.03, 'triangle', 0.05); },
  cashIn() { if (!enabled) return; tone(988, 0.08, 'sine', 0.1); tone(1319, 0.15, 'sine', 0.1, 0.08); },
  cashOut() { if (!enabled) return; tone(440, 0.08, 'sine', 0.1); tone(330, 0.15, 'sine', 0.1, 0.08); },
  card() { if (enabled) tone(600, 0.06, 'sawtooth', 0.04); },
  win() { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, i * 0.12)); },
};
