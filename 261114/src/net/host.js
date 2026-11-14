// Хост сетевой игры. Хранит единственное настоящее состояние (LocalGame),
// принимает действия гостей, проверяет, что гость действует только за своего игрока,
// и рассылает всем само действие. Гости применяют его тем же движком — состояние у всех одинаковое,
// а по сети идут только маленькие сообщения (минимальная задержка).
import { LocalGame } from './localGame.js';
import { createGame } from '../core/engine.js';
import { loadPeer, peerOptions } from './peer.js';

export const MAX_NET_PLAYERS = 4;

export class HostSession {
  constructor({ hostId, me, onChange }) {
    this.hostId = hostId;
    this.onChange = onChange || (() => {});
    this.lobby = [{ clientId: 'host', name: me.name, color: me.color, online: true }];
    this.conns = new Map();   // clientId → connection
    this.game = null;
    this.seats = {};          // clientId → playerId
    this.status = 'connecting';
    this.closed = false;
  }

  async open() {
    const Peer = await loadPeer();
    const start = () => {
      if (this.closed) return;
      this.peer = new Peer(this.hostId, peerOptions());
      this.peer.on('open', () => { this.status = 'ready'; this.onChange(); });
      this.peer.on('connection', (conn) => this.accept(conn));
      this.peer.on('disconnected', () => { if (!this.closed) setTimeout(() => this.peer && !this.peer.destroyed && this.peer.reconnect(), 1000); });
      this.peer.on('error', (err) => {
        this.status = 'error:' + (err.type || 'unknown'); this.onChange();
        // id ещё занят прошлой сессией или сеть пропала — пробуем снова
        if (['unavailable-id', 'network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          try { this.peer.destroy(); } catch { /* уже закрыт */ }
          setTimeout(start, 2000);
        }
      });
    };
    start();
  }

  close() { this.closed = true; try { this.peer && this.peer.destroy(); } catch { /* уже закрыт */ } }

  accept(conn) {
    conn.on('data', (msg) => this.onMessage(conn, msg));
    conn.on('close', () => {
      if (conn.clientId && this.conns.get(conn.clientId) === conn) {
        this.conns.delete(conn.clientId);
        const e = this.lobby.find(x => x.clientId === conn.clientId);
        if (e) e.online = false;
        this.broadcastLobby();
      }
    });
  }

  send(conn, msg) { try { if (conn.open) conn.send(msg); } catch { /* соединение закрыто */ } }
  broadcast(msg) { for (const c of this.conns.values()) this.send(c, msg); }
  broadcastLobby() { this.broadcast({ t: 'lobby', lobby: this.lobby, started: !!this.game }); this.onChange(); }

  onMessage(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const clientId = String(msg.clientId || '').slice(0, 40);
      if (!clientId || clientId === 'host') return;
      let entry = this.lobby.find(x => x.clientId === clientId);
      if (!entry) {
        if (this.game || this.lobby.length >= MAX_NET_PLAYERS) { this.send(conn, { t: 'full' }); return; }
        entry = { clientId, name: '', color: '' };
        this.lobby.push(entry);
      }
      if (!this.game) { entry.name = String(msg.name || '').slice(0, 16); entry.color = String(msg.color || '#888').slice(0, 9); }
      entry.online = true;
      const old = this.conns.get(clientId);
      if (old && old !== conn) try { old.close(); } catch { /* уже закрыт */ }
      conn.clientId = clientId;
      this.conns.set(clientId, conn);
      this.send(conn, { t: 'welcome', lobby: this.lobby });
      if (this.game) this.send(conn, { t: 'state', state: this.game.getState(), seat: this.seats[clientId] || null });
      this.broadcastLobby();
      return;
    }
    if (!conn.clientId) return;
    if (msg.t === 'action' && this.game) {
      const seat = this.seats[conn.clientId];
      const action = msg.action || {};
      let error = null;
      if (!seat || action.playerId !== seat) error = { key: 'err.notYourPlayer', params: {} };
      else error = this.game.dispatch(action).error;
      this.send(conn, { t: 'res', id: msg.id, error });
    } else if (msg.t === 'sync' && this.game) {
      this.send(conn, { t: 'state', state: this.game.getState(), seat: this.seats[conn.clientId] || null });
    }
  }

  // Начать партию: игроки — участники лобби по порядку подключения.
  startGame(seed, professionMode) {
    const players = this.lobby.map(e => ({ name: e.name, color: e.color }));
    const config = { seed, players, professionMode };
    this.lobby.forEach((e, i) => { this.seats[e.clientId] = `p${i + 1}`; });
    this.attach(new LocalGame(createGame(config)));
    for (const [clientId, conn] of this.conns) this.send(conn, { t: 'state', state: this.game.getState(), seat: this.seats[clientId] });
    this.broadcastLobby();
    return config;
  }

  // Восстановить партию после перезагрузки страницы хоста.
  resume(state, history, seats, lobby) {
    this.seats = seats;
    this.lobby = lobby.map(e => ({ ...e, online: e.clientId === 'host' }));
    this.attach(new LocalGame(state, history));
  }

  attach(game) {
    this.game = game;
    game.subscribe((state, events, action) => {
      if (action) this.broadcast({ t: 'act', action, seq: state.seq });
      else this.broadcast({ t: 'state', state });
    });
  }

  mySeat() { return this.seats.host; }
  // Действие с экрана хоста — только за своего игрока.
  dispatch(action) {
    if (action.playerId !== this.mySeat()) return { error: { key: 'err.notYourPlayer', params: {} }, events: [] };
    return this.game.dispatch(action);
  }
}
