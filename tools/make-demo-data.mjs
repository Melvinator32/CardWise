// Regenerates the fabricated dataset baked into index.html.
//
// Every transaction, merchant, date and credit redemption this produces is
// invented. Nothing here comes from a real statement, and the file is
// deterministic: the same seed always yields the same dataset, so a rebuild
// never silently changes what the demo shows.
//
//   node tools/make-demo-data.mjs
//
// Card names, annual fees, earn multipliers and credit structures are public
// published product terms, kept so the demo demonstrates something real. The
// holdings they imply (which cards are held, when they were opened) are not.
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

// -- invented merchants -----------------------------------------------------
// National chains and generic names only: nothing that identifies a person.
// Grouped by category because transactions carry a resolved `category`, and
// the optimizer indexes a per-category table by it -- a null or off-list value
// crashes the dashboard on load.
const BY_CATEGORY = {
  'Restaurants': [
    ['SUBWAY #40218', 9, 18], ['FIVE GUYS 1180', 14, 34], ["WENDY'S #221", 8, 22],
    ['TACO BELL #4417', 7, 19], ['POPEYES 11902', 9, 26], ['CHICK-FIL-A #0292', 10, 28],
    ['PIZZA HUT 3310', 16, 42], ['THE CORNER TAVERN', 28, 96], ['RIVERSIDE GRILL', 34, 128],
    ['HARBOR OYSTER BAR', 42, 165], ['TST* NORTHSIDE KITCHEN', 26, 88], ['SUSHI HOUSE 12', 30, 104],
  ],
  'Coffee Shops': [
    ['STARBUCKS #11238', 4, 14], ['LOCAL COFFEE BAR', 4, 12], ["PJ'S COFFEE #18", 4, 13],
  ],
  'Food Delivery': [
    ['DOORDASH*ORDER', 18, 62], ['GRUBHUB*ORDER', 16, 58], ['UBER EATS', 17, 60],
  ],
  'Groceries': [
    ['WHOLE FOODS MKT 402', 38, 190], ["TRADER JOE'S #445", 32, 140], ['KROGER #2011', 44, 210],
    ['COSTCO WHSE #1188', 85, 420], ['PUBLIX #3320', 30, 150],
  ],
  'Rideshare': [['UBER TRIP', 11, 58], ['LYFT *RIDE', 10, 52]],
  'Airfare': [['SOUTHWEST AIRLINES', 118, 640], ['DELTA AIR LINES', 165, 880], ['UNITED AIRLINES', 152, 810]],
  'Hotels': [
    ['MARRIOTT BONVOY 4471', 165, 640], ['HILTON HOTELS RES', 148, 590],
    ['HYATT PLACE 220', 132, 520], ['AIRBNB * HMQ4T2', 210, 980],
  ],
  'Other Travel': [
    ['AMTRAK .COM', 48, 260], ['HERTZ RENT A CAR', 88, 420],
    ['SP PLUS PARKING', 8, 46], ['EXPEDIA 7412', 190, 940],
  ],
  'Entertainment & Events': [
    ['TICKETMASTER 8891', 55, 320], ['STUBHUB INC', 70, 380],
    ['SEATGEEK EVENT', 62, 300], ['AMC CINEMA 1140', 14, 62],
  ],
  'Streaming & Software': [
    ['NETFLIX.COM', 15.49, 24.99], ['SPOTIFY USA', 11.99, 19.99], ['OPENAI CHATGPT SUBSCR', 20, 20],
    ['APPLE.COM/BILL', 2.99, 34.99], ['ADOBE *CREATIVE CLD', 22.99, 59.99],
  ],
  'Pets': [['PETCO #2214', 22, 110], ['CHEWY.COM', 34, 165], ['RIVERBEND VETERINARY', 78, 420]],
  'Utilities': [['COX COMMUNICATIONS', 89, 165], ['AT&T *PAYMENT', 62, 145], ['CITY POWER ELECTRIC', 74, 260]],
  'Insurance': [['PROGRESSIVE INSURANCE', 118, 235], ['GEICO AUTO PMT', 96, 210]],
  'Car': [
    ['VALVOLINE #1206', 62, 138], ['DISCOUNT TIRE 440', 120, 720],
    ['AUTOZONE #9004', 18, 130], ['EXPRESS CAR WASH', 12, 34],
  ],
  'Gas': [
    ['SHELL OIL 574123', 28, 82], ['CHEVRON #2218', 30, 86],
    ['EXXON MOBIL 4471', 29, 84], ['CIRCLE K #5502', 26, 76],
  ],
  'Health': [
    ['CVS PHARMACY #2011', 12, 96], ['WALGREENS #1146', 11, 88],
    ['DENTAL ASSOCIATES', 95, 480], ['CITY MEDICAL CLINIC', 60, 340],
  ],
  'Business & Office': [
    ['STAPLES #1180', 22, 180], ['OFFICE DEPOT 4412', 26, 210], ['FEDEX OFFICE 0221', 14, 120],
    ['PRINTIFY.COM', 40, 320], ['GODADDY.COM', 12, 96],
  ],
  'Charity': [['GOFUNDME*CAMPAIGN', 25, 150]],
  'Gifts': [['CALIFORNIA GIFT CO', 30, 140]],
  'Online Shopping': [
    ['AMAZON.COM*A12BC4D', 12, 240], ['AMZN MKTP US*7741', 10, 190], ['TARGET #1180', 24, 185],
    ['WALMART.COM 8812', 20, 170], ['EBAY O*12-34567', 15, 130], ['ETSY.COM', 18, 120],
  ],
};

// [merchant, lo, hi, category]
const MERCHANTS = Object.entries(BY_CATEGORY).flatMap(([cat, list]) =>
  list.map(([name, lo, hi]) => [name, lo, hi, cat]),
);



const DAY = 86400000;
const START = Date.UTC(2024, 5, 1);
const END = Date.UTC(2026, 5, 30);
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const ym = (t) => new Date(t).toISOString().slice(0, 7);

// Which cards carry spend, and roughly how much of it.
const SPEND_WEIGHTS = { gold: 0.30, csr: 0.28, plat: 0.14, inkpref: 0.12, inkcash: 0.09, ventx: 0.07 };

// Invented portfolio timeline. Replaces the real open/renewal history.
const CARD_OVERRIDES = {
  gold:      { status: 'held',        applied: '2024-05-14', renewal: '2027-05-31', nextAward: null, note: '4x on restaurants, food delivery and groceries. Sample portfolio card.' },
  csr:       { status: 'held',        applied: '2024-08-02', renewal: '2027-08-31', nextAward: null, note: 'Travel and dining multipliers plus the annual travel credit.' },
  plat:      { status: 'held',        applied: '2025-02-20', renewal: '2027-02-28', nextAward: null, note: 'High annual fee offset by statement credits rather than earn rate.' },
  ink:       { status: 'considering', applied: null,         renewal: null,         nextAward: null, note: 'No-fee business card under evaluation in this sample portfolio.' },
  inkcash:   { status: 'held',        applied: '2025-03-11', renewal: '2027-03-31', nextAward: null, note: '5x office supply and internet/cable/phone, 2x gas and dining, each capped annually.' },
  inkpref:   { status: 'held',        applied: '2025-03-11', renewal: '2027-03-31', nextAward: null, note: '3x travel, shipping, internet/cable/phone and advertising, up to a combined annual cap.' },
  ventx:     { status: 'dropped',     applied: '2024-07-09', renewal: '2026-08-31', nextAward: null, note: 'Dropped in this sample after the travel portal credit stopped clearing the fee.' },
  green:     { status: 'considering', applied: null,         renewal: null,         nextAward: null, note: 'Lower-fee alternative in the same points currency.' },
  freedom:   { status: 'considering', applied: null,         renewal: null,         nextAward: null, note: 'No-fee card in the same points ecosystem.' },
  sw:        { status: 'considering', applied: null,         renewal: null,         nextAward: null, note: 'Airline card evaluated for its companion benefit.' },
  xmjuch:    { status: 'considering', applied: null,         renewal: null,         nextAward: null, note: 'Lower-fee version of the same airline card.' },
};

// The card catalogue is declared a second time outside BAKED, via C(...) calls,
// and carried the same personal annotations. Scrub both copies or the notes
// survive in the shipped page.
const SCRUB = [
  [/"Highest-value card you hold\.?"/g, '"Premium travel card in this sample portfolio."'],
  [/"NEXT CARD\.[^"]*"/g, '"Airline card evaluated for its companion benefit."'],
  [/"CSV provided[^"]*"/g, '"Sample portfolio card."'],
  [/"Working toward \$3k[^"]*"/g, '"Signup bonus spend in progress in this sample."'],
  [/"Downgrade target[^"]*"/g, '"No-annual-fee option in the same points ecosystem."'],
  [/"AF \$895[^"]*"/g, '"High annual fee offset by statement credits."'],
  [/"added from Excel"/g, '"Imported card"'],
  [/\/\/ pre-loaded from [^\n]*/g, '// fabricated demo data - see tools/make-demo-data.mjs'],
];

// Cheap everyday purchases happen far more often than big-ticket ones, so
// weight frequency inversely to price. Without this the demo shows a spend
// profile no household actually has.
const MERCHANT_POOL = MERCHANTS.flatMap((m) => {
  const freq = Math.max(1, Math.min(40, Math.round(360 / m[2])));
  return Array.from({ length: freq }, () => m);
});

function synthTransactions(cardIds) {
  const weighted = [];
  for (const [id, w] of Object.entries(SPEND_WEIGHTS)) {
    if (!cardIds.has(id)) continue;
    for (let i = 0; i < Math.round(w * 100); i++) weighted.push(id);
  }
  if (!weighted.length) weighted.push(...cardIds);

  const out = [];
  const total = 1900;
  for (let i = 0; i < total; i++) {
    const [merchant, lo, hi, category] = pick(MERCHANT_POOL);
    const t = START + Math.floor(rand() * (END - START));
    out.push({
      id: 'demo-' + String(i + 1).padStart(4, '0'),
      merchant,
      category,
      amount: money(lo, hi),
      cardId: pick(weighted),
      date: ymd(t),
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// Plausible redemption history for each card's credits, so the credits view
// has something to show. Invented, but consistent with each credit's cadence.
function synthDetectedCredits(cards) {
  const months = [];
  for (let t = START; t <= END; ) {
    months.push(ym(t));
    const d = new Date(t);
    d.setUTCMonth(d.getUTCMonth() + 1);
    t = d.getTime();
  }
  const recent = months.slice(-14);
  const out = {};
  for (const c of cards) {
    if ((CARD_OVERRIDES[c.id] || {}).status === 'considering') continue;
    const bag = {};
    for (const k of c.credits || []) {
      if (!k.match) continue;
      const target = k.targeted || k.nominal || 0;
      if (!target) continue;
      const hits = {};
      if (k.cadence === 'monthly') {
        const per = Math.round((target / 12) * 100) / 100;
        for (const m of recent) if (rand() < 0.72) hits[m] = per;
      } else if (k.cadence === 'semiannual') {
        for (const m of [recent[2], recent[8]]) if (m) hits[m] = Math.round((target / 2) * 100) / 100;
      } else {
        const m = recent[Math.floor(rand() * recent.length)];
        const first = Math.round(target * between(0.45, 0.75) * 100) / 100;
        hits[m] = first;
        const m2 = recent[Math.floor(rand() * recent.length)];
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
const real = JSON.parse(json);

const cards = real.cards.map((c) => {
  const o = CARD_OVERRIDES[c.id] || {};
  const next = { ...c, ...o };
  if (next.sub) next.sub = { ...next.sub, start: null };
  return next;
});
const cardIds = new Set(cards.map((c) => c.id));

const fake = {
  settings: real.settings,
  cards,
  transactions: synthTransactions(cardIds),
  _detectedCredits: synthDetectedCredits(cards),
  firstRun: true,
};

let out = src.slice(0, open) + JSON.stringify(fake) + src.slice(close);
for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement);
writeFileSync(INDEX, out);

const sum = fake.transactions.reduce((a, t) => a + t.amount, 0);
console.log('transactions:', fake.transactions.length);
console.log('distinct merchants:', new Set(fake.transactions.map((t) => t.merchant)).size);
console.log('date range:', fake.transactions.at(-1).date, '->', fake.transactions[0].date);
console.log('total spend: $' + sum.toFixed(2));
console.log('cards:', fake.cards.length, '| with detected credits:', Object.keys(fake._detectedCredits).length);
