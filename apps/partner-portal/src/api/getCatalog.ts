import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getCustomerForUser, unitPrice } from '../lib/customer';

export default createEndpoint({
  description: 'Lists the product catalog for the signed-in partner',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async ({ context }) => {
    const customer = await getCustomerForUser(context.user);
    const { records } = await zite.products.findAll({ limit: 2000 });
    const products = records
      .map((p) => {
        const base = p.basePrice ?? 0;
        const stock = p.stockLevel ?? 0;
        return {
          id: p.id,
          sku: p.sku ?? '',
          name: p.productName ?? '',
          category: p.category ?? 'Uncategorized',
          imageUrl: p.image?.[0]?.url ?? null,
          price: unitPrice(base),
          rrp: p.rrp ?? null,
          stock,
          orderable: stock > 0 && p.availabilityStatus !== 'Discontinued',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      companyName: customer.companyName ?? '',
      products,
    };
  },
});
