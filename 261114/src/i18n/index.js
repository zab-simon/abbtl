// Переводы. Базовый язык — английский (ключи и запасной вариант),
// первая версия показывается на русском. Новый язык = новый файл + строка в LANGS.
import { RU } from './ru.js';
import { EN } from './en.js';
import { CARDS_RU } from './cards.ru.js';

export const LANGS = { ru: { name: 'Русский', ui: RU, cards: CARDS_RU }, en: { name: 'English', ui: EN, cards: {} } };
export const BASE_LANG = 'en';
let lang = 'ru';

export function setLang(code) { if (LANGS[code]) lang = code; }
export function getLang() { return lang; }

export function t(key, params = {}) {
  const s = LANGS[lang].ui[key] ?? LANGS[BASE_LANG].ui[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

export function cardText(id) {
  return LANGS[lang].cards[id] ?? LANGS[BASE_LANG].cards[id] ?? null;
}

// Деньги: «$13.200» для русского (как на карточках профессий), «$13,200» для английского.
export function money(n) {
  const sep = t('fmt.thousands');
  const abs = Math.abs(Math.round(n * 100) / 100);
  const [int, frac] = String(abs).split('.');
  const s = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (frac ? t('fmt.decimal') + frac : '');
  return (n < 0 ? '-' : '') + '$' + s;
}
