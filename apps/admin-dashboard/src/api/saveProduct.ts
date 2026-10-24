import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Creates, updates or deletes a product',
  inputSchema: z.object({
    id: z.string().optional(),
    delete: z.boolean().optional(),
    data: z.object({
      sku: z.string(), name: z.string(), category: z.string(), imageUrl: z.string(),
      basePrice: z.number(), costPrice: z.number(), rrp: z.number().nullable(), stock: z.number(), status: z.enum(['Available', 'Discontinued']),
    }).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    if (input.delete && input.id) {
      await zite.products.delete({ id: input.id });
      return { success: true };
    }
    const d = input.data!;
    const record = {
      sku: d.sku, productName: d.name, category: d.category, basePrice: d.basePrice, costPrice: d.costPrice, rrp: d.rrp,
      stockLevel: d.stock, availabilityStatus: d.status,
      image: d.imageUrl ? [d.imageUrl] : [],
    } as never;
    if (input.id) await zite.products.update({ id: input.id, record });
    else await zite.products.create({ record });
    return { success: true };
  },
});
