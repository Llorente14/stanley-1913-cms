// One-off generator: node scripts/gen-seed.mjs <path/to/stanley products.json>
// Builds src/lib/seed-data.json for the 13 relations. Dates are anchored to ANCHOR and
// shifted to "today" at runtime (see seed.ts), so the demo always looks current.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ANCHOR = '2026-11-04';
const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/gen-seed.mjs products.json');
const products = JSON.parse(fs.readFileSync(src, 'utf8')).products;

// ---------- deterministic random ----------
let seed = 1913;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pad = (n, l = 2) => String(n).padStart(l, '0');
const anchor = new Date(ANCHOR + 'T12:00:00');
function at(daysAgo, hour = int(8, 21), min = int(0, 59)) {
  const d = new Date(anchor);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(min)}`;
}
const dateOnly = (daysAgo) => at(daysAgo).slice(0, 10);
const addMinutes = (dt, m) => {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() + m);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const idr = (usd) => Math.round((Number(usd) * 16000) / 1000) * 1000;

// ---------- categories (hierarchical, Category contains Category) ----------
const category = [
  { category_id: 1, parent_category_id: null, name: 'Drinkware', slug: 'drinkware' },
  { category_id: 2, parent_category_id: 1, name: 'Tumblers', slug: 'tumblers' },
  { category_id: 3, parent_category_id: 1, name: 'Mugs', slug: 'mugs' },
  { category_id: 4, parent_category_id: 1, name: 'Water Bottles', slug: 'water-bottles' },
  { category_id: 5, parent_category_id: 1, name: 'Barware', slug: 'barware' },
  { category_id: 6, parent_category_id: 1, name: 'Jugs & Growlers', slug: 'jugs-growlers' },
  { category_id: 7, parent_category_id: null, name: 'Food & Coolers', slug: 'food-coolers' },
  { category_id: 8, parent_category_id: 7, name: 'Lunch Boxes & Totes', slug: 'lunch-boxes-totes' },
  { category_id: 9, parent_category_id: 7, name: 'Coolers', slug: 'coolers' },
  { category_id: 10, parent_category_id: 7, name: 'Food Jars', slug: 'food-jars' },
  { category_id: 11, parent_category_id: null, name: 'Accessories', slug: 'accessories' },
  { category_id: 12, parent_category_id: 11, name: 'Straws & Charms', slug: 'straws-charms' },
  { category_id: 13, parent_category_id: 11, name: 'Pet', slug: 'pet' },
  { category_id: 14, parent_category_id: 1, name: 'Thermoses', slug: 'thermoses' },
];

function classify(title, type) {
  const t = title.toLowerCase();
  if (t.includes('pet bowl')) return 13;
  if (t.includes('charm') || t.includes('straws') || t.includes('key chain')) return 12;
  if (t.includes('food jar')) return 10;
  if (t.includes('cooler') && !t.includes('cup')) return 9;
  if (t.includes('lunch') || t.includes('tote') || t.includes('useful box')) return 8;
  if (t.includes('jug') || t.includes('growler') || t.includes('pitcher')) return 6;
  if (t.includes('legendary bottle') || t.includes('to-go bottle') || type === 'Thermoses') return 14;
  if (t.includes('pint') || t.includes('wine') || t.includes('flask') || t.includes('shot') || t.includes('stein') || type === 'Barware') return 5;
  if (t.includes('bottle')) return 4;
  if (t.includes('mug') || t.includes('cup')) return 3;
  if (t.includes('tumbler')) return 2;
  return null;
}

const clean = (s) => s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
const strip = (html) => clean((html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&[a-z]+;/g, ' '));

const product = [];
const seen = new Set();
const perCat = new Map();
let pid = 0;
for (const p of products) {
  const title = clean(p.title);
  if (/Stanley Create|Service Fee|Sticker|Boot and Straw|Bins|Gift Card/i.test(title)) continue;
  if (p.product_type === 'Cafe' || p.product_type === 'Sticker') continue;
  const [nameRaw, ...rest] = title.split('|').map(clean);
  const name = nameRaw.replace(/^The\s+/, 'The ');
  const size = (rest[0] || 'One Size').replace(/\s*-\s*$/, '').slice(0, 20);
  const key = (name + size).toLowerCase();
  if (seen.has(key)) continue;
  const cat = classify(name, p.product_type);
  if (!cat) continue;
  const v0 = p.variants[0];
  if (Number(v0.price) < 8 || Number(v0.price) > 200) continue;
  const n = perCat.get(cat) ?? 0;
  if (n >= 5) continue;
  seen.add(key);
  perCat.set(cat, n + 1);
  const desc = strip(p.body_html).slice(0, 320).replace(/\s\S*$/, '') || null;
  for (const v of p.variants.slice(0, 2)) {
    const img = v.featured_image?.src || p.images.find((i) => i.variant_ids.includes(v.id))?.src || p.images[0]?.src || null;
    const price = idr(v.price);
    const cmp = v.compare_at_price && Number(v.compare_at_price) > Number(v.price) ? idr(v.compare_at_price) : null;
    const r = rnd();
    product.push({
      product_id: ++pid,
      category_id: cat,
      sku: String(v.sku || `ST${p.id}`).slice(0, 30),
      name: name.slice(0, 150),
      description: desc,
      color: clean(v.option1 || 'Default').slice(0, 50),
      size,
      price,
      compare_at_price: cmp,
      stock_qty: r < 0.12 ? int(0, 4) : int(8, 120),
      image_url: img ? img + (img.includes('?') ? '&' : '?') + 'width=600' : null,
      is_promo_eligible: !/x Devin|x Nest|Caitlin|FARM Rio|Nelly|Juventus|Paris|Kacey/i.test(name),
      is_active: rnd() > 0.06,
    });
  }
  if (product.length >= 46) break;
}
// Make sure there are sale items (compare_at_price) for the promo rule demo.
for (const i of [3, 9, 17]) if (product[i] && !product[i].compare_at_price) product[i].compare_at_price = product[i].price + 120000;
// SKU must be unique
const skuSeen = new Set();
for (const p of product) {
  while (skuSeen.has(p.sku)) p.sku = p.sku + 'X';
  skuSeen.add(p.sku);
}

// ---------- customers ----------
const people = [
  ['Rizky Pratama', 'Jakarta Selatan', 'DKI Jakarta', '12430'],
  ['Nadia Putri Lestari', 'Bandung', 'Jawa Barat', '40115'],
  ['Andika Saputra', 'Surabaya', 'Jawa Timur', '60231'],
  ['Clarissa Wijaya', 'Jakarta Barat', 'DKI Jakarta', '11470'],
  ['Bima Ardiansyah', 'Yogyakarta', 'DI Yogyakarta', '55223'],
  ['Kevin Halim', 'Medan', 'Sumatera Utara', '20152'],
  ['Sekar Ayu Maharani', 'Denpasar', 'Bali', '80234'],
  ['Fajar Nugroho', 'Semarang', 'Jawa Tengah', '50241'],
  ['Michelle Tanoto', 'Tangerang', 'Banten', '15810'],
  ['Dimas Haryo', 'Bekasi', 'Jawa Barat', '17141'],
  ['Putri Anggraini', 'Makassar', 'Sulawesi Selatan', '90231'],
  ['Jonathan Gunawan', 'Jakarta Utara', 'DKI Jakarta', '14240'],
];
const streets = ['Jl. Kemang Raya No. 12', 'Jl. Dago No. 88', 'Jl. Raya Darmo No. 45', 'Jl. Puri Indah Blok C/7', 'Jl. Kaliurang Km 5 No. 3', 'Jl. Gatot Subroto No. 210', 'Jl. Sunset Road No. 9', 'Jl. Pandanaran No. 61', 'Jl. Boulevard Gading Serpong No. 18', 'Jl. Ahmad Yani No. 77', 'Jl. Pettarani No. 15', 'Jl. Pluit Karang Ayu No. 4'];
const customer = [];
const membership = [];
const customer_address = [];
const memberIdx = [0, 1, 2, 3, 4, 6, 8, 11];
const b64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const hash = () => '$2b$10$' + Array.from({ length: 53 }, () => b64[int(0, 63)]).join('');
people.forEach(([name, city, prov, postal], i) => {
  const first = name.split(' ')[0].toLowerCase();
  const last = name.split(' ').slice(-1)[0].toLowerCase();
  const created = at(int(70, 400));
  customer.push({
    customer_id: i + 1,
    full_name: name,
    email: `${first}.${last}${i % 3 === 0 ? int(1, 99) : ''}@${pick(['gmail.com', 'yahoo.co.id', 'outlook.com'])}`,
    phone: `08${pick(['12', '13', '21', '56', '77', '81'])}${int(10000000, 99999999)}`,
    created_at: created,
  });
  if (memberIdx.includes(i)) {
    const mid = membership.length + 1;
    membership.push({
      membership_id: mid,
      customer_id: i + 1,
      password_hash: hash(),
      birth_date: `${int(1988, 2003)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
      tier: 'member',
      tier_valid_until: null,
      total_points: 0,
      registered_at: created,
    });
    customer_address.push({
      customer_address_id: customer_address.length + 1,
      membership_id: mid,
      label: 'Home',
      recipient_name: name,
      recipient_phone: customer[i].phone,
      street_address: streets[i],
      city,
      province: prov,
      postal_code: postal,
    });
    if (i % 2 === 0)
      customer_address.push({
        customer_address_id: customer_address.length + 1,
        membership_id: mid,
        label: 'Office',
        recipient_name: name,
        recipient_phone: customer[i].phone,
        street_address: pick(['Jl. Jend. Sudirman Kav. 52-53, Lt. 18', 'Jl. M.H. Thamrin No. 1, Lt. 9', 'Jl. HR Rasuna Said Kav. C-22']),
        city: 'Jakarta Pusat',
        province: 'DKI Jakarta',
        postal_code: '10350',
      });
  }
});
// One member has a birthday this month → personal promo
const birthdayMember = membership[2];
birthdayMember.birth_date = `1996-${ANCHOR.slice(5, 7)}-${pad(int(1, 28))}`;

// ---------- promo codes ----------
const promo_code = [
  { promo_code_id: 1, membership_id: null, code: 'WELCOME10', discount_type: 'percentage', discount_value: 10, max_discount: 50000, min_purchase: 300000, starts_at: at(120, 0, 0), ends_at: at(-60, 23, 59), usage_limit: null },
  { promo_code_id: 2, membership_id: null, code: 'HEMAT50K', discount_type: 'fixed_amount', discount_value: 50000, max_discount: null, min_purchase: 600000, starts_at: at(45, 0, 0), ends_at: at(-15, 23, 59), usage_limit: 500 },
  { promo_code_id: 3, membership_id: null, code: 'PAYDAY15', discount_type: 'percentage', discount_value: 15, max_discount: 100000, min_purchase: 500000, starts_at: at(10, 0, 0), ends_at: at(-3, 23, 59), usage_limit: 200 },
  { promo_code_id: 4, membership_id: null, code: 'QUENCHER25', discount_type: 'percentage', discount_value: 25, max_discount: 150000, min_purchase: 700000, starts_at: at(90, 0, 0), ends_at: at(60, 23, 59), usage_limit: 100 },
  { promo_code_id: 5, membership_id: birthdayMember.membership_id, code: 'BDAY-' + customer[birthdayMember.customer_id - 1].full_name.split(' ')[0].toUpperCase(), discount_type: 'percentage', discount_value: 20, max_discount: 200000, min_purchase: 0, starts_at: at(4, 0, 0), ends_at: at(-26, 23, 59), usage_limit: 1 },
  { promo_code_id: 6, membership_id: null, code: 'CLUBVIP12', discount_type: 'percentage', discount_value: 12, max_discount: 120000, min_purchase: 400000, starts_at: at(200, 0, 0), ends_at: at(-120, 23, 59), usage_limit: null },
];

// ---------- stores ----------
const store = [
  ['Rimba Outdoor', 'Rimba Outdoor Senayan City', 'Senayan City Lt. 3, Jl. Asia Afrika Lot 19', 'Jakarta Pusat', 'DKI Jakarta', '10270', -6.2276, 106.7972],
  ['Rimba Outdoor', 'Rimba Outdoor Paris Van Java', 'Paris Van Java Mall GF, Jl. Sukajadi No. 131-139', 'Bandung', 'Jawa Barat', '40162', -6.8893, 107.5961],
  ['Jelajah Supply', 'Jelajah Supply Tunjungan Plaza', 'Tunjungan Plaza 6 Lt. 2, Jl. Basuki Rahmat No. 8-12', 'Surabaya', 'Jawa Timur', '60261', -7.2621, 112.7386],
  ['Jelajah Supply', 'Jelajah Supply PIK Avenue', 'PIK Avenue Lt. 1, Jl. Pantai Indah Kapuk Boulevard', 'Jakarta Utara', 'DKI Jakarta', '14470', -6.1095, 106.7395],
  ['Kedai Kemah', 'Kedai Kemah Malioboro', 'Malioboro Mall Lt. 2, Jl. Malioboro No. 52-58', 'Yogyakarta', 'DI Yogyakarta', '55271', -7.7925, 110.3658],
  ['Kedai Kemah', 'Kedai Kemah Beachwalk', 'Beachwalk Shopping Center Lt. 1, Jl. Pantai Kuta', 'Badung', 'Bali', '80361', -8.7177, 115.1693],
  ['Urban Sip', 'Urban Sip Grand Indonesia', 'Grand Indonesia West Mall Lt. 2, Jl. M.H. Thamrin No. 1', 'Jakarta Pusat', 'DKI Jakarta', '10310', -6.1951, 106.8198],
  ['Urban Sip', 'Urban Sip Summarecon Mall Serpong', 'Summarecon Mall Serpong Lt. 1, Jl. Boulevard Gading Serpong', 'Tangerang', 'Banten', '15810', -6.2412, 106.6283],
  ['Rimba Outdoor', 'Rimba Outdoor Delipark', 'Delipark Mall Lt. 2, Jl. Putri Hijau No. 1', 'Medan', 'Sumatera Utara', '20111', 3.5952, 98.6722],
  ['Jelajah Supply', 'Jelajah Supply Trans Studio Mall', 'Trans Studio Mall Lt. 1, Jl. Metro Tanjung Bunga', 'Makassar', 'Sulawesi Selatan', '90224', -5.1604, 119.3946],
].map(([retailer_name, store_name, street_address, city, province, postal_code, latitude, longitude], i) => ({
  store_id: i + 1,
  retailer_name, store_name, street_address, city, province, postal_code,
  phone: `021${int(5000000, 7999999)}`,
  latitude, longitude,
  opening_hours: i % 3 === 0 ? 'Mon–Sun 10:00–22:00' : 'Mon–Fri 10:00–21:00, Sat–Sun 10:00–22:00',
}));

// ---------- orders ----------
const SHIP = { jne_reg: 18000, jne_yes: 32000, sicepat_best: 25000, gosend_same_day: 45000, jt_ez: 16000 };
const METHODS = ['bca_va', 'mandiri_va', 'gopay', 'ovo', 'qris', 'credit_card'];
const orders = [], order_item = [], payment = [], shipment = [];
const plan = [
  ...Array(11).fill('completed'),
  ...Array(3).fill('shipped'),
  ...Array(4).fill('packed'),
  ...Array(4).fill('pending'),
  ...Array(4).fill('cancelled'),
];
const active = product.filter((p) => p.is_active);
const addrOf = (cid) => {
  const m = membership.find((x) => x.customer_id === cid);
  const a = m && customer_address.find((x) => x.membership_id === m.membership_id);
  const c = customer[cid - 1];
  const [, city, prov, postal] = people[cid - 1];
  return a
    ? { recipient_name: a.recipient_name, recipient_phone: a.recipient_phone, street_address: a.street_address, city: a.city, province: a.province, postal_code: a.postal_code }
    : { recipient_name: c.full_name, recipient_phone: c.phone, street_address: streets[cid - 1], city, province: prov, postal_code: postal };
};
const subtotalOf = (oid) => order_item.filter((i) => i.order_id === oid).reduce((s, i) => s + i.quantity * i.unit_price, 0);

// spread ordered_at over the last 58 days, completed ones older
const sorted = plan.map((kind) => ({ kind, days: kind === 'completed' ? int(8, 58) : kind === 'cancelled' ? int(3, 40) : kind === 'pending' ? int(0, 1) : int(0, 6) }))
  .sort((a, b) => b.days - a.days);
sorted.forEach(({ kind, days }, idx) => {
  const oid = idx + 1;
  const cid = int(1, customer.length);
  const ordered_at = at(days);
  const n = int(1, 3);
  const chosen = new Set();
  while (chosen.size < n) chosen.add(pick(active).product_id);
  for (const p of chosen) {
    const prod = product[p - 1];
    order_item.push({ order_id: oid, product_id: p, quantity: rnd() < 0.8 ? 1 : 2, unit_price: prod.price });
  }
  const sub = subtotalOf(oid);
  // promo: only when every item is promo-eligible and not on sale, and min_purchase met, code valid at ordered_at
  let promo = null, discount = 0;
  if (rnd() < 0.45) {
    const okItems = [...chosen].every((p) => product[p - 1].is_promo_eligible && !product[p - 1].compare_at_price);
    const candidates = promo_code.filter((c) => c.membership_id === null && c.starts_at <= ordered_at && c.ends_at >= ordered_at && sub >= c.min_purchase);
    if (okItems && candidates.length) {
      promo = pick(candidates);
      discount = promo.discount_type === 'percentage' ? Math.min(Math.round((sub * promo.discount_value) / 100 / 100) * 100, promo.max_discount ?? Infinity) : promo.discount_value;
    }
  }
  const service = pick(Object.keys(SHIP));
  const status = kind === 'completed' ? 'completed' : kind === 'cancelled' ? 'cancelled' : kind === 'pending' ? 'pending' : 'confirmed';
  const yymm = ordered_at.slice(2, 7).replace('-', '');
  orders.push({ order_id: oid, customer_id: cid, promo_code_id: promo?.promo_code_id ?? null, order_number: `SO-${yymm}-${pad(oid, 4)}`, order_type: 'regular', status, discount_amount: discount, shipping_cost: SHIP[service], ordered_at });
  const amount = sub - discount + SHIP[service];
  const paid = kind !== 'pending' && kind !== 'cancelled';
  const paid_at = paid ? addMinutes(ordered_at, int(3, 240)) : null;
  payment.push({ payment_id: oid, order_id: oid, method: pick(METHODS), amount, status: paid ? 'paid' : kind === 'cancelled' ? 'expired' : 'pending', reference_no: `PAY${ordered_at.slice(2, 10).replace(/-/g, '')}${pad(oid, 4)}`, paid_at });
  const shipStatus = { completed: 'delivered', shipped: 'shipped', packed: 'packed', pending: 'awaiting_payment', cancelled: 'cancelled' }[kind];
  const shipped_at = ['delivered', 'shipped'].includes(shipStatus) ? addMinutes(paid_at, int(600, 1800)) : null;
  const prefix = { jne_reg: 'JNE', jne_yes: 'JNY', sicepat_best: 'SCP', gosend_same_day: 'GSD', jt_ez: 'JT' }[service];
  shipment.push({
    shipment_id: oid, order_id: oid, shipping_service: service, ...addrOf(cid),
    tracking_number: shipped_at ? `${prefix}${int(1000000000, 9999999999)}` : null,
    status: shipStatus, shipped_at,
    delivered_at: shipStatus === 'delivered' ? addMinutes(shipped_at, int(1200, 4000)) : null,
  });
});

// ---------- points & tiers (consistent with completed orders) ----------
for (const m of membership) {
  const earned = orders
    .filter((o) => o.customer_id === m.customer_id && o.status === 'completed')
    .reduce((s, o) => s + Math.floor((subtotalOf(o.order_id) - o.discount_amount + o.shipping_cost) / 10000), 0);
  m.total_points = earned + int(20, 260);
  m.tier = m.total_points >= 600 ? 'all_access' : m.total_points >= 300 ? 'vip' : 'member';
  m.tier_valid_until = m.tier === 'member' ? null : dateOnly(-int(60, 300));
}

// ---------- reviews (only purchased & delivered) ----------
const titles = [
  [5, 'Ice-cold all day', 'Ice was still there by late afternoon after taking it to the office in the morning. The FlowState lid never leaked in my bag.'],
  [5, 'Gorgeous color', 'The color is exactly like the photos and the finish is smooth. Fits my car cup holder.'],
  [4, 'Great, a little heavy', 'Top quality as always, but it gets heavy when full on long walks.'],
  [5, 'Fast delivery', 'Packed neatly with thick bubble wrap and arrived in two days. Genuine product.'],
  [3, 'Straw is hard to clean', 'The tumbler is fine, but the straw needs a special brush. Hope a cleaning brush gets added.'],
  [4, 'Keeps coffee hot', 'My morning coffee is still warm at lunch. The handle is comfortable.'],
  [5, 'Perfect birthday gift', 'Bought it as a gift and they loved it. The box feels premium too.'],
  [2, 'Arrived with a scratch', 'There was a small scratch on the bottom. Support was quick to reply, but a bit disappointing.'],
  [5, 'Worth it', 'Premium price, but you can feel the quality. Used it every day for three months.'],
  [4, 'Great for hiking', 'Took it up Mount Prau and the water stayed cold. The lid seals tight.'],
];
const review = [];
const reviewed = new Set();
for (const o of orders.filter((x) => x.status === 'completed')) {
  for (const it of order_item.filter((i) => i.order_id === o.order_id)) {
    const k = o.customer_id + '|' + it.product_id;
    if (reviewed.has(k) || review.length >= 15 || rnd() < 0.25) continue;
    reviewed.add(k);
    const [rating, title, comment] = titles[review.length % titles.length];
    const del = shipment.find((s) => s.order_id === o.order_id).delivered_at;
    review.push({ customer_id: o.customer_id, product_id: it.product_id, rating, title, comment, created_at: addMinutes(del, int(600, 6000)) });
  }
}

// ---------- warranty claims ----------
const warranty_claim = [];
const completedItems = orders.filter((o) => o.status === 'completed').flatMap((o) => order_item.filter((i) => i.order_id === o.order_id).map((i) => ({ o, i })));
const photos = (p) => {
  const u = (p.image_url || '').slice(0, 200);
  return { photo_full_url: u, photo_bottom_url: u, photo_defect_url: u };
};
const issues = [
  'The FlowState lid cracked at the hinge after a fall from the table; water leaks when tilted.',
  'Lost its vacuum seal: hot drinks go cold within an hour and the outside wall gets hot.',
  'The powder coat is peeling at the base even though it was only hand-washed.',
  'The handle is loose and rattles; the screw no longer tightens.',
  'The lid gasket is torn, so the bottle leaks even when the lid is locked.',
  'A dent in the tumbler body stops the straw from going all the way in.',
];
const claimPlan = ['submitted', 'under_review', 'rejected', 'submitted', 'under_review', 'submitted'];
claimPlan.forEach((status, k) => {
  const online = k % 2 === 0 && completedItems[k];
  let c;
  if (online) {
    const { o, i } = completedItems[k];
    const p = product[i.product_id - 1];
    c = { customer_id: o.customer_id, product_id: p.product_id, order_id: o.order_id, store_id: null, purchase_place: 'stanley1913.co.id', purchase_date: o.ordered_at.slice(0, 10), ...photos(p) };
  } else {
    const p = pick(active);
    const s = pick(store);
    c = { customer_id: int(1, customer.length), product_id: p.product_id, order_id: null, store_id: s.store_id, purchase_place: s.store_name, purchase_date: `${int(2021, 2025)}-${pad(int(1, 12))}-${pad(int(1, 28))}`, ...photos(p) };
  }
  const submitted_at = at(int(1, 20));
  warranty_claim.push({
    warranty_claim_id: k + 1,
    ...c,
    replacement_order_id: null,
    claim_number: `WC-${submitted_at.slice(2, 7).replace('-', '')}-${pad(k + 1, 4)}`,
    date_code: `${pick(['A', 'B', 'C', 'D'])}${int(1, 9)}${int(10, 99)}`,
    issue_description: issues[k],
    status,
    rejection_reason: status === 'rejected' ? 'Damage caused by washing a non-dishwasher-safe product in a dishwasher, which the warranty does not cover.' : null,
    submitted_at,
    resolved_at: status === 'rejected' ? addMinutes(submitted_at, 2880) : null,
  });
});

const out = { anchor: ANCHOR, tables: { customer, membership, customer_address, category, product, promo_code, store, orders, order_item, payment, shipment, review, warranty_claim } };
const dest = fileURLToPath(new URL('../src/lib/seed-data.json', import.meta.url));
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log('wrote', dest, Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length])));
