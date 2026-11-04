// Validates the seed through the same constraint engine the app uses (Node 24 strips TS types).
import { configure, all, loadSeed } from '../src/lib/db.ts';
import { seedData } from '../src/lib/seed.ts';
import { orderTotal, pointsFor } from '../src/lib/derive.ts';

const mem = new Map();
configure({ storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }, seed: seedData });
loadSeed(seedData());

let problems = 0;
for (const p of all('payment')) {
  const o = all('orders').find((x) => x.order_id === p.order_id);
  if (orderTotal(o) !== p.amount) { problems++; console.error('amount mismatch', o.order_number, orderTotal(o), p.amount); }
}
for (const m of all('membership')) {
  const earned = all('orders').filter((o) => o.customer_id === m.customer_id && o.status === 'completed').reduce((s, o) => s + pointsFor(orderTotal(o)), 0);
  if (m.total_points < earned) { problems++; console.error('points below earned', m.membership_id); }
}
for (const r of all('review')) {
  const bought = all('order_item').some((i) => i.product_id === r.product_id && all('orders').some((o) => o.order_id === i.order_id && o.customer_id === r.customer_id));
  if (!bought) { problems++; console.error('review without purchase', r.customer_id, r.product_id); }
}
const counts = Object.fromEntries(['customer','membership','customer_address','category','product','promo_code','orders','order_item','payment','shipment','review','warranty_claim','store'].map((t) => [t, all(t).length]));
console.log('seed OK through constraint engine', counts);
if (problems) { console.error(problems, 'business-rule problems'); process.exit(1); }
