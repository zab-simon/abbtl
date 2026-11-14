// Главный модуль интерфейса: экраны, панель хода, окна (бланк, журнал, настройки).
import { h, sleep } from './dom.js';
import { t, money, setLang, LANGS } from '../i18n/index.js';
import { createGame, currentPlayer, diceOptions } from '../core/engine.js';
import { summary } from '../core/finance.js';
import { PROFESSIONS } from '../data/professions.js';
import { RULES } from '../data/rules.js';
import { LocalGame } from '../net/localGame.js';
import { loadSettings, saveSettings, loadGame, saveGame, clearGame } from './storage.js';
import { createBoard, renderTokens, updateDecks, animateMove, syncShown } from './board.js';
import { showDice } from './dice.js';
import { sfx, setSound } from './sound.js';
import { renderSheet, loanButton } from './sheet.js';
import { cardFace, cardActions, pendingBox } from './cardView.js';
import { logLine, errorText, assetLabel } from './format.js';

const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60', '#6d4c41', '#546e7a'];

const app = {
  settings: loadSettings(),
  game: null,        // LocalGame (или в будущем RemoteGame)
  config: null,      // параметры партии (для воспроизведения)
  board: null,
  busy: false,       // идёт анимация
  modal: null,
};

const root = document.getElementById('app');

function applySettings() {
  setLang(app.settings.lang);
  setSound(app.settings.sound);
  document.documentElement.lang = app.settings.lang;
  document.getElementById('theme').href = `themes/${app.settings.theme}.css`;
  document.title = t('app.title');
}

// ---------- сообщения ----------
function toast(text, kind = '') {
  const el = h('div.toast' + (kind ? '.' + kind : ''), {}, text);
  document.body.append(el);
  setTimeout(() => el.classList.add('hide'), 2600);
  setTimeout(() => el.remove(), 3000);
}

// ---------- действия ----------
async function act(action) {
  if (app.busy) return;
  const prev = app.game.getState();
  const { error, events } = app.game.dispatch(action);
  if (error) { toast(errorText(error), 'error'); return; }
  persist();
  await playEvents(prev, events);
  render();
}

async function playEvents(prev, events) {
  const state = app.game.getState();
  app.busy = true;
  document.body.classList.add('busy');
  try {
    for (const e of events) {
      if (e.type === 'move') {
        await showDice(e.dice, app.settings.diceMs);
        await animateMove(app.board, state, e.playerId, e.path, app.settings.stepMs);
      } else if (e.type === 'paycheck') e.delta >= 0 ? sfx.cashIn() : sfx.cashOut();
      else if (e.type === 'cash') e.delta >= 0 ? sfx.cashIn() : sfx.cashOut();
      else if (e.type === 'card') sfx.card();
      else if (e.type === 'exited') { sfx.win(); toast(t('log.exited', { player: state.players.find(p => p.id === e.playerId).name }), 'win'); }
    }
  } finally {
    app.busy = false;
    document.body.classList.remove('busy');
  }
  void prev;
}

function persist() { saveGame({ config: app.config, state: app.game.getState(), history: app.game.history }); }

// ---------- экраны ----------
function render() {
  if (!app.game) return renderSetup();
  renderGame();
}

function topbar(extra = []) {
  return h('header.topbar', {},
    h('div.brand', {}, t('app.title')),
    h('div.tools', {}, ...extra,
      h('button.icon', { onclick: openSettings, title: t('ui.settings') }, '⚙'),
    ));
}

function renderSetup() {
  const saved = loadGame();
  const count = h('select', {}, ...Array.from({ length: RULES.maxPlayers }, (_, i) => h('option', { value: i + 1, selected: i === 1 ? true : null }, String(i + 1))));
  const list = h('div.setup-list');
  const rows = [];
  const draw = () => {
    const n = Number(count.value);
    list.innerHTML = '';
    rows.length = 0;
    for (let i = 0; i < n; i++) {
      const name = h('input', { value: t('ui.playerN', { n: i + 1 }), maxlength: 16 });
      let color = COLORS[i];
      const sw = h('div.swatches', {}, ...COLORS.map(c => {
        const b = h('button.swatch' + (c === color ? '.on' : ''), { style: { background: c }, onclick: (ev) => { color = c; rowObj.color = c; for (const x of sw.children) x.classList.remove('on'); ev.currentTarget.classList.add('on'); } });
        return b;
      }));
      const prof = app.settings.professionMode === 'choose'
        ? h('select', {}, ...PROFESSIONS.map(p => h('option', { value: p.id }, t('prof.' + p.id))))
        : null;
      const rowObj = { name, color, prof };
      rows.push(rowObj);
      list.append(h('div.setup-row', {}, h('span.dot', { style: { background: color } }), name, prof, sw));
    }
  };
  count.addEventListener('change', draw);
  draw();
  const start = () => {
    const players = rows.map((r, i) => ({ name: (r.name.value || t('ui.playerN', { n: i + 1 })).trim(), color: r.color, professionId: r.prof ? r.prof.value : undefined }));
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    app.config = { seed, players, professionMode: app.settings.professionMode };
    app.game = new LocalGame(createGame(app.config));
    persist();
    const s = app.game.getState();
    toast(t('ui.firstPlayer', { player: currentPlayer(s).name }));
    app.board = null;
    render();
  };
  root.innerHTML = '';
  root.append(topbar(), h('main.setup', {},
    h('div.setup-card', {},
      h('h1', {}, t('app.title')),
      saved ? h('button.primary.wide', { onclick: () => { resume(saved); } }, t('ui.continue')) : null,
      h('h2', {}, t('ui.newGame')),
      h('label.row', {}, t('ui.playerCount') + ' ', count),
      list,
      h('button.primary.wide', { onclick: start }, t('ui.start')))));
}

function resume(saved) {
  app.config = saved.config;
  app.game = new LocalGame(saved.state, saved.history || []);
  app.board = null;
  render();
}

function renderGame() {
  const state = app.game.getState();
  if (!app.board) { app.board = createBoard(); syncShown(app.board, state); }
  else if (!app.busy) syncShown(app.board, state);
  updateDecks(app.board, state);
  renderTokens(app.board, state);

  root.innerHTML = '';
  root.append(
    topbar([
      h('button', { onclick: openLog }, t('ui.log')),
      h('button', { onclick: () => { if (confirm(t('ui.confirmNew'))) { clearGame(); app.game = null; app.board = null; render(); } } }, t('ui.newGame')),
    ]),
    h('main.game', {},
      h('section.board-wrap', {}, app.board),
      h('section.side', {}, turnPanel(state), playersPanel(state))));
}

function turnPanel(state) {
  if (state.phase === 'gameOver') {
    return h('div.panel', {}, h('h2', {}, t('phase.gameOver')),
      h('div', {}, t('ui.winners') + ':'),
      h('ol', {}, ...state.finished.map(id => h('li', {}, state.players.find(p => p.id === id).name))),
      h('div.hint', {}, t('ui.fastTrackSoon')),
      h('button.primary', { onclick: () => { clearGame(); app.game = null; app.board = null; render(); } }, t('ui.newGame')));
  }
  const p = currentPlayer(state);
  const f = summary(p);
  const progress = Math.min(100, Math.round(100 * f.passiveIncome / Math.max(1, f.totalExpenses)));
  const head = h('div.current', { style: { borderColor: p.color } },
    h('div.cur-name', {}, h('span.dot', { style: { background: p.color } }), p.name, h('span.prof', {}, t('prof.' + p.professionId))),
    h('div.cur-stats', {},
      h('div', {}, h('small', {}, t('ui.cash')), h('b', {}, money(p.cash))),
      h('div', {}, h('small', {}, t('ui.flow')), h('b.' + (f.cashFlow < 0 ? 'neg' : 'pos'), {}, money(f.cashFlow))),
      h('button', { onclick: () => openSheet(p.id) }, t('act.sheet'))),
    h('div.progress', { title: `${money(f.passiveIncome)} / ${money(f.totalExpenses)}` },
      h('div.bar', { style: { width: progress + '%' } }),
      h('span', {}, `${t('sheet.passive')} ${money(f.passiveIncome)} / ${money(f.totalExpenses)}`)),
    p.charityTurns ? h('div.hint', {}, t('hint.charityTurns', { n: p.charityTurns })) : null);

  const body = h('div.actions');
  const phase = state.phase;
  if (phase === 'roll') {
    body.append(h('div.hint', {}, t('phase.roll')));
    const opts = diceOptions(p);
    if (opts.length > 1) {
      body.append(h('div.row', {},
        h('button.primary.big', { onclick: () => act({ type: 'ROLL', playerId: p.id, dice: 2 }) }, t('act.roll2')),
        h('button.big', { onclick: () => act({ type: 'ROLL', playerId: p.id, dice: 1 }) }, t('act.roll1'))));
    } else body.append(h('button.primary.big', { onclick: () => act({ type: 'ROLL', playerId: p.id }) }, '🎲 ' + t('act.roll')));
  } else if (phase === 'chooseDeal') {
    body.append(h('div.hint', {}, t('phase.chooseDeal')), h('div.row', {},
      h('button.deal.small-deal', { onclick: () => act({ type: 'CHOOSE_DEAL', playerId: p.id, deck: 'small' }) }, t('act.small'), h('small', {}, t('deck.small.hint'))),
      h('button.deal.big-deal', { onclick: () => act({ type: 'CHOOSE_DEAL', playerId: p.id, deck: 'big' }) }, t('act.big'), h('small', {}, t('deck.big.hint')))));
  } else if (phase === 'charity') {
    const amount = Math.round(f.totalIncome * RULES.charityShare);
    body.append(h('div.hint', {}, t('phase.charity')), h('div.row', {},
      h('button.primary', { onclick: () => act({ type: 'CHARITY', playerId: p.id, accept: true }), disabled: p.cash < amount ? true : null }, t('act.charityYes', { amount: money(amount) })),
      loanButton(p, amount, act),
      h('button', { onclick: () => act({ type: 'CHARITY', playerId: p.id, accept: false }) }, t('act.charityNo'))));
  } else if (phase === 'bankruptcy') {
    body.append(h('div.hint.warn', {}, t('phase.bankruptcy')));
    for (const a of p.assets) body.append(h('div.sellrow', {}, h('span', {}, assetLabel(a)),
      h('button', { onclick: () => act({ type: 'BANKRUPT_SELL', playerId: p.id, assetId: a.id }) }, t('act.bankruptSell', { amount: money(Math.floor(a.down * RULES.bankruptcySaleShare)) }))));
    for (const l of p.stocks) body.append(h('div.sellrow', {}, h('span', {}, `${l.symbol} × ${l.shares}`),
      h('button', { onclick: () => act({ type: 'BANKRUPT_SELL', playerId: p.id, lotId: l.id }) }, t('act.bankruptSell', { amount: money(Math.floor(l.shares * l.price * RULES.bankruptcySaleShare)) }))));
    body.append(h('div.row', {}, h('button', { onclick: () => openSheet(p.id) }, t('act.sheet')),
      h('button.primary', { onclick: () => act({ type: 'BANKRUPT_FINISH', playerId: p.id }) }, t('act.bankruptFinish'))));
  } else if (phase === 'card' || phase === 'endTurn') {
    if (state.card) body.append(cardFace(state.card.id), ...cardActions(state, act));
    else if (state.pending) body.append(pendingBox(state, act));
    else body.append(h('div.hint', {}, t('phase.endTurn')));
    body.append(h('button.primary.big.end', { onclick: () => act({ type: 'END_TURN', playerId: p.id }), disabled: state.pending ? true : null }, t('act.endTurn') + ' →'));
  }
  const last = state.log.slice(-3).map(e => h('div.logline', {}, logLine(state, e)));
  return h('div.panel', {}, h('div.turnno', {}, t('ui.turn', { n: state.turn })), head, body, h('div.lastlog', {}, ...last));
}

function playersPanel(state) {
  return h('div.panel.players', {}, h('h3', {}, t('ui.players')),
    ...state.order.map(id => {
      const p = state.players.find(x => x.id === id);
      const f = summary(p);
      const status = p.status === 'exited' ? t('ui.exited') : p.status === 'out' ? t('ui.out') : p.skipTurns ? t('hint.skip', { n: p.skipTurns }) : '';
      return h('button.player' + (id === state.order[state.current] ? '.on' : ''), { onclick: () => openSheet(p.id) },
        h('span.dot', { style: { background: p.color } }),
        h('span.pn', {}, p.name, h('small', {}, t('prof.' + p.professionId) + (status ? ' · ' + status : ''))),
        h('span.pc', {}, money(p.cash)),
        h('span.pf' + (f.cashFlow < 0 ? '.neg' : ''), {}, money(f.cashFlow)));
    }));
}

// ---------- окна ----------
function openModal(title, contentFn) {
  closeModal();
  const box = h('div.modal-box');
  const wrap = h('div.modal', { onclick: (e) => { if (e.target === wrap) closeModal(); } },
    h('div.modal-inner', {}, h('div.modal-head', {}, h('h2', {}, title), h('button.icon', { onclick: closeModal }, '✕')), box));
  app.modal = { wrap, box, contentFn };
  box.append(contentFn());
  document.body.append(wrap);
}
function refreshModal() { if (app.modal) { app.modal.box.innerHTML = ''; app.modal.box.append(app.modal.contentFn()); } }
function closeModal() { if (app.modal) { app.modal.wrap.remove(); app.modal = null; } }

function openSheet(playerId) {
  const actAndRefresh = async (a) => { await act(a); refreshModal(); };
  openModal(t('act.sheet'), () => {
    const s = app.game.getState();
    const p = s.players.find(x => x.id === playerId);
    return renderSheet(s, p, p.status === 'playing' ? actAndRefresh : null);
  });
}

function openLog() {
  openModal(t('ui.log'), () => {
    const s = app.game.getState();
    return h('div.log', {},
      h('button', { onclick: exportLog }, t('ui.exportLog')),
      ...s.log.slice().reverse().map(e => h('div.logline', {}, `${t('ui.turn', { n: e.turn })}: ${logLine(s, e)}`)));
  });
}

function exportLog() {
  const data = JSON.stringify({ config: app.config, history: app.game.history, state: app.game.getState() }, null, 1);
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: 'vyhod-iz-kruga-log.json' });
  document.body.append(a); a.click(); a.remove();
}

function openSettings() {
  openModal(t('ui.settings'), () => {
    const s = app.settings;
    const set = (k, v) => { s[k] = v; saveSettings(s); applySettings(); if (k === 'lang') app.board = null; render(); refreshModal(); };
    const sel = (k, opts) => h('select', { onchange: (e) => set(k, e.target.value) }, ...opts.map(([v, l]) => h('option', { value: v, selected: s[k] === v ? true : null }, l)));
    const num = (k, min, max, step) => h('input.num', { type: 'number', min, max, step, value: s[k], onchange: (e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || s[k]))) });
    return h('div.settings', {},
      h('label', {}, t('set.language'), sel('lang', Object.entries(LANGS).map(([k, v]) => [k, v.name]))),
      h('label', {}, t('set.theme'), sel('theme', [['cartoon', t('set.theme.cartoon')], ['strict', t('set.theme.strict')]])),
      h('label', {}, t('set.sound'), h('select', { onchange: (e) => set('sound', e.target.value === '1') },
        h('option', { value: '1', selected: s.sound ? true : null }, t('set.on')), h('option', { value: '0', selected: !s.sound ? true : null }, t('set.off')))),
      h('label', {}, t('set.diceMs'), num('diceMs', 150, 3000, 50)),
      h('label', {}, t('set.stepMs'), num('stepMs', 20, 600, 10)),
      h('label', {}, t('set.professionMode'), sel('professionMode', [['random', t('set.prof.random')], ['choose', t('set.prof.choose')]])));
  });
}

// ---------- запуск ----------
// Любая непредвиденная ошибка показывается на экране — её сразу видно и легко сообщить.
window.addEventListener('error', (e) => toast('⚠ ' + (e.message || 'Error'), 'error'));
window.addEventListener('unhandledrejection', (e) => toast('⚠ ' + (e.reason && e.reason.message || 'Error'), 'error'));
applySettings();
const saved = loadGame();
if (saved) resume(saved); else render();
window.addEventListener('resize', () => { /* поле масштабируется через CSS */ });
void sleep;
