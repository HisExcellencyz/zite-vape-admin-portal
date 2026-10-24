import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { findCustomerForUser } from '../lib/customer';

export default createEndpoint({
  description: "Returns the signed-in partner's company profile, or null if they haven't set one up",
  inputSchema: z.object({}),
  outputSchema: z.object({
    company: z.object({ id: z.string(), name: z.string() }).nullable(),
  }),
  execute: async ({ context }) => {
    const c = await findCustomerForUser(context.user);
    return { company: c ? { id: c.id, name: c.companyName ?? '' } : null };
  },
});
