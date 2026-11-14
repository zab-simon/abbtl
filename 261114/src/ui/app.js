// Главный модуль интерфейса: экраны, панель хода, окна (бланк, журнал, настройки), сетевая игра.
// Режимы: local — все игроки на одном устройстве; host — это устройство создало сетевую игру;
// guest — устройство подключилось по QR-коду. Экран одинаковый, отличается только «за кого я играю».
import { h } from './dom.js';
import { t, money, setLang, LANGS } from '../i18n/index.js';
import { createGame, currentPlayer, diceCount } from '../core/engine.js';
import { summary } from '../core/finance.js';
import { PROFESSIONS } from '../data/professions.js';
import { RULES } from '../data/rules.js';
import { LocalGame } from '../net/localGame.js';
import { HostSession, MAX_NET_PLAYERS } from '../net/host.js';
import { RemoteGame } from '../net/remote.js';
import { peerQuery, randomId } from '../net/peer.js';
import qrcode from '../../vendor/qrcode.mjs';
import { loadSettings, saveSettings, loadGame, saveGame, clearGame, loadNet, saveNet } from './storage.js';
import { createBoard, renderTokens, updateDecks, animateMove, syncShown } from './board.js';
import { showDice } from './dice.js';
import { sfx, setSound } from './sound.js';
import { renderSheet, loanButton } from './sheet.js';
import { cardFace, cardActions, pendingBox } from './cardView.js';
import { logLine, errorText, assetLabel } from './format.js';
import { wallet } from './money.js';

const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60', '#6d4c41', '#546e7a'];

const app = {
  settings: loadSettings(),
  net: loadNet(),       // { hostId, clientId, name, color, lastHost }
  mode: 'local',        // local | host | guest
  game: null,           // объект с getState / dispatch / subscribe
  host: null,           // HostSession (режим host)
  remote: null,         // RemoteGame (режим guest)
  config: null,
  board: null,
  busy: false,
  queue: Promise.resolve(),
  unsub: null,
  modal: null,
  screen: 'setup',      // setup | hostLobby | join | guestLobby | game
};
if (!app.net.clientId) { app.net.clientId = randomId('c-'); saveNet(app.net); }

const root = document.getElementById('app');

function applySettings() {
  setLang(app.settings.lang);
  setSound(app.settings.sound);
  document.documentElement.lang = app.settings.lang;
  document.getElementById('theme').href = `themes/${app.settings.theme}.css`;
  document.title = t('app.title');
}

function toast(text, kind = '') {
  const el = h('div.toast' + (kind ? '.' + kind : ''), {}, text);
  document.body.append(el);
  setTimeout(() => el.classList.add('hide'), 2600);
  setTimeout(() => el.remove(), 3000);
}

// ---------- кто чем управляет ----------
function mySeat() {
  if (app.mode === 'host') return app.host.mySeat();
  if (app.mode === 'guest') return app.remote.seat;
  return null;
}
function canControl(playerId) { return app.mode === 'local' || playerId === mySeat(); }

// ---------- действия и показ изменений ----------
async function act(action) {
  if (app.busy) return;
  const r = await app.game.dispatch(action);
  if (r.error) toast(errorText(r.error), 'error');
}

function attachGame(game) {
  if (app.unsub) app.unsub();
  app.game = game;
  app.board = null;
  app.unsub = game.subscribe((state, events) => {
    if (app.mode !== 'guest') persist();
    app.queue = app.queue.then(() => playEvents(state, events)).then(() => { if (app.screen === 'game') render(); }).catch((e) => toast('⚠ ' + e.message, 'error'));
  });
}

async function playEvents(state, events) {
  if (!events.length) return;
  app.busy = true;
  document.body.classList.add('busy');
  try {
    for (const e of events) {
      if (e.type === 'move') {
        if (!app.board) continue;
        await showDice(e.dice, app.settings.diceMs);
        await animateMove(app.board, state, e.playerId, e.path, app.settings.stepMs);
      } else if (e.type === 'paycheck' || e.type === 'cash') e.delta >= 0 ? sfx.cashIn() : sfx.cashOut();
      else if (e.type === 'card') sfx.card();
      else if (e.type === 'exited') { sfx.win(); toast(t('log.exited', { player: state.players.find(p => p.id === e.playerId).name }), 'win'); }
    }
  } finally {
    app.busy = false;
    document.body.classList.remove('busy');
  }
}

function persist() {
  if (app.mode === 'guest' || !app.game || !app.game.getState()) return;
  const base = app.mode === 'host' ? app.host.game : app.game;
  saveGame({
    mode: app.mode, config: app.config, state: base.getState(), history: base.history,
    net: app.mode === 'host' ? { seats: app.host.seats, lobby: app.host.lobby } : null,
  });
}

// ---------- экраны ----------
function render() {
  if (app.screen === 'game' && app.game && app.game.getState()) return renderGame();
  if (app.screen === 'hostLobby') return renderHostLobby();
  if (app.screen === 'join') return renderJoin();
  if (app.screen === 'guestLobby') return renderGuestLobby();
  return renderSetup();
}

function topbar(extra = []) {
  return h('header.topbar', {},
    h('div.brand', {}, t('app.title')),
    h('div.tools', {}, ...extra, h('button.icon', { onclick: openSettings, title: t('ui.settings') }, '⚙')));
}

function playerRowsEditor(count, withProfession) {
  const list = h('div.setup-list');
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = { name: h('input', { value: t('ui.playerN', { n: i + 1 }), maxlength: 16 }), color: COLORS[i], prof: null };
    const dot = h('span.dot', { style: { background: row.color } });
    const sw = colorPicker(row.color, (c) => { row.color = c; dot.style.background = c; });
    if (withProfession) row.prof = h('select', {}, ...PROFESSIONS.map(p => h('option', { value: p.id }, t('prof.' + p.id))));
    rows.push(row);
    list.append(h('div.setup-row', {}, dot, row.name, row.prof, sw));
  }
  return { list, rows };
}

function colorPicker(initial, onPick) {
  const sw = h('div.swatches', {}, ...COLORS.map(c => h('button.swatch' + (c === initial ? '.on' : ''), {
    style: { background: c },
    onclick: (ev) => { for (const x of sw.children) x.classList.remove('on'); ev.currentTarget.classList.add('on'); onPick(c); },
  })));
  return sw;
}

function renderSetup() {
  const saved = loadGame();
  const count = h('select', {}, ...Array.from({ length: RULES.maxPlayers }, (_, i) => h('option', { value: i + 1, selected: i === 1 ? true : null }, String(i + 1))));
  const holder = h('div');
  let editor;
  const draw = () => { editor = playerRowsEditor(Number(count.value), app.settings.professionMode === 'choose'); holder.innerHTML = ''; holder.append(editor.list); };
  count.addEventListener('change', draw);
  draw();
  const start = () => {
    const players = editor.rows.map((r, i) => ({ name: (r.name.value || t('ui.playerN', { n: i + 1 })).trim(), color: r.color, professionId: r.prof ? r.prof.value : undefined }));
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    app.config = { seed, players, professionMode: app.settings.professionMode };
    app.mode = 'local';
    attachGame(new LocalGame(createGame(app.config)));
    persist();
    toast(t('ui.firstPlayer', { player: currentPlayer(app.game.getState()).name }));
    app.screen = 'game';
    render();
  };
  root.innerHTML = '';
  root.append(topbar(), h('main.setup', {},
    h('div.setup-card', {},
      h('h1', {}, t('app.title')),
      saved ? h('button.primary.wide', { onclick: () => resumeSaved(saved) }, t(saved.mode === 'host' ? 'net.resumeHost' : 'ui.continue')) : null,
      app.net.lastHost ? h('button.wide', { onclick: () => startGuest(app.net.lastHost) }, t('net.rejoin')) : null,
      h('h2', {}, t('ui.newGame')),
      h('label.row', {}, t('ui.playerCount') + ' ', count),
      holder,
      h('button.primary.wide', { onclick: start }, t('ui.start')),
      h('h2', {}, t('net.title')),
      h('div.hint', {}, t('net.hint', { n: MAX_NET_PLAYERS })),
      h('button.wide', { onclick: startHostLobby }, '📶 ' + t('net.create')))));
}

function resumeSaved(saved) {
  app.config = saved.config;
  if (saved.mode === 'host' && saved.net) {
    startHostSession();
    app.host.resume(saved.state, saved.history || [], saved.net.seats, saved.net.lobby);
    app.mode = 'host';
    attachGame(hostFacade());
  } else {
    app.mode = 'local';
    attachGame(new LocalGame(saved.state, saved.history || []));
  }
  app.screen = 'game';
  render();
}

// ----- сеть: хост -----
function hostFacade() {
  return {
    getState: () => app.host.game.getState(),
    dispatch: (a) => app.host.dispatch(a),
    subscribe: (fn) => app.host.game.subscribe(fn),
  };
}

function startHostSession() {
  if (!app.net.hostId) { app.net.hostId = randomId('vyhod-'); saveNet(app.net); }
  const me = { name: app.net.name || t('ui.playerN', { n: 1 }), color: app.net.color || COLORS[0] };
  app.host = new HostSession({ hostId: app.net.hostId, me, onChange: () => { if (app.screen === 'hostLobby') renderHostLobby(); else if (app.screen === 'game' && !app.busy) render(); } });
  app.host.open().catch(() => toast(t('net.libError'), 'error'));
}

function startHostLobby() {
  if (app.host) app.host.close();
  startHostSession();
  app.screen = 'hostLobby';
  render();
}

function joinUrl() {
  return location.origin + location.pathname + '?join=' + encodeURIComponent(app.net.hostId) + peerQuery();
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return h('div.qr', { html: qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) });
}

function renderHostLobby() {
  const host = app.host;
  const me = host.lobby[0];
  const name = h('input', { value: me.name, maxlength: 16, oninput: (e) => { me.name = e.target.value; app.net.name = me.name; saveNet(app.net); host.broadcastLobby(); } });
  const url = joinUrl();
  root.innerHTML = '';
  root.append(topbar([h('button', { onclick: () => { host.close(); app.host = null; app.screen = 'setup'; render(); } }, t('net.back'))]),
    h('main.setup', {}, h('div.setup-card', {},
      h('h1', {}, t('net.create')),
      h('div.net-status', {}, t('net.status.' + host.status.split(':')[0]) + (host.status.includes(':') ? ' (' + host.status.split(':')[1] + ')' : '')),
      h('div.qr-wrap', {}, qrSvg(url), h('div', {},
        h('p', {}, t('net.scan')),
        h('input.url', { value: url, readonly: true, onclick: (e) => e.target.select() }),
        h('button.small', { onclick: () => navigator.clipboard && navigator.clipboard.writeText(url).then(() => toast(t('net.copied'))) }, t('net.copy')))),
      h('h2', {}, t('ui.players') + ` (${host.lobby.length}/${MAX_NET_PLAYERS})`),
      h('div.setup-row', {}, h('span.dot', { style: { background: me.color } }), name,
        colorPicker(me.color, (c) => { me.color = c; app.net.color = c; saveNet(app.net); host.broadcastLobby(); })),
      ...host.lobby.slice(1).map(e => h('div.setup-row', {}, h('span.dot', { style: { background: e.color } }), h('b', {}, e.name || '…'),
        h('span.' + (e.online ? 'pos' : 'neg'), {}, e.online ? t('net.online') : t('net.offline')))),
      h('button.primary.wide', {
        onclick: () => {
          const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
          app.config = host.startGame(seed, 'random');
          app.mode = 'host';
          attachGame(hostFacade());
          persist();
          app.screen = 'game';
          render();
        },
      }, t('ui.start')))));
}

// ----- сеть: гость -----
function renderJoin() {
  const hostId = new URLSearchParams(location.search).get('join');
  let color = app.net.color || COLORS[1];
  const name = h('input', { value: app.net.name || '', placeholder: t('ui.name'), maxlength: 16 });
  const dot = h('span.dot', { style: { background: color } });
  root.innerHTML = '';
  root.append(topbar(), h('main.setup', {}, h('div.setup-card', {},
    h('h1', {}, t('net.join')),
    h('div.setup-row', {}, dot, name, colorPicker(color, (c) => { color = c; dot.style.background = c; })),
    h('button.primary.wide', {
      onclick: () => {
        app.net.name = (name.value || t('ui.playerN', { n: 2 })).trim();
        app.net.color = color;
        startGuest(hostId);
      },
    }, t('net.connect')),
    h('button.wide', { onclick: () => { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])join=[^&]*&?/, '$1').replace(/[?&]$/, '')); app.screen = 'setup'; render(); } }, t('net.playLocal')))));
}

function startGuest(hostId) {
  app.net.lastHost = hostId;
  saveNet(app.net);
  if (app.remote) app.remote.close();
  app.mode = 'guest';
  app.remote = new RemoteGame({
    hostId, clientId: app.net.clientId, name: app.net.name || 'Guest', color: app.net.color || COLORS[1],
    onStatus: (r) => {
      if (r.state && app.screen !== 'game') { app.screen = 'game'; render(); }
      else if (app.screen === 'guestLobby') renderGuestLobby();
    },
  });
  attachGame(app.remote);
  app.screen = 'guestLobby';
  render();
  app.remote.connect().catch(() => toast(t('net.libError'), 'error'));
}

function renderGuestLobby() {
  const r = app.remote;
  root.innerHTML = '';
  root.append(topbar([h('button', { onclick: leaveNet }, t('net.leave'))]), h('main.setup', {}, h('div.setup-card', {},
    h('h1', {}, t('net.join')),
    h('div.net-status', {}, t('net.status.' + r.status.split(':')[0])),
    h('h2', {}, t('ui.players')),
    ...r.lobby.map(e => h('div.setup-row', {}, h('span.dot', { style: { background: e.color } }), h('b', {}, e.name || '…'),
      e.clientId === app.net.clientId ? h('span', {}, ' ← ' + t('net.you')) : null)),
    h('div.hint', {}, t('net.waitHost')))));
}

function leaveNet() {
  if (app.remote) app.remote.close();
  if (app.host) app.host.close();
  app.remote = null; app.host = null;
  if (app.mode === 'guest') { app.net.lastHost = null; saveNet(app.net); }
  if (app.mode === 'host') clearGame();
  app.mode = 'local'; app.game = null;
  history.replaceState(null, '', location.pathname + location.search.replace(/([?&])join=[^&]*&?/, '$1').replace(/[?&]$/, ''));
  app.screen = 'setup';
  render();
}

// ----- игровой экран -----
function sheetTarget(state) {
  const seat = mySeat();
  if (seat) return state.players.find(p => p.id === seat);
  return currentPlayer(state);
}

function renderGame() {
  const state = app.game.getState();
  if (!app.board) { app.board = createBoard(); syncShown(app.board, state); }
  else if (!app.busy) syncShown(app.board, state);
  updateDecks(app.board, state);
  renderTokens(app.board, state);

  const pane = app.settings.sheetPane;
  const tools = [
    h('button' + (pane ? '.on' : ''), { onclick: () => { app.settings.sheetPane = !pane; saveSettings(app.settings); render(); } }, '📋 ' + t('ui.sheetPane')),
    h('button', { onclick: openLog }, t('ui.log')),
  ];
  if (app.mode === 'local') tools.push(h('button', { onclick: () => { if (confirm(t('ui.confirmNew'))) { clearGame(); app.game = null; app.screen = 'setup'; render(); } } }, t('ui.newGame')));
  else tools.push(h('span.net-badge', {}, app.mode === 'host' ? '📶 ' + t('net.hostBadge', { n: app.host.lobby.filter(e => e.online).length }) : '📶 ' + t('net.status.' + app.remote.status.split(':')[0])),
    h('button', { onclick: () => { if (confirm(t('net.confirmLeave'))) leaveNet(); } }, t('net.leave')));

  const sheetCol = pane ? h('section.sheet-pane', {},
    h('div.row', {}, h('button.small', { onclick: () => openSheet(sheetTarget(state).id) }, '⤢ ' + t('ui.expand'))),
    renderSheet(state, sheetTarget(state), canControl(sheetTarget(state).id) ? act : null)) : null;

  root.innerHTML = '';
  root.append(topbar(tools),
    h('main.game' + (pane ? '.with-sheet' : ''), {},
      h('section.board-wrap', {}, app.board),
      h('section.side', {}, turnPanel(state), sheetCol, playersPanel(state))));
  if (app.modal) refreshModal();
}

function turnPanel(state) {
  if (state.phase === 'gameOver') {
    return h('div.panel', {}, h('h2', {}, t('phase.gameOver')),
      h('div', {}, t('ui.winners') + ':'),
      h('ol', {}, ...state.finished.map(id => h('li', {}, state.players.find(p => p.id === id).name))),
      h('div.hint', {}, t('ui.fastTrackSoon')),
      app.mode !== 'guest' ? h('button.primary', { onclick: () => { clearGame(); leaveNet(); } }, t('ui.newGame')) : null);
  }
  const p = currentPlayer(state);
  const mine = canControl(p.id);
  const f = summary(p);
  const progress = Math.min(100, Math.round(100 * f.passiveIncome / Math.max(1, f.totalExpenses)));
  const head = h('div.current', { style: { borderColor: p.color } },
    h('div.cur-name', {}, h('span.dot', { style: { background: p.color } }), p.name, h('span.prof', {}, t('prof.' + p.professionId)),
      !mine ? h('span.waiting', {}, t('net.theirTurn')) : null),
    h('div.cur-stats', {},
      h('div', {}, h('small', {}, t('ui.cash')), h('b', {}, money(p.cash))),
      h('div', {}, h('small', {}, t('ui.flow')), h('b.' + (f.cashFlow < 0 ? 'neg' : 'pos'), {}, money(f.cashFlow))),
      h('button', { onclick: () => openSheet(p.id) }, t('act.sheet'))),
    wallet(p.cash),
    h('div.progress', { title: `${money(f.passiveIncome)} / ${money(f.totalExpenses)}` },
      h('div.bar', { style: { width: progress + '%' } }),
      h('span', {}, `${t('sheet.passive')} ${money(f.passiveIncome)} / ${money(f.totalExpenses)}`)),
    p.charityTurns ? h('div.hint', {}, t('hint.charityTurns', { n: p.charityTurns })) : null);

  const body = h('div.actions');
  const phase = state.phase;
  if (phase === 'roll') {
    body.append(h('div.hint', {}, t('phase.roll')));
    if (mine) body.append(h('button.primary.big', { onclick: () => act({ type: 'ROLL', playerId: p.id }) }, '🎲 ' + t(diceCount(p) === 2 ? 'act.roll2' : 'act.roll')));
  } else if (phase === 'chooseDeal') {
    body.append(h('div.hint', {}, t('phase.chooseDeal')));
    if (mine) body.append(h('div.row', {},
      h('button.deal.small-deal', { onclick: () => act({ type: 'CHOOSE_DEAL', playerId: p.id, deck: 'small' }) }, t('act.small'), h('small', {}, t('deck.small.hint'))),
      h('button.deal.big-deal', { onclick: () => act({ type: 'CHOOSE_DEAL', playerId: p.id, deck: 'big' }) }, t('act.big'), h('small', {}, t('deck.big.hint')))));
  } else if (phase === 'charity') {
    const amount = Math.round(f.totalIncome * RULES.charityShare);
    body.append(h('div.hint', {}, t('phase.charity')));
    if (mine) body.append(h('div.row', {},
      h('button.primary', { onclick: () => act({ type: 'CHARITY', playerId: p.id, accept: true }), disabled: p.cash < amount ? true : null }, t('act.charityYes', { amount: money(amount) })),
      loanButton(p, amount, act),
      h('button', { onclick: () => act({ type: 'CHARITY', playerId: p.id, accept: false }) }, t('act.charityNo'))));
  } else if (phase === 'bankruptcy') {
    body.append(h('div.hint.warn', {}, t('phase.bankruptcy')));
    if (mine) {
      for (const a of p.assets) body.append(h('div.sellrow', {}, h('span', {}, assetLabel(a)),
        h('button', { onclick: () => act({ type: 'BANKRUPT_SELL', playerId: p.id, assetId: a.id }) }, t('act.bankruptSell', { amount: money(Math.floor(a.down * RULES.bankruptcySaleShare)) }))));
      for (const l of p.stocks) body.append(h('div.sellrow', {}, h('span', {}, `${l.symbol} × ${l.shares}`),
        h('button', { onclick: () => act({ type: 'BANKRUPT_SELL', playerId: p.id, lotId: l.id }) }, t('act.bankruptSell', { amount: money(Math.floor(l.shares * l.price * RULES.bankruptcySaleShare)) }))));
      body.append(h('div.row', {}, h('button', { onclick: () => openSheet(p.id) }, t('act.sheet')),
        h('button.primary', { onclick: () => act({ type: 'BANKRUPT_FINISH', playerId: p.id }) }, t('act.bankruptFinish'))));
    }
  } else if (phase === 'card' || phase === 'endTurn') {
    if (state.card) body.append(cardFace(state.card.id), ...cardActions(state, act, canControl));
    else if (state.pending && canControl(state.pending.playerId)) body.append(pendingBox(state, act));
    else if (state.pending) body.append(h('div.hint', {}, t('hint.mustPay', { amount: money(state.pending.amount) })));
    else body.append(h('div.hint', {}, t('phase.endTurn')));
    if (mine) body.append(h('button.primary.big.end', { onclick: () => act({ type: 'END_TURN', playerId: p.id }), disabled: state.pending ? true : null }, t('act.endTurn') + ' →'));
  }
  const last = state.log.slice(-3).map(e => h('div.logline', {}, logLine(state, e)));
  return h('div.panel', {}, h('div.turnno', {}, t('ui.turn', { n: state.turn })), head, body, h('div.lastlog', {}, ...last));
}

function playersPanel(state) {
  const seat = mySeat();
  const online = app.mode === 'host' ? Object.fromEntries(app.host.lobby.map(e => [app.host.seats[e.clientId], e.online])) : null;
  return h('div.panel.players', {}, h('h3', {}, t('ui.players')),
    ...state.order.map(id => {
      const p = state.players.find(x => x.id === id);
      const f = summary(p);
      const status = p.status === 'exited' ? t('ui.exited') : p.status === 'out' ? t('ui.out') : p.skipTurns ? t('hint.skip', { n: p.skipTurns }) : '';
      const net = online && online[id] === false ? ' · ' + t('net.offline') : '';
      return h('button.player' + (id === state.order[state.current] ? '.on' : ''), { onclick: () => openSheet(p.id) },
        h('span.dot', { style: { background: p.color } }),
        h('span.pn', {}, p.name + (id === seat ? ' (' + t('net.you') + ')' : ''), h('small', {}, t('prof.' + p.professionId) + (status ? ' · ' + status : '') + net)),
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function openSheet(playerId) {
  openModal(t('act.sheet'), () => {
    const s = app.game.getState();
    const p = s.players.find(x => x.id === playerId);
    return renderSheet(s, p, p.status === 'playing' && canControl(p.id) ? act : null);
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
  const base = app.mode === 'host' ? app.host.game : app.game;
  const data = JSON.stringify({ mode: app.mode, config: app.config, history: base.history || null, state: base.getState() }, null, 1);
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: 'vyhod-iz-kruga-log.json' });
  document.body.append(a); a.click(); a.remove();
}

function openSettings() {
  openModal(t('ui.settings'), () => {
    const s = app.settings;
    const set = (k, v) => { s[k] = v; saveSettings(s); applySettings(); if (k === 'lang') app.board = null; render(); };
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
window.addEventListener('error', (e) => toast('⚠ ' + (e.message || 'Error'), 'error'));
window.addEventListener('unhandledrejection', (e) => toast('⚠ ' + ((e.reason && e.reason.message) || 'Error'), 'error'));
applySettings();
const joinId = new URLSearchParams(location.search).get('join');
const saved = loadGame();
if (joinId && app.net.lastHost === joinId && app.net.name) startGuest(joinId);   // уже подключались — сразу снова
else if (joinId) { app.screen = 'join'; render(); }
else if (saved) resumeSaved(saved);   // продолжить партию после перезагрузки (и одно устройство, и хост)
else render();
