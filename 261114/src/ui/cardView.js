// Карточка и действия по ней.
import { h } from './dom.js';
import { t, money, cardText } from '../i18n/index.js';
import { getCard } from '../data/cards.js';
import { marketOffer } from '../core/engine.js';
import { assetLabel, cardTitle } from './format.js';
import { loanButton } from './sheet.js';

const pct = (cashFlow, down) => (down > 0 ? Math.round((cashFlow * 12 / down) * 100) + '%' : '—');

export function cardFace(id) {
  const c = getCard(id);
  const tx = cardText(id);
  const nums = [];
  const kv = (k, v) => nums.push(h('div.kv', {}, h('span', {}, k), h('b', {}, v)));
  if (c.type === 'asset') {
    kv(t('card.cost'), money(c.cost));
    kv(t('card.down'), money(c.down));
    kv(t('card.mortgage'), money(c.mortgage));
    kv(t('card.cashFlow'), (c.cashFlow > 0 ? '+' : '') + money(c.cashFlow));
    kv(t('card.roi'), pct(c.cashFlow, c.down));
    if (c.resale) nums.push(h('div.note', {}, t('card.resale', { lo: money(c.resale[0]), hi: money(c.resale[1]) })));
    if (c.asset.kind === 'automated') nums.push(h('div.note', {}, t('card.noResale')));
    if (c.noLoan) nums.push(h('div.note.warn', {}, t('card.noLoan')));
  } else if (c.type === 'stock') {
    kv(t('card.symbol'), c.symbol);
    kv(t('card.priceToday'), money(c.price));
    kv(t('card.range'), money(c.range[0]) + ' – ' + money(c.range[1]));
    kv(t('card.dividend'), c.dividend ? money(c.dividend) : t('card.noDividend'));
  } else if (c.type === 'split') {
    kv(t('card.symbol'), c.symbol);
    nums.push(h('div.note', {}, t(c.factor > 1 ? 'card.split2' : 'card.split05')));
  } else if (c.type === 'damage') {
    nums.push(h('div.note', {}, t(c.condition === 'plex8' ? 'card.plumbing' : 'card.damage', { amount: money(c.amount) })));
  } else if (c.type === 'pay') {
    if (c.perChild) nums.push(h('div.note', {}, t('card.perChild', { amount: money(c.pay) })));
    else if (c.loan) nums.push(h('div.note', {}, t('card.boatLoan', { amount: money(c.pay), loan: money(c.loan.amount), payment: money(c.loan.payment) })));
    else nums.push(h('div.big', {}, t('card.pay', { amount: money(c.pay) })));
    if (c.childOnly) nums.push(h('div.note', {}, t('card.payChild')));
    if (c.creditOption) nums.push(h('div.note', {}, t('card.credit', { debt: money(c.creditOption.debt), payment: money(c.creditOption.payment) })));
  } else if (c.type === 'sell') {
    nums.push(h('div.big', {}, c.perUnit ? t('card.perUnit', { amount: money(c.price) }) : c.perCoin ? t('card.perCoin', { amount: money(c.price) }) : t('card.price', { amount: money(c.price) })));
  } else if (c.type === 'sellMultiple') {
    nums.push(h('div.big', {}, t('card.multiple', { n: c.multiple })));
  } else if (c.type === 'priceUp') {
    nums.push(h('div.big', {}, t('card.plus', { amount: money(c.plus) })));
  } else if (c.type === 'boost') {
    nums.push(h('div.big', {}, t('card.boost', { amount: money(c.amount) })));
  } else if (c.type === 'sonInLaw') {
    nums.push(h('div.big', {}, '+' + money(c.cashFlow)));
  }
  return h('div.card.card-' + c.deck, {},
    h('div.card-deck', {}, t('deck.' + c.deck)),
    h('div.card-title', {}, cardTitle(id)),
    tx ? h('div.card-text', {}, tx[1]) : null,
    h('div.card-nums', {}, ...nums));
}

// Действия по активной карточке для всех игроков (одно устройство).
export function cardActions(state, act) {
  const c = getCard(state.card.id);
  const holder = state.players.find(p => p.id === state.card.holderId);
  const active = state.players.filter(p => p.status === 'playing');
  const out = [];

  if (c.type === 'asset') {
    out.push(h('div.hint', {}, t('hint.holder', { player: holder.name })));
    if (!state.card.bought) {
      out.push(h('div.row', {},
        h('button.primary', { onclick: () => act({ type: 'BUY_ASSET', playerId: holder.id }), disabled: holder.cash < c.down ? true : null }, t('act.buy', { amount: money(c.down) })),
        c.noLoan ? null : loanButton(holder, c.down, act)));
      const others = active.filter(p => p.id !== holder.id);
      if (others.length) {
        const sel = h('select', {}, ...others.map(p => h('option', { value: p.id }, p.name)));
        const price = h('input.num', { type: 'number', min: 0, step: 100, value: 0, inputmode: 'numeric' });
        out.push(h('details.transfer', {}, h('summary', {}, t('act.transfer')),
          h('div.row', {}, h('label', {}, t('act.transferTo') + ' ', sel), h('label', {}, t('act.transferPrice') + ' $', price),
            h('button', { onclick: () => act({ type: 'TRANSFER_CARD', playerId: holder.id, toPlayerId: sel.value, price: Number(price.value) }) }, t('act.transferDo')))));
      }
    }
  }

  if (c.type === 'stock') {
    const buyers = c.anyoneBuys ? active : [holder];
    for (const p of active) {
      const lots = p.stocks.filter(s => s.symbol === c.symbol);
      const canBuy = buyers.includes(p);
      if (!canBuy && !lots.length) continue;
      const line = h('div.stockrow', {}, h('span.pname', { style: { borderColor: p.color } }, p.name));
      if (canBuy) {
        const max = Math.floor(p.cash / c.price);
        const q = h('input.num', { type: 'number', min: 1, step: 1, value: Math.max(1, Math.min(max, 100)), inputmode: 'numeric' });
        line.append(h('label', {}, t('act.qty') + ' ', q),
          h('button.small', { onclick: () => { q.value = Math.max(1, Math.floor(p.cash / c.price)); } }, t('act.maxQty')),
          h('button', { onclick: () => act({ type: 'BUY_STOCK', playerId: p.id, qty: Number(q.value) }) }, t('act.buyStock')));
      }
      for (const lot of lots) {
        const q = h('input.num', { type: 'number', min: 1, max: lot.shares, step: 1, value: lot.shares, inputmode: 'numeric' });
        line.append(h('span.lot', {}, `${lot.shares} × ${money(lot.price)}`), q,
          h('button', { onclick: () => act({ type: 'SELL_STOCK', playerId: p.id, lotId: lot.id, qty: Number(q.value) }) }, t('act.sellStock')));
      }
      out.push(line);
    }
  }

  if (c.deck === 'market') {
    let any = false;
    const rows = [];
    for (const p of active) for (const a of p.assets) {
      const offer = marketOffer(state, c, p, a);
      if (offer === null) continue;
      any = true;
      const net = offer - a.mortgage;
      const label = c.type === 'sonInLaw' ? t('act.applySonInLaw') : t('act.sell', { amount: money(offer) }) + ' · ' + t('act.sellNet', { amount: money(net) });
      rows.push(h('div.sellrow', {}, h('span.pname', { style: { borderColor: p.color } }, p.name), h('span', {}, assetLabel(a)),
        h('button', { onclick: () => act({ type: 'MARKET_SELL', playerId: p.id, assetId: a.id }) }, label)));
    }
    if (['sell', 'sellMultiple', 'priceUp', 'sonInLaw'].includes(c.type)) {
      out.push(h('div.hint', {}, any ? t('hint.othersSell') : t('hint.nobodyEligible')), ...rows);
    }
  }

  if (state.pending) out.push(pendingBox(state, act));
  return out;
}

export function pendingBox(state, act) {
  const p = state.players.find(x => x.id === state.pending.playerId);
  const amount = state.pending.amount;
  const c = state.card && getCard(state.card.id);
  return h('div.pending', {},
    h('div.hint', {}, t('hint.mustPay', { amount: money(amount) }) + ' (' + p.name + ')'),
    h('div.row', {},
      h('button.primary', { onclick: () => act({ type: 'PAY_PENDING', playerId: p.id }), disabled: p.cash < amount ? true : null }, t('act.pay', { amount: money(amount) })),
      loanButton(p, amount, act),
      c && c.creditOption ? h('button', { onclick: () => act({ type: 'PAY_PENDING', playerId: p.id, method: 'credit' }) }, t('act.payCredit')) : null));
}

export { assetLabel };
