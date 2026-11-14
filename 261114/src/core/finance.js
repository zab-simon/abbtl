// Все итоговые цифры бланка ВЫЧИСЛЯЮТСЯ, а не хранятся.
// Единственный источник правды — строки бланка игрока. Так итоги не могут разойтись.
import { RULES } from '../data/rules.js';

export const EXPENSE_LINES = ['taxes', 'homeMortgage', 'schoolLoan', 'carLoan', 'creditCard', 'retail', 'other'];
export const LIABILITY_LINES = ['homeMortgage', 'schoolLoan', 'carLoan', 'creditCard', 'retail'];
// Долги, которые можно погасить целиком (налоги, другие расходы и детские — нельзя).
export const PAYABLE_LINES = ['homeMortgage', 'schoolLoan', 'carLoan', 'creditCard', 'retail'];

export const REAL_ESTATE_KINDS = ['condo21', 'house32', 'plex', 'apartment', 'land', 'mall', 'installment'];
export const RENTAL_KINDS = ['condo21', 'house32', 'plex', 'apartment', 'mall'];

export function isRealEstate(asset) { return REAL_ESTATE_KINDS.includes(asset.kind); }

export function bankLoanPayment(p) { return Math.round(p.bankLoan * RULES.loanRateMonthly); }
export function childExpenses(p) { return p.children * p.perChild; }

export function interestIncome(p) {
  // «Капиталовложения»: доход по депозитам (CD).
  return p.stocks.filter(s => s.symbol === 'CD').reduce((a, s) => a + s.shares * s.dividend, 0);
}
export function dividendIncome(p) {
  return p.stocks.filter(s => s.symbol !== 'CD').reduce((a, s) => a + s.shares * s.dividend, 0);
}
export function realEstateIncome(p) {
  return p.assets.filter(isRealEstate).reduce((a, x) => a + x.cashFlow, 0);
}
export function businessIncome(p) {
  return p.assets.filter(x => !isRealEstate(x)).reduce((a, x) => a + x.cashFlow, 0);
}
export function passiveIncome(p) {
  return interestIncome(p) + dividendIncome(p) + realEstateIncome(p) + businessIncome(p);
}
export function totalIncome(p) { return p.salary + passiveIncome(p); }

export function extraPayments(p) { return p.extraLiabilities.reduce((a, l) => a + l.payment, 0); }

export function totalExpenses(p) {
  const lines = EXPENSE_LINES.reduce((a, k) => a + p.expenses[k], 0);
  return lines + childExpenses(p) + bankLoanPayment(p) + extraPayments(p);
}
export function monthlyCashFlow(p) { return totalIncome(p) - totalExpenses(p); }

// Условие выхода из круга: пассивный доход больше общих расходов.
export function canExitRatRace(p) { return passiveIncome(p) > totalExpenses(p); }

export function loanNeeded(cash, amount) {
  const missing = amount - cash;
  if (missing <= 0) return 0;
  return Math.ceil(missing / RULES.loanStep) * RULES.loanStep;
}

export function summary(p) {
  return {
    salary: p.salary,
    interest: interestIncome(p),
    dividends: dividendIncome(p),
    realEstate: realEstateIncome(p),
    business: businessIncome(p),
    passiveIncome: passiveIncome(p),
    totalIncome: totalIncome(p),
    childExpenses: childExpenses(p),
    bankLoanPayment: bankLoanPayment(p),
    totalExpenses: totalExpenses(p),
    cashFlow: monthlyCashFlow(p),
  };
}
