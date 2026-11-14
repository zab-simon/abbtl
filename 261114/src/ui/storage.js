// Сохранение в браузере. Любая ошибка чтения — просто «нет сохранения».
import { STATE_VERSION } from '../core/engine.js';

const GAME_KEY = 'vyhod.game.v1';
const SETTINGS_KEY = 'vyhod.settings.v1';
const NET_KEY = 'vyhod.net.v1';

export const DEFAULT_SETTINGS = {
  lang: 'ru', theme: 'cartoon', sound: true, diceMs: 700, stepMs: 90, professionMode: 'random', sheetPane: false,
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* нет хранилища */ } }

export function saveGame(data) { try { localStorage.setItem(GAME_KEY, JSON.stringify(data)); } catch { /* нет хранилища */ } }
export function clearGame() { try { localStorage.removeItem(GAME_KEY); } catch { /* нет хранилища */ } }
export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(GAME_KEY) || 'null');
    if (!d || !d.state || d.state.version !== STATE_VERSION || !Array.isArray(d.state.players)) return null;
    return d;
  } catch { return null; }
}

// Сетевые данные устройства: свой id хоста (QR всегда один и тот же), id гостя, имя, цвет, последний хост.
export function loadNet() { try { return JSON.parse(localStorage.getItem(NET_KEY) || '{}') || {}; } catch { return {}; } }
export function saveNet(n) { try { localStorage.setItem(NET_KEY, JSON.stringify(n)); } catch { /* нет хранилища */ } }
