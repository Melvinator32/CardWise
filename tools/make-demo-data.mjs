// Regenerates the fabricated dataset baked into index.html.
//
// The profile is a composite of an average 25-year-old US cardholder: roughly
// $1,600/month of card spend, weighted toward groceries, dining, fuel and
// subscriptions, with occasional travel. It is not modelled on anyone's real
// statements -- merchants, amounts, dates and credit history are all invented,
// and the run is deterministic, so the same seed always yields the same data.
//
//   node tools/make-demo-data.mjs
//
// Card names, annual fees, earn multipliers and credit structures are public
// published product terms, kept so the demo demonstrates something real. The
// holdings they imply are invented.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SEED = 20260906;
const INDEX = path.join(import.meta.dirname, '..', 'index.html');

// -- deterministic PRNG (mulberry32) ---------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const money = (lo, hi) => Math.round(between(lo, hi) * 100) / 100;

// -- the spending profile ---------------------------------------------------
// Per category: an approximate monthly budget, and the merchants it is spent
// at as [name, min, max]. Transactions carry a resolved `category` -- the
// optimizer indexes a per-category table by it, and a null or off-list value
// crashes the dashboard on load, so every merchant is declared under a
// category the app already knows.
//
// Deliberately omits business, pet, charity and gift spending: those belong to
// particular lives rather than an average one.
const PROFILE = {
  'Groceries': { monthly: 300, merchants: [
    ['ALDI #4820', 22, 78], ['LIDL US 2204', 25, 84], ['SPROUTS FARMERS MKT', 30, 96],
    ['SAFEWAY #1140', 28, 105], ['WEGMANS 0088', 34, 120],
  ]},
  'Restaurants': { monthly: 215, merchants: [
    ['CHIPOTLE 1180', 11, 27], ['SWEETGREEN 0441', 13, 24], ['NOODLES & CO 212', 12, 26],
    ['WINGSTOP 9021', 14, 38], ['SHAKE SHACK 0217', 13, 32], ['PHO NOODLE HOUSE', 16, 42],
    ['TACO SHOP CANTINA', 15, 46], ['BRICK OVEN PIZZ CO', 18, 54], ['RAMEN BAR 33', 17, 44],
  ]},
  'Coffee Shops': { monthly: 46, merchants: [
    ['DUTCH BROS 1182', 5, 11], ['CARIBOU COFFEE 44', 4, 10],
    ['BLUE BOTTLE 0012', 5, 13], ['CAMPUS ROASTERS CO', 4, 9],
  ]},
  'Food Delivery': { monthly: 84, merchants: [
    ['SEAMLESS*ORDER', 19, 46], ['GOPUFF DELIVERY', 12, 34], ['POSTMATES*ORDER', 18, 44],
  ]},
  'Gas': { monthly: 118, merchants: [
    ['BP #44710', 26, 62], ['SUNOCO 2205', 24, 58], ['SPEEDWAY 11802', 25, 60],
    ['QUIKTRIP 4423', 23, 56], ['WAWA 0881', 22, 54],
  ]},
  'Rideshare': { monthly: 38, merchants: [['LYFT *RIDE', 9, 31], ['VIA RIDE SHARE', 8, 26]]},
  'Streaming & Software': { monthly: 54, merchants: [
    ['HULU 1180', 9.99, 18.99], ['MAX.COM SUB', 9.99, 16.99], ['PARAMOUNT PLUS', 6.99, 12.99],
    ['YOUTUBE PREMIUM', 13.99, 13.99], ['STEAM GAMES', 9.99, 59.99], ['DUOLINGO PLUS', 6.99, 12.99],
  ]},
  'Utilities': { monthly: 132, merchants: [
    ['T-MOBILE PAYMENT', 55, 92], ['SPECTRUM INTERNET', 49, 88], ['CITY WATER DEPT', 24, 52],
  ]},
  'Online Shopping': { monthly: 172, merchants: [
    ['UNIQLO US 0220', 24, 96], ['ADIDAS ONLINE US', 38, 145], ['ZARA ONLINE US', 30, 118],
    ['BEST BUY 11802', 26, 240], ['IKEA 4420', 32, 190], ['WAYFAIR ORDER', 40, 210],
  ]},
  'Entertainment & Events': { monthly: 88, merchants: [
    ['REGAL CINEMAS 0088', 13, 34], ['DAVE & BUSTERS 12', 22, 74],
    ['TOPGOLF 0044', 28, 88], ['EVENTBRITE TICKETS', 24, 120],
  ]},
  'Health': { monthly: 62, merchants: [
    ['RITE AID #2043', 9, 48], ['PLANET FITNESS', 10, 29],
    ['URGENT CARE CLINIC', 45, 180], ['DENTAL GROUP 0012', 60, 210],
  ]},
  'Insurance': { monthly: 128, merchants: [['ALLSTATE AUTO PMT', 108, 158], ['NATIONWIDE INS PMT', 102, 149]]},
  // Lumpy categories: a trip or a service costs what it costs, and does not
  // divide neatly into a monthly budget. These fire on a per-month chance
  // instead, which is what makes travel spend look like trips rather than a
  // standing order.
  'Car': { chance: 0.45, merchants: [
    ['JIFFY LUBE 1182', 48, 96], ['MIDAS AUTO 0044', 60, 240], ['TOUCHLESS CAR WASH', 10, 22],
  ]},
  'Airfare': { chance: 0.24, merchants: [
    ['JETBLUE AIRWAYS', 118, 340], ['FRONTIER AIRLINES', 68, 210], ['ALASKA AIRLINES', 135, 380],
  ]},
  'Hotels': { chance: 0.24, merchants: [
    ['HOLIDAY INN EXPRESS', 104, 235], ['BEST WESTERN 2204', 88, 190], ['MOTEL 6 0118', 62, 130],
  ]},
  'Other Travel': { chance: 0.42, merchants: [
    ['TURO CAR SHARE', 48, 165], ['GREYHOUND LINES', 32, 110], ['CITY TRANSIT PASS', 20, 70],
  ]},
  'Other': { monthly: 38, merchants: [
    ['VENMO PAYMENT', 12, 68], ['CASH APP TRANSFER', 10, 60], ['WASH & FOLD LAUNDRY', 14, 38],
  ]},
};

const START = Date.UTC(2024, 5, 1);
const END = Date.UTC(2026, 7, 31);
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const ym = (t) => new Date(t).toISOString().slice(0, 7);

// Held cards and their share of spend. Both premium cards are held so the
// perks view has something substantial to track -- between them they carry the
// dining, rideshare, streaming, retail and travel credits the app exists to
// monitor. Their combined annual fees deliberately outrun what this level of
// spend earns back, which is the trade-off the dashboard is built to surface.
const SPEND_WEIGHTS = { gold: 0.30, csr: 0.22, freedom: 0.20, plat: 0.16, ventx: 0.12 };

// Invented portfolio timeline. Replaces the real open and renewal history.
const HELD = {
  freedom: { applied: '2024-04-18', renewal: null,         note: 'First card in this sample portfolio. No annual fee.' },
  gold:    { applied: '2025-01-22', renewal: '2027-01-31', note: '4x on restaurants, food delivery and groceries, the largest categories here.' },
  ventx:   { applied: '2025-09-05', renewal: '2027-09-30', note: 'Travel card carrying the annual portal credit.' },
  csr:     { applied: '2026-04-10', renewal: '2027-04-30', subStart: '2026-04-10', note: 'Opened most recently in this sample; its signup bonus is still in progress.' },
  plat:    { applied: '2025-11-08', renewal: '2027-11-30', note: 'Weak earn rate at this spend level; the case for it rests entirely on clearing the statement credits.' },
};
const CONSIDERING_NOTE = {
  ink: 'Business card, not applicable to this sample profile.',
  inkcash: 'Business card, not applicable to this sample profile.',
  inkpref: 'Business card, not applicable to this sample profile.',
  green: 'Lower-fee alternative in the same points currency.',
  sw: 'Airline card evaluated for its companion benefit.',
  xmjuch: 'Lower-fee version of the same airline card.',
};

// The card catalogue is declared a second time outside BAKED, via C(...) calls,
// and carried the same personal annotations. Scrub both copies or the notes
// survive in the shipped page.
const SCRUB = [
  [/"Highest-value card you hold\.?"/gi, '"Premium travel card in this sample portfolio."'],
  [/"NEXT CARD\.[^"]*"/gi, '"Airline card evaluated for its companion benefit."'],
  [/"CSV provided[^"]*"/gi, '"Sample portfolio card."'],
  [/"Working toward \$3k[^"]*"/gi, '"Signup bonus spend in progress in this sample."'],
  [/"Downgrade target[^"]*"/gi, '"No-annual-fee option in the same points ecosystem."'],
  [/"AF \$895[^"]*"/gi, '"High annual fee offset by statement credits."'],
  [/"No-AF UR keeper[^"]*"/gi, '"No-annual-fee option in the same points ecosystem."'],
  [/"added from Excel"/gi, '"Imported card"'],
  [/\/\/ pre-loaded from [^\n]*/g, '// fabricated demo data - see tools/make-demo-data.mjs'],
];

function monthsBetween(a, b) {
  const out = [];
  const d = new Date(a);
  d.setUTCDate(1);
  while (d.getTime() <= b) {
    out.push(new Date(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

// Spends each category's monthly budget down in realistically sized purchases,
// rather than drawing transactions at random and hoping the totals look sane.
function synthTransactions(cardIds) {
  const wallet = [];
  for (const [id, w] of Object.entries(SPEND_WEIGHTS)) {
    if (!cardIds.has(id)) continue;
    for (let i = 0; i < Math.round(w * 100); i++) wallet.push(id);
  }
  if (!wallet.length) wallet.push(...cardIds);

  const out = [];
  let n = 0;
  for (const month of monthsBetween(START, END)) {
    const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    const add = (category, merchant, amount) => {
      const day = 1 + Math.floor(rand() * daysInMonth);
      out.push({
        id: 'demo-' + String(++n).padStart(4, '0'),
        merchant,
        category,
        amount,
        cardId: pick(wallet),
        date: ymd(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)),
      });
    };

    for (const [category, spec] of Object.entries(PROFILE)) {
      if (spec.chance !== undefined) {
        if (rand() > spec.chance) continue;
        const times = rand() < 0.25 ? 2 : 1; // trips tend to book in pairs
        for (let k = 0; k < times; k++) {
          const [merchant, lo, hi] = pick(spec.merchants);
          add(category, merchant, money(lo, hi));
        }
        continue;
      }
      let budget = spec.monthly * between(0.7, 1.35);
      let guard = 0;
      while (budget > 0 && guard++ < 60) {
        const [merchant, lo, hi] = pick(spec.merchants);
        if (budget < lo * 0.6) break;
        const amount = money(lo, Math.max(lo, Math.min(hi, budget)));
        add(category, merchant, amount);
        budget -= amount;
      }
    }
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// Plausible redemption history for each held card's credits, so the credits
// view has something to show. Invented, consistent with each credit's cadence.
function synthDetectedCredits(cards) {
  const recent = monthsBetween(START, END).map((d) => ym(d.getTime())).slice(-14);
  const out = {};
  for (const c of cards) {
    if (!HELD[c.id]) continue;
    const opened = HELD[c.id].applied || '';
    const since = recent.filter((m) => m >= opened.slice(0, 7));
    const bag = {};
    for (const k of c.credits || []) {
      if (!k.match) continue;
      const target = k.targeted || k.nominal || 0;
      if (!target) continue;
      const hits = {};
      if (k.cadence === 'monthly') {
        const per = Math.round((target / 12) * 100) / 100;
        for (const m of since) if (rand() < 0.72) hits[m] = per;
      } else if (k.cadence === 'semiannual') {
        for (const m of [since[2], since[Math.min(8, since.length - 1)]]) if (m) hits[m] = Math.round((target / 2) * 100) / 100;
      } else {
        if (!since.length) continue;
        const m = since[Math.floor(rand() * since.length)];
        const first = Math.round(target * between(0.45, 0.75) * 100) / 100;
        hits[m] = first;
        const m2 = since[Math.floor(rand() * since.length)];
        if (m2 !== m && first < target) hits[m2] = Math.round((target - first) * 100) / 100;
      }
      if (Object.keys(hits).length) bag[k.match.toLowerCase()] = hits;
    }
    if (Object.keys(bag).length) out[c.id] = bag;
  }
  return out;
}

// -- locate and replace the baked literal ----------------------------------
function extractBaked(src) {
  const marker = 'const BAKED=';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('could not find "const BAKED=" in index.html');
  const open = start + marker.length;
  let depth = 0, i = open, instr = false, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (instr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') instr = false;
      continue;
    }
    if (c === '"') instr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { i++; break; }
  }
  return { open, close: i, json: src.slice(open, i) };
}

const src = readFileSync(INDEX, 'utf8');
const { open, close, json } = extractBaked(src);
const previous = JSON.parse(json);

const cards = previous.cards.map((c) => {
  const held = HELD[c.id];
  const next = {
    ...c,
    status: held ? 'held' : 'considering',
    applied: held ? held.applied : null,
    renewal: held ? held.renewal : null,
    nextAward: null,
    note: held ? held.note : (CONSIDERING_NOTE[c.id] || 'Evaluated in this sample portfolio.'),
  };
  if (next.sub) next.sub = { ...next.sub, start: (held && held.subStart) || null };
  return next;
});
const cardIds = new Set(cards.map((c) => c.id));

const fake = {
  settings: previous.settings,
  cards,
  transactions: synthTransactions(cardIds),
  _detectedCredits: synthDetectedCredits(cards),
  firstRun: true,
};

let out = src.slice(0, open) + JSON.stringify(fake) + src.slice(close);
for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement);
writeFileSync(INDEX, out);

const tx = fake.transactions;
const total = tx.reduce((a, t) => a + t.amount, 0);
const months = monthsBetween(START, END).length;
const byCat = {};
for (const t of tx) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
console.log('transactions:', tx.length);
console.log('distinct merchants:', new Set(tx.map((t) => t.merchant)).size);
console.log('date range:', tx.at(-1).date, '->', tx[0].date);
console.log('total: $' + total.toFixed(2), '| per month: $' + (total / months).toFixed(2));
console.log('held cards:', cards.filter((c) => c.status === 'held').map((c) => c.name).join(', '));
console.log('\nspend by category, $/month:');
for (const [c, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + c.padEnd(24) + (v / months).toFixed(0).padStart(6));
}
