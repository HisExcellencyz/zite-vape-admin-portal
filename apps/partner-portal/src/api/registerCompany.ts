import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { findCustomerForUser } from '../lib/customer';

// A partner who signs up with the contact email the admin saved is linked to that company
// (see findCustomerForUser). Otherwise a new company is created here; if the admin had already
// added the same business under another email, the admin merges the two on the Customers page.
export default createEndpoint({
  description: 'Creates a company profile for a partner who signed themselves up',
  inputSchema: z.object({
    company: z.string(),
    address: z.string(),
    phone: z.string().optional(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    plusCode: z.string(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    if (!input.company.trim()) throw new ZiteError('Company name is required', 'BAD_REQUEST');
    const existing = await findCustomerForUser(context.user);
    if (existing) return { id: existing.id };
    const c = await zite.customers.create({
      record: {
        companyName: input.company.trim(),
        contactEmail: context.user.email.toLowerCase(),
        tierLevel: 'Standard',
        shippingAddress: input.address.trim(),
        phone: (input.phone || '').trim(),
        totalBalance: 0,
        latitude: input.lat,
        longitude: input.lng,
        plusCode: input.plusCode,
        portalUsers: [context.user.id],
      } as never,
    });
    return { id: c.id };
  },
});
