import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Imports products from a spreadsheet, updating existing ones by SKU',
  inputSchema: z.object({
    products: z.array(z.object({
      sku: z.string(), name: z.string(), category: z.string(),
      basePrice: z.number(), costPrice: z.number().optional(), rrp: z.number().optional(), stock: z.number(), status: z.string(), imageUrl: z.string().optional(),
    })),
  }),
  outputSchema: z.object({ count: z.number() }),
  execute: async ({ input }) => {
    const rows = input.products.filter((p) => p.sku.trim());
    for (let i = 0; i < rows.length; i += 100) {
      await zite.products.bulkCreate({
        matchOn: ['sku'] as never,
        records: rows.slice(i, i + 100).map((p) => ({
          sku: p.sku.trim(), productName: p.name, category: p.category,
          basePrice: p.basePrice, stockLevel: p.stock,
          ...(p.costPrice != null ? { costPrice: p.costPrice } : {}), ...(p.rrp != null ? { rrp: p.rrp } : {}),
          ...(p.imageUrl ? { image: [p.imageUrl] } : {}),
          availabilityStatus: p.status === 'Discontinued' ? 'Discontinued' : 'Available',
        })) as never,
      });
    }
    return { count: rows.length };
  },
});
