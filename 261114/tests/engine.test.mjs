// Автотесты правил. Запуск: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, currentPlayer, byId } from '../src/core/engine.js';
import { PROFESSIONS, PROFESSION_CHECKS } from '../src/data/professions.js';
import { DECKS, getCard } from '../src/data/cards.js';
import { RAT_RACE } from '../src/data/board.js';
import { totalExpenses, monthlyCashFlow, passiveIncome } from '../src/core/finance.js';
import { CARDS_RU } from '../src/i18n/cards.ru.js';
import { RU } from '../src/i18n/ru.js';
import { EN } from '../src/i18n/en.js';

const game = (n = 2, seed = 42) => createGame({ seed, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, color: '#000' })) });
const ok = (s, a) => { const r = applyAction(s, a); assert.equal(r.error, null, JSON.stringify(r.error)); return r.state; };
const forceCard = (s, id, playerId) => { s.card = { id, drawerId: playerId, holderId: playerId, bought: false }; s.phase = 'card'; };

test('итоги профессий совпадают с карточками', () => {
  for (const prof of PROFESSIONS) {
    const s = createGame({ seed: 1, professionMode: 'choose', players: [{ name: 'x', color: '#000', professionId: prof.id }] });
    const p = s.players[0];
    assert.equal(totalExpenses(p), PROFESSION_CHECKS[prof.id].totalExpenses, prof.id);
    assert.equal(monthlyCashFlow(p), PROFESSION_CHECKS[prof.id].cashFlow, prof.id);
    assert.equal(p.cash, PROFESSION_CHECKS[prof.id].cashFlow + prof.savings, prof.id);
  }
});

test('поле: 24 клетки, 3 чека, 3 рынка, 3 траты', () => {
  assert.equal(RAT_RACE.length, 24);
  for (const k of ['paycheck', 'market', 'doodad']) assert.equal(RAT_RACE.filter(c => c === k).length, 3);
  assert.equal(RAT_RACE.filter(c => c === 'opportunity').length, 12);
});

test('у каждой карточки есть текст, у каждого ключа — перевод', () => {
  for (const list of Object.values(DECKS)) for (const c of list) assert.ok(CARDS_RU[c.id], c.id);
  for (const k of Object.keys(RU)) assert.ok(k in EN, 'en missing ' + k);
  for (const k of Object.keys(EN)) assert.ok(k in RU, 'ru missing ' + k);
});

test('игроков от 1 до 10', () => {
  assert.ok(game(1)); assert.ok(game(10));
  assert.throws(() => game(11));
});

test('детерминированность: одинаковый seed — одинаковая игра', () => {
  let a = game(3, 7), b = game(3, 7);
  for (let i = 0; i < 30; i++) {
    const pa = currentPlayer(a);
    for (const s of [a, b]) void s;
    const step = (s) => {
      const p = currentPlayer(s);
      let r = applyAction(s, { type: 'ROLL', playerId: p.id });
      if (r.error) return s;
      s = r.state;
      if (s.phase === 'chooseDeal') s = applyAction(s, { type: 'CHOOSE_DEAL', playerId: p.id, deck: 'small' }).state;
      if (s.phase === 'charity') s = applyAction(s, { type: 'CHARITY', playerId: p.id, accept: false }).state;
      if (s.pending) { const pp = byId(s, s.pending.playerId); if (pp.cash < s.pending.amount) s = applyAction(s, { type: 'TAKE_LOAN', playerId: pp.id, amount: Math.ceil((s.pending.amount - pp.cash) / 1000) * 1000 }).state; s = applyAction(s, { type: 'PAY_PENDING', playerId: pp.id }).state; }
      if (s.phase === 'bankruptcy') s = applyAction(s, { type: 'BANKRUPT_FINISH', playerId: p.id }).state;
      return applyAction(s, { type: 'END_TURN', playerId: p.id }).state;
    };
    a = step(a); b = step(b);
    assert.deepEqual(a, b);
    void pa;
  }
});

test('состояние сериализуется в JSON без потерь', () => {
  const s = game(4);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('чек оплаты при проходе', () => {
  let s = game(1);
  const p = s.players[0];
  p.position = 5; // следующая клетка — чек оплаты (6)
  const before = p.cash, cf = monthlyCashFlow(p);
  s = ok(s, { type: 'ROLL', playerId: p.id });
  const after = s.players[0];
  if (after.position >= 6) assert.equal(after.cash, before + cf);
});

test('покупка недвижимости и продажа на рынке', () => {
  let s = game(2);
  const p = currentPlayer(s);
  forceCard(s, 's09', p.id); // дом 3/2: 50000 / взнос 4000 / ипотека 46000 / +200
  byId(s, p.id).cash = 10000;
  const cash = byId(s, p.id).cash;
  s = ok(s, { type: 'BUY_ASSET', playerId: p.id });
  let me = byId(s, p.id);
  assert.equal(me.cash, cash - 4000);
  assert.equal(passiveIncome(me), 200);
  forceCard(s, 'm19', p.id); // покупатель на дом 3/2 за 135000
  s = ok(s, { type: 'MARKET_SELL', playerId: p.id, assetId: me.assets[0].id });
  me = byId(s, p.id);
  assert.equal(me.cash, cash - 4000 + 135000 - 46000);
  assert.equal(me.assets.length, 0);
});

test('продажа за квартиру: многоквартирный дом', () => {
  let s = game(1);
  const p = s.players[0];
  p.cash = 100000;
  forceCard(s, 'b12', p.id); // 8 квартир, ипотека 128000
  s = ok(s, { type: 'BUY_ASSET', playerId: p.id });
  forceCard(s, 'm06', p.id); // 40000 за квартиру
  const a = s.players[0].assets[0];
  const c = s.players[0].cash;
  s = ok(s, { type: 'MARKET_SELL', playerId: p.id, assetId: a.id });
  assert.equal(s.players[0].cash, c + 8 * 40000 - 128000);
});

test('кредит: кратно 1000, 10% в месяц, частичный возврат', () => {
  let s = game(1);
  const p = s.players[0];
  const cf = monthlyCashFlow(p);
  assert.ok(applyAction(s, { type: 'TAKE_LOAN', playerId: p.id, amount: 1500 }).error);
  s = ok(s, { type: 'TAKE_LOAN', playerId: p.id, amount: 5000 });
  assert.equal(monthlyCashFlow(s.players[0]), cf - 500);
  s = ok(s, { type: 'REPAY_LOAN', playerId: p.id, amount: 2000 });
  assert.equal(monthlyCashFlow(s.players[0]), cf - 300);
});

test('погашение долга убирает и долг, и расход', () => {
  let s = game(1);
  const p = s.players[0];
  p.cash = 1000000;
  const cf = monthlyCashFlow(p);
  const pay = p.expenses.carLoan;
  s = ok(s, { type: 'PAY_OFF', playerId: p.id, line: 'carLoan' });
  assert.equal(s.players[0].liabilities.carLoan, 0);
  assert.equal(monthlyCashFlow(s.players[0]), cf + pay);
});

test('акции: покупка, продажа, дробление', () => {
  let s = game(2);
  const p = currentPlayer(s);
  const other = s.players.find(x => x.id !== p.id);
  byId(s, p.id).cash = 10000;
  forceCard(s, 's03', p.id); // OK4U $10
  assert.ok(applyAction(s, { type: 'BUY_STOCK', playerId: other.id, qty: 10 }).error); // только вытянувший
  s = ok(s, { type: 'BUY_STOCK', playerId: p.id, qty: 100 });
  assert.equal(byId(s, p.id).cash, 9000);
  forceCard(s, 's49', p.id); // дробление OK4U — эффект при вытягивании, поэтому применим вручную через drawCard-аналог
  s.card = null; s.phase = 'chooseDeal';
  s.decks.small.draw.push('s49');
  s = ok(s, { type: 'CHOOSE_DEAL', playerId: p.id, deck: 'small' });
  assert.equal(byId(s, p.id).stocks[0].shares, 200);
  forceCard(s, 's52', p.id); // OK4U $50
  s = ok(s, { type: 'SELL_STOCK', playerId: p.id, lotId: byId(s, p.id).stocks[0].id, qty: 200 });
  assert.equal(byId(s, p.id).cash, 9000 + 200 * 50);
});

test('депозит: доход 20 в месяц', () => {
  let s = game(1);
  const p = s.players[0];
  p.cash = 10000;
  forceCard(s, 's13', p.id);
  s = ok(s, { type: 'BUY_STOCK', playerId: p.id, qty: 1 });
  assert.equal(passiveIncome(s.players[0]), 20);
});

test('давай потратимся: обязательный платёж блокирует конец хода', () => {
  let s = game(1);
  const p = s.players[0];
  s.phase = 'chooseDeal'; // нужно состояние перед вытягиванием
  s.decks.doodad.draw.push('d20'); // отпуск 2000
  // симулируем попадание на клетку
  s.phase = 'card';
  s.card = { id: 'd20', drawerId: p.id, holderId: p.id, bought: false };
  s.pending = { playerId: p.id, amount: 2000, reason: 'doodad' };
  assert.ok(applyAction(s, { type: 'END_TURN', playerId: p.id }).error);
  s.players[0].cash = 2000;
  s = ok(s, { type: 'PAY_PENDING', playerId: p.id });
  assert.equal(s.players[0].cash, 0);
});

test('катер: 1000 наличными и новый долг 17000 / 340', () => {
  let s = game(1);
  const p = s.players[0];
  p.cash = 5000;
  const cf = monthlyCashFlow(p);
  s.card = { id: 'd24', drawerId: p.id, holderId: p.id, bought: false };
  s.phase = 'card';
  s.pending = { playerId: p.id, amount: 1000, reason: 'doodad', loan: getCard('d24').loan };
  s = ok(s, { type: 'PAY_PENDING', playerId: p.id });
  assert.equal(s.players[0].cash, 4000);
  assert.equal(monthlyCashFlow(s.players[0]), cf - 340);
});

test('благотворительность: 10% общего дохода, 2 кубика 3 хода', () => {
  let s = game(1);
  const p = s.players[0];
  p.cash = 100000;
  s.phase = 'charity';
  const inc = p.salary;
  s = ok(s, { type: 'CHARITY', playerId: p.id, accept: true });
  assert.equal(s.players[0].cash, 100000 - Math.round(inc * 0.1));
  assert.equal(s.players[0].charityTurns, 3);
});

test('выход из круга в начале хода', () => {
  let s = game(2);
  const p = currentPlayer(s);
  const me = byId(s, p.id);
  me.assets.push({ id: 'x', kind: 'apartment', units: 60, cost: 0, down: 0, mortgage: 0, cashFlow: 1000000 });
  s.phase = 'endTurn';
  s = ok(s, { type: 'END_TURN', playerId: p.id });
  // ход другого игрока, затем снова наш — мы выходим
  const q = currentPlayer(s);
  s.phase = 'endTurn';
  s = ok(s, { type: 'END_TURN', playerId: q.id });
  assert.equal(byId(s, p.id).status, 'exited');
  assert.deepEqual(s.finished, [p.id]);
});

test('банкротство: продажа за половину взноса', () => {
  let s = game(1);
  const p = s.players[0];
  p.assets.push({ id: 'h', kind: 'house32', cost: 50000, down: 4000, mortgage: 46000, cashFlow: -100000 });
  p.cash = 0;
  p.position = 5;
  s.lastRoll = null;
  // гарантируем попадание на чек: ставим на клетку 5 и бросаем, пока не пройдём 6
  const r = applyAction(s, { type: 'ROLL', playerId: p.id });
  s = r.state;
  assert.equal(s.phase, 'bankruptcy');
  s = ok(s, { type: 'BANKRUPT_SELL', playerId: p.id, assetId: 'h' });
  assert.equal(s.players[0].cash, 2000);
  s = ok(s, { type: 'BANKRUPT_FINISH', playerId: p.id });
  assert.equal(s.players[0].skipTurns, 3);
});

test('все колоды: количество карточек', () => {
  assert.equal(DECKS.small.length, 56);
  assert.equal(DECKS.big.length, 41);
  assert.equal(DECKS.market.length, 42);
  assert.equal(DECKS.doodad.length, 42);
});

test('длинная случайная партия без ошибок (10 игроков)', () => {
  let s = createGame({ seed: 99, players: Array.from({ length: 10 }, (_, i) => ({ name: 'P' + i, color: '#000' })) });
  for (let i = 0; i < 2000 && s.phase !== 'gameOver'; i++) {
    const p = currentPlayer(s);
    const tryA = (a) => { const r = applyAction(s, a); if (!r.error) s = r.state; return !r.error; };
    if (s.phase === 'roll') tryA({ type: 'ROLL', playerId: p.id, dice: 2 });
    else if (s.phase === 'chooseDeal') tryA({ type: 'CHOOSE_DEAL', playerId: p.id, deck: i % 3 ? 'small' : 'big' });
    else if (s.phase === 'charity') tryA({ type: 'CHARITY', playerId: p.id, accept: p.cash > 20000 });
    else if (s.phase === 'bankruptcy') {
      const me = byId(s, p.id);
      for (const a of [...me.assets]) tryA({ type: 'BANKRUPT_SELL', playerId: p.id, assetId: a.id });
      for (const l of [...me.stocks]) tryA({ type: 'BANKRUPT_SELL', playerId: p.id, lotId: l.id });
      tryA({ type: 'BANKRUPT_FINISH', playerId: p.id });
    } else {
      if (s.card) {
        const c = getCard(s.card.id);
        if (c.type === 'asset') tryA({ type: 'BUY_ASSET', playerId: p.id });
        if (c.type === 'stock') tryA({ type: 'BUY_STOCK', playerId: p.id, qty: 10 });
        if (c.deck === 'market') for (const pl of s.players) for (const a of [...pl.assets]) tryA({ type: 'MARKET_SELL', playerId: pl.id, assetId: a.id });
      }
      if (s.pending) {
        const pp = byId(s, s.pending.playerId);
        if (pp.cash < s.pending.amount) tryA({ type: 'TAKE_LOAN', playerId: pp.id, amount: Math.ceil((s.pending.amount - pp.cash) / 1000) * 1000 });
        tryA({ type: 'PAY_PENDING', playerId: pp.id });
      }
      assert.ok(tryA({ type: 'END_TURN', playerId: p.id }), 'end turn failed in phase ' + s.phase);
    }
    for (const pl of s.players) assert.ok(Number.isFinite(pl.cash));
  }
});
