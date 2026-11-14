// Проверка сетевого протокола без сети: хост и гости соединены «трубой» в памяти.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HostSession } from '../src/net/host.js';
import { RemoteGame } from '../src/net/remote.js';
import { currentPlayer } from '../src/core/engine.js';

function pipe(host, guest) {
  // сообщения проходят через JSON, как по сети
  const toHost = { open: true, send: (m) => host.onMessage(toHost, JSON.parse(JSON.stringify(m))), on() {}, close() {} };
  const toGuest = (m) => guest.onMessage(JSON.parse(JSON.stringify(m)));
  toHost.guestSend = toGuest;
  guest.conn = { open: true, send: (m) => host.onMessage(hostSide, JSON.parse(JSON.stringify(m))) };
  const hostSide = { open: true, send: toGuest, on() {}, close() {} };
  return hostSide;
}

function setup(nGuests = 2) {
  const host = new HostSession({ hostId: 'h', me: { name: 'Хост', color: '#f00' } });
  const guests = [];
  for (let i = 0; i < nGuests; i++) {
    const g = new RemoteGame({ hostId: 'h', clientId: 'c' + i, name: 'Гость' + i, color: '#00f' });
    pipe(host, g);
    g.conn.send({ t: 'hello', clientId: g.clientId, name: g.name, color: g.color });
    guests.push(g);
  }
  return { host, guests };
}

test('лобби: до 4 игроков, пятый получает отказ', () => {
  const { host, guests } = setup(3);
  assert.equal(host.lobby.length, 4);
  const extra = new RemoteGame({ hostId: 'h', clientId: 'c9', name: 'X', color: '#000' });
  pipe(host, extra);
  extra.conn.send({ t: 'hello', clientId: 'c9', name: 'X', color: '#000' });
  assert.equal(extra.status, 'full');
  assert.equal(guests[0].lobby.length, 4);
});

test('старт и синхронность: у всех одинаковое состояние после ходов', async () => {
  const { host, guests } = setup(2);
  host.startGame(123, 'random');
  for (const g of guests) assert.deepEqual(g.getState(), host.game.getState());
  for (let i = 0; i < 60; i++) {
    const s = host.game.getState();
    const p = currentPlayer(s);
    const seatOwner = p.id === host.mySeat() ? null : guests.find(g => g.seat === p.id);
    const send = (a) => seatOwner ? seatOwner.dispatch(a) : host.dispatch(a);
    if (s.phase === 'roll') await send({ type: 'ROLL', playerId: p.id });
    else if (s.phase === 'chooseDeal') await send({ type: 'CHOOSE_DEAL', playerId: p.id, deck: 'small' });
    else if (s.phase === 'charity') await send({ type: 'CHARITY', playerId: p.id, accept: false });
    else if (s.phase === 'bankruptcy') await send({ type: 'BANKRUPT_FINISH', playerId: p.id });
    else {
      if (s.pending) {
        const pp = s.players.find(x => x.id === s.pending.playerId);
        if (pp.cash < s.pending.amount) await send({ type: 'TAKE_LOAN', playerId: pp.id, amount: Math.ceil((s.pending.amount - pp.cash) / 1000) * 1000 });
        await send({ type: 'PAY_PENDING', playerId: pp.id });
      }
      await send({ type: 'END_TURN', playerId: p.id });
    }
    for (const g of guests) assert.deepEqual(g.getState(), host.game.getState());
  }
});

test('гость не может ходить за чужого игрока', async () => {
  const { host, guests } = setup(1);
  host.startGame(5, 'random');
  const other = host.mySeat();
  const r = await guests[0].dispatch({ type: 'TAKE_LOAN', playerId: other, amount: 1000 });
  assert.equal(r.error.key, 'err.notYourPlayer');
  const r2 = host.dispatch({ type: 'TAKE_LOAN', playerId: guests[0].seat, amount: 1000 });
  assert.equal(r2.error.key, 'err.notYourPlayer');
});

test('переподключение: гость получает своё место и полное состояние', () => {
  const { host, guests } = setup(1);
  host.startGame(7, 'random');
  const seat = guests[0].seat;
  const again = new RemoteGame({ hostId: 'h', clientId: 'c0', name: 'Гость0', color: '#00f' });
  pipe(host, again);
  again.conn.send({ t: 'hello', clientId: 'c0' });
  assert.equal(again.seat, seat);
  assert.deepEqual(again.getState(), host.game.getState());
});

test('пропущенное сообщение: гость запрашивает полную синхронизацию', () => {
  const { host, guests } = setup(1);
  host.startGame(9, 'random');
  const g = guests[0];
  g.state = { ...g.state, seq: g.state.seq - 1 }; // имитируем рассинхрон
  const p = currentPlayer(host.game.getState());
  host.game.dispatch({ type: 'TAKE_LOAN', playerId: p.id, amount: 1000 });
  assert.deepEqual(g.getState(), host.game.getState());
});
