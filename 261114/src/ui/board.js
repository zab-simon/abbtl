// Игровое поле (SVG). Разметка повторяет оригинальную доску:
// прямоугольное поле, по краю — дорожка «Быстрый путь» (в версии 1 — пустая рамка),
// в центре — круг «Крысиных гонок» (24 клетки), слева — «Большие» и «Маленькие дела»,
// справа — «Рынок» и «Давай потратимся», по углам — места под картинки, внизу — цели.
import { RAT_RACE } from '../data/board.js';
import { t } from '../i18n/index.js';
import { sleep } from './dom.js';
import { sfx } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';
export const W = 1500, H = 1000;
const CX = 750, CY = 505, R_OUT = 322, R_IN = 214, N = RAT_RACE.length;
const START_ANGLE = 135; // «Старт» слева снизу, как на оригинальной доске; ход по часовой стрелке

function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}
const rad = (d) => d * Math.PI / 180;
const pt = (r, a) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
const cellAngle = (i) => START_ANGLE + (i - 0.5) * (360 / N); // i = 1..24

function wedge(i) {
  const a0 = START_ANGLE + (i - 1) * 360 / N, a1 = a0 + 360 / N;
  const [x0, y0] = pt(R_OUT, a0), [x1, y1] = pt(R_OUT, a1), [x2, y2] = pt(R_IN, a1), [x3, y3] = pt(R_IN, a0);
  return `M${x0},${y0} A${R_OUT},${R_OUT} 0 0 1 ${x1},${y1} L${x2},${y2} A${R_IN},${R_IN} 0 0 0 ${x3},${y3} Z`;
}

// Многострочный текст: разбивает по словам на строки не длиннее maxChars.
function textBlock(x, y, str, maxChars, cls, lineH = 1.25, anchor = 'middle') {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  const el = s('text', { x, y, class: cls, 'text-anchor': anchor });
  lines.forEach((l, i) => el.append(s('tspan', { x, dy: i === 0 ? 0 : `${lineH}em` }, l)));
  return el;
}

// Картинка из assets/img/ — появляется, только если файл существует.
function imageSlot(svg, file, x, y, w, h) {
  const g = s('g', { class: 'img-slot' }, s('rect', { x, y, width: w, height: h, rx: 22 }));
  svg.append(g);
  const probe = new Image();
  probe.onload = () => g.append(s('image', { href: probe.src, x: x + 6, y: y + 6, width: w - 12, height: h - 12, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `inset(0 round 18px)` }));
  probe.src = 'assets/img/' + file;
}

function deckSlot(svg, deck, x, y, w, h) {
  const g = s('g', { class: 'deck deck-' + deck, 'data-deck': deck });
  g.append(s('rect', { x, y, width: w, height: h, rx: 18, class: 'deck-frame' }));
  g.append(s('rect', { x: x + 10, y: y + 10, width: w - 20, height: h - 20, rx: 12 }));
  g.append(s('text', { x: x + w / 2, y: y + 52, class: 'deck-title' }, t('deck.' + deck)));
  g.append(textBlock(x + w / 2, y + 86, t('board.deck.' + deck), 32, 'deck-desc'));
  g.append(s('text', { x: x + w - 26, y: y + h - 22, class: 'deck-count', 'text-anchor': 'end' }, ''));
  svg.append(g);
}

export function createBoard() {
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'board' });
  // рамка «Быстрого пути»
  svg.append(s('rect', { x: 6, y: 6, width: W - 12, height: H - 12, rx: 46, class: 'frame' }));
  svg.append(s('rect', { x: 64, y: 64, width: W - 128, height: H - 128, rx: 30, class: 'field' }));
  svg.append(s('text', { x: W / 2, y: 44, class: 'frame-label' }, t('board.fastTrack')));

  // левая колонка
  imageSlot(svg, 'corner-tl.png', 92, 92, 310, 170);
  deckSlot(svg, 'big', 92, 276, 310, 190);
  deckSlot(svg, 'small', 92, 480, 310, 190);
  imageSlot(svg, 'corner-bl.png', 92, 684, 310, 110);
  svg.append(textBlock(247, 826, t('board.goalRat'), 38, 'goal'));
  // правая колонка
  imageSlot(svg, 'corner-tr.png', 1098, 92, 310, 170);
  deckSlot(svg, 'market', 1098, 276, 310, 190);
  deckSlot(svg, 'doodad', 1098, 480, 310, 190);
  imageSlot(svg, 'corner-br.png', 1098, 684, 310, 110);
  svg.append(textBlock(1253, 826, t('board.goalFast'), 38, 'goal'));
  // надпись снизу
  svg.append(s('text', { x: CX, y: H - 84, class: 'board-motto' }, t('board.motto')));

  // круг
  svg.append(s('circle', { cx: CX, cy: CY, r: R_OUT + 16, class: 'ring-bg' }));
  for (let i = 1; i <= N; i++) {
    const type = RAT_RACE[i - 1];
    const g = s('g', { class: 'cell cell-' + type, 'data-cell': i });
    g.append(s('path', { d: wedge(i) }));
    const a = cellAngle(i);
    const [tx, ty] = pt((R_OUT + R_IN) / 2, a);
    let rot = a; const m = ((a % 360) + 360) % 360; if (m > 90 && m < 270) rot = a + 180;
    const title = t('cell.' + type);
    const subKey = 'cell.' + type + '.sub';
    const sub = t(subKey) !== subKey && t(subKey).length < 24 ? t(subKey) : '';
    const words = title.length > 10 ? title.split(' ') : [title];
    const lines = [...words.map(w => ['t', w]), ...(sub ? [['s', sub]] : [])];
    const text = s('text', { x: tx, y: ty, transform: `rotate(${rot} ${tx} ${ty})`, class: 'cell-label' });
    const longest = Math.max(...words.map(w => w.length));
    if (longest > 11) text.style.fontSize = Math.round(18 * 11 / longest) + 'px';
    lines.forEach(([k, l], idx) => text.append(s('tspan', { x: tx, dy: idx === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em', class: k === 's' ? 'cell-sub' : null }, l)));
    g.append(text);
    svg.append(g);
  }
  // центр круга
  svg.append(s('circle', { cx: CX, cy: CY, r: R_IN - 10, class: 'center-bg' }));
  const probe = new Image();
  probe.onload = () => svg.insertBefore(s('image', { href: probe.src, x: CX - 170, y: CY - 170, width: 340, height: 340, preserveAspectRatio: 'xMidYMid meet' }), svg.querySelector('.board-title'));
  probe.src = 'assets/img/board-center.png';
  svg.append(s('text', { x: CX, y: CY + 12, class: 'board-title' }, t('app.title')));
  // «Старт»
  const [ax, ay] = pt(R_OUT + 30, START_ANGLE);
  const [bx, by] = pt(R_OUT - 8, START_ANGLE + 2);
  svg.append(s('g', { class: 'start' },
    s('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'start-line' }),
    s('circle', { cx: bx, cy: by, r: 9, class: 'start-dot' }),
    s('text', { x: ax - 6, y: ay + 34, class: 'start-label' }, t('cell.start'))));

  const tokens = s('g', { class: 'tokens' });
  svg.append(tokens);
  svg._tokens = tokens;
  svg._shown = {};
  return svg;
}

export function tokenXY(position, slot, count) {
  let x, y;
  if (position === 0) [x, y] = pt(R_IN - 62, START_ANGLE); // «Старт»: внутри круга у стрелки
  else [x, y] = pt((R_OUT + R_IN) / 2, cellAngle(position));
  if (count > 1) {
    const ang = (slot / count) * Math.PI * 2;
    const rr = count > 4 ? 40 : 28;
    x += Math.cos(ang) * rr; y += Math.sin(ang) * rr;
  }
  return [x, y];
}

export function updateDecks(svg, state) {
  for (const g of svg.querySelectorAll('.deck')) {
    g.querySelector('.deck-count').textContent = String(state.decks[g.dataset.deck].draw.length);
  }
}

// Фишка — крыса (свой рисунок) цвета игрока.
function ratToken(p, label) {
  return s('g', { class: 'rat' },
    s('path', { d: 'M-20,8 C-38,10 -44,26 -30,30', class: 'rat-tail' }),
    s('ellipse', { cx: -2, cy: 4, rx: 22, ry: 16, fill: p.color, class: 'rat-body' }),
    s('circle', { cx: 18, cy: -6, r: 12, fill: p.color, class: 'rat-body' }),
    s('circle', { cx: 12, cy: -18, r: 7, fill: p.color, class: 'rat-ear' }),
    s('circle', { cx: 24, cy: -18, r: 6, fill: p.color, class: 'rat-ear' }),
    s('circle', { cx: 31, cy: -4, r: 3.5, class: 'rat-nose' }),
    s('circle', { cx: 21, cy: -9, r: 2.6, class: 'rat-eye' }),
    s('text', { x: -4, y: 11, class: 'token-label' }, label));
}

function tokenLabel(state, p) {
  const first = (x) => (x.name || '?').trim().charAt(0).toUpperCase();
  const dup = state.players.filter(x => first(x) === first(p)).length > 1;
  return dup ? String(state.players.indexOf(p) + 1) : first(p);
}

export function renderTokens(svg, state) {
  const layer = svg._tokens;
  const players = state.players.filter(p => p.status === 'playing');
  const pos = {};
  for (const p of players) pos[p.id] = svg._shown[p.id] ?? p.position;
  const groups = {};
  for (const p of players) (groups[pos[p.id]] ||= []).push(p.id);
  const existing = new Map([...layer.children].map(el => [el.dataset.id, el]));
  for (const p of players) {
    let el = existing.get(p.id);
    if (!el) { el = s('g', { class: 'token', 'data-id': p.id }, ratToken(p, tokenLabel(state, p))); layer.append(el); }
    existing.delete(p.id);
    const g = groups[pos[p.id]];
    const [x, y] = tokenXY(pos[p.id], g.indexOf(p.id), g.length);
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.classList.toggle('current', state.order[state.current] === p.id);
  }
  for (const el of existing.values()) el.remove();
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
