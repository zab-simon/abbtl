// Гость сетевой игры. Тот же интерфейс, что у LocalGame: getState / dispatch / subscribe.
// Действия отправляются хосту; хост рассылает принятые действия, и гость применяет их тем же движком.
import { applyAction } from '../core/engine.js';
import { loadPeer, peerOptions } from './peer.js';

export class RemoteGame {
  constructor({ hostId, clientId, name, color, onStatus }) {
    Object.assign(this, { hostId, clientId, name, color });
    this.onStatus = onStatus || (() => {});
    this.state = null;
    this.seat = null;
    this.lobby = [];
    this.status = 'connecting';
    this.listeners = new Set();
    this.pending = new Map();
    this.nextId = 1;
    this.closed = false;
  }

  async connect() {
    const Peer = await loadPeer();
    this.peer = new Peer(undefined, peerOptions());
    this.peer.on('open', () => this.dial());
    this.peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') { this.setStatus('hostOffline'); setTimeout(() => this.dial(), 2000); }
      else this.setStatus('error:' + (err.type || 'unknown'));
    });
    this.peer.on('disconnected', () => { if (!this.closed) setTimeout(() => this.peer && !this.peer.destroyed && this.peer.reconnect(), 1000); });
  }

  dial() {
    if (this.closed || !this.peer || this.peer.destroyed || this.peer.disconnected) return;
    if (this.conn && this.conn.open) return;
    const conn = this.peer.connect(this.hostId, { reliable: true, serialization: 'json' });
    this.conn = conn;
    conn.on('open', () => { this.setStatus('connected'); conn.send({ t: 'hello', clientId: this.clientId, name: this.name, color: this.color }); });
    conn.on('data', (msg) => this.onMessage(msg));
    conn.on('close', () => { if (this.conn === conn) { this.setStatus('reconnecting'); setTimeout(() => this.dial(), 1500); } });
    conn.on('error', () => { /* обработает close */ });
  }

  setStatus(s) { this.status = s; this.onStatus(this); }
  close() { this.closed = true; try { this.peer && this.peer.destroy(); } catch { /* уже закрыт */ } }

  onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'welcome' || msg.t === 'lobby') { this.lobby = msg.lobby || []; this.onStatus(this); }
    else if (msg.t === 'full') this.setStatus('full');
    else if (msg.t === 'state') {
      this.state = msg.state;
      if (msg.seat !== undefined) this.seat = msg.seat;
      for (const fn of this.listeners) fn(this.state, [], null);
      this.onStatus(this);
    } else if (msg.t === 'act') {
      if (!this.state || msg.seq !== this.state.seq + 1) { this.send({ t: 'sync' }); return; }
      const r = applyAction(this.state, msg.action);
      if (r.error || r.state.seq !== msg.seq) { this.send({ t: 'sync' }); return; }
      this.state = r.state;
      for (const fn of this.listeners) fn(this.state, r.events, msg.action);
    } else if (msg.t === 'res') {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); p({ error: msg.error, events: [] }); }
    }
  }

  send(msg) { try { if (this.conn && this.conn.open) { this.conn.send(msg); return true; } } catch { /* соединение закрыто */ } return false; }

  getState() { return this.state; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  dispatch(action) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const offline = { error: { key: 'err.offline', params: {} }, events: [] };
      // ждём ответ ДО отправки: ответ может прийти мгновенно
      const timer = setTimeout(() => { if (this.pending.delete(id)) resolve(offline); }, 8000);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      if (!this.send({ t: 'action', id, action })) { this.pending.delete(id); clearTimeout(timer); resolve(offline); }
    });
  }
}
