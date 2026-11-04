// Derived values (never stored): order subtotal/total (T3), KPIs, chart series.
import { all, get, where } from './db.ts';
import type { Row } from './schema.ts';

export function orderItems(orderId: number) {
  return where('order_item', (i) => i.order_id === orderId);
}

export function orderSubtotal(orderId: number): number {
  return orderItems(orderId).reduce((s, i) => s + i.quantity * i.unit_price, 0);
}

/** amount = SUM(quantity × unit_price) − discount_amount + shipping_cost */
export function orderTotal(order: Row): number {
  return Math.max(0, orderSubtotal(order.order_id) - order.discount_amount + order.shipping_cost);
}

export function pointsFor(total: number) {
  return Math.floor(total / 10000);
}

export function tierFor(points: number): 'member' | 'vip' | 'all_access' {
  if (points >= 600) return 'all_access';
  if (points >= 300) return 'vip';
  return 'member';
}

export function customerName(customerId: number) {
  return get('customer', customerId)?.full_name ?? `#${customerId}`;
}

export function membershipOf(customerId: number) {
  return all('membership').find((m) => m.customer_id === customerId);
}

export function productLabel(p: Row | undefined) {
  if (!p) return '—';
  return `${p.name} · ${p.color}`;
}

export function categoryPath(categoryId: number | null): string {
  const parts: string[] = [];
  let cur = categoryId != null ? get('category', categoryId) : undefined;
  let guard = 0;
  while (cur && guard++ < 10) {
    parts.unshift(cur.name);
    cur = cur.parent_category_id != null ? get('category', cur.parent_category_id) : undefined;
  }
  return parts.join(' › ');
}

const isRevenue = (o: Row) => o.order_type === 'regular' && (o.status === 'confirmed' || o.status === 'completed');

export function kpis(now = new Date()) {
  const orders = all('orders');
  const monthKey = localDate(now).slice(0, 7);
  const prev = localDate(new Date(now.getFullYear(), now.getMonth() - 1, 15)).slice(0, 7);
  const sumMonth = (key: string) =>
    orders.filter((o) => isRevenue(o) && o.ordered_at.startsWith(key)).reduce((s, o) => s + orderTotal(o), 0);
  return {
    revenueMonth: sumMonth(monthKey),
    revenuePrevMonth: sumMonth(prev),
    pendingPayment: orders.filter((o) => o.status === 'pending').length,
    toShip: all('shipment').filter((s) => s.status === 'packed').length,
    lowStock: all('product').filter((p) => p.is_active && p.stock_qty <= 5).length,
    openClaims: all('warranty_claim').filter((c) => c.status === 'submitted' || c.status === 'under_review').length,
    members: all('membership').length,
    customers: all('customer').length,
  };
}

/** Daily revenue for the last `days` days (local dates). */
export function revenueSeries(days = 30, now = new Date()) {
  const out: { date: string; value: number; orders: number }[] = [];
  const map = new Map<string, { value: number; orders: number }>();
  for (const o of all('orders')) {
    if (!isRevenue(o)) continue;
    const d = o.ordered_at.slice(0, 10);
    const cur = map.get(d) ?? { value: 0, orders: 0 };
    cur.value += orderTotal(o);
    cur.orders += 1;
    map.set(d, cur);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localDate(d);
    const v = map.get(key) ?? { value: 0, orders: 0 };
    out.push({ date: key, ...v });
  }
  return out;
}

export function topProducts(limit = 5) {
  const qty = new Map<number, { qty: number; revenue: number }>();
  const valid = new Set(all('orders').filter(isRevenue).map((o) => o.order_id));
  for (const i of all('order_item')) {
    if (!valid.has(i.order_id)) continue;
    const cur = qty.get(i.product_id) ?? { qty: 0, revenue: 0 };
    cur.qty += i.quantity;
    cur.revenue += i.quantity * i.unit_price;
    qty.set(i.product_id, cur);
  }
  return [...qty.entries()]
    .map(([product_id, v]) => ({ product: get('product', product_id), ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function localDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowLocal(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${localDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
