import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getCustomerForUser, unitPrice } from '../lib/customer';

export default createEndpoint({
  description: 'Saves the partner quick order as a draft or submits it (checks and deducts stock)',
  authenticated: true,
  inputSchema: z.object({
    items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
    submit: z.boolean(),
  }),
  outputSchema: z.object({ orderId: z.number().optional(), total: z.number() }),
  execute: async ({ input, context }) => {
    const customer = await getCustomerForUser(context.user);
    const lines = input.items.filter((i) => Number.isInteger(i.quantity) && i.quantity > 0);
    if (input.submit && lines.length === 0) throw new ZiteError('Add at least one item before submitting.', 'BAD_REQUEST');

    const { records: products } = await zite.products.findAll({ limit: 2000 });
    const byId = new Map(products.map((p) => [p.id, p]));

    const priced = lines.map((l) => {
      const p = byId.get(l.productId);
      if (!p) throw new ZiteError('A product in your order no longer exists.', 'BAD_REQUEST');
      if (input.submit) {
        const stock = p.stockLevel ?? 0;
        if (p.availabilityStatus === 'Discontinued' || stock <= 0)
          throw new ZiteError(`${p.productName} is out of stock.`, 'BAD_REQUEST');
        if (l.quantity > stock)
          throw new ZiteError(`Only ${stock} of ${p.productName} available.`, 'BAD_REQUEST');
      }
      return { ...l, product: p, unitPrice: unitPrice(p.basePrice ?? 0) };
    });
    const total = Math.round(priced.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;

    // Reuse existing draft, clearing its lines
    let order = await zite.orders.findOne({ filters: { customer: customer.id, orderStatus: 'Draft' } });
    if (order) {
      const { records: old } = await zite.orderItems.findAll({ filters: { order: order.id } });
      await Promise.all(old.map((o) => zite.orderItems.delete({ id: o.id })));
    } else {
      if (priced.length === 0) return { total: 0 };
      order = await zite.orders.create({
        record: { customer: customer.id, orderStatus: 'Draft', totalValue: 0 } as never,
      });
    }

    if (priced.length === 0) {
      await zite.orders.delete({ id: order.id });
      return { total: 0 };
    }

    for (let i = 0; i < priced.length; i += 100) {
      await zite.orderItems.bulkCreate({
        records: priced.slice(i, i + 100).map((l) => ({
          lineLabel: `${l.product.sku} × ${l.quantity}`,
          order: order!.id,
          product: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })) as never,
      });
    }

    await zite.orders.update({
      id: order.id,
      record: {
        totalValue: total,
        ...(input.submit ? { orderStatus: 'Submitted', datePlaced: new Date().toISOString() } : {}),
      } as never,
    });

    if (input.submit) {
      await Promise.all(
        priced.map((l) =>
          zite.products.update({
            id: l.productId,
            record: { stockLevel: (l.product.stockLevel ?? 0) - l.quantity } as never,
          }),
        ),
      );
      await zite.customers.update({
        id: customer.id,
        record: { totalBalance: (customer.totalBalance ?? 0) + total } as never,
      });
    }
    return { orderId: order.orderId, total };
  },
});
