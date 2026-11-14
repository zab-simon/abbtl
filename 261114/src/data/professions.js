// Профессии. Все цифры взяты один к одному с карточек профессий из присланных материалов.
// Расходы в месяц; долги (пассивы) — общая сумма.
// Поля: salary — заработок, savings — сбережения, perChild — расходы на одного ребёнка.
// expenses: taxes, homeMortgage, schoolLoan, carLoan, creditCard, retail, other.
// liabilities: homeMortgage, schoolLoan, carLoan, creditCard, retail.
// См. DECISIONS.md, пункт P1 (Швейцар).

export const PROFESSIONS = [
  { id: 'doctor', salary: 13200, savings: 400, perChild: 640,
    expenses: { taxes: 3420, homeMortgage: 1900, schoolLoan: 750, carLoan: 380, creditCard: 270, retail: 50, other: 2880 },
    liabilities: { homeMortgage: 202000, schoolLoan: 150000, carLoan: 19000, creditCard: 9000, retail: 1000 } },
  { id: 'truckDriver', salary: 2500, savings: 750, perChild: 140,
    expenses: { taxes: 460, homeMortgage: 400, schoolLoan: 0, carLoan: 80, creditCard: 60, retail: 50, other: 570 },
    liabilities: { homeMortgage: 38000, schoolLoan: 0, carLoan: 4000, creditCard: 2000, retail: 1000 } },
  { id: 'policeOfficer', salary: 3000, savings: 520, perChild: 160,
    expenses: { taxes: 580, homeMortgage: 400, schoolLoan: 0, carLoan: 100, creditCard: 60, retail: 50, other: 690 },
    liabilities: { homeMortgage: 46000, schoolLoan: 0, carLoan: 5000, creditCard: 2000, retail: 1000 } },
  { id: 'engineer', salary: 4900, savings: 400, perChild: 250,
    expenses: { taxes: 1050, homeMortgage: 700, schoolLoan: 60, carLoan: 140, creditCard: 120, retail: 50, other: 1090 },
    liabilities: { homeMortgage: 75000, schoolLoan: 12000, carLoan: 7000, creditCard: 4000, retail: 1000 } },
  { id: 'lawyer', salary: 7500, savings: 400, perChild: 640,
    expenses: { taxes: 1830, homeMortgage: 1100, schoolLoan: 390, carLoan: 220, creditCard: 180, retail: 50, other: 1650 },
    liabilities: { homeMortgage: 115000, schoolLoan: 78000, carLoan: 11000, creditCard: 6000, retail: 1000 } },
  { id: 'pilot', salary: 9500, savings: 400, perChild: 480,
    expenses: { taxes: 2350, homeMortgage: 1330, schoolLoan: 0, carLoan: 300, creditCard: 660, retail: 50, other: 2210 },
    liabilities: { homeMortgage: 143000, schoolLoan: 0, carLoan: 15000, creditCard: 22000, retail: 1000 } },
  { id: 'officeManager', salary: 4600, savings: 400, perChild: 240,
    expenses: { taxes: 910, homeMortgage: 700, schoolLoan: 60, carLoan: 120, creditCard: 90, retail: 50, other: 1000 },
    liabilities: { homeMortgage: 75000, schoolLoan: 12000, carLoan: 6000, creditCard: 3000, retail: 1000 } },
  { id: 'teacher', salary: 3300, savings: 400, perChild: 180,
    expenses: { taxes: 630, homeMortgage: 500, schoolLoan: 60, carLoan: 100, creditCard: 90, retail: 50, other: 760 },
    liabilities: { homeMortgage: 50000, schoolLoan: 12000, carLoan: 5000, creditCard: 3000, retail: 1000 } },
  { id: 'secretary', salary: 2500, savings: 710, perChild: 140,
    expenses: { taxes: 460, homeMortgage: 400, schoolLoan: 0, carLoan: 80, creditCard: 60, retail: 50, other: 570 },
    liabilities: { homeMortgage: 38000, schoolLoan: 0, carLoan: 4000, creditCard: 2000, retail: 1000 } },
  { id: 'mechanic', salary: 2000, savings: 670, perChild: 110,
    expenses: { taxes: 360, homeMortgage: 300, schoolLoan: 0, carLoan: 60, creditCard: 60, retail: 50, other: 450 },
    liabilities: { homeMortgage: 31000, schoolLoan: 0, carLoan: 3000, creditCard: 2000, retail: 1000 } },
  { id: 'nurse', salary: 3100, savings: 480, perChild: 170,
    expenses: { taxes: 600, homeMortgage: 400, schoolLoan: 30, carLoan: 100, creditCard: 90, retail: 50, other: 710 },
    liabilities: { homeMortgage: 47000, schoolLoan: 6000, carLoan: 5000, creditCard: 3000, retail: 1000 } },
  // Швейцар: в материалах пассивы скопированы с карточки врача (явная опечатка).
  // Взяты значения по тем же пропорциям, что у остальных профессий. См. DECISIONS.md P1.
  { id: 'janitor', salary: 1600, savings: 400, perChild: 70,
    expenses: { taxes: 280, homeMortgage: 200, schoolLoan: 0, carLoan: 60, creditCard: 60, retail: 50, other: 300 },
    liabilities: { homeMortgage: 20000, schoolLoan: 0, carLoan: 3000, creditCard: 2000, retail: 1000 } },
];

// Контрольные итоги с карточек (общий расход, денежный поток) — проверяются тестами.
export const PROFESSION_CHECKS = {
  doctor: { totalExpenses: 9650, cashFlow: 3550 },
  truckDriver: { totalExpenses: 1620, cashFlow: 880 },
  policeOfficer: { totalExpenses: 1880, cashFlow: 1120 },
  engineer: { totalExpenses: 3210, cashFlow: 1690 },
  lawyer: { totalExpenses: 5420, cashFlow: 2080 },
  pilot: { totalExpenses: 6900, cashFlow: 2600 },
  officeManager: { totalExpenses: 2930, cashFlow: 1670 },
  teacher: { totalExpenses: 2190, cashFlow: 1110 },
  secretary: { totalExpenses: 1620, cashFlow: 880 },
  mechanic: { totalExpenses: 1280, cashFlow: 720 },
  nurse: { totalExpenses: 1980, cashFlow: 1120 },
  janitor: { totalExpenses: 950, cashFlow: 650 },
};
