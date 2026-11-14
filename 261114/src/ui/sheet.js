// Бланк игрока — по структуре один к одному с бумажным бланком.
// Все суммы считаются движком (finance.js); игрок ничего не заполняет.
import { h } from './dom.js';
import { t, money } from '../i18n/index.js';
import { summary, EXPENSE_LINES, LIABILITY_LINES, isRealEstate, canExitRatRace, loanNeeded } from '../core/finance.js';
import { assetLabel } from './format.js';

const row = (label, value, cls = '') => h('div.srow' + (cls ? '.' + cls : ''), {}, h('span.slabel', {}, label), h('span.sval', {}, value ?? ''));

export function renderSheet(state, p, act) {
  const f = summary(p);
  const order = state.order;
  const idx = order.indexOf(p.id);
  const auditor = state.players.find(x => x.id === order[(idx - 1 + order.length) % order.length]);
  const re = p.assets.filter(isRealEstate);
  const biz = p.assets.filter(a => !isRealEstate(a));
  const cds = p.stocks.filter(s => s.symbol === 'CD');
  const divs = p.stocks.filter(s => s.symbol !== 'CD' && s.dividend > 0);

  const incomeBox = h('div.sbox.income', {},
    h('div.shead', {}, t('sheet.income')),
    h('div.scols', {}, h('span', {}, t('sheet.description')), h('span', {}, t('sheet.amount'))),
    row(t('sheet.salary'), money(p.salary)),
    row(t('sheet.interest'), cds.length ? money(f.interest) : ''),
    row(t('sheet.dividends'), divs.length ? money(f.dividends) : ''),
    ...divs.map(s => row('  ' + s.symbol, money(s.shares * s.dividend), 'sub')),
    row(t('sheet.realEstate'), ''),
    ...re.map(a => row('  ' + assetLabel(a), money(a.cashFlow), 'sub')),
    row(t('sheet.business'), ''),
    ...biz.map(a => row('  ' + assetLabel(a), money(a.cashFlow), 'sub')),
  );

  const childRow = row(t('sheet.exp.children'), p.children ? money(f.childExpenses) : '');
  const expBox = h('div.sbox.expenses', {},
    h('div.shead', {}, t('sheet.expenses')),
    ...EXPENSE_LINES.slice(0, 7).map(k => row(t('sheet.exp.' + k), p.expenses[k] ? money(p.expenses[k]) : '')),
    childRow,
    row(t('sheet.exp.bankLoan'), p.bankLoan ? money(f.bankLoanPayment) : ''),
    ...p.extraLiabilities.map(l => row(t('liab.' + l.id), money(l.payment))),
  );

  const right = h('div.sright', {},
    h('div.sauditor', {}, h('span.stag', {}, t('sheet.auditor')), h('span.sline', {}, auditor && auditor.id !== p.id ? auditor.name : '')),
    h('div.shint.center', {}, t('sheet.auditorHint')),
    h('div.sformula', {}, h('b', {}, t('sheet.passive')), ' ', h('span.big', {}, money(f.passiveIncome))),
    h('div.shint', {}, t('sheet.passiveHint')),
    h('div.stotal', {}, h('b', {}, t('sheet.totalIncome')), ' ', h('span.big', {}, money(f.totalIncome))),
    h('div.schildren', {},
      h('div', {}, h('b', {}, t('sheet.children')), ' ', h('span.big', {}, String(p.children))),
      h('div.shint', {}, t('sheet.childrenHint')),
      h('div', {}, h('b', {}, t('sheet.perChild')), ' ', h('span', {}, money(p.perChild)))),
    h('div.stotal', {}, h('b', {}, t('sheet.totalExpenses')), ' ', h('span.big', {}, money(f.totalExpenses))),
    h('div.stotal.flow' + (f.cashFlow < 0 ? '.neg' : ''), {}, h('b', {}, t('sheet.cashFlow')), ' ', h('span.big', {}, money(f.cashFlow))),
    h('div.shint.center', {}, t('sheet.cashFlowHint')),
  );

  const assets = h('div.sbox', {},
    h('div.shead', {}, t('sheet.assets')),
    row(t('sheet.savings'), ''),
    h('div.scols3', {}, h('span', {}, t('sheet.stocks')), h('span', {}, t('sheet.shares')), h('span', {}, t('sheet.price'))),
    ...p.stocks.map(s => h('div.scols3.sub', {}, h('span', {}, s.symbol), h('span', {}, String(s.shares)), h('span', {}, money(s.price)))),
    h('div.scols3', {}, h('span', {}, t('sheet.realEstate')), h('span', {}, t('sheet.reDown')), h('span', {}, t('sheet.cost'))),
    ...re.map(a => h('div.scols3.sub', {}, h('span', {}, assetLabel(a)), h('span', {}, money(a.down)), h('span', {}, money(a.cost)))),
    h('div.scols3', {}, h('span', {}, t('sheet.business')), h('span', {}, t('sheet.reDown')), h('span', {}, t('sheet.cost'))),
    ...biz.map(a => h('div.scols3.sub', {}, h('span', {}, assetLabel(a)), h('span', {}, money(a.down)), h('span', {}, money(a.cost)))),
  );

  const payBtn = (line, amount) => act && amount > 0
    ? h('button.small', { onclick: () => act({ type: 'PAY_OFF', playerId: p.id, line }), disabled: p.cash < amount ? true : null }, t('act.payOff', { amount: money(amount) }))
    : null;
  const liabilities = h('div.sbox', {},
    h('div.shead', {}, t('sheet.liabilities')),
    ...LIABILITY_LINES.map(k => h('div.srow', {}, h('span.slabel', {}, t('sheet.liab.' + k)), h('span.sval', {}, p.liabilities[k] ? money(p.liabilities[k]) : ''), payBtn(k, p.liabilities[k]))),
    ...p.extraLiabilities.map(l => h('div.srow', {}, h('span.slabel', {}, t('liab.' + l.id)), h('span.sval', {}, money(l.amount)), payBtn(l.id, l.amount))),
    row(t('sheet.liab.mortgages'), ''),
    ...re.filter(a => a.mortgage).map(a => row('  ' + assetLabel(a), money(a.mortgage), 'sub')),
    row(t('sheet.liab.business'), ''),
    ...biz.filter(a => a.mortgage).map(a => row('  ' + assetLabel(a), money(a.mortgage), 'sub')),
    row(t('sheet.liab.bankLoan'), p.bankLoan ? money(p.bankLoan) : ''),
  );

  const bank = act ? bankControls(state, p, act) : null;

  return h('div.sheet', {},
    h('div.stop', {},
      h('div.stagline', {}, h('span.stag', {}, t('sheet.profession')), h('span.sline', {}, t('prof.' + p.professionId))),
      h('div.stagline', {}, h('span.stag', {}, t('sheet.player')), h('span.sline', {}, p.name))),
    h('div.sgoal', {}, t('sheet.goal')),
    canExitRatRace(p) ? h('div.sexit', {}, t('sheet.exitReady')) : null,
    h('div.scash', {}, t('sheet.cash') + ': ', h('b', {}, money(p.cash))),
    h('h3.stitle', {}, t('sheet.statement')),
    h('div.sgrid', {}, h('div.sleft', {}, incomeBox, expBox), right),
    h('h3.stitle', {}, t('sheet.balance')),
    h('div.sgrid2', {}, assets, liabilities),
    bank,
  );
}

export function bankControls(state, p, act) {
  const input = h('input.num', { type: 'number', min: 1000, step: 1000, value: 1000, inputmode: 'numeric' });
  return h('div.bank', {},
    h('label', {}, t('act.amount') + ' $', input),
    h('button', { onclick: () => act({ type: 'TAKE_LOAN', playerId: p.id, amount: Number(input.value) }) }, t('act.loan')),
    p.bankLoan ? h('button', { onclick: () => act({ type: 'REPAY_LOAN', playerId: p.id, amount: Number(input.value) }) }, t('act.repay')) : null,
  );
}

export function loanButton(p, amount, act) {
  const need = loanNeeded(p.cash, amount);
  if (!need) return null;
  return h('button.loan', { onclick: () => act({ type: 'TAKE_LOAN', playerId: p.id, amount: need }) }, t('act.loanFor', { amount: money(need) }));
}
