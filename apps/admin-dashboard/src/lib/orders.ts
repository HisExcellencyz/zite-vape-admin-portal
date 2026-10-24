import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export type NewOrder = {
  customerId: string;
  date: string;
  status: string;
  lines: { productId: string; quantity: number; unitPrice?: number }[];
};

/** Creates a placed order on behalf of a customer: adds lines, deducts stock and raises the customer balance. */
export async function createOrderRecord(o: NewOrder, products: Awaited<ReturnType<typeof zite.products.findAll>>['records']) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = o.lines.filter((l) => l.quantity > 0).map((l) => {
    const p = byId.get(l.productId);
    if (!p) throw new ZiteError('A product on this order no longer exists', 'BAD_REQUEST');
    return { ...l, product: p, unitPrice: l.unitPrice ?? p.basePrice ?? 0 };
  });
  if (!lines.length) throw new ZiteError('Add at least one product line', 'BAD_REQUEST');
  const customer = await zite.customers.findOne({ id: o.customerId });
  if (!customer) throw new ZiteError('Customer not found', 'BAD_REQUEST');
  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;

  const order = await zite.orders.create({
    record: { customer: customer.id, orderStatus: o.status, totalValue: total, datePlaced: new Date(o.date).toISOString() } as never,
  });
  await zite.orderItems.bulkCreate({
    records: lines.map((l) => ({
      lineLabel: `${l.product.sku} × ${l.quantity}`, order: order.id, product: l.productId, quantity: l.quantity, unitPrice: l.unitPrice,
    })) as never,
  });
  await Promise.all(lines.map((l) => {
    const p = byId.get(l.productId)!;
    p.stockLevel = (p.stockLevel ?? 0) - l.quantity;
    return zite.products.update({ id: p.id, record: { stockLevel: p.stockLevel } as never });
  }));
  await zite.customers.update({ id: customer.id, record: { totalBalance: (customer.totalBalance ?? 0) + total } as never });
  return order;
}

export type NewPayment = { orderId: string; amount: number; method: string; date: string; reference?: string };

/** Records a payment against an order and lowers the customer balance. */
export async function recordPayment(input: NewPayment) {
  const order = await zite.orders.findOne({ id: input.orderId });
  if (!order) throw new ZiteError('Order not found', 'NOT_FOUND');
  const { records: existing } = await zite.payments.findAll({ filters: { order: order.id } });
  const paid = existing.reduce((s, p) => s + (p.amountPaid ?? 0), 0) + input.amount;
  const paymentStatus = paid >= (order.totalValue ?? 0) ? 'Fully Paid' : 'Deposit Made';
  const method = ['Bank Transfer', 'Mobile Money', 'Card', 'Cash'].includes(input.method) ? input.method : 'Bank Transfer';
  await zite.payments.create({
    record: {
      reference: input.reference || `PAY-${order.orderId}-${existing.length + 1}`,
      order: order.id, amountPaid: input.amount, paymentDate: input.date, paymentMethod: method, paymentStatus,
    } as never,
  });
  const custId = arr(order.customer)[0];
  if (custId) {
    const c = await zite.customers.findOne({ id: custId });
    if (c) await zite.customers.update({ id: c.id, record: { totalBalance: (c.totalBalance ?? 0) - input.amount } as never });
  }
  return paymentStatus;
}
