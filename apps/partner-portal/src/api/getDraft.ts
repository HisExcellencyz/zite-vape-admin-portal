import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getCustomerForUser, asArray } from '../lib/customer';

export default createEndpoint({
  description: "Returns the signed-in partner's saved draft order quantities",
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ items: z.record(z.number()) }),
  execute: async ({ context }) => {
    const customer = await getCustomerForUser(context.user);
    const draft = await zite.orders.findOne({ filters: { customer: customer.id, orderStatus: 'Draft' } });
    const items: Record<string, number> = {};
    if (!draft) return { items };
    const { records } = await zite.orderItems.findAll({ filters: { order: draft.id } });
    for (const r of records) {
      const pid = asArray(r.product)[0];
      if (pid) items[pid] = r.quantity ?? 0;
    }
    return { items };
  },
});
