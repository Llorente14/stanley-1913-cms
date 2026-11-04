// Business-rule chains (Step 2.4 general constraints + user transactions T3, T4, T7, T8).
// Each function runs in one transaction and returns human-readable effects for the UI/log.
import { all, get, insert, update, where, transaction, DbError, nextId } from './db.ts';
import { orderItems, orderTotal, pointsFor, tierFor, membershipOf, nowLocal, localDate } from './derive.ts';
import { ENUM_LABELS, type Row } from './schema.ts';

const L = (v: string) => (ENUM_LABELS[v] ?? v).toLowerCase();

type Effects = string[];

function shipmentOf(orderId: number) {
  return all('shipment').find((s) => s.order_id === orderId);
}
function paymentOf(orderId: number) {
  return all('payment').find((p) => p.order_id === orderId);
}

function addYear(dateStr: string) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return localDate(d);
}

export function trackingNumber(service: string) {
  const prefix: Record<string, string> = { jne_reg: 'JNE', jne_yes: 'JNY', sicepat_best: 'SCP', gosend_same_day: 'GSD', jt_ez: 'JT' };
  const digits = String(Date.now()).slice(-10);
  return (prefix[service] ?? 'TRK') + digits;
}

export function setPaymentStatus(paymentId: number, status: string): Effects {
  return transaction(() => {
    const pay = get('payment', paymentId);
    if (!pay) throw new DbError('This payment no longer exists.', 'not_found');
    const order = get('orders', pay.order_id)!;
    const fx: Effects = [];
    if (pay.status === status) return fx;
    if (order.status === 'cancelled') throw new DbError('This order was cancelled, so its payment can no longer change.', 'workflow');
    if (pay.status === 'paid') throw new DbError('A paid payment cannot be changed. Refunds are not supported.', 'workflow');

    update('payment', paymentId, { status, paid_at: status === 'paid' ? nowLocal() : null });
    fx.push(`Payment ${pay.reference_no} marked ${L(status)}`);

    if (status === 'paid') {
      update('orders', order.order_id, { status: 'confirmed' });
      fx.push(`Order ${order.order_number} confirmed`);
      const sh = shipmentOf(order.order_id);
      if (sh && sh.status === 'awaiting_payment') {
        update('shipment', sh.shipment_id, { status: 'packed' });
        fx.push('Package ready to pack');
      }
    }
    if (status === 'expired') fx.push(...cancelOrderInner(order.order_id, 'expired'));
    return fx;
  });
}

export function setShipmentStatus(shipmentId: number, status: string, tracking?: string): Effects {
  return transaction(() => {
    const sh = get('shipment', shipmentId);
    if (!sh) throw new DbError('This shipment no longer exists.', 'not_found');
    const order = get('orders', sh.order_id)!;
    const fx: Effects = [];
    const flow = ['awaiting_payment', 'packed', 'shipped', 'delivered'];
    if (sh.status === 'cancelled' || sh.status === 'delivered') throw new DbError(`This shipment is already ${L(sh.status)} and cannot change.`, 'workflow');
    if (status === 'cancelled') return cancelOrderInner(order.order_id);
    if (flow.indexOf(status) < flow.indexOf(sh.status)) throw new DbError('A shipment cannot move back to an earlier step.', 'workflow');
    if (status !== 'awaiting_payment' && order.order_type === 'regular') {
      const pay = paymentOf(order.order_id);
      if (!pay || pay.status !== 'paid') throw new DbError('This order is not paid yet. Ship it after the payment is received.', 'workflow');
    }
    const patch: Row = { status };
    if (status === 'shipped' || status === 'delivered') {
      patch.tracking_number = tracking || sh.tracking_number || trackingNumber(sh.shipping_service);
      patch.shipped_at = sh.shipped_at ?? nowLocal();
    }
    if (status === 'delivered') patch.delivered_at = nowLocal();
    update('shipment', shipmentId, patch);
    fx.push(`Package ${L(status)}${patch.tracking_number && !sh.tracking_number ? ` (tracking ${patch.tracking_number})` : ''}`);

    if (status === 'delivered') {
      update('orders', order.order_id, { status: 'completed' });
      fx.push(`Order ${order.order_number} completed`);
      const m = membershipOf(order.customer_id);
      if (m && order.order_type === 'regular') {
        const pts = pointsFor(orderTotal(order));
        const total = m.total_points + pts;
        const tier = tierFor(total);
        const upgraded = tier !== m.tier && ['member', 'vip', 'all_access'].indexOf(tier) > ['member', 'vip', 'all_access'].indexOf(m.tier);
        update('membership', m.membership_id, {
          total_points: total,
          ...(upgraded ? { tier, tier_valid_until: addYear(nowLocal()) } : {}),
        });
        fx.push(`+${pts} member points (total ${total})${upgraded ? `, upgraded to ${ENUM_LABELS[tier]}` : ''}`);
      }
    }
    return fx;
  });
}

function cancelOrderInner(orderId: number, paymentStatus = 'expired'): Effects {
  const order = get('orders', orderId)!;
  const fx: Effects = [];
  if (order.status === 'completed') throw new DbError('A completed order cannot be cancelled.', 'workflow');
  if (order.status === 'cancelled') return fx;
  const sh = shipmentOf(orderId);
  if (sh && (sh.status === 'shipped' || sh.status === 'delivered')) throw new DbError('The package has already shipped, so this order cannot be cancelled.', 'workflow');
  const pay = paymentOf(orderId);
  if (pay && pay.status === 'paid') throw new DbError('This order is already paid. Cancelling would need a refund, which is not supported.', 'workflow');

  update('orders', orderId, { status: 'cancelled' });
  fx.push(`Order ${order.order_number} cancelled`);
  for (const it of orderItems(orderId)) {
    const p = get('product', it.product_id);
    if (p) update('product', p.product_id, { stock_qty: p.stock_qty + it.quantity });
  }
  fx.push('Stock returned');
  if (pay && pay.status !== paymentStatus && pay.status !== 'failed') {
    update('payment', pay.payment_id, { status: paymentStatus, paid_at: null });
    fx.push(`Payment marked ${L(paymentStatus)}`);
  }
  if (sh) {
    update('shipment', sh.shipment_id, { status: 'cancelled' });
    fx.push('Shipment cancelled');
  }
  return fx;
}

export function cancelOrder(orderId: number): Effects {
  return transaction(() => cancelOrderInner(orderId));
}

export interface ShipTo {
  shipping_service: string;
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  city: string;
  province: string;
  postal_code: string;
}

/** Best-known address for a customer: latest shipment, else first saved address. */
export function defaultShipTo(customerId: number): ShipTo {
  const orders = where('orders', (o) => o.customer_id === customerId).sort((a, b) => (a.ordered_at < b.ordered_at ? 1 : -1));
  for (const o of orders) {
    const sh = shipmentOf(o.order_id);
    if (sh) return { ...pick(sh), shipping_service: 'jne_reg' };
  }
  const m = membershipOf(customerId);
  const addr = m ? all('customer_address').find((a) => a.membership_id === m.membership_id) : undefined;
  const c = get('customer', customerId);
  return {
    shipping_service: 'jne_reg',
    recipient_name: addr?.recipient_name ?? c?.full_name ?? '',
    recipient_phone: addr?.recipient_phone ?? c?.phone ?? '',
    street_address: addr?.street_address ?? '',
    city: addr?.city ?? '',
    province: addr?.province ?? '',
    postal_code: addr?.postal_code ?? '',
  };
}

function pick(s: Row): Omit<ShipTo, 'shipping_service'> {
  const { recipient_name, recipient_phone, street_address, city, province, postal_code } = s;
  return { recipient_name, recipient_phone, street_address, city, province, postal_code };
}

export function orderNumber(date = new Date()) {
  const yymm = localDate(date).slice(2, 7).replace('-', '');
  const n = String(nextId('orders')).padStart(4, '0');
  return `SO-${yymm}-${n}`;
}

export function setClaimStatus(claimId: number, status: string, opts: { reason?: string; shipTo?: ShipTo } = {}): Effects {
  return transaction(() => {
    const c = get('warranty_claim', claimId);
    if (!c) throw new DbError('This claim no longer exists.', 'not_found');
    if (c.status === 'approved' || c.status === 'rejected') throw new DbError('This claim has already been decided.', 'workflow');
    const fx: Effects = [];
    if (status === 'under_review' || status === 'submitted') {
      update('warranty_claim', claimId, { status });
      fx.push(`Claim ${c.claim_number} ${L(status)}`);
      return fx;
    }
    if (status === 'rejected') {
      update('warranty_claim', claimId, { status, rejection_reason: opts.reason ?? '', resolved_at: nowLocal() });
      fx.push(`Claim ${c.claim_number} rejected`);
      return fx;
    }
    // approved → replacement order Rp0, no Payment (T7)
    const p = get('product', c.product_id)!;
    if (p.stock_qty < 1) throw new DbError(`${p.name} (${p.color}) is out of stock. Add stock before approving this claim.`, 'CHECK (stock_qty >= 0)');
    if (!opts.shipTo) throw new DbError('A shipping address for the replacement is required.', 'NOT NULL');
    const order = insert('orders', {
      customer_id: c.customer_id,
      promo_code_id: null,
      order_number: orderNumber(),
      order_type: 'warranty_replacement',
      status: 'confirmed',
      discount_amount: 0,
      shipping_cost: 0,
      ordered_at: nowLocal(),
    });
    insert('order_item', { order_id: order.order_id, product_id: p.product_id, quantity: 1, unit_price: 0 });
    update('product', p.product_id, { stock_qty: p.stock_qty - 1 });
    insert('shipment', { order_id: order.order_id, ...opts.shipTo, status: 'packed', tracking_number: null });
    update('warranty_claim', claimId, { status: 'approved', replacement_order_id: order.order_id, resolved_at: nowLocal(), rejection_reason: null });
    fx.push(`Claim ${c.claim_number} approved`, `Free replacement order ${order.order_number} created`, 'Package ready to pack', `Stock for ${p.sku} −1`);
    return fx;
  });
}
