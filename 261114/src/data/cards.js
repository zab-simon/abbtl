// Колоды карточек. Здесь ТОЛЬКО цифры и логика — один к одному из присланных материалов.
// Тексты карточек лежат отдельно: src/i18n/cards.ru.js (их можно заменять, не трогая логику).
// Расхождения и опечатки оригинала описаны в DECISIONS.md.
//
// Типы карточек «Возможности» (маленькие и большие дела):
//   asset  — покупка актива: cost (стоимость), down (первый взнос), mortgage (ипотека/долг), cashFlow (пасс. доход)
//   stock  — акции/фонды/депозиты: symbol, price (цена сегодня), range, dividend (доход в месяц на 1 шт.),
//            anyoneBuys: true — покупать может любой игрок; иначе — только тот, кто вытянул.
//            Продать по цене карточки может любой владелец.
//   split  — дробление (factor 2) или объединение (factor 0.5) акций у всех владельцев
//   damage — платёж, если есть подходящая собственность (платит только вытянувший)
// Типы «Рынка»:
//   sell         — покупатель на актив: price за штуку (perUnit — за квартиру, perCoin — за монету)
//   sellMultiple — партнёрство выкупается за multiple × стоимость
//   priceUp      — только вытянувший может продать дом 3/2 за стоимость + plus
//   foreclose    — только у вытянувшего банк забирает все дома 3/2
//   sonInLaw     — только вытянувший: дом 3/2 меняется на доход +$500 в месяц
//   boost        — все созданные игроками компании получают +amount в месяц
// «Давай потратимся»:
//   pay — сумма; childOnly — только если есть ребёнок; perChild — за каждого ребёнка;
//   creditOption — можно оплатить кредитной картой (долг + платёж); loan — обязательный кредит (катер)

const A = (id, kind, extra, cost, down, mortgage, cashFlow, more = {}) =>
  ({ id, type: 'asset', asset: { kind, ...extra }, cost, down, mortgage, cashFlow, transferable: true, ...more });
const S = (id, symbol, price, range, more = {}) =>
  ({ id, type: 'stock', symbol, price, range, dividend: 0, anyoneBuys: false, ...more });

export const SMALL_DEALS = [
  A('s01', 'condo21', {}, 55000, 5000, 50000, 160, { resale: [45000, 65000] }),
  S('s02', 'OK4U', 5, [5, 40]),
  S('s03', 'OK4U', 10, [5, 40]),
  S('s04', 'ON2U', 40, [10, 30]),
  A('s05', 'condo21', {}, 40000, 5000, 35000, 220, { resale: [45000, 65000] }),
  S('s06', 'OK4U', 10, [5, 40]),
  S('s07', 'OK4U', 1, [5, 40]),
  S('s08', 'OK4U', 40, [5, 40]),
  A('s09', 'house32', {}, 50000, 4000, 46000, 200, { resale: [65000, 135000] }),
  A('s10', 'house32', {}, 45000, 2000, 43000, 250, { resale: [65000, 135000] }),
  A('s11', 'relativeLoan', {}, 5000, 5000, 0, 0),
  A('s12', 'house32', {}, 35000, 2000, 33000, 220, { resale: [65000, 135000] }),
  S('s13', 'CD', 5000, [5000, 5000], { dividend: 20, anyoneBuys: true }),
  A('s14', 'condo21', {}, 60000, 5000, 55000, -100, { resale: [45000, 65000] }),
  S('s15', 'CD', 4000, [4000, 4000], { dividend: 20, anyoneBuys: true }),
  A('s16', 'company', { sub: 'jewelry' }, 3000, 3000, 0, 0),
  A('s17', 'house32', {}, 50000, 3000, 47000, 100, { resale: [65000, 135000] }),
  S('s18', '2BIG', 1200, [1200, 1200], { dividend: 10, anyoneBuys: true }),
  A('s19', 'land', { acres: 10 }, 5000, 5000, 0, 0),
  S('s20', 'OK4U', 20, [5, 40]),
  A('s21', 'house32', {}, 50000, 0, 50000, -100, { resale: [65000, 135000] }),
  S('s22', 'MYT4U', 40, [5, 30]),
  S('s23', 'ON2U', 20, [10, 30]),
  A('s24', 'goldCoin', { coins: 1 }, 500, 500, 0, 0, { resale: [0, 4000] }),
  S('s25', 'ON2U', 5, [10, 30]),
  { id: 's26', type: 'split', symbol: 'MYT4U', factor: 2 },
  S('s27', 'ON2U', 20, [10, 30]),
  S('s28', '2BIG', 1200, [1200, 1200], { dividend: 10, anyoneBuys: true }),
  S('s29', 'ON2U', 10, [10, 30]),
  S('s30', 'ON2U', 30, [10, 30]),
  { id: 's31', type: 'split', symbol: 'MYT4U', factor: 0.5 },
  S('s32', 'MYT4U', 5, [5, 30]),
  S('s33', 'MYT4U', 5, [5, 30]),
  S('s34', 'MYT4U', 30, [5, 30]),
  { id: 's35', type: 'damage', amount: 500, condition: 'anyRental' },
  A('s36', 'house32', {}, 65000, 5000, 60000, 160, { resale: [65000, 135000] }),
  S('s37', 'GRO4US', 30, [10, 30]),
  S('s38', 'MYT4U', 1, [5, 30]),
  S('s39', 'MYT4U', 10, [5, 30]),
  S('s40', 'ON2U', 30, [10, 30]),
  A('s41', 'krugerrand', { coins: 10 }, 3000, 3000, 0, 0),
  A('s42', 'company', { sub: 'software' }, 5000, 5000, 0, 0),
  { id: 's43', type: 'split', symbol: 'OK4U', factor: 0.5 },
  A('s44', 'condo21', {}, 40000, 4000, 36000, 140, { resale: [45000, 65000] }),
  S('s45', 'GRO4US', 40, [10, 30]),
  S('s46', 'ON2U', 10, [10, 30]),
  A('s47', 'house32', {}, 50000, 0, 50000, 100, { resale: [65000, 135000] }),
  S('s48', 'OK4U', 30, [5, 40]),
  { id: 's49', type: 'split', symbol: 'OK4U', factor: 2 },
  S('s50', 'GRO4US', 10, [10, 30]),
  A('s51', 'condo21', {}, 50000, 5000, 45000, 100, { resale: [45000, 65000] }),
  S('s52', 'OK4U', 50, [5, 40]),
  S('s53', 'GRO4US', 30, [10, 30]),
  S('s54', 'MYT4U', 30, [5, 30]),
  S('s55', 'GRO4US', 20, [10, 30]),
  S('s56', 'MYT4U', 20, [5, 30]),
];

export const BIG_DEALS = [
  A('b01', 'plex', { units: 2 }, 45000, 8000, 37000, 320, { resale: [50000, 80000] }),
  A('b02', 'carwash', {}, 350000, 50000, 300000, 1500),
  A('b03', 'motel', { rooms: 5 }, 150000, 30000, 120000, 1000, { resale: [100000, 300000] }),
  A('b04', 'plex', { units: 4 }, 80000, 20000, 60000, 400, { resale: [100000, 140000] }),
  A('b05', 'plex', { units: 2 }, 50000, 8000, 42000, 240, { resale: [50000, 70000] }),
  A('b06', 'automated', { sub: 'laundry' }, 150000, 30000, 120000, 2500),
  A('b07', 'pizzaFranchise', {}, 500000, 100000, 400000, 5000, { resale: [520000, 800000] }),
  A('b08', 'plex', { units: 4 }, 125000, 15000, 110000, 600, { resale: [100000, 140000] }),
  A('b09', 'plex', { units: 4 }, 100000, 20000, 80000, 800, { resale: [100000, 140000] }),
  A('b10', 'plex', { units: 2 }, 60000, 6000, 54000, 300, { resale: [50000, 80000] }),
  A('b11', 'automated', { sub: 'arcade' }, 100000, 20000, 80000, 1600),
  A('b12', 'plex', { units: 8 }, 160000, 32000, 128000, 1700, { resale: [200000, 280000] }),
  A('b13', 'plex', { units: 4 }, 140000, 32000, 108000, 2000, { resale: [100000, 140000] }),
  A('b14', 'partnership', { sub: 'sandwich' }, 30000, 30000, 0, 1500, { resale: [60000, 90000] }),
  A('b15', 'house32', {}, 125000, 20000, 105000, -100, { resale: [65000, 150000] }),
  A('b16', 'partnership', { sub: 'pizza' }, 20000, 20000, 0, 800, { resale: [40000, 60000] }),
  A('b17', 'partnership', { sub: 'clinic' }, 25000, 25000, 0, 1000, { resale: [50000, 75000] }),
  A('b18', 'plex', { units: 2 }, 60000, 12000, 48000, 400, { resale: [50000, 80000] }),
  A('b19', 'house32', {}, 70000, 20000, 50000, 500, { resale: [65000, 135000] }),
  { id: 'b20', type: 'damage', amount: 1000, condition: 'anyRental' },
  A('b21', 'apartment', { units: 48 }, 575000, 75000, 500000, 3400, { resale: [600000, 960000] }),
  A('b22', 'apartment', { units: 60 }, 1200000, 200000, 1000000, 11000, { resale: [1500000, 2700000] }),
  A('b23', 'plex', { units: 8 }, 240000, 40000, 200000, 950, { resale: [200000, 280000] }),
  A('b24', 'plex', { units: 8 }, 220000, 40000, 180000, 1700, { resale: [200000, 280000] }),
  A('b25', 'partnership', { sub: 'carRental' }, 30000, 30000, 0, 1000, { resale: [60000, 90000] }),
  A('b26', 'house32', {}, 75000, 7000, 68000, 800),
  A('b27', 'plex', { units: 4 }, 90000, 15000, 75000, 500, { resale: [100000, 140000] }),
  A('b28', 'mall', {}, 50000, 50000, 0, 800, { resale: [35000, 150000] }),
  A('b29', 'land', { acres: 20 }, 20000, 20000, 0, 0),
  A('b30', 'automated', { sub: 'payphones' }, 200000, 40000, 160000, 2700),
  A('b31', 'house32', {}, 65000, 7000, 58000, 150, { resale: [65000, 135000] }),
  // b32 — в материалах цифры скопированы с карточки b22 (60 квартир) — исключена, см. DECISIONS.md B1.
  A('b33', 'house32', {}, 70000, 9000, 61000, 300, { resale: [65000, 135000] }),
  A('b34', 'house32', {}, 65000, 8000, 57000, 300, { resale: [65000, 135000] }),
  A('b35', 'plex', { units: 2 }, 70000, 7000, 63000, 140, { resale: [50000, 80000] }),
  A('b36', 'plex', { units: 8 }, 200000, 40000, 160000, 1600, { resale: [200000, 280000], noLoan: true }),
  A('b37', 'apartment', { units: 24 }, 550000, 50000, 500000, 2800, { resale: [600000, 960000] }),
  A('b38', 'apartment', { units: 12 }, 350000, 50000, 300000, 2400, { resale: [300000, 480000] }),
  A('b39', 'house32', {}, 115000, 10000, 105000, -100, { resale: [65000, 150000] }),
  A('b40', 'automated', { sub: 'laundry' }, 125000, 25000, 100000, 1800),
  { id: 'b41', type: 'damage', amount: 2000, condition: 'plex8' },
  A('b42', 'house32', {}, 67000, 12000, 55000, 400, { resale: [65000, 135000] }),
];

const PLEX = { kinds: ['plex'] };                       // 2-х, 4-х или 8-ми квартирный дом
const ANY_BUILDING = { kinds: ['plex', 'apartment'] };  // жилой дом любого размера
const BIG_BUILDING = { kinds: ['plex', 'apartment'], minUnits: 12 };

export const MARKET = [
  { id: 'm01', type: 'sell', target: { kinds: ['condo21'] }, price: 65000 },
  { id: 'm02', type: 'sell', target: { kinds: ['land'], acres: 20 }, price: 200000 },
  { id: 'm03', type: 'sell', target: PLEX, price: 35000, perUnit: true },
  { id: 'm04', type: 'sell', target: { kinds: ['motel'] }, price: 250000 },
  { id: 'm05', type: 'sell', target: { kinds: ['condo21'] }, price: 55000 },
  { id: 'm06', type: 'sell', target: PLEX, price: 40000, perUnit: true },
  { id: 'm07', type: 'priceUp', target: { kinds: ['house32'] }, plus: 50000 },
  { id: 'm08', type: 'sell', target: { kinds: ['goldCoin'] }, price: 5000, perCoin: true },
  { id: 'm09', type: 'sell', target: PLEX, price: 30000, perUnit: true },
  { id: 'm10', type: 'sell', target: { kinds: ['mall'] }, price: 100000 },
  { id: 'm11', type: 'sell', target: { kinds: ['house32'] }, price: 100000 },
  { id: 'm12', type: 'sell', target: PLEX, price: 35000, perUnit: true },
  { id: 'm13', type: 'sell', target: PLEX, price: 35000, perUnit: true },
  { id: 'm14', type: 'sell', target: ANY_BUILDING, price: 45000, perUnit: true },
  { id: 'm15', type: 'sell', target: ANY_BUILDING, price: 40000, perUnit: true },
  { id: 'm16', type: 'sell', target: { kinds: ['condo21'] }, price: 45000 },
  { id: 'm17', type: 'sell', target: { kinds: ['company'], sub: 'software' }, price: 100000 },
  { id: 'm18', type: 'boost', amount: 400 },
  { id: 'm19', type: 'sell', target: { kinds: ['house32'] }, price: 135000 },
  { id: 'm20', type: 'sell', target: { kinds: ['land'], acres: 10 }, price: 150000 },
  { id: 'm21', type: 'sell', target: PLEX, price: 30000, perUnit: true },
  { id: 'm22', type: 'sonInLaw', target: { kinds: ['house32'] }, cashFlow: 500 },
  { id: 'm23', type: 'sell', target: { kinds: ['house32'] }, price: 100000 },
  { id: 'm24', type: 'sell', target: { kinds: ['company'], sub: 'jewelry' }, price: 50000 },
  { id: 'm25', type: 'foreclose', target: { kinds: ['house32'] } },
  { id: 'm26', type: 'sell', target: PLEX, price: 25000, perUnit: true },
  { id: 'm27', type: 'sell', target: { kinds: ['house32'] }, price: 90000 },
  { id: 'm28', type: 'sell', target: { kinds: ['condo21'] }, price: 55000 },
  { id: 'm29', type: 'sell', target: ANY_BUILDING, price: 25000, perUnit: true },
  { id: 'm30', type: 'sell', target: { kinds: ['house32'] }, price: 135000 },
  { id: 'm31', type: 'sell', target: { kinds: ['house32'] }, price: 110000 },
  { id: 'm32', type: 'sell', target: { kinds: ['carwash'] }, price: 250000 },
  { id: 'm33', type: 'sell', target: BIG_BUILDING, price: 30000, perUnit: true },
  { id: 'm34', type: 'sell', target: PLEX, price: 35000, perUnit: true },
  { id: 'm35', type: 'sellMultiple', target: { kinds: ['partnership'] }, multiple: 2 },
  { id: 'm36', type: 'sellMultiple', target: { kinds: ['partnership'] }, multiple: 3 },
  { id: 'm37', type: 'sell', target: PLEX, price: 25000, perUnit: true },
  { id: 'm38', type: 'sell', target: PLEX, price: 30000, perUnit: true },
  { id: 'm39', type: 'sell', target: PLEX, price: 40000, perUnit: true },
  { id: 'm40', type: 'boost', amount: 250 },
  { id: 'm41', type: 'sell', target: { kinds: ['krugerrand'] }, price: 600, perCoin: true },
  { id: 'm42', type: 'sellMultiple', target: { kinds: ['partnership'] }, multiple: 2 },
];

const P = (id, pay, more = {}) => ({ id, type: 'pay', pay, ...more });
export const DOODADS = [
  P('d01', 100), P('d02', 220), P('d03', 10), P('d04', 200),
  P('d05', 2000, { childOnly: true }), P('d06', 200), P('d07', 450), P('d08', 100),
  P('d09', 50), P('d10', 600),
  P('d11', 180), P('d12', 120), P('d13', 150), P('d14', 100, { childOnly: true }),
  P('d15', 100), P('d16', 70), P('d17', 200), P('d18', 80), P('d19', 100), P('d20', 2000),
  P('d21', 100), P('d22', 4000, { creditOption: { debt: 4000, payment: 120 } }),
  P('d23', 350), P('d24', 1000, { loan: { id: 'boatLoan', amount: 17000, payment: 340 } }),
  P('d25', 350), P('d26', 2000, { childOnly: true }), P('d27', 80), P('d28', 200),
  P('d29', 100), P('d30', 1500, { childOnly: true }),
  P('d31', 250), P('d32', 250), P('d33', 50, { perChild: true }), P('d34', 20),
  P('d35', 100), P('d36', 300), P('d37', 150), P('d38', 500), P('d39', 150), P('d40', 350),
  P('d41', 40), P('d42', 700),
];

export const DECKS = { small: SMALL_DEALS, big: BIG_DEALS, market: MARKET, doodad: DOODADS };

const ALL = new Map();
for (const [deck, list] of Object.entries(DECKS)) for (const c of list) ALL.set(c.id, { ...c, deck });
export function getCard(id) { return ALL.get(id); }
