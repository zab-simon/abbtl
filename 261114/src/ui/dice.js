// Объёмные кубики (CSS 3D). Быстро пролетают через экран и останавливаются на выпавшем значении.
// Значение задаёт движок; здесь только показ.
import { h, sleep } from './dom.js';
import { sfx } from './sound.js';

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
// грань → поворот, при котором она смотрит на зрителя
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
const FACES = [['front', 1], ['back', 6], ['right', 3], ['left', 4], ['top', 5], ['bottom', 2]];

function face(cls, n) {
  return h('div.die-face.' + cls, {}, ...Array.from({ length: 9 }, (_, i) =>
    h('span.pip' + (PIPS[n].includes(i + 1) ? '.on' : ''))));
}
function makeDie() { return h('div.die', {}, ...FACES.map(([c, n]) => face(c, n))); }

export async function showDice(values, duration) {
  const layer = h('div.dice-layer');
  document.body.append(layer);
  sfx.dice();
  const W = window.innerWidth, H = window.innerHeight;
  const anims = values.map((v, i) => {
    const holder = h('div.die-holder');
    const die = makeDie();
    holder.append(die);
    layer.append(holder);
    const endX = W / 2 - 50 + (i - (values.length - 1) / 2) * 120;
    const endY = H / 2 - 50;
    const startX = -150 - i * 60, startY = H * 0.15 + i * 40;
    holder.animate([
      { transform: `translate(${startX}px, ${startY}px)` },
      { transform: `translate(${endX - 40}px, ${endY - 120}px)`, offset: 0.55 },
      { transform: `translate(${endX + 10}px, ${endY + 6}px)`, offset: 0.8 },
      { transform: `translate(${endX}px, ${endY}px)` },
    ], { duration, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    const [rx, ry] = FACE_ROT[v];
    const spinX = 720 + 360 * i, spinY = 720;
    return die.animate([
      { transform: `rotateX(${rx + spinX + 37}deg) rotateY(${ry + spinY + 53}deg) rotateZ(90deg)` },
      { transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(0deg)` },
    ], { duration, easing: 'cubic-bezier(.15,.6,.25,1)', fill: 'forwards' }).finished;
  });
  await Promise.all(anims);
  await sleep(Math.min(350, duration * 0.5));
  layer.classList.add('fade');
  setTimeout(() => layer.remove(), 250);
}
