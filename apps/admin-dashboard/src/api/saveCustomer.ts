import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Creates, updates or deletes a customer company',
  inputSchema: z.object({
    id: z.string().optional(),
    delete: z.boolean().optional(),
    data: z.object({
      company: z.string(), email: z.string(), address: z.string(), phone: z.string().optional(),
      lat: z.number().nullable().optional(), lng: z.number().nullable().optional(), plusCode: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    if (input.delete && input.id) {
      await zite.customers.delete({ id: input.id });
      return { success: true };
    }
    const d = input.data!;
    const record = { companyName: d.company, contactEmail: d.email.trim().toLowerCase(), tierLevel: 'Standard', shippingAddress: d.address, phone: d.phone ?? '', latitude: d.lat ?? null, longitude: d.lng ?? null, plusCode: d.plusCode ?? '' } as never;
    if (input.id) await zite.customers.update({ id: input.id, record });
    else await zite.customers.create({ record: { ...(record as object), totalBalance: 0 } as never });
    return { success: true };
  },
});
