// Транспорт игры. Интерфейс один для всех режимов:
//   getState()          → текущее состояние
//   dispatch(action)    → { error, events }   (action = { type, playerId, ... })
//   subscribe(fn)       → fn(state, events, action) после каждого изменения; возвращает отписку
//
// LocalGame — всё на одном устройстве (версия 1).
// Для игры по сети (дома или через интернет) добавляется RemoteGame с тем же интерфейсом:
// он отправляет action на сервер (WebSocket), а сервер-хост вызывает тот же applyAction
// и рассылает новое состояние всем. Движок и интерфейс при этом не меняются.
import { applyAction } from '../core/engine.js';

export class LocalGame {
  constructor(state, history = []) {
    this.state = state;
    this.history = history;     // все применённые действия — для журнала и воспроизведения ошибок
    this.listeners = new Set();
  }
  getState() { return this.state; }
  dispatch(action) {
    const { state, events, error } = applyAction(this.state, action);
    if (error) return { error, events: [] };
    this.state = state;
    this.history.push(action);
    if (this.history.length > 5000) this.history.splice(0, this.history.length - 5000);
    for (const fn of this.listeners) fn(state, events, action);
    return { error: null, events };
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  // Полная замена состояния (синхронизация с хостом или загрузка).
  replace(state) { this.state = state; for (const fn of this.listeners) fn(state, [], null); }
}
