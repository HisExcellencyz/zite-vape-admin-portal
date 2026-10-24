import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Imports customers from a spreadsheet, updating existing ones by contact email',
  inputSchema: z.object({
    customers: z.array(z.object({
      company: z.string(), email: z.string(), address: z.string(), phone: z.string().optional(),
      lat: z.number().nullable(), lng: z.number().nullable(), plusCode: z.string(),
    })),
  }),
  outputSchema: z.object({ count: z.number() }),
  execute: async ({ input }) => {
    const rows = input.customers.filter((c) => c.email.trim() && c.company.trim());
    for (let i = 0; i < rows.length; i += 100) {
      await zite.customers.bulkCreate({
        matchOn: ['contactEmail'] as never,
        records: rows.slice(i, i + 100).map((c) => ({
          companyName: c.company.trim(), contactEmail: c.email.trim().toLowerCase(),
          tierLevel: 'Standard', shippingAddress: c.address,
          ...(c.phone ? { phone: c.phone } : {}),
          ...(c.lat != null && c.lng != null ? { latitude: c.lat, longitude: c.lng } : {}),
          ...(c.plusCode ? { plusCode: c.plusCode } : {}),
        })) as never,
      });
    }
    return { count: rows.length };
  },
});
