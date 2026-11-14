// Детерминированный генератор случайных чисел (mulberry32).
// Состояние генератора хранится внутри состояния игры, поэтому одинаковые
// действия всегда дают одинаковый результат: это нужно для игры по сети,
// для сохранения и для воспроизведения ошибок.

export function nextRandom(seed) {
  let t = (seed + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, seed: t };
}

// Работает с объектом state.rng = { seed }. Мутирует только переданный черновик.
export function rollDie(rng) {
  const { value, seed } = nextRandom(rng.seed);
  rng.seed = seed;
  return 1 + Math.floor(value * 6);
}

export function randomInt(rng, n) {
  const { value, seed } = nextRandom(rng.seed);
  rng.seed = seed;
  return Math.floor(value * n);
}

export function shuffle(rng, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
