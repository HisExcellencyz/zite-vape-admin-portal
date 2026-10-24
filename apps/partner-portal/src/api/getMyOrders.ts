import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getCustomerForUser, asArray } from '../lib/customer';

export default createEndpoint({
  description: "Lists the signed-in partner's orders with line items, payments and balances",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async ({ context }) => {
    const customer = await getCustomerForUser(context.user);
    const { records: orders } = await zite.orders.findAll({ filters: { customer: customer.id }, limit: 2000 });
    const placed = orders.filter((o) => o.orderStatus !== 'Draft');
    const ids = placed.map((o) => o.id);
    const idSet = new Set(ids);
    const [itemsRes, paymentsRes, productsRes] = await Promise.all([
      zite.orderItems.findAll({ limit: 2000 }),
      zite.payments.findAll({ limit: 2000 }),
      zite.products.findAll({ limit: 2000 }),
    ]);
    const items = itemsRes.records.filter((i) => asArray(i.order).some((x) => idSet.has(x)));
    const payments = paymentsRes.records.filter((p) => asArray(p.order).some((x) => idSet.has(x)));
    const prodMap = new Map(productsRes.records.map((p) => [p.id, p] as const));

    const result = placed
      .map((o) => {
        const lines = items
          .filter((i) => asArray(i.order).includes(o.id))
          .map((i) => {
            const p = prodMap.get(asArray(i.product)[0] ?? '');
            return {
              sku: p?.sku ?? '',
              name: p?.productName ?? i.lineLabel ?? '',
              quantity: i.quantity ?? 0,
              unitPrice: i.unitPrice ?? 0,
            };
          });
        const pays = payments
          .filter((p) => asArray(p.order).includes(o.id))
          .map((p) => ({
            id: p.id,
            amount: p.amountPaid ?? 0,
            date: p.paymentDate ?? null,
            method: p.paymentMethod ?? '',
          }));
        const total = o.totalValue ?? 0;
        const paid = pays.reduce((s, p) => s + p.amount, 0);
        return {
          id: o.id,
          orderId: o.orderId ?? 0,
          datePlaced: o.datePlaced ?? null,
          status: o.orderStatus ?? 'Submitted',
          tracking: o.trackingNumber ?? '',
          total,
          paid,
          balance: Math.max(0, total - paid),
          paymentStatus: paid <= 0 ? 'Unpaid' : paid >= total ? 'Fully Paid' : 'Deposit Made',
          lines,
          payments: pays,
        };
      })
      .sort((a, b) => b.orderId - a.orderId);

    return {
      company: {
        name: customer.companyName ?? '',
        address: customer.shippingAddress ?? '',
        email: customer.contactEmail ?? '',
      },
      orders: result,
      totals: {
        pending: result.reduce((s, o) => s + o.balance, 0),
        deposits: result.reduce((s, o) => s + o.paid, 0),
        open: result.filter((o) => o.status !== 'Completed').length,
      },
    };
  },
});
