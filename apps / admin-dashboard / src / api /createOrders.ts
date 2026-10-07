import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { createOrderRecord } from '../lib/orders';

const STATUSES = ['Submitted', 'Awaiting Deposit', 'Processing', 'Completed'] as const;

export default createEndpoint({
  description: 'Creates one or more orders on behalf of customers (manual entry or spreadsheet import)',
  inputSchema: z.object({
    orders: z.array(z.object({
      customerId: z.string().optional(),
      customerEmail: z.string().optional(),
      date: z.string(),
      status: z.string(),
      lines: z.array(z.object({ productId: z.string().optional(), sku: z.string().optional(), quantity: z.number(), unitPrice: z.number().optional() })),
    })),
  }),
  outputSchema: z.object({ count: z.number(), skipped: z.array(z.string()) }),
  execute: async ({ input }) => {
    const [{ records: products }, { records: customers }] = await Promise.all([
      zite.products.findAll({ limit: 2000 }),
      zite.customers.findAll({ limit: 2000, fields: ['contactEmail', 'companyName'] as never }),
    ]);
    const bySku = new Map(products.map((p) => [(p.sku ?? '').toLowerCase(), p.id]));
    const byEmail = new Map(customers.map((c) => [(c.contactEmail ?? '').toLowerCase(), c.id]));
    const byName = new Map(customers.map((c) => [(c.companyName ?? '').toLowerCase(), c.id]));
    const skipped: string[] = [];
    let count = 0;
    for (const o of input.orders) {
      const key = (o.customerEmail ?? '').trim().toLowerCase();
      const customerId = o.customerId || byEmail.get(key) || byName.get(key);
      const lines = o.lines.map((l) => ({ ...l, productId: l.productId || bySku.get((l.sku ?? '').trim().toLowerCase()) }));
      const bad = lines.find((l) => !l.productId);
      if (!customerId || bad) { skipped.push(!customerId ? `Unknown customer "${o.customerEmail}"` : `Unknown SKU "${bad!.sku}"`); continue; }
      await createOrderRecord({
        customerId, date: o.date, status: (STATUSES as readonly string[]).includes(o.status) ? o.status : 'Submitted',
        lines: lines.map((l) => ({ productId: l.productId!, quantity: l.quantity, unitPrice: l.unitPrice })),
      }, products);
      count++;
    }
    return { count, skipped };
  },
});
