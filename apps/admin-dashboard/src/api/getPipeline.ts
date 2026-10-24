import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export default createEndpoint({
  description: 'Loads all placed orders with customer, lines, payments and finance totals',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => {
    const [{ records: orders }, { records: customers }, { records: payments }, { records: items }, { records: products }] =
      await Promise.all([
        zite.orders.findAll({ limit: 2000 }),
        zite.customers.findAll({ limit: 2000 }),
        zite.payments.findAll({ limit: 2000 }),
        zite.orderItems.findAll({ limit: 2000 }),
        zite.products.findAll({ limit: 2000, fields: ['sku', 'productName'] as never }),
      ]);
    const custMap = new Map(customers.map((c) => [c.id, c]));
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const list = orders
      .filter((o) => o.orderStatus && o.orderStatus !== 'Draft')
      .map((o) => {
        const c = custMap.get(arr(o.customer)[0] ?? '');
        const pays = payments.filter((p) => arr(p.order).includes(o.id)).map((p) => ({
          id: p.id, reference: p.reference ?? '', amount: p.amountPaid ?? 0, date: p.paymentDate ?? null, method: p.paymentMethod ?? '',
        }));
        const lines = items.filter((i) => arr(i.order).includes(o.id)).map((i) => {
          const p = prodMap.get(arr(i.product)[0] ?? '');
          return { sku: p?.sku ?? '', name: p?.productName ?? i.lineLabel ?? '', quantity: i.quantity ?? 0, unitPrice: i.unitPrice ?? 0 };
        });
        const total = o.totalValue ?? 0;
        const paid = pays.reduce((s, p) => s + p.amount, 0);
        return {
          id: o.id,
          orderId: o.orderId ?? 0,
          status: o.orderStatus!,
          datePlaced: o.datePlaced ?? null,
          tracking: o.trackingNumber ?? '',
          customerId: c?.id ?? '',
          customerName: c?.companyName ?? 'Unknown',
          customerEmail: c?.contactEmail ?? '',
          customerAddress: c?.shippingAddress ?? '',
          customerTier: c?.tierLevel ?? '',
          total, paid,
          balance: Math.max(0, total - paid),
          paymentStatus: paid <= 0 ? 'Unpaid' : paid >= total ? 'Fully Paid' : 'Deposit Made',
          lines, payments: pays,
        };
      })
      .sort((a, b) => b.orderId - a.orderId);

    return {
      orders: list,
      totals: {
        receivable: list.reduce((s, o) => s + o.balance, 0),
        deposits: list.filter((o) => o.paymentStatus === 'Deposit Made').reduce((s, o) => s + o.paid, 0),
        inProgress: list.filter((o) => o.status !== 'Completed').length,
      },
    };
  },
});
