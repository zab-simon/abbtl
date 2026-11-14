// Движок правил. Чистые функции, без DOM и без сети.
//   createGame(config)            → начальное состояние
//   applyAction(state, action)    → { state, events, error }
// Состояние — обычный JSON. Любое изменение игры — только через действие (action).
// Поэтому одну и ту же игру можно вести на одном устройстве, по локальной сети
// или через интернет: сервер просто вызывает applyAction.

import { RULES } from '../data/rules.js';
import { RAT_RACE } from '../data/board.js';
import { PROFESSIONS } from '../data/professions.js';
import { DECKS, getCard } from '../data/cards.js';
import { rollDie, randomInt, shuffle } from './rng.js';
import {
  PAYABLE_LINES, RENTAL_KINDS, totalIncome, totalExpenses, monthlyCashFlow, canExitRatRace,
} from './finance.js';

export const STATE_VERSION = 1;

// ---------- Создание игры ----------

// config = { seed, players: [{ name, color, professionId? }], professionMode: 'random'|'choose' }
export function createGame(config) {
  const n = config.players.length;
  if (n < RULES.minPlayers || n > RULES.maxPlayers) throw new Error('bad player count');
  const state = {
    version: STATE_VERSION,
    rng: { seed: (config.seed >>> 0) || 1 },
    turn: 1,
    phase: 'roll',
    players: [],
    order: [],
    current: 0,
    decks: {},
    card: null,        // активная карточка
    pending: null,     // обязательный платёж { playerId, amount, reason }
    lastRoll: null,
    initiative: [],
    finished: [],      // порядок вышедших из круга
    log: [],
    seq: 0,            // номер последнего применённого действия
  };

  // Профессии: случайно из колоды (как в коробке) или выбранная заранее.
  let profDeck = shuffle(state.rng, PROFESSIONS.map(p => p.id));
  config.players.forEach((pc, i) => {
    let profId = pc.professionId;
    if (!profId || config.professionMode !== 'choose') {
      if (profDeck.length === 0) profDeck = shuffle(state.rng, PROFESSIONS.map(p => p.id));
      profId = profDeck.pop();
    }
    state.players.push(newPlayer(`p${i + 1}`, pc.name, pc.color, profId));
  });

  for (const [name, list] of Object.entries(DECKS)) {
    state.decks[name] = { draw: shuffle(state.rng, list.map(c => c.id)), discard: [] };
  }

  // Кто ходит первым: каждый бросает кубик, при равенстве перебрасывают претенденты.
  let contenders = state.players.map(p => p.id);
  const rounds = [];
  while (contenders.length > 1) {
    const round = contenders.map(id => ({ id, die: rollDie(state.rng) }));
    rounds.push(round);
    const max = Math.max(...round.map(r => r.die));
    contenders = round.filter(r => r.die === max).map(r => r.id);
  }
  state.initiative = rounds;
  const firstIdx = state.players.findIndex(p => p.id === contenders[0]);
  state.order = state.players.map((_, i) => state.players[(firstIdx + i) % n].id);
  state.current = 0;
  log(state, 'log.firstPlayer', { player: contenders[0] });
  startTurn(state, []);
  return state;
}

function newPlayer(id, name, color, professionId) {
  const prof = PROFESSIONS.find(p => p.id === professionId);
  const p = {
    id, name, color, professionId,
    salary: prof.salary,
    perChild: prof.perChild,
    savings: prof.savings,
    children: 0,
    expenses: { ...prof.expenses },
    liabilities: { ...prof.liabilities },
    bankLoan: 0,
    extraLiabilities: [],   // например, кредит на катер
    assets: [],
    stocks: [],
    cash: 0,
    position: 0,            // 0 — «Старт», 1..24 — клетки круга
    skipTurns: 0,
    charityTurns: 0,
    status: 'playing',      // playing | exited | out
    nextAssetNo: 1,
  };
  // Банкир выдаёт: месячный денежный поток + сбережения.
  p.cash = monthlyCashFlow(p) + prof.savings;
  return p;
}

// ---------- Применение действий ----------

export function applyAction(prev, action) {
  const state = structuredClone(prev);
  const events = [];
  try {
    const handler = HANDLERS[action.type];
    if (!handler) throw new RuleError('err.unknownAction');
    handler(state, action, events);
    state.seq += 1;
    return { state, events, error: null };
  } catch (e) {
    if (e instanceof RuleError) return { state: prev, events: [], error: { key: e.key, params: e.params } };
    throw e;
  }
}

export class RuleError extends Error {
  constructor(key, params = {}) { super(key); this.key = key; this.params = params; }
}
const fail = (key, params) => { throw new RuleError(key, params); };

export function currentPlayer(state) { return byId(state, state.order[state.current]); }
export function byId(state, id) { return state.players.find(p => p.id === id); }

function actor(state, action) {
  const p = byId(state, action.playerId);
  if (!p) fail('err.noPlayer');
  return p;
}
function requireCurrent(state, action) {
  const p = actor(state, action);
  if (p.id !== currentPlayer(state).id) fail('err.notYourTurn');
  return p;
}
function requirePhase(state, ...phases) {
  if (!phases.includes(state.phase)) fail('err.wrongPhase');
}

function log(state, key, params = {}) {
  state.log.push({ turn: state.turn, key, params });
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
}

function pay(state, p, amount, reasonKey) {
  if (p.cash < amount) fail('err.notEnoughCash', { amount, cash: p.cash });
  p.cash -= amount;
}

const HANDLERS = {
  // --- ход ---
  ROLL(state, action, events) {
    const p = requireCurrent(state, action);
    requirePhase(state, 'roll');
    let diceCount = 1;
    if (p.charityTurns > 0) {
      diceCount = 2;            // благотворительность: 3 хода бросаете по две кости сразу
      p.charityTurns -= 1;
    }
    const dice = [];
    for (let i = 0; i < diceCount; i++) dice.push(rollDie(state.rng));
    const total = dice.reduce((a, b) => a + b, 0);
    state.lastRoll = { playerId: p.id, dice, total };
    const from = p.position;
    const path = [];
    let bankrupt = false;
    for (let s = 1; s <= total; s++) {
      p.position = (p.position % RAT_RACE.length) + 1;
      path.push(p.position);
      if (cellAt(p.position) === 'paycheck') {
        if (!collectPaycheck(state, p, events)) { bankrupt = true; break; }
      }
    }
    events.push({ type: 'move', playerId: p.id, dice, from, path });
    log(state, 'log.rolled', { player: p.id, dice: dice.join('+'), total });
    if (bankrupt) return;
    land(state, p, events);
  },

  CHOOSE_DEAL(state, action, events) {
    const p = requireCurrent(state, action);
    requirePhase(state, 'chooseDeal');
    if (action.deck !== 'small' && action.deck !== 'big') fail('err.badDeck');
    drawCard(state, action.deck, p, events);
  },

  // Покупка актива с карточки сделки (тот, у кого сейчас карточка).
  BUY_ASSET(state, action, events) {
    const p = actor(state, action);
    const c = activeCard(state, 'asset');
    if (state.card.holderId !== p.id) fail('err.notHolder');
    if (state.card.bought) fail('err.alreadyBought');
    pay(state, p, c.down);
    const asset = {
      id: `${p.id}-a${p.nextAssetNo++}`, cardId: c.id, ...c.asset,
      cost: c.cost, down: c.down, mortgage: c.mortgage, cashFlow: c.cashFlow,
    };
    p.assets.push(asset);
    state.card.bought = true;
    log(state, 'log.bought', { player: p.id, card: c.id, amount: c.down });
    events.push({ type: 'cash', playerId: p.id, delta: -c.down });
  },

  // Передать (продать) возможность другому игроку по договорной цене.
  TRANSFER_CARD(state, action) {
    const from = actor(state, action);
    const c = activeCard(state, 'asset');
    if (state.card.holderId !== from.id) fail('err.notHolder');
    if (state.card.bought) fail('err.alreadyBought');
    const to = byId(state, action.toPlayerId);
    if (!to || to.id === from.id || to.status !== 'playing') fail('err.noPlayer');
    const price = Math.max(0, Math.floor(Number(action.price) || 0));
    pay(state, to, price);
    from.cash += price;
    state.card.holderId = to.id;
    log(state, 'log.transferred', { from: from.id, to: to.id, card: c.id, amount: price });
  },

  BUY_STOCK(state, action, events) {
    const p = actor(state, action);
    const c = activeCard(state, 'stock');
    if (!c.anyoneBuys && state.card.holderId !== p.id) fail('err.notHolder');
    const qty = Math.floor(Number(action.qty));
    if (!(qty > 0)) fail('err.badQty');
    const cost = qty * c.price;
    pay(state, p, cost);
    let lot = p.stocks.find(s => s.symbol === c.symbol && s.price === c.price && s.dividend === c.dividend);
    if (lot) lot.shares += qty;
    else p.stocks.push({ id: `${p.id}-s${p.nextAssetNo++}`, symbol: c.symbol, shares: qty, price: c.price, dividend: c.dividend });
    log(state, 'log.boughtStock', { player: p.id, symbol: c.symbol, qty, price: c.price });
    events.push({ type: 'cash', playerId: p.id, delta: -cost });
  },

  SELL_STOCK(state, action, events) {
    const p = actor(state, action);
    const c = activeCard(state, 'stock');
    const lot = p.stocks.find(s => s.id === action.lotId);
    if (!lot || lot.symbol !== c.symbol) fail('err.noAsset');
    const qty = Math.floor(Number(action.qty));
    if (!(qty > 0) || qty > lot.shares) fail('err.badQty');
    lot.shares -= qty;
    if (lot.shares === 0) p.stocks = p.stocks.filter(s => s !== lot);
    p.cash += qty * c.price;
    log(state, 'log.soldStock', { player: p.id, symbol: c.symbol, qty, price: c.price });
    events.push({ type: 'cash', playerId: p.id, delta: qty * c.price });
  },

  // Продажа актива по карточке «Рынок».
  MARKET_SELL(state, action, events) {
    const p = actor(state, action);
    const c = state.card && getCard(state.card.id);
    if (!c || c.deck !== 'market') fail('err.noCard');
    const asset = p.assets.find(a => a.id === action.assetId);
    if (!asset) fail('err.noAsset');
    const offer = marketOffer(state, c, p, asset);
    if (offer === null) fail('err.notEligible');
    if (c.type === 'sonInLaw') {
      p.assets = p.assets.filter(a => a !== asset);
      p.assets.push({ id: `${p.id}-a${p.nextAssetNo++}`, cardId: c.id, kind: 'installment', cost: 0, down: 0, mortgage: 0, cashFlow: c.cashFlow });
      log(state, 'log.sonInLaw', { player: p.id });
      return;
    }
    const net = offer - asset.mortgage;
    if (net < 0) pay(state, p, -net); else p.cash += net;
    p.assets = p.assets.filter(a => a !== asset);
    log(state, 'log.sold', { player: p.id, asset: asset.kind, price: offer, net });
    events.push({ type: 'cash', playerId: p.id, delta: net });
  },

  // «Давай потратимся», ущерб, безработица — обязательный платёж.
  PAY_PENDING(state, action, events) {
    const p = actor(state, action);
    if (!state.pending || state.pending.playerId !== p.id) fail('err.nothingToPay');
    const { amount } = state.pending;
    if (action.method === 'credit') {
      const c = state.card && getCard(state.card.id);
      if (!c || !c.creditOption) fail('err.noCredit');
      p.liabilities.creditCard += c.creditOption.debt;
      p.expenses.creditCard += c.creditOption.payment;
      log(state, 'log.paidByCredit', { player: p.id, amount: c.creditOption.debt });
    } else {
      pay(state, p, amount);
      events.push({ type: 'cash', playerId: p.id, delta: -amount });
      log(state, 'log.paid', { player: p.id, amount, reason: state.pending.reason });
    }
    const loan = state.pending.loan;
    if (loan) {
      p.extraLiabilities.push({ id: loan.id, amount: loan.amount, payment: loan.payment });
      log(state, 'log.newLiability', { player: p.id, liability: loan.id, amount: loan.amount });
    }
    state.pending = null;
  },

  CHARITY(state, action, events) {
    const p = requireCurrent(state, action);
    requirePhase(state, 'charity');
    if (action.accept) {
      const amount = Math.round(totalIncome(p) * RULES.charityShare);
      pay(state, p, amount);
      p.charityTurns = RULES.charityTurns;
      log(state, 'log.charity', { player: p.id, amount });
      events.push({ type: 'cash', playerId: p.id, delta: -amount });
    }
    state.phase = 'endTurn';
  },

  // --- банк (доступно любому игроку в любой момент, кроме процедуры банкротства) ---
  TAKE_LOAN(state, action, events) {
    const p = actor(state, action);
    if (p.status !== 'playing') fail('err.noPlayer');
    if (state.phase === 'bankruptcy' && currentPlayer(state).id === p.id) fail('err.bankruptNoLoan');
    if (state.card && state.card.holderId === p.id) {
      const c = getCard(state.card.id);
      if (c.noLoan && !state.card.bought) fail('err.noLoanForThisCard');
    }
    const amount = Math.floor(Number(action.amount));
    if (!(amount > 0) || amount % RULES.loanStep !== 0) fail('err.loanStep');
    p.bankLoan += amount;
    p.cash += amount;
    log(state, 'log.loan', { player: p.id, amount });
    events.push({ type: 'cash', playerId: p.id, delta: amount });
  },

  REPAY_LOAN(state, action, events) {
    const p = actor(state, action);
    const amount = Math.floor(Number(action.amount));
    if (!(amount > 0) || amount % RULES.loanStep !== 0 || amount > p.bankLoan) fail('err.loanStep');
    pay(state, p, amount);
    p.bankLoan -= amount;
    log(state, 'log.repaid', { player: p.id, amount });
    events.push({ type: 'cash', playerId: p.id, delta: -amount });
  },

  // Погасить долг целиком (ипотека за дом, образование, авто, карты, розничный, доп. кредиты).
  PAY_OFF(state, action, events) {
    const p = actor(state, action);
    if (PAYABLE_LINES.includes(action.line)) {
      const debt = p.liabilities[action.line];
      if (!debt) fail('err.noDebt');
      pay(state, p, debt);
      p.liabilities[action.line] = 0;
      p.expenses[action.line] = 0;
      log(state, 'log.paidOff', { player: p.id, line: action.line, amount: debt });
      events.push({ type: 'cash', playerId: p.id, delta: -debt });
      return;
    }
    const extra = p.extraLiabilities.find(l => l.id === action.line);
    if (!extra) fail('err.noDebt');
    pay(state, p, extra.amount);
    p.extraLiabilities = p.extraLiabilities.filter(l => l !== extra);
    log(state, 'log.paidOff', { player: p.id, line: extra.id, amount: extra.amount });
    events.push({ type: 'cash', playerId: p.id, delta: -extra.amount });
  },

  // --- банкротство ---
  BANKRUPT_SELL(state, action, events) {
    const p = requireCurrent(state, action);
    requirePhase(state, 'bankruptcy');
    if (action.assetId) {
      const a = p.assets.find(x => x.id === action.assetId);
      if (!a) fail('err.noAsset');
      const value = Math.floor(a.down * RULES.bankruptcySaleShare);
      p.assets = p.assets.filter(x => x !== a);
      p.cash += value;
      log(state, 'log.bankruptSold', { player: p.id, asset: a.kind, amount: value });
      events.push({ type: 'cash', playerId: p.id, delta: value });
    } else {
      const lot = p.stocks.find(s => s.id === action.lotId);
      if (!lot) fail('err.noAsset');
      const value = Math.floor(lot.shares * lot.price * RULES.bankruptcySaleShare);
      p.stocks = p.stocks.filter(s => s !== lot);
      p.cash += value;
      log(state, 'log.bankruptSold', { player: p.id, asset: lot.symbol, amount: value });
      events.push({ type: 'cash', playerId: p.id, delta: value });
    }
  },

  BANKRUPT_FINISH(state, action) {
    const p = requireCurrent(state, action);
    requirePhase(state, 'bankruptcy');
    if (monthlyCashFlow(p) < 0) {
      if (p.assets.length || p.stocks.length) fail('err.sellMore');
      if (!state.bankruptcyCut) {
        // Списание половины кредита на авто, карт и розничного долга (и их платежей).
        for (const k of ['carLoan', 'creditCard', 'retail']) {
          p.liabilities[k] = Math.floor(p.liabilities[k] * RULES.bankruptcyDebtCut);
          p.expenses[k] = Math.floor(p.expenses[k] * RULES.bankruptcyDebtCut);
        }
        state.bankruptcyCut = true;
        log(state, 'log.debtCut', { player: p.id });
      }
      if (monthlyCashFlow(p) < 0) {
        p.status = 'out';
        log(state, 'log.out', { player: p.id });
      }
    }
    if (p.status === 'playing') {
      p.skipTurns = RULES.bankruptcySkipTurns;
      log(state, 'log.bankruptDone', { player: p.id });
    }
    state.bankruptcyCut = false;
    state.phase = 'endTurn';
  },

  END_TURN(state, action, events) {
    const p = requireCurrent(state, action);
    requirePhase(state, 'endTurn', 'card');
    if (state.pending) fail('err.mustPay');
    if (state.card) {
      const c = getCard(state.card.id);
      state.decks[c.deck].discard.push(c.id);
      state.card = null;       // возможность исчезает с передачей хода
    }
    nextPlayer(state, events);
  },
};

// ---------- Вспомогательные правила ----------

function cellAt(position) { return RAT_RACE[position - 1]; }

function activeCard(state, type) {
  const c = state.card && getCard(state.card.id);
  if (!c || c.type !== type) fail('err.noCard');
  return c;
}

// Возвращает false, если наступило банкротство.
function collectPaycheck(state, p, events) {
  const cf = monthlyCashFlow(p);
  if (cf < 0 && p.cash < -cf) {
    state.phase = 'bankruptcy';
    log(state, 'log.bankrupt', { player: p.id });
    events.push({ type: 'bankrupt', playerId: p.id });
    return false;
  }
  p.cash += cf;
  log(state, 'log.paycheck', { player: p.id, amount: cf });
  events.push({ type: 'paycheck', playerId: p.id, delta: cf });
  return true;
}

function land(state, p, events) {
  const cell = cellAt(p.position);
  events.push({ type: 'land', playerId: p.id, cell });
  switch (cell) {
    case 'opportunity': state.phase = 'chooseDeal'; break;
    case 'doodad': drawCard(state, 'doodad', p, events); break;
    case 'market': drawCard(state, 'market', p, events); break;
    case 'charity': state.phase = 'charity'; break;
    case 'baby':
      if (p.children < RULES.maxChildren) {
        p.children += 1;
        log(state, 'log.baby', { player: p.id, children: p.children });
      } else log(state, 'log.noMoreBabies', { player: p.id });
      state.phase = 'endTurn';
      break;
    case 'downsized': {
      const amount = totalExpenses(p);
      p.skipTurns = RULES.downsizedSkipTurns;
      p.charityTurns = 0;
      state.pending = { playerId: p.id, amount, reason: 'downsized' };
      log(state, 'log.downsized', { player: p.id, amount });
      state.phase = 'endTurn';
      break;
    }
    case 'paycheck': state.phase = 'endTurn'; break;
    default: state.phase = 'endTurn';
  }
}

function drawCard(state, deckName, p, events) {
  const deck = state.decks[deckName];
  if (deck.draw.length === 0) {
    deck.draw = shuffle(state.rng, deck.discard);
    deck.discard = [];
    log(state, 'log.reshuffled', { deck: deckName });
  }
  const id = deck.draw.pop();
  const c = getCard(id);
  state.card = { id, drawerId: p.id, holderId: p.id, bought: false };
  state.phase = 'card';
  log(state, 'log.drew', { player: p.id, card: id });
  events.push({ type: 'card', playerId: p.id, cardId: id });
  // Мгновенные эффекты карточки.
  if (c.type === 'split') {
    for (const pl of state.players) for (const lot of pl.stocks) {
      if (lot.symbol !== c.symbol) continue;
      if (c.factor > 1) { lot.shares *= c.factor; lot.price = lot.price / c.factor; }
      else { lot.shares = Math.floor(lot.shares * c.factor); lot.price = lot.price / c.factor; }
    }
    for (const pl of state.players) pl.stocks = pl.stocks.filter(s => s.shares > 0);
  } else if (c.type === 'damage') {
    const has = c.condition === 'plex8'
      ? p.assets.some(a => a.kind === 'plex' && a.units === 8)
      : p.assets.some(a => RENTAL_KINDS.includes(a.kind));
    if (has) state.pending = { playerId: p.id, amount: c.amount, reason: 'damage' };
  } else if (c.type === 'pay') {
    let amount = c.pay;
    if (c.childOnly && p.children === 0) amount = 0;
    if (c.perChild) amount = c.pay * p.children;
    if (amount > 0) state.pending = { playerId: p.id, amount, reason: 'doodad', loan: c.loan || null };
  } else if (c.type === 'boost') {
    for (const pl of state.players) for (const a of pl.assets) if (a.kind === 'company') a.cashFlow += c.amount;
    log(state, 'log.boost', { amount: c.amount });
  } else if (c.type === 'foreclose') {
    const lost = p.assets.filter(a => a.kind === 'house32');
    p.assets = p.assets.filter(a => a.kind !== 'house32');
    if (lost.length) log(state, 'log.foreclosed', { player: p.id, count: lost.length });
  }
}

// Цена, которую рынок даёт игроку p за актив, или null, если продать нельзя.
export function marketOffer(state, c, p, asset) {
  if (!state.card || state.card.id !== c.id) return null;
  const t = c.target;
  if (!t || !t.kinds.includes(asset.kind)) return null;
  if (t.sub && asset.sub !== t.sub) return null;
  if (t.acres && asset.acres !== t.acres) return null;
  if (t.minUnits && !(asset.units >= t.minUnits)) return null;
  const drawerOnly = ['priceUp', 'sonInLaw', 'foreclose'].includes(c.type);
  if (drawerOnly && state.card.drawerId !== p.id) return null;
  switch (c.type) {
    case 'sell':
      if (c.perUnit) return c.price * (asset.units || 1);
      if (c.perCoin) return c.price * (asset.coins || 1);
      return c.price;
    case 'sellMultiple': return asset.cost * c.multiple;
    case 'priceUp': return asset.cost + c.plus;
    case 'sonInLaw': return 0;
    default: return null;
  }
}

function startTurn(state, events) {
  // Пропуск ходов (безработица, банкротство) и проверка выхода из круга.
  for (let guard = 0; guard < state.order.length * 5; guard++) {
    const active = state.order.map(id => byId(state, id)).filter(p => p.status === 'playing');
    if (active.length === 0) { state.phase = 'gameOver'; return; }
    const p = currentPlayer(state);
    if (p.status !== 'playing') { advance(state); continue; }
    if (canExitRatRace(p)) {
      p.status = 'exited';
      state.finished.push(p.id);
      log(state, 'log.exited', { player: p.id });
      events.push({ type: 'exited', playerId: p.id });
      advance(state);
      continue;
    }
    if (p.skipTurns > 0) {
      p.skipTurns -= 1;
      log(state, 'log.skip', { player: p.id, left: p.skipTurns });
      advance(state);
      continue;
    }
    state.phase = 'roll';
    return;
  }
  state.phase = 'roll';
}

function advance(state) {
  state.current = (state.current + 1) % state.order.length;
  if (state.current === 0) state.turn += 1;
}

function nextPlayer(state, events) {
  state.lastRoll = null;
  advance(state);
  startTurn(state, events);
}

// Сколько кубиков бросает игрок сейчас.
export function diceCount(p) { return p.charityTurns > 0 ? 2 : 1; }
