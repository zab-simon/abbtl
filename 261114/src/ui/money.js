// Наличные купюрами — номиналы из комплекта игры.
import { h } from './dom.js';
import { money } from '../i18n/index.js';

export const DENOMS = [1000000, 500000, 100000, 50000, 10000, 5000, 1000, 500, 100, 50, 20, 10];

// Разложить сумму на купюры (как выдал бы банкир: крупными).
export function toNotes(cash) {
  let rest = Math.max(0, Math.floor(cash));
  const out = [];
  for (const d of DENOMS) {
    const n = Math.floor(rest / d);
    if (n) { out.push([d, n]); rest -= n * d; }
  }
  return { notes: out, rest };
}

export function wallet(cash) {
  const { notes, rest } = toNotes(cash);
  return h('div.wallet', { title: money(cash) },
    ...notes.map(([d, n]) => h('span.note.n' + d, {}, h('b', {}, money(d)), n > 1 ? h('i', {}, '×' + n) : null)),
    rest ? h('span.coins', {}, '+' + money(rest)) : null,
    cash < 0 ? h('span.debt', {}, money(cash)) : null);
}
