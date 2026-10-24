import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { recordPayment } from '../lib/orders';

export default createEndpoint({
  description: 'Imports payments from a spreadsheet, matching each row to an order by its order number',
  inputSchema: z.object({
    payments: z.array(z.object({ orderNumber: z.number(), amount: z.number(), method: z.string(), date: z.string(), reference: z.string() })),
  }),
  outputSchema: z.object({ count: z.number(), skipped: z.array(z.string()) }),
  execute: async ({ input }) => {
    const { records: orders } = await zite.orders.findAll({ limit: 2000, fields: ['orderId'] as never });
    const byNum = new Map(orders.map((o) => [o.orderId, o.id]));
    const skipped: string[] = [];
    let count = 0;
    for (const p of input.payments) {
      const id = byNum.get(p.orderNumber);
      if (!id || p.amount <= 0) { skipped.push(`ORD-${String(p.orderNumber).padStart(4, '0')}`); continue; }
      await recordPayment({ orderId: id, amount: p.amount, method: p.method, date: p.date, reference: p.reference || undefined });
      count++;
    }
    if (!count && skipped.length) throw new ZiteError(`No matching orders found (${skipped.slice(0, 5).join(', ')})`, 'BAD_REQUEST');
    return { count, skipped };
  },
});
