// Числовые параметры правил. Всё из правил игры; менять только здесь.
export const RULES = {
  minPlayers: 1,
  maxPlayers: 10,
  maxChildren: 3,
  loanStep: 1000,            // кредиты кратны $1,000
  loanRateMonthly: 0.10,     // 10% в месяц
  charityShare: 0.10,        // благотворительность: 10% общего дохода
  charityTurns: 3,           // ... даёт 2 кубика на 3 следующих хода
  downsizedSkipTurns: 2,     // безработица: пропустить 2 хода
  bankruptcySkipTurns: 3,    // банкротство: пропустить 3 хода
  bankruptcySaleShare: 0.5,  // активы продаются банку за половину уплаченного
  bankruptcyDebtCut: 0.5,    // списание половины авто/карт/розничного долга
  smallDealMax: 5000,
  bigDealMin: 6000,
};
