// Подписи для активов, карточек и строк журнала.
import { t, money, cardText } from '../i18n/index.js';
import { getCard } from '../data/cards.js';

export function assetLabel(a) {
  let s = t('asset.' + a.kind, { units: a.units, acres: a.acres, coins: a.coins });
  if (a.sub) s += ': ' + t('sub.' + a.sub);
  return s;
}

export function cardTitle(id) {
  const tx = cardText(id);
  if (tx) return tx[0];
  const c = getCard(id);
  if (!c) return id;
  if (c.type === 'asset') return assetLabel(c.asset);
  if (c.type === 'stock' || c.type === 'split') return c.symbol;
  return t('deck.' + c.deck);
}

const MONEY_KEYS = new Set(['amount', 'price', 'net', 'cash']);
export function logLine(state, entry) {
  const params = {};
  for (const [k, v] of Object.entries(entry.params || {})) {
    if (['player', 'from', 'to'].includes(k)) params[k] = state.players.find(p => p.id === v)?.name ?? v;
    else if (k === 'card') params[k] = cardTitle(v);
    else if (k === 'asset') params[k] = v in { condo21: 1, house32: 1, plex: 1, apartment: 1, land: 1, mall: 1, motel: 1, carwash: 1, pizzaFranchise: 1, automated: 1, partnership: 1, company: 1, goldCoin: 1, krugerrand: 1, relativeLoan: 1, installment: 1 } ? t('asset.' + v, { units: '', acres: '', coins: '' }) : v;
    else if (k === 'deck') params[k] = t('deck.' + v);
    else if (MONEY_KEYS.has(k)) params[k] = money(v);
    else params[k] = v;
  }
  return t(entry.key, params);
}

export function errorText(err) {
  const p = { ...err.params };
  for (const k of Object.keys(p)) if (MONEY_KEYS.has(k)) p[k] = money(p[k]);
  return t(err.key, p);
}
