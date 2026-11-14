// Игровое поле (SVG): внутренний круг из 24 клеток, колоды в центре, фишки.
import { RAT_RACE } from '../data/board.js';
import { t } from '../i18n/index.js';
import { sleep } from './dom.js';
import { sfx } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 500, R_OUT = 480, R_IN = 330, N = RAT_RACE.length;
const START_ANGLE = 90; // «Старт» внизу, ход по часовой стрелке

function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
}
const rad = (d) => d * Math.PI / 180;
const pt = (r, a) => [C + r * Math.cos(rad(a)), C + r * Math.sin(rad(a))];
function cellAngle(i) { return START_ANGLE + (i - 0.5) * (360 / N); } // i = 1..24

function wedge(i) {
  const a0 = START_ANGLE + (i - 1) * 360 / N, a1 = a0 + 360 / N;
  const [x0, y0] = pt(R_OUT, a0), [x1, y1] = pt(R_OUT, a1), [x2, y2] = pt(R_IN, a1), [x3, y3] = pt(R_IN, a0);
  return `M${x0},${y0} A${R_OUT},${R_OUT} 0 0 1 ${x1},${y1} L${x2},${y2} A${R_IN},${R_IN} 0 0 0 ${x3},${y3} Z`;
}

export function tokenXY(position, slot, count) {
  let x, y;
  if (position === 0) { [x, y] = pt(R_IN - 70, START_ANGLE); } // «Старт»: внутри круга у стрелки
  else [x, y] = pt((R_OUT + R_IN) / 2, cellAngle(position));
  if (count > 1) {
    const ang = (slot / count) * Math.PI * 2;
    const rr = count > 4 ? 46 : 32;
    x += Math.cos(ang) * rr; y += Math.sin(ang) * rr;
  }
  return [x, y];
}

export function createBoard(onDeckClick) {
  const svg = s('svg', { viewBox: '0 0 1000 1000', class: 'board' });
  svg.append(s('circle', { cx: C, cy: C, r: R_OUT + 14, class: 'ring-bg' }));
  for (let i = 1; i <= N; i++) {
    const type = RAT_RACE[i - 1];
    const g = s('g', { class: 'cell cell-' + type, 'data-cell': i });
    g.append(s('path', { d: wedge(i) }));
    const a = cellAngle(i);
    const [tx, ty] = pt((R_OUT + R_IN) / 2, a);
    // текст вдоль радиуса, читаемый снаружи
    let rot = a; if (a % 360 > 90 && a % 360 < 270) rot = a + 180;
    const text = s('text', { x: tx, y: ty, transform: `rotate(${rot} ${tx} ${ty})`, class: 'cell-label' });
    const title = t('cell.' + type);
    const longest = Math.max(...title.split(' ').map(w => w.length));
    if (longest > 12) text.style.fontSize = Math.round(22 * 12 / longest) + 'px';
    const words = title.split(' ');
    const sub = t('cell.' + type + '.sub') !== 'cell.' + type + '.sub' ? t('cell.' + type + '.sub') : '';
    const lines = [...words.length > 1 && title.length > 11 ? words : [title]];
    const subLines = sub && sub.length < 22 ? [sub] : [];
    const all = [...lines.map(l => ['t', l]), ...subLines.map(l => ['s', l])];
    all.forEach(([k, l], idx) => {
      text.append(s('tspan', { x: tx, dy: idx === 0 ? `${-(all.length - 1) * 0.55}em` : '1.1em', class: k === 's' ? 'cell-sub' : '' }, document.createTextNode(l)));
    });
    g.append(text);
    svg.append(g);
  }
  // «Старт»
  const [sx, sy] = pt(R_OUT + 4, START_ANGLE - 1);
  svg.append(s('g', { class: 'start' },
    s('path', { d: `M${sx - 70},${sy + 10} L${sx - 10},${sy - 18} L${sx - 14},${sy + 2} L${sx + 4},${sy + 6} Z`, class: 'start-arrow' }),
    s('text', { x: sx - 60, y: sy - 18, class: 'start-label' }, document.createTextNode(t('cell.start')))));

  // центр: картинка-заглушка и колоды
  svg.append(s('circle', { cx: C, cy: C, r: R_IN - 12, class: 'center-bg' }));
  // Картинка в центре — только если файл существует (assets/img/board-center.png).
  const probe = new Image();
  probe.onload = () => svg.insertBefore(s('image', { href: probe.src, x: C - 150, y: C - 200, width: 300, height: 220, preserveAspectRatio: 'xMidYMid meet', class: 'center-img' }), svg.querySelector('.board-title'));
  probe.src = 'assets/img/board-center.png';
  svg.append(s('text', { x: C, y: C - 70, class: 'board-title' }, document.createTextNode(t('app.title'))));
  const decks = [['small', C - 205, C - 20], ['big', C + 5, C - 20], ['market', C - 205, C + 105], ['doodad', C + 5, C + 105]];
  for (const [d, x, y] of decks) {
    const g = s('g', { class: 'deck deck-' + d, 'data-deck': d });
    g.append(s('rect', { x, y, width: 200, height: 110, rx: 16 }));
    g.append(s('text', { x: x + 100, y: y + 50, class: 'deck-title' }, document.createTextNode(t('deck.' + d))));
    g.append(s('text', { x: x + 100, y: y + 82, class: 'deck-count' }, document.createTextNode('')));
    if (onDeckClick) g.addEventListener('click', () => onDeckClick(d));
    svg.append(g);
  }
  const tokens = s('g', { class: 'tokens' });
  svg.append(tokens);
  svg._tokens = tokens;
  svg._shown = {}; // playerId → показанная позиция
  return svg;
}

export function updateDecks(svg, state) {
  for (const g of svg.querySelectorAll('.deck')) {
    const d = state.decks[g.dataset.deck];
    g.querySelector('.deck-count').textContent = String(d.draw.length);
  }
}

export function renderTokens(svg, state, override = {}) {
  const layer = svg._tokens;
  const players = state.players.filter(p => p.status === 'playing');
  const pos = {};
  for (const p of players) pos[p.id] = override[p.id] ?? svg._shown[p.id] ?? p.position;
  const groups = {};
  for (const p of players) (groups[pos[p.id]] ||= []).push(p.id);
  const existing = new Map([...layer.children].map(el => [el.dataset.id, el]));
  for (const p of players) {
    let el = existing.get(p.id);
    if (!el) {
      el = s('g', { class: 'token', 'data-id': p.id },
        s('circle', { r: 26, fill: p.color }),
        s('text', { class: 'token-label', y: 9 }, document.createTextNode(tokenLetter(state, p))));
      layer.append(el);
    }
    existing.delete(p.id);
    const g = groups[pos[p.id]];
    const [x, y] = tokenXY(pos[p.id], g.indexOf(p.id), g.length);
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.classList.toggle('current', state.order[state.current] === p.id);
  }
  for (const el of existing.values()) el.remove();
}

// Буква на фишке: первая буква имени, а если она у кого-то совпадает — номер игрока.
function tokenLetter(state, p) {
  const first = (x) => (x.name || '?').trim().charAt(0).toUpperCase();
  const dup = state.players.filter(x => first(x) === first(p)).length > 1;
  return dup ? String(state.players.indexOf(p) + 1) : first(p);
}

export async function animateMove(svg, state, playerId, path, stepMs) {
  for (const cell of path) {
    svg._shown[playerId] = cell;
    renderTokens(svg, state);
    sfx.step();
    await sleep(stepMs);
  }
}

export function syncShown(svg, state) { for (const p of state.players) svg._shown[p.id] = p.position; }
